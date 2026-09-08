import test from 'node:test';
import assert from 'node:assert/strict';
import { CinematicInbox, nextServerCursor, autoSceneExcerpt, cinematicLines, AUTO_SCENE_MAX_MS } from '../../worldstream/app/cinematic-player.js';

test('busy scene inbox retains incoming scenes and never repeats an event', () => {
  const inbox = new CinematicInbox();
  assert.equal(inbox.enqueue({ eventId: 'one' }), true);
  assert.equal(inbox.enqueue({ eventId: 'two' }), true);
  assert.equal(inbox.enqueue({ eventId: 'one' }), false);
  assert.equal(inbox.take().eventId, 'one');
  assert.equal(inbox.take().eventId, 'two');
  assert.equal(inbox.take(), null);
});

test('scene cursor advances on server time, never a local clock guess', () => {
  assert.equal(nextServerCursor(50, { acceptedAt: 60, serverTime: 100 }), 60);
  assert.equal(nextServerCursor(50, { serverTime: 100 }), 100);
  assert.equal(nextServerCursor(50, { acceptedAt: 40 }), 50);
});

test('long three-character scene has a bounded live excerpt and a complete unchanged transcript', () => {
  const record = { scene: { openingNarration: 'The door opens.', closingNarration: 'The door closes.',
    beats: Array.from({ length: 24 }, (_, i) => ({ speaker: ['goaden', 'ashai', 'rose'][i % 3], line: 'This is a complete line of the original conversation.' })) } };
  const complete = cinematicLines(record);
  const excerpt = autoSceneExcerpt(complete);
  assert.ok(excerpt.excerpted);
  assert.ok(excerpt.durationMs <= AUTO_SCENE_MAX_MS);
  assert.equal(complete.length, 26);
  assert.equal(excerpt.lines[0].text, complete[0].text);
  assert.equal(excerpt.lines.at(-1).text, complete.at(-1).text);
  assert.ok(excerpt.lines.every(line => complete.some(original => original.text === line.text)));
});
