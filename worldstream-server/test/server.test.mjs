import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server.mjs';

const NOW = Date.parse('2026-09-04T13:23:00.000Z');

async function fixture(t, customWorld) {
  const advances = [];
  let reads = 0;
  const projection = {
    worldId: 'shared-test-world', resolvedThrough: NOW - 60_000,
    weather: { description: 'Light rain', temperatureC: 12, simulated: true },
    worldStatus: 'A quiet afternoon.', characters: [], events: [],
  };
  const world = customWorld || {
    advance(target) { advances.push(target); projection.resolvedThrough = target; },
    publicProjection() { reads++; return structuredClone(projection); },
  };
  const server = createApp({ world, now: () => NOW });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  return { base, advances, reads: () => reads, projection };
}

test('world reads are pure and observe advances only to the server clock', async (t) => {
  const f = await fixture(t);
  const initial = await fetch(`${f.base}/api/world`).then((response) => response.json());
  assert.equal(initial.resolvedThrough, NOW - 60_000);
  assert.equal(initial.serverTime, NOW);
  assert.deepEqual(f.advances, []);

  const observed = await fetch(`${f.base}/api/observe`, { method: 'POST' }).then((response) => response.json());
  assert.equal(observed.resolvedThrough, NOW);
  assert.deepEqual(f.advances, [NOW]);
  const secondReader = await fetch(`${f.base}/api/world`).then((response) => response.json());
  assert.deepEqual(secondReader, observed);
  assert.deepEqual(f.advances, [NOW]);
});

test('clients cannot supply target times, mutate with GET, or select a database', async (t) => {
  const f = await fixture(t);
  assert.equal((await fetch(`${f.base}/api/observe`)).status, 405);
  assert.equal((await fetch(`${f.base}/api/world`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${f.base}/api/observe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: NOW + 86_400_000 }),
  })).status, 400);
  assert.equal((await fetch(`${f.base}/api/observe?target=${NOW + 86_400_000}`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${f.base}/api/world?db=other.sqlite`)).status, 404);
  assert.deepEqual(f.advances, []);
  assert.equal(f.reads(), 0);
});

test('only the page assets and public API can be read', async (t) => {
  const f = await fixture(t);
  // The reader app is also mounted at /worldstream/app/, which is where the
  // website serves it. It is the same public page at a second address, not a
  // new exposure — /worldstream/app/index.html moved into this list from the
  // one below when the mount was added.
  for (const path of ['/', '/index.html', '/style.css', '/app.js',
    '/worldstream/app/', '/worldstream/app/index.html', '/worldstream/app/app.js']) {
    const response = await fetch(`${f.base}${path}`);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  }
  // ...and the mount must not become a way to reach anything the site root
  // refuses. Same list, prefixed.
  for (const path of ['/server.mjs', '/src/world.mjs', '/data/world.sqlite', '/package.json',
    '/worldstream/app/server.mjs', '/worldstream/app/src/world.mjs',
    '/worldstream/app/data/world.sqlite', '/worldstream/app/package.json',
    '/%2e%2e%2fdata%2fworld.sqlite']) {
    const response = await fetch(`${f.base}${path}`);
    assert.equal(response.status, 404, path);
    assert.deepEqual(await response.json(), { error: 'Not found.' });
  }
  assert.equal(f.reads(), 0);
});

test('foreign origins and Host headers cannot trigger world operations', async (t) => {
  const f = await fixture(t);
  const foreignOrigin = await fetch(`${f.base}/api/observe`, {
    method: 'POST', headers: { Origin: 'https://unrelated.example' },
  });
  assert.equal(foreignOrigin.status, 403);
  // Fetch normalizes Host; use a raw HTTP request to exercise DNS-rebinding
  // protection with the actual foreign header reaching the server.
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(`${f.base}/api/observe`, {
      method: 'POST', headers: { Host: 'unrelated.example' },
    }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
    request.end();
  });
  assert.equal(foreignHostStatus, 403);
  assert.deepEqual(f.advances, []);
  assert.equal(f.reads(), 0);
});

test('internal exceptions return a generic response without private state or paths', async (t) => {
  const secret = 'PRIVATE_MEMORY_SENTINEL C:/private/world.sqlite';
  const f = await fixture(t, {
    advance() { throw new Error(secret); },
    publicProjection() { throw new Error(secret); },
  });
  for (const [path, method] of [['/api/world', 'GET'], ['/api/observe', 'POST']]) {
    const response = await fetch(`${f.base}${path}`, { method });
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.ok(!body.includes('PRIVATE_MEMORY_SENTINEL'));
    assert.ok(!body.includes('world.sqlite'));
    assert.ok(!body.includes('Error:'));
  }
});
