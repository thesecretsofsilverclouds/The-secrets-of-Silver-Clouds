import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadingFeedBuffer, reconcileReadingRows, captureReadingPosition, createReadingView } from '../../worldstream/app/reading-view.js';

const event = (id, occurredAt, description = `Passage ${id}.`) => ({ id, occurredAt, description, prose: `Written ${id}.` });

test('same-world polling preserves original passages and holds new scenes/revisions until reveal', () => {
  const buffer = new ReadingFeedBuffer(), first = event('a', 100), second = event('b', 200);
  const shown = buffer.update('one', [first, second]);
  assert.deepEqual(shown.events.map(row => row.id), ['b', 'a']);
  const same = buffer.update('one', [{ ...first }, { ...second }]);
  assert.strictEqual(same.events, shown.events); assert.strictEqual(same.events[0], second); assert.equal(same.pending, false);
  const revised = { ...first, prose: 'An accepted fuller presentation.' }, fresh = event('c', 300);
  const queued = buffer.update('one', [revised, { ...second }, fresh]);
  assert.equal(queued.added, 1); assert.equal(queued.revised, true);
  assert.strictEqual(queued.events[1], first); assert.equal(queued.events.length, 2);
  const revealed = buffer.reveal();
  assert.deepEqual(revealed.events.map(row => row.id), ['c', 'b', 'a']);
  assert.strictEqual(revealed.events[2], revised); assert.equal(revealed.pending, false);
});

test('queued moments survive later latest-page polling until the reader reveals them', () => {
  const buffer = new ReadingFeedBuffer(), initial = event('initial', 100), middle = event('middle', 200), newest = event('newest', 300);
  buffer.update('one', [initial]); buffer.update('one', [middle, initial]);
  buffer.update('one', [newest]); // The server's bounded page no longer contains middle.
  const revealed = buffer.reveal();
  assert.deepEqual(revealed.events.map(row => row.id), ['newest', 'middle', 'initial']);
});

test('a separate continuity resets its buffered and displayed history', () => {
  const buffer = new ReadingFeedBuffer(); buffer.update('one', [event('old', 100)]);
  buffer.update('one', [event('unread-old', 200)]);
  const replacement = event('new-world', 10), state = buffer.update('two', [replacement]);
  assert.deepEqual(state.events, [replacement]); assert.equal(state.pending, false);
  assert.deepEqual(buffer.reveal().events, [replacement]);
});

test('reveal merges exact IDs, uses newest incoming revision and remains bounded in time order', () => {
  const buffer = new ReadingFeedBuffer();
  buffer.update('one', Array.from({ length: 190 }, (_, i) => event(`e${i}`, i)));
  const revision = event('e188', 188, 'Updated public wording.');
  buffer.update('one', [revision, ...Array.from({ length: 30 }, (_, i) => event(`n${i}`, 200 + i)), { ...revision }]);
  const shown = buffer.reveal();
  assert.equal(shown.events.length, 200); assert.equal(new Set(shown.events.map(row => row.id)).size, 200);
  assert.equal(shown.events[0].id, 'n29'); assert.equal(shown.events.at(-1).occurredAt, 20);
  assert.equal(shown.events.find(row => row.id === 'e188').description, revision.description);
  assert.ok(shown.events.every((row, index) => !index || row.occurredAt <= shown.events[index - 1].occurredAt));
  assert.equal(shown.pending, false);
});

function dom() {
  const doc = { activeElement: null, selection: null, counters: { inserted: 0, removed: 0, replaced: 0 }, rows: [],
    getSelection() { return this.selection; }, querySelectorAll() { return this.rows; } };
  const win = { scrollY: 400, innerHeight: 800, moves: [],
    scrollBy(value) { this.moves.push(value); this.scrollY += value.top; } };
  class Element {
    constructor(id = null) { this.dataset = id ? { eventId: id } : {}; this.children = []; this.parentElement = null; this.documentTop = 500; }
    get firstElementChild() { return this.children[0] ?? null; }
    get nextElementSibling() { const list = this.parentElement?.children ?? []; return list[list.indexOf(this) + 1] ?? null; }
    get isConnected() { return this === container || Boolean(this.parentElement?.isConnected); }
    getBoundingClientRect() { return { top: this.documentTop - win.scrollY, bottom: this.documentTop - win.scrollY + 180 }; }
    closest() { return this.dataset.readingAnchor ? this : this.parentElement?.closest() ?? null; }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    insertBefore(child, next) {
      doc.counters.inserted++;
      if (child.parentElement) child.remove();
      const index = next == null ? this.children.length : this.children.indexOf(next);
      assert.ok(index >= 0, 'insertBefore reference must remain attached');
      this.children.splice(index, 0, child); child.parentElement = this;
    }
    remove() {
      if (!this.parentElement) return;
      doc.counters.removed++;
      if (this.contains(doc.activeElement)) doc.activeElement = null;
      const index = this.parentElement.children.indexOf(this);
      this.parentElement.children.splice(index, 1); this.parentElement = null;
    }
    replaceWith(other) {
      doc.counters.replaced++;
      const parent = this.parentElement, next = this.nextElementSibling;
      this.remove(); parent.insertBefore(other, next);
    }
  }
  const container = new Element();
  const render = source => {
    const row = new Element(source.id); row.description = source.description;
    const control = new Element(); control.parentElement = row; row.children.push(control); return row;
  };
  return { doc, win, container, render, reset() { doc.counters = { inserted: 0, removed: 0, replaced: 0 }; } };
}

test('unchanged polling never detaches or recreates rows, preserving focused control and selected text node', () => {
  const h = dom(), events = [event('newer', 200), event('older', 100)]; let rendered = 0;
  const render = source => { rendered++; return h.render(source); };
  reconcileReadingRows(h.container, events, render);
  const original = [...h.container.children], selected = { parentElement: original[1].children[0] };
  h.doc.activeElement = original[0].children[0]; h.doc.selection = { isCollapsed: false, anchorNode: selected };
  const focused = h.doc.activeElement; h.reset();
  for (let i = 0; i < 5; i++) reconcileReadingRows(h.container, events.map(row => ({ ...row })), render);
  assert.equal(rendered, 2); assert.deepEqual(h.doc.counters, { inserted: 0, removed: 0, replaced: 0 });
  assert.strictEqual(h.container.children[0], original[0]); assert.strictEqual(h.container.children[1], original[1]);
  assert.strictEqual(h.doc.activeElement, focused); assert.strictEqual(h.doc.selection.anchorNode, selected);
});

test('explicit reveal replaces only revised passage and inserts new rows without recreating unchanged neighbours', () => {
  const h = dom(), a = event('a', 100), b = event('b', 200); reconcileReadingRows(h.container, [b, a], h.render);
  const originalB = h.container.children[0], originalA = h.container.children[1]; h.reset();
  reconcileReadingRows(h.container, [event('c', 300), b, { ...a, description: 'A revised public passage.' }], h.render, { replaceChanged: true });
  assert.deepEqual(h.container.children.map(row => row.dataset.eventId), ['c', 'b', 'a']);
  assert.strictEqual(h.container.children[1], originalB); assert.notStrictEqual(h.container.children[2], originalA);
  assert.equal(h.doc.counters.replaced, 1); assert.equal(originalB.isConnected, true);
});

test('selected reading anchor regains its exact viewport offset after an upstream block grows', () => {
  const h = dom(); reconcileReadingRows(h.container, [event('first', 200), event('selected', 100)], h.render);
  const [first, selected] = h.container.children; first.documentTop = 480; selected.documentTop = 730;
  h.doc.rows = [first, selected];
  h.doc.selection = { isCollapsed: false, anchorNode: { parentElement: selected.children[0] } };
  const before = selected.getBoundingClientRect().top, restore = captureReadingPosition(h.doc, h.win);
  first.documentTop += 150; selected.documentTop += 150; restore();
  assert.equal(selected.getBoundingClientRect().top, before);
  assert.deepEqual(h.win.moves, [{ top: 150, behavior: 'instant' }]);
  const detachedRestore = captureReadingPosition(h.doc, h.win); selected.remove(); detachedRestore();
  assert.equal(h.win.moves.length, 1, 'removed passages never trigger a scroll jump');
});

test('viewport anchor also holds without selection, while the top of the page is left alone', () => {
  const h = dom(); reconcileReadingRows(h.container, [event('visible', 100)], h.render);
  h.doc.rows = [...h.container.children]; const row = h.doc.rows[0];
  const before = row.getBoundingClientRect().top, restore = captureReadingPosition(h.doc, h.win);
  row.documentTop += 80; restore(); assert.equal(row.getBoundingClientRect().top, before);
  h.win.scrollY = 0; const noJump = captureReadingPosition(h.doc, h.win); row.documentTop += 200; noJump();
  assert.equal(h.win.scrollY, 0);
});

function exposureHost() {
  let now = 0, id = 0, intersection, mutation, scene = false;
  const timers = new Map(), handlers = new Map(), viewed = [];
  const passage = { dataset: { eventId: 'first' }, isConnected: true };
  const document = { hidden: false, body: { dataset: {}, classList: { contains: name => name === 'scene-open' && scene } },
    querySelector: () => null, querySelectorAll: () => [passage],
    addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const runtime = { document, storage: { getItem: () => null, setItem() {} },
    setTimeout(fn, delay) { const key = ++id; timers.set(key, { at: now + delay, fn }); return key; },
    clearTimeout(key) { timers.delete(key); },
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} unobserve() {} disconnect() { intersection = null; } },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} disconnect() { mutation = null; } } };
  const reader = createReadingView({ runtime, onViewed: row => viewed.push(row.id) });
  return { reader, passage, viewed, timers,
    expose() { intersection([{ target: passage, isIntersecting: true, intersectionRatio: .75, intersectionRect: { height: 300 } }]); },
    tick(at) { now = at; const due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
      for (const [key, timer] of due) { timers.delete(key); timer.fn(); } },
    scene(open) { scene = open; mutation?.(); },
  };
}

test('reused featured passage gets a fresh full exposure interval and cannot inherit its predecessor timer', () => {
  const h = exposureHost(); h.reader.observe([event('first', 100)]); h.expose(); h.tick(1000);
  h.passage.dataset.eventId = 'second'; h.reader.observe([event('second', 200)]);
  h.tick(1800); assert.deepEqual(h.viewed, [], 'old first-passage deadline cannot mark second read');
  h.tick(2799); assert.deepEqual(h.viewed, []); h.tick(2800); assert.deepEqual(h.viewed, ['second']);
  h.passage.dataset.eventId = 'third'; h.reader.observe([event('third', 300)]);
  h.tick(4599); assert.deepEqual(h.viewed, ['second']); h.tick(4600); assert.deepEqual(h.viewed, ['second', 'third']);
  // No second IntersectionObserver callback occurred: unchanged geometry still rearms new content.
  h.reader.destroy(); assert.equal(h.timers.size, 0);
});

test('a scene interrupts exposure and closing it resumes visible passage timing without a scroll', () => {
  const h = exposureHost(); h.reader.observe([event('first', 100)]); h.expose(); h.tick(900);
  h.scene(true); assert.equal(h.timers.size, 0); h.tick(5000); assert.deepEqual(h.viewed, []);
  h.scene(false); assert.equal(h.timers.size, 1); h.tick(6799); assert.deepEqual(h.viewed, []);
  h.tick(6800); assert.deepEqual(h.viewed, ['first']);
  h.passage.dataset.eventId = 'second'; h.reader.observe([event('second', 200)]); h.reader.destroy();
  h.tick(20_000); assert.deepEqual(h.viewed, ['first']); h.scene(true); h.scene(false); assert.equal(h.timers.size, 0);
});
