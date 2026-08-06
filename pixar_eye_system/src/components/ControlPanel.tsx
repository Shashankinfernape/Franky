import React, { useState } from 'react';
import type { EmotionalState } from '../types/eye';
import { EMOTIONS } from '../constants/emotions';
import {
  Smile,
  Sparkles,
  Eye as EyeIcon,
  Zap,
  HelpCircle,
  Brain,
  Moon,
  Frown,
  Flame,
  Volume2,
  MessageSquare,
  Trophy,
  Camera,
  Activity,
  Smartphone,
  Settings,
  X,
} from 'lucide-react';

interface ControlPanelProps {
  currentEmotion: EmotionalState;
  onSelectEmotion: (emotion: EmotionalState) => void;
  onTriggerBlink: () => void;
  isFaceTracking: boolean;
  onToggleFaceTracking: () => void;
  enableMicroSaccades: boolean;
  onToggleMicroSaccades: () => void;
  showPhoneFrame: boolean;
  onTogglePhoneFrame: () => void;
  customPupilScale: number;
  onChangePupilScale: (val: number) => void;
}

const EMOTION_ICONS: Record<EmotionalState, React.ReactNode> = {
  neutral: <EyeIcon className="w-4 h-4" />,
  happy: <Smile className="w-4 h-4 text-amber-400" />,
  curious: <HelpCircle className="w-4 h-4 text-cyan-400" />,
  focused: <EyeIcon className="w-4 h-4 text-emerald-400" />,
  excited: <Zap className="w-4 h-4 text-yellow-400" />,
  confused: <HelpCircle className="w-4 h-4 text-purple-400" />,
  thinking: <Brain className="w-4 h-4 text-blue-400" />,
  sleepy: <Moon className="w-4 h-4 text-indigo-300" />,
  sad: <Frown className="w-4 h-4 text-sky-400" />,
  angry: <Flame className="w-4 h-4 text-rose-500" />,
  embarrassed: <Smile className="w-4 h-4 text-pink-400" />,
  listening: <Volume2 className="w-4 h-4 text-teal-400" />,
  talking: <MessageSquare className="w-4 h-4 text-orange-400" />,
  celebrating: <Trophy className="w-4 h-4 text-amber-300" />,
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  currentEmotion,
  onSelectEmotion,
  onTriggerBlink,
  isFaceTracking,
  onToggleFaceTracking,
  enableMicroSaccades,
  onToggleMicroSaccades,
  showPhoneFrame,
  onTogglePhoneFrame,
  customPupilScale,
  onChangePupilScale,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Minimal Gear Settings Button (Bottom Right) */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
          <button
            onClick={onTriggerBlink}
            title="Blink"
            className="p-3 bg-red-600/70 hover:bg-red-500 text-white rounded-full backdrop-blur-md shadow-lg transition-all active:scale-95 border border-red-400/30 cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsOpen(true)}
            title="Settings"
            className="p-3 bg-slate-900/70 hover:bg-slate-800 text-slate-200 rounded-full backdrop-blur-md shadow-lg transition-all active:scale-95 border border-white/20 cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Slide-Up Compact Settings Drawer */}
      {isOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-lg bg-slate-950/90 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 text-white shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-xs font-bold tracking-wider uppercase text-slate-300">
                Eye Controls & Expression Settings
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onTriggerBlink}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-xs font-semibold rounded-lg transition-all active:scale-95 shadow flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Blink
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/15 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Settings Body */}
          <div className="mt-3 space-y-4 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
            {/* Emotions Grid */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Select Emotion State
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {Object.keys(EMOTIONS).map((key) => {
                  const stateKey = key as EmotionalState;
                  const active = currentEmotion === stateKey;
                  return (
                    <button
                      key={stateKey}
                      onClick={() => onSelectEmotion(stateKey)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-medium transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-b from-red-600 to-red-800 border-red-400 text-white shadow-md scale-105'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      {EMOTION_ICONS[stateKey]}
                      <span className="mt-1 capitalize truncate w-full text-center">
                        {EMOTIONS[stateKey].label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tuning Sliders & Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
              {/* Pupil Scale Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Pupil Size</span>
                  <span className="font-mono text-amber-400">{customPupilScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.35"
                  step="0.05"
                  value={customPupilScale}
                  onChange={(e) => onChangePupilScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-around gap-2 text-xs">
                <button
                  onClick={onToggleFaceTracking}
                  className={`flex-1 py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    isFaceTracking
                      ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isFaceTracking ? 'Tracking On' : 'Idle Look'}
                </button>

                <button
                  onClick={onToggleMicroSaccades}
                  className={`flex-1 py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    enableMicroSaccades
                      ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Micro-Motion
                </button>

                <button
                  onClick={onTogglePhoneFrame}
                  title="Toggle Phone Chassis Mockup"
                  className={`py-1.5 px-2.5 rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    showPhoneFrame
                      ? 'bg-amber-600/30 border-amber-500/50 text-amber-300'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
