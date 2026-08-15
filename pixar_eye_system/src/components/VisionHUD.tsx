import React from 'react';
import type { AttentionOutput } from '../types/vision';
import { Eye, ShieldAlert, EyeOff, Target } from 'lucide-react';

interface VisionHUDProps {
  attentionData: AttentionOutput | null;
  cameraActive: boolean;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onRecalibrate?: () => void;
}

export const VisionHUD: React.FC<VisionHUDProps> = ({
  attentionData,
  cameraActive,
  isLoading,
  error,
  isOpen,
  onToggleOpen,
  onRecalibrate,
}) => {
  if (!cameraActive && !isLoading && !error) return null;

  const state = attentionData?.state || 'IDLE';
  const confidence = Math.round((attentionData?.confidence || 0) * 100);
  const target = attentionData?.smoothedPoint || { x: 0, y: 0 };
  const isLocked = state === 'EYES_LOCKED';

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 select-none pointer-events-auto font-mono">
      {/* Minimized Pill Badge */}
      <button
        onClick={onToggleOpen}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg transition-all active:scale-95 text-xs cursor-pointer ${
          isLocked
            ? 'border-cyan-500/50 bg-cyan-950/70 text-cyan-200 shadow-cyan-500/10'
            : 'border-slate-700 bg-slate-900/70 text-slate-300'
        }`}
      >
        {isLoading ? (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Loading Eye Tracker...</span>
          </>
        ) : error ? (
          <>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-rose-300">{error}</span>
          </>
        ) : isLocked ? (
          <>
            <Eye className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="font-semibold">Eyes Locked</span>
            <span className="opacity-75 text-[10px]">{confidence}%</span>
          </>
        ) : (
          <>
            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Searching Eyes...</span>
          </>
        )}
      </button>

      {/* Expanded Vision Radar / HUD Panel */}
      {isOpen && cameraActive && attentionData && (
        <div className="w-64 bg-slate-950/90 border border-white/20 rounded-2xl p-3 shadow-2xl backdrop-blur-xl text-white text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-bold text-slate-200 uppercase tracking-wider">
              <Eye className="w-3.5 h-3.5 text-cyan-400" /> Eye Gaze Radar
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                isLocked
                  ? 'text-cyan-300 bg-cyan-950/80 border-cyan-500/30'
                  : 'text-slate-400 bg-slate-900 border-white/10'
              }`}
            >
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
                isLocked
                  ? 'border-cyan-400 bg-cyan-400/40 shadow-cyan-400/50'
                  : 'border-slate-500 bg-slate-500/20'
              }`}
              style={{
                left: `${((target.x + 1) / 2) * 100}%`,
                top: `${((target.y + 1) / 2) * 100}%`,
              }}
            />
          </div>

          {/* Metrics */}
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-300">
              <span>Pupil Vector:</span>
              <span className="text-cyan-300">
                X:{target.x.toFixed(2)} Y:{target.y.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between text-slate-300">
              <span>Lock Confidence:</span>
              <span className="text-cyan-300">{confidence}%</span>
            </div>
            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-100"
                style={{ width: `${confidence}%` }}
              />
            </div>

            {onRecalibrate && (
              <button
                onClick={onRecalibrate}
                className="w-full mt-2 py-1.5 px-2 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow"
              >
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Recalibrate Eye Level</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
