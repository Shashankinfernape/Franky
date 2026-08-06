import soundfile as sf
import numpy as np
from pathlib import Path
from piper import PiperVoice

def test_piper():
    model_path = Path(__file__).parent / "voice_dataset" / "piper_voice.onnx"
    voice = PiperVoice.load(str(model_path))
    
    text = "Hello! I am ready to assist you with clear and standard speech."
    chunks = list(voice.synthesize(text))
    raw_pcm = b"".join([c.audio_int16_bytes for c in chunks if hasattr(c, 'audio_int16_bytes')])
    
    output_path = Path(__file__).parent / "voice_dataset" / "test_piper_out.wav"
    audio_data = np.frombuffer(raw_pcm, dtype=np.int16)
    sf.write(str(output_path), audio_data, voice.config.sample_rate)
    print(f"Generated {len(raw_pcm)} bytes of crystal-clear HD audio at {output_path.name}!")

if __name__ == "__main__":
    test_piper()
