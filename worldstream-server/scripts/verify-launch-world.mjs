import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ARCS } from '../src/arcs.mjs';

// Check a launch-candidate world against the continuity rules that the review
// world broke. Read-only: it opens the database `readOnly` and never advances.
//
//     node worldstream-server/scripts/verify-launch-world.mjs [dbPath]

const HERE = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] ?? join(HERE, '..', 'data', 'launch-candidate', 'world.sqlite'));

const db = new DatabaseSync(target, { readOnly: true });
const events = db.prepare('SELECT semantic_json FROM events ORDER BY seq')
  .all().map(row => JSON.parse(row.semantic_json));
db.close();

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

console.log(`world   ${target}`);
console.log(`events  ${events.length}\n`);

// 1. Nobody in two places at once. A character's location is carried by the
//    ledger's `changes`, so the last change before any instant is where they
//    were; two different locations at the same instant is a contradiction.
const positions = new Map();          // who -> [{at, location}]
for (const event of events) {
  for (const change of event.changes ?? []) {
    if (change.entity !== 'character' || change.field !== 'location') continue;
    if (!positions.has(change.id)) positions.set(change.id, []);
    positions.get(change.id).push({ at: event.occurredAt, location: change.after });
  }
}
const conflicts = [];
for (const [who, moves] of positions) {
  const byInstant = new Map();
  for (const move of moves) {
    if (byInstant.has(move.at) && byInstant.get(move.at) !== move.location) {
      conflicts.push(`${who} at ${new Date(move.at).toISOString()}: ${byInstant.get(move.at)} and ${move.location}`);
    }
    byInstant.set(move.at, move.location);
  }
}
check('no character is placed in two locations at once', conflicts.length === 0, conflicts[0] ?? '');

// 2. No character-dependent arc beat while its subject was elsewhere. This is
//    the exact failure that put Ashai in the tattoo shop mid-training.
const gated = new Map();              // stage key -> { needs, location }
for (const arc of Object.values(ARCS)) {
  for (const stage of arc.stages ?? []) {
    if (stage.needs) gated.set(stage.key, { needs: stage.needs, location: stage.location ?? arc.location });
  }
}
/** Where `who` was at `at`, from the committed ledger alone. */
const whereWas = (who, at) => {
  let location = null;
  for (const event of events) {
    if (event.occurredAt > at) break;
    for (const change of event.changes ?? []) {
      if (change.entity === 'character' && change.id === who && change.field === 'location') location = change.after;
    }
  }
  return location;
};
const teleports = [];
for (const event of events.filter(item => item.type === 'ARC_BEAT')) {
  const rule = gated.get(event.payload?.stage);
  if (!rule) continue;
  const actual = whereWas(rule.needs, event.occurredAt);
  if (actual && actual !== rule.location) {
    teleports.push(`${event.payload.stage}: says ${rule.needs} at ${rule.location}, world had ${actual}`);
  }
}
check('no character-dependent arc beat fires while they are elsewhere',
  teleports.length === 0, teleports[0] ?? `${gated.size} gated stages checked`);

// 3. No duplicate prose — the same sentence as both passage and canonical line.
const duplicates = events.filter(event => event.prose && event.publicDescription
  && event.prose.trim() === event.publicDescription.trim());
check('no event repeats its prose as its description', duplicates.length === 0,
  duplicates.length ? `${duplicates.length} duplicated, e.g. ${duplicates[0].type}` : '');

// 4. The world actually ran: it has public narrative, not just bookkeeping.
const publicEvents = events.filter(event => event.visibility === 'public' && event.publicDescription);
check('the world produced public narrative', publicEvents.length > 0, `${publicEvents.length} public events`);

console.log(`\n${failures.length ? `${failures.length} FAILED` : 'all checks passed'}`);
process.exit(failures.length ? 1 : 0);
