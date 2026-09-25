import { WorldDurableObject as Runtime } from './world-durable-object.mjs';
import { SqliteAdapter } from './sqlite-adapter.mjs';
import { createMaintenanceController } from './production-maintenance.mjs';
import { createFixture, RULES_VERSION, assertCanonState } from '../../src/fixture.mjs';
import { matchesRulesIdentity, savedEpochStartMs } from '../../src/world-identity.mjs';
import { CSV_RULES } from '../../src/counterfactual-value.mjs';
import { readProductionPathSpies } from '../../src/production-path-spies.mjs';
import { assertProspectiveActivation, NARRATIVE_ACTIVATION, RHYTHM_ACTIVATION } from '../../src/prospective-activation.mjs';

const EGRESS = Symbol.for('worldstream.production.fetch-boundary.v1');
const json = (status, value) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
const flag = value => value === true || value === 'true';
const WEATHER_HOST = 'api.open-meteo.com';

// Install once per isolate, before runtime methods can resolve global fetch.
// There are no production model clients. This final boundary also prevents a
// future accidental client from making a request. Logs never include tokens,
// query strings, payloads or private counterfactual evidence.
export function installProductionFetchBoundary(target = globalThis, logger = console) {
  if (target[EGRESS]) return target[EGRESS];
  const original = target.fetch?.bind(target);
  const counters = { weatherRequests: 0, blockedRequests: 0 };
  const boundary = { snapshot: () => ({ ...counters, scope: 'current_worker_isolate' }) };
  target.fetch = async (input, init = {}) => {
    let url;
    try { url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url); }
    catch { /* Invalid requests fail closed below. */ }
    const method = String(init.method ?? input?.method ?? 'GET').toUpperCase();
    if (!url || url.protocol !== 'https:' || url.hostname !== WEATHER_HOST || url.port
      || url.username || url.password || url.pathname !== '/v1/forecast' || method !== 'GET' || !original) {
      counters.blockedRequests++;
      logger.error(JSON.stringify({ kind: 'worldstream_egress_blocked', host: url?.hostname ?? 'invalid', method }));
      throw new Error('Production network boundary blocked an unapproved request');
    }
    counters.weatherRequests++;
    // A permitted weather URL must never redirect into another external host.
    return original(input, { ...init, redirect: 'error' });
  };
  Object.defineProperty(target, EGRESS, { value: boundary });
  return boundary;
}

const egress = installProductionFetchBoundary();
const readRoutes = pathname => ['/api/world', '/api/health', '/health', '/api/history',
  '/api/presence', '/api/tracks', '/api/ambient-sources', '/api/story-thread',
  '/api/cinematics/live', '/api/cinematics/archive'].includes(pathname)
  || /^\/api\/events\/[^/]+\/context$/.test(pathname)
  || /^\/api\/cinematics\/events\/[^/]+$/.test(pathname);

function existingFixture(db) {
  if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='world_state'").get())
    throw new Error('No existing world; controlled deployment never creates a new continuity');
  const row = db.prepare('SELECT * FROM world_state WHERE id=1').get();
  if (!row) throw new Error('No existing world; controlled deployment never creates a new continuity');
  const fixture = createFixture({ startMs: savedEpochStartMs(row.state_json) });
  if (!matchesRulesIdentity(row.rules_version, fixture, RULES_VERSION))
    throw new Error(`Existing world requires an explicit verified upgrade to ${RULES_VERSION}`);
  const state = JSON.parse(row.state_json);
  assertCanonState(state);
  const pending = db.prepare('SELECT * FROM scheduled_actions ORDER BY id').all();
  const activationContext = { state, pending, resolvedThrough: row.resolved_through };
  assertProspectiveActivation({ ...activationContext, ...NARRATIVE_ACTIVATION });
  assertProspectiveActivation({ ...activationContext, ...RHYTHM_ACTIVATION });
  const comments = db.prepare("SELECT name FROM pragma_table_info('event_comments')").all();
  if (comments.length && !comments.some(column => column.name === 'author_name'))
    throw new Error('Legacy audience schema requires a preserving migration; refusing destructive initialization');
  return fixture;
}

export class ControlledWorldDurableObject {
  constructor(ctx, env = {}) {
    this.ctx = ctx; this.env = env; this.db = new SqliteAdapter(ctx.storage.sql);
    this.controller = createMaintenanceController(ctx, env);
    this.runtime = null; this.paused = true; this.manualAdvance = false; this.writerAdvance = false;
    this.inFlight = new Set();
    this.wallTime = { advances: 0, lastAdvanceMs: 0, maxAdvanceMs: 0, scope: 'current_object_activation' };
    this.csvViolations = 0; this.lastCSVKey = null;
  }

  readCSV() {
    if (!this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='world_state'").get()) return null;
    const row = this.db.prepare("SELECT json_extract(state_json,'$.narrativeSignals.csv.lastEvaluation') AS csv FROM world_state WHERE id=1").get();
    return row?.csv ? JSON.parse(row.csv) : null;
  }

  csvMetric() {
    const csv = this.readCSV();
    if (!csv) return null;
    const actions = (csv.processedActions?.loyalty ?? 0) + (csv.processedActions?.ambition ?? 0);
    const valid = Number.isSafeInteger(actions) && actions >= 0 && actions <= CSV_RULES.maxActions
      && Number.isFinite(csv.cloneBytes) && csv.cloneBytes >= 0 && csv.cloneBytes <= CSV_RULES.maxCloneBytes
      && Number.isFinite(csv.logWeights?.loyalty) && Number.isFinite(csv.logWeights?.ambition)
      && Math.abs(csv.logWeights.loyalty - csv.logWeights.ambition) <= Math.log(CSV_RULES.maxMultiplier) + 1e-12;
    return { csv, valid, log: { kind: 'worldstream_csv_evaluation', evaluatedAt: csv.evaluatedAt,
      status: csv.status, reason: csv.reason, actions, cloneBytes: csv.cloneBytes,
      preferredMotive: csv.preferredMotive, gain: csv.gain, boundsValid: valid } };
  }

  logCSV() {
    const metric = this.csvMetric();
    const key = metric && `${metric.csv.evaluatedAt}|${metric.csv.opportunityId}`;
    if (!metric || key === this.lastCSVKey) return;
    this.lastCSVKey = key;
    if (!metric.valid) this.csvViolations++;
    console.log(JSON.stringify(metric.log));
  }

  getRuntime() {
    if (this.runtime) return this.runtime;
    // Do this before any Runtime constructor/schema method can write anything.
    existingFixture(this.db);
    const owner = this;
    class GuardedRuntime extends Runtime {
      ensureWorld() {
        this.fixture = existingFixture(this.db); this.initialized = true;
        // No implicit bootstrap, timestamp repairs, or alarm scheduling.
      }
      initAudienceTables() {
        const columns = this.db.prepare("SELECT name FROM pragma_table_info('event_comments')").all();
        if (columns.length && !columns.some(column => column.name === 'author_name'))
          throw new Error('Refusing destructive audience migration');
        super.initAudienceTables();
      }
      async ensureAlarm() {
        return owner.track(async () => {
          if (owner.paused) return;
          const alarm = await this.storage.getAlarm();
          if (!alarm && !await owner.controller.isPaused()) await this.storage.setAlarm(Date.now() + 1000);
        });
      }
      // Reader arrival, refresh and bootstrap cannot determine canonical time.
      catchUp() { return []; }
      recoverRecentCinematicArchive() {}
      async pollScheduledWeather(now) { if (!owner.paused) return super.pollScheduledWeather(now); }
      advance(targetMs) {
        if ((!owner.writerAdvance && !owner.manualAdvance) || (owner.paused && !owner.manualAdvance)) return [];
        const began = Date.now();
        try {
          const result = super.advance(targetMs); owner.logCSV(); return result;
        } finally {
          const elapsed = Math.max(0, Date.now() - began);
          owner.wallTime.advances++; owner.wallTime.lastAdvanceMs = elapsed;
          owner.wallTime.maxAdvanceMs = Math.max(owner.wallTime.maxAdvanceMs, elapsed);
        }
      }
      async alarm() {
        const began = Date.now();
        await this.pollScheduledWeather(began);
        owner.paused = await owner.controller.isPaused();
        if (owner.paused) return;
        if (typeof this.storage.transactionSync !== 'function') throw new Error('Atomic writer requires transactionSync');
        let events;
        owner.writerAdvance = true;
        try { events = this.storage.transactionSync(() => this.advance(began)); }
        finally { owner.writerAdvance = false; }
        if (events.length) this.broadcastEvents(events);
        this.sceneReservoir.tick(this.presentationSnapshot(), began);
        this.capacity.recordRequest('alarms', Date.now() - began);
        if (!await owner.controller.isPaused()) await this.storage.setAlarm(Date.now() + 60_000);
        // Failures propagate to the owner, which durably pauses the writer.
      }
    }
    const previous = this.readCSV();
    this.lastCSVKey = previous ? `${previous.evaluatedAt}|${previous.opportunityId}` : null;
    this.runtime = new GuardedRuntime(this.ctx, { ...this.env, AUTO_INIT: true });
    return this.runtime;
  }

  async telemetry() {
    const status = await this.controller.status();
    const metric = this.csvMetric();
    return { ...status, runtimeInitialized: Boolean(this.runtime), csv: metric?.csv ?? null,
      csvBoundsValid: metric?.valid ?? true, csvViolationCount: this.csvViolations,
      csvLimits: { actionsPerPair: CSV_RULES.maxActions, cloneBytes: CSV_RULES.maxCloneBytes,
        maxRelativeMultiplier: CSV_RULES.maxMultiplier, cooldownMs: CSV_RULES.cooldownMs },
      wallTime: { ...this.wallTime, note: 'Elapsed wall time; actual platform CPU must be read from Cloudflare telemetry' },
      sql: this.runtime?.adapter.getMetrics() ?? this.db.getMetrics(), egress: egress.snapshot(),
      authoring: { ...readProductionPathSpies(), scope: 'current_worker_isolate' } };
  }

  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/__ops/')) {
      const response = await this.controller.handle(request);
      if (response) {
        this.paused = await this.controller.isPaused();
        if (pathname === '/__ops/pause' && response.ok && this.paused) {
          // A weather fetch may already have yielded before pause arrived.
          // Acknowledge quiescence only after it and any prior request finish.
          await Promise.allSettled([...this.inFlight]);
          await this.ctx.storage.deleteAlarm();
        }
        if (pathname === '/__ops/resume' && response.ok && !this.paused) await this.getRuntime().ensureAlarm();
        return response;
      }
      if (!await this.controller.authorize(request)) return json(401, { error: 'Unauthorized' });
      if (pathname === '/__ops/telemetry') {
        if (request.method !== 'GET') return json(405, { error: 'Use GET' });
        return json(200, await this.telemetry());
      }
      if (pathname === '/__ops/advance') return this.controller.exclusive(() => this.advanceControlled(request));
      return json(404, { error: 'Unknown operation' });
    }
    this.paused = await this.controller.isPaused();
    if (this.paused && !(flag(this.env.WORLD_OPS_READ_WHILE_PAUSED) && request.method === 'GET'
      && !request.headers.has('Upgrade') && readRoutes(pathname) && await this.controller.authorize(request)))
      return json(503, { status: 'paused' });
    try { return await this.track(() => this.getRuntime().fetch(request)); }
    catch (error) { return json(503, { error: error.message }); }
  }

  async advanceControlled(request) {
    if (request.method !== 'POST') return json(405, { error: 'Use POST' });
    this.paused = await this.controller.isPaused();
    if (!this.paused) return json(409, { error: 'Controlled advance requires a paused writer' });
    if (!flag(this.env.WORLD_OPS_ALLOW_ADVANCE)) return json(409, { error: 'Controlled advance is disabled for this deployment' });
    if ((await this.controller.status()).importStatus !== 'verified') return json(409, { error: 'A verified imported candidate is required' });
    if (typeof this.ctx.storage.transactionSync !== 'function') return json(503, { error: 'Atomic advance requires transactionSync' });
    let body;
    try { const text = await request.text(); if (text.length > 1024) throw new Error(); body = JSON.parse(text); }
    catch { return json(400, { error: 'Invalid advance request' }); }
    const row = this.db.prepare('SELECT resolved_through FROM world_state WHERE id=1').get();
    const target = body.targetMs;
    if (!Number.isSafeInteger(target) || target <= row.resolved_through || target > row.resolved_through + 60_000)
      return json(400, { error: 'Advance must be 1–60000 ms after the committed watermark' });
    try {
      const runtime = this.getRuntime();
      this.manualAdvance = true;
      const work = () => runtime.advance(target);
      const events = this.ctx.storage.transactionSync(work);
      const confirmation = await this.controller.recordSmokeAdvance({ before: row.resolved_through, after: target, targetMs: target });
      return json(200, { status: 'advanced_paused_candidate', resolvedThrough: target,
        publicEvents: events.length, confirmation, telemetry: await this.telemetry() });
    } catch (error) { return json(409, { error: error.message }); }
    finally { this.manualAdvance = false; }
  }

  async alarm() {
    this.paused = await this.controller.isPaused();
    if (this.paused) { await this.ctx.storage.deleteAlarm(); return; }
    try { await this.track(() => this.getRuntime().alarm()); }
    catch (error) {
      console.error(JSON.stringify({ kind: 'worldstream_controlled_alarm_error', error: error.message }));
      await this.controller.pause();
    }
    finally { this.paused = await this.controller.isPaused(); if (this.paused) await this.ctx.storage.deleteAlarm(); }
  }
  async track(work) {
    const pending = Promise.resolve().then(work); this.inFlight.add(pending);
    try { return await pending; } finally { this.inFlight.delete(pending); }
  }
  async webSocketMessage(ws, message) {
    this.paused = await this.controller.isPaused();
    if (this.paused) { ws.send(JSON.stringify({ type: 'PAUSED' })); return; }
    return this.getRuntime().webSocketMessage(ws, message);
  }
  async webSocketClose(...args) { if (this.runtime) return this.runtime.webSocketClose(...args); }
  async webSocketError(...args) { if (this.runtime) return this.runtime.webSocketError(...args); }
}

export { ControlledWorldDurableObject as controlledWorld };
