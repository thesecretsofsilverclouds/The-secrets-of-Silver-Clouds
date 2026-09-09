import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneEditorial } from '../src/editorial-scenes.mjs';
import { editorialEvent } from '../src/editorial.mjs';
import { VENUE_SCENES } from '../src/venues.mjs';
import { LEGION_EXCHANGES } from '../src/legion.mjs';
const event = (type, lines, extra = {}) => ({ type, id: 'scene:review', occurredAt: 1,
  visibility: 'public', publicDescription: 'Recorded exchange.', participants: ['goaden', 'ashai'],
  location: 'mi6', payload: { lines }, ...extra });

test('venue staging follows the full recorded exchange and never adds a guest to an unknown scene', () => {
  const scene = VENUE_SCENES.enchanted_ink.find(scene => scene.id === 'ink_emily_prowler');
  const source = event('VENUE_SCENE', scene.lines, { location: 'enchanted_ink', payload: { lines: scene.lines, venue: 'enchanted_ink' } });
  const before = structuredClone(source), revised = editorialEvent(source);
  assert.match(revised.prose, /barefoot girl/);
  assert.doesNotMatch(revised.prose, /heavy shadow|killed|new powers/);
  assert.deepEqual(revised.payload.lines, source.payload.lines);
  assert.deepEqual(source, before);
  assert.deepEqual(editorialEvent(revised), revised);
  assert.equal(sceneEditorial({ ...source, visibility: 'private' }), null);
  assert.equal(sceneEditorial({ ...source, participants: ['goaden'] }), null);
  assert.equal(sceneEditorial({ ...source, location: 'mi6' }), null);
  assert.equal(sceneEditorial({ ...source, payload: { ...source.payload, lines: [{ who: 'ashai', text: 'Different words.' }] } }), null);
});

test('Balthazar is introduced through the shared body before an invoice exchange, without claiming payment happened', () => {
  const lines = LEGION_EXCHANGES.demon_admin.find(lines => lines[0].text === 'I have considered the invoice.');
  const source = event('LEGION_VISIT', lines), revised = editorialEvent(source);
  assert.match(revised.prose, /Anarchy.*Balthazar’s voice/);
  assert.match(revised.prose, /invoice/);
  assert.doesNotMatch(revised.prose, /paid|two men|beside Anarchy/);
  assert.deepEqual(revised.payload.lines, lines);
});

test('a venue opening lets the spoken exchange reveal its own result', () => {
  const scene = VENUE_SCENES.enchanted_ink.find(scene => scene.id === 'ink_light_inspector');
  const staged = sceneEditorial(event('VENUE_SCENE', scene.lines, { location: 'enchanted_ink', payload: { lines: scene.lines, venue: 'enchanted_ink' } }));
  assert.match(staged.prose, /lamp.*sprite/);
  assert.doesNotMatch(staged.prose, /right every time|thirty degrees|chair.*wrong/);
});
