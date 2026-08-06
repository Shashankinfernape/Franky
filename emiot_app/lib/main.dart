import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'features/perception/saccadic_attention.dart';
import 'features/network/websocket_service.dart';
import 'ui/emiot_face_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SaccadicAttentionController()),
        ChangeNotifierProvider(create: (_) => WebSocketService()),
      ],
      child: const EmiotApp(),
    ),
  );
}

class EmiotApp extends StatelessWidget {
  const EmiotApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Emiot Autonomous Companion',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0A0E14),
        useMaterial3: true,
      ),
      home: const EmiotFaceScreen(),
    );
  }
}
