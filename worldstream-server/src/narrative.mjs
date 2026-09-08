import { areaOf } from './places.mjs';
import { MINUTE_MS as MIN } from './time.mjs';
import { editorialEvent } from './editorial.mjs';
import { SIDE_CHARACTERS, LEGION_CAST, OUTSIDE_CAST } from './cast.mjs';

// Memory, traces and rapport — the continuity layer.
//
// In a novel, continuity is implicit in the author's prose. Here it has to be
// something the engine preserves and can show its working for. Everything below
// is *derived*: there is no mutable memory store, nothing here is written back
// into the world, and deleting this file would cost the page a drawer and cost
// the simulation nothing.
//
// Four rules shape it, and each one exists because the obvious implementation
// gets it wrong.
//
// 1. **Memory is projected, not re-derived.** The tempting version walks the
//    event log and decides what each character probably knows. This world
//    already knows: every character carries `knowledge[]`, and each entry has a
//    `factKey`, a `sourceEventId`, an `acquisitionEventId`, a `learnedAt`, a
//    `validUntil` and a `provenance` — placed there by the reducer under the
//    anti-telepathy rules the canon suite already enforces. Deriving memory
//    from anywhere else would mean two answers to the same question, and the
//    second one would be a guess. So a memory here is a *view* of a knowledge
//    entry, and a memory that disagreed with `knowledge[]` would be a bug.
//
// 2. **Nothing appears because it would be atmospheric.** A trace exists only
//    if a committed event created it, and it carries that event's id. There is
//    no chess board in this world, so there is no chess board on the page.
//
// 3. **Salience decays; forty-eight hours is not amnesia.** An ordinary meal is
//    unaddressable by the next afternoon. A night somebody came after them
//    stays reachable for a month. Both fall out of one horizon table.
//
// 4. **Nothing here is an inner thought.** No character is given a feeling they
//    did not demonstrably acquire. What the page shows is an *echo* — an
//    authored line selected by state — and a callback quotes only words that
//    exist in an event, paraphrasing otherwise.

// How a knowledge entry's provenance reads as an acquisition route.
const ACQUIRED_VIA = Object.freeze({
  told_by_participant: 'told',
  received_night_call: 'told', completed_night_response: 'witnessed',
  experienced_recovery: 'witnessed', heard_night_response_result: 'told',
  self_observation: 'witnessed',
  self_report: 'witnessed',
  participated: 'witnessed',
  lived_through: 'witnessed',
  called_to_standby: 'witnessed',
  duty_callout: 'witnessed',
  told_by_goaden: 'told',
  told_by_ashai: 'told',
  received_advisory: 'told',
  checked_ordinary_notice: 'public',
});
export const acquiredVia = provenance => ACQUIRED_VIA[provenance] ?? 'inferred';

// How long a kind of fact stays worth reaching for, and how loudly. `weight` is
// the salience it starts at; `days` is how long it takes to decay to nothing.
// The two together are the answer to "48 hours is too literal": an ordinary
// preference is gone by tomorrow and a confrontation is still addressable a
// month later, without anybody storing a separate expiry.
export const SALIENCE = Object.freeze({
  offscreen_result: { weight: 0.5, days: 14 },
  offscreen_help: { weight: 0.6, days: 14 },
  supporting_result: { weight: 0.3, days: 7 },
  night_result: { weight: 0.5, days: 7 },
  night_recovery: { weight: 0.25, days: 3 },
  intent_result: { weight: 0.45, days: 7 },
  agenda_report: { weight: 0.2, days: 3 },
  agenda_result: { weight: 0.3, days: 7 },
  training_ground_prepared: { weight: 0.2, days: 3 },
  training_ground_cleared: { weight: 0.3, days: 7 },
  incident: { weight: 1, days: 30 },
  ink_result: { weight: 0.55, days: 30 },
  ink_delivery_problem: { weight: 0.2, days: 2 },
  ink_delivery_request: { weight: 0.3, days: 3 },
  ink_delivery_dispatch: { weight: 0.3, days: 7 },
  ink_delivery_result: { weight: 0.55, days: 30 },
  ink_appointment_interrupted: { weight: 0.45, days: 14 },
  ink_appointment: { weight: 0.3, days: 3 },
  ink_design_choice: { weight: 0.2, days: 7 },
  ink_released_slot: { weight: 0.15, days: 1 },
  broken_plan: { weight: 0.8, days: 14 },
  unfinished_visit: { weight: 0.6, days: 7 },
  duty_callout: { weight: 0.55, days: 7 },
  unfinished_game: { weight: 0.35, days: 3 },
  invitation: { weight: 0.3, days: 3 },
  practice_slot: { weight: 0.15, days: 2 },
  break_preference: { weight: 0.15, days: 2 },
  quiet_preference: { weight: 0.15, days: 2 },
  finish_preference: { weight: 0.15, days: 2 },
});
export const SALIENCE_FLOOR = 0.05;
const DAY = 24 * 60 * MIN;

export function salienceOf(kind, ageMs, severity) {
  const spec = SALIENCE[kind];
  if (!spec) return 0;
  // A critical night outlives an ordinary one of the same kind.
  const bump = severity === 'critical' ? 1.35 : severity === 'high' ? 1.15 : 1;
  const life = spec.days * DAY;
  if (ageMs >= life) return 0;
  return Math.max(0, Math.min(1, spec.weight * bump * (1 - ageMs / life)));
}

// What a remembered fact reads as. Authored per kind, never generated, and
// deliberately about the shape of the thing rather than its meaning — the
// engine knows a callout happened, not what it felt like.
// Incidents are summarised by what happened, not by how loud it was. Keying
// only on severity gave four different nights the same sentence — a courier, a
// sealed case, a patrol and a sighting all read "the thing on the way home",
// which is the sort of flatness that makes a memory drawer feel generated.
const INCIDENT_SUMMARY = Object.freeze({
  courier: 'the courier who would not leave',
  followed: 'being followed back from the plaza',
  sighting: 'the thing that crossed the road',
  artefact: 'the case the MEU could not read',
  hostile_words: 'what the man in Order colours said',
  patrol: 'the patrols between the cafe and home',
  pursuit: 'the run back from the river',
  breach: 'the night the perimeter went',
  surge_incident: 'the corridor lighting up',
  deployment: 'the short-notice MI6 alert',
  hunted: 'the night something was hunting the embankment',
  confrontation: 'the night it came for them',
  multi_faction: 'the night three factions were on one street',
  severe_event: 'the minute the sky came apart',
});
const SUMMARY = Object.freeze({
  offscreen_result: value => `${guestSubject(value)} ${value?.outcome==='settled'?'that finally came together':'left unfinished'}`,
  offscreen_help: value => `helping ${guestName(value?.guest) ?? 'someone'} with ${lifeSubject(value?.guest)}`,
  supporting_result: value => value?.outcome==='kept'?`the time shared with ${guestName(value?.guest) ?? 'a familiar face'}`
    :value?.outcome==='cut_short'?`the time with ${guestName(value?.guest) ?? 'a familiar face'} that was cut short`
      :`the missed meeting with ${guestName(value?.guest) ?? 'a familiar face'}`,
  night_result: value => value?.outcome==='resolved'?'the night-watch entry that was closed':'the night-watch entry handed on to the day watch',
  night_recovery: () => 'the later start after the night watch',
  intent_result: value => value?.outcome==='completed'?'the short shared session they finished'
    :value?.outcome==='declined'?'the short shared offer that was declined':'the shared session that was interrupted',
  agenda_report: () => 'the retained MI6 service-record report',
  agenda_result: value => value?.outcome==='cleared'?'the service-record check that cleared':'the service-record check left outstanding',
  training_ground_prepared: () => 'preparing the training-ground safety check',
  training_ground_cleared: () => 'the completed check that reopened the training grounds',
  ink_result: () => 'the completed prowler design at Enchanted Ink',
  ink_delivery_problem: () => 'the missing dispatch copy at Enchanted Ink',
  ink_delivery_request: () => 'offering to help with the delivery check',
  ink_delivery_dispatch: () => 'the dispatch copy received at Enchanted Ink',
  ink_delivery_result: value => ({ reconciled:'the delivery accepted at Enchanted Ink',
    returned:'the delivery returned by Enchanted Ink', missed_window:'the missed delivery window at Enchanted Ink' }[value?.outcome] ?? 'the settled delivery check at Enchanted Ink'),
  ink_appointment_interrupted: () => 'the unfinished appointment at Enchanted Ink',
  ink_appointment: () => 'the booked appointment at Enchanted Ink',
  ink_design_choice: () => 'Goaden choosing the prowler design',
  ink_released_slot: () => 'the released appointment at Enchanted Ink',
  incident: value => INCIDENT_SUMMARY[value?.kind]
    ?? (value?.severity === 'critical' ? 'the night it came for them'
      : value?.severity === 'high' ? 'the night they had to run' : 'the thing on the way home'),
  broken_plan: () => 'the evening a callout took',
  unfinished_visit: () => 'the visit they were pulled out of',
  duty_callout: () => 'being called to stand by',
  unfinished_game: () => 'a game left unfinished',
  invitation: () => 'a guest window at Sanctuary',
  practice_slot: () => 'a training slot that moved',
  break_preference: () => 'wanting a break',
  quiet_preference: () => 'wanting the afternoon quiet',
  finish_preference: () => 'wanting to finish first',
});
function guestName(id) { const cast=[SIDE_CHARACTERS,LEGION_CAST,OUTSIDE_CAST].find(group=>Object.hasOwn(group,id)); return cast?.[id]?.name ?? null; }
const LIFE_SUBJECTS=Object.freeze({yukon:'the troublesome game section',gabriel:'the crowded last line',rose:'the unfinished rhythm',zara:'the unclear handover note'});
function lifeSubject(id) { return Object.hasOwn(LIFE_SUBJECTS,id)?LIFE_SUBJECTS[id]:'the earlier work'; }
function guestSubject(value) {
  const name = guestName(value?.guest);
  return name ? `${name}’s ${lifeSubject(value.guest).replace(/^the /,'')}` : 'the earlier work';
}
export const summariseMemory = (kind, value) => (SUMMARY[kind] ?? (() => 'something from earlier'))(value);

/**
 * What one character can legitimately be said to remember, right now.
 *
 * Projected straight from their own knowledge, so a memory Goaden has and Ashai
 * does not is simply absent from hers — the anti-telepathy rule is inherited
 * rather than re-implemented.
 */
export function deriveMemories(snapshot, characterId, now, { limit = 12, floor = SALIENCE_FLOOR, publicOnly = true } = {}) {
  const actor = snapshot?.characters?.[characterId];
  if (!actor) return [];
  const events = new Map((snapshot.events ?? []).map(event => [event.id, event]));
  const memories = [];
  for (const memory of actor.knowledge ?? []) {
    // The seeded canon anchors are not memories of anything that happened here.
    if (memory.provenance === 'canon_seed') continue;
    if (memory.learnedAt > now) continue;
    const fact = snapshot.facts?.[memory.factKey];
    const kind = fact?.kind;
    if (!kind) continue;
    const salience = salienceOf(kind, now - memory.learnedAt, fact?.value?.severity);
    if (salience <= floor) continue;
    const source = events.get(memory.sourceEventId);
    if (fact.sourceEventId !== memory.sourceEventId || fact.createdAt > now
      || source && source.occurredAt > now) continue;
    // **A memory may only be shown for something the feed already reported.**
    //
    // This is where the author's request for provenance meets a rail that was
    // already there: the public projection is contractually forbidden from
    // carrying `sourceEventId`, `learnedAt`, or any reference to a private
    // event, and the canon suite asserts it. Rather than weaken that, a memory
    // of a private moment simply does not surface. The reader can be shown what
    // somebody remembers of things they themselves watched happen, and nothing
    // else — which is also the only kind of memory a "link back to the original
    // event" could ever resolve to.
    if (publicOnly && source?.visibility !== 'public') continue;
    memories.push({
      factKey: memory.factKey,
      kind,
      summary: summariseMemory(kind, fact.value),
      // Provenance. `at` rather than `learnedAt` because the projection's own
      // allowlist test bans that name outright, and the id is only ever a
      // public event's — which is what makes it safe to hand out.
      sourceEvent: source?.visibility === 'public' ? memory.sourceEventId : null,
      acquiredVia: acquiredVia(memory.provenance),
      at: memory.learnedAt,
      // Still live, or remembered as past.
      expired: memory.validUntil !== null && now >= memory.validUntil,
      salience: Number(salience.toFixed(3)),
      // Only what the feed already said. A memory never carries more than the
      // event it came from made public.
      recalls: source?.visibility === 'public' ? editorialEvent(source).publicDescription ?? null : null,
    });
  }
  return memories.sort((a, b) => b.salience - a.salience || b.at - a.at).slice(0, limit);
}

/** Moments both of them hold, which is what "shared" actually means here. */
export function sharedMemories(snapshot, now, options) {
  const mine = deriveMemories(snapshot, 'goaden', now, options);
  const theirs = new Map(deriveMemories(snapshot, 'ashai', now, options).map(item => [item.factKey, item]));
  return mine.filter(item => theirs.has(item.factKey))
    .map(item => ({ ...item, alsoAcquiredVia: theirs.get(item.factKey).acquiredVia }));
}

// ---------------------------------------------------------------------------
// Traces: what the world left lying about.
//
// Every entry is keyed to the event that made it. There is no rule that invents
// a trace because a room would look better with one.
const TRACE_RULES = Object.freeze([
  {
    // The clearest case, and the one that was already in the world waiting to
    // be surfaced: GAME_PAUSE creates an `unfinished_game` fact with its own
    // expiry, and GAME_RESUME is what clears it.
    from: 'GAME_PAUSE', kind: 'unfinished_game', hours: 24,
    clearedBy: ['GAME_RESUME'],
    text: () => 'A game sits paused, mid-round.',
  },
  {
    from: 'MEAL_BEGIN', kind: 'table', hours: 5,
    clearedBy: ['REST_BEGIN'],
    text: () => 'Plates from earlier have not been cleared.',
  },
  {
    from: 'PIANO_BEGIN', kind: 'piano', hours: 12,
    clearedBy: ['REST_BEGIN'],
    text: () => 'The piano lid is still up.',
  },
  {
    from: 'PRACTICE_END', kind: 'kit', hours: 8,
    clearedBy: ['REST_BEGIN'],
    text: () => 'Training kit is still out where it was dropped.',
  },
  {
    // Only when somebody actually arrived in the wet — which is the difference
    // between a trace and a decoration.
    from: 'TRAVEL_ARRIVE', kind: 'wet', hours: 6, needsRain: true,
    clearedBy: ['REST_BEGIN'],
    text: () => 'Wet coats are over the backs of the chairs.',
  },
  {
    from: 'LEGION_VISIT', kind: 'visitors', hours: 10,
    clearedBy: ['REST_BEGIN'],
    text: () => 'There are more mugs out than two people need.',
  },
  {
    from: 'WEATHER_DISRUPTION', kind: 'yard', hours: 14,
    clearedBy: ['WEATHER_CHANGE'],
    text: () => 'The outdoor ground is still roped off.',
  },
  {
    from: 'INCIDENT', kind: 'incident', hours: 36, minSeverity: 'high',
    clearedBy: [],
    text: event => event.payload?.kind === 'breach'
      ? 'The north face is taped off and there is a guard on it.'
      : 'Something from an earlier night has not been tidied away yet.',
  },
]);
const RAINY = new Set(['light_rain', 'heavy_rain', 'storm']);
const severityAtLeast = (value, floor) =>
  ['unease', 'medium', 'high', 'critical'].indexOf(value) >= ['unease', 'medium', 'high', 'critical'].indexOf(floor);

/**
 * Everything currently lying about, keyed `location:area`.
 *
 * Keyed by place rather than returned as one list because the moment Goaden is
 * at MI6 and Ashai is at Sanctuary, a global array is answering the wrong
 * question. Cleanup is both time-driven and event-driven: a trace goes when its
 * hours run out, or when something happens that would obviously clear it —
 * turning in for the night, resuming the game, the weather changing.
 */
export function deriveTraces(snapshot, now) {
  const events = (snapshot.events ?? []).filter(event => event.visibility === 'public');
  const byPlace = {};
  for (const event of events) {
    const rule = TRACE_RULES.find(item => item.from === event.type);
    if (!rule) continue;
    if (rule.minSeverity && !severityAtLeast(event.payload?.severity ?? 'unease', rule.minSeverity)) continue;
    if (rule.needsRain && !RAINY.has(snapshot.weather?.code)) continue;
    const expiresAt = event.occurredAt + rule.hours * 60 * MIN;
    if (now >= expiresAt) continue;
    // Event-driven cleanup: anything that would obviously have tidied it.
    const cleared = events.find(later => later.occurredAt > event.occurredAt && later.occurredAt <= now
      && rule.clearedBy.includes(later.type));
    if (cleared) continue;
    const locationId = event.location, areaId = event.area ?? null;
    const key = `${locationId}:${areaId ?? 'unknown'}`;
    byPlace[key] ??= [];
    // One of a kind per place; the newest wins.
    const existing = byPlace[key].findIndex(item => item.kind === rule.kind);
    const trace = {
      kind: rule.kind,
      text: rule.text(event),
      createdByEventId: event.id,
      createdAt: event.occurredAt,
      locationId, areaId,
      room: areaOf(locationId, areaId)?.name ?? null,
      expiresAt,
      clearedBy: [...rule.clearedBy],
    };
    if (existing >= 0) byPlace[key][existing] = trace; else byPlace[key].push(trace);
  }
  for (const key of Object.keys(byPlace)) byPlace[key].sort((a, b) => b.createdAt - a.createdAt);
  return byPlace;
}

// ---------------------------------------------------------------------------
// What somebody is carrying, as one quiet line.
//
// Not an inner thought. It is selected by state from written lines, and it says
// what a reader could already have worked out from the feed.
const ECHOES = Object.freeze({
  incident_critical: 'Still somewhere else, mostly.',
  incident_high: 'Still carrying the edge of what happened.',
  broken_plan: 'Owed an evening, and not making a thing of it.',
  unfinished_visit: 'An earlier visit left unfinished.',
  duty_callout: 'One ear still on the door.',
  shaken: 'Quieter than usual.',
  tired: 'Running on not very much.',
  settled: null,
});
export function deriveCarrying(snapshot, characterId, now) {
  const actor = snapshot?.characters?.[characterId];
  if (!actor) return null;
  const memories = deriveMemories(snapshot, characterId, now, { limit: 12 });
  const top = memories[0];
  const active = (actor.conditions ?? []).filter(condition => condition.since <= now
    && (condition.until == null || condition.until > now));
  const shaken = active.some(condition => condition.kind === 'shaken');
  const tired = active.some(condition => condition.kind === 'ordinary_fatigue');
  // A frightening incident can remain a memory for a month without being the
  // only thing the character carries every morning. A recent actual exchange
  // may take the foreground once its immediate condition has passed.
  const recentLife = memories.filter(memory => ['offscreen_result','offscreen_help','supporting_result','intent_result'].includes(memory.kind)
    && now - memory.at <= 3 * DAY).sort((a,b)=>b.at-a.at||b.salience-a.salience)[0];
  if (!shaken && !tired && recentLife && !(top?.kind==='incident' && now-top.at<2*DAY)) {
    const fact=snapshot.facts?.[recentLife.factKey], value=fact?.value, name=guestName(value?.guest);
    const pronoun=characterId==='goaden'?'him':'her';
    const echo=recentLife.kind==='offscreen_help' && name ? `The help ${name} accepted began with something ${pronoun==='him'?'he':'she'} remembered.`
      :recentLife.kind==='offscreen_result' && name ? `What ${name} said about ${lifeSubject(value.guest)} has stayed with ${pronoun}.`
        :recentLife.kind==='supporting_result' && name ? value?.outcome==='kept'
          ? `A little more history with ${name}.` : `The unfinished time with ${name} is still part of the day.`
          :recentLife.kind==='intent_result' && value?.outcome==='completed'
            ? 'Something they made time for, and finished together.' : null;
    if(echo) return {echo,because:{factKey:recentLife.factKey,sourceEvent:recentLife.sourceEvent,summary:recentLife.summary}};
  }
  let key = 'settled';
  if (top?.kind === 'incident' && (now-top.at<2*DAY||shaken)) key = `incident_${top.recalls && /ran|drew|hunting/i.test(top.recalls) ? 'critical' : 'high'}`;
  else if (top?.kind === 'broken_plan') key = 'broken_plan';
  else if (top?.kind === 'unfinished_visit') key = 'unfinished_visit';
  else if (top?.kind === 'duty_callout') key = 'duty_callout';
  else if (shaken) key = 'shaken';
  else if (tired) key = 'tired';
  const echo = ECHOES[key];
  if (!echo) return null;
  return {
    echo,
    // Attributed, always. A line about somebody is only allowed on the page if
    // it can say which committed event put it there.
    because: top ? { factKey: top.factKey, sourceEvent: top.sourceEvent, summary: top.summary } : null,
  };
}

// Rapport is an interpretation and says so. It reads recent shared events and
// hands back a label; it never touches the relationship state the reducer owns,
// and no label here has ever changed a number.
const RAPPORT = Object.freeze([
  { id: 'weathering_it', label: 'Weathering it', when: ({ shared }) => shared.some(item => item.kind === 'incident') },
  { id: 'owed_an_evening', label: 'Owed an evening', when: ({ shared }) => shared.some(item => item.kind === 'broken_plan') },
  { id: 'unfinished_business', label: 'Unfinished business', when: ({ shared }) => shared.some(item => item.kind === 'unfinished_game' || item.kind === 'unfinished_visit') },
  { id: 'quiet_complicity', label: 'Quiet complicity', when: ({ shared }) => shared.length > 0 },
  { id: 'ordinary_week', label: 'An ordinary week', when: () => true },
]);
export function deriveRapport(snapshot, now) {
  const shared = sharedMemories(snapshot, now, { limit: 8 });
  const match = RAPPORT.find(item => item.when({ shared }));
  return {
    id: match.id,
    label: match.label,
    interpretation: true,
    basis: shared.slice(0, 3).map(item => ({ factKey: item.factKey, summary: item.summary, sourceEvent: item.sourceEvent })),
  };
}

/** Internal derived view; fact keys support knowledge joins and author audits. */
export function narrativeBlock(snapshot, now = snapshot?.world?.resolvedThrough) {
  return {
    memories: {
      goaden: deriveMemories(snapshot, 'goaden', now),
      ashai: deriveMemories(snapshot, 'ashai', now),
      shared: sharedMemories(snapshot, now),
    },
    carrying: {
      goaden: deriveCarrying(snapshot, 'goaden', now),
      ashai: deriveCarrying(snapshot, 'ashai', now),
      rapport: deriveRapport(snapshot, now),
    },
    tracesByLocation: deriveTraces(snapshot, now),
  };
}

/** Public provenance uses event links, never raw character knowledge keys. */
export function publicNarrativeBlock(snapshot, now = snapshot?.world?.resolvedThrough) {
  const block = narrativeBlock(snapshot, now);
  const basis = item => item ? { sourceEvent: item.sourceEvent, summary: item.summary } : null;
  const memory = item => ({ kind:item.kind, summary:item.summary, sourceEvent:item.sourceEvent,
    acquiredVia:item.acquiredVia, at:item.at, expired:item.expired, salience:item.salience,
    recalls:item.recalls, ...(item.alsoAcquiredVia ? {alsoAcquiredVia:item.alsoAcquiredVia} : {}) });
  const carrying = item => item ? { echo:item.echo, because:basis(item.because) } : null;
  return {
    memories:Object.fromEntries(Object.entries(block.memories).map(([who, items]) => [who, items.map(memory)])),
    carrying:{ goaden:carrying(block.carrying.goaden), ashai:carrying(block.carrying.ashai),
      rapport:{ id:block.carrying.rapport.id, label:block.carrying.rapport.label, interpretation:true,
        basis:block.carrying.rapport.basis.map(basis) } },
    tracesByLocation:block.tracesByLocation,
  };
}
