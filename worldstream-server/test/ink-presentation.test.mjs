import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { INK_BOOKING_SCENE } from '../src/venues.mjs';
import { buildScenePacket, performancePacket } from '../src/cinematics.mjs';
import { openCinematicStore } from '../src/cinematic-store.mjs';
import { CinematicService, ViewerRegistry } from '../src/cinematic-service.mjs';
import { createApp } from '../server.mjs';

const startMs = atLondon('2026-10-08', '00:00');
function completedWorld() {
  const world = openWorld({ dbPath: ':memory:', startMs });
  world.advance(atLondon('2026-10-08', '18:00'));
  return world;
}

test('an archived booking has historical knowledge, never the future finished result', t => {
  const world = completedWorld(); t.after(() => world.close());
  const snapshot = world.semanticSnapshot(), before = semanticDigest(snapshot);
  const booking = snapshot.events.find(event => event.type === 'INK_APPOINTMENT_BOOKED' && event.visibility === 'public');
  assert.ok(snapshot.storyEffects.ink.result);
  const packet = performancePacket(buildScenePacket(booking, snapshot));
  assert.deepEqual(packet.event.canonicalLines.map(line => line.line), INK_BOOKING_SCENE.lines.map(line => line.text));
  for (const actor of Object.values(packet.characters)) {
    assert.ok(actor.knownFacts.some(fact => fact.presentationText?.includes('chose a moving prowler')));
    assert.equal(actor.knownFacts.some(fact => fact.id.startsWith('ink:result:')), false);
    assert.ok(actor.knownFacts.every(fact => fact.learnedAt <= booking.occurredAt));
  }
  assert.equal(semanticDigest(world.semanticSnapshot()), before);
});

test('the committed booking plays through the shared authored cache and HTTP replay has zero world effects', async t => {
  const probe = completedWorld();
  const booking = probe.semanticSnapshot().events.find(event => event.type === 'INK_APPOINTMENT_BOOKED' && event.visibility === 'public');
  probe.close();
  const world = openWorld({ dbPath: ':memory:', startMs });
  const store = openCinematicStore({ dbPath: ':memory:' });
  t.after(() => { store.close(); world.close(); });
  world.advance(booking.occurredAt);
  const before = semanticDigest(world.semanticSnapshot());
  const registry = new ViewerRegistry(); registry.touch('local-review', booking.occurredAt);
  let modelCalls = 0;
  const service = new CinematicService({ store, config: { enabled: false, minSceneGapMs: 0 },
    now: () => booking.occurredAt, getPresence: at => registry.snapshot(at),
    client: () => { modelCalls++; throw new Error('Phase 1 must not call a model'); } });
  const run = service.ingest(world.semanticSnapshot(), { now: booking.occurredAt, presence: registry.snapshot(booking.occurredAt) });
  assert.equal(run.selected.eventId, booking.id);
  const cached = await run.generation;
  assert.equal(cached.status, 'fallback');
  assert.equal(cached.scene.source, 'canonical');
  assert.deepEqual(cached.scene.beats.map(beat => beat.line), INK_BOOKING_SCENE.lines.map(line => line.text));
  const server = createApp({ world, cinematicService: service, now: () => booking.occurredAt });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    let first;
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${base}/api/cinematics/events/${encodeURIComponent(booking.id)}`);
      assert.equal(response.status, 200);
      const replay = await response.json();
      if (first) assert.deepEqual(replay, first); else first = replay;
      const publicWorld = await fetch(`${base}/api/world`).then(response => response.json());
      assert.deepEqual(publicWorld.storyResults, []);
      assert.deepEqual(publicWorld.events.find(event => event.id === booking.id).lines, INK_BOOKING_SCENE.lines);
      assert.equal(Object.hasOwn(publicWorld, 'storyEffects'), false);
      assert.equal(semanticDigest(world.semanticSnapshot()), before);
    }
    world.advance(atLondon('2026-10-08', '18:00'));
    const publicWorld = await fetch(`${base}/api/world`).then(response => response.json());
    assert.equal(publicWorld.storyResults.length, 1);
    assert.equal(publicWorld.storyResults[0].owner, 'goaden');
    const resultKey = world.semanticSnapshot().storyEffects.ink.result.factKey;
    assert.equal(JSON.stringify(publicWorld).includes(resultKey), false, 'fresh result memory leaked its private key');
    assert.equal(modelCalls, 0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
