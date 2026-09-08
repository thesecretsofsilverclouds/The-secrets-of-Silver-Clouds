// Isolated author evidence. Never opens data/, starts a server or invokes a model.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { DEFAULT_SEED, RULES_VERSION } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';

const root = new URL('../', import.meta.url);
assert.equal(RULES_VERSION, 'canon-ambient-p183-v18',
  'This historical Phase 1 comparison requires v18; use the current phase verifier for later rules');
const output = new URL(`artifacts/phase1-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}/`, root);
mkdirSync(output, { recursive: true });
const json = (file, value) => writeFileSync(new URL(file, output), JSON.stringify(value, null, 2) + '\n');
const seed = DEFAULT_SEED, startMs = atLondon('2026-10-08', '00:00'), endMs = atLondon('2026-10-09', '00:00');
const MIN = 60_000;
const london = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'medium' });
const coreHash = createHash('sha256').update(readFileSync(new URL('../experiment-l/src/world.mjs', root))).digest('hex');
const phase0 = JSON.parse(readFileSync(new URL('artifacts/phase0/v16-baseline.json', root), 'utf8'));
assert.equal(coreHash, phase0.sources.find(source => source.path === '../experiment-l/src/world.mjs').sha256);
let baseline;
const rows = [];
function dbFor(name) {
  const directory = new URL(`${name}/`, output); mkdirSync(directory);
  return fileURLToPath(new URL('world.sqlite', directory));
}
function ledger(events) {
  return '| London occurrence time | Event ID | Type | Place | Description |\n|---|---|---|---|---|\n' + events.map(e =>
    `| ${london.format(e.occurredAt)} | ${e.id} | ${e.type} | ${e.location} | ${(e.publicDescription || '[private]').replaceAll('|', '/')} |`).join('\n') + '\n';
}
function save(name, dbPath, requests) {
  const world = openWorld({ dbPath });
  try {
    const snapshot = world.semanticSnapshot(), projection = world.publicProjection();
    if (baseline) assert.deepEqual(snapshot, baseline, `${name} changed semantic history`);
    else baseline = snapshot;
    const completed = snapshot.events.filter(e => e.type === 'INK_APPOINTMENT_COMPLETED' && e.visibility === 'public');
    assert.equal(completed.length, 1, 'This comparison must actually contain a completed milestone');
    assert.equal(snapshot.storyEffects.ink.result.sourceEventId, completed[0].id);
    assert.equal(projection.storyResults.length, 1);
    const digest = semanticDigest(snapshot);
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(world.publicProjection(), projection);
      world.advance(endMs);
      assert.equal(semanticDigest(world.semanticSnapshot()), digest);
    }
    json(`${name}/semantic-snapshot-private.json`, snapshot);
    json(`${name}/public-projection.json`, projection);
    writeFileSync(new URL(`${name}/event-ledger.md`, output), '# Internal author ledger\n\nNever served by the public API.\n\n' + ledger(snapshot.events));
    const row = { variant: name, requests, events: snapshot.events.length, digest };
    rows.push(row); console.log(JSON.stringify(row));
  } finally { world.close(); }
}
function worker(options) {
  const child = fork(fileURLToPath(new URL('../src/process-worker.mjs', import.meta.url)), [JSON.stringify(options)],
    { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let errors = '', result, readyResolve, rejectDone;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  const done = new Promise((resolve, reject) => {
    rejectDone = reject;
    child.once('error', reject);
    child.once('exit', code => code === 0 && result ? resolve(result) : reject(new Error(errors || `Worker exit ${code}`)));
  });
  child.stderr.on('data', chunk => { errors += chunk; });
  child.on('message', message => {
    if (message.ready) readyResolve();
    if (message.done) result = message;
    if (message.error) rejectDone(new Error(message.error));
  });
  return { ready, done, go: () => child.send('go') };
}

let dbPath = dbFor('A-frequent'), world = openWorld({ dbPath, startMs, seed });
for (let target = startMs + 5 * MIN; target <= endMs; target += 5 * MIN) world.advance(target);
world.close(); save('A-frequent', dbPath, 288);
dbPath = dbFor('B-absence'); world = openWorld({ dbPath, startMs, seed });
world.advance(endMs); world.close(); save('B-absence', dbPath, 1);
dbPath = dbFor('C-process-restarts');
const lifecycle = baseline.events.filter(e => e.type.startsWith('INK_') && e.visibility === 'public');
// Reopen in independent processes after choice, slot, booking, start and completion.
const targets = [...new Set([...lifecycle.map(e => e.occurredAt), endMs])].sort((a, b) => a - b);
for (const [index, target] of targets.entries()) {
  const child = worker({ dbPath, ...(index === 0 ? { seed, startMs } : {}), targets: [target] });
  await Promise.race([child.ready, child.done]); child.go(); await child.done;
}
save('C-process-restarts', dbPath, targets.length);
dbPath = dbFor('D-duplicates'); world = openWorld({ dbPath, startMs, seed });
for (const target of targets) for (const again of [target, target, target - 1, target]) world.advance(again);
world.close(); save('D-duplicates', dbPath, targets.length * 4);
dbPath = dbFor('E-concurrent'); world = openWorld({ dbPath, startMs, seed }); world.close();
const children = Array.from({ length: 4 }, () => worker({ dbPath, targets: [endMs, endMs, endMs] }));
await Promise.all(children.map(child => Promise.race([child.ready, child.done])));
children.forEach(child => child.go());
const concurrent = await Promise.all(children.map(child => child.done));
assert.equal(new Set(concurrent.map(child => child.digest)).size, 1);
save('E-concurrent', dbPath, 12);

// A real calendar recall interrupts work; a later released slot finishes only
// the remaining minutes. This is a second explicit test seed, not a rerolled save.
world = openWorld({ dbPath: ':memory:', seed: 'phase1-interruption-3', startMs: atLondon('2026-09-04', '00:00') });
world.advance(atLondon('2026-10-10', '00:00'));
const interrupted = world.semanticSnapshot(); world.close();
const ink = interrupted.storyEffects.ink;
assert.ok(ink.result && Object.values(ink.appointments).some(a => a.status === 'interrupted' && a.workAfterMs > 0));
assert.equal(Object.values(ink.appointments).filter(a => a.status === 'completed').length, 1);
json('interrupted-story-private.json', ink);
writeFileSync(new URL('interruption-ledger.md', output), '# Interrupted appointment and later completion\n\n' + ledger(interrupted.events.filter(e =>
  e.visibility === 'public' && (e.type.startsWith('INK_') || e.type === 'OUTING_CUT_SHORT'))));

const measurements = []; let processedActions;
for (let i = 0; i < 12; i++) {
  world = openWorld({ dbPath: dbFor(`benchmark-${i}`), seed, startMs });
  world.advance(atLondon('2026-10-08', '12:00'));
  const begin = performance.now(), result = world.advance(atLondon('2026-10-08', '18:00'));
  measurements.push(performance.now() - begin); processedActions = result.processedActions;
  assert.ok(world.semanticSnapshot().storyEffects.ink.result); world.close();
}
const sorted = [...measurements].sort((a, b) => a - b);
const benchmark = { fictionalHours: 6, iterations: 12, processedActions, minuteTicks: 0,
  medianMs: sorted[6], p95Ms: sorted[11], measurementsMs: measurements,
  includes: 'SQLite advance and FULL synchronous commit, including tattoo completion; excludes noon prefill and reads' };
assert.ok(benchmark.medianMs < 1000);
json('comparison.json', { result: 'PASS', rulesVersion: RULES_VERSION, startMs, endMs, seed,
  engineSha256: coreHash, variants: rows, benchmark });
writeFileSync(new URL('RESULTS.md', output), `# Phase 1 comparison: PASS\n\n8–9 October 2026, Europe/London; isolated authored test calendar.\n\n` +
  '| Variant | Events | Digest |\n|---|---:|---|\n' + rows.map(r => `| ${r.variant} | ${r.events} | ${r.digest} |`).join('\n') +
  `\n\nFull semantic snapshots match, including completed result, knowledge, relationships, pending actions and event changes. Restart uses separate processes at every milestone. Repeated public reads and duplicate advances produce no changes.\n\n` +
  `Six-hour catch-up including completion: ${processedActions} actions, zero minute ticks, median ${benchmark.medianMs.toFixed(3)} ms and p95 ${benchmark.p95Ms.toFixed(3)} ms over 12 fresh SQLite files.\n\n` +
  '## Lifecycle shared by all variants\n\n' + ledger(lifecycle));
console.log(JSON.stringify({ result: 'PASS', output: fileURLToPath(output), benchmark }, null, 2));
