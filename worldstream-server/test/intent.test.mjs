import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { WorldStore, semanticDigest } from '../experiment-l/src/world.mjs';
import { createFixture, DEFAULT_SEED } from '../src/fixture.mjs';
import { openWorld } from '../src/world.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { initialIntent, intentEncounterActions, issueIntentActions, chooseIntentMotive,
  publicIntentSummaries, INTENT_EVENT_TYPES, assertIntent } from '../src/intent.mjs';

const START = atLondon('2026-09-04', '00:00'), ENCOUNTER = atLondon('2026-09-04', '18:45');
const END = atLondon('2026-09-04', '20:00');
const base = createFixture({ startMs: START });
const only = state => {
  const entries = Object.values(state.intent.instances);
  assert.equal(entries.length, 1);
  return entries[0];
};
function stateAtEncounter() {
  const state = base.initialState();
  state.intent = initialIntent();
  for (const actor of Object.values(state.characters)) Object.assign(actor, {
    location: 'mi6', area: 'common_room', activity: 'unhurried_time',
    activitySince: ENCOUNTER, activityUntil: null, activityId: 'canon-test:encounter',
  });
  return state;
}
function opportunity(state, seed) {
  return intentEncounterActions({ state, day: londonDate(ENCOUNTER), now: ENCOUNTER,
    parentActionId: 'canon-test:encounter', parentEventId: 'canon-test:encounter', seed });
}
const SEED = Array.from({ length: 30 }, (_, index) => `intent-test-${index}`)
  .find(seed => opportunity(stateAtEncounter(), seed).length);
function setup(seed = SEED, prepare = () => {}) {
  const state = stateAtEncounter(); prepare(state);
  const actions = issueIntentActions({ state, now: ENCOUNTER, id: 'canon-test:encounter',
    ops: { setIntent: value => { state.intent = value; } } }, opportunity(state, seed));
  assert.equal(actions.length, 1);
  return { state, actions };
}
function harness(seed = SEED, prepare = () => {}) {
  const { state, actions } = setup(seed, prepare), events = [], queue = [...actions];
  const commit = a => {
    const result = base.reduceAction(state, structuredClone(a), seed);
    events.push(result.event); queue.push(...result.followups); return result;
  };
  const next = () => {
    queue.sort((first, second) => first.dueAt - second.dueAt || first.priority - second.priority || first.id.localeCompare(second.id));
    assert.ok(queue.length); return queue.shift();
  };
  const take = type => {
    for (let count = 0; count < 60; count++) { const a = next(); if (a.type === type) return a; commit(a); }
    assert.fail(`No ${type}`);
  };
  const finish = () => {
    for (let count = 0; count < 100 && queue.length; count++) commit(next());
    assert.equal(queue.length, 0); return state;
  };
  return { state, queue, events, commit, next, take, finish, seed };
}
function priorResult(state, who, outcome, activity = 'game', at = ENCOUNTER - 60 * MIN) {
  const key = `controlled-prior:${outcome}:${activity}`;
  const value = { outcome, activity, intentId: 'controlled-prior' };
  state.facts[key] = { key, kind: 'intent_result', subject: 'both', value,
    createdAt: at, sourceEventId: 'canon-test:prior-result', validUntil: null };
  state.characters[who].knowledge.push({ factKey: key, sourceEventId: 'canon-test:prior-result',
    acquisitionEventId: 'canon-test:prior-result', learnedAt: at, validUntil: null,
    provenance: 'participated', subject: 'both', value, visibility: 'private' });
}
const loyalty = state => priorResult(state, 'goaden', 'interrupted');
const ambition = state => priorResult(state, 'goaden', 'completed', 'game');
const fatigue = state => { state.abilities.actors.goaden.fatigue = 4; };
const duty = state => { state.arrangements['controlled-prior:commitment'] = {
  party: ['goaden'], requester: 'goaden', activity: 'game', status: 'accepted',
  sourceEventId: 'canon-test:commitment', acceptanceEventId: 'canon-test:acceptance',
  startAt: ENCOUNTER + 4 * MIN, until: ENCOUNTER + 30 * MIN, duration: 26,
}; };

test('Goaden chooses duty, rest, loyalty and ambition for distinct recorded circumstances', () => {
  for (const [prepare, expected] of [[duty, 'duty'], [fatigue, 'rest'], [loyalty, 'loyalty'], [ambition, 'ambition']]) {
    const state = stateAtEncounter(); prepare(state);
    assert.equal(chooseIntentMotive(state, ENCOUNTER, SEED, 'same-key', ENCOUNTER + 4 * MIN,
      ENCOUNTER + 16 * MIN).motive, expected);
  }
  const personal = stateAtEncounter(), other = stateAtEncounter(), future = stateAtEncounter();
  priorResult(personal, 'goaden', 'interrupted'); priorResult(other, 'ashai', 'interrupted');
  priorResult(future, 'goaden', 'interrupted', 'game', ENCOUNTER + MIN);
  const choose = state => chooseIntentMotive(state, ENCOUNTER, SEED, 'same-key', ENCOUNTER + 4 * MIN, ENCOUNTER + 16 * MIN);
  assert.equal(choose(personal).reason, 'remembered_unkept_time');
  assert.notEqual(choose(other).reason, 'remembered_unkept_time');
  assert.notEqual(choose(future).reason, 'remembered_unkept_time');
});

test('Ashai initiates offers, can refuse practice, and accepted negotiations own real completed time', () => {
  for (const [prepare, expected, selected] of [[loyalty, 'completed', 'game'], [ambition, 'completed', 'practice'],
    [fatigue, 'completed', 'quiet'], [duty, 'declined', null],
    [state => { ambition(state); state.abilities.actors.ashai.fatigue = 4; }, 'declined', 'practice']]) {
    const run = harness(SEED, prepare); run.finish(); const item = only(run.state);
    assert.equal(item.requester, 'ashai'); assert.equal(item.status, expected);
    assert.equal(item.selected, selected);
    assert.equal(run.state.arrangements[item.arrangementKey].status, expected === 'completed' ? 'completed' : 'deferred');
    assert.ok(run.events.some(event => event.type === 'INTENT_OFFER' && event.visibility === 'public'));
    if (expected === 'completed') {
      assert.ok(item.startEventId); assert.equal(item.completedAt - item.startAt, 12 * MIN);
      assert.ok(run.events.some(event => event.type === 'INTENT_COMPLETE' && event.causedBy.includes(item.startEventId)));
    }
    assertIntent(run.state);
  }
});

test('a competing commitment added after acceptance prevents a false start', () => {
  const run = harness(SEED, loyalty), start = run.take('INTENT_START');
  duty(run.state); run.commit(start); run.finish();
  const item = only(run.state);
  assert.equal(item.status, 'interrupted'); assert.equal(item.startEventId, null);
  assert.equal(run.events.some(event => event.type === 'INTENT_COMPLETE' && event.visibility === 'public'), false);
});

test('a real duty replacement releases only the old shared session and cannot complete it later', () => {
  const run = harness(SEED, loyalty), start = run.take('INTENT_START');
  run.commit(start); const item = only(run.state);
  run.commit({ id: 'canon-test:actual-duty', type: 'BRIEFING_BEGIN', dueAt: item.startAt + 4 * MIN,
    day: londonDate(item.startAt), priority: 12, actor: 'goaden', duration: 40 });
  run.finish(); const final = only(run.state);
  assert.equal(final.status, 'interrupted');
  const release = run.events.find(event => event.type === 'INTENT_INTERRUPTED');
  assert.ok(release); assert.ok(release.causedBy.includes(final.interruptionEventId));
  assert.equal(release.changes.some(change => change.entity === 'character' && change.id === 'goaden'
    && change.field === 'activity' && change.after === 'unhurried_time'), false, 'release overwrote incoming duty');
  assert.equal(run.events.some(event => event.type === 'INTENT_COMPLETE' && event.visibility === 'public'), false);
});

test('issued identity, time, version and participant ownership reject forged intention actions', () => {
  const run = harness(SEED, loyalty), response = run.take('INTENT_RESPONSE');
  for (const patch of [{ id: `${response.id}/forged` }, { dueAt: response.dueAt - 1 }, { version: 2 },
    { intentToken: 'foreign' }, { actors: ['goaden'] }]) {
    const copy = structuredClone(run.state), before = structuredClone(copy);
    const result = base.reduceAction(copy, { ...response, ...patch }, SEED);
    assert.deepEqual(result.event.changes, []); assert.deepEqual(copy, before);
  }
  run.commit(response); run.finish();
  const before = structuredClone(run.state), repeat = base.reduceAction(run.state, response, SEED);
  assert.deepEqual(repeat.event.changes, []); assert.deepEqual(run.state, before);
});

test('same room and a real awake opportunity are required; private motives never enter projection', () => {
  const state = stateAtEncounter(); state.characters.ashai.area = 'music_room';
  assert.deepEqual(opportunity(state, SEED), []);
  state.characters.ashai.area = 'common_room'; state.characters.ashai.activity = 'sleeping';
  assert.deepEqual(opportunity(state, SEED), []);
  const run = harness(SEED, ambition); run.finish(); const item = only(run.state);
  const projected = publicIntentSummaries(run.state, END), text = JSON.stringify(projected);
  for (const forbidden of ['privateDecision', 'factKeys', 'MOTIVE_WEIGHTS', item.token, item.offerFactKey, item.responseFactKey])
    assert.equal(text.includes(forbidden), false);
  assert.equal(projected[0].status, 'completed');
  const before = structuredClone(run.state);
  for (let count = 0; count < 5; count++) assert.deepEqual(publicIntentSummaries(run.state, END), projected);
  assert.deepEqual(run.state, before);
});

test('absence, frequent advances, duplicate requests and restarts preserve intentions and reservations', t => {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-intent-test-')), opened = [];
  t.after(() => {
    opened.forEach(world => world.close());
    const path = realpathSync(directory);
    if (dirname(path) !== realpathSync(tmpdir()) || !basename(path).startsWith('silver-clouds-intent-test-')) throw new Error('Unsafe test cleanup');
    rmSync(path, { recursive: true, force: true });
  });
  const fixture = { ...base, initialState: () => setup(SEED, loyalty).state, initialActions: () => setup(SEED, loyalty).actions };
  const open = path => { const world = new WorldStore({ dbPath: join(directory, `${path}.sqlite`), seed: SEED, fixture }); opened.push(world); return world; };
  const absent = open('absent'); absent.advance(END);
  const expected = absent.semanticSnapshot(), digest = semanticDigest(expected);
  const frequent = open('frequent');
  for (let at = ENCOUNTER; at <= END; at += MIN) { frequent.advance(at); frequent.advance(at); }
  assert.deepEqual(frequent.semanticSnapshot(), expected);
  let restarted = open('restart');
  for (const at of [ENCOUNTER + MIN, ENCOUNTER + 2 * MIN, ENCOUNTER + 4 * MIN, ENCOUNTER + 16 * MIN, END]) {
    restarted.advance(at); restarted.close(); restarted = open('restart');
  }
  assert.deepEqual(restarted.semanticSnapshot(), expected);
  for (let count = 0; count < 5; count++) absent.publicProjection();
  assert.equal(semanticDigest(absent.semanticSnapshot()), digest);
});

test('the existing fortnight produces bounded actual Ashai offers without observer scheduling', () => {
  const world = openWorld({ dbPath: ':memory:', seed: DEFAULT_SEED, startMs: START });
  try {
    world.advance(atLondon('2026-09-18', '00:00'));
    const snapshot = world.semanticSnapshot();
    const offers = snapshot.events.filter(event => event.type === 'INTENT_OFFER' && event.visibility === 'public');
    assert.ok(offers.length > 0, 'the ordinary calendar must actually reach the new decision points');
    assert.ok(offers.length <= 7, 'intentions should recur a few times per week, not fill every evening');
    assert.equal(new Set(offers.map(event => londonDate(event.occurredAt))).size, offers.length);
    for (const event of offers) assert.deepEqual([...event.participants].sort(), ['ashai', 'goaden']);
    for (const item of Object.values(snapshot.intent.instances)) assert.ok(!['offered', 'reserved', 'started'].includes(item.status));
  } finally { world.close(); }
});
