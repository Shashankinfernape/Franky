import wave
import struct
from pathlib import Path

voice_dir = Path(r"c:\Users\user\Desktop\El projecto\Franky\backend\voice_dataset")
src_path = voice_dir / "mcqueen_ref.wav"
dst_path = voice_dir / "mcqueen_ref_5s.wav"

with wave.open(str(src_path), 'rb') as src:
    channels = src.getnchannels()
    sampwidth = src.getsampwidth()
    framerate = src.getframerate()
    nframes = src.getnframes()
    
    # Read first 7 seconds of audio (frames 0 to 7 * framerate)
    frames_to_read = int(framerate * 7)
    raw_bytes = src.readframes(frames_to_read)

# Convert Stereo to Mono 24kHz
num_samples = len(raw_bytes) // (sampwidth * channels)
mono_samples = []

for i in range(num_samples):
    offset = i * channels * sampwidth
    # Average left and right channels
    l = struct.unpack('<h', raw_bytes[offset:offset+2])[0]
    r = struct.unpack('<h', raw_bytes[offset+2:offset+4])[0] if channels > 1 else l
    avg = (l + r) // 2
    mono_samples.append(struct.pack('<h', avg))

with wave.open(str(dst_path), 'wb') as dst:
    dst.setnchannels(1) # Mono
    dst.setsampwidth(2) # 16-bit
    dst.setframerate(framerate) # 48kHz
    dst.writeframes(b''.join(mono_samples))

print(f"Created clean 7-second mono reference clip at: {dst_path}")
