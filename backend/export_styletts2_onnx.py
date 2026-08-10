import sys
import os
import torch
import torch.onnx
import yaml
from munch import munchify

sys.path.append(os.path.abspath('backend/StyleTTS2'))

from models import build_model, load_ASR_models, load_F0_models
from Utils.PLBERT.util import load_plbert

_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

device = 'cpu'

config_path = 'backend/mcqueen_styletts2/config.yml'
with open(config_path, 'r') as f:
    config = yaml.safe_load(f)

config['ASR_path'] = 'backend/StyleTTS2/Utils/ASR/epoch_00080.pth'
config['ASR_config'] = 'backend/StyleTTS2/Utils/ASR/config.yml'
config['F0_path'] = 'backend/StyleTTS2/Utils/JDC/bst.t7'
config['PLBERT_dir'] = 'backend/StyleTTS2/Utils/PLBERT/'

text_aligner = load_ASR_models(config['ASR_path'], config['ASR_config'])
pitch_extractor = load_F0_models(config['F0_path'])
plbert = load_plbert(config['PLBERT_dir'])

def recursive_munch(d):
    if isinstance(d, dict):
        return munchify({k: recursive_munch(v) for k, v in d.items()})
    return d

model = build_model(recursive_munch(config['model_params']), text_aligner, pitch_extractor, plbert)

ckpt_path = 'backend/mcqueen_styletts2/mcqueen_model_pruned.pth'
params = torch.load(ckpt_path, map_location='cpu')

if 'net' in params:
    params = params['net']

for key in model:
    if key in params:
        try:
            state_dict = params[key]
            new_state_dict = { (k.replace('module.', '') if k.startswith('module.') else k): v for k, v in state_dict.items() }
            model[key].load_state_dict(new_state_dict, strict=False)
        except Exception as e:
            pass

_ = [model[key].eval().to(device) for key in model]

print("Exporting Decoder to ONNX (Opset 17)...")
class DecoderONNX(torch.nn.Module):
    def __init__(self, decoder):
        super().__init__()
        self.decoder = decoder

    def forward(self, asr, F0, N, style):
        return self.decoder(asr, F0, N, style)

decoder_onnx = DecoderONNX(model.decoder)

dummy_asr = torch.randn(1, 512, 100)
dummy_F0 = torch.randn(1, 200)
dummy_N = torch.randn(1, 200)
dummy_style = torch.randn(1, 128)

onnx_out_path = "pixar_eye_system/public/voice/mcqueen_decoder.onnx"
os.makedirs(os.path.dirname(onnx_out_path), exist_ok=True)

torch.onnx.export(
    decoder_onnx,
    (dummy_asr, dummy_F0, dummy_N, dummy_style),
    onnx_out_path,
    input_names=['asr', 'F0', 'N', 'style'],
    output_names=['audio'],
    dynamic_axes={
        'asr': {2: 'time_asr'},
        'F0': {1: 'time_f0'},
        'N': {1: 'time_f0'},
        'audio': {1: 'samples'}
    },
    opset_version=17
)

print(f"✅ ONNX Decoder exported successfully to: {onnx_out_path}")
print(f"File size: {os.path.getsize(onnx_out_path) / 1e6:.2f} MB")
