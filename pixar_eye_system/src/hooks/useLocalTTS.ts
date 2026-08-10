import { useState, useCallback, useRef } from 'react';

// ─── Web Speech API TTS (Primary — built into Android WebView, zero downloads) ───

function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function speakWebSpeech(
  text: string,
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (!hasSpeechSynthesis()) return false;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to pick an English voice
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

// ─── Piper TTS (Secondary fallback via piper-tts-web WASM) ─────────────────

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

    // Redirect HuggingFace model requests to local files
    if (url.includes('huggingface.co') || url.includes(MOCK_VOICE_ID)) {
      const base = window.location.origin;
      if (url.endsWith('.json')) {
        console.log('[TTS Patch] Redirecting .json to local');
        return originalFetch(`${base}/voice/piper_voice.onnx.json`, init);
      } else if (url.endsWith('.onnx')) {
        console.log('[TTS Patch] Redirecting .onnx to local');
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
    piperSession = await tts.TtsSession.create({
      voiceId: MOCK_VOICE_ID as any,
      wasmPaths: {
        onnxWasm: base,
        piperData: base + 'piper_phonemize.data',
        piperWasm: base + 'piper_phonemize.wasm',
      },
    });
    console.log('[Piper TTS] Session ready!');
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
  const engineRef = useRef<'webspeech' | 'piper' | null>(null);

  const initLocalTTS = useCallback(async () => {
    // 1. Try Web Speech API first — instant, no downloads
    if (hasSpeechSynthesis()) {
      console.log('[TTS] Web Speech API available — ready instantly!');
      engineRef.current = 'webspeech';
      setIsReady(true);
      setProgressInfo('');
      return;
    }

    // 2. Fall back to Piper WASM
    setProgressInfo('Loading neural voice engine...');
    if (!piperInitPromise) {
      piperInitPromise = initPiper();
    }
    const ok = await piperInitPromise;
    if (ok) {
      engineRef.current = 'piper';
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

      if (engineRef.current === 'webspeech') {
        const started = speakWebSpeech(text, onStart, onEnd);
        if (!started) {
          console.warn('[TTS] Web Speech failed, nothing to fall back to');
          onEnd?.();
        }
        return;
      }

      // Piper path
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
      } catch (err) {
        console.error('[Piper TTS] predict failed:', err);
        onEnd?.();
      }
    },
    [isReady]
  );

  return { isReady, progressInfo, initLocalTTS, speakText };
}
