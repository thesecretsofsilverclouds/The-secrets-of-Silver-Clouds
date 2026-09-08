import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';
import { editorialCinematicRecordForApi } from '../src/editorial-cinematics.mjs';
import { editorialEvent, EDITORIAL_REVISION } from '../src/editorial.mjs';
import { buildScenePacket, cinematicRecordForApi, deterministicFallbackScene, scenePacketKey } from '../src/cinematics.mjs';
import { CinematicService } from '../src/cinematic-service.mjs';
import { openCinematicStore } from '../src/cinematic-store.mjs';

const AT = Date.parse('2026-09-05T23:52:00.000Z');
const typo = 'Enchanted Ink was on the wrong street again, and the street it had left was one street shorter than it should be.';
function source(overrides = {}) {
  return { id: 'event:old-ink', seq: 1, type: 'INCIDENT', occurredAt: AT,
    visibility: 'public', location: 'enchanted_ink', area: 'venue', participants: ['goaden', 'ashai'],
    payload: { kind: 'ink_relocation', severity: 'low' }, publicDescription: typo, prose: typo,
    changes: [], causedBy: [], ...overrides };
}
function snapshot(event) {
  return { world: { id: 'editorial-test', seed: 'stable', rulesVersion: 'unchanged', resolvedThrough: AT },
    characters: { goaden: { knowledge: [] }, ashai: { knowledge: [] } },
    events: [event], weather: {}, pressure: { level: 'low' }, factions: {}, pendingActions: [] };
}
function cached(event = source()) {
  const packet = buildScenePacket(event, snapshot(event));
  return { eventId: event.id, occurredAt: AT, acceptedAt: AT + 1000, status: 'performed',
    score: 55, band: 'cinematic', packetKey: scenePacketKey(packet), packet,
    scene: deterministicFallbackScene(packet, 'canonical_only') };
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function nightSource() {
  return source({ id: 'event:old-night', type: 'NIGHT_WORK_END', location: 'mi6', area: 'ops_room',
    participants: ['goaden'], payload: { outcome: 'resolved' },
    publicDescription: 'Goaden completed the night check.', prose: 'The night check was completed.' });
}

test('an old canonical performance receives the wording correction without changing cache identity or facts', () => {
  const record = cached();
  record.packet.characters.goaden.privateCanary = 'DO_NOT_PROJECT_PRIVATE_MEMORY';
  record.packetKey = scenePacketKey(record.packet);
  const before = JSON.stringify(record), baseline = cinematicRecordForApi(record);
  freeze(record);
  const api = editorialCinematicRecordForApi(record);
  assert.match(api.scene.openingNarration, /one building fewer/);
  assert.match(api.chronicleSummary, /one building fewer/);
  assert.doesNotMatch(JSON.stringify(api), /one street shorter|DO_NOT_PROJECT_PRIVATE_MEMORY/);
  assert.equal(api.editorialRevision, EDITORIAL_REVISION);
  for (const field of ['eventId', 'occurredAt', 'acceptedAt', 'status', 'score', 'band', 'durationSeconds', 'atmosphere'])
    assert.deepEqual(api[field], baseline[field], field);
  assert.deepEqual(api.scene.assets, baseline.scene.assets);
  assert.deepEqual(api.scene.beats, baseline.scene.beats);
  assert.equal(JSON.stringify(record), before);
  assert.equal(scenePacketKey(record.packet), record.packetKey);
});

test('actual historical outcome enables richer authored fallback while incomplete packet context stays conservative', () => {
  const event = nightSource(), record = cached(event);
  const packetOnly = editorialCinematicRecordForApi(record);
  const full = editorialCinematicRecordForApi(record, { event: freeze(event) });
  assert.equal(packetOnly.scene.openingNarration, 'The night check was completed.');
  assert.notEqual(full.scene.openingNarration, packetOnly.scene.openingNarration);
  assert.match(full.chronicleSummary, /closed|reconciled|finished/i);
  assert.doesNotMatch(JSON.stringify(full.scene), /Ashai/);
  assert.equal(full.scene.openingNarration, editorialEvent(event).prose);
  assert.equal(full.acceptedAt, record.acceptedAt);
});

test('foreign, private or incorrectly timed source events cannot replace a cached public scene', () => {
  const event = nightSource(), record = cached(event), expected = editorialCinematicRecordForApi(record);
  for (const changes of [{ id: 'foreign' }, { visibility: 'private' }, { occurredAt: AT + 1 }, { location: 'sanctuary' }]) {
    const supplied = { ...event, ...changes, publicDescription: 'PRIVATE_OR_FOREIGN_CANARY' };
    assert.deepEqual(editorialCinematicRecordForApi(record, { event: supplied }), expected);
  }
});

test('provider performance is preserved except for the exact known typo; canonical summary remains current', () => {
  const event = source(), record = cached(event);
  record.scene = { ...record.scene, source: 'model',
    openingNarration: `The windows held the light. ${typo}`,
    beats: [{ speaker: 'goaden', plate: record.packet.visuals.plates.goaden[0], line: 'A quiet street.', factRefs: ['event:old-ink'] }],
    closingNarration: 'The light stayed.' };
  const before = structuredClone(record);
  const api = editorialCinematicRecordForApi(freeze(record), { event });
  assert.equal(api.scene.openingNarration, 'The windows held the light. Enchanted Ink was on the wrong street again, and the street it had left had one building fewer than it should.');
  assert.equal(api.scene.closingNarration, 'The light stayed.');
  assert.equal(api.scene.beats[0].line, 'A quiet street.');
  assert.equal(api.scene.source, 'model');
  assert.match(api.chronicleSummary, /one building fewer/);
  assert.deepEqual(record, before);
  assert.ok(!Object.hasOwn(api.scene.beats[0], 'factRefs'));
});

test('null and unperformed records never acquire a manufactured scene', () => {
  assert.equal(editorialCinematicRecordForApi(null), null);
  const record = { ...cached(), scene: null, status: 'candidate', acceptedAt: null };
  const api = editorialCinematicRecordForApi(record);
  assert.equal(api.scene, null);
  assert.equal(api.acceptedAt, null);
  assert.equal(api.chronicleSummary, null);
});

test('world, archive, event replay and live reads revise an existing cache row with zero writes or provider calls', async t => {
  const event = source({ id: 'event:old-game', type: 'INTENT_COMPLETE', location: 'mi6', area: 'common_room',
    payload: { status: 'completed', activity: 'game' }, publicDescription: 'Goaden and Ashai finished their game.',
    prose: 'The game was finished.' });
  const state = snapshot(event), store = openCinematicStore({ dbPath: ':memory:' });
  let calls = 0, advances = 0;
  const service = new CinematicService({ store, now: () => AT + 20_000,
    config: { enabled: false, minSceneGapMs: 0 },
    client: async () => { calls++; throw new Error('Editorial reads must not generate'); } });
  service.ingest(state, { now: AT });
  const candidate = store.get(event.id);
  assert.ok(candidate);
  store.performCanonical(event.id, deterministicFallbackScene(candidate.packet), { now: AT + 1000 });
  const storedBefore = JSON.stringify(store.get(event.id)), worldBefore = JSON.stringify(state);
  const world = {
    eventById: id => id === event.id ? event : null,
    advance: () => { advances++; },
    publicProjection: () => ({ worldId: 'editorial-test', resolvedThrough: AT, characters: [],
      events: [{ id: event.id, occurredAt: AT, type: event.type, location: event.location,
        participants: event.participants, description: event.publicDescription, prose: event.prose }] }),
  };
  const server = createApp({ world, cinematicStore: store, cinematicService: service,
    cinematicOptions: { enabled: false }, now: () => AT + 20_000 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function read(path) {
    const response = await fetch(`${base}${path}`); assert.equal(response.status, 200, path); return response.json();
  }
  const rows = [
    (await read('/api/world')).events[0].cinematic,
    (await read('/api/cinematics/archive')).cinematics[0],
    (await read(`/api/cinematics/events/${encodeURIComponent(event.id)}`)).cinematic,
    (await read('/api/cinematics/live')).cinematic,
  ];
  const expected = editorialCinematicRecordForApi(store.get(event.id), { event });
  for (const row of rows) assert.deepEqual(row, expected);
  assert.equal((await read(`/api/cinematics/live?after=${expected.acceptedAt}`)).cinematic, null,
    'a presentation revision does not replay an already accepted scene');
  service.ingest(state, { now: AT + 30_000 });
  assert.equal(JSON.stringify(store.get(event.id)), storedBefore);
  assert.equal(JSON.stringify(state), worldBefore);
  assert.equal(calls, 0); assert.equal(advances, 0);
});

test('archive and event endpoints expose safe setup context affordance for qualifying prior beats', async t => {
  const store = openCinematicStore({ dbPath: ':memory:' });
  const prior = { id: 'event:prior-order', seq: 1, type: 'INCIDENT', occurredAt: AT - 1200_000,
    visibility: 'public', location: 'mi6', area: 'embankment', participants: ['ashai'],
    publicDescription: 'Ashai stood with the others and watched the Order pass along the embankment.' };
  const target = source({ id: 'event:target-talk', seq: 2, occurredAt: AT, participants: ['ashai', 'goaden'] });
  const state = { world: { id: 'setup-test', seed: 'stable', rulesVersion: 'unchanged', resolvedThrough: AT },
    characters: { goaden: { knowledge: [] }, ashai: { knowledge: [] } },
    events: [prior, target], weather: {}, pressure: { level: 'low' }, factions: {}, pendingActions: [] };
  const service = new CinematicService({ store, now: () => AT + 20_000, config: { enabled: false, minSceneGapMs: 0 } });
  service.ingest(state, { now: AT });
  const candidate = store.get(target.id);
  assert.ok(candidate);
  store.performCanonical(target.id, deterministicFallbackScene(candidate.packet), { now: AT + 1000 });
  const world = {
    advance: () => {},
    eventById: id => id === target.id ? target : id === prior.id ? prior : null,
    presentationSnapshot: () => state,
    publicProjection: () => ({ worldId: 'setup-test', resolvedThrough: AT, characters: [], events: [target] }),
  };
  const server = createApp({ world, cinematicStore: store, cinematicService: service, cinematicOptions: { enabled: false }, now: () => AT + 20_000 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const archiveRes = await (await fetch(`${base}/api/cinematics/archive`)).json();
  const eventRes = await (await fetch(`${base}/api/cinematics/events/${encodeURIComponent(target.id)}`)).json();
  for (const c of [archiveRes.cinematics[0], eventRes.cinematic]) {
    assert.ok(c.setup, 'cinematic must include setup');
    assert.equal(c.setup.originEventId, prior.id);
    assert.equal(c.setup.originSnippet, prior.publicDescription);
    assert.match(c.setup.originTimeLabel, /^Earlier \u00b7 \d{2}:\d{2}$/);
    assert.doesNotMatch(JSON.stringify(c.setup), /PRIVATE|knowledge|secret/);
  }
});

