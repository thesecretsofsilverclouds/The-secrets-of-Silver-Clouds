import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';

const ORIGINS = ['https://thesecretsofsilverclouds.com', 'https://www.thesecretsofsilverclouds.com'];

function harness({ cors = ORIGINS.join(','), status = 200, headers = {}, body = '{"preserved":true}', launchMs } = {}) {
  const calls = [];
  const env = {
    CORS_ORIGINS: cors, WORLD_ID: 'cors-contract-existing-world',
    ...(launchMs === undefined ? {} : { LAUNCH_MS: String(launchMs) }),
    WORLD_DO: {
      idFromName(name) { calls.push({ name }); return name; },
      get(id) { return { async fetch(request) {
        calls.push({ id, request });
        return new Response(body, { status, headers: { 'Access-Control-Allow-Origin': '*', ...headers } });
      } }; },
    },
  };
  const call = (origin, { method = 'GET', path = '/api/world', headers: requestHeaders = {} } = {}) => worker.fetch(
    new Request(`https://worldstream-api.thesecretsofsilverclouds.co.uk${path}`, {
      method, headers: { ...(origin === undefined ? {} : { Origin: origin }), ...requestHeaders },
    }), env, {},
  );
  return { call, calls, env };
}

function assertOrigin(response, expected) {
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), expected);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  const vary = response.headers.get('Vary').split(',').map(value => value.trim().toLowerCase());
  assert.ok(vary.includes('origin') || vary.includes('*'));
}

test('both configured reader origins receive matching preflight and actual response policies', async () => {
  for (const origin of ORIGINS) {
    const preflight = harness();
    const response = await preflight.call(origin, { method: 'OPTIONS', headers: {
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-client-id,x-viewer-token',
    } });
    assert.equal(response.status, 204);
    assertOrigin(response, origin);
    assert.deepEqual(preflight.calls, [], 'preflight must not reach or initialize a world');
    assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization, x-client-id, x-viewer-token, Upgrade');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PUT, DELETE, OPTIONS');
    assert.equal(response.headers.get('Access-Control-Max-Age'), '86400');
    for (const status of [200, 503, 404]) {
      const upstream = harness({ status });
      const actual = await upstream.call(origin, { path: status === 404 ? '/api/missing' : '/api/world' });
      assert.equal(actual.status, status);
      assertOrigin(actual, origin);
      assert.equal(await actual.text(), '{"preserved":true}');
      assert.equal(upstream.calls[0].name, 'cors-contract-existing-world');
    }
  }
});

test('unlisted, localhost, and null origins never gain wildcard access on preflight or actual responses', async () => {
  for (const origin of ['https://unlisted.example', 'http://localhost:4323', 'http://127.0.0.1:4323', 'null']) {
    for (const method of ['OPTIONS', 'GET']) {
      const response = await harness().call(origin, { method });
      assertOrigin(response, ORIGINS[0]);
      assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), '*');
    }
  }
  assertOrigin(await harness().call(undefined), ORIGINS[0]);
});

test('forwarding preserves body and upstream headers while merging Vary case-insensitively', async () => {
  for (const [vary, expected] of [
    [undefined, 'Origin'], ['Accept-Encoding', 'Accept-Encoding, Origin'],
    ['Accept-Encoding, oRiGiN', 'Accept-Encoding, oRiGiN'], ['*', '*'],
  ]) {
    const h = harness({ status: 404, body: 'unaltered upstream bytes', headers: {
      'Content-Type': 'text/plain', 'X-Upstream-Trace': 'kept', 'Cache-Control': 'no-store',
      ...(vary === undefined ? {} : { Vary: vary }),
    } });
    const response = await h.call(ORIGINS[1], { path: '/api/missing?before=123' });
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'unaltered upstream bytes');
    assert.equal(response.headers.get('Vary'), expected);
    assert.equal(response.headers.get('Content-Type'), 'text/plain');
    assert.equal(response.headers.get('X-Upstream-Trace'), 'kept');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assertOrigin(response, ORIGINS[1]);
    assert.equal(new URL(h.calls[1].request.url).pathname, '/api/missing');
    assert.equal(new URL(h.calls[1].request.url).search, '?before=123');
  }
});

test('Worker health, not-open, and missing-binding responses also vary by the selected origin', async () => {
  for (const origin of ORIGINS) {
    const health = harness();
    const healthy = await health.call(origin, { path: '/worker-health' });
    assert.equal(healthy.status, 200); assertOrigin(healthy, origin);
    assert.deepEqual(health.calls, []);
    const closed = harness({ launchMs: Date.now() + 86400000 });
    const gated = await closed.call(origin);
    assert.equal(gated.status, 503); assertOrigin(gated, origin);
    assert.deepEqual(closed.calls, []);
    const missing = harness(); delete missing.env.WORLD_DO;
    const unavailable = await missing.call(origin);
    assert.equal(unavailable.status, 500); assertOrigin(unavailable, origin);
  }
});

test('explicit wildcard and unset development configurations keep their existing origin-reflection behavior', async () => {
  for (const cors of ['*', '']) {
    for (const method of ['OPTIONS', 'GET']) {
      const h = harness({ cors });
      assertOrigin(await h.call('http://localhost:4323', { method }), 'http://localhost:4323');
      assertOrigin(await h.call('https://development.example', { method }), 'https://development.example');
      assertOrigin(await h.call(undefined, { method }), '*');
    }
  }
});
