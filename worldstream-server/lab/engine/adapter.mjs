import { affordanceFacts } from '../grammar/affordances.mjs';
import { INTERRUPTIBLE, areaOf } from '../../src/places.mjs';
import { daypart } from '../../src/sky.mjs';

// Worldstream -> transient facts. One direction, always.
//
// This is the whole answer to the brief's section 3. Nothing here writes to
// Worldstream, opens its database, or keeps a copy of anything between calls.
// A view is built for one opportunity from a snapshot the caller already holds,
// used to decide, and dropped. There is exactly one ledger and it is not here.
//
// Four things this file is careful about:
//
//   Anti-telepathy. `knows.X.KEY` is derived only from X's own knowledge array,
//   filtered by learnedAt and validUntil against the opportunity's clock. There
//   is no path by which a character can condition on a fact they do not hold —
//   not because the practices are written politely, but because the sentence
//   that would let them is never asserted.
//
//   Presence. `here.X.PLACE` comes from location/area/journey, and co-presence
//   is a consequence of two characters sharing a PLACE rather than a separate
//   claim. Guests who are not simulated actors (Emily, Yukon) are placed from
//   offscreenLives.people[x].lastSeen inside a recency window, because that is
//   where Worldstream already records them; the engine invents no positions.
//
//   Bounding. Only present characters, their place, and that place's
//   affordances are translated. The view for a plaza opportunity is tens of
//   sentences, not the 279 facts and 275 knowledge entries a thirty-day world
//   is carrying. This is what keeps the cost flat as the world grows — the
//   opposite of Praxish's Swaygent, which deep-clones the entire database once
//   per candidate action (measured at 48ms for a 4000-fact world in
//   lab/research/probe-04).
//
//   Abilities. `ability.X.NAME` is asserted from a canon allow-list, never
//   inferred. Fade belongs to Emily because the Codex says so.

const MIN = 60_000;
const RECENT_PRESENCE = 45 * MIN;

// Canon-sourced. Nothing else in the lab may grant an ability.
export const CANON_ABILITIES = Object.freeze({
  emily: ['fade'],       // Codex: Emily Grimm; Codex: Fade; [P00958]-[P00971]
  // Davis has no Holy Item and no ability. Her leverage is entirely social,
  // which is the point of her.

  yukon: ['shapeshift'], // [M65] "His Onari heritage lets him shape-shift"
});

export const CANON_TRAITS = Object.freeze({
  emily: ['counts_things', 'answers_literally', 'reads_as_child', 'unhurried', 'no_social_debt'],
  // `does_not_take_the_bait` is Greah's advice at [P00681] made structural:
  // "People like Davis, they thrive on this. Don't give her the satisfaction."
  ashai: ['protective', 'norm_compliant', 'finishes_the_movement', 'does_not_take_the_bait'],
  goaden: ['watchful', 'deadpan', 'unbothered', 'deflects_concern'],
  // `nervous_when_serious` is the half of him that stops the rest being one
  // note: canon has him verbose and full of fillers when uncertain, and only
  // reaching for puns once he is comfortable.
  // `reckless` is canon in its own words — "Unlike his peace-loving tribe, Yukon
  // often courts trouble with his energetic and somewhat reckless nature."
  yukon: ['loud', 'competitive', 'impatient', 'physical', 'reckless', 'nervous_when_serious'],
  // Codex: "confidence and self-assuredness, masks a more manipulative and
  // selfish nature"; production's supporting voice has her answering
  // "obliquely and while walking" and checking the clock before you can.
  davis: ['composed', 'transactional', 'competitive', 'withholding'],
});

// Who is a known quantity to whom. MI6 colleagues have worked together for
// years [M63-M65]; Emily is a stranger to everybody and that is the point.
// Standing rivalries, from canon rather than from a relationship score.
//
// Ashai and Davis, manuscript [P00667]-[P00713]: the grand tour, the charm
// Ashai found on the training grounds, Davis overheard calling her "too naive,
// too... emotional", and the ops-room confrontation that ends "Power, Ashai.
// The same thing we're all after." At p.183 that is behind them and settled
// into something colder — which is the state this models. It is not enmity and
// it is not friendship; it is two colleagues who know exactly where they stand.
export const RIVALS = Object.freeze({
  ashai: Object.freeze(['davis']),
  davis: Object.freeze(['ashai']),
});

export const FAMILIAR = Object.freeze({
  goaden: ['ashai', 'yukon'],
  ashai: ['goaden', 'yukon'],
  yukon: ['goaden', 'ashai'],
  emily: [],
});

const placeKey = (location, area) => `${location}_${area}`;

/** Everybody the engine can see at this instant, with where they are. */
export function locateEveryone(snapshot, now) {
  const people = new Map();
  for (const actor of Object.values(snapshot.characters ?? {})) {
    if (actor.journey) continue; // in transit is not anywhere yet
    people.set(actor.id, { id: actor.id, location: actor.location, area: actor.area,
      activity: actor.activity, simulated: true });
  }
  for (const [guest, record] of Object.entries(snapshot.offscreenLives?.people ?? {})) {
    const seen = record.lastSeen;
    // A tier may keep a sighting good for longer than the default window —
    // Yukon genuinely occupies the MI6 gaming room, where Emily is deliberately
    // only ever here just after she was actually seen. When the caller has
    // already applied a tier window (the shadow rewind does), it says so and
    // this does not second-guess it.
    const window = record.presenceWindowMs ?? RECENT_PRESENCE;
    if (!seen || now - seen.at > window || seen.at > now) continue;
    people.set(guest, { id: guest, location: seen.location, area: seen.area,
      // What they are actually doing, when the world knows. Yukon retrying the
      // section that keeps beating him is `gaming`, which is interruptible, so
      // he can be spoken to; falling back to `unhurried_time` kept everyone
      // generically idle and lost the one detail that made them worth meeting.
      activity: record.activity ?? 'unhurried_time',
      project: record.currentProject ?? null,
      tier: record.tier ?? 'sparse', simulated: false });
  }
  return people;
}

// Seniority the world already carries. Cliff Henderson appears in Worldstream as
// a SIDE_PRESENCE — "General Henderson came through on his rounds and did not
// stop" — and canon has him as Ashai's mentor and the reason Goaden joined MI6
// at all. Whether he is in the room changes what Yukon will do in it.
const SENIOR = Object.freeze(['henderson', 'cliff']);

/**
 * A contest somebody is losing, from the project Worldstream is already
 * running for them. Yukon's `game_retry` in the MI6 gaming room carries an
 * attempt number and an outcome, which is everything a competitive practice
 * needs — the world had already modelled "the section that keeps beating him"
 * and nothing in the grammar was asking.
 */
function contestFacts(snapshot, place, location, area) {
  const out = [];
  for (const [who, record] of Object.entries(snapshot.offscreenLives?.people ?? {})) {
    const project = record.currentProject
      ?? snapshot.offscreenLives?.projects?.[record.currentProjectId] ?? null;
    if (!project || project.family !== 'game_retry') continue;
    if (project.location !== location || (project.area ?? 'venue') !== area) continue;
    const id = slug(project.id ?? `${who}_${project.family}`);
    out.push(`contest.${id}.at.${place}`, `contest.${id}.by.${who}`);
    // Losing is the interesting state, and it is the one the world reports as
    // `unfinished`. `settled` is a win, and wins have their own behaviour.
    if (project.status === 'settled' || project.stage === 'settled') out.push(`contest.${id}.tag.won`);
    else out.push(`contest.${id}.tag.losing`);
    const attempt = project.attempt ?? 1;
    // Graded rather than numeric, because a fact path cannot be compared. Real
    // Yukon data reaches attempt 3, so `humiliating` is rare and reachable
    // rather than decorative.
    if (attempt >= 2) out.push(`contest.${id}.tag.repeated`);
    if (attempt >= 3) out.push(`contest.${id}.tag.humiliating`);
  }
  return out;
}

/** Facts a character knows at `now`, by key. Their own knowledge only. */
function knownKeys(snapshot, who, now) {
  const actor = snapshot.characters?.[who];
  const list = actor ? actor.knowledge : (snapshot.offscreenLives?.people?.[who]?.knowledge ?? []);
  return (list ?? []).filter(memory => memory.learnedAt <= now
    && (memory.validUntil == null || memory.validUntil > now)).map(memory => memory.factKey);
}

/** Which conditional affordances the world state currently supports. */
function worldConditions(snapshot, now) {
  const conditions = new Set();
  const code = snapshot.weather?.code;
  if (code === 'heavy_rain' || code === 'storm') conditions.add('wet_weather');
  const part = daypart(now);
  if (part === 'night' || part === 'small_hours') conditions.add('after_dark');
  if (snapshot.factions?.order === 'active_in_city') conditions.add('procession');
  if (snapshot.factions?.church === 'veil_cycle') conditions.add('veil_lanterns');
  if (snapshot.abilities?.trainingGround?.status !== 'open') conditions.add('ground_closed');
  return conditions;
}

/** Obstacles the world state actually supports. Never invented. */
function obstacleFacts(snapshot, place, location, area, conditions) {
  const out = [];
  const add = (id, tags) => {
    out.push(`obstacle.${id}.at.${place}`);
    for (const tag of tags) out.push(`obstacle.${id}.tag.${tag}`);
  };
  if (conditions.has('wet_weather') && areaOf(location, area)?.indoors === false)
    add('standing_water', ['navigable']);
  if (conditions.has('ground_closed') && area === 'training') add('shut_gate', ['fixed']);
  if (location === 'mi6' && area === 'common_room' && snapshot.encounter) add('queue', ['navigable']);
  // The one genuinely shiftable obstruction the catalogue already describes:
  // `trolley` is declared `obstructive` in mi6/corridors. Promoting it to an
  // obstacle gives `move_it` and `offer_help` a target they can be true about,
  // rather than deleting two behaviours because every obstruction in this world
  // happens to be water, a gate, or a queue of people.
  if (location === 'mi6' && area === 'corridors') add('trolley', ['navigable', 'movable']);
  if (location === 'streamliner') add('jammed_door', ['fixed']);
  if (location === 'cafe') add('counter_queue', ['navigable']);
  if (location === 'big_ben_plaza' && conditions.has('procession')) add('closed_path', ['navigable']);
  return out;
}

/**
 * Build one opportunity's fact list.
 *
 * @param {object} snapshot  A Worldstream semanticSnapshot (read-only).
 * @param {object} options   { now, location, area, callbacks, witnessed }
 * @returns {{ sentences: string[], present: string[], place: string, inputs: string[] }}
 */
export function translate(snapshot, { now, location, area, callbacks = [], witnessed = [],
  experiences = [], castIds, recentNotices = [] }) {
  const place = placeKey(location, area);
  const everyone = locateEveryone(snapshot, now);
  const here = [...everyone.values()].filter(person => person.location === location && person.area === area);
  const present = here.map(person => person.id).filter(id => !castIds || castIds.includes(id)).sort();
  const sentences = [];
  const inputs = [];

  for (const person of here) {
    const id = person.id;
    if (castIds && !castIds.includes(id)) continue;
    sentences.push(`char.${id}`, `here.${id}.${place}`, `activity.${id}.${person.activity}`);
    if (INTERRUPTIBLE.includes(person.activity)) sentences.push(`free.${id}`);
    if (person.activity === 'waiting') sentences.push(`waiting.${id}`);
    // Asleep is not merely "not free": it is a state somebody can be woken from,
    // and Worldstream already distinguishes it ("Ashai went to bed and the
    // barracks got on with being quiet").
    if (person.activity === 'sleeping' || person.activity === 'resting') sentences.push(`asleep.${id}`);
    for (const ability of CANON_ABILITIES[id] ?? []) sentences.push(`ability.${id}.${ability}`);
    for (const trait of CANON_TRAITS[id] ?? []) sentences.push(`trait.${id}.${trait}`);
    // Anti-telepathy: this character's own memories, nobody else's.
    for (const key of knownKeys(snapshot, id, now)) sentences.push(`knows.${id}.${slug(key)}`);
  }

  // Who already knows whom. Without this, Ashai asks a colleague she has worked
  // beside for years whether he is here with someone — legal under every
  // condition in the practice, and nonsense. This is the brief's "emergent
  // nonsense" failure, and the fix is a fact rather than a special case.
  for (const a of here) for (const b of here) {
    if (a.id === b.id) continue;
    if (FAMILIAR[a.id]?.includes(b.id)) sentences.push(`familiar.${a.id}.${b.id}`);
    if (RIVALS[a.id]?.includes(b.id)) sentences.push(`rival.${a.id}.${b.id}`);
  }

  // Companions first: two simulated leads in the same room arrived together, so
  // they are each other's company rather than each other's encounter.
  const leads = here.filter(person => person.simulated).map(person => person.id);
  for (const a of leads) for (const b of leads) if (a !== b) sentences.push(`companion.${a}.${b}`);

  // `alone` therefore means unaccompanied, not unobserved — which is the
  // distinction the plaza needs. Emily on a bench with two MI6 agents walking
  // past her is still a person on their own; that is the whole situation.
  for (const person of here) {
    const accompanied = here.some(other => other.id !== person.id
      && leads.includes(other.id) && leads.includes(person.id));
    if (!accompanied) sentences.push(`alone.${person.id}`);
  }

  const conditions = worldConditions(snapshot, now);
  // Some conditions are events rather than states. The bell rang; it is not
  // ringing. The harness supplies what happened recently and the adapter turns
  // it into affordances, so a behaviour can bind to a thing that only exists
  // for the next twenty minutes.
  for (const notice of recentNotices) {
    if (notice === 'chimes_pulse' || notice === 'big_ben_heavy') conditions.add('bell_ringing');
    if (notice === 'order_procession') conditions.add('procession');
    if (notice === 'veil_notice') conditions.add('veil_lanterns');
    if (notice === 'elevated_alert' || notice === 'nameless_briefing') conditions.add('elevated_alert');
  }
  sentences.push(...affordanceFacts(location, area, conditions));
  sentences.push(...obstacleFacts(snapshot, place, location, area, conditions));
  sentences.push(...contestFacts(snapshot, place, location, area));

  // The social register of the room, which decides whether Yukon is the liaison
  // MI6 recruited or the teenager his friends actually know. Canon insists on
  // both: "despite his youth and humour, he carries a quiet authority that even
  // senior agents respect".
  const senior = here.find(person => SENIOR.includes(person.id));
  if (senior) sentences.push(`senior.${senior.id}.at.${place}`, `formal.${place}`);
  const others = here.filter(person => castIds?.includes(person.id));
  // Informal means: somewhere people talk, nobody senior, and everyone here
  // already knows everyone here. Two friends in the gaming room qualify; the
  // operations room never does.
  const allFamiliar = others.every(a => others.every(b =>
    a.id === b.id || FAMILIAR[a.id]?.includes(b.id)));
  if (!senior && areaOf(location, area)?.social && others.length > 1 && allFamiliar)
    sentences.push(`informal.${place}`);
  if (!senior && !conditions.has('elevated_alert')) sentences.push(`offduty.${place}`);
  // Which practices have an instance here. Praxish spawns instances from action
  // outcomes and persists them; here they are derived from world state every
  // time, because a practice instance is a description of the current situation
  // and Worldstream already holds the situation.
  sentences.push(...activePractices({ snapshot, now, place, location, area, here, conditions }));
  // Somewhere people actually talk. The lunch hall and the plaza qualify; the
  // operations room does not.
  if (areaOf(location, area)?.social) sentences.push(`sociable.${place}`);
  sentences.push(`world.daypart.${daypart(now)}`, `world.weather.${snapshot.weather?.code ?? 'unknown'}`);
  // A conjunction of conditions cannot express "night or small_hours", and
  // three in the morning is emphatically both dark and the small hours. One
  // derived fact rather than duplicating every action that cares.
  if (['night', 'small_hours'].includes(daypart(now))) sentences.push('world.dark');
  for (const [faction, level] of Object.entries(snapshot.factions ?? {}))
    sentences.push(`world.faction.${faction}.${level}`);
  for (const condition of conditions) sentences.push(`world.condition.${condition}`);

  // Memory as affordance. A callback is a past event that has earned the right
  // to be referred to; it makes an action available that did not exist before.
  for (const callback of callbacks) {
    if (callback.spent) { sentences.push(`spent.${callback.key}`); continue; }
    sentences.push(`callback.${callback.key}.by.${callback.by}`);
    if (callback.about) sentences.push(`callback.${callback.key}.about.${callback.about}`);
    if (callback.topic) sentences.push(`callback.${callback.key}.topic.${callback.topic}`);
    if (callback.sourceEventId) inputs.push(callback.sourceEventId);
  }
  for (const item of witnessed) {
    sentences.push(`seen.${item.observer}.${item.actor}.${item.what}`);
    if (item.eventId) inputs.push(item.eventId);
  }

  // Persisted semantic experience: the minimum a character has to carry out of
  // one Moment for a later one to be reachable. Three kinds, all scoped to the
  // pair and the target and all with a lifetime:
  //
  //   observed.<observer>.<actor>.<thing>   I saw you doing that
  //   asked.<asker>.<asked>.<thing>         I asked you about it
  //   answered.<answerer>.<asker>.<thing>   I answered
  //
  // The observer is the first segment on purpose. This is not a general memory
  // channel and must never become one: a character who was not in the room has
  // no sentence, so the question affordance cannot reach them however loudly
  // the event sits in the ledger.
  for (const item of experiences) {
    if (item.expiresAt <= now || item.at > now) continue;
    if (!here.some(person => person.id === item.observer)) continue;
    sentences.push(`${item.kind}.${item.observer}.${item.actor}.${slug(item.thing)}`);
    if (item.eventId) inputs.push(item.eventId);
  }

  return { sentences, present, place, inputs, conditions: [...conditions] };
}

/**
 * Which practices are live at this place right now. Deliberately conservative:
 * a practice that is not obviously supported by the situation is simply not
 * instantiated, which is the cheapest possible answer to the brief's
 * combinatorial-explosion question.
 */
export function activePractices({ snapshot, now, place, location, area, here, conditions }) {
  const out = [];
  const on = id => out.push(`practice.${id.toLowerCase()}.${place}`);
  const room = areaOf(location, area);
  const anyFree = here.some(person => INTERRUPTIBLE.includes(person.activity));
  const leads = here.filter(person => person.simulated);

  if (anyFree && room?.social !== false) on('PUBLIC_IDLE');
  if (here.length > 1 && here.some(person => !person.simulated) && leads.length) on('PERSON_ALONE_ENCOUNTER');
  if (obstacleFacts(snapshot, place, location, area, conditions).length) on('MINOR_INCONVENIENCE');
  // Unhurried shared co-presence: together, both free, somewhere sociable.
  // No fabricated `waiting` state — see the note on the practice itself.
  if (here.length > 1 && anyFree) on('SHARED_PAUSE');
  if (here.some(person => person.activity === 'eating')) on('CASUAL_MEAL');
  if (here.length > 1) on('NOTICE_UNUSUAL_BEHAVIOUR');

  // --- the Yukon set. Each spawns only where the world already supports it,
  // which is the whole reason these were worth adding: Worldstream has been
  // running his `game_retry` project in the gaming room the entire time.
  const contests = contestFacts(snapshot, place, location, area);
  if (contests.length) {
    on('COMPETITIVE_RETRY');
    // Gloating and excusing both need an audience, so they only exist when
    // somebody else is in the room to receive it.
    if (here.length > 1) on('COMPETITIVE_GLOAT_OR_RECOVER');
  }
  const senior = here.some(person => SENIOR.includes(person.id));
  const others = here.filter(person => person.id);
  const allFamiliar = others.every(a => others.every(b =>
    a.id === b.id || FAMILIAR[a.id]?.includes(b.id)));
  const informal = !senior && room?.social && here.length > 1 && allFamiliar;
  // Mockery and clowning need the informal register; the practice conditions
  // check it too, but there is no point spawning an instance that cannot fire.
  if (informal && here.some(person => (CANON_ABILITIES[person.id] ?? []).includes('shapeshift'))) {
    on('MOCKING_MIMIC');
    if (obstacleFacts(snapshot, place, location, area, conditions).length) on('SHAPESHIFT_OVERKILL');
  }
  if (senior && here.length > 1) on('NERVOUS_RAMBLE');
  // Two people with history in the same room. It does not need them to be
  // doing anything; standing there is the situation.
  if (here.some(a => here.some(b => RIVALS[a.id]?.includes(b.id)))) on('COLD_RIVALRY');
  // Night, somebody asleep, and somebody here who can look like somebody else.
  // Worldstream already opens a NIGHT_WINDOW slot and has been closing it with
  // "No rare, available night follow-up" — this is a candidate for that slot.
  const dark = ['night', 'small_hours'].includes(daypart(now));
  if (dark && here.some(person => person.activity === 'sleeping' || person.activity === 'resting')
    && here.some(person => (CANON_ABILITIES[person.id] ?? []).includes('shapeshift')))
    on('NIGHT_PRANK');
  return out;
}

// Fact keys carry colons and hex; a view path may not.
const slug = key => String(key).replace(/[^a-zA-Z0-9]+/g, '_');
export { slug, placeKey };
