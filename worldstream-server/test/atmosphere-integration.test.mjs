import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { cinematicRecordForApi } from '../src/cinematics.mjs';
import { atLondon } from '../src/time.mjs';
import { scoreMood } from '../../worldstream/app/score-mood.js';
import { roadSpriteMode, spriteFrame } from '../../worldstream/app/road-sprites.js';
import { deriveAtmosphere, artworkExposure } from '../../worldstream/app/weather-layer.js';
import { selectAmbientPlan } from '../../worldstream/app/ambient-audio.js';
import { publicAmbientSources, AMBIENT_AUDIO_FILES } from '../src/ambient-assets.mjs';

const now = atLondon('2026-09-06', '00:30');
const worldNow = Object.freeze({
  resolvedThrough: now, time: { daypart: 'small_hours', dayPhase: 'night', daylight: 0 },
  weather: { code: 'storm' }, factions: { mi6: 'elevated', arcane: 'high', order: 'active_in_city' },
  characters: [{ id: 'goaden', location: 'mi6', room: 'the ops room', activity: 'standby' },
    { id: 'ashai', location: 'mi6', room: 'the ops room', activity: 'standby' }], events: [],
});

test('pressure retains the urgent score after midnight; ordinary sleep and gaming keep distinct moods', () => {
  const before = structuredClone(worldNow);
  assert.equal(scoreMood(worldNow), 'pressure');
  assert.equal(scoreMood({ ...worldNow, factions: { mi6: 'routine', arcane: 'normal', order: 'quiet' } }), 'night');
  assert.equal(scoreMood({ time: { daypart: 'midday' }, factions: {}, characters: [{ activity: 'sleeping' }] }), 'night');
  assert.equal(scoreMood({ ...worldNow, factions: {}, characters: [{ activity: 'gaming' }] }), 'play');
  assert.equal(scoreMood({ time: { daypart: 'midday' }, factions: {}, characters: [{ activity: 'studying' }] }), 'ordinary');
  assert.deepEqual(worldNow, before);
});

test('public scene context owns score selection even when the current world has different pressure and time', () => {
  for (const eventType of ['INCIDENT', 'ARCANE_SURGE', 'RECALL']) {
    assert.equal(scoreMood({ factions: {}, time: { daypart: 'night' } }, { eventType, time: { dayPhase: 'night' } }), 'pressure');
  }
  assert.equal(scoreMood(worldNow, { eventType: 'CONVERSATION', time: { dayPhase: 'day' } }), 'ordinary');
  assert.equal(scoreMood(worldNow, { eventType: 'CONVERSATION', time: { dayPhase: 'night' } }), 'night');
  assert.equal(scoreMood(worldNow, { activity: 'gaming', eventType: 'CONVERSATION', time: { dayPhase: 'night' } }), 'play');
});

function archiveRecord() {
  const occurredAt = atLondon('2026-09-04', '12:15');
  return {
    eventId: 'archived-public-conversation', occurredAt, acceptedAt: occurredAt + 20_000,
    score: 70, band: 'scene', status: 'performed', privateState: 'PRIVATE_RECORD_SENTINEL',
    packet: {
      event: { location: 'big_ben_plaza', room: 'the plaza', type: 'CONVERSATION',
        privateReasoning: 'PRIVATE_REASONING_SENTINEL' },
      world: { weather: { code: 'clear', description: 'PRIVATE_WEATHER_SENTINEL' },
        seed: 'PRIVATE_SEED_SENTINEL', resolvedThrough: now, hidden: 'PRIVATE_WORLD_SENTINEL' },
      characters: { goaden: { knowledge: ['PRIVATE_MEMORY_SENTINEL'], voice: 'PRIVATE_VOICE_SENTINEL' } },
      scene: { targetDurationSeconds: 45, privateNotes: 'PRIVATE_SCENE_SENTINEL' },
    },
    scene: {
      background: 'london_day', openingNarration: 'The afternoon light crosses the paving.',
      beats: [{ speaker: 'goaden', plate: 'goaden_idle', line: 'A quiet moment.', factRefs: ['PRIVATE_FACT_REF_SENTINEL'] }],
      closingNarration: '', chronicleSummary: 'A brief pause at the plaza.', source: 'authored',
      privateNotes: 'PRIVATE_RENDER_SENTINEL',
    },
  };
}

test('archived atmosphere captures event weather and London time without inheriting the live storm or private packet', () => {
  const record = archiveRecord(), before = structuredClone(record);
  const api = cinematicRecordForApi(record);
  assert.deepEqual(Object.keys(api.atmosphere).sort(), ['eventType', 'location', 'room', 'time', 'weatherCode']);
  assert.equal(api.atmosphere.location, 'big_ben_plaza'); assert.equal(api.atmosphere.room, 'the plaza');
  assert.equal(api.atmosphere.weatherCode, 'clear'); assert.equal(api.atmosphere.time.dayPhase, 'day');
  assert.ok(api.atmosphere.time.daylight > 0.75);
  assert.equal(api.occurredAt, record.occurredAt);
  assert.ok(!JSON.stringify(api).includes('PRIVATE_'));
  const captured = deriveAtmosphere(worldNow, { ...api.atmosphere, eventId: api.eventId });
  assert.equal(captured.source, 'scene'); assert.equal(captured.weatherCode, 'clear');
  assert.equal(captured.location, 'big_ben_plaza'); assert.equal(captured.dayPhase, 'day');
  assert.equal(captured.rain, 0); assert.equal(captured.lightning, false);
  assert.equal(scoreMood(worldNow, api.atmosphere), 'ordinary');
  assert.equal(selectAmbientPlan(captured, publicAmbientSources()).key, 'city');
  assert.deepEqual(deriveAtmosphere({ ...worldNow, weather: { code: 'heavy_rain' } }, api.atmosphere),
    deriveAtmosphere({ ...worldNow, weather: { code: 'fog' } }, api.atmosphere));
  assert.deepEqual(record, before, 'presentation projection cannot rewrite cached canonical evidence');
});

test('legacy archives with missing or invalid captured weather stay neutral, never borrow current weather', () => {
  for (const weather of [undefined, { code: 'PRIVATE_WEATHER_SENTINEL' }]) {
    const record = archiveRecord(); record.packet.world.weather = weather;
    const api = cinematicRecordForApi(record), context = deriveAtmosphere(worldNow, api.atmosphere);
    assert.equal(api.atmosphere.weatherCode, 'cloudy'); assert.equal(context.rain, 0);
    assert.equal(context.lightning, false); assert.ok(!JSON.stringify(api).includes('PRIVATE_'));
  }
  assert.equal(cinematicRecordForApi(null), null);
});

test('page-edge sprites follow London light in every location and weather, while respecting opt-out and scenes', () => {
  const outside = { exposure: 'outdoor', dayPhase: 'day', weatherCode: 'clear' }, before = structuredClone(outside);
  assert.equal(roadSpriteMode(outside), 'run');
  assert.equal(roadSpriteMode({ ...outside, dayPhase: 'night' }), 'sleep');
  assert.equal(roadSpriteMode({ ...outside, dayPhase: 'dawn' }), 'run');
  for (const exposure of ['outdoor', 'sheltered', 'transit']) {
    for (const weatherCode of ['clear', 'heavy_rain', 'storm']) {
      assert.equal(roadSpriteMode({ ...outside, exposure, weatherCode }), 'run');
      assert.equal(roadSpriteMode({ ...outside, exposure, weatherCode, dayPhase: 'night' }), 'sleep');
    }
  }
  assert.equal(roadSpriteMode({ exposure: 'sheltered', dayPhase: 'night' }, { enabled: false }), 'off');
  assert.equal(roadSpriteMode({ exposure: 'sheltered', dayPhase: 'night' }, { sceneOpen: true }), 'off');
  assert.equal(roadSpriteMode(outside, { enabled: false }), 'off');
  assert.equal(roadSpriteMode(outside, { sceneOpen: true }), 'off');
  assert.equal(roadSpriteMode(null), 'off'); assert.deepEqual(outside, before);
});

test('sprite frames use elapsed time and remain inside authored strips across long runtimes', () => {
  for (const runner of [{ frames: 18, fps: 24 }, { frames: 12, fps: 12 }, { frames: 1, fps: 1 }]) {
    for (const elapsedMs of [-1000, 0, 1, 41, 42, 80, 749, 750, 1500, 100_000, 86_400_000]) {
      const frame = spriteFrame(elapsedMs, runner);
      assert.ok(Number.isInteger(frame)); assert.ok(frame >= 0 && frame < runner.frames);
    }
    assert.equal(spriteFrame(0, runner), 0);
    assert.equal(spriteFrame(runner.frames / runner.fps * 1000, runner), 0);
  }
  assert.equal(spriteFrame(1000, { frames: 18, fps: 24 }), 6);
});

async function httpFixture(t, options = {}) {
  let reads = 0, advances = 0;
  const world = {
    advance() { advances += 1; throw new Error('Cosmetic asset request attempted to advance world'); },
    publicProjection() { reads += 1; return structuredClone(worldNow); },
  };
  const server = createApp({ world, now: () => now, cinematicClient: null, cinematicOptions: { enabled: false }, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections(); await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  return { base: `http://127.0.0.1:${server.address().port}`, counts: () => ({ reads, advances }) };
}

test('atmosphere modules are served as same-origin static JavaScript without reading or advancing the world', async t => {
  const h = await httpFixture(t);
  for (const path of ['/weather-layer.js', '/ambient-audio.js', '/score-mood.js', '/road-sprites.js', '/atmosphere.js']) {
    const response = await fetch(h.base + path);
    assert.equal(response.status, 200, path); assert.match(response.headers.get('content-type'), /javascript/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await response.text(), /export /);
  }
  assert.deepEqual(h.counts(), { reads: 0, advances: 0 });
});

test('ambient HTTP manifest uses registered routes and playable ranges while retaining the ambiguous clip review gate', async t => {
  const h = await httpFixture(t);
  const response = await fetch(`${h.base}/api/ambient-sources`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, { sources: publicAmbientSources() });
  assert.equal(body.sources.rain_sheltered.automatic, false);
  assert.ok(!JSON.stringify(body).includes('C:\\'));
  assert.ok(!JSON.stringify(body).includes('1788638976971'));
  for (const { url } of Object.values(body.sources)) {
    const media = await fetch(h.base + url, { headers: { Range: 'bytes=0-31' } });
    assert.equal(media.status, 206, url); assert.equal(media.headers.get('content-type'), 'audio/mpeg');
    assert.equal(media.headers.get('accept-ranges'), 'bytes');
    assert.match(media.headers.get('content-range'), /^bytes 0-31\/\d+$/);
    assert.equal((await media.arrayBuffer()).byteLength, 32);
    const head = await fetch(h.base + url, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
  }
  assert.equal((await fetch(`${h.base}/api/ambient-sources`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${h.base}/ambient/private-sound.mp3`)).status, 404);
  assert.deepEqual(h.counts(), { reads: 0, advances: 0 });
});

test('score HTTP catalogue excludes exactly the environmental files and retains all three new music tracks', async t => {
  const h = await httpFixture(t);
  const response = await fetch(`${h.base}/api/tracks`); assert.equal(response.status, 200);
  const { tracks } = await response.json(), titles = new Set(tracks.map(track => track.title));
  for (const filename of AMBIENT_AUDIO_FILES) assert.ok(!titles.has(filename.slice(0, -4)), filename);
  for (const [title, slug] of [
    ['little star', 'little-star'],
    ['silver clouds', 'silver-clouds'],
    ['Touchscreen Drift', 'touchscreen-drift'],
    ['mowtown-towers', 'mowtown-towers'],
    ['mowtown towers3', 'mowtown-towers3'],
  ]) {
    assert.ok(tracks.some(track => track.title === title && track.slug === slug));
    const track = await fetch(`${h.base}/audio/${slug}.mp3`, { headers: { Range: 'bytes=0-15' } });
    assert.equal(track.status, 206); assert.equal((await track.arrayBuffer()).byteLength, 16);
  }
  assert.ok(titles.has('Midnight Static Loop')); assert.ok(titles.has('Arcade After Dark'));
  for (const slug of ['ambient-rain-heavy', 'ambient-rain-in-a-bu-4-1788638976971', 'background-sounds-ofcity']) {
    assert.equal((await fetch(`${h.base}/audio/${slug}.mp3`)).status, 404, 'SFX cannot remain aliased into the score');
  }
  assert.deepEqual(h.counts(), { reads: 0, advances: 0 });
});

test('public road sprite manifest contains only usable runtime assets and no provenance or local paths', async t => {
  const h = await httpFixture(t);
  const response = await fetch(`${h.base}/ambient/road-sprites.json`); assert.equal(response.status, 200);
  const body = await response.json(), encoded = JSON.stringify(body);
  assert.ok(!/C:|Users|Downloads|sha256|sourceCropSizes|sourceAlphaBounds|sourceStartSeconds/.test(encoded));
  assert.deepEqual(Object.keys(body).sort(), ['runners', 'sleepers', 'version']);
  assert.ok(body.runners.length > 0 && body.runners.length <= 2);
  assert.ok(body.sleepers.length > 0 && body.sleepers.length <= 2);
  const urls = new Set();
  for (const runner of body.runners) {
    assert.deepEqual(Object.keys(runner).sort(), ['baseline', 'facing', 'fallback', 'fps', 'frameHeight', 'frameWidth', 'frames', 'id', 'url']);
    assert.ok(Number.isInteger(runner.frames) && runner.frames > 0);
    assert.ok(runner.frameWidth > 0 && runner.frameHeight > 0 && runner.fps > 0);
    for (const at of [0, 1000, 50_000, 86_400_000]) assert.ok(spriteFrame(at, runner) < runner.frames);
    urls.add(runner.url); urls.add(runner.fallback);
  }
  for (const sleeper of body.sleepers) {
    assert.deepEqual(Object.keys(sleeper).sort(), ['bakedZzz', 'height', 'id', 'url', 'width']);
    assert.ok(sleeper.width > 0 && sleeper.height > 0); urls.add(sleeper.url);
  }
  for (const url of urls) {
    // Sprite paths are relative to the manifest that lists them, so the same
    // file works wherever the app is mounted — the site root during local
    // development, /worldstream/app/ on the website. A bare filename is also a
    // stronger guarantee than a rooted one for what this test is really
    // checking: that no local path or provenance leaked into a public asset.
    assert.match(url, /^[a-z-]+\.webp$/);
    const asset = await fetch(`${h.base}/ambient/${url}`); assert.equal(asset.status, 200, url);
    assert.equal(asset.headers.get('content-type'), 'image/webp');
    assert.ok((await asset.arrayBuffer()).byteLength > 100, `${url} must not be an unfinished extraction`);
  }
  assert.equal((await fetch(`${h.base}/artifacts/road-sprite-audit/manifest.json`)).status, 404);
  assert.deepEqual(h.counts(), { reads: 0, advances: 0 });
});

test('archive HTTP reads expose captured atmosphere and never advance the world or expose packet knowledge', async t => {
  const record = archiveRecord();
  const h = await httpFixture(t, { cinematicService: { store: {
    get: id => id === record.eventId ? record : null, list: () => [record],
  } } });
  for (const path of ['/api/cinematics/archive', `/api/cinematics/events/${record.eventId}`]) {
    const response = await fetch(h.base + path); assert.equal(response.status, 200);
    const body = await response.json(), row = body.cinematic ?? body.cinematics[0];
    assert.equal(body.serverTime, now); assert.equal(row.occurredAt, record.occurredAt);
    assert.equal(row.atmosphere.weatherCode, 'clear'); assert.equal(row.atmosphere.time.dayPhase, 'day');
    assert.ok(!JSON.stringify(body).includes('PRIVATE_'));
  }
  assert.deepEqual(h.counts(), { reads: 0, advances: 0 });
});

test('reviewed scene artwork wins over an outdoor event using an interior fallback', () => {
  assert.equal(artworkExposure('/scene/world-mi6-night.jpg'), 'sheltered');
  assert.equal(artworkExposure('/scene/mi6rooftop.jpg'), 'outdoor');
  assert.equal(artworkExposure('/scene/world-streamliner-day.jpg'), 'transit');
  // The training ground is `indoors: false` in the world and has its own art,
  // so it gets weather. The interior *fallback* below still must not.
  assert.equal(artworkExposure('/scene/world-mi6-training.jpg'), 'outdoor');
  const context = deriveAtmosphere({}, { location: 'mi6', room: 'training', weatherCode: 'storm',
    exposure: artworkExposure('/scene/world-mi6-night.jpg') });
  assert.equal(context.rain, 0);
  assert.equal(context.lightning, false);
});
