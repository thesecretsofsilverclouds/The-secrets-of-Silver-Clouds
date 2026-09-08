import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { openAudienceStore } from '../src/audience-store.mjs';
import { ViewerRegistry } from '../src/cinematic-service.mjs';

const START = Date.parse('2026-09-06T09:00:00Z');
async function setup(t) {
  let clock = START, advances = 0;
  const audience = openAudienceStore({ dbPath: ':memory:', ttlMs: 60_000 });
  const viewers = new ViewerRegistry();
  const projection = { worldId: 'audience-test', resolvedThrough: START, characters: [], events: [] };
  const world = { advance() { advances++; }, publicProjection: () => structuredClone(projection),
    semanticSnapshot: () => ({ world: { resolvedThrough: START }, events: [], characters: {} }) };
  const server = createApp({ world, audienceStore: audience, viewerRegistry: viewers,
    cinematicClient: null, cinematicOptions: { enabled: false }, now: () => clock });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); audience.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { audience, viewers, base, tick: ms => { clock += ms; }, now: () => clock,
    advances: () => advances, projection,
    ping: async (token, body = {}) => fetch(`${base}/api/presence/ping`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-viewer-token': token } : {}) },
      body: JSON.stringify(body) }).then(response => response.json()) };
}
const PRIVATE = new Set(['presence', 'watching', 'activeViewers', 'activeConnections', 'activeSessions',
  'baseline', 'audience', 'sessionStarts', 'peakSessions', 'activeSinceMs']);
function noAudience(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) { assert.ok(!PRIVATE.has(key), `Private field ${key}`); noAudience(nested); }
}

test('actual heartbeats drive private telemetry and cinematic presence without changing the world', async t => {
  const f = await setup(t);
  const readBefore = await fetch(`${f.base}/api/world`).then(r => r.json());
  for (const path of ['/api/world', '/api/presence', '/api/presence/ping', '/api/cinematics/status']) {
    noAudience(await fetch(f.base + path).then(r => r.json()));
  }
  assert.equal(f.audience.summary(f.now()).activeSessions, 0);
  assert.equal(f.viewers.snapshot(f.now()).count, 0);
  const first = await f.ping(null, { count: 900, watching: 900, clientId: 'not-an-identity' });
  noAudience(first);
  assert.deepEqual(Object.keys(first).sort(), ['ok', 'serverTime', 'viewerToken']);
  assert.equal(f.audience.summary(f.now()).activeSessions, 1);
  assert.equal(f.audience.summary(f.now()).today.sessionStarts, 1);
  await Promise.all(Array.from({ length: 5 }, () => f.ping(first.viewerToken)));
  assert.equal(f.audience.summary(f.now()).activeSessions, 1);
  assert.equal(f.audience.summary(f.now()).today.sessionStarts, 1);
  await f.ping();
  assert.equal(f.audience.summary(f.now()).activeSessions, 2);
  assert.equal(f.audience.summary(f.now()).today.peakSessions, 2);
  assert.equal(f.viewers.snapshot(f.now()).count, 2);
  assert.deepEqual(await fetch(`${f.base}/api/world`).then(r => r.json()), readBefore);
  assert.equal(f.advances(), 0);
  noAudience(await fetch(`${f.base}/api/observe`, { method: 'POST' }).then(r => r.json()));
  assert.equal(f.advances(), 1);
});

test('leaving and expiry remove actual sessions; an unknown leave cannot remove a reader', async t => {
  const f = await setup(t), one = await f.ping(), two = await f.ping();
  const leave = token => fetch(`${f.base}/api/presence/leave`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ viewerToken: token }) });
  await leave('invented-token');
  assert.equal(f.audience.summary(f.now()).activeSessions, 2);
  await leave(one.viewerToken);
  assert.equal(f.audience.summary(f.now()).activeSessions, 1);
  assert.equal(f.viewers.snapshot(f.now()).count, 1);
  f.tick(60_001);
  assert.equal(f.audience.summary(f.now()).activeSessions, 0);
  assert.equal(f.viewers.snapshot(f.now()).count, 0);
  await f.ping(two.viewerToken);
  assert.equal(f.audience.summary(f.now()).activeSessions, 1);
  assert.equal(f.audience.summary(f.now()).today.sessionStarts, 3);
  assert.equal(f.audience.summary(f.now()).today.peakSessions, 2);
});

test('no public owner route or database download exists and rejected requests never count', async t => {
  const f = await setup(t);
  for (const path of ['/api/audience', '/api/admin/audience', '/owner/audience', '/audience.sqlite',
    '/data/worldstream-final-review-v21/audience.sqlite', '/scripts/audience.mjs']) {
    assert.equal((await fetch(f.base + path)).status, 404, path);
  }
  assert.equal((await fetch(`${f.base}/api/presence/ping`, { method: 'POST',
    headers: { Origin: 'https://unrelated.example' } })).status, 403);
  assert.equal((await fetch(`${f.base}/api/presence/ping`, { method: 'POST',
    body: '{' })).status, 400);
  assert.equal(f.audience.summary(f.now()).activeSessions, 0);
  assert.equal(f.audience.summary(f.now()).today.sessionStarts, 0);
});
