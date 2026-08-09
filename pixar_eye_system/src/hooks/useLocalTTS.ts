import { useState, useRef, useCallback } from 'react';
import * as tts from '@mintplex-labs/piper-tts-web';

// We intercept fetch to trick the library into downloading OUR local model
// instead of the default HuggingFace model, while keeping OPFS caching intact!
const MOCK_VOICE_ID = 'en_US-hfc_female-medium'; // Just a placeholder to pass validation
let isFetchIntercepted = false;

function setupFetchInterceptor() {
  if (isFetchIntercepted) return;
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
    
    if (url.includes('huggingface.co') && url.includes('en_US-hfc_female-medium')) {
      // Redirect to our local public folder models!
      const baseUrl = window.location.origin;
      if (url.endsWith('.json')) {
        return originalFetch(`${baseUrl}/voice/piper_voice.onnx.json`, init);
      } else {
        return originalFetch(`${baseUrl}/voice/piper_voice.onnx`, init);
      }
    }
    return originalFetch(input, init);
  };
  isFetchIntercepted = true;
}

export function useLocalTTS() {
  const [isReady, setIsReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressInfo, setProgressInfo] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);

  const initLocalTTS = useCallback(async () => {
    setupFetchInterceptor();
    setIsDownloading(true);
    setProgressInfo('Loading neural engine...');

    try {
      // Initialize Audio Context
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }

      // Pre-warm the TTS session
      await tts.TtsSession.create({
        voiceId: MOCK_VOICE_ID as tts.VoiceId,
        wasmPaths: {
          onnxWasm: window.location.origin + '/voice/wasm/',
          piperData: window.location.origin + '/voice/wasm/',
          piperWasm: window.location.origin + '/voice/wasm/'
        },
        progress: (e) => {
          if (e.total) {
            const mbLoaded = (e.loaded / 1024 / 1024).toFixed(1);
            const mbTotal = (e.total / 1024 / 1024).toFixed(1);
            setProgressInfo(`Downloading voice... ${mbLoaded}MB / ${mbTotal}MB`);
          } else {
            setProgressInfo(`Downloading voice...`);
          }
        },
        logger: console.log
      });

      setIsReady(true);
      setIsDownloading(false);
      setProgressInfo('');
    } catch (err) {
      console.error('Failed to init Local TTS:', err);
      setProgressInfo('Error loading voice model');
      setIsDownloading(false);
    }
  }, []);

  const speakText = useCallback(async (text: string, onStart?: () => void, onEnd?: () => void) => {
    if (!isReady) {
      console.warn("Local TTS not ready yet!");
      return;
    }

    try {
      const wavBlob = await tts.predict({
        text,
        voiceId: MOCK_VOICE_ID as tts.VoiceId
      });

      const arrayBuffer = await wavBlob.arrayBuffer();
      const ctx = audioContextRef.current;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      onStart?.();
      source.start();

      source.onended = () => {
        onEnd?.();
      };

    } catch (err) {
      console.error("Local TTS generation failed:", err);
    }
  }, [isReady]);

  return {
    isReady,
    isDownloading,
    progressInfo,
    initLocalTTS,
    speakText
  };
}
