import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ScoreRotation } from '../../worldstream/app/score-rotation.js';

const source = readFileSync(new URL('../../worldstream/app/app.js', import.meta.url), 'utf8');
const start = source.indexOf('const music = (() => {');
const end = source.indexOf('const socialCache = new Map();', start);
assert.ok(start >= 0 && end > start, 'the score controller could not be located');
const scoreSource = source.slice(start, end);
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(name, callback, options) {
      const handlers = listeners.get(name) ?? [];
      handlers.push({ callback, once: options?.once });
      listeners.set(name, handlers);
    },
    removeEventListener(name, callback) {
      listeners.set(name, (listeners.get(name) ?? []).filter(item => item.callback !== callback));
    },
    dispatch(name) {
      for (const { callback, once } of [...(listeners.get(name) ?? [])]) {
        if (once) this.removeEventListener(name, callback);
        callback({ type: name, target: this });
      }
    },
  };
}

function harness({ preference, privateStorage = false, blocked = false, hidden = false,
  sharedStorage = new Map(), initialWorld = null } = {}) {
  let clock = 0, nextTimer = 0, autoplayBlocked = blocked;
  const timers = new Map(), writes = [], stored = sharedStorage;
  if (preference !== undefined) stored.set('silver-clouds-score', preference);
  const button = {
    ...eventTarget(), attributes: {}, classList: { toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const players = [0, 1].map(index => {
    let src = '';
    return {
      ...eventTarget(), volume: 0, paused: true, currentTime: 0, duration: 180, ended: false, playCalls: 0,
      get src() { return src; },
      set src(value) { src = value; this.currentTime = 0; this.ended = false; writes.push({ index, src: value }); },
      play() {
        this.playCalls += 1;
        if (autoplayBlocked) {
          this.paused = true;
          return Promise.reject(Object.assign(new Error('User gesture required'), { name: 'NotAllowedError' }));
        }
        this.paused = false;
        return Promise.resolve();
      },
      pause() { this.paused = true; },
      removeAttribute(name) { if (name === 'src') src = ''; },
      load() {},
    };
  });
  const document = {
    ...eventTarget(), hidden,
    querySelector(selector) {
      return ({ '#music-btn': button, '#score-a': players[0], '#score-b': players[1] })[selector] ?? null;
    },
  };
  const context = {
    document, lastWorld: initialWorld, sceneAtmosphere: null, ScoreRotation,
    scoreMood: world => world?.mood ?? 'ordinary',
    atmosphere: { scoreVolume: () => 0.34 },
    localStorage: {
      getItem(key) { if (privateStorage) throw new Error('Storage unavailable'); return stored.get(key) ?? null; },
      setItem(key, value) { if (privateStorage) throw new Error('Storage unavailable'); stored.set(key, value); },
    },
    fetch: async () => ({ ok: true, json: async () => ({ tracks: [] }) }),
    performance: { now: () => clock },
    setInterval(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearInterval(id) { timers.delete(id); },
    setTimeout: () => ++nextTimer, clearTimeout() {},
  };
  const music = runInNewContext(`${scoreSource}\nmusic`, context);
  return {
    music, document, players, button, stored, writes,
    allowPlayback() { autoplayBlocked = false; },
    renderMood(mood) { context.lastWorld = { mood }; music.update(context.lastWorld); },
    endTrack() {
      const player = players[music.state().element];
      player.currentTime = player.duration;
      player.paused = true;
      player.ended = true;
      player.dispatch('ended');
    },
    finishFade() { clock += 2300; for (const callback of [...timers.values()]) callback(); },
    playCalls() { return players.reduce((sum, player) => sum + player.playCalls, 0); },
  };
}

test('a new reader gets the score without pressing its toggle', async () => {
  const h = harness();
  await flush();
  h.finishFade();
  assert.equal(h.music.state().on, true);
  assert.equal(h.button.attributes['aria-pressed'], 'true');
  assert.equal(h.playCalls(), 1);
  const active = h.players[h.music.state().element];
  assert.equal(active.paused, false);
  assert.ok(active.volume > 0);
});

test('unavailable preference storage still defaults to music on', async () => {
  const h = harness({ privateStorage: true });
  await flush();
  assert.equal(h.music.state().on, true);
  assert.equal(h.playCalls(), 1);
});

for (const gesture of ['pointerdown', 'click', 'keydown']) {
  test(`blocked autoplay retries the same selected track on ${gesture}`, async () => {
    const h = harness({ preference: 'on', blocked: true });
    h.music.update({});
    await flush();
    h.finishFade();
    const before = h.music.state(), player = h.players[before.element], src = player.src;
    assert.equal(player.playCalls, 1);
    assert.equal(player.paused, true);
    h.allowPlayback();
    h.document.dispatch(gesture);
    await flush();
    h.finishFade();
    assert.equal(h.music.state().playing, before.playing);
    assert.equal(h.music.state().element, before.element);
    assert.equal(player.src, src);
    assert.equal(h.writes.length, 1, 'unlocking must not rotate or reload the track');
    assert.equal(player.playCalls, 2);
    assert.equal(player.paused, false);
    assert.ok(player.volume > 0);
    h.document.dispatch('pointerdown');
    h.document.dispatch('keydown');
    await flush();
    assert.equal(player.playCalls, 2, 'later interactions must not restart an audible score');
  });
}

test('an explicitly stored off preference remains silent across gestures', async () => {
  const h = harness({ preference: 'off' });
  h.music.update({});
  h.document.dispatch('pointerdown');
  h.document.dispatch('keydown');
  await flush();
  assert.equal(h.music.state().on, false);
  assert.equal(h.button.attributes['aria-pressed'], 'false');
  assert.equal(h.playCalls(), 0);
});

test('turning the score off cancels blocked playback and prevents gesture resume', async () => {
  const h = harness({ blocked: true });
  h.music.update({});
  await flush();
  assert.equal(h.playCalls(), 1);
  h.button.dispatch('click');
  h.allowPlayback();
  h.document.dispatch('pointerdown');
  h.document.dispatch('keydown');
  h.music.update({});
  await flush();
  assert.equal(h.stored.get('silver-clouds-score'), 'off');
  assert.equal(h.music.state().on, false);
  assert.equal(h.music.state().playing, null);
  assert.equal(h.playCalls(), 1);
  assert.ok(h.players.every(player => player.paused && player.src === ''));
});

test('a hidden page stays silent until it becomes visible', async () => {
  const h = harness({ hidden: true });
  h.music.update({});
  h.document.dispatch('pointerdown');
  h.document.dispatch('keydown');
  await flush();
  assert.equal(h.playCalls(), 0);
  h.document.hidden = false;
  h.document.dispatch('visibilitychange');
  await flush();
  assert.equal(h.playCalls(), 1);
});

test('long ordinary listening covers every track before repeating', async () => {
  const h = harness();
  await flush();
  h.finishFade();
  const expected = ['legends-of-dawn', 'oracle', 'magic', 'silver-clouds'].sort();
  const heard = [h.music.state().playing];
  for (let i = 0; i < 12; i++) {
    h.endTrack();
    await flush();
    h.finishFade();
    heard.push(h.music.state().playing);
  }
  for (let start = 0; start < 12; start += 4) {
    assert.deepEqual(heard.slice(start, start + 4).sort(), expected);
  }
  for (let i = 1; i < heard.length; i++) assert.notEqual(heard[i], heard[i - 1]);
});

test('reloads continue the saved rotation instead of replaying an opening song', async () => {
  const sharedStorage = new Map();
  const heard = [];
  for (let i = 0; i < 8; i++) {
    const h = harness({ sharedStorage });
    await flush();
    h.finishFade();
    heard.push(h.music.state().playing);
  }
  assert.equal(new Set(heard.slice(0, 4)).size, 4);
  assert.equal(new Set(heard.slice(4, 8)).size, 4);
  for (let i = 1; i < heard.length; i++) assert.notEqual(heard[i], heard[i - 1]);
});

test('reopening uses the last accepted mood while the first world projection loads', async () => {
  const sharedStorage = new Map();
  const first = harness({ sharedStorage });
  await flush();
  first.renderMood('pressure');
  await flush();
  first.finishFade();
  const previous = first.music.state().playing;
  const reopened = harness({ sharedStorage });
  await flush();
  assert.equal(reopened.music.state().mood, 'pressure');
  assert.notEqual(reopened.music.state().playing, previous);
  assert.equal(reopened.writes.length, 1, 'reopening must not preplay ordinary music');
});

test('blocked autoplay does not consume the bag and one successful retry commits once', async () => {
  const h = harness({ blocked: true });
  await flush();
  h.finishFade();
  const key = 'silver-clouds-score-rotation';
  assert.equal(h.stored.has(key), false, 'unheard playback must not be remembered as heard');
  const selected = h.music.state().playing;
  h.document.dispatch('pointerdown');
  await flush();
  assert.equal(h.stored.has(key), false);
  h.allowPlayback();
  h.document.dispatch('click');
  await flush();
  const saved = h.stored.get(key);
  assert.ok(saved, 'successful playback must survive reload');
  assert.equal(h.music.state().playing, selected);
  assert.equal(h.writes.length, 1);
  h.document.dispatch('keydown');
  h.music.update({});
  await flush();
  assert.equal(h.stored.get(key), saved, 'later gestures must not consume the choice twice');
});

test('returning to a visible tab resumes its position without selecting another track', async () => {
  const h = harness();
  await flush();
  h.finishFade();
  const before = h.music.state(), active = h.players[before.element];
  active.currentTime = 47;
  const src = active.src, saved = h.stored.get('silver-clouds-score-rotation');
  h.document.hidden = true;
  h.document.dispatch('visibilitychange');
  assert.ok(h.players.every(player => player.paused));
  assert.equal(active.src, src);
  assert.equal(active.currentTime, 47);
  h.document.hidden = false;
  h.document.dispatch('visibilitychange');
  await flush();
  h.finishFade();
  assert.equal(h.music.state().playing, before.playing);
  assert.equal(active.src, src);
  assert.equal(active.currentTime, 47);
  assert.equal(active.paused, false);
  assert.equal(h.writes.length, 1);
  assert.equal(h.stored.get('silver-clouds-score-rotation'), saved);
});

test('repeated world projections do not advance or reload the score', async () => {
  const h = harness();
  await flush();
  const selected = h.music.state().playing;
  const saved = h.stored.get('silver-clouds-score-rotation');
  for (let i = 0; i < 100; i++) h.renderMood('ordinary');
  await flush();
  assert.equal(h.music.state().playing, selected);
  assert.equal(h.writes.length, 1);
  assert.equal(h.stored.get('silver-clouds-score-rotation'), saved);
});

test('returning follows a real mood change received while the tab was hidden', async () => {
  const h = harness();
  await flush();
  h.finishFade();
  const before = h.music.state().playing;
  h.document.hidden = true;
  h.document.dispatch('visibilitychange');
  h.renderMood('pressure');
  assert.equal(h.writes.length, 1, 'hidden world updates must not start audio');
  h.document.hidden = false;
  h.document.dispatch('visibilitychange');
  await flush();
  h.finishFade();
  assert.equal(h.music.state().mood, 'pressure');
  assert.notEqual(h.music.state().playing, before);
  assert.equal(h.writes.length, 2);
  assert.ok(h.players.filter(player => !player.paused).length === 1);
});

test('a track ending as the tab hides advances once when visible again', async () => {
  const h = harness();
  await flush();
  h.finishFade();
  const before = h.music.state().playing;
  h.document.hidden = true;
  h.document.dispatch('visibilitychange');
  h.endTrack();
  assert.equal(h.writes.length, 1);
  h.document.hidden = false;
  h.document.dispatch('visibilitychange');
  await flush();
  h.finishFade();
  assert.notEqual(h.music.state().playing, before);
  assert.equal(h.writes.length, 2);
  assert.ok(h.players[h.music.state().element].currentTime === 0);
});
