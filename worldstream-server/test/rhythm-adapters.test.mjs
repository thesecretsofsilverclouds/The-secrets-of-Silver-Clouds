import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { WorldDurableObject } from '../cloudflare/src/world-durable-object.mjs';
import { createMockSqlStorage } from '../cloudflare/src/sqlite-adapter.mjs';
import { createFixture, eventId } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';

const startMs = atLondon('2026-09-05', '00:00'), seed = 'rhythm-acceptance-00';
const queue = db => db.prepare('SELECT action_json FROM scheduled_actions ORDER BY due_at,priority,id').all()
  .map(row => JSON.parse(row.action_json));
const state = db => JSON.parse(db.prepare('SELECT state_json FROM world_state WHERE id=1').get().state_json);
const canonical = db => ({ state: state(db), pending: queue(db),
  events: db.prepare('SELECT semantic_json FROM events ORDER BY seq').all().map(row => JSON.parse(row.semantic_json)),
  through: db.prepare('SELECT resolved_through FROM world_state WHERE id=1').get().resolved_through });

for (const stage of ['choice', 'concrete start']) test(`real Node and Cloudflare adapters block a RHYTHM ${stage} for already queued duty`, t => {
  const node = new WorldStore({ dbPath: ':memory:', seed, fixture: createFixture({ startMs }) });
  const cfDB = new DatabaseSync(':memory:');
  t.after(() => { node.close(); cfDB.close(); });
  const cf = new WorldDurableObject({ storage: { sql: createMockSqlStorage(cfDB),
    async getAlarm() { return null; }, async setAlarm() {}, async deleteAlarm() {} },
    waitUntil() {}, acceptWebSocket() {}, getWebSockets() { return []; } }, { START_MS: startMs, WORLD_SEED: seed });
  const worlds = [{ runtime: node, db: node.db }, { runtime: cf, db: cfDB }];
  for (const { runtime } of worlds) runtime.advance(startMs + 1);
  const choice = queue(node.db).find(action => action.type === 'RHYTHM_CHOOSE');
  assert.ok(choice);
  for (const { runtime } of worlds) runtime.advance(choice.dueAt - 1);
  if (stage === 'concrete start') for (const { runtime, db } of worlds) {
    runtime.advance(choice.dueAt);
    const decided = JSON.parse(db.prepare('SELECT semantic_json FROM events WHERE id=?').get(eventId(seed, choice.id)).semantic_json);
    assert.ok(decided.payload.scores?.length, 'The initial decision must really have succeeded');
    assert.ok(queue(db).some(action => action.id === choice.legacyId && action.rhythm?.decisionEventId === decided.id));
  }
  const snapshots = worlds.map(({ db }) => structuredClone(state(db).rhythm));
  const duty = { id: `adapter-audit/duty-at-${stage}`, day: choice.day, actor: choice.actor, type: 'BRIEFING_BEGIN',
    dueAt: choice.slotAt + 15 * 60_000, priority: 40, duration: 30 };
  const targetActionId = stage === 'choice' ? choice.id : choice.legacyId;
  for (const [index, { runtime, db }] of worlds.entries()) {
    db.prepare('INSERT INTO scheduled_actions VALUES(?,?,?,?)').run(duty.id, duty.dueAt, duty.priority, JSON.stringify(duty));
    runtime.advance(stage === 'choice' ? choice.dueAt : choice.slotAt);
    const refused = JSON.parse(db.prepare('SELECT semantic_json FROM events WHERE id=?').get(eventId(seed, targetActionId)).semantic_json);
    assert.equal(refused.payload.outcome, 'skipped');
    assert.equal(refused.payload.reason, 'The declared leisure slot is no longer free');
    assert.deepEqual(refused.changes, []);
    assert.deepEqual(state(db).rhythm, snapshots[index], 'A refusal must not change needs or learn a habit');
    assert.ok(queue(db).some(action => action.id === duty.id), 'The existing duty must retain its queue ownership');
    assert.ok(!queue(db).some(action => action.id === choice.legacyId || action.id.startsWith(`${choice.legacyId}/complete/`)));
  }
  assert.deepEqual(canonical(cfDB), canonical(node.db), 'Production adapters must commit identical refusal semantics');
});
