import test from 'node:test';
import assert from 'node:assert/strict';
import { listStoryThreads, buildStoryThread, STORY_THREAD_LOOKUP_LIMIT } from '../src/story-threads.mjs';
import { createStoryTrail, storyTrailKey } from '../../worldstream/app/story-trails.js';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { publicEvents } from '../src/fixture.mjs';

const event = (id, at, type, extra = {}) => ({ id, occurredAt: at, seq: at, type,
  location: 'enchanted_ink', participants: ['ashai'], visibility: 'public',
  publicDescription: `Public record ${id}.`, payload: { secret: 'PRIVATE_PAYLOAD' },
  changes: [{ private: 'PRIVATE_CHANGES' }], causedBy: ['unrelated', 'private-cause'], ...extra });
function snapshot() {
  const record = { id: 'thread:delivery', openedAt: 100, deadlineAt: 450, status: 'resolved',
    originEventId: 'opening', lastEventId: 'callback',
    causalEventIds: ['opening', 'checking', 'private-evidence', 'ending', 'callback'],
    hidden: { reference: 'PRIVATE_REFERENCE' }, factKeys: { dispatch: 'PRIVATE_FACT' },
    token: 'PRIVATE_TOKEN', result: { outcome: 'reconciled', deliveryDisposition: 'accepted',
      completedAt: 400, sourceEventId: 'ending' } };
  return { world: { resolvedThrough: 600 }, threads: { instances: { [record.id]: record } },
    intent: { instances: {} }, agendas: { operations: {} },
    characters: { ashai: { knowledge: [{ text: 'PRIVATE_MEMORY' }] } },
    events: [event('callback', 500, 'THREAD_DELIVERY_REMEMBERED'),
      event('opening', 100, 'THREAD_DELIVERY_OPEN'), event('ending', 400, 'THREAD_DELIVERY_DECIDE', { prose: 'A public closing paragraph.' }),
      event('private-evidence', 300, 'THREAD_DISPATCH_RECEIVED', { visibility: 'private' }),
      event('checking', 200, 'THREAD_DELIVERY_CHECK'), event('unrelated', 250, 'THREAD_DELIVERY_CHECK')],
  };
}
const request = { type: 'story', id: 'thread:delivery' };

test('trail is exact public ownership, chronological, and never inferred from nearby activity or private causes', () => {
  const state = snapshot(), before = structuredClone(state), result = buildStoryThread(state, request);
  assert.deepEqual(result.events.map(row => row.id), ['opening', 'checking', 'ending', 'callback']);
  assert.deepEqual(result.stages.map(stage => stage.eventIds), [['opening'], ['checking', 'ending'], ['callback']]);
  assert.equal(result.concluded, true);
  assert.equal(result.events[2].prose, 'A public closing paragraph.');
  for (const row of result.events) assert.ok(Object.keys(row).every(key =>
    ['id', 'occurredAt', 'type', 'location', 'description', 'prose'].includes(key)));
  const serialized = JSON.stringify([listStoryThreads(state), result]);
  for (const forbidden of ['PRIVATE_', 'private-evidence', 'private-cause', 'unrelated', 'causedBy', 'payload', 'factKey', 'knowledge'])
    assert.equal(serialized.includes(forbidden), false, forbidden);
  assert.deepEqual(state, before);
  assert.deepEqual(buildStoryThread(state, request), result);
});

test('missing opening and intermediate records remain missing; future events and mismatched lookup IDs cannot fill stages', () => {
  const state = snapshot();
  state.events = [state.events.find(row => row.id === 'ending')];
  const output = buildStoryThread(state, request, { eventById: id => id === 'opening'
    ? event('wrong-id', 100, 'THREAD_DELIVERY_OPEN') : id === 'callback'
      ? event('callback', 700, 'THREAD_DELIVERY_REMEMBERED') : null });
  assert.deepEqual(output.events.map(row => row.id), ['ending']);
  assert.equal(output.stages[0].state, 'not_recorded');
  assert.equal(output.stages[1].state, 'not_recorded');
  assert.equal(output.stages[2].state, 'recorded');
  assert.match(output.stages[0].message, /not available/);
  const openingOnly = snapshot();
  openingOnly.events = openingOnly.events.filter(row => row.id === 'opening');
  assert.equal(buildStoryThread(openingOnly, request).stages[2].state, 'not_recorded');
});

test('old sources load by exact ID with bounded lookups and no unrelated lookup or resimulation', () => {
  const state = snapshot(), oldEvents = new Map(state.events.map(row => [row.id, row]));
  state.events = []; let reads = [];
  const result = buildStoryThread(state, request, { eventById: id => { reads.push(id); return oldEvents.get(id); } });
  assert.deepEqual(result.events.map(row => row.id), ['opening', 'checking', 'ending', 'callback']);
  assert.equal(reads.length, 5);
  assert.equal(reads.includes('private-cause'), false);
  state.threads.instances[request.id].causalEventIds = Array.from({ length: 1000 }, (_, n) => `missing-${n}`);
  reads = [];
  buildStoryThread(state, request, { eventById: id => { reads.push(id); return null; } });
  assert.ok(reads.length <= STORY_THREAD_LOOKUP_LIMIT);
  for (const bad of [{ type: 'secret', id: request.id }, { type: 'story', id: '__proto__' },
    { type: 'story', id: 'missing' }, { type: 'story', id: 'x'.repeat(201) }])
    assert.equal(buildStoryThread(state, bad), null);
});

test('intention follows recorded offers and counteroffers without publishing the decision motive or an unrelated condition', () => {
  const state = snapshot(); state.threads.instances = {};
  state.intent.instances['intent:one'] = { id: 'intent:one', openedAt: 100, status: 'renegotiating',
    proposed: 'game', selected: 'quiet', startAt: 500, endAt: 900,
    originEventId: 'offer', actions: { response: { sourceEventId: 'offer' },
      renegotiate: { sourceEventId: 'counteroffer', consumed: false } },
    privateDecision: { motive: 'PRIVATE_FATIGUE', eventIds: ['private-condition'] } };
  state.events = [event('counteroffer', 200, 'INTENT_RESPONSE'), event('offer', 100, 'INTENT_OFFER'),
    event('private-condition', 150, 'REST_BEGIN')];
  const result = buildStoryThread(state, { type: 'intention', id: 'intent:one' });
  assert.deepEqual(result.events.map(row => row.id), ['offer', 'counteroffer']);
  assert.equal(result.title, 'A quiet break');
  assert.equal(result.concluded, false);
  assert.equal(result.stages[1].state, 'not_recorded');
  assert.equal(JSON.stringify(result).includes('FATIGUE'), false);
});

test('operation retains its own report and outcome, omits private observation, and does not absorb a prior operation', () => {
  const state = snapshot(); state.threads.instances = {};
  state.agendas.operations['agenda:one'] = { id: 'agenda:one', family: 'record_recheck',
    status: 'resolved', startedAt: 100, deadlineAt: 450, originEventId: 'open', lastEventId: 'release',
    previousResultEventId: 'prior-review', causalEventIds: ['open', 'observation', 'report', 'resolve', 'release'],
    result: { outcome: 'cleared', completedAt: 400, sourceEventId: 'resolve' } };
  state.events = [event('prior-review', 100, 'AGENDA_RESOLVE'), event('open', 100, 'AGENDA_OPERATION_START'),
    event('observation', 200, 'AGENDA_OBSERVE', { visibility: 'private' }),
    event('report', 300, 'AGENDA_REPORT'), event('resolve', 400, 'AGENDA_RESOLVE'), event('release', 500, 'AGENDA_RELEASE')];
  const descriptor = listStoryThreads(state)[0];
  assert.equal(descriptor.id, 'agenda:one'); assert.equal(descriptor.eventId, 'resolve');
  const output = buildStoryThread(state, { type: 'operation', id: descriptor.id });
  assert.deepEqual(output.events.map(row => row.id), ['open', 'report', 'resolve', 'release']);
  state.agendas.operations['agenda:one'].lastEventId = 'observation';
  assert.equal(JSON.stringify(listStoryThreads(state)).includes('observation'), false);
});

test('trail revision changes for new public turns, not private work or clock-only reads', () => {
  const state = snapshot(), initial = listStoryThreads(state)[0].revision;
  state.world.resolvedThrough += 10;
  state.threads.instances[request.id].hidden.reference = 'A_DIFFERENT_PRIVATE_VALUE';
  state.events.push(event('new-private-work', 550, 'THREAD_DELIVERY_CHECK', { visibility: 'private' }));
  state.threads.instances[request.id].causalEventIds.push('new-private-work');
  assert.equal(listStoryThreads(state)[0].revision, initial);
  state.events.push(event('new-public-turn', 560, 'THREAD_DELIVERY_RESULT_NOTICED'));
  state.threads.instances[request.id].causalEventIds.push('new-public-turn');
  assert.notEqual(listStoryThreads(state)[0].revision, initial);
});

test('HTTP story reads use the bounded snapshot and exact sources without advance or full ledger scans', async t => {
  const state = snapshot(), before = structuredClone(state), all = new Map(state.events.map(row => [row.id, row]));
  const sparse = { ...state, events: [] }; let advances = 0, fullReads = 0, lookups = 0;
  const world = { advance() { advances++; throw new Error('No simulation from story reads'); },
    semanticSnapshot() { fullReads++; throw new Error('No full ledger scans'); },
    presentationSnapshot() { return sparse; }, eventById(id) { lookups++; return all.get(id); },
    publicProjection() { return { worldId: 'test', resolvedThrough: 600, events: [], characters: [] }; } };
  const server = createApp({ world, cinematicClient: null, now: () => 600 });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const url = `${base}/api/story-thread?type=story&id=${encodeURIComponent(request.id)}`;
  const first = await fetch(url); assert.equal(first.status, 200);
  const output = await first.json(); assert.equal(output.id, request.id);
  assert.deepEqual(output.events.map(row => row.id), ['opening', 'checking', 'ending', 'callback']);
  assert.deepEqual(await fetch(url).then(response => response.json()), output);
  assert.equal((await fetch(`${base}/api/story-thread?type=private&id=one`)).status, 400);
  assert.equal((await fetch(`${base}/api/story-thread?type=story&id=missing`)).status, 404);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${url}&target=900`)).status, 400);
  assert.equal(advances, 0); assert.equal(fullReads, 0);
  assert.ok(lookups <= 2 * STORY_THREAD_LOOKUP_LIMIT);
  assert.deepEqual(state, before);
  assert.equal(JSON.stringify(output).includes('PRIVATE_'), false);
});

test('real canonical history is addressable through bounded snapshots and repeated trails leave the digest unchanged', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-09-04', '00:00') });
  try {
    world.advance(atLondon('2026-09-09', '00:00'));
    const before = semanticDigest(world.semanticSnapshot());
    const snapshot = world.presentationSnapshot(), descriptors = listStoryThreads(snapshot);
    assert.ok(descriptors.some(row => row.type === 'operation'));
    for (const item of descriptors) {
      const output = buildStoryThread(snapshot, item, { eventById: id => world.eventById(id) });
      assert.ok(output.events.length, `${item.type} has a real public source`);
      for (const source of output.events) {
        const canonical = world.eventById(source.id);
        assert.equal(canonical.visibility, 'public');
        // Displayed trails share the feed's edition; source facts and the
        // stored original wording remain immutable below the read boundary.
        assert.equal(source.description, publicEvents({ events: [canonical] })[0].description);
        assert.equal(source.occurredAt, canonical.occurredAt);
      }
      assert.deepEqual(buildStoryThread(snapshot, item, { eventById: id => world.eventById(id) }), output);
    }
    assert.equal(semanticDigest(world.semanticSnapshot()), before);
  } finally { world.close(); }
});

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.handlers = {}; this.open = false; }
  get parentNode() { return this.parent; }
  append(...children) { for (const child of children) {
    if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child);
    child.parent = this; this.children.push(child);
  } }
  replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; this.append(...children); }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(key, handler) { this.handlers[key] = handler; }
  emit(type) { this.handlers[type]?.(); }
}
const doc = { createElement: tag => new Element(tag) };
const tick = () => new Promise(resolve => setImmediate(resolve));
const nodes = root => [root, ...root.children.flatMap(nodes)];

test('client lazily reads once, preserves expanded DOM during polling, refreshes on revision and safely renders source text', async () => {
  const result = buildStoryThread(snapshot(), request);
  result.events[0].description = '<img src=x onerror=alert(1)> remains text';
  const calls = [], trails = createStoryTrail({ document: doc, fetcher: async (...args) => {
    calls.push(args); return { ok: true, json: async () => structuredClone(result) };
  } });
  const first = new Element('article'), second = new Element('article');
  const detail = trails.attach(first, { ...request, scope: 'world:one', revision: 1 });
  assert.equal(calls.length, 0);
  detail.open = true; detail.emit('toggle'); await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(new URL(calls[0][0], 'http://localhost').searchParams.get('id'), request.id);
  assert.ok(nodes(detail).some(node => node.textContent === result.events[0].description));
  const sourceLink = nodes(detail).find(node => node.className === 'story-trail-source');
  assert.ok(nodes(detail).some(node => node.id === decodeURIComponent(sourceLink.href.slice(1))));
  assert.equal(trails.attach(second, { ...request, scope: 'world:one', revision: 1 }), detail);
  assert.equal(detail.open, true); assert.equal(first.children.length, 0); assert.equal(calls.length, 1);
  trails.attach(second, { ...request, scope: 'world:one', revision: 2 }); await tick();
  assert.equal(calls.length, 2);
  assert.notEqual(trails.attach(first, { ...request, scope: 'world:two', revision: 2 }), detail);
  assert.notEqual(storyTrailKey({ ...request, scope: 'one' }), storyTrailKey({ ...request, scope: 'two' }));
});

test('failed client read is retryable, and a previous world response cannot replace the current world trail', async () => {
  let count = 0, deferred;
  const result = buildStoryThread(snapshot(), request);
  const trails = createStoryTrail({ document: doc, fetcher: async () => {
    count++;
    if (count === 1) return { ok: false };
    if (count === 2) return new Promise(resolve => { deferred = resolve; });
    return { ok: true, json: async () => result };
  } });
  const card = new Element('article');
  const old = trails.attach(card, { ...request, scope: 'old' }); old.open = true; old.emit('toggle'); await tick();
  nodes(old).find(node => node.tag === 'button').emit('click'); await tick();
  const fresh = trails.attach(card, { ...request, scope: 'new' }); fresh.open = true; fresh.emit('toggle'); await tick();
  deferred({ ok: true, json: async () => ({ ...result, events: [] }) }); await tick();
  assert.ok(nodes(fresh).some(node => node.textContent === result.events[0].description));
  assert.equal(count, 3);
});
