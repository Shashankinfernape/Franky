import os
import torch
import soundfile as sf
from pathlib import Path
from huggingface_hub import hf_hub_download
from f5_tts.model import DiT
from f5_tts.infer.utils_infer import load_model, load_vocoder, infer_process

def test_studio_mcqueen():
    print("Testing Studio Quality Owen Wilson McQueen Voice on RTX 2060 GPU...")
    voice_dir = Path(__file__).parent / "voice_dataset"
    ref_audio = str(voice_dir / "mcqueen_studio_8s_pcm.wav")
    ref_text = "You will get a great job order."
    gen_text = "Walter White is a chemistry teacher from Breaking Bad."

    ckpt_path = hf_hub_download(repo_id="vdaular/f5-tts-en", filename="F5TTS_v1_Base/model_1250000.safetensors")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    model = load_model(
        model_cls=DiT,
        model_cfg=dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, conv_layers=4),
        ckpt_path=ckpt_path,
        mel_spec_type="vocos",
        device=device
    )
    vocoder = load_vocoder(vocoder_name="vocos", device=device)

    wav, sr, _ = infer_process(
        ref_audio=ref_audio,
        ref_text=ref_text,
        gen_text=gen_text,
        model_obj=model,
        vocoder=vocoder,
        nfe_step=32,
        cfg_strength=1.5,
        sway_sampling_coef=0.0,
        speed=1.0,
        device=device
    )

    out_path = voice_dir / "mcqueen_studio_output.wav"
    sf.write(str(out_path), wav, sr)
    print(f"[F5-TTS Studio Success!] Output saved to: {out_path}")

if __name__ == "__main__":
    test_studio_mcqueen()
