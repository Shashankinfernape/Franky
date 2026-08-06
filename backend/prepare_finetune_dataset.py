"""
XTTS v2 Fine-Tuning Dataset Preparation
========================================
Takes the raw 197sec McQueen audio and produces:
  1. Mono 22050Hz WAV slices (3-10s each, silence-split)
  2. metadata.csv  (pipe-delimited: audio_file|text|speaker_name)
  3. Whisper transcriptions for each slice

Run this BEFORE finetune_xtts.py
"""
import os, sys, re, csv, warnings
warnings.filterwarnings("ignore")
os.environ["COQUI_TOS_AGREED"] = "1"

import numpy as np
import soundfile as sf
from pathlib import Path
from scipy.signal import resample_poly
from math import gcd

# --- CONFIG -------------------------------------------------------------------
SRC_WAV   = Path("voice_dataset/All_Lightning_McQueen_Voice_Clips_Kinect_Rush_A_Disney-Pixar_Adventure_Lines_Owen_Wilson_[cut_197sec].wav")
OUT_DIR   = Path("voice_dataset/finetune_dataset")
WAVS_DIR  = OUT_DIR / "wavs"
META_CSV  = OUT_DIR / "metadata.csv"
TARGET_SR = 22050
SPEAKER   = "mcqueen"
MIN_DUR   = 2.5    # seconds - min clip length
MAX_DUR   = 10.0   # seconds - max clip length
# RMS silence threshold (linear). From probe: RMS<0.001 = 18.9% frames = clean silence
SILENCE_RMS  = 0.008   # slightly above noise floor
MIN_SIL_FRAMES = 5     # min consecutive silent frames to split (=100ms)

WAVS_DIR.mkdir(parents=True, exist_ok=True)

# --- STEP 1: Load + mono + normalize -----------------------------------------
print("[1/4] Loading source audio...")
data, sr = sf.read(str(SRC_WAV))
if data.ndim == 2:
    data = data.mean(axis=1)
print(f"      Loaded: {sr}Hz, {len(data)/sr:.1f}s, mono")
data = data / max(abs(data).max(), 1e-6) * 0.92

# --- STEP 2: Resample to 22050Hz ---------------------------------------------
print(f"[2/4] Resampling {sr}Hz -> {TARGET_SR}Hz...")
g = gcd(TARGET_SR, sr)
data22 = resample_poly(data, TARGET_SR // g, sr // g).astype(np.float32)
print(f"      Resampled: {len(data22)/TARGET_SR:.1f}s at {TARGET_SR}Hz")

# --- STEP 3: Silence-split into clips ----------------------------------------
print("[3/4] Slicing on silence boundaries...")

frame_ms = 20
frame_sz = int(TARGET_SR * frame_ms / 1000)  # 441 samples per 20ms frame

frames  = [data22[i:i+frame_sz] for i in range(0, len(data22)-frame_sz, frame_sz)]
rms_arr = np.array([np.sqrt(np.mean(f**2)) for f in frames])
is_sil  = rms_arr < SILENCE_RMS

# State machine: find voiced regions separated by silence gaps
slices = []
voiced_start = None
sil_count = 0

for i, sil in enumerate(is_sil):
    if not sil:
        # Voiced frame
        if voiced_start is None:
            voiced_start = i
        sil_count = 0
    else:
        # Silent frame
        sil_count += 1
        if voiced_start is not None and sil_count >= MIN_SIL_FRAMES:
            # End of voiced region
            voiced_end = i - sil_count + 1
            dur = (voiced_end - voiced_start) * frame_ms / 1000.0
            start_s = voiced_start * frame_sz
            end_s   = voiced_end   * frame_sz

            if dur >= MIN_DUR and dur <= MAX_DUR:
                slices.append((start_s, end_s))
            elif dur > MAX_DUR:
                # Force-split into MAX_DUR chunks
                s = start_s
                while s < end_s:
                    e = min(s + int(MAX_DUR * TARGET_SR), end_s)
                    chunk_dur = (e - s) / TARGET_SR
                    if chunk_dur >= MIN_DUR:
                        slices.append((s, e))
                    s = e
            # Reset (skip too-short clips)
            voiced_start = None
            sil_count = 0

# Catch trailing voiced segment
if voiced_start is not None:
    end_s = len(data22)
    dur   = (end_s - voiced_start * frame_sz) / TARGET_SR
    if MIN_DUR <= dur <= MAX_DUR:
        slices.append((voiced_start * frame_sz, end_s))

print(f"      Found {len(slices)} voice segments (threshold RMS<{SILENCE_RMS})")

# Save slices
saved = []
for idx, (s, e) in enumerate(slices):
    seg  = data22[s:e]
    fname = f"mcqueen_{idx:04d}.wav"
    fpath = WAVS_DIR / fname
    sf.write(str(fpath), seg, TARGET_SR, subtype='PCM_16')
    saved.append(fname)
    dur = (e - s) / TARGET_SR
    print(f"      [{idx+1:03d}/{len(slices)}] {fname}: {dur:.2f}s")

# --- STEP 4: Transcribe with Whisper -----------------------------------------
print(f"\n[4/4] Transcribing {len(saved)} slices with Whisper (GPU)...")

try:
    import whisper
except ImportError:
    print("      Installing openai-whisper...")
    os.system(f'"{sys.executable}" -m pip install openai-whisper -q')
    import whisper

model = whisper.load_model("base.en")
print("      Whisper 'base.en' loaded")

rows = []
skipped = 0
for fname in saved:
    fpath = str(WAVS_DIR / fname)
    # Load as numpy float32 array (16kHz) - avoids ffmpeg dependency on Windows
    audio_data, audio_sr = sf.read(fpath)
    audio_float = audio_data.astype(np.float32)
    # Whisper needs 16kHz - resample from 22050
    g2 = gcd(16000, TARGET_SR)
    audio_16k = resample_poly(audio_float, 16000 // g2, TARGET_SR // g2).astype(np.float32)
    result = model.transcribe(audio_16k, language="en", fp16=True)
    text = result["text"].strip()
    text = re.sub(r'[^\x20-\x7E]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()

    if len(text) < 5:
        skipped += 1
        print(f"      [SKIP] {fname}: too short ('{text}')")
        continue

    rows.append({"audio_file": f"wavs/{fname}", "text": text, "speaker_name": SPEAKER})
    print(f"      {fname}: \"{text[:80]}\"")

# Write metadata.csv
with open(META_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["audio_file", "text", "speaker_name"], delimiter="|")
    writer.writeheader()
    writer.writerows(rows)

print(f"\n{'='*60}")
print(f"Dataset ready!")
print(f"  Slices     : {len(rows)} usable / {len(saved)} total ({skipped} skipped)")
print(f"  Metadata   : {META_CSV}")
print(f"\nNext step: run  python finetune_xtts.py")
