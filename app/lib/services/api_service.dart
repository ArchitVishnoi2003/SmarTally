import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../models/extracted_bill.dart';

class ApiService {
  Future<String?> _token() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return null;
    return user.getIdToken();
  }

  Future<Map<String, String>> _authHeaders() async {
    final token = await _token();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<ExtractedBill> extractBill({
    String? fileBase64,
    String? fileType,
    String? textContent,
  }) async {
    final headers = await _authHeaders();
    final body = <String, dynamic>{
      if (fileBase64 != null) 'file_base64': fileBase64,
      if (fileType != null) 'file_type': fileType,
      if (textContent != null) 'text_content': textContent,
    };

    final res = await http.post(
      Uri.parse(AppConfig.functionUrl('extractBill')),
      headers: headers,
      body: jsonEncode(body),
    );

    if (res.statusCode != 200) {
      throw Exception(_parseError(res.body));
    }

    final json = jsonDecode(res.body) as Map<String, dynamic>;
    return ExtractedBill.fromJson(json['data'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> confirmInvoice(
      Map<String, dynamic> invoiceData) async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse(AppConfig.functionUrl('confirmInvoice')),
      headers: headers,
      body: jsonEncode(invoiceData),
    );

    if (res.statusCode != 200) {
      throw Exception(_parseError(res.body));
    }

    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<String> generatePairingCode() async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse(AppConfig.functionUrl('pairAgent')),
      headers: headers,
      body: jsonEncode({}),
    );

    if (res.statusCode != 200) {
      throw Exception(_parseError(res.body));
    }

    final json = jsonDecode(res.body) as Map<String, dynamic>;
    return json['pairing_code'] as String;
  }

  Future<void> ensureUserProfile({String? phone}) async {
    final headers = await _authHeaders();
    await http.post(
      Uri.parse(AppConfig.functionUrl('ensureUserProfile')),
      headers: headers,
      body: jsonEncode({'phone': phone ?? ''}),
    );
  }

  String _parseError(String body) {
    try {
      final j = jsonDecode(body) as Map<String, dynamic>;
      return j['error']?.toString() ?? body;
    } catch (_) {
      return body;
    }
  }
}
