import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../models/emiot_state.dart';

class EmiotProceduralEyes extends StatelessWidget {
  final EyeEmotion emotion;
  final double gazeX; // [-1.0, 1.0]
  final double gazeY; // [-1.0, 1.0]
  final double blinkProgress; // [0.0 = open, 1.0 = closed]
  final double squintAmount; // [0.0, 1.0]
  final double pupilDilation; // [0.5, 1.5]
  final double headTilt; // [-0.2, 0.2] radians

  const EmiotProceduralEyes({
    super.key,
    required this.emotion,
    this.gazeX = 0.0,
    this.gazeY = 0.0,
    this.blinkProgress = 0.0,
    this.squintAmount = 0.0,
    this.pupilDilation = 1.0,
    this.headTilt = 0.0,
  });

  @override
  Widget build(BuildContext context) {
    return Transform.rotate(
      angle: headTilt,
      child: CustomPaint(
        size: Size.infinite,
        painter: _McQueenEyePainter(
          emotion: emotion,
          gazeX: gazeX,
          gazeY: gazeY,
          blinkProgress: blinkProgress,
          squintAmount: squintAmount,
          pupilDilation: pupilDilation,
        ),
      ),
    );
  }
}

class _McQueenEyePainter extends CustomPainter {
  final EyeEmotion emotion;
  final double gazeX;
  final double gazeY;
  final double blinkProgress;
  final double squintAmount;
  final double pupilDilation;

  _McQueenEyePainter({
    required this.emotion,
    required this.gazeX,
    required this.gazeY,
    required this.blinkProgress,
    required this.squintAmount,
    required this.pupilDilation,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final eyeWidth = size.width * 0.32;
    final eyeHeight = size.height * 0.50;
    final eyeSpacing = size.width * 0.06;

    final leftEyeCenter = Offset(center.dx - eyeWidth / 2 - eyeSpacing / 2, center.dy);
    final rightEyeCenter = Offset(center.dx + eyeWidth / 2 + eyeSpacing / 2, center.dy);

    // Draw Left & Right Eyes
    _drawSingleEye(canvas, leftEyeCenter, eyeWidth, eyeHeight, isLeft: true);
    _drawSingleEye(canvas, rightEyeCenter, eyeWidth, eyeHeight, isLeft: false);
  }

  void _drawSingleEye(
    Canvas canvas,
    Offset eyeCenter,
    double width,
    double height, {
    required bool isLeft,
  }) {
    // 1. Sclera Background (White with slight blue sheen)
    final scleraPath = Path();
    final rect = Rect.fromCenter(center: eyeCenter, width: width, height: height);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(width * 0.45));
    scleraPath.addRRect(rrect);

    final scleraPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          Colors.white,
          const Color(0xFFE3F2FD),
        ],
        center: Alignment.center,
        radius: 0.85,
      ).createShader(rect);

    canvas.drawRRect(rrect, scleraPaint);

    // 2. Iris & Pupil Gaze Offset
    final maxGazeOffsetX = width * 0.22;
    final maxGazeOffsetY = height * 0.22;
    final pupilCenter = Offset(
      eyeCenter.dx + (gazeX * maxGazeOffsetX),
      eyeCenter.dy + (gazeY * maxGazeOffsetY),
    );

    canvas.save();
    canvas.clipPath(scleraPath);

    // Iris Base
    final baseIrisRadius = (width * 0.28) * pupilDilation;
    final irisPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF00B0FF), // Bright cyan inner
          const Color(0xFF0072C6), // Cobalt outer
          const Color(0xFF001A33), // Deep rim
        ],
        stops: const [0.0, 0.7, 1.0],
      ).createShader(Rect.fromCircle(center: pupilCenter, radius: baseIrisRadius));

    canvas.drawCircle(pupilCenter, baseIrisRadius, irisPaint);

    // Black Inner Pupil
    final pupilPaint = Paint()..color = const Color(0xFF050B14);
    canvas.drawCircle(pupilCenter, baseIrisRadius * 0.55, pupilPaint);

    // Dual Specular Eye Shine (Pixar signature double reflection)
    final mainShineCenter = Offset(
      pupilCenter.dx - baseIrisRadius * 0.3,
      pupilCenter.dy - baseIrisRadius * 0.3,
    );
    final secShineCenter = Offset(
      pupilCenter.dx + baseIrisRadius * 0.35,
      pupilCenter.dy + baseIrisRadius * 0.25,
    );

    final shinePaint = Paint()..color = Colors.white.withOpacity(0.92);
    canvas.drawCircle(mainShineCenter, baseIrisRadius * 0.28, shinePaint);
    canvas.drawCircle(secShineCenter, baseIrisRadius * 0.14, shinePaint);

    // 3. Dynamic Eyelid & Emotion Overlay
    _drawEyelidsAndEyebrows(canvas, eyeCenter, width, height, isLeft);

    canvas.restore();
  }

  void _drawEyelidsAndEyebrows(
    Canvas canvas,
    Offset eyeCenter,
    double width,
    double height,
    bool isLeft,
  ) {
    final lidColor = const Color(0xFF0D1117); // Dark robot background color
    final lidPaint = Paint()..color = lidColor;

    // Calculate Blink & Sleepy Eyelid Overlap
    double topLidCoverage = blinkProgress;
    double bottomLidCoverage = blinkProgress * 0.4;

    if (emotion == EyeEmotion.sleepy) {
      topLidCoverage = math.max(topLidCoverage, 0.55);
    } else if (emotion == EyeEmotion.thinking) {
      topLidCoverage = math.max(topLidCoverage, 0.25);
    } else if (emotion == EyeEmotion.curious) {
      if (isLeft) topLidCoverage = math.max(topLidCoverage, 0.30);
    } else if (squintAmount > 0) {
      topLidCoverage = math.max(topLidCoverage, squintAmount * 0.4);
      bottomLidCoverage = math.max(bottomLidCoverage, squintAmount * 0.3);
    }

    // Top Eyelid Path
    if (topLidCoverage > 0.0) {
      final topLidHeight = height * topLidCoverage;
      final topRect = Rect.fromLTWH(
        eyeCenter.dx - width / 2 - 5,
        eyeCenter.dy - height / 2 - 5,
        width + 10,
        topLidHeight + 5,
      );
      canvas.drawRect(topRect, lidPaint);
    }

    // Bottom Eyelid Path
    if (bottomLidCoverage > 0.0) {
      final bottomLidHeight = height * bottomLidCoverage;
      final bottomRect = Rect.fromLTWH(
        eyeCenter.dx - width / 2 - 5,
        eyeCenter.dy + height / 2 - bottomLidHeight,
        width + 10,
        bottomLidHeight + 5,
      );
      canvas.drawRect(bottomRect, lidPaint);
    }

    // Eyebrow Angled Expressive Line
    final browPaint = Paint()
      ..color = const Color(0xFFFFD700) // Golden yellow brow accent
      ..strokeWidth = 6.0
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    double browTilt = 0.0;
    if (emotion == EyeEmotion.angry) {
      browTilt = isLeft ? 0.35 : -0.35;
    } else if (emotion == EyeEmotion.curious) {
      browTilt = isLeft ? -0.30 : 0.10;
    } else if (emotion == EyeEmotion.sad) {
      browTilt = isLeft ? -0.25 : 0.25;
    }

    final browStartY = eyeCenter.dy - height / 2 - 12;
    final browStart = Offset(eyeCenter.dx - width * 0.4, browStartY - (browTilt * 20));
    final browEnd = Offset(eyeCenter.dx + width * 0.4, browStartY + (browTilt * 20));

    canvas.drawLine(browStart, browEnd, browPaint);
  }

  @override
  bool shouldRepaint(covariant _McQueenEyePainter oldDelegate) {
    return oldDelegate.emotion != emotion ||
        oldDelegate.gazeX != gazeX ||
        oldDelegate.gazeY != gazeY ||
        oldDelegate.blinkProgress != blinkProgress ||
        oldDelegate.squintAmount != squintAmount ||
        oldDelegate.pupilDilation != pupilDilation;
  }
}
