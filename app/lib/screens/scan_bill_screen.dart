import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/api_service.dart';
import 'verify_bill_screen.dart';

class ScanBillScreen extends StatefulWidget {
  const ScanBillScreen({super.key});

  @override
  State<ScanBillScreen> createState() => _ScanBillScreenState();
}

class _ScanBillScreenState extends State<ScanBillScreen> {
  bool _loading = false;
  final _api = ApiService();

  Future<void> _extractAndNavigate({
    String? fileBase64,
    String? fileType,
    String? textContent,
  }) async {
    setState(() => _loading = true);
    try {
      final bill = await _api.extractBill(
        fileBase64: fileBase64,
        fileType: fileType,
        textContent: textContent,
      );
      if (!mounted) return;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => VerifyBillScreen(extracted: bill),
        ),
      );
    } catch (e) {
      if (mounted) {
        final msg = e.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              msg.length > 120 ? '${msg.substring(0, 120)}…' : msg,
            ),
            duration: const Duration(seconds: 6),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _takePhoto() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    await _extractAndNavigate(
      fileBase64: base64Encode(bytes),
      fileType: 'jpg',
    );
  }

  Future<void> _uploadFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf', 'webp'],
    );
    if (result == null || result.files.isEmpty) return;

    final f = result.files.first;
    List<int> bytes;
    if (f.bytes != null) {
      bytes = f.bytes!;
    } else if (f.path != null) {
      bytes = await File(f.path!).readAsBytes();
    } else {
      return;
    }

    final ext = f.extension ?? 'jpg';
    await _extractAndNavigate(
      fileBase64: base64Encode(bytes),
      fileType: ext,
    );
  }

  Future<void> _pasteText() async {
    final controller = TextEditingController();
    final text = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Paste Bill Text'),
        content: TextField(
          controller: controller,
          maxLines: 12,
          decoration: const InputDecoration(
            hintText: 'Paste bill contents here...',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Extract'),
          ),
        ],
      ),
    );

    if (text != null && text.trim().isNotEmpty) {
      await _extractAndNavigate(textContent: text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan Bill')),
      body: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'How would you like to add the bill?',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 8),
                Text(
                  'Purchase or sale — handwritten or printed',
                  style: TextStyle(color: Colors.grey[600]),
                ),
                const SizedBox(height: 32),
                _scanButton(
                  icon: Icons.camera_alt,
                  label: 'Take Photo',
                  onPressed: _loading ? null : _takePhoto,
                ),
                const SizedBox(height: 16),
                _scanButton(
                  icon: Icons.upload_file,
                  label: 'Upload File',
                  subtitle: 'Image or PDF',
                  onPressed: _loading ? null : _uploadFile,
                ),
                const SizedBox(height: 16),
                _scanButton(
                  icon: Icons.text_fields,
                  label: 'Paste Text',
                  onPressed: _loading ? null : _pasteText,
                ),
              ],
            ),
          ),
          if (_loading)
            Container(
              color: Colors.black45,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Colors.white),
                    SizedBox(height: 16),
                    Text(
                      'Reading bill with AI...',
                      style: TextStyle(color: Colors.white, fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _scanButton({
    required IconData icon,
    required String label,
    String? subtitle,
    VoidCallback? onPressed,
  }) {
    return FilledButton.tonal(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 20),
        alignment: Alignment.centerLeft,
      ),
      child: Row(
        children: [
          Icon(icon, size: 32),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 18)),
              if (subtitle != null)
                Text(subtitle, style: const TextStyle(fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }
}
