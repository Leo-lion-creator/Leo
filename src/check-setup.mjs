// "check my setup": verifies Node, ffmpeg, the canvas library and the ElevenLabs key.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, loadEnv, has, run } from './lib.mjs';

loadEnv();
const results = [];
const add = (ok, name, role, detail, fix) => results.push({ ok, name, role, detail, fix });

// 1. Node.js
const [major, minor] = process.versions.node.split('.').map(Number);
add(major > 20 || (major === 20 && minor >= 12), 'Node.js', 'animate', `v${process.versions.node}`,
  'Node 20.12 oder neuer installieren: https://nodejs.org (LTS-Version)');

// 2. ffmpeg + ffprobe
const ff = has('ffmpeg') && has('ffprobe');
const ffVersion = ff ? run('ffmpeg', ['-version']).stdout.split('\n')[0].split(' ')[2] : 'fehlt';
add(ff, 'ffmpeg', 'render', ffVersion,
  process.platform === 'darwin' ? 'Im Terminal: brew install ffmpeg  (Homebrew: https://brew.sh)'
  : process.platform === 'win32' ? 'Im Terminal: winget install ffmpeg'
  : 'Im Terminal: sudo apt install ffmpeg');

// 3. npm dependencies (canvas)
let canvasOk = false;
try { await import('@napi-rs/canvas'); canvasOk = true; } catch { /* not installed */ }
add(canvasOk, 'Canvas', 'animate', canvasOk ? 'installiert' : 'fehlt', 'Im Projektordner: npm install');

// 4. ElevenLabs key (optional – without it reels render silently)
const key = process.env.ELEVENLABS_API_KEY;
let voiceDetail = 'fehlt';
let voiceOk = false;
if (key) {
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': key } });
    voiceOk = res.ok;
    voiceDetail = res.ok ? 'gültig' : `abgelehnt (HTTP ${res.status})`;
  } catch (e) {
    voiceDetail = `nicht prüfbar (${e.message})`;
  }
}
add(voiceOk, 'Voice key', 'voice', voiceDetail,
  [
    existsSync(path.join(ROOT, '.env')) ? null : 'cp .env.example .env',
    '1) https://elevenlabs.io/app/settings/api-keys öffnen',
    '2) "Create key" klicken (Recht: Text to Speech)',
    '3) Key in .env bei ELEVENLABS_API_KEY= eintragen',
  ].filter(Boolean).join('\n      '));

// Report
const okCount = results.filter((r) => r.ok).length;
console.log(`\nChecking your setup … ${okCount}/${results.length}\n`);
for (const r of results) {
  console.log(`${r.ok ? '✔' : '✖'} ${r.name.padEnd(10)} [${r.role}]  ${r.detail}`);
  if (!r.ok) console.log(`    → ${r.fix}`);
}
const required = results.filter((r) => r.name !== 'Voice key');
if (required.every((r) => r.ok)) {
  console.log(voiceOk
    ? '\nAlles bereit. Sag Claude einfach dein Thema.'
    : '\nRendern geht schon – ohne Voice key aber stumm (nur Untertitel).');
} else {
  console.log('\nBitte die markierten Punkte beheben und dann erneut prüfen.');
  process.exitCode = 1;
}
