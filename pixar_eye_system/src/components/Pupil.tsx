import React from 'react';
import { motion } from 'framer-motion';

interface PupilProps {
  scale?: number;
}

export const Pupil: React.FC<PupilProps> = ({ scale = 1.0 }) => {
  return (
    <motion.div
      className="w-[40%] h-[40%] rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.8)] filter blur-[1px] pointer-events-none"
      animate={{
        scale: scale,
      }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 22,
      }}
    />
  );
};
