import 'dart:convert';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:audioplayers/audioplayers.dart';

import '../../models/emiot_state.dart';

class WebSocketService extends ChangeNotifier {
  WebSocketChannel? _channel;
  bool _isConnected = false;
  String _latestTextResponse = "";
  String _pendingFullText = "";
  EyeEmotion _currentEmotion = EyeEmotion.idle;
  PersonalityState _personalityState = const PersonalityState();
  final AudioPlayer _audioPlayer = AudioPlayer();
  bool _isResponding = false;
  Timer? _captionSyncTimer;

  bool get isConnected => _isConnected;
  String get latestTextResponse => _latestTextResponse;
  EyeEmotion get currentEmotion => _currentEmotion;
  PersonalityState get personalityState => _personalityState;

  void connect(String url) {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(url));
      _isConnected = true;
      notifyListeners();

      _channel!.stream.listen(
        (dynamic message) {
          _handleIncomingMessage(message);
        },
        onDone: () {
          _isConnected = false;
          notifyListeners();
        },
        onError: (error) {
          _isConnected = false;
          notifyListeners();
        },
      );
    } catch (e) {
      _isConnected = false;
      notifyListeners();
    }
  }

  void sendUserSpeech(String text) {
    if (!_isConnected || _channel == null) return;
    _latestTextResponse = "";
    _pendingFullText = "";
    _captionSyncTimer?.cancel();
    _isResponding = true;
    _currentEmotion = EyeEmotion.thinking;
    notifyListeners();

    _channel!.sink.add(jsonEncode({
      "type": "user_speech",
      "text": text,
    }));
  }

  void sendBatteryUpdate(double level) {
    if (!_isConnected || _channel == null) return;
    _channel!.sink.add(jsonEncode({
      "type": "battery_update",
      "level": level,
    }));
  }

  void setLocalEmotion(EyeEmotion emotion) {
    _currentEmotion = emotion;
    notifyListeners();
  }

  void _handleIncomingMessage(dynamic rawMessage) async {
    if (rawMessage is String) {
      try {
        final data = jsonDecode(rawMessage);
        final msgType = data['type'];

        if (msgType == 'emotion_tag') {
          final tag = data['emotion'] as String?;
          _currentEmotion = _parseEmotionTag(tag);
          notifyListeners();
        } else if (msgType == 'text_chunk') {
          _isResponding = true;
          final chunk = data['text'] as String? ?? "";
          _pendingFullText += chunk;
          final tag = data['emotion'] as String?;
          if (tag != null) {
            _currentEmotion = _parseEmotionTag(tag);
            notifyListeners();
          }
        } else if (msgType == 'audio_chunk') {
          final b64Audio = data['audio_b64'] as String?;
          if (b64Audio != null && b64Audio.isNotEmpty) {
            try {
              await _audioPlayer.setVolume(1.0);
              await _audioPlayer.play(UrlSource('data:audio/wav;base64,$b64Audio'));
            } catch (_) {
              await _audioPlayer.setVolume(1.0);
              await _audioPlayer.play(UrlSource('data:audio/mp3;base64,$b64Audio'));
            }
            _startVoiceSyncedCaption();
          }
        } else if (msgType == 'personality_state') {
          if (data['state'] != null && !_isResponding) {
            _personalityState = PersonalityState.fromJson(data['state']);
            notifyListeners();
          }
        } else if (msgType == 'stream_end') {
          _isResponding = false;
          if (data['personality'] != null) {
            _personalityState = PersonalityState.fromJson(data['personality']);
          }
          if (_latestTextResponse.isEmpty && _pendingFullText.isNotEmpty) {
            _latestTextResponse = _pendingFullText;
          }
          notifyListeners();
        }
      } catch (e) {
        debugPrint("Error parsing websocket message: $e");
      }
    }
  }

  void _startVoiceSyncedCaption() {
    _captionSyncTimer?.cancel();
    _latestTextResponse = "";
    final words = _pendingFullText.trim().split(RegExp(r'\s+'));
    int index = 0;

    if (words.isEmpty || words.first.isEmpty) return;

    _captionSyncTimer = Timer.periodic(const Duration(milliseconds: 220), (timer) {
      if (index < words.length) {
        _latestTextResponse += (index > 0 ? " " : "") + words[index];
        index++;
        notifyListeners();
      } else {
        timer.cancel();
      }
    });
  }

  EyeEmotion _parseEmotionTag(String? tag) {
    switch (tag?.toLowerCase()) {
      case 'excited':
        return EyeEmotion.excited;
      case 'curious':
        return EyeEmotion.curious;
      case 'confused':
        return EyeEmotion.confused;
      case 'happy':
        return EyeEmotion.excited;
      case 'sad':
        return EyeEmotion.sad;
      case 'sleepy':
        return EyeEmotion.sleepy;
      case 'surprised':
        return EyeEmotion.surprised;
      case 'love':
        return EyeEmotion.love;
      case 'angry':
        return EyeEmotion.angry;
      default:
        return EyeEmotion.excited;
    }
  }

  @override
  void dispose() {
    _captionSyncTimer?.cancel();
    _audioPlayer.dispose();
    _channel?.sink.close();
    super.dispose();
  }
}
