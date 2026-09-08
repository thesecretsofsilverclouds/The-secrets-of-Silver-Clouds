import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createApp } from '../server.mjs';
import { FEEDBACK_POLL, MAX_FEEDBACK_BODY_BYTES, openFeedbackStore } from '../src/feedback-store.mjs';

const NOW = Date.parse('2026-09-06T12:00:00Z');
const token = n => `deadbeef-cafe-4bad-8bee-${String(n).padStart(12, '0')}`;
const ballot = (n = 1, feature = 'continuing_threads', character = 'ashai') => ({
  pollId: FEEDBACK_POLL.id, voterToken: token(n), answers: { next_improvement: feature, character },
});

async function fixture(t) {
  let clock = NOW, reads = 0, advances = 0;
  const feedback = openFeedbackStore({ dbPath: ':memory:', now: () => clock });
  const world = {
    advance() { advances++; throw new Error('Feedback must never advance the world'); },
    publicProjection() { reads++; throw new Error('Feedback must not read the canonical world'); },
  };
  const server = createApp({ world, feedbackStore: feedback, now: () => clock,
    cinematicClient: null, cinematicOptions: { enabled: false } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((done, fail) => server.close(error => error ? fail(error) : done()));
    feedback.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, feedback, counters: () => ({ reads, advances }), advanceClock: ms => { clock += ms; },
    post: (body, options = {}) => fetch(`${base}/api/feedback`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...options }),
  };
}
const choiceCount = (summary, question, option) => summary.questions.find(row => row.id === question).options.find(row => row.id === option).count;
const assertPublic = value => assert.ok(!JSON.stringify(value).includes('deadbeef-cafe'), 'raw browser tokens must not be echoed');

test('HTTP feedback creates one shared ballot, acknowledges duplicate requests and replaces edited totals', async t => {
  const h = await fixture(t);
  const empty = await fetch(`${h.base}/api/feedback`).then(response => response.json());
  assert.equal(empty.totalBallots, 0); assert.equal(empty.pollId, FEEDBACK_POLL.id);
  const first = await h.post(ballot()); assert.equal(first.status, 200);
  const saved = await first.json(); assert.equal(saved.changed, true); assert.equal(saved.summary.totalBallots, 1); assertPublic(saved);
  const duplicates = await Promise.all([h.post(ballot()), h.post(ballot())]);
  for (const response of duplicates) {
    assert.equal(response.status, 200); const result = await response.json();
    assert.equal(result.changed, false); assert.equal(result.summary.totalBallots, 1); assertPublic(result);
  }
  h.advanceClock(2_000);
  const edited = await h.post(ballot(1, 'faction_intrigue', null)).then(response => response.json());
  assert.equal(edited.changed, true); assert.equal(edited.summary.totalBallots, 1);
  assert.deepEqual(edited.ballot.answers, { next_improvement: 'faction_intrigue' });
  assert.equal(choiceCount(edited.summary, 'next_improvement', 'continuing_threads'), 0);
  assert.equal(choiceCount(edited.summary, 'next_improvement', 'faction_intrigue'), 1);
  assert.equal(edited.summary.questions.find(row => row.id === 'character').totalResponses, 0);
  const other = await h.post(ballot(2, 'night_stories', 'yukon')).then(response => response.json());
  assert.equal(other.summary.totalBallots, 2);
  const shared = await fetch(`${h.base}/api/feedback`).then(response => response.json());
  assert.deepEqual(shared, other.summary); assertPublic(shared);
  assert.equal(choiceCount(shared, 'character', 'yukon'), 1);
  assert.deepEqual(h.counters(), { reads: 0, advances: 0 });
});

test('HTTP edit throttling returns Retry-After without modifying the accepted ballot', async t => {
  const h = await fixture(t); await h.post(ballot());
  const limited = await h.post(ballot(1, 'night_stories'));
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '2');
  assertPublic(await limited.json());
  assert.equal(choiceCount(h.feedback.summary(), 'next_improvement', 'continuing_threads'), 1);
  assert.equal((await h.post(ballot())).status, 200, 'retry of an accepted identical ballot remains idempotent');
  assert.deepEqual(h.counters(), { reads: 0, advances: 0 });
});

test('HTTP body, option and identity validation rejects invalid input without collecting it', async t => {
  const h = await fixture(t);
  const requests = [
    [() => fetch(`${h.base}/api/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid json' }), 400],
    [() => h.post([]), 400],
    [() => h.post({ ...ballot(), name: 'NAME_SENTINEL', email: 'EMAIL_SENTINEL@example.test' }), 400],
    [() => h.post({ ...ballot(), voterToken: 'INVALID_TOKEN_SENTINEL' }), 400],
    [() => h.post({ ...ballot(), pollId: 'obsolete-poll' }), 409],
    [() => h.post(ballot(1, 'not_a_real_choice')), 400],
    [() => h.post({ ...ballot(), comment: 'SENTINEL'.repeat(MAX_FEEDBACK_BODY_BYTES) }), 413],
    [() => h.post(ballot(), { headers: { 'Content-Type': 'text/plain' } }), 415],
  ];
  for (const [send, expected] of requests) {
    const response = await send(); assert.equal(response.status, expected);
    const error = await response.json(); assert.ok(!JSON.stringify(error).includes('SENTINEL')); assertPublic(error);
  }
  assert.equal(h.feedback.summary().totalBallots, 0);
  assert.deepEqual(h.counters(), { reads: 0, advances: 0 });
});

test('feedback rejects foreign origins, foreign hosts, unsupported methods and query-based identity', async t => {
  const h = await fixture(t);
  const foreign = await h.post(ballot(), { headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' } });
  assert.equal(foreign.status, 403);
  const crossSite = await fetch(`${h.base}/api/feedback`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
  assert.equal(crossSite.status, 403);
  const foreignHost = await new Promise((done, fail) => {
    const request = httpRequest(`${h.base}/api/feedback`, { headers: { Host: 'unrelated.example' } }, response => {
      response.resume(); response.once('end', () => done(response.statusCode));
    }); request.once('error', fail); request.end();
  });
  assert.equal(foreignHost, 403);
  for (const method of ['DELETE', 'PUT', 'PATCH', 'HEAD']) {
    assert.equal((await fetch(`${h.base}/api/feedback`, { method })).status, 405);
  }
  for (const query of ['?sort=votes', `?voterToken=${token(1)}`, '?pollId=other-world']) {
    const response = await fetch(`${h.base}/api/feedback${query}`);
    assert.equal(response.status, 400); assertPublic(await response.json());
  }
  assert.equal((await fetch(`${h.base}/src/feedback-store.mjs`)).status, 404);
  assert.equal((await fetch(`${h.base}/data/worldstream-feedback.sqlite`)).status, 404);
  assert.equal(h.feedback.summary().totalBallots, 0);
  assert.deepEqual(h.counters(), { reads: 0, advances: 0 });
});
