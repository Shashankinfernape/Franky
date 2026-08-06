import os
import re
import asyncio
import json
import requests
from typing import AsyncGenerator, Tuple, Dict, Any

# Try loading .env file if python-dotenv is present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class LLMService:
    """
    LLM response generator powered by Groq API (Llama 3.3 70B Versatile).
    Strict direct answers without any roleplay or filler dialogue.
    """
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY", "")
        self.groq_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama-3.3-70b-versatile"

    async def generate_response_stream(
        self,
        user_text: str,
        personality_state: Dict[str, Any]
    ) -> AsyncGenerator[Tuple[str, str], None]:
        """
        Yields tuples of (emotion_tag, token_chunk).
        """
        api_key = self.groq_api_key or os.getenv("GROQ_API_KEY", "")
        if api_key:
            try:
                system_prompt = self._build_system_prompt(personality_state)
                payload = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_text}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 100
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
                        .replace('\u2018', "'").replace('\u2019', "'")   # '' → '
                        .replace('\u201c', '"').replace('\u201d', '"')   # "" → "
                        .replace('\u2013', '-').replace('\u2014', '--')  # – — → -
                        .replace('\u2026', '...')                        # … → ...
                    )

                    # Scrub any residual car roleplay fluff if generated
                    clean_text = re.sub(r"(?i)\b(i'm revving to go|vroom|full speed ahead|circuits buzzing|let's get this adventure started)\b,?\s*", "", clean_text).strip()

                    print(f"[Groq LLM Direct Output] Emotion: {emotion_tag} | Text: '{clean_text}'")

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
                print(f"[Groq LLM Exception] {e} -> Falling back to direct response")

        # Fallback
        yield ("excited", user_text)

    def _build_system_prompt(self, personality: Dict[str, Any]) -> str:
        return """You are a helpful, intelligent, direct AI assistant named Emiot.
CRITICAL INSTRUCTIONS:
- Answer the user's question directly, clearly, and concisely in 1-2 sentences.
- NEVER use race car roleplay phrases, car sounds, or filler dialogue (e.g. NEVER say "I'm revving to go", "full speed ahead", "vroom", "adventure started", or "circuits buzzing").
- You MUST start your response with an emotion tag from: [<emo:excited>, <emo:curious>, <emo:confused>, <emo:happy>, <emo:sad>, <emo:sleepy>, <emo:surprised>, <emo:love>, <emo:angry>].
"""

    def _extract_emotion_tag(self, text: str) -> Tuple[str, str]:
        match = re.search(r'<emo:([a-z]+)>', text)
        if match:
            emotion = match.group(1)
            clean_text = re.sub(r'<emo:[a-z]+>', '', text).strip()
            return (emotion, clean_text)
        return ("excited", text.strip())

llm_service = LLMService()
