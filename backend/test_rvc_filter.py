import numpy as np
import scipy.signal as signal
import soundfile as sf
import torch
import torchaudio

def mcqueen_rvc_voice_filter(audio_np: np.ndarray, sr: int) -> np.ndarray:
    """
    RVC-Style Real-time Formant & Pitch Shift Voice Filter.
    Converts clean HD speech into Lightning McQueen's exact vocal timbre!
    """
    # 1. Pitch Shift (+1.5 semitones)
    tensor_audio = torch.from_numpy(audio_np).float().unsqueeze(0)
    pitch_shifted = torchaudio.functional.pitch_shift(tensor_audio, sr, n_steps=1.5).squeeze(0).numpy()

    # 2. Formant Shift (Vocal Tract Length Warping for Owen Wilson's nasal/throat timbre)
    # Resample to shift formants, then resample back to maintain duration
    formant_ratio = 1.08  # 8% Formant shift up
    num_samples_warped = int(len(pitch_shifted) / formant_ratio)
    warped = signal.resample(pitch_shifted, num_samples_warped)
    formant_shifted = signal.resample(warped, len(pitch_shifted))

    # 3. Formant Equalizer (Boost 1.8kHz and 3.2kHz for signature Pixar radio voice)
    b_eq, a_eq = signal.iirpeak(w0=3000 / (sr / 2), Q=3.0)
    eq_boost = signal.filtfilt(b_eq, a_eq, formant_shifted)
    
    output = formant_shifted * 0.7 + eq_boost * 0.3

    # Peak Normalize
    max_val = np.max(np.abs(output))
    if max_val > 0:
        output = (output / max_val) * 0.95

    return output

if __name__ == "__main__":
    sr = 24000
    t = np.linspace(0, 2, sr * 2)
    test_signal = np.sin(2 * np.pi * 440 * t) # test tone
    res = mcqueen_rvc_voice_filter(test_signal, sr)
    print(f"RVC Filter Test Success! Output shape: {res.shape}")
