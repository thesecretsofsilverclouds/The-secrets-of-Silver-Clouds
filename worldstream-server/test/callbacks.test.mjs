import test from 'node:test';
import assert from 'node:assert/strict';
import { callbackEditorial, validateMysteryIntegrity, listActiveCallbackSeeds } from '../src/callbacks.mjs';
import { editorialEvent } from '../src/editorial.mjs';
import { publicEvents } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';

test('callbackEditorial attaches coat_comfortable to the 13:30 lunch hall arrival', () => {
  const targetEvent = {
    id: 'evt:d54f7157b43b9bc1d14700178a06e4df',
    type: 'CROSS_PATHS',
    occurredAt: atLondon('2026-09-07', '13:30'),
    location: 'mi6',
    area: 'lunch_hall',
    participants: ['goaden', 'ashai'],
    publicDescription: 'Goaden and Ashai crossed paths in the lunch hall.'
  };

  const editorial = callbackEditorial(targetEvent);
  assert.ok(editorial, 'target event should match callback registry');
  assert.equal(editorial.prose, 'Goaden came through the lunch hall and took a seat across from Ashai. He was still wearing the same coat.');
  assert.deepEqual(editorial.lines, [
    { who: 'ashai', text: 'Still comfortable?' },
    { who: 'goaden', text: 'Extremely.' }
  ]);

  const cb = editorial.memoryCallback;
  assert.ok(cb, 'memoryCallback payload must be present');
  assert.equal(cb.key, 'coat_comfortable');
  assert.equal(cb.originEventId, 'evt:f46a2e1c5fa492b815b1eea75457bf6a');
  assert.equal(cb.originTime, '11:40');
  assert.equal(cb.originTimeLabel, 'Earlier · 11:40');
  assert.equal(cb.originLabel, "Coat's comfortable.");
  assert.match(cb.originSnippet, /Coat's comfortable/);
  assert.equal(cb.originLines.length, 2);
  assert.equal(cb.originLines[0].who, 'ashai');
  assert.equal(cb.originLines[1].who, 'goaden');
});

test('callbacks are seasoning, not punctuation: routine and unrelated events never receive callbacks', () => {
  const events = [
    { id: 'evt:other_meal', type: 'MEAL_BEGIN', occurredAt: atLondon('2026-09-07', '12:00'), publicDescription: 'Ashai had lunch.' },
    { id: 'evt:random_chat', type: 'CONVERSATION', occurredAt: atLondon('2026-09-07', '14:10'), publicDescription: 'They spoke quietly.' },
    { id: 'evt:practice_run', type: 'PRACTICE_BEGIN', occurredAt: atLondon('2026-09-07', '09:00'), publicDescription: 'Training began.' },
    { id: 'evt:routine_check', type: 'COMMS_CHECK_BEGIN', occurredAt: atLondon('2026-09-07', '10:00'), publicDescription: 'Comms check.' }
  ];

  for (const event of events) {
    assert.equal(callbackEditorial(event), null, `Event ${event.id} must not have a callback attached`);
  }
});

test('protect mystery everywhere: Emily plaza scene receives no callbacks or explanatory flattening', () => {
  const emilyPlazaEvent = {
    id: 'evt:0501eefd2abf0aa36c6dfe0eb2739b7b',
    type: 'VENUE_SCENE',
    occurredAt: atLondon('2026-09-07', '14:38'),
    location: 'big_ben_plaza',
    participants: ['goaden', 'ashai'],
    publicDescription: 'A quiet scene unfolded in the plaza with Emily present.',
    prose: 'Emily sat alone on the edge of the fountain, counting people who looked up at the clock face.'
  };

  // Emily's atmospheric intrigue must NEVER be bridged, summarized away, or flattened into exposition
  assert.equal(callbackEditorial(emilyPlazaEvent), null, 'Emily plaza scene must not receive callback injection');
  
  const projected = editorialEvent(emilyPlazaEvent);
  assert.equal(projected.memoryCallback, undefined, 'Projected Emily scene must not have memoryCallback');
  // Confirm the prose retains its evocative, unexplained observational power
  assert.match(projected.prose, /Emily sat alone on the edge of the fountain/);
});

test('publicEvents projects memoryCallback on matching events and preserves allowlist integrity', () => {
  const targetEvent = {
    id: 'evt:d54f7157b43b9bc1d14700178a06e4df',
    type: 'CROSS_PATHS',
    occurredAt: atLondon('2026-09-07', '13:30'),
    location: 'mi6',
    area: 'lunch_hall',
    participants: ['goaden', 'ashai'],
    visibility: 'public',
    publicDescription: 'Goaden and Ashai crossed paths in the lunch hall.'
  };

  const ordinaryEvent = {
    id: 'evt:ordinary_meet',
    type: 'CROSS_PATHS',
    occurredAt: atLondon('2026-09-07', '15:00'),
    location: 'mi6',
    area: 'corridors',
    participants: ['goaden', 'ashai'],
    visibility: 'public',
    publicDescription: 'They passed each other in the corridor.'
  };

  const snapshot = { events: [targetEvent, ordinaryEvent] };
  const projected = publicEvents(snapshot, 10);

  const targetProj = projected.find(e => e.id === targetEvent.id);
  const ordinaryProj = projected.find(e => e.id === ordinaryEvent.id);

  assert.ok(targetProj.memoryCallback, 'Target event must receive projected memoryCallback');
  assert.equal(targetProj.memoryCallback.key, 'coat_comfortable');
  assert.equal(targetProj.memoryCallback.originEventId, 'evt:f46a2e1c5fa492b815b1eea75457bf6a');
  assert.equal(targetProj.register, 'prose');
  assert.equal(targetProj.lines.length, 2);

  assert.equal(ordinaryProj.memoryCallback, undefined, 'Ordinary event must not have memoryCallback');
});

test('callback prerequisites rely on tracked physical facts and reject prose assumptions', () => {
  const validEvent = {
    id: 'evt:d54f7157b43b9bc1d14700178a06e4df',
    type: 'CROSS_PATHS',
    occurredAt: atLondon('2026-09-07', '13:30'),
    location: 'mi6',
    area: 'lunch_hall',
    participants: ['goaden', 'ashai'],
    publicDescription: 'Goaden and Ashai crossed paths in the lunch hall.'
  };

  // 1. Wrong physical location rejects callback
  const wrongLocation = { ...validEvent, location: 'cafe', area: 'dining_room' };
  assert.equal(callbackEditorial(wrongLocation), null, 'Wrong location must reject callback');

  // 2. Wrong physical area/room rejects callback
  const wrongArea = { ...validEvent, area: 'corridors' };
  assert.equal(callbackEditorial(wrongArea), null, 'Wrong area within barracks must reject callback');

  // 3. Incomplete physical participants reject callback
  const soloGoaden = { ...validEvent, participants: ['goaden'] };
  assert.equal(callbackEditorial(soloGoaden), null, 'Solo participant must reject callback');

  // 4. Chronological reversal rejects callback
  const reversedChronology = { ...validEvent, occurredAt: atLondon('2026-09-07', '09:00') };
  assert.equal(callbackEditorial(reversedChronology), null, 'Event occurring before origin must reject callback');

  // 5. Invalid physical duty context rejects callback
  assert.equal(callbackEditorial(validEvent, { ashaiCoveredFloor: false }), null, 'Context missing physical duty prerequisite must reject callback');

  // 6. Valid physical state succeeds
  assert.ok(callbackEditorial(validEvent, { ashaiCoveredFloor: true }), 'Tracked physical facts must succeed');
});

test('refined Emily mystery rule: behaviour may be referenced in future memories, but motive explanations are rejected', () => {
  // 1. Behavioural reference without motive is allowed and valid
  const observationalMemory = 'Ashai caught herself looking up at the tower clock face, like the girl in the plaza who counted everyone.';
  assert.equal(validateMysteryIntegrity(observationalMemory), true, 'Observational behaviour reference must be permitted');

  const dialogueBehaviour = 'Ashai: "You are looking up again." Goaden: "Just checking the chimes."';
  assert.equal(validateMysteryIntegrity(dialogueBehaviour), true, 'Dialogue referencing looking up must be permitted');

  // 2. Motive explanations are strictly rejected
  const explanatoryMotives = [
    'Emily was counting because she needed to calculate MEU fluctuations.',
    'Her motive was to identify individuals susceptible to the Celestial Veil.',
    'The reason she counted was under direct orders from the Order.',
    'She counted in order to measure the crowd resonance.'
  ];

  for (const motiveText of explanatoryMotives) {
    assert.equal(validateMysteryIntegrity(motiveText), false, `Motive explanation "${motiveText}" must be rejected`);
  }
});

test('Moment Engine integration: callback seeds are exposed as available downstream action opportunities', () => {
  const committedEvents = [
    { id: 'evt:f46a2e1c5fa492b815b1eea75457bf6a', type: 'NIGHT_DEBRIEF', occurredAt: atLondon('2026-09-07', '11:40') },
    { id: 'evt:other', type: 'MEAL_BEGIN', occurredAt: atLondon('2026-09-07', '12:00') }
  ];

  // 1. listActiveCallbackSeeds discovers the coat_comfortable seed from committed origin event
  const activeSeeds = listActiveCallbackSeeds(committedEvents);
  assert.equal(activeSeeds.length, 1);
  assert.equal(activeSeeds[0].key, 'coat_comfortable');
  assert.equal(activeSeeds[0].originEventId, 'evt:f46a2e1c5fa492b815b1eea75457bf6a');
  assert.equal(activeSeeds[0].targetEventId, 'evt:d54f7157b43b9bc1d14700178a06e4df');

  // 2. Later Moment opportunity uses active seed to expose new action choices
  const momentOpportunity = {
    momentId: 'moment:lunch_arrival',
    location: 'mi6',
    area: 'lunch_hall',
    actors: ['goaden', 'ashai'],
    baseActions: ['eat_lunch_quietly', 'discuss_roster']
  };

  const seed = activeSeeds.find(s => s.targetEventId === 'evt:d54f7157b43b9bc1d14700178a06e4df');
  assert.ok(seed, 'Moment opportunity must find matching active callback seed');

  const expandedActions = [...momentOpportunity.baseActions, `callback:${seed.key}`];
  assert.deepEqual(expandedActions, ['eat_lunch_quietly', 'discuss_roster', 'callback:coat_comfortable']);
});

