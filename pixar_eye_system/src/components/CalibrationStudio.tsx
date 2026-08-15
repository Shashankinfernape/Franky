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
  Hand,
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
    title: 'Centric Mona Lisa Eye Calibration',
    description:
      'McQueen will look into each room direction. Stand where his eyes are pointing and show a Thumbs Up 👍 to the camera to automatically lock and advance!',
    screenGaze: { x: 0, y: 0 },
    icon: <Sparkles className="w-6 h-6 text-amber-400" />,
    voicePrompt: "Let's calibrate! Stand where I look and show me a thumbs up!",
  },
  center: {
    title: '1 / 5: Center Eye Level',
    description:
      'Stand directly in front of the screen. Look into McQueen’s eyes and show a 👍 Thumbs Up.',
    screenGaze: { x: 0.0, y: 0.0 },
    icon: <Target className="w-6 h-6 text-cyan-400 animate-pulse" />,
    voicePrompt: "Look straight into my eyes from the center, then show me a thumbs up!",
  },
  right: {
    title: '2 / 5: Right Room Angle',
    description:
      'Step to the RIGHT where McQueen is looking. When he locks into your eyes, show a 👍 Thumbs Up.',
    screenGaze: { x: 0.55, y: 0.0 },
    icon: <ArrowRight className="w-6 h-6 text-emerald-400" />,
    voicePrompt: "Now step to where I'm looking on the right, and give me a thumbs up!",
  },
  left: {
    title: '3 / 5: Left Room Angle',
    description:
      'Step to the LEFT where McQueen is looking. When he locks into your eyes, show a 👍 Thumbs Up.',
    screenGaze: { x: -0.55, y: 0.0 },
    icon: <ArrowLeft className="w-6 h-6 text-indigo-400" />,
    voicePrompt: "Now step to where I'm looking on the left, and give me a thumbs up!",
  },
  up: {
    title: '4 / 5: High Angle / Standing',
    description:
      'Stand tall or look down from above. When McQueen looks up at you, show a 👍 Thumbs Up.',
    screenGaze: { x: 0.0, y: -0.42 },
    icon: <ArrowUp className="w-6 h-6 text-purple-400" />,
    voicePrompt: "Stand tall or look at me from above, then give me a thumbs up!",
  },
  down: {
    title: '5 / 5: Low Angle / Sitting Lower',
    description:
      'Lower down or crouch. When McQueen looks down at you, show a 👍 Thumbs Up.',
    screenGaze: { x: 0.0, y: 0.35 },
    icon: <ArrowDown className="w-6 h-6 text-pink-400" />,
    voicePrompt: "Almost there! Lower down to where I'm looking, and give me a thumbs up!",
  },
  complete: {
    title: 'Calibration Locked & Saved!',
    description:
      'Centric Mona Lisa trajectory locked. McQueen will now follow and look directly into your eyes from any room angle!',
    screenGaze: { x: 0, y: 0 },
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
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

  // Force Franky to look at the step's reference gaze point
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in select-none">
      <div className="relative w-full max-w-md bg-slate-900/95 border border-white/20 rounded-3xl p-6 shadow-2xl text-white font-sans space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-xs font-bold tracking-wider uppercase text-cyan-300">
              Automatic Eye Contact Trainer
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Progress Pills */}
        <div className="flex items-center justify-between gap-1.5 px-1">
          {(['center', 'right', 'left', 'up', 'down'] as const).map((s, idx) => {
            const isDone = Boolean(recordedPoints[s]);
            const isCurrent = step === s;
            return (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                  isDone
                    ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : isCurrent
                    ? 'bg-cyan-400 animate-pulse'
                    : 'bg-slate-800'
                }`}
                title={`Step ${idx + 1}: ${s}`}
              />
            );
          })}
        </div>

        {/* Content Body */}
        <div className="text-center space-y-3 py-1">
          <div className="inline-flex p-3 bg-white/5 border border-white/10 rounded-2xl shadow-inner">
            {currentConfig.icon}
          </div>

          <h3 className="text-base font-bold text-slate-100">{currentConfig.title}</h3>
          <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
            {currentConfig.description}
          </p>

          {/* Hands-Free Thumbs Up Live Indicator */}
          {step !== 'intro' && step !== 'complete' && (
            <div className="flex flex-col items-center gap-2 pt-1">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-all ${
                  isThumbUp
                    ? 'bg-emerald-950/80 border-emerald-400/80 text-emerald-300 shadow-lg shadow-emerald-500/20 scale-105'
                    : 'bg-black/40 border-white/10 text-slate-400'
                }`}
              >
                <Hand className={`w-3.5 h-3.5 ${isThumbUp ? 'text-emerald-400 animate-bounce' : ''}`} />
                <span>{isThumbUp ? '👍 Thumbs Up Detected! Locking...' : 'Show 👍 Thumbs Up to Lock'}</span>
              </div>

              {/* Hold Progress Bar */}
              {thumbHoldProgress > 0 && (
                <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-75"
                    style={{ width: `${thumbHoldProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-white/10 flex flex-col gap-2.5">
          {step === 'intro' ? (
            <button
              onClick={() => setStep('center')}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <span>Start 5-Point Sequence</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : step === 'complete' ? (
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Done! Enjoy Centric Eye Contact</span>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCapturePoint}
                className={`flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-xs border border-cyan-400/30 ${
                  isLockedAnimation ? 'scale-105 ring-4 ring-cyan-400' : ''
                }`}
              >
                <ThumbsUp className="w-4 h-4 text-yellow-300" />
                <span>Tap to Lock & Next</span>
              </button>

              <button
                onClick={() => {
                  setStep('center');
                  setRecordedPoints({});
                }}
                title="Restart Sequence"
                className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="text-center text-[10px] text-slate-500">
            Hands-Free: Show <span className="text-emerald-300 font-bold">👍</span> to camera, or press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-300">Space</kbd>
          </div>
        </div>
      </div>
    </div>
  );
};
