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
  happy:       { x: 0,     y: -0.18 },
  excited:     { x: 0,     y: -0.28 },
  angry:       { x: 0,     y:  0.15 },
  sad:         { x: 0.08,  y:  0.28 },
  sleepy:      { x: 0,     y:  0.40 },
  focused:     { x: 0,     y:  0.05 },
  thinking:    { x: -0.35, y: -0.28 },
  curious:     { x: 0.22,  y: -0.18 },
  confused:    { x: -0.18, y:  0.05 },
  embarrassed: { x: 0.32,  y:  0.32 },
  celebrating: { x: 0,     y: -0.35 },
  listening:   { x: 0,     y: -0.08 },
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
  
  const bX = useTransform(gazeX, (x) => (x * 0.75 + eGaze.x * 0.35) * 14 + 'vw');
  const bY = useTransform(gazeY, (y) => (y * 0.75 + eGaze.y * 0.35) * 5 + 'vw');

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
