import os
import sys
import torch
from pathlib import Path

def train_and_save_mcqueen_model(audio_path: str):
    """
    Extracts speaker embeddings from mcqueen.wav and trains/saves 
    a permanent speaker voice profile checkpoint for Emiot.
    """
    audio_file = Path(audio_path)
    if not audio_file.exists():
        print(f"❌ Error: Audio file '{audio_path}' not found.")
        return

    output_dir = Path(__file__).parent.parent / "voice_dataset"
    output_dir.mkdir(parents=True, exist_ok=True)
    speaker_checkpoint = output_dir / "mcqueen_speaker.pth"

    print(f"🚀 Training McQueen Voice Profile from '{audio_file.name}'...")

    try:
        from TTS.api import TTS
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"⚡ Device: {device}")

        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        
        # Extract latent speaker embedding
        gpt_cond_latent, speaker_embedding = tts.synthesizer.tts_model.get_conditioning_latents(
            audio_path=[str(audio_file)]
        )

        # Save permanent checkpoint file
        torch.save({
            "gpt_cond_latent": gpt_cond_latent,
            "speaker_embedding": speaker_embedding,
        }, speaker_checkpoint)

        print(f"🎉 SUCCESS! McQueen voice model checkpoint saved to:")
        print(f"   {speaker_checkpoint}")
        print("⚡ Emiot backend is now trained and ready to use McQueen's voice!")

    except Exception as e:
        print(f"❌ Training error: {e}")
        print("Installing TTS dependencies: pip install TTS torch torchaudio")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        train_and_save_mcqueen_model(sys.argv[1])
    else:
        # Default path check
        default_file = "mcqueen.wav"
        if os.path.exists(default_file):
            train_and_save_mcqueen_model(default_file)
        else:
            print("Usage: python train_mcqueen_xtts.py <path_to_mcqueen.wav>")
