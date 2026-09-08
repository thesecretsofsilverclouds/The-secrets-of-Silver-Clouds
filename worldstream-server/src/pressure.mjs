import { createHash } from 'node:crypto';
import { MINUTE_MS as MIN } from './time.mjs';
import { areaOf, permitsArea } from './places.mjs';

// Fantasy Pressure: the second axis.
//
// Tension asks "is the world already carrying weight?" and gates the director
// *out* — a tense day has its own shape and does not need a catalyst. Pressure
// asks a different question, and gates things *in*:
//
//     how abnormal is the world around them right now?
//
// The two are deliberately not the same number. Tension is institutional
// posture plus what the pair are carrying between them. Pressure is how much
// strangeness is bleeding into their day, and — this is the part that makes it
// feel authored rather than random — **it has momentum.** An incident raises
// it and it walks down over the following days, so a confrontation arrives
// after a week of things being slightly wrong rather than out of a clear sky.
//
// The prior this replaces was ordinary-life-with-occasional-weirdness. The
// prior now is: ordinary life is always present, and weirdness is constantly
// brushing against it. Goaden and Ashai are not ordinary Londoners and their
// exposure multiplier says so.
export const PRESSURE_LEVELS = Object.freeze(['low', 'medium', 'high', 'critical']);
// Measured, then moved. The first cut put a pursuit or a breach on the calendar
// every three days, which is a theme park rather than a city. The bands are now
// set so that the common posture — a moderate MEU reading with the Order out —
// reads as *medium*, and it takes a genuinely bad combination to reach high.
export const PRESSURE_BANDS = Object.freeze({ low: 0, medium: 0.34, high: 0.7, critical: 0.9 });
export const PRESSURE_RULES = Object.freeze({
  // These two are exceptional people in an exceptional job. An ordinary
  // resident of the boroughs would meet almost none of this.
  exposure: 2.6,
  // A day's pressure walks down by this much when nothing happens, so a bad
  // week stays bad for a while and then eases.
  dailyDecay: 0.14,
  // Ceiling on how much of the day's own baseline any single incident adds.
  incidentFloor: Object.freeze({ unease: 0.18, medium: 0.42, high: 0.66, critical: 0.9 }),
  maxIncidentsPerDay: 3,
  minGapMinutes: 100,
});

const clamp01 = value => Math.max(0, Math.min(1, value));
const hash = text => createHash('sha256').update(text).digest().readUInt32BE(0);

// The baseline the world sets before anything happens to them. Read off public
// posture, so a day the MEU is lit is a strange day whether or not the pair
// notice it.
const FACTION_WEIGHT = Object.freeze({
  arcane: { low: 0.05, moderate: 0.3, high: 0.62 },
  mi6: { routine: 0, briefings: 0.12, elevated: 0.3 },
  order: { quiet: 0, watchful: 0.1, active_in_city: 0.26 },
  church: { quiet: 0, preparations: 0.04, veil_cycle: 0.08 },
});
// The Veil drags the whole city strange as it closes.
const VEIL_WEIGHT = Object.freeze({ distant: 0, announced: 0.04, preparing: 0.1, imminent: 0.22, underway: 0.3 });

export function baselinePressure({ factions = {}, veilPhase = 'distant' } = {}) {
  let value = 0;
  for (const [faction, scale] of Object.entries(FACTION_WEIGHT)) value += scale[factions[faction]] ?? 0;
  value += VEIL_WEIGHT[veilPhase] ?? 0;
  return clamp01(value);
}

// What the world actually is right now: the day's baseline, or the residue of
// what has recently happened to them, whichever is higher. A floor rather than
// a sum, for the same reason the relationship model uses one — an increment
// cannot survive a decay of the same size, and taking a maximum is idempotent
// under replay.
export const pressureValue = (baseline, carried = 0) => clamp01(Math.max(baseline, carried));
export function pressureLevel(value) {
  if (value >= PRESSURE_BANDS.critical) return 'critical';
  if (value >= PRESSURE_BANDS.high) return 'high';
  if (value >= PRESSURE_BANDS.medium) return 'medium';
  return 'low';
}
export const atLeast = (level, floor) =>
  PRESSURE_LEVELS.indexOf(level) >= PRESSURE_LEVELS.indexOf(floor);

// ---------------------------------------------------------------------------
// The repertoire.
//
// Weighted heavily toward unease, because that is what makes the rest land. A
// world where somebody is attacked every week is a theme park; a world where
// small things are persistently wrong, and then once in a while something
// happens, is the one worth watching. This existing repertoire has no authored
// resolutions yet. That is a content limitation, not a continuity prohibition
// on future Worldstream stories with approved, persisted outcomes.
//
// Every line here passes the spoiler registry, and none of it reaches for the
// three reveals: no brother, no parentage, no alter ego, no chained door.

// Low. Environmental texture; these definitions currently schedule no follow-up.
export const UNEASE = Object.freeze([
  { kind: 'lintel_vigil', at: 'mi6',
    text: 'A lintel settled outside the quarters window and stayed there. It was still there at six.' },
  { kind: 'wrong_platform', at: 'streamliner',
    text: 'The Streamliner doors opened on a platform that was not on the line, for about three seconds, and then closed.' },
  { kind: 'burned_docket', at: 'mi6',
    text: 'A docket arrived for the section with the bottom third burned away. Nobody had sent it.' },
  { kind: 'sealed_corridor', at: 'mi6',
    text: 'MI6 sealed the east corridor before the morning rota and gave no reason for it.' },
  { kind: 'unrecognised', at: 'mi6',
    text: 'Somebody Goaden has worked beside for months walked straight past him in the corridor without a flicker.' },
  { kind: 'wet_footprint', at: 'mi6',
    text: 'There was a wet footprint in a store room that had not been unlocked since Friday.' },
  { kind: 'clock_disagreement', at: 'big_ben_plaza',
    text: 'For one round of the hour the Chimes of Renewal rang thirteen, and the plaza pretended not to notice.' },
  { kind: 'quiet_meu', at: 'mi6',
    text: 'Every MEU handheld in the building read zero for a minute and a half, which they are not built to do.' },
  { kind: 'ink_relocation', at: 'enchanted_ink',
    text: 'Enchanted Ink was on the wrong street again, and the street it had left was one street shorter than it should be.' },
  { kind: 'listening_rain', at: 'mi6',
    text: 'The rain stopped on one side of the yard and carried on falling on the other for a while.' },
]);

// Medium. Something is present and taking an interest. Still no resolution.
export const INCIDENTS_MEDIUM = Object.freeze([
  { kind: 'courier', at: 'mi6', text: 'A courier came to the gate with a package for a name nobody at the barracks has heard of, and would not leave it.' },
  { kind: 'followed', at: 'city', text: 'Somebody kept pace with them from the plaza to the barracks gate on the far side of the road, and turned back at the lamps.' },
  { kind: 'sighting', at: 'city', text: 'Something the size of a dog and the wrong shape for one crossed the road ahead of them and did not come out the other side.' },
  { kind: 'artefact', at: 'mi6', text: 'A sealed case came up from the river teams that the MEU could not get a reading off at all, in either direction.' },
  { kind: 'hostile_words', at: 'city', text: 'A man in Order colours said something to Goaden across the street that was not quite loud enough to answer.' },
  { kind: 'patrol', at: 'city', text: 'There were three Holy Order patrols between the cafe and the barracks, which is two more than the borough has ever needed.' },
]);

// High. It is no longer watching. Consequences are real: an evening goes, a
// night goes, somebody is somewhere they did not plan to be.
export const INCIDENTS_HIGH = Object.freeze([
  { kind: 'pursuit', at: 'city', text: 'Something came after them between the plaza and the river and they did not stop running until the barracks lights.' },
  { kind: 'breach', at: 'mi6', text: 'The north-face perimeter alarm cut through MI6. For a moment, every conversation in the room stopped.' },
  { kind: 'surge_incident', at: 'city', text: 'The corridor lit up along a mile of the Thames and everything with a Presence in it felt the pull.' },
  { kind: 'deployment', at: 'mi6', text: 'A short-notice readiness alert reached the section. Goaden and Ashai put their afternoon aside to read it.' },
  { kind: 'hunted', at: 'city', text: 'Something was hunting along the embankment. They went the long way and kept to the lit streets.' },
]);

// Critical. Rare on purpose. The page should feel different on these days.
export const INCIDENTS_CRITICAL = Object.freeze([
  { kind: 'confrontation', at: 'city', text: 'It found them on the way back and it did not intend to leave. Goaden drew. It took both of them and it took a while.' },
  { kind: 'multi_faction', at: 'city', text: 'MI6, the Order and the MEU were all on the same street by midnight, and none of them would say who had called it.' },
  { kind: 'severe_event', at: 'city', text: 'The sky over the river came apart for most of a minute. Half of London saw it. Nobody has explained it since.' },
]);

export const REPERTOIRE = Object.freeze({
  unease: UNEASE, medium: INCIDENTS_MEDIUM, high: INCIDENTS_HIGH, critical: INCIDENTS_CRITICAL,
});
// What each severity is allowed to cost. Bounded on purpose: an incident may
// take an evening, a night's sleep or a plan, and may leave them shaken. It may
// not injure anybody. Resolving a larger story needs its own committed effects;
// a presentation layer cannot invent that resolution.
export const CONSEQUENCE = Object.freeze({
  unease: { interrupts: false, concern: 0, aftermath: false, both: false },
  medium: { interrupts: true, concern: 1, aftermath: false, both: false },
  high: { interrupts: true, concern: 2, aftermath: true, both: true },
  critical: { interrupts: true, concern: 3, aftermath: true, both: true },
});

// The text's cast is a requirement, independent of its severity. In particular,
// medium "them" scenes need both protagonists even though their cost is small.
const PAIR_KINDS = new Set(['followed', 'sighting']);
const UNEASE_AREAS = Object.freeze({
  lintel_vigil: 'quarters', unrecognised: 'corridors', sealed_corridor: 'corridors',
  listening_rain: 'training', wrong_platform: 'transit',
  clock_disagreement: 'venue', ink_relocation: 'venue',
});

/** Bind authored pressure content to the physical state at execution time.
 * Day-level selection is only a proposal: it cannot move actors into a scene.
 * Environmental notices have a source location but confer no character knowledge.
 */
export function pressureContext(action, state) {
  const severity = action.type === 'UNEASE' ? 'unease' : action.severity;
  const definition = REPERTOIRE[severity]?.find(item => item.kind === action.kind);
  if (!definition || (action.type === 'INCIDENT' && severity === 'unease')
    || (action.type === 'UNEASE' && action.severity && action.severity !== 'unease')) {
    throw new Error(`Unknown incident ${action.kind} / ${severity}`);
  }
  if (action.text !== definition.text) throw new Error(`Incident text differs: ${action.kind}`);
  const result = { definition, severity, participants: [], location: definition.at,
    area: UNEASE_AREAS[definition.kind] ?? null, reason: null };
  if (severity === 'unease') {
    // This one sentence actually names Goaden in a corridor. It is not a remote
    // environmental notice, even though it still teaches nobody a new fact.
    if (definition.kind === 'unrecognised') {
      const goaden = state.characters.goaden;
      if (!goaden || goaden.location !== 'mi6' || goaden.area !== 'corridors'
        || goaden.journey || ['sleeping', 'travelling'].includes(goaden.activity)) {
        result.reason = 'Goaden is not awake in the corridor';
      }
    }
    return result;
  }

  const offered = action.actors ?? (action.actor ? [action.actor] : []);
  const paired = CONSEQUENCE[severity].both || PAIR_KINDS.has(definition.kind);
  const required = paired ? ['goaden', 'ashai']
    : [definition.kind === 'hostile_words' ? 'goaden' : offered[0]];
  if (new Set(offered).size !== offered.length
    || required.some(id => !id || !offered.includes(id) || !state.characters[id])) {
    return { ...result, reason: 'Required incident participants are absent' };
  }
  const witnesses = required.map(id => state.characters[id]);
  if (witnesses.some(actor => actor.journey || ['sleeping', 'travelling'].includes(actor.activity))) {
    return { ...result, reason: 'An incident participant is asleep or in transit' };
  }
  const first = witnesses[0];
  // The plaza is the only currently modelled outdoor city space. The cafe and
  // parlour are interiors; MI6's training yard is not a city street either.
  const location = definition.at === 'city' ? 'big_ben_plaza' : definition.at;
  if (witnesses.some(actor => actor.location !== location
    || !areaOf(actor.location, actor.area)
    || !permitsArea(actor.location, actor.area, 'unhurried_time', action.dueAt))) {
    return { ...result, reason: 'Incident setting is incompatible with actual location' };
  }
  if (definition.at === 'city' && witnesses.some(actor => actor.area !== first.area
    || areaOf(actor.location, actor.area).indoors)) {
    return { ...result, reason: 'Street participants are not together outdoors' };
  }
  return { ...result, location, participants: required,
    // A building-wide event can reach separate rooms without teleporting them.
    area: witnesses.every(actor => actor.area === first.area) ? first.area : null };
}

// Which severities a given level may reach for. A quiet world can still be
// strange; only a loud one can be dangerous.
// Weighted hard toward unease at every level, because unease is what makes the
// rest land. Even a critical day is mostly strange rather than mostly violent.
const REACHABLE = Object.freeze({
  low: ['unease'],
  medium: ['unease', 'unease', 'unease', 'medium'],
  high: ['unease', 'unease', 'medium', 'medium', 'high'],
  critical: ['unease', 'medium', 'medium', 'high', 'critical'],
});
export const reachableSeverities = level => REACHABLE[level] ?? REACHABLE.low;

/**
 * Pick an incident, or nothing. Seeded, so the same world always has the same
 * strange week. `recent` holds the kinds already used so the world does not
 * repeat itself inside a fortnight.
 */
export function chooseIncident({ level, recent = [], weatherCode = 'cloudy', outdoors = true }, seed, key) {
  const severities = reachableSeverities(level);
  const severity = severities[hash(`${seed}|pressure-severity|${key}`) % severities.length];
  const bank = REPERTOIRE[severity] ?? UNEASE;
  // A city incident needs them able to be out; indoors-only days keep to the
  // ones that can happen at the barracks.
  const eligible = bank.filter(item => (outdoors || item.at !== 'city') && !recent.includes(item.kind));
  const pool = eligible.length ? eligible : bank.filter(item => outdoors || item.at !== 'city');
  if (!pool.length) return null;
  const picked = pool[hash(`${seed}|pressure-pick|${key}`) % pool.length];
  return { severity, ...picked };
}

// How often the world reaches for them at all. Exposure is a multiplier on the
// *rate*, not on the level: the level says how strange the city is, exposure
// says how much of it these two personally meet.
export function incidentChance(level, exposure = PRESSURE_RULES.exposure) {
  const base = { low: 0.04, medium: 0.08, high: 0.13, critical: 0.18 }[level] ?? 0.04;
  return clamp01(base * exposure);
}
export function wantsIncident({ level, pressure, seed, key, exposure }) {
  const roll = (hash(`${seed}|pressure-roll|${key}`) % 1000) / 1000;
  return roll < incidentChance(level, exposure);
}

// The aftermath of yesterday, as a line rather than a mechanic.
// The morning after, as a line rather than a mechanic — and the lines have to
// respect that, which the first cut did not. "Neither of them trained" ran at
// 08:20 and the pair started training at 09:00, because an aftermath does not
// touch the schedule and was never going to. Every line here now describes a
// state rather than asserting a change, so nothing it says can be contradicted
// by the day that follows it.
export const AFTERMATH = Object.freeze({
  pursuit: 'Nobody said much about the run back. Ashai was awake before the alarm went.',
  breach: 'The north-face alarm came up again over breakfast. Neither of them had forgotten the sudden silence after it.',
  surge_incident: 'The river readings were still coming down from whatever that had been.',
  deployment: 'Yesterday’s readiness alert was still on Goaden’s mind. He turned the cup between his hands before drinking.',
  hunted: 'The lit streets, again, and neither of them mentioned why.',
  confrontation: 'Neither of them had slept much. It sat over the whole morning without being spoken about.',
  multi_faction: 'The street was open again by morning as though none of it had happened.',
  severe_event: 'Half the building was still looking at the sky. Nobody had an explanation and nobody pretended to.',
});
export const aftermathFor = kind => AFTERMATH[kind] ?? 'The day after was quieter than it should have been.';
