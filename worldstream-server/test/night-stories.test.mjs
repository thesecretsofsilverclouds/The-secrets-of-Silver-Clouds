import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { WorldStore, semanticDigest } from '../experiment-l/src/world.mjs';
import { initialNightStories, NIGHT_RULES, nightDayActions, recordNightCause, issueNightActions,
  resolveNightAction, nightEncounterActions, nightStoryAvailable, nightRecoveryFor,
  publicNightStories, assertNightStories } from '../src/night-stories.mjs';
import { initialAbilities, abilityActivityChanged, resolveAbilityAction, fatigueAt, assertAbilities } from '../src/abilities.mjs';
import { atLondon, londonDate, nextLondonDay, MINUTE_MS as MIN } from '../src/time.mjs';

const DAY = '2026-09-06', START = atLondon(DAY, '00:00'), END = atLondon(DAY, '12:00');
const clone = value => structuredClone(value);
const latest = state => Object.values(state.nightStories.episodes).sort((a, b) => b.requestedAt - a.requestedAt)[0];

function initial() {
  return { nightStories: initialNightStories(), abilities: initialAbilities(), facts: {}, arrangements: {},
    weather: { code: 'heavy_rain' }, factions: { mi6: 'elevated', arcane: 'high' }, pressure: { level: 'high' },
    characters: Object.fromEntries(['goaden', 'ashai'].map(id => [id, { id, location: 'mi6', area: 'quarters',
      activity: 'sleeping', activitySince: START - 90 * MIN, activityId: `initial:${id}`, activityUntil: null,
      journey: null, conditions: [], knowledge: [] }])) };
}

// Substitute only ledger primitives. Production night ownership, schedules,
// choices, knowledge checks and the existing elapsed-fatigue code run unchanged.
function context(state, action, seed) {
  const id = `test-event:${action.id}`, now = action.dueAt;
  const event = { id, type: action.type, occurredAt: now, visibility: 'private', location: 'mi6', area: null,
    participants: [], causedBy: [], changes: [], payload: {}, publicDescription: null };
  const followups = [];
  const change = (entity, owner, target, field, value) => {
    if (JSON.stringify(target[field]) === JSON.stringify(value)) return;
    event.changes.push({ entity, id: owner, field, before: clone(target[field]), after: clone(value) });
    target[field] = value;
  };
  const ctx = { state, action, seed, now, id, event, followups, ops: {
    setNightStories: value => change('world', 'shared', state, 'nightStories', value),
    setAbilities: value => change('world', 'shared', state, 'abilities', value),
    setActor: (who, field, value) => change('character', who, state.characters[who], field, value),
    createFact(key, kind, subject, value, validUntil) {
      assert.equal(state.facts[key], undefined, 'facts have a single authoritative creation');
      const fact = { key, kind, subject, value, validUntil, sourceEventId: id, createdAt: now };
      change('world', 'shared', state, 'facts', { ...state.facts, [key]: fact }); return fact;
    },
    learn(who, fact, provenance) {
      assert.ok(fact && fact.createdAt <= now);
      const actor = state.characters[who];
      if (actor.knowledge.some(row => row.factKey === fact.key)) return;
      change('character', who, actor, 'knowledge', [...actor.knowledge, { factKey: fact.key,
        sourceEventId: fact.sourceEventId, acquisitionEventId: id, learnedAt: now,
        validUntil: fact.validUntil, value: clone(fact.value), provenance, visibility: 'private' }]);
    },
    useMemory(who, key) {
      const memory = state.characters[who].knowledge.find(row => row.factKey === key && row.learnedAt <= now);
      assert.ok(memory, `${who} cannot react to information they have not acquired: ${key}`);
      event.causedBy.push(memory.sourceEventId, memory.acquisitionEventId); return memory;
    },
    activity(who, label, duration, area) {
      abilityActivityChanged(ctx, who, label, duration, area);
      for (const [field, value] of Object.entries({ activity: label, activitySince: now, activityId: id,
        activityUntil: duration ? now + duration * MIN : null, area })) ctx.ops.setActor(who, field, value);
    },
    publish(text) { event.visibility = 'public'; event.publicDescription = text; },
    skip(reason) { event.payload = { outcome: 'skipped', reason }; },
  } };
  return ctx;
}
function reduce(state, action, seed) {
  const ctx = context(state, action, seed);
  assert.ok(resolveNightAction(ctx) || resolveAbilityAction(ctx));
  assertNightStories(state); assertAbilities(state);
  return { event: ctx.event, followups: ctx.followups };
}
function cause(state, { at = START - 4 * 60 * MIN, type = 'INSTITUTION_NOTICE', visibility = 'public',
  location = 'mi6', payload = { notice: 'elevated_alert' }, eventId = 'source:existing-advisory' } = {}) {
  const ctx = context(state, { id: eventId, type, dueAt: at }, '');
  Object.assign(ctx.event, { id: eventId, visibility, location, payload });
  return recordNightCause(ctx);
}
function issue(state, actions, now, id = 'source:day-boundary') {
  return issueNightActions({ state, now, id, ops: { setNightStories: value => { state.nightStories = value; } } }, actions);
}
function harness(seed, state = initial(), withCause = true) {
  if (withCause) cause(state);
  const queue = [], events = [];
  const openDay = (day = DAY, now = atLondon(day, '00:00')) => {
    const source = `source:${day}:day-boundary`;
    const actions = nightDayActions({ state, seed, day, now, parentActionId: source, parentEventId: source });
    queue.push(...issue(state, actions, now, source)); return actions;
  };
  const next = () => {
    queue.sort((a, b) => a.dueAt - b.dueAt || a.priority - b.priority || a.id.localeCompare(b.id));
    assert.ok(queue.length, 'night response lost its continuation'); return queue.shift();
  };
  const commit = action => {
    const outcome = reduce(state, action, seed);
    assert.ok(outcome.followups.every(row => row.dueAt > action.dueAt));
    events.push(outcome.event); queue.push(...outcome.followups); return outcome;
  };
  const take = type => {
    for (let steps = 0; steps < 30; steps++) { const action = next(); if (action.type === type) return action; commit(action); }
    assert.fail(`no ${type} in the finite night response`);
  };
  const finish = () => {
    for (let steps = 0; queue.length && steps < 40; steps++) commit(next());
    assert.equal(queue.length, 0, 'the response must end'); return state;
  };
  return { seed, state, queue, events, openDay, next, commit, take, finish };
}
function eligibleSeeds(limit = 100) {
  const found = [];
  for (let i = 0; found.length < limit && i < 1000; i++) {
    const seed = `night-test-${i}`;
    if (nightDayActions({ state: initial(), seed, day: DAY, now: START,
      parentActionId: 'day', parentEventId: 'day' }).length) found.push(seed);
  }
  return found;
}
const SEEDS = eligibleSeeds(36), SEED = SEEDS[0];
function started(seed = SEED, state = initial()) {
  const run = harness(seed, state); assert.equal(run.openDay().length, 1); run.commit(run.next()); return run;
}
function sample(predicate) {
  for (const seed of SEEDS) {
    const run = started(seed); run.finish(); if (predicate(latest(run.state), run)) return seed;
  }
  assert.fail('authored seed sample did not cover the required outcome');
}
function refused(state, action, seed = SEED) {
  const before = clone(state), result = reduce(state, action, seed);
  assert.equal(result.event.payload.outcome, 'skipped');
  assert.equal(result.event.visibility, 'private'); assert.deepEqual(state, before); assert.deepEqual(result.event.changes, []);
}

test('night opportunities require a recorded, recent, public MI6 cause and current unresolved pressure', () => {
  for (const options of [null, { visibility: 'private' }, { location: 'sanctuary' },
    { at: START - 40 * 60 * MIN }, { at: START + 4 * 60 * MIN }]) {
    const state = initial(); if (options) cause(state, options);
    const run = harness(SEED, state, false); run.openDay(); run.finish();
    assert.deepEqual(state.nightStories.episodes, {}); assert.deepEqual(state.facts, {});
  }
  const calm = initial(); cause(calm); calm.factions = { mi6: 'routine', arcane: 'stable' }; calm.pressure.level = 'quiet';
  const run = harness(SEED, calm, false); run.openDay(); run.finish(); assert.equal(latest(calm), undefined);
  const valid = started(); assert.equal(latest(valid.state).source.eventId, 'source:existing-advisory');
  assert.ok(valid.events[0].causedBy.includes('source:existing-advisory'));
});

test('most calendar nights stay quiet, cooldown holds, and midday activation never backfills a wake-up', () => {
  let day = DAY, slots = 0;
  for (let count = 0; count < 80; count++, day = nextLondonDay(day)) {
    slots += nightDayActions({ state: initial(), seed: SEED, day, now: atLondon(day, '00:00'), parentActionId: 'day', parentEventId: 'day' }).length;
  }
  assert.ok(slots > 5 && slots < 35, `rare opportunities should leave most nights quiet: ${slots}`);
  const run = started(); run.finish();
  for (let date = nextLondonDay(DAY), count = 1; count < NIGHT_RULES.cooldownDays; count++, date = nextLondonDay(date))
    assert.deepEqual(nightDayActions({ state: run.state, seed: SEED, day: date, now: atLondon(date, '00:00'), parentActionId: 'day', parentEventId: 'day' }), []);
  assert.deepEqual(nightDayActions({ state: initial(), seed: SEED, day: DAY, now: START + 12 * 60 * MIN, parentActionId: 'activation', parentEventId: 'activation' }), []);
});

test('a request is not telepathy: explicit calls precede waking, Ashai choice and result knowledge', () => {
  const seed = sample(story => story.participants.ashai?.status === 'recovered');
  const run = started(seed), story = latest(run.state);
  assert.ok(run.state.facts[story.requestFactKey]);
  assert.ok(Object.values(run.state.characters).every(actor => actor.activity === 'sleeping' && !actor.knowledge.length));
  run.commit(run.take('NIGHT_CALL'));
  assert.equal(run.state.characters.goaden.knowledge[0].factKey, story.requestFactKey);
  assert.equal(run.state.characters.ashai.knowledge.length, 0);
  run.commit(run.take('NIGHT_CONTACT_ASHAI'));
  const learned = run.state.characters.ashai.knowledge[0];
  assert.equal(learned.provenance, 'received_night_call');
  const choice = run.take('NIGHT_ASHAI_CHOICE');
  assert.ok(learned.learnedAt < choice.dueAt);
  assert.equal(latest(run.state).participants.ashai.status, 'asked');
  run.commit(choice); assert.equal(latest(run.state).participants.ashai.status, 'committed');
  run.commit(run.take('NIGHT_WORK_BEGIN'));
  assert.equal(run.state.characters.ashai.area, 'ops_room');
  assert.equal(run.state.characters.ashai.knowledge.some(row => row.factKey.endsWith(':result')), false);
  run.finish();
  assert.ok(run.state.characters.ashai.knowledge.some(row => row.factKey === latest(run.state).result.factKey));
});

test('authored second checks resolve differently with real assistance; absent Ashai is never moved or taught', () => {
  const pairSeed = sample(story => story.needsSecondCheck && story.result.workers.includes('ashai'));
  const pair = started(pairSeed); pair.finish(); assert.equal(latest(pair.state).result.outcome, 'resolved');
  const state = initial(); Object.assign(state.characters.ashai, { location: 'streamliner', area: null,
    activity: 'travelling', journey: { from: 'sanctuary', to: 'mi6' } });
  const before = clone(state.characters.ashai), alone = started(pairSeed, state); alone.finish();
  assert.equal(latest(alone.state).needsSecondCheck, true);
  assert.equal(latest(alone.state).result.outcome, 'deferred');
  assert.equal(latest(alone.state).result.entryStatus, 'awaiting_day_watch');
  assert.deepEqual(state.characters.ashai, before);
  const solo = started(sample(story => !story.needsSecondCheck && story.result.workers.length === 1)); solo.finish();
  assert.equal(latest(solo.state).result.outcome, 'resolved');
});

test('sleeping Ashai is contacted only on the rare seeded branch and can decline when tired', () => {
  const quiet = started(sample(story => !story.participants.ashai));
  const before = clone(quiet.state.characters.ashai); quiet.finish();
  assert.deepEqual(quiet.state.characters.ashai, before);
  const seed = sample(story => story.participants.ashai?.status === 'recovered');
  const state = initial(); state.abilities.actors.ashai.fatigue = 4;
  const tired = started(seed, state); tired.finish();
  assert.equal(latest(state).participants.ashai.status, 'declined');
  assert.equal(state.characters.ashai.activity, 'sleeping');
  assert.equal(state.characters.ashai.knowledge.filter(row => row.factKey === latest(state).result.factKey).length, 0);
});

test('owned work has a real interval, rejects forged/duplicate callbacks, and does not borrow replacement activities', () => {
  const run = started(); const work = run.take('NIGHT_WORK_BEGIN'); run.commit(work);
  const completion = run.take('NIGHT_WORK_END'), story = latest(run.state);
  assert.equal(completion.dueAt - story.workStartedAt, story.workMinutes * MIN);
  assert.equal(nightStoryAvailable(run.state, 'goaden', { atMs: work.dueAt + MIN }), false);
  refused(run.state, { ...completion, id: `${completion.id}/forged` });
  refused(run.state, { ...completion, dueAt: completion.dueAt - MIN });
  refused(run.state, { ...completion, token: 'wrong-token' });
  const replacement = { activity: 'unhurried_time', activityId: 'new:independent-activity', activityUntil: null, area: 'common_room' };
  Object.assign(run.state.characters.goaden, replacement);
  const failed = run.commit(completion);
  assert.equal(failed.event.visibility, 'private'); assert.equal(latest(run.state).result, null);
  run.finish();
  assert.equal(latest(run.state).result.outcome, 'deferred');
  for (const [key, value] of Object.entries(replacement)) assert.equal(run.state.characters.goaden[key], value);
  const committed = clone(run.state); refused(run.state, completion); assert.deepEqual(run.state, committed);
  assert.equal(run.state.nightStories.activeId, null);
});

test('night work costs sleep and fatigue, reserves recovery through breakfast, and settles using elapsed rest', () => {
  const run = started(); const returning = run.take('NIGHT_RETURN'); run.commit(returning);
  const who = returning.actor, story = latest(run.state), part = story.participants[who];
  assert.equal(part.lostSleepMinutes, (returning.dueAt - part.wakeAt) / MIN);
  assert.ok(part.lostSleepMinutes >= 50);
  assert.ok(fatigueAt(run.state, who, returning.dueAt) > 1);
  assert.equal(run.state.characters[who].activity, 'sleeping');
  assert.equal(nightStoryAvailable(run.state, who, { atMs: atLondon(DAY, '08:00') }), false);
  assert.ok(nightRecoveryFor(run.state, who, atLondon(DAY, '08:00')).until > atLondon(DAY, '09:00'));
  assert.equal(nightStoryAvailable(run.state, 'not-a-protagonist', { atMs: END }), true);
  run.finish();
  assert.equal(fatigueAt(run.state, who, END), 0);
  assert.equal(run.state.characters[who].conditions.some(row => row.nightStoryId === story.id), false);
  assert.equal(run.state.characters[who].activity, 'unhurried_time');
  assert.equal(nightRecoveryFor(run.state, who, END), null);
  assert.equal(run.state.nightStories.activeId, null);
  const recovery = run.events.find(event => event.type === 'NIGHT_RECOVERED' && event.participants.includes(who));
  assert.ok(recovery.causedBy.includes(latest(run.state).result.sourceEventId));
});

test('stale return and recovery release their reservation without overwriting a later activity', () => {
  for (const type of ['NIGHT_RETURN', 'NIGHT_RECOVERED']) {
    const run = started(sample(story => !story.participants.ashai));
    const action = run.take(type), who = action.actor;
    Object.assign(run.state.characters[who], { activityId: 'new:later-activity', activity: 'waiting',
      area: 'briefing_room', activityUntil: null });
    const actor = clone(run.state.characters[who]), finalResult = clone(latest(run.state).result);
    run.commit(action); run.finish();
    assert.deepEqual(run.state.characters[who], actor);
    assert.deepEqual(latest(run.state).result, finalResult);
    assert.equal(latest(run.state).participants[who].status, 'interrupted');
    assert.equal(run.state.nightStories.activeId, null);
  }
});

test('later recollection needs a real encounter and explicitly teaches the uninvolved character', () => {
  const run = started(sample(story => !story.participants.ashai)); run.finish();
  const story = latest(run.state), now = END;
  const propose = () => nightEncounterActions({ state: run.state, now, parentActionId: 'encounter', parentEventId: 'event:encounter' });
  assert.deepEqual(propose(), [], 'Ashai is still asleep');
  Object.assign(run.state.characters.ashai, { activity: 'unhurried_time', area: 'common_room' });
  assert.deepEqual(propose(), [], 'same building is not same room');
  run.state.characters.goaden.area = 'common_room';
  run.state.characters.goaden.activity = 'training'; assert.deepEqual(propose(), []);
  run.state.characters.goaden.activity = 'unhurried_time';
  const actions = issue(run.state, propose(), now, 'event:encounter'); assert.equal(actions.length, 1);
  assert.equal(run.state.characters.ashai.knowledge.some(row => row.factKey === story.result.factKey), false);
  const recollection = run.commit(actions[0]);
  const memory = run.state.characters.ashai.knowledge.find(row => row.factKey === story.result.factKey);
  assert.equal(memory.acquisitionEventId, recollection.event.id);
  assert.equal(memory.sourceEventId, story.result.sourceEventId);
  assert.ok(recollection.event.causedBy.includes(story.result.sourceEventId));
  assert.deepEqual(propose(), []); refused(run.state, actions[0], run.seed);
});

test('public story summaries have readable active/recovery states without hidden decisions or fact keys', () => {
  const run = started(), story = latest(run.state);
  let summary = publicNightStories(run.state, story.requestedAt)[0];
  assert.equal(summary.openedAt, story.requestedAt); assert.equal(summary.status, 'active'); assert.ok(summary.description);
  run.commit(run.take('NIGHT_RETURN'));
  summary = publicNightStories(run.state, END)[0]; assert.equal(summary.status, 'active');
  assert.equal(summary.phase, 'recovering'); assert.ok(summary.recovering.length);
  run.finish(); summary = publicNightStories(run.state, END)[0];
  assert.ok(['resolved', 'deferred'].includes(summary.status));
  assert.doesNotMatch(JSON.stringify(summary), /token|factKey|requestFactKey|knowledge|needsSecondCheck|wakeAt|private|source:/i);
  assert.ok(run.events.filter(event => ['NIGHT_CALL', 'NIGHT_WORK_BEGIN', 'NIGHT_WORK_END', 'NIGHT_RETURN'].includes(event.type)
    && event.visibility === 'public').every(event => event.prose && !/bounded|protected|deployment|world unchanged/i.test(event.prose)));
  const before = clone(run.state); publicNightStories(run.state, END); publicNightStories(run.state, END);
  assert.deepEqual(run.state, before);
});

test('dispatch causes are sourced to the actual unresolved institutional result and withdrawn by its successor', () => {
  const state = initial(); state.agendas = { lastResult: { sourceEventId: 'agenda:unresolved', requiresRecheck: true } };
  cause(state, { type: 'AGENDA_RESOLVE', eventId: 'agenda:unrelated' }); assert.deepEqual(state.nightStories.causes, []);
  cause(state, { type: 'AGENDA_RESOLVE', eventId: 'agenda:unresolved' });
  assert.equal(state.nightStories.causes[0].kind, 'dispatch_followup');
  state.agendas.lastResult = { sourceEventId: 'agenda:cleared', requiresRecheck: false };
  cause(state, { type: 'AGENDA_RESOLVE', eventId: 'agenda:cleared' }); assert.deepEqual(state.nightStories.causes, []);
  const run = harness(SEED, state, false); run.openDay(); run.finish(); assert.equal(latest(state), undefined);
});

test('an already-awake response records effort without claiming sleep was interrupted', () => {
  const state = initial();
  for (const actor of Object.values(state.characters)) actor.activity = 'resting';
  const run = started(SEED, state); run.finish();
  assert.ok(Object.values(latest(state).participants).every(part => !part.lostSleepMinutes));
  assert.doesNotMatch(publicNightStories(state, END)[0].description, /lost sleep|sleep it cost/i);
  assert.ok(run.events.filter(event => event.type === 'NIGHT_RETURN' && event.visibility === 'public')
    .every(event => !/call had torn|missing hour/i.test(event.prose)));
});

test('SQLite absence, frequent advances, restart at every stage, duplicate reads and rollback have identical history', t => {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-night-test-')), stores = [];
  t.after(() => {
    for (const world of stores) world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-night-test-'))
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    rmSync(resolved, { recursive: true, force: true });
  });
  const prepared = harness(sample(story => story.participants.ashai?.status === 'recovered')); prepared.openDay();
  const fixture = { worldId: 'night-test', rulesVersion: 'night-v1', startMs: START, endMs: END, maxActions: 100,
    initialState: () => clone(prepared.state), initialActions: () => clone(prepared.queue), reduceAction: reduce,
    publicProjection: snapshot => ({ stories: publicNightStories(snapshot, snapshot.world.resolvedThrough) }) };
  const open = name => { const world = new WorldStore({ dbPath: join(directory, `${name}.sqlite`), seed: prepared.seed, fixture }); stores.push(world); return world; };
  const absent = open('absence'); absent.advance(END); const expected = absent.semanticSnapshot();
  assert.ok(expected.events.length < 20, 'half a fictional day uses meaningful boundaries, not minute stepping');
  const frequent = open('frequent'); for (let target = START + 7 * MIN; target < END; target += 7 * MIN) frequent.advance(target);
  frequent.advance(END); assert.deepEqual(frequent.semanticSnapshot(), expected);
  let observed = open('observed');
  for (const event of expected.events) {
    observed.advance(event.occurredAt); const before = semanticDigest(observed.semanticSnapshot());
    observed.publicProjection(); observed.publicProjection(); observed.advance(event.occurredAt); observed.close();
    observed = open('observed'); assert.equal(semanticDigest(observed.semanticSnapshot()), before);
  }
  observed.advance(END); assert.deepEqual(observed.semanticSnapshot(), expected);
  const rollback = open('rollback'), pristine = rollback.semanticSnapshot();
  assert.throws(() => rollback.advance(END, { failBeforeCommit: true }), /commit/i);
  assert.deepEqual(rollback.semanticSnapshot(), pristine); rollback.advance(END); assert.deepEqual(rollback.semanticSnapshot(), expected);
});
