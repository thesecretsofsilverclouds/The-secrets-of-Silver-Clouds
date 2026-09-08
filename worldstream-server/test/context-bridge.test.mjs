import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveContextBridge } from '../src/context-bridge.mjs';
import { publicEvents } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';

test('resolveContextBridge strictly gates on dependent beats and rejects ordinary routines', () => {
  const events = new Map();
  const lookup = id => events.get(id);

  // 1. Ordinary independent events must NEVER receive contextBridge
  const meal = {
    id: 'evt:meal', type: 'MEAL_BEGIN', occurredAt: atLondon('2026-09-07', '12:00'),
    causedBy: ['evt:some_prev'], publicDescription: 'Ashai went down for lunch.'
  };
  events.set('evt:some_prev', { id: 'evt:some_prev', type: 'PRACTICE_END', occurredAt: atLondon('2026-09-07', '11:45') });
  assert.equal(resolveContextBridge(meal, lookup), null);

  const practice = {
    id: 'evt:practice', type: 'PRACTICE_BEGIN', occurredAt: atLondon('2026-09-07', '08:00'),
    causedBy: [], publicDescription: 'Ashai began training.'
  };
  assert.equal(resolveContextBridge(practice, lookup), null);

  const conversation = {
    id: 'evt:chat', type: 'CONVERSATION', occurredAt: atLondon('2026-09-07', '10:15'),
    causedBy: ['evt:cross'], publicDescription: 'They talked in the corridor.'
  };
  events.set('evt:cross', { id: 'evt:cross', type: 'CROSS_PATHS', occurredAt: atLondon('2026-09-07', '10:14') });
  assert.equal(resolveContextBridge(conversation, lookup), null);

  // 2. Ground work opportunity connects to restriction or preparation
  const restriction = {
    id: 'evt:restr', type: 'GROUND_RESTRICTION', occurredAt: atLondon('2026-09-07', '08:45'),
    publicDescription: 'The outdoor training ground was taken out of use for a safety check and reset.'
  };
  events.set('evt:restr', restriction);

  const opportunity = {
    id: 'evt:opp', type: 'GROUND_WORK_OPPORTUNITY', occurredAt: atLondon('2026-09-07', '13:05'),
    causedBy: ['evt:restr']
  };
  const oppBridge = resolveContextBridge(opportunity, lookup);
  assert.ok(oppBridge);
  assert.equal(oppBridge.time, '08:45');
  assert.equal(oppBridge.timeLabel, 'Earlier · 08:45');
  assert.match(oppBridge.snippet, /The outdoor training ground had been taken out of use/);

  // 3. Ground work completion connects to ground work opportunity
  const completion = {
    id: 'evt:comp', type: 'GROUND_WORK_COMPLETED', occurredAt: atLondon('2026-09-07', '13:30'),
    causedBy: ['evt:opp', 'evt:restr']
  };
  events.set('evt:opp', opportunity);
  const compBridge = resolveContextBridge(completion, lookup);
  assert.ok(compBridge);
  assert.equal(compBridge.time, '13:05');
  assert.equal(compBridge.timeLabel, 'Earlier · 13:05');
  assert.match(compBridge.snippet, /Goaden and Ashai had switched plans to prepare the closed outdoor training yard themselves/);

  // 4. Zara's handover note offscreen continuation
  const zaraStart = {
    id: 'evt:zara_start', type: 'OFFSCREEN_START', occurredAt: atLondon('2026-09-07', '12:48'),
    payload: { storyId: 'liaison_notes' },
    publicDescription: 'Zara cleared the handover notes she could finish. One entry nobody could read straight kept her at the desk.'
  };
  events.set('evt:zara_start', zaraStart);

  const zaraResult = {
    id: 'evt:zara_res', type: 'OFFSCREEN_RESULT', occurredAt: atLondon('2026-09-07', '13:10'),
    causedBy: ['evt:zara_start'],
    payload: { storyId: 'liaison_notes' },
    publicDescription: 'Zara flagged the bad entry for the morning and left the rest of the handover clean.'
  };
  const zaraBridge = resolveContextBridge(zaraResult, lookup);
  assert.ok(zaraBridge);
  assert.equal(zaraBridge.time, '12:48');
  assert.equal(zaraBridge.timeLabel, 'Earlier · 12:48');
  assert.equal(zaraBridge.snippet, 'Zara had returned to an ambiguous handover note in Operations and started another pass.');
});

test('publicEvents attaches contextBridge only to eligible dependent events', () => {
  const restriction = {
    id: 'evt:restr', type: 'GROUND_RESTRICTION', occurredAt: atLondon('2026-09-07', '08:45'),
    visibility: 'public', publicDescription: 'The outdoor training ground was taken out of use for a safety check and reset.',
    participants: ['world'], changes: [], causedBy: []
  };
  const opportunity = {
    id: 'evt:opp', type: 'GROUND_WORK_OPPORTUNITY', occurredAt: atLondon('2026-09-07', '13:05'),
    location: 'mi6', area: 'training',
    visibility: 'public', publicDescription: 'Goaden and Ashai started on the yard itself.',
    participants: ['goaden', 'ashai'], payload: { prepared: true, method: 'cooperative_reset' },
    changes: [], causedBy: ['evt:restr']
  };
  const meal = {
    id: 'evt:meal', type: 'MEAL_BEGIN', occurredAt: atLondon('2026-09-07', '13:10'),
    location: 'mi6', area: 'lunch_hall',
    visibility: 'public', publicDescription: 'Goaden ate lunch.',
    participants: ['goaden'], payload: {},
    changes: [], causedBy: ['evt:opp']
  };

  const snapshot = { events: [restriction, opportunity, meal] };
  const projected = publicEvents(snapshot, 10);
  const oppProj = projected.find(e => e.id === 'evt:opp');
  const mealProj = projected.find(e => e.id === 'evt:meal');

  assert.ok(oppProj.contextBridge);
  assert.equal(oppProj.contextBridge.timeLabel, 'Earlier · 08:45');
  assert.match(oppProj.contextBridge.snippet, /outdoor training ground/);

  // Meal MUST NOT have a context bridge despite having an antecedent
  assert.equal(mealProj.contextBridge, undefined);
});

test('NIGHT_DEBRIEF context bridge grounds in committed Operations watch entry and strictly forbids synthetic fixture details', () => {
  const events = new Map();
  const lookup = id => events.get(id);

  const nightWorkEnd = {
    id: 'evt:night_end',
    type: 'NIGHT_WORK_END',
    occurredAt: atLondon('2026-09-07', '03:20'),
    location: 'mi6',
    area: 'ops_room',
    publicDescription: 'The MI6 night check was complete. The figures agreed and its watch entry was closed.'
  };
  events.set('evt:night_end', nightWorkEnd);

  const nightDebrief = {
    id: 'evt:debrief',
    type: 'NIGHT_DEBRIEF',
    occurredAt: atLondon('2026-09-07', '10:40'),
    location: 'mi6',
    area: 'corridors',
    causedBy: ['evt:cross_paths', 'evt:night_end'],
    publicDescription: 'Goaden and Ashai spoke about the night check and its closed entry.'
  };

  const bridge = resolveContextBridge(nightDebrief, lookup);
  assert.ok(bridge, 'NIGHT_DEBRIEF must have a context bridge');
  assert.equal(bridge.time, '03:20');
  assert.equal(bridge.timeLabel, 'Earlier · 03:20');
  assert.equal(bridge.snippet, 'Goaden had finished the overnight readiness check in Operations and closed the outstanding watch entry.');

  // Regression check: strictly forbid synthetic fixture scenarios (Echo, river sweep, etc.)
  assert.doesNotMatch(bridge.snippet, /river|corridor sweep|sweep|Echo/i);
});

