import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { leadMomentLine } from '../src/moments.mjs';
import { publicEvents } from '../src/fixture.mjs';
import { buildScenePacket, deterministicFallbackScene } from '../src/cinematics.mjs';
import { editorialCinematicRecordForApi } from '../src/editorial-cinematics.mjs';

const oldLine = 'Goaden was out of the lunch hall before the second tone. Whatever it is that answers a surge in him answered this one, and Kai came off his shoulder into the air over the corridor with his scales up.';
const corrected = 'In the MI6 barracks, whatever it is that answers a surge in Goaden answered this one. Kai came off his shoulder with his scales up.';
const readerEdition = 'Goaden felt the Thames surge inside the barracks. Kai lifted off his shoulder, scales raised. The little dragon stayed close.';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the surge reaction preserves Goaden and Kai without inventing a room transition', () => {
  assert.equal(leadMomentLine({ moment: 'arcane_surge', who: 'goaden', activity: 'on_call' }), corrected);
});

test('the already committed quarters reaction receives the same correction in feed and cached narration', () => {
  // Fields from the observed integrated 2026-09-08 19:42 event. It has no area
  // change and follows the 19:40 surge that put Goaden on call in his quarters.
  const event = {
    id: 'evt:cd3a746c28b8d56e34cdeada7f1b7307', seq: 2, occurredAt: 1788892920000,
    type: 'MOMENT_NOTICED', visibility: 'public', location: 'mi6', area: 'quarters',
    participants: ['goaden'], publicDescription: oldLine, changes: [],
    payload: { moment: 'arcane_surge', sight: 'the corridor light running the length of the river' },
  };
  const snapshot = { events: [event], characters: { goaden: { knowledge: [] } },
    relationships: [], weather: {}, factions: {}, pressure: {} };
  const packet = buildScenePacket(event, snapshot);
  const record = { eventId: event.id, occurredAt: event.occurredAt,
    acceptedAt: event.occurredAt + 1, scene: deterministicFallbackScene(packet), packet };
  const before = digest({ snapshot, record });
  assert.equal(publicEvents(snapshot)[0].description, readerEdition);
  const cinematic = editorialCinematicRecordForApi(record, { event, snapshot });
  assert.equal(cinematic.scene.openingNarration, readerEdition);
  assert.equal(cinematic.scene.background, 'mi6_quarters');
  assert.equal(cinematic.acceptedAt, record.acceptedAt);
  assert.equal(digest({ snapshot, record }), before, 'presentation correction leaves committed event and cache intact');
});
