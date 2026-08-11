import { useState, useCallback } from 'react';

export function useLocalTTS() {
  const [isReady, setIsReady] = useState(true);
  const [progressInfo, setProgressInfo] = useState<string>('');

  const initLocalTTS = useCallback(async () => {
    setIsReady(true);
    setProgressInfo('');
  }, []);

  // When backend audio streaming is enabled, speech is synthesized by the backend
  // (McQueen StyleTTS2 model) and streamed over WebSocket.
  // We do NOT play client-side WebSpeech to prevent dual overlapping "ghost" audio.
  const speakText = useCallback(
    async (_text: string, _onStart?: () => void, onEnd?: () => void) => {
      // Backend handles TTS streaming over WebSocket — client does not double-speak
      onEnd?.();
    },
    []
  );

  return { isReady, progressInfo, initLocalTTS, speakText };
}
