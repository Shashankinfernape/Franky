import sys
import os
import torch
import torchaudio
import yaml
import math
import nltk
from nltk.tokenize import word_tokenize
from munch import munchify

# Add StyleTTS2 to path
sys.path.append(os.path.abspath('backend/StyleTTS2'))

from models import build_model, load_ASR_models, load_F0_models
from Utils.PLBERT.util import load_plbert
from Modules.diffusion.sampler import DiffusionSampler, ADPM2Sampler, KarrasSchedule
from text_utils import TextCleaner
from phonemizer.backend import EspeakBackend

# Monkeypatch torch.load for PyTorch 2.6+
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Using device: {device}")

# Load config
config_path = 'backend/mcqueen_styletts2/config.yml'
with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

# Update paths relative to backend/StyleTTS2
config['ASR_path'] = 'backend/StyleTTS2/Utils/ASR/epoch_00080.pth'
config['ASR_config'] = 'backend/StyleTTS2/Utils/ASR/config.yml'
config['F0_path'] = 'backend/StyleTTS2/Utils/JDC/bst.t7'
config['PLBERT_dir'] = 'backend/StyleTTS2/Utils/PLBERT/'

print("Loading ASR & F0 models...")
text_aligner = load_ASR_models(config['ASR_path'], config['ASR_config'])
pitch_extractor = load_F0_models(config['F0_path'])
plbert = load_plbert(config['PLBERT_dir'])

def recursive_munch(d):
    if isinstance(d, dict):
        return munchify({k: recursive_munch(v) for k, v in d.items()})
    return d

print("Building StyleTTS2 model...")
model = build_model(recursive_munch(config['model_params']), text_aligner, pitch_extractor, plbert)

ckpt_path = 'backend/mcqueen_styletts2/mcqueen_model_pruned.pth'
print(f"Loading checkpoint: {ckpt_path}")
params = torch.load(ckpt_path, map_location='cpu')

if 'net' in params:
    params = params['net']

for key in model:
    if key in params:
        try:
            state_dict = params[key]
            new_state_dict = {}
            for k, v in state_dict.items():
                new_k = k.replace('module.', '') if k.startswith('module.') else k
                new_state_dict[new_k] = v
            model[key].load_state_dict(new_state_dict, strict=False)
        except Exception as e:
            print(f"Warning loading {key}: {e}")

_ = [model[key].eval() for key in model]
_ = [model[key].to(device) for key in model]
print("Model loaded successfully!")

# Setup Diffusion Sampler & TextCleaner
sampler = DiffusionSampler(
    model.diffusion.diffusion,
    sampler=ADPM2Sampler(),
    sigma_schedule=KarrasSchedule(sigma_min=0.0001, sigma_max=3.0, rho=9.0),
    clamp=False
)

text_cleaner = TextCleaner()

def length_to_mask(lengths):
    mask = torch.arange(lengths.max()).unsqueeze(0).expand(lengths.shape[0], -1).type_as(lengths)
    mask = torch.gt(mask + 1, lengths.unsqueeze(1))
    return mask

try:
    global_phonemizer = EspeakBackend(language='en-us', preserve_punctuation=True, with_stress=True)
except Exception as e:
    global_phonemizer = None

def synthesize(text, diffusion_steps=10, embedding_scale=1.5):
    text = text.strip().replace('"', '')
    if global_phonemizer:
        ps = global_phonemizer.phonemize([text])
        ps = word_tokenize(ps[0])
        ps = ' '.join(ps)
    else:
        ps = text

    tokens = text_cleaner(ps)
    tokens.insert(0, 0)
    tokens = torch.LongTensor(tokens).to(device).unsqueeze(0)

    with torch.no_grad():
        input_lengths = torch.LongTensor([tokens.shape[-1]]).to(device)
        text_mask = length_to_mask(input_lengths).to(device)

        t_en = model.text_encoder(tokens, input_lengths, text_mask)
        bert_dur = model.bert(tokens, attention_mask=(~text_mask).int())
        d_en = model.bert_encoder(bert_dur).transpose(-1, -2)

        noise = torch.randn(1, 1, 256).to(device)
        s_pred = sampler(
            noise,
            embedding=bert_dur[0].unsqueeze(0),
            num_steps=diffusion_steps,
            embedding_scale=embedding_scale
        ).squeeze(0)

        s = s_pred[:, 128:]
        ref = s_pred[:, :128]

        d = model.predictor.text_encoder(d_en, s, input_lengths, text_mask)

        x, _ = model.predictor.lstm(d)
        duration = model.predictor.duration_proj(x)
        duration = torch.sigmoid(duration).sum(axis=-1)
        pred_dur = torch.round(duration.squeeze()).clamp(min=1)
        pred_dur[-1] += 5

        pred_aln_trg = torch.zeros(input_lengths.item(), int(pred_dur.sum().data)).to(device)
        c_frame = 0
        for i in range(pred_aln_trg.size(0)):
            pred_aln_trg[i, c_frame:c_frame + int(pred_dur[i].data)] = 1
            c_frame += int(pred_dur[i].data)

        en = (d.transpose(-1, -2) @ pred_aln_trg.unsqueeze(0).to(device))
        F0_pred, N_pred = model.predictor.F0Ntrain(en, s)
        out = model.decoder(
            (t_en @ pred_aln_trg.unsqueeze(0).to(device)),
            F0_pred, N_pred, ref.squeeze().unsqueeze(0)
        )
        return out.squeeze().cpu()

test_text = "Kachow! I am Lightning McQueen, speed is my middle name!"
print(f"Synthesizing: '{test_text}'...")

try:
    nltk.download('punkt')
    nltk.download('punkt_tab')
except:
    pass

audio = synthesize(test_text)
out_path = "backend/mcqueen_styletts2_test.wav"
torchaudio.save(out_path, audio.unsqueeze(0), 24000)
print(f"SUCCESS! Audio saved to: {out_path}")
