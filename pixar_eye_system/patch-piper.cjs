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

const wasmDir = path.join(__dirname, 'public', 'voice', 'wasm');
if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
}

// Copy piper-wasm files
const piperBuild = path.join(__dirname, 'node_modules', '@diffusionstudio', 'piper-wasm', 'build');
if (fs.existsSync(piperBuild)) {
  fs.readdirSync(piperBuild).forEach(file => {
    if (file.endsWith('.wasm') || file.endsWith('.data')) {
      fs.copyFileSync(path.join(piperBuild, file), path.join(wasmDir, file));
    }
  });
}

// Copy onnxruntime-web files
const onnxDist = path.join(__dirname, 'node_modules', 'onnxruntime-web', 'dist');
if (fs.existsSync(onnxDist)) {
  fs.readdirSync(onnxDist).forEach(file => {
    if (file.endsWith('.wasm')) {
      fs.copyFileSync(path.join(onnxDist, file), path.join(wasmDir, file));
    }
  });
}
console.log('Successfully copied WASM files to public/voice/wasm/');
