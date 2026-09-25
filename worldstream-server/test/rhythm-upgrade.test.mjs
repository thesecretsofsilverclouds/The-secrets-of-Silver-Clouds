import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture } from '../src/fixture.mjs';
import { upgradeRhythm } from '../src/rhythm-upgrade.mjs';
import { upgradeNarrativeSystems } from '../src/narrative-upgrade.mjs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { applyChange, readChange, sideOf } from '../src/ledger.mjs';
import { WorldDurableObject } from '../cloudflare/src/world-durable-object.mjs';
import { createMockSqlStorage } from '../cloudflare/src/sqlite-adapter.mjs';

const start = atLondon('2026-09-05', '00:00'), cutover = start + 2 * 3600_000;
function legacy(version = 'canon-ambient-p183-v29') {
  const directory = mkdtempSync(join(tmpdir(), 'sc-rhythm-upgrade-'));
  const dbPath = join(directory, 'world.sqlite'), backupPath = join(directory, 'before-v30.sqlite');
  const current = createFixture({ startMs: start }), initial = current.initialState();
  delete initial.rhythm;
  if (version.endsWith('v28')) delete initial.narrativeSignals;
  const fixture = { ...current, rulesVersion: version, initialState: () => structuredClone(initial) };
  const world = new WorldStore({ dbPath, seed: 'rhythm-prospective-migration', fixture });
  world.advance(cutover); world.close();
  writeFileSync(join(directory, 'active-world.json'), JSON.stringify({ format: 1, database: 'world.sqlite', rulesVersion: version, keep: 'metadata' }));
  return { directory, dbPath, backupPath };
}
function rows(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try { return { state: db.prepare('SELECT * FROM world_state').get(), events: db.prepare('SELECT * FROM events ORDER BY seq').all(),
    queue: db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all() }; } finally { db.close(); }
}
function modify(f, work) { const db = new DatabaseSync(f.dbPath); try { work(db); } finally { db.close(); } }
const stateOf = snapshot => Object.fromEntries(Object.entries(snapshot).filter(([key]) => !['world', 'events', 'pendingActions'].includes(key)));

test('v30 preserves every old event and pending row, then activates with exact reversible absence and restart', () => {
  const f = legacy(), before = rows(f.dbPath);
  assert.ok(before.queue.some(row => ['TV_BEGIN', 'PIANO_BEGIN', 'MUSIC_LISTEN_BEGIN', 'GAMING_BEGIN'].includes(JSON.parse(row.action_json).type)));
  assert.throws(() => openWorld({ dbPath: f.dbPath }), /refusing to reinterpret history/);
  const result = upgradeRhythm(f), pending = rows(f.dbPath);
  assert.deepEqual(pending.events, before.events);
  assert.deepEqual(pending.queue.filter(row => row.id !== result.activationActionId), before.queue);
  for (const key of ['id', 'seed', 'resolved_through']) assert.equal(pending.state[key], before.state[key]);
  const state = JSON.parse(pending.state.state_json), oldState = JSON.parse(before.state.state_json);
  const withoutReceipt = structuredClone(state); withoutReceipt.meta.upgrades.pop();
  // Empty upgrades may not have existed on a fresh v29 world.
  if (!Object.hasOwn(oldState.meta, 'upgrades')) delete withoutReceipt.meta.upgrades;
  assert.deepEqual(withoutReceipt, oldState); assert.equal(Object.hasOwn(state, 'rhythm'), false);
  assert.deepEqual(rows(f.backupPath), before);
  assert.equal(upgradeRhythm(f).status, 'already_upgraded');
  const manifestPath = join(f.directory, 'active-world.json'), manifest = JSON.parse(readFileSync(manifestPath));
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, rulesVersion: 'canon-ambient-p183-v29' }));
  assert.equal(upgradeRhythm(f).status, 'already_upgraded');
  assert.equal(JSON.parse(readFileSync(manifestPath)).keep, 'metadata');
  let world = openWorld({ dbPath: f.dbPath });
  try {
    const unchanged = semanticDigest(world.semanticSnapshot());
    assert.throws(() => world.advance(cutover + 1, { failBeforeCommit: true }), /Injected/);
    assert.equal(semanticDigest(world.semanticSnapshot()), unchanged);
    world.advance(cutover + 1);
    const snapshot = world.semanticSnapshot(), added = snapshot.events.slice(before.events.length);
    assert.equal(added.length, 1); assert.equal(added[0].type, 'WORLD_RHYTHM_ACTIVATE');
    assert.equal(snapshot.rhythm.activatedAt, cutover + 1);
    assert.deepEqual(rows(f.dbPath).events.slice(0, before.events.length), before.events);
    assert.deepEqual(rows(f.dbPath).queue, before.queue);
    const replay = structuredClone(state);
    for (const change of added[0].changes) { assert.deepEqual(readChange(replay, change), sideOf(change, 'before')); applyChange(replay, change, 'after'); }
    assert.deepEqual(replay, stateOf(snapshot));
    for (const change of added[0].changes.toReversed()) { assert.deepEqual(readChange(replay, change), sideOf(change, 'after')); applyChange(replay, change, 'before'); }
    assert.deepEqual(replay, state); assert.equal(Object.hasOwn(replay, 'rhythm'), false);
    const digest = semanticDigest(snapshot); world.close(); world = openWorld({ dbPath: f.dbPath });
    assert.equal(semanticDigest(world.semanticSnapshot()), digest);
  } finally { world.close(); }
  assert.equal(upgradeRhythm(f).status, 'already_upgraded');
});

test('migration refuses dirty cutovers, unowned fields and forged pending activations without mutation', () => {
  for (const mutation of [
    db => db.prepare('UPDATE scheduled_actions SET due_at=? WHERE id=(SELECT id FROM scheduled_actions LIMIT 1)').run(cutover),
    db => { const state = JSON.parse(db.prepare('SELECT state_json FROM world_state').get().state_json); state.rhythm = null;
      db.prepare('UPDATE world_state SET state_json=?').run(JSON.stringify(state)); },
  ]) {
    const f = legacy(); modify(f, mutation); const before = rows(f.dbPath);
    assert.throws(() => upgradeRhythm(f)); assert.deepEqual(rows(f.dbPath), before);
  }
  const f = legacy(), result = upgradeRhythm(f);
  modify(f, db => db.prepare('UPDATE scheduled_actions SET due_at=due_at+1 WHERE id=?').run(result.activationActionId));
  const before = rows(f.dbPath);
  assert.throws(() => upgradeRhythm(f), /pending activation/); assert.deepEqual(rows(f.dbPath), before);
});

test('failed migration transaction retains original history, queue, state and manifest', () => {
  const f = legacy();
  modify(f, db => db.exec("CREATE TRIGGER fail_rhythm BEFORE UPDATE ON world_state BEGIN SELECT RAISE(ABORT,'injected upgrade failure'); END"));
  const before = rows(f.dbPath), manifest = readFileSync(join(f.directory, 'active-world.json'), 'utf8');
  assert.throws(() => upgradeRhythm(f), /injected upgrade failure/);
  assert.deepEqual(rows(f.dbPath), before);
  assert.equal(readFileSync(join(f.directory, 'active-world.json'), 'utf8'), manifest);
  assert.deepEqual(rows(f.backupPath), before);
});

test('bare Cloudflare v29 identity upgrades explicitly while retaining its original epoch and queue', () => {
  const f = legacy(); modify(f, db => db.prepare('UPDATE world_state SET rules_version=?').run('canon-ambient-p183-v29'));
  const before = rows(f.dbPath), result = upgradeRhythm(f), after = rows(f.dbPath);
  assert.equal(after.state.seed, before.state.seed); assert.equal(after.state.resolved_through, before.state.resolved_through);
  assert.deepEqual(after.events, before.events);
  assert.deepEqual(after.queue.filter(row => row.id !== result.activationActionId), before.queue);
  assert.equal(JSON.parse(after.state.state_json).meta.startMs, start);
});

test('pending v29 and v30 activations chain prospectively with Node/Cloudflare parity', () => {
  const f = legacy('canon-ambient-p183-v28');
  upgradeNarrativeSystems({ directory: f.directory, backupPath: join(f.directory, 'before-v29.sqlite') });
  upgradeRhythm(f);
  const second = join(f.directory, 'cloud.sqlite'); modify(f, db => db.prepare('VACUUM INTO ?').run(second));
  const node = openWorld({ dbPath: f.dbPath }), db = new DatabaseSync(second);
  try {
    const cloud = new WorldDurableObject({ storage: { sql: createMockSqlStorage(db), async getAlarm() { return null; }, async setAlarm() {} },
      waitUntil() {}, getWebSockets() { return []; } });
    for (const target of [cutover + 1, start + 86_400_000 + 1, start + 2 * 86_400_000]) {
      node.advance(target); cloud.advance(target);
      const snapshot = node.semanticSnapshot();
      assert.deepEqual(JSON.parse(db.prepare('SELECT state_json FROM world_state').get().state_json), stateOf(snapshot));
      assert.deepEqual(db.prepare('SELECT semantic_json FROM events ORDER BY seq').all().map(row => JSON.parse(row.semantic_json)), snapshot.events);
      assert.deepEqual(db.prepare('SELECT action_json FROM scheduled_actions ORDER BY due_at,priority,id').all().map(row => JSON.parse(row.action_json)), snapshot.pendingActions);
    }
    assert.equal(node.semanticSnapshot().narrativeSignals.activatedAt, cutover + 1);
    assert.equal(node.semanticSnapshot().rhythm.activatedAt, cutover + 1);
  } finally { node.close(); db.close(); }
});
