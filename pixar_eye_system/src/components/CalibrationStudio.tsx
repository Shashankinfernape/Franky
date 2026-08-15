import React, { useState, useEffect, useCallback } from 'react';
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
    title: 'Mona Lisa Eye Contact Calibration',
    description:
      'Franky will cast his gaze to 5 key directions. Stand directly in his line of sight so he looks dead into your eyes, then give a Thumbs Up 👍 to lock the trajectory!',
    screenGaze: { x: 0, y: 0 },
    icon: <Sparkles className="w-6 h-6 text-amber-400" />,
    voicePrompt: "Let's calibrate my eyes! Stand where I look and give me a thumbs up!",
  },
  center: {
    title: 'Step 1: Center Eye Level',
    description:
      'Stand or sit directly in front of the screen. Align until Franky is looking straight into your eyes, then hit Thumbs Up 👍.',
    screenGaze: { x: 0.0, y: 0.0 },
    icon: <Target className="w-6 h-6 text-cyan-400 animate-pulse" />,
    voicePrompt: "Look straight into my eyes from the center, then give me a thumbs up!",
  },
  right: {
    title: 'Step 2: Right Side Trajectory',
    description:
      'Step to the RIGHT side of the room where Franky is looking. When he is looking directly into your eyes, hit Thumbs Up 👍.',
    screenGaze: { x: 0.70, y: 0.0 },
    icon: <ArrowRight className="w-6 h-6 text-emerald-400" />,
    voicePrompt: "Now step to where I'm looking on the right, and give me a thumbs up!",
  },
  left: {
    title: 'Step 3: Left Side Trajectory',
    description:
      'Step to the LEFT side of the room where Franky is looking. When he is looking directly into your eyes, hit Thumbs Up 👍.',
    screenGaze: { x: -0.70, y: 0.0 },
    icon: <ArrowLeft className="w-6 h-6 text-indigo-400" />,
    voicePrompt: "Great! Now step to where I'm looking on the left, and give me a thumbs up!",
  },
  up: {
    title: 'Step 4: High Angle / Standing Tall',
    description:
      'Stand up or look down at the screen from above. Align with Franky looking up at you, then hit Thumbs Up 👍.',
    screenGaze: { x: 0.0, y: -0.55 },
    icon: <ArrowUp className="w-6 h-6 text-purple-400" />,
    voicePrompt: "Stand tall or look at me from above, then give me a thumbs up!",
  },
  down: {
    title: 'Step 5: Low Angle / Crouching',
    description:
      'Crouch or position lower than the screen. Align with Franky looking down at you, then hit Thumbs Up 👍.',
    screenGaze: { x: 0.0, y: 0.45 },
    icon: <ArrowDown className="w-6 h-6 text-pink-400" />,
    voicePrompt: "Almost done! Lower down to where I'm looking, and give me a thumbs up!",
  },
  complete: {
    title: 'Calibration Locked & Saved!',
    description:
      'Ground-truth trajectory profile generated and saved. Franky will now maintain flawless Mona Lisa eye contact from any room angle!',
    screenGaze: { x: 0, y: 0 },
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
    voicePrompt: "Ka-chow! Direct eye contact calibrated and locked!",
  },
};

export const CalibrationStudio: React.FC<CalibrationStudioProps> = ({
  isOpen,
  onClose,
  currentPupilCamera,
  onSetCalibrationGaze,
  onSpeak,
}) => {
  const [step, setStep] = useState<CalibrationStep>('intro');
  const [recordedPoints, setRecordedPoints] = useState<Partial<CalibrationProfile>>({});
  const [isLockedAnimation, setIsLockedAnimation] = useState(false);

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
      alert('No eyes detected by camera! Make sure your face is visible in good lighting.');
      return;
    }

    const config = STEP_CONFIGS[step];
    const point: CalibrationPoint = {
      screenGaze: { ...config.screenGaze },
      pupilCamera: { ...currentPupilCamera },
    };

    setIsLockedAnimation(true);
    setTimeout(() => setIsLockedAnimation(false), 400);

    setRecordedPoints((prev) => {
      const updated = { ...prev, [step]: point };

      // Transition to next step
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in select-none">
      <div className="relative w-full max-w-lg bg-slate-900/95 border border-white/20 rounded-3xl p-6 shadow-2xl text-white font-sans space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm font-bold tracking-wider uppercase text-cyan-300">
              Gaze Ground-Truth Studio
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
        <div className="text-center space-y-3 py-2">
          <div className="inline-flex p-3.5 bg-white/5 border border-white/10 rounded-2xl shadow-inner">
            {currentConfig.icon}
          </div>

          <h3 className="text-lg font-bold text-slate-100">{currentConfig.title}</h3>
          <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
            {currentConfig.description}
          </p>

          {/* Pupil Camera Status Feedback */}
          {step !== 'intro' && step !== 'complete' && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/40 border border-white/10 rounded-full text-[11px] font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  currentPupilCamera ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                }`}
              />
              <span className={currentPupilCamera ? 'text-emerald-300' : 'text-rose-400'}>
                {currentPupilCamera
                  ? `Eyes Detected (X:${currentPupilCamera.x.toFixed(2)}, Y:${currentPupilCamera.y.toFixed(2)})`
                  : 'Searching for eyes...'}
              </span>
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
              <span>Begin Calibration</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : step === 'complete' ? (
            <button
              onClick={onClose}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Done! Enjoy Flawless Eye Contact</span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleCapturePoint}
                className={`flex-1 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2.5 cursor-pointer text-sm border border-cyan-400/30 ${
                  isLockedAnimation ? 'scale-105 ring-4 ring-cyan-400' : ''
                }`}
              >
                <ThumbsUp className="w-5 h-5 text-yellow-300" />
                <span>👍 Thumbs Up! Lock This Position</span>
              </button>

              <button
                onClick={() => {
                  setStep('center');
                  setRecordedPoints({});
                }}
                title="Restart Calibration"
                className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="text-center text-[10px] text-slate-500">
            Tip: Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-300">Space</kbd> or{' '}
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-300">Enter</kbd> to confirm instantly!
          </div>
        </div>
      </div>
    </div>
  );
};
