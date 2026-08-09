const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules', '@mintplex-labs', 'piper-tts-web', 'dist', 'piper-tts-web.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  
  content = content.replace(
    /const HF_BASE = "https:\/\/huggingface\.co\/diffusionstudio\/piper-voices\/resolve\/main";/,
    'const HF_BASE = window.location.origin + "/voice";'
  );
  
  content = content.replace(
    /"en_US-hfc_female-medium": "en\/en_US\/hfc_female\/medium\/en_US-hfc_female-medium\.onnx"/,
    '"en_US-hfc_female-medium": "piper_voice.onnx"'
  );

  fs.writeFileSync(targetFile, content, 'utf8');
  console.log('Successfully patched piper-tts-web.js for local OPFS TTS!');
} else {
  console.warn('Could not find piper-tts-web.js to patch.');
}
