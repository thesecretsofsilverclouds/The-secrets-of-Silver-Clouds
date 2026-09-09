// Public continuity comes from committed ownership and explicit causal edges.
// Neither a shared cast nor proximity in time makes two events the same story.
import { editorialEvent } from './editorial.mjs';
import { londonDate, londonClock } from './time.mjs';

const text = value => typeof value === 'string' && value.length > 0;
export const isPublicStoryEvent = event => event?.visibility === 'public'
  && text(event.id) && text(event.publicDescription) && Number.isSafeInteger(event.occurredAt);

export function publicStoryRef(event) {
  if (!isPublicStoryEvent(event)) return null;
  const payload = event.payload ?? {};
  for (const [field, type] of [['arcInstanceId', 'arc'], ['supportingStoryId', 'story'],
    ['offscreenStoryId', 'story'], ['sceneEpisodeId', 'story'], ['threadId', 'story'], ['intentId', 'intention'], ['operationId', 'operation']]) {
    if (text(payload[field])) return { type, id: payload[field] };
  }
  // Older night/operation records did not put the instance ID in their public
  // payload. Their ledger names the exact instance changed by this turn. Copy
  // just that opaque identity, never the state/knowledge inside the change.
  // Night episodes moved from the shared-world ledger to their own story bag;
  // both persisted owner shapes still identify the same explicit episode path.
  const owner = event.type?.startsWith('NIGHT_') ? ['nightStories', 'episodes', 'story']
    : event.type?.startsWith('AGENDA_') ? ['agendas', 'operations', 'operation'] : null;
  if (!owner) return null;
  const ids = new Set((event.changes ?? []).filter(change => (change.entity === 'world'
      || (owner[0] === 'nightStories' && change.entity === 'story' && change.id === 'nightStories'))
    && change.field === owner[0] && change.path?.[0] === owner[1]
    && text(change.path?.[1]) && Object.hasOwn(change, 'after')).map(change => change.path[1]));
  return ids.size === 1 ? { type: owner[2], id: [...ids][0] } : null;
}

const DEPENDENT = /^(?:ARC_(?:BEAT|CONFRONTATION|CLOSED)|SUPPORTING_(?:ENCOUNTER|OUTCOME|CALLBACK)|OFFSCREEN_(?:RESULT|UNFINISHED|RESUMED|ENCOUNTER|CALLBACK)|NIGHT_(?:CALL|CONTACT_ASHAI|ASHAI_CHOICE|WORK_BEGIN|WORK_END|RETURN|RECOVERED|DEBRIEF)|INTENT_(?:RESPONSE|RENEGOTIATE|BEGIN|COMPLETE|INTERRUPTED)|THREAD_|AGENDA_|GROUND_WORK_|MEMORY_CALLBACK)/;

export function explicitPublicCauses(event, lookup) {
  if (!isPublicStoryEvent(event) || typeof lookup !== 'function') return [];
  const ids = [...new Set([...(event.causedBy ?? []), event.payload?.continuationSourceEventId,
    event.memoryCallback?.originEventId].filter(text))].slice(0, 16);
  return ids.flatMap(id => {
    const source = lookup(id);
    return isPublicStoryEvent(source) && source.id === id && source.id !== event.id
      && (source.occurredAt < event.occurredAt || (source.occurredAt === event.occurredAt
        && Number.isSafeInteger(source.seq) && source.seq < event.seq)) ? [source] : [];
  });
}

export function sourceBridge(source, event) {
  const { hour, minute } = londonClock(source.occurredAt);
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const day = londonDate(source.occurredAt);
  return { originEventId: source.id, originOccurredAt: source.occurredAt, originType: source.type,
    time, timeLabel: `Earlier · ${day === londonDate(event.occurredAt) ? '' : `${day} · `}${time}`,
    snippet: editorialEvent(source).publicDescription };
}

export function publicContinuity(event, lookup, existingBridge = null) {
  let storyRef = publicStoryRef(event);
  const continuationStart = event.type === 'OFFSCREEN_START' && text(event.payload?.continuationSourceEventId);
  const rememberedChoice = event.type === 'SUPPORTING_COMMITMENT'
    && event.payload?.relationshipChoice?.evidence?.length > 0;
  const causes = DEPENDENT.test(event.type) || continuationStart || rememberedChoice || event.type === 'SCENE_BANK_BEAT'
    ? explicitPublicCauses(event, lookup) : [];
  if (!storyRef && causes.length) {
    // Reading a retained operation report may only change the reader's memory,
    // not the operation ledger. Its explicit public report still names the
    // owned instance. Never infer this from an unrelated preceding system.
    const prefix = `${event.type.split('_')[0]}_`;
    const refs = new Map(causes.filter(source => source.type.startsWith(prefix)).map(publicStoryRef)
      .filter(Boolean).map(ref => [`${ref.type}:${ref.id}`, ref]));
    if (refs.size === 1) storyRef = [...refs.values()][0];
  }
  const sameStory = causes.filter(source => {
    const ref = publicStoryRef(source);
    return ref && storyRef && ref.id === storyRef.id && ref.type === storyRef.type;
  });
  const continuationOrigin = continuationStart ? causes.find(source => source.id === event.payload.continuationSourceEventId) : null;
  const candidates = continuationOrigin ? [continuationOrigin] : sameStory.length ? sameStory : causes;
  // Prefer the actual latest owned turn. All alternatives remain available in
  // the context endpoint; a recent unrelated routine is never called a cause.
  const parent = candidates.sort((a, b) => b.occurredAt - a.occurredAt || (b.seq ?? 0) - (a.seq ?? 0))[0];
  const bridge = parent ? sourceBridge(parent, event) : existingBridge;
  return { ...(storyRef ? { storyRef } : {}), ...(bridge ? { contextBridge: bridge } : {}),
    ...(causes.length ? { earlierEventIds: causes.map(source => source.id) } : {}),
    ...(event.payload?.routineContinuation === true ? { routineContinuation: true } : {}) };
}

/** Collect an exact bounded trail, including public causes before a week/page.
 * Private, missing and future causes are neither traversed nor disclosed.
 */
export function collectPublicContext(event, lookup, { limit = 32 } = {}) {
  if (!isPublicStoryEvent(event)) return null;
  const rows = new Map([[event.id, event]]), queue = [event];
  let complete = true;
  for (let index = 0; index < queue.length; index++) {
    for (const source of explicitPublicCauses(queue[index], lookup)) {
      if (rows.has(source.id)) continue;
      if (rows.size >= limit) { complete = false; continue; }
      rows.set(source.id, source); queue.push(source);
    }
  }
  return { rows: [...rows.values()].sort((a, b) => a.occurredAt - b.occurredAt
    || (a.seq ?? 0) - (b.seq ?? 0) || a.id.localeCompare(b.id)), complete };
}
