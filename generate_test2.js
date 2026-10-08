const fs = require('fs');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Archit</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Purchase" ACTION="Create">
            <DATE>20260501</DATE>
            <REFERENCE>SUPP-002</REFERENCE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <ISINVOICE>Yes</ISINVOICE>
            <VOUCHERNUMBER>TEST-PUR-002</VOUCHERNUMBER>
            <PARTYLEDGERNAME>Test Vendor</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>

            <LEDGERENTRIES.LIST>
              <LEDGERNAME>Test Vendor</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-11800.00</AMOUNT>
            </LEDGERENTRIES.LIST>
            
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>Test Item</STOCKITEMNAME>
              <RATE>1000.00/Pcs</RATE>
              <ACTUALQTY>10 Pcs</ACTUALQTY>
              <BILLEDQTY>10 Pcs</BILLEDQTY>
              <AMOUNT>-10000.00</AMOUNT>
              <ACCOUNTINGALLOCATIONS.LIST>
                <LEDGERNAME>Test Purchase</LEDGERNAME>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <AMOUNT>-10000.00</AMOUNT>
              </ACCOUNTINGALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>

            <LEDGERENTRIES.LIST>
              <LEDGERNAME>Test Input CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-1800.00</AMOUNT>
            </LEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

fs.writeFileSync('C:/Users/avarc/Desktop/test_import2.xml', xml);
console.log('Created test_import2.xml');
