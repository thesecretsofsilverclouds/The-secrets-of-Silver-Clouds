import { publicEvents } from './fixture.mjs';
import { collectPublicContext, publicStoryRef } from './public-story-context.mjs';
import { createHash } from 'node:crypto';
import { londonDate, atLondon } from './time.mjs';

// Invoked lazily only for the exact legacy waking-time exchange. The SQL range
// is one civil day and its two proof types; no full-ledger/cache search occurs.
export function readPublicDialogueSources(world, event) {
  if (!Number.isSafeInteger(event?.occurredAt)) return [];
  const start = atLondon(londonDate(event.occurredAt), '00:00');
  return world.db.prepare(`SELECT semantic_json FROM events WHERE occurred_at >= ? AND occurred_at < ?
    AND json_extract(semantic_json, '$.visibility') = 'public'
    AND json_extract(semantic_json, '$.type') IN ('NIGHT_WORK_END', 'NIGHT_RECOVERED')
    ORDER BY occurred_at, seq LIMIT 32`).all(start, event.occurredAt)
    .map(row => JSON.parse(row.semantic_json));
}

function readingIdentity(world) {
  const row = world.db.prepare(`SELECT seed, resolved_through,
    json_extract(state_json, '$.meta.startMs') AS start_ms FROM world_state WHERE id = 1`).get();
  const worldId = world.fixture?.worldId ?? 'silver-clouds-now';
  return { resolvedThrough: Number(row?.resolved_through ?? 0),
    continuityId: createHash('sha256').update(`${worldId}|${row?.seed}|${row?.start_ms}`).digest('hex').slice(0, 24) };
}

export function historyOptions(params) {
  const number = (key, fallback) => params.has(key) ? Number(params.get(key)) : fallback;
  return { beforeSeq: number('before', Number.MAX_SAFE_INTEGER), limit: number('limit', 40),
    afterMs: number('after', null), throughMs: number('through', null) };
}

/** A fixed time window over the persisted ledger, never over the recent cache.
 * Pages are bounded; `complete` only certifies the requested range once its
 * cursor is exhausted. `through` stays fixed across a reader's subsequent pages.
 */
export function readPublicHistory(world, { beforeSeq = Number.MAX_SAFE_INTEGER, limit = 40,
  afterMs = null, throughMs = null } = {}) {
  if (!Number.isSafeInteger(beforeSeq) || beforeSeq < 1) throw new RangeError('Invalid history cursor');
  const { resolvedThrough, continuityId } = readingIdentity(world);
  if (afterMs !== null && (!Number.isSafeInteger(afterMs) || afterMs < 0)) throw new RangeError('Invalid history start');
  if (throughMs !== null && (!Number.isSafeInteger(throughMs) || throughMs < 0)) throw new RangeError('Invalid history end');
  if (afterMs !== null && throughMs !== null && afterMs > throughMs) throw new RangeError('Invalid history range');
  const through = Math.min(throughMs ?? resolvedThrough, resolvedThrough);
  limit = Math.min(100, Math.max(1, Math.trunc(limit) || 40));
  const rows = world.db.prepare(`SELECT semantic_json FROM events WHERE seq < ?
    AND occurred_at >= ? AND occurred_at <= ?
    AND json_extract(semantic_json, '$.visibility') = 'public'
    AND length(json_extract(semantic_json, '$.publicDescription')) > 0
    ORDER BY seq DESC LIMIT ?`).all(beforeSeq, afterMs ?? 0, through, limit + 1)
    .map(row => JSON.parse(row.semantic_json));
  const more = rows.length > limit, page = rows.slice(0, limit).reverse();
  return { events: publicEvents({ events: page, eventById: id => world.eventById(id),
    publicSourcesForEvent: event => readPublicDialogueSources(world, event) }, Infinity),
    nextCursor: more ? page[0].seq : null, complete: !more,
    coverage: { after: afterMs, through }, resolvedThrough, continuityId };
}

export function readPublicEventContext(world, id) {
  if (typeof id !== 'string' || id.length > 200) return null;
  const source = world.eventById(id);
  const { resolvedThrough, continuityId } = readingIdentity(world);
  if (!source || source.occurredAt > resolvedThrough) return null;
  const context = collectPublicContext(source, sourceId => world.eventById(sourceId));
  if (!context) return null;
  // Arc stages share an explicit instance ID but older reducers did not attach
  // their preceding stage as a causal edge. Retrieve those owned public stages
  // directly, including an opening long gone from the current state snapshot.
  const ref = publicStoryRef(source);
  if (ref?.type === 'arc') {
    const owned = world.db.prepare(`SELECT semantic_json FROM events
      WHERE occurred_at <= ? AND json_extract(semantic_json, '$.visibility') = 'public'
      AND json_extract(semantic_json, '$.payload.arcInstanceId') = ?
      ORDER BY occurred_at, seq LIMIT 33`).all(source.occurredAt, ref.id)
      .map(row => JSON.parse(row.semantic_json)).filter(row => row.seq <= source.seq);
    const combined = new Map([...owned, ...context.rows].map(row => [row.id, row]));
    context.complete = context.complete && combined.size <= 32;
    const rows = [...combined.values()].sort((a, b) => a.occurredAt - b.occurredAt || a.seq - b.seq);
    // Keep the origin and target if an unusually long instance exceeds the cap.
    context.rows = rows.length <= 32 ? rows : [rows[0], ...rows.slice(-31)];
  }
  const events = publicEvents({ events: context.rows, eventById: sourceId => world.eventById(sourceId),
    publicSourcesForEvent: event => readPublicDialogueSources(world, event) }, Infinity);
  return { event: events.find(event => event.id === id), events, complete: context.complete, resolvedThrough, continuityId };
}
