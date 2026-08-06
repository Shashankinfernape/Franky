import torchaudio
import soundfile as sf
import torch

# Monkeypatch torchaudio.load to use soundfile directly without torchcodec
def _custom_load(filepath, **kwargs):
    data, samplerate = sf.read(filepath)
    tensor = torch.from_numpy(data).float()
    if tensor.ndim == 1:
        tensor = tensor.unsqueeze(0)
    elif tensor.ndim == 2:
        tensor = tensor.t() # (channels, samples)
    return tensor, samplerate

torchaudio.load = _custom_load

print("Monkeypatched torchaudio.load with soundfile!")

import subprocess
import sys
from pathlib import Path

voice_dir = Path(r"c:\Users\user\Desktop\El projecto\Franky\backend\voice_dataset")
ref_audio = voice_dir / "mcqueen_ref_5s.wav"

cmd = [
    sys.executable, "-m", "f5_tts.infer.infer_cli",
    "--ref_audio", str(ref_audio),
    "--gen_text", "Kachow! I am Lightning McQueen! Speed, I am speed!",
    "--output_dir", str(voice_dir)
]

print("Running F5-TTS inference...")
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:", res.stdout[-500:] if res.stdout else "None")
print("STDERR:", res.stderr[-500:] if res.stderr else "None")
print("Return code:", res.returncode)
