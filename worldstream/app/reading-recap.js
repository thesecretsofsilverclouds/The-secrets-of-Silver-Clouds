// Personal reading state only. A poll is not proof that an event was read.
const PREFIX = 'silver-clouds-last-view:';
const MAX_VIEWED = 512;
const ENDINGS = new Set(['INK_APPOINTMENT_COMPLETED', 'INK_APPOINTMENT_INTERRUPTED', 'THREAD_DELIVERY_DECIDE',
  'THREAD_DELIVERY_DEADLINE', 'INTENT_COMPLETE', 'INTENT_INTERRUPTED', 'AGENDA_RESOLVE', 'AGENDA_DEADLINE',
  'GROUND_WORK_COMPLETED', 'GROUND_WORK_INTERRUPTED', 'PLAN_BROKEN', 'OUTING_CUT_SHORT',
  'SUPPORTING_OUTCOME', 'SUPPORTING_CALLBACK', 'NIGHT_WORK_END', 'NIGHT_RETURN', 'NIGHT_RECOVERED', 'NIGHT_DEBRIEF',
  'OFFSCREEN_RESULT', 'OFFSCREEN_ENCOUNTER']);
const CHANGES = new Set(['INCIDENT', 'ARCANE_SURGE', 'AFTERMATH', 'INVITATION_ACCEPTED', 'WEATHER_DISRUPTION',
  'INK_APPOINTMENT_BOOKED', 'THREAD_DELIVERY_OPEN', 'INTENT_RESPONSE', 'INTENT_RENEGOTIATE',
  'AGENDA_OPERATION_START', 'GROUND_RESTRICTION', 'SUPPORTING_COMMITMENT', 'NIGHT_CALL', 'NIGHT_WORK_BEGIN', 'OFFSCREEN_START']);
const ACTIVE_INTENTS = new Set(['offered', 'renegotiating', 'reserved', 'started']);
const time = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const text = value => typeof value === 'string' ? value : '';
const scopeOf = world => text(world?.continuityId) || text(world?.worldId) || 'silver-clouds';
const order = (a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id);
const emptyBookmark = () => ({ version: 2, boundary: null, viewed: [], lastViewed: null });

function cursor(value) {
  return value && text(value.id) && time(value.at) !== null ? { id: value.id, at: value.at } : null;
}
function readBookmark(value) {
  if (!value || typeof value !== 'object') return emptyBookmark();
  if (value.version !== 2) return time(value.at) === null ? emptyBookmark()
    : { ...emptyBookmark(), boundary: { at: value.at, eventId: null, kind: 'legacy_visit' } };
  const boundary = time(value.boundary?.at) !== null
    && ['read_start', 'acknowledged', 'legacy_visit'].includes(value.boundary?.kind)
    ? { at: value.boundary.at, eventId: text(value.boundary.eventId) || null, kind: value.boundary.kind } : null;
  const viewed = (Array.isArray(value.viewed) ? value.viewed : []).map(cursor).filter(Boolean).slice(-MAX_VIEWED);
  return { version: 2, boundary, viewed, lastViewed: cursor(value.lastViewed) };
}

function publicRows(input, now) {
  const rows = Array.isArray(input) ? input : input?.events;
  const unique = new Map();
  for (const event of Array.isArray(rows) ? rows : []) {
    // Accept public API entries, never fall back to raw internal publicDescription.
    if (!text(event?.id) || !text(event.description).trim() || event.visibility === 'private'
      || time(event.occurredAt) === null || now !== null && event.occurredAt > now) continue;
    if (!unique.has(event.id)) unique.set(event.id, { id: event.id, occurredAt: event.occurredAt,
      type: text(event.type), description: event.description, location: text(event.location), room: text(event.room),
      register: event.register === 'prose' ? 'prose' : 'ticker' });
  }
  return [...unique.values()].sort(order);
}
function afterBoundary(event, boundary) {
  return boundary && (event.occurredAt > boundary.at || event.occurredAt === boundary.at
    && boundary.kind === 'read_start' && event.id !== boundary.eventId);
}
function significance(event) {
  if (ENDINGS.has(event.type)) return 3;
  if (CHANGES.has(event.type)) return 2;
  if (['CONVERSATION', 'VENUE_SCENE', 'LEGION_VISIT'].includes(event.type)) return 1;
  return 0; // No guessing significance from dramatic-sounding words.
}
function family(event) {
  return /^(INK|THREAD_DELIVERY|INTENT|AGENDA|GROUND|SUPPORTING|NIGHT|OFFSCREEN)_/.exec(event.type)?.[1] ?? event.type;
}

function unresolvedThread(world, now) {
  const rows = [];
  const add = (section, item, title, at) => {
    if (!text(title) || section === 'operations' && time(item.startedAt) !== null && now !== null && item.startedAt > now) return;
    const id = text(item.id) || null;
    if (id && rows.some(row => row.threadId === id)) return;
    rows.push({ section, type: { stories: 'story', intentions: 'intention', operations: 'operation' }[section],
      threadId: id, eventId: text(item.eventId) || null,
      title, description: text(item.description), status: text(item.status),
      at: time(at), deadlineAt: time(item.deadlineAt ?? item.endAt), location: text(item.location) });
  };
  for (const item of Array.isArray(world?.storyThreads) ? world.storyThreads : []) {
    const section = { story: 'stories', intention: 'intentions', operation: 'operations' }[item.type];
    if (!section || time(item.openedAt) === null || now !== null && item.openedAt > now) continue;
    if (['active','unfinished'].includes(item.status) || item.type === 'intention' && ACTIVE_INTENTS.has(item.status))
      add(section, item, text(item.title), item.openedAt);
  }
  for (const item of Array.isArray(world?.stories) ? world.stories : [])
    if (['active','unfinished'].includes(item.status)) add('stories', item, text(item.title), item.openedAt ?? item.startedAt);
  for (const item of Array.isArray(world?.intentions) ? world.intentions : [])
    if (ACTIVE_INTENTS.has(item.status)) add('intentions', item,
      { game: 'A short game together', practice: 'Shared practice', quiet: 'A quiet break together' }[item.activity] || 'Time together', item.startAt);
  for (const item of Array.isArray(world?.operations) ? world.operations : [])
    if (item.status === 'active' || ['followup_required', 'unverified'].includes(item.outcome)) {
      const descriptor = (Array.isArray(world?.storyThreads) ? world.storyThreads : []).find(row => row.type === 'operation'
        && row.title === item.title && row.openedAt === item.startedAt);
      add('operations', { ...item, id: descriptor?.id ?? item.id }, text(item.title), item.startedAt);
    }
  return rows.sort((a, b) => (a.status === 'failed') - (b.status === 'failed')
    || (a.deadlineAt ?? Infinity) - (b.deadlineAt ?? Infinity) || a.title.localeCompare(b.title))[0] ?? null;
}

/** Pure recap of supplied PUBLIC entries. events may be an array or
 * {events, completeSince?}; completeSince is optional caller-confirmed coverage.
 * Without coverage spanning the bookmark we honestly say history may be missing.
 * Recap prose is copied verbatim from description; no memories/payloads are read.
 */
export function buildReadingRecap(world = {}, events = world.events, stored = null) {
  const bookmark = readBookmark(stored), now = time(world.resolvedThrough);
  const boundary = bookmark.boundary && (now === null || bookmark.boundary.at <= now) ? bookmark.boundary : null;
  const rows = publicRows(events, now), viewed = new Set(bookmark.viewed.map(item => item.id));
  const newer = rows.filter(event => afterBoundary(event, boundary));
  const meaningful = newer.filter(event => significance(event));
  const bestByFamily = new Map();
  for (const event of meaningful) {
    const previous = bestByFamily.get(family(event));
    if (!previous || significance(event) >= significance(previous)) bestByFamily.set(family(event), event);
  }
  const selected = [...bestByFamily.values()].sort((a, b) => significance(b) - significance(a) || order(b, a))
    .slice(0, 3).sort(order).map(event => ({ ...event, viewed: viewed.has(event.id) }));
  const completeSince = !Array.isArray(events) ? time(events?.completeSince) : null;
  // A merged cache can contain old and new pages with an unread gap between.
  // Explicit object input carries the host's contiguous-coverage proof; an old
  // cached row alone cannot fill that gap. Array callers retain legacy inference.
  const coversBoundary = boundary && (Array.isArray(events)
    ? rows.some(event => event.occurredAt <= boundary.at)
    : completeSince !== null && completeSince <= boundary.at);
  const gapPossible = Boolean(boundary && now !== null && now > boundary.at && !coversBoundary);
  const unread = newer.filter(event => !viewed.has(event.id));
  const next = unread.find(event => significance(event)) ?? unread[0];
  const continueTarget = gapPossible ? { kind: 'history', beforeAt: rows[0]?.occurredAt ?? now }
    : next ? { kind: 'event', eventId: next.id, occurredAt: next.occurredAt } : null;
  return { scope: scopeOf(world), boundaryAt: boundary?.at ?? null, boundaryKind: boundary?.kind ?? null,
    visible: Boolean(boundary && (newer.length || gapPossible)), events: selected,
    unresolved: unresolvedThread(world, now), availableNewEvents: newer.length, availableUnreadEvents: unread.length,
    meaningfulEvents: meaningful.length, gapPossible, historyGap: gapPossible, continueTarget,
    coverageNote: gapPossible ? 'Earlier activity may be outside the loaded history. Read earlier activity to continue from your bookmark.' : null,
    lastViewed: bookmark.lastViewed ? { ...bookmark.lastViewed } : null };
}

/** Local controller. update/poll NEVER writes a bookmark. markViewed must only
 * be called by the host after sustained actual row exposure (e.g. >=1.5s visible
 * while the tab is foreground), not merely because a row entered the DOM.
 * It records individual IDs and never acknowledges all earlier rows. The return
 * boundary moves only on the first real view or explicit markCaughtUp().
 * Callbacks: onContinue({kind:'event',eventId,occurredAt} | {kind:'history',beforeAt}
 * | {kind:'thread',threadId,eventId,section,type}); onMark({kind,scope,...}).
 */
export function createReadingRecap({ container = null, storage, onContinue = () => {}, onMark = () => {} } = {}) {
  if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
  let world = null, input = [], scope = null, bookmark = emptyBookmark(), model = null, destroyed = false, rendered = '';
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const persist = () => { try { storage?.setItem(`${PREFIX}${scope}`, JSON.stringify(bookmark)); } catch {} };
  const node = (tag, content, className) => {
    const item = container.ownerDocument.createElement(tag);
    if (content != null) item.textContent = content;
    if (className) item.className = className;
    return item;
  };
  const date = at => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London',
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at);
  function button(label, callback, className) {
    const item = node('button', label, className); item.type = 'button'; item.addEventListener('click', callback); return item;
  }
  function render() {
    if (!container || !model) return;
    const fingerprint = JSON.stringify(model);
    if (fingerprint === rendered) return;
    rendered = fingerprint; container.hidden = !model.visible;
    if (!model.visible) { container.replaceChildren(); return; }
    const children = [node('h3', 'While you were away…', 'recap-title'),
      node('p', `${model.boundaryKind === 'legacy_visit' ? 'Last recorded visit' : 'Reading from'} ${date(model.boundaryAt)}`, 'recap-note')];
    const list = node('ol', null, 'recap-events');
    for (const event of model.events) {
      const item = node('li', null, 'recap-event');
      const when = node('time', date(event.occurredAt)); when.dateTime = new Date(event.occurredAt).toISOString();
      item.append(when, node('p', event.description), button(event.viewed ? 'Read again' : 'Read this moment',
        () => onContinue({ kind: 'event', eventId: event.id, occurredAt: event.occurredAt }), 'recap-link'));
      list.append(item);
    }
    children.push(list);
    if (!model.events.length) children.push(node('p', 'No major changes in the activity loaded here.', 'recap-note'));
    if (model.unresolved) {
      const thread = model.unresolved, block = node('div', null, 'recap-thread');
      block.append(node('p', 'Still unfolding', 'recap-label'), node('h4', thread.title));
      if (thread.description) block.append(node('p', thread.description));
      block.append(button('Follow this thread', () => onContinue({ kind: 'thread', section: thread.section,
        type: thread.type, threadId: thread.threadId, eventId: thread.eventId }), 'recap-link')); children.push(block);
    }
    if (model.coverageNote) children.push(node('p', model.coverageNote, 'recap-note'));
    const actions = node('div', null, 'recap-actions');
    if (model.continueTarget) actions.append(button(model.gapPossible ? 'Load earlier activity' : 'Continue from here',
      () => onContinue(clone(model.continueTarget)), 'recap-continue'));
    actions.append(button('Mark caught up', () => markCaughtUp(), 'recap-mark'));
    children.push(actions); container.replaceChildren(...children);
  }
  function refresh() { if (world) { model = buildReadingRecap(world, input, bookmark); render(); } return clone(model); }
  function update(value, events = value?.events) {
    if (destroyed || !value) return null;
    const nextScope = scopeOf(value);
    if (nextScope !== scope) {
      scope = nextScope; bookmark = emptyBookmark(); rendered = '';
      try { bookmark = readBookmark(JSON.parse(storage?.getItem(`${PREFIX}${scope}`) ?? 'null')); } catch {}
      if (time(value.resolvedThrough) !== null && bookmark.boundary?.at > value.resolvedThrough) bookmark = emptyBookmark();
    }
    world = value; input = events ?? []; return refresh();
  }
  function markViewed(event) {
    if (destroyed || !world) return false;
    const row = publicRows(input, time(world.resolvedThrough)).find(item => item.id === event?.id && item.occurredAt === event.occurredAt);
    if (!row || bookmark.viewed.some(item => item.id === row.id)) return false;
    if (!bookmark.boundary) bookmark.boundary = { at: row.occurredAt, eventId: row.id, kind: 'read_start' };
    const point = { id: row.id, at: row.occurredAt };
    bookmark.viewed = [...bookmark.viewed, point].slice(-MAX_VIEWED); bookmark.lastViewed = point;
    persist(); refresh(); onMark({ kind: 'viewed', scope, eventId: row.id, at: row.occurredAt }); return true;
  }
  function markCaughtUp(value = world) {
    if (destroyed || !world || !value || scopeOf(value) !== scope || time(value.resolvedThrough) === null
      || value.resolvedThrough > world.resolvedThrough) return false;
    bookmark = { ...emptyBookmark(), boundary: { at: value.resolvedThrough, eventId: null, kind: 'acknowledged' } };
    persist(); refresh(); onMark({ kind: 'caught_up', scope, at: value.resolvedThrough }); return true;
  }
  return { update, markViewed, markCaughtUp,
    getState: () => ({ scope, bookmark: clone(bookmark), recap: clone(model), model: clone(model),
      historyGap: Boolean(model?.historyGap), boundaryAt: model?.boundaryAt ?? null }),
    destroy() { destroyed = true; world = null; input = []; if (container) { container.replaceChildren(); container.hidden = true; } },
  };
}
