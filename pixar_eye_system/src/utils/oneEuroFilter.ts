/**
 * 1€ (One-Euro) Filter for 2D Point Tracking
 * Casiez, G., Roussel, N. and Vogel, D. (2012)
 * Eliminates webcam landmark jitter at low speeds while maintaining zero lag at high speeds.
 */

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;
  private alpha: number = 0.5;

  constructor(alpha: number = 0.5) {
    this.alpha = alpha;
  }

  filter(value: number, alpha: number): number {
    this.alpha = alpha;
    if (this.s === null) {
      this.s = value;
    } else {
      this.s = this.alpha * value + (1.0 - this.alpha) * this.s;
    }
    this.y = value;
    return this.s;
  }

  hasLastRawValue(): boolean {
    return this.y !== null;
  }

  lastRawValue(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter2D {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private yFilter = new LowPassFilter();
  private dyFilter = new LowPassFilter();

  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  filter(x: number, y: number, timestampMs: number = performance.now()): { x: number; y: number } {
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      this.xFilter.filter(x, 1.0);
      this.yFilter.filter(y, 1.0);
      return { x, y };
    }

    const dt = (timestampMs - this.lastTime) / 1000.0;
    this.lastTime = timestampMs;

    if (dt <= 0) {
      return {
        x: this.xFilter.lastRawValue(),
        y: this.yFilter.lastRawValue(),
      };
    }

    const rate = 1.0 / dt;

    // Estimate derivative (velocity)
    const dx = this.xFilter.hasLastRawValue() ? (x - this.xFilter.lastRawValue()) * rate : 0;
    const dy = this.yFilter.hasLastRawValue() ? (y - this.yFilter.lastRawValue()) * rate : 0;

    const edx = this.dxFilter.filter(dx, this.alpha(rate, this.dCutoff));
    const edy = this.dyFilter.filter(dy, this.alpha(rate, this.dCutoff));

    // Dynamic cutoff based on speed
    const speed = Math.sqrt(edx * edx + edy * edy);
    const cutoff = this.minCutoff + this.beta * speed;
    const a = this.alpha(rate, cutoff);

    return {
      x: this.xFilter.filter(x, a),
      y: this.yFilter.filter(y, a),
    };
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.yFilter.reset();
    this.dyFilter.reset();
    this.lastTime = null;
  }
}
