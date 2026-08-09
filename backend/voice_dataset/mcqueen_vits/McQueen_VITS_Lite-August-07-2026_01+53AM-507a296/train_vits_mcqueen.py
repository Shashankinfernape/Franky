"""
McQueen VITS Lite Trainer
--------------------------
Trains a single-speaker Coqui VITS model on Lightning McQueen's 15 audio clips.
The output is a lightweight (~35 MB) model that runs in real-time on a CPU.

Usage:
    .\\venv_coqui\\Scripts\\python.exe train_vits_mcqueen.py

Output:
    voice_dataset/mcqueen_vits/best_model.pth  (~35 MB)
    voice_dataset/mcqueen_vits/config.json
"""

import os, sys, csv
os.environ["COQUI_TOS_AGREED"] = "1"

from pathlib import Path
from trainer import Trainer, TrainerArgs

from TTS.config.shared_configs import BaseDatasetConfig
from TTS.tts.configs.vits_config import VitsConfig
from TTS.tts.datasets import load_tts_samples
from TTS.tts.models.vits import Vits, VitsAudioConfig, VitsArgs
from TTS.tts.utils.text.tokenizer import TTSTokenizer
from TTS.utils.audio import AudioProcessor

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
DATASET_DIR = BASE_DIR / "voice_dataset" / "finetune_dataset"
OUTPUT_DIR  = BASE_DIR / "voice_dataset" / "mcqueen_vits"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

META_CSV   = DATASET_DIR / "metadata.csv"
TRAIN_CSV  = str(OUTPUT_DIR / "train.csv")
EVAL_CSV   = str(OUTPUT_DIR / "eval.csv")

print(f"[VITS Trainer] Dataset : {DATASET_DIR}")
print(f"[VITS Trainer] Output  : {OUTPUT_DIR}")
print(f"[VITS Trainer] Clips   : {len(list((DATASET_DIR / 'wavs').glob('*.wav')))}")

# ── Split metadata into train/eval CSVs (13 train, 2 eval) ───────────────────
rows = []
with open(META_CSV, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        parts = line.split("|")
        if len(parts) < 2:
            continue
        audio_abs = str(DATASET_DIR / "wavs" / f"{parts[0].strip()}.wav")
        rows.append({"audio_file": audio_abs, "text": parts[1].strip(), "speaker_name": "mcqueen"})

eval_rows  = rows[-2:]   # last 2 clips for eval
train_rows = rows[:-2]   # remaining 13 for training

for fpath, data in [(TRAIN_CSV, train_rows), (EVAL_CSV, eval_rows)]:
    with open(fpath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["audio_file", "text", "speaker_name"], delimiter="|")
        writer.writeheader()
        writer.writerows(data)

print(f"[VITS Trainer] Train: {len(train_rows)} samples | Eval: {len(eval_rows)} samples")

# ── Audio config (must match dataset sample rate: 22050) ──────────────────────
audio_config = VitsAudioConfig(
    sample_rate=22050,
    win_length=1024,
    hop_length=256,
    num_mels=80,
    mel_fmin=0,
    mel_fmax=None,
)

# ── VITS model config ─────────────────────────────────────────────────────────
config = VitsConfig(
    audio=audio_config,
    run_name="McQueen_VITS_Lite",
    run_description="Lightweight McQueen voice - trained on Owen Wilson game clips",
    batch_size=4,
    eval_batch_size=2,
    batch_group_size=5,
    num_loader_workers=0,        # must be 0 on Windows (no fork support)
    num_eval_loader_workers=0,   # must be 0 on Windows
    run_eval=True,
    test_delay_epochs=-1,
    epochs=2000,
    save_step=500,
    save_best_after=200,
    save_checkpoints=True,
    target_loss="loss_1",
    print_step=25,
    mixed_precision=False,
    output_path=str(OUTPUT_DIR),
    datasets=[BaseDatasetConfig(
        formatter="coqui",
        dataset_name="mcqueen_clips",
        path=str(DATASET_DIR) + "/",
        meta_file_train=TRAIN_CSV,
        meta_file_val=EVAL_CSV,
        language="en",
    )],
    # Phoneme config
    use_phonemes=True,
    phoneme_language="en-us",
    phoneme_cache_path=str(OUTPUT_DIR / "phoneme_cache"),
    compute_input_seq_cache=True,
    add_blank=True,
    text_cleaner="english_cleaners",
    # VITS model args — use exact param names for this version of Coqui TTS
    model_args=VitsArgs(
        use_sdp=True,                           # Stochastic Duration Predictor — better timing
        noise_scale=0.667,
        noise_scale_dp=1.0,
        length_scale=1.0,
        hidden_channels=192,
        hidden_channels_ffn_text_encoder=768,
        num_heads_text_encoder=2,
        num_layers_text_encoder=6,
        kernel_size_text_encoder=3,
        dropout_p_text_encoder=0.1,
        dropout_p_duration_predictor=0.5,
        resblock_type_decoder="1",
        resblock_kernel_sizes_decoder=[3, 7, 11],
        resblock_dilation_sizes_decoder=[[1, 3, 5], [1, 3, 5], [1, 3, 5]],
        upsample_rates_decoder=[8, 8, 2, 2],
        upsample_initial_channel_decoder=512,
        upsample_kernel_sizes_decoder=[16, 16, 4, 4],
        use_speaker_embedding=False,            # single speaker only
    ),
    # Optimizer
    lr=0.0002,
    lr_scheduler="ExponentialLR",
    lr_scheduler_params={"gamma": 0.99875, "last_epoch": -1},
    lr_disc=0.0002,
    lr_scheduler_disc="ExponentialLR",
    lr_scheduler_disc_params={"gamma": 0.99875, "last_epoch": -1},
    # Test sentences spoken after training
    test_sentences=[
        "Ka-chow! I am speed.",
        "Turn right to go left. Respect the curve.",
        "Float like a Cadillac, sting like a Beemer!",
        "I am Lightning McQueen and I can do this.",
    ],
)

# ── Load dataset ──────────────────────────────────────────────────────────────
ap = AudioProcessor.init_from_config(config)
tokenizer, config = TTSTokenizer.init_from_config(config)

train_samples, eval_samples = load_tts_samples(
    config.datasets,
    eval_split=True,
)

print(f"[VITS Trainer] Train samples : {len(train_samples)}")
print(f"[VITS Trainer] Eval  samples : {len(eval_samples)}")

# ── Init model ────────────────────────────────────────────────────────────────
model = Vits(config, ap, tokenizer, speaker_manager=None)

# ── Train ─────────────────────────────────────────────────────────────────────
trainer = Trainer(
    TrainerArgs(
        restore_path=None,
        skip_train_epoch=False,
        use_ddp=False,
    ),
    config,
    output_path=str(OUTPUT_DIR),
    model=model,
    train_samples=train_samples,
    eval_samples=eval_samples,
)

if __name__ == '__main__':
    print("\n[VITS Trainer] 🏎️  Starting McQueen VITS Lite training — 2000 epochs")
    print("[VITS Trainer] Expected duration: ~30–60 minutes on GPU\n")
    trainer.fit()
    print("\n[VITS Trainer] ✅ Training complete!")
    print(f"[VITS Trainer] Best model saved to: {OUTPUT_DIR}")
