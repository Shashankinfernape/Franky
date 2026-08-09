import os
os.environ["COQUI_TOS_AGREED"] = "1"

import io
import torch
import soundfile as sf
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Lightning McQueen XTTS v2 Fine-Tuned Worker")

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[XTTS Worker] Loading fine-tuned McQueen model on {device.upper()}...")

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR       = Path(__file__).parent
BASE_MODEL_DIR = Path(os.path.expanduser("~")) / "AppData/Local/tts/tts_models--multilingual--multi-dataset--xtts_v2"
FT_RUN_DIR     = BASE_DIR / "voice_dataset/mcqueen_model/McQueen_XTTS_FT-August-06-2026_04+33PM-0000000"
# Checkpoint: use best_model_630.pth (lowest eval-loss checkpoint at step 630)
BEST_MODEL_PTH = FT_RUN_DIR / "best_model_630.pth"
if not BEST_MODEL_PTH.exists():
    BEST_MODEL_PTH = FT_RUN_DIR / "best_model.pth"

# Best reference audio: the longest McQueen clip (mcqueen_0012 = 5.78s)
REF_AUDIO = str(BASE_DIR / "voice_dataset/finetune_dataset/wavs/mcqueen_0012.wav")

tts_model = None

try:
    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    config = XttsConfig()
    config.load_json(str(BASE_MODEL_DIR / "config.json"))

    tts_model = Xtts.init_from_config(config)

    if BEST_MODEL_PTH.exists():
        print(f"[XTTS Worker] Loading FINE-TUNED checkpoint: {BEST_MODEL_PTH.name}")
        tts_model.load_checkpoint(
            config,
            checkpoint_dir=str(BASE_MODEL_DIR),   # for vocab.json + speakers_xtts.pth
            checkpoint_path=str(BEST_MODEL_PTH),   # override model weights with fine-tuned
            eval=True,
            strict=False,
        )
        print("[XTTS Worker] [OK] Fine-tuned McQueen model loaded!")
    else:
        print(f"[XTTS Worker] [WARN] Fine-tuned model not found at {BEST_MODEL_PTH}, falling back to base model")
        tts_model.load_checkpoint(
            config,
            checkpoint_dir=str(BASE_MODEL_DIR),
            eval=True,
        )
        print("[XTTS Worker] Base model loaded (fallback)")

    tts_model = tts_model.to(device)

    # Pre-compute McQueen's speaker conditioning latents
    print("[XTTS Worker] Pre-computing McQueen speaker conditioning latents...")
    with torch.no_grad():
        gpt_cond_latent, speaker_embedding = tts_model.get_conditioning_latents(
            audio_path=[REF_AUDIO],
            gpt_cond_len=6,
            gpt_cond_chunk_len=3,
            max_ref_length=10,
        )
    print("[XTTS Worker] [OK] Speaker latents cached — READY FOR SYNTHESIS!")

except Exception as e:
    print(f"[XTTS Worker Init Error] {e}")
    import traceback; traceback.print_exc()
    tts_model = None
    gpt_cond_latent = None
    speaker_embedding = None


class TTSRequest(BaseModel):
    text: str


@app.post("/synthesize")
def synthesize(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    if tts_model is None:
        raise HTTPException(status_code=500, detail="XTTS Model not loaded")

    try:
        with torch.no_grad():
            out = tts_model.inference(
                text=req.text.strip(),
                language="en",
                gpt_cond_latent=gpt_cond_latent,
                speaker_embedding=speaker_embedding,
                temperature=0.3,          # sharp Owen Wilson pitch, no low-end drift
                length_penalty=1.0,
                repetition_penalty=2.0,   # smooth, natural pacing
                top_k=20,                 # focused acoustic sampling
                top_p=0.8,
            )

        wav = out["wav"]
        if isinstance(wav, torch.Tensor):
            wav = wav.squeeze().cpu().numpy()

        buf = io.BytesIO()
        sf.write(buf, wav, 24000, format="WAV", subtype="PCM_16")
        buf.seek(0)
        return {"audio_b64": buf.read().hex()}

    except Exception as e:
        print(f"[Worker Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8009)
