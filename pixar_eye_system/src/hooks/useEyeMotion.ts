import { useEffect, useRef } from 'react';
import { useMotionValue, MotionValue } from 'framer-motion';
import type { GazePoint } from '../types/eye';

interface EyeMotionOptions {
  enableMicroSaccades?: boolean;
  enableBreathing?: boolean;
  enableIdleLookAround?: boolean;
  saccadeSpeedMultiplier?: number;
}

export interface EyeMotionOutput {
  gazeX: MotionValue<number>;
  gazeY: MotionValue<number>;
  parallaxX: MotionValue<number>;
  parallaxY: MotionValue<number>;
  setGaze: (point: GazePoint, isTouch?: boolean) => void;
  releaseGaze: () => void;
}

export function useEyeMotion(options: EyeMotionOptions = {}): EyeMotionOutput {
  const {
    enableMicroSaccades = true,
    enableBreathing = true,
    enableIdleLookAround = true,
    saccadeSpeedMultiplier = 1.0,
  } = options;

  // Motion values to avoid React re-renders on every frame
  const gazeX = useMotionValue(0);
  const gazeY = useMotionValue(0);
  const parallaxX = useMotionValue(0);
  const parallaxY = useMotionValue(0);

  // Refs for animation physics loop
  const gazeRef = useRef<GazePoint>({ x: 0, y: 0 });
  const targetRef = useRef<GazePoint>({ x: 0, y: 0 });
  const microOffsetRef = useRef<GazePoint>({ x: 0, y: 0 });
  const lastUserInteractionTime = useRef<number>(Date.now());
  const isUserInteractingRef = useRef(false);
  const isTouchRef = useRef(false);

  // Micro-Saccades (Subtle physiological fixations, 1px)
  useEffect(() => {
    let saccadeTimer: ReturnType<typeof setTimeout> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSaccade = () => {
      if (!enableMicroSaccades) return;

      const delay = (2200 + Math.random() * 2500) / saccadeSpeedMultiplier;
      saccadeTimer = setTimeout(() => {
        microOffsetRef.current = {
          x: (Math.random() - 0.5) * 0.012,
          y: (Math.random() - 0.5) * 0.008,
        };
        scheduleSaccade();
      }, delay);
    };

    const scheduleIdleLook = () => {
      if (!enableIdleLookAround) return;

      idleTimer = setTimeout(() => {
        const timeSinceUser = Date.now() - lastUserInteractionTime.current;
        if (timeSinceUser > 4000) {
          isUserInteractingRef.current = false;
          isTouchRef.current = false;
          const idleTargets: GazePoint[] = [
            { x: 0.15, y: -0.05 },
            { x: -0.15, y: -0.04 },
            { x: 0.08, y: 0.08 },
            { x: -0.08, y: 0.06 },
            { x: 0, y: 0 },
          ];
          const randomPick = idleTargets[Math.floor(Math.random() * idleTargets.length)];
          targetRef.current = randomPick;
        }
        scheduleIdleLook();
      }, 4500 + Math.random() * 2500);
    };

    scheduleSaccade();
    scheduleIdleLook();

    return () => {
      if (saccadeTimer) clearTimeout(saccadeTimer);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [enableMicroSaccades, enableIdleLookAround, saccadeSpeedMultiplier]);

  // 60 FPS Silky Smooth Pixar Glides Engine (tau = 0.085s)
  useEffect(() => {
    let animFrameId: number;
    let lastFrameTime = performance.now();

    const updatePhysics = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      // Breathing Rhythm (0.2 Hz sinusoidal drift)
      const breathingY = enableBreathing ? Math.sin(now * 0.0015) * 0.004 : 0;
      const breathingX = enableBreathing ? Math.cos(now * 0.0008) * 0.002 : 0;

      // Desired target + micro offsets + breathing
      const finalTargetX = (targetRef.current.x || 0) + microOffsetRef.current.x + breathingX;
      const finalTargetY = (targetRef.current.y || 0) + microOffsetRef.current.y + breathingY;

      if (isUserInteractingRef.current && isTouchRef.current) {
        // Direct touch tracking (Instant)
        gazeRef.current.x = finalTargetX;
        gazeRef.current.y = finalTargetY;
      } else {
        // Silky smooth, organic exponential filter (tau = 85ms)
        const smoothFactor = 1.0 - Math.exp(-dt / 0.085);
        gazeRef.current.x += (finalTargetX - gazeRef.current.x) * smoothFactor;
        gazeRef.current.y += (finalTargetY - gazeRef.current.y) * smoothFactor;
      }

      // NaN Guard
      if (isNaN(gazeRef.current.x)) gazeRef.current.x = 0;
      if (isNaN(gazeRef.current.y)) gazeRef.current.y = 0;

      // Parallax Highlight calculation
      const pX = -gazeRef.current.x * 6;
      const pY = -gazeRef.current.y * 4;

      // Direct write to Framer Motion values
      gazeX.set(gazeRef.current.x);
      gazeY.set(gazeRef.current.y);
      parallaxX.set(pX);
      parallaxY.set(pY);

      animFrameId = requestAnimationFrame(updatePhysics);
    };

    animFrameId = requestAnimationFrame(updatePhysics);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [enableBreathing, gazeX, gazeY, parallaxX, parallaxY]);

  // Set user gaze target explicitly (clamped -1 to 1)
  const setGaze = (point: GazePoint, isTouch: boolean = true) => {
    const clampedX = Math.max(-1, Math.min(1, isNaN(point.x) ? 0 : point.x));
    const clampedY = Math.max(-1, Math.min(1, isNaN(point.y) ? 0 : point.y));

    targetRef.current = { x: clampedX, y: clampedY };
    isUserInteractingRef.current = true;
    isTouchRef.current = isTouch;
    lastUserInteractionTime.current = Date.now();
  };

  const releaseGaze = () => {
    isUserInteractingRef.current = false;
    lastUserInteractionTime.current = Date.now();
  };

  return {
    gazeX,
    gazeY,
    parallaxX,
    parallaxY,
    setGaze,
    releaseGaze,
  };
}
