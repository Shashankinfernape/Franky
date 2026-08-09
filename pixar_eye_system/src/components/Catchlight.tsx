import React from 'react';
import { motion, useTransform, MotionValue } from 'framer-motion';

interface CatchlightProps {
  parallaxX: MotionValue<number>;
  parallaxY: MotionValue<number>;
}

export const Catchlight: React.FC<CatchlightProps> = ({ parallaxX, parallaxY }) => {
  const x = useTransform(parallaxX, (val) => val * 0.3);
  const y = useTransform(parallaxY, (val) => val * 0.3);

  return (
    <motion.div
      className="absolute top-[18%] right-[18%] w-[12%] h-[12%] rounded-full bg-white/85 shadow-sm pointer-events-none"
      style={{ x, y }}
    />
  );
};
