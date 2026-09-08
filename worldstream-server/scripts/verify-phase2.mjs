// Author evidence only: the existing A–E runner plus three episode endings.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { RULES_VERSION } from '../src/fixture.mjs';
import { THREAD_EVENT_TYPES } from '../src/threads.mjs';
import { atLondon } from '../src/time.mjs';

assert.equal(RULES_VERSION, 'canon-ambient-p183-v19', 'Phase 2 evidence requires v19 rules');
const root = fileURLToPath(new URL('../', import.meta.url));
const run = spawnSync(process.execPath, [join(root, 'src/run-verification.mjs')],
  { cwd: root, encoding: 'utf8', timeout: 180_000, windowsHide: true, maxBuffer: 2_000_000 });
if (run.status !== 0) throw new Error(run.stderr || run.stdout || run.error?.message || 'A–E verification failed');
const summaryAt = run.stdout.lastIndexOf('{\n  "result": "PASS"');
assert.ok(summaryAt >= 0, 'Verification runner did not report its artifact path');
const result = JSON.parse(run.stdout.slice(summaryAt));
const output = result.output;
const comparison = JSON.parse(readFileSync(join(output, 'comparison.json'), 'utf8'));
const baseline = JSON.parse(readFileSync(join(output, 'A-frequent/semantic-snapshot-private.json'), 'utf8'));
assert.equal(Object.values(baseline.threads.instances).length, 1);
assert.ok(Object.values(baseline.threads.instances)[0].result);
const json = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n');
const london = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/London', dateStyle:'short', timeStyle:'medium' });
const ledger = events => '| London time | Event ID | Event | Public description |\n|---|---|---|---|\n' + events.filter(e => THREAD_EVENT_TYPES.includes(e.type))
  .map(e => `| ${london.format(e.occurredAt)} | ${e.id} | ${e.type} | ${(e.publicDescription || '[private]').replaceAll('|', '/')} |`).join('\n') + '\n';

const outcomes = new Map();
for (let index = 0; index < 48 && outcomes.size < 3; index++) {
  const seed = `phase2-outcome-${index}`;
  const world = openWorld({ dbPath:':memory:', seed, startMs:atLondon('2026-09-04', '00:00') });
  try {
    world.advance(atLondon('2026-09-17', '00:00'));
    const snapshot = world.semanticSnapshot(), thread = Object.values(snapshot.threads.instances)[0];
    assert.ok(thread?.result);
    if (outcomes.has(thread.result.outcome)) continue;
    const publicView = world.publicProjection();
    assert.ok(!JSON.stringify(publicView).includes(thread.token));
    const row = { outcome:thread.result.outcome, seed, disposition:thread.result.deliveryDisposition,
      resolver:thread.result.resolver, completedAt:thread.result.completedAt, digest:semanticDigest(snapshot) };
    outcomes.set(row.outcome, row);
    json(`${row.outcome}-private.json`, { thread, events:snapshot.events.filter(e => THREAD_EVENT_TYPES.includes(e.type)) });
    writeFileSync(join(output, `${row.outcome}-ledger.md`), `# ${row.outcome}: isolated seeded test history\n\n` + ledger(snapshot.events));
  } finally { world.close(); }
}
assert.deepEqual([...outcomes.keys()].sort(), ['missed_window', 'reconciled', 'returned']);

// Measure the actual new episode, rather than a six-hour window with no Ink visit.
const measures = []; let processedActions;
for (let i = 0; i < 12; i++) {
  const world = openWorld({ dbPath:join(output, `phase2-benchmark-${i}.sqlite`), startMs:atLondon('2026-09-04', '00:00') });
  try {
    world.advance(atLondon('2026-09-05', '12:00'));
    const start = performance.now(), advance = world.advance(atLondon('2026-09-05', '18:00'));
    measures.push(performance.now() - start); processedActions = advance.processedActions;
    assert.ok(Object.values(world.semanticSnapshot().threads.instances)[0].result);
  } finally { world.close(); }
}
const sorted = [...measures].sort((a,b) => a-b);
const benchmark = { fictionalHours:6, iterations:12, processedActions, minuteTicks:0,
  medianMs:sorted[6], p95Ms:sorted[11], measurementsMs:measures,
  includes:'advance and SQLite FULL synchronous commit, including episode opening and ending; excludes noon prefill and projection' };
assert.ok(benchmark.medianMs < 1000);
const final = { result:'PASS', rulesVersion:RULES_VERSION, output, variants:comparison.variants,
  outcomes:[...outcomes.values()], benchmark };
json('phase2-comparison.json', final);
writeFileSync(join(output, 'PHASE2-RESULTS.md'), '# Phase 2: PASS\n\nFive ambient days, 4–9 September 2026. The existing A–E runner compares full semantic snapshots, including the new episode and every pending action.\n\n' +
  '| Variant | Events | Semantic digest |\n|---|---:|---|\n' + comparison.variants.map(row => `| ${row.variant} | ${row.events} | ${row.digest} |`).join('\n') +
  '\n\n## Three real calendar outcomes\n\n| Seed | Outcome | Delivery disposition |\n|---|---|---|\n' + [...outcomes.values()].map(row => `| ${row.seed} | ${row.outcome} | ${row.disposition} |`).join('\n') +
  `\n\nSix-hour catch-up including this episode: ${processedActions} actions, no minute ticks; median ${benchmark.medianMs.toFixed(3)} ms, p95 ${benchmark.p95Ms.toFixed(3)} ms across twelve fresh SQLite files.\n\n## Default-seed episode ledger\n\n` + ledger(baseline.events));
console.log(JSON.stringify(final, null, 2));
