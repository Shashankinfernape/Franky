import React from 'react';
import { motion } from 'framer-motion';
import type { EmotionalState, GazePoint } from '../types/eye';

interface UpperLidProps {
  blinkProgress: number;
  currentGaze: GazePoint;
  emotionState: EmotionalState;
}

const LID_BASE = 130;

const EMOTION_DROP: Record<EmotionalState, number> = {
  neutral:     0,
  happy:       -22,
  excited:     -42,
  angry:       95,
  sad:         60,
  sleepy:      280,
  focused:     28,
  thinking:    -14,
  curious:     -30,
  confused:    30,
  embarrassed: 85,
  celebrating: -48,
  listening:   0,
  talking:     0,
};

const EMOTION_DIP: Record<EmotionalState, number> = {
  neutral:     25,
  happy:       8,
  excited:     4,
  angry:       35,
  sad:         12,
  sleepy:      0,
  focused:     22,
  thinking:    12,
  curious:     8,
  confused:    28,
  embarrassed: 10,
  celebrating: 4,
  listening:   15,
  talking:     15,
};

const EMOTION_SKEW: Record<EmotionalState, number> = {
  neutral:     0,
  happy:       0,
  excited:     0,
  angry:       -2.5,
  sad:         2.0,
  sleepy:      1.0,
  focused:     -0.8,
  thinking:    2.0,
  curious:     -1.2,
  confused:    4.0,
  embarrassed: 1.8,
  celebrating: 0,
  listening:   0,
  talking:     0,
};

function makeLidFill(bLeft: number, bRight: number, d: number, cx: number): string {
  const bCenter = (bLeft + bRight) / 2;
  const notch = Math.max(2, bCenter - d);
  const arch = 25; // Lesser upward curve height
  return [
    `M -100 -100`,
    `L 1100 -100`,
    `L 1100 ${bRight}`,
    `C 750 ${bRight - arch} ${600 + cx} ${bCenter} ${530 + cx} ${bCenter}`,
    `C ${515 + cx} ${bCenter} ${506 + cx} ${notch} ${500 + cx} ${notch}`,
    `C ${494 + cx} ${notch} ${485 + cx} ${bCenter} ${470 + cx} ${bCenter}`,
    `C ${400 + cx} ${bCenter} 250 ${bLeft - arch} -100 ${bLeft}`,
    `Z`,
  ].join(' ');
}

export const UpperLid: React.FC<UpperLidProps> = ({
  blinkProgress,
  currentGaze,
  emotionState,
}) => {
  const drop    = EMOTION_DROP[emotionState] ?? 0;
  const dipBase = EMOTION_DIP[emotionState] ?? 15;
  
  // Massive dynamic tracking of eyeballs
  const gazeAdjY = currentGaze.y * 65; // Lids follow up/down
  const gazeAdjX = currentGaze.x * 45; // Lids slant left/right
  const skewX    = EMOTION_SKEW[emotionState] ?? 0; // Pure emotion skew
  const cx       = currentGaze.x * 120; // Center notch slides left/right

  let bLeft = LID_BASE + drop + gazeAdjY + gazeAdjX;
  let bRight = LID_BASE + drop + gazeAdjY - gazeAdjX;

  // Mathematically interpolate the blink using the 60fps custom blink engine
  // This allows half-blinks, sleepy blinks, and double blinks to work perfectly.
  bLeft = bLeft + (435 - bLeft) * blinkProgress;
  bRight = bRight + (435 - bRight) * blinkProgress;

  bLeft = Math.max(18, Math.min(435, bLeft));
  bRight = Math.max(18, Math.min(435, bRight));

  // The center 'M' notch flattens out fully during a blink
  const dip = dipBase * (1 - blinkProgress);

  const fillD = makeLidFill(bLeft, bRight, dip, cx);

  return (
    <motion.svg
      viewBox="0 0 1000 435"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 30, originX: '50%', originY: '0%', overflow: 'visible' }}
      animate={{ skewX }}
      transition={{ type: 'tween', duration: 0 }}
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
        transition={{ type: 'tween', duration: 0 }}
      />

      <motion.path
        d={fillD}
        fill="url(#lgSheen)"
        animate={{ d: fillD }}
        transition={{ type: 'tween', duration: 0 }}
      />
    </motion.svg>
  );
};
