import { hash } from '../engine/rng.mjs';

// The paper's voice, as grammar rather than as prose.
//
// Headline families are keyed by the *semantic shape* of what happened, not by
// the event type, which is what lets one family serve a Streamliner failure, a
// closed bridge and a shut training ground. The Gazette's own tendencies then
// select between families: it is sceptical of the Order, respectful of MI6,
// delighted by anything magical and structurally incapable of resisting a
// borough dispute.
//
// Everything here is authored once. Runtime recombines; it never writes.

export const TENDENCIES = Object.freeze({
  sensational: 0.6,        // reaches for the bigger word
  scepticalOfOrder: 0.8,
  deferentialToMI6: 0.7,
  delightedByMagic: 0.9,
  lovesBoroughDisputes: 0.8,
  buriesTheSerious: 0.3,   // occasionally leads with something silly
});

// Semantic shapes. A shape is what the story *is*, stripped of its particulars.
export const SHAPES = Object.freeze({
  institution_clash: [
    '[A] DENIES [B]',
    'BOROUGH DEMANDS ANSWERS',
    '[A] FACES QUESTIONS AFTER [EVENT]',
    'WHO KNEW WHAT — AND WHEN?',
    '[A] SAYS MATTER CLOSED. BOROUGH DISAGREES.',
  ],
  magical_oddity: [
    'THE [THING] THAT SHOULD NOT EXIST',
    'LOCAL [THING] REFUSES TO BEHAVE',
    'LINTEL STOPS TRAFFIC. AGAIN.',
    'IT DID IT AGAIN AND NOBODY WILL SAY WHY',
    'MEU: “ENTIRELY NORMAL”. EVERYONE ELSE: “IT IS NOT.”',
  ],
  service_failure: [
    'EASTERN LINE FAILS AGAIN',
    '[THING] OUT OF ACTION FOR THIRD TIME THIS WEEK',
    'STILL SHUT',
    'NO, IT IS NOT FIXED',
    '[THING] CLOSED. NO ONE TOLD THE BOROUGH.',
  ],
  weather: [
    'CITY UNDER WATER BY LUNCHTIME',
    'THE RIVER CAME UP THE STEPS AGAIN',
    'FOG STOPS EVERYTHING, AS PREDICTED BY NOBODY',
  ],
  procession: [
    'ORDER WALKS THE BOROUGH',
    'THE STREETS WENT QUIET AND NOBODY SAID WHY',
    'COLOURS ON THE EMBANKMENT',
  ],
  reassurance: [
    'NOTHING TO REPORT, SAYS [A]',
    'ALL QUIET. ALLEGEDLY.',
    '[A] URGES CALM',
  ],
  human_interest: [
    'THE QUIETEST CORNER OF THE BOROUGH',
    'SOMEBODY HAS BEEN COUNTING',
    'THE BENCH NOBODY SITS ON',
  ],
});

// Which shape a thread takes. Kept separate from the event type so a shape can
// be reached several ways.
// The notice key is more informative than the event type, and reading the type
// first was a real error: it filed a storm coming up the river under
// "institution clash" and the paper spent a fortnight demanding that the Holy
// Order account for the weather.
const NOTICE_SHAPES = Object.freeze({
  storm_breaks: 'weather', fog_closed: 'weather', yard_shut: 'service_failure',
  storm_over: 'weather', order_procession: 'procession', veil_notice: 'institution_clash',
  chimes_pulse: 'magical_oddity', arcane_surge: 'magical_oddity',
  arcane_signature: 'magical_oddity', corridor_light: 'magical_oddity',
  lintel_low: 'magical_oddity', meu_handheld: 'magical_oddity',
  sanctuary_private: 'institution_clash', church_preparations: 'institution_clash',
  general_rounds: 'reassurance', mi6_recall: 'institution_clash',
});

export function shapeOf(event, thread) {
  const notice = event.payload?.notice ?? event.payload?.kind;
  if (notice && NOTICE_SHAPES[notice]) return NOTICE_SHAPES[notice];
  if (thread?.entries.length >= 1 && /DISRUPTION|CLOSED|SHUT|FAIL/i.test(thread.kind))
    return 'service_failure';
  if (event.type === 'ARCANE_SURGE' || event.type === 'MINOR_ANOMALY') return 'magical_oddity';
  if (event.type === 'WEATHER_DISRUPTION') return 'weather';
  if (event.type === 'FACTION_STATUS') return 'institution_clash';
  if (event.type === 'INSTITUTION_NOTICE') return 'reassurance';
  return 'reassurance';
}

const FACTION_NAMES = Object.freeze({
  order: 'THE HOLY ORDER', mi6: 'MI6', church: 'THE CHURCH',
  arcane: 'THE MEU', streamliner: 'THE STREAMLINER BOARD', sanctuary: 'THE SANCTUARY',
  borough: 'THE BOROUGH',
});

/** A headline, chosen deterministically from the family the shape names. */
export function headline({ shape, event, thread, seed = '', slots = {} }) {
  const bank = SHAPES[shape] ?? SHAPES.reassurance;
  // Later entries in a thread step through the bank rather than re-rolling, so
  // a running story does not print the same headline twice.
  const step = thread ? thread.entries.length : 0;
  const offset = hash(`${seed}|headline|${shape}|${thread?.id ?? event.id}`) % bank.length;
  let text = bank[(offset + step) % bank.length];
  const fill = { A: FACTION_NAMES[slots.A] ?? slots.A ?? 'THE BOROUGH',
    B: FACTION_NAMES[slots.B] ?? slots.B ?? 'THE CLAIM',
    THING: (slots.THING ?? 'thing').toUpperCase().replace(/_/g, ' '),
    EVENT: (slots.EVENT ?? 'the incident').toUpperCase() };
  for (const [key, value] of Object.entries(fill)) text = text.replaceAll(`[${key}]`, value);
  return text;
}

/** Where in the paper it goes. */
export function sectionFor(event, shape) {
  if (shape === 'magical_oddity') return 'Arcane';
  if (shape === 'weather') return 'Weather';
  if (shape === 'service_failure') return 'London';
  if (shape === 'procession' || shape === 'institution_clash') return 'Front Page';
  if (event.location === 'legion_hideout' || event.location === 'sanctuary'
    || event.location === 'enchanted_ink') return 'Culture';
  return 'London';
}
