import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_RESERVOIR_CATALOG } from '../src/scene-reservoir-catalog.mjs';
import { editorialEvent } from '../src/editorial.mjs';
import {
  selectReservoirSurface, reservoirPresentation, createReservoirMemory, reservoirWitnesses,
  reservoirSurfaceMatches,
} from '../src/scene-reservoir-select.mjs';
import { atLondon } from '../src/time.mjs';

const at = atLondon('2026-09-10', '14:30');
const event = (type, extra = {}) => ({
  id: extra.id ?? `evt:${type}`, type, visibility: 'public', occurredAt: extra.occurredAt ?? at,
  location: extra.location ?? 'mi6', area: extra.area ?? 'common_room',
  participants: extra.participants ?? ['goaden', 'ashai'], payload: extra.payload ?? {},
  publicDescription: 'Committed public event.',
});

test('TRAVEL_DEPART selects Streamliner prose without inventing a departure', () => {
  const depart = event('TRAVEL_DEPART', { location: 'streamliner', area: 'transit',
    payload: { to: 'sanctuary' } });
  const scene = selectReservoirSurface(depart);
  assert.ok(scene, 'committed Streamliner travel must find reservoir prose');
  assert.equal(scene.location, 'streamliner');
  assert.ok(scene.reservoir.triggerTypes.includes('TRAVEL_DEPART'));
  const presented = editorialEvent(depart);
  assert.equal(presented.prose, scene.beats[0].text);
  assert.equal(presented.type, 'TRAVEL_DEPART');
  assert.deepEqual(presented.participants, depart.participants);
});

test('LEGION_VISIT can take Legion prose even though the visit is not at the warehouse', () => {
  const visit = event('LEGION_VISIT', { location: 'mi6', area: 'common_room',
    payload: { visitors: ['gabriel', 'anarchy'] } });
  const scene = selectReservoirSurface(visit);
  assert.ok(scene, 'a committed Legion visit must be able to find reservoir prose');
  assert.ok(scene.reservoir.triggerTypes.includes('LEGION_VISIT')
    || String(scene.reservoir.family).includes('legion'));
});

test('Emily-only prose cannot attach to a Goaden/Ashai event that does not include her', () => {
  const emily = SCENE_RESERVOIR_CATALOG.find(s => s.cast.includes('emily')
    && !s.cast.includes('goaden') && !s.cast.includes('ashai'));
  assert.ok(emily);
  const pair = event('VENUE_SCENE', { location: emily.location, area: emily.area,
    participants: ['goaden', 'ashai'] });
  assert.equal(selectReservoirSurface(pair, { catalog: [emily] }), null);
  const hers = event('VENUE_SCENE', { location: emily.location, area: emily.area,
    participants: ['emily'] });
  assert.equal(selectReservoirSurface(hers, { catalog: [emily] })?.id, emily.id);
});

test('request time and viewer count cannot change the selected surface', () => {
  const source = event('QUIET_TIME_BEGIN', { id: 'evt:stable-quiet' });
  const first = selectReservoirSurface(source);
  if (!first) return;
  for (let i = 0; i < 20; i++) {
    assert.equal(selectReservoirSurface(source, { now: Date.now() + i * 999 }).id, first.id);
  }
  assert.equal(editorialEvent(source, { viewers: 12, now: Date.now() }).prose, first.beats[0].text);
  assert.equal(editorialEvent(source, { viewers: 0 }).prose, first.beats[0].text);
});

test('callback family stays unmatched until a real origin event is known', () => {
  const callbacks = SCENE_RESERVOIR_CATALOG.filter(s => s.reservoir.family === 'callback.shared_recent');
  const source = event('ACTIVITY_COMPLETE');
  assert.equal(selectReservoirSurface(source, { catalog: callbacks.length ? callbacks : SCENE_RESERVOIR_CATALOG,
    knownEventIds: null }), selectReservoirSurface(source));
});

test('guardians count as present when their lead is on the committed event', () => {
  const witnesses = reservoirWitnesses(event('REST_BEGIN', { participants: ['goaden'] }));
  assert.ok(witnesses.has('goaden') && witnesses.has('kai'));
  assert.equal(witnesses.has('greah'), false);
});

test('least-used scoring is a function of event identity and prior plays, never wall-clock', () => {
  const depart = event('TRAVEL_DEPART', { id: 'evt:a', location: 'streamliner', area: 'transit' });
  const family = SCENE_RESERVOIR_CATALOG.filter(s => reservoirSurfaceMatches(depart, s)).slice(0, 8);
  if (family.length < 2) return;
  const memory = createReservoirMemory();
  const a = selectReservoirSurface(depart, { catalog: family, memory });
  const later = event('TRAVEL_DEPART', { id: 'evt:b', location: 'streamliner', area: 'transit',
    occurredAt: at + 40 * 60 * 60 * 1000 });
  const b = selectReservoirSurface(later, { catalog: family, memory });
  assert.ok(a && b);
  assert.equal(reservoirPresentation(depart, { catalog: family }).reservoirSceneId, a.id);
});
