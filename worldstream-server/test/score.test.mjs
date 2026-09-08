import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const slugify = name => name.replace(/\.mp3$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

test('every track the page asks for is a file the server can serve', () => {
  // The score is grouped into moods in app.js by slug. A slug that does not
  // match a file is a track that silently never plays, which is the one bug in
  // an audio layer nobody notices for weeks.
  const source = readFileSync(join(root, '..', 'worldstream', 'app', 'app.js'), 'utf8');
  const block = source.slice(source.indexOf('const MOODS = {'), source.indexOf('const btn = document.querySelector'));
  assert.ok(block.length > 100, 'could not find the mood table');
  const asked = [...block.matchAll(/'([a-z0-9-]+)'/g)].map(match => match[1]).filter(slug => slug.includes('-') || slug.length > 6);
  // Track audio lives in the app, which is what the static site serves and the
  // only copy in the repository. Files there are already named by slug, so no
  // slugify step: the filename *is* the URL the page asks for.
  const onDisk = new Set(readdirSync(join(root, '..', 'worldstream', 'app', 'audio'))
    .filter(file => file.toLowerCase().endsWith('.mp3'))
    .map(file => file.replace(/\.mp3$/i, '')));
  assert.ok(onDisk.size >= 5, `expected the score on disk, found ${onDisk.size}`);
  const moodNames = new Set(['night', 'play', 'pressure', 'ordinary']);
  for (const slug of asked) {
    if (moodNames.has(slug)) continue;
    assert.ok(onDisk.has(slug), `app.js asks for /audio/${slug}.mp3, which is not in worldstream/app/audio/`);
  }
});

test('a track dropped into worldstream/app/audio is played without a code change', () => {
  // The point of the reconciliation: adding a file is the whole job. Anything
  // no mood names joins UNCLAIMED_JOIN rather than being shipped unheard, and a
  // slug whose file has gone is dropped rather than played into silence.
  const source = readFileSync(join(root, '..', 'worldstream', 'app', 'app.js'), 'utf8');
  assert.ok(/const UNCLAIMED_JOIN = '(night|play|pressure|ordinary)';/.test(source),
    'there is no home for an unclaimed track');
  assert.ok(source.includes('if (!claimed.has(slug)) next[UNCLAIMED_JOIN].push(slug)'),
    'unclaimed tracks are not adopted');
  assert.ok(source.includes('list.filter(slug => onDisk.has(slug))'),
    'a mood can still name a track that does not exist');
  // The night state is the one that asked for a second track, so it is the one
  // a new file lands in.
  assert.ok(/const UNCLAIMED_JOIN = 'night';/.test(source));
});

test('no mood can end up looping a short pool', () => {
  const source = readFileSync(join(root, '..', 'worldstream', 'app', 'app.js'), 'utf8');
  // The minimum is asserted as a property rather than as a literal, because
  // pinning the literal is what let the real bug through: the guard was set to
  // two, `pressure` declared exactly two, so the top-up never fired for the
  // mood holding 30% of all listening time. Three minutes thirty-six of music
  // against stretches of up to forty-eight hours. See lab/MUSIC-CHECK.md.
  const minimum = /const MIN_TRACKS = (\d+);/.exec(source);
  assert.ok(minimum, 'there is no minimum');
  assert.ok(Number(minimum[1]) >= 4,
    `MIN_TRACKS is ${minimum[1]}; a mood that can run for a whole day needs more than that`);
  assert.ok(/const NEIGHBOUR = \{/.test(source), 'a short mood has nowhere to borrow from');
  assert.ok(source.includes('if (next[name].length >= MIN_TRACKS) break;'), 'the top-up never runs');
  // Rotation must be per mood. A single shared counter aliases against the pool
  // sizes: alternating between two moods steps it by two each time a given mood
  // comes round, so a two-track mood lands on the same index every visit and
  // its second track never plays at all.
  assert.ok(/const rotation = \{\};/.test(source), 'rotation is not per mood');
  assert.ok(source.includes('rotation[name] = (rotation[name] ?? -1) + 1;'),
    'rotation is not keyed by mood');
  assert.ok(!/rotation\+\+/.test(source), 'a shared rotation counter is still in use');
  // Every mood declares at least one track of its own to build from.
  const block = source.slice(source.indexOf('const MOODS = {'), source.indexOf('const btn = document.querySelector'));
  for (const mood of ['night', 'play', 'pressure', 'ordinary']) {
    const start = block.indexOf(`${mood}: [`);
    assert.ok(start >= 0, `${mood} is not declared`);
    const declared = block.slice(start + mood.length + 3, block.indexOf(']', start));
    const named = declared.split(',').map(part => part.trim()).filter(Boolean);
    // Every mood names its own two, so the runtime top-up is a safety net
    // rather than something the score relies on to sound varied.
    assert.ok(named.length >= 2, `${mood} declares only ${named.join(', ')}`);
  }
});

test('no track serves two moods', () => {
  // The other half of the same bug. `tiny-rebel` sat in both `pressure` and
  // `ordinary` — the two largest moods, 63% of listening time between them —
  // which made it the most-played track in the score by 44%: a hundred and
  // fifty-six hours a month against seven for each arcade track, a spread of
  // twenty-two to one. A track may still be *borrowed* at runtime by a short
  // mood; what it may not do is be declared twice and quietly double its share.
  const source = readFileSync(join(root, '..', 'worldstream', 'app', 'app.js'), 'utf8');
  const block = source.slice(source.indexOf('const MOODS = {'), source.indexOf('const btn = document.querySelector'));
  const seen = new Map();
  for (const mood of ['night', 'play', 'pressure', 'ordinary']) {
    const start = block.indexOf(`${mood}: [`);
    const declared = block.slice(start + mood.length + 3, block.indexOf(']', start));
    for (const slug of [...declared.matchAll(/'([a-z0-9-]+)'/g)].map(match => match[1])) {
      assert.ok(!seen.has(slug),
        `${slug} is declared in both ${seen.get(slug)} and ${mood}; it will play far more than anything else`);
      seen.set(slug, mood);
    }
  }
});

test('a mood outlasts its tracks, so the score carries itself', () => {
  // The bug this guards is the quietest kind. With `loop` on the elements a
  // track never fires `ended`, and rotation only ran on a mood change — so the
  // small hours, which last for hours, sat on one song all night and looked for
  // all the world like a broken playlist.
  const html = readFileSync(join(root, '..', 'worldstream', 'app', 'index.html'), 'utf8');
  const elements = html.match(/<audio[^>]*>/g) || [];
  assert.ok(elements.length >= 2, 'the score needs two elements to crossfade');
  for (const element of elements) {
    assert.ok(!/loop/.test(element), `a score element still loops: ${element}`);
  }
  const source = readFileSync(join(root, '..', 'worldstream', 'app', 'app.js'), 'utf8');
  assert.ok(source.includes("player.addEventListener('ended'"), 'nothing advances the score');
  assert.ok(/function advance\(name\)/.test(source), 'there is no in-mood step');
  // A mood with a single track still repeats rather than falling silent.
  assert.ok(source.includes('if (bankFor(mood).length < 2)'), 'a one-track mood would stop dead');
});

test('the page is allowed to load audio at all', () => {
  // default-src 'none' blocks every <audio> fetch without an explicit
  // media-src, and it fails silently — no console error, just no sound.
  const server = readFileSync(join(root, 'server.mjs'), 'utf8');
  const csp = /'Content-Security-Policy': "([^"]+)"/.exec(server);
  assert.ok(csp, 'no CSP found');
  assert.ok(/media-src 'self'/.test(csp[1]), 'the CSP does not permit audio');
  assert.ok(/default-src 'none'/.test(csp[1]), 'the CSP should still deny by default');
  // Media is served with ranges, which Safari requires before it will play at all.
  assert.ok(server.includes("'Accept-Ranges': 'bytes'"), 'audio is served without range support');
  assert.ok(server.includes('206'), 'no partial-content response');
});

test('the score follows the world rather than shuffling at it', () => {
  const source = readFileSync(join(root, '..', 'worldstream', 'app', 'app.js'), 'utf8');
  // The mood is derived from public projection fields only — no private state
  // reaches the presentation layer here any more than anywhere else.
  //
  // This used to slice app.js between two function names, which silently became
  // an empty string the moment the policy was extracted to its own module — the
  // rail did not weaken, the test just stopped reading anything. It now reads
  // the file the policy actually lives in.
  const moodFor = readFileSync(join(root, '..', 'worldstream', 'app', 'score-mood.js'), 'utf8');
  assert.ok(moodFor.includes('export function scoreMood'), 'the score policy has moved again');
  assert.ok(moodFor.includes('daypart'), 'the score ignores the hour');
  assert.ok(moodFor.includes('activity'), 'the score ignores what they are doing');
  assert.ok(moodFor.includes('factions'), 'the score ignores the city');
  for (const forbidden of ['concern', 'irritation', 'trust', 'knowledge', 'director']) {
    assert.ok(!moodFor.includes(forbidden), `the score reads private state: ${forbidden}`);
  }
  // A track changes only when the mood does, so a quiet afternoon is not a playlist.
  assert.ok(/if \(wanted === mood && playing\) return;/.test(source), 'the score re-picks on every render');
});

test('the now-playing title stays out of the way', () => {
  const css = readFileSync(join(root, '..', 'worldstream', 'app', 'style.css'), 'utf8');
  const chip = css.slice(css.indexOf('.now-playing {'), css.indexOf('.now-playing.is-announcing'));
  assert.ok(/position: fixed/.test(chip), 'the chip should not sit in the flow');
  assert.ok(/pointer-events: none/.test(chip), 'the chip must not eat clicks');
  assert.ok(/opacity: \.[0-3]/.test(chip), 'the chip should rest faint');
  // It announces, then recedes, and disappears entirely under a scene.
  assert.ok(css.includes('.now-playing.is-announcing'), 'the chip never becomes legible');
  assert.ok(css.includes('body.scene-open .now-playing'), 'the chip overlaps the scene stage');
});

test('the backdrop is not blurred', () => {
  // blur(2px) was buying readability the card scrims and page gradient already
  // pay for, at the cost of the art being legible as art.
  const css = readFileSync(join(root, '..', 'worldstream', 'app', 'style.css'), 'utf8');
  const layer = css.slice(css.indexOf('.world-backdrop-layer'), css.indexOf('.world-backdrop-layer.is-visible'));
  assert.ok(!/filter:[^;]*blur\(/.test(layer), 'the world backdrop is blurred again');
});
