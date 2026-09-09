import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { openWorld } from '../src/world.mjs';
import { DEFAULT_SEED } from '../src/fixture.mjs';
import { atLondon, nextLondonDay } from '../src/time.mjs';

// The standard, in the author's words: "readers need to be able to understand
// what's happening but we can do that and give lyrical prose simultaneously."
//
// This is the regression guard for it. Every phrase below was found in the feed
// and removed, and each one names a specific way a line can be grammatical,
// atmospheric and about nothing:
//
//   "Rose left unfinished the ending of the repeated rhythm."
//   "Goaden set aside a short interval for time with Kai."
//   "Ashai proposed a quiet break together at MI6, with twelve minutes set aside."
//
// The common fault is an abstract head noun with no object — an interval, a
// rhythm, a matter, a section — standing where the thing itself should be. A
// reader cannot picture any of them. The cure is never "write less prose"; it
// is to name the place, name the work, and give it one physical detail that a
// reader can see. Rose cutting a verse on the drum kit under a hole in the roof
// is more lyrical than the rhythm sentence was, not less.
//
// Deliberately run against a live world rather than the authored banks: most of
// these lines are composed at runtime from a template plus a noun, and it was
// exactly that composition — not any single bank — that produced the vagueness.
const VAGUE = Object.freeze([
  { pattern: /\ba (?:short|small|brief|quiet|little) (?:interval|while|period|stretch)\b/i,
    why: 'an unnamed span of time standing in for the thing that happened' },
  { pattern: /\bset aside a\b/i, why: '"set aside" is scheduling language, not a scene' },
  { pattern: /\bthe (?:troublesome|unclear|repeated|difficult|awkward) \w+/i,
    why: 'an adjective doing the work a noun should do' },
  { pattern: /\bthe (?:matter|situation|business)\b/i, why: 'an abstract head noun with no object' },
  { pattern: /\bsome (?:time|work)\b/i, why: 'an unquantified nothing' },
  { pattern: /\bwhere it refused to settle\b/i, why: 'atmosphere with no subject' },
  { pattern: /\bminutes set aside\b/i, why: 'a duration reported instead of an event' },
]);

test('nothing the world publishes is grammatical and about nothing', t => {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-clarity-'));
  const world = openWorld({ dbPath: join(directory, 'w.sqlite'), seed: DEFAULT_SEED, startMs: atLondon('2026-09-04', '00:00') });
  t.after(() => {
    world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-clarity-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  let end = '2026-09-04';
  for (let index = 0; index < 45; index++) end = nextLondonDay(end);
  world.advance(atLondon(end, '00:00'));

  const published = world.semanticSnapshot().events
    .filter(event => event.visibility === 'public' && event.publicDescription);
  assert.ok(published.length > 1500, `expected a real sample, saw ${published.length}`);

  const offences = new Map();
  for (const event of published) {
    // A spoken idiom such as "What's the matter?" is concrete in a physical
    // scene. Audit the authored narration, retaining the full template guard
    // for ordinary runtime summaries instead of rewriting the creator's speech.
    const narration = event.type === 'SCENE_BANK_BEAT'
      ? event.payload.narrativeParagraphs.filter(item => item.kind === 'prose').map(item => item.text).join('\n')
      : event.publicDescription;
    for (const { pattern, why } of VAGUE) {
      if (!pattern.test(narration)) continue;
      const key = `${event.type}: ${event.publicDescription}`;
      if (!offences.has(key)) offences.set(key, why);
    }
  }
  assert.deepEqual([...offences].map(([line, why]) => `${line}  <-- ${why}`), [],
    'the feed published a line a reader cannot picture');
});

test('a story beat says where it happened', t => {
  // Prose-register events are the novel half of the feed and have to put the
  // reader somewhere. Ticker lines are exempt by design: "Goaden stopped for a
  // meal" is doing its job precisely by being flat.
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-clarity-place-'));
  const world = openWorld({ dbPath: join(directory, 'w.sqlite'), seed: DEFAULT_SEED, startMs: atLondon('2026-09-04', '00:00') });
  t.after(() => {
    world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-clarity-place-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  let end = '2026-09-04';
  for (let index = 0; index < 45; index++) end = nextLondonDay(end);
  world.advance(atLondon(end, '00:00'));

  const PLACE = /lunch hall|corridor|quarters|training ground|music room|gaming|assembly|operations|yard|warehouse|Sanctuary|plaza|Streamliner|carriage|Ink|parlour|Silver Spoon|barracks|window|table|desk|screen|door|kitchen|sill|stage|floor|street|river|roof/i;
  const beats = world.semanticSnapshot().events.filter(event =>
    ['MOMENT_NOTICED', 'OFFSCREEN_WITNESS', 'SUPPORTING_COMMITMENT'].includes(event.type)
    && event.visibility === 'public' && event.publicDescription);
  assert.ok(beats.length > 40, `expected a real sample, saw ${beats.length}`);
  const placeless = [...new Set(beats.filter(event => !PLACE.test(event.publicDescription))
    .map(event => `${event.type}: ${event.publicDescription}`))];
  assert.deepEqual(placeless, [], 'a story beat happened nowhere in particular');
});
