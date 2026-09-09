import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app = readFileSync(new URL('../../worldstream/app/app.js', import.meta.url), 'utf8');
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const presence = between('let presenceInFlight = null;', '// Every viewer polls the same cache.');
const lifecycle = between('async function resumeWatching() {', 'elements.refresh.addEventListener');

function harness({ origin = '', token = 'existing', beacon = true, pending = false } = {}) {
  const document = { visibilityState: 'visible' }, beacons = [], requests = [], actions = [];
  let resolvePing;
  const response = () => ({ ok: true, json: async () => ({ viewerToken: 'issued' }) });
  const context = { document, VIEWER_TOKEN_KEY: 'viewer-token', viewerSessionId: 'tab',
    viewerToken: token, sessionStorage: { setItem() {} },
    apiUrl: path => `${origin}${path}`,
    navigator: { sendBeacon(url, body) { beacons.push({ url, body }); return beacon; } },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true }; },
    viewerFetch: async () => { actions.push('ping'); return pending
      ? new Promise(resolve => { resolvePing = () => resolve(response()); }) : response(); },
    scene: { resume: () => actions.push('resume'), suspend: () => actions.push('suspend') },
    refreshWorld: async () => actions.push('observe'),
  };
  const api = runInNewContext(`${presence}\n${lifecycle}\n({updatePresence,resumeWatching,leaveWatching})`, context);
  return { ...api, document, beacons, requests, actions, resolvePing: () => resolvePing() };
}

test('leaving reaches the configured backend with a simple token body', () => {
  for (const origin of ['', 'https://world.example']) {
    const f = harness({ origin });
    f.leaveWatching();
    assert.equal(f.beacons[0].url, `${origin}/api/presence/leave`);
    assert.equal(typeof f.beacons[0].body, 'string', 'no cross-origin preflight needed');
    assert.deepEqual(JSON.parse(f.beacons[0].body), { viewerToken: 'existing' });
    assert.equal(f.requests.length, 0);
  }
});

test('a refused beacon falls back to a keepalive request without credentials', () => {
  const f = harness({ origin: 'https://world.example', beacon: false });
  f.leaveWatching();
  assert.equal(f.requests[0].url, 'https://world.example/api/presence/leave');
  assert.equal(f.requests[0].options.keepalive, true);
  assert.equal(f.requests[0].options.credentials, 'omit');
  assert.equal(f.requests[0].options.headers['Content-Type'], 'text/plain;charset=UTF-8');
});

test('leaving during the first handshake retires its late token and never observes', async () => {
  const f = harness({ token: null, pending: true });
  const resume = f.resumeWatching();
  f.document.visibilityState = 'hidden';
  f.leaveWatching();
  f.resolvePing();
  await resume;
  assert.deepEqual(f.actions, ['ping', 'suspend', 'suspend']);
  assert.deepEqual(JSON.parse(f.beacons[0].body), { viewerToken: 'issued' });
});

test('hidden tabs send no heartbeats, while a returning tab observes after its handshake', async () => {
  const f = harness();
  f.document.visibilityState = 'hidden';
  await f.updatePresence(); await f.resumeWatching();
  assert.deepEqual(f.actions, []);
  f.document.visibilityState = 'visible';
  await f.resumeWatching();
  assert.deepEqual(f.actions, ['ping', 'resume', 'observe']);
});

test('a startup retry does not observe after the reader leaves during backoff', async () => {
  const document = { visibilityState: 'visible' }, calls = [];
  const refresh = runInNewContext(`${between('async function refreshWorld() {', 'function setupCourierNotificationToggle() {')}\nrefreshWorld`, {
    document, refreshing: false, hasWorld: false, AbortSignal,
    elements: { refresh: {}, connection: { dataset: {} } }, readingLiveStatus: null,
    viewerFetch: async () => { calls.push('observe'); throw new Error('Disconnected'); },
    setTimeout(resolve) { document.visibilityState = 'hidden'; resolve(); },
    console: { error() {} },
  });
  await refresh();
  assert.deepEqual(calls, ['observe']);
});
