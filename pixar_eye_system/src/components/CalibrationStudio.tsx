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
  onSetCalibrationGaze: (gaze: Point2D | null) => void; // Drives Franky's eyes to user's dragged position
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
    title: 'Interactive Drag & Lock Calibration',
    instruction:
      'In each step, stand in position, DRAG McQueen’s eyes on screen until he looks 100% directly into your eyes, then tap Lock!',
    defaultGaze: { x: 0, y: 0 },
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
    voicePrompt: "Let's calibrate! Drag my eyes so I'm looking straight at you, then lock it in!",
  },
  center: {
    title: '1/5: Center Position',
    instruction:
      'Stay in the CENTER. Drag eyes / use arrows until McQueen looks dead into your eyes, then tap Lock.',
    defaultGaze: { x: 0.0, y: 0.0 },
    icon: <Target className="w-4 h-4 text-cyan-400 animate-pulse" />,
    voicePrompt: "Look at me from the center, drag my eyes so I'm looking at you, and tap Lock!",
  },
  right: {
    title: '2/5: Stand on RIGHT',
    instruction:
      'Step to the RIGHT of camera. Drag McQueen’s eyes until he looks straight into your eyes on the right, then tap Lock.',
    defaultGaze: { x: 0.40, y: 0.0 },
    icon: <ArrowRight className="w-4 h-4 text-emerald-400" />,
    voicePrompt: "Now step to your right, drag my eyes to look at you, and tap Lock!",
  },
  left: {
    title: '3/5: Stand on LEFT',
    instruction:
      'Step to the LEFT of camera. Drag McQueen’s eyes until he looks straight into your eyes on the left, then tap Lock.',
    defaultGaze: { x: -0.40, y: 0.0 },
    icon: <ArrowLeft className="w-4 h-4 text-indigo-400" />,
    voicePrompt: "Now step to your left, drag my eyes to look at you, and tap Lock!",
  },
  up: {
    title: '4/5: Look from ABOVE',
    instruction:
      'Stand tall or look down at the screen. Drag McQueen’s eyes up until he looks up at you, then tap Lock.',
    defaultGaze: { x: 0.0, y: -0.30 },
    icon: <ArrowUp className="w-4 h-4 text-purple-400" />,
    voicePrompt: "Stand tall or look from above, drag my eyes up to meet you, and tap Lock!",
  },
  down: {
    title: '5/5: Look from BELOW',
    instruction:
      'Sit lower or crouch. Drag McQueen’s eyes down until he looks down at you, then tap Lock.',
    defaultGaze: { x: 0.0, y: 0.25 },
    icon: <ArrowDown className="w-4 h-4 text-pink-400" />,
    voicePrompt: "Almost done! Sit lower, drag my eyes down to meet you, and tap Lock!",
  },
  complete: {
    title: 'Calibration Locked & Saved!',
    instruction:
      'Ground-truth trajectory profile generated from your exact manual locks. McQueen will now follow you with 100% precision!',
    defaultGaze: { x: 0, y: 0 },
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    voicePrompt: "Ka-chow! Your custom eye positions are locked in!",
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
  const [currentGaze, setCurrentGaze] = useState<Point2D>({ x: 0, y: 0 });
  const [recordedPoints, setRecordedPoints] = useState<Partial<CalibrationProfile>>({});
  const [isLockedAnimation, setIsLockedAnimation] = useState(false);

  // Sync current dragged gaze with Franky's eyes
  useEffect(() => {
    if (!isOpen) {
      onSetCalibrationGaze(null);
      return;
    }

    if (step !== 'intro' && step !== 'complete') {
      onSetCalibrationGaze(currentGaze);
    } else {
      onSetCalibrationGaze(null);
    }
  }, [isOpen, step, currentGaze, onSetCalibrationGaze]);

  // Reset gaze to default suggestion when entering a new step
  useEffect(() => {
    if (step !== 'intro' && step !== 'complete') {
      setCurrentGaze(STEP_CONFIGS[step].defaultGaze);
    }
  }, [step]);

  // Voice guidance prompt per step
  useEffect(() => {
    if (isOpen && onSpeak) {
      onSpeak(STEP_CONFIGS[step].voicePrompt);
    }
  }, [isOpen, step, onSpeak]);

  // Nudge functions (0.05 step)
  const nudge = useCallback((dx: number, dy: number) => {
    setCurrentGaze((prev) => ({
      x: Math.max(-1.0, Math.min(1.0, prev.x + dx)),
      y: Math.max(-1.0, Math.min(1.0, prev.y + dy)),
    }));
  }, []);

  const handleCapturePoint = useCallback(() => {
    if (!currentPupilCamera) {
      alert('Camera is searching for eyes. Make sure your face is visible in the webcam!');
      return;
    }

    const point: CalibrationPoint = {
      screenGaze: { ...currentGaze },
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
          id: 'custom_drag_' + Date.now(),
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
  }, [step, currentGaze, currentPupilCamera]);

  // Keyboard arrow keys for precision nudging + Space for lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        nudge(-0.04, 0);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        nudge(0.04, 0);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        nudge(0, -0.04);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        nudge(0, 0.04);
      } else if (e.code === 'Space' || e.code === 'Enter') {
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
  }, [isOpen, step, nudge, handleCapturePoint, onClose]);

  if (!isOpen) return null;

  const currentConfig = STEP_CONFIGS[step];

  return (
    /* Floating Top HUD - 100% Unobscured Eyes in Center */
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-lg pointer-events-auto select-none font-sans animate-in fade-in slide-in-from-top-2">
      <div className="bg-slate-950/90 border border-white/25 rounded-2xl p-3 shadow-2xl backdrop-blur-xl text-white space-y-2.5">
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
              onClick={onClose}
              className="p-1 hover:bg-white/15 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Instruction Banner */}
        <p className="text-[11px] text-slate-200 leading-snug">
          {currentConfig.instruction}
        </p>

        {/* Interactive Gaze Nudge D-Pad & Camera Status */}
        {step !== 'intro' && step !== 'complete' && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            {/* Camera Status */}
            <div className="flex flex-col gap-0.5 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    currentPupilCamera ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className={currentPupilCamera ? 'text-emerald-300' : 'text-rose-400'}>
                  {currentPupilCamera ? 'Eyes Detected ✓' : 'Face not visible'}
                </span>
              </div>
              <div className="text-slate-400 text-[9px]">
                Gaze (X:{currentGaze.x.toFixed(2)}, Y:{currentGaze.y.toFixed(2)})
              </div>
            </div>

            {/* Directional Nudge D-Pad Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => nudge(-0.06, 0)}
                title="Nudge Left"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-lg text-slate-200 border border-white/10"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => nudge(0, -0.06)}
                  title="Nudge Up"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-lg text-slate-200 border border-white/10"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => nudge(0, 0.06)}
                  title="Nudge Down"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-lg text-slate-200 border border-white/10"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={() => nudge(0.06, 0)}
                title="Nudge Right"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-lg text-slate-200 border border-white/10"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
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
              <span>Begin Drag & Lock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : step === 'complete' ? (
            <button
              onClick={onClose}
              className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Done! Enjoy Perfect Eye Contact</span>
            </button>
          ) : (
            <>
              <button
                onClick={handleCapturePoint}
                className={`flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer text-xs border border-emerald-400/30 ${
                  isLockedAnimation ? 'ring-2 ring-emerald-400 scale-105' : ''
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-yellow-300" />
                <span>🔒 Lock This Position & Next</span>
              </button>

              <button
                onClick={() => setCurrentGaze(STEP_CONFIGS[step].defaultGaze)}
                title="Reset Position"
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
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
