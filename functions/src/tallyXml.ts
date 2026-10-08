import { LineItem } from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTallyDate(isoDate: string): string {
  const d = isoDate.replace(/-/g, "");
  return d.length === 8 ? d : isoDate;
}

export function buildSalesVoucherXml(params: {
  companyName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  partyName: string;
  lineItems: LineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  interState: boolean;
}): string {
  const {
    companyName,
    invoiceId,
    invoiceNumber,
    invoiceDate,
    partyName,
    lineItems,
    cgst,
    sgst,
    igst,
    total,
    interState,
  } = params;

  // Sales (Outward) Item amounts are negative
  // Sales Ledger is Credit (No) -> Negative
  const inventoryEntries = lineItems
    .map((item) => {
      return `
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${esc(item.name)}</STOCKITEMNAME>
        <RATE>${item.rate.toFixed(2)}/${esc(item.unit)}</RATE>
        <ACTUALQTY>${item.quantity} ${esc(item.unit)}</ACTUALQTY>
        <BILLEDQTY>${item.quantity} ${esc(item.unit)}</BILLEDQTY>
        <AMOUNT>-${item.amount_before_tax.toFixed(2)}</AMOUNT>
        <ACCOUNTINGALLOCATIONS.LIST>
          <LEDGERNAME>Sales</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${item.amount_before_tax.toFixed(2)}</AMOUNT>
        </ACCOUNTINGALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>`;
    })
    .join("");

  // Output Taxes are Credit (No) -> Negative
  const taxEntries: string[] = [];
  if (!interState && cgst > 0) {
    taxEntries.push(`
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>Output CGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${cgst.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>Output SGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${sgst.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>`);
  }
  if (interState && igst > 0) {
    taxEntries.push(`
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>Output IGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <AMOUNT>-${igst.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>`);
  }

  // Customer is Debit (Yes) -> Positive
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>${formatTallyDate(invoiceDate)}</DATE>
            <REFERENCE>${esc(invoiceNumber)}</REFERENCE>
            <VOUCHERNUMBER>${esc(invoiceNumber)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${esc(partyName)}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <UDF:APPINVOICEID.LIST DESC="AppInvoiceId" ISLIST="YES">
              <UDF:APPINVOICEID DESC="AppInvoiceId">${esc(invoiceId)}</UDF:APPINVOICEID>
            </UDF:APPINVOICEID.LIST>
            
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(partyName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>${total.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>

            ${inventoryEntries}
            ${taxEntries.join("")}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function buildPurchaseVoucherXml(params: {
  companyName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  partyName: string;
  lineItems: LineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  interState: boolean;
}): string {
  const {
    companyName,
    invoiceId,
    invoiceNumber,
    invoiceDate,
    partyName,
    lineItems,
    cgst,
    sgst,
    igst,
    total,
    interState,
  } = params;

  // Purchase (Inward) Item amounts are positive
  // Purchase Ledger is Debit (Yes) -> Positive
  const inventoryEntries = lineItems
    .map((item) => {
      return `
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${esc(item.name)}</STOCKITEMNAME>
        <RATE>${item.rate.toFixed(2)}/${esc(item.unit)}</RATE>
        <ACTUALQTY>${item.quantity} ${esc(item.unit)}</ACTUALQTY>
        <BILLEDQTY>${item.quantity} ${esc(item.unit)}</BILLEDQTY>
        <AMOUNT>${item.amount_before_tax.toFixed(2)}</AMOUNT>
        <ACCOUNTINGALLOCATIONS.LIST>
          <LEDGERNAME>Purchase</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${item.amount_before_tax.toFixed(2)}</AMOUNT>
        </ACCOUNTINGALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>`;
    })
    .join("");

  // Input Taxes are Debit (Yes) -> Positive
  const taxEntries: string[] = [];
  if (!interState && cgst > 0) {
    taxEntries.push(`
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>Input CGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>Input SGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>`);
  }
  if (interState && igst > 0) {
    taxEntries.push(`
      <LEDGERENTRIES.LIST>
        <LEDGERNAME>Input IGST</LEDGERNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <AMOUNT>${igst.toFixed(2)}</AMOUNT>
      </LEDGERENTRIES.LIST>`);
  }

  // Vendor is Credit (No) -> Negative
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create">
            <DATE>${formatTallyDate(invoiceDate)}</DATE>
            <REFERENCE>${esc(invoiceNumber)}</REFERENCE>
            <VOUCHERNUMBER>${esc(invoiceNumber)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${esc(partyName)}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <UDF:APPINVOICEID.LIST DESC="AppInvoiceId" ISLIST="YES">
              <UDF:APPINVOICEID DESC="AppInvoiceId">${esc(invoiceId)}</UDF:APPINVOICEID>
            </UDF:APPINVOICEID.LIST>
            
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${esc(partyName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${total.toFixed(2)}</AMOUNT>
            </LEDGERENTRIES.LIST>

            ${inventoryEntries}
            ${taxEntries.join("")}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function buildLedgerMasterXml(
  companyName: string,
  ledgerName: string,
  parent: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <LEDGER NAME="${esc(ledgerName)}" ACTION="Create">
            <NAME.LIST><NAME>${esc(ledgerName)}</NAME></NAME.LIST>
            <PARENT>${esc(parent)}</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function buildStockItemMasterXml(
  companyName: string,
  itemName: string,
  unit: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <STOCKITEM NAME="${esc(itemName)}" ACTION="Create">
            <NAME.LIST><NAME>${esc(itemName)}</NAME></NAME.LIST>
            <BASEUNITS>${esc(unit)}</BASEUNITS>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
