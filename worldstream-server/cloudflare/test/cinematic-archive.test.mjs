import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { WorldDurableObject } from '../src/world-durable-object.mjs';
import { createMockSqlStorage } from '../src/sqlite-adapter.mjs';
import { atLondon } from '../../src/time.mjs';
import { scoreCinematicEvent, scenePacketKey } from '../../src/cinematics.mjs';

function worldForWeek() {
  const db = new DatabaseSync(':memory:');
  const ctx = {
    storage: { sql: createMockSqlStorage(db), async setAlarm() {}, async getAlarm() { return null; } },
    getWebSockets() { return []; },
  };
  const world = new WorldDurableObject(ctx, { START_MS: atLondon('2026-09-01', '00:00') });
  const end = atLondon('2026-09-08', '00:00');
  world.advance(end);
  return { db, world, end };
}

test('the same seven-day world archives its existing qualifying scenes with mounted artwork', async t => {
  const { db, world, end } = worldForWeek();
  t.after(() => db.close());
  t.mock.method(Date, 'now', () => end);
  const ledger = db.prepare('SELECT semantic_json FROM events ORDER BY seq').all();
  const qualifying = ledger.map(row => JSON.parse(row.semantic_json))
    .filter(event => event.visibility === 'public' && scoreCinematicEvent(event).score >= 70);
  assert.equal(qualifying.length, 3, 'baseline window contains three qualifying committed events');
  const stored = db.prepare('SELECT * FROM cinematics ORDER BY occurred_at').all();
  assert.deepEqual(stored.map(row => row.event_id), qualifying.map(event => event.id));
  for (const row of stored) assert.equal(row.packet_key, scenePacketKey(JSON.parse(row.packet_json)));

  const archive = await (await world.fetch(new Request('https://local.test/api/cinematics/archive'))).json();
  assert.equal(archive.cinematics.length, 3);
  for (const record of archive.cinematics) {
    const assets = [record.scene.assets.background, ...Object.values(record.scene.assets.plates)];
    for (const asset of assets) {
      assert.ok(asset.url.startsWith('/worldstream/app/scene/'), asset.url);
      assert.ok(existsSync(new URL(`../../..${asset.url}`, import.meta.url)), asset.url);
    }
    const detail = await (await world.fetch(new Request(`https://local.test/api/cinematics/events/${record.eventId}`))).json();
    assert.deepEqual(detail.cinematic.scene.assets, record.scene.assets);
  }
  assert.deepEqual(db.prepare('SELECT semantic_json FROM events ORDER BY seq').all(), ledger,
    'archive reads do not rewrite or add canonical events');
});

test('repairing a previously empty archive restores only committed qualifying history and never announces it as live', async t => {
  const { db, world, end } = worldForWeek();
  t.after(() => db.close());
  t.mock.method(Date, 'now', () => end);
  // Reproduce the old adapter failure without altering the canonical world.
  db.exec('DELETE FROM cinematics');
  const ledger = db.prepare('SELECT semantic_json FROM events ORDER BY seq').all();
  const first = await (await world.fetch(new Request('https://local.test/api/cinematics/archive'))).json();
  assert.equal(first.cinematics.length, 3);
  const rows = db.prepare('SELECT * FROM cinematics ORDER BY event_id').all();
  assert.ok(rows.every(row => row.accepted_at === row.occurred_at));
  const live = await (await world.fetch(new Request('https://local.test/api/cinematics/live?after=0'))).json();
  assert.equal(live.cinematic, null);
  const second = await (await world.fetch(new Request('https://local.test/api/cinematics/archive'))).json();
  assert.deepEqual(second, first);
  assert.deepEqual(db.prepare('SELECT * FROM cinematics ORDER BY event_id').all(), rows);
  assert.deepEqual(db.prepare('SELECT semantic_json FROM events ORDER BY seq').all(), ledger);
});
