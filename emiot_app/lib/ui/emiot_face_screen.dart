import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';

import '../features/animation/rive_eye_controller.dart';
import '../features/perception/saccadic_attention.dart';
import '../features/network/websocket_service.dart';
import '../models/emiot_state.dart';

class EmiotFaceScreen extends StatefulWidget {
  const EmiotFaceScreen({super.key});

  @override
  State<EmiotFaceScreen> createState() => _EmiotFaceScreenState();
}

class _EmiotFaceScreenState extends State<EmiotFaceScreen> with SingleTickerProviderStateMixin {
  late AnimationController _tickerController;
  final TextEditingController _speechInputController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tickerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..addListener(() {
        context.read<SaccadicAttentionController>().updateTick(0.016);
      });
    _tickerController.repeat();

    // Connect WebSocket on startup
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<WebSocketService>().connect("ws://localhost:8008/ws/emiot");
    });
  }

  @override
  void dispose() {
    _tickerController.dispose();
    _speechInputController.dispose();
    super.dispose();
  }

  void _sendSpeech(String text) {
    if (text.trim().isEmpty) return;
    final ws = context.read<WebSocketService>();
    ws.sendUserSpeech(text.trim());
    _speechInputController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final attention = context.watch<SaccadicAttentionController>();
    final ws = context.watch<WebSocketService>();
    final activeEmotion = ws.currentEmotion;
    final pState = ws.personalityState;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0E14),
      body: SafeArea(
        child: Column(
          children: [
            // Clean Top Header Status Bar
            _buildTopHeader(ws, pState),

            // Main 60 FPS Lightning McQueen Eye Stage
            Expanded(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Subtle Dynamic Radial Glow matching emotion
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          center: Alignment.center,
                          radius: 0.6,
                          colors: [
                            _getEmotionGlowColor(activeEmotion).withOpacity(0.12),
                            Colors.transparent,
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Eyes Stage
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
                    child: RiveOrProceduralEyeStage(
                      emotion: activeEmotion,
                      gazeX: attention.gazeX,
                      gazeY: attention.gazeY,
                      blinkProgress: attention.blinkProgress,
                      headTilt: attention.headTilt,
                    ),
                  ),
                ],
              ),
            ),

            // Floating Subtitle Response Box
            if (ws.latestTextResponse.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFF161B22).withOpacity(0.95),
                    borderRadius: BorderRadius.circular(16.0),
                    border: Border.all(color: const Color(0xFF30363D)),
                    boxShadow: [
                      BoxShadow(
                        color: _getEmotionGlowColor(activeEmotion).withOpacity(0.2),
                        blurRadius: 12,
                        spreadRadius: 1,
                      )
                    ],
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.record_voice_over_rounded, color: Color(0xFF00B0FF), size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          ws.latestTextResponse,
                          style: GoogleFonts.outfit(
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: 8),

            // Bottom Input Controls Bar
            _buildBottomControlsBar(ws),
          ],
        ),
      ),
    );
  }

  Widget _buildTopHeader(WebSocketService ws, PersonalityState pState) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 12.0),
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(16.0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: ws.isConnected ? const Color(0xFF00E676) : const Color(0xFFFF1744),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                "EMIOT CORE",
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          Row(
            children: [
              _buildStatChip(Icons.bolt, "${(pState.energy * 100).round()}%", Colors.amber),
              const SizedBox(width: 8),
              _buildStatChip(Icons.center_focus_strong, "${(pState.curiosity * 100).round()}%", Colors.cyan),
              const SizedBox(width: 8),
              _buildStatChip(Icons.battery_charging_full, "${(pState.batteryLevel * 100).round()}%", Colors.greenAccent),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildStatChip(IconData icon, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12.0),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            value,
            style: GoogleFonts.outfit(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControlsBar(WebSocketService ws) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20.0)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _speechInputController,
              onSubmitted: _sendSpeech,
              style: GoogleFonts.outfit(color: Colors.white),
              decoration: InputDecoration(
                hintText: "Say something to Emiot...",
                hintStyle: GoogleFonts.outfit(color: Colors.white38),
                filled: true,
                fillColor: const Color(0xFF0D1117),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24.0),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: () => _sendSpeech(_speechInputController.text),
            child: Container(
              padding: const EdgeInsets.all(14.0),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [Color(0xFF00B0FF), Color(0xFF00E5FF)],
                ),
              ),
              child: const Icon(
                Icons.send_rounded,
                color: Colors.black,
                size: 22,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _getEmotionGlowColor(EyeEmotion emotion) {
    switch (emotion) {
      case EyeEmotion.excited:
        return const Color(0xFFFFD700);
      case EyeEmotion.curious:
        return const Color(0xFF00E5FF);
      case EyeEmotion.listening:
        return const Color(0xFF00E676);
      case EyeEmotion.thinking:
        return const Color(0xFFAB47BC);
      case EyeEmotion.sleepy:
        return const Color(0xFF5C6BC0);
      case EyeEmotion.angry:
        return const Color(0xFFFF1744);
      case EyeEmotion.surprised:
        return const Color(0xFFFF9100);
      case EyeEmotion.love:
        return const Color(0xFFFF4081);
      default:
        return const Color(0xFF00B0FF);
    }
  }
}
