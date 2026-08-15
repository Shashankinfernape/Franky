import React from 'react';
import { motion, useTransform, MotionValue } from 'framer-motion';
import { Iris } from './Iris';
import type { EmotionalState } from '../types/eye';

interface EyeProps {
  gazeX: MotionValue<number>;
  gazeY: MotionValue<number>;
  parallaxX: MotionValue<number>;
  parallaxY: MotionValue<number>;
  pupilScale?: number;
  emotionState: EmotionalState;
}

// McQueen's idle gaze direction per emotion (when not face-tracking)
const EMOTION_GAZE: Record<EmotionalState, { x: number; y: number }> = {
  neutral:     { x: 0,     y: 0     },
  happy:       { x: 0,     y: -0.05 },
  excited:     { x: 0,     y: -0.08 },
  angry:       { x: 0,     y:  0.04 },
  sad:         { x: 0.02,  y:  0.06 },
  sleepy:      { x: 0,     y:  0.10 },
  focused:     { x: 0,     y:  0.02 },
  thinking:    { x: -0.10, y: -0.06 },
  curious:     { x: 0.08,  y: -0.05 },
  confused:    { x: -0.05, y:  0.02 },
  embarrassed: { x: 0.08,  y:  0.08 },
  celebrating: { x: 0,     y: -0.10 },
  listening:   { x: 0,     y: -0.02 },
  talking:     { x: 0,     y:  0    },
};

export const Eye: React.FC<EyeProps> = ({
  gazeX,
  gazeY,
  parallaxX,
  parallaxY,
  pupilScale = 1.0,
  emotionState,
}) => {
  const eGaze = EMOTION_GAZE[emotionState] ?? { x: 0, y: 0 };
  
  // Safe Centric Deflection (2.2vw horizontal, 1.4vw vertical)
  // Perfectly contained within the eye socket — 100% impossible to look out of the window!
  const bX = useTransform(gazeX, (x) => (x * 0.85 + eGaze.x * 0.15) * 2.2 + 'vw');
  const bY = useTransform(gazeY, (y) => (y * 0.85 + eGaze.y * 0.15) * 1.4 + 'vw');

  return (
    <div className="relative flex items-center justify-center pointer-events-none">
      <motion.div
        className="relative flex items-center justify-center"
        style={{ x: bX, y: bY }}
      >
        <Iris pupilScale={pupilScale} parallaxX={parallaxX} parallaxY={parallaxY} />
      </motion.div>
    </div>
  );
};
