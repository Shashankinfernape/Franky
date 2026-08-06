import os
import torchaudio
import soundfile as sf
from pathlib import Path

def slice_mcqueen_dataset():
    print("Slicing 197-second Owen Wilson Disney-Pixar Studio Dataset...")
    dataset_dir = Path(__file__).parent / "voice_dataset"
    raw_wav_path = dataset_dir / "mcqueen_ref.wav"
    slices_dir = dataset_dir / "slices"
    slices_dir.mkdir(exist_ok=True)

    # Load 197s audio
    audio, sr = torchaudio.load(raw_wav_path)
    if audio.shape[0] > 1:
        audio = audio.mean(dim=0, keepdim=True) # Convert to mono

    total_duration = audio.shape[-1] / sr
    print(f"Loaded Raw Studio Audio: {total_duration:.2f} seconds | Sample Rate: {sr} Hz")

    # Slice into clean ~6 second segments
    segment_sec = 6.0
    num_samples = int(sr * segment_sec)
    total_samples = audio.shape[-1]

    created_slices = []
    idx = 0
    for start in range(0, total_samples - num_samples, num_samples):
        chunk = audio[:, start:start + num_samples]
        
        # Check audio energy (avoid silent clips)
        energy = chunk.pow(2).mean().sqrt().item()
        if energy > 0.01:
            out_file = slices_dir / f"mcqueen_slice_{idx:03d}.wav"
            torchaudio.save(str(out_file), chunk, sr)
            # Also save PCM_16 version for fast loading
            pcm_data, _ = sf.read(str(out_file))
            sf.write(str(out_file), pcm_data, sr, subtype='PCM_16')
            created_slices.append(out_file)
            idx += 1

    print(f"Successfully generated {len(created_slices)} clean studio voice slices in {slices_dir}!")

if __name__ == "__main__":
    slice_mcqueen_dataset()
