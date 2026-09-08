import { createHash } from 'node:crypto';
import { atLondon, londonDate, MINUTE_MS as MIN } from './time.mjs';
import { INK_BOOKING_SCENE } from './venues.mjs';

// One deliberately small semantic story: an authored cosmetic choice, a scarce
// released appointment, actual time in the chair, and a result that later scenes
// may recognise. This module proposes no powers, purchases, artists or prices.
// All writes go through the fixture's existing ledger operations.
export const INK_ACTIVITY = 'getting_a_tattoo';
export const INK_EVENT_TYPES = Object.freeze([
  'INK_DESIGN_CHOSEN', 'INK_SLOT_RELEASED', 'INK_APPOINTMENT_BOOKED',
  'INK_APPOINTMENT_STARTED', 'INK_APPOINTMENT_COMPLETED',
  'INK_APPOINTMENT_INTERRUPTED', 'INK_RESULT_NOTICED',
]);
export const INK_FACT_KINDS = Object.freeze([
  'ink_design_choice', 'ink_released_slot', 'ink_appointment',
  'ink_appointment_interrupted', 'ink_result',
]);
export const INK_WORK_MS = 60 * MIN;
const TYPES = new Set(INK_EVENT_TYPES);
const ACTIVE = new Set(['booked', 'in_progress']);
const STATUSES = new Set([...ACTIVE, 'completed', 'interrupted']);
const inkOf = state => state.storyEffects?.ink ?? initialStoryEffects().ink;
const actorAtInk = actor => actor?.location === 'enchanted_ink'
  && actor.area === 'venue' && !actor.journey && actor.activity !== 'sleeping';
const pairAtInk = state => ['goaden', 'ashai'].every(id => actorAtInk(state.characters[id]));
const sameRoom = (first, second) => first && second && !first.journey && !second.journey
  && first.activity !== 'sleeping' && second.activity !== 'sleeping'
  && first.location === second.location && first.area === second.area;
const releasedOnVisit = (seed, day, parentActionId) => createHash('sha256')
  .update(`${seed}|ink-slot-v1|${day}|${parentActionId}`).digest().readUInt32BE(0) % 3 === 0;
const remainingWork = ink => Math.max(1, INK_WORK_MS - ink.workMs);
const openFor = (startAt, endAt) => Number.isFinite(startAt) && Number.isFinite(endAt)
  && endAt > startAt && londonDate(startAt) === londonDate(endAt)
  && startAt >= atLondon(londonDate(startAt), '11:00')
  && endAt <= atLondon(londonDate(startAt), '17:00');
const publicFact = (designId, presentationText, extra = {}) => ({ designId, presentationText, ...extra });

export function initialStoryEffects() {
  return { ink: { choice: null, slots: {}, appointments: {}, result: null, workMs: 0 } };
}

export function activeInkAppointment(state) {
  return Object.values(inkOf(state).appointments).find(appointment => ACTIVE.has(appointment.status)) ?? null;
}

// Called by a committed visit, never by observation. Merely looking around does
// not promise a slot: the existing multi-year waiting list is still the ordinary
// rule, and this small authored exception must be recorded before it is used.
export function inkVisitActions({ state, day, now, parentActionId, arrangementKey, returnMinutes, seed }) {
  const ink = inkOf(state);
  if (ink.result || activeInkAppointment(state) || !pairAtInk(state)) return [];
  if (!Number.isFinite(returnMinutes) || returnMinutes <= 0 || !arrangementKey) return [];
  const releaseSlot = releasedOnVisit(seed, day, parentActionId);
  if (ink.choice && !releaseSlot) return [];
  const dueAt = now + MIN;
  // Choice -> release -> booking -> start takes five minutes; an existing
  // choice removes the first step. Both paths reserve only an open interval.
  const startAt = dueAt + (ink.choice ? 3 : 4) * MIN;
  if (!openFor(startAt, startAt + remainingWork(ink))) return [];
  return [{ id: `${parentActionId}/ink/${ink.choice ? 'released-slot' : 'choose'}`,
    type: ink.choice ? 'INK_SLOT_RELEASED' : 'INK_DESIGN_CHOSEN',
    dueAt, priority: 25, day, actors: ['goaden', 'ashai'], parentActionId,
    arrangementKey, returnMinutes, releaseSlot }];
}

function updateInk(ctx, patch) {
  ctx.ops.setStoryEffects({ ...ctx.state.storyEffects, ink: { ...inkOf(ctx.state), ...patch } });
}

function setAppointment(ctx, appointment) {
  updateInk(ctx, { appointments: { ...inkOf(ctx.state).appointments, [appointment.id]: appointment } });
}

function addFollowup(ctx, type, slug, dueAt, data = {}) {
  if (!Number.isFinite(dueAt) || dueAt <= ctx.now) throw new Error('Ink follow-up must occur after its cause');
  const a = ctx.action;
  ctx.followups.push({ id: `${a.id}/${slug}`, type, dueAt, priority: 25, day: londonDate(dueAt),
    actors: ['goaden', 'ashai'], parentActionId: a.parentActionId ?? a.id,
    arrangementKey: a.arrangementKey, returnMinutes: a.returnMinutes, ...data });
}

function validArrangement(ctx, key) {
  const arrangement = ctx.state.arrangements[key];
  return arrangement && ['accepted', 'started'].includes(arrangement.status)
    && arrangement.activity === 'ink_visit'
    && ['goaden', 'ashai'].every(id => arrangement.party.includes(id))
    && arrangement.startAt <= ctx.now && ctx.now <= arrangement.until
    ? arrangement : null;
}

function witnessesAtInk(state) {
  return ['goaden', 'ashai'].filter(id => actorAtInk(state.characters[id]));
}

// Travel and external activity replacement invoke this before moving the actor.
// The old completion stays queued and becomes a harmless stale action. Progress
// belongs to this one chosen design; it can never be spent on a second tattoo.
export function interruptInkAppointment(ctx, reason = 'activity_replaced') {
  const appointment = activeInkAppointment(ctx.state);
  if (!appointment) return null;
  const ink = inkOf(ctx.state);
  const goaden = ctx.state.characters.goaden;
  // An ownership/presence failure cannot turn an unverified interval into work.
  // Normal activity/travel hooks run before moving him, so they retain the
  // provable elapsed part while a failed completion conservatively retains only
  // progress that an earlier, legitimate interruption already recorded.
  const stillWorking = actorAtInk(goaden) && goaden.activity === INK_ACTIVITY
    && goaden.activityId === appointment.startEventId && goaden.activityUntil === appointment.endAt;
  const worked = appointment.status === 'in_progress' && stillWorking
    ? Math.max(0, Math.min(ctx.now, appointment.endAt) - appointment.startAt) : 0;
  const workMs = Math.min(INK_WORK_MS, appointment.workBeforeMs + worked);
  const interrupted = { ...appointment, status: 'interrupted', interruptedAt: ctx.now,
    interruptionEventId: ctx.id, reason, workAfterMs: workMs,
    interruptionWitnesses: witnessesAtInk(ctx.state) };
  updateInk(ctx, { workMs, appointments: { ...ink.appointments, [appointment.id]: interrupted } });
  ctx.event.causedBy.push(appointment.bookingEventId);
  if (appointment.startEventId) ctx.event.causedBy.push(appointment.startEventId);
  addFollowup(ctx, 'INK_APPOINTMENT_INTERRUPTED', `ink-interrupted/${appointment.id}`,
    ctx.now + 1, { appointmentId: appointment.id, appointmentToken: appointment.token });
  if (pairAtInk(ctx.state)) {
    addFollowup(ctx, 'TRAVEL_DEPART', `ink-interrupted-return/${appointment.id}`, ctx.now + MIN, {
      from: 'enchanted_ink', to: 'mi6', duration: appointment.returnMinutes,
      arrangementKey: appointment.arrangementKey,
      inkAppointmentId: appointment.id, inkAppointmentToken: appointment.token,
    });
  }
  return interrupted;
}

export function resolveInkAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const ink = inkOf(state);
  const refuse = reason => { ops.skip(reason); return true; };
  event.location = 'enchanted_ink';
  event.area = 'venue';
  if (a.type === 'INK_DESIGN_CHOSEN') {
    if (ink.choice || ink.result) return refuse('The prowler choice already exists');
    if (!pairAtInk(state) || !validArrangement(ctx, a.arrangementKey)) return refuse('No agreed visit for choosing a design');
    const factKey = `ink:choice:${id}`;
    const choice = { designId: 'prowler', chosenAt: now, sourceEventId: id, factKey };
    updateInk(ctx, { choice });
    const fact = ops.createFact(factKey, 'ink_design_choice', 'goaden',
      publicFact('prowler', 'Goaden chose a moving prowler design at Enchanted Ink.'), null);
    for (const who of ['goaden', 'ashai']) ops.learn(who, fact, 'participated');
    event.participants = ['goaden', 'ashai'];
    event.payload = { designId: 'prowler' };
    ops.publish('Goaden chose a moving prowler design at Enchanted Ink. It was a choice, not yet an appointment.');
    if (a.releaseSlot && releasedOnVisit(ctx.seed, a.day, a.parentActionId))
      addFollowup(ctx, 'INK_SLOT_RELEASED', 'released-slot', now + MIN);
  } else if (a.type === 'INK_SLOT_RELEASED') {
    const slotId = `ink-slot:${a.parentActionId ?? a.id}`;
    if (ink.result || !ink.choice || activeInkAppointment(state) || ink.slots[slotId])
      return refuse('No new appointment opportunity');
    if (!releasedOnVisit(ctx.seed, a.day, a.parentActionId ?? a.id)) return refuse('No slot released on this visit');
    if (!pairAtInk(state) || !validArrangement(ctx, a.arrangementKey)) return refuse('The pair are not on an agreed Ink visit');
    const startAt = now + 3 * MIN, endAt = startAt + remainingWork(ink);
    if (!openFor(startAt, endAt)) return refuse('Not enough open time for the remaining work');
    const factKey = `ink:slot:${id}`;
    const slot = { id: slotId, location: 'enchanted_ink', releasedAt: now,
      expiresAt: startAt, startAt, endAt, status: 'released', sourceEventId: id, factKey, appointmentId: null };
    updateInk(ctx, { slots: { ...ink.slots, [slotId]: slot } });
    const fact = ops.createFact(factKey, 'ink_released_slot', 'world',
      publicFact('prowler', 'A short-notice appointment became available at Enchanted Ink.', { startAt, endAt }), startAt);
    for (const who of ['goaden', 'ashai']) ops.learn(who, fact, 'checked_ordinary_notice');
    event.participants = ['goaden', 'ashai'];
    event.payload = { slotId, startAt, endAt };
    ops.publish('A released appointment became available at Enchanted Ink. The ordinary waiting list had not changed.');
    addFollowup(ctx, 'INK_APPOINTMENT_BOOKED', 'book', now + MIN, { slotId });
  } else if (a.type === 'INK_APPOINTMENT_BOOKED') {
    const slot = ink.slots[a.slotId], arrangement = validArrangement(ctx, a.arrangementKey);
    if (ink.result || activeInkAppointment(state) || !ink.choice || !slot || slot.status !== 'released')
      return refuse('No unclaimed released slot');
    if (!pairAtInk(state) || !arrangement || now >= slot.expiresAt || slot.startAt !== now + 2 * MIN)
      return refuse('Released slot is unavailable to this visit');
    if (!openFor(slot.startAt, slot.endAt) || slot.endAt - slot.startAt !== remainingWork(ink)
      || !Number.isFinite(a.returnMinutes) || a.returnMinutes <= 0)
      return refuse('The appointment interval is not valid');
    if (!['goaden', 'ashai'].every(who => ops.useMemory(who, ink.choice.factKey) && ops.useMemory(who, slot.factKey)))
      return refuse('Booking requires knowledge of the choice and released slot');
    const appointmentId = `ink-appointment:${id}`, token = `${id}:reserved`;
    const factKey = `ink:appointment:${id}`;
    const appointment = { id: appointmentId, token, slotId: slot.id, designId: 'prowler', owner: 'goaden',
      arrangementKey: a.arrangementKey, status: 'booked', bookedAt: now, startAt: slot.startAt,
      endAt: slot.endAt, returnAt: slot.endAt + 5 * MIN, returnMinutes: a.returnMinutes,
      bookingEventId: id, startActionId: `${a.id}/start`, startEventId: null,
      completionActionId: null, completionEventId: null, interruptionEventId: null,
      workBeforeMs: ink.workMs, factKey };
    updateInk(ctx, { appointments: { ...ink.appointments, [appointmentId]: appointment },
      slots: { ...ink.slots, [slot.id]: { ...slot, status: 'booked', appointmentId } } });
    ops.setArrangement(a.arrangementKey, { ...arrangement,
      until: Math.max(arrangement.until, appointment.returnAt + (a.returnMinutes + 30) * MIN) });
    for (const who of ['goaden', 'ashai']) ops.setActor(who, 'publicNext', {
      at: appointment.returnAt, description: 'Returning to MI6 after the Enchanted Ink appointment',
    });
    const summary = ink.workMs ? 'Goaden booked a released appointment to finish the prowler tattoo at Enchanted Ink.'
      : INK_BOOKING_SCENE.summary;
    const fact = ops.createFact(factKey, 'ink_appointment', 'goaden',
      publicFact('prowler', summary, { startAt: slot.startAt, endAt: slot.endAt }), slot.endAt + 1);
    for (const who of ['goaden', 'ashai']) ops.learn(who, fact, 'participated');
    event.causedBy.push(slot.sourceEventId, arrangement.acceptanceEventId, ink.choice.sourceEventId);
    const prior = Object.values(ink.appointments).filter(item => item.status === 'interrupted')
      .sort((first, second) => second.interruptedAt - first.interruptedAt || first.id.localeCompare(second.id))[0];
    if (prior?.interruptionFactKey && ops.useMemory('goaden', prior.interruptionFactKey))
      event.causedBy.push(prior.interruptionEventId);
    event.participants = ['goaden', 'ashai'];
    event.payload = { appointmentId, designId: 'prowler', startAt: slot.startAt, endAt: slot.endAt,
      venue: 'enchanted_ink', remainingWorkMs: slot.endAt - slot.startAt,
      ...(ink.workMs ? {} : { mood: INK_BOOKING_SCENE.mood, cast: [...INK_BOOKING_SCENE.cast],
        lines: INK_BOOKING_SCENE.lines.map(line => ({ ...line })) }) };
    ops.publish(summary);
    addFollowup(ctx, 'INK_APPOINTMENT_STARTED', 'start', slot.startAt, { appointmentId, appointmentToken: token });
    addFollowup(ctx, 'TRAVEL_DEPART', 'return', appointment.returnAt, {
      from: 'enchanted_ink', to: 'mi6', duration: a.returnMinutes,
      inkAppointmentId: appointmentId, inkAppointmentToken: token,
    });
  } else if (a.type === 'INK_APPOINTMENT_STARTED') {
    const appointment = ink.appointments[a.appointmentId], goaden = state.characters.goaden;
    if (ink.result || !appointment || appointment.status !== 'booked' || appointment.token !== a.appointmentToken
      || a.id !== appointment.startActionId || now !== appointment.startAt)
      return refuse('No matching booked appointment');
    if (!actorAtInk(goaden) || !openFor(now, appointment.endAt)
      || appointment.endAt - now !== remainingWork(ink)
      || !validArrangement(ctx, appointment.arrangementKey) || !ops.useMemory('goaden', appointment.factKey)) {
      interruptInkAppointment(ctx, 'reserved_start_unavailable');
      return refuse('The reserved start was unavailable; the appointment was interrupted');
    }
    setAppointment(ctx, { ...appointment, status: 'in_progress', startEventId: id, completionActionId: `${a.id}/complete` });
    ops.activity('goaden', INK_ACTIVITY, null, 'venue');
    ops.setActor('goaden', 'activityUntil', appointment.endAt);
    event.causedBy.push(appointment.bookingEventId);
    event.participants = ['goaden'];
    event.payload = { appointmentId: appointment.id, designId: 'prowler', endAt: appointment.endAt };
    ops.publish(appointment.workBeforeMs ? 'Goaden returned to the chair to finish the prowler tattoo.'
      : 'Goaden took the chair at Enchanted Ink. The prowler tattoo would take the reserved hour.');
    addFollowup(ctx, 'INK_APPOINTMENT_COMPLETED', 'complete', appointment.endAt, {
      appointmentId: appointment.id, appointmentToken: appointment.token, startEventId: id,
    });
  } else if (a.type === 'INK_APPOINTMENT_COMPLETED') {
    const appointment = ink.appointments[a.appointmentId], goaden = state.characters.goaden;
    if (ink.result || !appointment || appointment.status !== 'in_progress' || appointment.token !== a.appointmentToken
      || appointment.startEventId !== a.startEventId || a.id !== appointment.completionActionId
      || now !== appointment.endAt) return refuse('No matching work to complete');
    if (!actorAtInk(goaden) || goaden.activity !== INK_ACTIVITY || goaden.activityId !== appointment.startEventId
      || goaden.activityUntil !== now
      || Math.min(INK_WORK_MS, appointment.workBeforeMs + now - appointment.startAt) !== INK_WORK_MS) {
      interruptInkAppointment(ctx, 'reserved_completion_unavailable');
      return refuse('The reserved work was not completed here; the appointment was interrupted');
    }
    const factKey = `ink:result:${id}`;
    const result = { id: `ink-result:${id}`, appointmentId: appointment.id, designId: 'prowler', owner: 'goaden',
      completedAt: now, sourceEventId: id, factKey, cosmeticOnly: true };
    updateInk(ctx, { workMs: INK_WORK_MS, result,
      appointments: { ...ink.appointments, [appointment.id]: { ...appointment, status: 'completed', completionEventId: id } } });
    // Terminal state precedes replacing the activity, so the fixture's shared
    // interruption hook cannot mistake a successful completion for a recall.
    ops.activity('goaden', 'unhurried_time', null, 'venue');
    const fact = ops.createFact(factKey, 'ink_result', 'goaden',
      publicFact('prowler', 'Goaden has a completed moving prowler tattoo from Enchanted Ink.', { cosmeticOnly: true }), null);
    const witnesses = witnessesAtInk(state);
    for (const who of witnesses) ops.learn(who, fact, 'self_observation');
    event.participants = witnesses;
    event.causedBy.push(appointment.bookingEventId, appointment.startEventId);
    event.payload = { designId: 'prowler', cosmeticOnly: true };
    ops.publish('The prowler tattoo was finished at Enchanted Ink. It moved across Goaden’s skin.');
  } else if (a.type === 'INK_APPOINTMENT_INTERRUPTED') {
    const appointment = ink.appointments[a.appointmentId];
    if (!appointment || appointment.status !== 'interrupted' || appointment.token !== a.appointmentToken
      || appointment.interruptionAnnouncementId || now <= appointment.interruptedAt)
      return refuse('No new interruption to report');
    const factKey = `ink:interruption:${id}`;
    setAppointment(ctx, { ...appointment, interruptionAnnouncementId: id, interruptionFactKey: factKey });
    const fact = ops.createFact(factKey, 'ink_appointment_interrupted', 'goaden',
      publicFact('prowler', 'Goaden’s Enchanted Ink appointment was interrupted before completion.'), null);
    // Departure may already have moved them during the originating transition.
    // The delayed announcement records only those who actually experienced the
    // interruption, not somebody who arrived in the parlour a millisecond later.
    const witnesses = appointment.interruptionWitnesses ?? [];
    for (const who of witnesses) ops.learn(who, fact, 'participated');
    event.participants = witnesses;
    if (witnesses.length && witnesses.every(who => sameRoom(state.characters[witnesses[0]], state.characters[who]))) {
      event.location = state.characters[witnesses[0]].location;
      event.area = state.characters[witnesses[0]].area;
    } else if (witnesses.length > 1) {
      // The notice is public at its source. Separated former witnesses still
      // retain their own experience, but this is no newly staged encounter.
      event.participants = [];
    }
    event.causedBy.push(appointment.bookingEventId, appointment.interruptionEventId);
    if (appointment.startEventId) event.causedBy.push(appointment.startEventId);
    event.payload = { designId: 'prowler', completed: false };
    ops.publish('Goaden’s appointment at Enchanted Ink was interrupted. The prowler tattoo remained unfinished.');
  } else if (a.type === 'INK_RESULT_NOTICED') {
    const result = ink.result;
    if (!result || result.completedAt >= now || !sameRoom(state.characters.goaden, state.characters.ashai)
      || ops.useMemory('ashai', result.factKey) || !ops.useMemory('goaden', result.factKey))
      return refuse('No new completed result to notice together');
    const fact = state.facts[result.factKey];
    if (!fact || fact.sourceEventId !== result.sourceEventId) return refuse('The finished tattoo has no committed source');
    ops.learn('ashai', fact, 'self_observation');
    event.location = state.characters.goaden.location;
    event.area = state.characters.goaden.area;
    event.participants = ['goaden', 'ashai'];
    event.causedBy.push(result.sourceEventId);
    event.payload = { designId: 'prowler' };
    ops.publish('Ashai noticed the completed prowler tattoo when she and Goaden met again.');
  }
  return true;
}

export function assertStoryEffects(state) {
  const ink = state.storyEffects?.ink;
  if (!ink || !Number.isFinite(ink.workMs) || ink.workMs < 0 || ink.workMs > INK_WORK_MS
    || !ink.slots || !ink.appointments) throw new Error('Invalid Enchanted Ink story state');
  if (ink.choice && (ink.choice.designId !== 'prowler' || !ink.choice.factKey || !ink.choice.sourceEventId
    || !Number.isFinite(ink.choice.chosenAt))) throw new Error('Unapproved Ink design choice');
  const appointments = Object.values(ink.appointments);
  if (appointments.filter(item => ACTIVE.has(item.status)).length > 1) throw new Error('Overlapping Ink appointments');
  for (const appointment of appointments) {
    if (!STATUSES.has(appointment.status) || appointment.owner !== 'goaden' || appointment.designId !== 'prowler'
      || !ink.choice || !appointment.id || !appointment.token || !appointment.bookingEventId || !appointment.startActionId
      || !Number.isFinite(appointment.workBeforeMs) || appointment.workBeforeMs < 0 || appointment.workBeforeMs > INK_WORK_MS
      || !openFor(appointment.startAt, appointment.endAt)
      || appointment.endAt - appointment.startAt !== Math.max(1, INK_WORK_MS - appointment.workBeforeMs)
      || !Number.isFinite(appointment.returnAt) || appointment.returnAt < appointment.endAt)
      throw new Error('Invalid Ink appointment');
    const slot = ink.slots[appointment.slotId];
    if (!slot || slot.appointmentId !== appointment.id || slot.status !== 'booked'
      || slot.startAt !== appointment.startAt || slot.endAt !== appointment.endAt)
      throw new Error('Ink appointment lacks its released slot');
    if (appointment.status === 'in_progress' && (!appointment.startEventId || !appointment.completionActionId))
      throw new Error('Ink work lacks a start');
    if (appointment.status === 'interrupted' && (!appointment.interruptionEventId
      || !Number.isFinite(appointment.interruptedAt) || !Number.isFinite(appointment.workAfterMs)
      || appointment.workAfterMs < appointment.workBeforeMs || appointment.workAfterMs > INK_WORK_MS))
      throw new Error('Invalid interrupted Ink progress');
    if (appointment.status === 'completed' && (!appointment.startEventId || !appointment.completionEventId))
      throw new Error('Ink completion lacks its causes');
  }
  for (const [slotId, slot] of Object.entries(ink.slots)) {
    if (slot.id !== slotId || slot.location !== 'enchanted_ink' || !['released', 'booked'].includes(slot.status)
      || !slot.sourceEventId || !Number.isFinite(slot.releasedAt) || slot.releasedAt >= slot.expiresAt
      || slot.expiresAt !== slot.startAt || !openFor(slot.startAt, slot.endAt)
      || slot.status === 'booked' && !ink.appointments[slot.appointmentId])
      throw new Error('Invalid released Ink slot');
  }
  if (ink.result) {
    const result = ink.result, appointment = ink.appointments[result.appointmentId];
    const resultKeys = ['id', 'appointmentId', 'designId', 'owner', 'completedAt', 'sourceEventId', 'factKey', 'cosmeticOnly'];
    if (Object.keys(result).some(key => !resultKeys.includes(key))
      || result.owner !== 'goaden' || result.designId !== 'prowler' || result.cosmeticOnly !== true
      || !result.factKey || !result.sourceEventId || !Number.isFinite(result.completedAt)
      || !appointment || appointment.status !== 'completed' || appointment.completionEventId !== result.sourceEventId
      || appointment.endAt !== result.completedAt || ink.workMs !== INK_WORK_MS
      || appointments.filter(item => item.status === 'completed').length !== 1 || activeInkAppointment(state))
      throw new Error('Ink result lacks its unique completed appointment');
  } else if (appointments.some(item => item.status === 'completed')) {
    throw new Error('Finished Ink work lacks its result');
  }
}
