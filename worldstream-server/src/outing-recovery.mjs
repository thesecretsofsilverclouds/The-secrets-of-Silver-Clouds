import { createHash } from 'node:crypto';
import { encounterEligibility, ENCOUNTER_REASONS, INTERRUPTIBLE } from './places.mjs';
import { londonDate, MINUTE_MS as MIN } from './time.mjs';

// One missed proposal may be retried after the actual blocking work finishes.
// This module never writes actors, consent, travel, facts or knowledge. Its
// issued native actions still pass through the fixture's ordinary reducers.
export const OUTING_RECOVERY_EVENT_TYPES = Object.freeze(['OUTING_RECOVERY_CHECK', 'OUTING_RECOVERY_EXPIRE']);
const NATIVE = ['CROSS_PATHS', 'OFFER_ACTIVITY', 'ACCEPT_ACTIVITY', 'ANNOUNCE_ARRANGEMENT', 'END_ENCOUNTER'];
const COMPLETIONS = new Set(['ACTIVITY_COMPLETE', 'PRACTICE_END', 'GROUND_PREPARED',
  'GROUND_WORK_COMPLETED', 'INTENT_COMPLETE', 'INK_APPOINTMENT_COMPLETED']);
const VENUES = { ink_visit: 'enchanted_ink', cafe_outing: 'cafe', city_walk: 'big_ben_plaza' };
const ACTIVE = new Set(['waiting', 'ready', 'retrying']);
const of = state => state.outingRecovery ?? initialOutingRecovery();
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const canonical = value => JSON.stringify(normalise(value));
function normalise(value) {
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, normalise(value[key])]));
  return value;
}
export function initialOutingRecovery() { return { opportunities: {}, issued: {} }; }
/** A recovered scheduled proposal takes precedence over an opportunistic new
 * cameo. Use only when selecting OTHER activities; its own native sequence
 * remains governed by guardOutingRecoveryAction. This grants no consent. */
export function outingRecoveryActorAvailable(state, who, { atMs } = {}) {
  if (!['goaden', 'ashai'].includes(who) || !Number.isFinite(atMs)) return false;
  return !Object.values(of(state).opportunities).some(record => ['ready', 'retrying'].includes(record.status)
    && record.readyAt <= atMs && atMs < record.spec.departureAt);
}
function save(ctx, opportunity) {
  const current = of(ctx.state);
  ctx.ops.setOutingRecovery({ ...current, opportunities: { ...current.opportunities, [opportunity.id]: opportunity } });
}
function issue(ctx, opportunity, type, slug, dueAt, data = {}) {
  if (!(dueAt > ctx.now)) throw new Error('Outing recovery follow-up must be in the future');
  const action = { id: `${opportunity.originActionId}/recovery/${slug}`, type, dueAt,
    priority: type === 'OUTING_RECOVERY_EXPIRE' ? 5 : 39, day: opportunity.day,
    outingRecoveryId: opportunity.id, outingRecoveryToken: opportunity.token, ...data };
  const current = of(ctx.state);
  if (current.issued[action.id]) throw new Error('Outing recovery action already issued');
  ctx.ops.setOutingRecovery({ ...current, issued: { ...current.issued,
    [action.id]: { action, sourceEventId: ctx.id, consumed: false } } });
  ctx.followups.push(action);
  return action;
}
function owned(ctx) {
  const row = of(ctx.state).issued[ctx.action.id];
  return row && !row.consumed && ctx.now === row.action.dueAt
    && canonical(ctx.action) === canonical(row.action) ? row : null;
}
function consume(ctx, row) {
  const current = of(ctx.state);
  ctx.ops.setOutingRecovery({ ...current, issued: { ...current.issued,
    [ctx.action.id]: { ...row, consumed: true, consumedEventId: ctx.id } } });
  ctx.event.causedBy.push(row.sourceEventId);
}
function end(ctx, record, reason, status = 'abandoned') {
  save(ctx, { ...record, status, endedAt: ctx.now, endEventId: ctx.id, reason });
}
function known(state, key, now) {
  if (!key) return true;
  const fact = state.facts?.[key];
  return Boolean(fact && fact.createdAt <= now && (fact.validUntil == null || now < fact.validUntil)
    && state.characters.ashai.knowledge?.some(memory => memory.factKey === key
      && memory.sourceEventId === fact.sourceEventId && memory.learnedAt <= now
      && fact.createdAt <= memory.learnedAt && (memory.validUntil == null || now < memory.validUntil)));
}
function specFor(ctx) {
  const a = ctx.action, spec = a.outingRecovery;
  if (!spec || a.type !== 'CROSS_PATHS' || a.outingRecoveryId || a.area !== 'common_room'
    || canonical(a.actors) !== canonical(['goaden', 'ashai']) || a.dueAt !== ctx.now
    || a.day !== londonDate(ctx.now) || !a.id || !ctx.id
    || VENUES[spec.kind] !== spec.venue || !spec.arrangementKey
    || spec.departureAt !== ctx.now + 40 * MIN || spec.duration !== 90
    || !Number.isFinite(spec.travelMinutes) || spec.travelMinutes <= 0 || spec.travelMinutes > 60
    || spec.requiredFact != null && typeof spec.requiredFact !== 'string') return null;
  return { arrangementKey: spec.arrangementKey, kind: spec.kind, venue: spec.venue,
    departureAt: spec.departureAt, travelMinutes: spec.travelMinutes, duration: spec.duration,
    requiredFact: spec.requiredFact ?? null };
}
function eligible(ctx, record, { allowOwnArrangement = false } = {}) {
  const { state, now } = ctx;
  if (now + 5 * MIN >= record.spec.departureAt && record.status !== 'retrying') return 'The original departure is too close';
  if (now >= record.spec.departureAt) return 'The original departure has passed';
  const people = Object.fromEntries(['goaden', 'ashai'].map(who => [who, state.characters[who]]));
  if (Object.values(people).some(who => !who)) return 'The original party is unavailable';
  const verdict = encounterEligibility(people, { location: 'mi6', area: 'common_room', atMs: now });
  if (!verdict.ok) return 'The original party cannot meet now';
  if (!known(state, record.spec.requiredFact, now)) return 'The proposal has no current known basis';
  if (typeof ctx.ops.outingRecoveryAllowed !== 'function'
    || !ctx.ops.outingRecoveryAllowed(record.spec, now)) return 'The original outing is no longer permitted';
  for (const [key, arrangement] of Object.entries(state.arrangements ?? {})) {
    if (key === record.spec.arrangementKey) {
      if (!allowOwnArrangement) return 'The original proposal has already been handled';
      continue;
    }
    if (['offered', 'accepted', 'started'].includes(arrangement.status)
      && arrangement.party?.some(who => ['goaden', 'ashai'].includes(who))
      && arrangement.until > now && arrangement.startAt < record.spec.departureAt + record.spec.duration * MIN)
      return 'Another commitment already occupies the party';
  }
  return null;
}

/** Call after every committed reducer action, before cause deduplication and assertions.
 * Reads actual ledger changes, so a clock tick or stale completion cannot free a
 * reservation. A replacement/interruption cancels instead of acting as completion.
 */
export function outingRecoveryAfterAction(ctx) {
  const { action, state, event, now } = ctx;
  if (action.type === 'CROSS_PATHS' && event.payload?.reason === ENCOUNTER_REASONS.busy) {
    const spec = specFor(ctx), id = `outing:${hash(action.id)}`;
    if (spec && !of(state).opportunities[id] && !state.arrangements?.[spec.arrangementKey]
      && known(state, spec.requiredFact, now)) {
      const party = ['goaden', 'ashai'].map(who => state.characters[who]);
      const blocked = party.filter(who => who && !INTERRUPTIBLE.includes(who.activity));
      if (party.every(who => who?.location === 'mi6' && !who.journey && who.activity !== 'sleeping')
        && blocked.length && blocked.every(who => who.activityId && Number.isFinite(who.activityUntil)
          && who.activityUntil > now && who.activityUntil + 5 * MIN < spec.departureAt)) {
        const record = { id, token: ctx.id, originActionId: action.id, originEventId: ctx.id,
          day: action.day, spec, status: 'waiting', createdAt: now, originalEndAt: now + 4 * MIN,
          blockers: blocked.map(who => ({ who: who.id, activityId: who.activityId,
            expectedUntil: who.activityUntil, completionEventId: null })), attempts: 0, step: 0 };
        save(ctx, record);
        event.causedBy.push(...blocked.map(who => who.activityId));
        if (spec.requiredFact) ctx.ops.useMemory('ashai', spec.requiredFact);
        issue(ctx, record, 'OUTING_RECOVERY_EXPIRE', 'expire', spec.departureAt);
      }
    }
  }

  for (let record of Object.values(of(state).opportunities)) {
    if (record.status === 'waiting' && now > record.createdAt) {
      const changed = record.blockers.filter(blocker => !blocker.completionEventId
        && state.characters[blocker.who]?.activityId !== blocker.activityId);
      if (!changed.length) continue;
      const completion = COMPLETIONS.has(action.type) && event.payload?.outcome !== 'skipped';
      if (!completion || changed.some(blocker => now < blocker.expectedUntil
        || !event.changes.some(change => change.entity === 'character' && change.id === blocker.who
          && change.field === 'activityId' && change.before === blocker.activityId
          && change.after === state.characters[blocker.who]?.activityId))) {
        end(ctx, record, 'The blocking activity was replaced or interrupted'); continue;
      }
      record = { ...record, blockers: record.blockers.map(blocker => changed.includes(blocker)
        ? { ...blocker, completedAt: now, completionEventId: ctx.id } : blocker) };
      save(ctx, record);
      if (record.blockers.every(blocker => blocker.completionEventId)) {
        const dueAt = Math.max(now + 1, record.originalEndAt + 1);
        if (dueAt + 5 * MIN >= record.spec.departureAt) { end(ctx, record, 'The proposal window closed after work finished', 'expired'); continue; }
        record = { ...record, status: 'ready', readyAt: now, readyEventId: ctx.id };
        save(ctx, record);
        issue(ctx, record, 'OUTING_RECOVERY_CHECK', 'check', dueAt);
      }
    }
  }

  const record = of(state).opportunities[action.outingRecoveryId];
  if (!record || record.status !== 'retrying' || !NATIVE.includes(action.type)) return;
  const row = of(state).issued[action.id];
  if (!row?.consumed || row.consumedEventId !== ctx.id || record.step !== NATIVE.indexOf(action.type)) return;
  const arrangement = state.arrangements?.[record.spec.arrangementKey];
  const successful = event.payload?.outcome !== 'skipped' && (
    action.type === 'CROSS_PATHS' ? state.encounter?.eventId === ctx.id
      : action.type === 'OFFER_ACTIVITY' ? arrangement?.sourceEventId === ctx.id && arrangement.status === 'offered'
      : action.type === 'ACCEPT_ACTIVITY' ? arrangement?.acceptanceEventId === ctx.id && arrangement.status === 'accepted'
      : action.type === 'ANNOUNCE_ARRANGEMENT' ? arrangement?.public === true && event.visibility === 'public'
      : state.encounter === null);
  if (!successful) { end(ctx, record, 'The retried proposal did not pass its ordinary rules'); return; }
  save(ctx, { ...record, step: record.step + 1,
    ...(action.type === 'CROSS_PATHS' ? { meetingEventId: ctx.id } : {}),
    ...(action.type === 'END_ENCOUNTER' ? { status: 'recovered', endedAt: now, endEventId: ctx.id } : {}) });
}

/** Call before dispatching a tagged native action. A false result must bypass
 * its ordinary reducer. Untagged actions are unaffected. */
export function guardOutingRecoveryAction(ctx) {
  if (!ctx.action.outingRecoveryId || OUTING_RECOVERY_EVENT_TYPES.includes(ctx.action.type)) return true;
  const record = of(ctx.state).opportunities[ctx.action.outingRecoveryId], row = owned(ctx);
  if (!record || !row || record.token !== ctx.action.outingRecoveryToken
    || record.status !== 'retrying' || NATIVE.indexOf(ctx.action.type) !== record.step) {
    ctx.ops.skip('No matching owned outing retry'); return false;
  }
  const reason = eligible(ctx, record, { allowOwnArrangement: record.step > 1 });
  const changedEncounter = record.step > 0 && ctx.state.encounter?.eventId !== record.meetingEventId;
  if (reason || changedEncounter) {
    consume(ctx, row); end(ctx, record, reason ?? 'The meeting has already ended or changed');
    ctx.ops.skip('The retried outing is no longer available'); return false;
  }
  consume(ctx, row);
  ctx.event.causedBy.push(record.originEventId, ...record.blockers.map(blocker => blocker.completionEventId));
  return true;
}

export function resolveOutingRecoveryAction(ctx) {
  if (!OUTING_RECOVERY_EVENT_TYPES.includes(ctx.action.type)) return false;
  const record = of(ctx.state).opportunities[ctx.action.outingRecoveryId], row = owned(ctx);
  if (!record || !row || record.token !== ctx.action.outingRecoveryToken) {
    ctx.ops.skip('No matching owned outing recovery'); return true;
  }
  // Terminal copies and expired completions are side-effect-free, including
  // the expiry action left behind by an already recovered proposal.
  if (!ACTIVE.has(record.status)) { ctx.ops.skip('The outing recovery is already terminal'); return true; }
  if (ctx.action.type === 'OUTING_RECOVERY_EXPIRE') {
    consume(ctx, row); end(ctx, record, 'The original departure window closed', 'expired'); return true;
  }
  if (record.status !== 'ready' || record.attempts !== 0 || !record.blockers.every(blocker => blocker.completionEventId)) {
    ctx.ops.skip('The blocking work has not completed'); return true;
  }
  const reason = eligible(ctx, record);
  consume(ctx, row);
  ctx.event.causedBy.push(record.originEventId, ...record.blockers.map(blocker => blocker.completionEventId));
  if (reason) { end(ctx, record, reason); ctx.ops.skip('The original outing is no longer available'); return true; }
  const next = { ...record, status: 'retrying', attempts: 1, step: 0, retryEventId: ctx.id };
  save(ctx, next);
  const start = ctx.now + 1;
  const native = [
    { actors: ['goaden', 'ashai'], area: 'common_room' },
    { actor: 'ashai', guest: 'goaden', arrangementKey: record.spec.arrangementKey,
      activity: record.spec.kind, startAt: record.spec.departureAt, duration: record.spec.duration,
      ...(record.spec.requiredFact ? { requiredFact: record.spec.requiredFact, fallback: null } : {}) },
    { arrangementKey: record.spec.arrangementKey }, { arrangementKey: record.spec.arrangementKey }, {},
  ];
  NATIVE.forEach((type, index) => issue(ctx, next, type, `step-${index}`, start + index * MIN, native[index]));
  ctx.event.payload = { outcome: 'proposal_window_recovered' };
  return true;
}

export function assertOutingRecovery(state) {
  const current = state.outingRecovery;
  if (!current || !current.opportunities || !current.issued) throw new Error('Missing outing recovery state');
  for (const [id, record] of Object.entries(current.opportunities)) {
    if (record.id !== id || !record.originEventId || record.token !== record.originEventId
      || !['waiting', 'ready', 'retrying', 'recovered', 'abandoned', 'expired'].includes(record.status)
      || !Number.isInteger(record.attempts) || record.attempts < 0 || record.attempts > 1
      || !Number.isInteger(record.step) || record.step < 0 || record.step > 5
      || record.blockers.length < 1 || record.blockers.length > 2
      || new Set(record.blockers.map(blocker => blocker.who)).size !== record.blockers.length
      || record.blockers.some(blocker => !['goaden', 'ashai'].includes(blocker.who)
        || !blocker.activityId || !Number.isFinite(blocker.expectedUntil))
      || VENUES[record.spec.kind] !== record.spec.venue
      || record.spec.departureAt !== record.createdAt + 40 * MIN
      || record.status === 'recovered' && (record.attempts !== 1 || record.step !== 5))
      throw new Error('Invalid bounded outing recovery');
  }
  for (const [id, row] of Object.entries(current.issued)) {
    const record = current.opportunities[row.action.outingRecoveryId];
    if (!record || row.action.id !== id || row.action.outingRecoveryToken !== record.token
      || ![...NATIVE, ...OUTING_RECOVERY_EVENT_TYPES].includes(row.action.type)
      || typeof row.consumed !== 'boolean' || !row.sourceEventId)
      throw new Error('Invalid outing retry ownership');
  }
}
