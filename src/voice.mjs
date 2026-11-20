// Records one voiceover file per scene via ElevenLabs.
// Unchanged scenes are skipped (the text is cached next to each mp3).
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadEnv, projectDir, loadScript, audioPath, isMain, cliArgs } from './lib.mjs';

export async function recordVoice(slug, { force = false } = {}) {
  loadEnv();
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    console.log('ℹ Kein ELEVENLABS_API_KEY in .env – Voiceover wird übersprungen.');
    return false;
  }
  const voice = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const model = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
  const dir = projectDir(slug);
  const script = loadScript(dir);
  mkdirSync(path.join(dir, 'audio'), { recursive: true });

  for (const [i, scene] of script.scenes.entries()) {
    const text = (scene.voiceover || '').trim();
    const file = audioPath(dir, i);
    const cache = file.replace(/\.mp3$/, '.txt');
    if (!text) continue;
    if (!force && existsSync(file) && existsSync(cache) && readFileSync(cache, 'utf8') === text) {
      console.log(`  Szene ${i + 1}: unverändert`);
      continue;
    }
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3 },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`ElevenLabs Fehler bei Szene ${i + 1}: HTTP ${res.status} ${await res.text()}`);
    }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    writeFileSync(cache, text);
    console.log(`  Szene ${i + 1}: aufgenommen`);
  }
  return true;
}

if (isMain(import.meta.url)) {
  const { slug, flags } = cliArgs();
  recordVoice(slug, { force: flags.has('--force') }).catch((e) => {
    console.error('✖', e.message);
    process.exit(1);
  });
}
