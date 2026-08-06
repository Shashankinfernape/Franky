import asyncio
from services.tts_service import tts_service

async def main():
    print("Testing TTS generation...")
    async for chunk in tts_service.generate_speech_chunks("Hello I am Emiot"):
        print(f"Generated chunk size: {len(chunk)} bytes")

if __name__ == "__main__":
    asyncio.run(main())
