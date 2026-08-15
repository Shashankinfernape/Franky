import React, { useState, useEffect, useCallback } from 'react';
import type { Point2D } from '../types/vision';
import {
  gazeCalibration,
  type CalibrationProfile,
  type CalibrationPoint,
} from '../services/gazeCalibration';
import {
  Lock,
  RotateCcw,
  CheckCircle2,
  X,
  Target,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Move,
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
  currentPupilCamera: Point2D | null;
  calibrationGaze: Point2D | null;
  onSetCalibrationGaze: (gaze: Point2D | null) => void;
  onSpeak?: (text: string) => void;
}

const STEP_CONFIGS: Record<
  CalibrationStep,
  {
    title: string;
    instruction: string;
    defaultGaze: Point2D;
    icon: React.ReactNode;
    voicePrompt: string;
  }
> = {
  intro: {
    title: 'Swipe & Lock Calibration',
    instruction:
      'Swipe anywhere on the screen with your finger to aim McQueen’s pupils directly at your eyes, then tap Lock!',
    defaultGaze: { x: 0, y: 0 },
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    voicePrompt: "Swipe anywhere on screen to point my eyes at you, and tap lock!",
  },
  center: {
    title: '1/5: Center Position',
    instruction:
      'Sit in the CENTER. Swipe on screen until McQueen looks dead into your eyes ➔ Tap Lock.',
    defaultGaze: { x: 0.0, y: 0.0 },
    icon: <Target className="w-4 h-4 text-cyan-400 animate-pulse" />,
    voicePrompt: "Swipe on screen so I'm looking straight at you, then tap Lock!",
  },
  right: {
    title: '2/5: Stand on RIGHT',
    instruction:
      'Step to the RIGHT of camera. Swipe screen until McQueen looks directly at you ➔ Tap Lock.',
    defaultGaze: { x: 0.50, y: 0.0 },
    icon: <ArrowRight className="w-4 h-4 text-emerald-400" />,
    voicePrompt: "Step to your right, swipe my eyes to look at you, and tap Lock!",
  },
  left: {
    title: '3/5: Stand on LEFT',
    instruction:
      'Step to the LEFT of camera. Swipe screen until McQueen looks directly at you ➔ Tap Lock.',
    defaultGaze: { x: -0.50, y: 0.0 },
    icon: <ArrowLeft className="w-4 h-4 text-indigo-400" />,
    voicePrompt: "Step to your left, swipe my eyes to look at you, and tap Lock!",
  },
  up: {
    title: '4/5: Look from ABOVE',
    instruction:
      'Stand tall or look down from above. Swipe eyes up to meet your gaze ➔ Tap Lock.',
    defaultGaze: { x: 0.0, y: -0.35 },
    icon: <ArrowUp className="w-4 h-4 text-purple-400" />,
    voicePrompt: "Stand tall, swipe my eyes up to meet you, and tap Lock!",
  },
  down: {
    title: '5/5: Look from BELOW',
    instruction:
      'Sit lower or crouch. Swipe eyes down to meet your gaze ➔ Tap Lock.',
    defaultGaze: { x: 0.0, y: 0.30 },
    icon: <ArrowDown className="w-4 h-4 text-pink-400" />,
    voicePrompt: "Sit lower, swipe my eyes down to meet you, and tap Lock!",
  },
  complete: {
    title: 'Calibration Locked & Active!',
    instruction:
      'Custom trajectory profile saved to browser! McQueen is now tracking your exact locked positions!',
    defaultGaze: { x: 0, y: 0 },
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    voicePrompt: "Ka-chow! Your custom eye trajectory is saved and active!",
  },
};

export const CalibrationStudio: React.FC<CalibrationStudioProps> = ({
  isOpen,
  onClose,
  currentPupilCamera,
  calibrationGaze,
  onSetCalibrationGaze,
  onSpeak,
}) => {
  const [step, setStep] = useState<CalibrationStep>('intro');
  const [recordedPoints, setRecordedPoints] = useState<Partial<CalibrationProfile>>({});
  const [isLockedAnimation, setIsLockedAnimation] = useState(false);

  // Set default starting gaze position when step changes
  useEffect(() => {
    if (isOpen && step !== 'intro' && step !== 'complete') {
      onSetCalibrationGaze(STEP_CONFIGS[step].defaultGaze);
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
      alert('Camera is searching for eyes. Make sure your face is visible in the camera frame!');
      return;
    }

    const activeGaze = calibrationGaze || STEP_CONFIGS[step].defaultGaze;
    const point: CalibrationPoint = {
      screenGaze: { ...activeGaze },
      pupilCamera: { ...currentPupilCamera },
    };

    setIsLockedAnimation(true);
    setTimeout(() => setIsLockedAnimation(false), 300);

    setRecordedPoints((prev) => {
      const updated = { ...prev, [step]: point };

      // Transition to next step
      if (step === 'center') setStep('right');
      else if (step === 'right') setStep('left');
      else if (step === 'left') setStep('up');
      else if (step === 'up') setStep('down');
      else if (step === 'down') {
        const finalProfile: CalibrationProfile = {
          id: 'custom_swipe_' + Date.now(),
          timestamp: Date.now(),
          center: updated.center || point,
          right: updated.right || point,
          left: updated.left || point,
          up: updated.up || point,
          down: point,
        };
        gazeCalibration.saveProfile(finalProfile);
        onSetCalibrationGaze(null);
        setStep('complete');
      }

      return updated;
    });
  }, [step, calibrationGaze, currentPupilCamera, onSetCalibrationGaze]);

  const handleFinish = useCallback(() => {
    onSetCalibrationGaze(null);
    onClose();
  }, [onSetCalibrationGaze, onClose]);

  // Spacebar / Enter shortcut to lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (step === 'intro') setStep('center');
        else if (step === 'complete') handleFinish();
        else handleCapturePoint();
      } else if (e.code === 'Escape') {
        handleFinish();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, handleCapturePoint, handleFinish]);

  if (!isOpen) return null;

  const currentConfig = STEP_CONFIGS[step];
  const displayGaze = calibrationGaze || currentConfig.defaultGaze;

  return (
    /* Floating Top HUD Bar */
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-lg pointer-events-auto select-none font-sans animate-in fade-in slide-in-from-top-2">
      <div className="bg-slate-950/90 border border-white/25 rounded-2xl p-3 shadow-2xl backdrop-blur-xl text-white space-y-2">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              {currentConfig.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Step Progress Dots */}
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
              onClick={handleFinish}
              className="p-1 hover:bg-white/15 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Instruction Banner */}
        <div className="flex items-center gap-2 text-[11px] text-slate-200">
          <Move className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
          <span>{currentConfig.instruction}</span>
        </div>

        {/* Camera Status Feedback */}
        {step !== 'intro' && step !== 'complete' && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-[10px] font-mono">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  currentPupilCamera ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className={currentPupilCamera ? 'text-emerald-300' : 'text-rose-400'}>
                {currentPupilCamera ? 'Face Detected ✓' : 'Face not visible'}
              </span>
            </div>

            <div className="text-slate-400 text-[9px]">
              Pupil Gaze: (X:{displayGaze.x.toFixed(2)}, Y:{displayGaze.y.toFixed(2)})
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          {step === 'intro' ? (
            <button
              onClick={() => setStep('center')}
              className="w-full py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
            >
              <span>Begin Swipe & Lock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : step === 'complete' ? (
            <button
              onClick={handleFinish}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-xs border border-emerald-400/40"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Done! Enjoy Perfect Eye Contact</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleCapturePoint}
                className={`flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer text-xs border border-emerald-400/30 ${
                  isLockedAnimation ? 'ring-2 ring-emerald-400 scale-105' : ''
                }`}
              >
                <Lock className="w-4 h-4 text-yellow-300" />
                <span>🔒 Lock This Position & Next</span>
              </button>

              <button
                onClick={() => onSetCalibrationGaze(STEP_CONFIGS[step].defaultGaze)}
                title="Reset Position"
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
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
