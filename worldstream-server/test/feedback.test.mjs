import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { FEEDBACK_POLL, FEEDBACK_LIMITS, MAX_FEEDBACK_BODY_BYTES, FeedbackError, openFeedbackStore } from '../src/feedback-store.mjs';
import { SIDE_CHARACTERS, LEGION_CAST, OUTSIDE_CAST } from '../src/cast.mjs';

const NOW = Date.parse('2026-09-06T12:00:00Z');
const token = n => `deadbeef-cafe-4bad-8bee-${String(n).padStart(12, '0')}`;
const body = (n = 1, feature = 'continuing_threads', character = 'ashai') => ({
  pollId: FEEDBACK_POLL.id, voterToken: token(n),
  answers: { next_improvement: feature, ...(character === undefined ? {} : { character }) },
});
const count = (summary, question, option) => summary.questions.find(row => row.id === question).options.find(row => row.id === option).count;
const expectCode = (fn, code, status) => assert.throws(fn, error => error instanceof FeedbackError && error.code === code
  && (status === undefined || error.status === status) && !error.message.includes('SENTINEL'));

function memory(t, options = {}) {
  let now = NOW;
  const store = openFeedbackStore({ dbPath: ':memory:', now: () => now, ...options });
  t.after(() => store.close());
  return { store, advance: ms => { now += ms; } };
}
function disk(t) {
  const directory = mkdtempSync(join(tmpdir(), 'worldstream-feedback-')), stores = [];
  t.after(() => {
    stores.forEach(store => store.close());
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('worldstream-feedback-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, dbPath: join(directory, 'feedback.sqlite'),
    open(options = {}) { const store = openFeedbackStore({ dbPath: join(directory, 'feedback.sqlite'), now: () => NOW, ...options }); stores.push(store); return store; } };
}
function storedRows(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { return Object.fromEntries(['feedback_ballots', 'feedback_answers', 'feedback_limits']
    .map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])); }
  finally { db.close(); }
}

test('poll uses current approved public cast, neutral development priorities and genuine zero counts', t => {
  const { store } = memory(t), summary = store.summary();
  assert.equal(summary.totalBallots, 0); assert.equal(summary.questions.length, 2);
  assert.equal(summary.questions[0].options.length, 5); assert.equal(summary.questions[0].required, true);
  assert.equal(summary.questions[1].required, false);
  assert.deepEqual(summary.questions[1].options.map(option => option.id),
    ['goaden', 'ashai', ...Object.keys(SIDE_CHARACTERS), ...Object.keys(LEGION_CAST), ...Object.keys(OUTSIDE_CAST)]);
  assert.ok(['davis', 'kartel', 'henderson'].every(id => summary.questions[1].options.some(option => option.id === id)));
  assert.ok(!/Whisper|Grimoire|basement/i.test(JSON.stringify(summary)));
  assert.ok(summary.questions.every(question => question.totalResponses === 0 && question.options.every(option => option.count === 0)));
  assert.match(summary.description, /do not direct the world/);
});

test('two browsers contribute real totals, with optional character responses counted separately', t => {
  const { store } = memory(t);
  assert.equal(store.vote(body()).changed, true);
  const second = body(2, 'night_stories'); delete second.answers.character;
  const result = store.vote(second);
  assert.equal(result.summary.totalBallots, 2);
  assert.equal(result.summary.questions[0].totalResponses, 2); assert.equal(result.summary.questions[1].totalResponses, 1);
  assert.equal(count(result.summary, 'next_improvement', 'continuing_threads'), 1);
  assert.equal(count(result.summary, 'next_improvement', 'night_stories'), 1);
  assert.equal(count(result.summary, 'character', 'ashai'), 1);
  assert.deepEqual(store.ballot(token(2)), { pollId: FEEDBACK_POLL.id, answers: { next_improvement: 'night_stories' } });
  assert.equal(store.ballot(token(3)), null);
});

test('editing atomically replaces a browser ballot, including clearing an optional answer', t => {
  const { store, advance } = memory(t); store.vote(body()); advance(2_000);
  const update = body(1, 'faction_intrigue', null); update.voterToken = update.voterToken.toUpperCase();
  const result = store.vote(update);
  assert.equal(result.changed, true); assert.equal(result.summary.totalBallots, 1);
  assert.equal(count(result.summary, 'next_improvement', 'continuing_threads'), 0);
  assert.equal(count(result.summary, 'next_improvement', 'faction_intrigue'), 1);
  assert.equal(count(result.summary, 'character', 'ashai'), 0);
  assert.deepEqual(result.ballot.answers, { next_improvement: 'faction_intrigue' });
  advance(2_000); store.vote(body(1, 'familiar_characters', 'kartel'));
  assert.equal(count(store.summary(), 'character', 'kartel'), 1);
});

test('identical resubmissions and repeated aggregate/ballot reads create no writes or rate charges', t => {
  const f = disk(t), store = f.open(); store.vote(body());
  const before = storedRows(f.dbPath);
  for (let i = 0; i < 20; i++) {
    assert.equal(store.vote(body()).changed, false); store.summary(); store.ballot(token(1));
  }
  assert.deepEqual(storedRows(f.dbPath), before);
  assert.equal(store.summary().totalBallots, 1);
});

test('restart retains votes and enforces the persisted edit cooldown without extending it for rejected requests', t => {
  const f = disk(t), first = f.open(); first.vote(body()); first.close();
  let at = NOW + 500; const restarted = f.open({ now: () => at });
  assert.equal(restarted.summary().totalBallots, 1);
  assert.deepEqual(restarted.ballot(token(1)).answers, body().answers);
  assert.throws(() => restarted.vote(body(1, 'night_stories')), error => error.code === 'RATE_LIMITED' && error.retryAfterMs === 1_000);
  assert.equal(restarted.vote(body()).changed, false);
  at = NOW + FEEDBACK_LIMITS.editCooldownMs;
  assert.equal(restarted.vote(body(1, 'night_stories')).changed, true);
});

test('per-browser hourly edit limit permits later edits and never duplicates a ballot', t => {
  const { store, advance } = memory(t, { limits: { editCooldownMs: 1, editsPerHour: 3 } });
  store.vote(body()); advance(1); store.vote(body(1, 'night_stories')); advance(1); store.vote(body(1, 'faction_intrigue'));
  advance(1); expectCode(() => store.vote(body(1, 'familiar_characters')), 'RATE_LIMITED', 429);
  assert.equal(count(store.summary(), 'next_improvement', 'faction_intrigue'), 1);
  assert.equal(store.vote(body(1, 'faction_intrigue')).changed, false);
  advance(3_600_000); assert.equal(store.vote(body(1, 'familiar_characters')).changed, true);
  assert.equal(store.summary().totalBallots, 1);
});

test('global write cap also limits fresh tokens and persists across connections', t => {
  const f = disk(t); let at = NOW;
  const first = f.open({ now: () => at, limits: { submissionsPerMinute: 2 } });
  const other = f.open({ now: () => at, limits: { submissionsPerMinute: 2 } });
  first.vote(body(1)); other.vote(body(2));
  expectCode(() => other.vote(body(3)), 'POLL_BUSY', 429);
  assert.equal(other.ballot(token(3)), null); assert.equal(first.summary().totalBallots, 2);
  assert.equal(first.vote(body(1)).changed, false);
  at += 60_000; assert.equal(other.vote(body(3)).changed, true); assert.equal(first.summary().totalBallots, 3);
});

test('malformed, oversized, unknown and identity-bearing ballots are rejected without collecting them', t => {
  const { store } = memory(t);
  for (const invalid of [null, [], 'text', { ...body(), name: 'NAME_SENTINEL' },
    { ...body(), email: 'EMAIL_SENTINEL@example.test' }, { ...body(), comment: 'FREE_TEXT_SENTINEL' },
    { ...body(), answers: [] }, { ...body(), answers: {} },
    { ...body(), answers: { next_improvement: 'invented_option' } },
    { ...body(), answers: { ...body().answers, secret_question: 'SENTINEL' } },
    { ...body(), answers: { ...body().answers, character: 'whisper' } },
  ]) expectCode(() => store.vote(invalid), 'INVALID_BALLOT', 400);
  expectCode(() => store.vote({ ...body(), pollId: 'old-poll' }), 'POLL_CHANGED', 409);
  for (const voterToken of ['short', 'NAME_SENTINEL', '', token(1).replace('-4bad-', '-1bad-'), ' '.repeat(40), null]) {
    expectCode(() => store.vote({ ...body(), voterToken }), 'INVALID_TOKEN', 400);
  }
  expectCode(() => store.vote({ ...body(), comment: 'é'.repeat(MAX_FEEDBACK_BODY_BYTES) }), 'PAYLOAD_TOO_LARGE', 413);
  assert.equal(store.summary().totalBallots, 0);
});

test('raw voter tokens are not stored, and public totals reveal no hashes, identity or timestamps', t => {
  const f = disk(t), store = f.open(); store.vote(body());
  const rows = storedRows(f.dbPath), encodedRows = JSON.stringify(rows), summary = store.summary();
  assert.ok(!encodedRows.includes(token(1))); assert.match(rows.feedback_ballots[0].voter_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(summary).sort(), ['description', 'pollId', 'questions', 'title', 'totalBallots']);
  assert.ok(!/voter|hash|created_at|updated_at|email|token/i.test(JSON.stringify(summary)));
  const result = store.vote(body());
  assert.ok(!JSON.stringify(result).includes(token(1))); assert.ok(!JSON.stringify(result).includes(rows.feedback_ballots[0].voter_hash));
  assert.deepEqual(Object.keys(rows.feedback_ballots[0]).sort(),
    ['answers_json', 'created_at', 'edit_count', 'edit_window_started', 'poll_id', 'updated_at', 'voter_hash']);
});

test('catalog changes require a new version so historic votes cannot be silently reinterpreted', t => {
  const f = disk(t), first = f.open(); first.vote(body()); first.close();
  const changed = structuredClone(FEEDBACK_POLL); changed.questions[0].options[0].label = 'A different meaning';
  expectCode(() => f.open({ catalog: changed }), 'CATALOG_CONFLICT', 409);
  changed.id = 'worldstream-priorities-v2'; const next = f.open({ catalog: changed });
  assert.equal(next.summary().totalBallots, 0);
  const original = f.open(); assert.equal(original.summary().totalBallots, 1);
});

test('feedback refuses a canonical or unrelated database and leaves its bytes unchanged', t => {
  const f = disk(t), worldPath = join(f.directory, 'world.sqlite');
  const world = new DatabaseSync(worldPath);
  world.exec("CREATE TABLE events(id TEXT PRIMARY KEY, payload TEXT); INSERT INTO events VALUES('canonical','WORLD_SENTINEL');");
  world.close(); const before = readFileSync(worldPath);
  expectCode(() => openFeedbackStore({ dbPath: worldPath }), 'SEPARATE_DATABASE_REQUIRED', 500);
  assert.deepEqual(readFileSync(worldPath), before);
});

test('invalid server configuration fails before opening a store and closed methods fail safely', t => {
  const missingId = structuredClone(FEEDBACK_POLL); delete missingId.questions[0].id;
  assert.throws(() => openFeedbackStore({ dbPath: ':memory:', catalog: missingId }), /Invalid feedback question/);
  assert.throws(() => openFeedbackStore({ dbPath: ':memory:', limits: { editsPerHour: 0 } }), /Invalid feedback limits/);
  const { store } = memory(t); store.close(); store.close();
  expectCode(() => store.summary(), 'UNAVAILABLE', 503); expectCode(() => store.vote(body()), 'UNAVAILABLE', 503);
});

test('two simultaneous process-independent submissions share one durable editable ballot', async t => {
  const f = disk(t); f.open().close();
  const moduleUrl = new URL('../src/feedback-store.mjs', import.meta.url).href;
  const run = () => new Promise((done, fail) => {
    const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
      import(workerData.moduleUrl).then(({openFeedbackStore})=>{
        const store=openFeedbackStore({dbPath:workerData.dbPath,now:()=>workerData.now});
        try { parentPort.postMessage(store.vote(workerData.body)); } finally { store.close(); }
      }).catch(error=>{throw error;});`, {
      eval: true, workerData: { moduleUrl, dbPath: f.dbPath, now: NOW, body: body() },
    });
    let result;
    worker.once('message', value => { result = value; }); worker.once('error', fail);
    worker.once('exit', code => code === 0 ? done(result) : fail(new Error(`Feedback worker exited ${code}`)));
  });
  const results = await Promise.all([run(), run()]);
  assert.deepEqual(results.map(result => result.changed).sort(), [false, true]);
  assert.equal(f.open().summary().totalBallots, 1);
});
