import React from 'react';
import { Pupil } from './Pupil';
import { Reflection } from './Reflection';
import { Catchlight } from './Catchlight';
import type { GazePoint } from '../types/eye';

import { MotionValue } from 'framer-motion';

interface IrisProps {
  pupilScale?: number;
  parallaxX: MotionValue<number>;
  parallaxY: MotionValue<number>;
}

export const Iris: React.FC<IrisProps> = ({ pupilScale = 1.0, parallaxX, parallaxY }) => {
  return (
    <div
      className="relative rounded-full flex items-center justify-center shadow-[inset_0_4px_16px_rgba(0,0,0,0.5),0_0_8px_rgba(13,27,57,0.4)] overflow-hidden"
      style={{
        width: '12.5vw',
        height: '12.5vw',
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
      {/* High-res crisp graphic striation lines (360 rays) */}
      <svg 
        className="absolute inset-0 w-full h-full mix-blend-overlay pointer-events-none" 
        viewBox="0 0 100 100"
        style={{ opacity: 0.9 }}
      >
        {Array.from({ length: 360 }).map((_, i) => {
          const isPrimary = i % 4 === 0;
          const isSecondary = i % 3 === 0;
          const isDark = i % 7 === 0;

          // Pseudo-random variations for jagged organic edges
          const lengthVar = Math.sin(i * 4.3) * 6 + Math.cos(i * 11.7) * 3; 
          const startVar = Math.cos(i * 7.1) * 1.5;

          let y1 = 30 + startVar; // Start at pupil edge (radius 20)
          let y2 = 12 + lengthVar; // End before outer dark ring (radius 38)
          let stroke = '#80DEEA'; // Default cyan
          let strokeWidth = 0.2;
          let opacity = 0.5 + Math.sin(i * 2.7) * 0.2;

          if (isDark) {
            stroke = '#001F3F';
            strokeWidth = 0.4;
            opacity = 0.7;
            y2 = 8 + lengthVar; // Dark lines reach further out
          } else if (isPrimary) {
            stroke = '#FFFFFF';
            strokeWidth = 0.25;
            opacity = 0.8;
            y2 = 16 + lengthVar; // Bright white lines are shorter
          } else if (isSecondary) {
            stroke = '#E0F7FA';
            strokeWidth = 0.2;
            opacity = 0.6;
          }

          return (
            <line
              key={i}
              x1="50"
              y1={y1}
              x2="50"
              y2={y2}
              stroke={stroke}
              strokeWidth={strokeWidth}
              opacity={opacity}
              transform={`rotate(${i} 50 50)`}
            />
          );
        })}
      </svg>

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

      <Pupil scale={pupilScale} parallaxX={parallaxX} parallaxY={parallaxY} />
      <Reflection parallaxX={parallaxX} parallaxY={parallaxY} />
      <Catchlight parallaxX={parallaxX} parallaxY={parallaxY} />
    </div>
  );
};
