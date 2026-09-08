// What a place actually offers a character.
//
// The point of this layer, and the reason it is separate from the practices: a
// behaviour binds to a *tag*, not to a place. Emily's counting behaviour asks
// for something `countable` and `perceptible` and does not care what it is. The
// plaza offers a crowd, pigeons, bell strikes and lit windows; the lunch hall
// offers a queue and a room of soldiers; the carriage offers stops and other
// passengers. One authored behaviour, therefore, has as many manifestations as
// the world has countable things — which is the whole argument for doing this
// rather than authoring another string.
//
// Compare what production does today. src/offscreen-lives.mjs holds
// SHARED_MOMENTS: five moments x five characters = twenty-five authored
// strings, and exactly one of them is Emily counting. It is a good sentence.
// It is also the only one, it fires only on `veil_notice`, and only on the
// swing. That is the hardcoded scene this engine exists to replace with a
// behaviour — not because the sentence is bad, but because there can only ever
// be twenty-five of them, and every twenty-sixth costs an author an evening.
//
// Every tag below is a claim about what is physically there. Nothing here
// invents world state: `crowd`, `weather`, `bell` and the rest are asserted by
// the adapter only when Worldstream's own state supports them.

// Semantic properties of a countable thing.
//
// Added after the author's review of the first ninety days, which found that
// eight of eighteen unusable moments failed on binding rather than character:
// Emily counting lanterns and reporting that "one came back", telling a lantern
// count that the listener "is number nine", observing that benches "do it
// without knowing they do it".
//
// `countable` was never enough. Different *wordings* require different
// properties of what is being counted, and the engine had no way to know that:
//
//   "One came back."                 members that can leave and return
//   "You are number nine."           the listener could be one of them
//   "They do it without knowing."    animate agents doing something unaware
//   "In twos..."                     a set that can meaningfully be paired
//   "Starting from the other end."   something with an order or an extent
//
// That is exactly why the same line is superb with pigeons and nonsense with
// bell strikes. Properties are asserted as `affordance.<thing>.prop.<name>` and
// an authored line declares what it requires; a line whose requirements the
// bound thing does not satisfy is never selected.
export const AFFORDANCE_PROPS = Object.freeze([
  'animate_population',      // members are living agents
  'can_depart_return',       // a member can leave and come back
  'listener_can_be_member',  // the person being spoken to could be one of them
  // Members repeatedly do something without noticing. **Only ever animate.**
  // It was briefly granted to `plaza_shadows` on the reasoning that the person
  // casting the shadow does not know — which is a stretch, and the author caught
  // it in review: "shadows cannot not-know they are doing something". A shadow
  // has no interior. Anything carrying this must also carry
  // `animate_population`, and the lines that need it say so.
  'unconscious_behaviour',
  'spatially_ordered',       // has ends, an order, an extent
  'pairable',                // can meaningfully be counted in twos
]);

export const AFFORDANCE_TAGS = Object.freeze([
  'countable',      // has a number that changes
  'transient',      // is only here because of what the world is doing today
  'perceptible',    // can be observed from where the actor is standing
  'navigable',      // can be gone round, through or past
  'obstructive',    // can get in the way
  'askable',        // a person who can be asked about it
  'sittable',
  'sheltering',
  // An obstruction somebody could physically shift. Asserted positively: the
  // old test was `not tag.fixed`, so everything the world had not explicitly
  // nailed down counted as movable, and Ashai ended up offering to help shift
  // a queue of people.
  'movable',
  'audible',
  'shadowed',       // matters for exactly one character
  'social',         // a place people are expected to talk in
]);

// What each countable thing actually is, semantically. Assigned from the
// author's own reasoning in the review — `crowd` deliberately does NOT get
// `unconscious_behaviour`, because "what are they doing?" was the objection.
export const PROPS = Object.freeze({
  // people
  crowd: ['animate_population', 'can_depart_return', 'listener_can_be_member', 'pairable'],
  pedestrians_looking_up: ['animate_population', 'can_depart_return', 'listener_can_be_member',
    'unconscious_behaviour', 'pairable'],
  pigeons: ['animate_population', 'can_depart_return', 'unconscious_behaviour', 'pairable'],
  people_sheltering: ['animate_population', 'can_depart_return', 'listener_can_be_member', 'pairable'],
  people_avoiding: ['animate_population', 'can_depart_return', 'listener_can_be_member',
    'unconscious_behaviour', 'pairable'],
  arrivals_between_chimes: ['animate_population', 'can_depart_return', 'listener_can_be_member', 'pairable'],
  soldiers: ['animate_population', 'can_depart_return', 'listener_can_be_member',
    'unconscious_behaviour', 'pairable'],
  passengers: ['animate_population', 'can_depart_return', 'listener_can_be_member', 'pairable'],
  passing_agents: ['animate_population', 'can_depart_return', 'listener_can_be_member',
    'unconscious_behaviour', 'pairable'],
  players: ['animate_population', 'can_depart_return', 'listener_can_be_member', 'pairable'],
  arrivals: ['animate_population', 'can_depart_return', 'listener_can_be_member', 'pairable'],
  // the one exception among inanimate things: a shadow behaves, and the person
  // casting it does not know that it does. The author kept that binding.
  // Countable and orderable; not a population that can be unaware of itself.
  plaza_shadows: ['spatially_ordered', 'pairable'],
  // things, which have order and can be paired and nothing else
  benches: ['spatially_ordered', 'pairable'],
  lanterns: ['spatially_ordered', 'pairable'],
  bell_strikes: ['spatially_ordered', 'pairable'],
  lit_windows: ['spatially_ordered', 'pairable'],
  shelved_inks: ['spatially_ordered', 'pairable'],
  other_tables: ['spatially_ordered', 'pairable'],
  stops: ['spatially_ordered', 'pairable'],
  queue: ['spatially_ordered', 'pairable'],
  cones: ['spatially_ordered', 'pairable'],
  crates: ['spatially_ordered', 'pairable'],
  bunks: ['spatially_ordered', 'pairable'],
  sheet_stacks: ['spatially_ordered', 'pairable'],
  portals: ['spatially_ordered', 'pairable'],
  portal_glow: ['spatially_ordered', 'pairable'],
  screens: ['spatially_ordered', 'pairable'],
  corridor_light: ['spatially_ordered'],
});

// location/area -> the things in it and what each thing affords.
// Areas mirror src/places.mjs exactly; nothing is invented.
export const AFFORDANCES = Object.freeze({
  'big_ben_plaza/venue': {
    crowd: ['countable', 'perceptible', 'navigable'],
    pedestrians_looking_up: ['countable', 'perceptible'],
    bell_tower: ['perceptible', 'audible'],
    swing: ['sittable', 'perceptible'],
    benches: ['sittable', 'countable', 'perceptible'],
    pigeons: ['countable', 'perceptible'],
    plaza_shadows: ['perceptible', 'shadowed', 'countable'],
    puddle: ['obstructive', 'navigable'],
    market_stall: ['perceptible', 'askable'],
  },
  'mi6/common_room': {
    queue: ['countable', 'perceptible', 'obstructive', 'navigable'],
    soldiers: ['countable', 'perceptible', 'social'],
    cutlery_noise: ['audible', 'perceptible'],
    corner_table: ['sittable', 'perceptible'],
    serving_hatch: ['obstructive', 'askable'],
  },
  'mi6/corridors': {
    passing_agents: ['countable', 'perceptible', 'social'],
    corridor_light: ['perceptible', 'countable'],
    sealed_door: ['obstructive', 'perceptible'],
    trolley: ['obstructive', 'navigable'],
  },
  'mi6/gaming_room': {
    screens: ['countable', 'perceptible', 'audible'],
    good_chair: ['sittable', 'obstructive'],
    players: ['countable', 'perceptible', 'social'],
  },
  'mi6/training': {
    cones: ['countable', 'perceptible', 'obstructive'],
    weather_exposure: ['perceptible'],
    far_wall: ['perceptible'],
  },
  'mi6/quarters': { window: ['perceptible'], bunks: ['countable', 'sittable'] },
  'mi6/music_room': { piano: ['perceptible', 'audible'], sheet_stacks: ['countable', 'perceptible'] },
  'streamliner/transit': {
    passengers: ['countable', 'perceptible', 'social'],
    stops: ['countable', 'perceptible', 'audible'],
    jammed_door: ['obstructive'],
    window_seat: ['sittable', 'perceptible'],
  },
  'cafe/venue': {
    other_tables: ['countable', 'perceptible', 'social'],
    counter_queue: ['countable', 'obstructive', 'navigable', 'askable'],
    steamed_window: ['perceptible'],
  },
  'enchanted_ink/venue': {
    shelved_inks: ['countable', 'perceptible'],
    curtain: ['obstructive', 'navigable'],
    proprietor: ['askable', 'perceptible'],
  },
  'sanctuary/central_hub': {
    arrivals: ['countable', 'perceptible', 'social'],
    portal_glow: ['perceptible', 'countable'],
    long_bench: ['sittable'],
  },
  'sanctuary/portal_halls': { portals: ['countable', 'perceptible'], hall_echo: ['audible'] },
  'legion_hideout/venue': {
    drum_kit: ['perceptible', 'audible'],
    roof_hole: ['perceptible'],
    crates: ['countable', 'obstructive', 'sittable'],
  },
});

// Things the world state can add to a place when it happens to be true, rather
// than because the place always has them. The adapter asserts these; nothing is
// hardcoded per location.
export const CONDITIONAL_AFFORDANCES = Object.freeze({
  bell_strikes: { tags: ['countable', 'perceptible', 'audible'], needs: 'bell_ringing' },
  lit_windows: { tags: ['countable', 'perceptible'], needs: 'after_dark' },
  people_sheltering: { tags: ['countable', 'perceptible'], needs: 'wet_weather' },
  people_avoiding: { tags: ['countable', 'perceptible'], needs: 'procession' },
  lanterns: { tags: ['countable', 'perceptible'], needs: 'veil_lanterns' },
  arrivals_between_chimes: { tags: ['countable', 'perceptible'], needs: 'bell_ringing' },
  standing_water: { tags: ['obstructive', 'navigable'], needs: 'wet_weather' },
  shut_gate: { tags: ['obstructive'], needs: 'ground_closed' },
});

/** Every `affordance.<place>.<thing>.tag.<tag>` sentence for a place. */
export function affordanceFacts(location, area, conditions = new Set()) {
  // A conditional affordance is tagged `transient` as well as whatever it
  // affords, because "this only exists today" is itself a reason to notice it.
  const key = `${location}/${area}`;
  const out = [];
  const emit = (thing, tags) => {
    out.push(`affordance.${thing}.at.${key.replace('/', '_')}`);
    for (const tag of tags) out.push(`affordance.${thing}.tag.${tag}`);
    for (const prop of PROPS[thing] ?? []) out.push(`affordance.${thing}.prop.${prop}`);
  };
  for (const [thing, tags] of Object.entries(AFFORDANCES[key] ?? {})) emit(thing, tags);
  for (const [thing, spec] of Object.entries(CONDITIONAL_AFFORDANCES))
    if (conditions.has(spec.needs) && AFFORDANCES[key]) emit(thing, [...spec.tags, 'transient']);
  return out;
}

/** How many distinct things a character could bind a `countable` behaviour to. */
export function countableSurface() {
  const total = new Map();
  for (const [place, things] of Object.entries(AFFORDANCES)) {
    const n = Object.values(things).filter(tags => tags.includes('countable')).length;
    if (n) total.set(place, n);
  }
  return total;
}
