package tally

import "fmt"

func BuildLedgerMasterXML(companyName, ledgerName, parent string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>%s</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <LEDGER NAME="%s" ACTION="Create">
            <NAME.LIST><NAME>%s</NAME></NAME.LIST>
            <PARENT>%s</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`, companyName, ledgerName, ledgerName, parent)
}

func BuildStockItemMasterXML(companyName, itemName, unit string) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>%s</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <UNIT NAME="%s" ACTION="Create">
            <NAME>%s</NAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
          </UNIT>
        </TALLYMESSAGE>
        <TALLYMESSAGE>
          <STOCKITEM NAME="%s" ACTION="Create">
            <NAME.LIST><NAME>%s</NAME></NAME.LIST>
            <BASEUNITS>%s</BASEUNITS>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`, companyName, unit, unit, itemName, itemName, unit)
}

func PartyParent(voucherType string) string {
	if voucherType == "Purchase" {
		return "Sundry Creditors"
	}
	return "Sundry Debtors"
}
