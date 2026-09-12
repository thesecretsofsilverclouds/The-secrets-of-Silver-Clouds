import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS_BY_LOCATION, SEALED_AREAS } from '../src/places.mjs';
import { LEGION_CAST, OUTSIDE_CAST, SIDE_CHARACTERS, STREET_FAUNA } from '../src/cast.mjs';
import { SCENE_BANK_CATALOG } from '../src/scene-bank-catalog.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = readFileSync(join(root, '..', 'worldstream', 'app', 'app.js'), 'utf8');
const scene = name => join(root, '..', 'worldstream', 'app', 'scene', name);

// The page joins artwork to a room by the world's own display name for the
// area. That join is a pair of string literals in two different files, so a
// renamed room or a typo would not throw — the artwork would just silently
// stop appearing. These tests are the join.
function block(label) {
  const start = [`const ${label} = Object.freeze({`, `const ${label} = {`]
    .map(form => app.indexOf(form)).find(index => index >= 0) ?? -1;
  assert.ok(start >= 0, `${label} is missing from app.js`);
  const end = app.indexOf('});', start);
  return app.slice(start, end);
}

test('every room with artwork is a room the simulation actually has', () => {
  const art = block('MI6_ROOM_ART');
  const rooms = [...art.matchAll(/^\s*'([^']+)':\s*\{/gm)].map(match => match[1]);
  assert.ok(rooms.length >= 8, `only ${rooms.length} rooms mapped`);
  const known = new Set(Object.values(AREAS_BY_LOCATION.mi6).map(area => area.name));
  for (const room of rooms) assert.ok(known.has(room), `"${room}" is not an MI6 area name`);
  // And the reverse, so a new area with art cannot be forgotten here: every
  // area either has artwork or is deliberately left on the general interior.
  const withoutArt = [...known].filter(name => !rooms.includes(name));
  assert.deepEqual(withoutArt.sort(), ['MI6 reception', 'the MI6 corridors', 'the MI6 rooftop', 'the quarters'],
    'an MI6 area gained or lost artwork without this test being updated');
});

test('every backdrop the page can ask for is a file that exists', () => {
  const table = block('WORLD_BACKDROPS');
  const files = [...table.matchAll(/'\/worldstream\/app\/scene\/([^']+)'/g)].map(match => match[1]);
  assert.ok(files.length >= 20, `only ${files.length} backdrops declared`);
  for (const file of new Set(files)) assert.ok(existsSync(scene(file)), `missing backdrop: ${file}`);
  // The scene stage loads the same artwork by basename rather than by path.
  for (const [, basename] of block('MI6_ROOM_ART').matchAll(/file:\s*'([^']+)'/g))
    assert.ok(existsSync(scene(`${basename}.jpg`)), `missing scene backdrop: ${basename}.jpg`);
});

test('the sealed basement keeps its artwork and still cannot be walked into', () => {
  // The door is painted shut on purpose. The art is wired so that it is ready
  // if the area is ever opened, and the area is still sealed, so it will not
  // appear on its own before then.
  assert.ok(block('MI6_ROOM_ART').includes("'the basement'"));
  assert.ok(SEALED_AREAS.includes('basement'));
  assert.deepEqual([...SEALED_AREAS].sort(), ['basement', 'information_room']);
});

test('every plate the page declares has art, and every plated character is cast', () => {
  const sets = block('PLATE_SETS');
  const rows = [...sets.matchAll(/^\s*([a-z_]+):\{\s*has:(?:new Set\(\[([^\]]*)\]\)|([A-Z_]+))/gm)];
  assert.ok(rows.length >= 14, `only ${rows.length} plate sets parsed`);
  const rosters = { ...LEGION_CAST, ...OUTSIDE_CAST, ...STREET_FAUNA, ...SIDE_CHARACTERS };
  // Approved extras may sit on the page without becoming simulation actors.
  const presentationExtras = new Set(['onari_contractor', 'onari_protester']);
  for (const extra of presentationExtras) {
    assert.ok(!rosters[extra], `${extra} must stay a presentation extra, not a runtime actor`);
  }
  for (const [, who, inline] of rows) {
    if (['goaden', 'ashai'].includes(who)) continue;
    assert.ok(rosters[who] || presentationExtras.has(who)
      || SCENE_BANK_CATALOG.some(entry => entry.status === 'enabled' && entry.cast.includes(who)),
      `${who} has plates on the page but is in no cast roster or enabled authored scene`);
    const fileOverride = sets.match(new RegExp(`${who}:\\{[\\s\\S]*?file:'([^']+)'`));
    if (fileOverride && presentationExtras.has(who)) {
      assert.ok(existsSync(scene(fileOverride[1])), `missing plate art: ${fileOverride[1]}`);
      continue;
    }
    for (const expression of (inline ?? '').split(',').map(part => part.trim().replace(/'/g, '')).filter(Boolean))
      assert.ok(existsSync(scene(`${who}-${expression}.png`)), `missing plate art: ${who}-${expression}.png`);
  }
});
