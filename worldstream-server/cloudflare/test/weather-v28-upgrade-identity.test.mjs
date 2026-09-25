import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { WorldDurableObject } from '../src/world-durable-object.mjs';
import { createMockSqlStorage } from '../src/sqlite-adapter.mjs';
import { createFixture, RULES_VERSION } from '../../src/fixture.mjs';
import { fixtureIdentity } from '../../src/world-identity.mjs';
import { atLondon } from '../../src/time.mjs';

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

test('Cloudflare v30 refuses to silently relabel a v27 world during startup', async () => {
  const start = atLondon('2026-09-05', '00:00');
  const resolvedThrough = atLondon('2026-09-06', '12:00');
  const seed = 'live-v27-to-v28-test';
  const fixtureV27 = createFixture({ startMs: start });
  const v27State = fixtureV27.initialState();
  delete v27State.narrativeSignals;
  delete v27State.rhythm;
  v27State.meta.upgrades = [
    { from: 'canon-ambient-p183-v26', to: 'canon-ambient-p183-v27', cutoverAt: start, activatedAt: start + 1 }
  ];

  const nodeDb = new DatabaseSync(':memory:');
  nodeDb.exec(`CREATE TABLE world_state (
    id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
    resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL)`);
  nodeDb.exec(`CREATE TABLE events (
    seq INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, occurred_at INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL, semantic_json TEXT NOT NULL)`);
  nodeDb.exec(`CREATE TABLE scheduled_actions (
    id TEXT PRIMARY KEY, due_at INTEGER NOT NULL, priority INTEGER NOT NULL,
    action_json TEXT NOT NULL)`);

  const v27RulesIdentity = fixtureIdentity(fixtureV27, 'canon-ambient-p183-v27');
  nodeDb.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
    seed, v27RulesIdentity, resolvedThrough, JSON.stringify(v27State)
  );

  const testEvent = {
    id: 'evt-test-historical',
    seq: 1,
    type: 'INCIDENT',
    occurredAt: start + 3600000,
    recordedAt: start + 3600000,
    visibility: 'public',
  };
  nodeDb.prepare('INSERT INTO events VALUES (1, ?, ?, ?, ?)').run(
    testEvent.id, testEvent.occurredAt, testEvent.recordedAt, JSON.stringify(testEvent)
  );

  const before = nodeDb.prepare('SELECT * FROM world_state WHERE id=1').get();
  assert.equal(RULES_VERSION, 'canon-ambient-p183-v30');
  assert.throws(() => mockDo(nodeDb, { WORLD_SEED: seed, START_MS: start }), /refusing to reinterpret/);
  assert.deepEqual(nodeDb.prepare('SELECT * FROM world_state WHERE id=1').get(), before);
  assert.equal(Number(nodeDb.prepare('SELECT COUNT(*) AS n FROM events').get().n), 1);
  nodeDb.close();
});
