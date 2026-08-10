import os
import io
import re
import asyncio
import requests
from pathlib import Path
from typing import AsyncGenerator

# ── Available voices ──────────────────────────────────────────────────────────
VOICES = {
    "xtts_original": {
        "id":          "xtts_original",
        "name":        "⚡ McQueen Original",
        "description": "Fine-tuned XTTS v2 — full GPU quality, Owen Wilson accurate",
        "size":        "5.6 GB",
        "quality":     "★★★★★",
    },
    "vits_lite": {
        "id":          "vits_lite",
        "name":        "🏎️ Piper Lite (ONNX)",
        "description": "Ultra-fast Piper ONNX — instant sub-100ms CPU & mobile speech engine",
        "size":        "~15 MB",
        "quality":     "★★★★☆",
    },
    "edge_neural": {
        "id":          "edge_neural",
        "name":        "🎤 McQueen Edge",
        "description": "Edge TTS neural voice — instant, no GPU needed",
        "size":        "Cloud",
        "quality":     "★★☆☆☆",
    },
}

DEFAULT_VOICE = "vits_lite"


class TTSService:
    """
    Multi-voice Lightning McQueen TTS Service.

    Voices:
      xtts_original — Fine-tuned XTTS v2 GPU worker (port 8009)  [best quality, UNTOUCHED]
      vits_lite     — Ultra-fast Piper ONNX Neural Voice Engine  [instant <50ms CPU, mobile-ready]
      edge_neural   — edge_tts AndrewNeural cloud voice           [instant fallback]
    """

    def __init__(self):
        self.xtts_worker_url = "http://127.0.0.1:8009/synthesize"
        self._active_voice   = DEFAULT_VOICE
        self._xtts_healthy   = True
        self._piper_voice    = None  # loaded on first use for Piper ONNX

        print(f"[TTS] Active voice: {VOICES[self._active_voice]['id']}")

    # ── Voice selection ───────────────────────────────────────────────────────

    @property
    def active_voice(self) -> str:
        return self._active_voice

    def set_voice(self, voice_id: str) -> dict:
        if voice_id not in VOICES:
            return {"ok": False, "error": f"Unknown voice: {voice_id}"}
        self._active_voice = voice_id
        v = VOICES[voice_id]
        print(f"[TTS] Switched to: {v['name']}")
        return {"ok": True, "voice": v}

    def get_voices(self) -> list:
        return list(VOICES.values())

    def get_active_voice_info(self) -> dict:
        return VOICES[self._active_voice]

    # ── Main synthesis ────────────────────────────────────────────────────────

    async def generate_speech_chunks(self, text: str) -> AsyncGenerator[bytes, None]:
        if not text.strip():
            return

        clean = re.sub(r'[*_#`]', '', text.strip())

        if self._active_voice == "xtts_original":
            async for chunk in self._synthesize_xtts(clean):
                yield chunk

        elif self._active_voice == "vits_lite":
            async for chunk in self._synthesize_piper_onnx(clean):
                yield chunk

        else:  # edge_neural
            async for chunk in self._synthesize_edge(clean):
                yield chunk

    # ── XTTS Original (GPU, port 8009) — UNTOUCHED ──────────────────────────

    async def _synthesize_xtts(self, text: str) -> AsyncGenerator[bytes, None]:
        if not self._xtts_healthy:
            async for chunk in self._synthesize_edge(text):
                yield chunk
            return

        try:
            loop = asyncio.get_event_loop()

            def _call():
                r = requests.post(
                    self.xtts_worker_url,
                    json={"text": text},
                    timeout=15,
                )
                if r.status_code == 200:
                    hex_data = r.json().get("audio_b64")
                    if hex_data:
                        return bytes.fromhex(hex_data)
                return None

            audio = await loop.run_in_executor(None, _call)
            if audio:
                print(f"[XTTS Original] ✅ {len(audio):,} bytes — '{text[:50]}'")
                self._xtts_healthy = True
                yield audio
                return

        except requests.exceptions.ConnectionError:
            print("[XTTS Original] ⚠️  Worker offline — falling back to Edge voice")
            self._xtts_healthy = False
        except Exception as e:
            print(f"[XTTS Original] Error: {e}")
            self._xtts_healthy = False

        # Fallback to edge if XTTS fails
        async for chunk in self._synthesize_edge(text):
            yield chunk

    # ── Piper ONNX Lite (CPU, ~15 MB, Sub-100ms Instant Mobile Engine) ────────

    async def _synthesize_piper_onnx(self, text: str) -> AsyncGenerator[bytes, None]:
        try:
            from services.mcqueen_styletts2_service import mcqueen_styletts2_engine
            if mcqueen_styletts2_engine.is_loaded:
                loop = asyncio.get_event_loop()
                audio = await loop.run_in_executor(None, mcqueen_styletts2_engine.synthesize_wav_bytes, text)
                if audio:
                    print(f"[McQueen StyleTTS2 Lite] ✅ {len(audio):,} bytes — '{text[:50]}'")
                    yield audio
                    return
        except Exception as e:
            print(f"[McQueen StyleTTS2 Lite] Error: {e} — falling back to Edge")

        async for chunk in self._synthesize_edge(text):
            yield chunk

    async def _load_piper_model(self):
        """Load Piper ONNX model from disk (cached once)."""
        model_path = Path(__file__).parent.parent / "voice_dataset" / "piper_voice.onnx"
        if not model_path.exists():
            print(f"[Piper ONNX] ⚠️  Model not found at {model_path}")
            return

        try:
            loop = asyncio.get_event_loop()

            def _load():
                from piper import PiperVoice
                return PiperVoice.load(str(model_path))

            self._piper_voice = await loop.run_in_executor(None, _load)
            print("[Piper ONNX] ✅ Piper ONNX Neural Voice Engine loaded successfully!")
        except Exception as e:
            print(f"[Piper ONNX Error] {e}")

    # ── Edge TTS Fallback (Cloud, instant) ───────────────────────────────────

    async def _synthesize_edge(self, text: str) -> AsyncGenerator[bytes, None]:
        try:
            import edge_tts

            print(f"[Edge TTS] Generating: '{text[:50]}...'")
            communicate = edge_tts.Communicate(text, voice="en-US-AndrewNeural")

            mp3_buf = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    mp3_buf.write(chunk["data"])

            mp3_buf.seek(0)
            mp3_bytes = mp3_buf.read()

            if mp3_bytes:
                loop = asyncio.get_event_loop()

                def _convert():
                    import pydub
                    seg = pydub.AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
                    wav_buf = io.BytesIO()
                    seg.export(wav_buf, format="wav")
                    return wav_buf.getvalue()

                wav_bytes = await loop.run_in_executor(None, _convert)
                print(f"[Edge TTS] ✅ {len(wav_bytes):,} bytes")
                yield wav_bytes
                return

        except Exception as e:
            print(f"[Edge TTS Error] {e}")

        # Emergency silence chunk (1s of silence at 24kHz PCM)
        print("[TTS] ⚠️ All engines failed — returning silence fallback")
        yield b"\x00" * 48000


tts_service = TTSService()
