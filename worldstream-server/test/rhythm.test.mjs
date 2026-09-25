import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { atLondon } from '../src/time.mjs';
import { initialNarrativeSignals, commitMorphos } from '../src/morphos.mjs';
import {
  RHYTHM_RULES, RHYTHM_NEEDS, RHYTHM_LABELS, RHYTHM_ACTORS, RHYTHM_SLOT_FAMILIES,
  initialRhythm, rhythmActive, settledNeeds, gain, similarity, satiety, trace,
  scoreCandidates, raceCandidates, chooseRoutine, commitCompletion, commitSleep, commitTraces, assertRhythm,
} from '../src/rhythm.mjs';

const HOUR = 3600000, START = atLondon('2026-09-20', '19:00');
function fresh() {
  return { rhythm: initialRhythm(START), facts: {},
    characters: Object.fromEntries(RHYTHM_ACTORS.map(who => [who, {
      id: who, activity: 'unhurried_time', activitySince: START, area: 'gaming_room', knowledge: [],
    }])),
    abilities: { actors: Object.fromEntries(RHYTHM_ACTORS.map(who => [who, { fatigue: 0, track: null }])) },
  };
}
function options(state, extra = {}) {
  return { state, who: 'ashai', family: 'evening_leisure', slotAt: START, now: START,
    minutes: 45, legal: () => true, seed: 'rhythm-unit', key: 'evening/ashai', ...extra };
}
function learn(state, { who = 'ashai', kind = 'broken_plan', subject = who, severity = 'high',
  now = START, source = 'source:one', eventId = 'learn:one', validUntil = null } = {}) {
  const fact = { key: `fact:${source}`, kind, subject, value: { severity }, createdAt: now,
    sourceEventId: source, validUntil };
  state.facts[fact.key] = fact;
  const memory = { factKey: fact.key, subject, sourceEventId: source,
    acquisitionEventId: eventId, learnedAt: now, validUntil };
  state.characters[who].knowledge.push(memory);
  return { fact, memory, event: { id: eventId, occurredAt: now, changes: [{ entity: 'character', id: who,
    field: 'knowledge', path: [String(state.characters[who].knowledge.length - 1)], after: structuredClone(memory) }] }, now };
}
const within = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('initial state is private bounded data with an explicit safe activation clock', () => {
  const state = fresh(); assertRhythm(state, START);
  assert.equal(rhythmActive(state, START - 1), false);
  assert.equal(rhythmActive(state, START), true);
  state.rhythm.enabled = false; assert.equal(rhythmActive(state, START), false);
  assert.equal(rhythmActive({ rhythm: { version: 1, enabled: true, activatedAt: '0' } }, START), false);
  assert.throws(() => initialRhythm(NaN), /clock/);
  assert.doesNotThrow(() => assertRhythm({}));
  for (const record of Object.values(state.rhythm.actors)) assert.ok(Buffer.byteLength(JSON.stringify(record)) <= 4096);
});

test('awake need drift is monotone and bounded; reading it is pure and clocks cannot rewind', () => {
  const state = fresh(), before = structuredClone(state);
  const one = settledNeeds(state, 'ashai', START + HOUR), many = settledNeeds(state, 'ashai', START + 1000 * HOUR);
  for (const need of RHYTHM_NEEDS) {
    assert.ok(one[need] > .3); assert.equal(many[need], 1);
  }
  assert.deepEqual(state, before);
  assert.throws(() => settledNeeds(state, 'ashai', START - 1), /backwards/);
});

test('completion and sleep never put stored rest below authoritative ability fatigue', () => {
  const state = fresh(); state.abilities.actors.ashai.fatigue = 4;
  assert.equal(settledNeeds(state, 'ashai', START).rest, 4 / 6);
  const after = commitCompletion(state.rhythm, state, { who: 'ashai', label: 'resting', minutes: 90, now: START });
  assert.ok(after.actors.ashai.needs.rest >= 4 / 6);
  state.rhythm = after; state.characters.ashai.activity = 'sleeping';
  const slept = commitSleep(after, state, START + 8 * HOUR);
  assert.ok(slept.actors.ashai.needs.rest >= 4 / 6);
  assertRhythm({ ...state, rhythm: slept }, START + 8 * HOUR);
});

test('routine effects scale by actual minutes, cap at a full effect, and reject phantom completions', () => {
  const state = fresh();
  for (const need of RHYTHM_NEEDS) state.rhythm.actors.ashai.needs[need] = .8;
  const finish = minutes => commitCompletion(state.rhythm, state, { who: 'ashai', label: 'resting', minutes, now: START });
  within(finish(22.5).actors.ashai.needs.rest, .6);
  within(finish(45).actors.ashai.needs.rest, .4);
  assert.deepEqual(finish(450), finish(45));
  for (const minutes of [0, -1, NaN, Infinity]) assert.equal(finish(minutes), state.rhythm);
  assert.equal(commitCompletion(state.rhythm, state, { who: 'ashai', label: 'invented', minutes: 45, now: START }), state.rhythm);
  assert.throws(() => gain(state.rhythm.actors.ashai.needs, 'ashai', 'training', -10), /input/);
  assert.equal(gain(state.rhythm.actors.ashai.needs, 'ashai', 'resting', 0), 0);
});

test('pure completion helpers compose against the supplied rhythm, not a stale state bag', () => {
  const state = fresh(), original = structuredClone(state);
  state.rhythm.actors.ashai.needs.rest = .9;
  const first = commitCompletion(state.rhythm, state, { who: 'ashai', label: 'resting', minutes: 22.5, now: START });
  const second = commitCompletion(first, state, { who: 'ashai', label: 'resting', minutes: 22.5, now: START });
  within(second.actors.ashai.needs.rest, .5);
  assert.equal(state.rhythm.actors.ashai.needs.rest, .9);
  assert.deepEqual(state.characters, original.characters);
  assert.deepEqual(state.facts, original.facts);
});

test('sleep recovery reflects actual sleeping overlap and does not award rest to awake actors', () => {
  const state = fresh();
  const record = state.rhythm.actors.ashai;
  record.needs = Object.fromEntries(RHYTHM_NEEDS.map(need => [need, .8]));
  state.characters.ashai.activity = 'sleeping'; state.characters.ashai.activitySince = START + HOUR;
  const after = commitSleep(state.rhythm, state, START + 3 * HOUR);
  within(after.actors.ashai.needs.rest, .84 * .25 ** (2 / 8));
  within(after.actors.ashai.needs.solitude, .83 * .6 ** (2 / 8));
  within(after.actors.ashai.needs.social, .83, 1e-12);
  assert.equal(after.actors.goaden, state.rhythm.actors.goaden, 'awake night duty gets no sleep credit');
  assert.deepEqual(commitSleep(state.rhythm, state, START), state.rhythm);
});

test('partial midnight and wake settlements give the same recovery as the actual whole sleep', () => {
  const state = fresh(); state.characters.ashai.activity = 'sleeping';
  const whole = commitSleep(state.rhythm, state, START + 8 * HOUR);
  const part = commitSleep(state.rhythm, state, START + 2 * HOUR);
  const chunks = commitSleep(part, { ...state, rhythm: part }, START + 8 * HOUR);
  for (const need of RHYTHM_NEEDS) within(chunks.actors.ashai.needs[need], whole.actors.ashai.needs[need]);
  within(whole.actors.ashai.needs.rest, .3 * .25);
  within(whole.actors.ashai.needs.solitude, .3 * .6);
  assert.equal(whole.actors.ashai.needs.stimulation, .3, 'sleep hours add no awake pressure');
});

test('leisure builds bounded habit while alternative habits decay; duty and shared activity do not', () => {
  const state = fresh(), before = structuredClone(state.rhythm.actors.ashai.habits);
  const duty = commitCompletion(state.rhythm, state, { who: 'ashai', label: 'gaming', minutes: 45, now: START });
  assert.deepEqual(duty.actors.ashai.habits, before);
  const shared = commitCompletion(state.rhythm, state, { who: 'ashai', label: 'gaming', minutes: 45,
    family: 'evening_leisure', shared: true, now: START });
  assert.deepEqual(shared.actors.ashai.habits, before);
  within(shared.actors.ashai.needs.social, .1);
  assert.equal(duty.actors.ashai.needs.social, .3, 'solo gaming cannot supply social contact');
  for (let i = 0; i < 500; i++) state.rhythm = commitCompletion(state.rhythm, state, {
    who: 'ashai', label: 'listening_to_music', minutes: 45, family: 'evening_leisure', now: START + i * HOUR,
  });
  const learned = state.rhythm.actors.ashai.habits;
  assert.ok(learned.listening_to_music > .99 && learned.listening_to_music <= 1);
  assert.ok(learned.watching_television < before.watching_television);
  assert.equal(learned.training, before.training);
  assertRhythm(state, START + 499 * HOUR);
});

test('satiety follows the reviewed symmetric similarity and decays without importing future history', () => {
  for (const a of RHYTHM_LABELS) for (const b of RHYTHM_LABELS) {
    assert.equal(similarity(a, b), similarity(b, a)); assert.ok(similarity(a, b) >= 0 && similarity(a, b) <= 1);
  }
  const now = START + 48 * HOUR;
  const record = { history: [0, 24, 48].map(hour => ({ label: 'watching_television', at: START + hour * HOUR })) };
  assert.equal(satiety(record, 'watching_television', now), 1);
  within(satiety(record, 'listening_to_music', now), .35 * (1 + Math.exp(-.6) + Math.exp(-1.2)));
  assert.equal(satiety(record, 'training', now), 0);
  assert.ok(satiety(record, 'watching_television', now + 7 * RHYTHM_RULES.satietyTau) < .002);
  assert.equal(satiety({ history: [{ label: 'watching_television', at: now + 1 }] }, 'watching_television', now), 0);
});

test('legal filtering precedes every score and never invents a routine or changes state', () => {
  const state = fresh(), before = structuredClone(state);
  state.rhythm.actors.ashai.habits.watching_television = 1;
  const scored = scoreCandidates(options(state, { legal: (_template, label) => label === 'quiet_break' }));
  assert.deepEqual(scored.map(row => row.label), ['quiet_break']);
  assert.equal(chooseRoutine(options(state, { legal: () => false })), null);
  assert.equal(chooseRoutine(options(state, { family: 'unreviewed' })), null);
  for (const who of RHYTHM_ACTORS) {
    const choices = scoreCandidates(options(state, { who }));
    assert.ok(choices.every(row => RHYTHM_SLOT_FAMILIES.evening_leisure[who].includes(row.label)));
    assert.equal(choices.some(row => row.label === (who === 'ashai' ? 'playing_piano' : 'watching_television')), false);
    for (const row of choices) {
      assert.ok(Number.isFinite(row.total));
      for (const [term, value] of Object.entries(row.terms)) assert.ok(value <= 1 && value >= (term === 'narrative' ? -1 : 0));
    }
  }
  state.rhythm.actors.ashai.habits.watching_television = before.rhythm.actors.ashai.habits.watching_television;
  assert.deepEqual(state, before);
});

test('CSV narrative-disabled scoring zeros only MORPHOS, retaining the same legal behavior set', () => {
  const state = fresh(); state.narrativeSignals = initialNarrativeSignals(START);
  state.narrativeSignals = commitMorphos(state.narrativeSignals, state,
    { id: 'topology', type: 'RHYTHM_CHOOSE', occurredAt: START, participants: ['ashai'], location: 'mi6', payload: {} },
    { id: 'topology', priority: 40 });
  const m = state.narrativeSignals.morphos, index = m.nodes.indexOf('actor:ashai');
  assert.ok(index >= 0); m.fields.shared_recovery.a[index] = 1;
  const normal = scoreCandidates(options(state)), isolated = scoreCandidates(options(state, { narrative: false }));
  assert.deepEqual(normal.map(row => row.label), isolated.map(row => row.label));
  const quiet = normal.find(row => row.label === 'quiet_break'), isolatedQuiet = isolated.find(row => row.label === 'quiet_break');
  assert.equal(quiet.terms.narrative, 1); assert.equal(isolatedQuiet.terms.narrative, 0);
  within(quiet.total - isolatedQuiet.total, RHYTHM_RULES.weights.narrative);
  const { narrative: _a, ...a } = quiet.terms, { narrative: _b, ...b } = isolatedQuiet.terms;
  assert.deepEqual(a, b);
});

test('keyed race is deterministic, input-order independent, hash-exact when tied, and capped at four', () => {
  const tied = RHYTHM_LABELS.slice(0, 5).map(label => ({ label, total: .25 }));
  const expected = [...tied].sort((a, b) => {
    const digest = label => createHash('sha256').update(`seed|rhythm-v1|slot|${label}`).digest('hex');
    return digest(a.label).localeCompare(digest(b.label));
  }).map(row => row.label);
  assert.deepEqual(raceCandidates(tied, 'seed', 'slot').map(row => row.label), expected);
  assert.deepEqual(raceCandidates([...tied].reverse(), 'seed', 'slot'), raceCandidates(tied, 'seed', 'slot'));
  const scores = [{ label: 'gaming', total: -1000 }, { label: 'quiet_break', total: 1000 }];
  const raced = raceCandidates(scores, 'seed', 'slot');
  assert.ok(Math.max(...raced.map(row => row.weight)) / Math.min(...raced.map(row => row.weight)) <= 4);
  assert.ok(raced.every(row => Number.isFinite(row.race) && row.race > 0));
  let wins = 0;
  for (let i = 0; i < 1000; i++) if (raceCandidates(scores, 'seed', `slot:${i}`)[0].label === 'quiet_break') wins++;
  assert.ok(wins > 740 && wins < 850, `${wins} wins: bias must influence, not dictate`);
  assert.equal(raceCandidates([], 'seed', 'slot'), null);
  for (const bad of [[{ label: 'invented', total: 1 }], [{ label: 'gaming', total: NaN }], [scores[0], scores[0]]])
    assert.throws(() => raceCandidates(bad, 'seed', 'slot'), /candidates/);
});

test('a trace needs this actor’s newly acquired, matching, unexpired source proof', () => {
  const state = fresh(), known = learn(state), original = structuredClone(state);
  const result = commitTraces(state.rhythm, state, known.event, START);
  assert.deepEqual(result.actors.ashai.traces.map(row => row.label), ['listening_to_music', 'quiet_break']);
  assert.equal(result.actors.goaden.traces.length, 0);
  assert.equal(result.actors.ashai.traces[0].sourceEventId, known.fact.sourceEventId);
  assert.equal(result.actors.ashai.traces[0].factKey, known.fact.key);
  assert.deepEqual(state, original);
  assert.equal(commitTraces(result, state, known.event, START), result, 'one source cannot deposit twice');
  for (const mutate of [
    h => { h.state.characters.ashai.knowledge = []; }, h => { h.memory.sourceEventId = 'other-source'; },
    h => { h.fact.key = 'other-key'; }, h => { h.memory.subject = 'goaden'; },
    h => { h.fact.subject = h.memory.subject = 'goaden'; }, h => { h.fact.createdAt = START + 1; },
    h => { h.memory.learnedAt = START + 1; }, h => { h.memory.learnedAt = START - 1; },
    h => { h.memory.acquisitionEventId = 'other-event'; }, h => { h.memory.validUntil = START; },
    h => { h.fact.validUntil = START; }, h => { h.fact.sourceEventId = h.memory.sourceEventId = ''; },
  ]) {
    const candidate = fresh(), source = learn(candidate), h = { state: candidate, ...source }; mutate(h);
    assert.equal(commitTraces(candidate.rhythm, candidate, source.event, START).actors.ashai.traces.length, 0);
  }
});

test('only high/critical incidents affecting the informed actor leave a bounded decaying trace', () => {
  for (const severity of ['low', 'moderate', 'high', 'critical']) {
    const state = fresh(), source = learn(state, { kind: 'incident', severity, subject: 'both' });
    const result = commitTraces(state.rhythm, state, source.event, START);
    assert.equal(result.actors.ashai.traces.length, ['high', 'critical'].includes(severity) ? 2 : 0);
    if (result.actors.ashai.traces.length) {
      const record = result.actors.ashai;
      assert.ok(trace(record, 'quiet_break', START) > 0);
      assert.equal(trace(record, 'quiet_break', START - 1), 0);
      assert.ok(trace(record, 'quiet_break', START + 7 * RHYTHM_RULES.traceTau) < 1e-3);
    }
  }
});

test('trace/history caps evict oldest entries and preserve exact source identifiers within the UTF-8 budget', () => {
  const state = fresh();
  for (let i = 0; i < 30; i++) {
    const now = START + i * HOUR;
    const source = learn(state, { kind: 'unfinished_game', source: `source:${i}`, eventId: `learn:${i}`, now });
    state.rhythm = commitTraces(state.rhythm, state, source.event, now);
    state.rhythm = commitCompletion(state.rhythm, state, { who: 'ashai', label: 'gaming', minutes: 45, now });
  }
  const record = state.rhythm.actors.ashai;
  assert.equal(record.traces.length, 8); assert.equal(record.traces[0].sourceEventId, 'source:22');
  assert.equal(record.history.length, 24); assert.equal(record.history[0].at, START + 6 * HOUR);
  for (let i = 30; i < 40; i++) {
    const now = START + i * HOUR;
    const source = learn(state, { kind: 'unfinished_game', source: `source:${i}:${'🌱'.repeat(160)}`, eventId: `learn:${i}`, now });
    state.rhythm = commitTraces(state.rhythm, state, source.event, now);
    assertRhythm(state, now);
    assert.ok(Buffer.byteLength(JSON.stringify(state.rhythm.actors.ashai)) <= RHYTHM_RULES.maxActorBytes);
  }
  assert.ok(state.rhythm.actors.ashai.traces.every(item => state.facts[item.factKey].sourceEventId === item.sourceEventId));
  const later = START + 10 * 24 * HOUR;
  state.rhythm = commitCompletion(state.rhythm, state, { who: 'ashai', label: 'quiet_break', minutes: 45, now: later });
  assert.equal(state.rhythm.actors.ashai.history.length, 1);
});

test('validation rejects coercible numbers, incomplete habits, invalid decay, future clocks and real oversized UTF-8', () => {
  for (const mutate of [
    r => { r.actors = null; }, r => { r.actors.ashai.needs.rest = '0.3'; },
    r => { r.actors.ashai.needs.social = NaN; }, r => { delete r.actors.ashai.habits.gaming; },
    r => { r.actors.ashai.needsAt = START + 1; }, r => { r.actors.ashai.needsAt = START - 1; },
    r => { r.actors.ashai.history = [{ label: 'gaming', at: START + 1 }]; },
    r => { r.actors.ashai.traces = [{ label: 'gaming', strength: .3, at: START, tau: 0, sourceEventId: 'source', factKey: 'fact' }]; },
    r => { r.actors.ashai.traces = [{ label: 'gaming', strength: .3, at: START, tau: RHYTHM_RULES.traceTau, sourceEventId: 'source', factKey: '🌱'.repeat(1000) }]; },
  ]) {
    const state = fresh(); mutate(state.rhythm); assert.throws(() => assertRhythm(state, START), /[Rr]hythm/);
  }
});

test('trace acquisition reads only new indexed memories, never a mature actor’s whole knowledge history', () => {
  const state = fresh();
  state.characters.ashai.knowledge = Array.from({ length: 10000 }, (_, index) => ({ factKey: `old:${index}` }));
  const source = learn(state), appended = state.characters.ashai.knowledge.length - 1;
  let indexedReads = 0;
  state.characters.ashai.knowledge = new Proxy(state.characters.ashai.knowledge, { get(target, key, receiver) {
    if (key === Symbol.iterator || ['filter', 'find', 'map', 'forEach', 'slice'].includes(key))
      throw new Error('Full memory traversal is forbidden');
    if (/^\d+$/.test(String(key))) {
      assert.equal(Number(key), appended, 'old knowledge must not be read'); indexedReads++;
    }
    return Reflect.get(target, key, receiver);
  }, ownKeys() { throw new Error('Full memory enumeration is forbidden'); } });
  const result = commitTraces(state.rhythm, state, source.event, START);
  assert.equal(result.actors.ashai.traces.length, 2); assert.equal(indexedReads, 1);
  const noNewKnowledge = commitTraces(state.rhythm, state, { id: 'ordinary-event', changes: [] }, START);
  assert.equal(noNewKnowledge, state.rhythm); assert.equal(indexedReads, 1);
});

test('append leaves and legacy appended suffix give equivalent traces; forged and rewritten memories cannot deposit', () => {
  const state = fresh(), source = learn(state);
  const leaf = commitTraces(state.rhythm, state, source.event, START);
  const whole = { ...source.event, changes: [{ entity: 'character', id: 'ashai', field: 'knowledge',
    before: [], after: structuredClone(state.characters.ashai.knowledge) }] };
  assert.deepEqual(commitTraces(state.rhythm, state, whole, START), leaf);
  for (const change of [
    { ...source.event.changes[0], before: { factKey: 'old' } },
    { ...source.event.changes[0], path: ['99'] },
    { ...source.event.changes[0], after: { ...source.memory, provenance: 'forged' } },
    { ...source.event.changes[0], id: 'goaden' },
    { ...whole.changes[0], before: structuredClone(state.characters.ashai.knowledge) },
  ]) assert.equal(commitTraces(state.rhythm, state, { ...source.event, changes: [change] }, START), state.rhythm);
  assert.equal(commitTraces(state.rhythm, state, { ...source.event, changes: [] }, START), state.rhythm);
});
