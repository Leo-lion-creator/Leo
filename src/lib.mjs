// Shared helpers: project loading, env, durations, ffmpeg/ffprobe.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (existsSync(file)) {
    try { process.loadEnvFile(file); } catch { /* malformed .env – ignore */ }
  }
}

export function projectDir(slug) {
  if (!slug) throw new Error('Bitte Projektnamen angeben, z. B.: npm run make -- beispiel');
  const dir = path.join(ROOT, 'projects', slug);
  if (!existsSync(path.join(dir, 'script.json'))) {
    throw new Error(`Kein Skript gefunden: projects/${slug}/script.json`);
  }
  return dir;
}

export function loadScript(dir) {
  const script = JSON.parse(readFileSync(path.join(dir, 'script.json'), 'utf8'));
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('script.json braucht mindestens eine Szene in "scenes".');
  }
  return script;
}

export const pad = (i) => String(i + 1).padStart(2, '0');
export const audioPath = (dir, i) => path.join(dir, 'audio', `scene-${pad(i)}.mp3`);

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.error) throw r.error;
  return r;
}

export function has(cmd, args = ['-version']) {
  try { return run(cmd, args).status === 0; } catch { return false; }
}

export function mediaDuration(file) {
  const r = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const d = parseFloat(r.stdout);
  return Number.isFinite(d) ? d : null;
}

// Estimated speaking time when no voice file exists (≈ 2.6 words/second).
export function estimateDuration(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2.5, words / 2.6 + 0.6);
}

// Duration of every scene: voice length + a short breath, or an estimate.
export function sceneDurations(dir, script) {
  return script.scenes.map((s, i) => {
    if (s.duration) return s.duration;
    const a = audioPath(dir, i);
    const d = existsSync(a) ? mediaDuration(a) : null;
    return d ? d + 0.35 : estimateDuration(s.voiceover);
  });
}

// True when the file is run directly (works with spaces in paths, e.g. "AI Video Editor").
export function isMain(metaUrl) {
  return process.argv[1] && path.resolve(fileURLToPath(metaUrl)) === path.resolve(process.argv[1]);
}

// First non-flag CLI argument = project name; the rest are flags.
export function cliArgs() {
  const args = process.argv.slice(2);
  return { slug: args.find((a) => !a.startsWith('--')), flags: new Set(args.filter((a) => a.startsWith('--'))) };
}
