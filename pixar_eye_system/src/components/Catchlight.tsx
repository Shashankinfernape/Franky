import React from 'react';
import { motion } from 'framer-motion';
import type { GazePoint } from '../types/eye';

interface CatchlightProps {
  parallaxOffset: GazePoint;
}

export const Catchlight: React.FC<CatchlightProps> = ({ parallaxOffset }) => {
  return (
    <motion.div
      className="absolute bottom-[18%] right-[18%] w-[12%] h-[12%] rounded-full bg-white/85 shadow-sm pointer-events-none"
      animate={{
        x: parallaxOffset.x * 0.3,
        y: parallaxOffset.y * 0.3,
      }}
      transition={{
        type: 'spring',
        stiffness: 140,
        damping: 18,
      }}
    />
  );
};
