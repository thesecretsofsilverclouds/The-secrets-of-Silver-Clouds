import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture, RULES_VERSION } from '../src/fixture.mjs';
import { upgradeRhythm } from '../src/rhythm-upgrade.mjs';
import { upgradeNarrativeSystems } from '../src/narrative-upgrade.mjs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { WorldDurableObject } from '../cloudflare/src/world-durable-object.mjs';
import { createMockSqlStorage } from '../cloudflare/src/sqlite-adapter.mjs';
import { applyChange, readChange, sideOf } from '../src/ledger.mjs';

const start = atLondon('2026-09-05', '00:00'), cutover = start + 86_400_000;
function legacy() {
  const directory = mkdtempSync(join(tmpdir(), 'sc-narrative-upgrade-'));
  const dbPath = join(directory, 'world.sqlite'), backupPath = join(directory, 'before-v29.sqlite');
  const current = createFixture({ startMs: start }), state = current.initialState();
  delete state.narrativeSignals;
  delete state.rhythm;
  const old = { ...current, rulesVersion: 'canon-ambient-p183-v28', initialState: () => structuredClone(state) };
  const world = new WorldStore({ dbPath, seed: 'prospective-narrative', fixture: old });
  world.advance(cutover); const snapshot = world.semanticSnapshot(); world.close();
  writeFileSync(join(directory, 'active-world.json'), JSON.stringify({ format: 1, database: 'world.sqlite', rulesVersion: old.rulesVersion }));
  return { directory, dbPath, backupPath, snapshot };
}
function rows(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try { return { state: db.prepare('SELECT * FROM world_state WHERE id=1').get(),
    events: db.prepare('SELECT * FROM events ORDER BY seq').all(), queue: db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all() }; }
  finally { db.close(); }
}
function doWorld(db, env = {}) {
  return new WorldDurableObject({ storage: { sql: createMockSqlStorage(db), async getAlarm() { return null; }, async setAlarm() {}, async deleteAlarm() {} },
    waitUntil() {}, acceptWebSocket() {}, getWebSockets() { return []; } }, env);
}
test('v29 upgrade preserves old ledger/queue/epoch and activates once at a future owned boundary', () => {
  const f = legacy(), before = rows(f.dbPath);
  assert.throws(() => openWorld({ dbPath: f.dbPath }), /identity|mismatch|differ/i);
  const report = upgradeNarrativeSystems(f), after = rows(f.dbPath);
  assert.equal(report.status, 'upgraded');
  assert.deepEqual(after.events, before.events);
  assert.deepEqual(after.queue.filter(r => r.id !== report.activationActionId), before.queue);
  assert.equal(after.state.seed, before.state.seed); assert.equal(after.state.resolved_through, cutover);
  assert.equal(JSON.parse(after.state.state_json).narrativeSignals, undefined);
  assert.deepEqual(rows(f.backupPath), before);
  assert.equal(upgradeNarrativeSystems(f).status, 'already_upgraded');
  assert.equal(JSON.parse(readFileSync(join(f.directory, 'active-world.json'))).rulesVersion, 'canon-ambient-p183-v29');
  upgradeRhythm({ directory: f.directory, backupPath: join(f.directory, 'before-v30.sqlite') });
  const activationInitial = rows(f.dbPath);
  const world = openWorld({ dbPath: f.dbPath });
  try {
    const initial = semanticDigest(world.semanticSnapshot());
    assert.throws(() => world.advance(cutover + 1, { failBeforeCommit: true }), /Injected/);
    assert.equal(semanticDigest(world.semanticSnapshot()), initial, 'activation rolls back atomically');
    world.advance(cutover + 1);
    const s = world.semanticSnapshot();
    assert.equal(s.narrativeSignals.activatedAt, cutover + 1);
    assert.equal(s.events.filter(e => e.type === 'WORLD_NARRATIVE_ACTIVATE').length, 1);
    assert.deepEqual(s.events.slice(0, f.snapshot.events.length), f.snapshot.events);
    assert.ok(s.meta.upgrades.at(-1).activatedAt);
    // Replay the actual persisted upgrade, including any same-time day action.
    // A v28 save has no narrativeSignals property: null is not the same state.
    const initialState = JSON.parse(activationInitial.state.state_json), replay = structuredClone(initialState);
    const activationEvents = s.events.slice(f.snapshot.events.length);
    const target = (state, change) => change.entity === 'character' ? state.characters[change.id]
      : change.entity === 'relationship' ? state.relationships.find(pair => `${pair.from}->${pair.to}` === change.id) : state;
    for (const event of activationEvents) for (const change of event.changes) {
      const object = target(replay, change);
      assert.deepEqual(readChange(object, change), sideOf(change, 'before'));
      applyChange(object, change, 'after');
    }
    const finalState = Object.fromEntries(Object.entries(s).filter(([key]) => !['world', 'events', 'pendingActions'].includes(key)));
    assert.deepEqual(replay, finalState);
    for (const event of [...activationEvents].reverse()) for (const change of [...event.changes].reverse()) {
      const object = target(replay, change);
      assert.deepEqual(readChange(object, change), sideOf(change, 'after'));
      applyChange(object, change, 'before');
    }
    assert.deepEqual(replay, initialState);
    assert.equal(Object.hasOwn(replay, 'narrativeSignals'), false);
  } finally { world.close(); }
  assert.throws(() => upgradeNarrativeSystems(f), /Only an unmodified v28/);
});
test('omission-aware whole-field replay preserves existing legacy null records', () => {
  const legacy = { field: 'value', before: null, after: { active: true } }, state = {};
  assert.equal(readChange(state, legacy), null);
  applyChange(state, legacy, 'after'); applyChange(state, legacy, 'before');
  assert.deepEqual(state, { value: null });
  const creation = { field: 'newField', after: { active: true } };
  assert.equal(readChange(state, creation), undefined);
  applyChange(state, creation, 'after'); applyChange(state, creation, 'before');
  assert.deepEqual(state, { value: null });
});
test('Cloudflare refuses unupgraded saves; copied prospective migration has Node-identical activation and next day', () => {
  const f = legacy();
  let db = new DatabaseSync(f.dbPath);
  try { assert.throws(() => doWorld(db), /refusing to reinterpret/); } finally { db.close(); }
  upgradeNarrativeSystems(f);
  upgradeRhythm({ directory: f.directory, backupPath: join(f.directory, 'before-v30.sqlite') });
  // Copy through SQLite backup already created by the migration is the original
  // v28 world. Upgrade that separately and execute through the other adapter.
  const second = mkdtempSync(join(tmpdir(), 'sc-narrative-cf-'));
  const source = new DatabaseSync(f.dbPath);
  const secondPath = join(second, 'world.sqlite');
  source.prepare('VACUUM INTO ?').run(secondPath); source.close();
  const local = openWorld({ dbPath: f.dbPath }); db = new DatabaseSync(secondPath);
  try {
    const cloud = doWorld(db);
    const target = cutover + 86_400_000;
    local.advance(target); cloud.advance(target);
    const nodeSnapshot = local.semanticSnapshot();
    const cloudState = JSON.parse(db.prepare('SELECT state_json FROM world_state WHERE id=1').get().state_json);
    assert.deepEqual(cloudState, Object.fromEntries(Object.entries(nodeSnapshot).filter(([k]) => !['world', 'events', 'pendingActions'].includes(k))));
    const cloudEvents = db.prepare('SELECT semantic_json FROM events ORDER BY seq').all().map(r => JSON.parse(r.semantic_json));
    assert.deepEqual(cloudEvents, nodeSnapshot.events);
    assert.deepEqual(db.prepare('SELECT action_json FROM scheduled_actions ORDER BY due_at,priority,id').all().map(r => JSON.parse(r.action_json)), nodeSnapshot.pendingActions);
  } finally { db.close(); local.close(); }
});
