import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createAmbientAudio, selectAmbientPlan } from '../../worldstream/app/ambient-audio.js';
import { AMBIENT_ASSETS, AMBIENT_AUDIO_FILES, isAmbientAudioFile, publicAmbientSources } from '../src/ambient-assets.mjs';

const sources = publicAmbientSources();
const outdoorRain = Object.freeze({ weatherCode: 'heavy_rain', rain: 0.8, location: 'big_ben_plaza', exposure: 'outdoor' });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function harness({ preference, play, privateStorage = false } = {}) {
  let clock = 0, nextTimer = 0;
  const timers = new Map(), players = [], notices = [], listeners = new Map();
  const stored = new Map(preference ? [['silver-clouds-ambient-audio', JSON.stringify(preference)]] : []);
  const document = {
    hidden: false,
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
  };
  const runtime = {
    document, now: () => clock,
    storage: {
      getItem(key) { if (privateStorage) throw new Error('Storage disabled'); return stored.get(key) ?? null; },
      setItem(key, value) { if (privateStorage) throw new Error('Storage disabled'); stored.set(key, value); },
    },
    setInterval(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay, due: clock + delay }); return id; },
    clearInterval(id) { timers.delete(id); },
    createAudio() {
      const handlers = new Map();
      const audio = {
        src: '', volume: 1, paused: true, loop: false, playCalls: 0, loadCalls: 0,
        currentTime: 0, duration: 20,
        play() { this.playCalls += 1; this.paused = false; return play ? play(this) : Promise.resolve(); },
        pause() { this.paused = true; },
        load() { this.loadCalls += 1; },
        removeAttribute(name) { if (name === 'src') this.src = ''; },
        addEventListener(name, fn) { handlers.set(name, fn); },
        removeEventListener(name, fn) { if (handlers.get(name) === fn) handlers.delete(name); },
        error() { handlers.get('error')?.(); },
        timeupdate(seconds) { this.currentTime = seconds; handlers.get('timeupdate')?.(); },
      };
      players.push(audio); return audio;
    },
  };
  const channel = createAmbientAudio({ sources, runtime, onState: state => notices.push(state) });
  const tick = (amount) => {
    const end = clock + amount;
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
      if (!next || next[1].due > end) break;
      const [id, timer] = next; clock = timer.due; timer.due += timer.delay;
      if (timers.has(id)) timer.fn();
    }
    clock = end;
  };
  const visibility = value => { document.hidden = value; listeners.get('visibilitychange')?.(); };
  return { channel, runtime, players, timers, notices, stored, listeners, tick, visibility };
}

test('exact environmental asset manifest excludes SFX without swallowing the score', () => {
  assert.deepEqual(AMBIENT_AUDIO_FILES, [
    'ambient_rain_heavy.mp3', 'ambient_rain_in_a_bu_#4-1788638976971.mp3', 'background_sounds_ofcity.mp3',
  ]);
  // Audio now lives where it is deployed from: ambient beds under the app's
  // `ambient/` folder named by the URL they are served at, and the score under
  // `audio/` named by slug. One copy of each, in the app the site publishes.
  const ambientDir = fileURLToPath(new URL('../../worldstream/app/ambient/', import.meta.url));
  const audioDir = fileURLToPath(new URL('../../worldstream/app/audio/', import.meta.url));
  for (const asset of Object.values(AMBIENT_ASSETS)) {
    assert.match(asset.url, /^\/ambient\/[a-z-]+\.mp3$/);
    assert.ok(existsSync(join(ambientDir, asset.url.split('/').pop())),
      `${asset.url} has no file in worldstream/app/ambient/`);
    assert.equal(isAmbientAudioFile(asset.file.toUpperCase()), true);
  }
  const score = readdirSync(audioDir).filter(file => /\.mp3$/i.test(file) && !isAmbientAudioFile(file));
  assert.ok(score.includes('touchscreen-drift.mp3'));
  assert.ok(score.includes('midnight-static-loop.mp3'));
  assert.ok(score.includes('silver-clouds.mp3'));
  assert.equal(isAmbientAudioFile('some_other_rain_song.mp3'), false);
  assert.equal(isAmbientAudioFile('../ambient_rain_heavy.mp3'), false);
  assert.deepEqual(Object.keys(publicAmbientSources(['ambient_rain_heavy.mp3'])), ['rain_heavy']);
  assert.ok(Object.values(sources).every(item => !('file' in item)));
});

test('rain plan uses only supported beds; ambiguous rain recording remains out of automatic playback', () => {
  assert.equal(selectAmbientPlan(outdoorRain, sources).key, 'rain_heavy');
  assert.equal(selectAmbientPlan({ ...outdoorRain, weatherCode: 'rain' }, sources).key, 'rain_heavy');
  assert.ok(selectAmbientPlan({ ...outdoorRain, weatherCode: 'storm', rain: 1 }, sources).gain
    > selectAmbientPlan({ ...outdoorRain, weatherCode: 'light_rain', rain: 0.3 }, sources).gain);
  const inside = selectAmbientPlan({ ...outdoorRain, exposure: 'sheltered' }, sources);
  assert.equal(inside.key, 'rain_heavy');
  assert.ok(inside.gain < selectAmbientPlan(outdoorRain, sources).gain / 3);
  assert.equal(sources.rain_sheltered.automatic, false);
  assert.equal(selectAmbientPlan({ ...outdoorRain, exposure: 'sheltered' }, {
    ...sources, rain_sheltered: { ...sources.rain_sheltered, automatic: true },
  }).key, 'rain_sheltered', 'only explicit review can opt the alternate recording in');
});

test('quiet transit, sheltered clear interiors and unknown context cannot get street traffic', () => {
  for (const context of [
    { ...outdoorRain, exposure: 'transit' }, { ...outdoorRain, location: 'streamliner' },
    { ...outdoorRain, travelling: true }, { weatherCode: 'clear', exposure: 'sheltered' }, {},
  ]) assert.equal(selectAmbientPlan(context, sources).key, null);
  assert.equal(selectAmbientPlan({ weatherCode: 'fog', exposure: 'outdoor' }, sources).key, 'city');
  assert.equal(selectAmbientPlan(outdoorRain, {}).key, null);
});

test('default opt-out creates no audio elements, downloads or timers on repeated public updates', () => {
  const h = harness();
  for (let i = 0; i < 30; i++) h.channel.apply(outdoorRain);
  h.channel.setDucked(true); h.channel.resume();
  assert.equal(h.channel.state().status, 'off');
  assert.equal(h.players.length, 0); assert.equal(h.timers.size, 0);
  assert.deepEqual(outdoorRain, { weatherCode: 'heavy_rain', rain: 0.8, location: 'big_ben_plaza', exposure: 'outdoor' });
  h.channel.destroy();
});

test('explicit enable loops the rain once; repeated reads and same-bed weather shifts do not restart it', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true);
  await flush(); h.tick(1700);
  assert.equal(h.players.length, 1); assert.equal(h.players[0].loop, true);
  assert.equal(h.channel.state().status, 'playing');
  for (let i = 0; i < 20; i++) h.channel.apply(outdoorRain);
  h.channel.apply({ ...outdoorRain, weatherCode: 'light_rain', rain: 0.3 }); h.tick(1700);
  assert.equal(h.players[0].playCalls, 1);
  assert.equal(h.timers.size, 0);
  h.channel.destroy();
});

test('rain to city crossfades two players and releases the old recording', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(1700);
  const rain = h.players[0], rainStart = rain.volume;
  h.channel.apply({ ...outdoorRain, weatherCode: 'clear', rain: 0 }); await flush(); h.tick(800);
  const city = h.players[1];
  assert.equal(rain.paused, false); assert.equal(city.paused, false);
  assert.ok(rain.volume > 0 && rain.volume < rainStart); assert.ok(city.volume > 0);
  h.tick(900);
  assert.equal(rain.paused, true); assert.equal(rain.src, '');
  assert.equal(h.channel.state().playing, 'city'); assert.equal(h.timers.size, 0);
  h.channel.destroy();
});

test('outdoor scene weather stays audible without restarting its rain bed', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(1700);
  const rain = h.players[0], initialGain = rain.volume;
  h.channel.setDucked(true); h.tick(400);
  assert.ok(Math.abs(rain.volume - initialGain * 0.6) < 1e-10);
  for (let i = 0; i < 10; i++) h.channel.apply({ ...outdoorRain, source: 'scene' });
  h.channel.setDucked(false); h.tick(400);
  assert.equal(rain.playCalls, 1);
  assert.ok(Math.abs(rain.volume - initialGain) < 1e-10);
  h.channel.destroy();
});

test('rain loop overlaps for 400ms using only the existing two players', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(1700);
  const first = h.players[0], gain = first.volume;
  first.timeupdate(19.6); await flush();
  const second = h.players[1];
  assert.equal(h.players.length, 2);
  for (let i = 0; i < 10; i++) { first.timeupdate(19.65); h.channel.apply(outdoorRain); }
  h.tick(200);
  assert.ok(first.volume > 0 && second.volume > 0);
  assert.ok(Math.abs(first.volume + second.volume - gain) < 1e-10, 'overlap must not double the rain gain');
  h.tick(240);
  assert.ok(first.paused && !first.src);
  assert.equal(second.playCalls, 1); assert.equal(h.timers.size, 0);
  second.timeupdate(19.6); await flush(); h.tick(440);
  assert.equal(h.players.length, 2, 'future boundaries reuse the released player');
  assert.equal(h.players.filter(player => !player.paused).length, 1);
  h.channel.destroy();
});

test('failed rain overlap leaves native loop playing and does not retry every media update', async () => {
  let attempts = 0;
  const h = harness({ play: () => ++attempts === 1 ? Promise.resolve() : Promise.reject(new Error('Not ready')) });
  h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(1700);
  const first = h.players[0];
  first.timeupdate(19.6); await flush(); h.tick(200);
  for (let i = 0; i < 10; i++) first.timeupdate(19.8);
  assert.equal(attempts, 2); assert.equal(first.paused, false);
  assert.equal(h.channel.state().status, 'playing');
  h.channel.destroy();
});

test('rain boundary handoff is cancelled cleanly by disable, hidden, destroy or weather change', async () => {
  for (const stop of [h => h.channel.setEnabled(false), h => h.visibility(true), h => h.channel.destroy(),
    h => h.channel.apply({ ...outdoorRain, weatherCode: 'clear', rain: 0 })]) {
    const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(1700);
    h.players[0].timeupdate(19.6); await flush(); h.tick(120);
    stop(h); await flush(); h.tick(1700);
    const remaining = h.players.filter(player => !player.paused);
    assert.ok(remaining.every(player => player.src === sources.city.url));
    assert.ok(remaining.length <= 1); assert.equal(h.timers.size, 0);
    for (const player of h.players) player.timeupdate(19.8);
    assert.equal(h.players.length, 2, 'released listeners must not create new playback');
    h.channel.destroy();
  }
});

test('city ambience keeps its native loop without rain-specific boundary handoffs', async () => {
  const h = harness(); h.channel.apply({ weatherCode: 'clear', exposure: 'outdoor' });
  h.channel.setEnabled(true); await flush(); h.tick(1700); h.players[0].timeupdate(19.6); await flush();
  assert.equal(h.players.length, 1); assert.equal(h.players[0].loop, true);
  h.channel.destroy();
});

test('scene duck and volume changes remain in force through a crossfade', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(1700);
  h.channel.apply({ ...outdoorRain, weatherCode: 'clear', rain: 0 }); await flush(); h.tick(400);
  h.channel.setDucked(true); h.tick(400);
  const city = h.players.find(player => player.src === sources.city.url);
  assert.ok(Math.abs(city.volume - 0.35 * 0.24 * 0.24) < 1e-10);
  h.channel.setVolume(0.8); h.tick(400);
  assert.ok(Math.abs(city.volume - 0.8 * 0.24 * 0.24) < 1e-10);
  h.channel.setDucked(false); h.tick(400);
  assert.ok(Math.abs(city.volume - 0.8 * 0.24) < 1e-10);
  h.channel.destroy();
});

test('disable and zero volume stop media immediately, cancel fades and retain only local preferences', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(400);
  h.channel.setEnabled(false);
  assert.ok(h.players.every(player => player.paused && !player.src)); assert.equal(h.timers.size, 0);
  h.channel.setVolume(0); h.channel.setEnabled(true); await flush();
  assert.equal(h.players[0].playCalls, 1);
  assert.deepEqual(JSON.parse(h.stored.get('silver-clouds-ambient-audio')), { enabled: true, volume: 0 });
  h.channel.setVolume(0.5); await flush(); h.tick(1700);
  assert.equal(h.channel.state().status, 'playing');
  h.channel.destroy();
});

test('hidden tabs pause immediately and resume current ambience on visibility without changing preference', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(500);
  h.visibility(true);
  assert.equal(h.channel.state().status, 'paused'); assert.equal(h.timers.size, 0);
  assert.ok(h.players.every(player => player.paused && !player.src));
  h.channel.apply({ ...outdoorRain, weatherCode: 'clear', rain: 0 }); await flush();
  assert.equal(h.players[0].playCalls, 1);
  h.visibility(false); await flush(); h.tick(1700);
  assert.equal(h.channel.state().playing, 'city'); assert.equal(h.channel.state().enabled, true);
  h.channel.destroy(); assert.equal(h.listeners.size, 0);
});

test('late play fulfillment cannot restart an off, hidden or destroyed channel', async () => {
  for (const stop of [h => h.channel.setEnabled(false), h => h.visibility(true), h => h.channel.destroy()]) {
    let resolve;
    const h = harness({ play: () => new Promise(done => { resolve = done; }) });
    h.channel.apply(outdoorRain); h.channel.setEnabled(true); stop(h);
    resolve(); await flush(); h.tick(5000);
    assert.ok(h.players.every(player => player.paused && !player.src));
    assert.equal(h.timers.size, 0); assert.equal(h.channel.state().playing, null);
    h.channel.destroy();
  }
});

test('remembered enable respects blocked autoplay and retries only through an explicit resume', async () => {
  let permitted = false;
  const h = harness({ preference: { enabled: true, volume: 0.6 }, play: () => permitted ? Promise.resolve()
    : Promise.reject(Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' })) });
  assert.equal(h.players.length, 0, 'restoring preference alone does not download a sound');
  h.channel.apply(outdoorRain); await flush();
  assert.equal(h.channel.state().status, 'blocked'); assert.equal(h.timers.size, 0);
  assert.equal(h.channel.state().enabled, true); assert.equal(h.channel.state().volume, 0.6);
  for (let i = 0; i < 20; i++) h.channel.apply(outdoorRain);
  assert.equal(h.players[0].playCalls, 1, 'world polling must not hammer blocked play');
  permitted = true; h.channel.resume(); await flush(); h.tick(1700);
  assert.equal(h.channel.state().status, 'playing'); assert.equal(h.players[0].playCalls, 2);
  h.channel.destroy();
});

test('missing media stops cleanly with unavailable state and no polling retries', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(300);
  h.players[0].error();
  assert.equal(h.channel.state().status, 'unavailable'); assert.equal(h.timers.size, 0);
  assert.ok(h.players[0].paused); h.channel.apply(outdoorRain);
  assert.equal(h.players[0].playCalls, 1);
  h.channel.destroy();
});

test('rapid exposure and weather changes cannot exceed two players or leave a stale loop running', async () => {
  const h = harness(); h.channel.apply(outdoorRain); h.channel.setEnabled(true); await flush(); h.tick(1700);
  for (const weatherCode of ['clear', 'heavy_rain', 'clear', 'light_rain', 'fog', 'storm']) {
    h.channel.apply({ ...outdoorRain, weatherCode }); await flush(); h.tick(120);
  }
  h.tick(1700);
  assert.ok(h.players.length <= 2);
  assert.equal(h.players.filter(player => !player.paused).length, 1);
  h.channel.apply({ ...outdoorRain, exposure: 'transit' }); h.tick(1700);
  assert.ok(h.players.every(player => player.paused && !player.src));
  assert.equal(h.channel.state().status, 'quiet'); assert.equal(h.timers.size, 0);
  h.channel.destroy();
});

test('disabled storage and throwing UI callbacks cannot prevent audio cleanup', async () => {
  const h = harness({ privateStorage: true });
  const channel = createAmbientAudio({ sources, runtime: h.runtime, onState: () => { throw new Error('Detached UI'); } });
  channel.apply(outdoorRain); channel.setEnabled(true); await flush(); h.tick(400);
  channel.setVolume(2); assert.equal(channel.state().volume, 1);
  channel.destroy();
  assert.ok(h.players.every(player => player.paused && !player.src)); assert.equal(h.timers.size, 0);
  h.channel.destroy();
});
