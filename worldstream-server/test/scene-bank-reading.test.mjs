import test from 'node:test';
import assert from 'node:assert/strict';
import { publicEvents } from '../src/fixture.mjs';
import { CinematicService } from '../src/cinematic-service.mjs';
import { readingSceneParagraphs } from '../../worldstream/app/reader-scene.js';
import { authoredSceneRecord, cinematicLines } from '../../worldstream/app/cinematic-player.js';
import { forwardReadingEvents, loadedDialogueScenes } from '../../worldstream/app/reader-narrative.js';
import { ReadingFeedBuffer } from '../../worldstream/app/reading-view.js';
import { dayPhase } from '../src/sky.mjs';

function source() {
  return { id: 'evt:bank', seq: 2, occurredAt: Date.parse('2026-09-09T12:00:00Z'),
    type: 'SCENE_BANK_BEAT', visibility: 'public', publicDescription: 'The coat was warm.',
    location: 'big_ben_plaza', area: 'venue', participants: ['goaden', 'ashai', 'nimbus'],
    causedBy: ['evt:before'], changes: [], payload: { sceneBankId: 'P1', sceneEpisodeId: 'nimbus',
      privateKnowledge: { forbidden: 'Unplayed ending' },
      narrativeParagraphs: [
        { text: 'Something warm shifted inside the coat.', kind: 'prose' },
        { text: '“Your coat,” said Ashai.', kind: 'dialogue', who: 'ashai' },
        { text: 'Nimbus opened one eye.', kind: 'prose', who: 'nimbus', expression: 'wink' },
        { text: '“I know,” said Goaden.', kind: 'dialogue', who: 'goaden' }],
      sceneBeats: [
        { text: 'Something warm shifted inside the coat.', kind: 'prose' },
        { text: 'Your coat.', kind: 'dialogue', who: 'ashai', expression: 'neutral' },
        { text: 'Nimbus opened one eye.', kind: 'prose', who: 'nimbus', nimbusPlate: 'wink' },
        { text: 'I know.', kind: 'dialogue', who: 'goaden', expression: 'idle' }],
      lines: [{ who: 'ashai', text: 'Your coat.' }, { who: 'goaden', text: 'I know.' }] } };
}

test('public scene preserves ordered prose and speech once in reading and cinematic playback', () => {
  const original = source(), before = JSON.stringify(original);
  const [event] = publicEvents({ events: [original] });
  const paragraphs = readingSceneParagraphs(event, { openingNarration: 'Unrelated generated opening.' });
  assert.deepEqual(paragraphs.map(item => item.text), original.payload.narrativeParagraphs.map(item => item.text));
  const beats = cinematicLines(authoredSceneRecord(event));
  assert.deepEqual(beats.map(item => item.text), original.payload.sceneBeats.map(item => item.text));
  assert.equal(beats[2].kind, 'narration'); assert.equal(beats[2].expression, 'wink');
  assert.equal(beats[2].who, 'nimbus');
  assert.ok(!JSON.stringify(event).includes('Unplayed ending'));
  assert.equal(JSON.stringify(original), before);
  const edited = forwardReadingEvents([event])[0];
  assert.equal(edited.readerWeight, 3);
  assert.deepEqual(readingSceneParagraphs(edited), paragraphs);
  assert.equal(loadedDialogueScenes([event])[0].id, event.id);
});

test('silent scenes keep replay and narration without inventing a speaking Nimbus', () => {
  const canonical = source();
  canonical.payload.sceneBeats = [canonical.payload.sceneBeats[2]];
  canonical.payload.narrativeParagraphs = [canonical.payload.narrativeParagraphs[2]];
  canonical.payload.lines = [];
  const [event] = publicEvents({ events: [canonical] });
  assert.equal(loadedDialogueScenes([event]).length, 1);
  assert.equal(cinematicLines(authoredSceneRecord(event))[0].kind, 'narration');
  assert.equal(readingSceneParagraphs(event)[0].kind, 'prose');
  assert.ok(!/said|“/.test(readingSceneParagraphs(event)[0].text));
});

test('authored replay keeps the recorded winter night and room, with a short archive title', () => {
  const canonical = source();
  canonical.occurredAt = Date.parse('2027-02-01T23:00:00Z');
  canonical.location = 'mi6'; canonical.area = 'gaming_room';
  canonical.payload.sceneTitle = 'The tin';
  const [event] = publicEvents({events:[canonical]});
  const record = authoredSceneRecord(event);
  assert.equal(record.atmosphere.time.dayPhase, dayPhase(canonical.occurredAt));
  assert.equal(record.atmosphere.time.dayPhase, 'night');
  assert.equal(record.atmosphere.room, 'the gaming area');
  assert.equal(event.sceneTitle, 'The tin');
});

test('scene causes expose only actual earlier public events and private performances stay private', () => {
  const bank = source();
  const earlier = { ...bank, id: 'evt:before', seq: 1, occurredAt: bank.occurredAt - 1000,
    publicDescription: 'Ashai had seen the coat move.', causedBy: [] };
  const hidden = { ...earlier, id: 'evt:hidden', visibility: 'private' };
  bank.causedBy.push(hidden.id);
  const rows = publicEvents({ events: [earlier, hidden, bank] });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1].earlierEventIds, [earlier.id]);
  assert.equal(rows[1].contextBridge.originEventId, earlier.id);
  assert.deepEqual(rows[1].storyRef, { type: 'story', id: 'nimbus' });
});

test('authored scenes never enter the model generation queue', () => {
  const service = new CinematicService({ store: { get: () => null },
    client: () => { throw new Error('Authored dialogue must never be regenerated'); } });
  assert.deepEqual(service.ingest({ events: [source()] }).candidates, []);
});

test('a corrected silent plate is held as a reading revision without changing the current page', () => {
  const [event] = publicEvents({ events: [source()] });
  const buffer = new ReadingFeedBuffer();
  buffer.update('one-world', [event]); buffer.reveal();
  const revised = structuredClone(event); revised.sceneBeats[2].nimbusPlate = 'surprised';
  buffer.update('one-world', [revised]);
  assert.equal(buffer.shown[0].sceneBeats[2].nimbusPlate, 'wink');
  buffer.reveal();
  assert.equal(buffer.shown[0].sceneBeats[2].nimbusPlate, 'surprised');
});
