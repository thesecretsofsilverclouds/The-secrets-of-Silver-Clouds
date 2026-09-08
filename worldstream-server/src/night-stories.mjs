import { createHash } from 'node:crypto';
import { atLondon, londonDate, nextLondonDay, MINUTE_MS as MIN } from './time.mjs';
import { fatigueAt } from './abilities.mjs';

// Canon anchors: the MI6 quarters/connected barracks (manuscript physical
// pp.63–64), summons to the assembly room (p.71), surveillance operations
// (p.89), and exhaustion after sustained work/training (pp.161–167).
// This authored ambient episode checks an existing advisory/dispatch record.
// It creates no enemy, power, injury, field deployment or Book One revelation.
export const NIGHT_EVENT_TYPES = Object.freeze(['NIGHT_WINDOW', 'NIGHT_CALL', 'NIGHT_CONTACT_ASHAI',
  'NIGHT_ASHAI_CHOICE', 'NIGHT_WORK_BEGIN', 'NIGHT_WORK_END', 'NIGHT_DEADLINE',
  'NIGHT_RETURN', 'NIGHT_RECOVERED', 'NIGHT_DEBRIEF']);
export const NIGHT_FACT_KINDS = Object.freeze(['night_request', 'night_result', 'night_recovery']);
export const NIGHT_RULES = Object.freeze({ rarityDivisor: 4, cooldownDays: 4, sourceMaxAgeMs: 36 * 60 * MIN,
  windowTime: '02:17', maximumEpisodes: 8, maximumIssued: 160 });
const TYPES = new Set(NIGHT_EVENT_TYPES), WHO = ['goaden', 'ashai'];
const FREE = new Set(['sleeping', 'resting', 'quiet_break', 'waiting', 'unhurried_time']);
const SOCIAL = new Set(['unhurried_time', 'waiting', 'quiet_break', 'eating', 'listening_to_music', 'watching_tv', 'gaming']);
const name = who => who === 'goaden' ? 'Goaden' : 'Ashai';
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const roll = value => parseInt(hash(value).slice(0, 8), 16);
const of = state => state.nightStories ?? initialNightStories();
const instance = (state, id) => of(state).episodes[id];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const known = (state, who, factKey, now) => state.characters?.[who]?.knowledge?.some(memory => memory.factKey === factKey
  && memory.learnedAt <= now && state.facts?.[factKey]?.createdAt <= now
  && memory.sourceEventId === state.facts[factKey].sourceEventId);
const shape = a => ({ id: a.id, type: a.type, version: a.version, dueAt: a.dueAt, day: a.day,
  priority: a.priority, actors: a.actors, actor: a.actor ?? null,
  episodeId: a.episodeId ?? null, token: a.token ?? null, originEventId: a.originEventId ?? null });
const afterDays = (day, count) => { for (let i = 0; i < count; i++) day = nextLondonDay(day); return day; };

// ------------------------------------------------- the night prank sequence
//
// OWNERSHIP, stated because the split is the point:
//
//   The Moment Engine owns **eligibility, trigger and callback provenance** —
//   whether Yukon is awake, in the quarters, reckless, has actually seen the
//   face he intends to wear, and whether the world is dark. It produces one
//   Moment (the figure in the doorway) and the callback seed.
//
//   This layer owns **the sequence** — a chase across rooms, several beats,
//   two people moving and a third opening a door. That is a scene, and a scene
//   is not a Moment.
//
// **Declared, not scheduled.** Nothing here is wired into `nightDayActions` or
// `resolveNightAction`, and no action is issued from it. It cannot fire until
// two things are decided: the consequence that closes it (see `closesWith`),
// and an author pass on the copy.
//
// **The dialogue below is provisional.** It came out of brainstorming, not the
// normal authoring process, and it is kept because the *behavioural beats* are
// right — the register shift, the tell, the chase, the refusal to get involved.
// Every `line` here is a placeholder for a surface that must be authored and
// canon-checked before any of it reaches a reader.
export const PRANK_SCENE = Object.freeze({
  id: 'night_prank_chase',
  version: 1,
  trigger: 'moment-engine:NIGHT_PRANK',
  provisionalCopy: true,
  rooms: Object.freeze(['quarters', 'corridors']),
  // The artwork already exists and is already registered: `mi6_quarters`
  // (mi6bedroom.jpg) and `mi6_corridor` (mi6corridor.jpg) in
  // src/cinematic-assets.mjs. Named here rather than selected by tag, because
  // this scene knows exactly which two rooms it needs — and because widening
  // the corridor's `suitableFor` to admit a comic register would change what
  // the generic cinematic selector reaches for everywhere else.
  backgrounds: Object.freeze({ quarters: 'mi6_quarters', corridors: 'mi6_corridor' }),
  beats: Object.freeze([
    { id: 'in_the_doorway', room: 'quarters', owner: 'moment-engine',
      note: 'The figure is not moving. It is not doing anything. That is the whole beat.' },
    { id: 'refusal', room: 'quarters', owner: 'night-story', speaker: 'target',
      line: '...No.', provisional: true },
    { id: 'the_tell', room: 'quarters', owner: 'moment-engine',
      note: 'The impression overshoots on the axis the real person has none of. '
        + 'That is what gives it away, and it is enforced in the grammar rather than written here.' },
    { id: 'reveal', room: 'quarters', owner: 'night-story',
      note: 'Grey for half a second, then Yukon. Reuses the borrowed plate; no new art.' },
    { id: 'pursuit_begins', room: 'quarters', owner: 'night-story', speaker: 'target',
      line: 'YOU LITTLE—', provisional: true },
    { id: 'chase', room: 'corridors', owner: 'night-story',
      note: 'The transformations are deliberately not useful. A boy who can be anything picks this.' },
    { id: 'bystander', room: 'corridors', owner: 'night-story', speaker: 'ashai',
      line: '...I am not getting involved.', provisional: true,
      note: 'A door opening far enough to establish she has seen everything, and closing.' },
    { id: 'gives_up', room: 'quarters', owner: 'night-story',
      note: 'He hides, the pursuit ends, everyone goes back to bed. The scene must be able to end here.' },
  ]),
  // The delayed consequence. Deliberately null: it is a decision, not a fixture.
  // Candidates, none chosen — Henderson finding out, a captured still reaching
  // the target, or an ordinary earned callback days later. Whatever it becomes,
  // it must be committed through the mechanism that actually owns it rather
  // than invented here to satisfy a test.
  closesWith: null,
});

/**
 * Accept a handoff from the Moment Engine. Returns the scene to run, or null.
 *
 * This does not decide *whether* the prank happens — that judgement belongs to
 * the engine and has already been made by the time a request arrives. It checks
 * only that the request is well formed and that the scene is runnable.
 */
export function nightPrankScene(request) {
  if (!request || request.scene !== PRANK_SCENE.id) return null;
  const { actor, target, disguise, rooms } = request;
  if (!actor || !target || !disguise) return null;
  if (actor === target || disguise === target || disguise === actor) return null;
  // Until a consequence is chosen the scene is declared but not runnable, and
  // saying so is better than quietly running a scene with no ending.
  if (PRANK_SCENE.closesWith === null) return { ...PRANK_SCENE, runnable: false,
    blocked: 'no consequence decided for the delayed beat' };
  return { ...PRANK_SCENE, runnable: true, actor, target, disguise,
    rooms: rooms ?? PRANK_SCENE.rooms };
}

export function initialNightStories() {
  return { version: 1, causes: [], episodes: {}, issued: {}, activeId: null, nextEligibleAt: 0, lastResult: null };
}
function save(ctx, patch) { ctx.ops.setNightStories({ ...of(ctx.state), ...patch }); }
function touch(ctx, story, patch) {
  const next = { ...story, ...patch, lastEventId: ctx.id,
    eventIds: [...new Set([...story.eventIds, ctx.id])] };
  save(ctx, { episodes: { ...of(ctx.state).episodes, [story.id]: next } }); return next;
}
function actorPatch(ctx, story, who, patch) {
  return touch(ctx, story, { participants: { ...story.participants,
    [who]: { ...story.participants[who], ...patch } } });
}

/** Capture only a committed public institutional cause, never viewer state. */
export function recordNightCause(ctx) {
  const { event, state } = ctx;
  if (event.visibility !== 'public' || event.location !== 'mi6') return false;
  let kind = null;
  if (event.type === 'FACTION_STATUS' && (event.payload.mi6 === 'elevated' || event.payload.arcane === 'high')) kind = 'readiness_followup';
  if (event.type === 'INSTITUTION_NOTICE' && ['arcane_signature', 'elevated_alert', 'order_advisory'].includes(event.payload.notice)) kind = 'readiness_followup';
  if (['AGENDA_RESOLVE', 'AGENDA_DEADLINE'].includes(event.type)) {
    const result = state.agendas?.lastResult;
    if (result?.sourceEventId === event.id && result.requiresRecheck) kind = 'dispatch_followup';
    else if (result?.sourceEventId === event.id && !result.requiresRecheck) {
      save(ctx, { causes: of(state).causes.filter(cause => cause.kind !== 'dispatch_followup') }); return true;
    }
  }
  if (!kind || of(state).causes.some(cause => cause.eventId === event.id)) return false;
  save(ctx, { causes: [...of(state).causes, { eventId: event.id, occurredAt: ctx.now, kind, type: event.type }].slice(-6) });
  return true;
}

export function nightDayActions({ state, day, now, seed, parentActionId, parentEventId }) {
  const dueAt = atLondon(day, NIGHT_RULES.windowTime), current = of(state);
  if (!parentActionId || !parentEventId || dueAt <= now || dueAt < current.nextEligibleAt || current.activeId
    || roll(`${seed}|night-v1|${day}`) % NIGHT_RULES.rarityDivisor !== 0
    || Object.values(current.issued).some(row => row.shape.type === 'NIGHT_WINDOW' && row.shape.day === day)) return [];
  return [{ id: `${day}/night/window`, type: 'NIGHT_WINDOW', dueAt, day, priority: 26, actors: [],
    version: 1, originEventId: parentEventId }];
}
export function issueNightActions(ctx, proposals) {
  const actions = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt)
      || action.dueAt <= ctx.now || !Array.isArray(action.actors) || action.actors.length)
      throw new Error('Night actions require exact owned future scheduling');
    const current = of(ctx.state);
    if (current.issued[action.id]) continue;
    const retained = Object.entries(current.issued).filter(([, row]) => !row.consumed || row.shape.dueAt >= ctx.now - 10 * 24 * 60 * MIN);
    if (retained.length >= NIGHT_RULES.maximumIssued) throw new Error('Night action budget exceeded');
    save(ctx, { issued: { ...Object.fromEntries(retained), [action.id]: {
      shape: shape(action), sourceEventId: ctx.id, consumed: false,
    } } }); actions.push(action);
  }
  return actions;
}
function follow(ctx, story, type, suffix, dueAt, actor = null) {
  ctx.followups.push(...issueNightActions(ctx, [{ id: `${story.id}/${suffix}`, type, version: 1,
    dueAt, day: londonDate(dueAt), priority: 26, actors: [], ...(actor ? { actor } : {}),
    episodeId: story.id, token: story.token }]));
}
function available(state, who, now, allowSleep = true) {
  const actor = state.characters?.[who];
  if (!actor || actor.location !== 'mi6' || actor.journey || !FREE.has(actor.activity)
    || (!allowSleep && actor.activity === 'sleeping') || (actor.activity === 'sleeping' && actor.area !== 'quarters')) return false;
  if (Object.values(state.arrangements ?? {}).some(item => ['accepted', 'started'].includes(item.status)
    && item.party?.includes(who) && item.startAt < now + 90 * MIN && item.until > now)) return false;
  return !actor.activityUntil || actor.activityUntil <= now || ['sleeping', 'resting'].includes(actor.activity);
}
function ownsActivity(state, story, who, statuses = null) {
  const part = story.participants[who], actor = state.characters?.[who];
  return part && (!statuses || statuses.includes(part.status)) && actor && actor.location === 'mi6'
    && !actor.journey && actor.activityId === part.activityToken && actor.activity === part.activity
    && actor.area === part.area && actor.activityUntil === part.activityUntil;
}
function setActivity(ctx, story, who, activity, area, until, patch = {}) {
  ctx.ops.activity(who, activity, null, area); ctx.ops.setActor(who, 'activityUntil', until);
  return actorPatch(ctx, story, who, { ...patch, activity, area, activityUntil: until, activityToken: ctx.id });
}
function currentCause(state, now) {
  return [...of(state).causes].reverse().find(cause => cause.occurredAt < now && now - cause.occurredAt <= NIGHT_RULES.sourceMaxAgeMs
    && (cause.kind === 'dispatch_followup' ? state.agendas?.lastResult?.requiresRecheck
      && state.agendas.lastResult.sourceEventId === cause.eventId
      : state.factions?.mi6 === 'elevated' || state.factions?.arcane === 'high' || ['high', 'critical'].includes(state.pressure?.level)));
}

export function nightStoryAvailable(state, who, { atMs } = {}) {
  if (!WHO.includes(who)) return true;
  return !Object.values(of(state).episodes).some(story => story.requestedAt <= atMs
    && ownsActivity(state, story, who, ['called', 'asked', 'committed', 'working', 'returning', 'recovering']));
}
export function nightRecoveryFor(state, who, atMs) {
  const story = Object.values(of(state).episodes).find(row => row.requestedAt <= atMs
    && row.participants[who]?.status === 'recovering' && ownsActivity(state, row, who));
  if (!story) return null;
  const part = story.participants[who];
  return { since: part.recoveryStartedAt, until: part.recoveryUntil, lostSleepMinutes: part.lostSleepMinutes,
    sourceEventId: part.recoveryEventId, reason: 'overnight_response' };
}
function releaseIfDone(ctx, story) {
  if (story.result && !Object.values(story.participants).some(part => ['called', 'asked', 'committed', 'working', 'returning', 'recovering'].includes(part.status))) {
    touch(ctx, story, { phase: 'settled' }); save(ctx, { activeId: null });
  }
}
function abandonOwnedReturn(ctx, story, who, status) {
  if (story.participants[who]?.status !== status) return;
  const next = actorPatch(ctx, story, who, { status: 'interrupted', endedAt: ctx.now });
  releaseIfDone(ctx, next);
}
function nightOutside(state) {
  const code = state.weather?.code;
  if (['storm', 'heavy_rain'].includes(code)) return 'Beyond the barracks, rain swallowed the sleeping city.';
  if (code === 'light_rain') return 'A fine rain lay over London in the dark.';
  if (code === 'fog') return 'Fog had drawn the city into itself.';
  return 'London was still deep in the hours before morning.';
}
function finishResponse(ctx, story, outcome, workers) {
  if (story.result) return story;
  const text = outcome === 'resolved'
    ? 'The MI6 night check was complete. The figures agreed and its watch entry was closed.'
    : 'The MI6 night check ended with one entry still unreconciled. It was handed to the day watch for another check.';
  const factKey = `${story.id}:result`;
  const fact = ctx.ops.createFact(factKey, 'night_result', 'world', { storyId: story.id, outcome,
    entryStatus: outcome === 'resolved' ? 'closed' : 'awaiting_day_watch', presentationText: text }, null);
  const result = { outcome, factKey, sourceEventId: ctx.id, completedAt: ctx.now,
    entryStatus: outcome === 'resolved' ? 'closed' : 'awaiting_day_watch', workers: [...workers] };
  story = touch(ctx, story, { result, status: outcome, phase: 'returning' });
  save(ctx, { lastResult: { ...result, storyId: story.id } });
  for (const who of WHO) {
    const part = story.participants[who];
    if (!part) continue;
    if (workers.includes(who)) {
      ctx.ops.learn(who, fact, 'completed_night_response'); ctx.ops.useMemory(who, story.requestFactKey);
      story = setActivity(ctx, story, who, 'on_call', 'ops_room', ctx.now + 7 * MIN, { status: 'returning' });
      follow(ctx, story, 'NIGHT_RETURN', `return/${who}`, ctx.now + 7 * MIN, who);
    } else if (['called', 'asked', 'committed', 'working'].includes(part.status)) {
      story = actorPatch(ctx, story, who, { status: 'interrupted', endedAt: ctx.now });
    }
  }
  ctx.event.participants = [...workers]; ctx.event.causedBy.push(story.requestEventId, story.workEventId ?? story.requestEventId);
  ctx.event.payload = { outcome, entryStatus: result.entryStatus }; ctx.ops.publish(text);
  ctx.event.prose = outcome === 'resolved'
    ? `At last, the figures agreed. ${workers.length > 1 ? 'Goaden and Ashai' : workers.length ? name(workers[0]) : 'The watch'} had reached the end of the entry, and there was nothing left beside it to check. ${nightOutside(ctx.state)} Inside the operations room, the unfinished line could finally be closed.`
    : `The last entry would not quite agree. ${workers.length ? `${workers.map(name).join(' and ')} left the discrepancy clearly marked for the day watch` : 'The discrepancy remained marked for the day watch'}; a second check would have to finish what the night had left open. ${nightOutside(ctx.state)}`;
  releaseIfDone(ctx, story); return story;
}

export function nightEncounterActions({ state, now, parentActionId, parentEventId }) {
  if (!parentActionId || !parentEventId) return [];
  const [first, second] = WHO.map(who => state.characters[who]);
  if (!first || !second || first.journey || second.journey || first.location !== second.location
    || first.area !== second.area || WHO.some(who => !SOCIAL.has(state.characters[who].activity)
      || !nightStoryAvailable(state, who, { atMs: now }))) return [];
  const story = Object.values(of(state).episodes).filter(row => row.result && !row.debriefEventId
    && row.result.completedAt < now && now - row.result.completedAt <= 2 * 24 * 60 * MIN
    && WHO.some(who => known(state, who, row.result.factKey, now))).sort((a, b) => b.requestedAt - a.requestedAt)[0];
  if (!story || Object.values(of(state).issued).some(row => !row.consumed && row.shape.type === 'NIGHT_DEBRIEF' && row.shape.episodeId === story.id)) return [];
  return [{ id: `${parentActionId}/night/debrief`, type: 'NIGHT_DEBRIEF', version: 1,
    dueAt: now + 1, day: londonDate(now), priority: 26, actors: [],
    episodeId: story.id, token: story.token, originEventId: parentEventId }];
}

export function resolveNightAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const refuse = reason => { ops.skip(reason); return true; };
  const issuance = of(state).issued[a.id];
  if (!issuance || issuance.consumed || now !== a.dueAt || !equal(issuance.shape, shape(a))) return refuse('No owned night action');
  let story = a.episodeId ? instance(state, a.episodeId) : null;
  if (a.type !== 'NIGHT_WINDOW' && (!story || story.token !== a.token)) return refuse('No matching night response');
  event.location = 'mi6'; event.area = 'ops_room'; event.participants = [];
  save(ctx, { issued: { ...of(state).issued, [a.id]: { ...issuance, consumed: true } } });
  event.causedBy.push(issuance.sourceEventId);

  if (a.type === 'NIGHT_WINDOW') {
    const cause = currentCause(state, now), current = of(state);
    if (!cause || current.activeId || now < current.nextEligibleAt || !available(state, 'goaden', now)
      || roll(`${ctx.seed}|night-v1|${a.day}`) % NIGHT_RULES.rarityDivisor !== 0) return refuse('No rare, available night follow-up');
    const storyId = `night:${hash(`${ctx.seed}|${a.id}|${cause.eventId}`)}`;
    const requestFactKey = `${storyId}:request`;
    story = { id: storyId, version: 1, token: `${id}:night-v1`, day: a.day, status: 'active', phase: 'requested',
      requestedAt: now, requestEventId: id, requestFactKey, source: { ...cause }, lastEventId: id, eventIds: [id],
      participants: {}, workBeginsAt: now + 8 * MIN, workMinutes: roll(`${ctx.seed}|${storyId}/duration`) % 2 ? 55 : 40,
      needsSecondCheck: roll(`${ctx.seed}|${storyId}/second-check`) % 3 === 0, result: null, debriefEventId: null };
    const kept = Object.values(current.episodes).sort((a, b) => b.requestedAt - a.requestedAt).slice(0, NIGHT_RULES.maximumEpisodes - 1);
    save(ctx, { episodes: { ...Object.fromEntries(kept.map(row => [row.id, row])), [storyId]: story }, activeId: storyId,
      nextEligibleAt: atLondon(afterDays(a.day, NIGHT_RULES.cooldownDays), '00:00') });
    ops.createFact(requestFactKey, 'night_request', 'world', { storyId, causeKind: cause.kind, sourceEventId: cause.eventId,
      presentationText: 'MI6 requested a short night follow-up on its existing watch or dispatch entry.' }, atLondon(nextLondonDay(a.day), '12:00'));
    event.causedBy.push(cause.eventId); event.payload = { kind: cause.kind };
    ops.publish(story.source.kind === 'dispatch_followup'
      ? 'An unresolved dispatch entry came back to the MI6 night watch. A request went to Goaden to check it.'
      : 'An earlier MI6 advisory left a night-watch entry to check. A request went to Goaden in the quarters.');
    follow(ctx, story, 'NIGHT_CALL', 'call/goaden', now + 3 * MIN, 'goaden');
    follow(ctx, story, 'NIGHT_CONTACT_ASHAI', 'contact/ashai', now + 4 * MIN, 'ashai');
    follow(ctx, story, 'NIGHT_WORK_BEGIN', 'work', story.workBeginsAt);
    follow(ctx, story, 'NIGHT_DEADLINE', 'deadline', story.workBeginsAt + (story.workMinutes + 10) * MIN);
  } else if (a.type === 'NIGHT_CALL' || a.type === 'NIGHT_CONTACT_ASHAI') {
    const who = a.type === 'NIGHT_CALL' ? 'goaden' : 'ashai';
    if (story.result || story.phase !== 'requested' || story.participants[who] || !available(state, who, now)) return refuse('No free recipient for this request');
    if (who === 'ashai' && state.characters.ashai.activity === 'sleeping'
      && roll(`${ctx.seed}|${story.id}/contact-ashai`) % 3 !== 0) return refuse('Ashai was left asleep');
    const wasSleeping = state.characters[who].activity === 'sleeping';
    const fact = state.facts[story.requestFactKey];
    if (!fact || fact.sourceEventId !== story.requestEventId || fact.createdAt >= now) return refuse('The request has no earlier source');
    ops.learn(who, fact, 'received_night_call');
    story = setActivity(ctx, story, who, 'unhurried_time', 'quarters', story.workBeginsAt,
      { status: who === 'goaden' ? 'called' : 'asked', contactEventId: id, wakeAt: now, wasSleeping });
    event.participants = [who]; event.area = 'quarters';
    ops.publish(wasSleeping ? `${name(who)} woke to the MI6 call and received the watch-check request.`
      : `${name(who)} received the MI6 night-watch request in the quarters.`);
    event.prose = `${nightOutside(state)} ${wasSleeping ? `The call pulled ${name(who)} out of sleep` : `The call reached ${name(who)} in the quiet of the quarters`}. An unfinished ${story.source.kind === 'dispatch_followup' ? 'dispatch' : 'watch'} entry needed another pair of eyes in operations. ${wasSleeping ? 'For a moment, the room was still a room to sleep in. Then there was somewhere to be.' : 'The rest of the night had acquired a different shape.'}`;
    if (who === 'ashai') follow(ctx, story, 'NIGHT_ASHAI_CHOICE', 'choice/ashai', now + MIN, who);
  } else if (a.type === 'NIGHT_ASHAI_CHOICE') {
    if (story.result || !ownsActivity(state, story, 'ashai', ['asked']) || !known(state, 'ashai', story.requestFactKey, now))
      return refuse('Ashai cannot choose a request she has not received or cannot attend');
    const accepts = fatigueAt(state, 'ashai', now) < 3 && roll(`${ctx.seed}|${story.id}/ashai-choice`) % 3 !== 0;
    ops.useMemory('ashai', story.requestFactKey);
    if (accepts) story = actorPatch(ctx, story, 'ashai', { status: 'committed', choiceEventId: id });
    else story = setActivity(ctx, story, 'ashai', story.participants.ashai.wasSleeping ? 'sleeping' : 'resting', 'quarters', null,
      { status: 'declined', choiceEventId: id });
    event.participants = ['ashai']; event.area = 'quarters'; event.payload = { choice: accepts ? 'join' : 'decline' };
    ops.publish(accepts ? 'Ashai accepted the short watch-check request after hearing what it involved.'
      : 'Ashai declined the optional watch check and returned to rest. Goaden retained the request.');
  } else if (a.type === 'NIGHT_WORK_BEGIN') {
    if (story.result || story.phase !== 'requested' || !ownsActivity(state, story, 'goaden', ['called'])
      || !known(state, 'goaden', story.requestFactKey, now)) return refuse('Goaden no longer owns the night request');
    const workers = WHO.filter(who => ownsActivity(state, story, who, ['called', 'committed']) && known(state, who, story.requestFactKey, now));
    const endsAt = now + story.workMinutes * MIN;
    story = touch(ctx, story, { phase: 'working', workStartedAt: now, workEndsAt: endsAt, workEventId: id });
    for (const who of workers) {
      ops.useMemory(who, story.requestFactKey);
      story = setActivity(ctx, story, who, 'on_call', 'ops_room', endsAt, { status: 'working', workStartedAt: now });
    }
    event.participants = workers; event.payload = { durationMinutes: story.workMinutes };
    ops.publish(`${workers.map(name).join(' and ')} reached the operations room and began checking the unfinished watch entry.`);
    event.prose = `${workers.map(name).join(' and ')} came into operations while the rest of the barracks slept. ${workers.length > 1 ? 'Between them, the unfinished entry became two sets of figures to compare' : 'The unfinished entry waited for Goaden, line after line'}. ${nightOutside(state)} The work itself would take as long as it took.`;
    follow(ctx, story, 'NIGHT_WORK_END', 'work/end', endsAt);
  } else if (a.type === 'NIGHT_WORK_END') {
    if (story.result || story.phase !== 'working' || now !== story.workEndsAt) return refuse('No current night work to complete');
    const workers = WHO.filter(who => ownsActivity(state, story, who, ['working']) && known(state, who, story.requestFactKey, now));
    if (!workers.includes('goaden')) return refuse('The working activity was replaced; completion cannot borrow it');
    finishResponse(ctx, story, !story.needsSecondCheck || workers.includes('ashai') ? 'resolved' : 'deferred', workers);
  } else if (a.type === 'NIGHT_DEADLINE') {
    if (story.result) return refuse('The night response already has a final outcome');
    finishResponse(ctx, story, 'deferred', WHO.filter(who => ownsActivity(state, story, who, ['called', 'committed', 'working'])));
  } else if (a.type === 'NIGHT_RETURN') {
    const who = a.actor, part = story.participants[who];
    if (!story.result || !ownsActivity(state, story, who, ['returning']) || !known(state, who, story.result.factKey, now)) {
      abandonOwnedReturn(ctx, story, who, 'returning');
      return refuse('The responder no longer owns this return to rest');
    }
    const lostSleepMinutes = part.wasSleeping ? Math.ceil((now - part.wakeAt) / MIN) : 0;
    const recoveryUntil = atLondon(story.day, '08:00') + Math.min(120, Math.max(60, lostSleepMinutes + 30)) * MIN;
    const effort = state.abilities?.actors?.[who];
    if (effort) ops.setAbilities({ ...state.abilities, actors: { ...state.abilities.actors,
      [who]: { ...effort, fatigue: Math.min(6, fatigueAt(state, who, now) + Math.max(1, lostSleepMinutes / 45)),
        track: null, fatigueEventId: id } } });
    ops.setActor(who, 'conditions', [...state.characters[who].conditions.filter(condition => condition.nightStoryId !== story.id),
      { kind: 'ordinary_fatigue', since: now, until: recoveryUntil, sourceEventId: id, nightStoryId: story.id }]);
    story = setActivity(ctx, story, who, 'sleeping', 'quarters', recoveryUntil, { status: 'recovering',
      lostSleepMinutes, recoveryUntil, recoveryStartedAt: now, recoveryEventId: id });
    story = touch(ctx, story, { phase: 'recovering' });
    event.area = 'quarters'; event.participants = [who]; event.payload = { lostSleepMinutes, recoveryUntil };
    ops.useMemory(who, story.result.factKey);
    ops.publish(`${name(who)} returned to the quarters after the night check. The early morning routine would have to wait.`);
    event.prose = `${name(who)} made it back to the quarters with ${story.result.outcome === 'resolved' ? 'the watch entry finally closed' : 'the remaining discrepancy handed over'}. ${nightOutside(state)} ${lostSleepMinutes
      ? 'Sleep came back in the place the call had torn out of it. Morning could ask for the missing hour later.'
      : 'The night had taken its share of work. There was finally room in what remained of it for sleep.'}`;
    follow(ctx, story, 'NIGHT_RECOVERED', `recovered/${who}`, recoveryUntil, who);
  } else if (a.type === 'NIGHT_RECOVERED') {
    const who = a.actor, part = story.participants[who];
    if (!story.result || !ownsActivity(state, story, who, ['recovering']) || now !== part?.recoveryUntil) {
      abandonOwnedReturn(ctx, story, who, 'recovering');
      return refuse('The protected sleep was replaced; this recovery cannot claim it');
    }
    ops.useMemory(who, story.result.factKey);
    const fact = ops.createFact(`${story.id}:recovery:${who}`, 'night_recovery', who,
      { storyId: story.id, lostSleepMinutes: part.lostSleepMinutes, recoveredAt: now,
        presentationText: `${name(who)} resumed the morning later because of the completed night-watch response.` }, null);
    ops.learn(who, fact, 'experienced_recovery');
    ops.setActor(who, 'conditions', state.characters[who].conditions.filter(condition => condition.nightStoryId !== story.id));
    story = setActivity(ctx, story, who, 'unhurried_time', 'quarters', null, { status: 'recovered', recoveredAt: now });
    event.area = 'quarters'; event.participants = [who]; event.payload = { lostSleepMinutes: part.lostSleepMinutes };
    ops.publish(`${name(who)} got up later after the night check. Its ${story.result.outcome === 'resolved' ? 'closed entry' : 'day-watch handover'} remained in the record.`);
    releaseIfDone(ctx, story);
  } else if (a.type === 'NIGHT_DEBRIEF') {
    const [first, second] = WHO.map(who => state.characters[who]);
    const source = WHO.find(who => story.result && known(state, who, story.result.factKey, now));
    if (!source || story.debriefEventId || first.journey || second.journey || first.location !== second.location
      || first.area !== second.area || WHO.some(who => !SOCIAL.has(state.characters[who].activity)
        || !nightStoryAvailable(state, who, { atMs: now }))) return refuse('No eligible shared recollection of the night result');
    const fact = state.facts[story.result.factKey]; ops.useMemory(source, fact.key);
    for (const who of WHO) if (!known(state, who, fact.key, now)) ops.learn(who, fact, 'heard_night_response_result');
    touch(ctx, story, { debriefEventId: id });
    event.location = first.location; event.area = first.area; event.participants = [...WHO];
    event.payload = { outcome: story.result.outcome };
    ops.publish(`${name(source)} brought the night check up when they met again. ${story.result.outcome === 'resolved'
      ? 'Both now knew its watch entry had closed.' : 'Both now knew the outstanding entry had gone to the day watch.'}`);
    const lostSleep = Object.values(story.participants).some(part => part.lostSleepMinutes > 0);
    event.prose = `The night came back into the conversation through ${name(source)}. ${story.result.outcome === 'resolved'
      ? `The figures had agreed in the end; the watch entry was closed. It was a small enough ending to tell in a few words, for something that had taken ${lostSleep ? 'so much sleep' : 'so much of the night'}.`
      : 'One entry was still waiting for the day watch. The work had ended, but the loose end had followed them into the morning.'} Now neither of them had to guess how it had finished.`;
  }
  return true;
}

export function publicNightStories(state, now) {
  return Object.values(of(state).episodes).filter(story => story.requestedAt <= now)
    .sort((a, b) => b.requestedAt - a.requestedAt).slice(0, 2).map(story => ({ id: story.id,
      title: story.source.kind === 'dispatch_followup' ? 'An unfinished night entry' : 'The night-watch follow-up',
      description: story.phase === 'settled'
        ? `${story.result?.outcome === 'resolved' ? 'A late MI6 check closed its watch entry.' : 'A late MI6 check left an entry for the day watch.'}${Object.values(story.participants).some(part => part.lostSleepMinutes > 0)
          ? ' The lost sleep reshaped the following morning.' : Object.values(story.participants).some(part => part.recoveredAt)
            ? ' The responders took a later start after resting.' : ''}`
        : story.phase === 'recovering' ? 'The night check is over. The responders are resting before a later start.'
          : story.phase === 'returning' ? 'The night watch has its answer. The responders are returning to the quarters.'
            : story.phase === 'working' ? 'An unfinished MI6 entry has brought work into the small hours.'
              : 'An earlier MI6 report has left something for the night watch to check.',
      location: 'mi6', status: story.phase === 'settled' ? story.status : 'active', phase: story.phase,
      startedAt: story.requestedAt, openedAt: story.requestedAt,
      eventId: story.result?.sourceEventId ?? story.requestEventId,
      ...(story.result ? { outcome: story.result.outcome, entryStatus: story.result.entryStatus, completedAt: story.result.completedAt } : {}),
      recovering: WHO.filter(who => story.participants[who]?.status === 'recovering').map(who => ({ id: who,
        until: story.participants[who].recoveryUntil })),
    }));
}
export function assertNightStories(state) {
  const current = state.nightStories;
  if (!current || current.version !== 1 || !Array.isArray(current.causes) || current.causes.length > 6
    || !current.episodes || !current.issued || Object.keys(current.episodes).length > NIGHT_RULES.maximumEpisodes
    || Object.keys(current.issued).length > NIGHT_RULES.maximumIssued || !Number.isSafeInteger(current.nextEligibleAt))
    throw new Error('Invalid bounded night state');
  if (current.activeId && !current.episodes[current.activeId]) throw new Error('Unknown active night response');
  for (const story of Object.values(current.episodes)) {
    if (story.version !== 1 || !['active', 'resolved', 'deferred'].includes(story.status)
      || !['requested', 'working', 'returning', 'recovering', 'settled'].includes(story.phase)
      || !story.source?.eventId || story.source.occurredAt >= story.requestedAt
      || ![40, 55].includes(story.workMinutes) || Object.keys(story.participants).some(who => !WHO.includes(who)))
      throw new Error('Invalid night episode');
    if (story.result && (story.result.outcome !== story.status || !['closed', 'awaiting_day_watch'].includes(story.result.entryStatus)
      || story.result.completedAt <= story.requestedAt || state.facts[story.result.factKey]?.sourceEventId !== story.result.sourceEventId))
      throw new Error('Night result lacks its committed factual source');
    for (const [who, part] of Object.entries(story.participants)) {
      if (!['called', 'asked', 'committed', 'declined', 'working', 'returning', 'recovering', 'recovered', 'interrupted'].includes(part.status)
        || !known(state, who, story.requestFactKey, part.wakeAt)) throw new Error('Night participation lacks explicit request knowledge');
      if (['recovering', 'recovered'].includes(part.status) && (!Number.isInteger(part.lostSleepMinutes) || part.lostSleepMinutes < 0
        || part.recoveryUntil <= part.recoveryStartedAt || !story.result)) throw new Error('Night recovery lacks a real cost');
    }
  }
}
