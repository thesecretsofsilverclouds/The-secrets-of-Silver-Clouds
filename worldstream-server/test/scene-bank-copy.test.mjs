import test from 'node:test';
import assert from 'node:assert/strict';
import { polishSceneBeats } from '../src/scene-bank-copy.mjs';
import { SCENE_BANK_BY_ID } from '../src/scene-bank-catalog.mjs';
import { SCENE_BANK_SOURCE } from '../src/scene-bank-data.mjs';

const prose = id => SCENE_BANK_BY_ID[id].beats.filter(beat => beat.kind === 'prose').map(beat => beat.text).join('\n');

test('the overturned stall remains the same physical scene in past tense, including its final stolen apple', () => {
  const scene = SCENE_BANK_BY_ID.G5;
  assert.match(prose('G5'), /A stall lay on its side/);
  assert.match(prose('G5'), /Ashai righted the stall/);
  assert.match(prose('G5'), /Then an apple was put down, very slowly/);
  assert.doesNotMatch(prose('G5'), /A pause|stall is|apple is/);
  const source = SCENE_BANK_SOURCE.find(row => row.id === 'G5');
  assert.deepEqual(scene.beats.filter(row => row.kind === 'dialogue').map(row => [row.who, row.text]),
    source.beats.filter(row => row.kind === 'dialogue').map(row => [row.who, row.text]));
});

test('ordinary physical narration keeps its facts while removing stage summaries and unowned later time or travel', () => {
  assert.match(prose('C2'), /skin stayed grey and his ears stayed pointed/);
  assert.match(prose('I8'), /Six squirrels stood in a line/);
  assert.match(prose('I8'), /thirty seconds later at a flat sprint, pursued/);
  assert.match(prose('J2'), /chains were moving\. Emily was not pushing/);
  assert.match(prose('J2'), /Emily said her own name/);
  assert.doesNotMatch(prose('D5'), /That is the scene/);
  assert.doesNotMatch(prose('N4'), /way home|went home/);
  assert.match(prose('N4'), /counted them again from memory/);
  assert.doesNotMatch(prose('N5'), /twenty minutes/);
  assert.match(prose('N5'), /Ashai took it/);
});

test('prose adaptations never apply a tense substitution to dialogue or mutate their source', () => {
  const source = [{ kind: 'dialogue', who: 'ashai', text: 'A stall is on its side. Bloody sprites.' },
    { kind: 'prose', text: 'A stall is on its side.' },
    { kind: 'dialogue', who: 'sprite_orange', text: 'We are all looking somewhere else.' },
    { kind: 'prose', text: 'A pause. An apple is put down very slowly.' }];
  const before = structuredClone(source), output = polishSceneBeats('G5', source);
  assert.deepEqual(source, before);
  assert.deepEqual(output.filter(row => row.kind === 'dialogue'), source.filter(row => row.kind === 'dialogue'));
  assert.deepEqual(polishSceneBeats('G5', source), output);
  assert.equal(output.length, source.length);
});

test('the existing Nimbus narration, dialogue timing and silent expressions remain intact', () => {
  assert.match(prose('P1'), /Goaden had been walking for ten minutes/);
  assert.match(prose('P14'), /silhouette four storeys high/);
  const split = SCENE_BANK_BY_ID.P16.beats;
  const gaveUp = split.findIndex(beat => beat.text === 'Ashai gave up.');
  assert.equal(split[gaveUp - 1].who, 'ashai');
  assert.match(split[gaveUp - 1].text, /that's —$/);
  assert.equal(split[gaveUp + 1].text, "It's a coat it likes.");
  for (const id of ['P6', 'P8', 'P12', 'P18', 'P21']) {
    const beats = SCENE_BANK_BY_ID[id].beats.filter(beat => beat.who === 'nimbus');
    assert.ok(beats.length);
    assert.ok(beats.every(beat => beat.kind === 'prose'));
    assert.ok(beats.some(beat => beat.nimbusPlate));
  }
});
