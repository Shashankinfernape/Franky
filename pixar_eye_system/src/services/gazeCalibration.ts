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

const STORAGE_KEY = 'franky_eye_calibration_v5';

// Default fallback calibration (gentle natural FOV)
const DEFAULT_PROFILE: CalibrationProfile = {
  id: 'default',
  timestamp: Date.now(),
  center: {
    screenGaze: { x: 0.0, y: 0.0 },
    pupilCamera: { x: 0.50, y: 0.44 },
  },
  right: {
    screenGaze: { x: 0.22, y: 0.0 },
    pupilCamera: { x: 0.32, y: 0.44 },
  },
  left: {
    screenGaze: { x: -0.22, y: 0.0 },
    pupilCamera: { x: 0.68, y: 0.44 },
  },
  up: {
    screenGaze: { x: 0.0, y: -0.18 },
    pupilCamera: { x: 0.50, y: 0.32 },
  },
  down: {
    screenGaze: { x: 0.0, y: 0.15 },
    pupilCamera: { x: 0.50, y: 0.56 },
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
   * Smooth Nonlinear S-Curve Transform with Deadband
   * Prevents micro-tremors and eliminates sudden full-screen jumps
   */
  mapCameraToScreenGaze(rawPupil: Point2D): Point2D {
    const { center, right, left, up, down } = this.profile;

    const u = rawPupil.x;
    const v = rawPupil.y;

    const uCenter = center.pupilCamera.x;
    const vCenter = center.pupilCamera.y;

    let gazeX = 0;
    let gazeY = 0;

    // Horizontal Mapping with deadband (0.012)
    const du = u - uCenter;
    if (Math.abs(du) > 0.012) {
      if (du < 0) {
        // User on Screen Right
        const span = Math.abs(right.pupilCamera.x - uCenter) || 0.18;
        const linearT = Math.min(1.0, Math.max(0, -du / span));
        const smoothT = Math.pow(linearT, 1.25);
        gazeX = smoothT * right.screenGaze.x;
      } else {
        // User on Screen Left
        const span = Math.abs(left.pupilCamera.x - uCenter) || 0.18;
        const linearT = Math.min(1.0, Math.max(0, du / span));
        const smoothT = Math.pow(linearT, 1.25);
        gazeX = smoothT * left.screenGaze.x;
      }
    }

    // Vertical Mapping with deadband (0.012)
    const dv = v - vCenter;
    if (Math.abs(dv) > 0.012) {
      if (dv < 0) {
        // User looking UP
        const span = Math.abs(vCenter - up.pupilCamera.y) || 0.14;
        const linearT = Math.min(1.0, Math.max(0, -dv / span));
        const smoothT = Math.pow(linearT, 1.25);
        gazeY = smoothT * up.screenGaze.y;
      } else {
        // User looking DOWN
        const span = Math.abs(down.pupilCamera.y - vCenter) || 0.14;
        const linearT = Math.min(1.0, Math.max(0, dv / span));
        const smoothT = Math.pow(linearT, 1.25);
        gazeY = smoothT * down.screenGaze.y;
      }
    }

    return {
      x: Math.max(-1.0, Math.min(1.0, gazeX)),
      y: Math.max(-1.0, Math.min(1.0, gazeY)),
    };
  }
}

export const gazeCalibration = new GazeCalibrationManager();
