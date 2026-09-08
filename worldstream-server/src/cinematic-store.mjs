import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function parse(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function record(row) {
  if (!row) return null;
  return {
    eventId: row.event_id, rulesVersion: row.rules_version, promptVersion: row.prompt_version,
    packetKey: row.packet_key, occurredAt: row.occurred_at, score: row.score, band: row.band,
    dimensions: parse(row.dimensions_json, {}), packet: parse(row.packet_json, null),
    status: row.status, attempts: row.attempts, scene: parse(row.scene_json, null),
        model: row.model, failureReason: row.failure_reason, createdAt: row.created_at,
    generationStartedAt: row.generation_started_at,
    generationDeadlineAt: row.generation_deadline_at ?? null,
    acceptedAt: row.accepted_at,
  };
}

const nonNegative = (value, fallback = 0) => Number.isFinite(Number(value))
  ? Math.max(0, Math.trunc(Number(value))) : fallback;

/**
 * Presentation state is deliberately separate from canonical world state.
 * SQLite BEGIN IMMEDIATE makes claims safe across Node processes.
 */
export class CinematicStore {
  constructor({ dbPath = ':memory:' } = {}) {
    if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.closed = false;
    this.db.exec('PRAGMA busy_timeout = 30000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cinematics (
        event_id TEXT PRIMARY KEY,
        rules_version TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        packet_key TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        score INTEGER NOT NULL,
        band TEXT NOT NULL,
        dimensions_json TEXT NOT NULL,
        packet_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('candidate','generating','performed','fallback')),
        attempts INTEGER NOT NULL DEFAULT 0,
        scene_json TEXT,
        model TEXT,
        failure_reason TEXT,
        created_at INTEGER NOT NULL,
        generation_started_at INTEGER,
        accepted_at INTEGER,
        generation_owner_token TEXT,
        generation_deadline_at INTEGER,
        generation_gap_ms INTEGER NOT NULL DEFAULT 0,
        last_call_day TEXT
      );
      CREATE INDEX IF NOT EXISTS cinematic_status_time ON cinematics(status, occurred_at);
      CREATE INDEX IF NOT EXISTS cinematic_accepted ON cinematics(accepted_at);
      CREATE TABLE IF NOT EXISTS cinematic_budget (
        london_day TEXT PRIMARY KEY,
        calls INTEGER NOT NULL DEFAULT 0,
        reserved_cost_usd REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS cinematic_runtime (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        active_event_id TEXT,
        active_owner_token TEXT,
        active_started_at INTEGER,
        active_deadline_at INTEGER,
        next_generation_at INTEGER NOT NULL DEFAULT 0,
        uncertain_until INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO cinematic_runtime(singleton) VALUES(1);
      CREATE TABLE IF NOT EXISTS cinematic_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        owner_token TEXT NOT NULL UNIQUE,
        london_day TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        estimated_cost_usd REAL NOT NULL,
        outcome TEXT NOT NULL DEFAULT 'inflight'
      );
      CREATE INDEX IF NOT EXISTS cinematic_calls_day ON cinematic_calls(london_day, started_at);
    `);
    // Additive migration for local databases made by the first implementation.
    this.#ensureColumn('cinematics', 'generation_owner_token', 'TEXT');
    this.#ensureColumn('cinematics', 'generation_deadline_at', 'INTEGER');
    this.#ensureColumn('cinematics', 'generation_gap_ms', 'INTEGER NOT NULL DEFAULT 0');
    this.#ensureColumn('cinematics', 'last_call_day', 'TEXT');
    this.#ensureColumn('cinematic_calls', 'usage_json', 'TEXT');
    this.#ensureColumn('cinematic_calls', 'response_json', 'TEXT');
  }

  #ensureColumn(table, column, declaration) {
    const columns = new Set(this.db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name));
    if (!columns.has(column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
  }

  #begin() { this.db.exec('BEGIN IMMEDIATE'); }
  #commit() { this.db.exec('COMMIT'); }
  #rollback() { try { this.db.exec('ROLLBACK'); } catch {} }
  #row(eventId) { return this.db.prepare('SELECT * FROM cinematics WHERE event_id = ?').get(eventId); }
  #runtime() { return this.db.prepare('SELECT * FROM cinematic_runtime WHERE singleton = 1').get(); }

  #charge({ eventId, attempt, ownerToken, londonDay, now, estimatedCostPerCallUsd }) {
    this.db.prepare(`INSERT INTO cinematic_budget(london_day,calls,reserved_cost_usd) VALUES(?,?,?)
      ON CONFLICT(london_day) DO UPDATE SET calls=calls+1,reserved_cost_usd=reserved_cost_usd+excluded.reserved_cost_usd`)
      .run(londonDay, 1, estimatedCostPerCallUsd);
    this.db.prepare(`INSERT INTO cinematic_calls
      (event_id,attempt,owner_token,london_day,started_at,estimated_cost_usd)
      VALUES(?,?,?,?,?,?)`).run(eventId, attempt, ownerToken, londonDay, now, estimatedCostPerCallUsd);
  }

  #budgetAllows(londonDay, { maxCallsPerDay, maxDailyCostUsd, estimatedCostPerCallUsd }) {
    const budget = this.db.prepare('SELECT * FROM cinematic_budget WHERE london_day = ?').get(londonDay)
      ?? { calls: 0, reserved_cost_usd: 0 };
    return budget.calls < maxCallsPerDay
      && budget.reserved_cost_usd + estimatedCostPerCallUsd <= maxDailyCostUsd + Number.EPSILON;
  }

  #clearRuntime(ownerToken, { nextGenerationAt = 0, uncertainUntil = 0 } = {}) {
    this.db.prepare(`UPDATE cinematic_runtime SET
      active_event_id=NULL,active_owner_token=NULL,active_started_at=NULL,active_deadline_at=NULL,
      next_generation_at=MAX(next_generation_at,?),uncertain_until=MAX(uncertain_until,?)
      WHERE singleton=1 AND active_owner_token=?`).run(nextGenerationAt, uncertainUntil, ownerToken);
  }

  #markStale(row, { now, leaseMs, minSceneGapMs }) {
    const deadline = row.generation_deadline_at
      ?? (Number(row.generation_started_at ?? now) + leaseMs);
    const blockUntil = Math.max(deadline, now + Math.max(leaseMs, minSceneGapMs));
    this.db.prepare(`UPDATE cinematics SET status='fallback',failure_reason='generation_uncertain',
      generation_owner_token=NULL,generation_started_at=NULL,generation_deadline_at=NULL,accepted_at=?
      WHERE event_id=? AND status='generating'`).run(now, row.event_id);
    if (row.generation_owner_token) {
      this.db.prepare("UPDATE cinematic_calls SET outcome='uncertain' WHERE owner_token=? AND outcome='inflight'")
        .run(row.generation_owner_token);
      this.#clearRuntime(row.generation_owner_token, {
        nextGenerationAt: blockUntil, uncertainUntil: blockUntil,
      });
    } else {
      this.db.prepare(`UPDATE cinematic_runtime SET active_event_id=NULL,active_owner_token=NULL,
        active_started_at=NULL,active_deadline_at=NULL,
        next_generation_at=MAX(next_generation_at,?),uncertain_until=MAX(uncertain_until,?)
        WHERE singleton=1`).run(blockUntil, blockUntil);
    }
  }

  upsertCandidate(candidate, now = Date.now()) {
    const packetJson = JSON.stringify(candidate.packet);
    this.db.prepare(`INSERT OR IGNORE INTO cinematics
      (event_id,rules_version,prompt_version,packet_key,occurred_at,score,band,dimensions_json,packet_json,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,'candidate',?)`).run(
      candidate.eventId, candidate.rulesVersion, candidate.promptVersion, candidate.packetKey,
      candidate.occurredAt, candidate.score, candidate.band, JSON.stringify(candidate.dimensions),
      packetJson, now,
    );
    const row = this.#row(candidate.eventId);
    const immutable = row && row.packet_key === candidate.packetKey
      && row.rules_version === candidate.rulesVersion
      && row.prompt_version === candidate.promptVersion
      && row.occurred_at === candidate.occurredAt
      && row.packet_json === packetJson;
    if (!immutable) throw new Error(`Cinematic packet drift for ${candidate.eventId}`);
    return record(row);
  }

  get(eventId) { return record(this.#row(eventId)); }

  // Private diagnostics let an author inspect a rejected response without
  // purchasing another generation. This table has no public API projection.
  recordResponse(eventId, ownerToken, scene, usage = null) {
    const encoded = JSON.stringify(scene);
    if (typeof encoded !== 'string' || encoded.length > 32_000) return;
    this.db.prepare(`UPDATE cinematic_calls SET response_json=?,usage_json=?
      WHERE event_id=? AND owner_token=? AND outcome='inflight'`).run(
      encoded, usage ? JSON.stringify(usage) : null, eventId, ownerToken);
  }

  list({ status = null } = {}) {
    const rows = status
      ? this.db.prepare('SELECT * FROM cinematics WHERE status = ? ORDER BY occurred_at,event_id').all(status)
      : this.db.prepare('SELECT * FROM cinematics ORDER BY occurred_at,event_id').all();
    return rows.map(record);
  }

  counts() {
    return Object.fromEntries(this.db.prepare('SELECT status,COUNT(*) AS count FROM cinematics GROUP BY status')
      .all().map((row) => [row.status, row.count]));
  }

  budget(londonDay) {
    const row = this.db.prepare('SELECT * FROM cinematic_budget WHERE london_day = ?').get(londonDay);
    return row ? { londonDay: row.london_day, calls: row.calls, reservedCostUsd: row.reserved_cost_usd }
      : { londonDay, calls: 0, reservedCostUsd: 0 };
  }

  performCanonical(eventId, scene, { now = Date.now(), minSceneGapMs = 0 } = {}) {
    this.#begin();
    try {
      const row = this.#row(eventId), runtime = this.#runtime();
      if (!row) throw new Error('Unknown cinematic candidate');
      if (row.status !== 'candidate' || runtime.active_event_id
        || now < Math.max(runtime.next_generation_at, runtime.uncertain_until)) {
        this.#commit(); return record(row);
      }
      this.db.prepare(`UPDATE cinematics SET status='fallback',scene_json=?,failure_reason='canonical_only',accepted_at=?
        WHERE event_id=? AND status='candidate'`).run(JSON.stringify(scene), now, eventId);
      this.db.prepare('UPDATE cinematic_runtime SET next_generation_at=? WHERE singleton=1')
        .run(now + minSceneGapMs);
      const result = record(this.#row(eventId));
      this.#commit(); return result;
    } catch (error) { this.#rollback(); throw error; }
  }

  /** Reserve the one global model-call slot and charge this actual attempt. */
  claim(eventId, {
    londonDay, now = Date.now(), maxAttempts = 2, leaseMs = 90_000,
    minSceneGapMs = 0, maxCallsPerDay = 8, maxDailyCostUsd = 1,
    estimatedCostPerCallUsd = 0.05,
  } = {}) {
    const safeNow = nonNegative(now, Date.now());
    const safeLease = Math.max(1, nonNegative(leaseMs, 90_000));
    const safeGap = nonNegative(minSceneGapMs);
    this.#begin();
    try {
      let row = this.#row(eventId);
      if (!row) throw new Error('Unknown cinematic candidate');
      if (row.status === 'performed') {
        this.#commit();
        return { claimed: false, reason: 'cached', record: record(row) };
      }
      if (row.status === 'fallback') {
        this.#commit();
        return { claimed: false, reason: 'fallback', record: record(row) };
      }

      const generating = this.db.prepare("SELECT * FROM cinematics WHERE status='generating' ORDER BY generation_started_at,event_id LIMIT 1").get();
      if (generating) {
        const deadline = generating.generation_deadline_at
          ?? (Number(generating.generation_started_at ?? safeNow) + safeLease);
        if (safeNow <= deadline) {
          this.#commit();
          return { claimed: false, reason: generating.event_id === eventId ? 'locked' : 'global_locked',
            record: record(row) };
        }
        this.#markStale(generating, { now: safeNow, leaseMs: safeLease, minSceneGapMs: safeGap });
        row = this.#row(eventId);
        const staleRecord = record(this.#row(generating.event_id));
        this.#commit();
        return { claimed: false,
          reason: generating.event_id === eventId ? 'generation_uncertain' : 'global_uncertain',
          record: record(row), staleRecord };
      }

      const runtime = this.#runtime();
      const blockedUntil = Math.max(runtime.next_generation_at ?? 0, runtime.uncertain_until ?? 0);
      if (safeNow < blockedUntil) {
        this.#commit();
        return { claimed: false, reason: 'pacing', retryAt: blockedUntil, record: record(row) };
      }
      if (row.attempts >= maxAttempts) {
        this.db.prepare("UPDATE cinematics SET status='fallback',failure_reason='attempt_limit',accepted_at=? WHERE event_id=?")
          .run(safeNow, eventId);
        row = this.#row(eventId);
        this.#commit();
        return { claimed: false, reason: 'attempt_limit', record: record(row) };
      }
      if (!this.#budgetAllows(londonDay, { maxCallsPerDay, maxDailyCostUsd, estimatedCostPerCallUsd })) {
        this.db.prepare("UPDATE cinematics SET status='fallback',failure_reason='budget_ceiling',accepted_at=? WHERE event_id=?")
          .run(safeNow, eventId);
        row = this.#row(eventId);
        this.#commit();
        return { claimed: false, reason: 'budget_ceiling', record: record(row) };
      }

      const ownerToken = randomUUID();
      const deadline = safeNow + safeLease;
      const attempt = row.attempts + 1;
      this.#charge({ eventId, attempt, ownerToken, londonDay, now: safeNow, estimatedCostPerCallUsd });
      const changed = this.db.prepare(`UPDATE cinematics SET status='generating',attempts=?,
        generation_started_at=?,generation_deadline_at=?,generation_owner_token=?,generation_gap_ms=?,
        last_call_day=?,failure_reason=NULL WHERE event_id=? AND status='candidate'`)
        .run(attempt, safeNow, deadline, ownerToken, safeGap, londonDay, eventId).changes;
      if (changed !== 1) throw new Error('Cinematic claim lost');
      this.db.prepare(`UPDATE cinematic_runtime SET active_event_id=?,active_owner_token=?,
        active_started_at=?,active_deadline_at=?,uncertain_until=0 WHERE singleton=1`)
        .run(eventId, ownerToken, safeNow, deadline);
      row = this.#row(eventId);
      this.#commit();
      return { claimed: true, reason: null, ownerToken, record: record(row) };
    } catch (error) {
      this.#rollback();
      throw error;
    }
  }

  /** Keep the global reservation while a returned-but-invalid result is repaired. */
  retry(eventId, ownerToken, {
    londonDay, now = Date.now(), maxAttempts = 2, leaseMs = 90_000,
    maxCallsPerDay = 8, maxDailyCostUsd = 1, estimatedCostPerCallUsd = 0.05,
    priorOutcome = 'rejected',
  } = {}) {
    const safeNow = nonNegative(now, Date.now());
    const safeLease = Math.max(1, nonNegative(leaseMs, 90_000));
    this.#begin();
    try {
      let row = this.#row(eventId);
      if (!row) throw new Error('Unknown cinematic candidate');
      if (row.status !== 'generating' || row.generation_owner_token !== ownerToken) {
        this.#commit();
        return { claimed: false, reason: 'stale_owner', record: record(row) };
      }
      this.db.prepare("UPDATE cinematic_calls SET outcome=? WHERE owner_token=? AND outcome='inflight'")
        .run(priorOutcome, ownerToken);
      if (row.attempts >= maxAttempts) {
        this.#commit();
        return { claimed: false, reason: 'attempt_limit', ownerToken, record: record(row) };
      }
      if (!this.#budgetAllows(londonDay, { maxCallsPerDay, maxDailyCostUsd, estimatedCostPerCallUsd })) {
        this.db.prepare(`UPDATE cinematics SET status='fallback',failure_reason='budget_ceiling',
          generation_owner_token=NULL,generation_started_at=NULL,generation_deadline_at=NULL,accepted_at=?
          WHERE event_id=? AND generation_owner_token=?`).run(safeNow, eventId, ownerToken);
        this.#clearRuntime(ownerToken, { nextGenerationAt: safeNow + row.generation_gap_ms });
        row = this.#row(eventId);
        this.#commit();
        return { claimed: false, reason: 'budget_ceiling', record: record(row) };
      }
      const nextOwnerToken = randomUUID();
      const attempt = row.attempts + 1;
      const deadline = safeNow + safeLease;
      this.#charge({ eventId, attempt, ownerToken: nextOwnerToken, londonDay, now: safeNow,
        estimatedCostPerCallUsd });
      this.db.prepare(`UPDATE cinematics SET attempts=?,generation_started_at=?,generation_deadline_at=?,
        generation_owner_token=?,last_call_day=?,failure_reason=NULL
        WHERE event_id=? AND status='generating' AND generation_owner_token=?`)
        .run(attempt, safeNow, deadline, nextOwnerToken, londonDay, eventId, ownerToken);
      this.db.prepare(`UPDATE cinematic_runtime SET active_owner_token=?,active_started_at=?,active_deadline_at=?
        WHERE singleton=1 AND active_event_id=? AND active_owner_token=?`)
        .run(nextOwnerToken, safeNow, deadline, eventId, ownerToken);
      row = this.#row(eventId);
      this.#commit();
      return { claimed: true, reason: null, ownerToken: nextOwnerToken, record: record(row) };
    } catch (error) {
      this.#rollback();
      throw error;
    }
  }

  complete(eventId, ownerToken, scene, { model = null, usage = null, now = Date.now(), minSceneGapMs = null } = {}) {
    const safeNow = nonNegative(now, Date.now());
    this.#begin();
    try {
      let row = this.#row(eventId);
      if (!row) throw new Error('Unknown cinematic candidate');
      if (row.status === 'performed') {
        this.#commit();
        return record(row);
      }
      if (row.status !== 'generating' || row.generation_owner_token !== ownerToken) {
        this.#commit();
        return record(row);
      }
      const gap = minSceneGapMs === null ? row.generation_gap_ms : nonNegative(minSceneGapMs);
      this.db.prepare(`UPDATE cinematics SET status='performed',scene_json=?,model=?,failure_reason=NULL,
        generation_started_at=NULL,generation_deadline_at=NULL,generation_owner_token=NULL,accepted_at=?
        WHERE event_id=? AND status='generating' AND generation_owner_token=?`)
        .run(JSON.stringify(scene), model, safeNow, eventId, ownerToken);
      this.db.prepare("UPDATE cinematic_calls SET outcome='performed',usage_json=? WHERE owner_token=? AND outcome='inflight'")
        .run(usage ? JSON.stringify(usage) : null, ownerToken);
      this.#clearRuntime(ownerToken, { nextGenerationAt: safeNow + gap });
      row = this.#row(eventId);
      this.#commit();
      return record(row);
    } catch (error) {
      this.#rollback();
      throw error;
    }
  }

  fail(eventId, ownerToken, reason, {
    fallbackScene = null, now = Date.now(), minSceneGapMs = null,
    uncertain = false, leaseMs = 90_000,
  } = {}) {
    const safeNow = nonNegative(now, Date.now());
    this.#begin();
    try {
      let row = this.#row(eventId);
      if (!row) throw new Error('Unknown cinematic candidate');
      if (row.status === 'performed' || row.status === 'fallback') {
        this.#commit();
        return record(row);
      }
      if (row.status !== 'generating' || row.generation_owner_token !== ownerToken) {
        this.#commit();
        return record(row);
      }
      const gap = minSceneGapMs === null ? row.generation_gap_ms : nonNegative(minSceneGapMs);
      const uncertainBlock = uncertain ? safeNow + Math.max(nonNegative(leaseMs, 90_000), gap) : 0;
      this.db.prepare(`UPDATE cinematics SET status='fallback',scene_json=?,failure_reason=?,
        generation_started_at=NULL,generation_deadline_at=NULL,generation_owner_token=NULL,accepted_at=?
        WHERE event_id=? AND status='generating' AND generation_owner_token=?`).run(
        fallbackScene ? JSON.stringify(fallbackScene) : null, String(reason).slice(0, 300),
        safeNow, eventId, ownerToken,
      );
      this.db.prepare("UPDATE cinematic_calls SET outcome=? WHERE owner_token=? AND outcome='inflight'")
        .run(uncertain ? 'uncertain' : 'failed', ownerToken);
      this.#clearRuntime(ownerToken, {
        nextGenerationAt: Math.max(safeNow + gap, uncertainBlock), uncertainUntil: uncertainBlock,
      });
      row = this.#row(eventId);
      this.#commit();
      return record(row);
    } catch (error) {
      this.#rollback();
      throw error;
    }
  }

  setFallbackScene(eventId, fallbackScene, now = Date.now()) {
    this.db.prepare(`UPDATE cinematics SET scene_json=COALESCE(scene_json,?),accepted_at=COALESCE(accepted_at,?)
      WHERE event_id=? AND status='fallback'`).run(JSON.stringify(fallbackScene), now, eventId);
    return this.get(eventId);
  }

  setBudgetFallback(eventId, fallbackScene, now = Date.now()) {
    return this.setFallbackScene(eventId, fallbackScene, now);
  }

  latestAcceptedAt() {
    return this.db.prepare("SELECT COALESCE(MAX(accepted_at),0) AS value FROM cinematics WHERE status IN ('performed','fallback')").get().value;
  }

  nextPresentation({ afterAcceptedAt = 0, now = Date.now(), maxAgeMs = 180_000 } = {}) {
    const row = this.db.prepare(`SELECT * FROM cinematics
      WHERE status IN ('performed','fallback') AND scene_json IS NOT NULL
        AND accepted_at > ? AND accepted_at >= ? AND accepted_at <= ?
      ORDER BY accepted_at,event_id LIMIT 1`).get(afterAcceptedAt, now - maxAgeMs, now);
    return record(row);
  }

  /** Only accepted performances can become non-retroactive callbacks. */
  callbacksBefore(occurredAt, { limit = 64 } = {}) {
    const rows = this.db.prepare(`SELECT event_id,occurred_at,accepted_at,scene_json,packet_json
      FROM cinematics WHERE status='performed' AND accepted_at IS NOT NULL
        AND accepted_at <= ? AND occurred_at < ?
      ORDER BY occurred_at DESC,event_id DESC LIMIT ?`).all(
      occurredAt, occurredAt, Math.max(1, Math.min(256, limit)),
    );
    return rows.reverse().map((row) => {
      const scene = parse(row.scene_json, null);
      const packet = parse(row.packet_json, null);
      const quotes = (scene?.beats ?? []).filter((beat) => typeof beat?.speaker === 'string'
        && typeof beat?.line === 'string').slice(0, 2).map((beat) => ({ speaker: beat.speaker, line: beat.line }));
      return {
        eventId: row.event_id, occurredAt: row.occurred_at, acceptedAt: row.accepted_at,
        chronicleSummary: scene?.chronicleSummary,
        participants: packet?.event?.participants ?? [], quotes,
      };
    }).filter((item) => item.chronicleSummary);
  }

  close() {
    if (!this.closed) { this.db.close(); this.closed = true; }
  }
}

export function openCinematicStore(options) { return new CinematicStore(options); }
