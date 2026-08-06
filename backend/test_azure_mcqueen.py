import asyncio
import io
import edge_tts
import soundfile as sf
import numpy as np
from pathlib import Path

async def test_azure_mcqueen():
    text = "Kachow! I am Lightning McQueen! Faster than fast, quicker than quick. I am speed!"
    
    # Microsoft Azure Studio HD Neural Male Voice tuned to Owen Wilson's Lightning McQueen pitch
    voice = "en-US-GuyNeural"
    rate = "+5%"
    pitch = "+8Hz"

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])

    buf.seek(0)
    out_path = Path(__file__).parent / "voice_dataset" / "test_azure_mcqueen.mp3"
    with open(out_path, "wb") as f:
        f.write(buf.getvalue())

    print(f"Generated {len(buf.getvalue())} bytes of HD Studio Azure McQueen voice at {out_path.name}!")

if __name__ == "__main__":
    asyncio.run(test_azure_mcqueen())
