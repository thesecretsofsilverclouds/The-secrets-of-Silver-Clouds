import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneReservoirHealth } from '../src/scene-reservoir-health.mjs';

const HOUR = 3_600_000, DAY = 24 * HOUR, NOW = 80 * DAY;
const scene = (id = 'R:quiet.1', extra = {}) => ({ id, status: 'enabled', effectPolicy: 'surface_only',
  dependencies: [], cast: ['ashai', 'greah'], location: 'mi6', area: 'common_room',
  beats: [{ kind: 'prose', text: 'Ashai rested beside Greah.' }],
  reservoir: { sourceId: id.slice(2), family: 'domestic.quiet', sourceHash: `hash:${id}`,
    batchId: 'monthly:1', origin: 'authored', sourceProvenance: 'creator',
    triggerTypes: ['ACTIVITY_COMPLETE'], activitiesByActor: { ashai: ['unhurried_time'] },
    cooldown: { sceneDays: 30, familyHours: 36, pairHours: 8 } }, ...extra });
const event = (id, extra = {}) => ({ id, occurredAt: NOW - HOUR, visibility: 'public',
  type: 'ACTIVITY_COMPLETE', location: 'mi6', area: 'common_room', participants: ['ashai'], ...extra });
const state = extra => ({ world: { resolvedThrough: NOW }, sceneBank: { completed: {} },
  events: [event('a'), event('b', { occurredAt: NOW - 2 * HOUR })], ...extra });
const health = (snapshot, catalog = [scene()]) => sceneReservoirHealth(snapshot, { catalog });

test('real fresh approved reserve covers recurring signatures without a refill', () => {
  const result = health(state());
  assert.equal(result.status, 'covered');
  assert.equal(result.families[0].eligibleFreshCount, 1);
  assert.equal(result.families[0].recentExposureCount, 2);
  assert.deepEqual(result.deficits, []);
});

test('depleted reusable scene generates a deficit for its approved source archetype', () => {
  const snapshot = state({ sceneBank: { completed: { 'R:quiet.1': { at: NOW - 4 * DAY, plays: 1 } } } });
  const result = health(snapshot);
  assert.equal(result.status, 'needs_refill');
  assert.deepEqual(result.deficits, [{ familyId: 'domestic.quiet', archetypeId: 'R:quiet.1',
    eligibleFreshCount: 0, recentExposureCount: 2 }]);
  assert.deepEqual(result.archetypes['R:quiet.1'].allowedFacts, ['Ashai rested beside Greah.']);
  assert.equal(result.archetypes['R:quiet.1'].metadata.effectPolicy, 'surface_only');
  assert.equal(result.archetypes['R:quiet.1'].provenance.sourceHash, 'hash:R:quiet.1');
});

test('scene cooldown recovery uses latest play, while temporary family cooling is not exhaustion', () => {
  const recovered = state({ sceneBank: { completed: { 'R:quiet.1': { at: NOW - 31 * DAY } } } });
  assert.equal(health(recovered).families[0].freshCount, 1);
  recovered.sceneBank.completed['R:quiet.1'].lastAt = NOW - HOUR;
  const cooling = health(recovered, [scene(), scene('R:quiet.2')]);
  assert.equal(cooling.families[0].freshCount, 1);
  assert.equal(cooling.families[0].eligibleFreshCount, 0);
  assert.equal(cooling.families[0].coolingCount, 1);
  assert.deepEqual(cooling.deficits, [], 'new wording cannot bypass family cooldown or request more wording');
});

test('different room, location, actor, trigger and stale/future/private events do not create demand', () => {
  const invalid = [{ area: 'corridors' }, { location: 'sanctuary' }, { participants: ['goaden'] },
    { type: 'MEAL_BEGIN' }, { occurredAt: NOW - 73 * HOUR }, { occurredAt: NOW + 1 },
    { visibility: 'private' }].map((extra, i) => event(`irrelevant:${i}`, extra));
  const snapshot = state({ events: [...invalid, event('only'), event('only')],
    sceneBank: { completed: { 'R:quiet.1': { at: NOW - DAY } } } });
  const result = health(snapshot);
  assert.equal(result.families[0].recentExposureCount, 1, 'same event ID cannot inflate demand');
  assert.deepEqual(result.deficits, []);
});

test('unused scenes in another room do not conceal depletion of the actual repeated signature', () => {
  const snapshot = state({ sceneBank: { completed: { 'R:quiet.1': { at: NOW - 4 * DAY } } } });
  const result = health(snapshot, [scene(), scene('R:quiet.2', { area: 'quarters' })]);
  assert.equal(result.families[0].freshCount, 1);
  assert.equal(result.deficits.length, 1);
  assert.equal(result.deficits[0].archetypeId, 'R:quiet.1');
});

test('supporting guest demand needs committed presence, never current snapshot co-location', () => {
  const catalog = [scene('R:quiet.1', { cast: ['ashai', 'yukon'] })];
  const snapshot = state({ characters: { yukon: { location: 'mi6', area: 'common_room' } },
    sceneBank: { completed: { 'R:quiet.1': { at: NOW - 4 * DAY } } } });
  assert.equal(health(snapshot, catalog).families[0].recentExposureCount, 0);
  snapshot.events[0].participants.push('yukon');
  snapshot.events[1].payload = { cast: ['yukon'] };
  assert.equal(health(snapshot, catalog).deficits.length, 1);
});

test('disabled, staged, consequential and empty content cannot be counted or become archetypes', () => {
  const catalog = [scene('a', { status: 'staged' }), scene('b', { status: 'disabled' }),
    scene('c', { dependencies: ['prior'] }), scene('d', { effectPolicy: 'changes_world' }),
    scene('e', { beats: [] })];
  const result = health(state(), catalog);
  assert.equal(result.status, 'no_approved_reserve');
  assert.equal(result.metrics.approvedSceneCount, 0);
  assert.deepEqual(result.archetypes, {});
  assert.deepEqual(result.deficits, []);
});

test('coverage queries are deterministic, immutable and never count as use', () => {
  const snapshot = state(), catalog = [scene()], before = structuredClone({ snapshot, catalog });
  const first = health(snapshot, catalog);
  assert.deepEqual(health(snapshot, catalog), first);
  assert.deepEqual({ snapshot, catalog }, before);
  assert.ok(Object.isFrozen(first.archetypes['R:quiet.1'].metadata.gates.activitiesByActor.ashai));
  assert.throws(() => first.archetypes['R:quiet.1'].allowedFacts.push('New lore.'));
  assert.equal(Object.isFrozen(catalog[0]), false, 'health does not freeze or mutate caller input');
});
