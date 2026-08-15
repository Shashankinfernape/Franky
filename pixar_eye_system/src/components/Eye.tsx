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
  happy:       { x: 0,     y: -0.10 },
  excited:     { x: 0,     y: -0.18 },
  angry:       { x: 0,     y:  0.08 },
  sad:         { x: 0.04,  y:  0.15 },
  sleepy:      { x: 0,     y:  0.22 },
  focused:     { x: 0,     y:  0.03 },
  thinking:    { x: -0.20, y: -0.15 },
  curious:     { x: 0.15,  y: -0.10 },
  confused:    { x: -0.10, y:  0.03 },
  embarrassed: { x: 0.18,  y:  0.18 },
  celebrating: { x: 0,     y: -0.20 },
  listening:   { x: 0,     y: -0.04 },
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
  
  // Confident 1:1 direct eye contact deflection (6.5vw horizontal, 3.5vw vertical)
  // Perfectly calibrated so McQueen locks eyes directly with you at any angle
  const bX = useTransform(gazeX, (x) => (x * 0.85 + eGaze.x * 0.15) * 6.5 + 'vw');
  const bY = useTransform(gazeY, (y) => (y * 0.85 + eGaze.y * 0.15) * 3.5 + 'vw');

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
