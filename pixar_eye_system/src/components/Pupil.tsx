import React from 'react';
import { motion } from 'framer-motion';
import type { GazePoint } from '../types/eye';

interface PupilProps {
  scale?: number;
  parallaxOffset?: GazePoint;
}

export const Pupil: React.FC<PupilProps> = ({ scale = 1.0, parallaxOffset }) => {
  let pX = (parallaxOffset?.x || 0) * -15;
  let pY = (parallaxOffset?.y || 0) * -15;
  
  const dist = Math.sqrt(pX * pX + pY * pY);
  const MAX_RADIUS = 12; // Strict boundary limit in pixels
  
  if (dist > MAX_RADIUS) {
    pX = (pX / dist) * MAX_RADIUS;
    pY = (pY / dist) * MAX_RADIUS;
  }

  return (
    <motion.div
      className="w-[40%] h-[40%] rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.8)] filter blur-[1px] pointer-events-none"
      animate={{
        scale: scale * 1.35,
        x: pX,
        y: pY,
      }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 22,
      }}
    />
  );
};
