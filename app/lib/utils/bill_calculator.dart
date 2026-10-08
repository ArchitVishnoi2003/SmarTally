import '../models/extracted_bill.dart';

class BillCalculator {
  static Map<String, double> computeTotals(
    List<ExtractedItem> items, {
    bool interState = false,
  }) {
    double subtotal = 0;
    double cgst = 0;
    double sgst = 0;
    double igst = 0;

    for (final item in items) {
      final taxable = item.amountBeforeTax > 0
          ? item.amountBeforeTax
          : item.quantity * item.rate * (1 - item.discountPct / 100);
      subtotal += taxable;
      final tax = taxable * item.gstRate / 100;
      if (interState) {
        igst += tax;
      } else {
        cgst += tax / 2;
        sgst += tax / 2;
      }
    }

    final total = subtotal + cgst + sgst + igst;
    return {
      'subtotal': subtotal,
      'cgst': cgst,
      'sgst': sgst,
      'igst': igst,
      'total': total,
    };
  }
}
