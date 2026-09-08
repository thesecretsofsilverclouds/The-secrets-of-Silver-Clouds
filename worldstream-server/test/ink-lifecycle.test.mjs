import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { createFixture, DEFAULT_SEED, knowsFact, publicProjection } from '../src/fixture.mjs';
import { INK_ACTIVITY, INK_WORK_MS, inkVisitActions } from '../src/story-effects.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { applyChange } from '../src/ledger.mjs';

const START = atLondon('2026-09-04', '00:00');
const END = atLondon('2026-12-01', '00:00');
// This v21 trajectory actually receives both a recall and a later available
// return slot. New commitments can legitimately remove an older pinned visit.
const INTERRUPTED_SEED = 'phase1-interruption-6';
const definition = createFixture({ startMs: START });
const samples = new Map();
const accepted = (snapshot, type) => snapshot.events.filter(event => event.type === type && event.visibility === 'public');

function sample(seed = DEFAULT_SEED) {
  if (!samples.has(seed)) {
    const world = openWorld({ dbPath: ':memory:', seed, startMs: START });
    try {
      world.advance(END);
      samples.set(seed, world.semanticSnapshot());
    } finally { world.close(); }
  }
  return samples.get(seed);
}

// The ledger already records reversible changes. Reconstruct the state at a
// recorded boundary to inspect every Ink stage without replaying months for
// each assertion. No presentation callback or model participates in this read.
function atBoundary(snapshot, through) {
  const { events, pendingActions, ...savedState } = snapshot;
  const copy = structuredClone(savedState);
  for (const event of [...events].reverse()) {
    if (event.occurredAt <= through) continue;
    for (const change of [...event.changes].reverse()) {
      const target = change.entity === 'character' ? copy.characters[change.id]
        : change.entity === 'relationship' ? copy.relationships.find(row => `${row.from}->${row.to}` === change.id)
          : copy;
      assert.ok(target, `unknown ledger target ${change.entity}/${change.id}`);
      applyChange(target, change, 'before');
    }
  }
  copy.events = events.filter(event => event.occurredAt <= through);
  copy.pendingActions = [];
  copy.world.resolvedThrough = through;
  return copy;
}

function fixtureVisit(time = '14:00') {
  const state = definition.initialState();
  const now = atLondon('2026-09-04', time);
  const arrangementKey = 'test:agreed-ink-visit';
  state.arrangements[arrangementKey] = { status: 'started', activity: 'ink_visit',
    party: ['goaden', 'ashai'], startAt: now - 30 * MIN, until: now + 90 * MIN,
    acceptanceEventId: 'test:accepted-visit', startedEventId: 'test:started-visit' };
  for (const who of Object.values(state.characters)) Object.assign(who, {
    location: 'enchanted_ink', area: 'venue', activity: 'visiting_enchanted_ink',
    activitySince: now, activityUntil: now + 55 * MIN,
  });
  let initial;
  // Ask the actual visit policy for a released opportunity. Test setup does
  // not bypass or reimplement the deterministic availability decision.
  for (let i = 0; i < 100 && !initial; i++) {
    const actions = inkVisitActions({ state, day: londonDate(now), now, seed: DEFAULT_SEED,
      parentActionId: `test:visit-${i}`, arrangementKey, returnMinutes: 15 });
    if (actions[0]?.releaseSlot) initial = actions[0];
  }
  assert.ok(initial, 'test visit search found no released opportunity');
  const queue = [initial];
  const run = action => definition.reduceAction(state, action, DEFAULT_SEED);
  const take = type => {
    for (;;) {
      queue.sort((a, b) => a.dueAt - b.dueAt || a.priority - b.priority || a.id.localeCompare(b.id));
      const action = queue.shift();
      assert.ok(action, `no queued ${type}`);
      if (action.type === type) return action;
      const outcome = run(action);
      assert.equal(outcome.event.visibility, 'public', `${action.type} unexpectedly refused`);
      queue.push(...outcome.followups);
    }
  };
  const commit = action => {
    const result = run(action);
    queue.push(...result.followups);
    return result;
  };
  return { state, queue, run, take, commit };
}

function refused(state, action) {
  const before = structuredClone(state);
  const output = definition.reduceAction(state, action, DEFAULT_SEED);
  assert.equal(output.event.visibility, 'private');
  assert.equal(output.event.payload.outcome, 'skipped');
  assert.equal(output.event.publicDescription, null);
  assert.deepEqual(output.event.changes, []);
  assert.deepEqual(state, before, 'refused appointment action changed canonical state');
  return output;
}

test('the actual calendar turns one choice into one completed result with event-linked knowledge', () => {
  const snapshot = sample();
  const events = ['INK_DESIGN_CHOSEN', 'INK_SLOT_RELEASED', 'INK_APPOINTMENT_BOOKED',
    'INK_APPOINTMENT_STARTED', 'INK_APPOINTMENT_COMPLETED'].map(type => {
    const matches = accepted(snapshot, type);
    assert.equal(matches.length, 1, `${type} repeated its first milestone`);
    return matches[0];
  });
  for (let i = 1; i < events.length; i++) assert.ok(events[i].occurredAt > events[i - 1].occurredAt);
  assert.equal(events[4].occurredAt - events[3].occurredAt, INK_WORK_MS);
  const ink = snapshot.storyEffects.ink;
  assert.equal(ink.result.sourceEventId, events[4].id);
  assert.equal(ink.result.cosmeticOnly, true);
  assert.equal(ink.workMs, INK_WORK_MS);
  assert.equal(snapshot.facts[ink.result.factKey].sourceEventId, events[4].id);
  for (const who of ['goaden', 'ashai']) {
    const memories = snapshot.characters[who].knowledge.filter(memory => memory.factKey === ink.result.factKey);
    assert.equal(memories.length, 1);
    assert.equal(memories[0].sourceEventId, events[4].id);
    assert.equal(memories[0].acquisitionEventId, events[4].id);
    assert.equal(memories[0].learnedAt, events[4].occurredAt);
    assert.ok(events[4].participants.includes(who));
  }
  assert.equal(ink.appointments[ink.result.appointmentId].status, 'completed');
  assert.ok(snapshot.events.some(event => event.type === 'VENUE_SCENE' && event.occurredAt > events[4].occurredAt),
    'the sample must include later visits, not stop at the first success');
});

test('choosing, booking and partial work never project a finished tattoo or its private records', () => {
  const snapshot = sample();
  const completion = accepted(snapshot, 'INK_APPOINTMENT_COMPLETED')[0];
  const boundaries = snapshot.events.filter(event => event.type.startsWith('INK_') && event.occurredAt < completion.occurredAt)
    .map(event => event.occurredAt).concat(completion.occurredAt - 1);
  for (const through of boundaries) {
    const state = atBoundary(snapshot, through);
    assert.equal(state.storyEffects.ink.result, null);
    assert.deepEqual(publicProjection(state).storyResults, []);
    for (const who of Object.values(state.characters)) {
      assert.equal(who.knowledge.some(memory => memory.factKey.startsWith('ink:result:')), false);
    }
  }
  const projected = publicProjection(snapshot);
  assert.equal(projected.storyResults.length, 1);
  assert.equal(projected.storyResults[0].eventId, completion.id);
  const publicText = JSON.stringify(projected);
  for (const privateValue of [snapshot.storyEffects.ink.result.factKey,
    ...Object.values(snapshot.storyEffects.ink.appointments).map(appointment => appointment.token)]) {
    assert.equal(publicText.includes(privateValue), false, 'public projection leaked an internal causal identifier');
  }
  assert.equal(Object.hasOwn(projected, 'storyEffects'), false);
  assert.equal(Object.hasOwn(projected, 'facts'), false);
});

test('a natural recall interrupts work, stale completion fails, and a later visit finishes only the remainder', () => {
  const snapshot = sample(INTERRUPTED_SEED);
  const interruptions = accepted(snapshot, 'INK_APPOINTMENT_INTERRUPTED');
  assert.ok(interruptions.length > 0, 'the pinned calendar no longer exercises a genuine recall');
  assert.equal(accepted(snapshot, 'INK_DESIGN_CHOSEN').length, 1);
  assert.equal(accepted(snapshot, 'INK_APPOINTMENT_COMPLETED').length, 1);
  const ink = snapshot.storyEffects.ink;
  const interrupted = Object.values(ink.appointments).find(appointment => appointment.status === 'interrupted');
  assert.ok(interrupted.workAfterMs > 0 && interrupted.workAfterMs < INK_WORK_MS);
  const beforeLaterResult = atBoundary(snapshot, interruptions[0].occurredAt);
  assert.equal(beforeLaterResult.storyEffects.ink.result, null);
  assert.deepEqual(publicProjection(beforeLaterResult).storyResults, []);
  const oldCompletion = snapshot.events.find(event => event.type === 'INK_APPOINTMENT_COMPLETED'
    && event.occurredAt === interrupted.endAt);
  assert.ok(oldCompletion);
  assert.equal(oldCompletion.visibility, 'private');
  assert.equal(oldCompletion.payload.outcome, 'skipped');
  assert.deepEqual(oldCompletion.changes, []);
  const completed = ink.appointments[ink.result.appointmentId];
  assert.equal(completed.workBeforeMs, interrupted.workAfterMs);
  assert.equal(completed.endAt - completed.startAt, INK_WORK_MS - interrupted.workAfterMs);
  const resumedBooking = snapshot.events.find(event => event.id === completed.bookingEventId);
  assert.equal(resumedBooking.payload.lines, undefined, 'a resumed visit replayed the full-hour first booking');
  assert.match(resumedBooking.publicDescription, /finish the prowler tattoo/);
  assert.ok(resumedBooking.causedBy.includes(interrupted.interruptionEventId));
});

test('a process restart preserves an appointment in progress and its queued completion', t => {
  const snapshot = sample();
  const start = accepted(snapshot, 'INK_APPOINTMENT_STARTED')[0];
  const completion = accepted(snapshot, 'INK_APPOINTMENT_COMPLETED')[0];
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-ink-restart-'));
  const path = join(directory, 'world.sqlite');
  const worlds = [];
  t.after(() => {
    for (const world of worlds) world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-ink-restart-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  let world = openWorld({ dbPath: path, seed: DEFAULT_SEED, startMs: START });
  worlds.push(world);
  world.advance(start.occurredAt + 20 * MIN);
  const paused = world.semanticSnapshot();
  assert.equal(paused.characters.goaden.activity, INK_ACTIVITY);
  assert.equal(paused.characters.goaden.activityUntil, completion.occurredAt);
  assert.ok(paused.pendingActions.some(action => action.type === 'INK_APPOINTMENT_COMPLETED'));
  assert.equal(paused.storyEffects.ink.result, null);
  world.close();
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {openWorld,semanticDigest} from ${JSON.stringify(new URL('../src/world.mjs', import.meta.url).href)};
const world=openWorld({dbPath:process.argv[1]});
console.log(semanticDigest(world.semanticSnapshot()));
world.advance(Number(process.argv[2]));
world.close();`, path, String(END)], { encoding: 'utf8', timeout: 120_000, windowsHide: true });
  // This child also resolves the remainder of an 88-day audit while other
  // test files run. Keep a finite process guard without treating its old
  // thirty-second wall-clock allowance as an appointment/continuity assertion.
  assert.equal(child.status, 0, child.error?.message || child.stderr);
  assert.equal(child.stdout.trim(), semanticDigest(paused), 'reopening changed the saved state or queue');
  world = openWorld({ dbPath: path });
  worlds.push(world);
  assert.equal(semanticDigest(world.semanticSnapshot()), semanticDigest(snapshot));
});

test('duplicate advances and repeated projections cannot book, complete or learn anything twice', () => {
  const world = openWorld({ dbPath: ':memory:', seed: DEFAULT_SEED, startMs: START });
  try {
    const completedAt = sample().storyEffects.ink.result.completedAt;
    world.advance(completedAt);
    const digest = semanticDigest(world.semanticSnapshot());
    const projection = world.publicProjection();
    for (let i = 0; i < 5; i++) {
      assert.equal(world.advance(completedAt).processedActions, 0);
      assert.equal(world.advance(completedAt - 1).processedActions, 0);
      assert.deepEqual(world.publicProjection(), projection);
    }
    assert.equal(semanticDigest(world.semanticSnapshot()), digest);
  } finally { world.close(); }
});

test('booking requires a real unexpired released slot and cannot be claimed twice', () => {
  const visit = fixtureVisit();
  const book = visit.take('INK_APPOINTMENT_BOOKED');
  refused(structuredClone(visit.state), { ...book, slotId: 'made-up-slot' });
  const slot = visit.state.storyEffects.ink.slots[book.slotId];
  refused(structuredClone(visit.state), { ...book, dueAt: slot.expiresAt });
  const ignorant = structuredClone(visit.state);
  ignorant.characters.ashai.knowledge = ignorant.characters.ashai.knowledge.filter(memory => memory.factKey !== slot.factKey);
  refused(ignorant, book);
  const success = visit.commit(book);
  assert.equal(success.event.visibility, 'public');
  refused(visit.state, { ...book, id: `${book.id}/duplicate` });
  assert.equal(Object.keys(visit.state.storyEffects.ink.appointments).length, 1);
});

test('an appointment cannot start or finish with fabricated tokens, no booking, or insufficient work', () => {
  const visit = fixtureVisit();
  const start = visit.take('INK_APPOINTMENT_STARTED');
  const empty = fixtureVisit();
  refused(empty.state, start);
  refused(structuredClone(visit.state), { ...start, appointmentToken: 'wrong-owner-token' });
  refused(structuredClone(visit.state), { ...start, dueAt: start.dueAt + MIN });
  visit.commit(start);
  const complete = visit.take('INK_APPOINTMENT_COMPLETED');
  refused(structuredClone(visit.state), { ...complete, appointmentToken: 'wrong-owner-token' });
  refused(structuredClone(visit.state), { ...complete, startEventId: 'not-this-start' });
  refused(structuredClone(visit.state), { ...complete, dueAt: complete.dueAt - MIN });
  assert.equal(visit.state.storyEffects.ink.result, null);
});

test('the parlour cannot release a slot that would finish after opening hours', () => {
  const visit = fixtureVisit();
  const release = visit.take('INK_SLOT_RELEASED');
  refused(visit.state, { ...release, dueAt: atLondon(release.day, '16:30') });
  assert.deepEqual(visit.state.storyEffects.ink.slots, {});
});

test('an absent Ashai learns nothing until an actual later encounter with the finished result', () => {
  const visit = fixtureVisit();
  const complete = visit.take('INK_APPOINTMENT_COMPLETED');
  Object.assign(visit.state.characters.ashai, { location: 'mi6', area: 'common_room', activity: 'unhurried_time' });
  const finished = visit.commit(complete);
  assert.equal(finished.event.visibility, 'public');
  assert.deepEqual(finished.event.participants, ['goaden']);
  const result = visit.state.storyEffects.ink.result;
  assert.ok(knowsFact(visit.state.characters.goaden, result.factKey, complete.dueAt));
  assert.equal(Boolean(knowsFact(visit.state.characters.ashai, result.factKey, complete.dueAt)), false);
  const notice = { id: 'test:notice-result', type: 'INK_RESULT_NOTICED', actors: ['goaden', 'ashai'],
    day: complete.day, dueAt: complete.dueAt + MIN, priority: 25 };
  refused(visit.state, notice);
  Object.assign(visit.state.characters.ashai, { location: 'enchanted_ink', area: 'venue' });
  const learned = visit.commit(notice);
  const memory = knowsFact(visit.state.characters.ashai, result.factKey, notice.dueAt);
  assert.equal(memory.sourceEventId, result.sourceEventId);
  assert.equal(memory.acquisitionEventId, learned.event.id);
  assert.equal(memory.learnedAt, notice.dueAt);
  assert.equal(Boolean(knowsFact(visit.state.characters.ashai, result.factKey, notice.dueAt - 1)), false);
  refused(visit.state, { ...notice, id: 'test:notice-again', dueAt: notice.dueAt + MIN });
});

test('the persisted cosmetic result changes neither canonical bodies nor powers', () => {
  const initial = definition.initialState();
  for (const snapshot of [sample(), sample(INTERRUPTED_SEED)]) {
    for (const who of ['goaden', 'ashai']) {
      for (const field of ['body', 'powers', 'abilities']) {
        assert.deepEqual(snapshot.characters[who][field], initial.characters[who][field]);
      }
    }
    for (const event of snapshot.events.filter(event => event.type.startsWith('INK_'))) {
      assert.equal(event.changes.some(change => change.entity === 'character'
        && ['body', 'powers', 'abilities'].includes(change.field)), false);
    }
    assert.equal(snapshot.storyEffects.ink.result.cosmeticOnly, true);
  }
});

test('an authentic failed start releases the active reservation instead of stranding a booking', () => {
  const visit = fixtureVisit();
  const start = visit.take('INK_APPOINTMENT_STARTED');
  const appointment = visit.state.storyEffects.ink.appointments[start.appointmentId];
  assert.equal(start.id, appointment.startActionId);
  // A copied token on a different action cannot cancel the real reservation.
  refused(structuredClone(visit.state), { ...start, id: `${start.id}/forged` });
  visit.state.characters.goaden.knowledge = visit.state.characters.goaden.knowledge
    .filter(memory => memory.factKey !== appointment.factKey);
  const outcome = visit.commit(start);
  assert.equal(outcome.event.payload.outcome, 'skipped');
  assert.equal(outcome.event.visibility, 'private');
  const interrupted = visit.state.storyEffects.ink.appointments[start.appointmentId];
  assert.equal(interrupted.status, 'interrupted');
  assert.equal(interrupted.interruptionEventId, outcome.event.id);
  assert.equal(interrupted.reason, 'reserved_start_unavailable');
  assert.equal(interrupted.workAfterMs, 0);
  assert.equal(visit.state.storyEffects.ink.result, null);
  assert.notEqual(visit.state.characters.goaden.activity, INK_ACTIVITY);
  const notice = outcome.followups.find(action => action.type === 'INK_APPOINTMENT_INTERRUPTED');
  assert.ok(notice && notice.dueAt > start.dueAt);
  assert.ok(outcome.followups.some(action => action.type === 'TRAVEL_DEPART' && action.dueAt > start.dueAt));
  assert.equal(visit.commit(notice).event.visibility, 'public');
  refused(visit.state, start);
});

test('an authentic failed completion interrupts without banking unverifiable work or granting a result', () => {
  const visit = fixtureVisit();
  const complete = visit.take('INK_APPOINTMENT_COMPLETED');
  const appointment = visit.state.storyEffects.ink.appointments[complete.appointmentId];
  assert.equal(complete.id, appointment.completionActionId);
  refused(structuredClone(visit.state), { ...complete, id: `${complete.id}/forged` });
  // Simulate an inconsistent imported position, bypassing the normal departure
  // hook. The authentic due action must recover conservatively, not assert an
  // hour in the chair merely because the clock reached its scheduled end.
  Object.assign(visit.state.characters.goaden, {
    location: 'mi6', area: 'common_room', activity: 'unhurried_time',
  });
  const outcome = visit.commit(complete);
  assert.equal(outcome.event.payload.outcome, 'skipped');
  assert.equal(outcome.event.visibility, 'private');
  const interrupted = visit.state.storyEffects.ink.appointments[complete.appointmentId];
  assert.equal(interrupted.status, 'interrupted');
  assert.equal(interrupted.reason, 'reserved_completion_unavailable');
  assert.equal(interrupted.workAfterMs, appointment.workBeforeMs);
  assert.equal(visit.state.storyEffects.ink.workMs, appointment.workBeforeMs);
  assert.equal(visit.state.storyEffects.ink.result, null);
  assert.equal(Object.values(visit.state.facts).some(fact => fact.kind === 'ink_result'), false);
  assert.ok(outcome.followups.some(action => action.type === 'INK_APPOINTMENT_INTERRUPTED'));
  refused(visit.state, complete);
});

test('a valid reserved hour can complete exactly at the 17:00 closing boundary', () => {
  const visit = fixtureVisit('15:55');
  const complete = visit.take('INK_APPOINTMENT_COMPLETED');
  assert.equal(complete.dueAt, atLondon('2026-09-04', '17:00'));
  const appointment = visit.state.storyEffects.ink.appointments[complete.appointmentId];
  assert.equal(appointment.endAt - appointment.startAt, INK_WORK_MS);
  const outcome = visit.commit(complete);
  assert.equal(outcome.event.visibility, 'public');
  assert.equal(visit.state.storyEffects.ink.result.completedAt, complete.dueAt);
  assert.equal(visit.state.storyEffects.ink.workMs, INK_WORK_MS);
  assert.equal(visit.state.storyEffects.ink.appointments[complete.appointmentId].status, 'completed');
  assert.equal(visit.state.characters.goaden.activity, 'unhurried_time');
});

test('early acknowledgement waits for an active Ink reservation and awards no trust yet', () => {
  for (const inProgress of [false, true]) {
    const visit = fixtureVisit();
    const start = visit.take('INK_APPOINTMENT_STARTED');
    if (inProgress) visit.commit(start);
    const appointment = visit.state.storyEffects.ink.appointments[start.appointmentId];
    const before = structuredClone(visit.state);
    const now = inProgress ? appointment.startAt + 10 * MIN : appointment.startAt - 1;
    const outcome = visit.run({ id: `test:early-ack-${inProgress}`, type: 'ACKNOWLEDGE_ARRANGEMENT',
      dueAt: now, day: londonDate(now), priority: 30, actors: ['goaden', 'ashai'],
      arrangementKey: appointment.arrangementKey });
    assert.equal(outcome.event.visibility, 'private');
    assert.equal(outcome.event.payload.outcome, 'skipped');
    assert.deepEqual(outcome.event.changes, []);
    assert.deepEqual(visit.state, before, 'early acknowledgement changed trust or marked the plan kept');
    assert.equal(visit.state.arrangements[appointment.arrangementKey].status, 'started');
    const deferred = outcome.followups.find(action => action.type === 'ACKNOWLEDGE_ARRANGEMENT');
    assert.ok(deferred);
    assert.ok(deferred.dueAt > now);
    assert.ok(deferred.dueAt > appointment.returnAt + appointment.returnMinutes * MIN);
    assert.equal(deferred.arrangementKey, appointment.arrangementKey);
    assert.match(deferred.id, /\/after-ink$/);
  }
});
