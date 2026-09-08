import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadingRecap, createReadingRecap } from '../../worldstream/app/reading-recap.js';
const event = (id, occurredAt, type = 'INTENT_COMPLETE') => ({ id, occurredAt, type, location: 'mi6', description: `Exact public wording ${id}.` });
const world = (events, now = 600, continuityId = 'one') => ({ continuityId, resolvedThrough: now, events });
function storage(saved = {}) {
  const data = new Map(Object.entries(saved)); let writes = 0;
  return { getItem: key => data.get(key) ?? null, setItem(key, value) { writes++; data.set(key, value); }, data, get writes() { return writes; } };
}
const legacy = () => storage({ 'silver-clouds-last-view:one': JSON.stringify({ at: 100 }) });

test('offscreen attempts remain one unfinished story in the recap instead of being marked concluded',()=>{
  const events=[event('anchor',100,'ACTIVITY_COMPLETE'),event('start',200,'OFFSCREEN_START'),event('result',250,'OFFSCREEN_RESULT')];
  const w={...world(events),stories:[{id:'life:one',title:'Yukon’s game',status:'unfinished',openedAt:200,eventId:'result',description:'The section is still unfinished.'}]};
  const result=buildReadingRecap(w,events,{at:100});
  assert.deepEqual(result.events.map(row=>row.id),['result']);
  assert.equal(result.unresolved.threadId,'life:one');
});

test('recap uses at most three exact meaningful public events and one unresolved public thread', () => {
  const events = [event('anchor', 100, 'ACTIVITY_COMPLETE'), event('routine', 110, 'ACTIVITY_COMPLETE'),
    event('offer', 120, 'INTENT_RESPONSE'), event('finished', 150), event('repair', 170, 'GROUND_WORK_COMPLETED'),
    event('review', 180, 'AGENDA_RESOLVE'), event('private', 190, 'INCIDENT'), event('future', 700, 'INCIDENT')];
  events[6].visibility = 'private'; events[6].description = 'DO_NOT_EXPOSE';
  events[4].payload = { privateDecision: 'SECRET_REASON' }; events[4].changes = [{ knowledge: 'PRIVATE_MEMORY' }];
  const w = { ...world(events), stories: [{ id: 'thread', title: 'A dispatch copy', description: 'The public deadline remains open.', status: 'active' }],
    intentions: [{ id: 'ended', activity: 'game', status: 'completed', description: 'Already over.' }] };
  const before = structuredClone(w), result = buildReadingRecap(w, events, { at: 100 });
  assert.equal(result.events.length, 3); assert.ok(result.events.every(row => events.some(source => source.description === row.description)));
  assert.ok(result.events.some(row => row.id === 'finished')); assert.ok(!result.events.some(row => row.id === 'offer'));
  assert.equal(result.unresolved.threadId, 'thread'); assert.equal(result.gapPossible, false);
  assert.ok(!/DO_NOT_EXPOSE|SECRET_REASON|PRIVATE_MEMORY|payload|changes/.test(JSON.stringify(result)));
  assert.deepEqual(w, before);
});

test('polling never saves an unread watermark; real views remain individual across restart', () => {
  const saved = legacy(), events = [event('anchor', 100), event('older', 200, 'GROUND_WORK_COMPLETED'), event('newest', 300)];
  const first = createReadingRecap({ storage: saved });
  for (let i = 0; i < 5; i++) first.update(world(events, 600 + i));
  assert.equal(saved.writes, 0); assert.equal(first.getState().bookmark.boundary.at, 100);
  assert.equal(first.markViewed(events[2]), true); assert.equal(first.markViewed(events[2]), false);
  assert.equal(saved.writes, 1); assert.equal(first.getState().bookmark.boundary.at, 100);
  first.destroy(); const second = createReadingRecap({ storage: saved });
  const recap = second.update(world(events, 800));
  assert.equal(recap.continueTarget.eventId, 'older'); assert.equal(recap.availableUnreadEvents, 1);
  assert.equal(second.getState().bookmark.lastViewed.id, 'newest'); assert.equal(saved.writes, 1);
});

test('reading older history does not acknowledge newer unseen events; explicit caught-up does', () => {
  const saved = legacy(), reader = createReadingRecap({ storage: saved });
  const events = [event('old', 90), event('newer', 200), event('newest', 300)];
  reader.update(world(events)); reader.markViewed(events[0]);
  assert.equal(reader.getState().recap.availableUnreadEvents, 2); assert.equal(reader.getState().bookmark.boundary.at, 100);
  assert.equal(reader.markCaughtUp(), true); assert.equal(reader.getState().bookmark.boundary.at, 600);
  assert.equal(reader.getState().recap.visible, false);
  reader.update(world([...events, event('later', 650)], 700));
  assert.equal(reader.getState().recap.availableNewEvents, 1); assert.equal(reader.getState().bookmark.boundary.at, 600);
});

test('a gap in the latest page is admitted, and supplied earlier history restores the continuation', () => {
  const saved = legacy(), reader = createReadingRecap({ storage: saved });
  const latest = [event('latest', 500)];
  let recap = reader.update(world(latest));
  assert.equal(recap.gapPossible, true); assert.equal(recap.continueTarget.kind, 'history');
  assert.match(recap.coverageNote, /may be outside/);
  const all = [event('anchor', 90), event('missed', 200, 'GROUND_RESTRICTION'), ...latest];
  recap = reader.update(world(latest), all);
  assert.equal(recap.gapPossible, false); assert.equal(recap.continueTarget.eventId, 'missed');
  assert.equal(saved.writes, 0);
  recap = buildReadingRecap(world(latest), { events: latest, completeSince: 100 }, { at: 100 });
  assert.equal(recap.gapPossible, false);
});

test('merged cache with an old anchor cannot conceal a gap when contiguous coverage is explicitly unknown', () => {
  const rows = [event('cached-before-bookmark', 90), event('new-page', 500)];
  const w = world(rows);
  const unknown = buildReadingRecap(w, { events: rows, completeSince: null }, { at: 100 });
  assert.equal(unknown.historyGap, true); assert.equal(unknown.continueTarget.kind, 'history');
  const partial = buildReadingRecap(w, { events: rows, completeSince: 400 }, { at: 100 });
  assert.equal(partial.historyGap, true);
  const filled = buildReadingRecap(w, { events: rows, completeSince: 90 }, { at: 100 });
  assert.equal(filled.historyGap, false); assert.equal(filled.continueTarget.eventId, 'new-page');
  assert.equal(buildReadingRecap(w, rows, { at: 100 }).historyGap, false, 'legacy array input keeps its prior inference');
});

test('first real reading and same-time events are tracked without equating a timestamp with every event', () => {
  const saved = storage(), reader = createReadingRecap({ storage: saved });
  const a = event('a', 300), b = event('b', 300, 'GROUND_WORK_COMPLETED');
  assert.equal(reader.update(world([a, b])).visible, false); assert.equal(saved.writes, 0);
  reader.markViewed(a); const result = reader.getState();
  assert.equal(result.bookmark.boundary.kind, 'read_start'); assert.equal(result.recap.availableUnreadEvents, 1);
  assert.equal(result.recap.continueTarget.eventId, 'b');
  assert.equal(reader.markViewed(event('forged', 400)), false);
  assert.equal(reader.markViewed({ ...b, occurredAt: 900 }), false);
});

test('bookmarks isolate continuities, tolerate unavailable storage, and reject stale foreign acknowledgements', () => {
  const saved = legacy(), reader = createReadingRecap({ storage: saved });
  const one = world([event('a', 300)]); reader.update(one); reader.markViewed(one.events[0]);
  const two = world([event('b', 350)], 800, 'two'); reader.update(two);
  assert.equal(reader.getState().bookmark.boundary, null); assert.equal(reader.markCaughtUp(one), false);
  reader.markViewed(two.events[0]); assert.ok(saved.data.has('silver-clouds-last-view:two'));
  reader.update(one); assert.equal(reader.getState().bookmark.lastViewed.id, 'a');
  const broken = createReadingRecap({ storage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
  assert.doesNotThrow(() => { broken.update(one); broken.markViewed(one.events[0]); broken.markCaughtUp(); });
  reader.destroy(); assert.equal(reader.markViewed(one.events[0]), false);
});

test('public thread descriptors link unfinished work without resurrecting resolved stories', () => {
  const events = [event('anchor', 90), event('recent', 200)];
  const w = { ...world(events), storyThreads: [
    { type: 'story', id: 'closed', title: 'Delivery', status: 'resolved', openedAt: 100 },
    { type: 'operation', id: 'review', title: 'Dispatch cross-check', status: 'failed', openedAt: 150, eventId: 'review-end' },
  ], operations: [{ title: 'Dispatch cross-check', status: 'failed', outcome: 'unverified', startedAt: 150, eventId: 'review-end' }] };
  const result = buildReadingRecap(w, events, { at: 100 });
  assert.equal(result.unresolved.threadId, 'review'); assert.equal(result.unresolved.type, 'operation');
  w.operations[0].outcome = 'cleared'; w.operations[0].status = 'resolved';
  assert.equal(buildReadingRecap(w, events, { at: 100 }).unresolved, null);
});

test('rendered navigation copies exact public text and only the explicit mark button acknowledges the world', () => {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; this.handlers = {}; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    addEventListener(type, handler) { this.handlers[type] = handler; }
  }
  const container = new Element('section'); container.ownerDocument = { createElement: tag => new Element(tag) };
  const saved = legacy(), moves = [], marks = [];
  const reader = createReadingRecap({ container, storage: saved, onContinue: move => moves.push(move), onMark: mark => marks.push(mark) });
  const events = [event('anchor', 90), { ...event('new', 200), description: '<script>still exact text</script>' }];
  reader.update(world(events));
  const descend = item => [item, ...item.children.flatMap(descend)];
  const nodes = descend(container);
  assert.ok(nodes.some(item => item.textContent === 'While you were away…'));
  assert.ok(nodes.some(item => item.textContent === events[1].description));
  nodes.find(item => item.textContent === 'Continue from here').handlers.click();
  assert.equal(moves[0].eventId, 'new'); assert.equal(saved.writes, 0);
  nodes.find(item => item.textContent === 'Mark caught up').handlers.click();
  assert.equal(saved.writes, 1); assert.equal(marks[0].kind, 'caught_up'); assert.equal(container.hidden, true);
});
