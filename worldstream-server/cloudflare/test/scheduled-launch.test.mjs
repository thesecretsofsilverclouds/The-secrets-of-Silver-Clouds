import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The world opens at an appointed minute, and not before.
//
// A Durable Object begins to exist the first time anything fetches its stub,
// and it fixes its epoch at that moment and keeps it. So "launch at five" is
// not a matter of announcing it: every route has to answer without reaching the
// object until the appointed instant, or an uptime check at lunchtime quietly
// starts the world with the wrong history behind it.
//
// These exercise the two halves of that — the closed door, and the one caller
// allowed through early to open it.

const worker = (await import('../src/worker.mjs')).default;
const config = readFileSync(fileURLToPath(new URL('../wrangler.toml', import.meta.url)), 'utf8');

const OPENS = Date.parse('2026-09-10T16:00:00Z');   // 17:00 Europe/London

/** A binding that records every stub fetch, so "never touched" is checkable. */
function binding() {
  const calls = [];
  return {
    calls,
    idFromName(name) { return { name }; },
    get(id) {
      return { fetch(input, init) { calls.push({ world: id.name, url: String(input), method: init?.method ?? 'GET' }); return new Response('{}'); } };
    },
  };
}
const env = (extra = {}) => ({ WORLD_ID: 'worldstream-production', LAUNCH_MS: String(OPENS), WORLD_DO: binding(), ...extra });
const ask = (path = '/api/observe') => new Request(`https://worldstream.example${path}`, { method: 'POST' });
const context = () => ({ waitUntil(promise) { this.work = promise; } });

test('before the opening instant no request reaches the world', async () => {
  const world = env();
  const at = OPENS - 60_000;
  const clock = Date.now;
  Date.now = () => at;
  try {
    for (const path of ['/api/observe', '/api/history', '/api/dispatch/latest', '/anything']) {
      const answer = await worker.fetch(ask(path), world, context());
      assert.equal(answer.status, 503, `${path} must not be served early`);
      const body = await answer.json();
      assert.equal(body.status, 'not_open');
      assert.equal(body.opensAt, OPENS);
      assert.ok(Number(answer.headers.get('Retry-After')) > 0);
    }
  } finally { Date.now = clock; }
  assert.deepEqual(world.WORLD_DO.calls, [], 'the Durable Object was created before its time');
});

test('the health check answers early without creating the world', async () => {
  const world = env();
  const clock = Date.now;
  Date.now = () => OPENS - 3_600_000;
  try {
    const answer = await worker.fetch(new Request('https://worldstream.example/worker-health'), world, context());
    assert.equal(answer.status, 200);
  } finally { Date.now = clock; }
  assert.deepEqual(world.WORLD_DO.calls, [], 'a health check must never start the world');
});

test('at the opening instant the route serves the world', async () => {
  const world = env();
  const clock = Date.now;
  Date.now = () => OPENS;
  try {
    const answer = await worker.fetch(ask(), world, context());
    assert.notEqual(answer.status, 503);
  } finally { Date.now = clock; }
  assert.equal(world.WORLD_DO.calls.length, 1);
  assert.equal(world.WORLD_DO.calls[0].world, 'worldstream-production');
});

test('the scheduled trigger creates the world once, only inside its window', async () => {
  const clock = Date.now;
  try {
    // Too early in the day, and any firing after the launch: both do nothing.
    for (const at of [OPENS - 6 * 3_600_000, OPENS - 16 * 60_000, OPENS, OPENS + 86_400_000]) {
      const world = env();
      Date.now = () => at;
      await worker.scheduled({}, world, context());
      assert.deepEqual(world.WORLD_DO.calls, [], `a firing at ${new Date(at).toISOString()} must be inert`);
    }
    // Five minutes before: this is the one that opens the world.
    const world = env();
    Date.now = () => OPENS - 5 * 60_000;
    const ctx = context();
    await worker.scheduled({}, world, ctx);
    await ctx.work;
    assert.equal(world.WORLD_DO.calls.length, 1);
    assert.equal(world.WORLD_DO.calls[0].world, 'worldstream-production');
    assert.match(world.WORLD_DO.calls[0].url, /\/api\/observe$/);
  } finally { Date.now = clock; }
});

test('an unset launch leaves development and staging ungated', async () => {
  const clock = Date.now;
  Date.now = () => OPENS - 86_400_000;
  try {
    for (const value of [undefined, '', 'soon', '0']) {
      const world = env({ LAUNCH_MS: value, WORLD_ID: 'worldstream-staging' });
      const answer = await worker.fetch(ask(), world, context());
      assert.notEqual(answer.status, 503);
      assert.equal(world.WORLD_DO.calls[0].world, 'worldstream-staging');
      // And nothing schedules a launch it was never given.
      const idle = env({ LAUNCH_MS: value });
      await worker.scheduled({}, idle, context());
      assert.deepEqual(idle.WORLD_DO.calls, []);
    }
  } finally { Date.now = clock; }
});

test('the deployed configuration names the appointed minute and the day it opens', () => {
  const production = config.slice(config.indexOf('[env.production]'));
  assert.match(production, /LAUNCH_MS = "1789056000000"/);
  assert.match(production, /START_MS = "1788994800000"/);
  assert.match(production, /crons = \["55 15 \* \* \*"\]/);
  // 15:55 UTC is 16:55 London, inside the fifteen minutes the trigger accepts.
  assert.ok(Date.parse('2026-09-10T15:55:00Z') < OPENS);
  assert.ok(Date.parse('2026-09-10T15:55:00Z') >= OPENS - 15 * 60_000);
  // The epoch is a London midnight, which the fixture requires, and it is the
  // same calendar day as the opening rather than an older one.
  assert.equal(Number('1788994800000'), Date.parse('2026-09-09T23:00:00Z'));
  // Staging is a different world and is never gated.
  const staging = config.slice(config.indexOf('[env.staging]'), config.indexOf('[env.production]'));
  assert.match(staging, /WORLD_ID = "worldstream-staging"/);
  assert.ok(!staging.includes('LAUNCH_MS'), 'staging must not inherit the launch gate');
  assert.ok(!staging.includes('START_MS'), 'staging must not inherit the production epoch');
});
