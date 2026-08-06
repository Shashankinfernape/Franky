import os
import io
import re
import asyncio
import requests
from typing import AsyncGenerator

class TTSService:
    """
    Primary: Fine-tuned McQueen XTTS v2 GPU worker on port 8009.
    Fallback: edge_tts AndrewNeural (instant, used only if XTTS worker is down).

    The XTTS worker must be started separately:
        .\\venv_coqui\\Scripts\\python.exe xtts_server.py
    It takes ~30-60s to boot (model loading to VRAM).
    Once warm, synthesis latency is ~1-2s per sentence on GPU.
    """
    def __init__(self):
        self.worker_url = "http://127.0.0.1:8009/synthesize"
        self._xtts_healthy = True   # assume healthy until first failure
        print("[TTS] McQueen XTTS Worker target: http://127.0.0.1:8009")

    async def generate_speech_chunks(self, text: str) -> AsyncGenerator[bytes, None]:
        if not text.strip():
            return

        clean_text = re.sub(r'[*_#`]', '', text.strip())

        # ── 1. Fine-tuned McQueen XTTS Worker ────────────────────────────────
        if self._xtts_healthy:
            try:
                loop = asyncio.get_event_loop()

                def _call_worker():
                    r = requests.post(
                        self.worker_url,
                        json={"text": clean_text},
                        timeout=15,   # XTTS GPU inference takes 1-3s per sentence
                    )
                    if r.status_code == 200:
                        hex_data = r.json().get("audio_b64")
                        if hex_data:
                            return bytes.fromhex(hex_data)
                    return None

                audio_bytes = await loop.run_in_executor(None, _call_worker)

                if audio_bytes:
                    print(f"[McQueen XTTS] ✅ {len(audio_bytes)} bytes — '{clean_text[:50]}'")
                    self._xtts_healthy = True
                    yield audio_bytes
                    return

            except requests.exceptions.ConnectionError:
                # Worker not running — mark unhealthy so we stop retrying
                print("[McQueen XTTS] ⚠️  Worker offline — using edge_tts fallback")
                self._xtts_healthy = False
            except Exception as e:
                print(f"[McQueen XTTS] Error: {e} — falling back to edge_tts")
                self._xtts_healthy = False

        # ── 2. Fast edge_tts fallback (AndrewNeural) ─────────────────────────
        try:
            import edge_tts
            communicate = edge_tts.Communicate(
                clean_text,
                voice="en-US-AndrewNeural",
                rate="+12%",
                pitch="+4Hz",
                volume="+10%",
            )
            buf = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            audio_bytes = buf.getvalue()
            if audio_bytes:
                print(f"[edge_tts fallback] {len(audio_bytes)} bytes — '{clean_text[:50]}'")
                yield audio_bytes
        except Exception as e:
            print(f"[TTS Fallback Error] {e}")

    def mark_xtts_healthy(self):
        """Call this when XTTS worker comes back online."""
        self._xtts_healthy = True
        print("[TTS] XTTS worker marked healthy — switching back to McQueen voice")

tts_service = TTSService()
