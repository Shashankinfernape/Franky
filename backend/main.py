import sys, io
# Force UTF-8 output on Windows — prevents charmap crash on smart quotes from LLM
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import json
import base64
import asyncio
import re
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.websockets import WebSocketState
from services.personality_service import personality_engine
from services.llm_service import llm_service
from services.tts_service import tts_service

app = FastAPI(title="Emiot Core AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Serve frontend dist if it exists
DIST_DIR = Path(__file__).parent / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")
    if (DIST_DIR / "voice").exists():
        app.mount("/voice", StaticFiles(directory=str(DIST_DIR / "voice")), name="voice")

    @app.get("/")
    def serve_index():
        return FileResponse(str(DIST_DIR / "index.html"))

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "Emiot AI Companion Core",
        "xtts_healthy": tts_service._xtts_healthy,
    }

@app.get("/reset-tts")
def reset_tts():
    """Re-enable XTTS worker after it comes back online."""
    tts_service.mark_xtts_healthy()
    return {"status": "XTTS re-enabled", "xtts_healthy": True}

@app.websocket("/ws/emiot")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("[Emiot] Client connected to WebSocket endpoint")

    try:
        # Send initial state snapshot to client
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({
                "type": "personality_state",
                "state": personality_engine.get_state_payload()
            })

        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
                msg_type = data.get("type")

                if msg_type == "user_speech":
                    user_text = data.get("text", "").strip()
                    if not user_text:
                        continue

                    print(f"[User Input Received] '{user_text}'")

                    # 1. Immediate Thinking State Transition
                    personality_engine.on_user_speech()
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({
                            "type": "emotion_tag",
                            "emotion": "thinking"
                        })

                    # 2. Real-Time Split-Second Sentence Pipelining
                    state = personality_engine.get_state_payload()
                    full_text = ""
                    sentence_buffer = ""
                    first_token = True
                    target_emotion = "excited"

                    async for emotion_tag, token in llm_service.generate_response_stream(user_text, state):
                        if first_token and emotion_tag:
                            target_emotion = emotion_tag
                            if websocket.client_state == WebSocketState.CONNECTED:
                                await websocket.send_json({
                                    "type": "emotion_tag",
                                    "emotion": target_emotion
                                })
                            first_token = False

                        if token:
                            full_text += token
                            sentence_buffer += token

                            # Send text chunk to UI
                            if websocket.client_state == WebSocketState.CONNECTED:
                                await websocket.send_json({
                                    "type": "text_chunk",
                                    "text": token,
                                    "emotion": target_emotion
                                })

                            # Check for sentence end boundary (. ! ? \n)
                            if re.search(r'[.!?\n]', token):
                                sentence_to_speak = sentence_buffer.strip()
                                sentence_buffer = ""
                                if sentence_to_speak:
                                    async for chunk in tts_service.generate_speech_chunks(sentence_to_speak):
                                        if chunk and websocket.client_state == WebSocketState.CONNECTED:
                                            b64_audio = base64.b64encode(chunk).decode('utf-8')
                                            await websocket.send_json({
                                                "type": "audio_chunk",
                                                "audio_b64": b64_audio
                                            })

                    # Render any remaining text in sentence buffer
                    remaining_sentence = sentence_buffer.strip()
                    if remaining_sentence:
                        async for chunk in tts_service.generate_speech_chunks(remaining_sentence):
                            if chunk and websocket.client_state == WebSocketState.CONNECTED:
                                b64_audio = base64.b64encode(chunk).decode('utf-8')
                                await websocket.send_json({
                                    "type": "audio_chunk",
                                    "audio_b64": b64_audio
                                })

                    full_text = full_text.strip()
                    print(f"[Groq Answer Stream Complete] '{full_text}' (Emotion: {target_emotion})")

                    # Send completion signal & updated personality
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({
                            "type": "stream_end",
                            "personality": personality_engine.get_state_payload()
                        })

                elif msg_type == "perceptual_update":
                    audio_level = data.get("audio_level", 0.0)
                    face_detected = data.get("face_detected", False)
                    motion_x = data.get("motion_x", 0.0)
                    motion_y = data.get("motion_y", 0.0)

                    personality_engine.process_perceptual_frame(
                        audio_level=audio_level,
                        face_detected=face_detected,
                        motion_x=motion_x,
                        motion_y=motion_y
                    )

                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({
                            "type": "personality_state",
                            "state": personality_engine.get_state_payload()
                        })

                elif msg_type == "set_voice":
                    voice_id = data.get("voice_id", "")
                    result = tts_service.set_voice(voice_id)
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({
                            "type": "voice_changed",
                            "voice": tts_service.get_active_voice_info(),
                            "ok": result["ok"]
                        })

                elif msg_type == "get_voices":
                    if websocket.client_state == WebSocketState.CONNECTED:
                        await websocket.send_json({
                            "type": "voices_list",
                            "voices": tts_service.get_voices(),
                            "active": tts_service.active_voice
                        })

            except json.JSONDecodeError:
                print("Malformed WebSocket JSON")

    except WebSocketDisconnect:
        print("[Emiot] Client disconnected cleanly")
    except Exception as e:
        print(f"[WebSocket Exception] {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
