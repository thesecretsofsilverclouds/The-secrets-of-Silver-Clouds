import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture, eventId, RULES_VERSION } from '../src/fixture.mjs';
import { initialMeuCasesState } from '../src/meu-cases.mjs';
import { openPinnedWorld, restoreWorldBackup } from '../src/world-operations.mjs';
import { upgradeMeuCases } from '../src/meu-upgrade.mjs';
import { atLondon } from '../src/time.mjs';

const OLD = 'canon-ambient-p183-v23', NEXT = 'canon-ambient-p183-v24';
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

function legacy(t) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-meu-upgrade-'));
  const dbPath = join(directory, 'world.sqlite'), backupPath = join(directory, 'before-v24.sqlite');
  const current = createFixture({ startMs: start }), initial = current.initialState();
  delete initial.meuCases;
  initial.meta.upgrades = [{ from: 'canon-ambient-p183-v22', to: OLD, cutoverAt: start,
    activatedAt: start + 1, activationActionId: `lives-v23/activate/${start}` }];
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
  const world = new WorldStore({ dbPath, seed: 'meu-migration-test', fixture });
  world.advance(cutover); world.close();
  const db = new DatabaseSync(dbPath); t.after(() => db.close());
  const f = { directory, dbPath, backupPath, db }; setManifest(f, OLD);
  return f;
}

test('v23 to v24 preserves old ledger bytes, memories, clock, seed and every existing pending action', t => {
  const f = legacy(t), before = snapshot(f);
  assert.equal(RULES_VERSION, NEXT);
  assert.throws(() => openPinnedWorld({ directory: f.directory }), /differs/);
  const result = upgradeMeuCases(f), after = snapshot(f);
  assert.equal(result.status, 'upgraded'); assert.equal(result.rulesVersion, NEXT);
  assert.equal(result.cutoverAt, cutover); assert.equal(result.historicalEvents, before.events.length);
  assert.deepEqual(after.events, before.events);
  for (const key of ['id', 'seed', 'resolved_through']) assert.equal(after.row[key], before.row[key], key);
  const original = JSON.parse(before.row.state_json), state = JSON.parse(after.row.state_json);
  for (const [key, value] of Object.entries(original)) if (key !== 'meta') assert.deepEqual(state[key], value, key);
  for (const [key, value] of Object.entries(original.meta)) if (key !== 'upgrades') assert.deepEqual(state.meta[key], value, key);
  assert.deepEqual(state.meta.upgrades.slice(0, -1), original.meta.upgrades);
  assert.deepEqual(state.meuCases, initialMeuCasesState());
  assert.equal(after.pending.length, before.pending.length + 1);
  assert.deepEqual(after.pending.filter(row => row.id !== result.activationActionId), before.pending);
  const activation = JSON.parse(after.pending.find(row => row.id === result.activationActionId).action_json);
  assert.deepEqual(activation, { id: `meu-v24/activate/${cutover}`, type: 'WORLD_MEU_ACTIVATE',
    day, dueAt: cutover + 1, priority: 1 });
});

test('v24 upgrade is idempotent, verifiable, and backup can be restored', t => {
  const f = legacy(t);
  const result = upgradeMeuCases(f);
  assert.equal(result.status, 'upgraded');
  const second = upgradeMeuCases(f);
  assert.equal(second.status, 'already_upgraded');
  assert.equal(second.rulesVersion, NEXT);
  assert.equal(second.cutoverAt, result.cutoverAt);

  // Verify backup exists and is valid
  assert.ok(existsSync(result.backupPath));

  // Advance world past cutover
  const world = openPinnedWorld({ directory: f.directory });
  world.advance(cutover + 2 * 60 * 60000);
  const snap = world.semanticSnapshot();
  world.close();

  assert.ok(snap.events.some(e => e.type === 'WORLD_MEU_ACTIVATE'), 'Activation action must execute');
  assert.ok(snap.meta.upgrades.some(u => u.to === NEXT && u.activatedAt), 'Upgrade receipt must record activation time');
});
