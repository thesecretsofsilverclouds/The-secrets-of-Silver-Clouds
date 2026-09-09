/**
 * WorldDurableObject: The single authoritative shared world backend on Cloudflare.
 * 
 * Responsibilities:
 * 1. Authoritative SQLite persistence via ctx.storage.sql + SqliteAdapter.
 * 2. Real-time autonomous world progression via Durable Object alarms.
 * 3. On-demand catch-up for incoming visitor requests.
 * 4. Hibernating WebSockets: live multi-reader delta streaming with zero idle compute cost.
 * 5. Complete fiction preservation: dialogue, narrative prose, cinematics archive,
 *    ↩ Earlier setup context, callbacks, recaps, plot clocks, and morning broadsheet.
 * 6. Read-only Shadow Moment adapter stub point (leaving Moment Engine grammar to parallel agent).
 * 7. Live resource tracking & Cloudflare Free Tier headroom measurement.
 */

import { SqliteAdapter } from './sqlite-adapter.mjs';
import { ShadowAdapter } from './shadow-adapter.mjs';
import { CapacityTracker } from './capacity.mjs';
import { createFixture, RULES_VERSION, DEFAULT_SEED, publicEvents } from '../../src/fixture.mjs';
import { atLondon, londonDate } from '../../src/time.mjs';
import { evaluatePlotClocks } from '../../src/clocks.mjs';
import {
  CINEMATIC_PROMPT_VERSION, CINEMATIC_RULES_VERSION,
  buildScenePacket, deterministicFallbackScene, scoreCinematicEvent, scenePacketKey
} from '../../src/cinematics.mjs';
import { editorialCinematicRecordForApi } from '../../src/editorial-cinematics.mjs';
import { detectWagerForEvent } from '../../src/wagers.mjs';
import { getLatestDispatch, getDispatchByDate } from '../../src/dispatch.mjs';
// Reader-facing surfaces the Node server already implements. These are the same
// modules `server.mjs` uses, handed this Durable Object's SQLite instead of a
// file, so the semantics are not reimplemented and cannot drift.
import { openSocialStore } from '../../src/social-store.mjs';
import { openFeedbackStore, FeedbackError, MAX_FEEDBACK_BODY_BYTES } from '../../src/feedback-store.mjs';
import { buildStoryThread, listStoryThreads } from '../../src/story-threads.mjs';
import { historyOptions, readPublicHistory, readPublicEventContext, readPublicDialogueSources } from '../../src/public-history.mjs';
import { BACKGROUND_BY_ID, selectVisualVocabulary } from '../../src/cinematic-assets.mjs';
import { daypart } from '../../src/sky.mjs';
import { TRACKS, AMBIENT_SOURCES } from './media-manifest.mjs';

const ALARM_INTERVAL_MS = 60_000; // 1 London minute

/** Where the reader app is served from on the website. */
const APP_MOUNT = '/worldstream/app';

// Cached performances use the shared engine's /scene paths. Mount those public
// asset URLs at the integrated website boundary, including archive/detail/live.
function mountedCinematicRecordForApi(record, context) {
  const api = editorialCinematicRecordForApi(record, context);
  if (!api?.scene?.assets) return api;
  const mounted = asset => asset ? { ...asset,
    url: asset.url?.startsWith('/scene/') ? `${APP_MOUNT}${asset.url}` : asset.url,
  } : null;
  return { ...api, scene: { ...api.scene, assets: {
    background: mounted(api.scene.assets.background),
    plates: Object.fromEntries(Object.entries(api.scene.assets.plates ?? {})
      .map(([id, asset]) => [id, mounted(asset)])),
  } } };
}

export class WorldDurableObject {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.env = env || {};
    this.storage = ctx.storage;
    this.adapter = new SqliteAdapter(ctx.storage.sql);
    this.db = this.adapter;
    this.shadowAdapter = new ShadowAdapter(this.db);
    this.capacity = new CapacityTracker();
    this.fixture = null;
    this.initialized = false;
    this.cinematicArchiveRecoveryComplete = false;

    this.initTables();
    this.initAudienceTables();
    if (this.env.AUTO_INIT !== false) {
      const seed = this.env.WORLD_SEED || DEFAULT_SEED;
      const startMs = this.env.START_MS ? Number(this.env.START_MS) : null;
      this.ensureWorld(seed, startMs);
    }
  }

  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS world_state (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        seed TEXT NOT NULL,
        rules_version TEXT NOT NULL,
        resolved_through INTEGER NOT NULL,
        state_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        occurred_at INTEGER NOT NULL,
        semantic_json TEXT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS event_time ON events(occurred_at, seq);

      CREATE TABLE IF NOT EXISTS scheduled_actions (
        id TEXT PRIMARY KEY,
        due_at INTEGER NOT NULL,
        priority INTEGER NOT NULL,
        action_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS scheduled_due ON scheduled_actions(due_at, priority, id);

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
        accepted_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS cinematic_occurred ON cinematics(occurred_at);

      -- event_reactions, event_comments, event_wagers and traveller_wager_votes
      -- are deliberately NOT defined here. They are created by openSocialStore,
      -- the same module the Node server uses, which is the behavioural
      -- reference. Two definitions of the same table names had already drifted
      -- apart -- this object's event_comments carried traveller_id/flair_json
      -- where the reference carries author_name and the rest -- and because
      -- CREATE TABLE IF NOT EXISTS is a no-op on an existing table, whichever
      -- ran first silently won. One definition, in one place.

      CREATE TABLE IF NOT EXISTS audience_sessions (
        token_hash TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      );
    `);
  }

  /**
   * Create the audience tables via their owning module.
   *
   * First, retire any table left over from this object's own earlier, divergent
   * definitions. `CREATE TABLE IF NOT EXISTS` cannot repair a table that already
   * exists with the wrong columns, so a database created before the definitions
   * were unified keeps the old `event_comments` (traveller_id/flair_json) and
   * every read of `author_name` fails.
   *
   * Dropping is safe *because nothing has been deployed*: the only databases in
   * existence are local development ones. If this object ever holds real reader
   * comments, this must become a copying migration instead — which is why it
   * checks the shape rather than dropping unconditionally.
   */
  initAudienceTables() {
    try {
      const columns = this.db.prepare("SELECT name FROM pragma_table_info('event_comments')").all();
      if (columns.length && !columns.some(column => column.name === 'author_name')) {
        this.db.exec('DROP TABLE IF EXISTS event_comments');
      }
    } catch {}
    this.social;      // the getter opens the store, which creates its tables
    this.feedback;
  }

  ensureWorld(seed = DEFAULT_SEED, startMs = null) {
    const existing = this.db.prepare('SELECT * FROM world_state WHERE id = 1').get();
    if (!existing) {
      // Default to today London midnight if not specified
      const effectiveStartMs = startMs ?? atLondon(londonDate(Date.now()), '00:00');
      this.fixture = createFixture({ startMs: effectiveStartMs });
      const initial = this.fixture.initialState();
      const actions = this.fixture.initialActions();

      this.db.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(
        seed,
        this.fixture.rulesVersion,
        effectiveStartMs,
        JSON.stringify(initial)
      );

      const insertAction = this.db.prepare('INSERT INTO scheduled_actions VALUES (?, ?, ?, ?)');
      for (const a of actions) {
        insertAction.run(a.id, a.dueAt, a.priority, JSON.stringify(a));
      }
    } else {
      const day = londonDate(existing.resolved_through);
      this.fixture = createFixture({ startMs: atLondon(day, '00:00') });
    }
    this.initialized = true;
  }

  getResolvedThrough() {
    const row = this.db.prepare('SELECT resolved_through FROM world_state WHERE id = 1').get();
    return row ? Number(row.resolved_through) : 0;
  }

  getSeed() {
    const row = this.db.prepare('SELECT seed FROM world_state WHERE id = 1').get();
    return row ? row.seed : DEFAULT_SEED;
  }

  /**
   * Advance the canonical simulation to targetMs. Pure deterministic state transitions.
   */
  advance(targetMs) {
    const row = this.db.prepare('SELECT * FROM world_state WHERE id = 1').get();
    if (!row || targetMs <= row.resolved_through) {
      return [];
    }

    const state = JSON.parse(row.state_json);
    let seq = Number(this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM events').get().seq);
    const nextActionStmt = this.db.prepare('SELECT action_json FROM scheduled_actions WHERE due_at <= ? ORDER BY due_at, priority, id LIMIT 1');
    const insertActionStmt = this.db.prepare('INSERT INTO scheduled_actions VALUES (?, ?, ?, ?)');
    const deleteActionStmt = this.db.prepare('DELETE FROM scheduled_actions WHERE id = ?');
    const insertEventStmt = this.db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?)');

    let processedActions = 0;
    const newEvents = [];

    for (;;) {
      const pending = nextActionStmt.get(targetMs);
      if (!pending) break;

      const action = JSON.parse(pending.action_json);
      if (action.dueAt <= row.resolved_through) {
        deleteActionStmt.run(action.id);
        continue;
      }

      const { event, followups } = this.fixture.reduceAction(state, action, row.seed);
      for (const followup of followups) {
        insertActionStmt.run(followup.id, followup.dueAt, followup.priority, JSON.stringify(followup));
      }

      const semanticEvent = { seq: ++seq, ...event };
      insertEventStmt.run(seq, event.id, event.occurredAt, JSON.stringify(semanticEvent), new Date().toISOString());
      deleteActionStmt.run(action.id);
      processedActions++;
      newEvents.push(semanticEvent);

      // Ingest into cinematics if qualifies (deterministic fallback scene, $0 token cost)
      this.maybeIngestCinematic(semanticEvent);
    }

    // Only update state_json when actions actually altered the state
    if (processedActions === 0) {
      this.db.prepare('UPDATE world_state SET resolved_through = ? WHERE id = 1').run(targetMs);
    } else {
      this.db.prepare('UPDATE world_state SET resolved_through = ?, state_json = ? WHERE id = 1').run(targetMs, JSON.stringify(state));
    }

    // Filter public events for reader delta
    const publicDeltas = publicEvents({ events: newEvents, eventById: id => this.eventById(id),
      publicSourcesForEvent: event => this.publicDialogueSources(event) }, Infinity);
    return publicDeltas;
  }

  maybeIngestCinematic(event, { snapshot = null, acceptedAt = Date.now() } = {}) {
    if (!event || event.visibility !== 'public') return;
    if (event.type === 'SCENE_BANK_BEAT') return;
    try {
      const scoreData = scoreCinematicEvent(event);
      if (scoreData.score >= 70 || scoreData.band === 'gold' || scoreData.band === 'silver') {
        if (this.db.prepare('SELECT event_id FROM cinematics WHERE event_id = ?').get(event.id)) return;
        const snap = snapshot ?? this.presentationSnapshot();
        const packet = buildScenePacket(event, snap);
        if (packet) {
          const fallbackScene = deterministicFallbackScene(packet);
          this.db.prepare(`
            INSERT OR IGNORE INTO cinematics (
              event_id, rules_version, prompt_version, packet_key, occurred_at,
              score, band, dimensions_json, packet_json, status, scene_json,
              model, created_at, accepted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'fallback', ?, 'deterministic-fallback', ?, ?)
          `).run(
            event.id,
            CINEMATIC_RULES_VERSION,
            CINEMATIC_PROMPT_VERSION,
            scenePacketKey(packet),
            event.occurredAt,
            scoreData.score,
            scoreData.band,
            JSON.stringify(scoreData.dimensions),
            JSON.stringify(packet),
            JSON.stringify(fallbackScene),
            Date.now(),
            acceptedAt
          );
        }
      }
    } catch {
      // Ingest failures never break canonical world progression
    }
  }

  recoverRecentCinematicArchive() {
    if (this.cinematicArchiveRecoveryComplete) return;
    // Once per object activation, only when a reader opens Scenes. The existing
    // 1024-event presentation window bounds this repair; no full-ledger scan or
    // polling work. Restore the same qualifying committed events, never a new
    // story beat, and retain historical time so repair is not a live premiere.
    const snapshot = this.presentationSnapshot();
    for (const event of snapshot?.events ?? []) {
      this.maybeIngestCinematic(event, { snapshot, acceptedAt: event.occurredAt });
    }
    this.cinematicArchiveRecoveryComplete = true;
  }

  catchUp(nowMs = Date.now()) {
    const current = this.getResolvedThrough();
    if (current < nowMs) {
      return this.advance(nowMs);
    }
    return [];
  }

  presentationSnapshot() {
    const row = this.db.prepare('SELECT * FROM world_state WHERE id = 1').get();
    if (!row) return null;

    const state = JSON.parse(row.state_json);
    const recentRows = this.db.prepare('SELECT semantic_json FROM events ORDER BY seq DESC LIMIT 1024').all();
    const recent = recentRows.map(r => JSON.parse(r.semantic_json)).reverse();
    const byId = new Map(recent.map(e => [e.id, e]));

    // Gather memory source events
    const DAY = 86_400_000;
    const ids = new Set();
    for (const actor of Object.values(state.characters ?? {})) {
      for (const memory of actor.knowledge ?? []) {
        if (memory.learnedAt < row.resolved_through - 31 * DAY) continue;
        if (memory.sourceEventId) ids.add(memory.sourceEventId);
        if (memory.acquisitionEventId) ids.add(memory.acquisitionEventId);
      }
    }

    const lookupStmt = this.db.prepare('SELECT semantic_json FROM events WHERE id = ?');
    for (const id of ids) {
      if (id && !byId.has(id)) {
        const found = lookupStmt.get(id);
        if (found) byId.set(id, JSON.parse(found.semantic_json));
      }
    }

    const pendingActions = this.db.prepare('SELECT action_json FROM scheduled_actions ORDER BY due_at, priority, id').all()
      .map(e => JSON.parse(e.action_json));

    return {
      world: {
        id: this.fixture.worldId,
        seed: row.seed,
        rulesVersion: this.fixture.rulesVersion,
        resolvedThrough: row.resolved_through
      },
      ...state,
      events: [...byId.values()].sort((a, b) => a.seq - b.seq),
      pendingActions,
      presentationFloor: recent[0]?.occurredAt ?? row.resolved_through
    };
  }

  publicProjection() {
    const snap = this.presentationSnapshot();
    return snap ? this.fixture.publicProjection(snap) : null;
  }

  eventById(id) {
    const row = this.db.prepare('SELECT semantic_json FROM events WHERE id = ?').get(id);
    return row ? JSON.parse(row.semantic_json) : null;
  }

  publicHistory(options) { return readPublicHistory(this, options); }

  publicEventContext(id) { return readPublicEventContext(this, id); }

  publicDialogueSources(event) { return readPublicDialogueSources(this, event); }

  cinematicForApi(record, context = {}) {
    return mountedCinematicRecordForApi(record, { ...context,
      publicSourcesForEvent: event => this.publicDialogueSources(event) });
  }

  operationalStats() {
    return {
      eventCount: Number(this.db.prepare('SELECT COUNT(*) AS n FROM events').get().n),
      pendingActionCount: Number(this.db.prepare('SELECT COUNT(*) AS n FROM scheduled_actions').get().n),
      resolvedThrough: this.getResolvedThrough()
    };
  }

  /**
   * Alarm lifecycle handler: wakes every minute to advance world, ingest cinematics, and broadcast deltas.
   */
  async alarm() {
    const startMs = Date.now();
    try {
      const newDeltas = this.advance(startMs);
      if (newDeltas.length > 0) {
        this.broadcastEvents(newDeltas);
      }
      this.capacity.recordRequest('alarms', Date.now() - startMs);
    } catch (err) {
      console.error('DO Alarm error:', err);
    } finally {
      // Schedule next alarm in 60 seconds
      await this.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    }
  }

  broadcastEvents(events) {
    if (!this.ctx.getWebSockets) return;
    const websockets = this.ctx.getWebSockets('readers');
    if (!websockets || websockets.length === 0) return;

    const payload = JSON.stringify({
      type: 'EVENTS_DELTA',
      serverTime: Date.now(),
      events
    });

    for (const ws of websockets) {
      try {
        ws.send(payload);
      } catch {
        // Closed sockets pruned automatically by hibernation API
      }
    }
  }

  // WebSocket Hibernation handlers
  async webSocketMessage(ws, message) {
    this.capacity.recordRequest('websocketMessage', 0.1);
    try {
      const data = JSON.parse(message);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
      } else if (data.type === 'sync' && Number.isSafeInteger(data.afterSeq)) {
        const missed = this.db.prepare(`
          SELECT semantic_json FROM events
          WHERE seq > ? AND json_extract(semantic_json, '$.visibility') = 'public'
          ORDER BY seq ASC
          LIMIT 100
        `).all(data.afterSeq).map(r => JSON.parse(r.semantic_json));
        const projected = publicEvents({ events: missed, eventById: id => this.eventById(id) }, Infinity);
        ws.send(JSON.stringify({ type: 'SYNC_RESPONSE', serverTime: Date.now(), events: projected }));
      }
    } catch {
      // Invalid message ignored
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    this.capacity.recordSessionEvent('disconnect');
  }

  async webSocketError(ws, error) {
    this.capacity.recordSessionEvent('disconnect');
  }

  // ------------------------------------------------ non-canonical surfaces
  //
  // Reader activity — reactions, comments, wagers, poll ballots, presence —
  // lives in its own tables inside this same SQLite. It is deliberately *not*
  // world history: nothing here is ever read back into `advance()`, no row
  // becomes an event, and submitting any of it cannot move the world's
  // watermark. Sharing one database is what a Durable Object is for; keeping
  // the tables separate is what keeps the canon clean.
  get social() {
    if (!this._social) this._social = openSocialStore({ db: this.db });
    return this._social;
  }

  get feedback() {
    if (!this._feedback) this._feedback = openFeedbackStore({
      db: this.db,
      // Durable Objects reject raw BEGIN/COMMIT and want their own transaction
      // API, which rolls back on exception and coalesces writes properly.
      transaction: work => (this.ctx.storage?.transactionSync
        ? this.ctx.storage.transactionSync(work)
        : work()),
    });
    return this._feedback;
  }

  /**
   * Record that a reader is here. Mirrors the Node server's heartbeat: a POST
   * establishes or refreshes a session and hands back its token; a GET only
   * reports. Presence is a session fact, never a world fact.
   */
  touchPresence(token, atMs) {
    const viewerToken = typeof token === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(token)
      ? token : crypto.randomUUID();
    this.db.prepare(`INSERT INTO audience_sessions(token_hash, started_at, last_seen)
      VALUES(?, ?, ?) ON CONFLICT(token_hash) DO UPDATE SET last_seen = excluded.last_seen`)
      .run(viewerToken, atMs, atMs);
    return viewerToken;
  }

  dropPresence(token) {
    if (typeof token !== 'string' || !token) return;
    this.db.prepare('DELETE FROM audience_sessions WHERE token_hash = ?').run(token);
  }

  /**
   * The reader-facing world body, matching `publicWorld()` in server.mjs.
   *
   * The raw projection is not what the page consumes. The Node server decorates
   * it with `storyThreads` and, per event, a `backgroundUrl` and any performed
   * cinematic — and the app needs all three: without `storyThreads` the
   * "Across Silver Clouds" panel never leaves "Loading…", and `render()` throws
   * before anything else appears. Returning the bare projection is what left
   * the page stuck on "Connecting to Silver Clouds…" even though every request
   * was answering 200.
   */
  publicWorldForApi() {
    const snapshot = this.presentationSnapshot();
    if (!snapshot) return null;
    const projection = this.fixture.publicProjection(snapshot);
    const storyThreads = listStoryThreads(snapshot);
    return {
      ...projection,
      storyThreads,
      events: (projection.events ?? []).map((event) => {
        const visuals = selectVisualVocabulary({
          event, daypart: daypart(event.occurredAt), room: event.area,
        });
        const file = BACKGROUND_BY_ID[visuals.backgrounds[0]]?.file;
        // The app is mounted at /worldstream/app/ on the website, so artwork is
        // served from there rather than the site root.
        const backgroundUrl = file ? `${APP_MOUNT}${file}` : undefined;
        const row = this.db.prepare('SELECT * FROM cinematics WHERE event_id = ?').get(event.id);
        const performed = row?.scene_json && ['performed', 'fallback'].includes(row.status)
          ? this.cinematicForApi({
            eventId: row.event_id, occurredAt: row.occurred_at, acceptedAt: row.accepted_at,
            score: row.score, band: row.band, status: row.status,
            scene: JSON.parse(row.scene_json), packet: JSON.parse(row.packet_json),
          }, { event: this.eventById(row.event_id), snapshot })
          : null;
        return { ...event, backgroundUrl, ...(performed ? { cinematic: performed } : {}) };
      }),
    };
  }

  /**
   * HTTP Dispatch: handles all reader and administrative endpoints.
   */
  async fetch(request) {
    const startMs = Date.now();
    const url = new URL(request.url);
    const pathname = url.pathname;

    // WebSocket upgrade handler
    if (request.headers.get('Upgrade') === 'websocket') {
      this.capacity.recordRequest('websocketConnect', 0.5);
      this.capacity.recordSessionEvent('connect');
      
      // Advance to current moment
      this.catchUp(Date.now());

      const pair = typeof WebSocketPair !== 'undefined'
        ? new WebSocketPair()
        : { 0: { readyState: 1 }, 1: { readyState: 1, send() {} } };
      const [client, server] = Object.values(pair);

      // Hibernating WebSocket registration: idle connections consume 0 billed CPU time
      this.ctx.acceptWebSocket(server, ['readers']);

      // Send initial hello state
      const snap = this.presentationSnapshot();
      const initialPublic = snap ? this.fixture.publicProjection(snap) : null;
      server.send(JSON.stringify({
        type: 'HELLO',
        serverTime: Date.now(),
        world: initialPublic
      }));

      try {
        return new Response(null, { status: 101, webSocket: client });
      } catch {
        return new Response(JSON.stringify({ status: 101, message: 'Switching Protocols (WebSocket)' }), { status: 200 });
      }
    }

    // Advance world on demand for incoming HTTP requests
    this.catchUp(Date.now());

    // CORS & response headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-id, x-viewer-token',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const sendJson = (status, data) => {
      this.capacity.recordRequest('http', Date.now() - startMs);
      return new Response(JSON.stringify(data), { status, headers: corsHeaders });
    };

    try {
      // /api/world
      if (pathname === '/api/world') {
        const serverTime = Date.now();
        return sendJson(200, {
          ...this.publicWorldForApi(), clocks: evaluatePlotClocks(this, serverTime), serverTime,
        });
      }

      // /api/history
      if (pathname === '/api/history') {
        if (request.method !== 'GET') return sendJson(405, { error: 'Use GET for this endpoint.' });
        try { return sendJson(200, this.publicHistory(historyOptions(url.searchParams))); }
        catch (error) {
          if (error instanceof RangeError) return sendJson(400, { error: error.message });
          throw error;
        }
      }

      const contextMatch = pathname.match(/^\/api\/events\/([^/]+)\/context$/);
      if (contextMatch) {
        if (request.method !== 'GET') return sendJson(405, { error: 'Use GET for this endpoint.' });
        let eventId;
        try { eventId = decodeURIComponent(contextMatch[1]); }
        catch { return sendJson(400, { error: 'Invalid event reference.' }); }
        const context = this.publicEventContext(eventId);
        return context ? sendJson(200, context) : sendJson(404, { error: 'Public passage not found.' });
      }

      // /api/clocks
      if (pathname === '/api/clocks') {
        return sendJson(200, { clocks: evaluatePlotClocks(this, Date.now()), serverTime: Date.now() });
      }

      // /api/cinematics/archive
      if (pathname === '/api/cinematics/archive') {
        this.recoverRecentCinematicArchive();
        const snap = this.presentationSnapshot();
        const rows = this.db.prepare(`
          SELECT * FROM cinematics
          WHERE scene_json IS NOT NULL AND status IN ('performed', 'fallback')
          ORDER BY occurred_at DESC
          LIMIT 30
        `).all().map(r => {
          const event = this.eventById(r.event_id) ?? snap?.events?.find(e => e.id === r.event_id) ?? null;
          const parsed = {
            eventId: r.event_id,
            occurredAt: r.occurred_at,
            score: r.score,
            band: r.band,
            status: r.status,
            scene: JSON.parse(r.scene_json),
            packet: JSON.parse(r.packet_json)
          };
          return this.cinematicForApi(parsed, { event, snapshot: snap });
        });
        return sendJson(200, { cinematics: rows, serverTime: Date.now() });
      }

      // /api/cinematics/events/:id
      const cinMatch = pathname.match(/^\/api\/cinematics\/events\/([^/?#]+)$/);
      if (cinMatch) {
        const eventId = decodeURIComponent(cinMatch[1]);
        const r = this.db.prepare('SELECT * FROM cinematics WHERE event_id = ?').get(eventId);
        if (!r || !r.scene_json) return sendJson(404, { error: 'Cinematic not found.' });
        const snap = this.presentationSnapshot();
        const event = this.eventById(eventId) ?? snap?.events?.find(e => e.id === eventId) ?? null;
        const parsed = {
          eventId: r.event_id,
          occurredAt: r.occurred_at,
          score: r.score,
          band: r.band,
          status: r.status,
          scene: JSON.parse(r.scene_json),
          packet: JSON.parse(r.packet_json)
        };
        return sendJson(200, { cinematic: this.cinematicForApi(parsed, { event, snapshot: snap }), serverTime: Date.now() });
      }

      // /api/dispatch/latest
      if (pathname === '/api/dispatch/latest') {
        const dispatch = getLatestDispatch(this, Date.now());
        return sendJson(200, dispatch);
      }

      // /api/dispatch/:date
      const dispatchMatch = pathname.match(/^\/api\/dispatch\/([^/?#]+)$/);
      if (dispatchMatch) {
        const dateStr = decodeURIComponent(dispatchMatch[1]);
        const dispatch = getDispatchByDate(this, dateStr);
        return sendJson(200, dispatch);
      }

      // /api/presence
      if (pathname === '/api/presence') {
        const activeSockets = this.ctx.getWebSockets ? (this.ctx.getWebSockets('readers')?.length || 0) : 0;
        return sendJson(200, {
          ok: true,
          activeReaders: activeSockets,
          serverTime: Date.now()
        });
      }

      // /api/shadow/moments (Stub boundary for parallel Moment Engine agent)
      if (pathname === '/api/shadow/moments') {
        if (request.method === 'POST') {
          const body = await request.json();
          const recorded = this.shadowAdapter.recordProposal(body);
          return sendJson(201, recorded);
        }
        const proposals = this.shadowAdapter.listProposals();
        return sendJson(200, { proposals, serverTime: Date.now() });
      }

      // ================================================ reader-facing parity
      //
      // Ported from `server.mjs`, which is the behavioural reference. Response
      // shapes are reproduced exactly so the existing frontend needs no change.

      // /api/observe — the reader bootstrap, and the only one of these that
      // touches the world at all. It advances to now, exactly as the Node
      // server does, and returns the same body as /api/world.
      if (pathname === '/api/observe') {
        if (request.method !== 'POST') return sendJson(405, { error: 'Use POST for this endpoint.' });
        const serverTime = Date.now();
        this.advance(serverTime);
        try { this.social.syncWagers(this, serverTime); } catch {}
        return sendJson(200, {
          ...this.publicWorldForApi(), clocks: evaluatePlotClocks(this, serverTime), serverTime,
        });
      }

      // /api/cinematics/live — the same query the Node cinematic store runs,
      // against this Durable Object's own cinematics table.
      if (pathname === '/api/cinematics/live') {
        if (request.method !== 'GET') return sendJson(405, { error: 'Use GET for this endpoint.' });
        const serverTime = Date.now();
        const asked = Number(url.searchParams.get('after') || 0);
        const afterAcceptedAt = Number.isSafeInteger(asked) && asked >= 0 ? asked : 0;
        const maxAgeMs = 180_000;
        const row = this.db.prepare(`SELECT * FROM cinematics
          WHERE status IN ('performed','fallback') AND scene_json IS NOT NULL
            AND accepted_at > ? AND accepted_at >= ? AND accepted_at <= ?
          ORDER BY accepted_at, event_id LIMIT 1`)
          .get(afterAcceptedAt, serverTime - maxAgeMs, serverTime);
        let cinematic = null;
        if (row) {
          const snap = this.presentationSnapshot();
          const event = this.eventById(row.event_id) ?? snap?.events?.find(e => e.id === row.event_id) ?? null;
          cinematic = this.cinematicForApi({
            eventId: row.event_id, occurredAt: row.occurred_at, acceptedAt: row.accepted_at,
            score: row.score, band: row.band, status: row.status,
            scene: JSON.parse(row.scene_json), packet: JSON.parse(row.packet_json),
          }, { event, snapshot: snap });
        }
        return sendJson(200, { cinematic, serverTime });
      }

      // /api/highlights/today
      if (pathname === '/api/highlights/today') {
        if (request.method !== 'GET') return sendJson(405, { error: 'Use GET for this endpoint.' });
        let events = [];
        try { events = this.publicProjection()?.events ?? []; } catch {}
        return sendJson(200, this.social.getTodayHighlight(events, null, Date.now()));
      }

      // /api/story-thread
      if (pathname === '/api/story-thread') {
        if (request.method !== 'GET') return sendJson(405, { error: 'Use GET for this endpoint.' });
        const type = url.searchParams.get('type'), id = url.searchParams.get('id');
        if ([...url.searchParams.keys()].length !== 2
          || !['story', 'intention', 'operation'].includes(type)
          || typeof id !== 'string' || !/^[a-zA-Z0-9:_-]{1,160}$/.test(id)) {
          return sendJson(400, { error: 'Invalid story reference.' });
        }
        const snapshot = this.presentationSnapshot();
        const thread = snapshot
          ? buildStoryThread(snapshot, { type, id }, { eventById: eventId => this.eventById(eventId) })
          : null;
        if (!thread) return sendJson(404, { error: 'Public story not found.' });
        return sendJson(200, thread);
      }

      // /api/presence/ping and /api/presence/leave
      if (pathname === '/api/presence/ping') {
        if (!['GET', 'POST'].includes(request.method)) return sendJson(405, { error: 'Use GET or POST for this endpoint.' });
        const serverTime = Date.now();
        if (request.method !== 'POST') return sendJson(200, { ok: true, serverTime });
        const viewerToken = this.touchPresence(request.headers.get('x-viewer-token'), serverTime);
        return sendJson(200, { ok: true, viewerToken, serverTime });
      }

      if (pathname === '/api/presence/leave') {
        if (request.method !== 'POST') return sendJson(405, { error: 'Use POST for this endpoint.' });
        let body = {};
        try { body = await request.json(); } catch {}
        this.dropPresence(request.headers.get('x-viewer-token') || body?.viewerToken);
        return sendJson(200, { ok: true });
      }

      // /api/tracks and /api/ambient-sources — media listings, not world state.
      // The audio itself is static and served by the site; see media-manifest.
      if (pathname === '/api/tracks') {
        return sendJson(200, { tracks: TRACKS });
      }

      if (pathname === '/api/ambient-sources') {
        if (!['GET', 'HEAD'].includes(request.method)) return sendJson(405, { error: 'Use GET for sound settings.' });
        return sendJson(200, { sources: AMBIENT_SOURCES });
      }

      // /api/feedback — the reader poll. Its own tables; submitting a ballot
      // cannot advance the world or write an event.
      if (pathname === '/api/feedback') {
        if ([...url.searchParams.keys()].length) return sendJson(400, { error: 'The poll does not accept query parameters.' });
        if (request.method === 'GET') return sendJson(200, this.feedback.summary());
        if (request.method !== 'POST') return sendJson(405, { error: 'Use GET or POST for this endpoint.' });
        if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
          return sendJson(415, { error: 'Send feedback as JSON.' });
        }
        try {
          const raw = await request.text();
          if (raw.length > MAX_FEEDBACK_BODY_BYTES) return sendJson(413, { error: 'Invalid feedback request.' });
          return sendJson(200, this.feedback.vote(JSON.parse(raw)));
        } catch (error) {
          if (error instanceof FeedbackError) {
            const headers = { ...corsHeaders };
            if (error.retryAfterMs) headers['Retry-After'] = String(Math.max(1, Math.ceil(error.retryAfterMs / 1000)));
            this.capacity.recordRequest('http', Date.now() - startMs);
            return new Response(JSON.stringify({ error: error.message }), { status: error.status, headers });
          }
          return sendJson(400, { error: 'Invalid feedback request.' });
        }
      }

      // /api/events/:id/{social,react,comment,wager,wager/vote}
      const eventMatch = pathname.match(/^\/api\/events\/([^/?#]+)\/(social|react|comment|wager(?:\/vote)?)$/);
      if (eventMatch) {
        let eventId;
        try { eventId = decodeURIComponent(eventMatch[1]); }
        catch { return sendJson(400, { error: 'Invalid event ID encoding.' }); }
        const kind = eventMatch[2];
        const serverTime = Date.now();
        const snap = this.presentationSnapshot();
        const event = this.eventById(eventId) ?? snap?.events?.find(e => e.id === eventId) ?? null;

        if (kind === 'social') {
          if (request.method !== 'GET') return sendJson(405, { error: 'Use GET for this endpoint.' });
          return sendJson(200, this.social.getSocial(eventId, event, serverTime));
        }
        if (kind === 'wager') {
          if (request.method !== 'GET') return sendJson(405, { error: 'Use GET for this endpoint.' });
          const travellerId = url.searchParams.get('travellerId');
          return sendJson(200, { wager: this.social.getWagerByEventId(eventId, travellerId, serverTime) });
        }
        if (request.method !== 'POST') return sendJson(405, { error: 'Use POST for this endpoint.' });
        let body = {};
        try { body = await request.json(); } catch { return sendJson(400, { error: 'Invalid request body.' }); }
        // Response shapes copied from server.mjs rather than invented: the
        // frontend reads `reactions`, `comment`/`totalComments` and
        // `wager`/`userVote` from these exact keys.
        try {
          if (kind === 'react') {
            if (typeof body.reaction !== 'string' || !body.reaction) {
              return sendJson(400, { error: 'A reaction string is required.' });
            }
            this.social.addReaction(eventId, body.reaction, body.delta === -1 ? -1 : 1);
            const updated = this.social.getSocial(eventId, event, serverTime);
            return sendJson(200, { success: true, eventId, reactions: updated.reactions });
          }
          if (kind === 'comment') {
            if (typeof body.text !== 'string' || !body.text.trim()) {
              return sendJson(400, { error: 'Comment text is required.' });
            }
            const comment = this.social.addComment(eventId, body);
            const updated = this.social.getSocial(eventId, event, serverTime);
            return sendJson(200, { success: true, comment, totalComments: updated.totalComments });
          }
          // wager/vote — create the wager on demand exactly as the Node server
          // does, so a first vote on an undetected event still works.
          if (!this.social.getWagerByEventId(eventId, null, serverTime) && event) {
            const detected = detectWagerForEvent(event, snap, serverTime);
            if (detected) this.social.createWager(detected, serverTime);
          }
          const wager = this.social.castWagerVote(eventId, body.travellerId, body.optionId, serverTime);
          return sendJson(200, { success: true, wager, userVote: body.optionId });
        } catch (error) {
          if (error?.message === 'WAGER_NOT_FOUND') return sendJson(404, { error: 'No wager found for this event.' });
          return sendJson(400, { error: String(error?.message ?? 'Invalid request.') });
        }
      }

      // /api/capacity & /api/health
      if (pathname === '/api/capacity') {
        const metrics = this.capacity.getMeasuredMetrics();
        const storageBytes = this.capacity.measureStorageBytes(this.db);
        const projection = this.capacity.projectFreeTierHeadroom({ measuredDbBytes: storageBytes });
        return sendJson(200, { metrics, storageBytes, projection, serverTime: Date.now() });
      }

      if (pathname === '/health' || pathname === '/api/health') {
        return sendJson(200, {
          status: 'ok',
          worldId: this.fixture?.worldId,
          rulesVersion: this.fixture?.rulesVersion,
          stats: this.operationalStats(),
          serverTime: Date.now()
        });
      }

      return sendJson(404, { error: 'Not found' });
    } catch (error) {
      console.error('DO error:', error);
      return sendJson(500, { error: error.message });
    }
  }
}
