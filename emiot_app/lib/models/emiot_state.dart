
enum EyeEmotion {
  idle,
  blink,
  listening,
  thinking,
  excited,
  curious,
  angry,
  sleepy,
  love,
  confused,
  surprised,
  sad,
  scared,
}

class PersonalityState {
  final double energy;
  final double curiosity;
  final double mood;
  final double sleepiness;
  final double excitement;
  final double trust;
  final double batteryLevel;
  final String dominantEmotion;

  const PersonalityState({
    this.energy = 0.9,
    this.curiosity = 0.75,
    this.mood = 0.8,
    this.sleepiness = 0.1,
    this.excitement = 0.5,
    this.trust = 0.7,
    this.batteryLevel = 1.0,
    this.dominantEmotion = 'idle',
  });

  factory PersonalityState.fromJson(Map<String, dynamic> json) {
    return PersonalityState(
      energy: (json['energy'] as num?)?.toDouble() ?? 0.9,
      curiosity: (json['curiosity'] as num?)?.toDouble() ?? 0.75,
      mood: (json['mood'] as num?)?.toDouble() ?? 0.8,
      sleepiness: (json['sleepiness'] as num?)?.toDouble() ?? 0.1,
      excitement: (json['excitement'] as num?)?.toDouble() ?? 0.5,
      trust: (json['trust'] as num?)?.toDouble() ?? 0.7,
      batteryLevel: (json['battery_level'] as num?)?.toDouble() ?? 1.0,
      dominantEmotion: json['dominant_emotion'] as String? ?? 'idle',
    );
  }

  PersonalityState copyWith({
    double? energy,
    double? curiosity,
    double? mood,
    double? sleepiness,
    double? excitement,
    double? trust,
    double? batteryLevel,
    String? dominantEmotion,
  }) {
    return PersonalityState(
      energy: energy ?? this.energy,
      curiosity: curiosity ?? this.curiosity,
      mood: mood ?? this.mood,
      sleepiness: sleepiness ?? this.sleepiness,
      excitement: excitement ?? this.excitement,
      trust: trust ?? this.trust,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      dominantEmotion: dominantEmotion ?? this.dominantEmotion,
    );
  }
}
