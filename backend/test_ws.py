import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8008/ws/emiot"
    async with websockets.connect(uri) as ws:
        print("Connected to Emiot WebSocket!")
        await ws.send(json.dumps({
            "type": "user_speech",
            "text": "Who is Walter White?"
        }))
        
        while True:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                data = json.loads(msg)
                msg_type = data.get("type")
                if msg_type == "synced_sentence":
                    print(f"\nSynced Sentence: '{data.get('text')}' | Audio: {len(data.get('audio_b64', ''))} b64 chars | Emotion: {data.get('emotion')}")
                elif msg_type == "text_chunk":
                    print(f"Token: '{data.get('text')}' (Emotion: {data.get('emotion')})", end=" ", flush=True)

                elif msg_type == "audio_chunk":
                    print(f"\nReceived Audio Chunk ({len(data.get('audio_b64', ''))} b64 chars)")

                elif msg_type == "stream_end":
                    print("\nStream Finished Success!")
                    break
            except asyncio.TimeoutError:
                print("\nTimeout waiting for msg")
                break

if __name__ == "__main__":
    asyncio.run(test())
