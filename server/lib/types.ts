export interface ExtractedBill {
  bill_type: string;
  bill_number: string | null;
  bill_date: string | null;
  supplier: { name: string; gstin: string; address: string };
  buyer: { name: string; gstin: string; address: string };
  items: unknown[];
  totals: {
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
  extraction_notes: string;
}

export interface ConfirmInvoiceInput {
  bill_type: "purchase" | "sales";
  bill_date: string;
  party_id?: string;
  party_name: string;
  party_gstin?: string;
  party_address?: string;
  place_of_supply?: string;
  line_items: LineItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  source_bill_url?: string;
}

export interface LineItem {
  name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_pct: number;
  gst_rate: number;
  amount_before_tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  amount: number;
}
