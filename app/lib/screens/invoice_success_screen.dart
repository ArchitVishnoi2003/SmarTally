import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/firestore_service.dart';

class InvoiceSuccessScreen extends StatelessWidget {
  final String invoiceId;
  final String invoiceNumber;
  final String partyName;
  final double total;

  const InvoiceSuccessScreen({
    super.key,
    required this.invoiceId,
    required this.invoiceNumber,
    required this.partyName,
    required this.total,
  });

  String _statusLabel(String? status) {
    switch (status) {
      case 'synced':
        return 'Synced to Tally';
      case 'failed':
        return 'Sync failed — check PC agent';
      case 'confirmed':
        return 'Waiting for PC agent...';
      default:
        return status ?? 'Processing';
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'synced':
        return Colors.green;
      case 'failed':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  Future<void> _shareWhatsApp(BuildContext context) async {
    final text =
        'Invoice $invoiceNumber\nParty: $partyName\nTotal: ₹${total.toStringAsFixed(2)}';
    final uri = Uri.parse(
        'https://wa.me/?text=${Uri.encodeComponent(text)}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fs = FirestoreService();

    return Scaffold(
      appBar: AppBar(title: const Text('Invoice Created')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 72),
            const SizedBox(height: 16),
            Text(
              invoiceNumber,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              partyName,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600], fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              '₹${total.toStringAsFixed(2)}',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 24),
            StreamBuilder<Map<String, dynamic>?>(
              stream: fs.watchInvoice(invoiceId),
              builder: (context, snap) {
                final status = snap.data?['status']?.toString();
                return Card(
                  child: ListTile(
                    leading: Icon(Icons.sync, color: _statusColor(status)),
                    title: Text(_statusLabel(status)),
                    subtitle: status == 'failed'
                        ? const Text(
                            'Ensure Tally is open on PC and agent is running')
                        : null,
                  ),
                );
              },
            ),
            const Spacer(),
            OutlinedButton.icon(
              onPressed: () => _shareWhatsApp(context),
              icon: const Icon(Icons.share),
              label: const Text('Share via WhatsApp'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.popUntil(context, (r) => r.isFirst),
              child: const Text('Back to Home'),
            ),
          ],
        ),
      ),
    );
  }
}
