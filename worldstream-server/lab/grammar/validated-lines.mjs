import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { quip } from '../engine/grammar.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadUnits() {
  const files = [
    resolve(root, 'data/moment-grammar-batch-02-staged.json'),
    resolve(root, 'data/moment-grammar-batch-03-staged.json'),
    resolve(root, '../../WORLDSTREAM_CANON_CONTENT_MEGA_BATCH_04/WORLDSTREAM_MOMENT_GRAMMAR_BATCH_03.json'),
  ];
  const units = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const json = JSON.parse(readFileSync(file, 'utf8'));
    units.push(...(json.entries ?? json.units ?? []));
  }
  return units;
}

const existingText = entry => (typeof entry === 'string' ? entry : entry?.text ?? '').normalize('NFKC').trim();

/**
 * Add validated Moment-grammar lines onto surfaces the engine already owns.
 * Unknown characters or unknown surfaces are skipped; no semantic action is invented.
 */
export function applyValidatedMomentGrammar(CAST) {
  const added = [];
  const skipped = [];
  for (const unit of loadUnits()) {
    if (unit.valid === false) { skipped.push({ id: unit.id, reason: 'marked invalid' }); continue; }
    const character = unit.character;
    const surface = unit.surface || unit.original_surface;
    const line = (unit.line || unit.text || '').trim();
    if (!character || !surface || !line) continue;
    const grammar = CAST.get(character);
    if (!grammar) { skipped.push({ id: unit.id, reason: `unknown character ${character}` }); continue; }
    const bank = grammar.quips?.[surface];
    if (!Array.isArray(bank)) { skipped.push({ id: unit.id, reason: `unknown surface ${character}/${surface}` }); continue; }
    if (bank.some(entry => existingText(entry) === line.normalize('NFKC').trim())) continue;
    bank.push(quip(line));
    added.push({ id: unit.id, character, surface });
  }
  return { added: added.length, skipped: skipped.length };
}

export const VALIDATED_MOMENT_GRAMMAR_REPORT = { added: 0, skipped: 0 };
