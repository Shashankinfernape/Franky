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

const STORAGE_KEY = 'franky_eye_calibration_v7';

const DEFAULT_PROFILE: CalibrationProfile = {
  id: 'default',
  timestamp: Date.now(),
  center: {
    screenGaze: { x: 0.0, y: 0.0 },
    pupilCamera: { x: 0.50, y: 0.40 },
  },
  right: {
    screenGaze: { x: 0.35, y: 0.0 },
    pupilCamera: { x: 0.70, y: 0.40 },
  },
  left: {
    screenGaze: { x: -0.35, y: 0.0 },
    pupilCamera: { x: 0.30, y: 0.40 },
  },
  up: {
    screenGaze: { x: 0.0, y: -0.25 },
    pupilCamera: { x: 0.50, y: 0.25 },
  },
  down: {
    screenGaze: { x: 0.0, y: 0.25 },
    pupilCamera: { x: 0.50, y: 0.55 },
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
   * Direct, Correct Spatial Mapping
   * When face is on Camera Left (u < 0.5), Gaze points Screen Left (gazeX < 0)
   * When face is on Camera Right (u > 0.5), Gaze points Screen Right (gazeX > 0)
   */
  mapCameraToScreenGaze(rawPupil: Point2D): Point2D {
    const u = rawPupil.x;
    const v = rawPupil.y;

    const uCenter = this.profile.center.pupilCamera.x || 0.50;
    const vCenter = this.profile.center.pupilCamera.y || 0.40;

    // Linear Proportional Gain (1.8x)
    const rawGazeX = (u - uCenter) * 1.8;
    const rawGazeY = (v - vCenter) * 1.8;

    return {
      x: Math.max(-1.0, Math.min(1.0, rawGazeX)),
      y: Math.max(-1.0, Math.min(1.0, rawGazeY)),
    };
  }
}

export const gazeCalibration = new GazeCalibrationManager();
