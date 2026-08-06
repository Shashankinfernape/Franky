import os
import sys
import wave
import subprocess
from pathlib import Path

def process_audio_file(input_file: str, output_dir: str):
    """
    Normalizes, converts to 24kHz mono WAV, and prepares clean audio sample
    for F5-TTS / XTTS v2 voice cloning.
    """
    input_path = Path(input_file)
    if not input_path.exists():
        print(f"❌ Error: Input file '{input_file}' not found.")
        return

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    clean_wav_out = output_path / "mcqueen_voice_reference.wav"
    print(f"🎙️ Processing '{input_path.name}' -> '{clean_wav_out.name}'...")

    # Using ffmpeg if available, or wave python stdlib
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(input_path),
            "-ac", "1",               # Mono
            "-ar", "24000",           # 24kHz sampling rate for modern TTS
            "-filter:a", "loudnorm",  # EBU R128 loudness normalization
            str(clean_wav_out)
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"✅ Successfully created 24kHz normalized voice reference: {clean_wav_out}")
    except Exception as e:
        print(f"⚠️ FFmpeg not found or failed ({e}). Please ensure audio is 24kHz mono WAV format.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python prepare_voice_dataset.py <path_to_audio_file>")
        print("Example: python prepare_voice_dataset.py raw_mcqueen_sample.mp3")
    else:
        process_audio_file(sys.argv[1], "voice_dataset")
