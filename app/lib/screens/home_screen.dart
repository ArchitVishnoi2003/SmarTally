import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../services/firestore_service.dart';
import 'scan_bill_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _pairingCode;
  bool _generatingCode = false;

  Future<void> _showPairingDialog() async {
    setState(() => _generatingCode = true);
    try {
      final code = await ApiService().generatePairingCode();
      setState(() => _pairingCode = code);
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Pair Windows Agent'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Enter this code in the Tally Sync Agent on your PC:',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                code,
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      letterSpacing: 8,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Valid for 10 minutes',
                style: TextStyle(color: Colors.grey[600], fontSize: 12),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Done'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      setState(() => _generatingCode = false);
    }
  }

  Color _syncColor(AgentStatus? status) {
    if (status == null) return Colors.grey;
    if (status.tallyStatus == 'down') return Colors.red;
    if (status.pendingCount > 0) return Colors.orange;
    return Colors.green;
  }

  String _syncLabel(AgentStatus? status) {
    if (status == null) return 'Agent not paired';
    if (status.tallyStatus == 'down') return 'Tally offline on PC';
    if (status.pendingCount > 0) {
      return '${status.pendingCount} bill(s) waiting to sync';
    }
    return 'All synced with Tally';
  }

  @override
  Widget build(BuildContext context) {
    final fs = FirestoreService();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => FirebaseAuth.instance.signOut(),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            StreamBuilder<AgentStatus?>(
              stream: fs.watchAgentStatus(),
              builder: (context, snap) {
                final status = snap.data;
                return Card(
                  color: _syncColor(status).withValues(alpha: 0.1),
                  child: ListTile(
                    leading: Icon(Icons.sync, color: _syncColor(status)),
                    title: Text(_syncLabel(status)),
                    subtitle: status?.lastHeartbeat != null
                        ? Text(
                            'Last seen: ${status!.lastHeartbeat}',
                            style: const TextStyle(fontSize: 11),
                          )
                        : const Text('Pair your PC agent to sync'),
                    trailing: (status != null && status.pendingCount > 0)
                        ? IconButton(
                            icon: const Icon(Icons.delete_sweep, color: Colors.red),
                            tooltip: 'Clear stuck queue',
                            onPressed: () async {
                              final confirm = await showDialog<bool>(
                                context: context,
                                builder: (c) => AlertDialog(
                                  title: const Text('Clear Queue?'),
                                  content: const Text('This will delete all stuck or pending bills from the queue.'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                                    TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Clear', style: TextStyle(color: Colors.red))),
                                  ],
                                ),
                              );
                              if (confirm == true) {
                                await fs.clearQueue();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Queue cleared!')));
                                }
                              }
                            },
                          )
                        : null,
                  ),
                );
              },
            ),
            const SizedBox(height: 24),
            _actionCard(
              context,
              icon: Icons.document_scanner,
              title: 'Scan Bill',
              subtitle: 'Photo, PDF, or paste text',
              color: Theme.of(context).colorScheme.primary,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ScanBillScreen()),
              ),
            ),
            const SizedBox(height: 12),
            _actionCard(
              context,
              icon: Icons.computer,
              title: 'Pair PC Agent',
              subtitle: _pairingCode != null
                  ? 'Code: $_pairingCode'
                  : 'Connect Tally on Windows',
              color: Colors.teal,
              onTap: _generatingCode ? null : _showPairingDialog,
            ),
            const SizedBox(height: 12),
            _actionCard(
              context,
              icon: Icons.account_balance_wallet,
              title: 'Khata',
              subtitle: 'Coming in Phase 3',
              color: Colors.grey,
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Khata — Phase 3')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    VoidCallback? onTap,
  }) {
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.15),
          child: Icon(icon, color: color),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
