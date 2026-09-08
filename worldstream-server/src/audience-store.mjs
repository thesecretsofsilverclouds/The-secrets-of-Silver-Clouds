import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { londonDate, prevLondonDay } from './time.mjs';

const DEFAULT_TTL_MS = 60_000;

function timestamp(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8.64e15) throw new TypeError('Expected an epoch timestamp in milliseconds');
  return value;
}

function tokenHash(token) {
  if (typeof token !== 'string' || !token.trim() || token.length > 512) throw new TypeError('Expected a nonempty opaque session token, at most 512 characters');
  return createHash('sha256').update(token).digest('hex');
}

function report(db, at, ttlMs) {
  timestamp(at);
  const todayDate = londonDate(at);
  const dates = [todayDate];
  for (let i = 1; i < 7; i++) dates.push(prevLondonDay(dates.at(-1)));
  const rows = db.prepare('SELECT day, peak_sessions, session_starts FROM audience_days WHERE day >= ? AND day <= ?')
    .all(dates.at(-1), todayDate);
  const byDate = new Map(rows.map(row => [row.day, row]));
  const activeSessions = Number(db.prepare('SELECT COUNT(*) AS count FROM audience_sessions WHERE last_seen >= ? AND last_seen <= ?')
    .get(at - ttlMs, at).count);
  const last7Days = dates.map(date => {
    const row = byDate.get(date);
    return {
      date,
      // A read just after midnight can measure surviving sessions before their next heartbeat.
      peakSessions: Math.max(Number(row?.peak_sessions ?? 0), date === todayDate ? activeSessions : 0),
      sessionStarts: Number(row?.session_starts ?? 0),
    };
  });
  return { measuredAt: at, timeZone: 'Europe/London', unit: 'browser_sessions', ttlMs,
    activeSessions, today: last7Days[0], last7Days };
}

/** Operational telemetry only. No world seed, simulation state, public endpoint or personal profile. */
export function openAudienceStore({ dbPath, ttlMs = DEFAULT_TTL_MS } = {}) {
  if (typeof dbPath !== 'string' || !dbPath) throw new TypeError('A separate audience database path is required');
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new TypeError('ttlMs must be a positive integer');
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS audience_sessions (
      token_hash TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audience_days (
      day TEXT PRIMARY KEY,
      peak_sessions INTEGER NOT NULL DEFAULT 0,
      session_starts INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS audience_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS audience_sessions_last_seen ON audience_sessions(last_seen);
  `);
  db.prepare("INSERT INTO audience_meta(key,value) VALUES ('ttl_ms',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(ttlMs));

  function transaction(action) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = action(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  return {
    heartbeat(token, at = Date.now()) {
      const hash = tokenHash(token);
      timestamp(at);
      return transaction(() => {
        const previous = db.prepare('SELECT last_seen FROM audience_sessions WHERE token_hash = ?').get(hash);
        // A delayed request must not move an existing session backwards in time.
        if (previous && previous.last_seen > at) return { accepted: false, sessionStarted: false };
        db.prepare('DELETE FROM audience_sessions WHERE last_seen < ?').run(at - ttlMs);
        const sessionStarted = !previous || previous.last_seen < at - ttlMs;
        db.prepare(`INSERT INTO audience_sessions(token_hash,started_at,last_seen) VALUES (?,?,?)
          ON CONFLICT(token_hash) DO UPDATE SET last_seen=excluded.last_seen`).run(hash, at, at);
        const active = Number(db.prepare('SELECT COUNT(*) AS count FROM audience_sessions WHERE last_seen >= ? AND last_seen <= ?')
          .get(at - ttlMs, at).count);
        db.prepare(`INSERT INTO audience_days(day,peak_sessions,session_starts) VALUES (?,?,?)
          ON CONFLICT(day) DO UPDATE SET peak_sessions=MAX(peak_sessions,excluded.peak_sessions),
          session_starts=session_starts+excluded.session_starts`).run(londonDate(at), active, sessionStarted ? 1 : 0);
        return { accepted: true, sessionStarted };
      });
    },
    leave(token, at = Date.now()) {
      const hash = tokenHash(token);
      timestamp(at);
      return Number(db.prepare('DELETE FROM audience_sessions WHERE token_hash = ? AND last_seen <= ?').run(hash, at).changes) > 0;
    },
    beginRun(at = Date.now()) {
      timestamp(at);
      return transaction(() => {
        const expiredSessions = Number(db.prepare('DELETE FROM audience_sessions').run().changes);
        db.prepare("INSERT INTO audience_meta(key,value) VALUES ('run_started_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(at));
        return { expiredSessions, startedAt: at };
      });
    },
    summary(at = Date.now()) { return report(db, at, ttlMs); },
    close() { db.close(); },
  };
}

/** Owner tooling opens an existing file read-only, even while the server is using it. */
export function readAudienceSummary({ dbPath, at = Date.now() } = {}) {
  if (typeof dbPath !== 'string' || !existsSync(dbPath)) throw new Error('No audience measurements exist yet. Start Worldstream and open its page first.');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const ttlMs = Number(db.prepare("SELECT value FROM audience_meta WHERE key='ttl_ms'").get()?.value);
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error('Audience database has no valid heartbeat interval');
    return report(db, at, ttlMs);
  } finally { db.close(); }
}
