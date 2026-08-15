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
  Mic,
  Radar,
  Target,
} from 'lucide-react';

const VOICE_OPTIONS = [
  {
    id: 'xtts_original',
    name: '⚡ McQueen Original',
    description: 'Full GPU quality — Owen Wilson accurate',
    badge: '5.6 GB',
    badgeColor: 'text-amber-400',
    stars: '★★★★★',
  },
  {
    id: 'vits_lite',
    name: '🏎️ McQueen Lite',
    description: 'Lightweight — mobile CPU compatible',
    badge: '~35 MB',
    badgeColor: 'text-emerald-400',
    stars: '★★★☆☆',
  },
  {
    id: 'edge_neural',
    name: '🎤 McQueen Edge',
    description: 'Neural cloud voice — instant, no GPU',
    badge: 'Cloud',
    badgeColor: 'text-sky-400',
    stars: '★★☆☆☆',
  },
];

interface ControlPanelProps {
  currentEmotion: EmotionalState;
  onSelectEmotion: (emotion: EmotionalState) => void;
  onTriggerBlink: () => void;
  isVisionTracking: boolean;
  onToggleVisionTracking: () => void;
  enableMicroSaccades: boolean;
  onToggleMicroSaccades: () => void;
  showPhoneFrame: boolean;
  onTogglePhoneFrame: () => void;
  customPupilScale: number;
  onChangePupilScale: (val: number) => void;
  activeVoice: string;
  onVoiceChange: (voiceId: string) => void;
  isVisionHUDOpen: boolean;
  onToggleVisionHUD: () => void;
  isVisionReady: boolean;
  onOpenCalibrationStudio?: () => void;
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
  isVisionTracking,
  onToggleVisionTracking,
  enableMicroSaccades,
  onToggleMicroSaccades,
  showPhoneFrame,
  onTogglePhoneFrame,
  customPupilScale,
  onChangePupilScale,
  activeVoice,
  onVoiceChange,
  isVisionHUDOpen,
  onToggleVisionHUD,
  isVisionReady,
  onOpenCalibrationStudio,
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
                Eye Controls & Perception Settings
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
          <div className="mt-3 space-y-4 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
            {/* Calibration Studio Action Banner */}
            {onOpenCalibrationStudio && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCalibrationStudio();
                }}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-900/60 to-blue-900/60 hover:from-cyan-800/80 hover:to-blue-800/80 border border-cyan-500/50 rounded-2xl flex items-center justify-between text-left transition-all active:scale-98 shadow-md cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-cyan-500/20 rounded-xl">
                    <Target className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-cyan-200">
                      🎯 Calibrate Mona Lisa Eye Contact
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Align 5 room directions with Thumbs Up 👍
                    </div>
                  </div>
                </div>
                <span className="text-[10px] bg-cyan-500/30 text-cyan-300 font-bold px-2 py-1 rounded-lg border border-cyan-400/30">
                  Launch
                </span>
              </button>
            )}

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

            {/* Voice Selection */}
            <div className="pt-2 border-t border-white/10">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Mic className="w-3.5 h-3.5 text-red-400" /> Voice Model
              </label>
              <div className="space-y-1.5">
                {VOICE_OPTIONS.map((voice) => {
                  const isActive = activeVoice === voice.id;
                  return (
                    <button
                      key={voice.id}
                      onClick={() => onVoiceChange(voice.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-red-900/60 to-red-800/40 border-red-500/60 text-white shadow-md'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">{voice.name}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{voice.description}</span>
                      </div>
                      <div className="flex flex-col items-end ml-2 shrink-0">
                        <span className={`text-[10px] font-mono ${voice.badgeColor}`}>{voice.badge}</span>
                        <span className="text-[10px] text-amber-300/70 mt-0.5">{voice.stars}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pupil Scale Slider */}
            <div className="space-y-1 pt-2 border-t border-white/10">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Pupil Size</span>
                <span className="font-mono text-cyan-400">{customPupilScale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.35"
                step="0.05"
                value={customPupilScale}
                onChange={(e) => onChangePupilScale(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-xs">
              <button
                onClick={onToggleVisionTracking}
                className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isVisionTracking
                    ? 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 shadow'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isVisionTracking ? 'Eyes Lock ON' : 'Eyes Lock OFF'}</span>
                {isVisionTracking && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isVisionReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                )}
              </button>

              <button
                onClick={onToggleVisionHUD}
                className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isVisionHUDOpen
                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <Radar className="w-3.5 h-3.5 text-purple-400" />
                <span>Eye Radar</span>
              </button>

              <button
                onClick={onToggleMicroSaccades}
                className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  enableMicroSaccades
                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                <span>Micro-Motion</span>
              </button>

              <button
                onClick={onTogglePhoneFrame}
                title="Toggle Phone Chassis Mockup"
                className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  showPhoneFrame
                    ? 'bg-amber-600/30 border-amber-500/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>Chassis</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
