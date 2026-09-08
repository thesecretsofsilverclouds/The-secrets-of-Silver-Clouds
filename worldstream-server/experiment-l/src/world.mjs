import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// All names of actions, conditions and outcomes below are synthetic test fixtures.
// This bounded experiment is not an assertion about the books' canon.
export const WORLD_ID = 'silver-clouds-experiment-l';
export const DEFAULT_SEED = 'silver-clouds-experiment-l';
export const RULES_VERSION = 'synthetic-fixture-v1';
export const START_MS = Date.parse('2026-09-04T11:00:00.000Z');
export const END_MS = Date.parse('2026-09-04T17:00:00.000Z');

// This fixture is exactly one BST afternoon; this is not a general timezone API.
export function at(localTime) {
  if (!/^\d{2}:\d{2}$/.test(localTime)) throw new RangeError('Expected HH:mm');
  const [hour, minute] = localTime.split(':').map(Number);
  if (hour > 23 || minute > 59) throw new RangeError('Invalid fixture time');
  return Date.parse('2026-09-04T00:00:00.000Z') + ((hour - 1) * 60 + minute) * 60_000;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function semanticDigest(snapshot) {
  return createHash('sha256').update(JSON.stringify(canonical(snapshot))).digest('hex');
}

function eventId(seed, actionId) {
  const suffix = createHash('sha256').update(`${WORLD_ID}|${RULES_VERSION}|${seed}|${actionId}`).digest('hex').slice(0, 12);
  return `evt:${actionId}:${suffix}`;
}

function choose(seed, actionId, choices) {
  const number = createHash('sha256').update(`${seed}|${RULES_VERSION}|${actionId}|condition-side`).digest().readUInt32BE(0);
  return choices[number % choices.length];
}

export function selectEncounterOutcome({ knowledge, atMs, sourceEventId, conditionActive }) {
  const knows = knowledge.some((memory) => memory.sourceEventId === sourceEventId
    && memory.factKey === 'synthetic.goaden.minor_strain' && memory.learnedAt <= atMs);
  return conditionActive && knows
    ? { type: 'concerned_check_in', referencedEventIds: [sourceEventId], concernDelta: 1 }
    : { type: 'ordinary_greeting', referencedEventIds: [], concernDelta: 0 };
}

function initialState() {
  return {
    characters: {
      goaden: { id: 'goaden', displayName: 'Goaden', location: 'mi6', activity: 'research', journey: null, conditions: [], knowledge: [], lastOutcome: null },
      ashai: { id: 'ashai', displayName: 'Ashai', location: 'mi6', activity: 'waiting', journey: null, conditions: [], knowledge: [], lastOutcome: null },
    },
    relationships: [
      { from: 'ashai', to: 'goaden', concern: 0, trust: 0 },
      { from: 'goaden', to: 'ashai', concern: 0, trust: 0 },
    ],
  };
}

function initialActions() {
  // Arrivals precede encounters at the same timestamp. IDs break remaining ties.
  return [
    { id: 'early-encounter', time: '12:30', priority: 40, type: 'encounter', learn: false },
    { id: 'ashai-outbound', time: '12:40', priority: 10, type: 'depart', character: 'ashai', from: 'mi6', to: 'sanctuary', arrival: '13:00', arrivalId: 'ashai-outbound-arrival' },
    { id: 'minor-condition', time: '13:00', priority: 20, type: 'condition' },
    { id: 'scheduled-training', time: '13:10', priority: 30, type: 'scheduled_activity', planned: 'training' },
    { id: 'goaden-outbound', time: '13:50', priority: 10, type: 'depart', character: 'goaden', from: 'mi6', to: 'sanctuary', arrival: '14:18', arrivalId: 'goaden-outbound-arrival' },
    { id: 'learning-encounter', time: '14:18', priority: 40, type: 'encounter', learn: true },
    { id: 'ashai-return', time: '15:00', priority: 10, type: 'depart', character: 'ashai', from: 'sanctuary', to: 'mi6', arrival: '15:20', arrivalId: 'ashai-return-arrival' },
    { id: 'ashai-revisit', time: '16:30', priority: 10, type: 'depart', character: 'ashai', from: 'mi6', to: 'sanctuary', arrival: '16:50', arrivalId: 'ashai-revisit-arrival' },
    { id: 'later-encounter', time: '17:00', priority: 40, type: 'encounter', learn: false },
  ].map(({ time, ...action }) => ({ ...action, dueAt: at(time) }));
}

function assertState(state) {
  const locations = new Set(['mi6', 'sanctuary', 'streamliner']);
  if (Object.keys(state.characters).sort().join(',') !== 'ashai,goaden') throw new Error('Unexpected character');
  for (const actor of Object.values(state.characters)) {
    if (!locations.has(actor.location)) throw new Error('Unexpected location');
    if ((actor.location === 'streamliner') !== (actor.journey !== null)) throw new Error('Journey/location mismatch');
    if (new Set(actor.knowledge.map((m) => `${m.factKey}|${m.sourceEventId}`)).size !== actor.knowledge.length) throw new Error('Duplicate knowledge');
  }
  for (const pair of state.relationships) {
    if (pair.concern < 0 || pair.concern > 10 || pair.trust < 0 || pair.trust > 10) throw new Error('Relationship out of bounds');
  }
}

// A pure state transition. No wall clock, I/O, viewers or ambient random generator.
function reduceAction(state, action, seed) {
  const id = eventId(seed, action.id);
  const sourceId = eventId(seed, 'minor-condition');
  const changes = [];
  const followups = [];
  const goaden = state.characters.goaden;
  const ashai = state.characters.ashai;
  const pair = (from, to) => state.relationships.find((item) => item.from === from && item.to === to);
  const change = (entity, targetId, target, field, value) => {
    if (JSON.stringify(target[field]) === JSON.stringify(value)) return;
    changes.push({ entity, id: targetId, field, before: structuredClone(target[field]), after: structuredClone(value) });
    target[field] = value;
  };
  const setActor = (actor, field, value) => change('character', actor.id, actor, field, value);
  const setPair = (from, to, field, value) => change('relationship', `${from}->${to}`, pair(from, to), field, value);
  const knowledge = (learnedAt, acquisitionEventId, source) => ({
    factKey: 'synthetic.goaden.minor_strain', subject: 'goaden', sourceEventId: sourceId,
    acquisitionEventId, learnedAt, source, visibility: 'private',
    value: { condition: 'minor_strain', note: 'SYNTHETIC_PRIVATE_KNOWLEDGE_GOADEN_STRAIN' },
  });
  const condition = () => goaden.conditions.find((item) => item.id === 'synthetic-minor-strain' && item.active);
  const result = {
    id, type: action.type, occurredAt: action.dueAt, location: goaden.location,
    participants: ['goaden'], causedBy: [], payload: {}, changes, visibility: 'public', publicDescription: null,
  };

  if (action.type === 'condition') {
    if (goaden.location !== 'mi6' || condition()) throw new Error('Condition precondition failed');
    const side = choose(seed, action.id, ['left_arm', 'right_arm']);
    setActor(goaden, 'conditions', [{ id: 'synthetic-minor-strain', kind: 'minor_strain', side, active: true, since: action.dueAt, sourceEventId: id }]);
    setActor(goaden, 'knowledge', [...goaden.knowledge, knowledge(action.dueAt, id, 'self_observation')]);
    result.type = 'condition_applied';
    result.visibility = 'private';
    result.payload = { condition: 'minor_strain', side, synthetic: true };
  } else if (action.type === 'scheduled_activity') {
    const substitute = Boolean(condition());
    const selected = substitute ? 'resting' : action.planned;
    setActor(goaden, 'activity', selected);
    result.type = 'scheduled_activity_resolved';
    result.payload = { planned: action.planned, selected, reason: substitute ? 'active_minor_strain' : 'schedule' };
    result.causedBy = substitute ? [sourceId] : [];
    result.publicDescription = 'Goaden began his next scheduled activity.';
  } else if (action.type === 'depart') {
    const actor = state.characters[action.character];
    if (actor.location !== action.from || actor.journey !== null) throw new Error(`Departure precondition failed: ${action.id}`);
    const journey = { from: action.from, to: action.to, departedAt: action.dueAt, arrivesAt: at(action.arrival), departureEventId: id };
    setActor(actor, 'location', 'streamliner');
    setActor(actor, 'activity', 'travelling');
    setActor(actor, 'journey', journey);
    result.type = 'departed';
    result.location = 'streamliner';
    result.participants = [actor.id];
    result.payload = { from: action.from, to: action.to, arrivesAt: journey.arrivesAt };
    result.publicDescription = `${actor.displayName} boarded the Streamliner.`;
    followups.push({ id: action.arrivalId, dueAt: journey.arrivesAt, priority: 30, type: 'arrive', character: actor.id, to: action.to, departureEventId: id });
  } else if (action.type === 'arrive') {
    const actor = state.characters[action.character];
    if (actor.location !== 'streamliner' || actor.journey?.departureEventId !== action.departureEventId || actor.journey.arrivesAt !== action.dueAt) throw new Error('Arrival precondition failed');
    setActor(actor, 'location', action.to);
    setActor(actor, 'activity', actor.id === 'goaden' && condition() ? 'resting' : 'waiting');
    setActor(actor, 'journey', null);
    result.type = 'arrived';
    result.location = action.to;
    result.participants = [actor.id];
    result.causedBy = [action.departureEventId];
    result.payload = { destination: action.to };
    result.publicDescription = `${actor.displayName} arrived at ${action.to === 'mi6' ? 'MI6' : 'Sanctuary'}.`;
  } else if (action.type === 'encounter') {
    if (goaden.location !== ashai.location || goaden.journey || ashai.journey) throw new Error('Encounter requires co-location');
    result.type = 'encounter_resolved';
    result.participants = ['goaden', 'ashai'];
    if (action.learn) {
      if (!condition() || !goaden.knowledge.some((m) => m.sourceEventId === sourceId && m.learnedAt <= action.dueAt)) throw new Error('Knowledge transfer lacks provenance');
      if (ashai.knowledge.some((m) => m.sourceEventId === sourceId)) throw new Error('Knowledge already acquired');
      setActor(ashai, 'knowledge', [...ashai.knowledge, knowledge(action.dueAt, id, 'told_by_goaden')]);
      setActor(ashai, 'lastOutcome', 'learned_condition');
      setPair('ashai', 'goaden', 'concern', pair('ashai', 'goaden').concern + 1);
      result.payload = { outcome: 'learned_condition', referencedEventIds: [sourceId], learnedAt: action.dueAt };
      result.causedBy = [sourceId];
    } else {
      const outcome = selectEncounterOutcome({ knowledge: ashai.knowledge, atMs: action.dueAt, sourceEventId: sourceId, conditionActive: Boolean(condition()) });
      setActor(ashai, 'lastOutcome', outcome.type);
      if (outcome.concernDelta) {
        setPair('ashai', 'goaden', 'concern', pair('ashai', 'goaden').concern + outcome.concernDelta);
        setPair('goaden', 'ashai', 'trust', pair('goaden', 'ashai').trust + 1);
      }
      result.payload = { outcome: outcome.type, referencedEventIds: outcome.referencedEventIds };
      result.causedBy = [...outcome.referencedEventIds];
      if (outcome.referencedEventIds.length) result.causedBy.push(ashai.knowledge.find((m) => m.sourceEventId === sourceId).acquisitionEventId);
    }
    // Public text deliberately does not disclose what either character knows.
    result.publicDescription = 'Goaden and Ashai had a brief encounter.';
  } else {
    throw new Error(`Unknown action: ${action.type}`);
  }
  assertState(state);
  return { event: result, followups };
}

const DEFAULT_FIXTURE = Object.freeze({
  worldId: WORLD_ID,
  rulesVersion: RULES_VERSION,
  startMs: START_MS,
  endMs: END_MS,
  maxActions: 100,
  initialState,
  initialActions,
  reduceAction,
});

function validateFixture(fixture) {
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    throw new TypeError('A fixture must be an object');
  }
  for (const field of ['worldId', 'rulesVersion']) {
    if (typeof fixture[field] !== 'string' || !fixture[field].trim()) {
      throw new TypeError(`Fixture ${field} must be a nonempty string`);
    }
  }
  if (!Number.isSafeInteger(fixture.startMs) || !Number.isSafeInteger(fixture.endMs)
    || fixture.startMs >= fixture.endMs) {
    throw new RangeError('Fixture startMs/endMs must be ordered safe integers');
  }
  if (!Number.isSafeInteger(fixture.maxActions) || fixture.maxActions < 1) {
    throw new RangeError('Fixture maxActions must be a positive safe integer');
  }
  for (const field of ['initialState', 'initialActions', 'reduceAction', 'publicProjection']) {
    if (typeof fixture[field] !== 'function') throw new TypeError(`Fixture ${field} must be a function`);
  }
  // Snapshot the supplied configuration so a caller cannot swap its identity or
  // reducer after this connection has validated the persisted world.
  return Object.freeze({ ...fixture });
}

export class WorldStore {
  constructor({ dbPath, seed = DEFAULT_SEED, fixture }) {
    if (typeof seed !== 'string' || !seed.length) throw new TypeError('A nonempty seed is required');
    this.fixture = fixture === undefined ? DEFAULT_FIXTURE : validateFixture(fixture);
    // Reuse the existing rules column without changing the original fixture's
    // persisted value. Custom identity and bounds must agree when reopening.
    const persistedRules = fixture === undefined ? RULES_VERSION : `fixture:${JSON.stringify([
      this.fixture.worldId, this.fixture.rulesVersion, this.fixture.startMs,
      this.fixture.endMs, this.fixture.maxActions,
    ])}`;
    this.closed = false;
    if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    try {
      this.db.exec('PRAGMA busy_timeout = 30000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS world_state (
          id INTEGER PRIMARY KEY CHECK(id = 1), seed TEXT NOT NULL, rules_version TEXT NOT NULL,
          resolved_through INTEGER NOT NULL, state_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
          seq INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, occurred_at INTEGER NOT NULL,
          semantic_json TEXT NOT NULL, recorded_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scheduled_actions (
          id TEXT PRIMARY KEY, due_at INTEGER NOT NULL, priority INTEGER NOT NULL, action_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS scheduled_due ON scheduled_actions(due_at, priority, id);
      `);
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const existing = this.db.prepare('SELECT * FROM world_state WHERE id = 1').get();
        if (!existing) {
          this.db.prepare('INSERT INTO world_state VALUES (1, ?, ?, ?, ?)').run(seed, persistedRules, this.fixture.startMs, JSON.stringify(this.fixture.initialState()));
          const insert = this.db.prepare('INSERT INTO scheduled_actions VALUES (?, ?, ?, ?)');
          for (const action of this.fixture.initialActions()) insert.run(action.id, action.dueAt, action.priority, JSON.stringify(action));
        } else if (existing.seed !== seed || existing.rules_version !== persistedRules) {
          throw new Error('Persisted seed/rules differ; refusing to reinterpret history');
        }
        this.db.exec('COMMIT');
      } catch (error) {
        if (this.db.isTransaction) this.db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      this.close();
      throw error;
    }
  }

  advance(targetMs, { failBeforeCommit = false } = {}) {
    if (!Number.isSafeInteger(targetMs) || targetMs < this.fixture.startMs || targetMs > this.fixture.endMs) {
      throw new RangeError(this.fixture === DEFAULT_FIXTURE ? 'Target outside bounded 12:00–18:00 fixture' : 'Target outside bounded fixture');
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('SELECT * FROM world_state WHERE id = 1').get();
      if (targetMs <= row.resolved_through) {
        this.db.exec('COMMIT');
        return { processedActions: 0, appendedEvents: 0, resolvedThrough: row.resolved_through };
      }
      const state = JSON.parse(row.state_json);
      let seq = this.db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM events').get().seq;
      let processedActions = 0;
      const next = this.db.prepare('SELECT action_json FROM scheduled_actions WHERE due_at <= ? ORDER BY due_at, priority, id LIMIT 1');
      const insertAction = this.db.prepare('INSERT INTO scheduled_actions VALUES (?, ?, ?, ?)');
      const insertEvent = this.db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?)');
      for (;;) {
        const pending = next.get(targetMs);
        if (!pending) break;
        const action = JSON.parse(pending.action_json);
        if (action.dueAt <= row.resolved_through) throw new Error('Pending action behind committed watermark');
        const { event, followups } = this.fixture.reduceAction(state, action, row.seed);
        for (const followup of followups) {
          if (followup.dueAt <= action.dueAt) throw new Error('Follow-up must occur after its cause');
          insertAction.run(followup.id, followup.dueAt, followup.priority, JSON.stringify(followup));
        }
        const semanticEvent = { seq: ++seq, ...event };
        insertEvent.run(seq, event.id, event.occurredAt, JSON.stringify(semanticEvent), new Date().toISOString());
        this.db.prepare('DELETE FROM scheduled_actions WHERE id = ?').run(action.id);
        processedActions++;
        if (processedActions > this.fixture.maxActions) throw new Error('Bounded fixture action limit exceeded');
      }
      // Only rewrite the state when the state actually moved. The clock adapter
      // advances once a minute and the overwhelming majority of those ticks
      // process nothing at all, yet each one used to rewrite the entire
      // serialised world — which for a year-old world is megabytes, 1440 times a
      // day, under synchronous=FULL. Zero processed actions means the parsed
      // state is byte-identical to the row it came from, so only the watermark
      // has anything to say.
      if (processedActions === 0) {
        this.db.prepare('UPDATE world_state SET resolved_through = ? WHERE id = 1').run(targetMs);
      } else {
        this.db.prepare('UPDATE world_state SET resolved_through = ?, state_json = ? WHERE id = 1').run(targetMs, JSON.stringify(state));
      }
      if (failBeforeCommit) throw new Error('Injected failure before commit');
      this.db.exec('COMMIT');
      return { processedActions, appendedEvents: processedActions, resolvedThrough: targetMs };
    } catch (error) {
      // Only roll back a transaction that is still open. An unconditional
      // ROLLBACK here threw 'cannot rollback - no transaction is active' and
      // *replaced* the original exception, so every real failure inside advance
      // arrived at the test suite disguised as a SQLite logic error.
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  semanticSnapshot() {
    // The read transaction keeps state, ledger and pending queue on one revision.
    this.db.exec('BEGIN');
    try {
      const row = this.db.prepare('SELECT * FROM world_state WHERE id = 1').get();
      const state = JSON.parse(row.state_json);
      const events = this.db.prepare('SELECT semantic_json FROM events ORDER BY seq').all().map((entry) => JSON.parse(entry.semantic_json));
      const pendingActions = this.db.prepare('SELECT action_json FROM scheduled_actions ORDER BY due_at, priority, id').all().map((entry) => JSON.parse(entry.action_json));
      this.db.exec('COMMIT');
      return { world: { id: this.fixture.worldId, seed: row.seed, rulesVersion: this.fixture.rulesVersion, resolvedThrough: row.resolved_through }, ...state, events, pendingActions };
    } catch (error) {
      // Only roll back a transaction that is still open. An unconditional
      // ROLLBACK here threw 'cannot rollback - no transaction is active' and
      // *replaced* the original exception, so every real failure inside advance
      // arrived at the test suite disguised as a SQLite logic error.
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  publicProjection() {
    const snapshot = this.semanticSnapshot();
    if (this.fixture.publicProjection) return this.fixture.publicProjection(snapshot);
    // Explicit allowlists, not object spreading or a recursive denylist.
    return {
      worldId: snapshot.world.id,
      resolvedThrough: snapshot.world.resolvedThrough,
      characters: Object.values(snapshot.characters).map((actor) => ({ id: actor.id, name: actor.displayName, location: actor.location, activity: actor.activity })),
      events: snapshot.events.filter((event) => event.visibility === 'public' && event.publicDescription).map((event) => ({
        id: event.id, occurredAt: event.occurredAt, location: event.location,
        participants: [...event.participants], description: event.publicDescription,
      })),
    };
  }

  operationalStats() {
    const snapshot = this.semanticSnapshot();
    return { eventCount: snapshot.events.length, pendingActionCount: snapshot.pendingActions.length, resolvedThrough: snapshot.world.resolvedThrough };
  }

  close() {
    if (!this.closed) {
      this.db.close();
      this.closed = true;
    }
  }
}
