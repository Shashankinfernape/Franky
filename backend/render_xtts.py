import os
os.environ["COQUI_TOS_AGREED"] = "1"

import sys
import io
import torch
import soundfile as sf
from pathlib import Path
from TTS.api import TTS

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[XTTS v2 Runner] Loading XTTS v2 on {device}...", file=sys.stderr)

tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False).to(device)
ref_audio = Path(__file__).parent / "voice_dataset" / "noise_free_slices" / "mcqueen_slice_007.wav"

def generate(text_prompt: str, out_path: str):
    tts.tts_to_file(
        text=text_prompt,
        speaker_wav=str(ref_audio),
        language="en",
        file_path=out_path
    )
    print(f"[XTTS v2 Runner] Rendered '{text_prompt}' -> {out_path}", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) > 2:
        prompt = sys.argv[1]
        output_file = sys.argv[2]
        generate(prompt, output_file)
