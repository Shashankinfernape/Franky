import { useState, useEffect, useRef } from 'react';
import type { GazePoint } from '../types/eye';

interface EyeMotionOptions {
  enableMicroSaccades?: boolean;
  enableBreathing?: boolean;
  enableIdleLookAround?: boolean;
  saccadeSpeedMultiplier?: number;
}

export function useEyeMotion(options: EyeMotionOptions = {}) {
  const {
    enableMicroSaccades = true,
    enableBreathing = true,
    enableIdleLookAround = true,
    saccadeSpeedMultiplier = 1.0,
  } = options;

  // Base target set by user / tracking (range -1 to 1)
  const [targetGaze, setTargetGaze] = useState<GazePoint>({ x: 0, y: 0 });
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // Computed smooth gaze after spring physics & micro motions
  const [currentGaze, setCurrentGaze] = useState<GazePoint>({ x: 0, y: 0 });

  // Glass Parallax offset (opposite to gaze direction)
  const [parallaxOffset, setParallaxOffset] = useState<GazePoint>({ x: 0, y: 0 });

  // Refs for animation physics loop
  const gazeRef = useRef<GazePoint>({ x: 0, y: 0 });
  const velocityRef = useRef<GazePoint>({ x: 0, y: 0 });
  const targetRef = useRef<GazePoint>({ x: 0, y: 0 });
  const microOffsetRef = useRef<GazePoint>({ x: 0, y: 0 });
  const lastUserInteractionTime = useRef<number>(Date.now());

  // Keep targetRef synced with targetGaze
  useEffect(() => {
    targetRef.current = targetGaze;
  }, [targetGaze]);

  // Micro-Saccades & Idle Lookaround Generator (Movie Accurate: 1-3 pixels amplitude ONLY!)
  useEffect(() => {
    let saccadeTimer: ReturnType<typeof setTimeout> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    // Pixar micro drift generator (1-3px tiny calm drift)
    const scheduleSaccade = () => {
      if (!enableMicroSaccades) return;

      const delay = (2000 + Math.random() * 2500) / saccadeSpeedMultiplier;
      saccadeTimer = setTimeout(() => {
        // Subtle offset range -0.02 to +0.02 (translates to 1-3 pixels max!)
        microOffsetRef.current = {
          x: (Math.random() - 0.5) * 0.03,
          y: (Math.random() - 0.5) * 0.02,
        };
        scheduleSaccade();
      }, delay);
    };

    // Idle look-around sequence (when user hasn't interacted for 4 seconds)
    const scheduleIdleLook = () => {
      if (!enableIdleLookAround) return;

      idleTimer = setTimeout(() => {
        const timeSinceUser = Date.now() - lastUserInteractionTime.current;
        if (timeSinceUser > 4000) {
          // Pixar calm gaze pattern: slight look side, pause, return
          const idleTargets: GazePoint[] = [
            { x: 0.25, y: -0.08 },
            { x: -0.3, y: -0.05 },
            { x: 0.1, y: 0.18 },
            { x: -0.15, y: 0.12 },
            { x: 0, y: 0 },
          ];
          const randomPick = idleTargets[Math.floor(Math.random() * idleTargets.length)];
          setTargetGaze(randomPick);
        }
        scheduleIdleLook();
      }, 4500 + Math.random() * 3000);
    };

    scheduleSaccade();
    scheduleIdleLook();

    return () => {
      if (saccadeTimer) clearTimeout(saccadeTimer);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [enableMicroSaccades, enableIdleLookAround, saccadeSpeedMultiplier]);

  // 60 FPS Organic Spring Physics Engine Loop
  useEffect(() => {
    let animFrameId: number;
    const startTime = performance.now();

    const updatePhysics = (now: number) => {
      const elapsedSec = (now - startTime) / 1000;

      // Pixar Breathing Rhythm (Slow 0.2 Hz sinusoidal drift)
      const breathingY = enableBreathing ? Math.sin(elapsedSec * 1.2) * 0.008 : 0;
      const breathingX = enableBreathing ? Math.cos(elapsedSec * 0.6) * 0.004 : 0;

      // Desired target + micro offsets + breathing
      const finalTargetX = targetRef.current.x + microOffsetRef.current.x + breathingX;
      const finalTargetY = targetRef.current.y + microOffsetRef.current.y + breathingY;

      // Spring dynamics parameters (Snappy Pixar eye darts)
      const stiffness = 380;
      const damping = 28;
      const dt = 1 / 60;

      // Spring force
      const forceX = (finalTargetX - gazeRef.current.x) * stiffness;
      const forceY = (finalTargetY - gazeRef.current.y) * stiffness;

      // Update velocity with damping
      velocityRef.current.x = (velocityRef.current.x + forceX * dt) * (1 - damping * dt);
      velocityRef.current.y = (velocityRef.current.y + forceY * dt) * (1 - damping * dt);

      // Update position
      gazeRef.current.x += velocityRef.current.x * dt;
      gazeRef.current.y += velocityRef.current.y * dt;

      // Glass Parallax Highlight calculation: moves OPPOSITE to gaze direction
      const parallaxX = -gazeRef.current.x * 12;
      const parallaxY = -gazeRef.current.y * 8;

      setCurrentGaze({ x: gazeRef.current.x, y: gazeRef.current.y });
      setParallaxOffset({ x: parallaxX, y: parallaxY });

      animFrameId = requestAnimationFrame(updatePhysics);
    };

    animFrameId = requestAnimationFrame(updatePhysics);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [enableBreathing]);

  // Set user gaze target explicitly (clamped -1 to 1)
  const setGaze = (point: GazePoint) => {
    const clampedX = Math.max(-1, Math.min(1, point.x));
    const clampedY = Math.max(-1, Math.min(1, point.y));

    setTargetGaze({ x: clampedX, y: clampedY });
    setIsUserInteracting(true);
    lastUserInteractionTime.current = Date.now();
  };

  return {
    currentGaze,
    targetGaze,
    parallaxOffset,
    setGaze,
    isUserInteracting,
  };
}
