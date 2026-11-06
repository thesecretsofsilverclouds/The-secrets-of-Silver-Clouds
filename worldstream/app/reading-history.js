// A reading window is pinned to the world the reader opened. Fetching it cannot
// advance a bookmark or acknowledge any passages.
export async function loadReadingWindow({ fetcher = globalThis.fetch, after, through,
  before = null, maxPages = 20, signal, continuityId, onPage = () => {} } = {}) {
  if (!Number.isSafeInteger(after) || !Number.isSafeInteger(through) || after < 0 || through < after)
    throw new TypeError('Invalid reading window');
  const rows = new Map(), cursors = new Set();
  let cursor = before, complete = false, completeSince = null;
  for (let page = 0; page < maxPages; page++) {
    const query = new URLSearchParams({ after: String(after), through: String(through), limit: '100' });
    if (cursor !== null) query.set('before', String(cursor));
    const response = await fetcher(`/api/history?${query}`, { cache: 'no-store', signal });
    if (!response.ok) throw new Error('Earlier passages are unavailable');
    const result = await response.json();
    if (continuityId && result.continuityId !== continuityId) throw new Error('Reading history continuity changed');
    if (!Array.isArray(result.events) || result.events.length > 100
      || result.coverage?.after !== after || result.coverage?.through !== through
      || !(result.nextCursor === null || Number.isSafeInteger(result.nextCursor) && result.nextCursor > 0))
      throw new Error('Invalid reading history');
    const events = result.events;
    if (events.some(event => typeof event.id !== 'string' || !event.id || typeof event.description !== 'string'
      || event.visibility === 'private' || !Number.isSafeInteger(event.occurredAt)
      || event.occurredAt < after || event.occurredAt > through)) throw new Error('Invalid public passage');
    const next = result.nextCursor;
    if (next !== null && (next === cursor || cursors.has(next))) throw new Error('History cursor did not advance');
    for (const event of events) rows.set(event.id, event);
    if (events.length) completeSince = Math.min(completeSince ?? Infinity, ...events.map(event => event.occurredAt));
    complete = result.complete === true && next === null;
    if (complete) completeSince = after;
    onPage({ events, complete, completeSince, through, nextCursor: next });
    cursor = next;
    if (next === null) break;
    cursors.add(next);
  }
  return { events: [...rows.values()].sort((a, b) => a.occurredAt - b.occurredAt
    || (Number.isSafeInteger(a.narrativeOrder) && Number.isSafeInteger(b.narrativeOrder)
      ? a.narrativeOrder - b.narrativeOrder : a.id.localeCompare(b.id))),
    complete, completeSince, through, nextCursor: cursor };
}
