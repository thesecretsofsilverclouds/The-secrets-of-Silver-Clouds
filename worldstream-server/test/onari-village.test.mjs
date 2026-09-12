import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AREAS_BY_LOCATION,
  ONARI_VILLAGE_AREAS,
  SEALED_AREAS,
  defaultArea,
  placePhrase,
  permitsArea,
  encounterEligibility,
} from '../src/places.mjs';
import {
  CITY_LOCATIONS,
  THEME_NAMES,
  canEnterOnariVillage,
  LOCATION_MODES,
  MODE_PERMITS,
  createFixture,
} from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';
import { VENUE_GUESTS, VENUE_SCENES } from '../src/venues.mjs';
import { SIDE_CHARACTERS } from '../src/cast.mjs';
import { BACKGROUND_BY_ID } from '../src/cinematic-assets.mjs';
import { assertNoSpoiler, findSpoilers } from '../src/spoilers.mjs';

const sceneFile = url => join(dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'worldstream', 'app', String(url).replace(/^\//, ''));

test('Onari Village is registered with safe public areas and sealed information room', () => {
  assert.ok(AREAS_BY_LOCATION.onari_village, 'onari_village must be a registered canonical location');
  assert.deepEqual(AREAS_BY_LOCATION.onari_village, ONARI_VILLAGE_AREAS);

  // Safe public areas
  assert.ok(ONARI_VILLAGE_AREAS.village_square);
  assert.equal(ONARI_VILLAGE_AREAS.village_square.indoors, false);
  assert.equal(ONARI_VILLAGE_AREAS.village_square.social, true);

  assert.ok(ONARI_VILLAGE_AREAS.market);
  assert.equal(ONARI_VILLAGE_AREAS.market.social, true);

  assert.ok(ONARI_VILLAGE_AREAS.communal_grounds);
  assert.equal(ONARI_VILLAGE_AREAS.communal_grounds.social, true);

  assert.ok(ONARI_VILLAGE_AREAS.life_tree_perimeter);
  assert.equal(ONARI_VILLAGE_AREAS.life_tree_perimeter.social, false);

  assert.ok(ONARI_VILLAGE_AREAS.trails);
  assert.equal(ONARI_VILLAGE_AREAS.trails.social, false);

  // Sealed information room
  assert.ok(ONARI_VILLAGE_AREAS.information_room);
  assert.ok(SEALED_AREAS.includes('information_room'), 'information_room must be in SEALED_AREAS');
  assert.deepEqual(ONARI_VILLAGE_AREAS.information_room.permits, []);
  assert.deepEqual(ONARI_VILLAGE_AREAS.information_room.dayparts, []);
});

test('Information room fails closed and cannot be entered or staged', () => {
  const atMs = Date.parse('2026-09-08T14:00:00Z');
  // permitsArea must return false for information_room at all times
  assert.equal(permitsArea('onari_village', 'information_room', 'unhurried_time', atMs), false);
  assert.equal(permitsArea('onari_village', 'information_room', 'resting', atMs), false);

  // encounterEligibility must refuse with reason 'sealed'
  const people = {
    ashai: { location: 'onari_village', area: 'village_square', activity: 'unhurried_time', journey: null },
    goaden: { location: 'onari_village', area: 'village_square', activity: 'unhurried_time', journey: null },
  };
  const result = encounterEligibility(people, { location: 'onari_village', area: 'information_room', atMs });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'sealed');
});

test('Onari Village default area and place phrase formatting', () => {
  const atMs = Date.parse('2026-09-08T12:00:00Z');
  assert.equal(defaultArea('onari_village', atMs), 'village_square');
  assert.equal(placePhrase('onari_village', 'village_square'), 'the village square');
  assert.equal(placePhrase('onari_village', 'market'), 'the village market');
  assert.equal(placePhrase('onari_village', 'life_tree_perimeter'), 'the Life Tree perimeter');
  assert.equal(placePhrase('onari_village', null), 'the Onari village');
});

test('Onari Village is strictly excluded from ordinary leisure and destination pools', () => {
  // Not in ordinary CITY_LOCATIONS (cafe, enchanted_ink, big_ben_plaza)
  assert.ok(!CITY_LOCATIONS.onari_village, 'onari_village must not be in CITY_LOCATIONS');

  // Not in THEME_NAMES
  assert.ok(!THEME_NAMES.includes('onari_village'));
  assert.ok(!THEME_NAMES.includes('village_outing'));

  // Not in VENUE_GUESTS or VENUE_SCENES
  assert.ok(!VENUE_GUESTS.onari_village);
  assert.ok(!VENUE_SCENES.onari_village);

  // Registered in modes and permits
  assert.ok(LOCATION_MODES.onari_village);
  assert.ok(MODE_PERMITS['onari_village:daylight']);
  assert.ok(MODE_PERMITS['onari_village:dusk']);
  assert.ok(MODE_PERMITS['onari_village:quiet_night']);
});

test('Travel access guard: ordinary travel is rejected; committed reason allows entry', () => {
  const atMs = Date.parse('2026-09-08T14:00:00Z');
  const emptyState = { facts: {} };

  // Casual leisure visit by Goaden and Ashai is rejected
  assert.equal(canEnterOnariVillage(emptyState, atMs, ['goaden', 'ashai']), false);

  // Single Yukon journey is recognized (home location)
  assert.equal(canEnterOnariVillage(emptyState, atMs, ['yukon']), true);
  assert.equal(SIDE_CHARACTERS.yukon.homeLocation, 'onari_village');

  // Non-Onari travel with committed simulation access fact is permitted
  const validAccessState = {
    facts: {
      'fact:onari-escort': {
        kind: 'onari_consultation_referral',
        validUntil: atMs + 3600_000,
      },
    },
  };
  assert.equal(canEnterOnariVillage(validAccessState, atMs, ['goaden', 'ashai']), true);

  // Expired fact is rejected
  const expiredState = {
    facts: {
      'fact:onari-escort': {
        kind: 'onari_consultation_referral',
        validUntil: atMs - 1000,
      },
    },
  };
  assert.equal(canEnterOnariVillage(expiredState, atMs, ['goaden', 'ashai']), false);
});

test('Production TRAVEL_DEPART/ARRIVE require a committed village access fact', () => {
  const startMs = atLondon('2026-09-08', '00:00');
  const dueAt = atLondon('2026-09-08', '14:00');
  const fixture = createFixture({ startMs });
  const arrangementKey = '2026-09-08:onari-consultation';
  const accessKey = '2026-09-08:onari-access';

  const denied = fixture.initialState();
  denied.arrangements[arrangementKey] = {
    status: 'accepted',
    party: ['goaden', 'ashai'],
    activity: 'unhurried_time',
    startAt: startMs,
    until: dueAt + 4 * 3600_000,
    acceptanceEventId: 'seed:village-arr',
    sourceEventId: 'seed:village-arr-src'
  };
  const deniedDepart = {
    id: 'test/village-denied',
    type: 'TRAVEL_DEPART',
    dueAt,
    priority: 40,
    day: '2026-09-08',
    actors: ['goaden', 'ashai'],
    from: 'mi6',
    to: 'onari_village',
    duration: 20,
    arrangementKey
  };
  const skipped = fixture.reduceAction(denied, deniedDepart, 'village-access-test');
  assert.equal(skipped.event.payload.outcome, 'skipped');
  assert.match(skipped.event.payload.reason, /Onari village access/);

  const allowed = fixture.initialState();
  allowed.facts[accessKey] = {
    key: accessKey,
    kind: 'onari_consultation_referral',
    subject: 'onari',
    value: { locationId: 'onari_village' },
    validUntil: dueAt + 6 * 3600_000,
    createdAt: startMs,
    sourceEventId: 'seed:village-access'
  };
  allowed.arrangements[arrangementKey] = denied.arrangements[arrangementKey];
  const allowedDepart = { ...deniedDepart, id: 'test/village-allowed' };
  const boarded = fixture.reduceAction(allowed, allowedDepart, 'village-access-test');
  assert.notEqual(boarded.event.payload.outcome, 'skipped');
  assert.equal(boarded.event.payload.to, 'onari_village');
  assert.equal(allowed.characters.goaden.journey.to, 'onari_village');
  const arrival = boarded.followups.find(action => action.type === 'TRAVEL_ARRIVE');
  assert.ok(arrival);
  assert.equal(arrival.to, 'onari_village');
  const arrived = fixture.reduceAction(allowed, arrival, 'village-access-test');
  assert.equal(arrived.event.location, 'onari_village');
  assert.equal(allowed.characters.goaden.location, 'onari_village');
  assert.equal(allowed.characters.ashai.location, 'onari_village');
  assert.equal(allowed.characters.goaden.area, 'village_square');
});

test('Spoiler embargo: doll revelation, information room, and Ashai parentage ties to Onari are blocked', () => {
  // Banned terms
  assert.throws(() => assertNoSpoiler('Ashai entered the information room to look through files.'), /information room/);
  assert.throws(() => assertNoSpoiler('They found an ashai-doll wrapped in cloth.'), /ashai-doll/);
  assert.throws(() => assertNoSpoiler('The doll revelation changed everything.'), /doll revelation/);

  // Banned links: Ashai and Onari parentage/ties
  assert.throws(() => assertNoSpoiler('Ashai wondered about her onari mother who had left London.'), /ashai_parentage/);
  assert.throws(() => assertNoSpoiler('Ashai had ties to onari through her bloodline.'), /ashai_parentage/);
  assert.throws(() => assertNoSpoiler('Ashai discovered she had onari parents.'), /ashai_parentage/);
  assert.throws(() => assertNoSpoiler('The onari village held secrets about her mother and the journal.'), /ashai_parentage/);

  // Clean ambient Onari Village text without spoilers passes cleanly
  assert.doesNotThrow(() => assertNoSpoiler('Yukon sat by the communal hearth in the village square.'));
  assert.doesNotThrow(() => assertNoSpoiler('The Life Tree perimeter was quiet in the afternoon sun.'));
  assert.doesNotThrow(() => assertNoSpoiler('Stalls in the village market were packing away woven baskets.'));
});

test('Cinematic backdrop world-onari-village.png is registered and exists on disk', () => {
  const bg = BACKGROUND_BY_ID.onari_village;
  assert.ok(bg, 'onari_village background must be registered');
  assert.equal(bg.file, '/scene/world-onari-village.png');
  assert.equal(bg.location, 'onari_village');
  assert.ok(existsSync(sceneFile(bg.file)), `world-onari-village.png must exist at ${sceneFile(bg.file)}`);
});
