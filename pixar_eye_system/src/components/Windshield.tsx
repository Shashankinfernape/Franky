import React from 'react';
import { Eye } from './Eye';
import { UpperLid } from './UpperLid';
import type { EmotionConfig, GazePoint } from '../types/eye';

interface WindshieldProps {
  emotion: EmotionConfig;
  currentGaze: GazePoint;
  parallaxOffset: GazePoint;
  blinkProgress: number;
}

/**
 * Full-screen windshield layout — no gasket frame.
 *
 * Layout (matches Cars movie framing):
 *   - WHITE windshield glass fills the ENTIRE viewport
 *   - Red car roof (UpperLid) slides down from the TOP
 *   - Red hood panel rises from the BOTTOM (~18% of screen)
 *   - Two eyes absolutely positioned:
 *       Left iris center:  37.5% from left,  38% from top
 *       Right iris center: 62.5% from left,  38% from top
 *     These proportions match the movie reference where irises sit
 *     directly below the two arch openings in the lid.
 */
export const Windshield: React.FC<WindshieldProps> = ({
  emotion,
  currentGaze,
  parallaxOffset,
  blinkProgress,
}) => {
  return (
    <div
      className="relative w-screen h-screen select-none overflow-hidden touch-none"
      style={{
        /* Windshield glass — off-white, very slightly warm */
        background: 'radial-gradient(ellipse at 50% 40%, #F8F7F3 0%, #F0EFE9 55%, #E8E7DF 100%)',
      }}
    >
      {/* Subtle top ambient shadow (roof casts into glass) */}
      <div className="absolute inset-x-0 top-0 h-[12%] z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, transparent 100%)' }} />

      {/* Left side A-pillar shadow */}
      <div className="absolute inset-y-0 left-0 w-[6%] z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.12) 0%, transparent 100%)' }} />

      {/* Right side A-pillar shadow */}
      <div className="absolute inset-y-0 right-0 w-[6%] z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.12) 0%, transparent 100%)' }} />

      {/* Diagonal glass glare / sun reflection */}
      <div className="absolute z-10 pointer-events-none"
           style={{
             top: '-20%', left: '-20%',
             width: '80%', height: '60%',
             background: 'linear-gradient(to bottom, rgba(255,255,255,0.14) 0%, transparent 100%)',
             transform: 'rotate(-12deg)',
             filter: 'blur(8px)',
             opacity: 0.6,
           }} />

      {/* ─────────── McQueen Eyelid ─────────── */}
      <UpperLid
        blinkProgress={blinkProgress}
        currentGaze={currentGaze}
        emotionState={emotion.name}
      />

      {/* ─────────── Left Eye ─────────── */}
      {/* Positioned at 37.5% from left, 38% from top (iris center) */}
      <div
        className="absolute z-20"
        style={{
          left: '32%',
          top: '55%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <Eye
          currentGaze={currentGaze}
          parallaxOffset={parallaxOffset}
          pupilScale={emotion.pupilScale}
          emotionState={emotion.name}
        />
      </div>

      {/* ─────────── Right Eye ─────────── */}
      {/* Positioned at 62.5% from left, 38% from top */}
      <div
        className="absolute z-20"
        style={{
          left: '68%',
          top: '55%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <Eye
          currentGaze={currentGaze}
          parallaxOffset={parallaxOffset}
          pupilScale={emotion.pupilScale}
          emotionState={emotion.name}
        />
      </div>

      {/* ─────────── Bottom Red Hood Panel ─────────── */}
      <div
        className="absolute bottom-0 inset-x-0 z-20 pointer-events-none"
        style={{
          height: '20%',
          background: `
            linear-gradient(to top,
              #8A0A0E 0%,
              #B41618 30%,
              #C82020 65%,
              rgba(195,28,28,0.55) 85%,
              transparent 100%
            )
          `,
        }}
      />

      {/* Hood specular highlight */}
      <div
        className="absolute bottom-0 inset-x-0 z-21 pointer-events-none"
        style={{
          height: '12%',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(255,180,180,0.18) 0%, transparent 70%)',
        }}
      />
    </div>
  );
};
