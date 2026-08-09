import React from 'react';
import { Pupil } from './Pupil';
import { Reflection } from './Reflection';
import { Catchlight } from './Catchlight';
import type { GazePoint } from '../types/eye';

interface IrisProps {
  pupilScale?: number;
  parallaxOffset: GazePoint;
}

export const Iris: React.FC<IrisProps> = ({ pupilScale = 1.0, parallaxOffset }) => {
  return (
    <div
      className="relative rounded-full flex items-center justify-center shadow-[inset_0_4px_16px_rgba(0,0,0,0.5),0_0_8px_rgba(13,27,57,0.4)] overflow-hidden"
      style={{
        width: 'min(14vw, 14vw)',
        height: 'min(14vw, 14vw)',
        background: `radial-gradient(circle at 48% 46%,
          #000000 0%,
          #65DCCF 32%,
          #4DC8F3 50%,
          #2C78D8 72%,
          #163B7A 92%,
          #0D1B39 100%)`,
      }}
    >
      {/* Upper shadow — lid occlusion */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(14,27,57,0.45) 0%, rgba(14,27,57,0.1) 45%, transparent 100%)`,
        }}
      />

      {/* Soft painted fiber texture */}
      <div
        className="absolute inset-0 rounded-full opacity-40 mix-blend-soft-light pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 40% 60%,
            rgba(101,220,207,0.9) 0%,
            rgba(77,200,243,0.7) 40%,
            rgba(44,120,216,0.5) 70%,
            rgba(13,27,57,0.95) 100%)`,
        }}
      />

      {/* Inner shimmer */}
      <div
        className="absolute inset-1 rounded-full opacity-25 mix-blend-overlay pointer-events-none"
        style={{
          background: `radial-gradient(circle at 55% 42%,
            rgba(255,255,255,0.6) 0%,
            rgba(77,200,243,0.3) 50%,
            rgba(13,27,57,0.8) 100%)`,
        }}
      />

      {/* Limbal ring */}
      <div className="absolute inset-0 rounded-full border-[3px] border-[#0D1B39]/80 pointer-events-none" style={{ filter: 'blur(0.8px)' }} />

      <Pupil scale={pupilScale} />
      <Reflection parallaxOffset={parallaxOffset} />
      <Catchlight parallaxOffset={parallaxOffset} />
    </div>
  );
};
