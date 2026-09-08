import test from 'node:test';
import assert from 'node:assert/strict';
import { initialAbilities, abilityActivityChanged, fatigueAt, abilityDayActions,
  resolveAbilityAction, canEnterAbilityArea, assertAbilities } from '../src/abilities.mjs';
import { atLondon, nextLondonDay, MINUTE_MS as MIN } from '../src/time.mjs';

function rig() {
  const state = { abilities: initialAbilities(), weather: { code: 'cloudy' }, facts: {},
    characters: Object.fromEntries(['goaden', 'ashai'].map(id => [id, { id,
      location: 'mi6', area: 'common_room', activity: 'unhurried_time', activityId: 'initial',
      activitySince: 0, activityUntil: null, journey: null, knowledge: [] }])) };
  const queue = [], events = [];
  function context(action) {
    const event = { id: `event:${action.id}`, type: action.type, occurredAt: action.dueAt,
      causedBy: [], changes: [], visibility: 'private', publicDescription: null, payload: {} };
    const ctx = { state, action, now: action.dueAt, id: event.id, event, followups: [], seed: 'test' };
    ctx.ops = {
      setAbilities(value) { event.changes.push({ field: 'abilities' }); state.abilities = value; },
      setActor(who, field, value) { event.changes.push({ who, field }); state.characters[who][field] = value; },
      createFact(key, kind, subject, value, validUntil) {
        return state.facts[key] = { key, kind, subject, value, validUntil, sourceEventId: ctx.id, createdAt: ctx.now };
      },
      learn(who, fact, provenance) {
        state.characters[who].knowledge.push({ factKey: fact.key, sourceEventId: fact.sourceEventId,
          acquisitionEventId: ctx.id, learnedAt: ctx.now, provenance });
      },
      activity(who, label, duration, area) {
        assert.equal(canEnterAbilityArea(state, who, 'mi6', area, { activity: label }), true,
          `${who} illegally entered restricted ${area} for ${label}`);
        abilityActivityChanged(ctx, who, label, duration, area);
        Object.assign(state.characters[who], { activity: label, activityId: ctx.id,
          activitySince: ctx.now, activityUntil: duration ? ctx.now + duration * MIN : null,
          location: 'mi6', area });
      },
      publish(text) { event.visibility = 'public'; event.publicDescription = text; },
      skip(reason) { event.payload = { outcome: 'skipped', reason }; },
    };
    return ctx;
  }
  function commit(action) {
    const ctx = context(action);
    resolveAbilityAction(ctx);
    assertAbilities(state);
    queue.push(...ctx.followups); events.push(ctx.event);
    return ctx.event;
  }
  function transition(who, label, time, duration = null, area = 'common_room', id = `${who}/${label}/${time}`) {
    const ctx = context({ id, type: 'ordinary_activity', dueAt: time });
    ctx.ops.activity(who, label, duration, area);
    queue.push(...ctx.followups); events.push(ctx.event);
    assertAbilities(state);
    return ctx.event;
  }
  function through(time) {
    for (;;) {
      queue.sort((a, b) => a.dueAt - b.dueAt || a.priority - b.priority || a.id.localeCompare(b.id));
      if (!queue.length || queue[0].dueAt > time) break;
      commit(queue.shift());
    }
  }
  return { state, queue, events, commit, context, transition, through };
}

let DAY = '2026-09-05';
while (!abilityDayActions({ day: DAY }).some(action => action.type === 'GROUND_RESTRICTION')) DAY = nextLondonDay(DAY);
const scheduled = type => abilityDayActions({ day: DAY }).find(action => action.type === type);
const restrict = fixture => fixture.commit(scheduled('GROUND_RESTRICTION'));
const work = fixture => fixture.commit(scheduled('GROUND_WORK_OPPORTUNITY'));

test('elapsed recovery survives midnight and JSON restart without minute stepping or midnight reset', () => {
  const f = rig();
  f.state.abilities.actors.goaden.fatigue = 3;
  const begin = atLondon(DAY, '23:30');
  f.transition('goaden', 'sleeping', begin, null, 'quarters');
  assert.equal(f.queue.length, 1, 'a whole recovery should need one owned settlement, not minute ticks');
  const middle = atLondon(nextLondonDay(DAY), '00:15');
  assert.equal(fatigueAt(f.state, 'goaden', middle), 2);
  const restored = JSON.parse(JSON.stringify(f.state));
  assert.equal(fatigueAt(restored, 'goaden', middle), 2);
  assert.equal(restored.abilities.actors.goaden.track.startedAt, begin);
  f.through(begin + 135 * MIN);
  assert.equal(f.state.abilities.actors.goaden.fatigue, 0);
  assert.equal(f.state.abilities.actors.goaden.track, null);
});

test('changing activity settles only elapsed recovery and fences the old settlement', () => {
  const f = rig();
  f.state.abilities.actors.goaden.fatigue = 3;
  const begin = atLondon(DAY, '23:30');
  f.transition('goaden', 'sleeping', begin, null, 'quarters');
  const old = structuredClone(f.queue[0]);
  f.transition('goaden', 'on_call', begin + 20 * MIN, 60, 'ops_room');
  assert.equal(f.state.abilities.actors.goaden.fatigue, 2.555556);
  const before = structuredClone(f.state);
  const stale = f.commit(old);
  assert.equal(stale.payload.outcome, 'skipped');
  assert.deepEqual(stale.changes, []);
  assert.deepEqual(f.state, before);
});

test('training effort changes the later reset duration and exhaustion removes the action', () => {
  const rested = rig(), tired = rig();
  restrict(rested); restrict(tired);
  const begin = atLondon(DAY, '09:00');
  for (const who of ['goaden', 'ashai']) {
    tired.transition(who, 'training', begin, 50, 'indoor_yard');
    tired.transition(who, 'unhurried_time', begin + 50 * MIN, null, 'common_room');
  }
  work(rested); work(tired);
  assert.equal(tired.state.abilities.actors.goaden.fatigue, 2);
  assert.ok(tired.state.abilities.trainingGround.work.endsAt > rested.state.abilities.trainingGround.work.endsAt);
  const exhausted = rig(); restrict(exhausted);
  for (const who of ['goaden', 'ashai']) exhausted.state.abilities.actors[who].fatigue = 3;
  assert.equal(work(exhausted).payload.outcome, 'skipped');
  assert.equal(exhausted.state.abilities.trainingGround.status, 'restricted');
});

test('weather, actual preparation and cooperation alter how the ground is resolved', () => {
  const dry = rig(), rain = rig(), storm = rig(), solo = rig(), prepared = rig();
  for (const f of [dry, rain, storm, solo, prepared]) restrict(f);
  rain.state.weather.code = 'light_rain'; storm.state.weather.code = 'storm';
  solo.state.characters.ashai.activity = 'in_a_briefing';
  prepared.commit(scheduled('GROUND_PREPARATION'));
  prepared.through(atLondon(DAY, '10:00'));
  assert.equal(prepared.state.abilities.trainingGround.preparation.status, 'completed');
  for (const f of [dry, rain, solo, prepared]) work(f);
  const blocked = work(storm);
  assert.equal(blocked.payload.method, 'sheltered_wait');
  assert.equal(storm.state.abilities.trainingGround.status, 'restricted');
  const duration = f => f.state.abilities.trainingGround.work.endsAt - f.state.abilities.trainingGround.work.startedAt;
  assert.ok(duration(solo) > duration(dry), 'cooperation must change the reserved duration');
  assert.ok(duration(prepared) < duration(dry), 'completed preparation must change the reserved duration');
  assert.ok(duration(rain) > duration(dry), 'wet footing must change the reserved duration');
  assert.equal(solo.state.abilities.trainingGround.work.method, 'manual_reset');
  assert.equal(dry.state.abilities.trainingGround.work.method, 'cooperative_reset');
});

test('the room stays restricted across time and restarts until an owned clearing event completes', () => {
  const f = rig(); const closure = restrict(f);
  assert.equal(canEnterAbilityArea(f.state, 'goaden', 'mi6', 'training', { activity: 'training' }), false);
  assert.equal(canEnterAbilityArea(f.state, 'goaden', 'mi6', 'indoor_yard', { activity: 'training' }), true);
  assert.equal(canEnterAbilityArea(f.state, 'goaden', 'mi6', 'basement', { activity: 'unhurried_time' }), false);
  assert.equal(JSON.parse(JSON.stringify(f.state)).abilities.trainingGround.restriction.sourceEventId, closure.id);
  const before = structuredClone(f.state);
  // A read a week later cannot act as the clearing event.
  fatigueAt(f.state, 'goaden', atLondon(nextLondonDay(DAY), '12:00'));
  assert.deepEqual(f.state, before);
  const begun = work(f); const end = f.state.abilities.trainingGround.work.endsAt;
  const completion = f.queue.find(action => action.type === 'GROUND_WORK_COMPLETED');
  const forged = f.commit({ ...completion, id: `${completion.id}/foreign` });
  assert.equal(forged.payload.outcome, 'skipped');
  assert.equal(f.state.abilities.trainingGround.status, 'work_in_progress');
  f.through(end);
  assert.equal(f.state.abilities.trainingGround.status, 'open');
  const clearing = f.events.find(event => event.type === 'GROUND_WORK_COMPLETED' && event.visibility === 'public');
  assert.ok(clearing.causedBy.includes(closure.id));
  assert.ok(clearing.causedBy.includes(begun.id));
  assert.equal(f.state.abilities.trainingGround.lastClearEventId, clearing.id);
  assert.equal(canEnterAbilityArea(f.state, 'goaden', 'mi6', 'training', { activity: 'training' }), true);
  for (const who of ['goaden', 'ashai']) assert.ok(f.state.characters[who].knowledge.some(item => item.sourceEventId === clearing.id));
});

test('interrupting either worker stops the shared work and its stale completion cannot reopen the ground', () => {
  const f = rig(); restrict(f); work(f);
  const ground = structuredClone(f.state.abilities.trainingGround);
  f.transition('goaden', 'on_call', ground.work.startedAt + 5 * MIN, 30, 'ops_room');
  assert.equal(f.state.abilities.trainingGround.status, 'restricted');
  f.through(ground.work.startedAt + 5 * MIN + 1);
  assert.equal(f.state.characters.ashai.activity, 'unhurried_time', 'the remaining worker cannot be stranded in interrupted work');
  assert.equal(f.state.characters.ashai.area, 'indoor_yard');
  f.through(ground.work.endsAt);
  assert.equal(f.state.abilities.trainingGround.status, 'restricted');
  assert.equal(f.state.abilities.trainingGround.lastClearEventId, null);
  const completion = f.events.find(event => event.type === 'GROUND_WORK_COMPLETED');
  assert.equal(completion.payload.outcome, 'skipped');
  assert.equal(Object.values(f.state.facts).some(fact => fact.kind === 'training_ground_cleared'), false);
});

test('calendar restrictions and opportunities reject changed priority, actors or timestamps without mutation', () => {
  for (const change of [{ priority: 0 }, { actor: 'goaden' }, { actors: ['ashai'] },
    { dueAt: scheduled('GROUND_RESTRICTION').dueAt + 1 }]) {
    const f = rig(), before = structuredClone(f.state);
    const rejected = f.commit({ ...scheduled('GROUND_RESTRICTION'), ...change });
    assert.equal(rejected.payload.outcome, 'skipped');
    assert.deepEqual(rejected.changes, []);
    assert.deepEqual(f.state, before);
  }
});
