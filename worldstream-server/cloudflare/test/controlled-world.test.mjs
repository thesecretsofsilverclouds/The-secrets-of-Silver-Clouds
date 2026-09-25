import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { ControlledWorldDurableObject, installProductionFetchBoundary } from '../src/controlled-world.mjs';
import { WorldDurableObject as Runtime } from '../src/world-durable-object.mjs';
import { createMockSqlStorage } from '../src/sqlite-adapter.mjs';
import { MAINTENANCE_CONTROL_KEY, MAINTENANCE_IMPORT_KEY } from '../src/production-maintenance.mjs';
import { atLondon } from '../../src/time.mjs';

const TOKEN = 'controlled-world-test-only', START = atLondon('2026-09-20', '00:00');
const ENV = { START_MS: START, WORLD_SEED: 'controlled-world',
  WORLD_OPS_TOKEN_SHA256: createHash('sha256').update(TOKEN).digest('hex'),
  WORLD_OPS_READ_WHILE_PAUSED: 'true', WORLD_OPS_ALLOW_ADVANCE: 'true',
  OPENAI_API_KEY: 'test-only', RESERVOIR_REFILL_ENABLED: 'true', WORLDSTREAM_CINEMATICS_ENABLED: 'true' };
function harness(t, { populate = true, env = {} } = {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const kv = new Map(), effects = { alarm: null, alarmSets: 0, alarmDeletes: 0 };
  const ctx = { storage: { sql: createMockSqlStorage(db),
    async get(key) { return structuredClone(kv.get(key)); },
    async put(key, value) { kv.set(key, structuredClone(value)); },
    async list() { return new Map(kv); }, async delete(key) { kv.delete(key); },
    async getCurrentBookmark() { return 'test:pitr:before'; },
    async getAlarm() { return effects.alarm; },
    async setAlarm(at) { effects.alarm = at; effects.alarmSets++; },
    async deleteAlarm() { effects.alarm = null; effects.alarmDeletes++; },
    transactionSync(work) {
      if (db.isTransaction) return work();
      db.exec('BEGIN');
      try { const result = work(); db.exec('COMMIT'); return result; }
      catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    },
  }, getWebSockets() { return []; }, acceptWebSocket() {}, waitUntil() {} };
  if (populate) new Runtime(ctx, ENV);
  const world = new ControlledWorldDurableObject(ctx, { ...ENV, ...env });
  const request = (path, { authorized = true, method = 'GET', body } = {}) => new Request(`https://world.test${path}`,
    { method, headers: { ...(authorized ? { Authorization: `Bearer ${TOKEN}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
  const call = (path, options) => world.fetch(request(path, options));
  return { db, kv, ctx, world, call, request, effects };
}
const canonical = db => ({ world: db.prepare('SELECT * FROM world_state').all(),
  events: db.prepare('SELECT * FROM events ORDER BY seq').all(),
  queue: db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all() });
const allTables = db => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
  .map(({ name }) => [name, db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all()]));

test('blank and old-rule storage never construct a runtime or create a new world', async t => {
  const blank = harness(t, { populate: false });
  assert.equal((await blank.call('/api/world', { authorized: false })).status, 503);
  assert.equal((await blank.call('/__ops/telemetry', { authorized: false })).status, 401);
  assert.equal((await blank.call('/api/world')).status, 503);
  await blank.world.alarm();
  assert.equal(blank.world.runtime, null);
  assert.deepEqual(blank.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(), []);
  const old = harness(t);
  old.db.prepare('UPDATE world_state SET rules_version=?').run('canon-ambient-p183-v28');
  const before = canonical(old.db);
  assert.equal((await old.call('/api/world')).status, 503);
  assert.equal(old.world.runtime, null); assert.deepEqual(canonical(old.db), before);
});

test('paused smoke reads require authentication and cannot advance, poll weather, or schedule alarms', async t => {
  const h = harness(t), before = allTables(h.db);
  await h.call('/__ops/pause', { method: 'POST' });
  const alarmSets = h.effects.alarmSets;
  assert.equal((await h.call('/api/world', { authorized: false })).status, 503);
  assert.equal((await h.call('/api/observe', { method: 'POST' })).status, 503);
  for (const path of ['/api/world', '/api/health', '/api/history?after=' + START, '/api/cinematics/archive']) {
    const response = await h.call(path); assert.equal(response.status, 200, await response.text());
  }
  assert.ok(h.world.runtime);
  const weather = t.mock.method(h.world.runtime, 'pollScheduledWeather');
  await h.world.alarm();
  assert.equal(weather.mock.callCount(), 0);
  assert.equal(h.effects.alarmSets, alarmSets);
  assert.deepEqual(allTables(h.db), before);
  const telemetry = await (await h.call('/__ops/telemetry')).json();
  assert.equal(telemetry.paused, true); assert.equal(telemetry.csv, null);
  assert.equal(telemetry.authoring.modelCalls, 0); assert.equal(telemetry.authoring.refillReservations, 0);
  assert.match(telemetry.wallTime.note, /wall time/);
});

function pendingFeatures(h, fields = ['narrativeSignals', 'rhythm']) {
  const state = JSON.parse(h.db.prepare('SELECT state_json FROM world_state').get().state_json);
  state.meta.upgrades = [];
  for (const field of fields) {
    delete state[field];
    const rhythm = field === 'rhythm', version = rhythm ? 30 : 29;
    const action = { id: `${rhythm ? 'rhythm' : 'narrative'}-v${version}/activate/${START}`,
      type: rhythm ? 'WORLD_RHYTHM_ACTIVATE' : 'WORLD_NARRATIVE_ACTIVATE', dueAt: START + 1, priority: -1, day: '2026-09-20' };
    state.meta.upgrades.push({ from: `canon-ambient-p183-v${version - 1}`, to: `canon-ambient-p183-v${version}`,
      cutoverAt: START, activationActionId: action.id, historicalLedgerDigest: '0'.repeat(64), backupSha256: '1'.repeat(64) });
    h.db.prepare('INSERT INTO scheduled_actions VALUES(?,?,?,?)').run(action.id, action.dueAt, action.priority, JSON.stringify(action));
  }
  h.db.prepare('UPDATE world_state SET state_json=?').run(JSON.stringify(state));
  return state;
}

test('v30 controlled reads accept independent pending v29/v30 activations without creating either field', async t => {
  for (const fields of [['rhythm'], ['narrativeSignals', 'rhythm']]) {
    const h = harness(t); pendingFeatures(h, fields); const before = allTables(h.db);
    const response = await h.call('/api/world'); assert.equal(response.status, 200, await response.text());
    assert.deepEqual(allTables(h.db), before);
  }
  const old = harness(t); old.db.prepare('UPDATE world_state SET rules_version=?').run('canon-ambient-p183-v29');
  const before = allTables(old.db);
  assert.equal((await old.call('/api/world')).status, 503);
  assert.deepEqual(allTables(old.db), before); assert.equal(old.world.runtime, null);
});

test('controlled v30 rejects absent, stale, duplicate, or forged activation ownership before runtime initialization', async t => {
  for (const corrupt of [
    h => h.db.prepare("DELETE FROM scheduled_actions WHERE id LIKE 'rhythm-v30/%'").run(),
    h => h.db.prepare("UPDATE scheduled_actions SET due_at=due_at+1 WHERE id LIKE 'rhythm-v30/%'").run(),
    h => h.db.prepare("UPDATE scheduled_actions SET priority=0 WHERE id LIKE 'rhythm-v30/%'").run(),
    h => { const row = h.db.prepare("SELECT * FROM scheduled_actions WHERE id LIKE 'rhythm-v30/%'").get();
      const action = JSON.parse(row.action_json); action.id = 'unowned-rhythm';
      h.db.prepare('INSERT INTO scheduled_actions VALUES(?,?,?,?)').run(action.id, action.dueAt, action.priority, JSON.stringify(action)); },
    h => { const state = JSON.parse(h.db.prepare('SELECT state_json FROM world_state').get().state_json);
      state.meta.upgrades.at(-1).activatedAt = START + 1;
      h.db.prepare('UPDATE world_state SET state_json=?').run(JSON.stringify(state)); },
    h => { const state = JSON.parse(h.db.prepare('SELECT state_json FROM world_state').get().state_json);
      state.meta.upgrades.at(-1).from = 'canon-ambient-p183-v28';
      h.db.prepare('UPDATE world_state SET state_json=?').run(JSON.stringify(state)); },
  ]) {
    const h = harness(t); pendingFeatures(h); corrupt(h); const before = allTables(h.db);
    assert.equal((await h.call('/api/world')).status, 503);
    assert.equal(h.world.runtime, null); assert.deepEqual(allTables(h.db), before);
  }
});

test('live reader refresh and bootstrap do not advance canon or change persisted tables', async t => {
  const h = harness(t);
  h.kv.set(MAINTENANCE_CONTROL_KEY, { version: 1, paused: false });
  const before = allTables(h.db);
  for (let i = 0; i < 2; i++) for (const path of ['/api/world', '/api/cinematics/archive', '/api/observe']) {
    const response = await h.call(path, { authorized: false, method: path.endsWith('observe') ? 'POST' : 'GET' });
    assert.equal(response.status, 200, await response.text());
  }
  assert.deepEqual(allTables(h.db), before);
});

test('pause acknowledgement waits for outstanding weather work and deletes its alarm', async t => {
  const h = harness(t);
  h.kv.set(MAINTENANCE_CONTROL_KEY, { version: 1, paused: false });
  await h.call('/api/world');
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const weather = new Promise(resolve => { release = resolve; });
  t.mock.method(h.world.runtime, 'pollScheduledWeather', async () => { entered(); await weather; });
  const alarm = h.world.alarm(); await started;
  let acknowledged = false;
  const pause = h.call('/__ops/pause', { method: 'POST' }).then(response => { acknowledged = true; return response; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledged, false);
  const before = canonical(h.db); release();
  await alarm; assert.equal((await pause).status, 200);
  assert.equal(h.effects.alarm, null); assert.deepEqual(canonical(h.db), before);
});

test('writer failure rolls back the attempted canonical advance and durably pauses', async t => {
  const h = harness(t);
  h.kv.set(MAINTENANCE_CONTROL_KEY, { version: 1, paused: false });
  await h.call('/api/world'); const before = canonical(h.db);
  t.mock.method(h.world.runtime, 'pollScheduledWeather', async () => {});
  t.mock.method(h.world.runtime.fixture, 'reduceAction', () => {
    h.db.prepare('UPDATE world_state SET resolved_through=?').run(START + 999);
    throw new Error('injected reducer failure');
  });
  const logs = []; t.mock.method(console, 'error', value => logs.push(value));
  await h.world.alarm();
  assert.deepEqual(canonical(h.db), before);
  assert.equal(h.kv.get(MAINTENANCE_CONTROL_KEY).paused, true);
  assert.equal(h.effects.alarm, null); assert.equal(logs.length, 1);
});

test('runtime initialization refuses incompatible reader schema and preserves its comments', async t => {
  const h = harness(t);
  h.db.exec("DROP TABLE event_comments; CREATE TABLE event_comments(id TEXT PRIMARY KEY,traveller_id TEXT,text TEXT); INSERT INTO event_comments VALUES('keep','reader','do not delete')");
  const before = h.db.prepare('SELECT * FROM event_comments').all();
  assert.equal((await h.call('/api/world')).status, 503);
  assert.equal(h.world.runtime, null);
  assert.deepEqual(h.db.prepare('SELECT * FROM event_comments').all(), before);
});

test('private telemetry reads CSV bounds without publishing hypothetical evidence or changing canon', async t => {
  const h = harness(t);
  const row = h.db.prepare('SELECT state_json FROM world_state').get(), state = JSON.parse(row.state_json);
  state.narrativeSignals.csv.lastEvaluation = { evaluatedAt: START, opportunityId: 'private-choice', status: 'evaluated',
    reason: 'completed_obligation_gain', processedActions: { loyalty: 29, ambition: 24 }, cloneBytes: 180180,
    gain: .2, preferredMotive: 'loyalty', logWeights: { loyalty: Math.log(1.25), ambition: 0 },
    evidence: [{ factKey: 'private-fork-fact', sourceEventId: 'private-fork-event' }] };
  h.db.prepare('UPDATE world_state SET state_json=?').run(JSON.stringify(state));
  const before = canonical(h.db);
  const response = await h.call('/__ops/telemetry'); assert.equal(response.status, 200);
  const metrics = await response.json();
  assert.equal(metrics.csvBoundsValid, true); assert.equal(metrics.csv.processedActions.loyalty, 29);
  const logs = []; t.mock.method(console, 'log', line => logs.push(line)); h.world.logCSV();
  assert.equal(logs.length, 1); assert.equal(logs[0].includes('private-fork'), false);
  assert.equal((await (await h.call('/api/world')).text()).includes('private-fork'), false);
  assert.deepEqual(canonical(h.db), before);
});

test('global egress boundary permits only HTTPS weather GET, blocks model calls and redirects, and installs once', async () => {
  const called = [], logged = [], target = { async fetch(...args) { called.push(args); return new Response('{}'); } };
  const boundary = installProductionFetchBoundary(target, { error: line => logged.push(line) });
  assert.equal(installProductionFetchBoundary(target), boundary);
  await target.fetch('https://api.open-meteo.com/v1/forecast?latitude=51.5074');
  assert.equal(called.length, 1); assert.equal(called[0][1].redirect, 'error');
  for (const [url, init] of [['https://api.openai.com/v1/responses', {}],
    ['https://api.open-meteo.com/v1/forecast', { method: 'POST' }],
    ['http://api.open-meteo.com/v1/forecast', {}], ['https://api.open-meteo.com.evil.test/v1/forecast', {}]])
    await assert.rejects(target.fetch(url, init), /blocked/);
  assert.equal(called.length, 1); assert.equal(logged.length, 4);
  assert.deepEqual(boundary.snapshot(), { weatherRequests: 1, blockedRequests: 4, scope: 'current_worker_isolate' });
});

test('controlled advancement requires verified import, stays paused and enforces a one-minute target', async t => {
  const h = harness(t), before = canonical(h.db);
  assert.equal((await h.call('/__ops/advance', { method: 'POST', body: { targetMs: START + 1 } })).status, 409);
  assert.deepEqual(canonical(h.db), before);
  await h.call('/__ops/pause', { method: 'POST' });
  const row = h.db.prepare('SELECT * FROM world_state').get();
  h.kv.set(MAINTENANCE_IMPORT_KEY, { version: 1, status: 'verified', expected: {
    seed: row.seed, rulesVersion: row.rules_version, resolvedThrough: row.resolved_through }, tableFingerprints: {}, verifiedFingerprints: {} });
  assert.equal((await h.call('/__ops/advance', { method: 'POST', body: { targetMs: START + 60001 } })).status, 400);
  const response = await h.call('/__ops/advance', { method: 'POST', body: { targetMs: START + 1 } });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(h.db.prepare('SELECT resolved_through FROM world_state').get().resolved_through, START + 1);
  assert.equal(h.kv.get(MAINTENANCE_CONTROL_KEY).paused, true);
  assert.equal(h.effects.alarm, null);
  assert.equal((await response.json()).telemetry.authoring.modelCalls, 0);
});
