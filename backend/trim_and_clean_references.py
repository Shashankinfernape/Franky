import os
import json
import soundfile as sf
import numpy as np
from pathlib import Path

def clean_and_trim_slices():
    slices_dir = Path(__file__).parent / "voice_dataset" / "slices"
    trimmed_dir = Path(__file__).parent / "voice_dataset" / "trimmed_slices"
    trimmed_dir.mkdir(parents=True, exist_ok=True)

    manifest_path = Path(__file__).parent / "voice_dataset" / "mcqueen_dataset_manifest.json"
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    cleaned_manifest = []

    for entry in manifest:
        audio_path = entry["audio_path"]
        text = entry["text"]
        filename = Path(audio_path).name

        try:
            data, sr = sf.read(audio_path)
            if len(data.shape) > 1:
                data = data.mean(axis=1)

            # Silence trimming threshold (0.01)
            abs_data = np.abs(data)
            mask = abs_data > 0.015
            if not np.any(mask):
                continue
            
            start_idx = np.argmax(mask)
            end_idx = len(mask) - np.argmax(mask[::-1])
            
            # Keep 50ms padding
            pad = int(sr * 0.05)
            start_idx = max(0, start_idx - pad)
            end_idx = min(len(data), end_idx + pad)

            trimmed_data = data[start_idx:end_idx]

            # Peak normalize
            max_val = np.max(np.abs(trimmed_data))
            if max_val > 0:
                trimmed_data = (trimmed_data / max_val) * 0.95

            output_path = str(trimmed_dir / filename)
            sf.write(output_path, trimmed_data, sr, subtype='PCM_16')

            duration = len(trimmed_data) / sr
            if 3.0 <= duration <= 8.0:
                cleaned_manifest.append({
                    "audio_path": output_path,
                    "text": text,
                    "duration": duration
                })
                print(f"[{filename}] Trimmed & normalized ({duration:.2f}s): '{text}'")

        except Exception as e:
            print(f"[Error {filename}] {e}")

    with open(Path(__file__).parent / "voice_dataset" / "mcqueen_trimmed_manifest.json", "w") as f:
        json.dump(cleaned_manifest, f, indent=2)

    print(f"\nCreated {len(cleaned_manifest)} high-precision trimmed studio reference slices!")

if __name__ == "__main__":
    clean_and_trim_slices()
