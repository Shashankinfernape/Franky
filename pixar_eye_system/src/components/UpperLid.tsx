import React from 'react';
import { motion } from 'framer-motion';
import type { EmotionalState, GazePoint } from '../types/eye';

interface UpperLidProps {
  blinkProgress: number;
  currentGaze: GazePoint;
  emotionState: EmotionalState;
}

/**
 * McQueen Eyelid — CORRECT approach.
 *
 * THE KEY INSIGHT:
 *   The SVG must be a SOLID RED RECTANGLE from y=0 to near y=500,
 *   with the wave shape carved ONLY at the VERY BOTTOM EDGE (y≈380-430).
 *
 *   This renders as one solid red band covering the top of the screen,
 *   with a subtle scalloped bottom edge (two gentle arches + tiny center notch).
 *
 *   Previous versions had the arch cutouts near y=150 which made two
 *   separate red BLOBS dripping down — completely wrong.
 *
 * SVG: 0 0 1000 500
 *   The red fill path covers from y=0 to the wave (y≈380-430).
 *   Arch peaks (max glass visible) at x=320,x=680, y=380.
 *   Center notch tip at x=500, y=428.
 *   Outer dips at x=160,x=840, y=400.
 *
 * Lid HEIGHT (as % of screen) drives the emotion: higher = more coverage.
 * Iris sits at top=55%, so the lid eventually covers irises in angry/sleepy.
 */

const EMOTION_HEIGHT: Record<EmotionalState, number> = {
  neutral:     35,
  happy:       22,
  excited:     13,
  angry:       68,
  sad:         48,
  sleepy:      78,
  focused:     60,
  thinking:    32,
  curious:     27,
  confused:    42,
  embarrassed: 62,
  celebrating: 10,
  listening:   33,
  talking:     35,
};

const EMOTION_SKEW: Record<EmotionalState, number> = {
  neutral:     0,
  happy:       0,
  excited:     0,
  angry:       -2,
  sad:         1.8,
  sleepy:      0.9,
  focused:     -0.6,
  thinking:    1.8,
  curious:     -1.2,
  confused:    3,
  embarrassed: 1.4,
  celebrating: 0,
  listening:   0,
  talking:     0,
};

export const UpperLid: React.FC<UpperLidProps> = ({
  blinkProgress,
  currentGaze,
  emotionState,
}) => {
  const base = EMOTION_HEIGHT[emotionState] ?? 35;
  const gazeYAdj = currentGaze.y * 3;
  const h = blinkProgress > 0.05 ? 100 : Math.max(8, base + gazeYAdj);
  const skewX = (EMOTION_SKEW[emotionState] ?? 0) + currentGaze.x * 1.0;

  /*
    CORRECT SHAPE:
    The fill is a SOLID block from y=0 to the bottom wave.
    The wave is at the very BOTTOM of the SVG (y≈380-430 out of 500).

    Bottom boundary going RIGHT → LEFT (from x=1000 toward x=0):
      Right edge:       (1000, 390)  — moderate
      Right outer dip:  ( 840, 402)  — slight droop
      Right arch peak:  ( 680, 380)  — HIGHEST POINT (eye opening, less coverage)
      Right inner:      ( 618, 394)  — slopes toward center
      Center spike:     ( 500, 428)  — DEEPEST (red comes down most here)
      Left inner:       ( 382, 394)
      Left arch peak:   ( 320, 380)  — HIGHEST (eye opening)
      Left outer dip:   ( 160, 402)
      Left edge:        (   0, 394)
  */

  // FILL: solid red from top to wave
  const fillD = `
    M 0 0 L 1000 0 L 1000 390
    C 938 392 882 402 840 402
    C 808 402 792 380 680 380
    C 658 380 640 390 622 404
    C 610 412 570 426 500 428
    C 430 426 390 412 378 404
    C 360 390 342 380 320 380
    C 208 380 192 402 160 402
    C 118 402 62 392 0 394
    Z
  `;

  // TRIM: dark rubber seal along the bottom edge only
  const trimD = `
    M 0 394
    C 62 392 118 402 160 402
    C 192 402 208 380 320 380
    C 342 380 360 390 378 404
    C 390 412 430 426 500 428
    C 570 426 610 412 622 404
    C 640 390 658 380 680 380
    C 792 380 808 402 840 402
    C 882 402 938 392 1000 390
  `;

  return (
    <motion.div
      className="absolute top-0 left-0 w-full z-30 pointer-events-none"
      style={{ originY: 0 }}
      animate={{ height: `${h}%`, skewX }}
      transition={{ type: 'spring', stiffness: 180, damping: 26, mass: 0.9 }}
    >
      <svg
        viewBox="0 0 1000 500"
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <defs>
          {/* McQueen deep automotive red */}
          <linearGradient id="lG" x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%"   stopColor="#4E0808" />
            <stop offset="22%"  stopColor="#880E0E" />
            <stop offset="56%"  stopColor="#C31818" />
            <stop offset="80%"  stopColor="#DA2828" />
            <stop offset="100%" stopColor="#C62020" />
          </linearGradient>
          {/* Metallic specular highlight */}
          <radialGradient id="sG" cx="48%" cy="25%" r="62%">
            <stop offset="0%"   stopColor="rgba(255,200,200,0.28)" />
            <stop offset="50%"  stopColor="rgba(255,150,150,0.10)" />
            <stop offset="100%" stopColor="rgba(255,100,100,0.00)" />
          </radialGradient>
          <filter id="dSh" x="-5%" y="-5%" width="110%" height="250%">
            <feDropShadow dx="0" dy="15" stdDeviation="12" floodColor="rgba(0,0,0,0.55)" />
          </filter>
        </defs>

        {/* Solid red car body */}
        <path d={fillD} fill="url(#lG)" filter="url(#dSh)" />

        {/* Metallic sheen */}
        <path d={fillD} fill="url(#sG)" />

        {/* Dark rubber window seal trim along bottom edge */}
        <path
          d={trimD}
          fill="none"
          stroke="rgba(6,2,2,0.96)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Gloss highlight inside trim */}
        <path
          d={trimD}
          fill="none"
          stroke="rgba(255,180,180,0.20)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
};
