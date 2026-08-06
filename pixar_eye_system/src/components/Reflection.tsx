import React from 'react';
import { motion } from 'framer-motion';
import type { GazePoint } from '../types/eye';

interface ReflectionProps {
  parallaxOffset: GazePoint;
}

export const Reflection: React.FC<ReflectionProps> = ({ parallaxOffset }) => {
  return (
    <motion.div
      className="absolute top-[12%] left-[14%] w-[38%] h-[24%] rounded-[50%] bg-white/45 blur-[6px] pointer-events-none -rotate-12"
      animate={{
        x: parallaxOffset.x * 0.5,
        y: parallaxOffset.y * 0.5,
      }}
      transition={{
        type: 'spring',
        stiffness: 140,
        damping: 18,
      }}
    />
  );
};
