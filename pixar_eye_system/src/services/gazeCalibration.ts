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

const STORAGE_KEY = 'franky_eye_calibration_v6';

// Default fallback calibration
const DEFAULT_PROFILE: CalibrationProfile = {
  id: 'default',
  timestamp: Date.now(),
  center: {
    screenGaze: { x: 0.0, y: 0.0 },
    pupilCamera: { x: 0.50, y: 0.44 },
  },
  right: {
    screenGaze: { x: 0.50, y: 0.0 },
    pupilCamera: { x: 0.32, y: 0.44 },
  },
  left: {
    screenGaze: { x: -0.50, y: 0.0 },
    pupilCamera: { x: 0.68, y: 0.44 },
  },
  up: {
    screenGaze: { x: 0.0, y: -0.40 },
    pupilCamera: { x: 0.50, y: 0.30 },
  },
  down: {
    screenGaze: { x: 0.0, y: 0.35 },
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
   * Direct Linear & Responsive Mapping
   * Maps measured camera pupil coordinates (u, v) [0, 1] directly to screen gaze [-1, 1]
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
    // When u < uCenter (camera left -> user is on Screen Right)
    // When u > uCenter (camera right -> user is on Screen Left)
    const du = u - uCenter;
    if (Math.abs(du) > 0.008) {
      if (du < 0) {
        const span = Math.abs(right.pupilCamera.x - uCenter) || 0.18;
        const t = Math.min(1.0, -du / span);
        gazeX = t * right.screenGaze.x;
      } else {
        const span = Math.abs(left.pupilCamera.x - uCenter) || 0.18;
        const t = Math.min(1.0, du / span);
        gazeX = t * left.screenGaze.x;
      }
    }

    // Vertical Mapping:
    const dv = v - vCenter;
    if (Math.abs(dv) > 0.008) {
      if (dv < 0) {
        const span = Math.abs(vCenter - up.pupilCamera.y) || 0.14;
        const t = Math.min(1.0, -dv / span);
        gazeY = t * up.screenGaze.y;
      } else {
        const span = Math.abs(down.pupilCamera.y - vCenter) || 0.14;
        const t = Math.min(1.0, dv / span);
        gazeY = t * down.screenGaze.y;
      }
    }

    return {
      x: Math.max(-1.0, Math.min(1.0, gazeX)),
      y: Math.max(-1.0, Math.min(1.0, gazeY)),
    };
  }
}

export const gazeCalibration = new GazeCalibrationManager();
