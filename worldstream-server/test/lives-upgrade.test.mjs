import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture, eventId, RULES_VERSION } from '../src/fixture.mjs';
import { initialOffscreenLives } from '../src/offscreen-lives.mjs';
import { openPinnedWorld, restoreWorldBackup } from '../src/world-operations.mjs';
import { upgradeOffscreenLives } from '../src/lives-upgrade.mjs';
import { atLondon } from '../src/time.mjs';

const OLD = 'canon-ambient-p183-v22', NEXT = 'canon-ambient-p183-v23';
const day = '2026-09-05', start = atLondon(day, '00:00'), cutover = atLondon(day, '12:00');
const hash = value => createHash('sha256').update(value).digest('hex');
const events = db => db.prepare('SELECT * FROM events ORDER BY seq').all();
const pending = db => db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all();
const stateRow = db => db.prepare('SELECT * FROM world_state WHERE id=1').get();
const manifestPath = f => join(f.directory, 'active-world.json');
const readManifest = f => JSON.parse(readFileSync(manifestPath(f), 'utf8'));
const setManifest = (f, version) => writeFileSync(manifestPath(f), JSON.stringify({
  format: 1, database: 'world.sqlite', rulesVersion: version, note: 'Existing continuity' }));
const snapshot = f => ({ row: stateRow(f.db), events: events(f.db), pending: pending(f.db), manifest: readManifest(f) });

// A structural v22 database: only the v23 field is absent. Canon memories,
// prior state bags and a pending activity retain their original representation.
function legacy(t) {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-lives-upgrade-'));
  const dbPath = join(directory, 'world.sqlite'), backupPath = join(directory, 'before-v23.sqlite');
  const current = createFixture({ startMs: start }), initial = current.initialState();
  delete initial.offscreenLives;
  initial.meta.upgrades = [{ from: 'canon-ambient-p183-v21', to: OLD, cutoverAt: start }];
  const fixture = { ...current, rulesVersion: OLD, initialState: () => structuredClone(initial),
    initialActions: () => [
      { id: 'existing-notice', dueAt: start + 1, priority: 0, type: 'INSTITUTION_NOTICE' },
      { id: `${day}/old-quiet`, dueAt: atLondon(day, '15:00'), priority: 40,
        type: 'QUIET_TIME_BEGIN', day, actor: 'goaden', duration: 20 },
    ], reduceAction(state, action, seed) {
      return { event: { id: eventId(seed, action.id), type: action.type, occurredAt: action.dueAt,
        location: 'mi6', participants: [], causedBy: [], payload: {}, changes: [], visibility: 'public',
        publicDescription: 'A previously recorded test notice.' }, followups: [] };
    } };
  const world = new WorldStore({ dbPath, seed: 'lives-migration-test', fixture });
  world.advance(cutover); world.close();
  const db = new DatabaseSync(dbPath); t.after(() => db.close());
  const f = { directory, dbPath, backupPath, db }; setManifest(f, OLD);
  return f;
}

test('v22 to v23 preserves old ledger bytes, memories, clock, seed and every existing pending action', t => {
  const f = legacy(t), before = snapshot(f);
  assert.equal(RULES_VERSION, NEXT);
  assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
  const result = upgradeOffscreenLives(f), after = snapshot(f);
  assert.equal(result.status, 'upgraded'); assert.equal(result.rulesVersion, NEXT);
  assert.equal(result.cutoverAt, cutover); assert.equal(result.historicalEvents, before.events.length);
  assert.deepEqual(after.events, before.events);
  for (const key of ['id', 'seed', 'resolved_through']) assert.equal(after.row[key], before.row[key], key);
  const original = JSON.parse(before.row.state_json), state = JSON.parse(after.row.state_json);
  for (const [key, value] of Object.entries(original)) if (key !== 'meta') assert.deepEqual(state[key], value, key);
  for (const [key, value] of Object.entries(original.meta)) if (key !== 'upgrades') assert.deepEqual(state.meta[key], value, key);
  assert.deepEqual(state.meta.upgrades.slice(0, -1), original.meta.upgrades);
  assert.deepEqual(state.offscreenLives, initialOffscreenLives());
  assert.equal(after.pending.length, before.pending.length + 1);
  assert.deepEqual(after.pending.filter(row => row.id !== result.activationActionId), before.pending);
  const activation = JSON.parse(after.pending.find(row => row.id === result.activationActionId).action_json);
  assert.deepEqual(activation, { id: `lives-v23/activate/${cutover}`, type: 'WORLD_LIVES_ACTIVATE',
    day, dueAt: cutover + 1, priority: 1 });
  assert.equal(after.manifest.note, before.manifest.note);
  assert.equal(after.manifest.rulesVersion, NEXT);
  const receipt = state.meta.upgrades.at(-1);
  assert.equal(receipt.backupSha256, result.backup.sha256);
  assert.equal(receipt.historicalLedgerDigest, result.historicalLedgerDigest);

  // The backup is independently restorable and contains the exact pre-release
  // rows, not the upgraded state or its new activation action.
  assert.ok(existsSync(f.backupPath)); assert.ok(existsSync(`${f.backupPath}.json`));
  assert.equal(hash(readFileSync(f.backupPath)), receipt.backupSha256);
  const restoredPath = join(f.directory, 'restored-v22.sqlite');
  restoreWorldBackup(f.backupPath, restoredPath);
  const restored = new DatabaseSync(restoredPath, { readOnly: true });
  try {
    assert.deepEqual(stateRow(restored), before.row);
    assert.deepEqual(events(restored), before.events);
    assert.deepEqual(pending(restored), before.pending);
  } finally { restored.close(); }
});

test('activation begins after the cutover without backfilling events or changing continuity', t => {
  const f = legacy(t), history = events(f.db);
  upgradeOffscreenLives(f);
  const world = openPinnedWorld({ directory: f.directory });
  try {
    const continuity = world.publicProjection().continuityId;
    assert.equal(world.semanticSnapshot().events.length, history.length);
    world.advance(cutover + 1);
    const after = world.semanticSnapshot();
    assert.equal(after.events.length, history.length + 1);
    assert.equal(after.events.at(-1).type, 'WORLD_LIVES_ACTIVATE');
    assert.equal(after.events.at(-1).occurredAt, cutover + 1);
    assert.equal(after.events.at(-1).visibility, 'private');
    assert.ok(after.pendingActions.every(action => action.dueAt > cutover + 1));
    assert.equal(world.publicProjection().continuityId, continuity);
    assert.deepEqual(events(f.db).slice(0, history.length), history);
    const committed = stateRow(f.db), scheduled = pending(f.db), allEvents = events(f.db);
    world.advance(cutover + 1);
    world.publicProjection(); world.publicProjection();
    assert.deepEqual(stateRow(f.db), committed);
    assert.deepEqual(pending(f.db), scheduled);
    assert.deepEqual(events(f.db), allEvents);
  } finally { world.close(); }
});

test('duplicate upgrades and manifest crash recovery do not create another activation', t => {
  const f = legacy(t);
  upgradeOffscreenLives(f);
  const before = snapshot(f), backupBytes = hash(readFileSync(f.backupPath));
  assert.equal(upgradeOffscreenLives({ directory: f.directory }).status, 'already_upgraded');
  assert.deepEqual(snapshot(f), before);
  setManifest(f, OLD); // SQLite committed; the manifest rename did not finish.
  assert.equal(upgradeOffscreenLives(f).status, 'already_upgraded');
  assert.deepEqual(snapshot(f), before);
  assert.equal(hash(readFileSync(f.backupPath)), backupBytes);
  assert.equal(pending(f.db).filter(row => JSON.parse(row.action_json).type === 'WORLD_LIVES_ACTIVATE').length, 1);
  const expected = `evt:${hash('canon-ambient-p183-v21|lives-migration-test|existing-notice').slice(0, 32)}`;
  assert.equal(events(f.db)[0].id, expected, 'event identity remains pinned to the original v21 scheme');
});

test('unknown manifests, mismatched database releases and unreceipted new saves fail closed', t => {
  const f = legacy(t), original = snapshot(f);
  for (const version of ['unknown', 'canon-ambient-p183-v21', NEXT]) {
    setManifest(f, version); const before = snapshot(f);
    assert.throws(() => upgradeOffscreenLives(f), /Only the pinned v22/);
    assert.deepEqual(snapshot(f), before);
  }
  setManifest(f, OLD);
  f.db.prepare('UPDATE world_state SET rules_version=? WHERE id=1').run('unknown-release');
  let before = snapshot(f);
  assert.throws(() => upgradeOffscreenLives(f), /Only the pinned v22/);
  assert.deepEqual(snapshot(f), before);
  const state = JSON.parse(original.row.state_json); state.offscreenLives = initialOffscreenLives();
  f.db.prepare('UPDATE world_state SET rules_version=?,state_json=? WHERE id=1')
    .run(original.row.rules_version.replace(OLD, NEXT), JSON.stringify(state));
  before = snapshot(f);
  assert.throws(() => upgradeOffscreenLives(f), /No matching committed upgrade receipt/);
  assert.deepEqual(snapshot(f), before);
  assert.equal(existsSync(f.backupPath), false);
});

test('invalid canon, pre-existing new state and unexpected activation cannot be upgraded', t => {
  const f = legacy(t), original = stateRow(f.db);
  for (const mutation of [
    state => { state.characters.goaden.location = 'unknown-location'; },
    state => { state.offscreenLives = initialOffscreenLives(); },
    state => { state.meta.upgrades.push({ from: OLD, to: NEXT, cutoverAt: cutover }); },
  ]) {
    const state = JSON.parse(original.state_json); mutation(state);
    f.db.prepare('UPDATE world_state SET state_json=? WHERE id=1').run(JSON.stringify(state));
    const before = snapshot(f);
    assert.throws(() => upgradeOffscreenLives(f)); assert.deepEqual(snapshot(f), before);
  }
  f.db.prepare('UPDATE world_state SET state_json=? WHERE id=1').run(original.state_json);
  const action = { id: 'unexpected-lives-activation', type: 'WORLD_LIVES_ACTIVATE', dueAt: cutover + 2, priority: 1, day };
  f.db.prepare('INSERT INTO scheduled_actions(id,due_at,priority,action_json) VALUES(?,?,?,?)')
    .run(action.id, action.dueAt, action.priority, JSON.stringify(action));
  const before = snapshot(f);
  assert.throws(() => upgradeOffscreenLives(f), /Unexpected prior lives activation/);
  assert.deepEqual(snapshot(f), before); assert.equal(existsSync(f.backupPath), false);
});

test('a fresh verified backup is mandatory and a failed database update rolls back the whole upgrade', t => {
  const f = legacy(t), before = snapshot(f);
  assert.throws(() => upgradeOffscreenLives({ directory: f.directory }), /backup path/);
  assert.deepEqual(snapshot(f), before);
  const occupied = join(f.directory, 'occupied.sqlite'); writeFileSync(occupied, 'do not overwrite');
  assert.throws(() => upgradeOffscreenLives({ directory: f.directory, backupPath: occupied }), /already exists/);
  assert.equal(readFileSync(occupied, 'utf8'), 'do not overwrite'); assert.deepEqual(snapshot(f), before);
  f.db.exec("CREATE TRIGGER prevent_test_update BEFORE UPDATE ON world_state BEGIN SELECT RAISE(ABORT, 'injected update failure'); END");
  assert.throws(() => upgradeOffscreenLives(f), /injected update failure/);
  assert.deepEqual(snapshot(f), before);
  assert.ok(existsSync(f.backupPath), 'the rollback still leaves its pre-transaction recovery backup');
  assert.equal(hash(readFileSync(f.backupPath)), JSON.parse(readFileSync(`${f.backupPath}.json`, 'utf8')).sha256);
});
