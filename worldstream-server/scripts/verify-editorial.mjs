import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { publicEvents } from '../src/fixture.mjs';
import { EDITORIAL_REVISION } from '../src/editorial.mjs';

const root = new URL('../', import.meta.url), output = new URL('artifacts/editorial-review/', root);
mkdirSync(output, { recursive: true });
const digest = text => createHash('sha256').update(text).digest('hex');
const baselineRoot = 'artifacts/2026-09-06T01-10-34-032Z/';
const variants = ['A-frequent', 'B-one-absence', 'C-process-restarts', 'D-duplicates', 'E-concurrent'];
const results = [];
let baseline, publicDigest;
for (const variant of variants) {
  const snapshot = JSON.parse(readFileSync(new URL(`${baselineRoot}${variant}/semantic-snapshot-private.json`, root), 'utf8'));
  const projected = publicEvents(snapshot, Infinity), edition = digest(JSON.stringify(projected));
  baseline ??= snapshot; publicDigest ??= edition;
  assert.equal(edition, publicDigest);
  results.push({ variant, semanticDigest: semanticDigest(snapshot), publicEditionDigest: edition });
}
const world = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-09-04', '00:00') });
let replay;
try {
  world.advance(atLondon('2026-09-09', '00:00'));
  replay = semanticDigest(world.semanticSnapshot());
  assert.equal(replay, semanticDigest(baseline), 'Editorial code changed simulation');
  for (let i = 0; i < 10; i++) { world.publicProjection(); world.publicHistory(); }
  assert.equal(semanticDigest(world.semanticSnapshot()), replay, 'Reading changed history');
} finally { world.close(); }
const db = new DatabaseSync(fileURLToPath(new URL('data/worldstream-final-review-v21/world.sqlite', root)), { readOnly: true });
const ledger = db.prepare('SELECT seq,semantic_json FROM events ORDER BY seq').all(); db.close();
const live = { prefixThroughSeq: ledger.at(-1).seq, count: ledger.length,
  hash: digest(JSON.stringify(ledger)) };
const current = ledger.map(row => JSON.parse(row.semantic_json)).filter(row => row.visibility === 'public');
const types = ['UNEASE', 'INCIDENT', 'INTENT_COMPLETE', 'SUPPORTING_OUTCOME', 'SUPPORTING_CALLBACK',
  'THREAD_DELIVERY_DECIDE', 'OUTING_CUT_SHORT', 'TRAVEL_ARRIVE', 'ARCANE_SURGE', 'NIGHT_CALL', 'NIGHT_WORK_END', 'NIGHT_RETURN'];
const examples = types.flatMap(type => {
  const source = (type === 'UNEASE' ? current : baseline.events).find(row => row.type === type
    && row.visibility === 'public' && (type !== 'UNEASE' || row.payload?.kind === 'ink_relocation'));
  if (!source) return [];
  const rendered = publicEvents({ events: [source] })[0];
  return [{ id: source.id, type, occurredAt: source.occurredAt, old: source.prose ?? source.publicDescription,
    description: rendered.description, prose: rendered.prose ?? null }];
});
const revised = publicEvents(baseline, Infinity).filter(row => {
  const original = baseline.events.find(event => event.id === row.id);
  return row.description !== original.publicDescription || row.prose !== original.prose;
}).length;
const report = { revision: EDITORIAL_REVISION, result: 'PASS', variants: results, freshReplayDigest: replay,
  coreEngineSha256: digest(readFileSync(new URL('../experiment-l/src/world.mjs', root))),
  revisedPublicEventsInFiveDays: revised, liveLedgerBeforeRestart: live, examples };
writeFileSync(new URL('comparison.json', output), JSON.stringify(report, null, 2) + '\n');
writeFileSync(new URL('before-and-after.md', output), '# Worldstream prose revision\n\nDisplay wording only. Event IDs and consequences are unchanged.\n\n'
  + examples.map(row => `## ${row.type}\n\n${row.id}\n\nBefore: ${row.old}\n\nAfter: ${row.prose ?? row.description}\n`).join('\n'));
console.log(JSON.stringify({ result: report.result, revision: report.revision, revisedPublicEvents: revised,
  matchedHistoryVariants: results.length, freshReplayDigest: replay, coreEngineSha256: report.coreEngineSha256,
  report: fileURLToPath(new URL('comparison.json', output)) }));
