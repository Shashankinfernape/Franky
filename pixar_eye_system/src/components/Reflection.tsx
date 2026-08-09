import React from 'react';
import { motion, useTransform, MotionValue } from 'framer-motion';

interface ReflectionProps {
  parallaxX: MotionValue<number>;
  parallaxY: MotionValue<number>;
}

export const Reflection: React.FC<ReflectionProps> = ({ parallaxX, parallaxY }) => {
  const x = useTransform(parallaxX, (val) => val * 0.5);
  const y = useTransform(parallaxY, (val) => val * 0.5);

  return (
    <motion.div
      className="absolute top-[12%] left-[14%] w-[38%] h-[24%] rounded-[50%] bg-white/45 blur-[6px] pointer-events-none -rotate-12"
      style={{ x, y }}
    />
  );
};
