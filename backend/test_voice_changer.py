import torch
import torchaudio
import numpy as np

def test_pitch_shift():
    sample_rate = 22050
    audio = torch.randn(1, sample_rate * 2) # 2 seconds of audio
    # Shift pitch up by 2 semitones
    shifted = torchaudio.functional.pitch_shift(audio, sample_rate, n_steps=2)
    print(f"Shifted audio shape: {shifted.shape}")

if __name__ == "__main__":
    test_pitch_shift()
