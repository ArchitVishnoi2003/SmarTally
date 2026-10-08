class ExtractedBill {
  final String billType;
  final String? billNumber;
  final String? billDate;
  final PartyInfo supplier;
  final PartyInfo buyer;
  final List<ExtractedItem> items;
  final BillTotals totals;
  final String extractionNotes;

  ExtractedBill({
    required this.billType,
    this.billNumber,
    this.billDate,
    required this.supplier,
    required this.buyer,
    required this.items,
    required this.totals,
    this.extractionNotes = '',
  });

  factory ExtractedBill.fromJson(Map<String, dynamic> json) {
    return ExtractedBill(
      billType: json['bill_type']?.toString() ?? 'unknown',
      billNumber: json['bill_number']?.toString(),
      billDate: json['bill_date']?.toString(),
      supplier: PartyInfo.fromJson(
          json['supplier'] as Map<String, dynamic>? ?? {}),
      buyer:
          PartyInfo.fromJson(json['buyer'] as Map<String, dynamic>? ?? {}),
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => ExtractedItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      totals: BillTotals.fromJson(
          json['totals'] as Map<String, dynamic>? ?? {}),
      extractionNotes: json['extraction_notes']?.toString() ?? '',
    );
  }
}

class PartyInfo {
  final String name;
  final String gstin;
  final String address;

  PartyInfo({this.name = '', this.gstin = '', this.address = ''});

  factory PartyInfo.fromJson(Map<String, dynamic> json) {
    return PartyInfo(
      name: json['name']?.toString() ?? '',
      gstin: json['gstin']?.toString() ?? '',
      address: json['address']?.toString() ?? '',
    );
  }
}

class ExtractedItem {
  String name;
  String hsnCode;
  double quantity;
  String unit;
  double rate;
  double discountPct;
  int gstRate;
  double amountBeforeTax;
  String confidence;

  ExtractedItem({
    required this.name,
    this.hsnCode = '',
    this.quantity = 1,
    this.unit = 'PCS',
    this.rate = 0,
    this.discountPct = 0,
    this.gstRate = 5,
    this.amountBeforeTax = 0,
    this.confidence = 'medium',
  });

  factory ExtractedItem.fromJson(Map<String, dynamic> json) {
    return ExtractedItem(
      name: json['name']?.toString() ?? '',
      hsnCode: json['hsn_code']?.toString() ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 1,
      unit: json['unit']?.toString() ?? 'PCS',
      rate: (json['rate'] as num?)?.toDouble() ?? 0,
      discountPct: (json['discount_pct'] as num?)?.toDouble() ?? 0,
      gstRate: (json['gst_rate'] as num?)?.toInt() ?? 5,
      amountBeforeTax: (json['amount_before_tax'] as num?)?.toDouble() ?? 0,
      confidence: json['confidence']?.toString() ?? 'medium',
    );
  }

  Map<String, dynamic> toLineItemJson() {
    final taxable = amountBeforeTax > 0
        ? amountBeforeTax
        : quantity * rate * (1 - discountPct / 100);
    final tax = taxable * gstRate / 100;
    return {
      'name': name,
      'hsn_code': hsnCode,
      'quantity': quantity,
      'unit': unit,
      'rate': rate,
      'discount_pct': discountPct,
      'gst_rate': gstRate,
      'amount_before_tax': taxable,
      'cgst': tax / 2,
      'sgst': tax / 2,
      'igst': 0,
      'amount': taxable + tax,
    };
  }
}

class BillTotals {
  final double subtotal;
  final double cgst;
  final double sgst;
  final double igst;
  final double total;

  BillTotals({
    this.subtotal = 0,
    this.cgst = 0,
    this.sgst = 0,
    this.igst = 0,
    this.total = 0,
  });

  factory BillTotals.fromJson(Map<String, dynamic> json) {
    return BillTotals(
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0,
      cgst: (json['cgst'] as num?)?.toDouble() ?? 0,
      sgst: (json['sgst'] as num?)?.toDouble() ?? 0,
      igst: (json['igst'] as num?)?.toDouble() ?? 0,
      total: (json['total'] as num?)?.toDouble() ?? 0,
    );
  }
}
