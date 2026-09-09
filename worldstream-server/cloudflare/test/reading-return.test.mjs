import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { WorldDurableObject } from '../src/world-durable-object.mjs';
import { createMockSqlStorage } from '../src/sqlite-adapter.mjs';
import { atLondon } from '../../src/time.mjs';

test('Durable Object returns a full persisted week and exact old context with bounded HTTP pages', async () => {
  const db = new DatabaseSync(':memory:');
  const ctx = { storage: { sql: createMockSqlStorage(db), async getAlarm() { return null; },
    async setAlarm() {}, async deleteAlarm() {} }, getWebSockets() { return []; }, acceptWebSocket() {} };
  const start = atLondon('2026-09-08', '00:00'), through = atLondon('2026-09-15', '12:00');
  const world = new WorldDurableObject(ctx, { START_MS: start });
  try {
    world.advance(through);
    const before = world.operationalStats();
    const expected = db.prepare(`SELECT id FROM events WHERE occurred_at >= ? AND occurred_at <= ?
      AND json_extract(semantic_json, '$.visibility') = 'public'
      AND length(json_extract(semantic_json, '$.publicDescription')) > 0 ORDER BY seq`).all(start, through).map(row => row.id);
    assert.ok(expected.length > 240);
    let cursor; const events = [];
    do {
      const response = await world.fetch(new Request(`https://reader.test/api/history?after=${start}&through=${through}&limit=100${cursor ? `&before=${cursor}` : ''}`));
      assert.equal(response.status, 200);
      const page = await response.json();
      assert.ok(page.events.length <= 100);
      assert.deepEqual(page.coverage, { after: start, through });
      assert.equal(page.continuityId, world.publicProjection().continuityId);
      assert.equal(page.complete, page.nextCursor === null);
      events.unshift(...page.events); cursor = page.nextCursor;
    } while (cursor);
    assert.deepEqual(events.map(row => row.id), expected);
    const old = events[0];
    const response = await world.fetch(new Request(`https://reader.test/api/events/${encodeURIComponent(old.id)}/context`));
    assert.equal(response.status, 200);
    const context = await response.json();
    assert.equal(context.event.id, old.id);
    assert.equal(context.continuityId, world.publicProjection().continuityId);
    assert.equal(context.events.at(-1).id, old.id);
    assert.equal((await world.fetch(new Request('https://reader.test/api/history?through=NaN'))).status, 400);
    assert.equal((await world.fetch(new Request('https://reader.test/api/events/missing/context'))).status, 404);
    assert.deepEqual(world.operationalStats(), before, 'history/context reads do not change canonical state');
  } finally { db.close(); }
});
