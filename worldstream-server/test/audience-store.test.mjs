import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openAudienceStore, readAudienceSummary } from '../src/audience-store.mjs';
import { formatAudienceSummary } from '../scripts/audience.mjs';

const AT = Date.parse('2026-09-06T10:00:00Z');

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'silver-clouds-audience-'));
  const dbPath = join(dir, 'audience.sqlite');
  const store = openAudienceStore({ dbPath });
  t.after(() => { try { store.close(); } catch {} rmSync(dir, { recursive: true, force: true }); });
  return { store, dbPath, dir };
}

test('starts at zero; repeated heartbeats and multiple sessions count only measured sessions', t => {
  const { store } = fixture(t);
  assert.equal(store.summary(AT).activeSessions, 0);
  assert.deepEqual(store.summary(AT).today, { date: '2026-09-06', peakSessions: 0, sessionStarts: 0 });
  assert.deepEqual(store.heartbeat('first-browser-token', AT), { accepted: true, sessionStarted: true });
  assert.deepEqual(store.heartbeat('first-browser-token', AT), { accepted: true, sessionStarted: false });
  store.heartbeat('second-browser-token', AT);
  store.heartbeat('first-browser-token', AT + 1000);
  assert.equal(store.summary(AT + 1000).activeSessions, 2);
  assert.deepEqual(store.summary(AT + 1000).today, { date: '2026-09-06', peakSessions: 2, sessionStarts: 2 });
});

test('leave is immediate and idempotent; expiry boundary and resumed sessions are honest', t => {
  const { store } = fixture(t);
  store.heartbeat('one', AT);
  store.heartbeat('two', AT);
  assert.equal(store.leave('two', AT), true);
  assert.equal(store.leave('two', AT), false);
  assert.equal(store.summary(AT).activeSessions, 1);
  assert.equal(store.summary(AT + 60_000).activeSessions, 1);
  assert.equal(store.summary(AT + 60_001).activeSessions, 0);
  assert.equal(store.heartbeat('one', AT + 60_001).sessionStarted, true);
  assert.equal(store.summary(AT + 60_001).today.sessionStarts, 3);
  assert.equal(store.summary(AT + 60_001).today.peakSessions, 2);
});

test('restart expires runtime presence without erasing previous measured aggregates', t => {
  const { store, dbPath } = fixture(t);
  store.heartbeat('one', AT);
  store.heartbeat('two', AT);
  store.close();
  const reopened = openAudienceStore({ dbPath });
  try {
    assert.deepEqual(reopened.beginRun(AT + 5000), { expiredSessions: 2, startedAt: AT + 5000 });
    assert.equal(reopened.summary(AT + 5000).activeSessions, 0);
    assert.equal(reopened.summary(AT + 5000).today.peakSessions, 2);
    assert.equal(reopened.summary(AT + 5000).today.sessionStarts, 2);
    reopened.heartbeat('one', AT + 6000);
    assert.equal(reopened.summary(AT + 6000).today.sessionStarts, 3);
  } finally { reopened.close(); }
});

test('London midnight keeps one continuous session; spring and autumn DST use civil days', t => {
  const { store } = fixture(t);
  const beforeMidnight = Date.parse('2026-09-06T22:59:50Z');
  store.heartbeat('continuous', beforeMidnight);
  store.heartbeat('continuous', beforeMidnight + 20_000);
  const next = store.summary(beforeMidnight + 20_000);
  assert.equal(next.today.date, '2026-09-07');
  assert.equal(next.today.sessionStarts, 0);
  assert.equal(next.today.peakSessions, 1);
  assert.equal(next.last7Days[1].date, '2026-09-06');
  assert.equal(next.last7Days[1].sessionStarts, 1);
  for (const [date, earlier, later] of [
    ['2026-03-29', '2026-03-29T00:59:50Z', '2026-03-29T01:00:10Z'],
    ['2026-10-25', '2026-10-25T00:59:50Z', '2026-10-25T01:00:10Z'],
  ]) {
    store.beginRun(Date.parse(earlier));
    store.heartbeat(`dst-${date}`, Date.parse(earlier));
    store.heartbeat(`dst-${date}`, Date.parse(later));
    const summary = store.summary(Date.parse(later));
    assert.equal(summary.today.date, date);
    assert.equal(summary.today.sessionStarts, 1);
    assert.equal(summary.activeSessions, 1);
    assert.equal(new Set(summary.last7Days.map(day => day.date)).size, 7);
  }
});

test('only hashes are stored; summaries contain aggregates with no tokens, IPs or world identity', t => {
  const { store, dbPath } = fixture(t);
  const token = 'private-viewer-token-do-not-store-raw';
  store.heartbeat(token, AT);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare('SELECT * FROM audience_sessions').all();
    assert.deepEqual(Object.keys(rows[0]).sort(), ['last_seen', 'started_at', 'token_hash']);
    assert.match(rows[0].token_hash, /^[a-f0-9]{64}$/);
    assert.equal(rows[0].token_hash.includes(token), false);
    assert.equal(readFileSync(dbPath).includes(Buffer.from(token)), false);
  } finally { db.close(); }
  const summary = store.summary(AT);
  assert.deepEqual(Object.keys(summary).sort(), ['activeSessions', 'last7Days', 'measuredAt', 'timeZone', 'today', 'ttlMs', 'unit']);
  assert.equal(JSON.stringify(summary).includes(token), false);
  assert.equal(JSON.stringify(summary).includes('token_hash'), false);
  assert.equal(summary.unit, 'browser_sessions');
});

test('repeat owner reads are read-only, cannot create events, and missing paths are not created', t => {
  const { store, dbPath, dir } = fixture(t);
  store.heartbeat('one', AT);
  const before = readFileSync(dbPath);
  const a = readAudienceSummary({ dbPath, at: AT });
  const b = readAudienceSummary({ dbPath, at: AT });
  assert.deepEqual(a, b);
  assert.deepEqual(readFileSync(dbPath), before);
  const missing = join(dir, 'not-created.sqlite');
  assert.throws(() => readAudienceSummary({ dbPath: missing, at: AT }), /No audience measurements/);
  assert.equal(existsSync(missing), false);
});

test('delayed heartbeat cannot rewind a session; invalid inputs create no measurements', t => {
  const { store } = fixture(t);
  store.heartbeat('one', AT);
  assert.equal(store.heartbeat('one', AT - 1000).accepted, false);
  assert.equal(store.leave('one', AT - 1000), false);
  assert.equal(store.summary(AT).activeSessions, 1);
  for (const token of [null, '', ' ', 'x'.repeat(513)]) assert.throws(() => store.heartbeat(token, AT), /token/);
  assert.throws(() => store.heartbeat('bad-time', NaN), /timestamp/);
  assert.equal(store.summary(AT).today.sessionStarts, 1);
});

test('expired session rows are bounded by current activity; historical daily totals remain', t => {
  const { store, dbPath } = fixture(t);
  for (let i = 0; i < 100; i++) store.heartbeat(`tab-${i}`, AT);
  store.heartbeat('later-tab', AT + 60_001);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audience_sessions').get().n, 1); }
  finally { db.close(); }
  assert.equal(store.summary(AT + 60_001).today.peakSessions, 100);
  assert.equal(store.summary(AT + 60_001).today.sessionStarts, 101);
});

test('owner CLI uses an existing database and labels sessions rather than claiming people', t => {
  const { store, dbPath, dir } = fixture(t);
  store.heartbeat('one', Date.now());
  const cli = new URL('../scripts/audience.mjs', import.meta.url);
  const json = spawnSync(process.execPath, [fileURLToPath(cli), '--db', dbPath, '--json'], { encoding: 'utf8' });
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).today.sessionStarts, 1);
  assert.match(formatAudienceSummary(store.summary(Date.now())), /browser sessions, not unique people/);
  const missing = join(dir, 'missing-cli.sqlite');
  const failed = spawnSync(process.execPath, [fileURLToPath(cli), '--db', missing], { encoding: 'utf8' });
  assert.equal(failed.status, 1);
  assert.equal(existsSync(missing), false);
});

test('configured TTL survives read-only owner reports and no world seed contributes viewers', t => {
  const dir = mkdtempSync(join(tmpdir(), 'silver-clouds-audience-ttl-'));
  const dbPath = join(dir, 'audience.sqlite');
  const store = openAudienceStore({ dbPath, ttlMs: 20_000, seed: 'a-busy-fictional-world' });
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.equal(store.summary(AT).activeSessions, 0);
  store.heartbeat('real-browser-session', AT);
  assert.equal(readAudienceSummary({ dbPath, at: AT + 20_000 }).activeSessions, 1);
  assert.equal(readAudienceSummary({ dbPath, at: AT + 20_001 }).activeSessions, 0);
  assert.equal(readAudienceSummary({ dbPath, at: AT }).ttlMs, 20_000);
});
