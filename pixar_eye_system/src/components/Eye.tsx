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
  happy:       { x: 0,     y: -0.08 },
  excited:     { x: 0,     y: -0.14 },
  angry:       { x: 0,     y:  0.06 },
  sad:         { x: 0.03,  y:  0.12 },
  sleepy:      { x: 0,     y:  0.16 },
  focused:     { x: 0,     y:  0.02 },
  thinking:    { x: -0.15, y: -0.10 },
  curious:     { x: 0.12,  y: -0.08 },
  confused:    { x: -0.08, y:  0.02 },
  embarrassed: { x: 0.14,  y:  0.14 },
  celebrating: { x: 0,     y: -0.16 },
  listening:   { x: 0,     y: -0.03 },
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
  
  // Subtle, precise eye deflection (3.2vw horizontal, 1.8vw vertical)
  // Perfectly calibrated for tablets and laptops so eye contact is gentle and locks directly into your eyes
  const bX = useTransform(gazeX, (x) => (x * 0.70 + eGaze.x * 0.30) * 3.2 + 'vw');
  const bY = useTransform(gazeY, (y) => (y * 0.70 + eGaze.y * 0.30) * 1.8 + 'vw');

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
