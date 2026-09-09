import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Build-time transcription only. Runtime never reads the workshop or Markdown.
const input = process.argv[2];
if (!input) throw new Error('Pass the creator-authored SCENE-BANK.md path');
const source = readFileSync(input, 'utf8').replaceAll('\r\n', '\n');
const starts = [...source.matchAll(/^### ([A-Z]\d+) · (.+)$/gm)];
const speakers = { ASHAI:'ashai', GOADEN:'goaden', DAVIS:'davis', HENDERSON:'henderson',
  EMILY:'emily', YUKON:'yukon', GREAH:'greah', SPRITE:'sprite_orange', 'SECOND SPRITE':'sprite_shades',
  SPRITES:'sprite_orange', STRANGER:'stranger', ENVOY:'envoy', CUSTOMER:'customer',
  OPERATIVE:'operative', MAN:'syndicate_man', INSPECTOR:'inspector', 'GOADEN & YUKON':'goaden' };
const clean = value => value.replaceAll('*', '').replace(/\s+/g, ' ').trim();
const records = starts.map((match, index) => {
  const end = starts[index + 1]?.index ?? source.length;
  const block = source.slice(match.index + match[0].length, end).trim();
  const [setting, ...rest] = block.split('\n');
  const paragraphs = rest.join('\n').split(/\n\s*\n/);
  const beats = [];
  for (const paragraph of paragraphs) {
    const p = paragraph.trim();
    if (!p) continue;
    if (/^(?:---|#|\*(?!\*))/.test(p)) break;
    // Some short scenes put successive speakers on adjacent lines.
    for (const piece of p.split(/\n(?=\*\*[A-Z"“])/)) {
      const dialogue = piece.match(/^\*\*(.+?):\*\*\s*([\s\S]*)$/);
      if (!dialogue) { beats.push({kind:'prose', text:clean(piece)}); continue; }
      const label = dialogue[1], imitation = /as ([^)]+)/.exec(label)?.[1] ?? (label.includes('"EMILY"') ? 'Emily' : null);
      const key = imitation ? 'YUKON' : label;
      const directions = [...dialogue[2].matchAll(/\*\(([^)]+)\)\*/g)].map(m => m[1]);
      beats.push({kind:'dialogue', who:speakers[key] ?? key.toLowerCase(),
        text:clean(dialogue[2].replace(/\*\([^)]+\)\*/g, '')), ...(directions.length ? {directions} : {}),
        ...(imitation ? {imitation} : {})});
    }
  }
  return {id:match[1], title:clean(match[2].replace(/`[^`]+`/g, '').replace(/\*\(ORIGINAL[^)]+\)\*/g, '')),
    setting, stage:/`(WEEK \d+|MONTH \d+)`/.exec(match[2])?.[1] ?? null,
    sourceLine:source.slice(0, match.index).split('\n').length, original:/ORIGINAL/.test(match[2]), beats};
});
const destination = fileURLToPath(new URL('../src/scene-bank-data.mjs', import.meta.url));
writeFileSync(destination, '// Creator-authored scene bank, transcribed at build time on 2026-09-09.\n'
  + '// Runtime eligibility and canon corrections live in scene-bank-catalog.mjs.\n'
  + 'export const SCENE_BANK_SOURCE = Object.freeze(' + JSON.stringify(records, null, 2) + ');\n');
process.stdout.write(`${records.length} source scenes transcribed.\n`);
