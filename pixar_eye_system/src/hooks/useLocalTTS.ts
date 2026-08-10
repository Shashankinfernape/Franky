import { useState, useCallback, useRef } from 'react';

// ─── Web Speech API TTS (Fallback if ONNX fails) ─────────────────────────

function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function speakWebSpeech(
  text: string,
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (!hasSpeechSynthesis()) return false;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find(v => v.lang.startsWith('en'));
  if (englishVoice) utterance.voice = englishVoice;

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = (e) => {
    console.warn('[WebSpeech] Error:', e.error);
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
  return true;
}

// ─── Piper / McQueen ONNX Neural TTS Engine (Primary) ─────────────────────

const MOCK_VOICE_ID = 'en_US-hfc_female-medium';
let piperInitPromise: Promise<boolean> | null = null;
let isFetchPatched = false;

function patchFetchForLocalModel() {
  if (isFetchPatched) return;
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof Request
        ? input.url
        : input.toString();

    // Redirect HuggingFace model requests to our local McQueen ONNX model
    if (url.includes('huggingface.co') || url.includes(MOCK_VOICE_ID)) {
      const base = window.location.origin;
      if (url.endsWith('.json')) {
        console.log('[TTS Patch] Redirecting .json to local McQueen config');
        return originalFetch(`${base}/voice/piper_voice.onnx.json`, init);
      } else if (url.endsWith('.onnx')) {
        console.log('[TTS Patch] Redirecting .onnx to local McQueen ONNX model');
        return originalFetch(`${base}/voice/piper_voice.onnx`, init);
      }
    }
    return originalFetch(input, init);
  };
  isFetchPatched = true;
}

async function initPiper(): Promise<boolean> {
  try {
    patchFetchForLocalModel();
    const tts = await import('@mintplex-labs/piper-tts-web');
    const base = window.location.origin + '/voice/wasm/';
    const session = await tts.TtsSession.create({
      voiceId: MOCK_VOICE_ID as any,
      wasmPaths: {
        onnxWasm: base,
        piperData: base + 'piper_phonemize.data',
        piperWasm: base + 'piper_phonemize.wasm',
      },
    });
    console.log('[Piper TTS] McQueen Neural Engine Ready!', session ? 'ok' : 'null');
    return true;
  } catch (e) {
    console.error('[Piper TTS] Init failed:', e);
    return false;
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useLocalTTS() {
  const [isReady, setIsReady] = useState(false);
  const [progressInfo, setProgressInfo] = useState<string>('');
  const engineRef = useRef<'piper' | 'webspeech' | null>(null);

  const initLocalTTS = useCallback(async () => {
    // 1. Try McQueen Piper ONNX Neural engine first
    setProgressInfo('Loading McQueen neural voice...');
    if (!piperInitPromise) {
      piperInitPromise = initPiper();
    }
    const ok = await piperInitPromise;
    if (ok) {
      console.log('[TTS] McQueen ONNX Engine loaded!');
      engineRef.current = 'piper';
      setIsReady(true);
      setProgressInfo('');
      return;
    }

    // 2. Fall back to Web Speech API if ONNX fails
    if (hasSpeechSynthesis()) {
      console.log('[TTS] Falling back to Web Speech API');
      engineRef.current = 'webspeech';
      setIsReady(true);
      setProgressInfo('');
    } else {
      setProgressInfo('Error loading voice model');
    }
  }, []);

  const speakText = useCallback(
    async (text: string, onStart?: () => void, onEnd?: () => void) => {
      if (!isReady || !engineRef.current) {
        console.warn('[TTS] Not ready yet');
        return;
      }

      if (engineRef.current === 'piper') {
        try {
          const tts = await import('@mintplex-labs/piper-tts-web');
          const wavBlob = await tts.predict({
            text,
            voiceId: MOCK_VOICE_ID as any,
          });
          const arrayBuffer = await wavBlob.arrayBuffer();

          const AudioCtx =
            window.AudioContext ||
            (window as any).webkitAudioContext;
          const ctx = new AudioCtx();

          if (ctx.state === 'suspended') await ctx.resume();

          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          onStart?.();
          source.start();
          source.onended = () => {
            onEnd?.();
            ctx.close();
          };
          return;
        } catch (err) {
          console.error('[Piper TTS] predict failed, using WebSpeech fallback:', err);
        }
      }

      // WebSpeech fallback
      const started = speakWebSpeech(text, onStart, onEnd);
      if (!started) {
        onEnd?.();
      }
    },
    [isReady]
  );

  return { isReady, progressInfo, initLocalTTS, speakText };
}
