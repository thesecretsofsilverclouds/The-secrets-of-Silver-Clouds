import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lineReadingHoldMs, linePlaybackMs, autoSceneExcerpt, cinematicLines,
  AUTO_SCENE_MAX_MS, SCENE_CLOSE_MS, PausableSceneTimer, SceneCloseLifecycle,
  SceneReadingPreferences, CinematicInbox,
} from '../../worldstream/app/cinematic-player.js';

function clock() {
  let time = 0, sequence = 0;
  const timers = new Map(), scheduled = [];
  const runtime = {
    now: () => time,
    setTimeout(fn, delay) {
      const id = ++sequence;
      timers.set(id, { at: time + delay, fn }); scheduled.push(fn); return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  return { runtime, timers, scheduled, now: () => time,
    tick(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        const [id, value] = next; time = value.at; timers.delete(id); value.fn();
      }
      time = end;
    },
  };
}

test('final lines linger and longer prose gets a full reading allowance in either text mode', () => {
  const short = { text: 'London was still there.' };
  const long = { kind: 'narration', text: Array(75).fill('word').join(' ') };
  assert.ok(lineReadingHoldMs(short, { final: true }) >= 4_500);
  assert.ok(lineReadingHoldMs(short, { final: true, instantText: true }) >= 4_500);
  assert.ok(lineReadingHoldMs(long, { final: true, instantText: true }) > 20_000);
  assert.ok(lineReadingHoldMs(long, { final: true }) > lineReadingHoldMs(short, { final: true }));
  assert.ok(lineReadingHoldMs(short, { final: true }) > lineReadingHoldMs(short));
  assert.ok(linePlaybackMs(short) > linePlaybackMs(short, { instantText: true }));
  assert.equal(linePlaybackMs({ ...short, instant: true }), linePlaybackMs(short, { instantText: true }));
});

test('live excerpt reserves final reading and dissolve within sixty seconds without rewriting accepted prose', () => {
  const source = [
    { kind: 'narration', text: 'The city waited under the rain.' },
    ...Array.from({ length: 15 }, (_, index) => ({ who: index % 2 ? 'ashai' : 'goaden',
      text: `${index}. A whole accepted line has time to settle before the next one appears.` })),
    { kind: 'narration', text: 'For a moment, neither of them hurried away.' },
  ];
  const before = structuredClone(source), excerpt = autoSceneExcerpt(source);
  assert.equal(excerpt.excerpted, true); assert.ok(excerpt.lines.length > 2);
  assert.equal(excerpt.lines[0].text, source[0].text);
  assert.equal(excerpt.lines.at(-1).text, source.at(-1).text);
  assert.ok(excerpt.durationMs <= AUTO_SCENE_MAX_MS);
  for (const instantText of [true, false]) {
    const visibleMs = excerpt.lines.reduce((total, line, index) => total + linePlaybackMs(line, {
      instantText, final: index === excerpt.lines.length - 1,
    }), SCENE_CLOSE_MS);
    assert.ok(visibleMs <= excerpt.durationMs);
  }
  assert.ok(excerpt.lines.every(line => source.some(original => original.text === line.text)));
  assert.deepEqual(source, before);
});

test('an oversized complete opening stays manual instead of flashing or being cut to meet the auto cap', () => {
  const opening = { kind: 'narration', text: Array(400).fill('unhurried').join(' ') };
  const result = autoSceneExcerpt([opening, { kind: 'narration', text: 'The final sentence.' }]);
  assert.deepEqual(result, { lines: [], durationMs: 0, excerpted: true });
  assert.deepEqual(autoSceneExcerpt([{ who: 'goaden', text: opening.text },
    { kind: 'narration', text: 'The final sentence.' }]), result);
  const accepted = { scene: { openingNarration: opening.text, closingNarration: 'The final sentence.',
    beats: [{ speaker: 'goaden', line: 'Still available to read in full.' }] } };
  assert.equal(cinematicLines(accepted)[0].text, opening.text);
  assert.equal(cinematicLines(accepted).length, 3);
});

test('reading holds count visible time and preserve their remainder across a long hidden tab', () => {
  const c = clock(), timer = new PausableSceneTimer(c.runtime);
  let advances = 0;
  timer.set(() => advances++, 5_000); c.tick(1_500); timer.pause();
  assert.equal(timer.remainingMs(), 3_500); assert.equal(c.timers.size, 0);
  c.tick(3_600_000); assert.equal(advances, 0);
  timer.resume(); c.tick(3_499); assert.equal(advances, 0);
  c.tick(1); assert.equal(advances, 1); assert.equal(c.timers.size, 0);
});

test('default browser timers keep their native global receiver during finish, pause and skip', () => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const queued = new Map(); let next = 0, starts = 0, cancels = 0, closes = 0;
  // Node tolerates a borrowed timer function; browsers need a Window receiver.
  // Model that stricter native contract instead of hiding it with arrow mocks.
  globalThis.setTimeout = function (callback) {
    assert.equal(this, globalThis, 'native setTimeout must not receive PausableSceneTimer as this');
    starts += 1; const id = ++next; queued.set(id, callback); return id;
  };
  globalThis.clearTimeout = function (id) {
    assert.equal(this, globalThis, 'native clearTimeout must keep its global receiver');
    cancels += 1; queued.delete(id);
  };
  try {
    const lifecycle = new SceneCloseLifecycle({ onFinish: () => closes++ });
    lifecycle.begin(); lifecycle.pause(); lifecycle.resume();
    assert.equal(starts, 2); assert.equal(cancels, 1);
    const [id, callback] = queued.entries().next().value; queued.delete(id); callback();
    assert.equal(closes, 1); assert.equal(lifecycle.phase, 'closed');
    lifecycle.reset(); lifecycle.begin(); lifecycle.begin({ immediate: true });
    assert.equal(closes, 2); assert.equal(queued.size, 0); assert.equal(cancels, 2);
  } finally {
    globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear;
  }
});

test('clearing or replacing a timer makes stale callbacks harmless', () => {
  const c = clock(), timer = new PausableSceneTimer(c.runtime), calls = [];
  timer.set(() => calls.push('old'), 1_000); const old = c.scheduled.at(-1);
  timer.set(() => calls.push('replacement'), 2_000); old(); c.tick(1_999);
  assert.deepEqual(calls, []); c.tick(1); assert.deepEqual(calls, ['replacement']);
  timer.set(() => calls.push('closed scene'), 500); const closed = c.scheduled.at(-1);
  timer.clear(); closed(); c.tick(500);
  assert.deepEqual(calls, ['replacement']); assert.equal(c.timers.size, 0);
});

test('natural close keeps its scene alive for the whole gentle dissolve and finishes once', () => {
  const c = clock(), calls = [];
  const lifecycle = new SceneCloseLifecycle({ runtime: c.runtime,
    onStart: () => calls.push('dissolve'), onFinish: () => calls.push('hide and restore focus') });
  assert.ok(SCENE_CLOSE_MS >= 1_200 && SCENE_CLOSE_MS <= 2_000);
  lifecycle.begin(); lifecycle.begin();
  assert.equal(lifecycle.phase, 'closing'); assert.deepEqual(calls, ['dissolve']);
  c.tick(SCENE_CLOSE_MS - 1); assert.deepEqual(calls, ['dissolve']);
  c.tick(1); assert.deepEqual(calls, ['dissolve', 'hide and restore focus']);
  lifecycle.finish(); c.tick(10_000); assert.equal(calls.length, 2); assert.equal(c.timers.size, 0);
});

test('Skip or Escape immediately dismiss during a dissolve without a delayed second close', () => {
  const c = clock(); let closes = 0;
  const lifecycle = new SceneCloseLifecycle({ runtime: c.runtime, onFinish: () => closes++ });
  lifecycle.begin(); const lateFade = c.scheduled.at(-1); c.tick(400);
  lifecycle.begin({ immediate: true });
  assert.equal(closes, 1); assert.equal(lifecycle.phase, 'closed'); assert.equal(c.timers.size, 0);
  lateFade(); c.tick(5_000); assert.equal(closes, 1);
});

test('reduced motion bypasses the dissolve, including a preference change during it', () => {
  for (const midway of [false, true]) {
    const c = clock(); let closes = 0, starts = 0;
    const lifecycle = new SceneCloseLifecycle({ runtime: c.runtime,
      onStart: () => starts++, onFinish: () => closes++ });
    if (midway) { lifecycle.begin(); c.tick(200); }
    lifecycle.begin({ reducedMotion: true });
    assert.equal(closes, 1); assert.equal(c.timers.size, 0); assert.equal(starts, midway ? 1 : 0);
  }
});

test('hidden dissolve pauses its remaining budget and reset cannot close a replacement scene', () => {
  const c = clock(); let closes = 0;
  const lifecycle = new SceneCloseLifecycle({ runtime: c.runtime, onFinish: () => closes++ });
  lifecycle.begin(); c.tick(600); lifecycle.pause(); c.tick(3_600_000);
  assert.equal(closes, 0); assert.equal(c.timers.size, 0);
  lifecycle.resume(); c.tick(SCENE_CLOSE_MS - 601); assert.equal(closes, 0);
  c.tick(1); assert.equal(closes, 1);
  lifecycle.reset(); lifecycle.begin(); const old = c.scheduled.at(-1);
  lifecycle.reset(); old(); c.tick(10_000);
  assert.equal(closes, 1); assert.equal(lifecycle.phase, 'idle'); assert.equal(c.timers.size, 0);
});

test('automatic visible budget includes the dissolve while hidden time consumes neither stage', () => {
  const c = clock(); let closes = 0;
  const lifecycle = new SceneCloseLifecycle({ runtime: c.runtime, onFinish: () => closes++ });
  const budget = new PausableSceneTimer(c.runtime);
  budget.set(() => lifecycle.begin(), AUTO_SCENE_MAX_MS - SCENE_CLOSE_MS);
  c.tick(50_000); budget.pause(); c.tick(3_600_000); budget.resume();
  c.tick(AUTO_SCENE_MAX_MS - SCENE_CLOSE_MS - 50_000); assert.equal(lifecycle.phase, 'closing');
  c.tick(500); lifecycle.pause(); c.tick(3_600_000); lifecycle.resume();
  c.tick(SCENE_CLOSE_MS - 501); assert.equal(closes, 0);
  c.tick(1); assert.equal(closes, 1);
  assert.equal(c.now() - 7_200_000, AUTO_SCENE_MAX_MS); assert.equal(c.timers.size, 0);
});

test('automatic-scene and instant-text preferences are separate, local and remembered', () => {
  const values = new Map([['silver-clouds-score', 'on']]);
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const prefs = new SceneReadingPreferences(storage);
  assert.deepEqual(prefs.get(), { autoScenes: true, instantText: false });
  prefs.set({ autoScenes: false }); assert.equal(prefs.get().instantText, false);
  prefs.set({ instantText: true, worldId: 'must not store', weather: 'storm' });
  assert.deepEqual(new SceneReadingPreferences(storage).get(), { autoScenes: false, instantText: true });
  assert.equal(values.get('silver-clouds-score'), 'on'); assert.equal(values.size, 2);
  assert.deepEqual(JSON.parse(values.get('silver-clouds-scene-reading')), { autoScenes: false, instantText: true });
  prefs.set({ autoScenes: 'false', instantText: null });
  assert.deepEqual(prefs.get(), { autoScenes: false, instantText: true });
  const broken = new SceneReadingPreferences({ getItem() { throw Error('Unavailable'); }, setItem() { throw Error('Unavailable'); } });
  assert.deepEqual(broken.set({ instantText: true }), { autoScenes: true, instantText: true });
});

test('opt-out acknowledges shared IDs and discards pending scenes, so re-enable only plays new arrivals', () => {
  const inbox = new CinematicInbox();
  inbox.enqueue({ eventId: 'previously-pending' }); assert.equal(inbox.discard(), 1);
  inbox.enqueue({ eventId: 'arrived-while-off' }, { queue: false });
  assert.equal(inbox.size, 0); assert.equal(inbox.take(), null);
  assert.equal(inbox.enqueue({ eventId: 'previously-pending' }), false);
  assert.equal(inbox.enqueue({ eventId: 'arrived-while-off' }), false);
  assert.equal(inbox.enqueue({ eventId: 'fresh-after-enable' }), true);
  assert.equal(inbox.take().eventId, 'fresh-after-enable'); assert.equal(inbox.take(), null);
});

test('a rapid off/on cycle invalidates an in-flight queue policy even though final enabled value matches', () => {
  const prefs = new SceneReadingPreferences(), captured = prefs.autoVersion();
  prefs.set({ instantText: true }); assert.equal(prefs.autoVersion(), captured);
  prefs.set({ autoScenes: false }); prefs.set({ autoScenes: true });
  assert.equal(prefs.get().autoScenes, true); assert.notEqual(prefs.autoVersion(), captured);
  const stable = prefs.autoVersion(); prefs.set({ autoScenes: true }); assert.equal(prefs.autoVersion(), stable);
});
