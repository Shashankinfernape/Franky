import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';

class SaccadicAttentionController extends ChangeNotifier {
  double _currentGazeX = 0.0;
  double _currentGazeY = 0.0;
  double _targetGazeX = 0.0;
  double _targetGazeY = 0.0;

  double _blinkProgress = 0.0; // 0.0 = open, 1.0 = closed
  bool _isBlinking = false;
  double _headTilt = 0.0; // Radians

  Timer? _saccadeTimer;
  Timer? _blinkTimer;
  final math.Random _random = math.Random();

  double get gazeX => _currentGazeX;
  double get gazeY => _currentGazeY;
  double get blinkProgress => _blinkProgress;
  double get headTilt => _headTilt;

  SaccadicAttentionController() {
    _startAutonomousSaccades();
    _scheduleNextBlink();
  }

  void updateTick(double deltaTime) {
    // Smooth lerp toward target gaze vector
    const lerpSpeed = 12.0; // Smooth 60 FPS interpolation
    _currentGazeX += (_targetGazeX - _currentGazeX) * math.min(1.0, deltaTime * lerpSpeed);
    _currentGazeY += (_targetGazeY - _currentGazeY) * math.min(1.0, deltaTime * lerpSpeed);

    notifyListeners();
  }

  void setDirectGaze(double targetX, double targetY) {
    _targetGazeX = targetX.clamp(-1.0, 1.0);
    _targetGazeY = targetY.clamp(-1.0, 1.0);
  }

  void setHeadTilt(double radians) {
    _headTilt = radians.clamp(-0.35, 0.35);
    notifyListeners();
  }

  void _startAutonomousSaccades() {
    _saccadeTimer = Timer.periodic(const Duration(milliseconds: 1200), (_) {
      // 80% look near center/user face, 20% micro glance
      if (_random.nextDouble() < 0.8) {
        _targetGazeX = (_random.nextDouble() * 0.3) - 0.15;
        _targetGazeY = (_random.nextDouble() * 0.2) - 0.10;
      } else {
        _targetGazeX = (_random.nextDouble() * 1.2) - 0.6;
        _targetGazeY = (_random.nextDouble() * 0.8) - 0.4;
      }
    });
  }

  void _scheduleNextBlink() {
    final nextBlinkMs = 2500 + _random.nextInt(2500);
    _blinkTimer = Timer(Duration(milliseconds: nextBlinkMs), () async {
      await triggerBlink();
      _scheduleNextBlink();
    });
  }

  Future<void> triggerBlink() async {
    if (_isBlinking) return;
    _isBlinking = true;

    // Fast closure (60ms)
    for (int i = 0; i <= 5; i++) {
      _blinkProgress = i / 5.0;
      notifyListeners();
      await Future.delayed(const Duration(milliseconds: 12));
    }
    // Fast opening (80ms)
    for (int i = 5; i >= 0; i--) {
      _blinkProgress = i / 5.0;
      notifyListeners();
      await Future.delayed(const Duration(milliseconds: 16));
    }

    _blinkProgress = 0.0;
    _isBlinking = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _saccadeTimer?.cancel();
    _blinkTimer?.cancel();
    super.dispose();
  }
}
