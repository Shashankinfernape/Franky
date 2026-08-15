import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Point2D } from '../types/vision';
import {
  gazeCalibration,
  type CalibrationProfile,
  type CalibrationPoint,
} from '../services/gazeCalibration';
import {
  ThumbsUp,
  RotateCcw,
  CheckCircle2,
  X,
  Target,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from 'lucide-react';

export type CalibrationStep =
  | 'intro'
  | 'center'
  | 'right'
  | 'left'
  | 'up'
  | 'down'
  | 'complete';

interface CalibrationStudioProps {
  isOpen: boolean;
  onClose: () => void;
  currentPupilCamera: Point2D | null; // Live pupil position in camera frame [0, 1]
  isThumbUp: boolean; // Live Hands-free thumbs up gesture detection
  onSetCalibrationGaze: (gaze: Point2D | null) => void; // Forces Franky to look at calibration reference point
  onSpeak?: (text: string) => void;
}

const STEP_CONFIGS: Record<
  CalibrationStep,
  {
    title: string;
    description: string;
    screenGaze: Point2D;
    icon: React.ReactNode;
    voicePrompt: string;
  }
> = {
  intro: {
    title: 'Centric Eye Contact Calibration',
    description:
      'McQueen will look in 5 directions. Stand where his eyes point and show a 👍 Thumbs Up to the camera to lock!',
    screenGaze: { x: 0, y: 0 },
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    voicePrompt: "Let's calibrate! Stand where I look and show me a thumbs up!",
  },
  center: {
    title: '1/5: Center Eye Contact',
    description:
      'Stand directly in front of the screen. Look into McQueen’s eyes and show 👍 Thumbs Up.',
    screenGaze: { x: 0.0, y: 0.0 },
    icon: <Target className="w-4 h-4 text-cyan-400 animate-pulse" />,
    voicePrompt: "Look straight into my eyes from the center, then show me a thumbs up!",
  },
  right: {
    title: '2/5: Right Room Angle',
    description:
      'Step slightly to the RIGHT where McQueen is looking. When he locks eyes, show 👍 Thumbs Up.',
    screenGaze: { x: 0.28, y: 0.0 },
    icon: <ArrowRight className="w-4 h-4 text-emerald-400" />,
    voicePrompt: "Now step slightly to where I'm looking on the right, and give me a thumbs up!",
  },
  left: {
    title: '3/5: Left Room Angle',
    description:
      'Step slightly to the LEFT where McQueen is looking. When he locks eyes, show 👍 Thumbs Up.',
    screenGaze: { x: -0.28, y: 0.0 },
    icon: <ArrowLeft className="w-4 h-4 text-indigo-400" />,
    voicePrompt: "Now step slightly to where I'm looking on the left, and give me a thumbs up!",
  },
  up: {
    title: '4/5: High Angle / Standing',
    description:
      'Stand tall or look down from above. When McQueen looks up at you, show 👍 Thumbs Up.',
    screenGaze: { x: 0.0, y: -0.22 },
    icon: <ArrowUp className="w-4 h-4 text-purple-400" />,
    voicePrompt: "Stand tall or look at me from above, then give me a thumbs up!",
  },
  down: {
    title: '5/5: Low Angle / Crouching',
    description:
      'Lower down or crouch slightly. When McQueen looks down at you, show 👍 Thumbs Up.',
    screenGaze: { x: 0.0, y: 0.18 },
    icon: <ArrowDown className="w-4 h-4 text-pink-400" />,
    voicePrompt: "Almost there! Lower down slightly to where I'm looking, and give me a thumbs up!",
  },
  complete: {
    title: 'Calibration Complete!',
    description:
      'Centric Mona Lisa trajectory locked. McQueen will now follow and look directly into your eyes!',
    screenGaze: { x: 0, y: 0 },
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    voicePrompt: "Ka-chow! Direct eye contact calibrated and locked!",
  },
};

export const CalibrationStudio: React.FC<CalibrationStudioProps> = ({
  isOpen,
  onClose,
  currentPupilCamera,
  isThumbUp,
  onSetCalibrationGaze,
  onSpeak,
}) => {
  const [step, setStep] = useState<CalibrationStep>('intro');
  const [recordedPoints, setRecordedPoints] = useState<Partial<CalibrationProfile>>({});
  const [isLockedAnimation, setIsLockedAnimation] = useState(false);
  const [thumbHoldProgress, setThumbHoldProgress] = useState(0);

  const thumbHoldStartTimeRef = useRef<number | null>(null);

  // Force McQueen to look at the step's reference gaze point
  useEffect(() => {
    if (!isOpen) {
      onSetCalibrationGaze(null);
      return;
    }

    const currentConfig = STEP_CONFIGS[step];
    if (step !== 'intro' && step !== 'complete') {
      onSetCalibrationGaze(currentConfig.screenGaze);
    } else {
      onSetCalibrationGaze(null);
    }
  }, [isOpen, step, onSetCalibrationGaze]);

  // Voice guidance prompt per step
  useEffect(() => {
    if (isOpen && onSpeak) {
      onSpeak(STEP_CONFIGS[step].voicePrompt);
    }
  }, [isOpen, step, onSpeak]);

  const handleCapturePoint = useCallback(() => {
    if (!currentPupilCamera) {
      return;
    }

    const config = STEP_CONFIGS[step];
    const point: CalibrationPoint = {
      screenGaze: { ...config.screenGaze },
      pupilCamera: { ...currentPupilCamera },
    };

    setIsLockedAnimation(true);
    setTimeout(() => setIsLockedAnimation(false), 350);

    setRecordedPoints((prev) => {
      const updated = { ...prev, [step]: point };

      // Transition automatically to next direction
      if (step === 'center') setStep('right');
      else if (step === 'right') setStep('left');
      else if (step === 'left') setStep('up');
      else if (step === 'up') setStep('down');
      else if (step === 'down') {
        // Complete & Save Profile
        const finalProfile: CalibrationProfile = {
          id: 'custom_' + Date.now(),
          timestamp: Date.now(),
          center: updated.center || point,
          right: updated.right || point,
          left: updated.left || point,
          up: updated.up || point,
          down: point,
        };
        gazeCalibration.saveProfile(finalProfile);
        setStep('complete');
      }

      return updated;
    });
  }, [step, currentPupilCamera]);

  // Live Hands-Free Thumbs-Up Detection & Auto-Advance Loop
  useEffect(() => {
    if (!isOpen || step === 'intro' || step === 'complete') {
      setThumbHoldProgress(0);
      thumbHoldStartTimeRef.current = null;
      return;
    }

    let intervalId: ReturnType<typeof setInterval>;

    if (isThumbUp && currentPupilCamera) {
      if (!thumbHoldStartTimeRef.current) {
        thumbHoldStartTimeRef.current = Date.now();
      }

      intervalId = setInterval(() => {
        const elapsed = Date.now() - (thumbHoldStartTimeRef.current || Date.now());
        const holdTarget = 400; // Hold for 400ms to confirm
        const progress = Math.min(100, Math.round((elapsed / holdTarget) * 100));
        setThumbHoldProgress(progress);

        if (progress >= 100) {
          clearInterval(intervalId);
          thumbHoldStartTimeRef.current = null;
          setThumbHoldProgress(0);
          handleCapturePoint();
        }
      }, 30);
    } else {
      thumbHoldStartTimeRef.current = null;
      setThumbHoldProgress(0);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen, step, isThumbUp, currentPupilCamera, handleCapturePoint]);

  // Keyboard shortcut (Space / Enter for thumbs up)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (step === 'intro') setStep('center');
        else if (step === 'complete') onClose();
        else handleCapturePoint();
      } else if (e.code === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, handleCapturePoint, onClose]);

  if (!isOpen) return null;

  const currentConfig = STEP_CONFIGS[step];

  return (
    /* Completely unobscured floating Top Island HUD (Eyes in center remain 100% visible) */
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-md pointer-events-auto select-none font-sans animate-in fade-in slide-in-from-top-2">
      <div className="bg-slate-950/90 border border-white/25 rounded-2xl p-3 shadow-2xl backdrop-blur-xl text-white space-y-2.5">
        {/* Top Header & Progress */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              {currentConfig.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Step Indicator Progress Dots */}
            <div className="flex items-center gap-1">
              {(['center', 'right', 'left', 'up', 'down'] as const).map((s) => {
                const isDone = Boolean(recordedPoints[s]);
                const isCurrent = step === s;
                return (
                  <div
                    key={s}
                    className={`w-2 h-2 rounded-full transition-all ${
                      isDone
                        ? 'bg-emerald-400'
                        : isCurrent
                        ? 'bg-cyan-400 scale-125 animate-pulse'
                        : 'bg-slate-700'
                    }`}
                  />
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="p-1 hover:bg-white/15 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prompt & Guidance */}
        <p className="text-[11px] text-slate-200 leading-snug">
          {currentConfig.description}
        </p>

        {/* Live Gesture Detection Status */}
        {step !== 'intro' && step !== 'complete' && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  isThumbUp ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                }`}
              />
              <span className={isThumbUp ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                {isThumbUp ? '👍 Thumbs Up! Locking...' : 'Show 👍 to camera'}
              </span>
            </div>

            {thumbHoldProgress > 0 && (
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-75"
                  style={{ width: `${thumbHoldProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          {step === 'intro' ? (
            <button
              onClick={() => setStep('center')}
              className="w-full py-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
            >
              <span>Begin Sequence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : step === 'complete' ? (
            <button
              onClick={onClose}
              className="w-full py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Done!</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleCapturePoint}
                className={`flex-1 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer text-[11px] border border-cyan-400/30 ${
                  isLockedAnimation ? 'ring-2 ring-cyan-400' : ''
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5 text-yellow-300" />
                <span>Tap or Show 👍</span>
              </button>

              <button
                onClick={() => {
                  setStep('center');
                  setRecordedPoints({});
                }}
                title="Restart"
                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
