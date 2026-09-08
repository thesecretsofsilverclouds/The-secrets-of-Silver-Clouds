import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, existsSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStartupWorld } from '../src/startup-world.mjs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { RULES_VERSION } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';

const START = atLondon('2026-09-04', '00:00');

function storage(t) {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-startup-test-'));
  t.after(() => {
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-startup-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  return directory;
}

function files(directory) {
  return Object.fromEntries(readdirSync(directory).sort().map(name => [name, readFileSync(join(directory, name))]));
}

function seedCurrent(dbPath) {
  const world = openWorld({ dbPath, seed: 'startup-preserved-seed', startMs: START });
  try {
    world.advance(START + 6 * 60 * 60_000);
    return semanticDigest(world.semanticSnapshot());
  } finally { world.close(); }
}

test('normal startup reopens the matching saved epoch, seed and history even when older worlds remain', t => {
  const directory = storage(t);
  const dbPath = join(directory, `world-${RULES_VERSION}.sqlite`);
  const before = seedCurrent(dbPath);
  writeFileSync(join(directory, 'world-previous-rules.sqlite'), 'older world must remain untouched');
  const world = openStartupWorld({ dataDirectory: directory });
  try { assert.equal(semanticDigest(world.semanticSnapshot()), before); }
  finally { world.close(); }
  assert.equal(readFileSync(join(directory, 'world-previous-rules.sqlite'), 'utf8'), 'older world must remain untouched');
});

test('normal startup refuses an implicit new version without creating or altering any saved file', t => {
  const directory = storage(t);
  writeFileSync(join(directory, 'world-previous-rules.sqlite'), 'old canonical world');
  writeFileSync(join(directory, 'world-previous-rules.sqlite-wal'), 'saved journal');
  const before = files(directory);
  assert.throws(() => openStartupWorld({ dataDirectory: directory }), error =>
    error.code === 'SAVED_WORLD_REQUIRES_REVIEW' && /Refusing to silently create/.test(error.message));
  assert.equal(existsSync(join(directory, `world-${RULES_VERSION}.sqlite`)), false);
  assert.deepEqual(files(directory), before);
});

test('an explicitly selected mismatched database is refused before WAL or schema writes', t => {
  const directory = storage(t);
  const dbPath = join(directory, 'chosen.sqlite');
  seedCurrent(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = DELETE');
  const row = db.prepare('SELECT rules_version FROM world_state WHERE id = 1').get();
  const identity = JSON.parse(row.rules_version.slice('fixture:'.length));
  identity[1] = 'previous-content-version';
  db.prepare('UPDATE world_state SET rules_version = ? WHERE id = 1').run(`fixture:${JSON.stringify(identity)}`);
  db.close();
  const before = files(directory);
  assert.throws(() => openStartupWorld({ dataDirectory: directory, dbPath }), /does not match rules/);
  assert.deepEqual(files(directory), before);
});

test('fresh normal startup creates the canonical database in an empty directory', t => {
  const directory = storage(t);
  const world = openStartupWorld({ dataDirectory: directory, startMs: START });
  try { assert.equal(world.semanticSnapshot().world.rulesVersion, RULES_VERSION); }
  finally { world.close(); }
  assert.equal(existsSync(join(directory, `world-${RULES_VERSION}.sqlite`)), true);
});

test('fresh normal startup can create a new data directory and ignores social/presentation files', t => {
  const parent = storage(t);
  const directory = join(parent, 'new-data');
  let world = openStartupWorld({ dataDirectory: directory, startMs: START });
  world.close();
  const otherDirectory = join(parent, 'social-only');
  mkdirSync(otherDirectory);
  writeFileSync(join(otherDirectory, 'world.sqlite'), 'social store');
  writeFileSync(join(otherDirectory, 'worldstream-cinematics.sqlite'), 'presentation store');
  world = openStartupWorld({ dataDirectory: otherDirectory, startMs: START });
  world.close();
  // The regular data directory itself is created by WorldStore when needed.
  assert.equal(existsSync(directory), true);
  assert.equal(existsSync(join(otherDirectory, `world-${RULES_VERSION}.sqlite`)), true);
  assert.equal(readFileSync(join(otherDirectory, 'world.sqlite'), 'utf8'), 'social store');
  assert.equal(readFileSync(join(otherDirectory, 'worldstream-cinematics.sqlite'), 'utf8'), 'presentation store');
});

test('an explicit new isolated path is allowed without replacing or touching older saves', t => {
  const directory = storage(t);
  const oldPath = join(directory, 'world-previous-rules.sqlite');
  writeFileSync(oldPath, 'old canonical world');
  const dbPath = join(directory, 'author-verification.sqlite');
  const world = openStartupWorld({ dataDirectory: directory, dbPath, startMs: START });
  try { assert.equal(world.semanticSnapshot().world.rulesVersion, RULES_VERSION); }
  finally { world.close(); }
  assert.equal(readFileSync(oldPath, 'utf8'), 'old canonical world');
  assert.equal(existsSync(join(directory, `world-${RULES_VERSION}.sqlite`)), false);
  assert.equal(existsSync(dbPath), true);
});

test('an existing unrelated or empty database cannot be silently repurposed as a world', t => {
  const directory = storage(t);
  const dbPath = join(directory, 'unrelated.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE user_data (value TEXT); INSERT INTO user_data VALUES (\'preserve me\')');
  db.close();
  const before = files(directory);
  assert.throws(() => openStartupWorld({ dbPath }), /is not a saved Silver Clouds world/);
  assert.deepEqual(files(directory), before);
});

test('requested epoch or seed mismatches are refused without changing the compatible saved world', t => {
  const directory = storage(t);
  const dbPath = join(directory, `world-${RULES_VERSION}.sqlite`);
  seedCurrent(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = DELETE');
  db.close();
  const before = files(directory);
  assert.throws(() => openStartupWorld({ dataDirectory: directory, seed: 'different' }), /requested seed differs/);
  assert.throws(() => openStartupWorld({ dataDirectory: directory, startMs: START + 60_000 }), /requested epoch differs/);
  assert.deepEqual(files(directory), before);
});
