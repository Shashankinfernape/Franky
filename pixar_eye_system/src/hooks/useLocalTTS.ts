import { useState, useCallback, useRef } from 'react';
import { TtsSession } from '@mintplex-labs/piper-tts-web';

// Intercept fetch to reroute 'mcqueen' voice requests to our local /models/ directory
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
  if (url.includes('diffusionstudio/piper-voices') && url.includes('/mcqueen/')) {
    if (url.endsWith('.onnx')) {
      return originalFetch('/models/mcqueen.onnx', init);
    } else if (url.endsWith('.json')) {
      return originalFetch('/models/mcqueen.onnx.json', init);
    }
  }
  return originalFetch(input, init);
};

export function useLocalTTS() {
  const [isReady, setIsReady] = useState(false);
  const [progressInfo, setProgressInfo] = useState<string>('');
  const sessionRef = useRef<TtsSession | null>(null);

  const initLocalTTS = useCallback(async () => {
    try {
      setProgressInfo('Loading voice model (60MB)...');
      
      const session = await TtsSession.create({
        voiceId: 'mcqueen',
        progress: (p) => {
          setProgressInfo(`Downloading: ${Math.round((p.loaded / p.total) * 100)}%`);
        },
        logger: (msg) => console.log('[PiperTTS]', msg)
      });
      
      await session.init();
      sessionRef.current = session;
      setIsReady(true);
      setProgressInfo('');
    } catch (err) {
      console.error('Failed to init local TTS:', err);
      setProgressInfo('Failed to load voice model.');
    }
  }, []);

  const speakText = useCallback(
    async (text: string, onStart?: () => void, onEnd?: () => void) => {
      if (!sessionRef.current) {
        onEnd?.();
        return;
      }
      
      try {
        const audioBlob = await sessionRef.current.predict(text);
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        
        audio.onplay = () => onStart?.();
        audio.onended = () => {
          URL.revokeObjectURL(url);
          onEnd?.();
        };
        
        audio.play();
      } catch (err) {
        console.error('TTS error:', err);
        onEnd?.();
      }
    },
    []
  );

  return { isReady, progressInfo, initLocalTTS, speakText };
}
