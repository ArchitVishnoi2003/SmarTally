import 'package:flutter/material.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:intl/intl.dart';

import '../models/extracted_bill.dart';
import '../services/api_service.dart';
import '../services/firestore_service.dart';
import '../utils/bill_calculator.dart';
import 'invoice_success_screen.dart';

class VerifyBillScreen extends StatefulWidget {
  final ExtractedBill extracted;

  const VerifyBillScreen({super.key, required this.extracted});

  @override
  State<VerifyBillScreen> createState() => _VerifyBillScreenState();
}

class _VerifyBillScreenState extends State<VerifyBillScreen> {
  late String _billType;
  late DateTime _billDate;
  late TextEditingController _partyController;
  late List<ExtractedItem> _items;
  String? _partyGstin;
  bool _submitting = false;

  final _units = ['PCS', 'MTR', 'KG', 'BOX'];
  final _gstRates = [0, 5, 12, 18, 28];

  @override
  void initState() {
    super.initState();
    final e = widget.extracted;
    _billType = e.billType == 'sales' ? 'sales' : 'purchase';
    _billDate = e.billDate != null
        ? DateTime.tryParse(e.billDate!) ?? DateTime.now()
        : DateTime.now();

    final party = _billType == 'purchase' ? e.supplier : e.buyer;
    _partyController = TextEditingController(text: party.name);
    _partyGstin = party.gstin;
    _items = List.from(e.items);
    if (_items.isEmpty) {
      _items.add(ExtractedItem(name: '', confidence: 'low'));
    }
  }

  Map<String, double> get _totals =>
      BillCalculator.computeTotals(_items, interState: false);

  Future<void> _confirm() async {
    if (_partyController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter party name')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final totals = _totals;
      final lineItems = _items.map((i) => i.toLineItemJson()).toList();

      final result = await ApiService().confirmInvoice({
        'bill_type': _billType,
        'bill_date': DateFormat('yyyy-MM-dd').format(_billDate),
        'party_name': _partyController.text.trim(),
        'party_gstin': _partyGstin ?? '',
        'line_items': lineItems,
        'subtotal': totals['subtotal'],
        'cgst': totals['cgst'],
        'sgst': totals['sgst'],
        'igst': totals['igst'],
        'total': totals['total'],
      });

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => InvoiceSuccessScreen(
            invoiceId: result['invoice_id'] as String,
            invoiceNumber: result['invoice_number'] as String,
            partyName: _partyController.text.trim(),
            total: totals['total']!,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final totals = _totals;
    final fs = FirestoreService();

    return Scaffold(
      appBar: AppBar(title: const Text('Verify Bill')),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (widget.extracted.extractionNotes.isNotEmpty)
                  Card(
                    color: Colors.amber.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(widget.extracted.extractionNotes),
                    ),
                  ),
                const SizedBox(height: 8),
                _sectionTitle('Bill Details'),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'purchase', label: Text('Purchase')),
                    ButtonSegment(value: 'sales', label: Text('Sale')),
                  ],
                  selected: {_billType},
                  onSelectionChanged: (s) =>
                      setState(() => _billType = s.first),
                ),
                const SizedBox(height: 12),
                ListTile(
                  title: const Text('Date'),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(_billDate)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _billDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now().add(const Duration(days: 1)),
                    );
                    if (picked != null) setState(() => _billDate = picked);
                  },
                ),
                const SizedBox(height: 8),
                StreamBuilder<List<Party>>(
                  stream: fs.watchParties(),
                  builder: (context, snap) {
                    final parties = snap.data ?? [];
                    return Autocomplete<String>(
                      initialValue:
                          TextEditingValue(text: _partyController.text),
                      optionsBuilder: (text) {
                        if (text.text.isEmpty) {
                          return parties.map((p) => p.name);
                        }
                        return parties
                            .where((p) => p.name
                                .toLowerCase()
                                .contains(text.text.toLowerCase()))
                            .map((p) => p.name);
                      },
                      onSelected: (value) {
                        final party =
                            parties.firstWhere((p) => p.name == value);
                        setState(() {
                          _partyController.text = party.name;
                          _partyGstin = party.gstin;
                        });
                      },
                      fieldViewBuilder: (ctx, controller, focus, onSubmit) {
                        if (controller.text != _partyController.text) {
                          controller.text = _partyController.text;
                        }
                        return TextField(
                          controller: controller,
                          focusNode: focus,
                          decoration: InputDecoration(
                            labelText: _billType == 'purchase'
                                ? 'Supplier'
                                : 'Customer',
                            border: const OutlineInputBorder(),
                          ),
                          onChanged: (v) => _partyController.text = v,
                        );
                      },
                    );
                  },
                ),
                const SizedBox(height: 16),
                _sectionTitle('Items (${_items.length})'),
                ..._items.asMap().entries.map((e) => _itemCard(e.key, e.value)),
                OutlinedButton.icon(
                  onPressed: () => setState(() {
                    _items.add(ExtractedItem(name: '', confidence: 'high'));
                  }),
                  icon: const Icon(Icons.add),
                  label: const Text('Add Item'),
                ),
                const SizedBox(height: 16),
                _sectionTitle('Totals'),
                _totalRow('Subtotal', totals['subtotal']!),
                if (totals['cgst']! > 0) _totalRow('CGST', totals['cgst']!),
                if (totals['sgst']! > 0) _totalRow('SGST', totals['sgst']!),
                if (totals['igst']! > 0) _totalRow('IGST', totals['igst']!),
                _totalRow('Total', totals['total']!, bold: true),
              ],
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: FilledButton(
                onPressed: _submitting ? null : _confirm,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                child: _submitting
                    ? const CircularProgressIndicator()
                    : const Text('Confirm & Push to Tally'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }

  Widget _totalRow(String label, double value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text('₹${value.toStringAsFixed(2)}',
              style: TextStyle(
                  fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        ],
      ),
    );
  }

  Widget _itemCard(int index, ExtractedItem item) {
    final lowConfidence = item.confidence == 'low';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Slidable(
        endActionPane: ActionPane(
          motion: const DrawerMotion(),
          children: [
            SlidableAction(
              onPressed: (_) => setState(() => _items.removeAt(index)),
              backgroundColor: Colors.red,
              icon: Icons.delete,
              label: 'Delete',
            ),
          ],
        ),
        child: Card(
          color: lowConfidence ? Colors.amber.shade50 : null,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                TextFormField(
                  initialValue: item.name,
                  decoration: const InputDecoration(
                    labelText: 'Item name',
                    isDense: true,
                  ),
                  onChanged: (v) => item.name = v,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        initialValue: item.hsnCode,
                        decoration: const InputDecoration(
                          labelText: 'HSN',
                          isDense: true,
                        ),
                        onChanged: (v) => item.hsnCode = v,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextFormField(
                        initialValue: item.quantity.toString(),
                        decoration: const InputDecoration(
                          labelText: 'Qty',
                          isDense: true,
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (v) {
                          item.quantity = double.tryParse(v) ?? 1;
                          setState(() {});
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _units.contains(item.unit.toUpperCase())
                            ? item.unit.toUpperCase()
                            : 'PCS',
                        decoration: const InputDecoration(
                          labelText: 'Unit',
                          isDense: true,
                        ),
                        items: _units
                            .map((u) =>
                                DropdownMenuItem(value: u, child: Text(u)))
                            .toList(),
                        onChanged: (v) =>
                            setState(() => item.unit = v ?? 'PCS'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextFormField(
                        initialValue: item.rate.toString(),
                        decoration: const InputDecoration(
                          labelText: 'Rate',
                          isDense: true,
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (v) {
                          item.rate = double.tryParse(v) ?? 0;
                          setState(() {});
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<int>(
                  value: _gstRates.contains(item.gstRate)
                      ? item.gstRate
                      : 5,
                  decoration: const InputDecoration(
                    labelText: 'GST %',
                    isDense: true,
                  ),
                  items: _gstRates
                      .map((r) => DropdownMenuItem(
                          value: r, child: Text('$r%')))
                      .toList(),
                  onChanged: (v) => setState(() => item.gstRate = v ?? 5),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _partyController.dispose();
    super.dispose();
  }
}
