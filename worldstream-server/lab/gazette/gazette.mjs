import { newsworthiness, isNewsworthy, NEWSWORTHY_FLOOR } from './newsworthiness.mjs';
import { sourcesFor, hedgeFor } from './sources.mjs';
import { shapeOf, headline, sectionFor } from './voice.mjs';
import { hash } from '../engine/rng.mjs';
import { londonDate } from '../../src/time.mjs';

// The editorial desk.
//
// It reads committed public events, keeps its own memory of what it has already
// printed, and produces editions. It has one absolute rule, the same one the
// Moment Engine has: **it reports reality, it does not create it.** No headline
// causes an event. There is no path in this file that writes to Worldstream.
//
// What it does produce, and this is the part that makes it a simulation rather
// than decoration, is *public knowledge*. When the Gazette prints that the
// eastern line is expected to reopen, that expectation becomes a thing the city
// believes. When the line then fails, the Moment Engine can see both facts and
// Goaden can say "paper said they fixed this" — an action that did not exist
// before the paper printed the claim. The newspaper does not cause the failure.
// It causes there to be something to say about it.
//
// The other thing it does is be wrong. A claim carries the confidence of its
// best source, and when later events contradict a printed claim the paper runs
// a correction rather than the simulation quietly retconning itself.

export const GAZETTE_RULES = Object.freeze({
  leadPerEdition: 1,
  briefsPerEdition: 4,
  threadIdleDays: 9,        // after this a thread goes cold and stops accruing
  followUpWindowDays: 14,   // how long a printed claim stays quotable
  correctionWindowDays: 5,
});

/** The paper's own memory. Not world state — what it has said, and to whom. */
export function createDesk({ seed = 'gazette-v1' } = {}) {
  return { seed, threads: new Map(), editions: [], claims: [], corrections: [], published: new Set() };
}

// A thread's identity: what kind of thing, happening to what. Two Streamliner
// failures on the eastern line are one story; a Streamliner failure and a
// closed training ground are two.
function threadKeyFor(event) {
  const subject = event.payload?.notice ?? event.payload?.kind ?? event.location ?? 'city';
  const kind = event.type === 'INSTITUTION_NOTICE' ? (event.payload?.notice ?? 'notice')
    : event.type === 'WEATHER_DISRUPTION' ? 'disruption'
      : event.type === 'MINOR_ANOMALY' ? 'anomaly'
        : event.type;
  return `${kind}:${subject}`;
}

function threadFor(desk, event, day) {
  const key = threadKeyFor(event);
  let thread = desk.threads.get(key);
  if (thread && daysBetween(thread.lastDay, day) > GAZETTE_RULES.threadIdleDays) {
    thread.status = 'cold';
    thread = undefined;
  }
  if (!thread) {
    thread = { id: `${key}#${desk.threads.size + 1}`, key, kind: key, entries: [],
      openedDay: day, lastDay: day, status: 'running' };
    desk.threads.set(key, thread);
  }
  return thread;
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Consider one committed public event. Returns the item the paper would run, or
 * null. Nothing is written to Worldstream in either case.
 */
export function consider(desk, event, { factions = {}, day = londonDate(event.occurredAt) } = {}) {
  if (event.visibility !== 'public' || !event.publicDescription) return null;
  if (desk.published.has(event.id)) return null;

  const existing = desk.threads.get(threadKeyFor(event));
  const similar = existing?.entries.at(-1);
  const assessment = newsworthiness(event, {
    thread: existing?.status === 'running' ? existing : null,
    daysSinceSimilar: similar ? daysBetween(similar.day, day) : null,
    knownCause: Boolean(sourcesFor(event, { factions }).sources.find(s => s.trust >= 4)),
  });
  if (!isNewsworthy(assessment)) return null;

  const thread = threadFor(desk, event, day);
  const sourcing = sourcesFor(event, { factions, seed: desk.seed });
  const shape = shapeOf(event, thread);
  // THING is what the story is *about*, and it must never fall back to a
  // location: "LOCAL MI6 REFUSES TO BEHAVE" is what happens when it does.
  const slots = { A: dominantFaction(factions, event),
    THING: event.payload?.kind ?? SUBJECT_NOUNS[event.payload?.notice] ?? 'thing',
    EVENT: EVENT_PHRASES[event.payload?.notice] ?? event.type.toLowerCase().replace(/_/g, ' ') };
  const item = {
    id: `story:${hash(`${desk.seed}|${event.id}`).toString(16)}`,
    day, at: event.occurredAt, eventId: event.id,
    threadId: thread.id, entryNumber: thread.entries.length + 1,
    shape, section: sectionFor(event, shape),
    headline: headline({ shape, event, thread, seed: desk.seed, slots }),
    size: assessment.score >= 26 ? 'lead' : assessment.score >= 18 ? 'story' : 'brief',
    score: assessment.score, terms: assessment.terms, why: assessment.why,
    attribution: sourcing.sources.map(source => source.attribution).filter(Boolean)[0] ?? null,
    confidence: sourcing.confidence, hedge: hedgeFor(sourcing.confidence),
    body: event.publicDescription,
    // What the paper is asserting. A claim is checkable, which is what makes a
    // correction possible later.
    claims: claimsFrom(event, shape, day),
  };
  thread.entries.push({ day, itemId: item.id, eventId: event.id, headline: item.headline });
  thread.lastDay = day;
  desk.published.add(event.id);
  desk.claims.push(...item.claims.map(claim => ({ ...claim, itemId: item.id, threadId: thread.id })));
  return item;
}

// The paper's testable assertions. Deliberately few and deliberately dull: a
// claim exists so that reality can contradict it.
function claimsFrom(event, shape, day) {
  const claims = [];
  if (shape === 'service_failure')
    claims.push({ kind: 'expected_to_resume', subject: event.location, madeOn: day,
      text: 'expected back in service shortly' });
  if (shape === 'reassurance')
    claims.push({ kind: 'nothing_wrong', subject: event.location, madeOn: day,
      text: 'no cause for concern' });
  if (shape === 'magical_oddity' && event.payload?.kind)
    claims.push({ kind: 'explained_as_routine', subject: event.payload.kind, madeOn: day,
      text: 'described as routine' });
  return claims;
}

// Who the story is about. Read off the event first — a Church notice is about
// the Church — and only fall back to whichever institution is currently making
// the most noise. Defaulting to the Order regardless was how a fortnight of
// weather became a fortnight of Order coverage.
// A plain noun for the thing a headline is about.
const SUBJECT_NOUNS = Object.freeze({
  arcane_signature: 'reading', corridor_light: 'corridor', chimes_pulse: 'bell',
  lintel_low: 'lintel', meu_handheld: 'handheld', yard_shut: 'yard',
  storm_breaks: 'river', fog_closed: 'crossing', order_procession: 'procession',
  church_preparations: 'preparations', sanctuary_private: 'hall', veil_notice: 'notice',
  general_rounds: 'rounds', mi6_recall: 'recall',
});

// How a headline refers to the incident. Printing the raw state key produced
// "THE SANCTUARY FACES QUESTIONS AFTER SANCTUARY_PRIVATE", which is a database
// column wearing a hat.
const EVENT_PHRASES = Object.freeze({
  arcane_signature: 'the reading', corridor_light: 'the corridor', chimes_pulse: 'the chimes',
  order_procession: 'the procession', church_preparations: 'the preparations',
  sanctuary_private: 'the closed halls', veil_notice: 'the veil dates',
  general_rounds: 'the rounds', mi6_recall: 'the recall', yard_shut: 'the closure',
  storm_breaks: 'the flooding', fog_closed: 'the fog',
});

const NOTICE_FACTION = Object.freeze({
  order_procession: 'order', veil_notice: 'church', church_preparations: 'church',
  sanctuary_private: 'sanctuary', mi6_recall: 'mi6', general_rounds: 'mi6',
  arcane_signature: 'arcane', corridor_light: 'arcane', chimes_pulse: 'church',
  storm_breaks: null, fog_closed: null, yard_shut: null,
});
function dominantFaction(factions, event) {
  const notice = event?.payload?.notice;
  if (notice && NOTICE_FACTION[notice] !== undefined) {
    if (NOTICE_FACTION[notice]) return NOTICE_FACTION[notice];
    return 'borough';
  }
  if (factions.order === 'active_in_city') return 'order';
  if (factions.mi6 === 'elevated') return 'mi6';
  if (factions.arcane === 'high') return 'arcane';
  return 'borough';
}

/**
 * Check standing claims against what has since happened, and run corrections.
 * The paper is wrong; the simulation is not. That distinction is the whole
 * value of this function.
 */
export function reconcile(desk, event, day) {
  const corrections = [];
  for (const claim of desk.claims) {
    if (claim.retracted) continue;
    if (daysBetween(claim.madeOn, day) > GAZETTE_RULES.correctionWindowDays) continue;
    const contradicted =
      (claim.kind === 'expected_to_resume' && event.location === claim.subject
        && /DISRUPTION|CLOSED|FAIL/i.test(event.type))
      || (claim.kind === 'nothing_wrong' && event.location === claim.subject
        && ['ARCANE_SURGE', 'INCIDENT'].includes(event.type))
      || (claim.kind === 'explained_as_routine' && event.payload?.kind === claim.subject);
    if (!contradicted) continue;
    claim.retracted = day;
    corrections.push({
      id: `correction:${hash(`${desk.seed}|${claim.itemId}|${day}`).toString(16)}`,
      day, threadId: claim.threadId, aboutItem: claim.itemId,
      text: CORRECTION_FORMS[hash(`${desk.seed}|c|${claim.itemId}`) % CORRECTION_FORMS.length]
        .replace('[CLAIM]', claim.text),
    });
  }
  desk.corrections.push(...corrections);
  return corrections;
}

const CORRECTION_FORMS = Object.freeze([
  'Earlier editions reported that it was [CLAIM]. It was not.',
  'CORRECTION: apparently not.',
  'The Gazette said [CLAIM]. The Gazette was going on what it was told.',
  'An earlier edition described the matter as [CLAIM]. The borough would like that revisited.',
]);

/** Assemble one day's paper from the items the desk kept. */
export function edition(desk, day, items, corrections) {
  const ranked = [...items].sort((a, b) => b.score - a.score);
  const lead = ranked[0] ?? null;
  const sections = new Map();
  for (const item of ranked.slice(0, 1 + GAZETTE_RULES.briefsPerEdition)) {
    if (!sections.has(item.section)) sections.set(item.section, []);
    sections.get(item.section).push(item);
  }
  const built = { day, lead, sections: Object.fromEntries(sections), corrections,
    threads: [...desk.threads.values()].filter(thread => thread.lastDay === day)
      .map(thread => ({ id: thread.id, entries: thread.entries.length })) };
  desk.editions.push(built);
  return built;
}

/**
 * What the paper has published that a character could now refer to. This is the
 * bridge into the Moment Engine: a printed claim is a callback seed, and a
 * *contradicted* printed claim is a better one.
 */
export function publicKnowledgeAffordances(desk, day) {
  const out = [];
  const seen = new Set();
  for (const claim of desk.claims) {
    const age = daysBetween(claim.madeOn, day);
    if (age < 0 || age > GAZETTE_RULES.followUpWindowDays) continue;
    // One affordance per claim, not one per printing of it. The paper saying
    // the same reassuring thing three times does not give a character three
    // separate things to say about it.
    const key = `gazette_${claim.kind}_${String(claim.subject).replace(/[^a-z0-9]+/gi, '_')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      topic: claim.retracted ? 'failed_prediction' : 'printed_claim',
      by: null,                       // anybody who reads the paper
      sourceEventId: claim.itemId,
      spent: false,
      contradicted: Boolean(claim.retracted),
      text: claim.text,
    });
  }
  return out;
}

export { NEWSWORTHY_FLOOR };
