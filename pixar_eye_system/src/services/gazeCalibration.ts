import type { Point2D } from '../types/vision';

export interface CalibrationPoint {
  screenGaze: Point2D;
  pupilCamera: Point2D;
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

const STORAGE_KEY = 'franky_custom_calibration_permanent_v1';

// Default initial calibration profile
const DEFAULT_PROFILE: CalibrationProfile = {
  id: 'default',
  timestamp: 0,
  center: {
    screenGaze: { x: 0.0, y: 0.0 },
    pupilCamera: { x: 0.50, y: 0.40 },
  },
  right: {
    screenGaze: { x: 0.60, y: 0.0 },
    pupilCamera: { x: 0.38, y: 0.40 },
  },
  left: {
    screenGaze: { x: -0.60, y: 0.0 },
    pupilCamera: { x: 0.62, y: 0.40 },
  },
  up: {
    screenGaze: { x: 0.0, y: -0.45 },
    pupilCamera: { x: 0.50, y: 0.32 },
  },
  down: {
    screenGaze: { x: 0.0, y: 0.40 },
    pupilCamera: { x: 0.50, y: 0.48 },
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
        const parsed = JSON.parse(saved);
        if (parsed && parsed.center && parsed.right && parsed.left) {
          console.log('[Calibration] Loaded cached profile from localStorage:', parsed);
          return parsed;
        }
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
      console.log('[Calibration] Successfully cached profile to localStorage:', profile);
    } catch (e) {
      console.warn('[Calibration] Failed to save to localStorage:', e);
    }
  }

  resetToDefault(): void {
    this.profile = { ...DEFAULT_PROFILE };
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[Calibration] Cleared cached calibration, reset to default.');
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
   * Ground-Truth Direct Dynamic Calibration Transform
   * Maps measured camera pupil (u, v) proportionally to user's exact locked screen coordinates
   */
  mapCameraToScreenGaze(rawPupil: Point2D): Point2D {
    const u = rawPupil.x;
    const v = rawPupil.y;
    const { center, right, left, up, down } = this.profile;

    const uCenter = center.pupilCamera.x;
    const vCenter = center.pupilCamera.y;

    const du = u - uCenter;
    const dv = v - vCenter;

    // Measured physical movement span from user's calibration (min 0.03 to avoid div zero)
    const spanRight = Math.max(0.03, Math.abs(right.pupilCamera.x - uCenter));
    const spanLeft = Math.max(0.03, Math.abs(left.pupilCamera.x - uCenter));
    const spanUp = Math.max(0.025, Math.abs(vCenter - up.pupilCamera.y));
    const spanDown = Math.max(0.025, Math.abs(down.pupilCamera.y - vCenter));

    let gazeX = center.screenGaze.x;
    let gazeY = center.screenGaze.y;

    // Horizontal Mapping:
    // Determine whether user moves toward the calibrated Right position
    const rightIsLowerU = right.pupilCamera.x < uCenter;
    if ((rightIsLowerU && du < 0) || (!rightIsLowerU && du > 0)) {
      const t = Math.min(1.2, Math.max(0, Math.abs(du) / spanRight));
      gazeX = center.screenGaze.x + t * (right.screenGaze.x - center.screenGaze.x);
    } else {
      const t = Math.min(1.2, Math.max(0, Math.abs(du) / spanLeft));
      gazeX = center.screenGaze.x + t * (left.screenGaze.x - center.screenGaze.x);
    }

    // Vertical Mapping:
    const upIsLowerV = up.pupilCamera.y < vCenter;
    if ((upIsLowerV && dv < 0) || (!upIsLowerV && dv > 0)) {
      const t = Math.min(1.2, Math.max(0, Math.abs(dv) / spanUp));
      gazeY = center.screenGaze.y + t * (up.screenGaze.y - center.screenGaze.y);
    } else {
      const t = Math.min(1.2, Math.max(0, Math.abs(dv) / spanDown));
      gazeY = center.screenGaze.y + t * (down.screenGaze.y - center.screenGaze.y);
    }

    return {
      x: Math.max(-1.0, Math.min(1.0, isNaN(gazeX) ? 0 : gazeX)),
      y: Math.max(-1.0, Math.min(1.0, isNaN(gazeY) ? 0 : gazeY)),
    };
  }
}

export const gazeCalibration = new GazeCalibrationManager();
