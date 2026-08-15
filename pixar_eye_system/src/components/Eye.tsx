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
  excited:     { x: 0,     y: -0.16 },
  angry:       { x: 0,     y:  0.08 },
  sad:         { x: 0.04,  y:  0.15 },
  sleepy:      { x: 0,     y:  0.20 },
  focused:     { x: 0,     y:  0.02 },
  thinking:    { x: -0.20, y: -0.14 },
  curious:     { x: 0.15,  y: -0.10 },
  confused:    { x: -0.10, y:  0.02 },
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
  
  // Natural, camera-friendly eye deflection (4.8vw max horizontal, 2.4vw max vertical)
  // Perfectly calibrated within human camera FOV so eyes never overshoot into extreme edges
  const bX = useTransform(gazeX, (x) => (x * 0.70 + eGaze.x * 0.30) * 4.8 + 'vw');
  const bY = useTransform(gazeY, (y) => (y * 0.70 + eGaze.y * 0.30) * 2.4 + 'vw');

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
