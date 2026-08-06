import React from 'react';

interface ScleraProps {
  children?: React.ReactNode;
}

export const Sclera: React.FC<ScleraProps> = ({ children }) => {
  return (
    <div className="relative w-full h-full rounded-full bg-[#F3F2EE] flex items-center justify-center overflow-hidden shadow-[inset_0_16px_28px_rgba(0,0,0,0.12),inset_0_-8px_16px_rgba(0,0,0,0.06)]">
      {/* Subtle Upper Lid Occlusion Shadow cast onto Sclera */}
      <div className="absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-black/14 via-black/5 to-transparent pointer-events-none z-10" />

      {children}
    </div>
  );
};
