import os
os.environ["COQUI_TOS_AGREED"] = "1"

import torch
import soundfile as sf
from pathlib import Path

def test_xtts_mcqueen():
    print("[XTTS v2 Engine] Initializing Coqui XTTS v2 Model on GPU...")
    try:
        from TTS.api import TTS
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[XTTS v2 Engine] Loading xtts_v2 model on {device}...")
        
        tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True).to(device)

        ref_audio = Path(__file__).parent / "voice_dataset" / "noise_free_slices" / "mcqueen_slice_007.wav"
        output_wav = Path(__file__).parent / "voice_dataset" / "test_xtts_mcqueen_out.wav"

        prompt_text = "I am Lightning McQueen! Faster than fast, quicker than quick. I am speed!"
        print(f"[XTTS v2 Engine] Synthesizing speech using reference audio: {ref_audio.name}...")

        tts.tts_to_file(
            text=prompt_text,
            speaker_wav=str(ref_audio),
            language="en",
            file_path=str(output_wav)
        )
        print(f"[XTTS v2 Engine] SUCCESS! Saved XTTS v2 synthesized audio at {output_wav.name}!")
    except Exception as e:
        print(f"[XTTS v2 Error] {e}")

if __name__ == "__main__":
    test_xtts_mcqueen()
