// TRACK E — production shadow-mode contract.
//
// **Nothing here is wired to production and nothing writes.** This is the exact
// interface a future shadow mode would use, defined now so that if the lab
// passes we do not spend another round deciding how to connect it safely.
//
// Shadow mode, in full:
//
//     Worldstream commits an event
//         → emits a read-only MomentOpportunity
//             → the lab evaluates it
//                 → a MomentProposal (or a refusal) is logged
//                     → nothing is committed. Ever.
//
// The zero-write guarantee is structural rather than promised: the opportunity
// carries a frozen plain-object snapshot with no database handle, no reducer
// ops and no callbacks, so there is no path from the engine back into the
// world even by mistake. `assertReadOnly` proves it on every call.

export const CONTRACT_VERSION = 'shadow-1';

// ---------------------------------------------------------------- snapshot
//
// Exactly the fields the adapter reads today, and no others. Anything the
// engine does not need is not sent — a shadow mode that receives the whole
// world is one refactor away from being able to change it.
export const SNAPSHOT_FIELDS = Object.freeze({
  required: Object.freeze([
    'occurredAt',            // the instant this opportunity describes
    'day',                   // London calendar day
    'location', 'area',      // where
    'trigger',               // which committed event opened it
    'triggerEventId',
    'characters',            // id -> {location, area, activity, journey}
    'offscreenPeople',       // guest -> {lastSeen:{at,location,area}}
    'weather',               // {code}
    'factions',              // {mi6, order, church, arcane, ...}
    'abilities',             // {trainingGround:{status}}
    'encounter',             // or null
    'knowledgeByCharacter',  // id -> [{factKey, learnedAt, validUntil}]  OWN ONLY
    'recentNotices',         // [{at, key}] within the affordance window
    'callbacks',             // earned, unspent, with topic + origin event id
    'witnessed',             // [{observer, actor, what, at, eventId}]
    'arcState',              // {activeId, beatDueWithin90Min}
    'rulesVersion', 'seed',
  ]),
  // Explicitly refused. Listed so the refusal is a decision on the record
  // rather than an omission somebody later "fixes".
  forbidden: Object.freeze([
    'db', 'world', 'ops', 'reduce', 'commit', 'advance',   // any handle at all
    'events',                                              // the full ledger
    'relationships',                                       // engine reads bands, not raw
    'pendingActions',                                      // the future is not its business
  ]),
});

// ---------------------------------------------------------------- proposal
export const PROPOSAL_FIELDS = Object.freeze([
  'id', 'at', 'day', 'location', 'area',
  'practice', 'instance', 'family', 'behaviour',
  'actor', 'action', 'intent', 'target', 'participants', 'roles',
  'reason', 'score', 'rawScore', 'fatigue', 'tier',
  'influences', 'rejectedAlternatives', 'unavailable', 'forbidden',
  'requiredFacts', 'requestedEffects',
  'presentationKey', 'presentation', 'scene',
  'line', 'lineIsSignature', 'lineMeaning', 'dialogueFamily',
  'mystery', 'callbackSeedsCreated', 'provenance',
]);

/** Why nothing was proposed. A refusal is a first-class result, not an error. */
export const REFUSAL_CODES = Object.freeze([
  'arc_hard_obligation', 'world_daily_budget', 'world_gap',
  'character_daily_budget', 'no_available_action',
  'nothing_worth_surfacing', 'no_authored_surface', 'no_line_fits_this_target',
  'surface_spacing', 'every_fitting_line_is_cooling', 'not_worth_surfacing',
  'costly_act_recently_foregrounded', 'below_interest_floor',
]);

// ------------------------------------------- blocked-action explanation
//
// The reason this whole investigation was worth doing. Every action that was
// *not* available is reported with the condition that refused it, in the
// author's own words, so a shadow run can be read rather than decoded.
export const BLOCKED_SHAPE = Object.freeze({
  actor: 'string', practice: 'string', action: 'string',
  instance: 'string',
  reason: 'string',        // "Ashai does not possess Fade"
  condition: 'string',     // "ability.Actor.fade"
});

// --------------------------------------------------------------- guarantee
// Forbidden *names*, checked only at the top level, where the contract declares
// them. Checking names recursively was a mistake and the shadow runner caught
// it on its first opportunity: the engine's own pacing history has a field
// called `world` — a plain array of past Moments — and a name-based guard threw
// on it. Worse, name-matching would happily pass a real database handle stored
// under an innocuous key.
const FORBIDDEN_TOP_LEVEL = /^(db|world|ops|reduce|commit|advance|store|connection|events|pendingActions)$/i;

// What actually makes something dangerous: it can be called, or it exposes a
// method that writes. This is checked all the way down, and it is the guarantee
// that matters — capability, not vocabulary.
const WRITE_METHODS = ['prepare', 'exec', 'run', 'advance', 'commit', 'rollback',
  'close', 'write', 'insert', 'update', 'delete', 'setActor', 'setWorld', 'publish'];

/**
 * Prove the snapshot cannot be written through. Throws rather than warns:
 * a shadow mode that has quietly acquired a write path must fail loudly on the
 * first opportunity, not on the thousandth.
 */
export function assertReadOnly(snapshot, path = 'snapshot', depth = 0) {
  if (snapshot === null || typeof snapshot !== 'object') return true;
  if (typeof snapshot === 'function') throw new Error(`${path}: a function reached the engine`);
  for (const method of WRITE_METHODS)
    if (typeof snapshot[method] === 'function')
      throw new Error(`${path}: exposes ${method}() — a live handle reached the engine`);
  for (const [key, value] of Object.entries(snapshot)) {
    if (depth === 0 && FORBIDDEN_TOP_LEVEL.test(key))
      throw new Error(`${path}.${key}: a forbidden top-level field reached the engine`);
    if (typeof value === 'function') throw new Error(`${path}.${key}: a callable reached the engine`);
    if (value && typeof value === 'object') assertReadOnly(value, `${path}.${key}`, depth + 1);
  }
  return true;
}

/** The deterministic seed for one opportunity. Same inputs, same decision. */
export const opportunitySeed = ({ seed, rulesVersion, triggerEventId, occurredAt, location, area }) =>
  `${seed}|${rulesVersion}|${CONTRACT_VERSION}|${triggerEventId}|${occurredAt}|${location}/${area}`;

/**
 * One shadow record. This is the row that accumulates, and its shape is chosen
 * so the comparison against what Worldstream actually published is a join
 * rather than an investigation.
 */
export function shadowRecord({ opportunity, proposal, audit, worldEventsInWindow = [] }) {
  return {
    contract: CONTRACT_VERSION,
    seed: opportunitySeed(opportunity),
    at: opportunity.occurredAt, day: opportunity.day,
    location: opportunity.location, area: opportunity.area,
    trigger: opportunity.trigger, triggerEventId: opportunity.triggerEventId,
    present: opportunity.presentCharacters ?? [],
    // What the engine would have done.
    proposed: proposal ? Object.fromEntries(PROPOSAL_FIELDS
      .filter(field => proposal[field] !== undefined)
      .map(field => [field, proposal[field]])) : null,
    refusal: proposal ? null : audit.refusal,
    refusalDetail: proposal ? null : (audit.detail ?? null),
    // Why nothing else could have happened. The inspectability payload.
    blocked: (audit.blocked ?? []).slice(0, 32),
    forbidden: (audit.rejected ?? []).slice(0, 16),
    considered: audit.considered ?? 0,
    // What Worldstream actually published in the same window, so the two can be
    // compared without re-deriving anything.
    worldPublished: worldEventsInWindow.map(event => ({
      id: event.id, type: event.type, at: event.occurredAt,
      participants: event.participants, description: event.publicDescription })),
    committed: false,          // always. There is no code path that sets this true.
  };
}

/**
 * The comparison a shadow run exists to produce: did the engine want to speak
 * where the world was already speaking, or into its silences?
 */
export function compareToWorld(records) {
  const proposed = records.filter(record => record.proposed);
  // The trigger event is *always* inside its own +/-30min window — it is the
  // thing that opened the opportunity. Counting it made "proposed into a
  // silence" unreachable by construction, in the same way the 90-day
  // "Moments per line" metric was capped at 1.0 by the cooldown. Excluded, so
  // the number measures the world's company rather than the engine's own
  // trigger. (It did not change this run's answer: every proposal still had
  // 6-9 other public events within half an hour. But it would have reported 0%
  // even for a world that was silent, which makes it worthless as evidence.)
  const company = record => record.worldPublished.filter(event => event.id !== record.triggerEventId);
  const intoSilence = proposed.filter(record => company(record).length === 0);
  const overTop = proposed.filter(record => company(record).length > 0);
  const overlapping = overTop.filter(record => company(record)
    .some(event => event.participants?.includes(record.proposed.actor)));
  return {
    opportunities: records.length,
    proposals: proposed.length,
    refusals: records.length - proposed.length,
    proposedIntoSilence: intoSilence.length,
    proposedAlongsideWorldEvents: overTop.length,
    proposedOverTheSameCharacter: overlapping.length,
    // The number that decides whether shadow mode is telling us anything good:
    // moments the engine would have added where the world said nothing at all.
    additiveRate: proposed.length ? +(intoSilence.length / proposed.length).toFixed(3) : 0,
    refusalBreakdown: records.filter(record => !record.proposed)
      .reduce((map, record) => ({ ...map, [record.refusal]: (map[record.refusal] ?? 0) + 1 }), {}),
    // Why the additive rate is what it is. The engine is only ever invoked
    // *next to* a committed event, so the stretches where the world says
    // nothing are stretches where it is never asked. This measures how much of
    // the elapsed run it could not reach at all.
    reach: unreachable(records),
  };
}

/** How much of the run's elapsed time contained no opportunity at all. */
export function unreachable(records, quietMinutes = 120) {
  const times = records.map(record => record.at).sort((a, b) => a - b);
  if (times.length < 2) return { days: 0, elapsedDays: 0, share: 0, longestQuietHours: 0 };
  const elapsed = times.at(-1) - times[0];
  const gaps = times.slice(1).map((time, index) => time - times[index]);
  const quiet = gaps.filter(gap => gap > quietMinutes * 60_000);
  const inQuiet = quiet.reduce((total, gap) => total + gap, 0);
  return {
    days: +(inQuiet / 86_400_000).toFixed(1),
    elapsedDays: +(elapsed / 86_400_000).toFixed(1),
    share: +(inQuiet / elapsed).toFixed(3),
    longestQuietHours: +(Math.max(0, ...gaps) / 3_600_000).toFixed(1),
    opportunitiesPerDay: +(records.length / (elapsed / 86_400_000)).toFixed(1),
  };
}
