"""
Fix XTTS v2 Reference Audio: Resample all noise_free_slices from 48000Hz -> 22050Hz.
XTTS v2 uses 22050Hz internally. Feeding 48000Hz clips causes spectral misalignment
which produces muffled, unclear, or "bad" voice cloning output.
"""
import soundfile as sf
import numpy as np
from scipy.signal import resample_poly
from math import gcd
from pathlib import Path
import glob

SRC_DIR = Path("voice_dataset/noise_free_slices")
OUT_DIR = Path("voice_dataset/xtts_ready_slices")
OUT_DIR.mkdir(exist_ok=True)

TARGET_SR = 22050

slices = sorted(SRC_DIR.glob("*.wav"))
print(f"Resampling {len(slices)} slices: 48000Hz -> {TARGET_SR}Hz for XTTS v2...")

for slice_path in slices:
    data, sr = sf.read(str(slice_path))
    
    if sr == TARGET_SR:
        # Already correct rate
        sf.write(str(OUT_DIR / slice_path.name), data, TARGET_SR, subtype='PCM_16')
        print(f"  [SKIP] {slice_path.name} already at {TARGET_SR}Hz")
        continue
    
    # High-quality polyphase resampling
    g = gcd(TARGET_SR, sr)
    up = TARGET_SR // g
    down = sr // g
    resampled = resample_poly(data, up, down)
    
    # Normalize to 0.92 peak
    max_amp = np.max(np.abs(resampled))
    if max_amp > 0:
        resampled = resampled / max_amp * 0.92
    
    sf.write(str(OUT_DIR / slice_path.name), resampled.astype(np.float32), TARGET_SR, subtype='PCM_16')
    
    duration = len(resampled) / TARGET_SR
    print(f"  [OK] {slice_path.name}: {sr}Hz -> {TARGET_SR}Hz | {duration:.1f}s")

print(f"\nDone! {len(slices)} XTTS-ready reference slices saved in {OUT_DIR}")
