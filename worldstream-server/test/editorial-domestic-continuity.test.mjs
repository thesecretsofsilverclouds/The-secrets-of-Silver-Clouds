import test from 'node:test';
import assert from 'node:assert/strict';
import { domesticEditorial } from '../src/editorial-domestic.mjs';

// The domestic editor speaks only for the silent, and only about what the
// committed event already says. These pin the guards that keep it that way;
// they say nothing about voice, which is the approved v1 banks' business.

const make = (type, extra = {}) => ({ id: `domestic:${type}`, occurredAt: 1788862500000,
  type, visibility: 'public', location: 'mi6', area: 'common_room',
  participants: ['goaden'], publicDescription: 'The recorded public activity.',
  payload: {}, changes: [], ...extra });
const many = (type, extra, n = 80) => Array.from({ length: n }, (_, i) =>
  domesticEditorial(make(type, { id: `${type}:${i}`, ...extra }))?.prose).filter(Boolean);

test('a chance meeting takes two people and never names a place the event did not record', () => {
  const prose = many('CROSS_PATHS', { participants: ['goaden', 'ashai'] });
  assert.ok(prose.length > 0);
  for (const line of prose) {
    assert.match(line, /Goaden and Ashai/);
    assert.doesNotMatch(line, /corridor|doorway|landing|stairs|yard|plaza|lunch hall/i);
  }
  assert.equal(domesticEditorial(make('CROSS_PATHS')), null, 'one person cannot meet themselves');
});

test('sleep cannot be recast as wakeful rest, and unknown or duplicated cast fails closed', () => {
  assert.equal(domesticEditorial(make('REST_BEGIN', { changes: [
    { entity: 'character', id: 'goaden', field: 'activity', before: 'unhurried_time', after: 'sleeping' },
  ] })), null);
  assert.equal(domesticEditorial(make('REST_BEGIN', { publicDescription: 'Goaden turned in for the night.' })), null);
  assert.equal(domesticEditorial(make('REST_BEGIN', { payload: { sleeping: true } })), null);
  assert.ok(many('REST_BEGIN', {}).length > 0, 'a wakeful rest is still narrated');
  assert.equal(domesticEditorial(make('MEAL_BEGIN', { participants: ['goaden', 'unknown'] })), null);
  assert.equal(domesticEditorial(make('MEAL_BEGIN', { participants: ['goaden', 'goaden'] })), null);
});

test('authored prose, canonical dialogue, private events, continuations and skipped outcomes keep their own editors', () => {
  const source = make('CROSS_PATHS', { participants: ['goaden', 'ashai'] });
  assert.ok(domesticEditorial(source)?.prose, 'the control case is narrated');
  for (const extra of [{ prose: 'Authored passage.' }, { lines: [{ who: 'goaden', text: 'Yeah.' }] },
    { payload: { lines: [{ who: 'goaden', text: 'Yeah.' }] } }, { visibility: 'private' },
    { payload: { continuing: true } }, { payload: { continuing: false, resumed: true } },
    { payload: { outcome: 'skipped' } }, { routineContinuation: true }]) {
    assert.equal(domesticEditorial({ ...source, ...extra }), null, JSON.stringify(extra));
  }
});

test('only Goaden plays the piano', () => {
  assert.ok(many('PIANO_BEGIN', { area: 'music_room' }).length > 0);
  assert.equal(domesticEditorial(make('PIANO_BEGIN', { participants: ['ashai'] })), null);
});

test('weather narrates the closure the notice records; the relocation is narrated where it actually happens', () => {
  for (const line of many('WEATHER_CHANGE', { participants: [], payload: { weatherCode: 'storm' } })) {
    assert.match(line, /yard/);
    assert.doesNotMatch(line, /training|indoors|inside|moved/i);
  }
  assert.equal(domesticEditorial(make('WEATHER_CHANGE', { participants: [], payload: { weatherCode: 'cloudy' } })), null);
  const practice = domesticEditorial(make('PRACTICE_BEGIN', { area: 'indoor_yard', payload: { trainingRelocated: true } }));
  assert.match(practice.prose, /outdoor ground was still closed/);
  assert.match(practice.prose, /covered floor/);
  for (const line of many('PRACTICE_BEGIN', { area: 'training' })) assert.doesNotMatch(line, /closed|covered/);
});

test('the room comes off the recorded area, and selection is stable and never edits the event', () => {
  const paired = many('MEAL_BEGIN', { participants: ['goaden', 'ashai'], area: 'common_room', room: 'somewhere else' });
  assert.ok(paired.some(line => /the lunch hall/.test(line)), 'the area name is used when a line names the room');
  assert.ok(!paired.some(line => /somewhere else/.test(line)), 'a stale room string never wins over the recorded area');
  for (let i = 0; i < 40; i++) {
    const event = make('CROSS_PATHS', { id: `stable:${i}`, participants: ['goaden', 'ashai'] });
    const before = structuredClone(event), first = domesticEditorial(event);
    assert.deepEqual(domesticEditorial(event), first);
    assert.equal(first.description, event.publicDescription);
    assert.deepEqual(event, before);
  }
});
