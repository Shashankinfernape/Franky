import 'package:flutter_test/flutter_test.dart';
import 'package:emiot_app/main.dart';

void main() {
  testWidgets('Emiot App Smoke Test', (WidgetTester tester) async {
    await tester.pumpWidget(const EmiotApp());
    expect(find.byType(EmiotApp), findsOneWidget);
  });
}
