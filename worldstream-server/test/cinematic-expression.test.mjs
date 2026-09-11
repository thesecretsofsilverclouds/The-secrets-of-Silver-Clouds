import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHARACTER_PLATES, CINEMATIC_BACKGROUNDS, plateForExpression, selectVisualVocabulary,
} from '../src/cinematic-assets.mjs';
import { buildScenePacket, deterministicFallbackScene } from '../src/cinematics.mjs';

const sceneFile = url => join(dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'worldstream', 'app', String(url).replace(/^\//, ''));

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

test('recovered presentation plates and location art resolve on disk', () => {
  assert.equal(plateForExpression('greah', 'happy'), 'greah_happy');
  assert.equal(plateForExpression('greah', 'warm-greeting'), 'greah_warm_greeting');
  assert.equal(plateForExpression('kai', 'greeting'), 'kai_greeting');
  assert.equal(plateForExpression('damien', 'idle'), 'damien_idle');
  assert.equal(plateForExpression('truth', 'idle'), 'truth_idle');
  for (const plate of Object.values(CHARACTER_PLATES).flat()) {
    assert.ok(existsSync(sceneFile(plate.file)), `missing cinematic plate: ${plate.file}`);
  }
  for (const background of CINEMATIC_BACKGROUNDS) {
    assert.ok(existsSync(sceneFile(background.file)), `missing cinematic background: ${background.file}`);
  }
  const hideout = selectVisualVocabulary({
    event: { type: 'LEGION_VISIT', location: 'legion_hideout', participants: ['goaden', 'damien'] },
    daypart: 'evening',
  });
  assert.deepEqual([...hideout.backgrounds], ['legion_hideout_day']);
  assert.ok(!hideout.backgrounds.includes('london_day'));
  assert.ok(hideout.plates.damien?.includes('damien_idle'));
});
