export type EmotionalState =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'focused'
  | 'excited'
  | 'confused'
  | 'thinking'
  | 'sleepy'
  | 'sad'
  | 'angry'
  | 'embarrassed'
  | 'listening'
  | 'talking'
  | 'celebrating';

export interface GazePoint {
  x: number; // Normalized -1 (left) to 1 (right)
  y: number; // Normalized -1 (top) to 1 (bottom)
}

export interface EmotionConfig {
  name: EmotionalState;
  label: string;
  description: string;
  // Lid Path specifications for SVG viewBox (0 0 200 200)
  upperLidLeft: string;
  upperLidRight: string;
  lowerLidLeft: string;
  lowerLidRight: string;
  // Dynamic eye parameters
  pupilScale: number; // 0.6 to 1.35
  irisBrightness: number; // 0.8 to 1.4
  irisGlowRadius: number; // 0 to 15px
  scleraTint: string; // warm white variant
  lidColorGradient: [string, string, string]; // Top, Middle, Bottom gradient colors
  tiltLeft: number; // Angle degrees for expression asymmetry
  tiltRight: number;
  squintLeft: number; // 0 to 1
  squintRight: number;
  browHeightLeft: number; // offset Y
  browHeightRight: number;
  saccadeSpeed: number; // Speed multiplier for micro movements
  blinkFrequencyMultiplier: number;
}
