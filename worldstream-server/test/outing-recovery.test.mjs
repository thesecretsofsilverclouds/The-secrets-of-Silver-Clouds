import test from 'node:test';
import assert from 'node:assert/strict';
import { initialOutingRecovery, outingRecoveryAfterAction, guardOutingRecoveryAction,
  resolveOutingRecoveryAction, assertOutingRecovery, OUTING_RECOVERY_EVENT_TYPES,
  outingRecoveryActorAvailable } from '../src/outing-recovery.mjs';
import { atLondon, MINUTE_MS as MIN } from '../src/time.mjs';
import { ENCOUNTER_REASONS, encounterEligibility } from '../src/places.mjs';

const DAY = '2026-09-05', meetingAt = atLondon(DAY, '13:20'), completionAt = atLondon(DAY, '13:31');
const departureAt = atLondon(DAY, '14:00');
const original = extra => ({ id: `${DAY}/ink-meeting`, day: DAY, dueAt: meetingAt, priority: 40,
  type: 'CROSS_PATHS', actors: ['goaden', 'ashai'], area: 'common_room',
  outingRecovery: { arrangementKey: `${DAY}:ink`, kind: 'ink_visit', venue: 'enchanted_ink',
    departureAt, travelMinutes: 15, duration: 90, ...extra } });

function rig(restored = null) {
  const state = restored ?? { outingRecovery: initialOutingRecovery(), arrangements: {}, encounter: null, facts: {},
    characters: Object.fromEntries(['goaden', 'ashai'].map(id => [id, { id, location: 'mi6', area: 'training',
      activity: 'clearing_training_ground', activityId: 'event:work-start', activitySince: meetingAt - 15 * MIN,
      activityUntil: completionAt, journey: null, knowledge: [] }])) };
  const queue = [], events = [];
  let allowed = true;
  function context(action, now = action.dueAt) {
    const event = { id: `event:${action.id}`, type: action.type, occurredAt: now, causedBy: [], changes: [],
      payload: {}, visibility: 'private', publicDescription: null };
    const ctx = { state, action, now, id: event.id, event, followups: [], ops: {
      setOutingRecovery(value) { event.changes.push({ entity: 'world', field: 'outingRecovery' }); state.outingRecovery = value; },
      outingRecoveryAllowed() { return allowed; },
      useMemory(who, key) { return state.characters[who].knowledge.find(memory => memory.factKey === key); },
      skip(reason) { event.payload = { outcome: 'skipped', reason }; },
    } };
    return ctx;
  }
  function changed(ctx, who, field, value) {
    ctx.event.changes.push({ entity: 'character', id: who, field,
      before: state.characters[who][field], after: value });
    state.characters[who][field] = value;
  }
  function native(ctx) {
    const a = ctx.action, r = state.arrangements[a.arrangementKey];
    if (a.type === 'CROSS_PATHS') {
      const verdict = encounterEligibility(state.characters, { area: a.area, atMs: ctx.now });
      if (!verdict.ok) { ctx.ops.skip(ENCOUNTER_REASONS[verdict.reason]); return; }
      for (const who of ['goaden', 'ashai']) changed(ctx, who, 'area', a.area);
      state.encounter = { area: a.area, until: ctx.now + 25 * MIN, eventId: ctx.id };
      ctx.event.visibility = 'public';
    } else if (a.type === 'OFFER_ACTIVITY') {
      assert.ok(state.encounter, 'ordinary offers require an actual encounter');
      state.arrangements[a.arrangementKey] = { party: ['ashai', 'goaden'], activity: a.activity,
        startAt: a.startAt, duration: a.duration, until: a.startAt + (a.duration + 45) * MIN,
        status: 'offered', public: false, sourceEventId: ctx.id };
    } else if (a.type === 'ACCEPT_ACTIVITY') {
      assert.equal(r?.status, 'offered', 'no consent can precede the offer');
      Object.assign(r, { status: 'accepted', acceptedAt: ctx.now, acceptanceEventId: ctx.id });
    } else if (a.type === 'ANNOUNCE_ARRANGEMENT') {
      assert.equal(r?.status, 'accepted', 'no public promise before consent');
      r.public = true; ctx.event.visibility = 'public';
    } else if (a.type === 'END_ENCOUNTER') state.encounter = null;
  }
  function finish(ctx) {
    outingRecoveryAfterAction(ctx); assertOutingRecovery(state);
    queue.push(...ctx.followups); events.push(ctx.event); return ctx.event;
  }
  function commit(action, now) {
    const ctx = context(action, now);
    if (guardOutingRecoveryAction(ctx)) {
      if (OUTING_RECOVERY_EVENT_TYPES.includes(action.type)) resolveOutingRecoveryAction(ctx);
      else native(ctx);
    }
    return finish(ctx);
  }
  function workEnds({ at = completionAt, type = 'GROUND_WORK_COMPLETED', who = ['goaden', 'ashai'],
    id = `work-end-${at}`, stale = false } = {}) {
    const ctx = context({ id, type, dueAt: at, day: DAY });
    if (stale) ctx.ops.skip('No matching reset to complete');
    else for (const actor of who) {
      changed(ctx, actor, 'activityId', ctx.id); changed(ctx, actor, 'activityUntil', null);
      changed(ctx, actor, 'activity', type === 'BRIEFING_BEGIN' ? 'in_a_briefing' : 'unhurried_time');
    }
    return finish(ctx);
  }
  function through(at) {
    for (;;) {
      queue.sort((a, b) => a.dueAt - b.dueAt || a.priority - b.priority || a.id.localeCompare(b.id));
      if (!queue.length || queue[0].dueAt > at) break;
      commit(queue.shift());
    }
  }
  return { state, queue, events, context, commit, workEnds, through, setAllowed(value) { allowed = value; } };
}
const record = fixture => Object.values(fixture.state.outingRecovery.opportunities)[0];

test('a blocked outing recovers once after real completion and retains its original consent and departure', () => {
  const f = rig(), blocked = f.commit(original());
  assert.equal(blocked.payload.reason, ENCOUNTER_REASONS.busy);
  assert.equal(record(f).status, 'waiting');
  assert.deepEqual(Object.keys(f.state.arrangements), []);
  const work = f.workEnds();
  assert.equal(record(f).status, 'ready');
  assert.equal(f.queue.filter(a => a.type === 'OUTING_RECOVERY_CHECK').length, 1);
  f.through(departureAt);
  assert.equal(record(f).status, 'recovered');
  assert.equal(record(f).attempts, 1);
  const arrangement = f.state.arrangements[`${DAY}:ink`];
  assert.equal(arrangement.status, 'accepted');
  assert.equal(arrangement.startAt, departureAt);
  assert.equal(arrangement.activity, 'ink_visit');
  assert.equal(arrangement.public, true);
  assert.notEqual(arrangement.acceptanceEventId, arrangement.sourceEventId);
  assert.deepEqual(Object.values(f.state.characters).map(w => w.location), ['mi6', 'mi6'], 'recovery itself never travels');
  const retry = f.events.find(e => e.type === 'CROSS_PATHS' && e.visibility === 'public');
  assert.ok(retry.occurredAt > work.occurredAt);
  assert.ok(retry.causedBy.includes(blocked.id));
  assert.ok(retry.causedBy.includes(work.id));
  assert.ok(f.events.filter(e => /OFFER_ACTIVITY|ACCEPT_ACTIVITY|ANNOUNCE_ARRANGEMENT/.test(e.type))
    .every(e => e.occurredAt < departureAt));
});

test('a clock, stale completion, interrupted work and copied retry cannot release the opportunity', () => {
  const f = rig(); f.commit(original());
  const before = structuredClone(f.state);
  f.workEnds({ stale: true });
  assert.deepEqual(f.state, before);
  assert.equal(f.queue.some(a => a.type === 'OUTING_RECOVERY_CHECK'), false);
  f.workEnds({ at: completionAt - MIN, type: 'BRIEFING_BEGIN' });
  assert.equal(record(f).status, 'abandoned');
  const interrupted = structuredClone(f.state);
  f.workEnds({ stale: true, id: 'old-completion' });
  assert.deepEqual(f.state, interrupted);

  const healthy = rig(); healthy.commit(original()); healthy.workEnds();
  const check = healthy.queue.find(a => a.type === 'OUTING_RECOVERY_CHECK');
  const untouched = structuredClone(healthy.state);
  healthy.commit({ ...check, id: 'foreign-but-copied-token' });
  healthy.commit(check, check.dueAt - 1);
  healthy.commit({ ...check, dueAt: check.dueAt - 1 });
  assert.deepEqual(healthy.state, untouched);
  healthy.through(departureAt - MIN);
  const done = structuredClone(healthy.state);
  healthy.commit(check);
  assert.deepEqual(healthy.state, done, 'duplicate checks cannot create another offer');
});

test('restart preserves the wait and frequent observation cannot create or accelerate a retry', () => {
  const frequent = rig(), absent = rig();
  for (const f of [frequent, absent]) f.commit(original());
  for (let i = 1; i < 10; i++) {
    const ctx = frequent.context({ id: `read-${i}`, type: 'READ_ONLY_POLL', dueAt: meetingAt + i * MIN });
    outingRecoveryAfterAction(ctx);
    assert.deepEqual(ctx.event.changes, []); assert.deepEqual(ctx.followups, []);
  }
  const restarted = rig(JSON.parse(JSON.stringify(frequent.state)));
  restarted.queue.push(...JSON.parse(JSON.stringify(frequent.queue)));
  for (const f of [restarted, absent]) { f.workEnds(); f.through(departureAt); }
  assert.deepEqual(restarted.state, absent.state);
  assert.deepEqual(restarted.events, absent.events.slice(1));
});

test('all captured workers must actually finish and retry waits until the old failed proposal chain has ended', () => {
  const f = rig();
  f.state.characters.goaden.activityUntil = meetingAt + MIN / 2;
  f.state.characters.ashai.activityUntil = meetingAt + MIN;
  f.commit(original());
  f.workEnds({ at: meetingAt + MIN / 2, who: ['goaden'], type: 'ACTIVITY_COMPLETE', id: 'goaden-complete' });
  assert.equal(record(f).status, 'waiting');
  f.workEnds({ at: meetingAt + MIN, who: ['ashai'], type: 'ACTIVITY_COMPLETE', id: 'ashai-complete' });
  const check = f.queue.find(a => a.type === 'OUTING_RECOVERY_CHECK');
  assert.ok(check.dueAt > meetingAt + 4 * MIN, 'the old END_ENCOUNTER must run first');
  f.through(departureAt);
  assert.equal(record(f).status, 'recovered');
});

test('missed completion expires at original departure without manufacturing a late plan', () => {
  const f = rig(); f.commit(original()); f.through(departureAt);
  assert.equal(record(f).status, 'expired');
  assert.deepEqual(f.state.arrangements, {});
  f.workEnds({ at: departureAt + MIN });
  assert.equal(record(f).status, 'expired');
  assert.equal(f.queue.some(a => a.type === 'OUTING_RECOVERY_CHECK'), false);
  const late = rig();
  late.state.characters.ashai.activityUntil = departureAt - 3 * MIN;
  late.commit(original());
  assert.equal(record(late), undefined, 'do not open a window already too short to use');
});

test('expired or unknown private knowledge cannot become a recovered offer', () => {
  const unknown = rig(); unknown.commit(original({ requiredFact: 'private-prerequisite' }));
  assert.equal(record(unknown), undefined);
  const f = rig(), key = 'private-prerequisite';
  f.state.facts[key] = { key, createdAt: meetingAt - MIN, validUntil: completionAt,
    sourceEventId: 'event:known-source' };
  f.state.characters.ashai.knowledge = [{ factKey: key, sourceEventId: 'event:known-source',
    learnedAt: meetingAt - MIN, validUntil: completionAt }];
  f.commit(original({ requiredFact: key })); f.workEnds(); f.through(departureAt);
  assert.equal(record(f).status, 'abandoned');
  assert.deepEqual(f.state.arrangements, {});
  assert.equal(f.state.characters.goaden.knowledge.length, 0);
  assert.ok(f.events.every(e => !e.publicDescription?.includes(key)));
});

test('current venue permission, another commitment and changed location still veto recovery', () => {
  for (const change of [f => f.setAllowed(false),
    f => { f.state.characters.ashai.location = 'sanctuary'; },
    f => { f.state.arrangements.other = { party: ['goaden'], status: 'accepted',
      startAt: completionAt, until: departureAt + MIN }; }]) {
    const f = rig(); f.commit(original()); f.workEnds(); change(f); f.through(departureAt);
    assert.equal(record(f).status, 'abandoned');
    assert.equal(f.state.arrangements[`${DAY}:ink`], undefined);
    assert.equal(f.events.some(e => e.type === 'CROSS_PATHS' && e.visibility === 'public'), false);
  }
});

test('native retry actions reject tampering and cannot clear a newer encounter', () => {
  const f = rig(); f.commit(original()); f.workEnds();
  f.through(completionAt + 1);
  const meet = f.queue.find(a => a.type === 'CROSS_PATHS');
  const before = structuredClone(f.state);
  f.commit({ ...meet, actors: ['goaden'] });
  assert.deepEqual(f.state, before);
  f.through(completionAt + 3 * MIN);
  f.state.encounter = { area: 'common_room', until: departureAt, eventId: 'event:another-meeting' };
  f.through(departureAt);
  assert.equal(record(f).status, 'abandoned');
  assert.equal(f.state.encounter.eventId, 'event:another-meeting');
});

test('the tiny owned proposal interval blocks opportunistic attention without reserving the whole outing', () => {
  const f = rig(); f.commit(original());
  assert.equal(outingRecoveryActorAvailable(f.state, 'goaden', { atMs: meetingAt }), true);
  f.workEnds();
  assert.equal(outingRecoveryActorAvailable(f.state, 'goaden', { atMs: completionAt + 1 }), false);
  assert.equal(outingRecoveryActorAvailable(f.state, 'ashai', { atMs: completionAt + 1 }), false);
  f.through(completionAt + 5 * MIN);
  assert.equal(record(f).status, 'recovered');
  assert.equal(outingRecoveryActorAvailable(f.state, 'goaden', { atMs: completionAt + 5 * MIN }), true);
  assert.equal(f.state.arrangements[`${DAY}:ink`].status, 'accepted');
});
