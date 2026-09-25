import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture, DEFAULT_SEED, hasDavisBetrayal, hasDavisWarmthPrerequisite } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';
import { SCENE_RESERVOIR_CATALOG } from '../src/scene-reservoir-catalog.mjs';
import { selectReservoirSurface, reservoirSurfaceMatches } from '../src/scene-reservoir-select.mjs';

test('davis-ashai: pre-disclosure gating blocks rivalry and permits pre_disclosure', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();

  assert.equal(hasDavisBetrayal(state), false);

  const preDisclosureScene = SCENE_RESERVOIR_CATALOG.find(s => s.reservoir?.family === 'davis_pre_disclosure');
  const rivalryScene = SCENE_RESERVOIR_CATALOG.find(s => s.reservoir?.family === 'davis_ashai_rivalry' && s.area === 'corridors');

  assert.ok(preDisclosureScene, 'Must have davis_pre_disclosure scene');
  assert.ok(rivalryScene, 'Must have davis_ashai_rivalry scene');

  const testEvent = {
    id: 'evt-test-crossing',
    type: 'CROSS_PATHS',
    occurredAt: atLondon('2026-09-05', '14:00'),
    location: 'mi6',
    area: 'corridors',
    participants: ['ashai', 'goaden'],
    payload: { who: 'davis', area: 'corridors' },
    visibility: 'public',
  };

  // With no betrayal: pre_disclosure matches, rivalry is strictly blocked
  assert.equal(reservoirSurfaceMatches(testEvent, rivalryScene, { state }), false, 'Rivalry scene must be blocked pre-disclosure');
  assert.equal(reservoirSurfaceMatches(testEvent, rivalryScene, { hasDavisBetrayal: false }), false);
});

test('davis-ashai: betrayal discovery requires warmth prerequisite and MI6 corridor presence', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  fixture.reduceAction(state, fixture.initialActions()[0], DEFAULT_SEED);

  const actionTime = atLondon('2026-09-05', '11:00');

  // Attempt betrayal action directly WITHOUT warmth prerequisite -> skipped
  assert.equal(hasDavisWarmthPrerequisite(state), false);
  const attemptWithoutWarmth = fixture.reduceAction(state, {
    id: 'test/betrayal-early',
    day: '2026-09-05',
    dueAt: actionTime,
    priority: 15,
    type: 'DAVIS_BETRAYAL_DISCOVERY',
    actors: ['ashai'],
    area: 'corridors',
  }, DEFAULT_SEED);

  assert.equal(attemptWithoutWarmth.event.payload.outcome, 'skipped');
  assert.equal(hasDavisBetrayal(state), false);

  // Now establish warmth prerequisite (e.g. supporting appearance)
  state.supportingStories = state.supportingStories || {};
  state.supportingStories.appearances = state.supportingStories.appearances || {};
  state.supportingStories.appearances['davis'] = {
    at: atLondon('2026-09-05', '10:00'),
    eventId: 'evt-davis-warmth',
    count: 1,
  };
  assert.equal(hasDavisWarmthPrerequisite(state), true);

  // Ashai in quarters (not corridors / sleeping) -> skipped if sleeping
  state.characters.ashai.activity = 'sleeping';
  const attemptWhileSleeping = fixture.reduceAction(state, {
    id: 'test/betrayal-sleep',
    day: '2026-09-05',
    dueAt: actionTime + 1000,
    priority: 15,
    type: 'DAVIS_BETRAYAL_DISCOVERY',
    actors: ['ashai'],
    area: 'corridors',
  }, DEFAULT_SEED);
  assert.equal(attemptWhileSleeping.event.payload.outcome, 'skipped');
  assert.equal(hasDavisBetrayal(state), false);

  // Ashai awake and in MI6 -> successful single-use canonical discovery!
  state.characters.ashai.activity = 'unhurried_time';
  state.characters.ashai.location = 'mi6';
  state.characters.ashai.area = 'corridors';

  const discoveryResult = fixture.reduceAction(state, {
    id: 'test/betrayal-success',
    day: '2026-09-05',
    dueAt: actionTime + 2000,
    priority: 15,
    type: 'DAVIS_BETRAYAL_DISCOVERY',
    actors: ['ashai'],
    area: 'corridors',
  }, DEFAULT_SEED);

  assert.equal(discoveryResult.event.visibility, 'public');
  assert.equal(discoveryResult.event.register, 'prose');
  assert.ok(discoveryResult.event.prose.includes('naïve') || discoveryResult.event.prose.includes('charm'));
  assert.ok(discoveryResult.event.payload.lines.some(l => l.who === 'davis'));
  assert.ok(discoveryResult.event.payload.lines.some(l => l.who === 'greah'));
  assert.equal(discoveryResult.event.payload.confidante, undefined, 'Greah is not Davis confidante');
  assert.equal(discoveryResult.event.payload.spokenTo, 'another_agent', 'Davis speaks to another agent');
  assert.equal(discoveryResult.event.payload.counselBy, 'greah', 'Greah counsels Ashai');
  assert.ok(discoveryResult.event.prose.includes('speaking to another agent'));
  assert.ok(discoveryResult.event.publicDescription.includes('speaking to another agent'));

  // Knowledge and facts committed
  assert.equal(hasDavisBetrayal(state), true);
  assert.ok(state.facts['canon.davis_betrayal_overheard']);
  assert.ok(state.characters.ashai.knowledge.some(k => k.factKey === 'canon.davis_betrayal_overheard'));

  // Cannot trigger a second time (single-use)
  const attemptSecond = fixture.reduceAction(state, {
    id: 'test/betrayal-second',
    day: '2026-09-05',
    dueAt: actionTime + 3000,
    priority: 15,
    type: 'DAVIS_BETRAYAL_DISCOVERY',
    actors: ['ashai'],
    area: 'corridors',
  }, DEFAULT_SEED);
  assert.equal(attemptSecond.event.payload.outcome, 'skipped');
});

test('davis-ashai: post-disclosure gating enables rivalry and blocks pre_disclosure', () => {
  const start = atLondon('2026-09-05', '00:00');
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  const now = atLondon('2026-09-05', '14:00');

  // Manually commit betrayal fact
  state.facts['canon.davis_betrayal_overheard'] = {
    key: 'canon.davis_betrayal_overheard',
    kind: 'davis_betrayal',
    subject: 'davis',
    createdAt: now - 3600000,
  };
  state.characters.ashai.knowledge.push({
    factKey: 'canon.davis_betrayal_overheard',
    learnedAt: now - 3600000,
  });

  assert.equal(hasDavisBetrayal(state, now), true);

  const preDisclosureScene = SCENE_RESERVOIR_CATALOG.find(s => s.reservoir?.family === 'davis_pre_disclosure');
  const rivalryScene = SCENE_RESERVOIR_CATALOG.find(s => s.reservoir?.family === 'davis_ashai_rivalry' && s.area === 'corridors');

  const testEvent = {
    id: 'evt-post-betrayal-crossing',
    type: 'CROSS_PATHS',
    occurredAt: now,
    location: 'mi6',
    area: 'corridors',
    participants: ['ashai', 'goaden'],
    payload: { who: 'davis', area: 'corridors' },
    visibility: 'public',
  };

  // Post-betrayal: pre_disclosure is blocked, rivalry is eligible!
  assert.equal(reservoirSurfaceMatches(testEvent, preDisclosureScene, { state, now }), false, 'pre_disclosure must be blocked post-betrayal');
  assert.equal(reservoirSurfaceMatches(testEvent, rivalryScene, { state, now }), true, 'rivalry scene must be eligible post-betrayal');
});
