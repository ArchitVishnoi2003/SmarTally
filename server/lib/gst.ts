/** Indian state codes (first 2 digits of GSTIN) */
export function stateFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.substring(0, 2).toUpperCase();
}

export function isInterState(
  sellerState: string | null,
  buyerState: string | null
): boolean {
  if (!sellerState || !buyerState) return false;
  return sellerState !== buyerState;
}

export function calcLineTax(
  amountBeforeTax: number,
  gstRate: number,
  interState: boolean
): { cgst: number; sgst: number; igst: number } {
  const tax = (amountBeforeTax * gstRate) / 100;
  if (interState) {
    return { cgst: 0, sgst: 0, igst: Math.round(tax * 100) / 100 };
  }
  const half = Math.round((tax / 2) * 100) / 100;
  return { cgst: half, sgst: half, igst: 0 };
}

export function tallySalesLedger(gstRate: number, interState: boolean): string {
  if (interState) return `IGST @${gstRate}%`;
  return `CGST @${(gstRate / 2).toFixed(1)}%`;
}

export function tallyPurchaseLedger(gstRate: number, interState: boolean): string {
  if (interState) return `Input IGST @${gstRate}%`;
  return `Input CGST @${(gstRate / 2).toFixed(1)}%`;
}
