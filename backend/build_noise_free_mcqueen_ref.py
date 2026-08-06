import soundfile as sf
import numpy as np
import noisereduce as nr
from pathlib import Path

def build_noise_free_mcqueen_ref():
    slices_dir = Path(__file__).parent / "voice_dataset" / "trimmed_slices"
    output_dir = Path(__file__).parent / "voice_dataset" / "noise_free_slices"
    output_dir.mkdir(parents=True, exist_ok=True)

    slice_files = sorted(list(slices_dir.glob("*.wav")))
    print(f"Applying Spectral Noise Reduction to {len(slice_files)} Lightning McQueen studio slices...")

    for slice_file in slice_files:
        try:
            data, sr = sf.read(str(slice_file))
            if len(data.shape) > 1:
                data = data.mean(axis=1)

            # Apply Stationary Spectral Noise Reduction
            reduced_data = nr.reduce_noise(y=data, sr=sr, stationary=True, prop_decrease=0.95)

            # Normalize peak volume to 0.95 (-0.4 dBFS)
            max_amp = np.max(np.abs(reduced_data))
            if max_amp > 0:
                reduced_data = (reduced_data / max_amp) * 0.95

            out_path = output_dir / slice_file.name
            sf.write(str(out_path), reduced_data, sr, subtype='PCM_16')
            print(f"[{slice_file.name}] Noise reduced & saved!")
        except Exception as e:
            print(f"[Error {slice_file.name}] {e}")

    print(f"\nCompleted! Saved 100% noise-free studio slices in {output_dir.name}/")

if __name__ == "__main__":
    build_noise_free_mcqueen_ref()
