import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWatcherComments, selectWatchersForEvent, ALL_WATCHER_KIND_LINES } from '../src/watchers.mjs';
import { buildBroadsheet, buildFactionRoundup, buildGazetteNotices, buildLintelFlock,
  formatHighStakesPing, isHighStakesEvent, synthesizeLeadHeadline } from '../src/dispatch.mjs';
import { atLondon } from '../src/time.mjs';

const date = '2026-09-09';
const now = atLondon(date, '14:00');
const event = (id, type, description, extra = {}) => ({ id, type, description,
  occurredAt: now - 60_000, ...extra });
const world = { weather: { code: 'clear', description: 'Clear', temperatureC: 18 },
  sky: { lintels: 1 }, factions: { mi6: 'routine', order: 'quiet', church: 'quiet',
    sanctuary: 'invited_guests', streamliner: 'normal', arcane: 'low' }, events: [] };

test('unrelated, unknown and private passages do not manufacture World Voices', () => {
  for (let index = 0; index < 100; index++) {
    const offscreen = event(`verse-${index}`, 'OFFSCREEN_ATTEMPT', 'Rose worked alone on her verse.', { location: 'legion_hideout' });
    assert.deepEqual(generateWatcherComments(offscreen), []);
    assert.deepEqual(generateWatcherComments({ ...offscreen, visibility: 'private', description: 'MI6 report about Ashai.' }), []);
  }
  assert.deepEqual(generateWatcherComments({ id: 'unknown' }), []);
  assert.deepEqual(generateWatcherComments('unknown'), []);
  assert.deepEqual(selectWatchersForEvent(event('talk', 'CONVERSATION', 'Goaden talked.'), 0), []);
});

test('World Voices follow a supported subject and remain repeatable without changing the event', () => {
  const source = event('breakfast', 'CONVERSATION', 'Goaden and Ashai talked over breakfast at the Silver Spoon.', { location: 'cafe' });
  const before = JSON.stringify(source);
  const comments = generateWatcherComments(source);
  assert.ok(comments.length > 0 && comments.length <= 3);
  assert.ok(comments.every(comment => ['EmberVale', 'Pennyworth_Pip'].includes(comment.authorName)));
  assert.ok(comments.every(comment => comment.eventId === source.id && comment.createdAt > source.occurredAt));
  assert.deepEqual(generateWatcherComments(source), comments);
  assert.equal(JSON.stringify(source), before);
});

test('World Voice corpus contains reactions, not the previously invented observations', () => {
  const text = ALL_WATCHER_KIND_LINES.join('\n');
  assert.doesNotMatch(text, /Amy|Tait|eleven seconds|ninety seconds|beds started shaking|peal ran long|cleared the embankment|two miles away|never hear about|22:15|third carriage was running warm/i);
  const clinical = generateWatcherComments(event('rest', 'REST_BEGIN', 'Ashai lay down to rest.', { location: 'mi6' }));
  assert.ok(clinical.length);
  assert.ok(clinical.every(comment => comment.authorName === 'NightShiftNurse'));
});

test('urgent notices preserve the committed account without inventing a recall, time or place', () => {
  for (const source of [event('surge', 'ARCANE_SURGE', 'Arcane light crossed the Thames.'),
    event('plan', 'PLAN_BROKEN', 'They let the arrangement lapse.'),
    event('trip', 'OUTING_CUT_SHORT', 'Rain brought their walk to an end.'),
    event('brief', 'BRIEFING_BEGIN', 'Goaden joined the briefing.')]) {
    assert.equal(formatHighStakesPing(source), `⚡ URGENT DISPATCH: ${source.description}`);
    assert.equal(formatHighStakesPing({ ...source, visibility: 'private' }), null);
    assert.equal(isHighStakesEvent({ ...source, visibility: 'private' }), false);
  }
});

test('Gazette notices come only from dated public notices, with no fabricated filler', () => {
  const notice = event('notice', 'INSTITUTION_NOTICE', 'The Church confirmed the Veil dates.');
  const result = buildGazetteNotices(date, 3, [notice,
    event('private', 'INSTITUTION_NOTICE', 'PRIVATE_THING', { visibility: 'private' }),
    event('old', 'INSTITUTION_NOTICE', 'OLD_THING', { occurredAt: atLondon('2026-09-06', '10:00') }),
    event('talk', 'CONVERSATION', 'Goaden ordered tea.')]);
  assert.deepEqual(result, [notice.description]);
  assert.deepEqual(buildGazetteNotices(date, 3, []), []);
  assert.deepEqual(buildGazetteNotices(), []);
});

test('a historical surge cannot change current posture, access rules or flock measurements', () => {
  const surge = event('surge', 'ARCANE_SURGE', 'An arcane surge crossed the Thames.');
  const roundup = buildFactionRoundup(world.factions, [surge], date);
  assert.equal(roundup.mi6.level, 'routine');
  assert.equal(roundup.mi6.tone, 'calm');
  assert.equal(roundup.arcane.level, 'low');
  assert.equal(roundup.church.level, 'quiet');
  assert.equal(buildFactionRoundup({ sanctuary: 'private_event' }).sanctuary.level, 'private_event');
  assert.doesNotMatch(JSON.stringify(roundup), /open to the public|06:00|0\.38|doubled|scouts near rail/i);
  const flock = buildLintelFlock({ lintels: 1 }, {}, [surge]);
  assert.equal(flock.count, 1);
  assert.doesNotMatch(flock.observation + flock.reading, /surge|\d+\.\d+|mist|belfry/i);
});

test('newspaper excludes future and private events and identifies current conditions beside old articles', () => {
  const past = event('past', 'TRAVEL_DEPART', 'Ashai left the cafe on foot.', { location: 'cafe' });
  const future = event('future', 'ARCANE_SURGE', 'FUTURE_SURGE', { occurredAt: now + 60_000 });
  const privateEvent = event('private', 'INCIDENT', 'PRIVATE_INCIDENT', { visibility: 'private' });
  const edition = buildBroadsheet({ events: [past, future, privateEvent], date, serverTime: now, world });
  assert.deepEqual(edition.chronicleBriefs.map(brief => brief.eventId), ['past']);
  assert.doesNotMatch(edition.plainTextSummary, /FUTURE_SURGE|PRIVATE_INCIDENT|third carriage|mag-lev|skyport/i);
  assert.equal(edition.chronicleBriefs[0].text, past.description);
  const archive = buildBroadsheet({ events: [past], date, serverTime: now + 86_400_000, world });
  assert.match(archive.masthead.weather.description, /^Current weather:/);
  assert.ok(Object.values(archive.factionRoundup).every(faction => faction.status.startsWith('Current:')));
  assert.equal(archive.lintelFlock.reading, 'Current sky');
});

test('headlines do not turn a routine journey or a private-room talk into another event', () => {
  assert.equal(synthesizeLeadHeadline(event('walk', 'TRAVEL_DEPART', 'Ashai walked home.'), date), 'ON THE WAY: A journey begins');
  assert.equal(synthesizeLeadHeadline(event('talk', 'CONVERSATION', 'Goaden spoke in the music room.'), date), 'WORDS EXCHANGED: A moment in conversation');
  const empty = buildBroadsheet({ date, serverTime: now, world });
  assert.doesNotMatch(empty.chronicleBriefs[0].text, /patrol|steady chimes|all boroughs/i);
});
