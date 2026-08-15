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
  happy:       { x: 0,     y: -0.06 },
  excited:     { x: 0,     y: -0.10 },
  angry:       { x: 0,     y:  0.05 },
  sad:         { x: 0.02,  y:  0.08 },
  sleepy:      { x: 0,     y:  0.12 },
  focused:     { x: 0,     y:  0.02 },
  thinking:    { x: -0.12, y: -0.08 },
  curious:     { x: 0.10,  y: -0.06 },
  confused:    { x: -0.06, y:  0.02 },
  embarrassed: { x: 0.10,  y:  0.10 },
  celebrating: { x: 0,     y: -0.12 },
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
  
  // Responsive, clear Pixar eye deflection (4.8vw horizontal, 2.8vw vertical)
  const bX = useTransform(gazeX, (x) => (x * 0.85 + eGaze.x * 0.15) * 4.8 + 'vw');
  const bY = useTransform(gazeY, (y) => (y * 0.85 + eGaze.y * 0.15) * 2.8 + 'vw');

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
