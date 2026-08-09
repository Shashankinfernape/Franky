import React from 'react';
import { motion } from 'framer-motion';
import type { EmotionalState, GazePoint } from '../types/eye';

interface UpperLidProps {
  blinkProgress: number;
  currentGaze: GazePoint;
  emotionState: EmotionalState;
}

const LID_BASE = 74;
const DIP = 15;

const EMOTION_DROP: Record<EmotionalState, number> = {
  neutral:     0,
  happy:       -20,
  excited:     -40,
  angry:       200,
  sad:         110,
  sleepy:      280,
  focused:     158,
  thinking:    -14,
  curious:     -30,
  confused:    55,
  embarrassed: 138,
  celebrating: -52,
  listening:   0,
  talking:     0,
};

const EMOTION_SKEW: Record<EmotionalState, number> = {
  neutral: 0,   happy: 0,     excited: 0,   angry: -1.5,
  sad: 1.4,     sleepy: 0.7,  focused: -0.5, thinking: 1.4,
  curious: -1.0, confused: 2.5, embarrassed: 1.2,
  celebrating: 0, listening: 0, talking: 0,
};

function makeLidFill(b: number, d: number): string {
  const notch = b - d;
  return [
    `M 0 0`,
    `L 1000 0`,
    `L 1000 ${b}`,
    `C 880 ${b} 700 ${b} 550 ${b}`,
    `C 530 ${b} 514 ${notch} 500 ${notch}`,
    `C 486 ${notch} 470 ${b} 450 ${b}`,
    `C 300 ${b} 120 ${b} 0 ${b}`,
    `Z`,
  ].join(' ');
}

function makeSeal(b: number, d: number): string {
  const notch = b - d;
  return [
    `M 0 ${b}`,
    `C 120 ${b} 300 ${b} 450 ${b}`,
    `C 470 ${b} 486 ${notch} 500 ${notch}`,
    `C 514 ${notch} 530 ${b} 550 ${b}`,
    `C 700 ${b} 880 ${b} 1000 ${b}`,
  ].join(' ');
}

const SPRING = {
  type: 'spring' as const,
  stiffness: 155,
  damping: 26,
  mass: 1.0,
};

export const UpperLid: React.FC<UpperLidProps> = ({
  blinkProgress,
  currentGaze,
  emotionState,
}) => {
  const drop    = EMOTION_DROP[emotionState] ?? 0;
  const gazeAdj = currentGaze.y * 14;
  const skewX   = (EMOTION_SKEW[emotionState] ?? 0) + currentGaze.x * 0.7;

  const bottom = blinkProgress > 0.05
    ? 435
    : Math.max(18, Math.min(435, LID_BASE + drop + gazeAdj));

  const dip = blinkProgress > 0.05 ? 0 : DIP;

  const fillD = makeLidFill(bottom, dip);
  const sealD = makeSeal(bottom, dip);

  return (
    <motion.svg
      viewBox="0 0 1000 435"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 30, originX: '50%', originY: '0%' }}
      animate={{ skewX }}
      transition={SPRING}
    >
      <defs>
        <linearGradient id="lgLid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3D0606" />
          <stop offset="18%"  stopColor="#7A0C0C" />
          <stop offset="52%"  stopColor="#BE1818" />
          <stop offset="80%"  stopColor="#D42222" />
          <stop offset="100%" stopColor="#C01C1C" />
        </linearGradient>

        <radialGradient id="lgSheen" cx="50%" cy="28%" rx="72%" ry="58%">
          <stop offset="0%"   stopColor="rgba(255,215,215,0.30)" />
          <stop offset="50%"  stopColor="rgba(255,160,160,0.10)" />
          <stop offset="100%" stopColor="rgba(255,100,100,0.00)" />
        </radialGradient>

        <filter id="fLidDrop" x="-3%" y="-3%" width="106%" height="600%">
          <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="rgba(0,0,0,0.55)" />
        </filter>
      </defs>

      <motion.path
        d={fillD}
        fill="url(#lgLid)"
        filter="url(#fLidDrop)"
        animate={{ d: fillD }}
        transition={SPRING}
      />

      <motion.path
        d={fillD}
        fill="url(#lgSheen)"
        animate={{ d: fillD }}
        transition={SPRING}
      />

      <motion.path
        d={sealD}
        fill="none"
        stroke="rgba(6,1,1,0.94)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ d: sealD }}
        transition={SPRING}
      />

      <motion.path
        d={sealD}
        fill="none"
        stroke="rgba(255,195,195,0.24)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ d: sealD }}
        transition={SPRING}
      />
    </motion.svg>
  );
};
