import os
import json
import torch
import soundfile as sf
import scipy.signal
import numpy as np
from pathlib import Path
from transformers import WhisperProcessor, WhisperForConditionalGeneration

def transcribe_and_build_manifest():
    print("Transcribing Studio Owen Wilson Lightning McQueen Slices with Whisper Model...")
    slices_dir = Path(__file__).parent / "voice_dataset" / "slices"
    manifest_path = Path(__file__).parent / "voice_dataset" / "mcqueen_dataset_manifest.json"

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading Whisper model on {device}...")
    processor = WhisperProcessor.from_pretrained("openai/whisper-tiny")
    model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-tiny").to(device)

    manifest = []
    slice_files = sorted(list(slices_dir.glob("*.wav")))

    for slice_file in slice_files:
        try:
            data, sr = sf.read(str(slice_file))
            if len(data.shape) > 1:
                data = data.mean(axis=1) # Mono
            
            if sr != 16000:
                num_samples = int(len(data) * 16000 / sr)
                data_16k = scipy.signal.resample(data, num_samples)
            else:
                data_16k = data

            input_features = processor(data_16k, sampling_rate=16000, return_tensors="pt").input_features.to(device)
            predicted_ids = model.generate(input_features)
            text = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()

            if text and len(text.split()) > 1:
                entry = {
                    "audio_path": str(slice_file),
                    "text": text
                }
                manifest.append(entry)
                print(f"[{slice_file.name}] Transcribed: '{text}'")
        except Exception as e:
            print(f"[Error {slice_file.name}] {e}")

    print(f"\nManifest built with {len(manifest)} transcribed studio slices!")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    if manifest:
        best_sample = manifest[0]
        print(f"\nTop Reference Audio: {best_sample['audio_path']}")
        print(f"Top Reference Text: '{best_sample['text']}'")

if __name__ == "__main__":
    transcribe_and_build_manifest()
