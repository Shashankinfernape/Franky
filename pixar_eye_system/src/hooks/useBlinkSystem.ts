import { useState, useEffect, useCallback, useRef } from 'react';

export type BlinkType = 'normal' | 'double' | 'sleepy' | 'half';

interface UseBlinkSystemOptions {
  enabled?: boolean;
  frequencyMultiplier?: number;
}

export function useBlinkSystem(options: UseBlinkSystemOptions = {}) {
  const { enabled = true, frequencyMultiplier = 1.0 } = options;
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkProgress, setBlinkProgress] = useState(0); // 0 (open) to 1 (closed)
  const [blinkType, setBlinkType] = useState<BlinkType>('normal');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerBlink = useCallback((overrideType?: BlinkType) => {
    // Pick blink type based on probability if not overridden
    let chosenType: BlinkType = overrideType || 'normal';
    if (!overrideType) {
      const rand = Math.random();
      if (rand < 0.15) chosenType = 'double';
      else if (rand < 0.25) chosenType = 'sleepy';
      else if (rand < 0.35) chosenType = 'half';
    }

    setBlinkType(chosenType);
    setIsBlinking(true);

    // Duration mapping
    let duration = 150; // default 120-180ms
    if (chosenType === 'sleepy') duration = 380;
    else if (chosenType === 'half') duration = 130;
    else duration = Math.floor(120 + Math.random() * 60);

    const targetCoverage = chosenType === 'half' ? 0.55 : 1.0;

    // Animate blink down and up smoothly
    const startTime = performance.now();

    const animateBlink = (now: number) => {
      const elapsed = now - startTime;
      const halfDuration = duration / 2;

      if (elapsed < halfDuration) {
        // Closing phase
        const p = elapsed / halfDuration;
        setBlinkProgress(p * targetCoverage);
        requestAnimationFrame(animateBlink);
      } else if (elapsed < duration) {
        // Opening phase
        const p = 1 - (elapsed - halfDuration) / halfDuration;
        setBlinkProgress(p * targetCoverage);
        requestAnimationFrame(animateBlink);
      } else {
        setBlinkProgress(0);
        setIsBlinking(false);

        // Handle double blink
        if (chosenType === 'double') {
          setTimeout(() => {
            setIsBlinking(true);
            setBlinkType('normal');
            const doubleStart = performance.now();
            const animateDouble = (dNow: number) => {
              const dElapsed = dNow - doubleStart;
              if (dElapsed < 75) {
                setBlinkProgress(dElapsed / 75);
                requestAnimationFrame(animateDouble);
              } else if (dElapsed < 150) {
                setBlinkProgress(1 - (dElapsed - 75) / 75);
                requestAnimationFrame(animateDouble);
              } else {
                setBlinkProgress(0);
                setIsBlinking(false);
              }
            };
            requestAnimationFrame(animateDouble);
          }, 60);
        }
      }
    };

    requestAnimationFrame(animateBlink);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const scheduleNextBlink = () => {
      // Random interval between 3.0s and 8.0s, modified by frequency multiplier
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
