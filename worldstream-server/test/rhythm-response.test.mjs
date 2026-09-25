import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture } from '../src/fixture.mjs';
import { atLondon, londonDate, nextLondonDay } from '../src/time.mjs';
import { chooseRoutine, scoreCandidates, commitCompletion, RHYTHM_SLOT_FAMILIES } from '../src/rhythm.mjs';

const START = atLondon('2026-09-05', '00:00'), SEED = 'silver-clouds-now-v1', TRIALS = 4096;
const succeeds = event => event.payload?.outcome !== 'skipped' && !event.payload?.skipped;
let cached;

// Observe the unchanged real reducer through a fresh, memory-only WorldStore.
// No winners, completion tags, events, facts, or production state are injected.
function observedCases() {
  if (cached) return cached;
  const fixture = createFixture({ startMs: START }), music = [];
  let broken = null, traceCase = null, habitCase = null;
  let withoutMusicHabit = structuredClone(fixture.initialState().rhythm.actors.ashai.habits);
  const watched = { ...fixture, reduceAction(state, action, seed, context) {
    const actor = state.characters.ashai;
    const completion = action.type === 'ACTIVITY_COMPLETE' && action.actor === 'ashai'
      && action.rhythm?.family && actor.activityId === action.activityId
      ? { label: actor.activity, minutes: (action.dueAt - actor.activitySince) / 60000,
        family: action.rhythm.family, startEventId: actor.activityId, at: action.dueAt } : null;
    // The following evening is an owned make-up plan, so it has no leisure
    // seam. Use the next actual free evening; never invent a slot for the test.
    const nextBrokenEvening = broken && action.type === 'RHYTHM_CHOOSE' && action.actor === 'ashai'
      && action.family === 'evening_leisure' && action.day > londonDate(broken.at)
      && action.dueAt - broken.at < 3 * 86400000;
    const afterFive = music.length === 5 && action.type === 'RHYTHM_CHOOSE' && action.actor === 'ashai';
    const beforeChoice = (!traceCase && nextBrokenEvening || !habitCase && afterFive) ? structuredClone(state) : null;
    const result = fixture.reduceAction(state, action, seed, context), event = result.event;
    if (event.type === 'PLAN_BROKEN' && succeeds(event)) {
      const fact = Object.values(state.facts).find(item => item.kind === 'broken_plan' && item.sourceEventId === event.id);
      assert.ok(fact, 'the actual broken plan must create its own fact');
      assert.ok(actor.knowledge.some(memory => memory.factKey === fact.key && memory.acquisitionEventId === event.id));
      broken = { sourceEventId: event.id, factKey: fact.key, at: event.occurredAt };
    }
    if (beforeChoice && Array.isArray(event.payload.scores) && event.payload.scores.length) {
      const sample = { state: beforeChoice, action: structuredClone(action),
        legal: event.payload.scores.map(row => row.label) };
      if (!traceCase && nextBrokenEvening) traceCase = { ...sample, source: structuredClone(broken) };
      if (!habitCase && afterFive) habitCase = { ...sample, music: structuredClone(music),
        withoutMusicHabit: structuredClone(withoutMusicHabit) };
    }
    if (completion && succeeds(event)) {
      assert.ok(RHYTHM_SLOT_FAMILIES[completion.family].ashai.includes(completion.label));
      assert.equal(state.rhythm.actors.ashai.history.at(-1).label, completion.label);
      // Matched lab ablation: replay this same factual completion's habit
      // transition, treating music as a non-learning routine. Other actual
      // leisure learning is retained. Only the resulting habit vector is used;
      // later comparisons retain factual needs, history, traces and legality.
      const shadow = { ...state.rhythm, actors: { ...state.rhythm.actors,
        ashai: { ...state.rhythm.actors.ashai, habits: withoutMusicHabit } } };
      withoutMusicHabit = commitCompletion(shadow, state, { who: 'ashai', label: completion.label,
        minutes: completion.minutes, family: completion.label === 'listening_to_music' ? null : completion.family,
        now: completion.at }).actors.ashai.habits;
      if (completion.label === 'listening_to_music' && music.length < 5)
        music.push({ ...completion, completionEventId: event.id });
    }
    return result;
  } };
  const world = new WorldStore({ dbPath: ':memory:', seed: SEED, fixture: watched });
  try {
    let day = londonDate(START);
    for (let count = 0; count < 21 && !(traceCase && habitCase); count++) {
      day = nextLondonDay(day); world.advance(atLondon(day, '00:00'));
    }
    assert.ok(traceCase, `bounded fixture must include a real broken plan and the next available legal evening slot; latest source=${JSON.stringify(broken)}`);
    assert.ok(habitCase, 'bounded fixture must include five unforced music completions and a later free slot');
    const events = new Map(world.semanticSnapshot().events.map(event => [event.id, event]));
    for (const completion of habitCase.music) {
      const start = events.get(completion.startEventId), end = events.get(completion.completionEventId);
      assert.equal(start?.type, 'MUSIC_LISTEN_BEGIN'); assert.equal(end?.type, 'ACTIVITY_COMPLETE');
      assert.ok(succeeds(start) && succeeds(end));
      const decision = start.causedBy.map(id => events.get(id)).find(event => event?.type === 'RHYTHM_CHOOSE');
      assert.equal(decision?.payload.chosen, 'MUSIC_LISTEN_BEGIN');
      assert.equal(decision.payload.family, completion.family);
    }
    cached = { traceCase, habitCase }; return cached;
  } finally { world.close(); }
}

function selectionOptions(sample, state, key = sample.action.id) {
  return { state, who: 'ashai', family: sample.action.family, now: sample.action.dueAt,
    slotAt: sample.action.slotAt, minutes: sample.action.duration, seed: SEED, key,
    // These are the actual authoritative resolver's legal candidates at this
    // exact slot. All cloned controls retain identical physical circumstances.
    legal: (_template, label) => sample.legal.includes(label), narrative: false };
}
function compare(sample, treatment, control, wanted) {
  const fingerprint = JSON.stringify([treatment, control]), counts = { treatment: 0, control: 0, switchesToward: 0, switchesAway: 0 };
  for (let trial = 0; trial < TRIALS; trial++) {
    const key = `rhythm-response-common-key:${trial}`;
    const a = chooseRoutine(selectionOptions(sample, treatment, key)), b = chooseRoutine(selectionOptions(sample, control, key));
    assert.deepEqual(a.scores.map(row => row.label).sort(), b.scores.map(row => row.label).sort());
    const yes = wanted.has(a.label), baseline = wanted.has(b.label);
    counts.treatment += Number(yes); counts.control += Number(baseline);
    counts.switchesToward += Number(yes && !baseline); counts.switchesAway += Number(!yes && baseline);
  }
  assert.equal(JSON.stringify([treatment, control]), fingerprint, 'experimental reads must not write the factual world or controls');
  return { trials: TRIALS, ...counts, treatmentRate: counts.treatment / TRIALS, controlRate: counts.control / TRIALS,
    change: (counts.treatment - counts.control) / TRIALS };
}

test('a genuinely known broken plan increases traced routines at the next available real evening slot', t => {
  const sample = observedCases().traceCase, known = structuredClone(sample.state), unknown = structuredClone(sample.state);
  const { sourceEventId, factKey } = sample.source;
  assert.notEqual(sample.action.day, nextLondonDay(londonDate(sample.source.at)),
    'the owned make-up evening must not be relabelled as a RHYTHM leisure opportunity');
  const memory = known.characters.ashai.knowledge.find(item => item.factKey === factKey);
  assert.equal(memory.sourceEventId, sourceEventId);
  assert.ok(known.rhythm.actors.ashai.traces.some(item => item.sourceEventId === sourceEventId));
  unknown.characters.ashai.knowledge = unknown.characters.ashai.knowledge.filter(item => item.factKey !== factKey);
  unknown.rhythm.actors.ashai.traces = unknown.rhythm.actors.ashai.traces.filter(item => item.sourceEventId !== sourceEventId);
  assert.deepEqual(known.facts, unknown.facts, 'the world still contains the fact; only this actor’s source knowledge and resulting traces differ');
  assert.deepEqual(known.rhythm.actors.ashai.habits, unknown.rhythm.actors.ashai.habits);
  assert.deepEqual(known.rhythm.actors.ashai.history, unknown.rhythm.actors.ashai.history);
  const result = compare(sample, known, unknown, new Set(['listening_to_music', 'quiet_break']));
  assert.ok(result.change > .005, `known-source trace produced no measurable next-evening response: ${JSON.stringify(result)}`);
  assert.ok(result.switchesToward > result.switchesAway);
  t.diagnostic(JSON.stringify({ knownPlanBrokenNextAvailableEvening: result,
    sourceAt: new Date(sample.source.at).toISOString(), choiceAt: new Date(sample.action.dueAt).toISOString(),
    designRefinement: 'The next evening belongs to an existing make-up plan; evaluate the next actual free evening instead of inventing a slot.' }));
});

test('five real music completions increase later unforced preference with need, trace and satiety held equal', t => {
  const sample = observedCases().habitCase, learned = structuredClone(sample.state), control = structuredClone(sample.state);
  assert.equal(sample.music.length, 5);
  control.rhythm.actors.ashai.habits = structuredClone(sample.withoutMusicHabit);
  const scores = scoreCandidates(selectionOptions(sample, learned)), baseline = scoreCandidates(selectionOptions(sample, control));
  const music = scores.find(row => row.label === 'listening_to_music'), controlMusic = baseline.find(row => row.label === 'listening_to_music');
  assert.ok(music.terms.habit > controlMusic.terms.habit);
  assert.ok(music.total > controlMusic.total);
  for (const term of ['gain', 'circadian', 'trace', 'social', 'narrative', 'satiety', 'cost'])
    assert.equal(music.terms[term], controlMusic.terms[term], `matched ${term} changed`);
  const result = compare(sample, learned, control, new Set(['listening_to_music']));
  assert.ok(result.change > .005, `learned habit produced no measurable choice response: ${JSON.stringify(result)}`);
  t.diagnostic(JSON.stringify({ fiveActualMusicCompletions: sample.music.map(row => ({ at: row.at, family: row.family })),
    isolatedHabitResponse: result }));

  // Combined immediate habit + repetition comparison, with physical needs held
  // equal: remove both the five learning exposures and their retained history
  // entries. Recent satiety may outweigh learning; no positive sign is forced.
  const noExposure = structuredClone(control), exposureTimes = new Set(sample.music.map(row => row.at));
  const priorLength = noExposure.rhythm.actors.ashai.history.length;
  noExposure.rhythm.actors.ashai.history = noExposure.rhythm.actors.ashai.history.filter(item =>
    item.label !== 'listening_to_music' || !exposureTimes.has(item.at));
  assert.ok(noExposure.rhythm.actors.ashai.history.length < priorLength, 'at least one actual recent listen must remain in the repetition window');
  const combined = compare(sample, learned, noExposure, new Set(['listening_to_music']));
  t.diagnostic(JSON.stringify({ immediateHabitPlusSatietyResponse: combined,
    interpretation: 'Needs, traces, circumstances and legal set are matched; this includes retained recent-listening satiety, not a promise that habit always wins.' }));
});
