import { useState, useEffect, useCallback, useRef } from 'react';
import { useMotionValue, MotionValue } from 'framer-motion';

export type BlinkType = 'normal' | 'double' | 'sleepy' | 'half';

interface UseBlinkSystemOptions {
  enabled?: boolean;
  frequencyMultiplier?: number;
}

export interface BlinkSystemOutput {
  isBlinking: boolean;
  blinkProgress: MotionValue<number>;
  blinkType: BlinkType;
  triggerBlink: (overrideType?: BlinkType) => void;
}

export function useBlinkSystem(options: UseBlinkSystemOptions = {}): BlinkSystemOutput {
  const { enabled = true, frequencyMultiplier = 1.0 } = options;
  const [isBlinking, setIsBlinking] = useState(false);
  
  // High-performance motion value for the blink animation
  const blinkProgress = useMotionValue(0); 
  
  const [blinkType, setBlinkType] = useState<BlinkType>('normal');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBlink = useCallback((overrideType?: BlinkType) => {
    let chosenType: BlinkType = overrideType || 'normal';
    if (!overrideType) {
      const rand = Math.random();
      if (rand < 0.15) chosenType = 'double';
      else if (rand < 0.25) chosenType = 'sleepy';
      else if (rand < 0.35) chosenType = 'half';
    }

    setBlinkType(chosenType);
    setIsBlinking(true);

    let duration = 150;
    if (chosenType === 'sleepy') duration = 380;
    else if (chosenType === 'half') duration = 130;
    else duration = Math.floor(120 + Math.random() * 60);

    const targetCoverage = chosenType === 'half' ? 0.55 : 1.0;
    const startTime = performance.now();

    const animateBlink = (now: number) => {
      const elapsed = now - startTime;
      const halfDuration = duration / 2;

      if (elapsed < halfDuration) {
        const p = elapsed / halfDuration;
        blinkProgress.set(p * targetCoverage);
        requestAnimationFrame(animateBlink);
      } else if (elapsed < duration) {
        const p = 1 - (elapsed - halfDuration) / halfDuration;
        blinkProgress.set(p * targetCoverage);
        requestAnimationFrame(animateBlink);
      } else {
        blinkProgress.set(0);
        setIsBlinking(false);

        if (chosenType === 'double') {
          setTimeout(() => {
            setIsBlinking(true);
            setBlinkType('normal');
            const doubleStart = performance.now();
            const animateDouble = (dNow: number) => {
              const dElapsed = dNow - doubleStart;
              if (dElapsed < 75) {
                blinkProgress.set(dElapsed / 75);
                requestAnimationFrame(animateDouble);
              } else if (dElapsed < 150) {
                blinkProgress.set(1 - (dElapsed - 75) / 75);
                requestAnimationFrame(animateDouble);
              } else {
                blinkProgress.set(0);
                setIsBlinking(false);
              }
            };
            requestAnimationFrame(animateDouble);
          }, 60);
        }
      }
    };

    requestAnimationFrame(animateBlink);
  }, [blinkProgress]);

  useEffect(() => {
    if (!enabled) return;

    const scheduleNextBlink = () => {
      const baseInterval = (3000 + Math.random() * 5000) / frequencyMultiplier;

      timerRef.current = setTimeout(() => {
        triggerBlink();
        scheduleNextBlink();
      }, baseInterval);
    };

    scheduleNextBlink();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, frequencyMultiplier, triggerBlink]);

  return {
    isBlinking,
    blinkProgress,
    blinkType,
    triggerBlink,
  };
}
