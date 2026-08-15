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
    earLeft?: number;
    earRight?: number;
    headEuler?: { yaw: number; pitch: number; roll: number };
    motionEnergy?: number;
    distance?: number;
  };
}

export type AttentionState =
  | 'IDLE'
  | 'EYES_LOCKED'
  | 'SEARCHING';

export interface AttentionOutput {
  state: AttentionState;
  targetPoint: Point2D; // Raw arbitrated target [-1, 1]
  smoothedPoint: Point2D; // 1€ / EMA filtered target [-1, 1]
  activeSource: TargetSource;
  confidence: number;
}

export interface AttentionConfig {
  irisSensitivity: number; // default 1.2
  persistenceMs: number; // hold last eye target for X ms if lost
}
