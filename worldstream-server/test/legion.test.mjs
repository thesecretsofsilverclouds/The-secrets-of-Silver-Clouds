import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename } from 'node:path';
import { openWorld } from '../src/world.mjs';
import { DEFAULT_SEED } from '../src/fixture.mjs';
import { atLondon, nextLondonDay } from '../src/time.mjs';
import { LEGION_CAST, LEGION_IDS, LEGION_OFFSCREEN, SIDE_CHARACTERS, SIDE_CHARACTER_IDS, NAMEABLE } from '../src/cast.mjs';
import { assertNoSpoiler } from '../src/spoilers.mjs';
import { LEGION_EXCHANGES, LEGION_MOODS, LEGION_PLATES, selectLegionScene, legionCastOf,
  summariseLegion } from '../src/legion.mjs';
import { BEAT_FAMILIES } from '../src/director.mjs';

const scenePath = name => join(dirname(dirname(fileURLToPath(import.meta.url))), '..', 'worldstream', 'app', 'scene', name);
const START = atLondon('2026-09-04', '00:00');
const DAYS = 120;
let END_DAY = '2026-09-04';
for (let i = 0; i < DAYS; i++) END_DAY = nextLondonDay(END_DAY);

let shared = null;
function run(t) {
  if (shared) return shared;
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-legion-test-'));
  const world = openWorld({ dbPath: join(directory, 'w.sqlite'), seed: DEFAULT_SEED, startMs: START });
  t.after(() => {
    world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-legion-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  world.advance(atLondon(END_DAY, '00:00'));
  shared = world.semanticSnapshot();
  return shared;
}

test('every written line asks for a plate the world actually owns', () => {
  // The one failure mode that would reach a reader as a broken image. Checked
  // against the filesystem rather than against the plate lists, so a list that
  // drifts from the art is caught too.
  let checked = 0;
  for (const [mood, bank] of Object.entries(LEGION_EXCHANGES)) {
    assert.ok(LEGION_MOODS.includes(mood), `${mood} is not a declared mood`);
    for (const lines of bank) {
      for (const line of lines) {
        if (!(line.who in LEGION_PLATES)) continue;
        assert.ok(LEGION_PLATES[line.who].includes(line.expression),
          `${mood}: ${line.who} has no ${line.expression} plate`);
        assert.ok(existsSync(scenePath(`${line.who}-${line.expression}.png`)),
          `${mood}: missing art for ${line.who}-${line.expression}.png`);
        checked++;
      }
    }
  }
  assert.ok(checked > 40, `expected plenty of Legion lines, saw ${checked}`);
  // And the declared plate lists match the files on disk both ways.
  for (const id of LEGION_IDS) {
    for (const plate of LEGION_CAST[id].plates) {
      assert.ok(existsSync(scenePath(`${id}-${plate}.png`)), `${id}-${plate}.png is declared but absent`);
    }
  }
});

test('nobody speaks who has no face, and nobody is invented', () => {
  // Truth and Damien have plates and speak. Marley remains LEGION_OFFSCREEN:
  // named in banter, not a runtime speaker, even though twin2-marley.png exists.
  const speakers = new Set(Object.values(LEGION_EXCHANGES).flat().flat().map(line => line.who));
  for (const who of speakers) {
    assert.ok(['goaden', 'ashai', ...LEGION_IDS].includes(who), `${who} speaks without being cast`);
  }
  for (const absent of LEGION_OFFSCREEN) {
    assert.ok(!speakers.has(absent.toLowerCase()), `${absent} has no plate and must not speak`);
    assert.ok(NAMEABLE.includes(absent), `${absent} is named in banter so the prose layer must allow it`);
  }
  // Everybody on stage is in the manuscript before the checkpoint.
  for (const id of LEGION_IDS) {
    assert.ok(Number.isInteger(LEGION_CAST[id].page) && LEGION_CAST[id].page < 183, id);
    assert.ok(NAMEABLE.includes(LEGION_CAST[id].name), `${id} must be sayable by the prose layer`);
  }
  // The silent MI6 staff are unchanged: still observed, still wordless.
  assert.equal(SIDE_CHARACTER_IDS.length, 6);
  for (const id of SIDE_CHARACTER_IDS) {
    for (const line of SIDE_CHARACTERS[id].lines) assert.ok(!/["'']/.test(line), `${id} started speaking`);
  }
});

test('the banter stays on this side of the checkpoint', () => {
  const text = Object.values(LEGION_EXCHANGES).flat().flat().map(line => line.text).join(' ').toLowerCase();
  // The same embargo the rest of the world runs under.
  for (const forbidden of ['whisper', 'grimoire', 'basement', 'prophecy', 'parentage', 'chosen one', 'betray']) {
    assert.ok(!text.includes(forbidden), `the banter says "${forbidden}"`);
  }
  // The two-tier registry as well, not just this suite's own word list: all
  // three reveals can be written without using a single banned word, and the
  // forbidden-links table is the only thing that catches that.
  for (const [mood, bank] of Object.entries(LEGION_EXCHANGES)) {
    for (const lines of bank) for (const line of lines) assertNoSpoiler(line.text, `legion/${mood}`);
  }
  for (const mood of LEGION_MOODS) assertNoSpoiler(summariseLegion(mood), `legion summary/${mood}`);

  // And it never reaches for the wound the reunion already settled.
  for (const forbidden of ['traitor', 'never forgave', 'left us']) {
    assert.ok(!text.includes(forbidden), `the banter reopens the betrayal: "${forbidden}"`);
  }
});

test('a scene is only ever cast from the people who came', () => {
  // The bug this guards: banks are grouped by subject, not by cast, so picking
  // a mood from the visitors and then any exchange from that bank handed three
  // visitors a scene needing a fourth, and the reducer threw.
  const combinations = [];
  for (const a of LEGION_IDS) for (const b of LEGION_IDS) if (a !== b) combinations.push([a, b]);
  for (const available of [...combinations, LEGION_IDS.slice(0, 3), [...LEGION_IDS]]) {
    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      const scene = selectLegionScene({ available, seed: DEFAULT_SEED, key });
      const performable = Object.values(LEGION_EXCHANGES).flat()
        .filter(lines => legionCastOf(lines).every(who => available.includes(who)));
      if (!performable.length) {
        assert.equal(scene, null, `a scene must not summon an absent cast member (had ${available})`);
        continue;
      }
      assert.ok(scene, `the available cast has ${performable.length} authored scenes`);
      assert.ok(scene.lines.length >= 3, 'a scene needs a few lines');
      assert.ok(LEGION_MOODS.includes(scene.mood), scene.mood);
      assert.deepEqual(scene.cast, legionCastOf(scene.lines));
      for (const who of scene.cast) {
        assert.ok(available.includes(who), `${who} performed without being available (had ${available})`);
      }
    }
  }
  // Seeded: the same moment always plays the same scene.
  const once = selectLegionScene({ available: LEGION_IDS, seed: DEFAULT_SEED, key: 'same' });
  const twice = selectLegionScene({ available: LEGION_IDS, seed: DEFAULT_SEED, key: 'same' });
  assert.deepEqual(once, twice);
  assert.ok(summariseLegion(once.mood).length > 10);
});

test('ordinary Legion banter changes only pacing and factual appearance records', t => {
  const snapshot = run(t);
  assert.ok(BEAT_FAMILIES.includes('legion_visit'));
  const visits = snapshot.events.filter(event => event.type === 'LEGION_VISIT' && event.payload?.lines);
  // Measured, not guessed: about one visit a fortnight, because the family
  // competes on equal terms with seven others and needs a quiet, low-tension
  // afternoon with both of them in and free. Over a year it comes to ~25, and
  // every member turns up. Pacing is an authorial dial, not a correctness one.
  assert.ok(visits.length >= 6, `expected the Legion to visit over ${DAYS} days, saw ${visits.length}`);

  const seen = new Set();
  for (const visit of visits) {
    // Ordinary banter does not acquire story consequences. Appearance history
    // now prevents cast starvation, so permit that exact ledger field while
    // continuing to reject fact, memory, plan and relationship mutations.
    for (const change of visit.changes) {
      if (change.entity === 'director') continue;
      // The ledger records leaves, so 'changed nothing but appearance
      // bookkeeping' is no longer a diff of two whole bags — it is the path.
      // Anything reaching past ['appearances', who] is the visit touching a
      // subsystem it has no business in, and says so by its own address.
      assert.equal(change.entity, 'story', 'a Legion visit changed a character or relationship');
      // Rose being in this room is also a fact the offscreen layer needs — she
      // cannot be here and away on her own errand at once — so a visit ticks two
      // ledgers. Both are pinned to the exact paths that are bookkeeping, which
      // is what keeps this an allowance rather than a licence.
      const allowed = { supportingStories: ['appearances'], offscreenLives: ['issued', 'people'] }[change.field];
      assert.ok(allowed, `a Legion visit changed another world subsystem: ${change.field}`);
      if (change.field !== 'supportingStories') {
        assert.ok(allowed.includes(change.path?.[0]),
          `a Legion visit wrote ${change.field}.${change.path?.[0]}`);
        continue;
      }
      assert.equal(change.path?.[0], 'appearances', 'ordinary banter changed more than appearance bookkeeping');
      {
        // A first appearance arrives as the whole record at ['appearances', who];
        // a repeat moves one field inside it. Both shapes are checked, because
        // the claim is the same either way: this person attended, and the record
        // credits this visit exactly once.
        const [, who, field] = change.path;
        const present = visit.payload.visitors.includes(who)
          || ['anarchy', 'balthazar'].includes(who) && visit.payload.visitors.some(id => ['anarchy', 'balthazar'].includes(id));
        assert.ok(present, `${who} received an appearance without attending`);
        if (field === undefined) {
          assert.equal(change.after.eventId, visit.id);
          assert.equal(change.after.at, visit.occurredAt);
          assert.equal(change.after.count, (change.before?.count ?? 0) + 1);
        } else {
          assert.ok(['at', 'eventId', 'count'].includes(field), `banter wrote appearances.${who}.${field}`);
          if (field === 'eventId') assert.equal(change.after, visit.id);
          if (field === 'at') assert.equal(change.after, visit.occurredAt);
          if (field === 'count') assert.equal(change.after, (change.before ?? 0) + 1);
        }
      }
    }
    assert.deepEqual([...visit.participants].sort(), ['ashai', 'goaden']);
    assert.ok(visit.publicDescription, 'a visit should reach the feed');
    // Everyone who speaks was recorded as having come, and has a real plate.
    for (const who of legionCastOf(visit.payload.lines)) {
      assert.ok(visit.payload.visitors.includes(who), `${who} spoke without being listed`);
      seen.add(who);
    }
    for (const line of visit.payload.lines) {
      assert.ok(['goaden', 'ashai', ...LEGION_IDS].includes(line.who), line.who);
    }
  }
  // Four months is not long enough to guarantee all four, but it is long
  // enough that it cannot be the same person every time.
  assert.ok(seen.size >= 2, `only ${[...seen]} ever came`);
  for (const who of seen) assert.ok(LEGION_IDS.includes(who), who);
});

test('a visit is staged with the pair actually in the room', t => {
  const snapshot = run(t);
  // Without a meeting first, every visit resolved as "nobody in to receive
  // them" and the family silently never fired at all — which is exactly what
  // the first cut of this did, for ninety days straight.
  const skipped = snapshot.events.filter(event => event.type === 'LEGION_VISIT' && event.payload?.outcome === 'skipped');
  const played = snapshot.events.filter(event => event.type === 'LEGION_VISIT' && event.payload?.lines);
  assert.ok(played.length > skipped.length, `more visits were skipped (${skipped.length}) than played (${played.length})`);
  // Each played visit has an encounter opened just before it.
  for (const visit of played) {
    const opened = snapshot.events.find(event => event.type === 'CROSS_PATHS'
      && event.occurredAt <= visit.occurredAt && visit.occurredAt - event.occurredAt <= 25 * 60_000);
    assert.ok(opened, 'a visit played without anybody having crossed paths first');
  }
});

test('the page can draw every voice the world can write', () => {
  // The scene player used to be hardwired to Goaden on the left and Ashai on
  // the right. A Legion scene can have three speakers and need not include
  // either of them, so the player must know all six.
  const source = readFileSync(new URL('../../worldstream/app/app.js', import.meta.url), 'utf8');
  for (const who of ['goaden', 'ashai', ...LEGION_IDS]) {
    assert.ok(new RegExp(`\\b${who}\\s*:`).test(source), `the page has no plate set for ${who}`);
    assert.ok(source.includes(`${who}:`), who);
  }
  assert.ok(source.includes('slotFor'), 'the player still assigns plates by hardcoded identity');
});
