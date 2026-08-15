import type { Point2D, VisionTarget } from '../types/vision';

export interface MotionConfig {
  diffThreshold: number; // Pixel intensity difference (0-255) to count as movement
  minMotionPixels: number; // Minimum moving pixels to be considered intentional motion
  maxMotionFraction: number; // Discard whole-screen illumination changes (e.g., lights turned on)
  width: number;
  height: number;
}

export class MotionSaliencyDetector {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private prevFrameData: Uint8ClampedArray | null = null;
  private config: MotionConfig;

  // Curiosity persistence tracker
  private candidateCentroid: Point2D | null = null;
  private candidateStartTime: number = 0;

  constructor(config: Partial<MotionConfig> = {}) {
    this.config = {
      diffThreshold: 28,
      minMotionPixels: 45,
      maxMotionFraction: 0.65, // >65% screen motion is a camera shake/light flip, ignore
      width: 160,
      height: 120,
      ...config,
    };

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.width;
    this.canvas.height = this.config.height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Process a video frame for motion saliency.
   * @param video HTMLVideoElement
   * @param currentGaze Current gaze point [-1, 1] to calculate peripheral saliency
   * @param humanRegion Optional bounding box of tracked human to mask out
   */
  processFrame(
    video: HTMLVideoElement,
    currentGaze: Point2D = { x: 0, y: 0 },
    humanRegion?: { minX: number; maxX: number; minY: number; maxY: number }
  ): VisionTarget | null {
    if (!this.ctx || video.readyState < 2) return null;

    const { width, height, diffThreshold, minMotionPixels, maxMotionFraction } = this.config;

    // Draw downscaled frame
    this.ctx.drawImage(video, 0, 0, width, height);
    const imgData = this.ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const now = performance.now();

    if (!this.prevFrameData || this.prevFrameData.length !== data.length) {
      this.prevFrameData = new Uint8ClampedArray(data);
      return null;
    }

    let motionCount = 0;
    let sumX = 0;
    let sumY = 0;
    let totalEnergy = 0;

    const totalPixels = width * height;

    for (let i = 0; i < data.length; i += 4) {
      const pixelIdx = i / 4;
      const px = pixelIdx % width;
      const py = Math.floor(pixelIdx / width);

      // Normalized coordinates in camera view [0, 1]
      const normX = px / width;
      const normY = py / height;

      // Mask out tracked human body/face if provided
      if (humanRegion) {
        if (
          normX >= humanRegion.minX &&
          normX <= humanRegion.maxX &&
          normY >= humanRegion.minY &&
          normY <= humanRegion.maxY
        ) {
          continue;
        }
      }

      // Convert RGB to approximate luminance
      const currLum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const prevLum =
        0.299 * this.prevFrameData[i] +
        0.587 * this.prevFrameData[i + 1] +
        0.114 * this.prevFrameData[i + 2];

      const diff = Math.abs(currLum - prevLum);

      if (diff > diffThreshold) {
        motionCount++;
        sumX += px;
        sumY += py;
        totalEnergy += diff;
      }
    }

    // Update previous frame
    this.prevFrameData.set(data);

    // Reject lighting shifts or whole camera movements
    const motionFraction = motionCount / totalPixels;
    if (motionCount < minMotionPixels || motionFraction > maxMotionFraction) {
      // Reset candidate if motion drops
      if (now - this.candidateStartTime > 300) {
        this.candidateCentroid = null;
        this.candidateStartTime = 0;
      }
      return null;
    }

    // Centroid in camera space (0 to 1) -> mirror X for natural webcam interaction (-1 to 1)
    const rawCentroidX = sumX / motionCount / width;
    const rawCentroidY = sumY / motionCount / height;

    // Mirrored for selfie cam: looking left in camera means looking right in eye screen
    const targetX = -(rawCentroidX - 0.5) * 2.0;
    const targetY = (rawCentroidY - 0.5) * 2.0;

    // Calculate motion energy density
    const energyDensity = Math.min(1.0, totalEnergy / (motionCount * 128));

    // Distance from current gaze (peripheral objects are more salient!)
    const dx = targetX - currentGaze.x;
    const dy = targetY - currentGaze.y;
    const distFromGaze = Math.sqrt(dx * dx + dy * dy);
    const peripheralWeight = Math.min(1.5, 0.5 + distFromGaze * 0.7);

    // Novelty / Persistence check (Must persist for >120ms to avoid single-frame glitch)
    if (!this.candidateCentroid) {
      this.candidateCentroid = { x: targetX, y: targetY };
      this.candidateStartTime = now;
      return null;
    }

    const duration = now - this.candidateStartTime;
    if (duration < 120) {
      // Still warming up
      return null;
    }

    // Curiosity Saliency Score calculation
    const persistenceScore = Math.min(1.0, duration / 250);
    const curiosityScore = Math.min(
      1.0,
      energyDensity * 0.45 +
        distFromGaze * 0.25 +
        peripheralWeight * 0.15 +
        persistenceScore * 0.15
    );

    return {
      source: 'motion',
      point: { x: targetX, y: targetY },
      confidence: curiosityScore,
      timestamp: now,
      metadata: {
        motionEnergy: energyDensity,
        distance: distFromGaze,
      },
    };
  }

  reset(): void {
    this.prevFrameData = null;
    this.candidateCentroid = null;
    this.candidateStartTime = 0;
  }
}
