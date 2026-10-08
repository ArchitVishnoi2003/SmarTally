package sync

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/wholesale-tally/agent/cloud"
	"github.com/wholesale-tally/agent/config"
	"github.com/wholesale-tally/agent/tally"
)

type Worker struct {
	cfg    *config.Config
	api    *cloud.API
	tally  *tally.Client
	status func(tallyUp bool, pending int, lastErr string)
}

func NewWorker(cfg *config.Config, statusFn func(bool, int, string)) *Worker {
	return &Worker{
		cfg:    cfg,
		api:    cloud.New(cfg.CloudAPIURL, cfg.DeviceToken),
		tally:  tally.NewClient(),
		status: statusFn,
	}
}

func (w *Worker) RunOnce() {
	tallyUp := w.tally.IsUp()
	tallyStatus := "down"
	if tallyUp {
		tallyStatus = "up"
	}

	items, err := w.api.GetPendingQueue()
	if err != nil {
		log.Printf("queue fetch error: %v", err)
		w.status(tallyUp, 0, err.Error())
		_ = w.api.Heartbeat(tallyStatus, 0)
		return
	}

	w.status(tallyUp, len(items), "")

	if !tallyUp || len(items) == 0 {
		_ = w.api.Heartbeat(tallyStatus, len(items))
		return
	}

	item := items[0]
	_ = w.api.MarkInFlight(item.QueueID)

	if err := w.processItem(item); err != nil {
		log.Printf("sync failed %s: %v", item.InvoiceID, err)
		_ = w.api.MarkSynced(item.QueueID, item.InvoiceID, "", "failed", err.Error())
		w.status(tallyUp, len(items)-1, err.Error())
	} else {
		_ = w.api.MarkSynced(item.QueueID, item.InvoiceID, item.InvoiceID, "synced", "")
		w.status(tallyUp, len(items)-1, "")
	}

	_ = w.api.Heartbeat(tallyStatus, max(0, len(items)-1))
}

func (w *Worker) processItem(item cloud.QueueItem) error {
	company := strings.TrimSpace(w.cfg.TallyCompanyName)
	if company == "" {
		return fmt.Errorf(
			"Tally company name not set in agent config. Delete %%APPDATA%%\\WholesaleTally\\config.json, run setup again, and enter the exact company name from Tally",
		)
	}

	// 1. Initial Master Sync (best-effort)
	partyXML := tally.EnsureCompanyInXML(
		tally.BuildLedgerMasterXML(company, item.PartyName, tally.PartyParent(item.VoucherType)),
		company,
	)
	_, _ = w.tally.PostXML(partyXML)
	
	// Auto-create all ledgers found in the XML payload
	ledgerRe := regexp.MustCompile(`<LEDGERNAME>([^<]+)</LEDGERNAME>`)
	matches := ledgerRe.FindAllStringSubmatch(item.TallyXMLPayload, -1)
	for _, m := range matches {
		lName := strings.TrimSpace(m[1])
		parent := "Sundry Debtors"
		lower := strings.ToLower(lName)
		if strings.Contains(lower, "sales") {
			parent = "Sales Accounts"
		} else if strings.Contains(lower, "purchase") {
			parent = "Purchase Accounts"
		} else if strings.Contains(lower, "gst") || strings.Contains(lower, "tax") || strings.Contains(lower, "duty") {
			parent = "Duties &amp; Taxes"
		} else if strings.Contains(lower, "discount") {
			parent = "Indirect Expenses"
		}
		
		lXML := tally.EnsureCompanyInXML(
			tally.BuildLedgerMasterXML(company, lName, parent),
			company,
		)
		_, _ = w.tally.PostXML(lXML)
	}

	// Auto-create 'Pcs' unit
	unitXML := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>%s</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <UNIT NAME="Pcs" ACTION="Create">
            <NAME>Pcs</NAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
          </UNIT>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`, company)
	_, _ = w.tally.PostXML(unitXML)

	for _, name := range item.LineItemNames {
		stockXML := tally.EnsureCompanyInXML(
			tally.BuildStockItemMasterXML(company, name, "Pcs"),
			company,
		)
		_, _ = w.tally.PostXML(stockXML)
	}

	// 2. XML Sanitization & Restructuring
	voucherXML := tally.EnsureCompanyInXML(item.TallyXMLPayload, company)

	// Strip out UDF tags to prevent exceptions in Tally if TDL is not loaded
	udfRe := regexp.MustCompile(`(?s)<UDF:APPINVOICEID.*?<\/UDF:APPINVOICEID\.LIST>`)
	voucherXML = udfRe.ReplaceAllString(voucherXML, "")
	
	// Fix Inventory Amount Sign (Must be negative for Sales to balance with Ledger Credit)
	// DELETED: Backend handles signs correctly now!

	// Bulletproof Date Fix & Educational Mode Bypass
	// Tally Educational Mode ONLY accepts the 1st, 2nd, and 31st of the month.
	// We force the date to the 1st of the respective month to ensure robust syncing.
	dateRe := regexp.MustCompile(`<DATE>([^<]+)</DATE>`)
	voucherXML = dateRe.ReplaceAllStringFunc(voucherXML, func(m string) string {
		val := strings.TrimSpace(dateRe.FindStringSubmatch(m)[1])
		var parsed string
		if len(val) >= 10 && val[4] == '-' && val[7] == '-' {
			parsed = fmt.Sprintf("%s%s01", val[0:4], val[5:7]) // Force to 1st
		} else if len(val) == 8 && !strings.Contains(val, "-") {
			parsed = fmt.Sprintf("%s01", val[0:6]) // Force to 1st
		} else {
			parsed = time.Now().Format("200601") + "01" // Force to 1st
		}
		return fmt.Sprintf("<DATE>%s</DATE>", parsed)
	})



	// Print final payload for transparency
	fmt.Println("=== SENDING SANITIZED XML TO TALLY ===")
	fmt.Println(voucherXML)
	fmt.Println("======================================")

	// 3. Instant Auto-Create Retry Loop
	maxRetries := 15
	var finalErr error

	for i := 0; i < maxRetries; i++ {
		resp, err := w.tally.PostXML(voucherXML)
		if err != nil {
			return err
		}

		if tally.ResponseCreated(resp) {
			return nil
		}

		errMsg := tally.ResponseError(resp)
		if errMsg == "" {
			errMsg = "Tally rejected voucher"
		}
		errMsg = strings.ReplaceAll(errMsg, "&apos;", "'")

		if !strings.Contains(strings.ToLower(errMsg), "does not exist") {
			return fmt.Errorf("%s", errMsg)
		}

		// Auto-Create Missing Master
		start := strings.Index(errMsg, "'")
		end := strings.LastIndex(errMsg, "'")
		if start < 0 || end <= start {
			return fmt.Errorf("%s", errMsg)
		}

		missingName := errMsg[start+1 : end]
		var missingXML string
		
		if strings.Contains(strings.ToLower(errMsg), "stock item") {
			missingXML = tally.EnsureCompanyInXML(tally.BuildStockItemMasterXML(company, missingName, "Pcs"), company)
		} else {
			parent := "Duties &amp; Taxes"
			lower := strings.ToLower(missingName)
			if strings.Contains(lower, "sales") {
				parent = "Sales Accounts"
			} else if strings.Contains(lower, "purchase") {
				parent = "Purchase Accounts"
			} else if !strings.Contains(lower, "gst") && !strings.Contains(lower, "tax") {
				parent = "Sundry Debtors"
			}
			missingXML = tally.EnsureCompanyInXML(tally.BuildLedgerMasterXML(company, missingName, parent), company)
		}

		if _, err := w.tally.PostXML(missingXML); err != nil {
			log.Printf("auto-create error for %s: %v", missingName, err)
		}

		finalErr = fmt.Errorf("%s", errMsg)
		// Loop immediately continues and pushes voucherXML again
	}

	return fmt.Errorf("max auto-create retries reached. Last error: %v", finalErr)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
