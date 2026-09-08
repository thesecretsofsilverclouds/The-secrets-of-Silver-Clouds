// Private author audit. Isolated in-memory world only; no server or model calls.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WorldStore, semanticDigest } from '../experiment-l/src/world.mjs';
import { createFixture, RULES_VERSION, SELECTION_VERSION, DEFAULT_SEED, weatherForDay } from '../src/fixture.mjs';
import { REPERTOIRE } from '../src/pressure.mjs';
import { atLondon } from '../src/time.mjs';

const root = new URL('../', import.meta.url);
assert.equal(RULES_VERSION, 'canon-ambient-p183-v17',
  'This historical Phase 0 audit requires v17 source; do not overwrite its evidence with later rules');
const output = new URL('artifacts/phase0/', root);
mkdirSync(output, { recursive: true });
const readJson = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const baseline = readJson('artifacts/phase0/v16-baseline.json');
const savedBaseline = readJson('artifacts/2026-09-05T20-04-15-826Z/A-frequent/semantic-snapshot-private.json');
const definitions = new Map(Object.values(REPERTOIRE).flat().map(item => [item.kind, item]));
const weatherChecks = savedBaseline.events.filter(event => event.type === 'WEATHER_CHANGE').map(event => {
  const date = event.payload.calendarDay;
  const current = weatherForDay(date, DEFAULT_SEED).code;
  assert.equal(current, event.payload.weatherCode, `Unrelated weather redraw on ${date}`);
  return { date, code: current };
});
const coreHash = createHash('sha256').update(readFileSync(new URL('../experiment-l/src/world.mjs', root))).digest('hex');
assert.equal(coreHash, baseline.sources.find(source => source.path === '../experiment-l/src/world.mjs').sha256,
  'Experiment L transaction engine changed');
assert.equal(SELECTION_VERSION, baseline.rulesVersion);
assert.notEqual(RULES_VERSION, baseline.rulesVersion);

const violations = [], incidents = [], skips = [];
const base = createFixture({ startMs: atLondon('2026-09-05', '00:00') });
const fixture = { ...base, reduceAction(state, action, seed) {
  const before = ['INCIDENT', 'UNEASE'].includes(action.type) ? structuredClone(state.characters) : null;
  const result = base.reduceAction(state, action, seed);
  const event = result.event;
  if (!before) return result;
  if (event.visibility !== 'public') {
    skips.push({ actionId: action.id, kind: action.kind, reason: event.payload.reason });
    assert.deepEqual(state.characters, before, 'Refused pressure action changed a character');
    return result;
  }
  const definition = definitions.get(event.payload.kind);
  const expectedLocation = definition.at === 'city' ? 'big_ben_plaza' : definition.at;
  if (event.location !== expectedLocation) violations.push({ id: event.id, issue: 'wrong_source_location' });
  if (event.type === 'UNEASE') {
    assert.deepEqual(event.participants, []);
    assert.deepEqual(state.characters, before);
    return result;
  }
  for (const who of event.participants) {
    const actor = before[who];
    if (actor.location !== event.location || actor.journey || ['sleeping', 'travelling'].includes(actor.activity)) {
      violations.push({ id: event.id, who, issue: 'unavailable_witness' });
    }
    if (definition.at === 'city' && actor.area !== 'venue') violations.push({ id: event.id, who, issue: 'not_on_plaza' });
    assert.equal(state.characters[who].area, actor.area, 'Incident moved a witness to another room');
  }
  for (const who of Object.keys(before).filter(who => !event.participants.includes(who))) {
    assert.deepEqual(state.characters[who], before[who], 'An absent character changed');
    assert.ok(!event.changes.some(change => change.entity === 'relationship' && change.id.startsWith(`${who}->`)),
      'An absent character acquired feelings without learning about the incident');
  }
  incidents.push({ id: event.id, occurredAt: event.occurredAt, kind: event.payload.kind,
    severity: event.payload.severity, location: event.location, area: event.area, participants: event.participants });
  return result;
} };
const world = new WorldStore({ dbPath: ':memory:', seed: DEFAULT_SEED, fixture });
try {
  world.advance(atLondon('2026-10-08', '00:00'));
  const snapshot = world.semanticSnapshot(), digest = semanticDigest(snapshot);
  world.publicProjection(); world.publicProjection();
  assert.equal(semanticDigest(world.semanticSnapshot()), digest, 'Read altered history');
  assert.deepEqual(violations, []);
  const report = { result: 'PASS', rulesVersion: RULES_VERSION, selectionVersion: SELECTION_VERSION,
    seed: DEFAULT_SEED, fictionalDays: 33, eventCount: snapshot.events.length,
    publicEventCount: snapshot.events.filter(event => event.visibility === 'public').length, digest,
    baseline: { rulesVersion: baseline.rulesVersion, digest: baseline.digest,
      invalidStreetIncidents: baseline.invalidStreetIncidents.length },
    interpretation: 'v17 is an intentional behavior correction, not a v16 migration. No saved live world was opened.',
    coreEngineUnchanged: true, preservedWeatherChecks: weatherChecks, violations, incidents, skippedProposals: skips };
  writeFileSync(new URL('v17-audit.json', output), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ result: report.result, output: fileURLToPath(new URL('v17-audit.json', output)),
    eventCount: report.eventCount, incidents: incidents.length, violations: violations.length,
    preservedWeatherDays: weatherChecks.length, coreEngineUnchanged: true }, null, 2));
} finally { world.close(); }
