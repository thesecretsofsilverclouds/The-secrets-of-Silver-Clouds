import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// One Worker, many worlds — and no way between them.
//
// The Durable Object instance name *is* the world's identity: two names are two
// objects with two SQLite databases, and nothing in the Worker can reach across.
// This was hardcoded to 'authoritative-world', so staging and production would
// have shared one history — the first deploy would have written beta traffic
// into the world readers were meant to get.
//
// These check the routing rule itself rather than a live deployment: what name
// each configuration resolves to, and that a request cannot select one.

const worker = readFileSync(fileURLToPath(new URL('../src/worker.mjs', import.meta.url)), 'utf8');
const wrangler = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8');

/** The Worker's own rule, restated: which object a given env resolves to. */
const worldNameFor = (env) => (typeof env.WORLD_ID === 'string' && env.WORLD_ID.trim()
  ? env.WORLD_ID.trim() : 'authoritative-world');

/** A stub namespace that records the names it is asked for. */
function namespace() {
  const asked = [];
  return { asked, idFromName(name) { asked.push(name); return { name }; } };
}

test('the world is selected by WORLD_ID, not hardcoded', () => {
  assert.ok(!/idFromName\(\s*['"]authoritative-world['"]\s*\)/.test(worker),
    'the instance name must not be a literal in the routing call');
  assert.match(worker, /idFromName\(worldId\)/, 'it resolves a configured name');
});

test('each configuration names a different world', () => {
  const seen = new Map();
  for (const [label, env] of [
    ['local', { WORLD_ID: 'authoritative-world' }],
    ['staging', { WORLD_ID: 'worldstream-staging' }],
    ['production', { WORLD_ID: 'worldstream-v27' }],
  ]) {
    const name = worldNameFor(env);
    assert.ok(!seen.has(name), `${label} reuses ${seen.get(name)}'s world`);
    seen.set(name, label);
  }
  assert.equal(seen.size, 3, 'three configurations, three separate histories');
});

test('the declared deploy targets carry the required identities', () => {
  assert.match(wrangler, /WORLD_ID = "authoritative-world"/, 'local/default is preserved');
  assert.match(wrangler, /\[env\.staging\.vars\][\s\S]*?WORLD_ID = "worldstream-staging"/);
  const production = wrangler.match(/\[env\.production\]\s*([^]*?)(?=\n\[)/)?.[1];
  const productionVars = wrangler.match(/\[env\.production\.vars\]\s*([^]*?)(?=\n\[)/)?.[1];
  assert.match(production, /^main = "src\/production-worker\.mjs"$/m,
    'production must use the controlled deployment entry point');
  assert.match(productionVars, /^WORLD_ID = "worldstream-v30-preserved-20260920"$/m,
    'production must select the verified preserved copy');
  assert.match(productionVars, /^WORLD_MIGRATION_SOURCE_ID = "worldstream-v29-preserved-20260920"$/m,
    'the source world must remain named for preservation and rollback');
  assert.match(productionVars, /^WORLD_WRITER_PAUSED = "true"$/m,
    'the production writer must fail closed until an explicit verified resume');
});

test('an unset or blank WORLD_ID keeps the existing local world', () => {
  // A new default would silently start an empty world and orphan local history.
  for (const env of [{}, { WORLD_ID: '' }, { WORLD_ID: '   ' }, { WORLD_ID: 42 }]) {
    assert.equal(worldNameFor(env), 'authoritative-world');
  }
});

test('two worlds ask for two different objects, and neither can reach the other', () => {
  const staging = namespace();
  const production = namespace();
  staging.idFromName(worldNameFor({ WORLD_ID: 'worldstream-staging' }));
  production.idFromName(worldNameFor({ WORLD_ID: 'worldstream-production' }));
  assert.deepEqual(staging.asked, ['worldstream-staging']);
  assert.deepEqual(production.asked, ['worldstream-production']);
  assert.notEqual(staging.asked[0], production.asked[0]);
  // Storage in a Durable Object is reachable only from inside that object, so
  // distinct ids are the entire isolation guarantee. Nothing in the Worker
  // opens a database by path, which is what would let one world read another.
  assert.ok(!/DatabaseSync|\.sqlite/.test(worker),
    'the Worker must not open any database directly');
});

test('a request cannot choose which world it talks to', () => {
  // Otherwise a reader could point production traffic at staging, or worse.
  const routing = worker.slice(worker.indexOf('const worldId'), worker.indexOf('idFromName(worldId)'));
  for (const source of ['url.searchParams', 'request.headers', 'pathname', 'body']) {
    assert.ok(!routing.includes(source),
      `the world name must come from configuration, not ${source}`);
  }
});
