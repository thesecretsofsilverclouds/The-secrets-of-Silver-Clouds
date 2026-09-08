import test from 'node:test';
import assert from 'node:assert/strict';
import { INK_BOOKING_SCENE, VENUE_SCENES, selectVenueScene } from '../src/venues.mjs';
import { assertNoSpoiler } from '../src/spoilers.mjs';

const select = (inkContext, available = ['goaden', 'ashai', 'emily'], key = 'ink') =>
  selectVenueScene({ venue: 'enchanted_ink', available, seed: 'phase1-scene-tests', key, inkContext });

test('Ink booking is an explicit lifecycle performance, never a random venue scene', () => {
  const ids = VENUE_SCENES.enchanted_ink.map(scene => scene.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => typeof id === 'string' && id.startsWith('ink_')));
  assert.equal(ids.includes(INK_BOOKING_SCENE.id), false);
  for (let i = 0; i < 128; i++) {
    const scene = select({ completed: true, knownBy: ['goaden', 'ashai'] }, ['goaden', 'ashai'], `visit-${i}`);
    assert.notEqual(scene.id, INK_BOOKING_SCENE.id);
  }
  assert.match(INK_BOOKING_SCENE.summary, /booked a released hour/);
  assert.doesNotMatch(INK_BOOKING_SCENE.summary, /completed|received|bought|finished/i);
  assert.ok(INK_BOOKING_SCENE.lines.some(line => line.who === 'ashai' && /Looking\./.test(line.text)));
});

test('Emily can refer to the prowler only after real completion and both protagonists know', () => {
  for (const context of [undefined, {}, { completed: false, knownBy: ['goaden', 'ashai'] },
    { completed: true, knownBy: [] }, { completed: true, knownBy: ['goaden'] },
    { completed: true, knownBy: ['ashai'] }]) {
    for (let i = 0; i < 24; i++) {
      assert.notEqual(select(context, undefined, `visit-${i}`).id, 'ink_emily_prowler');
    }
  }
  const context = { completed: true, knownBy: ['goaden', 'ashai'] };
  assert.equal(select(context).id, 'ink_emily_prowler');
  assert.deepEqual(select(context), select(context), 'knowledge gates preserve seeded selection');
});

test('the pair can remember a completed prowler without replaying its acquisition', () => {
  const valid = { completed: true, knownBy: ['goaden', 'ashai'] };
  const before = new Set();
  const after = new Set();
  for (let i = 0; i < 128; i++) {
    before.add(select({}, ['goaden', 'ashai'], `visit-${i}`).id);
    after.add(select(valid, ['goaden', 'ashai'], `visit-${i}`).id);
  }
  assert.equal(before.has('ink_prowler_remembered'), false);
  assert.equal(after.has('ink_prowler_remembered'), true);
});

test('venue fallback never invents an absent speaker', () => {
  for (const venue of Object.keys(VENUE_SCENES)) {
    for (const available of [[], ['goaden'], ['ashai'], ['emily'], ['goaden', 'emily']]) {
      assert.equal(selectVenueScene({ venue, available, seed: 'phase1-scene-tests' }), null,
        `${venue} filled in somebody missing from ${available}`);
    }
  }
  const context = { completed: true, knownBy: ['goaden', 'ashai'] };
  assert.equal(select(context, ['goaden', 'emily']), null, 'knowledge does not create physical presence');
});

test('Ink repertoire does not assert unrecorded acquisition or invent maintenance laws', () => {
  for (const scene of [...VENUE_SCENES.enchanted_ink, INK_BOOKING_SCENE]) {
    const text = [scene.summary, ...scene.lines.map(line => line.text)].join('\n');
    assertNoSpoiler(text, scene.id);
    assert.doesNotMatch(text, /bought a tattoo|paying right now|I am getting a lintel|topped up|every few months|tattoos get tired|wander off the shoulder|last spring|last week|four years/i);
  }
  const beforeCompletion = VENUE_SCENES.enchanted_ink.filter(scene => !scene.requires);
  for (const scene of beforeCompletion) {
    assert.doesNotMatch([scene.summary, ...scene.lines.map(line => line.text)].join('\n'),
      /your prowler|prowler Goaden already had|already got that one|Goaden bought|Goaden booked/i);
  }
});
