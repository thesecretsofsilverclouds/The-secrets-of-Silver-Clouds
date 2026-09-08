import test from 'node:test';
import assert from 'node:assert/strict';
import { livesEditorial } from '../src/editorial-lives.mjs';
import { editorialEvent, EDITORIAL_REVISION } from '../src/editorial.mjs';

const CASES = [
  ['game_retry', 'yukon', 'mi6', 'gaming_room', 'shorter_section'],
  ['verse_revision', 'gabriel', 'sanctuary', 'central_hub', 'shorten_last_line'],
  ['lyric_cutting', 'rose', 'legion_hideout', 'venue', 'say_it_out_loud'],
  ['the_swing', 'emily', 'big_ben_plaza', 'venue', 'stop_counting'],
  ['liaison_notes', 'zara', 'mi6', 'ops_room', 'separate_notes'],
];
function source(which = 0, stage = 'started', patch = {}) {
  const [family, guest, location, area, helpMethod] = CASES[which];
  const encounter = ['heard', 'helped', 'recalled'].includes(stage);
  return { id: 'event:now', visibility: 'public', occurredAt: 4000,
    publicDescription: 'The original recorded fact.', register: 'ticker', location, area,
    type: encounter ? 'OFFSCREEN_ENCOUNTER' : stage === 'result' ? 'OFFSCREEN_RESULT' : 'OFFSCREEN_START',
    participants: encounter ? ['goaden'] : [], causedBy: ['source:previous'], changes: [],
    payload: { family, guest, cast: encounter ? ['goaden', guest] : [guest], offscreenStoryId: 'life:current',
      attempt: stage === 'resumed' ? 2 : 1, projectNumber: 1, stage,
      ...(stage === 'resumed' ? { previousOutcome: 'unfinished', previousResultEventId: 'event:prior-result' } : {}),
      ...(stage === 'result' || encounter ? { outcome: 'unfinished' } : {}),
      ...(encounter ? { lead: 'goaden', sourceEventId: 'event:result', sourceOccurredAt: 1000,
        acquisitionEventId: stage === 'heard' ? 'event:now' : 'event:learned',
        acquiredAt: stage === 'heard' ? 4000 : 2000 } : {}),
      ...(['helped', 'recalled'].includes(stage) ? { recalledSourceEventId: 'event:result',
        recalledOccurredAt: 1000, memoryScope: 'same_project', recalledStoryId: 'life:current' } : {}),
      ...(stage === 'helped' ? { helpMethod, helpSourceEventId: 'event:now' } : {}), ...patch },
  };
}
const allText = value => `${value?.description}\n${value?.prose}`;

test('all authored offscreen lives have beginnings, unresolved work, results and knowledge-linked encounters', () => {
  for (let i = 0; i < CASES.length; i++) for (const stage of ['started', 'resumed', 'result', 'heard', 'helped', 'recalled']) {
    const event = source(i, stage), result = livesEditorial(event);
    assert.ok(result, `${CASES[i][0]}/${stage}`);
    assert.deepEqual(Object.keys(result).sort(), ['description', 'prose']);
    assert.ok(result.prose.length > 80 && result.prose.length < 750);
    assert.doesNotMatch(allText(result), /undefined|NaN|LLM|sourceEventId|factKey|checkpoint/);
    if (!event.participants.length) assert.doesNotMatch(allText(result), /Goaden|Ashai/);
  }
});

test('first hearing never turns the absent protagonist into an earlier witness or a helper', () => {
  for (let i = 0; i < CASES.length; i++) for (const outcome of ['unfinished', 'settled']) {
    for (const lead of ['goaden', 'ashai']) {
      const event = source(i, 'heard', { lead, outcome }); event.participants = [lead]; event.payload.cast[0] = lead;
      const result = livesEditorial(event);
      assert.ok(result);
      assert.match(result.description, /learned/);
      assert.doesNotMatch(allText(result), /remembered|suggested|watched (?:him|her)|had seen|as before/);
      assert.doesNotMatch(allText(result), lead === 'goaden' ? /Ashai/ : /Goaden/);
    }
  }
});

test('memory requires a past source, actual past acquisition, and a distinct recall path', () => {
  for (const stage of ['helped', 'recalled']) {
    const event = source(0, stage);
    for (const patch of [{ sourceEventId: '' }, { sourceOccurredAt: 5000 }, { acquisitionEventId: '' },
      { acquiredAt: 5000 }, { acquiredAt: 4000 }, { acquisitionEventId: event.id }, { recalledSourceEventId: '' },
      { recalledOccurredAt: 3000 }, { recalledOccurredAt: null }]) {
      assert.equal(livesEditorial({ ...event, payload: { ...event.payload, ...patch } }), null, JSON.stringify(patch));
    }
    assert.ok(livesEditorial(event));
  }
  const heard = source(0, 'heard');
  for (const patch of [{ acquiredAt: 2000 }, { acquisitionEventId: 'event:someone-else' }])
    assert.equal(livesEditorial({ ...heard, payload: { ...heard.payload, ...patch } }), null);
});

test('an encounter elsewhere recalls the work without transporting its scenery or leaving settled work open', () => {
  for (let i = 0; i < CASES.length; i++) {
    const first = source(i, 'heard'); first.location = 'mi6'; first.area = 'common_room';
    const heard = livesEditorial(first);
    assert.ok(heard);
    assert.doesNotMatch(heard.prose, /glance from the game|look(?:ed|ing)? (?:at|towards) the screen|monitor light|under the screens|controller|at the desk/);
    const ending = source(i, 'recalled', { outcome: 'settled', sourceEventId: 'event:new-ending',
      sourceOccurredAt: 3000, recalledSourceEventId: 'event:older-unfinished', recalledOccurredAt: 1000,
      acquisitionEventId: 'event:actual-earlier-learning', acquiredAt: 2000 });
    ending.location = 'mi6'; ending.area = 'common_room';
    const recalled = livesEditorial(ending);
    assert.ok(recalled); assert.match(recalled.prose, /ending now.*settled/);
    assert.doesNotMatch(recalled.prose, /still unfinished|still waiting|still refused|would still need|suggested/);
    const earlierProject = { ...ending, payload: { ...ending.payload,
      memoryScope: 'earlier_project', recalledStoryId: 'life:earlier-project' } };
    assert.match(livesEditorial(earlierProject).prose, /different attempt.*ending now.*settled/);
  }
});

test('help names only the authored approach and resolution requires the committed result', () => {
  for (let i = 0; i < CASES.length; i++) {
    const offered = source(i, 'helped');
    assert.ok(livesEditorial(offered));
    assert.doesNotMatch(livesEditorial(offered).prose, /finally came together|finally landed|had made.*clear|last beat fall/);
    assert.equal(livesEditorial({ ...offered, payload: { ...offered.payload, outcome: 'settled' } }), null);
    assert.equal(livesEditorial({ ...offered, payload: { ...offered.payload, helpMethod: 'new-magic-power' } }), null);
    const unresolved = source(i, 'result', { helpSourceEventId: 'earlier-help', helpMethod: CASES[i][4] });
    const closed = source(i, 'result', { outcome: 'settled', helpSourceEventId: 'earlier-help', helpMethod: CASES[i][4] });
    assert.doesNotMatch(livesEditorial(unresolved).prose, /suggestion|suggested/);
    assert.match(livesEditorial(closed).prose, /suggestion|suggested/);
    assert.doesNotMatch(allText(livesEditorial(closed)), /Goaden|Ashai|won the game|new mission|enemy|new power|drum solo/);
  }
});

test('new projects and earlier-project memory cannot reopen the old settled work', () => {
  for (let i = 0; i < CASES.length; i++) {
    const first = livesEditorial(source(i));
    const next = livesEditorial(source(i, 'started', { projectNumber: 2, newProject: true }));
    assert.notEqual(next.prose, first.prose);
    assert.match(next.prose, /different|new verse/);
    const familiar = source(i, 'helped', { projectNumber: 2, memoryScope: 'earlier_project',
      recalledStoryId: 'life:older', recalledSourceEventId: 'event:older-result', recalledOccurredAt: 500,
      sourceOccurredAt: 3000 });
    const result = livesEditorial(familiar);
    assert.ok(result); assert.match(result.prose, /different|new verse|earlier|another note/);
    assert.doesNotMatch(result.prose, /old.*still unfinished|previous.*still unfinished|same verse/);
  }
});

test('autonomous attendance, known guests and valid rooms are required', () => {
  const base = source();
  for (const bad of [{ ...base, participants: ['goaden'] }, { ...base, location: 'sanctuary' },
    { ...base, area: 'quarters' }, { ...base, visibility: 'private' }, { ...base, occurredAt: -1 },
    { ...base, payload: { ...base.payload, family: '__proto__' } },
    { ...base, payload: { ...base.payload, cast: [] } }, { ...base, payload: { ...base.payload, guest: 'gabriel' } },
    { ...base, payload: { ...base.payload, attempt: 4 } }, { ...base, payload: { ...base.payload, projectNumber: 0 } }])
    assert.equal(livesEditorial(bad), null);
  const heard = source(0, 'heard');
  assert.equal(livesEditorial({ ...heard, participants: ['goaden', 'ashai'] }), null);
  assert.equal(livesEditorial({ ...heard, participants: ['ashai'] }), null);
  assert.equal(livesEditorial(source(0, 'resumed', { previousResultEventId: null })), null);
});

test('the performance is immutable, private-text independent, and stable between reads', () => {
  const event = source(1, 'helped');
  for (const key of ['secret', 'knowledge', 'privateMemory', 'hiddenReason', 'providerText'])
    Object.defineProperty(event.payload, key, { get() { throw new Error(`Private field read: ${key}`); } });
  const before = JSON.stringify(event);
  Object.freeze(event.payload); Object.freeze(event.participants); Object.freeze(event);
  const expected = livesEditorial(event);
  for (let i = 0; i < 30; i++) assert.deepEqual(livesEditorial(event), expected);
  assert.equal(JSON.stringify(event), before);
  const revised = editorialEvent(event);
  assert.equal(revised.editorialRevision, EDITORIAL_REVISION);
  assert.equal(revised.id, event.id); assert.deepEqual(revised.payload, event.payload);
  assert.equal(revised.prose, expected.prose); assert.equal(revised.register, 'prose');
  assert.equal(editorialEvent(event, { asOf: 3999 }), event);
});
