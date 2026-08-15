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

// Stable permanent localStorage key for persistent browser caching
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
    screenGaze: { x: 0.30, y: 0.0 },
    pupilCamera: { x: 0.25, y: 0.40 },
  },
  left: {
    screenGaze: { x: -0.30, y: 0.0 },
    pupilCamera: { x: 0.75, y: 0.40 },
  },
  up: {
    screenGaze: { x: 0.0, y: -0.22 },
    pupilCamera: { x: 0.50, y: 0.22 },
  },
  down: {
    screenGaze: { x: 0.0, y: 0.18 },
    pupilCamera: { x: 0.50, y: 0.58 },
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
   * Continuous Smooth Gaze Interpolation
   * Enforces minimum span of 0.28 to prevent sudden jumps to the window
   */
  mapCameraToScreenGaze(rawPupil: Point2D): Point2D {
    const u = rawPupil.x;
    const v = rawPupil.y;
    const { center, right, left, up, down } = this.profile;

    const uCenter = center.pupilCamera.x || 0.50;
    const vCenter = center.pupilCamera.y || 0.40;

    const du = u - uCenter;
    const dv = v - vCenter;

    // Minimum physical room span of 0.28 (ensures slight head movement = gentle, subtle turn)
    const spanRight = Math.max(0.28, Math.abs(right.pupilCamera.x - uCenter));
    const spanLeft = Math.max(0.28, Math.abs(left.pupilCamera.x - uCenter));
    const spanUp = Math.max(0.22, Math.abs(vCenter - up.pupilCamera.y));
    const spanDown = Math.max(0.22, Math.abs(down.pupilCamera.y - vCenter));

    let gazeX = center.screenGaze.x;
    let gazeY = center.screenGaze.y;

    // Continuous Horizontal Mapping:
    const rightIsLowerU = right.pupilCamera.x < uCenter;
    if ((rightIsLowerU && du < 0) || (!rightIsLowerU && du > 0)) {
      const t = Math.min(1.0, Math.abs(du) / spanRight);
      gazeX = center.screenGaze.x + t * (right.screenGaze.x - center.screenGaze.x);
    } else {
      const t = Math.min(1.0, Math.abs(du) / spanLeft);
      gazeX = center.screenGaze.x + t * (left.screenGaze.x - center.screenGaze.x);
    }

    // Continuous Vertical Mapping:
    const upIsLowerV = up.pupilCamera.y < vCenter;
    if ((upIsLowerV && dv < 0) || (!upIsLowerV && dv > 0)) {
      const t = Math.min(1.0, Math.abs(dv) / spanUp);
      gazeY = center.screenGaze.y + t * (up.screenGaze.y - center.screenGaze.y);
    } else {
      const t = Math.min(1.0, Math.abs(dv) / spanDown);
      gazeY = center.screenGaze.y + t * (down.screenGaze.y - center.screenGaze.y);
    }

    return {
      x: Math.max(-1.0, Math.min(1.0, gazeX)),
      y: Math.max(-1.0, Math.min(1.0, gazeY)),
    };
  }
}

export const gazeCalibration = new GazeCalibrationManager();
