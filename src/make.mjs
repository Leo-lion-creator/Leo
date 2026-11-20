// One command for the whole reel: voiceover (if a key is set) → animate → render.
//   npm run make -- <slug> [--no-voice] [--force-voice]
import { recordVoice } from './voice.mjs';
import { render } from './render.mjs';
import { cliArgs } from './lib.mjs';

const { slug, flags } = cliArgs();

try {
  if (!flags.has('--no-voice')) {
    console.log('🎙  Voiceover');
    await recordVoice(slug, { force: flags.has('--force-voice') });
  }
  console.log('🎬 Animieren & rendern');
  await render(slug);
} catch (e) {
  console.error('\n✖', e.message);
  process.exit(1);
}
