import io
import re
import torch
import soundfile as sf
from pathlib import Path
from huggingface_hub import hf_hub_download
from f5_tts.model import DiT
from f5_tts.infer.utils_infer import load_model, load_vocoder, infer_process

def test_energetic_slices():
    noise_free_dir = Path(__file__).parent / "voice_dataset" / "noise_free_slices"
    device = "cuda" if torch.cuda.is_available() else "cpu"

    ckpt_path = hf_hub_download(repo_id="vdaular/f5-tts-en", filename="F5TTS_v1_Base/model_1250000.safetensors")
    f5_model = load_model(
        model_cls=DiT,
        model_cfg=dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4),
        ckpt_path=ckpt_path,
        mel_spec_type="vocos",
        device=device
    )
    f5_vocoder = load_vocoder(vocoder_name="vocos", device=device)

    candidates = [
        ("mcqueen_slice_016.wav", "Oh, I mean faster. Well, what do you know? I am speed."),
        ("mcqueen_slice_023.wav", "need to move. Time for a little cachow. Man am I glad to be back"),
        ("mcqueen_slice_007.wav", "I'll be available for autographs later.")
    ]

    test_text = "I am Lightning McQueen! Faster than fast, quicker than quick. I am speed!"

    for filename, ref_text in candidates:
        ref_audio = str(noise_free_dir / filename)
        if not Path(ref_audio).exists():
            continue

        print(f"\nTesting energetic slice: {filename}...")
        wav, sr, _ = infer_process(
            ref_audio=ref_audio,
            ref_text=ref_text,
            gen_text=test_text,
            model_obj=f5_model,
            vocoder=f5_vocoder,
            nfe_step=32,
            cfg_strength=1.5,
            sway_sampling_coef=0.0,
            speed=1.1,
            device=device
        )
        
        out_path = Path(__file__).parent / "voice_dataset" / f"test_{filename}"
        sf.write(str(out_path), wav, sr, subtype='PCM_16')
        print(f"Generated test audio at {out_path.name}")

if __name__ == "__main__":
    test_energetic_slices()
