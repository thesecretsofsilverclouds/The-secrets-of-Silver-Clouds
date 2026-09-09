import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReadingWindow } from '../../worldstream/app/reading-history.js';
import { buildReadingRecap, createReadingRecap } from '../../worldstream/app/reading-recap.js';

const event = (index, type = 'OFFSCREEN_RESULT', story = `life:${index}`) => ({ id: `evt:${index}`,
  occurredAt: 1000 + index, description: `Public consequence ${index}.`, type, storyRef: { type: 'story', id: story } });

test('a week longer than 240 rows has contiguous coverage and earliest-unread continuation', async () => {
  const all = Array.from({ length: 383 }, (_, index) => event(index));
  const requests = [];
  const result = await loadReadingWindow({ after: 1000, through: 1500, fetcher: async path => {
    const url = new URL(path, 'https://example.test'); requests.push(url);
    const before = Number(url.searchParams.get('before') ?? 383);
    const start = Math.max(0, before - 100);
    return { ok: true, json: async () => ({ events: all.slice(start, before), nextCursor: start || null,
      complete: start === 0, coverage: { after: 1000, through: 1500 } }) };
  } });
  assert.equal(requests.length, 4); assert.equal(result.events.length, 383);
  assert.equal(result.completeSince, 1000); assert.equal(result.complete, true);
  assert.ok(requests.every(url => url.searchParams.get('through') === '1500'));
  const recap = buildReadingRecap({ resolvedThrough: 1500 }, result,
    { version: 2, boundary: { kind: 'read_start', at: 1000, eventId: 'evt:0' }, viewed: [] });
  assert.equal(recap.historyGap, false); assert.equal(recap.continueTarget.eventId, 'evt:1');
});

test('bounded partial history admits its gap, and an invalid/private page cannot establish coverage', async () => {
  const result = await loadReadingWindow({ after: 1000, through: 1500, maxPages: 1,
    fetcher: async () => ({ ok: true, json: async () => ({ events: [event(300)], nextCursor: 200,
      complete: false, coverage: { after: 1000, through: 1500 } }) }) });
  assert.equal(result.complete, false); assert.equal(result.completeSince, 1300);
  assert.equal(buildReadingRecap({ resolvedThrough: 1500 }, result, { at: 1000 }).historyGap, true);
  let accepted = false;
  await assert.rejects(loadReadingWindow({ after: 1000, through: 1500, onPage: () => { accepted = true; },
    fetcher: async () => ({ ok: true, json: async () => ({ events: [{ ...event(1), visibility: 'private' }],
      nextCursor: null, complete: true, coverage: { after: 1000, through: 1500 } }) }) }), /public passage/);
  assert.equal(accepted, false);
});

test('independent stories of the same family and their actual beginnings survive a recap', () => {
  const rows = [event(0, 'OFFSCREEN_START', 'life:emily'), event(1, 'OFFSCREEN_START', 'life:gabriel'),
    event(20, 'OFFSCREEN_RESULT', 'life:emily'), event(21, 'OFFSCREEN_RESULT', 'life:gabriel'),
    event(22, 'ARC_BEAT', 'arc:question')];
  const recap = buildReadingRecap({ resolvedThrough: 1500 }, { events: rows, completeSince: 999 }, { at: 999 });
  assert.deepEqual(recap.events.map(item => item.id), ['evt:20', 'evt:21', 'evt:22']);
  assert.equal(recap.events[0].earlier.id, 'evt:0'); assert.equal(recap.events[1].earlier.id, 'evt:1');
});

test('rereading a previous page updates your place without acknowledging intervening unseen pages', () => {
  const memory = new Map(), rows = [event(1), event(2), event(3)];
  const reader = createReadingRecap({ storage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) } });
  reader.update({ continuityId: 'book', resolvedThrough: 1500 }, { events: rows, completeSince: 1000 });
  reader.markViewed(rows[0]); reader.markViewed(rows[2]); reader.markViewed(rows[0]);
  const state = reader.getState();
  assert.equal(state.bookmark.lastViewed.id, 'evt:1');
  assert.equal(state.bookmark.boundary.at, 1001);
  assert.equal(state.recap.availableUnreadEvents, 1);
  assert.equal(state.recap.continueTarget.eventId, 'evt:2');
});

test('a different server continuity cannot enter the reading cache even at the same timestamps', async () => {
  let accepted = false;
  await assert.rejects(loadReadingWindow({ after: 1000, through: 1500, continuityId: 'the-open-book',
    onPage: () => { accepted = true; }, fetcher: async () => ({ ok: true, json: async () => ({
      events: [event(1)], nextCursor: null, complete: true, continuityId: 'a-different-book',
      coverage: { after: 1000, through: 1500 },
    }) }) }), /continuity|history/i);
  assert.equal(accepted, false, 'a rejected response cannot advance coverage or mix worlds');
});

test('simultaneous passages retain immutable ledger order across a page boundary', async () => {
  const first = { ...event(1), id: 'evt:z-first', occurredAt: 1200, narrativeOrder: 101 };
  const second = { ...event(2), id: 'evt:a-second', occurredAt: 1200, narrativeOrder: 102 };
  let pages = 0;
  const result = await loadReadingWindow({ after: 1000, through: 1500, continuityId: 'the-open-book',
    fetcher: async () => ({ ok: true, json: async () => ({ events: [pages++ === 0 ? second : first],
      nextCursor: pages === 1 ? 102 : null, complete: pages === 2, continuityId: 'the-open-book',
      coverage: { after: 1000, through: 1500 },
    }) }) });
  assert.deepEqual(result.events.map(row => row.id), [first.id, second.id]);
});

test('a rejected later page leaves only the contiguous coverage proved by earlier successful pages', async () => {
  const accepted = []; let pages = 0;
  await assert.rejects(loadReadingWindow({ after: 1000, through: 1500, continuityId: 'the-open-book',
    onPage: page => accepted.push(page), fetcher: async () => ({ ok: true, json: async () => ({
      events: [event(pages++ === 0 ? 300 : 1)], nextCursor: pages === 1 ? 300 : null,
      complete: pages === 2, continuityId: 'the-open-book',
      coverage: { after: 1000, through: pages === 1 ? 1500 : 1501 },
    }) }) }), /history/i);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].complete, false);
  assert.equal(accepted[0].completeSince, 1300);
  assert.equal(buildReadingRecap({ resolvedThrough: 1500 },
    { events: accepted[0].events, completeSince: accepted[0].completeSince }, { at: 1000 }).historyGap, true);
});
