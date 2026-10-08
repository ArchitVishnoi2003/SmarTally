const fs = require('fs');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Archit</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <LEDGER NAME="Test Vendor" ACTION="Create">
            <NAME.LIST><NAME>Test Vendor</NAME></NAME.LIST>
            <PARENT>Sundry Creditors</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE>
          <LEDGER NAME="Test Purchase" ACTION="Create">
            <NAME.LIST><NAME>Test Purchase</NAME></NAME.LIST>
            <PARENT>Purchase Accounts</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE>
          <LEDGER NAME="Test Input CGST" ACTION="Create">
            <NAME.LIST><NAME>Test Input CGST</NAME></NAME.LIST>
            <PARENT>Duties &amp; Taxes</PARENT>
          </LEDGER>
        </TALLYMESSAGE>
        <TALLYMESSAGE>
          <STOCKITEM NAME="Test Item" ACTION="Create">
            <NAME.LIST><NAME>Test Item</NAME></NAME.LIST>
            <BASEUNITS>Pcs</BASEUNITS>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
    
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
            <REFERENCE>SUPP-001</REFERENCE>
            <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
            <ISINVOICE>Yes</ISINVOICE>
            <VOUCHERNUMBER>TEST-PUR-001</VOUCHERNUMBER>
            <PARTYLEDGERNAME>Test Vendor</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            
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

            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Test Vendor</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-11800.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Test Input CGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-1800.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

fs.writeFileSync('C:/Users/avarc/Desktop/test_import.xml', xml);
console.log('Created test_import.xml');
