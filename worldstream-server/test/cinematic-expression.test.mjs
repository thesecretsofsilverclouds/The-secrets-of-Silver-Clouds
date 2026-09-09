import test from 'node:test';
import assert from 'node:assert/strict';
import { plateForExpression } from '../src/cinematic-assets.mjs';
import { buildScenePacket, deterministicFallbackScene } from '../src/cinematics.mjs';

test('canonical Goaden dialogue keeps its authored smirk through cinematic selection', () => {
  const event = {
    id: 'event:authored-smirk', seq: 1, occurredAt: Date.parse('2026-09-08T17:46:00Z'),
    type: 'CONVERSATION', visibility: 'public', location: 'mi6', area: 'gaming_room',
    participants: ['goaden', 'ashai'], publicDescription: 'Goaden and Ashai talked.',
    lines: [{ who: 'goaden', expression: 'smirk', text: 'Yeah, but I carry it better.' }],
  };
  const snapshot = { events: [event], characters: { goaden: { knowledge: [] }, ashai: { knowledge: [] } },
    relationships: [], weather: {}, factions: {}, pressure: {} };
  const scene = deterministicFallbackScene(buildScenePacket(event, snapshot));
  assert.equal(scene.beats[0].plate, 'goaden_smirk');
  assert.equal(scene.assets.plates.goaden_smirk.url, '/scene/goaden-smirk.png');
  assert.equal(scene.beats[0].line, event.lines[0].text);
  assert.equal(plateForExpression('goaden', 'guarded'), 'goaden_idle');
  assert.equal(plateForExpression('goaden', 'amused'), 'goaden_smirk');
});
