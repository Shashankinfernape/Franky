import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:rive/rive.dart';
import '../../models/emiot_state.dart';
import 'procedural_eye_painter.dart';

class RiveOrProceduralEyeStage extends StatefulWidget {
  final EyeEmotion emotion;
  final double gazeX;
  final double gazeY;
  final double blinkProgress;
  final double headTilt;
  final String riveAssetPath;

  const RiveOrProceduralEyeStage({
    super.key,
    required this.emotion,
    this.gazeX = 0.0,
    this.gazeY = 0.0,
    this.blinkProgress = 0.0,
    this.headTilt = 0.0,
    this.riveAssetPath = 'rive/emiot_eyes.riv',
  });

  @override
  State<RiveOrProceduralEyeStage> createState() => _RiveOrProceduralEyeStageState();
}

class _RiveOrProceduralEyeStageState extends State<RiveOrProceduralEyeStage> {
  Artboard? _riveArtboard;
  StateMachineController? _controller;
  StateMachineController? get riveController => _controller;
  SMIInput<double>? _gazeXInput;
  SMIInput<double>? _gazeYInput;
  SMIInput<double>? _expressionInput;
  bool _hasRiveFile = false;

  @override
  void initState() {
    super.initState();
    _loadRiveFile();
  }

  Future<void> _loadRiveFile() async {
    try {
      final bytes = await rootBundle.load(widget.riveAssetPath);
      final file = RiveFile.import(bytes);
      final artboard = file.mainArtboard;
      var controller = StateMachineController.fromArtboard(artboard, 'EmiotEyesState');
      if (controller != null) {
        artboard.addController(controller);
        _gazeXInput = controller.findInput<double>('gaze_x');
        _gazeYInput = controller.findInput<double>('gaze_y');
        _expressionInput = controller.findInput<double>('expression_id');
      }
      setState(() {
        _riveArtboard = artboard;
        _controller = controller;
        _hasRiveFile = true;
      });
    } catch (_) {
      // Rive file not present yet -> seamless procedural fallback
      setState(() {
        _hasRiveFile = false;
      });
    }
  }

  @override
  void didUpdateWidget(covariant RiveOrProceduralEyeStage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_hasRiveFile) {
      _gazeXInput?.value = widget.gazeX;
      _gazeYInput?.value = widget.gazeY;
      _expressionInput?.value = widget.emotion.index.toDouble();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_hasRiveFile && _riveArtboard != null) {
      return Rive(
        artboard: _riveArtboard!,
        fit: BoxFit.contain,
      );
    }

    // Default Procedural 60 FPS McQueen Eyes
    return EmiotProceduralEyes(
      emotion: widget.emotion,
      gazeX: widget.gazeX,
      gazeY: widget.gazeY,
      blinkProgress: widget.blinkProgress,
      headTilt: widget.headTilt,
    );
  }
}
