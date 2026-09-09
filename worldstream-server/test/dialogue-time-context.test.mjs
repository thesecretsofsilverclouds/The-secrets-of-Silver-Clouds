import test from 'node:test';
import assert from 'node:assert/strict';
import { selectExchange, correctLegacyWakeDialogue } from '../src/dialogue.mjs';
import { atLondon } from '../src/time.mjs';

test('ordinary dialogue cannot assert a five o’clock waking without its actual cause', () => {
  const wakingLine = /up since five/;
  let witnessed = false;
  for (let index = 0; index < 250; index++) {
    const key = `after-night-recovery:${index}`;
    const ordinary = selectExchange('ordinary', 'sleep-proof', key);
    assert.ok(ordinary.length >= 3, 'the ordinary conversation still has a script');
    assert.ok(!ordinary.some(line => wakingLine.test(line.text)));
    assert.deepEqual(selectExchange('ordinary', 'sleep-proof', key), ordinary);
    witnessed ||= selectExchange('ordinary', 'sleep-proof', key, { causes: ['both_up_since_five'] })
      .some(line => wakingLine.test(line.text));
  }
  assert.ok(witnessed, 'the authored exchange remains available with the required cause');
});

test('the exact legacy clock claim is corrected only by both speakers’ completed public night and later recovery', () => {
  const day = '2026-09-08';
  const event = { id: 'old-conversation', type: 'CONVERSATION', occurredAt: atLondon(day, '18:45'),
    visibility: 'public', participants: ['goaden', 'ashai'], payload: { mood: 'ordinary', lines: [
      { who: 'goaden', expression: 'idle', text: "You've been up since five." },
      { who: 'ashai', expression: 'guarded', text: 'So have you.' },
      { who: 'goaden', expression: 'smirk', text: 'Yeah, but I carry it better.' },
    ] } };
  const work = { id: 'night-ending', type: 'NIGHT_WORK_END', visibility: 'public', publicDescription: 'The night check ended.',
    occurredAt: atLondon(day, '03:30'), participants: ['goaden', 'ashai'] };
  const recovered = ['goaden', 'ashai'].map(who => ({ id: `recovered:${who}`, type: 'NIGHT_RECOVERED',
    visibility: 'public', publicDescription: `${who} got up later.`, occurredAt: atLondon(day, '09:00'),
    participants: [who], causedBy: [work.id] }));
  const sources = [work, ...recovered], before = structuredClone(event);
  const corrected = correctLegacyWakeDialogue(event, sources);
  assert.equal(corrected.payload.lines[0].text, "You've had a long night.");
  assert.ok(corrected.causedBy.includes(work.id));
  assert.deepEqual(correctLegacyWakeDialogue(event, () => sources), corrected);
  const packetSource = { ...event, lines: event.payload.lines }; delete packetSource.payload;
  const packetCorrected = correctLegacyWakeDialogue(packetSource, () => sources);
  assert.equal(packetCorrected.lines[0].text, "You've had a long night.");
  assert.deepEqual(packetCorrected.payload.lines, packetCorrected.lines);
  assert.deepEqual(corrected.payload.lines.slice(1), event.payload.lines.slice(1));
  assert.deepEqual(event, before, 'the persisted event and its dialogue are untouched');
  for (const invalid of [[], [work, recovered[0]], [{ ...work, visibility: 'private' }, ...recovered],
    [work, ...recovered.map(row => ({ ...row, causedBy: ['another-night'] }))],
    [work, ...recovered.map(row => ({ ...row, occurredAt: atLondon('2026-09-09', '09:00') }))]]) {
    assert.equal(correctLegacyWakeDialogue(event, invalid), event);
  }
  assert.equal(correctLegacyWakeDialogue({ ...event, type: 'VENUE_SCENE' }, sources).payload.lines[0].text,
    "You've been up since five.");
  correctLegacyWakeDialogue({ ...event, type: 'VENUE_SCENE' }, () => { throw new Error('Unrelated scenes must not query history'); });
});
