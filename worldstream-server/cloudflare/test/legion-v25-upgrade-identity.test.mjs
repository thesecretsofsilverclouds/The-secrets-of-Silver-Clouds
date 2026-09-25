import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../../experiment-l/src/world.mjs';
import { createFixture, RULES_VERSION } from '../../src/fixture.mjs';
import { fixtureIdentity } from '../../src/world-identity.mjs';
import { upgradeLegionJobs } from '../../src/legion-upgrade.mjs';
import { upgradeDuskkinCompliance } from '../../src/duskkin-upgrade.mjs';
import { upgradeLivingPlaces } from '../../src/living-places-upgrade.mjs';
import { upgradeV28 } from '../../src/v28-upgrade.mjs';
import { upgradeRhythm } from '../../src/rhythm-upgrade.mjs';
import { upgradeNarrativeSystems } from '../../src/narrative-upgrade.mjs';
import { WorldDurableObject } from '../src/world-durable-object.mjs';
import { createMockSqlStorage } from '../src/sqlite-adapter.mjs';
import { atLondon } from '../../src/time.mjs';

const OLD = 'canon-ambient-p183-v24';
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

function v24Sqlite(seed = 'cf-legion-live-copy', { bareRules = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-legion-cf-'));
  const dbPath = join(directory, 'world.sqlite');
  const current = createFixture({ startMs: start }), initial = current.initialState();
  delete initial.legionJobs;
  delete initial.narrativeSignals;
  delete initial.rhythm;
  initial.meta.upgrades = [
    { from: 'canon-ambient-p183-v22', to: 'canon-ambient-p183-v23', cutoverAt: start,
      activatedAt: start + 1, activationActionId: `lives-v23/activate/${start}` },
    { from: 'canon-ambient-p183-v23', to: OLD, cutoverAt: start,
      activatedAt: start + 1, activationActionId: `meu-v24/activate/${start}` },
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
    format: 1, database: 'world.sqlite', rulesVersion: OLD,
  }, null, 2) + '\n');
  if (bareRules) rewriteBareRules(dbPath, OLD);
  return { directory, dbPath, backupPath: join(directory, 'before-v25.sqlite'), seed };
}

function loadRow(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try { return db.prepare('SELECT * FROM world_state WHERE id=1').get(); }
  finally { db.close(); }
}

test('Cloudflare DO refuses an unupgraded v24 sqlite under v25 rules', () => {
  const live = v24Sqlite();
  const row = loadRow(live.dbPath);
  assert.match(row.rules_version, /canon-ambient-p183-v24/);
  const nodeDb = new DatabaseSync(':memory:');
  nodeDb.exec(`CREATE TABLE world_state (
    id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
    resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)`);
  nodeDb.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
    row.seed, row.rules_version, row.resolved_through, row.state_json);
  assert.throws(() => mockDo(nodeDb, { WORLD_SEED: live.seed, START_MS: start }),
    /refusing to reinterpret its history/);
});

test('after the documented v24→v25 copy-upgrade, Cloudflare DO accepts the same epoch and seed', () => {
  const live = v24Sqlite();
  const before = loadRow(live.dbPath);
  upgradeLegionJobs(live);
  const afterLegion = loadRow(live.dbPath);
  assert.equal(afterLegion.seed, before.seed);
  assert.equal(afterLegion.resolved_through, before.resolved_through);
  assert.equal(afterLegion.rules_version, fixtureIdentity(createFixture({ startMs: start }), 'canon-ambient-p183-v25'));
  const refusedV25 = new DatabaseSync(':memory:');
  refusedV25.exec(`CREATE TABLE world_state (
    id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
    resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)`);
  refusedV25.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
    afterLegion.seed, afterLegion.rules_version, afterLegion.resolved_through, afterLegion.state_json);
  assert.throws(() => mockDo(refusedV25, { WORLD_SEED: live.seed, START_MS: start }),
    /refusing to reinterpret its history/);

  upgradeDuskkinCompliance({ directory: live.directory, backupPath: join(live.directory, 'before-v26.sqlite') });
  upgradeLivingPlaces({ directory: live.directory, backupPath: join(live.directory, 'before-v27.sqlite') });
  completeCurrentUpgrade(live);
  const after = loadRow(live.dbPath);
  assert.equal(after.seed, before.seed);
  assert.equal(after.resolved_through, before.resolved_through);
  assert.equal(after.rules_version, fixtureIdentity(createFixture({ startMs: start }), RULES_VERSION));
  assert.ok(['canon-ambient-p183-v27', 'canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION));
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

test('Cloudflare-shaped bare v24 export is refused, then accepted after copy-upgrade', () => {
  const live = v24Sqlite('cf-bare-legion-copy', { bareRules: true });
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

  upgradeLegionJobs(live);
  const afterLegion = loadRow(live.dbPath);
  assert.equal(afterLegion.rules_version, fixtureIdentity(createFixture({ startMs: start }), 'canon-ambient-p183-v25'));
  const stillRefusedV25 = new DatabaseSync(':memory:');
  stillRefusedV25.exec(`CREATE TABLE world_state (
    id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
    resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)`);
  stillRefusedV25.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
    afterLegion.seed, afterLegion.rules_version, afterLegion.resolved_through, afterLegion.state_json);
  assert.throws(() => mockDo(stillRefusedV25, { WORLD_SEED: live.seed, START_MS: start }),
    /refusing to reinterpret its history/);

  upgradeDuskkinCompliance({ directory: live.directory, backupPath: join(live.directory, 'before-v26.sqlite') });
  upgradeLivingPlaces({ directory: live.directory, backupPath: join(live.directory, 'before-v27.sqlite') });
  completeCurrentUpgrade(live);
  const after = loadRow(live.dbPath);
  assert.equal(after.seed, before.seed);
  assert.equal(after.resolved_through, before.resolved_through);
  assert.equal(after.rules_version, fixtureIdentity(createFixture({ startMs: start }), RULES_VERSION));
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

function completeCurrentUpgrade(live) {
  for (const [version, upgrade] of [['v28', upgradeV28], ['v29', upgradeNarrativeSystems], ['v30', upgradeRhythm]]) {
    const row = loadRow(live.dbPath);
    const intermediate = new DatabaseSync(':memory:');
    intermediate.exec('CREATE TABLE world_state (id INTEGER PRIMARY KEY, seed TEXT NOT NULL, rules_version TEXT NOT NULL, resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)');
    intermediate.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(row.seed, row.rules_version, row.resolved_through, row.state_json);
    try {
      assert.throws(() => mockDo(intermediate, { WORLD_SEED: live.seed, START_MS: start }), /refusing to reinterpret its history/);
    } finally { intermediate.close(); }
    upgrade({ directory: live.directory, backupPath: join(live.directory, 'before-' + version + '.sqlite') });
  }
}
