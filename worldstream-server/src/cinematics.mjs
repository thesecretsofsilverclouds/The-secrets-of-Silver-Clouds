import { createHash } from 'node:crypto';
import { applyChange } from './ledger.mjs';
import { CHARACTER_NAMES, voicePacket } from './cinematic-voices.mjs';
import {
  BACKGROUND_BY_ID, PLATE_BY_ID, cinematicSpeakers, plateForExpression,
  publicAssetManifest, selectVisualVocabulary, validateVisualChoice,
} from './cinematic-assets.mjs';
import { RULES_VERSION } from './fixture.mjs';
import { daypart, dayPhase, daylightFraction } from './sky.mjs';
import { londonClock, londonDate } from './time.mjs';
import { findSpoilers, properNouns } from './presentation.mjs';
import { settingForPerformance, SCENE_LOCATION_ALIASES } from './cinematic-setting.mjs';

export const CINEMATIC_RULES_VERSION = 'worldstream-cinematic-v1';
export const CINEMATIC_PROMPT_VERSION = 'sentient-scene-v3';
export const DEFAULT_CINEMATIC_MODEL = 'gpt-5-mini';

const HOUR = 3_600_000;
const WEIGHTS = Object.freeze({
  fantasySpectacle: 1.4, dangerConflict: 1.4, mysteryWeirdness: 1.3,
  emotionalSignificance: 1.3, characterChemistry: 1.2, novelty: 1.2,
  comedyPotential: 1.1, worldImportance: 1, relationshipSignificance: 1,
  visualPotential: 1,
});
const WEIGHT_TOTAL = Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0);
const clamp = (value, low = 0, high = 10) => Math.max(low, Math.min(high, value));

const TYPE_PROFILE = Object.freeze({
  INCIDENT: [8, 8, 8, 7, 6, 8, 1, 7, 6, 8],
  ARCANE_SURGE: [9, 7, 9, 5, 4, 8, 0, 8, 3, 9],
  LEGION_VISIT: [4, 2, 3, 5, 10, 8, 10, 3, 8, 9],
  VENUE_SCENE: [5, 2, 5, 5, 9, 7, 7, 2, 7, 8],
  // The lifecycle now owns this authored venue scene. Keep it performable
  // through the existing shared cache after booking has actually committed.
  INK_APPOINTMENT_BOOKED: [5, 2, 5, 5, 9, 7, 7, 2, 7, 8],
  THREAD_DELIVERY_OPEN: [4, 1, 4, 3, 2, 6, 1, 2, 2, 5],
  THREAD_DELIVERY_DECIDE: [3, 2, 3, 5, 4, 7, 2, 2, 4, 6],
  THREAD_DELIVERY_DEADLINE: [3, 2, 3, 4, 1, 7, 0, 2, 2, 5],
  // Authored choices and their actual consequences can earn a quiet scene.
  // Routine requests, clock settlements and staff releases retain feed scores.
  INTENT_RESPONSE: [1, 1, 2, 7, 9, 6, 5, 1, 8, 6],
  INTENT_RENEGOTIATE: [1, 1, 1, 7, 9, 6, 6, 1, 8, 6],
  INTENT_COMPLETE: [0, 0, 1, 6, 7, 6, 2, 1, 7, 5],
  INTENT_INTERRUPTED: [1, 2, 1, 6, 5, 6, 1, 2, 6, 4],
  AGENDA_RESOLVE: [2, 2, 3, 5, 1, 6, 1, 5, 2, 5],
  AGENDA_DEADLINE: [2, 2, 3, 4, 1, 6, 0, 5, 2, 5],
  GROUND_WORK_COMPLETED: [1, 1, 2, 6, 7, 7, 2, 2, 6, 6],
  GROUND_WORK_INTERRUPTED: [1, 2, 1, 5, 4, 6, 0, 2, 4, 5],
  CONVERSATION: [1, 1, 2, 7, 9, 5, 6, 1, 9, 6],
  AFTERMATH: [3, 2, 5, 8, 7, 6, 1, 4, 7, 7],
  UNEASE: [6, 1, 9, 3, 1, 7, 0, 4, 1, 8],
  MINOR_ANOMALY: [5, 1, 8, 2, 3, 6, 1, 3, 2, 7],
  PLAN_BROKEN: [2, 3, 2, 7, 7, 5, 1, 3, 8, 5],
  OUTING_CUT_SHORT: [3, 4, 3, 6, 6, 5, 1, 3, 6, 5],
  INVITATION_ACCEPTED: [5, 0, 4, 5, 6, 6, 2, 2, 5, 7],
  TRAVEL_DEPART: [3, 0, 2, 2, 3, 3, 1, 1, 2, 5],
  TRAVEL_ARRIVE: [3, 0, 2, 2, 3, 3, 1, 1, 2, 5],
});
const DIMENSION_NAMES = Object.freeze(Object.keys(WEIGHTS));

function fingerprint(event) {
  return `${event.type}:${event.payload?.kind ?? event.payload?.mood ?? event.payload?.outcome
    ?? event.payload?.status ?? event.payload?.method ?? event.payload?.activity ?? event.location ?? ''}`;
}

/** Pure scoring over committed history. Observation state is deliberately absent. */
export function scoreCinematicEvent(event, { priorEvents = [] } = {}) {
  const values = TYPE_PROFILE[event?.type] ? [...TYPE_PROFILE[event.type]] : [0, 0, 0, 1, 1, 4, 0, 0, 1, 1];
  const severity = event?.payload?.severity;
  if (event?.type === 'INCIDENT') {
    const bump = { medium: -2, high: 0, critical: 2 }[severity] ?? -3;
    for (const index of [0, 1, 2, 3, 7, 9]) values[index] = clamp(values[index] + bump);
  }
  const speakers = cinematicSpeakers(event);
  const hasGuest = speakers.some((speaker) => speaker !== 'goaden' && speaker !== 'ashai');
  if (hasGuest) {
    values[4] = clamp(values[4] + 1);
    values[6] = clamp(values[6] + 1);
    values[9] = clamp(values[9] + 1);
  }
  const key = fingerprint(event);
  const occurredAt = Number(event?.occurredAt ?? 0);
  const repetitions = priorEvents.filter((other) => other !== event
    && Number(other.occurredAt) < occurredAt
    && Number(other.occurredAt) >= occurredAt - 18 * HOUR
    && fingerprint(other) === key).length;
  values[5] = clamp(values[5] - Math.min(6, repetitions * 2));
  const dimensions = Object.fromEntries(DIMENSION_NAMES.map((name, index) => [name, values[index]]));
  let score = Math.round(DIMENSION_NAMES.reduce((sum, name) => sum + dimensions[name] * WEIGHTS[name], 0)
    / WEIGHT_TOTAL * 10);
  if (event?.type === 'INCIDENT' && severity === 'critical') score = Math.max(score, 92);
  if (event?.type === 'INCIDENT' && severity === 'high') score = Math.max(score, 78);
  if (event?.type === 'INCIDENT' && severity === 'medium') score = Math.max(score, 58);
  if (event?.type === 'ARCANE_SURGE') score = Math.max(score, 72);
  if (event?.type === 'LEGION_VISIT') score = Math.max(score, 66);
  if (event?.type === 'VENUE_SCENE' && hasGuest) score = Math.max(score, 62);
  if (event?.type === 'CONVERSATION' && (event.payload?.mood === 'repair' || event.payload?.mood === 'strained')) score = Math.max(score, 58);
  score = clamp(score - repetitions * 4, 0, 100);
  const band = score >= 90 ? 'major' : score >= 70 ? 'strong' : score >= 50 ? 'eligible'
    : score >= 30 ? 'chronicle' : 'feed';
  return Object.freeze({ score, band, dimensions: Object.freeze(dimensions), repetitionPenalty: repetitions * 4 });
}

export function effectiveCinematicThreshold(activeViewerCount, base = 52) {
  if (!Number.isFinite(activeViewerCount) || activeViewerCount <= 0) return Number.POSITIVE_INFINITY;
  // One real viewer is enough to make the world perform. A crowd lowers the
  // bar a little further, but never far enough to turn meals into set pieces.
  const liveBoost = Math.min(14, 5 + Math.ceil(Math.log2(activeViewerCount + 1) * 2));
  return Math.max(42, base - liveBoost);
}

function displayTime(ms) {
  const { hour, minute } = londonClock(ms);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function canonicalPublicText(event) {
  return event.prose ?? event.publicDescription ?? event.description ?? '';
}

function eventLines(event) {
  const source = event.lines ?? event.payload?.lines;
  return Array.isArray(source) ? source.filter((line) => line && typeof line.who === 'string'
    && typeof line.text === 'string').map((line) => ({
      speaker: line.who, expression: line.expression ?? null, line: line.text,
    })) : [];
}

function publicSourceFacts(snapshot, actorId, atMs) {
  const actor = snapshot?.characters?.[actorId];
  if (!actor || !Array.isArray(actor.knowledge)) return [];
  const eventById = new Map((snapshot.events ?? []).map((event) => [event.id, event]));
  return actor.knowledge.filter((fact) => fact.learnedAt <= atMs
    && (fact.validUntil === null || fact.validUntil === undefined || fact.validUntil > atMs))
    .map((fact) => {
      const source = eventById.get(fact.sourceEventId);
      const text = source?.visibility === 'public' && source.occurredAt <= atMs ? canonicalPublicText(source) : null;
      return text ? {
        id: fact.factKey, fact: text, learnedAt: fact.learnedAt,
        provenance: fact.provenance, sourceEventId: fact.sourceEventId,
        presentationText: typeof fact.presentationText === 'string' ? fact.presentationText : null,
      } : null;
    }).filter(Boolean).slice(-8);
}

// Reverse ledger changes into a presentation-only snapshot. No reducer runs,
// nothing is committed, and an event inspected tomorrow gets today's context.
export function contextAtEvent(event, snapshot) {
  const context = {
    characters: structuredClone(snapshot?.characters ?? {}),
    relationships: structuredClone(snapshot?.relationships ?? []),
    weather: structuredClone(snapshot?.weather ?? null),
    factions: structuredClone(snapshot?.factions ?? null),
    pressure: structuredClone(snapshot?.pressure ?? null),
    events: (snapshot?.events ?? []).filter(item => event.seq !== undefined
      ? item.seq <= event.seq : item.occurredAt <= event.occurredAt),
  };
  const future = (snapshot?.events ?? []).filter(item => event.seq !== undefined
    ? item.seq > event.seq : item.occurredAt > event.occurredAt);
  for (const later of [...future].reverse()) for (const change of [...(later.changes ?? [])].reverse()) {
    const target = change.entity === 'character' ? context.characters[change.id]
      : change.entity === 'relationship' ? context.relationships.find(item => `${item.from}->${item.to}` === change.id)
      : ['world', 'pressure'].includes(change.entity) ? context : null;
    if (target && Object.hasOwn(target, change.field)) applyChange(target, change, 'before');
  }
  return context;
}

function worldAtEvent(event, snapshot) {
  const earlier = snapshot?.events ?? [];
  const weatherEvent = [...earlier].reverse().find((item) => item.type === 'WEATHER_CHANGE');
  const factionEvent = [...earlier].reverse().find((item) => item.type === 'FACTION_STATUS');
  return {
    weather: snapshot.weather ? { code: snapshot.weather.code, description: snapshot.weather.description,
      temperatureC: snapshot.weather.temperatureC } : weatherEvent ? {
      code: weatherEvent.payload?.weatherCode ?? null,
      description: weatherEvent.publicDescription ?? null,
    } : null,
    factions: factionEvent?.payload ? Object.fromEntries(Object.entries(factionEvent.payload)
      .filter(([key]) => key !== 'calendarDay')) : null,
    currentWorldConditions: snapshot?.pressure ? [{
      kind: 'fantasy_pressure', level: snapshot.pressure.level,
    }] : [],
  };
}

// The causal setup an archived scene needs to be readable on its own.
//
// Reading View has had this since callbacks.mjs: an origin event id, a time
// label and the origin's own words. A cinematic had nothing, so an archived
// scene opened on its first line with the twenty minutes that earned it
// invisible. The audit case was Ashai's autonomy confrontation, which reads as
// an unprovoked outburst until you can see that she had stood at a window
// watching an Order procession go past twenty-two minutes earlier and said
// nothing.
//
// Two rules, both of which matter more than the selection heuristic:
//
//   * it is never new prose. The setup is a committed public event, quoted in
//     its own words. Explanatory writing is exactly what this must not become.
//   * it is never private. Only events the world already published can appear,
//     so a setup beat can never disclose something a reader was not shown.
//
// `selector` records *how* the beat was chosen, so the field shape survives a
// better heuristic. The first implementation is recency, which is bounded and
// honest; a causal/thread-relevance selector can be added later and slotted in
// without changing anything downstream.
// A scene's own staging is not its setup. CROSS_PATHS is the encounter that
// assembled this conversation and END_ENCOUNTER is it dispersing; quoting
// either as "Earlier" tells a reader that the reason Ashai snapped is that the
// two of them were in a room, which is both true and useless. Excluding them is
// the same class of rule as excluding the conversation itself, not a relevance
// heuristic — the bounded recency implementation stands.
const SCENE_STAGING = new Set(['CONVERSATION', 'CROSS_PATHS', 'END_ENCOUNTER',
  'ANNOUNCE_ARRANGEMENT', 'ACKNOWLEDGE_ARRANGEMENT']);

const SUBSTANTIVE_BEAT_TYPES = new Set([
  'INCIDENT', 'ARCANE_SURGE', 'MINOR_ANOMALY', 'OUTING_CUT_SHORT', 'PLAN_BROKEN',
  'ALERT', 'INSTITUTION_NOTICE', 'GROUND_RESTRICTION', 'MOMENT_NOTICED',
  'OFFSCREEN_WITNESS', 'OFFSCREEN_ENCOUNTER', 'VENUE_SCENE', 'DUTY_CALLOUT',
  'STANDBY_BEGIN', 'BRIEFING_BEGIN', 'NIGHT_DEBRIEF', 'SUPPORTING_ENCOUNTER',
  'SUPPORTING_CALLBACK', 'SUPPORTING_OUTCOME'
]);

export const SETUP_SELECTORS = Object.freeze({
  // Substantive narrative beats outrank routine meals and daily maintenance.
  // When a scene references specific occurrences (scanners, river, standby),
  // matching substantive beats receive strong priority, while recency breaks ties.
  recency: (candidate, event = {}) => {
    let score = Number(candidate.occurredAt);
    if (SUBSTANTIVE_BEAT_TYPES.has(candidate.type)) score += 1_000_000_000_000;
    const evText = JSON.stringify(event?.lines ?? event?.payload?.lines ?? '').toLowerCase();
    const candText = (canonicalPublicText(candidate) + ' ' + candidate.type).toLowerCase();
    if (evText.includes('scanner') || evText.includes('goes off')) {
      if (candText.includes('scanner') || candText.includes('surge') || candText.includes('order') || candText.includes('meu') || candText.includes('reading')) {
        score += 500_000_000_000;
      }
    }
    if (evText.includes('river')) {
      if (candText.includes('river') || candText.includes('embankment') || candText.includes('order')) {
        score += 500_000_000_000;
      }
    }
    if (evText.includes('standby') || evText.includes('gone')) {
      if (candText.includes('standby') || candText.includes('callout') || candText.includes('recall')) {
        score += 500_000_000_000;
      }
    }
    return score;
  },
});

/**
 * The committed public beat that set this scene up, or null.
 *
 * Qualifying means: earlier the same London day, public, has its own text, is
 * not itself a conversation, and involves somebody who is in this scene.
 */
export function setupBeatFor(event, snapshot, { selector = 'recency' } = {}) {
  const rank = SETUP_SELECTORS[selector];
  if (!rank) throw new TypeError(`Unknown setup selector: ${selector}`);
  const cast = new Set(cinematicSpeakers(event));
  if (!cast.size) return null;
  const day = londonDate(Number(event.occurredAt));
  const candidates = (snapshot?.events ?? []).filter((candidate) =>
    Number(candidate.occurredAt) < Number(event.occurredAt)
    && candidate.id !== event.id
    && candidate.visibility === 'public'
    && !SCENE_STAGING.has(candidate.type)
    && londonDate(Number(candidate.occurredAt)) === day
    && Boolean(canonicalPublicText(candidate))
    && (candidate.participants ?? []).some((who) => cast.has(who)));
  if (!candidates.length) return null;
  // Deterministic: rank, then the later event, then the id. Two runs of the
  // same world pick the same beat.
  const best = candidates.reduce((winner, candidate) => {
    if (!winner) return candidate;
    const delta = rank(candidate, event) - rank(winner, event);
    if (delta !== 0) return delta > 0 ? candidate : winner;
    if (candidate.occurredAt !== winner.occurredAt) return candidate.occurredAt > winner.occurredAt ? candidate : winner;
    return candidate.id > winner.id ? candidate : winner;
  }, null);
  return Object.freeze({
    originEventId: best.id,
    originType: best.type,
    originOccurredAt: Number(best.occurredAt),
    originTimeLabel: `Earlier \u00b7 ${displayTime(Number(best.occurredAt))}`,
    originSnippet: canonicalPublicText(best),
    originParticipants: [...(best.participants ?? [])],
    selector,
    // Reserved for a causal/thread selector. Null means "chosen by recency and
    // nothing claims this is the cause".
    relevance: null,
  });
}

export function primaryTone(event) {
  if (event.type === 'INCIDENT') return event.payload?.severity === 'critical' ? 'supernatural_crisis' : 'dangerous_intrusion';
  if (event.type === 'ARCANE_SURGE') return 'fantasy_pressure';
  if (event.type === 'AFTERMATH') return 'decompression';
  if (event.type === 'LEGION_VISIT') return 'comic_banter';
  if (event.type === 'VENUE_SCENE') return event.payload?.mood === 'cameo' ? 'strange_encounter' : 'characterful_downtime';
  if (event.type === 'CONVERSATION') return event.payload?.mood ?? 'quiet_connection';
  if (event.type === 'INTENT_RESPONSE' || event.type === 'INTENT_RENEGOTIATE') return 'quiet_connection';
  if (event.type === 'INTENT_COMPLETE' || event.type === 'GROUND_WORK_COMPLETED') return 'decompression';
  if (event.type === 'INTENT_INTERRUPTED' || event.type === 'GROUND_WORK_INTERRUPTED') return 'unfinished_business';
  if (event.type === 'AGENDA_RESOLVE' || event.type === 'AGENDA_DEADLINE') return 'institutional_consequence';
  if (event.type === 'UNEASE' || event.type === 'MINOR_ANOMALY') return 'uncanny';
  return 'observational';
}

function pressureFor(event, snapshot) {
  if (event.type === 'INCIDENT') return event.payload?.severity ?? 'medium';
  if (event.type === 'ARCANE_SURGE') return 'high';
  return snapshot?.pressure?.level ?? 'low';
}

/**
 * Build the only object the model may see. It contains a committed event and
 * the knowledge each speaker possessed at that instant; no future event and no
 * raw private value is copied into it.
 */
export function buildScenePacket(event, snapshot, { callbacks = [] } = {}) {
  if (!event?.id || event.visibility === 'private' || !canonicalPublicText(event)) throw new TypeError('A committed public event is required');
  snapshot = contextAtEvent(event, snapshot);
  const occurredAt = Number(event.occurredAt);
  const speakers = cinematicSpeakers(event);
  const canonicalLines = eventLines(event);
  const part = daypart(occurredAt);
  const visuals = selectVisualVocabulary({ event, daypart: part, room: event.room ?? event.area ?? null });
  const pressure = pressureFor(event, snapshot);
  const score = scoreCinematicEvent(event, { priorEvents: snapshot?.events ?? [] });
  const callbackRows = callbacks.filter((item) => Number(item.occurredAt) < occurredAt
    && (item.acceptedAt === undefined || item.acceptedAt <= occurredAt));
  const characters = Object.fromEntries(speakers.map((speaker) => {
    const witnessed = callbackRows.filter((item) => item.participants?.includes(speaker))
      .slice(-4).map((item) => ({ id: item.eventId, summary: item.chronicleSummary,
        quotes: item.quotes ?? [], occurredAt: item.occurredAt }));
    const facts = publicSourceFacts(snapshot, speaker, occurredAt);
    // The event itself is known to everybody actually in its scene. Requiring
    // this id on a factual line makes the anti-telepathy check mechanical.
    facts.push({ id: `event:${event.id}`, fact: canonicalPublicText(event), learnedAt: occurredAt,
      provenance: 'witnessed', sourceEventId: event.id });
    return [speaker, voicePacket(speaker, { event, knownFacts: facts, callbacks: witnessed })];
  }));
  const world = worldAtEvent(event, snapshot);
  const setup = setupBeatFor(event, snapshot);
  const packet = {
    packetVersion: CINEMATIC_PROMPT_VERSION,
    event: {
      id: event.id, type: event.type, location: event.location, area: event.area ?? null,
      room: event.room ?? event.area ?? null, activity: event.payload?.kind ?? event.payload?.mood ?? null,
      participants: speakers, occurredAt, canonicalSummary: event.publicDescription ?? event.description,
      canonicalProse: event.prose ?? null, canonicalLines,
      // Why the opening beat is happening, in the world's own committed words.
      setup,
    },
    scene: {
      primaryTone: primaryTone(event), fantasyPressure: pressure,
      danger: event.type === 'INCIDENT' && ['high', 'critical'].includes(event.payload?.severity),
      emotionalIntensity: Math.max(1, Math.min(10, Math.round(score.score / 10))),
      cinematicScore: score.score,
      targetDurationSeconds: score.score >= 90 ? 60 : score.score >= 70 ? 45 : 30,
      maxDialogueTurns: canonicalLines.length || !speakers.length ? 0 : 6,
    },
    characters,
    world: {
      londonDate: londonDate(occurredAt), londonTime: displayTime(occurredAt), daypart: part,
      locationFacts: [`The committed event occurs at ${event.location}${event.area ? `, in ${event.area}` : ''}.`],
      setting: settingForPerformance(event.location),
      ...world,
    },
    visuals,
    callbacks: callbackRows.filter((item) => speakers.every((speaker) => item.participants?.includes(speaker)))
      .slice(-3).map((item) => ({ id: item.eventId, summary: item.chronicleSummary,
        quotes: item.quotes ?? [], occurredAt: item.occurredAt })),
    forbidden: [
      'Change or extend the committed event', 'Invent a cause, consequence, object, ability, faction or participant',
      'Restate, paraphrase or explain event.setup — it is shown to the reader already, verbatim, before the scene',
      'Give a speaker knowledge absent from that speaker’s knownFacts', 'Refer to any Book One reveal after physical page 183',
      'Resolve an unexplained incident', 'Create an injury, confession, betrayal or irreversible development',
    ],
  };
  return Object.freeze(packet);
}

export const scenePacketKey = (packet) => createHash('sha256').update(JSON.stringify({
  worldRules: RULES_VERSION, cinematicRules: CINEMATIC_RULES_VERSION,
  prompt: CINEMATIC_PROMPT_VERSION, packet,
})).digest('hex').slice(0, 40);

/** A shared request must not see asymmetric knowledge, even under separate keys.
 * The richer packet stays server-side for validation. Untyped old memories are
 * omitted: their source event prose can disclose more than the learned fact.
 */
export function performancePacket(packet) {
  const result = structuredClone(packet);
  const actors = Object.values(result.characters);
  const shared = (field, id) => actors.every(actor => actor[field].some(item => item.id === id));
  // The setup beat is a reader-facing device, not a model input, and the two
  // have different rules. A published event may still be the source of one
  // speaker's private knowledge — the hardening test plants exactly that case —
  // and a shared request must never carry text only one of them witnessed. So
  // the internal packet keeps the setup, because the archive needs it to show a
  // reader why the scene opens where it does, and the transport drops it unless
  // every speaker was actually in it. Same rule as knownFacts, same reason.
  const cast = Object.keys(result.characters);
  if (result.event.setup && !cast.every(who => result.event.setup.originParticipants?.includes(who))) {
    result.event = { ...result.event, setup: null };
  }
  for (const actor of actors) {
    actor.knownFacts = actor.knownFacts.filter(fact => shared('knownFacts', fact.id)
      && (fact.id === `event:${packet.event.id}` || fact.presentationText))
      .map(fact => ({ id: fact.id, fact: fact.presentationText || fact.fact,
        presentationText: fact.presentationText || null, learnedAt: fact.learnedAt }));
    actor.recentRelevantMemories = actor.recentRelevantMemories.filter(memory => shared('recentRelevantMemories', memory.id));
  }
  return result;
}

export const CINEMATIC_SYSTEM_PROMPT = [
  'You perform one short scene in The Secrets of Silver Clouds. The event in the packet is already committed fact.',
  'You may add atmosphere, character-faithful dialogue, and nothing that changes what happened.',
  'Use only supplied characters, facts, callbacks, backgrounds and plate identifiers.',
  'A dialogue beat must list every fact or callback it relies on in factRefs. Use an empty list for pure banter or immediate sensory reaction.',
  'Never let one character use another character’s private knowledge. Never introduce lore, causes, consequences, plans, injuries, objects or people.',
  'If canonicalLines is non-empty, return no generated dialogue beats; the renderer will preserve those authored lines exactly.',
  'Write British English. Keep narration vivid and economical. Let concrete light, weather, sound and movement carry the prose.',
  'This is a living epic fantasy novel. Give the committed moment a small dramatic shape: an image, human response, then a final image that lands.',
  'Danger may be urgent and frightening when the event says it was. Humour can carry a scene by itself. Do not soften a crisis into office routine.',
  'Use a specific detail already licensed by the event. Avoid stock phrases such as the building holding its breath, ancient secrets, or destiny.',
  'Keep the total generated narration and dialogue under 140 words. Usually use 2–4 short dialogue turns.',
  'ChronicleSummary should closely paraphrase the canonical summary without adding any factual claim.',
  'The whole scene should feel like 20–60 seconds, not a chapter. Return only the requested JSON.',
].join('\n');

export function cinematicSceneSchema(packet) {
  const speakers = Object.keys(packet.characters);
  const plateIds = [...new Set(Object.values(packet.visuals.plates).flat())];
  return {
    type: 'object', additionalProperties: false,
    properties: {
      background: { type: 'string', enum: packet.visuals.backgrounds },
      openingNarration: { type: 'string', maxLength: 360 },
      beats: {
        type: 'array', maxItems: packet.scene.maxDialogueTurns,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            speaker: speakers.length ? { type: 'string', enum: speakers } : { type: 'string' },
            plate: plateIds.length ? { type: 'string', enum: plateIds } : { type: 'string' },
            line: { type: 'string', maxLength: 240 },
            factRefs: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          },
          required: ['speaker', 'plate', 'line', 'factRefs'],
        },
      },
      closingNarration: { type: 'string', maxLength: 300 },
      chronicleSummary: { type: 'string', maxLength: 280 },
    },
    required: ['background', 'openingNarration', 'beats', 'closingNarration', 'chronicleSummary'],
  };
}

function allSceneText(scene) {
  return [scene?.openingNarration, ...(scene?.beats ?? []).map((beat) => beat.line),
    scene?.closingNarration, scene?.chronicleSummary].filter(Boolean).join('\n');
}

function mentionsUncastCharacter(text, speakers) {
  for (const [id, name] of Object.entries(CHARACTER_NAMES)) {
    if (!speakers.includes(id) && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) return name;
  }
  return null;
}

export function validateCinematicScene(scene, packet) {
  if (!scene || typeof scene !== 'object' || Array.isArray(scene)) return { ok: false, reason: 'malformed' };
  for (const field of ['background', 'openingNarration', 'closingNarration', 'chronicleSummary']) {
    if (typeof scene[field] !== 'string') return { ok: false, reason: `missing:${field}` };
  }
  const keys = ['background', 'openingNarration', 'beats', 'closingNarration', 'chronicleSummary'];
  if (Object.keys(scene).some(key => !keys.includes(key))) return { ok: false, reason: 'unexpected_field' };
  if (scene.openingNarration.length > 360 || scene.closingNarration.length > 300
    || scene.chronicleSummary.length > 280) return { ok: false, reason: 'field_too_long' };
  if (!Array.isArray(scene.beats) || scene.beats.length > packet.scene.maxDialogueTurns) return { ok: false, reason: 'invalid_beats' };
  if (packet.event.canonicalLines.length && scene.beats.length) return { ok: false, reason: 'authored_dialogue_rewrite' };
  const visual = validateVisualChoice(scene, packet.visuals);
  if (!visual.ok) return visual;
  for (const beat of scene.beats) {
    if (!beat || typeof beat.line !== 'string' || !Array.isArray(beat.factRefs)) return { ok: false, reason: 'malformed_beat' };
    if (Object.keys(beat).some(key => !['speaker', 'plate', 'line', 'factRefs'].includes(key))
      || !beat.line.trim() || beat.line.length > 240 || beat.factRefs.length > 4
      || beat.factRefs.some(ref => typeof ref !== 'string')) return { ok: false, reason: 'malformed_beat' };
    if (PLATE_BY_ID[beat.plate]?.character !== beat.speaker) return { ok: false, reason: `plate_owner:${beat.speaker}` };
    const allowedFacts = new Set([
      ...(packet.characters[beat.speaker]?.knownFacts ?? []).map((fact) => fact.id),
      ...(packet.characters[beat.speaker]?.recentRelevantMemories ?? []).map((fact) => fact.id),
    ]);
    const illegal = beat.factRefs.find((id) => !allowedFacts.has(id));
    if (illegal) return { ok: false, reason: `knowledge:${beat.speaker}:${illegal}` };
  }
  const text = allSceneText(scene);
  if (!text.trim()) return { ok: false, reason: 'empty' };
  if (text.length > 2_500) return { ok: false, reason: 'too_long' };
  if (/https?:\/\/|^#|\*\*/m.test(text)) return { ok: false, reason: 'markup' };
  const spoilers = findSpoilers(text);
  if (spoilers.length) return { ok: false, reason: `embargoed:${spoilers[0].match}` };
  if (/\b(?:nameless|whisper\s+(?:is|was|means))\b/i.test(text)) return { ok: false, reason: 'embargoed:identity' };
  const uncast = mentionsUncastCharacter(text, Object.keys(packet.characters));
  if (uncast) return { ok: false, reason: `uncast_character:${uncast}` };
  const aliases = new Set(SCENE_LOCATION_ALIASES[packet.event.location] ?? []);
  const unknown = properNouns(text).filter(noun => !aliases.has(noun));
  if (unknown.length) return { ok: false, reason: `invented_name:${unknown.slice(0, 3).join(',')}` };
  return { ok: true, reason: null };
}

function canonicalBeats(packet) {
  return packet.event.canonicalLines.map((item) => ({
    speaker: item.speaker,
    plate: plateForExpression(item.speaker, item.expression),
    line: item.line,
    factRefs: [`event:${packet.event.id}`],
  })).filter((beat) => beat.plate);
}

export function acceptCinematicScene(scene, packet, { source = 'model' } = {}) {
  const composed = {
    background: scene.background,
    openingNarration: scene.openingNarration.trim(),
    beats: packet.event.canonicalLines.length ? canonicalBeats(packet) : scene.beats.map((beat) => ({ ...beat, line: beat.line.trim() })),
    closingNarration: scene.closingNarration.trim(),
    // Generated text is a performance, never a new factual memory.
    chronicleSummary: packet.event.canonicalSummary,
    source,
  };
  return { ...composed, assets: publicAssetManifest(composed) };
}

export function deterministicFallbackScene(packet, reason = 'fallback') {
  const background = packet.visuals.backgrounds[0];
  const fallback = {
    background,
    openingNarration: packet.event.canonicalProse || packet.event.canonicalSummary,
    beats: canonicalBeats(packet),
    closingNarration: '',
    chronicleSummary: packet.event.canonicalSummary,
    source: 'canonical', reason,
  };
  return { ...fallback, assets: publicAssetManifest(fallback) };
}

export function cinematicConfig(env = process.env) {
  const number = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  };
  return Object.freeze({
    enabled: env.WORLDSTREAM_CINEMATICS_ENABLED === 'true' && Boolean(env.OPENAI_API_KEY),
    model: env.WORLDSTREAM_MODEL || DEFAULT_CINEMATIC_MODEL,
    minScore: number('WORLDSTREAM_MIN_CINEMATIC_SCORE', 52, { min: 30, max: 95 }),
    maxCallsPerDay: Math.floor(number('WORLDSTREAM_MAX_LLM_CALLS_PER_DAY', 16, { min: 0, max: 100 })),
    maxDailyCostUsd: number('WORLDSTREAM_MAX_DAILY_COST', 1, { min: 0, max: 1_000 }),
    estimatedCostPerCallUsd: number('WORLDSTREAM_ESTIMATED_COST_PER_CALL_USD', 0.05, { min: 0, max: 100 }),
    activeViewerTtlMs: number('WORLDSTREAM_ACTIVE_VIEWER_TTL_SECONDS', 60, { min: 30, max: 300 }) * 1_000,
    reconnectGraceMs: number('WORLDSTREAM_RECONNECT_GRACE_SECONDS', 15, { min: 0, max: 120 }) * 1_000,
    generationLeaseMs: number('WORLDSTREAM_GENERATION_LEASE_SECONDS', 90, { min: 15, max: 600 }) * 1_000,
    maxAttempts: Math.floor(number('WORLDSTREAM_MAX_GENERATION_ATTEMPTS', 2, { min: 1, max: 2 })),
    maxOutputTokens: Math.floor(number('WORLDSTREAM_MAX_OUTPUT_TOKENS', 1500, { min: 200, max: 2_000 })),
    timeoutMs: number('WORLDSTREAM_MODEL_TIMEOUT_SECONDS', 30, { min: 5, max: 60 }) * 1_000,
    minSceneGapMs: number('WORLDSTREAM_MIN_SCENE_GAP_MINUTES', 10, { min: 0, max: 180 }) * 60_000,
    liveWindowMs: number('WORLDSTREAM_LIVE_EVENT_WINDOW_MINUTES', 3, { min: 1, max: 10 }) * 60_000,
  });
}

export function openAICinematicClient({ apiKey, model = DEFAULT_CINEMATIC_MODEL, fetchImpl = globalThis.fetch,
  timeoutMs = 30_000, maxOutputTokens = 1500 } = {}) {
  if (!apiKey) throw new TypeError('An API key is required');
  return async function generate(packet, { signal, repairReason } = {}) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, instructions: CINEMATIC_SYSTEM_PROMPT + (repairReason
          ? `\nThe prior response was rejected: ${String(repairReason).slice(0, 160)}. Return a corrected performance of the same event.` : ''),
        input: JSON.stringify(performancePacket(packet)), max_output_tokens: maxOutputTokens, store: false,
        ...(model === DEFAULT_CINEMATIC_MODEL ? { reasoning: { effort: 'minimal' } } : {}),
        text: { format: { type: 'json_schema', name: 'worldstream_cinematic_scene', strict: true,
          schema: cinematicSceneSchema(packet) } },
      }),
    });
    if (!response.ok) throw new Error(`Cinematic request failed: ${response.status}`);
    const body = await response.json();
    const outputText = body.output_text ?? body.output?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === 'output_text')?.text;
    if (!outputText) throw new Error('Cinematic response carried no output text');
    return { scene: JSON.parse(outputText), usage: body.usage ?? null, model: body.model ?? model };
  };
}

export function cinematicRecordForApi(record) {
  if (!record) return null;
  const scene = record.scene ? {
    background: record.scene.background, openingNarration: record.scene.openingNarration,
    beats: (record.scene.beats ?? []).map(({ speaker, plate, line }) => ({ speaker, plate, line })),
    closingNarration: record.scene.closingNarration, chronicleSummary: record.scene.chronicleSummary,
    source: record.scene.source, assets: publicAssetManifest(record.scene),
  } : null;
  return {
    eventId: record.eventId, occurredAt: record.occurredAt, acceptedAt: record.acceptedAt,
    score: record.score, band: record.band, status: record.status,
    durationSeconds: record.packet?.scene?.targetDurationSeconds ?? 45,
    setup: record.packet?.event?.setup ? {
      originEventId: record.packet.event.setup.originEventId,
      originType: record.packet.event.setup.originType,
      originOccurredAt: record.packet.event.setup.originOccurredAt,
      originTimeLabel: record.packet.event.setup.originTimeLabel,
      originSnippet: record.packet.event.setup.originSnippet,
    } : null,
    // Historical presentation context only. Never spread packet.world or voices:
    // those may contain knowledge that does not belong on the public page.
    atmosphere: {
      location: record.packet?.event?.location ?? null,
      room: record.packet?.event?.room ?? null,
      eventType: record.packet?.event?.type ?? null,
      weatherCode: ['clear', 'cloudy', 'light_rain', 'heavy_rain', 'fog', 'storm']
        .includes(record.packet?.world?.weather?.code) ? record.packet.world.weather.code : 'cloudy',
      time: Number.isFinite(record.occurredAt) ? {
        dayPhase: dayPhase(record.occurredAt), daylight: daylightFraction(record.occurredAt),
        daypart: daypart(record.occurredAt),
      } : {},
    },
    scene, chronicleSummary: scene?.chronicleSummary ?? null,
  };
}
