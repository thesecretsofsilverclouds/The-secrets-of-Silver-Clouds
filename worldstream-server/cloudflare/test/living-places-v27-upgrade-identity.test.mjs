import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../../experiment-l/src/world.mjs';
import { createFixture, RULES_VERSION } from '../../src/fixture.mjs';
import { fixtureIdentity } from '../../src/world-identity.mjs';
import { upgradeLivingPlaces } from '../../src/living-places-upgrade.mjs';
import { WorldDurableObject } from '../src/world-durable-object.mjs';
import { createMockSqlStorage } from '../src/sqlite-adapter.mjs';
import { atLondon } from '../../src/time.mjs';

const OLD = 'canon-ambient-p183-v26';
const start = atLondon('2026-09-05', '00:00');

function mockDo(nodeDb, env) {
  const storage = {
    sql: createMockSqlStorage(nodeDb),
    async getAlarm() { return null; },
    async setAlarm() {},
    async deleteAlarm() {},
  };
  return new WorldDurableObject({
    storage,
    waitUntil() {},
    acceptWebSocket() {},
    getWebSockets() { return []; },
  }, env);
}

function rewriteBareRules(dbPath, version) {
  const db = new DatabaseSync(dbPath);
  try { db.prepare('UPDATE world_state SET rules_version=? WHERE id=1').run(version); }
  finally { db.close(); }
}

function v26Sqlite(seed = 'cf-living-places-live-copy', { bareRules = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-living-places-cf-'));
  const dbPath = join(directory, 'world.sqlite');
  const current = createFixture({ startMs: start }), initial = current.initialState();
  delete initial.livingPlaces;
  initial.meta.upgrades = [
    { from: 'canon-ambient-p183-v22', to: 'canon-ambient-p183-v23', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `lives-v23/activate/${start}` },
    { from: 'canon-ambient-p183-v23', to: 'canon-ambient-p183-v24', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `meu-v24/activate/${start}` },
    { from: 'canon-ambient-p183-v24', to: 'canon-ambient-p183-v25', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `legion-v25/activate/${start}` },
    { from: 'canon-ambient-p183-v25', to: OLD, cutoverAt: start,
      activatedAt: start + 1, activationActionId: `duskkin-v26/activate/${start}` },
  ];
  const fixture = {
    ...current,
    rulesVersion: OLD,
    initialState: () => structuredClone(initial),
    initialActions: () => current.initialActions(),
    reduceAction: (state, action, seedValue) => current.reduceAction(state, action, seedValue),
  };
  const world = new WorldStore({ dbPath, seed, fixture });
  world.advance(start + 2 * 24 * 3600_000);
  world.close();
  writeFileSync(join(directory, 'active-world.json'), JSON.stringify({
    format: 1, database: 'world.sqlite', rulesVersion: OLD, note: 'v26 test fixture'
  }));
  if (bareRules) rewriteBareRules(dbPath, OLD);
  return { directory, dbPath, backupPath: join(directory, 'before-v27.sqlite'), seed, startMs: start };
}

function loadRow(dbPath) {
  const db = new DatabaseSync(dbPath);
  try { return db.prepare('SELECT seed, rules_version, resolved_through, state_json FROM world_state WHERE id = 1').get(); }
  finally { db.close(); }
}

test('Cloudflare DO refuses an unupgraded v26 sqlite under v27 rules', () => {
  const live = v26Sqlite();
  const row = loadRow(live.dbPath);
  assert.equal(row.rules_version, fixtureIdentity(createFixture({ startMs: start }), OLD));
  const nodeDb = new DatabaseSync(':memory:');
  nodeDb.exec(`CREATE TABLE world_state (
    id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
    resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)`);
  nodeDb.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
    row.seed, row.rules_version, row.resolved_through, row.state_json);
  assert.throws(() => mockDo(nodeDb, { WORLD_SEED: live.seed, START_MS: start }),
    /refusing to reinterpret its history/);
});

test('after the documented v26→v27 copy-upgrade, Cloudflare DO accepts the same epoch and seed', () => {
  const live = v26Sqlite();
  const before = loadRow(live.dbPath);
  upgradeLivingPlaces(live);
  const after = loadRow(live.dbPath);
  assert.equal(after.seed, before.seed);
  assert.equal(after.resolved_through, before.resolved_through);
  assert.equal(after.rules_version, fixtureIdentity(createFixture({ startMs: start })));
  assert.equal(RULES_VERSION, 'canon-ambient-p183-v27');
  const nodeDb = new DatabaseSync(':memory:');
  nodeDb.exec(`CREATE TABLE world_state (
    id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
    resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)`);
  nodeDb.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
    after.seed, after.rules_version, after.resolved_through, after.state_json);
  const doObj = mockDo(nodeDb, { WORLD_SEED: live.seed, START_MS: start });
  assert.equal(doObj.getSeed(), live.seed);
  assert.equal(doObj.getResolvedThrough(), before.resolved_through);
});

test('Cloudflare-shaped bare v26 export is refused, then accepted after copy-upgrade', () => {
  const live = v26Sqlite('cf-bare-living-places-copy', { bareRules: true });
  const before = loadRow(live.dbPath);
  assert.equal(before.rules_version, OLD);
  const refused = new DatabaseSync(':memory:');
  refused.exec(`CREATE TABLE world_state (
    id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
    resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)`);
  refused.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
    before.seed, before.rules_version, before.resolved_through, before.state_json);
  assert.throws(() => mockDo(refused, { WORLD_SEED: live.seed, START_MS: start }),
    /refusing to reinterpret its history/);

  upgradeLivingPlaces(live);
  const after = loadRow(live.dbPath);
  assert.equal(after.seed, before.seed);
  assert.equal(after.resolved_through, before.resolved_through);
  assert.equal(after.rules_version, fixtureIdentity(createFixture({ startMs: start })));
  const accepted = new DatabaseSync(':memory:');
  accepted.exec(`CREATE TABLE world_state (
    id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
    resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)`);
  accepted.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
    after.seed, after.rules_version, after.resolved_through, after.state_json);
  const doObj = mockDo(accepted, { WORLD_SEED: live.seed, START_MS: start });
  assert.equal(doObj.getSeed(), live.seed);
  assert.equal(doObj.getResolvedThrough(), before.resolved_through);
});
