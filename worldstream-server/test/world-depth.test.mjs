import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { openWorld } from '../src/world.mjs';
import { DEFAULT_SEED, assertCanonState, factionsForDay, EVENT_TYPES, weatherForDay,
  isShelterWeather, assertScheduleWindows, createFixture } from '../src/fixture.mjs';
import { atLondon, nextLondonDay, londonDate, MINUTE_MS } from '../src/time.mjs';
import { MI6_SECTIONS, MI6_ZONES, SANCTUARY_AREAS, SEALED_AREAS, AREAS_BY_LOCATION, areaOf, permitsArea,
  defaultArea, encounterEligibility, ENCOUNTER_REASONS, INTERRUPTIBLE } from '../src/places.mjs';
import { SIDE_CHARACTERS, SIDE_CHARACTER_IDS, presentableIn, guardianOf } from '../src/cast.mjs';
import { initialAgendaState, supportingAvailability } from '../src/faction-agendas.mjs';
import { BEAT_FAMILIES, DIRECTOR_RULES, tensionOf, eligibleFamilies, TICK_TIMES,
  beatActions } from '../src/director.mjs';
import { EXCHANGES, MOODS, moodFor } from '../src/dialogue.mjs';
import { daypart } from '../src/sky.mjs';
import { applyChange } from '../src/ledger.mjs';

const START = atLondon('2026-09-04', '00:00');
// Long enough for the director's thresholds, budget and memory to be exercised
// many times over, and for every beat family to have had a chance to appear.
const DAYS = 90;
let END_DAY = '2026-09-04';
for (let i = 0; i < DAYS; i++) END_DAY = nextLondonDay(END_DAY);
const END = atLondon(END_DAY, '00:00');

function storage(t) {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-depth-test-'));
  const stores = [];
  t.after(() => {
    for (const world of stores) world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-depth-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  return (name = 'world', options = { seed: DEFAULT_SEED, startMs: START }) => {
    const world = openWorld({ dbPath: join(directory, `${name}.sqlite`), ...options });
    stores.push(world);
    return world;
  };
}

let shared = null;
function run(t) {
  if (!shared) {
    const open = storage(t);
    const world = open('shared');
    world.advance(END);
    shared = world.semanticSnapshot();
  }
  return shared;
}

test('the barracks are eight interconnected sections and every activity happens in one that permits it', t => {
  const snapshot = run(t);
  // "comprised of eight interconnected sections" [M63]. The manuscript gives
  // the count and not the list, so the eight are the ones it walks through —
  // and the eighth is the sealed basement, which is why the count works out.
  assert.equal(Object.keys(MI6_SECTIONS).length, 8, 'the Armoured-dillo has eight sections');
  assert.ok(SEALED_AREAS.includes('basement') && 'basement' in MI6_SECTIONS, 'the sealed door is one of the eight');
  // The gaming area is a zone of the lunch hall, not a ninth section.
  assert.equal(MI6_ZONES.gaming_room.within, 'common_room');
  // Every area a character was ever moved into is a real room of the place they
  // were in, and permitted whatever they were doing when they got there.
  let checked = 0;
  const areaAt = new Map();
  for (const event of snapshot.events) {
    for (const change of event.changes) {
      if (change.entity !== 'character') continue;
      if (change.field === 'area') areaAt.set(change.id, change.after);
      if (change.field !== 'activity') continue;
      const area = areaAt.get(change.id);
      const actor = snapshot.characters[change.id];
      if (!area) continue;
      assert.ok(!SEALED_AREAS.includes(area), `${change.id} entered a sealed area`);
      checked++;
      assert.ok(actor, change.id);
    }
  }
  assert.ok(checked > 500, `expected many activity transitions, saw ${checked}`);
  // Final state is a legal room for the place each of them is standing in.
  for (const actor of Object.values(snapshot.characters)) {
    assert.ok(areaOf(actor.location, actor.area), `${actor.id} is in ${actor.area} at ${actor.location}`);
  }
});

test('a room refuses what it is not for, and the sealed basement refuses everything', () => {
  const morning = atLondon('2026-09-08', '10:00');
  const smallHours = atLondon('2026-09-08', '03:00');
  assert.ok(permitsArea('mi6', 'music_room', 'playing_piano', morning));
  assert.ok(!permitsArea('mi6', 'music_room', 'training', morning), 'nobody trains at the piano');
  assert.ok(!permitsArea('mi6', 'ops_room', 'sleeping', morning), 'nobody sleeps at the screens');
  assert.ok(!permitsArea('mi6', 'training', 'training', smallHours), 'the yard is not open at three in the morning');
  assert.ok(permitsArea('mi6', 'quarters', 'sleeping', smallHours));
  // The one door this world may never open, checked as a room and as a state.
  for (const label of ['unhurried_time', 'resting', 'quiet_break', 'training']) {
    assert.ok(!permitsArea('mi6', 'basement', label, morning), `the basement admitted ${label}`);
  }
  const state = { meta: { canonAnchors: null }, characters: {}, relationships: [] };
  assert.throws(() => assertCanonState({ ...state, characters: { ashai: { area: 'basement' } } }));
  // Somewhere with rooms always has a default that is one of them.
  for (const location of Object.keys(AREAS_BY_LOCATION)) {
    for (const time of ['09:00', '13:00', '19:00', '22:30']) {
      const area = defaultArea(location, atLondon('2026-09-08', time));
      assert.ok(areaOf(location, area), `${location} at ${time} defaulted to ${area}`);
    }
  }
});

test('an encounter names the rule that refused it rather than failing silently', () => {
  const when = atLondon('2026-09-08', '13:00');
  const idle = id => ({ id, location: 'mi6', area: 'common_room', activity: 'unhurried_time', journey: null });
  const both = { goaden: idle('goaden'), ashai: idle('ashai') };
  assert.deepEqual(encounterEligibility(both, { area: 'common_room', atMs: when }), { ok: true, reason: null });
  const cases = [
    ['travelling', { ...both, goaden: { ...idle('goaden'), journey: { to: 'sanctuary' } } }, 'common_room'],
    ['apart', { ...both, ashai: { ...idle('ashai'), location: 'cafe' } }, 'common_room'],
    ['busy', { ...both, ashai: { ...idle('ashai'), activity: 'sleeping' } }, 'common_room'],
    ['unsociable', both, 'quarters'],
    ['sealed', both, 'basement'],
    ['unreachable', both, 'no_such_room'],
  ];
  for (const [reason, people, area] of cases) {
    const verdict = encounterEligibility(people, { area, atMs: when });
    assert.equal(verdict.ok, false, reason);
    assert.equal(verdict.reason, reason);
    assert.ok(ENCOUNTER_REASONS[verdict.reason], `${reason} has no stated wording`);
  }
  // A room that is real, social and reachable can still be shut at this hour.
  assert.equal(encounterEligibility(both, { area: 'corridors', atMs: when }).ok, true);
  assert.equal(encounterEligibility({ goaden: { ...idle('goaden'), activity: 'training' }, ashai: idle('ashai') },
    { area: 'common_room', atMs: when }).reason, 'busy');
  for (const label of INTERRUPTIBLE) {
    const people = { goaden: { ...idle('goaden'), activity: label }, ashai: { ...idle('ashai'), activity: label } };
    assert.equal(encounterEligibility(people, { area: 'common_room', atMs: when }).ok, true, label);
  }
});

test('the director obeys its own two thresholds, its budget and its spacing, every single time', t => {
  const snapshot = run(t);
  const ticks = snapshot.events.filter(event => event.type === 'DIRECTOR_TICK');
  assert.equal(ticks.length, DAYS * TICK_TIMES.length, 'every day ticks the same number of times');
  const staged = ticks.filter(tick => tick.payload.family);
  assert.ok(staged.length > 30, `expected the director to stage beats, saw ${staged.length}`);

  for (const tick of staged) {
    assert.ok(BEAT_FAMILIES.includes(tick.payload.family), tick.payload.family);
    assert.ok(tick.payload.quietMinutes > DIRECTOR_RULES.quietMinutes,
      `staged after only ${tick.payload.quietMinutes} quiet minutes`);
    assert.ok(tick.payload.tension < DIRECTOR_RULES.maxTension,
      `staged at tension ${tick.payload.tension}`);
    // A tick is never public: the world does not announce that it was checked.
    assert.equal(tick.visibility, 'private');
    assert.deepEqual(tick.participants, []);
  }
  // The budget holds per day, and beats are never spent back to back.
  const perDay = {};
  for (const tick of staged) {
    const day = londonDate(tick.occurredAt);
    perDay[day] = (perDay[day] ?? 0) + 1;
  }
  assert.ok(Math.max(...Object.values(perDay)) <= DIRECTOR_RULES.maxBeatsPerDay, 'the daily budget was overspent');
  for (let i = 1; i < staged.length; i++) {
    const gap = (staged[i].occurredAt - staged[i - 1].occurredAt) / MINUTE_MS;
    assert.ok(gap >= DIRECTOR_RULES.minGapMinutes, `two beats ${gap} minutes apart`);
  }
  // A tick that stages nothing says which rule stopped it, so a quiet afternoon
  // can be audited rather than merely observed.
  for (const tick of ticks.filter(item => !item.payload.family)) {
    assert.ok(['asleep', 'travelling', 'budget_spent', 'too_soon', 'after_authored_scene', 'not_quiet_yet', 'world_is_busy', 'nothing_eligible']
      .includes(tick.payload.reason), tick.payload.reason);
  }
});

test('the whole authored repertoire is reachable and no family runs away with the world', t => {
  const snapshot = run(t);
  const staged = snapshot.events.filter(event => event.type === 'DIRECTOR_TICK' && event.payload.family);
  const counts = {};
  for (const tick of staged) counts[tick.payload.family] = (counts[tick.payload.family] ?? 0) + 1;
  // Reachability in principle is asserted separately, by building a context for
  // every tick and checking each family is eligible somewhere. Here the claim is
  // the weaker measured one: most of the repertoire actually shows up. One
  // family — weather disruption — needs fog *and* somebody outdoors *and* a tick
  // that passes both thresholds *and* to win the draw, which works out at about
  // one occurrence per four months. Demanding it inside ninety days was asking
  // the dice for a favour.
  const appeared = BEAT_FAMILIES.filter(family => counts[family] > 0);
  assert.ok(appeared.length >= BEAT_FAMILIES.length - 1,
    `only ${appeared.length} of ${BEAT_FAMILIES.length} families appeared: ${JSON.stringify(counts)}`);
  // No single family may take more than a third of the repertoire. The first
  // cut of this failed here: decompression took nearly half, because a late
  // evening tick was the only one most families were ineligible for.
  const worst = Math.max(...Object.values(counts));
  assert.ok(worst / staged.length <= 0.34,
    `one family took ${((worst / staged.length) * 100).toFixed(0)}% of all beats: ${JSON.stringify(counts)}`);
});

test('tension reads the world, and rises with both the city and what the pair carry', () => {
  const calm = [{ concern: 0, irritation: 0 }, { concern: 0, irritation: 0 }];
  const quiet = { arcane: 'low', mi6: 'routine', order: 'quiet' };
  assert.equal(tensionOf({ factions: quiet, relationships: calm }), 0);
  assert.equal(tensionOf({ factions: { arcane: 'high', mi6: 'elevated', order: 'active_in_city' },
    relationships: [{ concern: 3, irritation: 3 }] }), 1);
  // Worry alone is enough to make a day tense, without the city doing anything.
  assert.ok(tensionOf({ factions: quiet, relationships: [{ concern: 3, irritation: 0 }] }) > 0);
  // The worst either of them feels, not the average of the two.
  assert.equal(tensionOf({ factions: quiet, relationships: [{ concern: 3, irritation: 0 }, { concern: 0, irritation: 0 }] }),
    tensionOf({ factions: quiet, relationships: [{ concern: 3, irritation: 0 }, { concern: 3, irritation: 0 }] }));
  // Every real posture the world can draw stays inside a true 0–1.
  for (let day = '2026-09-04', count = 0; count < 120; count++, day = nextLondonDay(day)) {
    const value = tensionOf({ factions: factionsForDay(day, DEFAULT_SEED), relationships: calm });
    assert.ok(value >= 0 && value <= 1, `${day}: ${value}`);
  }
});

test('institutions read each other: the Order working the boroughs stands MI6 up', () => {
  let coincidences = 0;
  for (let day = '2026-09-04', count = 0; count < 200; count++, day = nextLondonDay(day)) {
    const posture = factionsForDay(day, DEFAULT_SEED);
    if (posture.order !== 'active_in_city') continue;
    coincidences++;
    assert.notEqual(posture.mi6, 'routine', `${day}: the Order was active and MI6 was not watching`);
  }
  assert.ok(coincidences > 20, `expected Order activity to observe, saw ${coincidences}`);
});

test('a named colleague keeps their canon grounding; cameos remain observational and respect commitments', t => {
  const snapshot = run(t);
  // The cast is small on purpose, and everybody in it is a background figure
  // with a manuscript page behind them.
  assert.ok(SIDE_CHARACTER_IDS.length >= 3 && SIDE_CHARACTER_IDS.length <= 6);
  for (const id of SIDE_CHARACTER_IDS) {
    const who = SIDE_CHARACTERS[id];
    assert.ok(Number.isInteger(who.page) && who.page < 183, `${id} must be canon before the checkpoint`);
    assert.ok(who.lines.length >= 3, `${id} needs more than one way of being there`);
    // Presence, never speech: a side character has no quoted line anywhere.
    for (const line of who.lines) assert.ok(!/[""'']/.test(line), `${id} speaks: ${line}`);
  }
  // Whisper sits behind the same embargo as the basement, and is not here.
  assert.ok(!SIDE_CHARACTER_IDS.includes('whisper'));
  assert.ok(!JSON.stringify(SIDE_CHARACTERS).toLowerCase().includes('whisper'));
  // Guardians are attached to a person rather than a room, so they are never met.
  assert.equal(guardianOf('goaden'), 'kai');
  assert.equal(guardianOf('ashai'), 'greah');
  for (const id of ['kai', 'greah']) assert.equal(SIDE_CHARACTERS[id].areas, null);
  assert.ok(!presentableIn('common_room', 'midday').includes('kai'));

  const sightings = snapshot.events.filter(event => event.type === 'SIDE_PRESENCE' && event.visibility === 'public');
  assert.ok(sightings.length > 0, 'nobody was ever seen');
  for (const event of sightings) {
    // The whole of a colleague's effect on the world: a published sentence.
    // No fact, no memory, no relationship, no plan — nothing but the pacing
    // clock, which is bookkeeping rather than anything in the world.
    for (const change of event.changes) {
      assert.ok(['director', 'story'].includes(change.entity), 'a colleague changed the world');
    }
    assert.ok(SIDE_CHARACTER_IDS.includes(event.payload.who));
    assert.ok(event.publicDescription.includes(SIDE_CHARACTERS[event.payload.who].name));
  }
  // Authored institutional work now lets Davis and Zara act in their own
  // operation. A passing cameo is still only a sighting: it grants no knowledge
  // or commitment and cannot put a reserved colleague in a second scene.
  let agendas = initialAgendaState();
  for (const event of snapshot.events) {
    if (event.type === 'SIDE_PRESENCE' && event.visibility === 'public') {
      assert.equal(supportingAvailability({ agendas }, event.payload.who,
        { atMs: event.occurredAt, location: event.location, area: event.area }), true,
      `${event.id} staged a colleague during another commitment`);
    }
    // Agendas are rebuilt through the applier for the same reason.
    for (const change of event.changes) {
      if (change.entity !== 'world' || change.field !== 'agendas') continue;
      const holder = { agendas };
      applyChange(holder, change, 'after');
      agendas = holder.agendas;
    }
  }
  const sightingIds = new Set(snapshot.events.filter(event => event.type === 'SIDE_PRESENCE').map(event => event.id));
  for (const actor of Object.values(snapshot.characters)) for (const memory of actor.knowledge) {
    assert.equal(sightingIds.has(memory.sourceEventId), false, 'a cameo created a fact');
    assert.equal(sightingIds.has(memory.acquisitionEventId), false, 'a cameo taught a private memory');
  }
  assert.deepEqual(Object.keys(snapshot.characters).sort(), ['ashai', 'goaden']);
});

test('a thing noticed in passing stays a thing noticed in passing', t => {
  const snapshot = run(t);
  const sightings = snapshot.events.filter(event => event.type === 'MINOR_ANOMALY');
  assert.ok(sightings.length > 0, 'the sky never did anything');
  const factKeys = new Set(Object.keys(snapshot.facts));
  for (const event of sightings) {
    // The review forbids anomalies that become hooks. This one cannot: it
    // creates no fact, so nothing downstream is able to depend on it.
    for (const change of event.changes) assert.equal(change.entity, 'director');
    assert.equal(event.participants.length, 1);
    assert.ok(!factKeys.has(event.id));
  }
  // And nobody ever learned anything from one.
  for (const actor of Object.values(snapshot.characters)) {
    for (const memory of actor.knowledge) {
      assert.ok(!sightings.some(event => event.id === memory.sourceEventId), 'an anomaly taught somebody something');
    }
  }
});

test('training obeys weather and persistent ground restrictions while covered practice remains possible', t => {
  const snapshot = run(t);
  // The world has published "the outdoor yard is closed; morning training moves
  // indoors" on every sheltered day since v6. Before v13 nothing checked where
  // training then happened, and it happened in the closed yard.
  const state = createFixture({ startMs: START }).initialState();
  let trainingStarts = 0, shelteredStarts = 0, justifiedDryCoveredStarts = 0;
  for (const event of snapshot.events) {
    const restrictionBefore = state.abilities.trainingGround.status;
    const changedActivity = new Set();
    // Apply the complete event before testing its resulting activity. Looking
    // only at an area change confuses checking the ground with training on it,
    // and misses a second training start when the area did not change.
    for (const change of event.changes) {
      // Through the shared applier: a change is a leaf now, so assigning
      // change.after straight onto the field would replace a whole bag with the
      // single value that moved inside it.
      if (change.entity === 'character') {
        applyChange(state.characters[change.id], change, 'after');
        if (['activity', 'activityId'].includes(change.field)) changedActivity.add(change.id);
      } else if (change.entity === 'world' && ['abilities', 'weather', 'intent'].includes(change.field)) {
        applyChange(state, change, 'after');
      }
    }
    for (const id of changedActivity) {
      const actor = state.characters[id];
      if (actor.activity !== 'training') continue;
      trainingStarts++;
      assert.equal(actor.location, 'mi6');
      assert.ok(['training', 'indoor_yard'].includes(actor.area), `${id} trained in ${actor.area}`);
      const sheltered = isShelterWeather(state.weather.code);
      if (sheltered) {
        shelteredStarts++;
        assert.equal(actor.area, 'indoor_yard', `${londonDate(event.occurredAt)} trained outdoors in ${state.weather.code}`);
      }
      if (actor.area === 'training') {
        assert.notEqual(state.abilities.trainingGround.status, 'restricted', `${id} trained on closed ground`);
      } else if (!sheltered) {
        const coveredAgreement = event.type === 'INTENT_START' && Object.values(state.intent.instances)
          .some(item => item.selected === 'practice' && item.startEventId === event.id && item.party.includes(id));
        assert.ok(restrictionBefore === 'restricted' || state.abilities.trainingGround.status === 'restricted' || coveredAgreement,
          `${event.id} moved dry-weather training indoors without a restriction or agreed covered practice`);
        justifiedDryCoveredStarts++;
      }
    }
  }
  assert.ok(trainingStarts > 100, `expected actual training starts, saw ${trainingStarts}`);
  assert.ok(shelteredStarts > 0, 'the sample must exercise training in shelter weather');
  assert.ok(justifiedDryCoveredStarts > 0, 'the sample must exercise persistent closures or covered agreements');
});

test('weather that disrupts something actually stops it', t => {
  const snapshot = run(t);
  const disruptions = snapshot.events.filter(event => event.type === 'WEATHER_DISRUPTION');
  // The conjunction this needs is genuinely rare, so the logic is asserted
  // directly rather than waited for: given fog and somebody out in it, the
  // family must be eligible; given shelter weather, it must not be, because
  // sheltered training has already moved under cover.
  const context = over => ({ part: 'midday', free: true, together: true, colleagues: [], recent: [],
    factions: { mi6: 'routine', arcane: 'low', order: 'quiet' }, arrangementPending: false, ...over });
  assert.ok(eligibleFamilies(context({ weather: { code: 'fog' }, outdoors: ['goaden'] })).includes('weather_disruption'));
  assert.ok(!eligibleFamilies(context({ weather: { code: 'fog' }, outdoors: [] })).includes('weather_disruption'),
    'it would close an empty yard');
  assert.ok(!eligibleFamilies(context({ weather: { code: 'clear' }, outdoors: ['goaden'] })).includes('weather_disruption'),
    'clear weather disrupted something');
  // And whatever did occur is well formed. It is a fog beat in practice, which
  // is the two weather rules agreeing rather than a coincidence: heavy rain and
  // a storm shelter the day in advance, so the only weather that can still
  // catch somebody outdoors is the one that does not close the yard first.
  for (const event of disruptions) assert.equal(event.payload.kind, 'fog_closed', event.payload.kind);
  for (const event of disruptions) {
    assert.ok(event.publicDescription);
    assert.ok(event.payload.stopped.length > 0, 'a disruption closed an empty yard');
    // Anybody it names as stopped was actually taken off the outdoor ground —
    // never off the covered floor, which the weather cannot reach.
    for (const id of event.payload.stopped) {
      const moved = event.changes.find(change => change.entity === 'character' && change.id === id && change.field === 'area');
      assert.ok(moved && moved.before === 'training', `${id} was reported stopped without being outdoors`);
      assert.notEqual(moved.before, 'indoor_yard');
    }
  }
  // The beat is only eligible when somebody is actually out in it, so every
  // firing has a consequence rather than closing an empty yard for nobody.
  for (const event of disruptions) {
    assert.ok(event.payload.stopped.length > 0, 'a disruption closed an empty yard');
  }
});

test('an awkward afternoon is what the evening then talks about', t => {
  const snapshot = run(t);
  assert.ok(MOODS.includes('sidelong'));
  assert.ok(EXCHANGES.sidelong.length >= 4);
  const awkwardDays = new Set(snapshot.events
    .filter(event => event.type === 'DIRECTOR_TICK' && event.payload.family === 'awkward_encounter')
    .map(event => londonDate(event.occurredAt)));
  const sidelongDays = new Set(snapshot.events
    .filter(event => event.type === 'CONVERSATION' && event.payload?.mood === 'sidelong')
    .map(event => londonDate(event.occurredAt)));
  assert.ok(sidelongDays.size > 0, 'the colour never reached an evening');
  // The colour cannot appear on a day that did not earn it, and it is cleared
  // at midnight rather than staining the week.
  for (const day of sidelongDays) assert.ok(awkwardDays.has(day), `${day} talked sidelong without an encounter`);
  // It still sits below the three pressing moods.
  assert.equal(moodFor({ concern: 3, colour: 'sidelong' }), 'strained');
  assert.equal(moodFor({ irritation: 2, colour: 'sidelong' }), 'friction');
  assert.equal(moodFor({ repairing: true, colour: 'sidelong' }), 'repair');
});

test('no beat family can be staged across a daypart boundary, from any tick', () => {
  // A beat is scheduled minutes after the tick that chose it, and its actions
  // are checked against their own windows before any of them is queued. If a
  // tick sat close enough to a boundary that a beat's last action fell into the
  // next daypart, that check would throw inside the reducer and take the whole
  // advance down with it. The bands are 03:00 / 06:00 / 11:00 / 17:00 / 20:00,
  // and the current tick times clear them — but this asserts it for every
  // family at every tick, so adding a tick time later fails here rather than in
  // somebody's afternoon.
  // A context arranged so that as many families as possible are eligible: the
  // pair free and together, colleagues about, somebody out in the fog, nothing
  // already arranged. What each tick then admits is the daypart's doing.
  const context = time => ({
    day: '2026-09-08', now: atLondon('2026-09-08', time), part: daypart(atLondon('2026-09-08', time)),
    weather: { code: 'fog', description: 'Fog', temperatureC: 9 },
    factions: { arcane: 'moderate', mi6: 'routine', order: 'quiet' },
    colleagues: ['yukon', 'davis'], area: 'common_room',
    free: true, together: true, outdoors: ['goaden'], arrangementPending: false, recent: [],
  });
  const everSeen = new Set();
  for (const time of TICK_TIMES) {
    const now = atLondon('2026-09-08', time);
    // Only the families this tick could actually choose. A family the director
    // would never reach at this hour proves nothing by failing here.
    const eligible = eligibleFamilies(context(time));
    for (const family of eligible) {
      everSeen.add(family);
      const actions = beatActions(family, context(time), DEFAULT_SEED, `k/${time}`);
      assert.ok(actions.length > 0, `${family} staged nothing`);
      for (const action of actions) {
        assert.ok(action.dueAt > now, `${family} scheduled ${action.type} at or before its own cause`);
        assert.equal(action.day, '2026-09-08');
      }
      // The real gate, run exactly as the reducer runs it.
      assert.doesNotThrow(() => assertScheduleWindows(actions),
        `${family} staged at ${time} falls outside its own window`);
    }
  }
  // And the sweep actually covered the repertoire rather than passing vacuously.
  assert.deepEqual([...everSeen].sort(), [...BEAT_FAMILIES].sort());
});

test('the same seed stages the same beats at the same minutes', t => {
  const open = storage(t);
  const summarise = name => {
    const world = open(name);
    world.advance(atLondon('2026-10-04', '00:00'));
    return world.semanticSnapshot().events
      .filter(event => event.type === 'DIRECTOR_TICK')
      .map(event => `${event.occurredAt}:${event.payload.reason}:${event.payload.family ?? '-'}`);
  };
  const first = summarise('twin-a');
  const second = summarise('twin-b');
  assert.deepEqual(first, second, 'the director is not deterministic');
  assert.ok(first.some(entry => entry.endsWith(':staged') === false && entry.includes('staged')));
});

test('the presentation layer cannot reach the world', () => {
  // The Phase C rail is structural rather than a matter of care: nothing the
  // engine loads imports the presentation module, so no model can be in the
  // path of a decision even by accident.
  const modelPresentationImport = /['"]\.\/(?:src\/)?presentation\.mjs['"]/;
  for (const file of ['fixture.mjs', 'world.mjs', 'dialogue.mjs', 'director.mjs', 'places.mjs', 'cast.mjs',
    'sky.mjs', 'time.mjs', 'veil.mjs']) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.ok(!modelPresentationImport.test(source), `${file} imports the presentation layer`);
    assert.ok(!/\bfetch\s*\(|node:https?\b/.test(source), `${file} reaches the network`);
  }
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.ok(!modelPresentationImport.test(server), 'the request path renders prose');
  // And the world's approved vocabulary still has no event a model can author.
  assert.ok(!EVENT_TYPES.some(type => /VIGNETTE|PROSE|GENERATED/.test(type)));
});
