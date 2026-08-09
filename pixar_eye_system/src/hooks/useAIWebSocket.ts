import { useState, useEffect, useRef, useCallback } from 'react';
import type { EmotionalState } from '../types/eye';

interface AIWebSocketOptions {
  onEmotionChange: (emotion: EmotionalState) => void;
  onTextChunk: (token: string, emotion: EmotionalState) => void;
  onStreamEnd: () => void;
  onWordSync: (wordIndex: number) => void;
  totalWordsRef: React.MutableRefObject<number>;
}

export function useAIWebSocket({
  onEmotionChange,
  onTextChunk,
  onStreamEnd,
  onWordSync,
  totalWordsRef,
}: AIWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Stable callback refs to avoid effect re-subscriptions
  const callbacksRef = useRef({ onEmotionChange, onTextChunk, onStreamEnd, onWordSync });
  callbacksRef.current = { onEmotionChange, onTextChunk, onStreamEnd, onWordSync };

  // Audio scheduling & animation refs
  const nextAudioTimeRef = useRef<number>(0);
  const audioStartTimeRef = useRef<number>(0);
  const totalAudioDurRef = useRef<number>(0);
  const isFirstChunkRef = useRef<boolean>(true);
  const syncRafRef = useRef<number | null>(null);

  // Initialize Web Audio Context
  useEffect(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    } catch {
      console.warn('[Emiot] Web Audio API not supported.');
    }
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Word-sync animation loop (syncs highlighted word to audioContext.currentTime)
  const startSyncLoop = useCallback(() => {
    if (syncRafRef.current) cancelAnimationFrame(syncRafRef.current);

    const loop = () => {
      const ctx = audioContextRef.current;
      if (!ctx) return;

      const elapsed = ctx.currentTime - audioStartTimeRef.current;
      const totalDur = totalAudioDurRef.current;
      const totalWords = totalWordsRef.current;

      if (totalDur > 0 && totalWords > 0 && elapsed >= 0) {
        const fraction = Math.min(elapsed / totalDur, 1.0);
        const wordIdx = Math.min(Math.floor(fraction * totalWords), totalWords - 1);
        callbacksRef.current.onWordSync(wordIdx);

        if (elapsed < totalDur + 0.3) {
          syncRafRef.current = requestAnimationFrame(loop);
        } else {
          // Audio playback complete - show full text
          callbacksRef.current.onWordSync(totalWords - 1);
          syncRafRef.current = null;
        }
      } else {
        // Audio scheduled but not playing yet - keep polling
        syncRafRef.current = requestAnimationFrame(loop);
      }
    };

    syncRafRef.current = requestAnimationFrame(loop);
  }, [totalWordsRef]);

  // Reset audio playback state
  const resetAudio = useCallback(() => {
    if (syncRafRef.current) {
      cancelAnimationFrame(syncRafRef.current);
      syncRafRef.current = null;
    }
    isFirstChunkRef.current = true;
    totalAudioDurRef.current = 0;
    nextAudioTimeRef.current = 0;
    audioStartTimeRef.current = 0;
  }, []);

  // WebSocket Connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const wsUrl = isLocal 
          ? 'ws://localhost:5050/ws/emiot'
          : 'wss://emiot-backend.onrender.com/ws/emiot';
          
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[Emiot AI] Connected to WebSocket backend on port 8008');
          setIsConnected(true);
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data as string);
            const msgType = data.type as string;

            if (msgType === 'emotion_tag' && data.emotion) {
              callbacksRef.current.onEmotionChange(data.emotion as EmotionalState);
            } else if (msgType === 'text_chunk' && data.text) {
              callbacksRef.current.onTextChunk(
                data.text as string,
                (data.emotion || 'talking') as EmotionalState
              );
            } else if (msgType === 'stream_end') {
              callbacksRef.current.onStreamEnd();
            } else if (msgType === 'audio_chunk' && data.audio_b64) {
              const ctx = audioContextRef.current;
              if (!ctx) return;

              if (ctx.state === 'suspended') {
                await ctx.resume();
              }

              try {
                const raw = atob(data.audio_b64 as string);
                const bytes = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) {
                  bytes[i] = raw.charCodeAt(i);
                }

                const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

                if (isFirstChunkRef.current) {
                  nextAudioTimeRef.current = ctx.currentTime + 0.05;
                  audioStartTimeRef.current = nextAudioTimeRef.current;
                  isFirstChunkRef.current = false;
                  startSyncLoop();
                }

                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.start(nextAudioTimeRef.current);

                nextAudioTimeRef.current += buffer.duration;
                totalAudioDurRef.current += buffer.duration;
              } catch (err) {
                console.warn('[Emiot] Audio decode error:', err);
              }
            }
          } catch (e) {
            console.warn('[Emiot AI] JSON parse error:', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 5000);
        };

        ws.onerror = () => setIsConnected(false);
      } catch {
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (syncRafRef.current) cancelAnimationFrame(syncRafRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [startSyncLoop]);

  // Send Speech Action
  const sendSpeechToAI = useCallback(
    (userText: string) => {
      resetAudio();
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'user_speech', text: userText }));
        return true;
      }
      return false;
    },
    [resetAudio]
  );

  // Send any raw JSON message to backend (e.g. set_voice, get_voices)
  const sendRawMessage = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  return { isConnected, sendSpeechToAI, sendRawMessage };
}
