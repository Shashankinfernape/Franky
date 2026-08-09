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
        background: `
          linear-gradient(to bottom,
            #2E0404 0%,
            #7A0A0A 28%,
            #C01616 55%,
            #A81212 80%,
            #6B0808 100%
          )
        `,
      }}
    >
      <div
        className="absolute top-0 left-0 overflow-hidden"
        style={{
          width: '100vw',
          height: 'calc(100vw / 2.3)',
          borderRadius: '0 0 3vw 3vw',
          boxShadow:
            'inset 0 0 0 8px rgba(6,1,1,0.85), ' +
            '0 6px 28px rgba(0,0,0,0.70)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            zIndex: 1,
            background:
              'radial-gradient(ellipse at 50% 32%, #FAFAF7 0%, #F4F3EC 50%, #ECEBD8 100%)',
          }}
        />

        <div
          className="absolute inset-y-0 left-0 pointer-events-none"
          style={{
            zIndex: 2,
            width: '9%',
            background:
              'linear-gradient(to right, rgba(0,0,0,0.24) 0%, transparent 100%)',
          }}
        />

        <div
          className="absolute inset-y-0 right-0 pointer-events-none"
          style={{
            zIndex: 2,
            width: '9%',
            background:
              'linear-gradient(to left, rgba(0,0,0,0.24) 0%, transparent 100%)',
          }}
        />

        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 2,
            top: '-12%', left: '-4%',
            width: '58%', height: '52%',
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 55%)',
            transform: 'rotate(-9deg)',
            filter: 'blur(5px)',
          }}
        />

        <div
          className="absolute bottom-0 inset-x-0 pointer-events-none"
          style={{
            zIndex: 2,
            height: '10%',
            background:
              'linear-gradient(to top, rgba(0,0,0,0.08) 0%, transparent 100%)',
          }}
        />

        <div
          className="absolute"
          style={{
            zIndex: 20,
            left: '38%',
            top: '50%',
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

        <div
          className="absolute"
          style={{
            zIndex: 20,
            left: '62%',
            top: '50%',
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

        <UpperLid
          blinkProgress={blinkProgress}
          currentGaze={currentGaze}
          emotionState={emotion.name}
        />
      </div>

      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: 'calc(100vw / 2.3)',
          background: `
            linear-gradient(to bottom,
              #C81818 0%,
              #A81212 35%,
              #780A0A 70%,
              #3D0505 100%
            )
          `,
        }}
      />

      <div
        className="absolute pointer-events-none"
        style={{
          top: 'calc(100vw / 2.3 + 1.5vw)',
          left: '6%', right: '6%',
          height: '1.8vw',
          background:
            'linear-gradient(to bottom, rgba(255,175,175,0.22) 0%, transparent 100%)',
          borderRadius: '50%',
          filter: 'blur(3px)',
        }}
      />
    </div>
  );
};
