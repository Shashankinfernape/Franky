export type TargetSource = 'iris' | 'face' | 'body' | 'motion' | 'idle';

export interface Point2D {
  x: number; // Normalized coordinate [-1.0, 1.0] (0 is center)
  y: number; // Normalized coordinate [-1.0, 1.0] (0 is center)
}

export interface VisionTarget {
  source: TargetSource;
  point: Point2D;
  confidence: number; // 0.0 to 1.0
  timestamp: number;
  metadata?: {
    irisLeft?: Point2D;
    irisRight?: Point2D;
    headEuler?: { yaw: number; pitch: number; roll: number };
    motionEnergy?: number;
    distance?: number;
  };
}

export type AttentionState =
  | 'IDLE'
  | 'TRACKING_HUMAN'
  | 'CURIOUS_GLANCE'
  | 'RETURNING'
  | 'SEARCHING';

export interface AttentionOutput {
  state: AttentionState;
  targetPoint: Point2D; // Raw arbitrated target [-1, 1]
  smoothedPoint: Point2D; // 1€ / EMA filtered target [-1, 1]
  activeSource: TargetSource;
  confidence: number;
  curiosityScore: number;
  curiosityDilation: number; // 0.0 to 0.3 pupil scale boost when curious
  isGlancing: boolean;
}

export interface AttentionConfig {
  irisWeight: number; // default 0.75
  headYawWeight: number; // default 0.25
  enableCuriosity: boolean; // default false for strict human focus (Eyes -> Face -> Body)
  curiosityThreshold: number; // default 0.65
  curiosityMinDurationMs: number; // default 700ms
  curiosityMaxDurationMs: number; // default 1400ms
  curiosityCooldownMs: number; // default 3000ms
  humanPersistenceMs: number; // hold human target for X ms if lost
}
