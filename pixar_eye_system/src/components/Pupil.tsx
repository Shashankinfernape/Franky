import React from 'react';
import { motion, useTransform, MotionValue } from 'framer-motion';

interface PupilProps {
  scale?: number;
  parallaxX: MotionValue<number>;
  parallaxY: MotionValue<number>;
}

export const Pupil: React.FC<PupilProps> = ({ scale = 1.0, parallaxX, parallaxY }) => {
  
  const pX = useTransform([parallaxX, parallaxY], ([px, py]: number[]) => {
    let x = px * -15;
    let y = py * -15;
    const dist = Math.sqrt(x * x + y * y);
    const MAX_RADIUS = 12;
    if (dist > MAX_RADIUS) {
      x = (x / dist) * MAX_RADIUS;
    }
    return x;
  });

  const pY = useTransform([parallaxX, parallaxY], ([px, py]: number[]) => {
    let x = px * -15;
    let y = py * -15;
    const dist = Math.sqrt(x * x + y * y);
    const MAX_RADIUS = 12;
    if (dist > MAX_RADIUS) {
      y = (y / dist) * MAX_RADIUS;
    }
    return y;
  });

  return (
    <motion.div
      className="w-[40%] h-[40%] rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.8)] filter blur-[1px] pointer-events-none"
      animate={{ scale: scale * 1.35 }}
      style={{ x: pX, y: pY }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 22,
      }}
    />
  );
};
