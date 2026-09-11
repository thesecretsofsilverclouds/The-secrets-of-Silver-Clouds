import { createHash } from 'node:crypto';
import { atLondon, londonDate, MINUTE_MS as MIN } from './time.mjs';
import { surfaceLine } from './downtime.mjs';

// The training ground closes and reopens about once a week, and each stage of
// that had exactly one sentence — so across seventy days "began the outdoor
// ground reset after the preparations" ran forty-six times and the interruption
// line thirty. A yard being resurfaced is meant to be dull; it does not have to
// be dull in the same eleven words every time. Seeded off the event, so a given
// afternoon always reads the same way and a replay is a no-op.
const groundHash = value => createHash('sha256').update(String(value)).digest().readUInt32BE(0);
const groundLine = (bank, key) => bank[groundHash(key) % bank.length];
const RESET_BEGUN = Object.freeze([
  'began preparing the outdoor training yard. The closure remained in place.',
  'started on the yard itself. The outdoor ground stayed closed while they worked.',
  'went out to the closed ground and got on with preparing it. The cones stayed where they were.',
  'switched plans rather than wait for the delayed ground crew. The ground stayed shut regardless.',
]);
const RESET_INTERRUPTED = Object.freeze([
  'The ground reset was interrupted. The outdoor training ground remained closed.',
  'The reset stopped halfway. Whatever was half-done out there stayed half-done, and the yard stayed shut.',
  'Work on the yard was called off before the reset was finished. The outdoor ground stayed closed.',
  'The reset did not finish. Somebody will find the tools where they were left.',
]);
const RESET_DONE = Object.freeze([
  'The safety check and preparations were complete. The outdoor training ground reopened.',
  'The yard passed its check and opened again. The cones came in off the grass at last.',
  'Preparations finished and the ground signed off. Outdoor training is back on from the next watch.',
  'The outdoor ground was signed off and reopened. The covered floor went back to being the second choice.',
  'The reset was done and the check was passed. The yard was open again.',
]);
const RESET_HELD = Object.freeze([
  'The outdoor reset was held until conditions improved. The covered training floor remained available.',
  'Too wet to reset the yard. It was put off, and the covered floor took the overflow.',
  'The outdoor work was held over for the weather. Indoors stayed open, and stayed crowded.',
]);

// Manuscript PDF pp.161–167 establishes deliberate training, concentration and
// exhaustion. It does not establish that either protagonist can repair wards.
// Consequently this episode uses a mundane inspection/reset of the existing
// training grounds, not a newly invented spell. Durations and effort units are
// authored sandbox mechanics; no proficiency, body or power is granted here.
export const ABILITY_EVENT_TYPES = Object.freeze([
  'ABILITY_ACTIVITY_SETTLED', 'GROUND_RESTRICTION', 'GROUND_PREPARATION',
  'GROUND_PREPARED', 'GROUND_WORK_OPPORTUNITY', 'GROUND_WORK_COMPLETED', 'GROUND_WORK_INTERRUPTED',
]);
export const ABILITY_FACT_KINDS = Object.freeze(['training_ground_restriction', 'training_ground_prepared', 'training_ground_cleared']);
export const GROUND_ACTIVITIES = Object.freeze(['checking_training_ground', 'clearing_training_ground']);
const TYPES = new Set(ABILITY_EVENT_TYPES);
const RECOVERY = new Set(['resting', 'sleeping', 'quiet_break']);
const EFFORT = new Set(['training', ...GROUND_ACTIVITIES]);
const AVAILABLE = new Set(['unhurried_time', 'waiting', 'quiet_break']);
const MAX_FATIGUE = 6;
const clamp = value => Math.max(0, Math.min(MAX_FATIGUE, Math.round(value * 1e6) / 1e6));
const actors = ['goaden', 'ashai'];
const wet = code => ['heavy_rain', 'storm'].includes(code);
const idName = who => who === 'goaden' ? 'Goaden' : 'Ashai';
const record = (state, who) => state.abilities?.actors?.[who];
const room = state => state.abilities.trainingGround;
const awakeHere = (state, who, area) => {
  const actor = state.characters[who];
  return actor && actor.location === 'mi6' && !actor.journey && actor.activity !== 'sleeping'
    && (!area || actor.area === area);
};

export function initialAbilities() {
  return { actors: Object.fromEntries(actors.map(who => [who, { fatigue: 0, track: null, fatigueEventId: null }])),
    trainingGround: { status: 'open', restriction: null, preparation: null, work: null,
      lastClearEventId: null, weatherDeferredDay: null, weatherDeferredAt: null, weatherDeferredSourceEventId: null } };
}

export function fatigueAt(state, who, now) {
  const current = record(state, who);
  if (!current) return 0;
  const track = current.track;
  if (!track || now <= track.startedAt) return current.fatigue;
  const end = Math.min(now, track.endsAt);
  const change = Math.max(0, end - track.startedAt) / MIN * track.unitsPerMinute;
  return clamp(track.baseline + change);
}

function saveActor(ctx, who, value) {
  ctx.ops.setAbilities({ ...ctx.state.abilities,
    actors: { ...ctx.state.abilities.actors, [who]: value } });
}
function saveGround(ctx, value) {
  ctx.ops.setAbilities({ ...ctx.state.abilities, trainingGround: value });
}
function settleEffort(ctx, who) {
  const current = record(ctx.state, who);
  if (current.track) {
    ctx.event.causedBy.push(current.track.sourceEventId);
    saveActor(ctx, who, { ...current, fatigue: fatigueAt(ctx.state, who, ctx.now), track: null, fatigueEventId: ctx.id });
  }
}
function queue(ctx, type, actionId, dueAt, data = {}) {
  if (!Number.isFinite(dueAt) || dueAt <= ctx.now) throw new Error('Ability follow-up must follow its cause');
  ctx.followups.push({ id: actionId, type, day: londonDate(dueAt), dueAt,
    priority: type === 'ABILITY_ACTIVITY_SETTLED' ? 18 : 24, ...data });
}

// Overlay on the fixture's existing location/mode/room gates. It never opens the
// sealed basement. A restricted yard permits only its actual booked workers.
export function canEnterAbilityArea(state, who, location, area, { activity } = {}) {
  if (location === 'mi6' && area === 'basement') return false;
  if (location !== 'mi6' || area !== 'training') return true;
  const ground = state.abilities?.trainingGround;
  if (!ground || ground.status === 'open') return true;
  return activity === 'clearing_training_ground' && ground.work?.status === 'in_progress'
    && ground.work.workers.includes(who);
}

// Every genuine activity/travel transition calls this before changing the actor.
// Settling uses elapsed fictional time; neither reads nor midnight write fatigue.
export function abilityActivityChanged(ctx, who, label, durationMinutes, area) {
  if (!record(ctx.state, who)) return;
  const current = record(ctx.state, who);
  if (current.track?.token === ctx.id && current.track.label === label) return;
  const ground = room(ctx.state);
  if (ground.preparation?.status === 'in_progress' && ground.preparation.actor === who
    && label !== 'checking_training_ground') {
    saveGround(ctx, { ...ground, preparation: { ...ground.preparation, status: 'interrupted',
      interruptionEventId: ctx.id, interruptedAt: ctx.now } });
  }
  const live = room(ctx.state);
  if (live.work?.status === 'in_progress' && live.work.workers.includes(who)
    && label !== 'clearing_training_ground') {
    const work = { ...live.work, status: 'interrupted', interruptedAt: ctx.now,
      interruptionEventId: ctx.id, interruptionActionId: `${ctx.action.id}/ground-interrupted` };
    saveGround(ctx, { ...live, status: 'restricted', work });
    ctx.event.causedBy.push(work.sourceEventId);
    queue(ctx, 'GROUND_WORK_INTERRUPTED', work.interruptionActionId, ctx.now + 1,
      { workToken: work.token });
  }
  settleEffort(ctx, who);
  const baseline = record(ctx.state, who).fatigue;
  if (!RECOVERY.has(label) && !EFFORT.has(label)) return;
  const recovery = RECOVERY.has(label);
  if (recovery && baseline === 0) return;
  const liveGround = room(ctx.state);
  const authoredEnd = label === 'checking_training_ground' ? liveGround.preparation?.endsAt
    : label === 'clearing_training_ground' ? liveGround.work?.endsAt : null;
  const endsAt = authoredEnd ?? (durationMinutes > 0 ? ctx.now + durationMinutes * MIN
    : ctx.now + (recovery ? Math.max(1, Math.ceil(baseline * 45)) : 60) * MIN);
  const exposure = area === 'training' && ctx.state.weather?.code === 'light_rain' ? 1.25 : 1;
  const unitsPerMinute = recovery ? -1 / 45 : label === 'training' ? exposure / 25 : exposure / 45;
  const track = { token: ctx.id, label, baseline, startedAt: ctx.now, endsAt, unitsPerMinute,
    settleActionId: `${ctx.action.id}/ability-settle/${who}`, sourceEventId: ctx.id };
  saveActor(ctx, who, { ...record(ctx.state, who), fatigue: baseline, track });
  queue(ctx, 'ABILITY_ACTIVITY_SETTLED', track.settleActionId, endsAt,
    { actor: who, activityToken: track.token });
}

export function abilityDayActions({ day }) {
  const ordinal = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
  const actions = [];
  const add = (time, type, suffix) => actions.push({ id: `${day}/ground/${suffix}`, type,
    day, dueAt: atLondon(day, time), priority: 27, actors: [] });
  if (ordinal % 3 === 0) add('08:45', 'GROUND_RESTRICTION', 'restrict');
  add('09:50', 'GROUND_PREPARATION', 'prepare');
  for (const time of ['10:05', '13:05', '16:05']) add(time, 'GROUND_WORK_OPPORTUNITY', `work-${time}`);
  return actions;
}

function ownCalendarAction(a) {
  return Array.isArray(a.actors) && a.actors.length === 0 && !Object.hasOwn(a, 'actor')
    && abilityDayActions({ day: a.day }).some(item => item.id === a.id && item.type === a.type
      && item.dueAt === a.dueAt && item.priority === a.priority);
}
function workerAvailable(ctx, who) {
  return awakeHere(ctx.state, who) && AVAILABLE.has(ctx.state.characters[who].activity)
    && fatigueAt(ctx.state, who, ctx.now) < 3;
}
function validWorker(state, work, who) {
  const actor = state.characters[who];
  return awakeHere(state, who, 'training') && actor.activity === 'clearing_training_ground'
    && actor.activityId === work.sourceEventId && actor.activityUntil === work.endsAt;
}

export function resolveAbilityAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const refuse = reason => { ops.skip(reason); return true; };
  event.location = 'mi6'; event.area = 'training'; event.participants = [];
  let ground = room(state);
  if (a.type === 'ABILITY_ACTIVITY_SETTLED') {
    const track = record(state, a.actor)?.track;
    if (!track || a.id !== track.settleActionId || a.activityToken !== track.token || now !== track.endsAt)
      return refuse('An earlier activity already settled or was interrupted');
    settleEffort(ctx, a.actor);
    event.causedBy.push(track.sourceEventId);
    event.payload = { outcome: 'elapsed_effort_settled' };
    return true;
  }
  if (['GROUND_RESTRICTION', 'GROUND_PREPARATION', 'GROUND_WORK_OPPORTUNITY'].includes(a.type) && !ownCalendarAction(a))
    return refuse('No owned training-ground opportunity');
  if (a.type === 'GROUND_RESTRICTION') {
    if (ground.status !== 'open') return refuse('The training ground is already restricted');
    const factKey = `ground:restriction:${id}`;
    saveGround(ctx, { ...ground, status: 'restricted', preparation: null, work: null,
      weatherDeferredDay: null, weatherDeferredAt: null, weatherDeferredSourceEventId: null,
      restriction: { sourceEventId: id, since: now, factKey, reason: 'routine_safety_check_and_reset' } });
    ops.createFact(factKey, 'training_ground_restriction', 'world',
      { presentationText: 'The outdoor training ground is closed until its safety check and reset are complete.' }, null);
    ops.publish(surfaceLine(id, [
      'The outdoor training ground was taken out of use for a safety check and reset. The covered training floor remained available.',
      'The outdoor ground was closed for its safety check and reset. The covered floor stayed available.',
      'The yard went out of use for a check and reset. The covered floor stayed open.',
      'A safety check took the outdoor training ground out of use. The covered floor was still available.']));
  } else if (a.type === 'GROUND_PREPARATION') {
    if (ground.status !== 'restricted' || ground.preparation?.status === 'in_progress'
      || ground.preparation?.status === 'completed') return refuse('No new ground preparation is needed');
    const who = ['ashai', 'goaden'].find(candidate => workerAvailable(ctx, candidate));
    if (!who) return refuse('Nobody is available for the safety preparation');
    const preparation = { actor: who, status: 'in_progress', token: id, sourceEventId: id,
      startedAt: now, endsAt: now + 10 * MIN, completionActionId: `${a.id}/complete` };
    saveGround(ctx, { ...ground, preparation });
    ops.activity(who, 'checking_training_ground', null, 'indoor_yard');
    ops.setActor(who, 'activityUntil', preparation.endsAt);
    event.area = 'indoor_yard'; event.participants = [who];
    event.causedBy.push(ground.restriction.sourceEventId);
    ops.publish(`${idName(who)} began the ground-check preparations from the covered training floor.`);
    queue(ctx, 'GROUND_PREPARED', preparation.completionActionId, preparation.endsAt, { preparationToken: id });
  } else if (a.type === 'GROUND_PREPARED') {
    const preparation = ground.preparation;
    if (!preparation || preparation.status !== 'in_progress' || preparation.token !== a.preparationToken
      || a.id !== preparation.completionActionId || now !== preparation.endsAt)
      return refuse('No matching preparation to complete');
    const actor = state.characters[preparation.actor];
    const valid = awakeHere(state, preparation.actor, 'indoor_yard')
      && actor.activity === 'checking_training_ground' && actor.activityId === preparation.sourceEventId;
    if (!valid) {
      saveGround(ctx, { ...ground, preparation: { ...preparation, status: 'interrupted', interruptedAt: now, interruptionEventId: id } });
      return refuse('The preparation was not completed here');
    }
    saveGround(ctx, { ...ground, preparation: { ...preparation, status: 'completed', completedAt: now, completionEventId: id } });
    ops.activity(preparation.actor, 'unhurried_time', null, 'indoor_yard');
    const fact = ops.createFact(`ground:prepared:${id}`, 'training_ground_prepared', preparation.actor,
      { presentationText: 'The outdoor ground-check preparations are complete.' }, null);
    ops.learn(preparation.actor, fact, 'participated');
    event.area = 'indoor_yard'; event.participants = [preparation.actor];
    event.causedBy.push(preparation.sourceEventId, ground.restriction.sourceEventId);
    ops.publish(`${idName(preparation.actor)} finished the preparations. The outdoor ground still needed its reset.`);
  } else if (a.type === 'GROUND_WORK_OPPORTUNITY') {
    if (ground.status !== 'restricted') return refuse('No outstanding ground reset');
    if (wet(state.weather?.code)) {
      if (ground.weatherDeferredDay === a.day) return refuse('Outdoor work remains weather-bound');
      // The same closure waiting through another wet day has not become a new
      // decision. Actual work in between makes the weather consequential again.
      // Older saved worlds lack the timestamp: retain the first new notice
      // rather than infer an unchanged history from its calendar date alone.
      const unchanged = Number.isSafeInteger(ground.weatherDeferredAt)
        && ground.weatherDeferredAt < now && (!ground.work || ground.work.startedAt <= ground.weatherDeferredAt);
      saveGround(ctx, { ...ground, weatherDeferredDay: a.day, weatherDeferredAt: now, weatherDeferredSourceEventId: id });
      event.causedBy.push(ground.restriction.sourceEventId);
      if (unchanged && ground.weatherDeferredSourceEventId) event.causedBy.push(ground.weatherDeferredSourceEventId);
      event.payload = { method: 'sheltered_wait', outcome: 'weather_deferred', ...(unchanged ? { routineContinuation: true } : {}) };
      ops.publish(groundLine(RESET_HELD, ctx.id));
      return true;
    }
    const workers = actors.filter(who => workerAvailable(ctx, who));
    if (!workers.length) return refuse('Available concentration and energy are insufficient for the reset');
    const prepared = ground.preparation?.status === 'completed';
    const fatigue = Math.max(...workers.map(who => fatigueAt(state, who, now)));
    const durationMinutes = (workers.length === 2 ? 22 : 35) - (prepared ? 5 : 0)
      + Math.ceil(fatigue * 4) + (state.weather?.code === 'light_rain' ? 8 : 0);
    const interrupted = ground.work?.status === 'interrupted' ? ground.work : null;
    const work = { status: 'in_progress', workers, token: id, sourceEventId: id, startedAt: now,
      endsAt: now + durationMinutes * MIN, completionActionId: `${a.id}/complete`,
      method: workers.length === 2 ? 'cooperative_reset' : 'manual_reset', prepared,
      startingFatigue: fatigue, weatherCode: state.weather?.code ?? 'cloudy' };
    saveGround(ctx, { ...ground, status: 'work_in_progress', work });
    for (const who of workers) {
      ops.activity(who, 'clearing_training_ground', null, 'training');
      ops.setActor(who, 'activityUntil', work.endsAt);
    }
    event.participants = workers; event.causedBy.push(ground.restriction.sourceEventId);
    if (prepared) event.causedBy.push(ground.preparation.completionEventId);
    if (interrupted) event.causedBy.push(interrupted.announcementEventId ?? interrupted.interruptionEventId);
    event.payload = { method: work.method, prepared, durationMinutes, ...(interrupted ? { resumed: true } : {}) };
    ops.publish(`${workers.map(idName).join(' and ')} ${interrupted
      ? 'returned to the interrupted yard reset. The outdoor ground stayed closed while they worked.'
      : groundLine(RESET_BEGUN, ctx.id)}`);
    queue(ctx, 'GROUND_WORK_COMPLETED', work.completionActionId, work.endsAt, { workToken: id });
  } else if (a.type === 'GROUND_WORK_COMPLETED') {
    const work = ground.work;
    if (!work || work.status !== 'in_progress' || a.id !== work.completionActionId
      || a.workToken !== work.token || now !== work.endsAt) return refuse('No matching reset to complete');
    if (wet(state.weather?.code) || !work.workers.every(who => validWorker(state, work, who))) {
      const interrupted = { ...work, status: 'interrupted', interruptedAt: now,
        interruptionEventId: id, interruptionActionId: `${a.id}/interrupted` };
      saveGround(ctx, { ...ground, status: 'restricted', work: interrupted });
      queue(ctx, 'GROUND_WORK_INTERRUPTED', interrupted.interruptionActionId, now + 1, { workToken: work.token });
      return refuse('The reset could not be completed under its actual conditions');
    }
    saveGround(ctx, { ...ground, status: 'open', work: { ...work, status: 'completed', completionEventId: id }, lastClearEventId: id });
    const fact = ops.createFact(`ground:cleared:${id}`, 'training_ground_cleared', 'world',
      { presentationText: 'The safety check and reset are complete; the outdoor training ground is open again.' }, null);
    for (const who of work.workers) { ops.activity(who, 'unhurried_time', null, 'training'); ops.learn(who, fact, 'participated'); }
    event.participants = [...work.workers]; event.causedBy.push(work.sourceEventId, ground.restriction.sourceEventId);
    event.payload = { method: work.method, outcome: 'reopened' };
    ops.publish(groundLine(RESET_DONE, ctx.id));
  } else if (a.type === 'GROUND_WORK_INTERRUPTED') {
    const work = ground.work;
    if (!work || work.status !== 'interrupted' || work.token !== a.workToken
      || a.id !== work.interruptionActionId || now !== work.interruptedAt + 1 || work.announcementEventId)
      return refuse('No new ground-work interruption');
    saveGround(ctx, { ...ground, work: { ...work, announcementEventId: id } });
    for (const who of work.workers) if (validWorker(state, work, who)) {
      // The old work is already terminal, so ending the remaining colleague's
      // activity cannot create another interruption notification.
      ops.activity(who, 'unhurried_time', null, 'indoor_yard');
    }
    event.causedBy.push(work.sourceEventId, work.interruptionEventId);
    ops.publish(groundLine(RESET_INTERRUPTED, ctx.id));
  }
  return true;
}

export function assertAbilities(state) {
  const abilities = state.abilities;
  if (!abilities || Object.keys(abilities.actors).sort().join(',') !== 'ashai,goaden') throw new Error('Invalid effort actors');
  for (const current of Object.values(abilities.actors)) {
    if (!Number.isFinite(current.fatigue) || current.fatigue < 0 || current.fatigue > MAX_FATIGUE) throw new Error('Effort bounds violated');
    const track = current.track;
    if (track && (!track.token || !track.sourceEventId || !track.settleActionId
      || !Number.isFinite(track.baseline) || track.baseline < 0 || track.baseline > MAX_FATIGUE
      || !Number.isFinite(track.startedAt) || !Number.isFinite(track.endsAt) || track.endsAt <= track.startedAt
      || !Number.isFinite(track.unitsPerMinute) || !RECOVERY.has(track.label) && !EFFORT.has(track.label)))
      throw new Error('Invalid elapsed activity');
  }
  const ground = abilities.trainingGround;
  if (!ground || !['open', 'restricted', 'work_in_progress'].includes(ground.status)) throw new Error('Invalid training-ground restriction');
  if (ground.status !== 'open' && (!ground.restriction?.sourceEventId || !Number.isFinite(ground.restriction.since)))
    throw new Error('Ground restriction lacks a source');
  if (ground.status === 'work_in_progress' && ground.work?.status !== 'in_progress') throw new Error('Ground work is not active');
  if (ground.work && (!['in_progress', 'completed', 'interrupted'].includes(ground.work.status)
    || !ground.work.workers.length || new Set(ground.work.workers).size !== ground.work.workers.length
    || ground.work.workers.some(who => !actors.includes(who)) || !ground.work.sourceEventId
    || !ground.work.token || !ground.work.completionActionId || ground.work.endsAt <= ground.work.startedAt))
    throw new Error('Invalid ground work');
  if (ground.status === 'open' && ground.restriction && (!ground.lastClearEventId
    || ground.work?.status !== 'completed' || ground.work.completionEventId !== ground.lastClearEventId))
    throw new Error('Training ground reopened without completed work');
}
