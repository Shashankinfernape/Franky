import asyncio
from services.tts_service import tts_service

async def main():
    print("Testing Piper ONNX TTS service...")
    async for chunk in tts_service.generate_speech_chunks("Kachow! Speed, I am speed!"):
        print(f"Generated WAV audio size: {len(chunk)} bytes")

if __name__ == "__main__":
    asyncio.run(main())
