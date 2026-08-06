import time
import math
from typing import Dict, Any

class PersonalityEngine:
    """
    Independent Personality Engine for Emiot.
    Manages continuous affect variables (Energy, Curiosity, Mood, Sleepiness, Excitement, Trust)
    operating independently from LLM inference.
    """
    def __init__(self):
        self.energy: float = 0.90         # [0.0, 1.0]
        self.curiosity: float = 0.75      # [0.0, 1.0]
        self.mood: float = 0.80           # [0.0, 1.0] (0.0=sad/upset, 1.0=happy/playful)
        self.sleepiness: float = 0.10     # [0.0, 1.0]
        self.excitement: float = 0.50     # [0.0, 1.0]
        self.trust: float = 0.70          # [0.0, 1.0]
        self.battery_level: float = 1.0   # [0.0, 1.0]
        
        self.last_interaction_time: float = time.time()
        self.last_update_time: float = time.time()

    def update_tick(self, delta_time: float = 1.0, user_present: bool = True):
        """Called periodically (e.g. every second) to apply decay curves and autonomous state updates."""
        now = time.time()
        idle_duration = now - self.last_interaction_time

        # Energy decays slowly over time
        decay_rate = 0.0005 if user_present else 0.0002
        self.energy = max(0.0, self.energy - (decay_rate * delta_time))

        # Battery low increases sleepiness
        if self.battery_level < 0.20:
            self.sleepiness = min(1.0, self.sleepiness + (0.01 * delta_time))
            self.energy = max(0.0, self.energy - (0.002 * delta_time))
        elif self.energy < 0.25:
            self.sleepiness = min(1.0, self.sleepiness + (0.005 * delta_time))

        # Idle duration increases curiosity or sleepiness
        if idle_duration > 30.0:
            self.excitement = max(0.2, self.excitement - (0.01 * delta_time))
            if self.energy > 0.4:
                self.curiosity = min(1.0, self.curiosity + (0.005 * delta_time))
            else:
                self.sleepiness = min(1.0, self.sleepiness + (0.005 * delta_time))

        self.last_update_time = now

    def on_user_speech(self, sentiment_score: float = 0.5):
        """Invoked when user speaks to Emiot."""
        self.last_interaction_time = time.time()
        self.excitement = min(1.0, self.excitement + 0.20)
        self.curiosity = min(1.0, self.curiosity + 0.15)
        
        # Adjust mood based on positive vs negative sentiment
        if sentiment_score > 0.6:
            self.mood = min(1.0, self.mood + 0.10)
            self.trust = min(1.0, self.trust + 0.02)
        elif sentiment_score < 0.4:
            self.mood = max(0.0, self.mood - 0.10)

    def set_battery(self, level: float):
        self.battery_level = max(0.0, min(1.0, level))

    def get_state_payload(self) -> Dict[str, Any]:
        return {
            "energy": round(self.energy, 2),
            "curiosity": round(self.curiosity, 2),
            "mood": round(self.mood, 2),
            "sleepiness": round(self.sleepiness, 2),
            "excitement": round(self.excitement, 2),
            "trust": round(self.trust, 2),
            "battery_level": round(self.battery_level, 2),
            "dominant_emotion": self.compute_dominant_emotion()
        }

    def compute_dominant_emotion(self) -> str:
        if self.sleepiness > 0.70 or self.energy < 0.15:
            return "sleepy"
        if self.excitement > 0.75:
            return "excited"
        if self.curiosity > 0.80:
            return "curiosity"
        if self.mood < 0.35:
            return "sad"
        if self.mood > 0.75:
            return "happy"
        return "idle"

# Global singleton for quick reference
personality_engine = PersonalityEngine()
