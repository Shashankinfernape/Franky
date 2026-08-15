import type {
  AttentionConfig,
  AttentionOutput,
  AttentionState,
  Point2D,
  TargetSource,
  VisionTarget,
} from '../types/vision';
import { OneEuroFilter2D } from '../utils/oneEuroFilter';

const DEFAULT_CONFIG: AttentionConfig = {
  irisWeight: 0.75,
  headYawWeight: 0.25,
  enableCuriosity: false, // Default: Focus strictly on human eyes -> face -> body
  curiosityThreshold: 0.62,
  curiosityMinDurationMs: 650,
  curiosityMaxDurationMs: 1200,
  curiosityCooldownMs: 3200, // 3.2s anti-ADHD cooldown
  humanPersistenceMs: 1600, // Hold last known human target for 1.6s
};

export class AttentionArbitrator {
  private config: AttentionConfig;
  private filter: OneEuroFilter2D;

  private state: AttentionState = 'IDLE';

  // Last known human target
  private lastHumanTarget: VisionTarget | null = null;
  private lastHumanTimestamp: number = 0;

  // Curiosity glance management
  private glanceStartTime: number = 0;
  private glanceDuration: number = 0;
  private glanceTargetPoint: Point2D = { x: 0, y: 0 };
  private lastGlanceEndTime: number = 0;

  constructor(config: Partial<AttentionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // 1€ Filter: minCutoff = 1.2 Hz (smooth stationary gaze), beta = 0.008 (snappy saccades)
    this.filter = new OneEuroFilter2D(1.2, 0.008, 1.0);
  }

  update(targets: VisionTarget[], now: number = performance.now()): AttentionOutput {
    // 1. Separate human targets from motion targets
    // Strict priority: Iris (high confidence) > Face (medium confidence) > Body (fallback)
    const irisTarget = targets.find((t) => t.source === 'iris' && t.confidence > 0.4);
    const faceTarget = targets.find((t) => t.source === 'face' && t.confidence > 0.35);
    const bodyTarget = targets.find((t) => t.source === 'body' && t.confidence > 0.3);
    const motionTarget = this.config.enableCuriosity
      ? targets.find((t) => t.source === 'motion' && t.confidence > 0.3)
      : undefined;

    // Pick best available human target (Cascade Priority: Eyes / Iris -> Face Trajectory -> Body / Torso)
    let bestHumanTarget: VisionTarget | null = null;
    if (irisTarget) {
      bestHumanTarget = irisTarget;
    } else if (faceTarget) {
      bestHumanTarget = faceTarget;
    } else if (bodyTarget) {
      bestHumanTarget = bodyTarget;
    }

    if (bestHumanTarget) {
      this.lastHumanTarget = bestHumanTarget;
      this.lastHumanTimestamp = now;
    }

    const hasRecentHuman =
      this.lastHumanTarget !== null && now - this.lastHumanTimestamp < this.config.humanPersistenceMs;

    const timeSinceLastGlance = now - this.lastGlanceEndTime;
    const isCooldownActive = timeSinceLastGlance < this.config.curiosityCooldownMs;

    let targetPoint: Point2D = { x: 0, y: 0 };
    let activeSource: TargetSource = 'idle';
    let confidence = 0.0;
    let curiosityScore = motionTarget ? motionTarget.confidence : 0;
    let curiosityDilation = 0.0;
    let isGlancing = false;

    // 2. State Machine Transitions
    switch (this.state) {
      case 'IDLE':
      case 'SEARCHING':
      case 'TRACKING_HUMAN':
      case 'RETURNING': {
        // Check if curiosity glance should trigger (only when enableCuriosity is active)
        const shouldTriggerGlance =
          this.config.enableCuriosity &&
          motionTarget &&
          motionTarget.confidence >= this.config.curiosityThreshold &&
          !isCooldownActive &&
          this.state !== 'RETURNING';

        if (shouldTriggerGlance) {
          this.state = 'CURIOUS_GLANCE';
          this.glanceStartTime = now;
          const energy = motionTarget.metadata?.motionEnergy ?? 0.5;
          this.glanceDuration =
            this.config.curiosityMinDurationMs +
            energy * (this.config.curiosityMaxDurationMs - this.config.curiosityMinDurationMs);
          this.glanceTargetPoint = { ...motionTarget.point };

          targetPoint = this.glanceTargetPoint;
          activeSource = 'motion';
          confidence = motionTarget.confidence;
          isGlancing = true;
          curiosityDilation = 0.18;
        } else if (bestHumanTarget) {
          this.state = 'TRACKING_HUMAN';
          targetPoint = bestHumanTarget.point;
          activeSource = bestHumanTarget.source;
          confidence = bestHumanTarget.confidence;
        } else if (hasRecentHuman) {
          this.state = 'SEARCHING';
          targetPoint = this.lastHumanTarget!.point;
          activeSource = this.lastHumanTarget!.source;
          confidence = Math.max(
            0.1,
            1.0 - (now - this.lastHumanTimestamp) / this.config.humanPersistenceMs
          );
        } else {
          this.state = 'IDLE';
          targetPoint = { x: 0, y: 0 };
          activeSource = 'idle';
          confidence = 0.0;
        }
        break;
      }

      case 'CURIOUS_GLANCE': {
        const elapsed = now - this.glanceStartTime;
        if (elapsed < this.glanceDuration) {
          if (motionTarget && motionTarget.confidence > 0.4) {
            this.glanceTargetPoint = {
              x: this.glanceTargetPoint.x * 0.8 + motionTarget.point.x * 0.2,
              y: this.glanceTargetPoint.y * 0.8 + motionTarget.point.y * 0.2,
            };
          }
          targetPoint = this.glanceTargetPoint;
          activeSource = 'motion';
          confidence = 0.9;
          isGlancing = true;
          curiosityDilation = 0.2;
        } else {
          this.state = 'RETURNING';
          this.lastGlanceEndTime = now;

          if (bestHumanTarget) {
            targetPoint = bestHumanTarget.point;
            activeSource = bestHumanTarget.source;
            confidence = bestHumanTarget.confidence;
          } else if (hasRecentHuman) {
            targetPoint = this.lastHumanTarget!.point;
            activeSource = this.lastHumanTarget!.source;
            confidence = 0.5;
          } else {
            targetPoint = { x: 0, y: 0 };
            activeSource = 'idle';
            confidence = 0.0;
          }
        }
        break;
      }
    }

    // 3. Clamp target point to [-1.0, 1.0]
    const clampedTarget: Point2D = {
      x: Math.max(-1.0, Math.min(1.0, targetPoint.x)),
      y: Math.max(-1.0, Math.min(1.0, targetPoint.y)),
    };

    // 4. Smooth coordinates with 1€ adaptive filter
    const smoothedPoint = this.filter.filter(clampedTarget.x, clampedTarget.y, now);

    return {
      state: this.state,
      targetPoint: clampedTarget,
      smoothedPoint: {
        x: Math.max(-1.0, Math.min(1.0, smoothedPoint.x)),
        y: Math.max(-1.0, Math.min(1.0, smoothedPoint.y)),
      },
      activeSource,
      confidence,
      curiosityScore,
      curiosityDilation,
      isGlancing,
    };
  }

  setConfig(newConfig: Partial<AttentionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AttentionConfig {
    return { ...this.config };
  }

  reset(): void {
    this.filter.reset();
    this.state = 'IDLE';
    this.lastHumanTarget = null;
    this.lastHumanTimestamp = 0;
    this.glanceStartTime = 0;
    this.lastGlanceEndTime = 0;
  }
}
