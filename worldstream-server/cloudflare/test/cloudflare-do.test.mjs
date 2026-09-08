import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { WorldDurableObject } from '../src/world-durable-object.mjs';
import { createMockSqlStorage } from '../src/sqlite-adapter.mjs';
import { ShadowAdapter } from '../src/shadow-adapter.mjs';
import { CapacityTracker, CLOUDFLARE_FREE_LIMITS } from '../src/capacity.mjs';
import { atLondon } from '../../src/time.mjs';

function createMockDoContext(rawDb = null) {
  const nodeDb = rawDb ?? new DatabaseSync(':memory:');
  const mockSql = createMockSqlStorage(nodeDb);
  const activeSockets = [];
  let scheduledAlarm = null;

  const storage = {
    sql: mockSql,
    async getAlarm() { return scheduledAlarm; },
    async setAlarm(time) { scheduledAlarm = time; },
    async deleteAlarm() { scheduledAlarm = null; }
  };

  const ctx = {
    storage,
    acceptWebSocket(ws, tags) {
      ws.tags = tags;
      activeSockets.push(ws);
    },
    getWebSockets(tag) {
      return activeSockets.filter(ws => ws.tags && ws.tags.includes(tag) && ws.readyState === 1);
    }
  };

  return { ctx, nodeDb, storage, activeSockets };
}

test('WorldDurableObject: initializes SQLite tables and seeds canonical state', async () => {
  const { ctx, nodeDb } = createMockDoContext();
  const startMs = atLondon('2026-09-04', '00:00');
  const doObj = new WorldDurableObject(ctx, { WORLD_SEED: 'test-seed-1', START_MS: startMs });

  assert.equal(doObj.initialized, true);
  assert.equal(doObj.getSeed(), 'test-seed-1');
  assert.equal(doObj.getResolvedThrough(), startMs);

  const stats = doObj.operationalStats();
  assert.equal(stats.eventCount, 0);
  assert.ok(stats.pendingActionCount > 0, 'Initial actions queued');
});

test('WorldDurableObject: advance moves watermark, commits events and schedules followups', async () => {
  const { ctx } = createMockDoContext();
  const startMs = atLondon('2026-09-04', '00:00');
  const doObj = new WorldDurableObject(ctx, { WORLD_SEED: 'test-seed-adv', START_MS: startMs });

  // Advance 14 hours (14:00 London time)
  const targetMs = startMs + 14 * 3600_000;
  const deltas = doObj.advance(targetMs);

  assert.ok(deltas.length > 0, 'New public events produced');
  assert.equal(doObj.getResolvedThrough(), targetMs);

  const stats = doObj.operationalStats();
  assert.ok(stats.eventCount > 0, 'Events committed to SQLite');
});

test('WorldDurableObject: on-demand catchUp brings lagging world to current time', async () => {
  const { ctx } = createMockDoContext();
  const startMs = atLondon('2026-09-04', '00:00');
  const doObj = new WorldDurableObject(ctx, { WORLD_SEED: 'test-seed-catchup', START_MS: startMs });

  const nowMs = startMs + 12 * 3600_000; // 12:00
  const deltas = doObj.catchUp(nowMs);

  assert.equal(doObj.getResolvedThrough(), nowMs);
  assert.ok(Array.isArray(deltas));

  // Immediate second catchup does nothing
  const second = doObj.catchUp(nowMs);
  assert.equal(second.length, 0);
});

test('WorldDurableObject: full restart & recovery preserves complete history and state', async () => {
  const nodeDb = new DatabaseSync(':memory:');
  const startMs = atLondon('2026-09-04', '00:00');

  // Session 1: Create DO, advance world
  {
    const { ctx } = createMockDoContext(nodeDb);
    const doObj1 = new WorldDurableObject(ctx, { WORLD_SEED: 'test-seed-restart', START_MS: startMs });
    doObj1.advance(startMs + 13 * 3600_000);
  }

  // Session 2: "Restart" DO with same underlying SQLite database
  {
    const { ctx } = createMockDoContext(nodeDb);
    const doObj2 = new WorldDurableObject(ctx, { WORLD_SEED: 'test-seed-restart', START_MS: startMs });

    assert.equal(doObj2.getResolvedThrough(), startMs + 13 * 3600_000);
    const stats = doObj2.operationalStats();
    assert.ok(stats.eventCount > 0, 'Committed events survive restart');

    const snap = doObj2.presentationSnapshot();
    assert.ok(snap.characters.goaden, 'Character state survives restart');
    assert.ok(snap.characters.ashai, 'Character state survives restart');
  }
});

test('WorldDurableObject: hibernating WebSockets broadcast deltas to multiple readers', async () => {
  const { ctx } = createMockDoContext();
  const startMs = atLondon('2026-09-04', '00:00');
  const doObj = new WorldDurableObject(ctx, { WORLD_SEED: 'test-seed-ws', START_MS: startMs });

  const messages1 = [];
  const messages2 = [];

  const fakeWs1 = {
    readyState: 1,
    send(msg) { messages1.push(JSON.parse(msg)); }
  };
  const fakeWs2 = {
    readyState: 1,
    send(msg) { messages2.push(JSON.parse(msg)); }
  };

  // Register two reader WebSockets
  ctx.acceptWebSocket(fakeWs1, ['readers']);
  ctx.acceptWebSocket(fakeWs2, ['readers']);

  // Advance time and broadcast
  const deltas = doObj.advance(startMs + 14 * 3600_000);
  doObj.broadcastEvents(deltas);

  assert.ok(messages1.length > 0, 'Browser 1 received broadcast');
  assert.ok(messages2.length > 0, 'Browser 2 received broadcast');
  assert.equal(messages1[0].type, 'EVENTS_DELTA');
  assert.deepEqual(messages1[0].events, messages2[0].events, 'Both readers received identical canonical events');
});

test('WorldDurableObject: ShadowAdapter isolates Moment proposals without mutating canonical state', async () => {
  const { ctx } = createMockDoContext();
  const startMs = atLondon('2026-09-04', '00:00');
  const doObj = new WorldDurableObject(ctx, { WORLD_SEED: 'test-seed-shadow', START_MS: startMs });

  const beforeStats = doObj.operationalStats();

  // Record a shadow proposal
  const recorded = doObj.shadowAdapter.recordProposal({
    id: 'shadow-test-01',
    opportunityId: 'opp-tea-1',
    characterId: 'ashai',
    occurredAt: startMs + 1000,
    grammarKey: 'tea_contemplation',
    surfaced: false,
    lines: [{ who: 'ashai', text: 'Quiet morning.' }]
  });

  assert.equal(recorded.canonical, false, 'Shadow proposals are never canonical');
  assert.equal(recorded.characterId, 'ashai');

  // Verify canonical stats are completely unchanged
  const afterStats = doObj.operationalStats();
  assert.equal(afterStats.eventCount, beforeStats.eventCount, 'Canonical event count unchanged');
  assert.equal(afterStats.pendingActionCount, beforeStats.pendingActionCount, 'Canonical pending queue unchanged');

  // Verify retrieval
  const list = doObj.shadowAdapter.listProposals();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'shadow-test-01');
  assert.equal(list[0].canonical, false);
});

test('CapacityTracker: projects free-tier headroom accurately for 100 visits/day', async () => {
  const tracker = new CapacityTracker();
  tracker.recordRequest('http', 1.5);
  tracker.recordRequest('http', 2.0);
  tracker.recordRequest('alarms', 0.8);
  tracker.recordSqlOps(45, 12, 5);

  const metrics = tracker.getMeasuredMetrics();
  assert.equal(metrics.requests.total, 3);
  assert.ok(metrics.cpuDuration.avgMs > 0);

  const projection = tracker.projectFreeTierHeadroom({
    dailyVisits: 100,
    sessionMinutes: 10,
    requestsPerVisit: 12
  });

  assert.equal(projection.planningCase.dailyVisits, 100);
  assert.equal(projection.daily.workerRequests, 1200);
  assert.ok(projection.monthly.workerUsagePercent < 2.0, 'Worker usage is under 2% of free tier');
  assert.ok(projection.monthly.workerHeadroomPercent > 98.0, 'Headroom is over 98%');
  assert.equal(projection.daily.billedWebSocketSeconds, 0, 'Hibernating WebSockets bill 0 compute seconds for idle sessions');
});
