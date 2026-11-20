// Animates script.json scene by scene on a canvas, pipes the frames into ffmpeg
// and lays the voiceover underneath. Output: projects/<slug>/out/reel.mp4
//
//   node src/render.mjs <slug>            full render
//   node src/render.mjs <slug> --preview  one still per scene (out/preview-XX.png)
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { projectDir, loadScript, sceneDurations, audioPath, run, pad, isMain, cliArgs } from './lib.mjs';

const W = 1080;
const H = 1920;
const FPS = 30;
const MARGIN = 110;

const FONT = {
  sans: '"Helvetica Neue", Helvetica, Arial, "DejaVu Sans", sans-serif',
  serif: 'Georgia, "Times New Roman", "DejaVu Serif", serif',
  mono: 'Menlo, Consolas, "DejaVu Sans Mono", monospace',
  stamp: 'Impact, "Arial Black", "Helvetica Neue", "DejaVu Sans", sans-serif',
};

const DEFAULT_THEME = { bg: '#F1ECE3', ink: '#141414', accent: '#E0262B', muted: '#8A857C', card: '#FFFFFF' };

// ── easing ────────────────────────────────────────────────────────────────
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;
const easeBack = (t) => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const progress = (t, start, len) => clamp((t - start) / len);

// ── text helpers ──────────────────────────────────────────────────────────
// "Warum ist *Essen* fade" → tokens; *word* is highlighted (red italic serif).
function tokenize(text) {
  const tokens = [];
  const re = /\*([^*]+)\*|(\S+)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) m[1].split(/\s+/).forEach((w) => tokens.push({ text: w, hl: true }));
    else tokens.push({ text: m[2], hl: false });
  }
  return tokens;
}

function headlineFont(tok, size) {
  return tok.hl ? `italic 500 ${size * 1.06}px ${FONT.serif}` : `bold ${size}px ${FONT.sans}`;
}

function wrapTokens(ctx, tokens, size, maxW) {
  const lines = [[]];
  let x = 0;
  ctx.font = `bold ${size}px ${FONT.sans}`;
  const space = ctx.measureText(' ').width;
  for (const tok of tokens) {
    ctx.font = headlineFont(tok, size);
    const w = ctx.measureText(tok.text).width;
    if (x > 0 && x + w > maxW) { lines.push([]); x = 0; }
    lines[lines.length - 1].push({ ...tok, w, x });
    x += w + space;
  }
  return lines;
}

function wrapPlain(ctx, text, maxW) {
  const lines = [''];
  for (const word of text.split(/\s+/)) {
    const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (ctx.measureText(test).width > maxW && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = test;
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ── scene parts ───────────────────────────────────────────────────────────
function drawBackground(ctx, theme) {
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.045)';
  for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) ctx.fillRect(x, y, 3, 3);
}

function drawLabel(ctx, theme, index, label, t) {
  ctx.globalAlpha = easeOut(progress(t, 0, 0.3));
  ctx.fillStyle = theme.muted;
  ctx.font = `34px ${FONT.mono}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`// ${pad(index)} · ${label}`, MARGIN, 230);
  ctx.globalAlpha = 1;
}

// Returns the y below the headline.
function drawHeadline(ctx, theme, text, t, size = 96) {
  if (!text) return 300;
  const lines = wrapTokens(ctx, tokenize(text), size, W - MARGIN * 2);
  const lh = size * 1.18;
  let y = 330 + size;
  lines.forEach((line, li) => {
    const p = easeOut(progress(t, 0.05 + li * 0.09, 0.45));
    ctx.globalAlpha = p;
    for (const tok of line) {
      ctx.font = headlineFont(tok, size);
      ctx.fillStyle = tok.hl ? theme.accent : theme.ink;
      ctx.fillText(tok.text, MARGIN + tok.x, y + (1 - p) * 50);
    }
    y += lh;
  });
  ctx.globalAlpha = 1;
  return y;
}

function drawStamp(ctx, theme, text, t, cy) {
  if (!text) return;
  const p = progress(t, 0.35, 0.45);
  if (p <= 0) return;
  // largest size (max 170px) at which the stamp fits inside the frame
  let size = 170;
  ctx.font = `900 ${size}px ${FONT.stamp}`;
  while (size > 60 && ctx.measureText(text).width + 80 > W - 2 * MARGIN) {
    size -= 6;
    ctx.font = `900 ${size}px ${FONT.stamp}`;
  }
  ctx.save();
  const tw = ctx.measureText(text).width;
  ctx.translate(W / 2, cy);
  ctx.rotate(-0.06);
  const s = 2.2 - 1.2 * easeBack(p);
  ctx.scale(s, s);
  ctx.globalAlpha = clamp(p * 3);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-tw / 2 - 40 + 14, -size * 0.62 + 14, tw + 80, size * 1.24);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(-tw / 2 - 40, -size * 0.62, tw + 80, size * 1.24);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 6);
  ctx.restore();
}

function drawBody(ctx, theme, text, t, top) {
  if (!text) return;
  ctx.font = `54px ${FONT.sans}`;
  const lines = wrapPlain(ctx, text, W - MARGIN * 2);
  lines.forEach((line, i) => {
    const p = easeOut(progress(t, 0.45 + i * 0.12, 0.5));
    ctx.globalAlpha = p;
    ctx.fillStyle = theme.ink;
    ctx.fillText(line, MARGIN, top + 80 + i * 74 + (1 - p) * 30);
  });
  ctx.globalAlpha = 1;
}

function drawList(ctx, theme, items = [], t, dur, top) {
  const n = items.length;
  if (!n) return;
  const gap = Math.min(0.9, (dur * 0.65) / n);
  const cardH = Math.min(150, (1500 - top - 40) / n - 24);
  items.forEach((item, i) => {
    const p = easeBack(progress(t, 0.4 + i * gap, 0.4));
    if (p <= 0) return;
    const y = top + 50 + i * (cardH + 24);
    const x = MARGIN + (1 - p) * 500;
    ctx.globalAlpha = clamp(p);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(ctx, x + 8, y + 8, W - MARGIN * 2, cardH, 22); ctx.fill();
    ctx.fillStyle = theme.card;
    roundRect(ctx, x, y, W - MARGIN * 2, cardH, 22); ctx.fill();
    const box = cardH - 36;
    ctx.fillStyle = i === n - 1 ? theme.accent : theme.ink;
    roundRect(ctx, x + 18, y + 18, box, box, 16); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${box * 0.7}px ${FONT.stamp}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x + 18 + box / 2, y + 18 + box / 2 + 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = theme.ink;
    ctx.font = `bold ${Math.min(52, cardH * 0.36)}px ${FONT.sans}`;
    ctx.fillText(item, x + 18 + box + 34, y + cardH / 2 + 4, W - MARGIN * 2 - box - 80);
    ctx.textBaseline = 'alphabetic';
  });
  ctx.globalAlpha = 1;
}

function drawStat(ctx, theme, stat = {}, t, top) {
  const p = easeOut(progress(t, 0.3, 1.3));
  const value = Number(stat.value) || 0;
  const decimals = String(stat.value).includes('.') ? 1 : 0;
  const shown = (value * p).toFixed(decimals).replace('.', ',');
  const cy = top + 330;
  ctx.globalAlpha = clamp(p * 4);
  ctx.textAlign = 'center';
  ctx.fillStyle = theme.accent;
  ctx.font = `900 300px ${FONT.stamp}`;
  ctx.fillText(`${stat.prefix || ''}${shown}${stat.suffix || ''}`, W / 2, cy, W - 120);
  ctx.fillStyle = theme.ink;
  ctx.font = `bold 54px ${FONT.sans}`;
  const lines = wrapPlain(ctx, stat.caption || '', W - MARGIN * 2);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, cy + 110 + i * 66));
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

// Word-by-word captions, 4 words at a time, the spoken word in red.
function drawCaptions(ctx, theme, text, t, dur) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const speak = Math.max(0.5, dur - 0.35);
  const weights = words.map((w) => w.length + 3);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  let current = words.length - 1;
  for (let i = 0; i < words.length; i++) {
    acc += weights[i];
    if (t < (acc / total) * speak) { current = i; break; }
  }
  const start = current - (current % 4);
  const chunk = words.slice(start, start + 4);
  ctx.font = `bold 58px ${FONT.sans}`;
  const space = ctx.measureText(' ').width;
  const widths = chunk.map((w) => ctx.measureText(w).width);
  const lineW = widths.reduce((a, b) => a + b, 0) + space * (chunk.length - 1);
  const scale = Math.min(1, (W - 120) / (lineW + 60));
  ctx.save();
  ctx.translate(W / 2, 1560);
  ctx.scale(scale, scale);
  let x = -lineW / 2;
  ctx.fillStyle = 'rgba(20,20,20,0.88)';
  roundRect(ctx, x - 30, -58, lineW + 60, 92, 20); ctx.fill();
  chunk.forEach((w, i) => {
    ctx.fillStyle = start + i === current ? theme.accent : '#fff';
    ctx.fillText(w, x, 10);
    x += widths[i] + space;
  });
  ctx.restore();
}

function drawProgress(ctx, theme, globalT, total) {
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, W * clamp(globalT / total), 10);
}

// ── frame ─────────────────────────────────────────────────────────────────
function drawFrame(ctx, script, theme, idx, t, dur, globalT, total) {
  const scene = script.scenes[idx];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  drawBackground(ctx, theme);
  drawLabel(ctx, theme, idx, scene.label || scene.type || 'scene', t);
  const below = drawHeadline(ctx, theme, scene.headline, t, scene.headlineSize || 96);
  switch (scene.type) {
    case 'title': drawStamp(ctx, theme, scene.stamp, t, Math.max(below + 260, 1000)); break;
    case 'list': drawList(ctx, theme, scene.items, t, dur, below); break;
    case 'stat': drawStat(ctx, theme, scene.stat, t, below); break;
    default: drawBody(ctx, theme, scene.body, t, below);
  }
  if (script.captions !== false) drawCaptions(ctx, theme, scene.voiceover, t, dur);
  drawProgress(ctx, theme, globalT, total);
  // quick fade-in at each scene start
  if (t < 0.12) {
    ctx.fillStyle = theme.bg;
    ctx.globalAlpha = 1 - t / 0.12;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ── audio track: each scene's voice, padded to its scene length ───────────
function buildAudio(dir, script, durs, outFile) {
  const args = ['-y', '-v', 'error'];
  const filters = [];
  script.scenes.forEach((_, i) => {
    const a = audioPath(dir, i);
    if (existsSync(a)) args.push('-i', a);
    else args.push('-f', 'lavfi', '-t', String(durs[i]), '-i', 'anullsrc=r=44100:cl=stereo');
    filters.push(`[${i}:a]aresample=44100,aformat=channel_layouts=stereo,apad,atrim=0:${durs[i].toFixed(3)}[a${i}]`);
  });
  const labels = script.scenes.map((_, i) => `[a${i}]`).join('');
  filters.push(`${labels}concat=n=${script.scenes.length}:v=0:a=1[out]`);
  args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', outFile);
  const r = run('ffmpeg', args);
  if (r.status !== 0) throw new Error(`Audio-Spur fehlgeschlagen:\n${r.stderr}`);
}

export async function render(slug, { preview = false } = {}) {
  const dir = projectDir(slug);
  const script = loadScript(dir);
  const theme = { ...DEFAULT_THEME, ...(script.theme || {}) };
  const durs = sceneDurations(dir, script);
  const total = durs.reduce((a, b) => a + b, 0);
  const outDir = path.join(dir, 'out');
  mkdirSync(outDir, { recursive: true });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const starts = durs.map((_, i) => durs.slice(0, i).reduce((a, b) => a + b, 0));

  if (preview) {
    script.scenes.forEach((_, i) => {
      const t = Math.min(durs[i] * 0.75, durs[i] - 0.1);
      drawFrame(ctx, script, theme, i, t, durs[i], starts[i] + t, total);
      writeFileSync(path.join(outDir, `preview-${pad(i)}.png`), canvas.toBuffer('image/png'));
    });
    console.log(`✔ ${script.scenes.length} Vorschaubilder in ${path.relative(process.cwd(), outDir)}/`);
    return;
  }

  const audioFile = path.join(outDir, 'voice.m4a');
  buildAudio(dir, script, durs, audioFile);
  const outFile = path.join(outDir, 'reel.mp4');
  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-i', audioFile,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-shortest', '-movflags', '+faststart', outFile,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg beendet mit Code ${code}`))));
  });

  const frames = Math.ceil(total * FPS);
  let scene = 0;
  for (let f = 0; f < frames; f++) {
    const g = f / FPS;
    while (scene < durs.length - 1 && g >= starts[scene + 1]) scene++;
    drawFrame(ctx, script, theme, scene, g - starts[scene], durs[scene], g, total);
    if (!ff.stdin.write(canvas.data())) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % FPS === 0) process.stdout.write(`\r  Rendern … ${Math.round((f / frames) * 100)}%`);
  }
  ff.stdin.end();
  await done;
  process.stdout.write('\r  Rendern … 100%\n');
  console.log(`✔ Fertig: ${path.relative(process.cwd(), outFile)} (${total.toFixed(1)} s)`);
}

if (isMain(import.meta.url)) {
  const { slug, flags } = cliArgs();
  render(slug, { preview: flags.has('--preview') }).catch((e) => {
    console.error('\n✖', e.message);
    process.exit(1);
  });
}
