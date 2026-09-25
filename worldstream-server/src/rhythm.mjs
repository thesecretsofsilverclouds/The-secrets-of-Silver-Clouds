import { createHash } from 'node:crypto';
import { daypart } from './sky.mjs';
import { fatigueAt } from './abilities.mjs';
import { morphosActorAffinity } from './morphos.mjs';
import { sameValue } from './ledger.mjs';

// RHYTHM: a behavioural metabolism for the two leads' ordinary free time.
//
// It chooses which already-legal routine fills a slot the day plan has already
// declared free, and nothing else. Needs are behavioural pressures, not
// emotions; they never reach prose or projection. All arithmetic is bounded,
// deterministic and hashed off the seed. See RHYTHM-DESIGN.md.
const HOUR = 3_600_000;
export const RHYTHM_RULES = Object.freeze({ version: 1,
  weights: Object.freeze({ gain: .35, habit: .20, circadian: .15, trace: .25, social: .10, narrative: .05, satiety: .40, cost: .15 }),
  temperature: .05, maxRelativeBias: 4,
  habitLearn: .08, habitDecay: .02,
  satietyTau: 40 * HOUR, traceTau: 36 * HOUR, lookahead: 2 * HOUR,
  effectMinutes: 45, sleepRest: .25, sleepSolitude: .6, sleepReferenceHours: 8,
  maxHistory: 24, historyWindow: 7 * 24 * HOUR, maxTraces: 8, maxActorBytes: 4096 });
export const RHYTHM_NEEDS = Object.freeze(['rest', 'social', 'stimulation', 'solitude', 'mastery']);
export const RHYTHM_ACTORS = Object.freeze(['ashai', 'goaden']);
export const RHYTHM_LABELS = Object.freeze(['watching_television', 'quiet_break', 'listening_to_music', 'gaming',
  'playing_piano', 'training', 'resting']);

// Per-hour rise of each pressure while awake. Pilot values, not biology.
export const RHYTHM_PROFILES = Object.freeze({
  ashai: Object.freeze({ rise: Object.freeze({ rest: .04, social: .03, stimulation: .07, solitude: .03, mastery: .03 }),
    priors: Object.freeze({ watching_television: .6, gaming: .2, quiet_break: .15, listening_to_music: .1, resting: .1, playing_piano: 0, training: .3 }) }),
  goaden: Object.freeze({ rise: Object.freeze({ rest: .04, social: .02, stimulation: .04, solitude: .05, mastery: .06 }),
    priors: Object.freeze({ playing_piano: .7, listening_to_music: .25, gaming: .2, quiet_break: .15, resting: .1, watching_television: 0, training: .4 }) }),
});

// The reviewed possibility library. Every label already exists in the reducer:
// activating RHYTHM adds no prose, permits or events. A Phase 2 template adds a
// row here (and its own authored mechanic elsewhere); the maths does not change.
export const RHYTHM_TEMPLATES = Object.freeze({
  watching_television: Object.freeze({ type: 'TV_BEGIN', area: 'gaming_room', owner: 'ashai', motif: null, shared: false,
    effect: Object.freeze({ rest: -.25, stimulation: -.35, solitude: -.10 }),
    circadian: Object.freeze({ small_hours: 0, morning: .5, midday: .6, evening: 1, night: .9 }) }),
  quiet_break: Object.freeze({ type: 'QUIET_TIME_BEGIN', area: null, owner: null, motif: 'shared_recovery', shared: false,
    effect: Object.freeze({ rest: -.20, solitude: -.35 }),
    circadian: Object.freeze({ small_hours: .3, morning: .8, midday: .8, evening: .8, night: .7 }) }),
  listening_to_music: Object.freeze({ type: 'MUSIC_LISTEN_BEGIN', area: null, owner: null, motif: null, shared: false,
    effect: Object.freeze({ rest: -.20, stimulation: -.20, solitude: -.20 }),
    circadian: Object.freeze({ small_hours: .4, morning: .7, midday: .6, evening: .9, night: .9 }) }),
  gaming: Object.freeze({ type: 'GAME_BEGIN', area: 'gaming_room', owner: null, motif: 'everyday_competition', shared: false,
    effect: Object.freeze({ stimulation: -.40, mastery: -.15 }),
    circadian: Object.freeze({ small_hours: 0, morning: .5, midday: .7, evening: .9, night: .8 }) }),
  playing_piano: Object.freeze({ type: 'PIANO_BEGIN', area: 'music_room', owner: 'goaden', motif: 'practice', shared: false,
    effect: Object.freeze({ stimulation: -.20, mastery: -.30, solitude: -.25 }),
    circadian: Object.freeze({ small_hours: 0, morning: .6, midday: .4, evening: 1, night: .5 }) }),
  training: Object.freeze({ type: 'PRACTICE_BEGIN', area: 'training', owner: null, motif: 'practice', shared: false,
    effect: Object.freeze({ rest: +.20, stimulation: -.15, mastery: -.40 }),
    circadian: Object.freeze({ small_hours: 0, morning: 1, midday: .8, evening: .3, night: 0 }) }),
  resting: Object.freeze({ type: 'REST_BEGIN', area: 'quarters', owner: null, motif: null, shared: false,
    effect: Object.freeze({ rest: -.40 }),
    circadian: Object.freeze({ small_hours: .8, morning: .2, midday: .4, evening: .6, night: .9 }) }),
});
// Which templates a slot family may consider, per actor. Training is deliberately
// absent from every free slot in v30: it is duty, not leisure.
export const RHYTHM_SLOT_FAMILIES = Object.freeze({
  daytime_leisure: Object.freeze({ ashai: Object.freeze(['watching_television', 'quiet_break', 'listening_to_music', 'gaming']),
    goaden: Object.freeze(['playing_piano', 'listening_to_music', 'quiet_break', 'gaming']) }),
  evening_leisure: Object.freeze({ ashai: Object.freeze(['watching_television', 'listening_to_music', 'gaming', 'quiet_break', 'resting']),
    goaden: Object.freeze(['playing_piano', 'listening_to_music', 'gaming', 'quiet_break']) }),
});
// Behavioural similarity, reviewed and symmetric. Related routines partially
// exhaust each other; unrelated ones do not.
const SIM = { watching_television: { listening_to_music: .35, quiet_break: .25, gaming: .35, playing_piano: .10, training: 0, resting: .15 },
  listening_to_music: { quiet_break: .45, gaming: .15, playing_piano: .40, training: 0, resting: .20 },
  quiet_break: { gaming: 0, playing_piano: .20, training: 0, resting: .55 },
  gaming: { playing_piano: .10, training: .10, resting: 0 },
  playing_piano: { training: .30, resting: 0 },
  training: { resting: 0 } };
export const similarity = (a, b) => a === b ? 1 : SIM[a]?.[b] ?? SIM[b]?.[a] ?? 0;
// Traces form only from facts the actor actually knows. Strength per source kind
// and association per label; both reviewed data.
export const RHYTHM_TRACE_SOURCES = Object.freeze({
  break_preference: Object.freeze({ resting: .5, quiet_break: .4 }),
  unfinished_game: Object.freeze({ gaming: .6 }),
  broken_plan: Object.freeze({ listening_to_music: .4, quiet_break: .3 }),
  quiet_preference: Object.freeze({ quiet_break: .5 }),
  incident: Object.freeze({ quiet_break: .4, resting: .3 }),
});
const INCIDENT_STRENGTH = { high: .8, critical: 1 };

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const round = n => Math.round(n * 1e6) / 1e6;
const hash = text => createHash('sha256').update(text).digest('hex');
const hours = ms => Math.max(0, ms) / HOUR;
const numeric = n => typeof n === 'number' && Number.isFinite(n);
const unitValue = n => numeric(n) && n >= 0 && n <= 1;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const validClock = now => { if (!Number.isSafeInteger(now)) throw new Error('Rhythm clock invalid'); };

export function initialRhythm(now) {
  validClock(now);
  return { version: 1, enabled: true, activatedAt: now,
    actors: Object.fromEntries(RHYTHM_ACTORS.map(who => [who, {
      needs: Object.fromEntries(RHYTHM_NEEDS.map(need => [need, .3])), needsAt: now,
      habits: Object.fromEntries(RHYTHM_LABELS.map(label => [label, RHYTHM_PROFILES[who].priors[label] ?? 0])),
      history: [], traces: [] }])) };
}
export const rhythmActive = (state, now) => state?.rhythm?.version === 1 && state.rhythm.enabled !== false
  && Number.isSafeInteger(now) && Number.isSafeInteger(state.rhythm.activatedAt) && state.rhythm.activatedAt <= now;

// Pressures drift while awake and are settled lazily, like ability fatigue. Rest
// is floored by the existing fatigue meter so RHYTHM can never disagree with it.
export function settledNeeds(state, who, now) {
  return settle(state.rhythm, state, who, now);
}
function settle(rhythm, state, who, now) {
  validClock(now);
  const record = rhythm?.actors?.[who];
  if (!RHYTHM_ACTORS.includes(who) || !record || !Number.isSafeInteger(record.needsAt)
    || now < record.needsAt || now < rhythm.activatedAt) throw new Error('Rhythm needs clock moved backwards');
  const actor = state.characters[who];
  const asleep = actor?.activity === 'sleeping' && Number.isSafeInteger(actor.activitySince)
    ? hours(now - Math.max(record.needsAt, actor.activitySince)) : 0;
  const rise = RHYTHM_PROFILES[who].rise, dt = hours(now - record.needsAt) - asleep;
  const needs = Object.fromEntries(RHYTHM_NEEDS.map(need => [need, clamp(record.needs[need] + rise[need] * dt)]));
  // Only observed sleep time earns recovery. These are authored pressure
  // multipliers per eight hours, not claims about biological sleep needs.
  needs.rest *= RHYTHM_RULES.sleepRest ** (asleep / RHYTHM_RULES.sleepReferenceHours);
  needs.solitude *= RHYTHM_RULES.sleepSolitude ** (asleep / RHYTHM_RULES.sleepReferenceHours);
  needs.rest = Math.max(needs.rest, clamp(fatigueAt(state, who, now) / 6));
  return needs;
}
const drive = needs => RHYTHM_NEEDS.reduce((sum, need) => sum + needs[need] ** 2, 0);
const applyEffect = (needs, effect, scale) => Object.fromEntries(RHYTHM_NEEDS.map(need =>
  [need, clamp(needs[need] + (effect[need] ?? 0) * scale)]));

export function gain(needs, who, label, minutes) {
  if (!RHYTHM_ACTORS.includes(who) || !RHYTHM_LABELS.includes(label) || !numeric(minutes) || minutes < 0)
    throw new Error('Invalid rhythm gain input');
  const rise = RHYTHM_PROFILES[who].rise, ahead = Object.fromEntries(RHYTHM_NEEDS.map(need =>
    [need, clamp(needs[need] + rise[need] * hours(RHYTHM_RULES.lookahead))]));
  const before = drive(ahead);
  if (before <= 0) return 0;
  const after = drive(applyEffect(ahead, RHYTHM_TEMPLATES[label].effect, Math.min(1, minutes / RHYTHM_RULES.effectMinutes)));
  return clamp((before - after) / before);
}
export const satiety = (record, label, now) => clamp(record.history.filter(item => item.at <= now).reduce((sum, item) =>
  sum + similarity(label, item.label) * Math.exp(-(now - item.at) / RHYTHM_RULES.satietyTau), 0));
export const trace = (record, label, now) => clamp(record.traces.filter(item => item.label === label && item.at <= now)
  .reduce((sum, item) => sum + item.strength * Math.exp(-(now - item.at) / item.tau), 0));

/** Scores every legal candidate for one slot. `legal(template, label)` is the
 * reducer's own permit/daypart/area/ownership check: RHYTHM never decides
 * legality and an illegal label never enters the scored set. */
export function scoreCandidates({ state, who, family, slotAt, now, minutes, legal, narrative = true }) {
  validClock(slotAt);
  if (slotAt < now || !numeric(minutes) || minutes <= 0 || typeof legal !== 'function') throw new Error('Invalid rhythm slot');
  const actor = state.characters[who], record = state.rhythm.actors[who];
  const needs = settledNeeds(state, who, now), w = RHYTHM_RULES.weights, part = daypart(slotAt);
  const fatigue = clamp(fatigueAt(state, who, now) / 6);
  const labels = (RHYTHM_SLOT_FAMILIES[family]?.[who] ?? []).filter(label => {
    const template = RHYTHM_TEMPLATES[label];
    return template && (!template.owner || template.owner === who) && legal(template, label);
  });
  return labels.map(label => {
    const template = RHYTHM_TEMPLATES[label];
    const terms = { gain: gain(needs, who, label, minutes), habit: clamp(record.habits[label] ?? 0),
      circadian: clamp(template.circadian[part] ?? 0), trace: trace(record, label, now),
      social: template.shared ? 1 : .5,
      narrative: narrative && template.motif ? clamp(morphosActorAffinity(state, who, template.motif, now), -1, 1) : 0,
      satiety: satiety(record, label, now),
      cost: clamp((label === 'training' ? fatigue : 0) + (template.area && template.area !== actor.area ? .15 : 0)) };
    const total = w.gain * terms.gain + w.habit * terms.habit + w.circadian * terms.circadian + w.trace * terms.trace
      + w.social * terms.social + w.narrative * terms.narrative - w.satiety * terms.satiety - w.cost * terms.cost;
    return { label, type: template.type, total: round(total), terms: Object.fromEntries(Object.entries(terms).map(([k, v]) => [k, round(v)])) };
  }).sort((a, b) => a.label.localeCompare(b.label));
}

/** The capped keyed race from narrative-selection, with a fixed temperature so a
 * real score gap can move behaviour, and a 4x cap so it cannot dictate it.
 * Equal scores reproduce the pure hash order exactly. */
export function raceCandidates(scores, seed, key) {
  if (!Array.isArray(scores) || scores.length > RHYTHM_LABELS.length
    || scores.some(score => !RHYTHM_LABELS.includes(score.label) || !numeric(score.total))
    || new Set(scores.map(score => score.label)).size !== scores.length) throw new Error('Invalid rhythm candidates');
  if (!scores.length) return null;
  const lo = Math.min(...scores.map(s => s.total)), v = scores.map(s => (s.total - lo) / RHYTHM_RULES.temperature);
  if (v.some(value => !numeric(value))) throw new Error('Rhythm score difference is not finite');
  const hi = Math.max(...v), scale = hi > 0 ? Math.min(1, Math.log(RHYTHM_RULES.maxRelativeBias) / hi) : 1;
  const raced = scores.map((s, i) => {
    const digest = hash(`${seed}|rhythm-v1|${key}|${s.label}`), weight = Math.exp(v[i] * scale);
    const unit = (parseInt(digest.slice(0, 13), 16) + 1) / (0x10000000000000 + 1);
    return { ...s, weight: round(weight), hash: digest, race: -Math.log1p(-unit) / weight };
  });
  raced.sort((a, b) => (hi === 0 ? a.hash.localeCompare(b.hash) : a.race - b.race || a.hash.localeCompare(b.hash)) || a.label.localeCompare(b.label));
  return raced;
}
export function chooseRoutine(options) {
  const scores = scoreCandidates(options);
  const raced = raceCandidates(scores, options.seed, options.key);
  if (!raced) return null;
  const winner = raced[0];
  return { label: winner.label, type: winner.type, scores: raced.map(({ hash: _h, race: _r, ...s }) => s) };
}

// ---- commits: pure, called only after the authoritative resolver succeeded ----
const withActor = (rhythm, who, patch) => {
  let record = { ...rhythm.actors[who], ...patch };
  // Source identifiers remain exact. Evict oldest traces rather than truncate
  // their provenance when long identifiers would exceed the canonical budget.
  while (bytes(record) > RHYTHM_RULES.maxActorBytes && record.traces.length)
    record = { ...record, traces: record.traces.slice(1) };
  while (bytes(record) > RHYTHM_RULES.maxActorBytes && record.history.length)
    record = { ...record, history: record.history.slice(1) };
  return { ...rhythm, actors: { ...rhythm.actors, [who]: record } };
};
const roundNeeds = (needs, state, who, now) => {
  const next = Object.fromEntries(RHYTHM_NEEDS.map(need => [need, round(clamp(needs[need]))]));
  // Rounding must not put the stored pressure below authoritative fatigue.
  next.rest = Math.max(next.rest, Math.ceil(clamp(fatigueAt(state, who, now) / 6) * 1e6) / 1e6);
  return next;
};

/** A routine actually finished. Needs move, history records it, and only a
 * free-slot routine builds habit. Refused or interrupted starts never get here. */
export function commitCompletion(rhythm, state, { who, label, minutes, family, shared = false, now }) {
  if (!RHYTHM_LABELS.includes(label) || !rhythm.actors[who]) return rhythm;
  if (!numeric(minutes) || minutes <= 0) return rhythm;
  const record = rhythm.actors[who], needs = settle(rhythm, state, who, now);
  const scale = Math.min(1, Math.max(0, minutes) / RHYTHM_RULES.effectMinutes);
  const history = [...record.history.filter(item => now - item.at <= RHYTHM_RULES.historyWindow), { label, at: now }]
    .slice(-RHYTHM_RULES.maxHistory);
  let habits = record.habits;
  if (!shared && family && RHYTHM_SLOT_FAMILIES[family]?.[who]?.includes(label)) {
    habits = { ...habits, [label]: round(habits[label] + RHYTHM_RULES.habitLearn * (1 - habits[label])) };
    for (const other of RHYTHM_SLOT_FAMILIES[family][who]) if (other !== label)
      habits[other] = round(habits[other] - RHYTHM_RULES.habitDecay * habits[other]);
  }
  const effect = shared && label === 'gaming' ? { ...RHYTHM_TEMPLATES[label].effect, social: -.20 } : RHYTHM_TEMPLATES[label].effect;
  return withActor(rhythm, who, { needs: roundNeeds(applyEffect(needs, effect, scale), state, who, now), needsAt: now, history, habits });
}
/** Settle the actual sleep elapsed so far. Call before changing a sleeping
 * actor's activity; a midnight checkpoint is only a partial sleep settlement. */
export function commitSleep(rhythm, state, now) {
  let next = rhythm;
  for (const who of RHYTHM_ACTORS) {
    if (!rhythm.actors[who] || state.characters[who]?.activity !== 'sleeping') continue;
    const needs = settle(rhythm, state, who, now);
    next = withActor(next, who, { needs: roundNeeds(needs, state, who, now), needsAt: now,
      history: rhythm.actors[who].history.filter(item => now - item.at <= RHYTHM_RULES.historyWindow),
      traces: rhythm.actors[who].traces.filter(item => item.strength * Math.exp(-(now - item.at) / item.tau) >= 1e-3) });
  }
  return next;
}
/** Traces form from facts learned in THIS event, by the actor who learned them.
 * The world knowing something happened is not enough. */
function acquiredMemories(actor, who, event, now) {
  const appended = new Map();
  const check = (index, value) => {
    if (!Number.isSafeInteger(index) || index < 0 || !object(value)) return;
    const memory = actor.knowledge[index];
    if (memory?.acquisitionEventId === event.id && memory.learnedAt === now && sameValue(memory, value)) appended.set(index, memory);
  };
  // The canonical learner appends. Inspect only this event's appended leaves,
  // then verify each claimed memory by direct index in the actor's real state.
  // Cost follows new knowledge, never the age/length of the whole memory bag.
  for (const change of event.changes ?? []) {
    if (change.entity !== 'character' || change.id !== who || change.field !== 'knowledge') continue;
    if (Array.isArray(change.path)) {
      if (change.path.length === 1 && !Object.hasOwn(change, 'before')
        && /^(0|[1-9]\d*)$/.test(String(change.path[0]))) check(Number(change.path[0]), change.after);
    } else if (Array.isArray(change.before) && Array.isArray(change.after)) {
      // Old whole-array ledger shape: only the appended suffix is new.
      for (let index = change.before.length; index < change.after.length; index++) check(index, change.after[index]);
    }
  }
  return [...appended].sort(([a], [b]) => a - b).map(([, memory]) => memory);
}
export function commitTraces(rhythm, state, event, now) {
  validClock(now);
  if (typeof event?.id !== 'string' || !event.id || now < rhythm.activatedAt) return rhythm;
  let next = rhythm;
  for (const who of RHYTHM_ACTORS) {
    const actor = state.characters[who], record = rhythm.actors[who];
    if (!actor || !record) continue;
    const learned = acquiredMemories(actor, who, event, now);
    let traces = record.traces;
    for (const memory of learned) {
      const fact = state.facts[memory.factKey], sources = RHYTHM_TRACE_SOURCES[fact?.kind];
      if (!fact || !sources || fact.key !== memory.factKey || ![who, 'both'].includes(fact.subject)
        || memory.subject !== fact.subject || typeof fact.sourceEventId !== 'string' || !fact.sourceEventId
        || memory.sourceEventId !== fact.sourceEventId || !Number.isSafeInteger(fact.createdAt) || fact.createdAt > now
        || (memory.validUntil != null && (!Number.isSafeInteger(memory.validUntil) || memory.validUntil <= now))
        || (fact.validUntil != null && (!Number.isSafeInteger(fact.validUntil) || fact.validUntil <= now))) continue;
      let strength = 1;
      if (fact.kind === 'incident') {
        strength = INCIDENT_STRENGTH[fact.value?.severity] ?? 0;
        if (!strength || ![who, 'both'].includes(fact.subject)) continue;
      }
      for (const [label, association] of Object.entries(sources)) {
        if (traces.some(item => item.sourceEventId === fact.sourceEventId && item.label === label)) continue;
        traces = [...traces, { label, strength: round(clamp(strength * association)), at: now, tau: RHYTHM_RULES.traceTau,
          sourceEventId: fact.sourceEventId, factKey: fact.key }].slice(-RHYTHM_RULES.maxTraces);
      }
    }
    if (traces !== record.traces) next = withActor(next, who, { traces });
  }
  return next;
}

export function assertRhythm(state, now) {
  const r = state.rhythm; if (r === undefined) return;
  if (r?.version !== 1 || typeof r.enabled !== 'boolean' || !Number.isSafeInteger(r.activatedAt)) throw new Error('Invalid rhythm state');
  if (now !== undefined) { validClock(now); if (r.activatedAt > now) throw new Error('Rhythm activation is in the future'); }
  if (!object(r.actors) || Object.keys(r.actors).sort().join(',') !== 'ashai,goaden') throw new Error('Rhythm actors changed');
  for (const [who, record] of Object.entries(r.actors)) {
    if (!object(record) || !Number.isSafeInteger(record.needsAt) || record.needsAt < r.activatedAt
      || (now !== undefined && record.needsAt > now)) throw new Error('Rhythm needs clock invalid');
    if (!object(record.needs)) throw new Error('Rhythm needs missing');
    for (const need of RHYTHM_NEEDS) if (!unitValue(record.needs[need])) throw new Error('Rhythm need out of range');
    if (Object.keys(record.needs).length !== RHYTHM_NEEDS.length) throw new Error('Unapproved rhythm need');
    if (!object(record.habits) || Object.keys(record.habits).length !== RHYTHM_LABELS.length
      || RHYTHM_LABELS.some(label => !Object.hasOwn(record.habits, label) || !unitValue(record.habits[label]))) throw new Error('Rhythm habit out of range');
    const validAt = at => Number.isSafeInteger(at) && at >= r.activatedAt && (now === undefined || at <= now);
    if (!Array.isArray(record.history) || record.history.length > RHYTHM_RULES.maxHistory
      || record.history.some((item, i) => !item || !RHYTHM_LABELS.includes(item.label) || !validAt(item.at)
        || item.at > record.needsAt || (i > 0 && item.at < record.history[i - 1].at)
        || record.needsAt - item.at > RHYTHM_RULES.historyWindow))
      throw new Error('Rhythm history invalid');
    if (!Array.isArray(record.traces) || record.traces.length > RHYTHM_RULES.maxTraces
      || record.traces.some((item, i) => !item || !RHYTHM_LABELS.includes(item.label) || !unitValue(item.strength)
        || !validAt(item.at) || item.tau !== RHYTHM_RULES.traceTau
        || (i > 0 && item.at < record.traces[i - 1].at)
        || typeof item.sourceEventId !== 'string' || !item.sourceEventId || typeof item.factKey !== 'string' || !item.factKey)
      || new Set(record.traces.map(item => JSON.stringify([item.sourceEventId, item.label]))).size !== record.traces.length)
      throw new Error('Rhythm trace invalid');
    if (bytes(record) > RHYTHM_RULES.maxActorBytes) throw new Error(`Rhythm state for ${who} exceeds its byte budget`);
  }
}
