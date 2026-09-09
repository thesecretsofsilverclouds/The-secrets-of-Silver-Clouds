import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreRotation } from '../../worldstream/app/score-rotation.js';

const KEY = 'silver-clouds-score-rotation';
const ordinary = ['legends-of-dawn', 'oracle', 'magic', 'silver-clouds'];
const pressure = ['glitch-pocket-riot', 'tiny-rebel', 'mowtown-towers', 'mowtown-towers3'];
const family = slug => slug.replace(/\d+$/, '');

function memory(initial = new Map()) {
  return {
    values: initial,
    getItem(key) { return initial.get(key) ?? null; },
    setItem(key, value) { initial.set(key, value); },
  };
}

function seeded(seed = 42) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function take(rotation, mood, bank) {
  const slug = rotation.next(mood, bank);
  rotation.played(mood, slug, bank);
  return slug;
}

test('selection is provisional until audio successfully plays', () => {
  const storage = memory();
  const rotation = new ScoreRotation({ storage, random: seeded() });
  const selected = rotation.next('ordinary', ordinary);
  assert.ok(ordinary.includes(selected));
  assert.equal(storage.getItem(KEY), null);
  assert.equal(rotation.lastMood(), null);
  assert.equal(rotation.next('ordinary', ordinary), selected);
  rotation.played('ordinary', selected, ordinary);
  assert.ok(storage.getItem(KEY));
  assert.equal(rotation.lastMood(), 'ordinary');
  assert.notEqual(rotation.next('ordinary', ordinary), selected);
});

test('complete ordinary cycles visit the whole pool and avoid boundary repeats', () => {
  const rotation = new ScoreRotation({ random: seeded() });
  const heard = Array.from({ length: 80 }, () => take(rotation, 'ordinary', ordinary));
  for (let offset = 0; offset < heard.length; offset += ordinary.length) {
    assert.deepEqual(heard.slice(offset, offset + ordinary.length).sort(), [...ordinary].sort());
  }
  for (let i = 1; i < heard.length; i++) assert.notEqual(heard[i], heard[i - 1]);
});

test('bag progress and recent choices survive every page reload', () => {
  const storage = memory(), heard = [];
  for (let i = 0; i < 24; i++) {
    const rotation = new ScoreRotation({ storage, random: seeded(i + 1) });
    heard.push(take(rotation, 'ordinary', ordinary));
  }
  for (let offset = 0; offset < heard.length; offset += ordinary.length) {
    assert.deepEqual(heard.slice(offset, offset + ordinary.length).sort(), [...ordinary].sort());
  }
  for (let i = 1; i < heard.length; i++) assert.notEqual(heard[i], heard[i - 1]);
});

test('shared fallback tracks cannot immediately repeat at a mood change', () => {
  const rotation = new ScoreRotation({ random: seeded() });
  const banks = {
    ordinary: ['shared', 'ordinary-a', 'ordinary-b', 'ordinary-c'],
    night: ['shared', 'night-a', 'night-b', 'night-c'],
  };
  let previous = null;
  for (let i = 0; i < 64; i++) {
    const mood = i % 2 ? 'night' : 'ordinary';
    const slug = take(rotation, mood, banks[mood]);
    assert.ok(banks[mood].includes(slug));
    assert.notEqual(slug, previous);
    previous = slug;
  }
});

test('hearing another mood invalidates an older provisional choice that would now repeat', () => {
  const rotation = new ScoreRotation({ random: () => 0 });
  const firstBank = ['shared', 'ordinary-a', 'ordinary-b', 'ordinary-c'];
  const nextBank = ['shared', 'night-a', 'night-b', 'night-c'];
  assert.equal(rotation.next('night', nextBank), 'shared');
  assert.equal(take(rotation, 'ordinary', firstBank), 'shared');
  assert.notEqual(rotation.next('night', nextBank), 'shared',
    'an abandoned blocked choice must be reconsidered after other music plays');
});

test('Mowtown variants are separated when the mood has alternatives', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const rotation = new ScoreRotation({ random: seeded(seed) });
    const heard = Array.from({ length: 80 }, () => take(rotation, 'pressure', pressure));
    assert.deepEqual([...new Set(heard)].sort(), [...pressure].sort());
    for (let i = 1; i < heard.length; i++) {
      assert.notEqual(family(heard[i]), family(heard[i - 1]),
        `seed ${seed} put ${heard[i - 1]} beside ${heard[i]}`);
    }
  }
});

test('catalogue changes remove absent tracks and admit new ones into rotation', () => {
  const storage = memory();
  const first = new ScoreRotation({ storage, random: seeded() });
  take(first, 'ordinary', ordinary);
  const updated = ['oracle', 'magic', 'new-score-a', 'new-score-b'];
  const reopened = new ScoreRotation({ storage, random: seeded(3) });
  const heard = Array.from({ length: 12 }, () => take(reopened, 'ordinary', updated));
  assert.ok(heard.every(slug => updated.includes(slug)), 'removed audio remained eligible');
  assert.deepEqual([...new Set(heard)].sort(), [...updated].sort());
});

test('invalid or unavailable storage does not prevent a valid selection', () => {
  for (const value of ['{invalid', 'null', '[]', '{"lastMood":"invented"}', '{"version":999,"moods":{}}']) {
    const rotation = new ScoreRotation({ storage: memory(new Map([[KEY, value]])), random: seeded() });
    assert.equal(rotation.lastMood(), null);
    assert.ok(ordinary.includes(take(rotation, 'ordinary', ordinary)));
  }
  const throwingStorage = { getItem() { throw new Error('private'); }, setItem() { throw new Error('private'); } };
  const rotation = new ScoreRotation({ storage: throwingStorage, random: seeded() });
  assert.ok(ordinary.includes(take(rotation, 'ordinary', ordinary)));
});

test('empty and single-track catalogues are handled without inventing audio', () => {
  const rotation = new ScoreRotation({ random: seeded() });
  assert.equal(rotation.next('night', []), null);
  assert.equal(take(rotation, 'night', ['only-track']), 'only-track');
  assert.equal(take(rotation, 'night', ['only-track']), 'only-track');
});
