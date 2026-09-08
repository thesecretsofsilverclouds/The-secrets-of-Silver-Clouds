import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { DEFAULT_SEED } from '../src/fixture.mjs';
import { atLondon, nextLondonDay, MINUTE_MS } from '../src/time.mjs';
import { deriveMemories, sharedMemories, deriveTraces, deriveCarrying, deriveRapport,
  narrativeBlock, salienceOf, acquiredVia, SALIENCE, SALIENCE_FLOOR } from '../src/narrative.mjs';
import { assertNoSpoiler } from '../src/spoilers.mjs';
import { areaOf } from '../src/places.mjs';

const START = atLondon('2026-09-04', '00:00');
const DAYS = 40;
let END_DAY = '2026-09-04';
for (let i = 0; i < DAYS; i++) END_DAY = nextLondonDay(END_DAY);
const DAY = 24 * 60 * MINUTE_MS;

function world(t, name = 'w') {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-narrative-test-'));
  const store = openWorld({ dbPath: join(directory, `${name}.sqlite`), seed: DEFAULT_SEED, startMs: START });
  t.after(() => {
    store.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-narrative-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  return store;
}
let cached = null;
function snapshot(t) {
  if (cached) return cached;
  const store = world(t);
  store.advance(atLondon(END_DAY, '00:00'));
  cached = store.semanticSnapshot();
  return cached;
}

test('salience decays on a horizon, so forty-eight hours is not amnesia', () => {
  // An ordinary preference is unreachable by tomorrow; a night somebody came
  // after them is still addressable a month later. One table, both behaviours.
  assert.ok(salienceOf('break_preference', 3 * DAY) === 0);
  assert.ok(salienceOf('incident', 20 * DAY, 'critical') > SALIENCE_FLOOR);
  assert.equal(salienceOf('incident', 40 * DAY), 0);
  // Monotonic, and bounded.
  for (const kind of Object.keys(SALIENCE)) {
    let previous = Infinity;
    for (let day = 0; day <= 35; day++) {
      const value = salienceOf(kind, day * DAY);
      assert.ok(value <= previous + 1e-9, `${kind} went up at day ${day}`);
      assert.ok(value >= 0 && value <= 1, `${kind} out of range at day ${day}`);
      previous = value;
    }
  }
  // Severity buys a longer life, which is the whole point of the bump.
  assert.ok(salienceOf('incident', 10 * DAY, 'critical') > salienceOf('incident', 10 * DAY, 'medium'));
  assert.equal(salienceOf('not_a_kind', 0), 0);
});

test('provenance survives the projection intact', () => {
  assert.equal(acquiredVia('self_observation'), 'witnessed');
  assert.equal(acquiredVia('lived_through'), 'witnessed');
  assert.equal(acquiredVia('told_by_goaden'), 'told');
  assert.equal(acquiredVia('received_advisory'), 'told');
  assert.equal(acquiredVia('checked_ordinary_notice'), 'public');
  assert.equal(acquiredVia('something_new'), 'inferred');
});

test('Ashai never receives a memory that is only Goaden’s', t => {
  const snap = snapshot(t);
  const now = snap.world.resolvedThrough;
  // The rule is inherited rather than re-implemented: a memory here is a view
  // of a knowledge entry, so it cannot exist for somebody whose knowledge does
  // not contain it. This asserts the projection kept that property.
  for (const id of ['goaden', 'ashai']) {
    const held = new Set((snap.characters[id].knowledge ?? []).map(item => item.factKey));
    for (const memory of deriveMemories(snap, id, now, { limit: 100 })) {
      assert.ok(held.has(memory.factKey), `${id} remembers ${memory.factKey} without knowing it`);
    }
  }
  // And there is genuinely asymmetry to protect — otherwise this proves nothing.
  const goadenOnly = new Set((snap.characters.goaden.knowledge ?? []).map(item => item.factKey));
  for (const item of snap.characters.ashai.knowledge ?? []) goadenOnly.delete(item.factKey);
  assert.ok(goadenOnly.size > 0, 'the pair knew exactly the same things, so this test is vacuous');
  const hers = new Set(deriveMemories(snap, 'ashai', now, { limit: 100 }).map(item => item.factKey));
  for (const key of goadenOnly) assert.ok(!hers.has(key), `Ashai received Goaden-only memory ${key}`);
});

test('a memory never carries more than the feed already said', t => {
  const snap = snapshot(t);
  const now = snap.world.resolvedThrough;
  const publicIds = new Set(snap.events.filter(event => event.visibility === 'public').map(event => event.id));
  const privateIds = new Set(snap.events.filter(event => event.visibility === 'private').map(event => event.id));
  for (const id of ['goaden', 'ashai']) {
    for (const memory of deriveMemories(snap, id, now, { limit: 100 })) {
      assert.ok(memory.sourceEvent === null || publicIds.has(memory.sourceEvent), 'a memory linked a private event');
      assert.ok(!privateIds.has(memory.sourceEvent), 'a private event id reached the page');
      assert.ok(memory.recalls === null || typeof memory.recalls === 'string');
      assertNoSpoiler(`${memory.summary} ${memory.recalls ?? ''}`, `memory ${memory.factKey}`);
      // Every memory is attributable, which was the point of the request.
      assert.ok(['witnessed', 'told', 'public', 'inferred'].includes(memory.acquiredVia));
      assert.ok(Number.isFinite(memory.at) && memory.at <= now);
    }
  }
});

test('a trace never appears without the event that made it', t => {
  const snap = snapshot(t);
  const now = snap.world.resolvedThrough;
  const byId = new Map(snap.events.map(event => [event.id, event]));
  const traces = deriveTraces(snap, now);
  let counted = 0;
  for (const [place, list] of Object.entries(traces)) {
    const [locationId, areaId] = place.split(':');
    for (const trace of list) {
      const cause = byId.get(trace.createdByEventId);
      assert.ok(cause, `${trace.kind} has no originating event`);
      assert.equal(cause.visibility, 'public', 'a trace came from a private event');
      assert.equal(trace.locationId, locationId);
      assert.equal(trace.areaId, areaId === 'unknown' ? null : areaId);
      assert.equal(trace.createdAt, cause.occurredAt);
      // It is in a room that exists, and it has not outlived itself.
      if (trace.areaId) assert.ok(areaOf(trace.locationId, trace.areaId), `${place} is not a room`);
      assert.ok(trace.expiresAt > now, 'an expired trace was still on the page');
      assert.ok(trace.createdAt <= now);
      assertNoSpoiler(trace.text, `trace ${trace.kind}`);
      counted++;
    }
  }
  assert.ok(counted > 0, 'the world left nothing lying about at all');
});

test('traces expire on their own clock and clear when something clears them', t => {
  const snap = snapshot(t);
  // Time-driven: wind the clock forward and everything with an expiry goes.
  const now = snap.world.resolvedThrough;
  const before = Object.values(deriveTraces(snap, now)).flat();
  assert.ok(before.length > 0);
  const latest = Math.max(...before.map(trace => trace.expiresAt));
  const after = Object.values(deriveTraces(snap, latest + 1)).flat();
  const survivors = after.filter(trace => trace.createdAt <= now);
  assert.equal(survivors.length, 0, 'a trace outlived its own expiry');
  // Exactly when expected, not approximately: one minute before its expiry a
  // trace is present, and at its expiry it is not.
  const sample = before[0];
  const atMinuteBefore = Object.values(deriveTraces(snap, sample.expiresAt - MINUTE_MS)).flat();
  assert.ok(atMinuteBefore.some(trace => trace.createdByEventId === sample.createdByEventId));
  const atExpiry = Object.values(deriveTraces(snap, sample.expiresAt)).flat();
  assert.ok(!atExpiry.some(trace => trace.createdByEventId === sample.createdByEventId),
    'a trace was still there at the instant it should have gone');
  for (const trace of before) assert.ok(Array.isArray(trace.clearedBy));

  // Event-driven, asserted on a constructed case rather than on whatever the
  // world happened to leave out. Most of the day's clutter expires before
  // bedtime on its own clock, so looking for a real trace that bedtime beats to
  // the punch is looking for a coincidence — and the first cut of this test
  // found the meal plates, which would have gone at 17:00 regardless.
  const piano = {
    id: 'evt:piano', type: 'PIANO_BEGIN', visibility: 'public', publicDescription: 'Goaden began playing piano.',
    occurredAt: atLondon('2026-09-10', '19:30'), location: 'mi6', area: 'music_room', participants: ['goaden'], payload: {},
  };
  const bed = {
    id: 'evt:bed', type: 'REST_BEGIN', visibility: 'public', publicDescription: 'Goaden turned in for the night.',
    occurredAt: atLondon('2026-09-10', '22:30'), location: 'mi6', area: 'quarters', participants: ['goaden'], payload: {},
  };
  const withPiano = { weather: { code: 'cloudy' }, events: [piano] };
  const withBed = { weather: { code: 'cloudy' }, events: [piano, bed] };
  const lidUp = Object.values(deriveTraces(withPiano, atLondon('2026-09-10', '21:00'))).flat();
  assert.equal(lidUp.length, 1, 'the piano left nothing behind');
  assert.ok(lidUp[0].expiresAt > bed.occurredAt,
    'the piano trace would have expired before bedtime anyway, so this proves nothing');
  // Same instant, same trace, but now somebody has turned in.
  assert.deepEqual(Object.values(deriveTraces(withBed, atLondon('2026-09-10', '23:00'))).flat(), [],
    'turning in for the night did not clear the room');
  // And with nobody turning in, it is still there at that hour.
  assert.equal(Object.values(deriveTraces(withPiano, atLondon('2026-09-10', '23:00'))).flat().length, 1,
    'the trace vanished without anything clearing it');
});

test('what somebody is carrying is a line with a cause, not an inner thought', t => {
  const snap = snapshot(t);
  const now = snap.world.resolvedThrough;
  for (const id of ['goaden', 'ashai']) {
    const carrying = deriveCarrying(snap, id, now);
    if (!carrying) continue;
    assert.equal(typeof carrying.echo, 'string');
    assertNoSpoiler(carrying.echo, `carrying/${id}`);
    // It never claims to know a mind: no "feels", no "thinks", no "wants".
    assert.ok(!/\b(feels?|thinks?|believes?|wishes|hopes|fears?)\b/i.test(carrying.echo),
      `an inner thought was invented: ${carrying.echo}`);
    // And it is attributable to a committed event.
    if (carrying.because) {
      assert.ok(carrying.because.factKey);
      assert.ok(carrying.because.sourceEvent === null
        || snap.events.some(event => event.id === carrying.because.sourceEvent));
    }
  }
});

test('rapport is an interpretation and never touches the relationship', t => {
  const store = world(t, 'rapport');
  store.advance(atLondon(END_DAY, '00:00'));
  const before = store.semanticSnapshot();
  const relationshipsBefore = JSON.stringify(before.relationships);
  const digestBefore = semanticDigest(before);

  const rapport = deriveRapport(before, before.world.resolvedThrough);
  assert.ok(rapport.label && rapport.id);
  assert.equal(rapport.interpretation, true, 'rapport must declare itself an interpretation');
  for (const item of rapport.basis) assert.ok(item.factKey, 'a rapport label with no basis');

  // Deriving it changed nothing. This is the whole of the guarantee: the label
  // is a reading of the relationship, never an input to it.
  const after = store.semanticSnapshot();
  assert.equal(JSON.stringify(after.relationships), relationshipsBefore);
  assert.equal(semanticDigest(after), digestBefore, 'reading the narrative moved the world');
});

test('the whole block is derived, deterministic and survives a restart', t => {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-narrative-test-'));
  t.after(() => {
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-narrative-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  const end = atLondon(END_DAY, '00:00');
  const path = join(directory, 'restart.sqlite');

  // One run straight through.
  const straight = openWorld({ dbPath: join(directory, 'straight.sqlite'), seed: DEFAULT_SEED, startMs: START });
  straight.advance(end);
  const oneGo = narrativeBlock(straight.semanticSnapshot(), end);
  straight.close();

  // The same world, closed and reopened four times along the way.
  let cursor = START;
  for (let step = 0; step < 4; step++) {
    cursor += Math.floor((end - START) / 4);
    const store = openWorld({ dbPath: path, seed: DEFAULT_SEED, startMs: START });
    store.advance(Math.min(cursor, end));
    store.close();
  }
  const reopened = openWorld({ dbPath: path, seed: DEFAULT_SEED, startMs: START });
  reopened.advance(end);
  const afterRestarts = narrativeBlock(reopened.semanticSnapshot(), end);
  reopened.close();

  assert.deepEqual(afterRestarts, oneGo, 'restarting the process changed what they remember');
  // Same seed, same memories — twice over, from the same snapshot.
  const again = openWorld({ dbPath: join(directory, 'twin.sqlite'), seed: DEFAULT_SEED, startMs: START });
  again.advance(end);
  const twin = again.semanticSnapshot();
  assert.deepEqual(narrativeBlock(twin, end), narrativeBlock(twin, end));
  assert.deepEqual(narrativeBlock(twin, end), oneGo, 'the same seed produced different memories');
  again.close();
});

test('nothing anywhere in the block can spoil anything', t => {
  const snap = snapshot(t);
  const block = narrativeBlock(snap, snap.world.resolvedThrough);
  // Serialised whole, so a field nobody thought about is still covered.
  assertNoSpoiler(JSON.stringify(block), 'the narrative block');
  // And the shapes the API promised are the shapes that are there.
  assert.deepEqual(Object.keys(block).sort(), ['carrying', 'memories', 'tracesByLocation']);
  assert.deepEqual(Object.keys(block.memories).sort(), ['ashai', 'goaden', 'shared']);
  assert.deepEqual(Object.keys(block.carrying).sort(), ['ashai', 'goaden', 'rapport']);
  for (const place of Object.keys(block.tracesByLocation)) {
    assert.match(place, /^[a-z0-9_]+:[a-z0-9_]+$/, `${place} is not a location:area key`);
  }
  // Shared means both of them hold it, not that it looked shared.
  const hers = new Set(block.memories.ashai.map(item => item.factKey));
  const his = new Set(block.memories.goaden.map(item => item.factKey));
  for (const item of block.memories.shared) {
    assert.ok(hers.has(item.factKey) && his.has(item.factKey), `${item.factKey} is not actually shared`);
  }
});
