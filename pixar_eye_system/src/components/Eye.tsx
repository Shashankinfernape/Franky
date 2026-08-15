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
  happy:       { x: 0,     y: -0.12 },
  excited:     { x: 0,     y: -0.20 },
  angry:       { x: 0,     y:  0.10 },
  sad:         { x: 0.05,  y:  0.20 },
  sleepy:      { x: 0,     y:  0.25 },
  focused:     { x: 0,     y:  0.03 },
  thinking:    { x: -0.25, y: -0.18 },
  curious:     { x: 0.18,  y: -0.12 },
  confused:    { x: -0.12, y:  0.03 },
  embarrassed: { x: 0.22,  y:  0.22 },
  celebrating: { x: 0,     y: -0.25 },
  listening:   { x: 0,     y: -0.05 },
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
  
  // Centric, high-focus eye deflection (7.8vw max horizontal, 3.6vw max vertical)
  const bX = useTransform(gazeX, (x) => (x * 0.70 + eGaze.x * 0.30) * 7.8 + 'vw');
  const bY = useTransform(gazeY, (y) => (y * 0.70 + eGaze.y * 0.30) * 3.6 + 'vw');

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
