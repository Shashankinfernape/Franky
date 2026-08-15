import type { Point2D } from '../types/vision';

export interface CalibrationPoint {
  screenGaze: Point2D; // The exact gaze coordinate manually positioned by the user
  pupilCamera: Point2D; // The camera pupil coordinate measured at lock time
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

const STORAGE_KEY = 'franky_eye_calibration_v9';

// Default initial calibration profile
const DEFAULT_PROFILE: CalibrationProfile = {
  id: 'default',
  timestamp: Date.now(),
  center: {
    screenGaze: { x: 0.0, y: 0.0 },
    pupilCamera: { x: 0.50, y: 0.40 },
  },
  right: {
    screenGaze: { x: 0.45, y: 0.0 },
    pupilCamera: { x: 0.30, y: 0.40 },
  },
  left: {
    screenGaze: { x: -0.45, y: 0.0 },
    pupilCamera: { x: 0.70, y: 0.40 },
  },
  up: {
    screenGaze: { x: 0.0, y: -0.30 },
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
      console.log('[Calibration] Saved custom drag-locked profile:', profile);
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
   * Ground-Truth Direct Interpolation Mapping
   * Uses the EXACT screen gaze coordinates that the user dragged and confirmed for each camera position
   */
  mapCameraToScreenGaze(rawPupil: Point2D): Point2D {
    const u = rawPupil.x;
    const v = rawPupil.y;
    const { center, right, left, up, down } = this.profile;

    const uCenter = center.pupilCamera.x;
    const vCenter = center.pupilCamera.y;

    let gazeX = center.screenGaze.x;
    let gazeY = center.screenGaze.y;

    // 1. Horizontal Direction & Interpolation:
    // Determine which side of camera center corresponds to the RIGHT calibration point:
    const isRightSide = (right.pupilCamera.x < uCenter && u <= uCenter) || (right.pupilCamera.x > uCenter && u >= uCenter);
    
    if (isRightSide) {
      const span = Math.abs(right.pupilCamera.x - uCenter) || 0.15;
      const t = Math.min(1.0, Math.max(0, Math.abs(u - uCenter) / span));
      gazeX = center.screenGaze.x + t * (right.screenGaze.x - center.screenGaze.x);
    } else {
      const span = Math.abs(left.pupilCamera.x - uCenter) || 0.15;
      const t = Math.min(1.0, Math.max(0, Math.abs(u - uCenter) / span));
      gazeX = center.screenGaze.x + t * (left.screenGaze.x - center.screenGaze.x);
    }

    // 2. Vertical Direction & Interpolation:
    const isUpSide = (up.pupilCamera.y < vCenter && v <= vCenter) || (up.pupilCamera.y > vCenter && v >= vCenter);

    if (isUpSide) {
      const span = Math.abs(vCenter - up.pupilCamera.y) || 0.12;
      const t = Math.min(1.0, Math.max(0, Math.abs(v - vCenter) / span));
      gazeY = center.screenGaze.y + t * (up.screenGaze.y - center.screenGaze.y);
    } else {
      const span = Math.abs(down.pupilCamera.y - vCenter) || 0.12;
      const t = Math.min(1.0, Math.max(0, Math.abs(v - vCenter) / span));
      gazeY = center.screenGaze.y + t * (down.screenGaze.y - center.screenGaze.y);
    }

    return {
      x: Math.max(-1.0, Math.min(1.0, gazeX)),
      y: Math.max(-1.0, Math.min(1.0, gazeY)),
    };
  }
}

export const gazeCalibration = new GazeCalibrationManager();
