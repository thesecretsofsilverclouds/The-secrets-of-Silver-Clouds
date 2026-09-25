import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { CanonicalFork, boundedCounterfactualState } from '../src/canonical-fork.mjs';
import { CSV_RULES, evaluateIntentAlternatives, causalSensitivity,
  counterfactualOutcomes, directionalChoiceWeights } from '../src/counterfactual-value.mjs';
import { chooseIntentMotive, ordinaryIntentChoice, intentEncounterActions, issueIntentActions } from '../src/intent.mjs';

const START = atLondon('2026-09-04', '00:00'), ENCOUNTER = atLondon('2026-09-04', '18:45');
const HOUR = 60 * MIN, base = createFixture({ startMs: START });
const shadow = { disableCounterfactual: true, disableNarrativeSignals: true };
function setup(seed, ashFatigue = 4) {
  const state = base.initialState();
  for (const actor of Object.values(state.characters)) Object.assign(actor, {
    location: 'mi6', area: 'common_room', activity: 'unhurried_time',
    activitySince: ENCOUNTER, activityUntil: null, activityId: 'canon-test:encounter',
  });
  state.abilities.actors.ashai.fatigue = ashFatigue;
  const proposed = intentEncounterActions({ state, day: londonDate(ENCOUNTER), now: ENCOUNTER,
    parentActionId: 'canon-test:encounter', parentEventId: 'canon-test:encounter', seed });
  if (!proposed.length) return null;
  const pendingActions = issueIntentActions({ state, now: ENCOUNTER, id: 'canon-test:encounter',
    ops: { setIntent: value => { state.intent = value; } } }, proposed);
  const initialState = structuredClone(state), initialActions = structuredClone(pendingActions);
  const offer = pendingActions.shift();
  const { event, followups } = base.reduceAction(state, offer, seed, shadow);
  pendingActions.push(...followups);
  const action = pendingActions.find(item => item.type === 'INTENT_RESPONSE');
  assert.ok(action);
  return { state, pendingActions, action, seed, key: action.intentId,
    baselineMotive: ordinaryIntentChoice(seed, action.intentId), reduceAction: base.reduceAction,
    rulesVersion: base.rulesVersion, startMs: START, resolvedThrough: offer.dueAt,
    sequence: 1, initialState, initialActions, offerEvent: event };
}
function findSetup(predicate = () => true, fatigue = 4) {
  for (let index = 0; index < 500; index++) {
    const input = setup(`csv-case-${index}`, fatigue);
    if (input && predicate(input)) return input;
  }
  assert.fail('No bounded ordinary fixture found');
}

test('canonical fork matches real WorldStore state, committed events and complete pending queue', () => {
  const seed = 'csv-parity', store = new WorldStore({ dbPath: ':memory:', seed, fixture: base });
  try {
    const origin = store.semanticSnapshot();
    const { world, events, pendingActions, ...state } = origin;
    const pristine = structuredClone(origin);
    const fork = new CanonicalFork({ state, pendingActions, seed,
      rulesVersion: world.rulesVersion, startMs: START, resolvedThrough: world.resolvedThrough,
      reduceAction: base.reduceAction, maxActions: 2000 });
    const end = START + 24 * HOUR;
    fork.advance(end); store.advance(end);
    const actual = store.semanticSnapshot();
    const { world: finalWorld, events: finalEvents, pendingActions: finalPending, ...finalState } = actual;
    assert.deepEqual(fork.state, finalState); assert.deepEqual(fork.events, finalEvents);
    assert.deepEqual(fork.pendingActions, finalPending);
    assert.equal(fork.resolvedThrough, finalWorld.resolvedThrough);
    assert.deepEqual(origin, pristine, 'fork mutated its source');
    assert.ok(fork.pendingActions.length, 'future queue must survive');
  } finally { store.close(); }
});

test('fork ordering matches SQLite dueAt/priority/id and enforces one total action budget', () => {
  const action = (id, dueAt, priority) => ({ id, dueAt, priority, type: 'test' });
  const queue = [action('z', 2, 2), action('b', 2, 1), action('a', 2, 1)];
  const reduceAction = (state, a) => { state.order.push(a.id); return {
    event: { id: `evt:${a.id}`, occurredAt: a.dueAt }, followups: a.id === 'a' ? [action('child', 3, 0)] : [] }; };
  const args = { state: { order: [] }, pendingActions: queue, seed: 'order', rulesVersion: 'test',
    startMs: 0, resolvedThrough: 0, reduceAction, maxActions: 3 };
  const fork = new CanonicalFork(args); fork.advance(2);
  assert.deepEqual(fork.state.order, ['a', 'b', 'z']);
  assert.throws(() => fork.advance(3), /action budget/);
  assert.equal(fork.processedActions, 3); assert.equal(queue.length, 3);
  assert.throws(() => new CanonicalFork({ ...args, maxCloneBytes: 1 }), /clone budget/);
  assert.equal(boundedCounterfactualState(args.state, 1), null);
  assert.deepEqual(boundedCounterfactualState(args.state), args.state);
  assert.notEqual(boundedCounterfactualState(args.state), args.state);
  const oversized = { text: 'x'.repeat(100), get tail() { assert.fail('oversize clone scanned the rest'); } };
  assert.equal(boundedCounterfactualState(oversized, 20), null);
});

test('real forks discover a completed legal session versus a declined counteroffer and have no recursive scoring', () => {
  const input = findSetup(item => item.baselineMotive === 'ambition');
  const untouched = JSON.stringify({ state: input.state, queue: input.pendingActions });
  let shadowActions = 0;
  const result = evaluateIntentAlternatives({ ...input, reduceAction: (state, action, seed, context) => {
    assert.equal(context.disableCounterfactual, true); assert.equal(context.disableNarrativeSignals, true);
    shadowActions++; return base.reduceAction(state, action, seed, context);
  } });
  assert.equal(result.status, 'evaluated'); assert.equal(result.preferredMotive, 'loyalty');
  assert.equal(result.gain, .2); assert.equal(result.logWeights.loyalty, Math.log(1.25));
  assert.ok(result.evidence.some(proof => proof.motive === 'loyalty' && proof.kind === 'intent_result'
    && proof.outcome === 'completed' && proof.value > 0));
  assert.equal(result.evidence.some(proof => proof.value < 0), false, 'declining is not harm');
  assert.equal(shadowActions, result.processedActions.loyalty + result.processedActions.ambition);
  assert.ok(shadowActions <= CSV_RULES.maxActions);
  assert.equal(JSON.stringify({ state: input.state, queue: input.pendingActions }), untouched);
  assert.deepEqual(evaluateIntentAlternatives({ ...input, reduceAction: undefined }).logWeights,
    { loyalty: 0, ambition: 0 });
  const restarted = { ...JSON.parse(JSON.stringify(input)), reduceAction: base.reduceAction };
  assert.deepEqual(evaluateIntentAlternatives(restarted), evaluateIntentAlternatives(input));
  const swapped = evaluateIntentAlternatives({ ...input, baselineMotive: 'loyalty' });
  assert.equal(swapped.preferredMotive, result.preferredMotive);
  assert.deepEqual(swapped.logWeights, result.logWeights, 'baseline label cannot bias the alternative');
});

test('equally completed real alternatives are neutral; incomplete horizons reject both branches', () => {
  const input = findSetup(() => true, 0), answer = evaluateIntentAlternatives(input);
  assert.equal(answer.status, 'evaluated'); assert.equal(answer.preferredMotive, null);
  assert.equal(answer.gain, 0); assert.deepEqual(answer.logWeights, { loyalty: 0, ambition: 0 });
  for (const limits of [{ maxActions: 1 }, { maxCloneBytes: 1 }]) {
    const blocked = evaluateIntentAlternatives({ ...input, ...limits });
    assert.equal(blocked.status, 'unavailable'); assert.equal(blocked.reason, 'bounded_budget');
    assert.deepEqual(blocked.logWeights, { loyalty: 0, ambition: 0 });
    assert.ok(blocked.processedActions.loyalty <= (limits.maxActions ?? CSV_RULES.maxActions));
  }
});

test('direction and neutral value agree across six fixed paired environments', () => {
  const seeds = [];
  for (let i = 0; seeds.length < 6 && i < 100; i++) if (setup(`csv-paired-${i}`)) seeds.push(`csv-paired-${i}`);
  assert.equal(seeds.length, 6);
  for (const seed of seeds) {
    const useful = evaluateIntentAlternatives(setup(seed, 4));
    const equal = evaluateIntentAlternatives(setup(seed, 0));
    assert.equal(useful.status, 'evaluated'); assert.equal(useful.preferredMotive, 'loyalty');
    assert.equal(useful.gain, .2);
    assert.equal(equal.status, 'evaluated'); assert.equal(equal.preferredMotive, null);
  }
});

test('sensitivity is sign-symmetric but directional value favours benefit and rejects disruption', () => {
  const now = [0, 0, 0, 0], future = [[0, .2, 0, 0], [0, .2, 0, 0], [0, .2, 0, 0], [0, .2, 0, 0]];
  assert.equal(causalSensitivity(now, future), causalSensitivity(now, future.map(row => row.map(v => -v))));
  assert.equal(causalSensitivity(now, future.map(() => now)), 0);
  assert.throws(() => causalSensitivity(now, future, [1, 1, 4, 6]), /checkpoints/);
  const benefit = { utility: .2, disruptions: 0, evidence: [{ value: .2 }] };
  const harm = { utility: -.2, disruptions: 1, evidence: [{ value: -.2 }] };
  assert.equal(directionalChoiceWeights(benefit, harm).preferredMotive, 'loyalty');
  assert.equal(directionalChoiceWeights(harm, benefit).preferredMotive, 'ambition');
  assert.equal(directionalChoiceWeights({ ...benefit, disruptions: 2 }, harm).preferredMotive, null);
  const source = findSetup();
  const cosmetic = structuredClone(source.state);
  cosmetic.sceneBank.counts = { fake: 999 };
  cosmetic.facts.cosmetic = { key: 'cosmetic', kind: 'scene_observation', sourceEventId: 'root',
    createdAt: source.action.dueAt, value: { outcome: 'completed' } };
  const metrics = state => counterfactualOutcomes({ state, events: [{ id: 'root', occurredAt: source.action.dueAt }],
    rootEventId: 'root', now: source.action.dueAt });
  assert.deepEqual(metrics(cosmetic), metrics(source.state));
});

test('zero bias preserves every original draw and a bounded fraction can actually change free choices', () => {
  let changed = 0;
  for (let index = 0; index < 1000; index++) {
    const seed = `seed:${index}`, key = `key:${index}`;
    const old = createHash('sha256').update(`${seed}|intent-v1|${key}/motive`).digest().readUInt32BE(0) % 7 < 4
      ? 'loyalty' : 'ambition';
    assert.equal(ordinaryIntentChoice(seed, key), old);
    assert.equal(ordinaryIntentChoice(seed, key, { loyalty: 0, ambition: 0 }), old);
    const capped = ordinaryIntentChoice(seed, key, { loyalty: Math.log(1.25), ambition: 0 });
    assert.equal(ordinaryIntentChoice(seed, key, { loyalty: 1000, ambition: -1000 }), capped);
    if (capped !== old) { assert.equal(capped, 'loyalty'); changed++; }
  }
  assert.ok(changed > 10);
});

test('mandatory duty and fatigue bypass evaluation and overrides completely', () => {
  const input = findSetup();
  for (const kind of ['duty', 'rest', 'remembered_unkept_time', 'recent_shared_activity']) {
    const state = structuredClone(input.state);
    if (kind === 'duty') state.characters.goaden.activity = 'on_call';
    else if (kind === 'rest') state.abilities.actors.goaden.fatigue = 4;
    else {
      const factKey = 'test:prior:result', sourceEventId = 'test:prior:event';
      const value = { outcome: kind === 'remembered_unkept_time' ? 'interrupted' : 'completed', activity: 'game' };
      state.facts[factKey] = { key: factKey, kind: 'intent_result', value, sourceEventId,
        createdAt: ENCOUNTER - MIN, validUntil: null };
      state.characters.goaden.knowledge.push({ factKey, sourceEventId, acquisitionEventId: sourceEventId,
        learnedAt: ENCOUNTER - MIN, validUntil: null, value });
    }
    const item = state.intent.instances[input.key];
    const result = chooseIntentMotive(state, input.action.dueAt, input.seed, input.key, item.startAt,
      item.endAt, item.arrangementKey, { counterfactualDecision: () => { assert.fail('mandatory choice evaluated'); },
        intentOverride: { key: input.key, motive: 'ambition' } });
    if (kind === 'duty' || kind === 'rest') assert.equal(result.motive, kind);
    else assert.equal(result.reason, kind);
  }
});

test('counterfactual imports have no I/O or model clients and real evaluation calls no network', t => {
  const visited = new Set(), dependencies = [new URL('../src/counterfactual-value.mjs', import.meta.url)];
  while (dependencies.length) {
    const url = dependencies.pop();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const source = readFileSync(url, 'utf8');
    for (const [, specifier] of source.matchAll(/(?:import|export)\s+[^;]*?from\s+['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) dependencies.push(new URL(specifier, url));
      else assert.equal(specifier, 'node:crypto', `Forbidden runtime dependency: ${specifier}`);
    }
    assert.equal(/\b(?:fetch|require|import)\s*\(/.test(source), false, 'No indirect I/O entry points');
  }
  assert.ok(visited.size >= 5);
  const input = findSetup();
  t.mock.method(globalThis, 'fetch', () => assert.fail('Counterfactual tried network access'));
  assert.equal(evaluateIntentAlternatives(input).status, 'evaluated');
});

test('different branch action counts preserve the exact exogenous weather action and result', () => {
  const input = findSetup(), nextDay = '2026-09-05';
  const weather = { id: `${nextDay}/day`, day: nextDay, type: 'WEATHER_CHANGE',
    dueAt: atLondon(nextDay, '00:00') + 1, priority: 0 };
  const branches = ['loyalty', 'ambition'].map(motive => {
    const fork = new CanonicalFork({ ...input, pendingActions: [...input.pendingActions, weather],
      context: { ...shadow, intentOverride: { key: input.key, motive } } });
    fork.advance(input.action.dueAt + 6 * HOUR); return fork;
  });
  assert.notEqual(branches[0].processedActions, branches[1].processedActions);
  const weatherEvent = fork => fork.events.find(event => event.type === 'WEATHER_CHANGE');
  assert.ok(weatherEvent(branches[0]));
  assert.equal(weatherEvent(branches[0]).id, weatherEvent(branches[1]).id);
  assert.deepEqual(weatherEvent(branches[0]).payload, weatherEvent(branches[1]).payload);
  assert.deepEqual(branches[0].state.weather, branches[1].state.weather);
});

test('live WorldStore uses paired result to change a legal ordinary choice and preserves chunk/restart equality', () => {
  const input = findSetup(item => item.baselineMotive === 'ambition'
    && ordinaryIntentChoice(item.seed, item.key, { loyalty: Math.log(1.25), ambition: 0 }) === 'loyalty');
  const fixture = { ...base, initialState: () => structuredClone(input.initialState),
    initialActions: () => structuredClone(input.initialActions) };
  const one = new WorldStore({ dbPath: ':memory:', seed: input.seed, fixture });
  const chunks = new WorldStore({ dbPath: ':memory:', seed: input.seed, fixture });
  try {
    const end = input.action.dueAt + 6 * HOUR;
    one.advance(end);
    for (let target = ENCOUNTER + MIN; target < end; target += 5 * MIN) chunks.advance(target);
    chunks.advance(end);
    const snapshot = one.semanticSnapshot();
    assert.deepEqual(chunks.semanticSnapshot(), snapshot);
    const item = snapshot.intent.instances[input.key];
    assert.equal(item.privateDecision.motive, 'loyalty'); assert.equal(item.status, 'completed');
    assert.equal(snapshot.narrativeSignals.csv.lastEvaluation.status, 'evaluated');
    assert.equal(snapshot.narrativeSignals.csv.lastEvaluation.preferredMotive, 'loyalty');
    const forecastIds = new Set(snapshot.narrativeSignals.csv.lastEvaluation.evidence.map(proof => proof.sourceEventId));
    const realIds = new Set(snapshot.events.map(event => event.id));
    for (const event of snapshot.events) for (const cause of event.causedBy)
      if (forecastIds.has(cause)) assert.ok(realIds.has(cause), 'hypothetical evidence became a real cause');
    const response = snapshot.events.find(event => event.type === 'INTENT_RESPONSE');
    assert.equal(response.causedBy.some(id => forecastIds.has(id)), false, 'future result leaked into present knowledge');
    assert.equal(JSON.stringify(one.publicProjection()).includes('logWeights'), false);
    const mid = new WorldStore({ dbPath: ':memory:', seed: input.seed, fixture });
    try {
      mid.advance(input.action.dueAt);
      const { world, events, pendingActions, ...state } = JSON.parse(JSON.stringify(mid.semanticSnapshot()));
      const resumed = new CanonicalFork({ state, pendingActions, seed: world.seed, rulesVersion: world.rulesVersion,
        startMs: START, resolvedThrough: world.resolvedThrough, sequence: events.length,
        reduceAction: base.reduceAction });
      resumed.advance(end);
      const { world: finalWorld, events: finalEvents, pendingActions: finalQueue, ...finalState } = snapshot;
      assert.deepEqual(resumed.state, finalState); assert.deepEqual(resumed.pendingActions, finalQueue);
      assert.deepEqual([...events, ...resumed.events], finalEvents);
    } finally { mid.close(); }
  } finally { one.close(); chunks.close(); }
});
