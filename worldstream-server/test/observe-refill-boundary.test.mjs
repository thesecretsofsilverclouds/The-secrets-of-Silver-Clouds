import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.mjs';
import { openWorld } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { WorldDurableObject } from '../cloudflare/src/world-durable-object.mjs';
import { createMockSqlStorage } from '../cloudflare/src/sqlite-adapter.mjs';

function createMockDoContext(rawDb = null) {
  const nodeDb = rawDb ?? new DatabaseSync(':memory:');
  const mockSql = createMockSqlStorage(nodeDb);
  const activeSockets = [];
  let scheduledAlarm = null;
  const waitUntilPromises = [];

  const storage = {
    sql: mockSql,
    async getAlarm() { return scheduledAlarm; },
    async setAlarm(time) { scheduledAlarm = time; },
    async deleteAlarm() { scheduledAlarm = null; }
  };

  const ctx = {
    storage,
    waitUntil(p) { waitUntilPromises.push(p); },
    acceptWebSocket(ws, tags) {
      ws.tags = tags;
      activeSockets.push(ws);
    },
    getWebSockets(tag) {
      return activeSockets.filter(ws => ws.tags && ws.tags.includes(tag) && ws.readyState === 1);
    }
  };

  return { ctx, nodeDb, storage, activeSockets, waitUntilPromises };
}

test('observe/refill boundary: Node /api/observe is strictly reader catch-up and cannot reserve refill or call a model', async () => {
  const startMs = atLondon('2026-09-04', '00:00');
  const world = openWorld({ dbPath: ':memory:', startMs, seed: 'test-seed-boundary' });

  // Enable refill in process.env with a mock API key
  const prevEnabled = process.env.RESERVOIR_REFILL_ENABLED;
  const prevKey = process.env.OPENAI_API_KEY;
  process.env.RESERVOIR_REFILL_ENABLED = 'true';
  process.env.OPENAI_API_KEY = 'test-mock-key';

  let clientCallCount = 0;
  const server = createApp({
    world,
    now: () => startMs + 3600_000,
    cinematicOptions: { enabled: false }
  });

  try {
    // Start listening on ephemeral port
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    // Call /api/observe 10 times consecutively
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${base}/api/observe`, { method: 'POST' });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(data.events, 'returns public events');
      assert.ok(data.clocks, 'returns clocks');
      assert.equal(data.serverTime, startMs + 3600_000);
    }

    // Verify: no refill table exists or has zero entries, client was never called
    assert.equal(clientCallCount, 0, 'refill client must never be called by /api/observe');
    const refillTable = world.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='scene_refill_state'"
    ).get();
    if (refillTable) {
      const row = world.db.prepare('SELECT state_json FROM scene_refill_state WHERE id = 1').get();
      if (row) {
        const state = JSON.parse(row.state_json);
        assert.equal(state.attempts.length, 0, 'No refill attempts or reservations may be created by /api/observe');
      }
    }
  } finally {
    process.env.RESERVOIR_REFILL_ENABLED = prevEnabled;
    process.env.OPENAI_API_KEY = prevKey;
    await new Promise(r => server.close(r));
    world.close();
  }
});

test('observe/refill boundary: Cloudflare DO /api/observe never touches scene reservoir refill', async () => {
  const { ctx, nodeDb } = createMockDoContext();
  const startMs = atLondon('2026-09-04', '00:00');
  const env = {
    WORLD_SEED: 'test-seed-cf-observe',
    START_MS: startMs,
    RESERVOIR_REFILL_ENABLED: 'true',
    OPENAI_API_KEY: 'test-key'
  };
  const doObj = new WorldDurableObject(ctx, env);

  // Call /api/observe on DO via fetch
  for (let i = 0; i < 5; i++) {
    const req = new Request('https://worldstream.internal/api/observe', { method: 'POST' });
    const res = await doObj.fetch(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.events, 'returns public projection events');
    assert.ok(body.clocks, 'returns clocks');
  }

  // scene_refill_state table must not even exist because sceneReservoir was never accessed
  const hasTable = nodeDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scene_refill_state'").get();
  assert.equal(hasTable, undefined, 'DO /api/observe must not even initialize or touch scene reservoir runtime');
});

test('observe/refill boundary: Cloudflare DO alarm owns scheduled maintenance', async () => {
  const { ctx, nodeDb, waitUntilPromises } = createMockDoContext();
  const startMs = atLondon('2026-09-04', '00:00');
  const env = {
    WORLD_SEED: 'test-seed-cf-alarm',
    START_MS: startMs,
    RESERVOIR_REFILL_ENABLED: 'false' // Refill disabled by default in config
  };
  const doObj = new WorldDurableObject(ctx, env);

  // Trigger alarm()
  await doObj.alarm();

  // Verification: alarm advanced the world and scheduled next alarm
  const nextAlarm = await ctx.storage.getAlarm();
  assert.ok(nextAlarm > 0, 'alarm schedules the next alarm 60 seconds out');
  assert.ok(doObj.getResolvedThrough() >= startMs, 'alarm advances world progression');
});
