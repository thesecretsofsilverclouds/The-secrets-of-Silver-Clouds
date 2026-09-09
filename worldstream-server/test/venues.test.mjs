import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWorld } from '../src/world.mjs';
import { DEFAULT_SEED, CITY_LOCATIONS } from '../src/fixture.mjs';
import { atLondon, nextLondonDay } from '../src/time.mjs';
import { VENUE_SCENES, VENUE_MOODS, VENUE_FAUNA, selectVenueScene, venueCastOf, venueSceneId } from '../src/venues.mjs';
import { LEGION_CAST, OUTSIDE_CAST, STREET_FAUNA } from '../src/cast.mjs';
import { assertNoSpoiler } from '../src/spoilers.mjs';

const scenePath = name => join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'worldstream', 'app', 'scene', name);
const GOADEN_HAS = new Set(['idle', 'smirk', 'surprised', 'amused', 'deflect', 'guarded', 'concerned', 'tired']);
const ASHAI_HAS = new Set(['neutral', 'soft_smile', 'amused', 'thoughtful', 'vulnerable', 'tired', 'surprised', 'guarded']);

test('equally eligible venue scripts are all performed before any repeats, with stable archive identities', () => {
  for (const [venue, bank] of Object.entries(VENUE_SCENES)) {
    const available = ['goaden', 'ashai'];
    const eligible = bank.filter(scene => !scene.requires && venueCastOf(scene)
      .every(who => [...available, ...(VENUE_FAUNA[venue] ?? [])].includes(who)));
    const usage = {}, performed = [];
    for (let index = 0; index < eligible.length; index++) {
      const args = { venue, available, seed: DEFAULT_SEED, key: 'same-draw', usage };
      const scene = selectVenueScene(args);
      assert.ok(scene.id);
      assert.deepEqual(selectVenueScene(args), scene, 'reading the same history does not consume a script');
      assert.ok(!performed.includes(scene.id));
      performed.push(scene.id); usage[scene.id] = 1;
    }
    assert.deepEqual(new Set(performed), new Set(eligible.map(scene => venueSceneId(venue, scene))));
  }
});

test('every venue the pair can visit has scenes written for it', () => {
  // The gap this closes: an hour at Enchanted Ink used to be "arrived" and
  // "spent time among the designs", with nothing in between.
  for (const venue of Object.keys(CITY_LOCATIONS)) {
    const bank = VENUE_SCENES[venue];
    assert.ok(bank?.length >= 2, `${venue} has ${bank?.length ?? 0} scenes`);
  }
  for (const [venue, bank] of Object.entries(VENUE_SCENES)) {
    for (const scene of bank) {
      assert.ok(VENUE_MOODS.includes(scene.mood), `${venue}: ${scene.mood}`);
      assert.ok(scene.summary, `${venue}/${scene.mood} has no feed line`);
      assert.ok(scene.lines.length >= 4, `${venue}/${scene.mood} is too short to be a scene`);
      assertNoSpoiler(scene.summary, `${venue}/${scene.mood} summary`);
      for (const line of scene.lines) assertNoSpoiler(line.text, `${venue}/${scene.mood}`);
    }
  }
});

test('default eligible cafe scenes do not claim unverified elapsed days', () => {
  // Venue eligibility knows the present cast, not how many days have passed
  // since they last sat together. A casual cafe visit must also fit a day when
  // they have already shared breakfast or a game in the barracks.
  const available = ['goaden', 'ashai'], present = [...available, ...VENUE_FAUNA.cafe];
  const eligible = VENUE_SCENES.cafe.filter(scene => !scene.requires
    && venueCastOf(scene).every(who => present.includes(who)));
  const usage = {}, reached = [];
  for (let index = 0; index < eligible.length; index++) {
    const scene = selectVenueScene({ venue: 'cafe', available, seed: DEFAULT_SEED,
      key: 'after-breakfast', usage });
    assert.ok(scene);
    reached.push(scene.id); usage[scene.id] = 1;
    for (const line of scene.lines) assert.doesNotMatch(line.text,
      /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\s+days?\b/i,
      `${scene.id} asserts an elapsed-day history that was never supplied`);
  }
  assert.equal(new Set(reached).size, eligible.length);
});

test('no written line asks for a plate the world has not got', () => {
  // The one failure that reaches a reader as a broken image.
  for (const [venue, bank] of Object.entries(VENUE_SCENES)) {
    for (const scene of bank) {
      for (const line of scene.lines) {
        if (line.who === 'goaden') { assert.ok(GOADEN_HAS.has(line.expression), `goaden/${line.expression}`); continue; }
        if (line.who === 'ashai') {
          assert.ok(ASHAI_HAS.has(line.expression), `ashai/${line.expression}`);
          assert.ok(existsSync(scenePath(`ashai-${line.expression}.png`)), `missing ashai-${line.expression}.png`);
          continue;
        }
        // Guests come from two rosters now — the crew, and the two who are not
        // friends of the house — and both are held to the same rule.
        const cast = LEGION_CAST[line.who] ?? OUTSIDE_CAST[line.who] ?? STREET_FAUNA[line.who];
        assert.ok(cast, `${venue}: ${line.who} is not in the cast`);
        assert.ok(cast.plates.includes(line.expression), `${line.who} has no ${line.expression} plate`);
        assert.ok(existsSync(scenePath(`${line.who}-${line.expression}.png`)),
          `missing art: ${line.who}-${line.expression}.png`);
      }
    }
  }
});

test('a scene is only cast from who is actually in the room', () => {
  for (const venue of Object.keys(VENUE_SCENES)) {
    // With only the pair available, no scene may reach for a guest.
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const scene = selectVenueScene({ venue, available: ['goaden', 'ashai'], seed: DEFAULT_SEED, key });
      assert.ok(scene, `${venue} produced nothing`);
      for (const who of scene.cast) {
        // A guest is booked, and an unbooked guest turning up is the bug this
        // guards. Street fauna are not booked and never were: a road sprite is
        // under the counter whether or not the world sent anybody, so it is
        // allowed here and held to the venue it actually lives at instead.
        if (STREET_FAUNA[who]) { assert.ok((VENUE_FAUNA[venue] ?? []).includes(who),
          `${who} is not fauna of ${venue}`); continue; }
        assert.ok(['goaden', 'ashai'].includes(who), `${who} appeared without being there`);
      }
    }
    // Seeded.
    const once = selectVenueScene({ venue, available: ['goaden', 'ashai'], seed: DEFAULT_SEED, key: 'same' });
    const twice = selectVenueScene({ venue, available: ['goaden', 'ashai'], seed: DEFAULT_SEED, key: 'same' });
    assert.deepEqual(once, twice, `${venue} is not deterministic`);
  }
  // A guest unlocks the scenes that need them.
  const withGabriel = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(key =>
    selectVenueScene({ venue: 'enchanted_ink', available: ['goaden', 'ashai', 'gabriel'], seed: DEFAULT_SEED, key }));
  assert.ok(withGabriel.some(scene => scene.cast.includes('gabriel')), 'Gabriel never turned up');
  assert.deepEqual(venueCastOf(VENUE_SCENES.enchanted_ink[0]), ['goaden', 'ashai']);
});

test('an hour at a venue actually happens, and changes nothing', t => {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-venue-test-'));
  const world = openWorld({ dbPath: join(directory, 'w.sqlite'), seed: DEFAULT_SEED, startMs: atLondon('2026-09-04', '00:00') });
  t.after(() => {
    world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-venue-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  let end = '2026-09-04';
  for (let i = 0; i < 60; i++) end = nextLondonDay(end);
  world.advance(atLondon(end, '00:00'));
  const snapshot = world.semanticSnapshot();

  const scenes = snapshot.events.filter(event => event.type === 'VENUE_SCENE' && event.payload?.lines);
  assert.ok(scenes.length >= 6, `only ${scenes.length} venue scenes in 60 days`);
  for (const scene of scenes) {
    // Lines and nothing else, the same guarantee a conversation has.
    for (const change of scene.changes) {
      // 'story' is the authored-situation ledger: which situation is running
      // and when the next may fire. Bookkeeping, like the two beside it.
      assert.ok(['director', 'pressure', 'story'].includes(change.entity), 'an hour at a venue moved the world');
    }
    // It happened where they were, and they were actually there.
    assert.ok(Object.keys(CITY_LOCATIONS).includes(scene.location), scene.location);
    assert.equal(scene.payload.venue, scene.location);
    assert.deepEqual([...scene.participants].sort(), ['ashai', 'goaden']);
    assert.ok(scene.publicDescription);
    // Everybody who speaks was available for that scene.
    for (const who of scene.payload.cast) {
      assert.ok(['goaden', 'ashai', ...Object.keys(LEGION_CAST), ...Object.keys(OUTSIDE_CAST), ...Object.keys(STREET_FAUNA)].includes(who), who);
    }
  }
  // More than one kind of hour, or it is a cutscene rather than a world.
  const moods = new Set(scenes.map(scene => scene.payload.mood));
  assert.ok(moods.size >= 3, `only ${[...moods]} ever played`);
  // And the lines reach the page.
  const projection = world.publicProjection();
  const onPage = projection.events.filter(event => Array.isArray(event.lines));
  for (const event of onPage) for (const line of event.lines) assert.ok(line.who && line.text);
});
