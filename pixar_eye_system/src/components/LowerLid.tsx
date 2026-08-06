import React from 'react';
import { motion } from 'framer-motion';

interface LowerLidProps {
  lidPath: string;
  gradientColors?: [string, string, string];
  isLeftEye?: boolean;
}

export const LowerLid: React.FC<LowerLidProps> = ({
  lidPath,
  gradientColors = ['#E60000', '#A80000', '#5C0000'],
  isLeftEye = true,
}) => {
  const sideKey = isLeftEye ? 'L' : 'R';
  const gradId = `lowerLidGrad-${sideKey}`;

  return (
    <g className="lower-lid-layer">
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={gradientColors[2]} />
          <stop offset="70%" stopColor={gradientColors[1]} />
          <stop offset="100%" stopColor={gradientColors[0]} />
        </linearGradient>
      </defs>

      <motion.path
        d={lidPath}
        fill={`url(#${gradId})`}
        stroke="#3B0000"
        strokeWidth="3"
        animate={{ d: lidPath }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 22,
        }}
      />
    </g>
  );
};
