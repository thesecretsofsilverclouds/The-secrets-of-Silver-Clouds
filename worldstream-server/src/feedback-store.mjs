import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIDE_CHARACTERS, LEGION_CAST, OUTSIDE_CAST } from './cast.mjs';

export const MAX_FEEDBACK_BODY_BYTES = 2_048;
export const FEEDBACK_LIMITS = Object.freeze({ editCooldownMs: 1_500, editsPerHour: 12, submissionsPerMinute: 120 });
// Resolved lazily. Computing this at module load calls `fileURLToPath` on
// `import.meta.url`, which is undefined inside the Cloudflare Worker bundle and
// killed the whole service on start-up — even though the Durable Object injects
// its own database and never wants a path at all.
const defaultPath = null;
const defaultDbPath = () => join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'worldstream-feedback.sqlite');
const HOUR = 3_600_000, MINUTE = 60_000;
const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const validId = value => typeof value === 'string' && idPattern.test(value);
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

// The two protagonists use the names in fixture.mjs. The supporting options
// come only from the current public cast catalog, not NAMEABLE's offscreen or
// embargoed manuscript names. Changing a poll's choices requires a new poll ID.
export const FEEDBACK_POLL = freeze({
  id: 'worldstream-priorities-v1',
  title: 'What should Worldstream develop next?',
  description: 'Help the creator choose future improvements. These votes do not direct the world.',
  questions: [
    { id: 'next_improvement', prompt: 'Which development should come next?', required: true, options: [
      { id: 'continuing_threads', label: 'Continuing story threads and consequences' },
      { id: 'familiar_characters', label: 'More familiar character appearances' },
      { id: 'character_relationships', label: 'Deeper friendships and friction' },
      { id: 'faction_intrigue', label: 'Faction intrigue' },
      { id: 'night_stories', label: 'Occasional night stories' },
    ] },
    { id: 'character', prompt: 'Who would you like to see more of? (Optional)', required: false, options: [
      { id: 'goaden', label: 'Goaden Reeves' }, { id: 'ashai', label: 'Ashai Bennet' },
      ...Object.entries({ ...SIDE_CHARACTERS, ...LEGION_CAST, ...OUTSIDE_CAST })
        .map(([id, character]) => ({ id, label: character.name })),
    ] },
  ],
});

const messages = {
  INVALID_BALLOT: 'Choose from the current poll options.',
  INVALID_TOKEN: 'A browser voting token is required.',
  PAYLOAD_TOO_LARGE: 'The feedback request is too large.',
  POLL_CHANGED: 'This poll has changed. Reload it before voting.',
  RATE_LIMITED: 'Please wait before changing your vote again.',
  POLL_BUSY: 'The poll is receiving many votes. Please try again shortly.',
  SEPARATE_DATABASE_REQUIRED: 'Feedback requires its own database.',
  CATALOG_CONFLICT: 'The poll definition requires a new version.',
  UNAVAILABLE: 'Feedback is temporarily unavailable. Please try again.',
};
export class FeedbackError extends Error {
  constructor(code, status = 400, retryAfterMs = null) {
    super(messages[code] ?? messages.UNAVAILABLE);
    this.name = 'FeedbackError'; this.code = code; this.status = status;
    if (retryAfterMs !== null) this.retryAfterMs = Math.max(1, Math.ceil(retryAfterMs));
  }
}

function checkedCatalog(source) {
  let catalog;
  try { catalog = structuredClone(source); } catch { throw new TypeError('Invalid feedback catalog'); }
  const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!plainObject(catalog) || !validId(catalog.id) || !validText(catalog.title, 160)
    || !validText(catalog.description, 300) || !Array.isArray(catalog.questions)
    || catalog.questions.length < 1 || catalog.questions.length > 2) throw new TypeError('Invalid feedback catalog');
  const questions = new Set();
  for (const question of catalog.questions) {
    if (!plainObject(question) || !validId(question.id) || questions.has(question.id)
      || !validText(question.prompt, 180) || typeof question.required !== 'boolean'
      || !Array.isArray(question.options) || question.options.length < 2 || question.options.length > 20) {
      throw new TypeError('Invalid feedback question');
    }
    questions.add(question.id);
    const choices = new Set();
    for (const option of question.options) {
      if (!plainObject(option) || !validId(option.id) || choices.has(option.id) || !validText(option.label, 100)) {
        throw new TypeError('Invalid feedback choice');
      }
      choices.add(option.id);
    }
  }
  if (!catalog.questions.some(question => question.required)) throw new TypeError('Feedback needs a required question');
  // Project config too: accidental internal metadata never becomes poll data.
  return freeze({ id: catalog.id, title: catalog.title, description: catalog.description,
    questions: catalog.questions.map(({ id, prompt, required, options }) => ({ id, prompt, required,
      options: options.map(({ id, label }) => ({ id, label })) })) });
}

function voterHash(token) {
  if (typeof token !== 'string' || !tokenPattern.test(token)) throw new FeedbackError('INVALID_TOKEN');
  return createHash('sha256').update(`worldstream-feedback:${token.toLowerCase()}`).digest('hex');
}

function checkedBallot(body, catalog) {
  let size;
  try { size = Buffer.byteLength(JSON.stringify(body) ?? '', 'utf8'); } catch { throw new FeedbackError('INVALID_BALLOT'); }
  if (size > MAX_FEEDBACK_BODY_BYTES) throw new FeedbackError('PAYLOAD_TOO_LARGE', 413);
  if (!plainObject(body) || Object.keys(body).some(key => !['pollId', 'voterToken', 'answers'].includes(key))) {
    throw new FeedbackError('INVALID_BALLOT');
  }
  if (body.pollId !== catalog.id) throw new FeedbackError('POLL_CHANGED', 409);
  const hash = voterHash(body.voterToken);
  if (!plainObject(body.answers)) throw new FeedbackError('INVALID_BALLOT');
  const knownQuestions = new Set(catalog.questions.map(question => question.id));
  if (Object.keys(body.answers).some(id => !knownQuestions.has(id))) throw new FeedbackError('INVALID_BALLOT');
  const answers = {};
  for (const question of catalog.questions) {
    const answer = body.answers[question.id];
    if ((answer === undefined || answer === null) && !question.required) continue;
    if (typeof answer !== 'string' || !question.options.some(option => option.id === answer)) throw new FeedbackError('INVALID_BALLOT');
    answers[question.id] = answer;
  }
  return { hash, answers, encoded: JSON.stringify(answers) };
}

/**
 * Independent visitor research only. This module has no world/agent/LLM API.
 * The HTTP owner must apply its normal same-origin check, cap the JSON body at
 * MAX_FEEDBACK_BODY_BYTES before parsing, and use its own trusted server clock.
 * UUIDv4 identifies an editable browser ballot, not a verified unique person.
 */
/**
 * @param options.db  An already-open database to use instead of opening one by
 *   path. Supplied by the Cloudflare Durable Object, which has a single SQLite
 *   database and no filesystem; the ballot tables live in it beside the world
 *   under their own names and never touch canonical history. When a `db` is
 *   given the "must be a separate database" check does not apply — that rule
 *   exists to stop the *Node* store being pointed at the world file, and inside
 *   the Durable Object sharing one database is the architecture, not a mistake.
 *   Everything below this line is identical for both callers, which is the
 *   point: one implementation, one set of semantics.
 */
export function openFeedbackStore({ dbPath = defaultPath, db: injected = null,
  transaction: runInTransaction = null,
  catalog: source = FEEDBACK_POLL, now = Date.now, limits: overrideLimits = {} } = {}) {
  const catalog = checkedCatalog(source), limits = { ...FEEDBACK_LIMITS, ...overrideLimits };
  for (const key of Object.keys(FEEDBACK_LIMITS)) if (!Number.isSafeInteger(limits[key]) || limits[key] < 1) {
    throw new TypeError('Invalid feedback limits');
  }
  if (!injected && dbPath === null) dbPath = defaultDbPath();
  if (!injected && dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = injected ?? new DatabaseSync(dbPath);
  let closed = false;
  try {
    if (!injected) {
      // Connection-local: install this before even reading sqlite_master, since
      // another process may still be recovering/opening the same WAL database.
      db.exec('PRAGMA busy_timeout=5000;');
      const allowed = new Set(['feedback_catalog', 'feedback_ballots', 'feedback_answers', 'feedback_limits']);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      if (tables.some(table => !allowed.has(table.name))) throw new FeedbackError('SEPARATE_DATABASE_REQUIRED', 500);
      db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS feedback_catalog (
        poll_id TEXT PRIMARY KEY, catalog_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS feedback_ballots (
        poll_id TEXT NOT NULL, voter_hash TEXT NOT NULL, answers_json TEXT NOT NULL,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        edit_window_started INTEGER NOT NULL, edit_count INTEGER NOT NULL CHECK(edit_count>0),
        PRIMARY KEY(poll_id,voter_hash), FOREIGN KEY(poll_id) REFERENCES feedback_catalog(poll_id)
      );
      CREATE TABLE IF NOT EXISTS feedback_answers (
        poll_id TEXT NOT NULL, voter_hash TEXT NOT NULL, question_id TEXT NOT NULL, option_id TEXT NOT NULL,
        PRIMARY KEY(poll_id,voter_hash,question_id),
        FOREIGN KEY(poll_id,voter_hash) REFERENCES feedback_ballots(poll_id,voter_hash) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS feedback_answer_totals ON feedback_answers(poll_id,question_id,option_id);
      CREATE TABLE IF NOT EXISTS feedback_limits (
        scope TEXT PRIMARY KEY, window_started INTEGER NOT NULL, writes INTEGER NOT NULL
      );
    `);
    const definition = JSON.stringify(catalog);
    // A Durable Object refuses raw BEGIN/COMMIT — it wants its own
    // `transactionSync`, which rolls back on exception and coalesces writes
    // correctly. When a caller supplies one, use it; otherwise the SQL
    // statements, exactly as before.
    const atomically = runInTransaction ?? (work => {
      db.exec('BEGIN IMMEDIATE');
      try { const result = work(); db.exec('COMMIT'); return result; }
      catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
    });
    atomically(() => {
      const existing = db.prepare('SELECT catalog_json FROM feedback_catalog WHERE poll_id=?').get(catalog.id);
      if (existing && existing.catalog_json !== definition) throw new FeedbackError('CATALOG_CONFLICT', 409);
      if (!existing) db.prepare('INSERT INTO feedback_catalog(poll_id,catalog_json) VALUES(?,?)').run(catalog.id, definition);
    });
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    db.close(); throw error;
  }

  const getBallot = db.prepare('SELECT * FROM feedback_ballots WHERE poll_id=? AND voter_hash=?');
  const globalLimit = db.prepare("SELECT * FROM feedback_limits WHERE scope='writes'");
  const putLimit = db.prepare(`INSERT INTO feedback_limits(scope,window_started,writes) VALUES('writes',?,?)
    ON CONFLICT(scope) DO UPDATE SET window_started=excluded.window_started,writes=excluded.writes`);
  const putBallot = db.prepare(`INSERT INTO feedback_ballots
    (poll_id,voter_hash,answers_json,created_at,updated_at,edit_window_started,edit_count) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(poll_id,voter_hash) DO UPDATE SET answers_json=excluded.answers_json,updated_at=excluded.updated_at,
      edit_window_started=excluded.edit_window_started,edit_count=excluded.edit_count`);
  const clearAnswers = db.prepare('DELETE FROM feedback_answers WHERE poll_id=? AND voter_hash=?');
  const putAnswer = db.prepare('INSERT INTO feedback_answers(poll_id,voter_hash,question_id,option_id) VALUES(?,?,?,?)');
  const ensureOpen = () => { if (closed) throw new FeedbackError('UNAVAILABLE', 503); };

  function summary() {
    ensureOpen();
    // One SELECT snapshot returns both the ballot count and answer totals, so a
    // concurrent process cannot place an edit between two aggregate snapshots.
    const rows = db.prepare(`SELECT question_id,option_id,COUNT(*) AS count,0 AS ballots
      FROM feedback_answers WHERE poll_id=? GROUP BY question_id,option_id
      UNION ALL SELECT '', '',0,COUNT(*) FROM feedback_ballots WHERE poll_id=?`).all(catalog.id, catalog.id);
    const counts = new Map(rows.filter(row => row.question_id).map(row => [`${row.question_id}:${row.option_id}`, Number(row.count)]));
    return { pollId: catalog.id, title: catalog.title, description: catalog.description,
      totalBallots: Number(rows.find(row => row.question_id === '')?.ballots ?? 0),
      questions: catalog.questions.map(question => {
        const options = question.options.map(option => ({ ...option, count: counts.get(`${question.id}:${option.id}`) ?? 0 }));
        return { id: question.id, prompt: question.prompt, required: question.required,
          totalResponses: options.reduce((sum, option) => sum + option.count, 0), options };
      }) };
  }

  function ballot(token) {
    ensureOpen();
    const row = getBallot.get(catalog.id, voterHash(token));
    return row ? { pollId: catalog.id, answers: JSON.parse(row.answers_json) } : null;
  }

  function vote(body) {
    ensureOpen();
    const { hash, answers, encoded } = checkedBallot(body, catalog);
    const serverTime = now();
    if (!Number.isSafeInteger(serverTime) || serverTime < 0) throw new FeedbackError('UNAVAILABLE', 503);
    const atomically = runInTransaction ?? (work => {
      db.exec('BEGIN IMMEDIATE');
      try { const result = work(); db.exec('COMMIT'); return result; }
      catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
    });
    try {
      return atomically(() => {
      const previous = getBallot.get(catalog.id, hash);
      if (previous?.answers_json === encoded) {
        return { changed: false, ballot: { pollId: catalog.id, answers }, summary: summary() };
      }
      const global = globalLimit.get();
      // A clock correction cannot bypass a persisted edit cooldown.
      const at = Math.max(serverTime, previous?.updated_at ?? 0, global?.window_started ?? 0);
      if (previous && at - previous.updated_at < limits.editCooldownMs) {
        throw new FeedbackError('RATE_LIMITED', 429, limits.editCooldownMs - (at - previous.updated_at));
      }
      const editWindow = previous && at < previous.edit_window_started + HOUR ? previous.edit_window_started : at;
      const edits = previous && editWindow === previous.edit_window_started ? previous.edit_count : 0;
      if (edits >= limits.editsPerHour) throw new FeedbackError('RATE_LIMITED', 429, editWindow + HOUR - at);
      const globalWindow = global && at < global.window_started + MINUTE ? global.window_started : at;
      const writes = global && globalWindow === global.window_started ? global.writes : 0;
      if (writes >= limits.submissionsPerMinute) throw new FeedbackError('POLL_BUSY', 429, globalWindow + MINUTE - at);
      putBallot.run(catalog.id, hash, encoded, previous?.created_at ?? at, at, editWindow, edits + 1);
      clearAnswers.run(catalog.id, hash);
      for (const [question, option] of Object.entries(answers)) putAnswer.run(catalog.id, hash, question, option);
      putLimit.run(globalWindow, writes + 1);
      return { changed: true, ballot: { pollId: catalog.id, answers }, summary: summary() };
      });
    } catch (error) {
      if (error instanceof FeedbackError) throw error;
      throw new FeedbackError('UNAVAILABLE', 503);
    }
  }

  return Object.freeze({ summary, ballot, vote,
    // Never close an injected database: the Durable Object owns it and the
    // world is still using it.
    close() { if (!closed) { closed = true; if (!injected) db.close(); } },
  });
}
