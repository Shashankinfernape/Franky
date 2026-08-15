import type { Point2D } from '../types/vision';

export interface CalibrationPoint {
  screenGaze: Point2D; // Known screen gaze where Franky was looking
  pupilCamera: Point2D; // Measured user pupil position in camera frame [0, 1]
}

export interface CalibrationProfile {
  id: string;
  timestamp: number;
  center: CalibrationPoint;
  right: CalibrationPoint;
  left: CalibrationPoint;
  up: CalibrationPoint;
  down: CalibrationPoint;
}

const STORAGE_KEY = 'franky_eye_calibration_v2';

// Default fallback calibration (standard 60cm laptop baseline)
const DEFAULT_PROFILE: CalibrationProfile = {
  id: 'default',
  timestamp: Date.now(),
  center: {
    screenGaze: { x: 0.0, y: 0.0 },
    pupilCamera: { x: 0.50, y: 0.44 },
  },
  right: {
    screenGaze: { x: 0.70, y: 0.0 },
    pupilCamera: { x: 0.20, y: 0.44 },
  },
  left: {
    screenGaze: { x: -0.70, y: 0.0 },
    pupilCamera: { x: 0.80, y: 0.44 },
  },
  up: {
    screenGaze: { x: 0.0, y: -0.55 },
    pupilCamera: { x: 0.50, y: 0.22 },
  },
  down: {
    screenGaze: { x: 0.0, y: 0.45 },
    pupilCamera: { x: 0.50, y: 0.65 },
  },
};

export class GazeCalibrationManager {
  private profile: CalibrationProfile;

  constructor() {
    this.profile = this.loadProfile();
  }

  loadProfile(): CalibrationProfile {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[Calibration] Failed to read from localStorage:', e);
    }
    return { ...DEFAULT_PROFILE };
  }

  saveProfile(profile: CalibrationProfile): void {
    this.profile = profile;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      console.log('[Calibration] Saved custom calibration profile:', profile);
    } catch (e) {
      console.warn('[Calibration] Failed to save to localStorage:', e);
    }
  }

  resetToDefault(): void {
    this.profile = { ...DEFAULT_PROFILE, timestamp: Date.now() };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn(e);
    }
  }

  getProfile(): CalibrationProfile {
    return this.profile;
  }

  hasCustomCalibration(): boolean {
    return this.profile.id !== 'default';
  }

  /**
   * Piecewise Bilinear Interpolation Transform
   * Maps measured camera pupil coordinates (u, v) [0, 1] directly to calibrated screen gaze [-1, 1]
   */
  mapCameraToScreenGaze(rawPupil: Point2D): Point2D {
    const { center, right, left, up, down } = this.profile;

    const u = rawPupil.x;
    const v = rawPupil.y;

    const uCenter = center.pupilCamera.x;
    const vCenter = center.pupilCamera.y;

    let gazeX = 0;
    let gazeY = 0;

    // Horizontal Mapping:
    // In camera selfie space: u < uCenter means user is on screen RIGHT
    // u > uCenter means user is on screen LEFT
    if (u <= uCenter) {
      const uRight = right.pupilCamera.x;
      const span = Math.abs(uRight - uCenter) || 0.25;
      const t = (uCenter - u) / span; // 0 at center, 1 at right target
      gazeX = t * right.screenGaze.x;
    } else {
      const uLeft = left.pupilCamera.x;
      const span = Math.abs(uLeft - uCenter) || 0.25;
      const t = (u - uCenter) / span; // 0 at center, 1 at left target
      gazeX = t * left.screenGaze.x;
    }

    // Vertical Mapping:
    // v < vCenter means user is above (looking UP)
    // v > vCenter means user is below (looking DOWN)
    if (v <= vCenter) {
      const vUp = up.pupilCamera.y;
      const span = Math.abs(vCenter - vUp) || 0.20;
      const t = (vCenter - v) / span;
      gazeY = t * up.screenGaze.y;
    } else {
      const vDown = down.pupilCamera.y;
      const span = Math.abs(vDown - vCenter) || 0.20;
      const t = (v - vCenter) / span;
      gazeY = t * down.screenGaze.y;
    }

    return {
      x: Math.max(-1.0, Math.min(1.0, gazeX)),
      y: Math.max(-1.0, Math.min(1.0, gazeY)),
    };
  }
}

export const gazeCalibration = new GazeCalibrationManager();
