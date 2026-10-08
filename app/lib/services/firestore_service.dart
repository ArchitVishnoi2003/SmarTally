import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class Party {
  final String id;
  final String name;
  final String gstin;
  final String partyType;

  Party({
    required this.id,
    required this.name,
    this.gstin = '',
    this.partyType = 'customer',
  });
}

class AgentStatus {
  final String tallyStatus;
  final int pendingCount;
  final DateTime? lastHeartbeat;

  AgentStatus({
    this.tallyStatus = 'unknown',
    this.pendingCount = 0,
    this.lastHeartbeat,
  });
}

class FirestoreService {
  final _db = FirebaseFirestore.instance;
  String? get uid => FirebaseAuth.instance.currentUser?.uid;

  Stream<AgentStatus?> watchAgentStatus() {
    final userId = uid;
    if (userId == null) return Stream.value(null);

    return _db
        .collection('agent_devices')
        .where('user_id', isEqualTo: userId)
        .limit(1)
        .snapshots()
        .map((snap) {
      if (snap.docs.isEmpty) return null;
      final d = snap.docs.first.data();
      return AgentStatus(
        tallyStatus: d['tally_status']?.toString() ?? 'unknown',
        pendingCount: (d['pending_count'] as num?)?.toInt() ?? 0,
        lastHeartbeat: (d['last_heartbeat'] as Timestamp?)?.toDate(),
      );
    });
  }

  Stream<List<Party>> watchParties() {
    final userId = uid;
    if (userId == null) return Stream.value([]);

    return _db
        .collection('parties')
        .where('user_id', isEqualTo: userId)
        .orderBy('name')
        .snapshots()
        .map((snap) => snap.docs
            .map((d) => Party(
                  id: d.id,
                  name: d['name']?.toString() ?? '',
                  gstin: d['gstin']?.toString() ?? '',
                  partyType: d['party_type']?.toString() ?? 'customer',
                ))
            .toList());
  }

  Stream<Map<String, dynamic>?> watchInvoice(String invoiceId) {
    return _db.collection('invoices').doc(invoiceId).snapshots().map((snap) {
      if (!snap.exists) return null;
      return snap.data();
    });
  }

  Future<void> clearQueue() async {
    final userId = uid;
    if (userId == null) return;
    final qs = await _db
        .collection('sync_queue')
        .where('user_id', isEqualTo: userId)
        .where('status', whereIn: ['pending', 'failed'])
        .get();
    final batch = _db.batch();
    for (var doc in qs.docs) {
      batch.delete(doc.reference);
    }
    await batch.commit();
  }
}
