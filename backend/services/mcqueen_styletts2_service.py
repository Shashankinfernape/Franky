import sys
import os
import io
import torch
import torchaudio
import yaml
import math
import nltk
from nltk.tokenize import word_tokenize
from munch import munchify

# Add StyleTTS2 to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'StyleTTS2')))

# Monkeypatch torch.load for PyTorch 2.6+
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

class McQueenStyleTTS2Engine:
    def __init__(self):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.is_loaded = False
        self.model = None
        self.sampler = None
        self.text_cleaner = None
        self.global_phonemizer = None
        self._init_model()

    def _init_model(self):
        try:
            from models import build_model, load_ASR_models, load_F0_models
            from Utils.PLBERT.util import load_plbert
            from Modules.diffusion.sampler import DiffusionSampler, ADPM2Sampler, KarrasSchedule
            from text_utils import TextCleaner
            from phonemizer.backend import EspeakBackend

            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
            config_path = os.path.join(base_dir, 'mcqueen_styletts2', 'config.yml')
            ckpt_path = os.path.join(base_dir, 'mcqueen_styletts2', 'mcqueen_model_pruned.pth')

            if not os.path.exists(ckpt_path):
                print(f"[McQueen StyleTTS2] Checkpoint not found at {ckpt_path}")
                return

            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)

            style_dir = os.path.join(base_dir, 'StyleTTS2')
            config['ASR_path'] = os.path.join(style_dir, 'Utils', 'ASR', 'epoch_00080.pth')
            config['ASR_config'] = os.path.join(style_dir, 'Utils', 'ASR', 'config.yml')
            config['F0_path'] = os.path.join(style_dir, 'Utils', 'JDC', 'bst.t7')
            config['PLBERT_dir'] = os.path.join(style_dir, 'Utils', 'PLBERT') + '/'

            text_aligner = load_ASR_models(config['ASR_path'], config['ASR_config'])
            pitch_extractor = load_F0_models(config['F0_path'])
            plbert = load_plbert(config['PLBERT_dir'])

            def recursive_munch(d):
                if isinstance(d, dict):
                    return munchify({k: recursive_munch(v) for k, v in d.items()})
                return d

            self.model = build_model(recursive_munch(config['model_params']), text_aligner, pitch_extractor, plbert)
            params = torch.load(ckpt_path, map_location='cpu')

            if 'net' in params:
                params = params['net']

            for key in self.model:
                if key in params:
                    try:
                        state_dict = params[key]
                        new_state_dict = { (k.replace('module.', '') if k.startswith('module.') else k): v for k, v in state_dict.items() }
                        self.model[key].load_state_dict(new_state_dict, strict=False)
                    except Exception:
                        pass

            _ = [self.model[key].eval().to(self.device) for key in self.model]

            self.sampler = DiffusionSampler(
                self.model.diffusion.diffusion,
                sampler=ADPM2Sampler(),
                sigma_schedule=KarrasSchedule(sigma_min=0.0001, sigma_max=3.0, rho=9.0),
                clamp=False
            )

            self.text_cleaner = TextCleaner()

            try:
                self.global_phonemizer = EspeakBackend(language='en-us', preserve_punctuation=True, with_stress=True)
            except Exception:
                self.global_phonemizer = None

            try:
                nltk.download('punkt', quiet=True)
                nltk.download('punkt_tab', quiet=True)
            except Exception:
                pass

            self.is_loaded = True
            print(f"[McQueen StyleTTS2] Loaded fine-tuned McQueen voice model successfully on {self.device}!")
        except Exception as e:
            print(f"[McQueen StyleTTS2] Failed to initialize model: {e}")
            self.is_loaded = False

    def synthesize_wav_bytes(self, text: str) -> bytes:
        if not self.is_loaded or not self.model:
            raise RuntimeError("McQueen StyleTTS2 model is not loaded")

        text = text.strip().replace('"', '')
        if self.global_phonemizer:
            ps = self.global_phonemizer.phonemize([text])
            ps = word_tokenize(ps[0])
            ps = ' '.join(ps)
        else:
            ps = text

        tokens = self.text_cleaner(ps)
        tokens.insert(0, 0)
        tokens = torch.LongTensor(tokens).to(self.device).unsqueeze(0)

        def length_to_mask(lengths):
            mask = torch.arange(lengths.max()).unsqueeze(0).expand(lengths.shape[0], -1).type_as(lengths)
            mask = torch.gt(mask + 1, lengths.unsqueeze(1))
            return mask

        with torch.no_grad():
            input_lengths = torch.LongTensor([tokens.shape[-1]]).to(self.device)
            text_mask = length_to_mask(input_lengths).to(self.device)

            t_en = self.model.text_encoder(tokens, input_lengths, text_mask)
            bert_dur = self.model.bert(tokens, attention_mask=(~text_mask).int())
            d_en = self.model.bert_encoder(bert_dur).transpose(-1, -2)

            noise = torch.randn(1, 1, 256).to(self.device)
            s_pred = self.sampler(
                noise,
                embedding=bert_dur[0].unsqueeze(0),
                num_steps=10,
                embedding_scale=1.5
            ).squeeze(0)

            s = s_pred[:, 128:]
            ref = s_pred[:, :128]

            d = self.model.predictor.text_encoder(d_en, s, input_lengths, text_mask)
            x, _ = self.model.predictor.lstm(d)
            duration = self.model.predictor.duration_proj(x)
            duration = torch.sigmoid(duration).sum(axis=-1)
            pred_dur = torch.round(duration.squeeze()).clamp(min=1)
            pred_dur[-1] += 5

            pred_aln_trg = torch.zeros(input_lengths.item(), int(pred_dur.sum().data)).to(self.device)
            c_frame = 0
            for i in range(pred_aln_trg.size(0)):
                pred_aln_trg[i, c_frame:c_frame + int(pred_dur[i].data)] = 1
                c_frame += int(pred_dur[i].data)

            en = (d.transpose(-1, -2) @ pred_aln_trg.unsqueeze(0).to(self.device))
            F0_pred, N_pred = self.model.predictor.F0Ntrain(en, s)
            out = self.model.decoder(
                (t_en @ pred_aln_trg.unsqueeze(0).to(self.device)),
                F0_pred, N_pred, ref.squeeze().unsqueeze(0)
            )

            buf = io.BytesIO()
            torchaudio.save(buf, out.squeeze().cpu().unsqueeze(0), 24000, format="wav")
            buf.seek(0)
            return buf.read()

mcqueen_styletts2_engine = McQueenStyleTTS2Engine()
