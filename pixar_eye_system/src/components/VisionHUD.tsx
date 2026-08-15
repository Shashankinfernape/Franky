import React from 'react';
import type { AttentionOutput } from '../types/vision';
import { Eye, User, Sparkles, Activity, ShieldAlert } from 'lucide-react';

interface VisionHUDProps {
  attentionData: AttentionOutput | null;
  cameraActive: boolean;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const VisionHUD: React.FC<VisionHUDProps> = ({
  attentionData,
  cameraActive,
  isLoading,
  error,
  isOpen,
  onToggleOpen,
}) => {
  if (!cameraActive && !isLoading && !error) return null;

  const state = attentionData?.state || 'IDLE';
  const source = attentionData?.activeSource || 'idle';
  const confidence = Math.round((attentionData?.confidence || 0) * 100);
  const curiosityScore = Math.round((attentionData?.curiosityScore || 0) * 100);
  const target = attentionData?.smoothedPoint || { x: 0, y: 0 };

  const getSourceBadge = () => {
    switch (source) {
      case 'iris':
        return {
          icon: <Eye className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />,
          label: 'Iris Gaze Lock',
          color: 'border-cyan-500/50 bg-cyan-950/60 text-cyan-200',
        };
      case 'face':
        return {
          icon: <User className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'Face 3D Trajectory',
          color: 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200',
        };
      case 'body':
        return {
          icon: <User className="w-3.5 h-3.5 text-indigo-400" />,
          label: 'Body/Torso Tracking',
          color: 'border-indigo-500/50 bg-indigo-950/60 text-indigo-200',
        };
      case 'motion':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
          label: 'Room Curiosity Glance',
          color: 'border-amber-500/50 bg-amber-950/60 text-amber-200',
        };
      default:
        return {
          icon: <Activity className="w-3.5 h-3.5 text-slate-400" />,
          label: 'Idle Wandering',
          color: 'border-slate-700 bg-slate-900/60 text-slate-400',
        };
    }
  };

  const badge = getSourceBadge();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 select-none pointer-events-auto font-mono">
      {/* Minimized Pill Badge */}
      <button
        onClick={onToggleOpen}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg transition-all active:scale-95 text-xs cursor-pointer ${badge.color}`}
      >
        {isLoading ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Loading Vision Models...</span>
          </>
        ) : error ? (
          <>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-300">{error}</span>
          </>
        ) : (
          <>
            {badge.icon}
            <span className="font-semibold">{badge.label}</span>
            <span className="opacity-70 text-[10px]">{confidence}%</span>
          </>
        )}
      </button>

      {/* Expanded Vision Radar / HUD Panel */}
      {isOpen && cameraActive && attentionData && (
        <div className="w-64 bg-slate-950/90 border border-white/20 rounded-2xl p-3 shadow-2xl backdrop-blur-xl text-white text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-bold text-slate-200 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 text-red-500" /> Vision Radar
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
              {state}
            </span>
          </div>

          {/* Coordinate Crosshair Radar Grid */}
          <div className="relative w-full h-24 bg-slate-900/80 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center">
            {/* Center Grid Lines */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/15" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-white/15" />
            {/* Target Reticle */}
            <div
              className={`absolute w-3.5 h-3.5 rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 shadow-md ${
                source === 'motion'
                  ? 'border-amber-400 bg-amber-400/40 animate-ping'
                  : source === 'iris'
                  ? 'border-cyan-400 bg-cyan-400/30'
                  : 'border-emerald-400 bg-emerald-400/20'
              }`}
              style={{
                left: `${((target.x + 1) / 2) * 100}%`,
                top: `${((target.y + 1) / 2) * 100}%`,
              }}
            />
          </div>

          {/* Metrics & Sliders */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-300">
              <span>Target Vector:</span>
              <span className="text-amber-300">
                X:{target.x.toFixed(2)} Y:{target.y.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Attention Confidence:</span>
              <span className="text-cyan-300">{confidence}%</span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100"
                style={{ width: `${confidence}%` }}
              />
            </div>

            <div className="flex justify-between text-slate-300 pt-1">
              <span>Curiosity Saliency:</span>
              <span className="text-amber-400">{curiosityScore}%</span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-100"
                style={{ width: `${curiosityScore}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
