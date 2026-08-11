"""
XTTS v2 Fine-Tuning Script (OFFICIAL API)
==========================================
Uses Coqui's GPTTrainer — the correct dedicated XTTS v2 training class.
Based on: TTS/demos/xtts_ft_demo/utils/gpt_train.py

Requires:
  - voice_dataset/finetune_dataset/metadata.csv  (from prepare_finetune_dataset.py)
  - dvae.pth + mel_stats.pth (auto-downloaded)

Output:
  - voice_dataset/mcqueen_model/run/training/GPT_XTTS_FT-<date>/best_model.pth
"""
import os, sys, gc, csv, shutil, warnings
warnings.filterwarnings("ignore")
os.environ["COQUI_TOS_AGREED"] = "1"
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "max_split_size_mb:256"

import torch
from pathlib import Path

# ─── PATHS ───────────────────────────────────────────────────────────────────
DATASET_DIR  = Path("voice_dataset/finetune_dataset").resolve()
OUTPUT_DIR   = Path("voice_dataset/mcqueen_model").resolve()
CHECKPTS_DIR = OUTPUT_DIR / "base_xtts_files"
META_CSV     = DATASET_DIR / "metadata.csv"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
CHECKPTS_DIR.mkdir(parents=True, exist_ok=True)

# ─── TRAINING HYPERPARAMS ────────────────────────────────────────────────────
LANGUAGE    = "en"
EPOCHS      = 100
BATCH_SIZE  = 2      # safe for RTX 2060 6GB with DVAE in memory
GRAD_ACCUM  = 8      # effective batch = 16
LR          = 1e-6   # lower LR for stable FP32 training
MAX_AUDIO_LEN = 255995  # ~11.6 seconds at 22050Hz

# ─── CHECK METADATA ──────────────────────────────────────────────────────────
if not META_CSV.exists():
    print("[ERROR] Run prepare_finetune_dataset.py first!")
    sys.exit(1)

# ─── CONVERT METADATA TO COQUI FORMAT ────────────────────────────────────────
# Coqui format: audio_file|text|speaker_name  (with header, pipe-delimited)
# Our metadata.csv already has this format from prepare_finetune_dataset.py
# But we need separate train.csv and eval.csv files

print("[Prep] Converting metadata to Coqui train/eval CSVs...")
rows = []
with open(META_CSV, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = line.split("|")
        if len(parts) < 2:
            continue
        fname = parts[0].strip()   # e.g. mcqueen_0000
        text  = parts[1].strip()   # transcription
        # Reconstruct absolute wav path
        audio_abs = str(DATASET_DIR / "wavs" / f"{fname}.wav")
        rows.append({
            "audio_file": audio_abs,
            "text": text,
            "speaker_name": "mcqueen",
        })

if len(rows) < 2:
    print(f"[ERROR] Only {len(rows)} samples found. Need at least 2.")
    sys.exit(1)

# Split: last 1 sample for eval, rest for train
eval_rows  = rows[-1:]
train_rows = rows[:-1]

TRAIN_CSV = str(DATASET_DIR / "train.csv")
EVAL_CSV  = str(DATASET_DIR / "eval.csv")

for fpath, data in [(TRAIN_CSV, train_rows), (EVAL_CSV, eval_rows)]:
    with open(fpath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["audio_file", "text", "speaker_name"], delimiter="|")
        writer.writeheader()
        writer.writerows(data)

print(f"  Train: {len(train_rows)} samples -> {TRAIN_CSV}")
print(f"  Eval : {len(eval_rows)} samples  -> {EVAL_CSV}")

# ─── DOWNLOAD REQUIRED FILES ─────────────────────────────────────────────────
from TTS.utils.manage import ModelManager

BASE_MODEL_DIR = Path(os.path.expanduser("~")) / "AppData/Local/tts/tts_models--multilingual--multi-dataset--xtts_v2"

# Use local already-downloaded model files
XTTS_CHECKPOINT = str(BASE_MODEL_DIR / "model.pth")
TOKENIZER_FILE  = str(BASE_MODEL_DIR / "vocab.json")
XTTS_CONFIG_FILE = str(BASE_MODEL_DIR / "config.json")

# DVAE and mel_stats need to be downloaded separately (not in the base model)
DVAE_CHECKPOINT = str(CHECKPTS_DIR / "dvae.pth")
MEL_NORM_FILE   = str(CHECKPTS_DIR / "mel_stats.pth")

DVAE_LINK    = "https://coqui.gateway.scarf.sh/hf-coqui/XTTS-v2/main/dvae.pth"
MEL_NORM_LINK = "https://coqui.gateway.scarf.sh/hf-coqui/XTTS-v2/main/mel_stats.pth"

if not os.path.isfile(DVAE_CHECKPOINT) or not os.path.isfile(MEL_NORM_FILE):
    print("[Setup] Downloading DVAE + mel_stats files (~50MB)...")
    ModelManager._download_model_files([MEL_NORM_LINK, DVAE_LINK], str(CHECKPTS_DIR), progress_bar=True)
else:
    print("[Setup] DVAE + mel_stats already present.")

# ─── IMPORT TRAINING API ──────────────────────────────────────────────────────
from trainer import Trainer, TrainerArgs
from TTS.config.shared_configs import BaseDatasetConfig
from TTS.tts.datasets import load_tts_samples
from TTS.tts.layers.xtts.trainer.gpt_trainer import GPTArgs, GPTTrainer, GPTTrainerConfig, XttsAudioConfig

print(f"\n[Fine-tune] Device: {'CUDA' if torch.cuda.is_available() else 'CPU'}")
if torch.cuda.is_available():
    print(f"[Fine-tune] GPU: {torch.cuda.get_device_name(0)}")

# ─── DATASET CONFIG ───────────────────────────────────────────────────────────
dataset_config = BaseDatasetConfig(
    formatter="coqui",
    dataset_name="mcqueen",
    path=str(DATASET_DIR) + "/",
    meta_file_train=TRAIN_CSV,
    meta_file_val=EVAL_CSV,
    language=LANGUAGE,
)

# ─── MODEL ARGS ───────────────────────────────────────────────────────────────
model_args = GPTArgs(
    max_conditioning_length=132300,   # 6 secs at 22050Hz
    min_conditioning_length=66150,    # 3 secs at 22050Hz
    debug_loading_failures=False,
    max_wav_length=MAX_AUDIO_LEN,
    max_text_length=200,
    mel_norm_file=MEL_NORM_FILE,
    dvae_checkpoint=DVAE_CHECKPOINT,
    xtts_checkpoint=XTTS_CHECKPOINT,
    tokenizer_file=TOKENIZER_FILE,
    gpt_num_audio_tokens=1026,
    gpt_start_audio_token=1024,
    gpt_stop_audio_token=1025,
    gpt_use_masking_gt_prompt_approach=True,
    gpt_use_perceiver_resampler=True,
)

audio_config = XttsAudioConfig(
    sample_rate=22050,
    dvae_sample_rate=22050,
    output_sample_rate=24000,
)

config = GPTTrainerConfig(
    epochs=EPOCHS,
    output_path=str(OUTPUT_DIR),
    model_args=model_args,
    run_name="McQueen_XTTS_FT",
    project_name="XTTS_McQueen",
    dashboard_logger="tensorboard",
    audio=audio_config,
    batch_size=BATCH_SIZE,
    batch_group_size=48,
    eval_batch_size=1,
    num_loader_workers=0,          # Windows: must be 0
    eval_split_max_size=1,
    print_step=10,
    plot_step=50,
    log_model_step=100,
    save_step=500,
    save_n_checkpoints=2,
    save_checkpoints=True,
    print_eval=False,
    optimizer="AdamW",
    optimizer_wd_only_on_weights=True,
    optimizer_params={"betas": [0.9, 0.96], "eps": 1e-8, "weight_decay": 1e-2},
    lr=LR,
    lr_scheduler="MultiStepLR",
    lr_scheduler_params={"milestones": [50000, 150000, 300000], "gamma": 0.5, "last_epoch": -1},
    test_sentences=[],
    mixed_precision=False,  # FP32 - FP16 causes NaN on small datasets
)

# ─── LOAD MODEL AND SAMPLES ───────────────────────────────────────────────────
print("[Fine-tune] Initializing GPTTrainer from config...")
model = GPTTrainer.init_from_config(config)

print("[Fine-tune] Loading training samples...")
train_samples, eval_samples = load_tts_samples(
    [dataset_config],
    eval_split=True,
    eval_split_max_size=1,
    eval_split_size=0.1,
)
print(f"[Fine-tune] Train: {len(train_samples)} | Eval: {len(eval_samples)}")

# ─── TRAIN ────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"  Starting XTTS v2 GPT Fine-Tuning for Lightning McQueen!")
print(f"  Epochs: {EPOCHS} | Batch: {BATCH_SIZE} | Grad Accum: {GRAD_ACCUM}")
print(f"  LR: {LR} | Output: {OUTPUT_DIR}")
print(f"{'='*60}\n")

trainer = Trainer(
    TrainerArgs(
        restore_path=None,
        skip_train_epoch=False,
        start_with_eval=False,
        grad_accum_steps=GRAD_ACCUM,
    ),
    config,
    output_path=str(OUTPUT_DIR),
    model=model,
    train_samples=train_samples,
    eval_samples=eval_samples,
)

trainer.fit()

# Get best speaker reference
samples_len = [len(item["text"].split(" ")) for item in train_samples]
speaker_ref = train_samples[samples_len.index(max(samples_len))]["audio_file"]

print(f"\n[Fine-tune] DONE!")
print(f"Checkpoint dir   : {trainer.output_path}")
print(f"Speaker reference: {speaker_ref}")
print(f"\nUpdate xtts_server.py to load: {trainer.output_path}/best_model.pth")

del model, trainer, train_samples, eval_samples
gc.collect()
