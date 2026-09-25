import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture, DEFAULT_SEED } from '../src/fixture.mjs';
import { initialNarrativeSignals, advanceMorphos, commitMorphos, assertNarrativeSignals, morphosSceneScore } from '../src/morphos.mjs';
import { SCENE_BANK_BY_ID } from '../src/scene-bank-catalog.mjs';
import { atLondon } from '../src/time.mjs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { applyChange, readChange, sideOf } from '../src/ledger.mjs';

const start = atLondon('2026-09-05', '00:00'), HOUR = 3_600_000;
function pulse(type = 'PRACTICE_END') {
  const state = createFixture({ startMs: start }).initialState();
  const event = { id: 'evt:original', type, occurredAt: start + 1, visibility: 'public',
    participants: ['goaden'], location: 'mi6', payload: {} };
  const action = { id: 'original', dueAt: event.occurredAt, priority: 20 };
  state.narrativeSignals = commitMorphos(state.narrativeSignals, state, event, action);
  return { state, event, action };
}
test('MORPHOS refractory pulse becomes an echo at real 12h/36h opportunities; never grants knowledge', () => {
  const { state } = pulse();
  const originalKnowledge = structuredClone(state.characters.goaden.knowledge);
  state.narrativeSignals = advanceMorphos(state.narrativeSignals, start + .25 * HOUR);
  assert.ok(morphosSceneScore(state, SCENE_BANK_BY_ID.N7, start + .25 * HOUR).score < 0);
  for (const hours of [12, 36]) {
    state.narrativeSignals = advanceMorphos(state.narrativeSignals, start + hours * HOUR);
    const result = morphosSceneScore(state, SCENE_BANK_BY_ID.N7, start + hours * HOUR);
    assert.ok(result.score > .005, `missing delayed influence at ${hours} hours: ${result.score}`);
    assert.ok(result.evidence.includes('evt:original'));
    assertNarrativeSignals(state);
  }
  assert.deepEqual(state.characters.goaden.knowledge, originalKnowledge);
});
test('fixed steps, JSON restart, topology changes and same-time pulses agree exactly', () => {
  const { state, event, action } = pulse();
  const once = advanceMorphos(state.narrativeSignals, start + 48 * HOUR);
  let chunks = state.narrativeSignals;
  for (let hour = 1; hour <= 48; hour++) chunks = JSON.parse(JSON.stringify(advanceMorphos(chunks, start + hour * HOUR)));
  assert.deepEqual(chunks, once);
  assert.deepEqual(commitMorphos(state.narrativeSignals, state, event, action), state.narrativeSignals, 'duplicate source');
  const early = advanceMorphos(state.narrativeSignals, start + HOUR);
  state.characters.goaden.location = 'cafe'; state.characters.goaden.area = 'venue';
  const moved = commitMorphos(early, state, { ...event, id: 'move', type: 'TRAVEL_ARRIVE', occurredAt: start + HOUR }, { id: 'move', priority: 20 });
  assert.deepEqual(moved.morphos.fields, early.morphos.fields, 'new topology must not rewrite yesterday');
  const actorIndex = moved.morphos.nodes.indexOf('actor:goaden');
  assert.ok(moved.morphos.graph[actorIndex].includes(moved.morphos.nodes.indexOf('place:cafe')));
});
test('fields extinguish, old source cannot revive them, new original source can; echoes cannot excite', () => {
  const { state, event, action } = pulse();
  state.narrativeSignals = advanceMorphos(state.narrativeSignals, start + 90 * 24 * HOUR);
  assert.ok(Object.values(state.narrativeSignals.morphos.fields).every(f => f.a.every(n => n === 0) && !f.sources.length));
  assert.equal(commitMorphos(state.narrativeSignals, state, event, action).morphos.pending.length, 0);
  const now = start + 90 * 24 * HOUR + 1;
  const echo = commitMorphos(state.narrativeSignals, state, { ...event, id: 'echo', type: 'SCENE_BANK_BEAT', occurredAt: now }, { id: 'echo' });
  assert.equal(echo.morphos.pending.length, 0);
  const revived = commitMorphos(echo, state, { ...event, id: 'new', occurredAt: now }, { id: 'new' });
  assert.equal(revived.morphos.pending.length, 1);
});
test('disabled hooks preserve old state and cannot score unreviewed prose', () => {
  const { state } = pulse();
  delete state.narrativeSignals;
  assert.deepEqual(morphosSceneScore(state, SCENE_BANK_BY_ID.N7, start), { score: 0, evidence: [] });
  state.narrativeSignals = initialNarrativeSignals(start);
  assert.equal(morphosSceneScore(state, { ...SCENE_BANK_BY_ID.N7, beats: [] }, start).score, 0);
});
test('real runtime signals survive chunked advances and replay every ledger change forward and backward', () => {
  const once = openWorld({ dbPath: ':memory:', startMs: start, seed: DEFAULT_SEED });
  const chunks = openWorld({ dbPath: ':memory:', startMs: start, seed: DEFAULT_SEED });
  try {
    once.advance(start + 2 * 24 * HOUR);
    for (let hour = 1; hour <= 48; hour++) chunks.advance(start + hour * HOUR);
    const snapshot = once.semanticSnapshot();
    assert.equal(semanticDigest(snapshot), semanticDigest(chunks.semanticSnapshot()));
    assert.ok(snapshot.events.some(e => e.changes.some(c => c.field === 'narrativeSignals')));
    assert.ok(Object.values(snapshot.narrativeSignals.morphos.fields).some(f => f.sources.length));
    const initial = createFixture({ startMs: start }).initialState();
    const replay = structuredClone(initial);
    const target = (state, c) => c.entity === 'character' ? state.characters[c.id]
      : c.entity === 'relationship' ? state.relationships.find(p => `${p.from}->${p.to}` === c.id) : state;
    for (const event of snapshot.events) for (const change of event.changes) {
      const object = target(replay, change);
      assert.deepEqual(readChange(object, change), sideOf(change, 'before'));
      applyChange(object, change, 'after');
    }
    assert.deepEqual(replay.narrativeSignals, snapshot.narrativeSignals);
    for (const event of [...snapshot.events].reverse()) for (const change of [...event.changes].reverse()) applyChange(target(replay, change), change, 'before');
    assert.deepEqual(replay, initial);
  } finally { once.close(); chunks.close(); }
});
