import { createHash } from 'node:crypto';
import { SIDE_CHARACTERS, LEGION_CAST, OUTSIDE_CAST, guardianOf } from './cast.mjs';
import { VENUE_GUESTS } from './venues.mjs';
import { areaOf, placePhrase } from './places.mjs';
import { daypart } from './sky.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from './time.mjs';
import { supportingAvailability as agendaAvailable } from './faction-agendas.mjs';
import { competingCommitments } from './intent.mjs';
import { offscreenAvailable, offscreenEncounterInterest } from './offscreen-lives.mjs';
import { supportingRelationshipChoice, recordRelationshipChoice, relationshipChoicePresentation } from './relationship-choices.mjs';

// Authored ambient staging, not extra manuscript events. Cast/room permissions
// remain those of cast.mjs and venues.mjs; PHASE0-CONTINUITY's named Legion/Zara
// exceptions do not release other future knowledge. Hammond never speaks.
// Guardians follow their owner; Anarchy/Balthazar reserve one physical presence.
export const SUPPORTING_EVENT_TYPES = Object.freeze(['SUPPORTING_COMMITMENT', 'SUPPORTING_ENCOUNTER',
  'SUPPORTING_OUTCOME', 'SUPPORTING_DEADLINE', 'SUPPORTING_CALLBACK']);
export const SUPPORTING_FACT_KINDS = Object.freeze(['supporting_promise', 'supporting_result', 'supporting_response']);
export const SUPPORTING_IDS = Object.freeze([...Object.keys(SIDE_CHARACTERS), ...Object.keys(LEGION_CAST), ...Object.keys(OUTSIDE_CAST)]);
export const SUPPORTING_RULES = Object.freeze({ version: 1, dailyLimit: 2, interval: 6 * 60 * MIN,
  venueInterval: 60 * MIN,
  individualCooldown: 72 * 60 * MIN, callbackDelay: 18 * 60 * MIN, encounterDelay: 4 * MIN,
  outcomeDelay: 9 * MIN, deadlineDelay: 12 * MIN, retainedStories: 24, retainedActions: 128 });
const TYPES = new Set(SUPPORTING_EVENT_TYPES), IDS = new Set(SUPPORTING_IDS);
const ACTIVE = new Set(['promised', 'met', 'interrupting']);
const OUTCOMES = new Set(['kept', 'missed', 'cut_short']);
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const cast = id => SIDE_CHARACTERS[id] ?? LEGION_CAST[id] ?? OUTSIDE_CAST[id];
const actorName = id => id === 'goaden' ? 'Goaden' : 'Ashai';
const unit = id => ['anarchy', 'balthazar'].includes(id) ? ['anarchy', 'balthazar'] : [id];
const unitKey = id => unit(id).join('+');
const of = state => state.supportingStories ?? initialSupportingStories();
const known = (person, key, source, now) => person?.knowledge?.some(memory => memory.factKey === key
  && memory.sourceEventId === source && memory.learnedAt <= now
  && (memory.validUntil == null || memory.validUntil > now));
const ordinary = new Set(['unhurried_time', 'gaming', 'eating', 'waiting', 'quiet_break', 'listening_to_music',
  'watching_television', 'visiting_enchanted_ink', 'at_the_silver_spoon', 'walking_the_city']);
const VISIT_ACTIVITY = { ink_visit: ['enchanted_ink', 'visiting_enchanted_ink'],
  cafe_outing: ['cafe', 'at_the_silver_spoon'], city_walk: ['big_ben_plaza', 'walking_the_city'] };
const inSceneSession = (state, id, atMs) => {
  return [state.sceneBank?.session, state.arcs?.session].some(session =>
    session && session.startAt <= atMs && atMs < session.until && session.cast?.includes(id));
};

export function initialSupportingStories() {
  return { version: 1, instances: {}, issued: {}, counts: {}, nextEligibleAt: 0, lastCallbackAt: null,
    appearances: {}, rapport: {}, lastChoices: {}, people: Object.fromEntries(SUPPORTING_IDS.map(id => [id, { knowledge: [] }])) };
}

export function supportingStoryAvailability(state, id, { atMs } = {}) {
  if (!IDS.has(id) || !Number.isSafeInteger(atMs)) return false;
  return availabilityExcept(state, id, atMs);
}
export function supportingLeadAvailable(state, actor, { atMs } = {}) {
  const id = typeof actor === 'string' ? actor : actor?.id;
  return Number.isSafeInteger(atMs) && !inSceneSession(state, id, atMs) && !Object.values(of(state).instances).some(story => story.lead === id
    && ACTIVE.has(story.status) && story.openedAt <= atMs && atMs < story.deadlineAt);
}
function availabilityExcept(state, id, atMs, ownId = null) {
  return !unit(id).some(member => inSceneSession(state, member, atMs))
    && !Object.values(of(state).instances).some(story => story.id !== ownId && ACTIVE.has(story.status)
    && story.guests.some(guest => unit(id).includes(guest)) && story.openedAt <= atMs && atMs < story.deadlineAt);
}

function hostEligible(state, lead, now, ownKey = null, canUseActor = () => true, until = now + SUPPORTING_RULES.deadlineDelay) {
  const actor = state.characters?.[lead], room = actor && areaOf(actor.location, actor.area);
  const conflicts = actor ? competingCommitments(state, lead, now, until, ownKey).filter(arrangement => {
    const visit = VISIT_ACTIVITY[arrangement.activity];
    // A guest encounter can be part of the currently running venue visit. Only
    // that exact started activity is exempt; future travel, another promise or
    // an appointment still conflicts. Its published activity end bounds us.
    return !(visit && visit[0] === actor.location && visit[1] === actor.activity && arrangement.public
      && arrangement.status === 'started' && arrangement.startedEventId === actor.activityId
      && Number.isSafeInteger(actor.activityUntil) && actor.activityUntil >= until);
  }) : [];
  return Boolean(actor && !actor.journey && !inSceneSession(state, lead, now) && ordinary.has(actor.activity) && room?.social
    && room.dayparts.includes(daypart(now)) && daypart(now) !== 'small_hours'
    && canUseActor(lead, now) !== false
    && !(state.encounter?.until > now && actor.location === 'mi6' && actor.area === state.encounter.area)
    && !conflicts.length);
}

function permitted(state, id, lead, now) {
  const actor = state.characters[lead], part = daypart(now), person = cast(id);
  if (!person) return false;
  if (person.attachedTo) return person.attachedTo === lead && person.dayparts.includes(part);
  if (actor.location === 'mi6') {
    if (SIDE_CHARACTERS[id]) return person.areas?.includes(actor.area) && person.dayparts.includes(part);
    // Existing Legion visits are received in the shared MI6 encounter rooms.
    if (LEGION_CAST[id]) return ['common_room', 'gaming_room'].includes(actor.area)
      && ['midday', 'evening', 'night'].includes(part) && lead === 'goaden';
    return id === 'zara' && ['common_room', 'corridors'].includes(actor.area)
      && ['morning', 'midday', 'evening'].includes(part);
  }
  if (actor.location === 'sanctuary') return Boolean(LEGION_CAST[id]) && lead === 'goaden'
    && ['midday', 'evening', 'night'].includes(part);
  return actor.area === 'venue' && (VENUE_GUESTS[actor.location] ?? []).includes(id)
    && ['midday', 'evening'].includes(part);
}

export function eligibleSupportingGuests(state, lead, now, { ownStory = null, canUseActor } = {}) {
  if (!hostEligible(state, lead, now, ownStory?.arrangementKey, canUseActor,
    ownStory && ACTIVE.has(ownStory.status) ? ownStory.deadlineAt : now + SUPPORTING_RULES.deadlineDelay)) return [];
  return SUPPORTING_IDS.filter(id => permitted(state, id, lead, now) && unit(id).every(member =>
    agendaAvailable(state, member, { atMs: now }) && availabilityExcept(state, member, now, ownStory?.id)
      && offscreenAvailable(state, member, { atMs: now, location:state.characters[lead].location,
        until: ownStory?.deadlineAt ?? now + SUPPORTING_RULES.deadlineDelay })));
}

export function noteSupportingAppearance(ctx, ids) {
  // Call only for an actual published appearance, never an invitation/roll.
  const present = [...new Set(ids.filter(id => IDS.has(id)).flatMap(unit))].filter(id => {
    const owner = SIDE_CHARACTERS[id]?.attachedTo;
    return !owner || ctx.event.participants?.includes(owner);
  });
  if (!present.length || ctx.event.visibility !== 'public') return;
  const current = of(ctx.state), appearances = { ...current.appearances };
  for (const id of present) appearances[id] = { at: ctx.now, eventId: ctx.id,
    count: (appearances[id]?.count ?? 0) + (appearances[id]?.eventId === ctx.id ? 0 : 1) };
  ctx.ops.setSupportingStories({ ...current, appearances });
}

function shape(action) { return { type: action.type, dueAt: action.dueAt, priority: action.priority,
  day: action.day, version: action.version, storyId: action.storyId ?? null, token: action.token ?? null,
  actor: action.actor ?? null, actors: action.actors ?? [] }; }
export function issueSupportingActions(ctx, proposals) {
  const actions = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt) || action.dueAt <= ctx.now)
      throw new Error('Supporting action must be owned and strictly future');
    const current = of(ctx.state); if (current.issued[action.id]) continue;
    const issued = Object.fromEntries(Object.entries(current.issued).filter(([, row]) => row.shape.dueAt >= ctx.now - 4 * 24 * 60 * MIN));
    if (Object.keys(issued).length >= SUPPORTING_RULES.retainedActions) throw new Error('Supporting action budget exceeded');
    issued[action.id] = { shape: shape(action), sourceEventId: ctx.id, consumed: false };
    ctx.ops.setSupportingStories({ ...current, issued }); actions.push(action);
  }
  return actions;
}
const proposal = (id, dueAt, type = 'SUPPORTING_COMMITMENT', extra = {}) => ({ id, dueAt, type,
  priority: 28, day: londonDate(dueAt), version: 1, actors: [], ...extra });
export function supportingDayActions({ state, day, now, parentActionId, parentEventId }) {
  if (!parentActionId || !parentEventId) return [];
  return ['12:34', '19:06'].map(time => proposal(`${day}/supporting/${time.replace(':', '')}`, atLondon(day, time)))
    .filter(action => action.dueAt > now && !of(state).issued[action.id]);
}
export function supportingEncounterActions({ state, now, parentActionId, parentEventId, canUseActor }) {
  if (!parentActionId || !parentEventId || Object.values(of(state).issued).some(row => !row.consumed
    && row.shape.type === 'SUPPORTING_COMMITMENT' && row.shape.dueAt > now && row.shape.dueAt <= now + MIN)) return [];
  if (!['goaden', 'ashai'].some(lead => eligibleSupportingGuests(state, lead, now, { canUseActor }).length)) return [];
  const current = of(state), hasCallback = Object.values(current.instances).some(story => story.result && !story.callbackRequestedAt
    && now - story.completedAt >= SUPPORTING_RULES.callbackDelay);
  if (now < current.nextEligibleAt && !hasCallback && !spareVenueWindow(state, now, canUseActor)) return [];
  return [proposal(`${parentActionId}/supporting`, now + 1)];
}
function spareVenueWindow(state, now, canUseActor) {
  // A lunchtime MI6 pause must not veto every real afternoon outing. Once an
  // actor has actually reached a different approved venue, one hour of spacing
  // permits the remaining daily slot. This never creates travel or guests on
  // demand, and per-person cooldown/least-seen selection still apply.
  const last = Object.values(of(state).instances).sort((a, b) => b.openedAt - a.openedAt)[0];
  if (!last || now - last.openedAt < SUPPORTING_RULES.venueInterval) return false;
  return ['goaden', 'ashai'].some(lead => VENUE_GUESTS[state.characters[lead]?.location]
    && state.characters[lead].location !== last.location
    && eligibleSupportingGuests(state, lead, now, { canUseActor }).length);
}
function save(ctx, patch) { ctx.ops.setSupportingStories({ ...of(ctx.state), ...patch }); }
function touch(ctx, story, patch = {}) {
  const next = { ...story, ...patch, lastEventId: ctx.id,
    causalEventIds: [...new Set([...story.causalEventIds, ctx.id])] };
  save(ctx, { instances: { ...of(ctx.state).instances, [story.id]: next } }); return next;
}
function follow(ctx, story, type, suffix, at) {
  ctx.followups.push(...issueSupportingActions(ctx, [proposal(`${story.id}/${suffix}`, at, type,
    { storyId: story.id, token: story.token })]));
}
function publication(ctx, story, description, prose = null, guestPresent = ready(ctx, story)) {
  ctx.event.location = story.location; ctx.event.area = story.area;
  ctx.event.participants = stateAtStory(ctx.state, story) ? [story.lead] : [];
  const guardians = ctx.event.participants.map(guardianOf).filter(Boolean);
  ctx.event.payload = { supportingStoryId: story.id, cast: [...new Set([...ctx.event.participants, ...(guestPresent ? story.guests : []), ...guardians])],
    family: story.family, ...(story.result ? { outcome: story.result.outcome } : {}) };
  ctx.ops.publish(description); if (prose) ctx.event.prose = prose;
}
function stateAtStory(state, story) {
  const actor = state.characters[story.lead];
  return actor?.location === story.location && actor.area === story.area && !actor.journey && actor.activity !== 'sleeping';
}
function ready(ctx, story) {
  return stateAtStory(ctx.state, story) && eligibleSupportingGuests(ctx.state, story.lead, ctx.now,
    { ownStory: story, canUseActor: ctx.ops.actorAvailable }).includes(story.guest);
}
function note(ctx, story) { noteSupportingAppearance(ctx, [...story.guests, ...ctx.event.participants.map(guardianOf).filter(Boolean)]); }
function supportKnowledge(ctx, story, key, source) {
  const current = of(ctx.state), people = { ...current.people };
  for (const id of story.guests) if (!known(people[id], key, source, ctx.now)) people[id] = { ...people[id],
    knowledge: [...people[id].knowledge, { factKey: key, sourceEventId: source, acquisitionEventId: ctx.id,
      learnedAt: ctx.now, validUntil: null }].slice(-12) };
  save(ctx, { people });
}

// One noun was doing the work of four sentences here, and that is why the whole
// system read as nothing. `family` was substituted into "set aside a short
// interval for X", "their X was finished within the agreed window", "they began
// the X they had agreed to" and "returned to the earlier X" — so it had to be a
// noun vague enough to survive all four, and "an unhurried interval" is what you
// get. Measured across seventy days: eighteen of eighteen commitment lines
// tripped the vagueness audit, and sixteen named no place at all.
//
// So each guest gets written sentences per stage. Two rules came out of fixing
// it, and the second was learnt the hard way on the live page:
//
//   1. Name the work and give it a physical detail. A reader should be able to
//      picture the room, not merely be told a promise was made.
//   2. Never name the room in the sentence. `p` is the place, passed in from the
//      story itself. Zara, Gabriel, Truth, Rose and the Legion can all be met in
//      several places, and a hardcoded "the lunch hall" published itself
//      underneath an event whose own location line read "The Silver Spoon Cafe".
//      Only the MI6-bound staff — Yukon at his screen, Davis at operations,
//      Hammond at his corner table — may assume where they are, and even they
//      take `p` where the room could differ.
//
// `began` deliberately does not restate `agreed`. They publish minutes apart and
// a reader was getting the same handshake twice.
const FAMILIES = {
  yukon: { subject: 'one more go at the game',
    wants: 'Yukon wanted company for one more run at the section that keeps beating him.',
    agreed: (n, p) => `${n} pulled the other chair round in ${p} and gave it ten minutes, which both of them treated as optimistic.`,
    began: (n, p) => `Yukon had the section queued up before ${n} had finished sitting down.`,
    kept: (n, p) => `They got through the ten minutes and most of the section. Yukon called the rest a formality, and ${n} let him have it.`,
    again: (n, p) => `The game came up again. Yukon still had the same section, and ${n} still had the same opinion about it.` },
  henderson: { subject: 'a question about the rota',
    wants: 'General Henderson had a question about next week’s rota and wanted it settled standing up.',
    agreed: (n, p) => `${n} stopped in ${p} rather than make an appointment of it. Henderson had the folder open before either of them sat down, which neither of them did.`,
    began: (n, p) => `Henderson was where he said he would be, in ${p}, with the folder still open at the same page.`,
    kept: (n, p) => `The rota question took four minutes and the answer fitted in one. Henderson wrote it down anyway, thanked ${n} by rank, and carried on with his rounds.`,
    again: (n, p) => `Henderson raised the rota once more. ${n} had the answer ready this time, which visibly pleased him more than the answer did.` },
  davis: { subject: 'the gap between handovers',
    wants: 'Agent Davis had twenty minutes between handovers and no intention of spending them at a desk.',
    agreed: (n, p) => `${n} took the seat opposite hers in ${p}. Davis did not look up from what she was reading, but she moved her cup to make room.`,
    began: (n, p) => `Davis had kept the other chair in ${p}, which from her is a considerable statement.`,
    kept: (n, p) => `Twenty minutes, and neither of them gave any of it away to something else. Davis checked the clock before ${n} could and went back to work with the same measured ease.`,
    again: (n, p) => `Davis had another gap between handovers. She mentioned it to ${n} the way she mentions everything, which is obliquely and while walking.` },
  kartel: { subject: 'the second chair',
    wants: 'Captain Hammond moved the second chair out from his table, which is how he asks.',
    agreed: (n, p) => `${n} sat down in ${p} without making anything of it. Hammond took a vow of silence when the Alchemical society fell and has kept it since; the chair was the whole conversation.`,
    began: (n, p) => `The chair was still out when ${n} got back to ${p}.`,
    kept: (n, p) => `They sat there for the length of a cold cup and said nothing whatsoever. ${n} left first. Hammond inclined his head, which from him is a long speech.`,
    again: (n, p) => `The second chair was out at Hammond’s table again. ${n} took it.` },
  kai: { subject: 'half an hour with Kai',
    wants: 'Kai had been on Goaden’s shoulder since six and had begun to make a point of it.',
    agreed: (n, p) => `${n} gave him the half hour and left the handheld face down. Kai relocated to the highest thing in ${p} and folded his wings, which is his version of winning.`,
    began: (n, p) => `Kai was waiting in ${p}, having never really left it.`,
    kept: (n, p) => `Half an hour, no callout, no interruptions. Kai went back to ${n}’s shoulder afterwards looking like a dragon who had proved something.`,
    again: (n, p) => `Kai made the same point again, from the same shoulder. ${n} took the hint faster this time.` },
  greah: { subject: 'a quiet half hour with Greah',
    wants: 'Greah settled on the back of the chair and glowed at Ashai until she noticed.',
    agreed: (n, p) => `${n} put everything else down. Greah moved from the chair back to the window of ${p}, where the light was better and the point was clearer.`,
    began: (n, p) => `Greah had held the same windowsill in ${p} the entire time.`,
    kept: (n, p) => `They watched the afternoon do nothing in particular for half an hour. Greah dimmed by degrees; ${n} let her.`,
    again: (n, p) => `Greah took the windowsill again and waited. ${n} came over sooner than last time.` },
  rose: { subject: 'a few minutes of not competing',
    wants: 'Rose wanted a few minutes in a room where nobody was competing for the last word.',
    agreed: (n, p) => `${n} agreed by taking the quiet end of ${p} and not starting anything. Rose approved of this to the extent of not saying so.`,
    began: (n, p) => `They took the quiet end of ${p}. Neither of them opened with anything.`,
    kept: (n, p) => `They got through the whole of it on about nine words. Rose gave ${n} the barest nod at the end, which from Rose is a standing ovation.`,
    again: (n, p) => `Rose wanted the quiet again. ${n} knew better than to ask what for.` },
  anarchy: { subject: 'a rhythm run past Goaden',
    wants: 'Anarchy wanted to run a rhythm past Goaden before taking it to Truth; Balthazar came along in the same body, as always.',
    agreed: (n, p) => `${n} gave him ten minutes in ${p}. Anarchy started drumming on the nearest flat surface before the ten minutes had officially begun.`,
    began: (n, p) => `Anarchy had not stopped drumming on the furniture in ${p} the entire time ${n} was gone.`,
    kept: (n, p) => `The rhythm got its ten minutes and a verdict. ${n} gave it, Anarchy disputed it, and Balthazar said something ancient and unhelpful from behind his own face.`,
    again: (n, p) => `Anarchy had another rhythm. ${n} had heard the last one and agreed anyway.` },
  balthazar: { subject: 'an argument older than the room',
    wants: 'Balthazar wanted the argument about timing ended, and had chosen to raise it through the body he shares.',
    agreed: (n, p) => `${n} agreed to hear it out, which is how a Demon who has witnessed the fall of three cities ends up litigating a drum fill in ${p}.`,
    began: (n, p) => `Anarchy was waiting in ${p}, and was for the moment mostly Balthazar.`,
    kept: (n, p) => `It was settled inside the window and in Balthazar’s favour, which he accepted with the graciousness of something that has waited aeons for smaller things. ${n} declined to referee a second round.`,
    again: (n, p) => `Balthazar raised it once more. ${n} pointed out that it had been settled. This was apparently not the point.` },
  gabriel: { subject: 'an opinion on a verse',
    wants: 'Gabriel wanted an opinion on the timing of a verse, with a firm limit on how many run-throughs that involved.',
    agreed: (n, p) => `${n} agreed to two run-throughs in ${p}. Gabriel began the third before anybody stopped him.`,
    began: (n, p) => `Gabriel had used the time in ${p} to add a line, which rather defeated the object.`,
    kept: (n, p) => `Two run-throughs as agreed, and a third that nobody agreed to. ${n} gave the verdict; Gabriel received it as a provisional finding pending appeal.`,
    again: (n, p) => `Gabriel had another verse and the same firm limit. ${n} did not believe in the limit either.` },
  truth: { subject: 'a few minutes without the next thing',
    wants: 'Truth wanted a few minutes in which nobody was rushing him to the next thing, which for Truth is a rare confession.',
    agreed: (n, p) => `${n} sat down with him in ${p} and let the place stay loud around them. Truth talked at half his usual volume, which is still most of a room.`,
    began: (n, p) => `Truth had held the best part of ${p} by occupying all of it.`,
    kept: (n, p) => `They got the few minutes. Truth spent them on the history of a song nobody had asked about, and ${n} let the whole thing run.`,
    again: (n, p) => `Truth wanted a few more minutes. ${n} was under no illusion about how few.` },
  // Damien has one plate and a bass. [M813]: "I'll bet my favourite bass we see
  // some fuck up" — he is the one who bets against his own crew affectionately
  // and is usually right. He does not perform; he arrives, does the thing, and
  // goes, which is what makes an hour of his company worth having.
  damien: { subject: 'a bass part that is not working',
    wants: 'Damien wanted somebody to sit through the same eight bars forty times and say honestly whether the second half was worse.',
    agreed: (n, p) => `${n} took the far end of ${p} and agreed to say nothing until asked, which Damien had specifically requested and then immediately tested.`,
    began: (n, p) => `Damien had been at the same eight bars in ${p} since before either of them arrived.`,
    kept: (n, p) => `He played it forty times and it got worse and then, at about the thirty-fifth, quietly better. ${n} said so once. Damien said "yeah" and did it again.`,
    again: (n, p) => `Damien had the second half nearly right and wanted the room back. ${n} went.` },
  emily: { subject: 'a few minutes nearby',
    wants: 'Emily wanted to stay and look at things a while longer. Nobody promised her anything beyond a few minutes in the same room.',
    agreed: (n, p) => `${n} agreed to a few minutes in ${p} and stayed within reach of the door for all of them. Emily noticed this and appeared to find it funny.`,
    began: (n, p) => `Emily was exactly where she had been in ${p}, which was somehow worse than if she had moved.`,
    kept: (n, p) => `The few minutes passed and nothing happened, which ${n} spent the rest of the day thinking about.`,
    again: (n, p) => `Emily turned up again wanting the same few minutes. ${n} gave them, and counted them.` },
  zara: { subject: 'a break from the handover',
    wants: 'Zara had a gap in the handover and wanted to spend it somewhere without screens in it.',
    agreed: (n, p) => `${n} found her a seat in ${p}. Zara brought the folder anyway and put it face down on the table, which she clearly considered a concession.`,
    began: (n, p) => `The folder was already face down when ${n} got back.`,
    kept: (n, p) => `The break lasted exactly as long as it was supposed to. Zara turned the folder back over at the minute, thanked ${n}, and went back to work.`,
    again: (n, p) => `Zara had another gap. She spent the first minute of it telling ${n} she did not have long.` },
};
// Falls back rather than throwing: an unwritten stage keeps the old phrasing,
// so adding a guest can never produce a blank line on the page.
const familyText = (guest, stage, lead, place) => FAMILIES[guest]?.[stage]?.(lead, place) ?? null;

function endingProse(story) {
  const lead = actorName(story.lead);
  return {
    yukon: `Yukon leaned forward for the last few seconds, as though the extra inch could help. The attempt ended with ${lead} still there to see it. He glanced at the time before reaching to start again. For once, the next attempt would have to wait.`,
    henderson: `Henderson let the last answer stand without turning it into another question. ${lead} had stayed for the few minutes agreed; the small matter of timing was settled. The General gave a brief nod and turned his attention back to the day.`,
    davis: `Davis checked the time before ${lead} could. There had been no grand confidence, no revelation—only a few minutes that neither of them had given away to something else. Her attention returned to the room with the same measured ease.`,
    kartel: `${lead} let the quiet last. Captain Hammond sat across the table, saying nothing, and for once the silence did not have to be filled. When their few minutes were up, he looked up. That was enough of an ending.`,
    kai: 'Kai settled his weight against Goaden and blinked slowly. Goaden kept still through the last of the pause. The little dragon had spent no words on asking, and needed none now.',
    greah: 'Greah hovered close, her glow steady through the small pause. Ashai let the minutes pass without getting ahead of them. When she stirred again, Greah was still beside her.',
    rose: `${lead} left the last gap in the conversation alone. Rose gave the smallest nod, and the quiet held. For a few minutes nobody had needed to win it.`,
    anarchy: 'Anarchy counted the last beat and stopped before finding an excuse to add another. Goaden caught the ending. Balthazar remained present through Anarchy; one body, for once without another argument about the timing.',
    balthazar: 'The final beat passed without an extension. Goaden waited a moment, but neither voice reopened the argument. Anarchy and Balthazar occupied the same small stretch of quiet as they did the same body.',
    gabriel: `Gabriel brought the verse to its end and looked straight at ${lead}. No second run had been promised. For a moment he seemed ready to find a loophole in that; then he let the ending stay an ending.`,
    truth: `Truth was still the largest presence in the conversation when the time ran out. ${lead} had stayed for all of it. He let the last words land without turning them into another invitation to linger.`,
    emily: `${lead} stayed nearby for the few minutes agreed. Emily's attention moved from one thing to another, bright and difficult to follow. The pause ended without a promise to meet again.`,
    zara: `Zara let the final moment remain free of work. ${lead} had not filled it with another request. Then she looked at the time, and the little interval ended where they had agreed it would.`,
  }[story.guest];
}

function finish(ctx, story, outcome) {
  const intact = ready(ctx, story), lead = actorName(story.lead), guest = cast(story.guest).name;
  const description = outcome === 'kept' ? (familyText(story.guest, 'kept', lead, placePhrase(story.location, story.area))
    ?? `${lead} kept the short promise with ${guest}. Their ${story.family} was finished within the agreed window.`)
    : outcome === 'cut_short' ? `${lead}’s time with ${guest} was cut short. They had met, but the small promise was left unfinished.`
      : `${lead}’s promised time with ${guest} did not come off. The short arrangement ended without the planned meeting.`;
  const key = `${story.id}:result`, fact = ctx.ops.createFact(key, 'supporting_result', story.lead,
    { storyId: story.id, guest: story.guest, outcome, presentationText: description,
      interruption: story.interruptionEventId ? { eventId: story.interruptionEventId,
        at: story.interruptedAt, reason: story.interruptionReason } : null }, null);
  // The lead knows the fate of their own promise, including their interruption.
  // An unavailable supporting figure learns it only if told in a later meeting.
  ctx.ops.learn(story.lead, fact, 'participated');
  if (intact) supportKnowledge(ctx, story, key, ctx.id);
  const rapportKey = `${unitKey(story.guest)}:${story.lead}`, prior = of(ctx.state).rapport[rapportKey]
    ?? { kept: 0, missed: 0, cutShort: 0, reliability: 0, familiarity: 0 };
  const rapport = { ...prior, [outcome === 'cut_short' ? 'cutShort' : outcome]: prior[outcome === 'cut_short' ? 'cutShort' : outcome] + 1,
    // This counts whether time was kept; an actual activity interruption is
    // not evidence of deliberate neglect. Known outcomes drive choices below,
    // never this aggregate (which can contain things a guest has not learned).
    reliability: Math.max(-3, Math.min(3, prior.reliability + (outcome === 'kept' ? 1 : story.interruptionEventId ? 0 : -1))),
    familiarity: Math.min(9, prior.familiarity + (story.encounterEventId ? 1 : 0)), eventId: ctx.id, at: ctx.now };
  save(ctx, { rapport: { ...of(ctx.state).rapport, [rapportKey]: rapport } });
  const final = touch(ctx, story, { status: outcome, completedAt: ctx.now,
    result: { outcome, factKey: key, sourceEventId: ctx.id, completedAt: ctx.now } });
  const arrangement = ctx.state.arrangements[story.arrangementKey];
  ctx.ops.setArrangement(story.arrangementKey, { ...arrangement, status: outcome === 'kept' ? 'completed' : 'broken',
    [outcome === 'kept' ? 'completionEventId' : 'brokenEventId']: ctx.id });
  ctx.event.causedBy.push(story.originEventId, story.encounterEventId, story.interruptionEventId);
  publication(ctx, final, description, outcome === 'kept' ? endingProse(story) : null, intact);
  if (intact) note(ctx, final);
  return final;
}

export function interruptSupportingStories(ctx, actorId, reason = 'activity_replaced') {
  for (const story of Object.values(of(ctx.state).instances).filter(row => ['promised', 'met'].includes(row.status) && row.lead === actorId)) {
    const next = touch(ctx, story, { status: 'interrupting', interruptionEventId: ctx.id,
      interruptedAt: ctx.now, interruptionReason: reason });
    follow(ctx, next, 'SUPPORTING_OUTCOME', `interrupted-${ctx.id}`, ctx.now + 1);
  }
}

export function resolveSupportingAction(ctx) {
  const { state, action, now, ops } = ctx;
  if (!TYPES.has(action.type)) return false;
  const refuse = reason => { ops.skip(reason); return true; };
  const current = of(state), issued = current.issued[action.id];
  if (!issued || issued.consumed || now !== action.dueAt || JSON.stringify(issued.shape) !== JSON.stringify(shape(action)))
    return refuse('No owned supporting action');
  let story = action.storyId ? current.instances[action.storyId] : null;
  if (action.type !== 'SUPPORTING_COMMITMENT' && (!story || story.token !== action.token)) return refuse('No matching supporting promise');
  if (story && action.type !== 'SUPPORTING_CALLBACK' && !ACTIVE.has(story.status)) return refuse('This promise has already ended');
  if (action.type === 'SUPPORTING_CALLBACK' && (!story.result || story.callbackEventId)) return refuse('No pending callback');
  save(ctx, { issued: { ...current.issued, [action.id]: { ...issued, consumed: true } } });
  ctx.event.causedBy.push(issued.sourceEventId);

  if (action.type === 'SUPPORTING_COMMITMENT') {
    const callback = Object.values(of(state).instances).filter(row => row.result && !row.callbackRequestedAt
      && now - row.completedAt >= SUPPORTING_RULES.callbackDelay && ready(ctx, row)
      && known(state.characters[row.lead], row.result.factKey, row.result.sourceEventId, now))
      .sort((a, b) => a.completedAt - b.completedAt || a.id.localeCompare(b.id))[0];
    if (callback && (of(state).lastCallbackAt == null || now - of(state).lastCallbackAt >= 24 * 60 * MIN)) {
      const requested = touch(ctx, callback, { callbackRequestedAt: now });
      follow(ctx, requested, 'SUPPORTING_CALLBACK', 'callback', now + 1); return true;
    }
    const date = londonDate(now);
    if (now < of(state).nextEligibleAt && !spareVenueWindow(state, now, ops.actorAvailable)
      || (of(state).counts[date] ?? 0) >= SUPPORTING_RULES.dailyLimit
      || Object.values(of(state).instances).some(row => ACTIVE.has(row.status))) return refuse('No spare supporting interval');
    const options = ['goaden', 'ashai'].flatMap(lead => eligibleSupportingGuests(state, lead, now,
      { canUseActor: ops.actorAvailable }).map(guest => ({ lead, guest })))
      .filter(({ guest }) => !Object.values(of(state).instances).some(row => unitKey(row.guest) === unitKey(guest)
        && now - row.openedAt < SUPPORTING_RULES.individualCooldown)
        && !(of(state).lastChoices?.[unitKey(guest)]?.at > now - SUPPORTING_RULES.individualCooldown))
      .map(choice => ({ ...choice, relationship: supportingRelationshipChoice(state, choice.lead, choice.guest, now) }));
    const seen = guest => Math.max(...unit(guest).map(id => of(state).appearances[id]?.at ?? -1));
    // Several experienced reasons can favour an already possible meeting.
    // The second daily slot keeps least-seen cast rotation. Hard room, work,
    // cast and 72-hour spacing rules have already filtered these candidates.
    const interest=choice=>(of(state).counts[date]??0)===0
      ? offscreenEncounterInterest(state,choice.lead,choice.guest,now) + choice.relationship.score : 0;
    options.sort((a, b) => interest(b)-interest(a)||seen(a.guest) - seen(b.guest)
      || hash(`${ctx.seed}|support-v1|${action.id}|${a.guest}|${a.lead}`).localeCompare(hash(`${ctx.seed}|support-v1|${action.id}|${b.guest}|${b.lead}`)));
    const selected = options[0]; if (!selected) return refuse('No eligible supporting character');
    const { relationship, ...choice } = selected;
    const decision = recordRelationshipChoice(ctx, relationship);
    const actor = state.characters[choice.lead], id = `support:${hash(`${ctx.id}|v1`)}`;
    save(ctx, { counts: { ...Object.fromEntries(Object.entries(of(state).counts)
      .filter(([day]) => day >= londonDate(now - 3 * 24 * 60 * MIN))),
      [date]: (of(state).counts[date] ?? 0) + 1 }, nextEligibleAt: now + SUPPORTING_RULES.interval,
      lastChoices: { ...of(state).lastChoices, [unitKey(choice.guest)]: { at: now, eventId: ctx.id,
        response: decision.response } } });
    if (decision.response === 'deferred') {
      // They meet briefly and decline another appointment. No promise, room
      // reservation or future encounter is manufactured by this no-action.
      const moment = { id, ...choice, guests: unit(choice.guest), location: actor.location,
        area: actor.area, family: FAMILIES[choice.guest].subject };
      publication(ctx, moment, `${cast(choice.guest).name} left another meeting for now.`, null, true);
      ctx.event.payload = { ...ctx.event.payload, outcome: 'deferred', relationshipChoice: decision };
      const performance = relationshipChoicePresentation(ctx.event, { ...choice,
        leadName: actorName(choice.lead), guestName: cast(choice.guest).name });
      if (!performance) throw new Error('Deferred supporting choice lacks its known history');
      ops.publish(performance.description); ctx.event.prose = performance.prose; ctx.event.lines = performance.lines;
      const response = ops.createFact(`${id}:response`, 'supporting_response', choice.lead,
        { guest: choice.guest, response: 'deferred', presentationText: performance.description }, null);
      ops.learn(choice.lead, response, 'participated'); supportKnowledge(ctx, moment, response.key, ctx.id);
      note(ctx, moment); return true;
    }
    story = { id, version: 1, token: `${ctx.id}:support-v1`, ...choice, guests: unit(choice.guest),
      relationshipChoice: decision,
      location: actor.location, area: actor.area, family: FAMILIES[choice.guest].subject, status: 'promised',
      openedAt: now, encounterAt: now + SUPPORTING_RULES.encounterDelay, outcomeAt: now + SUPPORTING_RULES.outcomeDelay,
      deadlineAt: now + SUPPORTING_RULES.deadlineDelay, originEventId: ctx.id, lastEventId: ctx.id,
      causalEventIds: [ctx.id], arrangementKey: `${id}:promise`, promiseFactKey: `${id}:promise`,
      encounterEventId: null, interruptionEventId: null, result: null, callbackEventId: null };
    const retained = Object.values(of(state).instances).sort((a, b) => b.openedAt - a.openedAt).slice(0, SUPPORTING_RULES.retainedStories - 1);
    save(ctx, { instances: { ...Object.fromEntries(retained.map(row => [row.id, row])), [id]: story } });
    const description = [FAMILIES[choice.guest].wants,
      familyText(choice.guest, 'agreed', actorName(choice.lead), placePhrase(story.location, story.area))].filter(Boolean).join(' ');
    const fact = ops.createFact(story.promiseFactKey, 'supporting_promise', choice.lead,
      { storyId: id, guest: choice.guest, presentationText: description }, story.deadlineAt + 1);
    ops.learn(choice.lead, fact, 'participated'); supportKnowledge(ctx, story, fact.key, ctx.id);
    ops.setArrangement(story.arrangementKey, { supportingStoryId: id, party: [story.lead], status: 'accepted', public: false,
      activity: 'supporting_interval', startAt: now, until: story.deadlineAt, sourceEventId: ctx.id, acceptanceEventId: ctx.id });
    publication(ctx, story, description); ctx.event.payload.relationshipChoice = decision; note(ctx, story);
    follow(ctx, story, 'SUPPORTING_ENCOUNTER', 'encounter', story.encounterAt);
    follow(ctx, story, 'SUPPORTING_OUTCOME', 'outcome', story.outcomeAt);
    follow(ctx, story, 'SUPPORTING_DEADLINE', 'deadline', story.deadlineAt);
  } else if (action.type === 'SUPPORTING_ENCOUNTER') {
    if (!ready(ctx, story) || !ops.useMemory(story.lead, story.promiseFactKey)) { finish(ctx, story, 'missed'); return true; }
    story = touch(ctx, story, { status: 'met', encounterEventId: ctx.id });
    ops.setArrangement(story.arrangementKey, { ...state.arrangements[story.arrangementKey], status: 'started', startedEventId: ctx.id });
    ctx.event.causedBy.push(story.originEventId);
    publication(ctx, story, familyText(story.guest, 'began', actorName(story.lead), placePhrase(story.location, story.area))
      ?? `${actorName(story.lead)} made it back to ${cast(story.guest).name}. They began the ${story.family} they had agreed to.`); note(ctx, story);
  } else if (action.type === 'SUPPORTING_OUTCOME' || action.type === 'SUPPORTING_DEADLINE') {
    const outcome = story.status === 'met' && ready(ctx, story) && known(state.characters[story.lead], story.promiseFactKey, story.originEventId, now)
      ? 'kept' : story.encounterEventId ? 'cut_short' : 'missed';
    finish(ctx, story, outcome);
  } else if (action.type === 'SUPPORTING_CALLBACK') {
    if (!ready(ctx, story) || now - story.completedAt < SUPPORTING_RULES.callbackDelay
      || !ops.useMemory(story.lead, story.result.factKey)) return refuse('The earlier promise is not known at this encounter');
    supportKnowledge(ctx, story, story.result.factKey, story.result.sourceEventId);
    story = touch(ctx, story, { callbackEventId: ctx.id }); save(ctx, { lastCallbackAt: now });
    publication(ctx, story, story.result.outcome === 'kept'
      ? familyText(story.guest, 'again', actorName(story.lead), placePhrase(story.location, story.area))
        ?? `${actorName(story.lead)} returned to the earlier ${story.family} with ${cast(story.guest).name}.`
      : `${actorName(story.lead)} and ${cast(story.guest).name} returned to the ${story.family} they had ${story.result.outcome === 'missed'
        ? 'never managed to begin' : 'had to leave early'}. This time, neither assumed the other could stay.`);
    ctx.event.causedBy.push(story.result.sourceEventId); note(ctx, story);
  }
  return true;
}

export function publicSupportingSummaries(state, now) {
  return Object.values(of(state).instances).filter(story => story.openedAt <= now)
    .sort((a, b) => b.openedAt - a.openedAt).slice(0, 3).map(story => ({ id: story.id,
      title: `${cast(story.guest).name} · ${story.family}`, location: story.location, status: ACTIVE.has(story.status)?'active':story.status,
      openedAt: story.openedAt, deadlineAt: story.deadlineAt, eventId: story.result?.sourceEventId ?? story.originEventId,
      ...(story.result ? { outcome: story.result.outcome, completedAt: story.completedAt } : {}),
      description: story.result ? { kept: 'A small promise was kept.', missed: 'The planned meeting did not happen.',
        cut_short: 'They met, but their agreed time was cut short.' }[story.result.outcome] : 'A short interval has been agreed.' }));
}
export function assertSupportingStories(state) {
  const current = state.supportingStories;
  if (!current || current.version !== 1 || Object.keys(current.instances).length > SUPPORTING_RULES.retainedStories
    || Object.keys(current.issued).length > SUPPORTING_RULES.retainedActions || Object.values(current.counts).some(n => n < 0 || n > 2))
    throw new Error('Invalid supporting story state');
  if (Object.values(current.instances).filter(story => ACTIVE.has(story.status)).length > 1) throw new Error('Overlapping supporting promises');
  for (const story of Object.values(current.instances)) {
    if (!IDS.has(story.guest) || !['goaden', 'ashai'].includes(story.lead) || !story.originEventId
      || story.guests.join(',') !== unit(story.guest).join(',') || !areaOf(story.location, story.area)
      || ![...ACTIVE, ...OUTCOMES].includes(story.status) || story.causalEventIds.length > 12
      || story.encounterAt <= story.openedAt || story.outcomeAt <= story.encounterAt || story.deadlineAt <= story.outcomeAt
      || SIDE_CHARACTERS[story.guest]?.attachedTo && SIDE_CHARACTERS[story.guest].attachedTo !== story.lead)
      throw new Error('Invalid owned supporting promise');
    const fact = state.facts[story.promiseFactKey], arrangement = state.arrangements[story.arrangementKey];
    if (fact?.sourceEventId !== story.originEventId || fact.value.storyId !== story.id || arrangement?.supportingStoryId !== story.id)
      throw new Error('Supporting promise lacks its causal source');
    if (OUTCOMES.has(story.status) && (!story.result || state.facts[story.result.factKey]?.sourceEventId !== story.result.sourceEventId
      || story.result.outcome !== story.status || story.completedAt < story.openedAt || story.completedAt > story.deadlineAt
      || story.status === 'kept' && !story.encounterEventId)) throw new Error('Supporting outcome lacks its actual encounter');
  }
  for (const [id, appearance] of Object.entries(current.appearances)) if (!IDS.has(id) || !appearance.eventId
    || !Number.isSafeInteger(appearance.at) || !Number.isInteger(appearance.count) || appearance.count < 1) throw new Error('Invalid cast appearance');
  for (const [id, choice] of Object.entries(current.lastChoices ?? {})) if (!SUPPORTING_IDS.some(guest => unitKey(guest) === id)
    || !Number.isSafeInteger(choice.at) || !choice.eventId || !['accepted', 'deferred'].includes(choice.response))
    throw new Error('Invalid supporting choice cooldown');
  for (const person of Object.values(current.people)) for (const memory of person.knowledge) {
    const fact = state.facts[memory.factKey];
    if (!fact || memory.sourceEventId !== fact.sourceEventId || memory.learnedAt < fact.createdAt || !memory.acquisitionEventId)
      throw new Error('Supporting knowledge lacks a learned event');
  }
  for (const rapport of Object.values(current.rapport)) if (!Number.isInteger(rapport.reliability)
    || rapport.reliability < -3 || rapport.reliability > 3 || !Number.isInteger(rapport.familiarity)
    || rapport.familiarity < 0 || rapport.familiarity > 9
    || ['kept', 'missed', 'cutShort'].some(key => !Number.isInteger(rapport[key]) || rapport[key] < 0)
    || !rapport.eventId) throw new Error('Supporting relationship consequence is unbounded');
}
