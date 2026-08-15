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
  irisSensitivity: 1.0,
  persistenceMs: 1200, // Hold last known eye target for 1.2s when blinked/obscured
};

export class AttentionArbitrator {
  private config: AttentionConfig;
  private filter: OneEuroFilter2D;

  private state: AttentionState = 'IDLE';

  // Last known eye target
  private lastEyeTarget: VisionTarget | null = null;
  private lastEyeTimestamp: number = 0;

  constructor(config: Partial<AttentionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // 1€ Filter: minCutoff = 1.5 Hz (clean jitter suppression), beta = 0.02 (ultra-fast dynamic response)
    this.filter = new OneEuroFilter2D(1.5, 0.02, 1.0);
  }

  update(targets: VisionTarget[], now: number = performance.now()): AttentionOutput {
    // 1. Search strictly for Iris / Eye target
    const irisTarget = targets.find((t) => t.source === 'iris' && t.confidence > 0.35);

    if (irisTarget) {
      this.lastEyeTarget = irisTarget;
      this.lastEyeTimestamp = now;
    }

    const hasRecentEye =
      this.lastEyeTarget !== null && now - this.lastEyeTimestamp < this.config.persistenceMs;

    let targetPoint: Point2D = { x: 0, y: 0 };
    let activeSource: TargetSource = 'idle';
    let confidence = 0.0;

    // 2. Eyes-Only State Machine Transitions
    if (irisTarget) {
      this.state = 'EYES_LOCKED';
      targetPoint = irisTarget.point;
      activeSource = 'iris';
      confidence = irisTarget.confidence;
    } else if (hasRecentEye) {
      this.state = 'SEARCHING';
      targetPoint = this.lastEyeTarget!.point;
      activeSource = 'iris';
      confidence = Math.max(
        0.1,
        1.0 - (now - this.lastEyeTimestamp) / this.config.persistenceMs
      );
    } else {
      this.state = 'IDLE';
      targetPoint = { x: 0, y: 0 };
      activeSource = 'idle';
      confidence = 0.0;
    }

    // 3. Clamp target point to [-1.0, 1.0]
    const clampedTarget: Point2D = {
      x: Math.max(-1.0, Math.min(1.0, targetPoint.x)),
      y: Math.max(-1.0, Math.min(1.0, targetPoint.y)),
    };

    // 4. Smooth coordinates with 1€ adaptive filter for zero jitter & zero lag
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
    this.lastEyeTarget = null;
    this.lastEyeTimestamp = 0;
  }
}
