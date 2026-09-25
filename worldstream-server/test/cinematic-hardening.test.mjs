import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { openCinematicStore } from '../src/cinematic-store.mjs';
import { CinematicService, ViewerRegistry } from '../src/cinematic-service.mjs';
import { buildScenePacket, performancePacket, cinematicRecordForApi, acceptCinematicScene,
  cinematicConfig, validateCinematicScene, contextAtEvent } from '../src/cinematics.mjs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { createApp } from '../server.mjs';

const AT = atLondon('2026-09-05', '23:50');
const config = { ...cinematicConfig({}), enabled: true, minSceneGapMs: 0, maxAttempts: 2 };
const event = (id = 'evt:1', at = AT) => ({ id, seq: Number(id.split(':')[1]) || 1,
  occurredAt: at, type: 'INCIDENT', visibility: 'public', location: 'mi6', area: 'ops_room',
  participants: ['goaden', 'ashai'], payload: { severity: 'high', kind: 'breach' }, changes: [],
  publicDescription: 'Goaden and Ashai remained inside MI6 during the lockdown.',
  prose: 'The doors locked. Both of them watched the corridor.' });
const snapshot = (events = [event()]) => ({ events, weather: { code: 'rain', description: 'Rain' },
  pressure: { level: 'high' }, relationships: [], characters: {
    goaden: { knowledge: [] }, ashai: { knowledge: [] },
  } });
const output = packet => ({ background: packet.visuals.backgrounds[0],
  openingNarration: 'The corridor lights lay flat against the locked door.',
  beats: [], closingNarration: 'Neither moved.', chronicleSummary: packet.event.canonicalSummary });

function setup(t, options = {}) {
  const store = openCinematicStore({ dbPath: ':memory:' });
  t.after(() => store.close());
  const registry = new ViewerRegistry();
  let clock = AT;
  let calls = 0;
  const service = new CinematicService({ store, config: { ...config, ...options.config },
    now: () => clock, getPresence: options.noGetter ? null : at => registry.snapshot(at),
    client: async (packet, metadata) => { calls++; return options.client ? options.client(packet, metadata, registry) : output(packet); } });
  service.ingest(snapshot(options.events), { now: AT });
  return { store, service, registry, calls: () => calls, setClock: value => { clock = value; } };
}

test('numeric or stale viewer claims cannot authorize generation', async t => {
  const f = setup(t, { noGetter: true });
  const run = f.service.ingest(snapshot(), { presence: { count: 100, activeSinceMs: AT }, now: AT });
  await run.generation;
  await f.service.generate('evt:1');
  assert.equal(f.calls(), 0);
  assert.equal(f.store.get('evt:1').status, 'candidate');
});

test('a live audience gets a shared authored performance with AI off and no model call', async t => {
  const f = setup(t, { config: { enabled: false } });
  f.registry.touch('tab', AT);
  const before = snapshot();
  const first = f.service.ingest(before, { presence: f.registry.snapshot(AT), now: AT });
  const row = await first.generation;
  assert.equal(row.status, 'fallback');
  assert.equal(row.scene.source, 'canonical');
  assert.equal(row.attempts, 0);
  assert.equal(f.calls(), 0);
  assert.equal(f.store.budget('2026-09-05').calls, 0);
  assert.deepEqual(before, snapshot());
  const again = f.service.ingest(snapshot(), { presence: f.registry.snapshot(AT), now: AT });
  assert.equal(again.generation, null);
  assert.equal(f.store.list().length, 1);
});

test('presence expires; a returned invalid response gets no repair when the viewer left', async t => {
  const f = setup(t, { client: (packet, meta, registry) => {
    registry.disconnect('tab'); return { ...output(packet), background: 'nonexistent' };
  } });
  f.registry.touch('tab', AT);
  await f.service.generate('evt:1');
  assert.equal(f.calls(), 1);
  assert.equal(f.store.get('evt:1').status, 'fallback');
  f.registry.touch('tab', AT);
  assert.equal(f.registry.snapshot(AT + 60_001).count, 0);
  assert.ok(!JSON.stringify(f.registry.snapshot(AT)).includes('tab'));
});

test('invalid model output has at most one repair; transport uncertainty never retries', async t => {
  const f = setup(t, { client: packet => ({ ...output(packet), background: 'nonexistent' }) });
  f.registry.touch('tab', AT);
  await f.service.generate('evt:1');
  assert.equal(f.calls(), 2);
  assert.equal(f.store.get('evt:1').status, 'fallback');
  const g = setup(t, { client: () => { throw new Error('network outcome unknown'); } });
  g.registry.touch('tab', AT);
  await g.service.generate('evt:1');
  assert.equal(g.calls(), 1);
  assert.equal(g.store.get('evt:1').status, 'fallback');
});

test('global reservation prevents different events from generating together and enforces pacing', async t => {
  let release;
  const f = setup(t, { events: [event(), event('evt:2')], config: { minSceneGapMs: 60_000 },
    client: packet => new Promise(resolve => { release = () => resolve(output(packet)); }) });
  f.registry.touch('tab', AT);
  const first = f.service.generate('evt:1');
  const second = await f.service.generate('evt:2');
  assert.equal(second.status, 'candidate');
  assert.equal(f.calls(), 1);
  release(); await first;
  await f.service.generate('evt:2');
  assert.equal(f.calls(), 1);
});

test('expired worker ownership is fenced and never replaced with another request for the event', t => {
  const f = setup(t);
  const options = { londonDay: '2026-09-05', now: AT, leaseMs: 30_000 };
  const first = f.store.claim('evt:1', options);
  assert.ok(first.claimed);
  const later = f.store.claim('evt:1', { ...options, now: AT + 30_001 });
  assert.equal(later.reason, 'generation_uncertain');
  assert.equal(later.record.status, 'fallback');
  f.store.complete('evt:1', first.ownerToken, output(first.record.packet), { now: AT + 40_000 });
  assert.equal(f.store.get('evt:1').status, 'fallback');
  assert.equal(f.store.budget('2026-09-05').calls, 1);
});

test('model transport excludes private facts and unshared public-source memories', () => {
  const earlier = { ...event('evt:1', AT - 60_000), participants: ['goaden'], publicDescription: 'PRIVATE_CONTEXT_SENTINEL', prose: 'PRIVATE_CONTEXT_SENTINEL' };
  const current = event('evt:2');
  const state = snapshot([earlier, current]);
  state.characters.goaden.knowledge = [{ factKey: 'solo', learnedAt: AT - 60_000,
    sourceEventId: earlier.id, validUntil: null, value: 'PRIVATE_VALUE_SENTINEL' }];
  const internal = buildScenePacket(current, state);
  assert.match(JSON.stringify(internal), /PRIVATE_CONTEXT_SENTINEL/);
  const transport = performancePacket(internal);
  assert.doesNotMatch(JSON.stringify(transport), /PRIVATE_CONTEXT_SENTINEL|PRIVATE_VALUE_SENTINEL|"solo"/);
  assert.deepEqual(performancePacket(transport), transport);
});

test('model summaries do not become factual memories, public responses expose no packet or factRefs', () => {
  const packet = buildScenePacket(event(), snapshot());
  const scene = acceptCinematicScene({ ...output(packet), chronicleSummary: 'An invented permanent change.' }, packet);
  assert.equal(scene.chronicleSummary, packet.event.canonicalSummary);
  const api = cinematicRecordForApi({ eventId: 'evt:1', status: 'performed', scene, packet,
    failureReason: 'PRIVATE_SENTINEL' });
  assert.doesNotMatch(JSON.stringify(api), /knownFacts|PRIVATE_SENTINEL|factRefs|voiceRules|forbidden/);
});

test('callbacks must have been accepted before an event; expired knowledge is excluded at the boundary', () => {
  const early = event('evt:1', AT - 1_000), current = event('evt:2');
  const state = snapshot([early, current]);
  state.characters.goaden.knowledge = [{ factKey: 'expired', sourceEventId: early.id,
    learnedAt: AT - 1_000, validUntil: AT }];
  const packet = buildScenePacket(current, state, { callbacks: [{ eventId: early.id,
    occurredAt: early.occurredAt, acceptedAt: AT + 1, participants: ['goaden', 'ashai'], chronicleSummary: 'Too late.' }] });
  assert.equal(packet.callbacks.length, 0);
  assert.ok(!packet.characters.goaden.knownFacts.some(item => item.id === 'expired'));
});

test('actual canonical event context is identical at occurrence and after future catch-up', t => {
  const world = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-09-05', '00:00') });
  t.after(() => world.close());
  world.advance(atLondon('2026-09-05', '15:00'));
  const atEvent = world.semanticSnapshot();
  const current = atEvent.events.filter(item => item.visibility === 'public' && item.publicDescription).at(-1);
  const first = buildScenePacket(current, atEvent);
  world.advance(atLondon('2026-09-06', '18:00'));
  const later = world.semanticSnapshot();
  const before = semanticDigest(later);
  assert.deepEqual(buildScenePacket(current, later), first);
  contextAtEvent(current, later);
  assert.equal(semanticDigest(world.semanticSnapshot()), before);
});

test('schema rejects extra fields; narration-only events remain performable', () => {
  const item = { ...event(), participants: [], type: 'UNEASE', publicDescription: 'The empty corridor was closed.', prose: 'The empty corridor was closed.' };
  const packet = buildScenePacket(item, snapshot([item]));
  assert.equal(packet.scene.maxDialogueTurns, 0);
  assert.equal(validateCinematicScene(output(packet), packet).ok, true);
  assert.equal(validateCinematicScene({ ...output(packet), privateState: {} }, packet).ok, false);
});

test('the Ink alias is legal at Enchanted Ink; source texture is place-scoped and does not grant knowledge', () => {
  const inkEvent = { ...event(), type: 'VENUE_SCENE', location: 'enchanted_ink' };
  const packet = buildScenePacket(inkEvent, snapshot([inkEvent]));
  assert.equal(validateCinematicScene({ ...output(packet), openingNarration: 'Inside the Ink, the designs moved.' }, packet).ok, true);
  assert.ok(packet.world.setting.details.every(detail => detail.source && detail.id));
  assert.match(packet.world.setting.rule, /do not establish a new event/);
  const mi6 = buildScenePacket(event(), snapshot());
  assert.equal(validateCinematicScene({ ...output(mi6), openingNarration: 'Inside the Ink, the designs moved.' }, mi6).ok, false);
  assert.equal(mi6.world.setting.details.length, 0);
  assert.ok(!packet.characters.ashai.knownFacts.some(fact => fact.id === 'living_ink'));
});

test('rejected prose is retained in private diagnostics and never in a public fallback', async t => {
  const f = setup(t, { config: { maxAttempts: 1 }, client: packet => ({ ...output(packet),
    openingNarration: 'Whisper is Nameless. REJECTED_SENTINEL' }) });
  f.registry.touch('tab', AT);
  const row = await f.service.generate('evt:1');
  assert.equal(row.status, 'fallback');
  const audit = f.store.db.prepare('SELECT response_json FROM cinematic_calls WHERE event_id=?').get('evt:1');
  assert.match(audit.response_json, /REJECTED_SENTINEL/);
  assert.doesNotMatch(JSON.stringify(cinematicRecordForApi(row)), /REJECTED_SENTINEL|response_json/);
});

test('HTTP reads do not count as spectators; a heartbeat enables one shared authored scene and archive without model calls', async t => {
  const canonical = snapshot();
  const sceneStore = openCinematicStore({ dbPath: ':memory:' });
  let calls = 0, clock = AT, advances = 0;
  const world = { advance() { advances++; }, semanticSnapshot: () => structuredClone(canonical),
    publicProjection: () => ({ characters: [], events: [event()], resolvedThrough: AT }) };
  const server = createApp({ world, cinematicStore: sceneStore, now: () => clock,
    cinematicOptions: config, cinematicClient: packet => { calls++; return output(packet); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); sceneStore.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const route of ['/api/world', '/api/cinematics/live', '/api/presence', '/api/cinematics/archive']) await fetch(base + route);
  await fetch(base + '/api/observe', { method: 'POST' });
  assert.equal(calls, 0);
  assert.equal(sceneStore.get('evt:1').status, 'candidate', 'reader GETs do not authorize a performance');
  const ping = await fetch(base + '/api/presence/ping', { method: 'POST' }).then(r => r.json());
  assert.equal(typeof ping.viewerToken, 'string');
  await Promise.all(Array.from({ length: 20 }, () => fetch(base + '/api/observe', { method: 'POST' })));
  assert.equal(calls, 0, 'production remains authored-only even with enabled legacy cinematic options');
  assert.equal(sceneStore.get('evt:1').status, 'fallback');
  assert.equal(sceneStore.get('evt:1').scene.source, 'canonical');
  assert.equal(sceneStore.get('evt:1').attempts, 0);
  assert.equal(sceneStore.budget('2026-09-05').calls, 0);
  const records = await Promise.all(Array.from({ length: 20 }, () => fetch(base + '/api/cinematics/live').then(r => r.json())));
  assert.ok(records.every(row => row.cinematic?.eventId === 'evt:1'));
  assert.ok(records.every(row => JSON.stringify(row.cinematic) === JSON.stringify(records[0].cinematic)));
  const archive = await fetch(base + '/api/cinematics/archive').then(r => r.json());
  assert.equal(archive.cinematics.length, 1);
  const exact = await fetch(base + '/api/cinematics/events/evt%3A1').then(r => r.json());
  assert.deepEqual(exact.cinematic, records[0].cinematic);
  const feed = await fetch(base + '/api/world').then(r => r.json());
  assert.deepEqual(feed.events[0].cinematic, exact.cinematic);
  assert.doesNotMatch(JSON.stringify(feed), /factRefs|knownFacts|PRIVATE/);
  assert.equal(advances, 21);
  clock += 61_000;
  const status = await fetch(base + '/api/cinematics/status').then(r => r.json());
  assert.equal(status.enabled, false);
  assert.equal(Object.hasOwn(status, 'activeViewers'), false, 'Audience size is private, including after expiry');
});

test('separate Node processes sharing SQLite reserve only one provider attempt', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'worldstream-workers-'));
  t.after(() => { const safe = realpathSync(dir);
    assert.equal(dirname(safe), realpathSync(tmpdir())); assert.ok(basename(safe).startsWith('worldstream-workers-'));
    rmSync(safe, { recursive: true, force: true }); });
  const dbPath = join(dir, 'scenes.sqlite');
  const db = openCinematicStore({ dbPath });
  new CinematicService({ store: db }).ingest(snapshot(), { now: AT });
  db.close();
  const source = `
    import { openCinematicStore } from ${JSON.stringify(new URL('../src/cinematic-store.mjs', import.meta.url).href)};
    const store = openCinematicStore({ dbPath: process.env.WORLDSTREAM_TEST_DB });
    process.send('ready');
    process.once('message', () => {
      const claim = store.claim('evt:1', { now: ${AT}, londonDay:'2026-09-05', leaseMs:30000 });
      process.send({ claimed: claim.claimed }); store.close(); process.disconnect();
    });`;
  const children = Array.from({ length: 2 }, () => spawn(process.execPath, ['--input-type=module', '-e', source],
    { env: { ...process.env, WORLDSTREAM_TEST_DB: dbPath }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true }));
  await Promise.all(children.map(child => once(child, 'message')));
  const outcomes = children.map(child => once(child, 'message'));
  const exits = children.map(child => once(child, 'exit'));
  children.forEach(child => child.send('start'));
  const results = await Promise.all(outcomes);
  await Promise.all(exits);
  assert.equal(results.filter(([item]) => item.claimed).length, 1);
  const check = openCinematicStore({ dbPath });
  assert.equal(check.budget('2026-09-05').calls, 1); check.close();
});
