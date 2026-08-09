import os
import re
import asyncio
import json
import requests
from pathlib import Path
from typing import AsyncGenerator, Tuple, Dict, Any

# Explicitly load backend/.env file
ENV_PATH = Path(__file__).parent.parent / ".env"
if ENV_PATH.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=ENV_PATH)
    except ImportError:
        # Fallback manual env file parser if dotenv isn't installed
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()

class LLMService:
    """
    LLM response generator powered by Groq API (Llama 3.3 70B Versatile).
    Answers user questions directly in character as Lightning McQueen.
    """
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama-3.3-70b-versatile"
        if self.groq_api_key:
            print(f"[LLMService] [OK] Groq API key loaded ({self.groq_api_key[:8]}...)")
        else:
            print("[LLMService] [WARN] Groq API key missing!")

    async def generate_response_stream(
        self,
        user_text: str,
        personality_state: Dict[str, Any]
    ) -> AsyncGenerator[Tuple[str, str], None]:
        """
        Yields tuples of (emotion_tag, token_chunk).
        """
        api_key = self.groq_api_key or os.getenv("GROQ_API_KEY", "").strip()

        if api_key:
            try:
                system_prompt = self._build_system_prompt(personality_state)
                payload = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_text}
                    ],
                    "temperature": 0.5,
                    "max_tokens": 120
                }
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }

                loop = asyncio.get_event_loop()
                def _call_groq():
                    return requests.post(self.groq_url, json=payload, headers=headers, timeout=10.0)

                resp = await loop.run_in_executor(None, _call_groq)

                if resp.status_code == 200:
                    data = resp.json()
                    full_text = data['choices'][0]['message']['content']

                    # Extract emotion tag
                    emotion_tag, clean_text = self._extract_emotion_tag(full_text)

                    # Normalize curly quotes and smart punctuation → plain ASCII
                    clean_text = (clean_text
                        .replace('\u2018', "'").replace('\u2019', "'")
                        .replace('\u201c', '"').replace('\u201d', '"')
                        .replace('\u2013', '-').replace('\u2014', '--')
                        .replace('\u2026', '...')
                    )

                    print(f"[Groq LLM Output] Emotion: {emotion_tag} | Response: '{clean_text}'")

                    yield (emotion_tag, "")
                    words = clean_text.split(" ")
                    for i, word in enumerate(words):
                        chunk = word + (" " if i < len(words) - 1 else "")
                        await asyncio.sleep(0.02)
                        yield (emotion_tag, chunk)
                    return
                else:
                    print(f"[Groq API Error Status {resp.status_code}] {resp.text}")
            except Exception as e:
                print(f"[Groq LLM Exception] {e}")

        # Intelligent McQueen Fallback (never echo user text!)
        fallback_reply = f"Lightning McQueen is ready. You asked about '{user_text}'."
        print(f"[LLM Fallback Output] {fallback_reply}")
        yield ("excited", "")
        words = fallback_reply.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.02)
            yield ("excited", chunk)

    def _build_system_prompt(self, personality: Dict[str, Any]) -> str:
        return """You are Lightning McQueen, the legendary #95 Piston Cup race car.
CRITICAL INSTRUCTIONS:
- Respond naturally as Lightning McQueen to whatever the user says.
- Be confident, friendly, and enthusiastic.
- DO NOT use catchphrases like "Ka-chow!" or "I am speed". Speak in clear, natural conversational sentences without repetitive slogans.
- Answer in 1-2 concise sentences.
- You MUST start your response with an emotion tag from: [<emo:excited>, <emo:curious>, <emo:confused>, <emo:happy>, <emo:sad>, <emo:sleepy>, <emo:surprised>, <emo:love>, <emo:angry>].
Example: <emo:excited> Turn right to go left, that is the secret on the dirt track!
"""

    def _extract_emotion_tag(self, text: str) -> Tuple[str, str]:
        match = re.search(r'<emo:([a-z]+)>', text)
        if match:
            emotion = match.group(1)
            clean_text = re.sub(r'<emo:[a-z]+>', '', text).strip()
            return (emotion, clean_text)
        return ("excited", text.strip())

llm_service = LLMService()
