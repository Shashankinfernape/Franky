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
  const velocityRef = useRef<GazePoint>({ x: 0, y: 0 });
  const targetRef = useRef<GazePoint>({ x: 0, y: 0 });
  const microOffsetRef = useRef<GazePoint>({ x: 0, y: 0 });
  const lastUserInteractionTime = useRef<number>(Date.now());
  const isUserInteractingRef = useRef(false);
  const isTouchRef = useRef(false);

  // Micro-Saccades & Idle Lookaround Generator (Calm, 1-2px gentle drift)
  useEffect(() => {
    let saccadeTimer: ReturnType<typeof setTimeout> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSaccade = () => {
      if (!enableMicroSaccades) return;

      const delay = (2500 + Math.random() * 3000) / saccadeSpeedMultiplier;
      saccadeTimer = setTimeout(() => {
        // Ultra-subtle micro fixation drift (max 0.015)
        microOffsetRef.current = {
          x: (Math.random() - 0.5) * 0.015,
          y: (Math.random() - 0.5) * 0.010,
        };
        scheduleSaccade();
      }, delay);
    };

    const scheduleIdleLook = () => {
      if (!enableIdleLookAround) return;

      idleTimer = setTimeout(() => {
        const timeSinceUser = Date.now() - lastUserInteractionTime.current;
        if (timeSinceUser > 5000) {
          isUserInteractingRef.current = false;
          isTouchRef.current = false;
          const idleTargets: GazePoint[] = [
            { x: 0.15, y: -0.05 },
            { x: -0.15, y: -0.04 },
            { x: 0.08, y: 0.10 },
            { x: -0.08, y: 0.08 },
            { x: 0, y: 0 },
          ];
          const randomPick = idleTargets[Math.floor(Math.random() * idleTargets.length)];
          targetRef.current = randomPick;
        }
        scheduleIdleLook();
      }, 5000 + Math.random() * 3000);
    };

    scheduleSaccade();
    scheduleIdleLook();

    return () => {
      if (saccadeTimer) clearTimeout(saccadeTimer);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [enableMicroSaccades, enableIdleLookAround, saccadeSpeedMultiplier]);

  // 60 FPS Cinematic Slow-Glide Physics Loop
  useEffect(() => {
    let animFrameId: number;
    let lastFrameTime = performance.now();

    const updatePhysics = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      // Organic Breathing Rhythm (0.2 Hz sinusoidal drift)
      const breathingY = enableBreathing ? Math.sin(now * 0.0012) * 0.006 : 0;
      const breathingX = enableBreathing ? Math.cos(now * 0.0006) * 0.003 : 0;

      // Desired target + micro offsets + breathing
      const finalTargetX = targetRef.current.x + microOffsetRef.current.x + breathingX;
      const finalTargetY = targetRef.current.y + microOffsetRef.current.y + breathingY;

      if (isUserInteractingRef.current && isTouchRef.current) {
        // Direct touch tracking
        gazeRef.current.x = finalTargetX;
        gazeRef.current.y = finalTargetY;
        velocityRef.current.x = 0;
        velocityRef.current.y = 0;
      } else {
        // Cinematic Critically-Damped Spring Dynamics (Slow, weighted, organic eye glides)
        const stiffness = 85.0; // Gentle spring pull
        const damping = 18.5; // High damping: eliminates twitching, snapping, and overshoot

        // Spring acceleration
        const forceX = (finalTargetX - gazeRef.current.x) * stiffness;
        const forceY = (finalTargetY - gazeRef.current.y) * stiffness;

        // Velocity integration
        velocityRef.current.x += forceX * dt;
        velocityRef.current.y += forceY * dt;

        // Apply viscous drag
        velocityRef.current.x *= Math.max(0, 1 - damping * dt);
        velocityRef.current.y *= Math.max(0, 1 - damping * dt);

        // Velocity speed cap (Prevents wild snapping across screen)
        const maxSpeed = 1.6; // units per second
        const currentSpeed = Math.sqrt(
          velocityRef.current.x * velocityRef.current.x +
          velocityRef.current.y * velocityRef.current.y
        );
        if (currentSpeed > maxSpeed) {
          const scale = maxSpeed / currentSpeed;
          velocityRef.current.x *= scale;
          velocityRef.current.y *= scale;
        }

        // Position integration
        gazeRef.current.x += velocityRef.current.x * dt;
        gazeRef.current.y += velocityRef.current.y * dt;
      }

      // Parallax Highlight calculation
      const pX = -gazeRef.current.x * 8;
      const pY = -gazeRef.current.y * 5;

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
    const clampedX = Math.max(-1, Math.min(1, point.x));
    const clampedY = Math.max(-1, Math.min(1, point.y));

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
