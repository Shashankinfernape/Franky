import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as ws_status;

/// Callback types
typedef OnTextChunk = void Function(String token, String emotion);
typedef OnEmotionChange = void Function(String emotion);
typedef OnStreamEnd = void Function();
typedef OnConnectionChange = void Function(bool connected);

/// McQueenVoiceService
///
/// Connects to the Emiot backend WebSocket (ws://HOST:8008/ws/emiot),
/// streams Groq LLM text chunks, and plays fine-tuned Lightning McQueen
/// XTTS v2 audio chunks sequentially with no gaps or overlap.
class McQueenVoiceService {
  // ── Config ──────────────────────────────────────────────────────────────────
  final String host;
  final int port;

  McQueenVoiceService({
    this.host = '10.197.68.181', // ← Your PC's Wi-Fi IP (auto-detected)
    this.port = 8008,
  });

  // ── Internal state ───────────────────────────────────────────────────────────
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _reconnectTimer;

  bool _connected = false;
  bool get isConnected => _connected;

  // Audio queue — chunks play one after another, never overlapping
  final List<Uint8List> _audioQueue = [];
  bool _isPlaying = false;
  final AudioPlayer _audioPlayer = AudioPlayer();

  // ── Callbacks ────────────────────────────────────────────────────────────────
  OnTextChunk? onTextChunk;
  OnEmotionChange? onEmotionChange;
  OnStreamEnd? onStreamEnd;
  OnConnectionChange? onConnectionChange;

  // ── Public API ───────────────────────────────────────────────────────────────

  /// Connect (or reconnect) to the Emiot backend WebSocket.
  void connect() {
    _disconnect(reconnect: false);

    final uri = Uri.parse('ws://$host:$port/ws/emiot');
    try {
      _channel = WebSocketChannel.connect(uri);

      _subscription = _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
      );

      _setConnected(true);
    } catch (e) {
      _setConnected(false);
      _scheduleReconnect();
    }
  }

  /// Send user text to the backend → triggers Groq LLM + McQueen voice.
  /// Returns true if the message was sent successfully.
  bool sendText(String text) {
    if (!_connected || _channel == null) return false;
    _clearAudioQueue(); // Cancel pending audio from previous response
    _channel!.sink.add(jsonEncode({'type': 'user_speech', 'text': text}));
    return true;
  }

  /// Disconnect and clean up all resources.
  void dispose() {
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close(ws_status.goingAway);
    _audioPlayer.dispose();
    _audioQueue.clear();
    _connected = false;
  }

  // ── Private: WebSocket message handling ──────────────────────────────────────

  void _onMessage(dynamic raw) {
    try {
      final data = jsonDecode(raw as String) as Map<String, dynamic>;
      final type = data['type'] as String? ?? '';

      switch (type) {
        case 'emotion_tag':
          final emotion = data['emotion'] as String? ?? 'neutral';
          onEmotionChange?.call(emotion);
          break;

        case 'text_chunk':
          final token = data['text'] as String? ?? '';
          final emotion = data['emotion'] as String? ?? 'talking';
          if (token.isNotEmpty) {
            onTextChunk?.call(token, emotion);
          }
          break;

        case 'audio_chunk':
          final b64 = data['audio_b64'] as String?;
          if (b64 != null && b64.isNotEmpty) {
            // Decode base64 WAV bytes and enqueue for sequential playback
            final bytes = base64Decode(b64);
            _enqueueAudio(bytes);
          }
          break;

        case 'stream_end':
          onStreamEnd?.call();
          break;

        default:
          break;
      }
    } catch (_) {
      // Malformed JSON — silently ignore
    }
  }

  void _onError(Object error) {
    _setConnected(false);
    _scheduleReconnect();
  }

  void _onDone() {
    _setConnected(false);
    _scheduleReconnect();
  }

  // ── Private: Sequential audio queue ─────────────────────────────────────────

  void _enqueueAudio(Uint8List wavBytes) {
    _audioQueue.add(wavBytes);
    if (!_isPlaying) {
      _playNext();
    }
  }

  Future<void> _playNext() async {
    if (_audioQueue.isEmpty) {
      _isPlaying = false;
      return;
    }

    _isPlaying = true;
    final chunk = _audioQueue.removeAt(0);

    try {
      // Write WAV bytes to a temp file (audioplayers needs a file or URL source)
      final tempDir = Directory.systemTemp;
      final tempFile = File('${tempDir.path}/mcqueen_chunk_${DateTime.now().millisecondsSinceEpoch}.wav');
      await tempFile.writeAsBytes(chunk);

      // Play and wait for completion before playing next chunk
      final completer = Completer<void>();

      _audioPlayer.onPlayerComplete.listen((_) {
        if (!completer.isCompleted) completer.complete();
      });

      await _audioPlayer.play(DeviceFileSource(tempFile.path));
      await completer.future;

      // Clean up temp file
      if (await tempFile.exists()) {
        await tempFile.delete();
      }
    } catch (e) {
      // If playback fails, skip to next chunk
    }

    // Play next chunk in queue
    _playNext();
  }

  void _clearAudioQueue() {
    _audioQueue.clear();
    _isPlaying = false;
    _audioPlayer.stop();
  }

  // ── Private: Connection management ──────────────────────────────────────────

  void _setConnected(bool value) {
    if (_connected != value) {
      _connected = value;
      onConnectionChange?.call(value);
    }
  }

  void _disconnect({bool reconnect = true}) {
    _subscription?.cancel();
    _channel?.sink.close(ws_status.goingAway);
    _channel = null;
    _subscription = null;
    _setConnected(false);
    if (reconnect) _scheduleReconnect();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), connect);
  }
}
