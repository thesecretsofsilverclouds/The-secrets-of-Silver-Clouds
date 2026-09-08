import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { findSpoilers, isClean, assertNoSpoiler, REVEALS, FORBIDDEN_TERMS,
  FORBIDDEN_LINKS, SEVERITY } from '../src/spoilers.mjs';
import { openWorld } from '../src/world.mjs';
import { DEFAULT_SEED } from '../src/fixture.mjs';
import { atLondon, nextLondonDay } from '../src/time.mjs';
import { EXCHANGES, linesOf } from '../src/dialogue.mjs';
import { LEGION_EXCHANGES } from '../src/legion.mjs';
import { SIDE_CHARACTERS, SIDE_CHARACTER_IDS } from '../src/cast.mjs';

test('the three reveals are named, and the line they sit behind is explicit', () => {
  assert.deepEqual(Object.keys(REVEALS).sort(),
    ['ashai_parentage', 'goaden_brother', 'whisper_identity']);
  // Severity came down; the reveal line did not. If anybody ever flips this,
  // it should be a deliberate edit to a named field rather than a drift.
  assert.equal(SEVERITY.reveals, false);
  assert.equal(SEVERITY.combat, true, 'the author lifted the combat ban in v15');
});

test('each reveal is caught by name and by implication', () => {
  // By name.
  assert.ok(!isClean("Goaden spoke to J'kobi."));
  assert.ok(!isClean('They found the Grimoire.'));
  assert.ok(!isClean('Goaden and Ashai went down to the basement.'));

  // By implication — the part a blocklist cannot do. None of these sentences
  // contains a forbidden word.
  const implied = [
    'Goaden had not seen his brother since the fire.',
    'The Head Captain removed his mask and Goaden knew the face.',
    'Goaden stared at the man he had believed dead.',
    'Ashai read the letters and learned who her father was.',
    'Whisper let the bandage slip, and his true face was something else entirely.',
  ];
  for (const sentence of implied) {
    const found = findSpoilers(sentence);
    assert.ok(found.length, `slipped through: ${sentence}`);
    assert.ok(found.some(item => item.kind === 'link'), `caught by term rather than link: ${sentence}`);
    assert.ok(found.every(item => item.reveal), `no reveal attributed: ${sentence}`);
  }
});

test('the figures themselves stay legal, because all three exist before the checkpoint', () => {
  // The Head Captain walks on at M41, Whisper is on the sofa at M65, and
  // Ashai's father is spoken about at M120. Embargoing the people rather than
  // the reveals would have cost the world three canon characters for nothing.
  const legal = [
    'The Head Captain crossed the hall and nobody spoke.',
    'Whisper was asleep on the sofa under a pile of sweet wrappers.',
    'Yukon and Whisper had the gaming area to themselves.',
    'Holy Order operatives were active in the city.',
    // Goaden's own line at M230, which a bare "brother" ban would have killed.
    'Perks of chaotic brotherhood.',
    'Goaden and Ashai talked about the week the city was having.',
    'Rose ended a conversation with four words.',
  ];
  for (const sentence of legal) {
    assert.deepEqual(findSpoilers(sentence), [], `false positive on: ${sentence}`);
  }
});

test('matching is whole-word, so ordinary prose is not caught by accident', () => {
  // "brothers" must not satisfy "brother he"; a substring must not fire.
  assert.ok(isClean('Goaden watched the brothers argue about the set list.'));
  // "basement" is banned; "basements" is a different word and must not fire.
  assert.ok(isClean('The basements of Whitehall are not our concern.'));
  // Casing and punctuation do not evade it.
  for (const variant of ["J'KOBI", "j'kobi.", "(J'kobi)", "— j'kobi —"]) {
    assert.ok(!isClean(`Goaden mentioned ${variant}`), `evaded by casing/punctuation: ${variant}`);
  }
  assert.throws(() => assertNoSpoiler("Goaden's brother J'kobi", 'a test'), /Spoiler in a test/);
  assert.doesNotThrow(() => assertNoSpoiler('An ordinary Tuesday at MI6', 'a test'));
});

test('every word the world can currently emit is clean', () => {
  // The authored banks, checked in full rather than sampled.
  // `linesOf` because an exchange may be gated — `{requires, lines}` — and a
  // bare `for...of` over that object would throw rather than check it, which
  // is a spoiler hole arriving disguised as a crash.
  for (const [mood, bank] of Object.entries(EXCHANGES)) {
    for (const exchange of bank) for (const line of linesOf(exchange)) assertNoSpoiler(line.text, `dialogue/${mood}`);
  }
  for (const [mood, bank] of Object.entries(LEGION_EXCHANGES)) {
    for (const lines of bank) for (const line of lines) assertNoSpoiler(line.text, `legion/${mood}`);
  }
  for (const id of SIDE_CHARACTER_IDS) {
    for (const line of SIDE_CHARACTERS[id].lines) assertNoSpoiler(line, `cast/${id}`);
  }
});

test('nothing a running world publishes ever spoils anything', t => {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-spoiler-test-'));
  const world = openWorld({ dbPath: join(directory, 'w.sqlite'), seed: DEFAULT_SEED, startMs: atLondon('2026-09-04', '00:00') });
  t.after(() => {
    world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-spoiler-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  let end = '2026-09-04';
  for (let i = 0; i < 60; i++) end = nextLondonDay(end);
  world.advance(atLondon(end, '00:00'));

  const projection = world.publicProjection();
  let checked = 0;
  for (const event of projection.events) {
    assertNoSpoiler(event.description, `event ${event.id}`);
    for (const line of event.lines ?? []) assertNoSpoiler(line.text, `line in ${event.id}`);
    checked++;
  }
  assert.ok(checked > 20, `expected a feed to check, saw ${checked}`);
  // And the whole projection as one blob, so a field nobody thought about is
  // still covered.
  assertNoSpoiler(JSON.stringify(projection), 'the public projection');
});

test('the registry is the only embargo left', () => {
  // It used to be three lists in three files that had already drifted apart.
  // With the severity rail gone this one is carrying everything, so there must
  // not be a second copy for somebody to update instead.
  const source = readFileSync(new URL('../src/presentation.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes("from './spoilers.mjs'"), 'the prose layer keeps its own list');
  assert.ok(!/const EMBARGOED = Object\.freeze\(\[/.test(source), 'a second embargo list survives');
  assert.ok(FORBIDDEN_TERMS.length >= 5 && FORBIDDEN_LINKS.length >= 4);
});
