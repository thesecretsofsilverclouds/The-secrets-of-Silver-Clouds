import test from 'node:test';
import assert from 'node:assert/strict';
import { passageEffectPlan, createPassageEffects } from '../../worldstream/app/reading-view.js';

const event = { id: 'rose-1', type: 'OFFSCREEN_RESULT', location: 'sanctuary',
  backgroundUrl: '/scene/world-sanctuary-day.jpg', prose: 'Rose returned to the final beat.' };
const world = { continuityId: 'shared', characters: [{ location: 'mi6' }, { location: 'mi6' }] };
test('Elsewhere needs actual offscreen work, absent leads and a local artwork URL; inputs stay immutable', () => {
  const before = JSON.stringify([event, world]);
  assert.equal(passageEffectPlan(event, world).image, event.backgroundUrl);
  assert.equal(passageEffectPlan({ ...event, type: 'CONVERSATION' }, world).image, null);
  assert.equal(passageEffectPlan(event, { characters: [{ location: 'sanctuary' }] }).image, null);
  assert.equal(passageEffectPlan(event, {}).image, null);
  assert.equal(passageEffectPlan({ ...event, backgroundUrl: 'https://elsewhere.test/x.jpg' }, world).image, null);
  assert.equal(passageEffectPlan({ ...event, backgroundUrl: '/scene/x.jpg");bad' }, world).image, null);
  assert.equal(JSON.stringify([event, world]), before);
});
function fixture(storage = new Map()) {
  const classes = () => { const values = new Set(); return { contains: key => values.has(key),
    add: (...keys) => keys.forEach(key => values.add(key)), remove: (...keys) => keys.forEach(key => values.delete(key)),
    toggle: (key, yes) => yes ? values.add(key) : values.delete(key) }; };
  const label = { textContent: '' }, card = { hidden: false, classList: classes(),
    querySelector: () => label, style: { setProperty() {} } };
  const listeners = new Map(), timers = new Map(); let intersection, mutation, nextTimer = 0;
  const motion = { matches: false, addEventListener: (_name, fn) => { motion.changed = fn; }, removeEventListener() {} };
  const document = { hidden: false, body: { dataset: { reading: 'true' }, classList: classes() },
    querySelector: () => card, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const runtime = { window: { sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, matchMedia: () => motion },
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() {} },
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id) };
  return { effects: createPassageEffects({ document, runtime }), card, label, document, motion, timers,
    show: (yes = true) => intersection([{ target: card, isIntersecting: yes, intersectionRatio: yes ? .6 : 0, intersectionRect: { height: yes ? 300 : 0 } }]),
    mutation: () => mutation(), visibility: () => listeners.get('visibilitychange')() };
}
test('a visible passage dissolves once, returns to normal and never retriggers on polling or reload', () => {
  const storage = new Map(), f = fixture(storage);
  f.effects.update(event, world); assert.equal(f.timers.size, 0); f.show();
  assert.ok(f.card.classList.contains('passage-elsewhere')); assert.ok(f.card.classList.contains('passage-spotlight'));
  f.effects.update(event, world); assert.equal(f.timers.size, 1);
  [...f.timers.values()][0](); assert.ok(!f.card.classList.contains('passage-elsewhere'));
  f.show(false); f.show(); assert.equal(f.timers.size, 0);
  const reloaded = fixture(storage); reloaded.effects.update(event, world); reloaded.show(); assert.equal(reloaded.timers.size, 0);
  assert.match(reloaded.label.textContent, /Elsewhere/);
});
test('hidden tabs, reading opt-out, cinematic playback and reduced motion cancel without retriggering', () => {
  for (const blocker of ['hidden', 'reading', 'scene', 'still', 'reduced']) {
    const f = fixture(); f.effects.update(event, world); f.show();
    if (blocker === 'hidden') { f.document.hidden = true; f.visibility(); }
    if (blocker === 'reading') { f.document.body.dataset.reading = 'false'; f.mutation(); }
    if (blocker === 'scene' || blocker === 'still') { f.document.body.classList.add(blocker === 'scene' ? 'scene-open' : 'atmosphere-still'); f.mutation(); }
    if (blocker === 'reduced') { f.motion.matches = true; f.motion.changed(); }
    assert.equal(f.timers.size, 0, blocker); assert.ok(!f.card.classList.contains('passage-spotlight'), blocker);
    f.effects.destroy();
  }
});
test('a new event gets its own hold and a stale timeout is cleared on replacement', () => {
  const f = fixture(); f.effects.update(event, world); f.show();
  const old = [...f.timers.keys()][0]; f.effects.update({ ...event, id: 'rose-2' }, world);
  assert.ok(!f.timers.has(old)); assert.equal(f.timers.size, 1); f.effects.destroy(); assert.equal(f.timers.size, 0);
});
