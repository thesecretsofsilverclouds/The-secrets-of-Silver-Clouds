import test from 'node:test';
import assert from 'node:assert/strict';
import { purposeEditorial, purposePlace, PURSUIT_PURPOSES, PURPOSE_RULES } from '../src/pursuit-purpose.mjs';
import { livesEditorial } from '../src/editorial-lives.mjs';

function request(guest = 'rose', lead = 'ashai') {
  const family = { rose: 'lyric_cutting', gabriel: 'verse_revision', emily: 'the_swing',
    yukon: 'game_retry', zara: 'liaison_notes' }[guest];
  const location = guest === 'emily' ? 'big_ben_plaza' : 'mi6';
  const area = guest === 'emily' ? 'venue' : guest === 'yukon' ? 'gaming_room' : 'common_room';
  return { id: 'actual-request', visibility: 'public', type: 'OFFSCREEN_ENCOUNTER', occurredAt: 5000,
    location, area, participants: [lead], causedBy: ['completed-work', 'chosen-purpose', 'actual-encounter'],
    payload: { family, guest, lead, cast: [lead, guest], stage: 'purpose_requested',
      attempt: 1, projectNumber: 2, purposeStage: 'requested', purposeId: 'purpose:one', offscreenStoryId: 'purpose:one',
      purposeKind: PURSUIT_PURPOSES[guest].kind, purposeSourceEventId: 'completed-work', purposeSourceOccurredAt: 1000,
      purposeChosenEventId: 'chosen-purpose', purposeChosenOccurredAt: 3000 } };
}

test('purpose performance preserves existing dialogue, private data independence and exact actual cast', () => {
  for (const guest of Object.keys(PURSUIT_PURPOSES)) for (const lead of ['ashai', 'goaden']) {
    const event = request(guest, lead), before = structuredClone(event), rendered = livesEditorial(event);
    assert.equal(rendered.lines.length, 2);
    assert.deepEqual(rendered.lines.map(row => row.who), [guest, lead]);
    assert.doesNotMatch(JSON.stringify(rendered), /undefined|factKey|purposeId|checkpoint|algorithm/);
    assert.deepEqual(event, before);
    assert.equal(purposeEditorial({ ...event, lines: [{ who: guest, text: 'Original words.' }] }).lines, undefined);
    assert.equal(purposeEditorial({ ...event, payload: { ...event.payload, lines: [{ who: lead, text: 'Original reply.' }] } }).lines, undefined);
    assert.deepEqual(purposeEditorial({ ...event, changes: [{ private: 'never read this' }] }), rendered);
    for (const cast of [[lead], [guest], [lead, guest, 'hammond']])
      assert.equal(purposeEditorial({ ...event, payload: { ...event.payload, cast } }), null);
  }
});

test('next-purpose prose refuses missing, future, unrelated or out-of-order public evidence', () => {
  const event = request();
  for (const patch of [{ purposeSourceEventId: '' }, { purposeSourceOccurredAt: 6000 },
    { purposeChosenEventId: '' }, { purposeChosenOccurredAt: 999 }, { purposeChosenOccurredAt: 5000 },
    { purposeKind: 'invented' }, { family: 'the_swing' }, { offscreenStoryId: 'other-purpose' },
    { guest: '__proto__' }, { guest: 'constructor' }, { lead: 'hammond' }])
    assert.equal(purposeEditorial({ ...event, payload: { ...event.payload, ...patch } }), null, JSON.stringify(patch));
  for (const causedBy of [[], ['chosen-purpose'], ['completed-work'], 'completed-work chosen-purpose'])
    assert.equal(purposeEditorial({ ...event, causedBy }), null);
  assert.equal(purposeEditorial({ ...event, visibility: 'private' }), null);
  assert.equal(purposeEditorial({ ...event, participants: ['goaden'] }), null);
});

test('only the bounded actual presentation result can say that the work was heard', () => {
  const asked = request(), result = { ...asked, id: 'actual-result', type: 'OFFSCREEN_RESULT',
    occurredAt: asked.occurredAt + PURPOSE_RULES.duration, causedBy: [...asked.causedBy, asked.id],
    payload: { ...asked.payload, purposeStage: 'result', purposeOutcome: 'shared',
      purposeRequestEventId: asked.id, purposeRequestOccurredAt: asked.occurredAt } };
  assert.match(purposeEditorial(result).description, /heard both/);
  assert.equal(purposeEditorial({ ...result, occurredAt: result.occurredAt - 1 }), null);
  assert.equal(purposeEditorial({ ...result, causedBy: asked.causedBy }), null);
  assert.equal(purposeEditorial({ ...result, participants: [] }), null);
  const interrupted = { ...result, participants: [], payload: { ...result.payload, cast: [], purposeOutcome: 'unheard', purposeRetired: true } };
  const prose = purposeEditorial(interrupted).prose;
  assert.match(prose, /cut short|put aside/);
  assert.doesNotMatch(prose, /Ashai/);
  assert.match(prose, /before the listener heard both lines/);
  assert.equal(purposeEditorial({ ...interrupted, payload: { ...interrupted.payload, cast: ['rose'] } }), null);
  assert.equal(purposePlace('yukon', 'mi6', 'common_room'), false);
  assert.equal(purposePlace('emily', 'cafe', 'venue'), false);
  assert.equal(purposePlace('zara', 'cafe', 'venue'), false);
  assert.equal(purposePlace('zara', 'mi6', 'common_room'), true);
  assert.equal(purposePlace('constructor', 'mi6', 'common_room'), false);
});
