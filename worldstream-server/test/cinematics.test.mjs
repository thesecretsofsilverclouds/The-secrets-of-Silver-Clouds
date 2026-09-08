import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openCinematicStore } from '../src/cinematic-store.mjs';
import { CinematicService } from '../src/cinematic-service.mjs';
import { buildScenePacket, deterministicFallbackScene, effectiveCinematicThreshold,
  scenePacketKey, validateCinematicScene } from '../src/cinematics.mjs';
import { atLondon } from '../src/time.mjs';

const occurredAt = atLondon('2026-09-05', '23:52');
const livePresence = () => ({ count: 1, activeSinceMs: occurredAt - 1000 });
const baseConfig = Object.freeze({
  enabled: true, model: 'mock-model', minScore: 56, maxCallsPerDay: 8,
  maxDailyCostUsd: 1, estimatedCostPerCallUsd: 0.05,
  reconnectGraceMs: 15_000, generationLeaseMs: 90_000, maxAttempts: 1,
  maxOutputTokens: 900, timeoutMs: 30_000, minSceneGapMs: 0, liveWindowMs: 180_000,
});

function incident(id = 'evt:midnight', at = occurredAt, participants = ['goaden', 'ashai']) {
  return {
    seq: Number(id.match(/\d+$/)?.[0] ?? 1), id, occurredAt: at, type: 'INCIDENT',
    visibility: 'public', location: 'mi6', area: 'ops_room', participants,
    payload: { kind: 'breach', severity: 'high' },
    publicDescription: 'The perimeter went at the north face. MI6 was sealed for the night and nobody went off shift.',
    prose: 'The north face went white, then black. Every door in the building found its lock at once.',
  };
}

function snapshot(events = [incident()]) {
  return {
    world: { id: 'test', seed: 'seed', rulesVersion: 'test', resolvedThrough: occurredAt },
    characters: {
      goaden: { id: 'goaden', knowledge: [] }, ashai: { id: 'ashai', knowledge: [] },
    },
    pressure: { level: 'high' }, events, factions: {}, weather: {}, pendingActions: [],
  };
}

function validScene(packet, line = null) {
  const speaker = Object.keys(packet.characters)[0];
  return {
    background: packet.visuals.backgrounds[0],
    openingNarration: 'The corridor lights flatten to a hard white.',
    beats: packet.event.canonicalLines.length ? [] : [{
      speaker, plate: packet.visuals.plates[speaker][0],
      line: line ?? `${packet.characters[speaker].name} watches the sealed door.`,
      factRefs: [`event:${packet.event.id}`],
    }],
    closingNarration: 'The building holds its breath around them.',
    chronicleSummary: packet.event.canonicalSummary,
  };
}

function serviceWith(client, options = {}) {
  const store = options.store ?? openCinematicStore({ dbPath: ':memory:' });
  const service = new CinematicService({ store, client, getPresence: livePresence,
    config: { ...baseConfig, ...(options.config ?? {}) }, now: options.now ?? (() => occurredAt + 30_000) });
  return { store, service };
}

test('NO VIEWERS: a worthy committed event is stored without an LLM call', async (t) => {
  let calls = 0;
  const { store, service } = serviceWith(async (packet) => { calls++; return validScene(packet); });
  t.after(() => store.close());
  const result = service.ingest(snapshot(), { activeViewerCount: 0, activeSinceMs: null, now: occurredAt + 30_000 });
  assert.equal(result.generation, null);
  assert.equal(store.get('evt:midnight').status, 'candidate');
  assert.equal(calls, 0);
  assert.equal(store.budget('2026-09-05').calls, 0);
});

test('ONE EVENT / TWENTY VIEWERS: exactly one generation is accepted', async (t) => {
  let calls = 0;
  const { store, service } = serviceWith(async (packet) => {
    calls++; await new Promise((resolve) => setTimeout(resolve, 20));
    return { scene: validScene(packet), model: 'mock-model' };
  });
  t.after(() => store.close());
  service.ingest(snapshot(), { activeViewerCount: 0, now: occurredAt + 1_000 });
  const rows = await Promise.all(Array.from({ length: 20 }, () => service.generate('evt:midnight', { now: occurredAt + 30_000 })));
  assert.equal(calls, 1);
  assert.ok(rows.every((row) => row.status === 'performed'));
  assert.equal(store.get('evt:midnight').attempts, 1);
});

test('RESTART SAFETY: a performed cinematic is loaded and never regenerated', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'worldstream-cinematic-restart-'));
  const dbPath = join(directory, 'cinematics.sqlite');
  try {
    let calls = 0;
    const firstStore = openCinematicStore({ dbPath });
    const first = new CinematicService({ store: firstStore, config: baseConfig, getPresence: livePresence, now: () => occurredAt + 30_000,
      client: async (packet) => { calls++; return { scene: validScene(packet), model: 'mock' }; } });
    const run = first.ingest(snapshot(), { presence: livePresence(), now: occurredAt + 30_000 });
    await run.generation;
    firstStore.close();

    const secondStore = openCinematicStore({ dbPath });
    const second = new CinematicService({ store: secondStore, config: baseConfig, getPresence: livePresence, now: () => occurredAt + 40_000,
      client: async () => { calls++; throw new Error('must not run'); } });
    const replay = second.ingest(snapshot(), { presence: livePresence(), now: occurredAt + 40_000 });
    assert.equal(replay.generation, null);
    assert.equal(secondStore.get('evt:midnight').status, 'performed');
    assert.equal(calls, 1);
    secondStore.close();
  } finally {
    const root = resolve(directory), parent = resolve(tmpdir());
    if (root.startsWith(parent) && root !== parent) rmSync(root, { recursive: true, force: true });
  }
});

test('CANON FAILURE: embargoed output is rejected and canonical fallback is the only presentation', async (t) => {
  const { store, service } = serviceWith(async (packet) => ({ scene: {
    ...validScene(packet), openingNarration: 'Whisper is Nameless, and Goaden finally says so.',
  } }));
  t.after(() => store.close());
  const run = service.ingest(snapshot(), { presence: livePresence(), now: occurredAt + 30_000 });
  const row = await run.generation;
  assert.equal(row.status, 'fallback');
  assert.equal(row.scene.source, 'canonical');
  assert.doesNotMatch(JSON.stringify(row.scene), /Whisper is Nameless/i);
  assert.match(row.failureReason, /embargoed|uncast|invented_name/i);
});

test('INVALID PLATE: a plate outside the packet vocabulary is refused', () => {
  const packet = buildScenePacket(incident(), snapshot());
  const scene = validScene(packet);
  scene.beats[0].plate = 'goaden_nonexistent';
  assert.deepEqual(validateCinematicScene(scene, packet), { ok: false, reason: 'invalid_plate:goaden' });
});

test('INVALID BACKGROUND: a background outside the packet vocabulary is refused', () => {
  const packet = buildScenePacket(incident(), snapshot());
  const scene = validScene(packet);
  scene.background = 'invented_castle';
  assert.deepEqual(validateCinematicScene(scene, packet), { ok: false, reason: 'invalid_background' });
});

test('KNOWLEDGE ISOLATION: Ashai cannot cite a fact only Goaden learned', () => {
  const source = {
    seq: 1, id: 'evt:private-source', occurredAt: occurredAt - 60_000, type: 'NOTICE_PUBLIC_FACT',
    visibility: 'public', location: 'mi6', participants: ['goaden'],
    publicDescription: 'Goaden received the north-gate call sign.', payload: {},
  };
  const later = { ...incident('evt:midnight-2', occurredAt), seq: 2 };
  const state = snapshot([source, later]);
  state.characters.goaden.knowledge.push({ factKey: 'north-gate-call-sign', sourceEventId: source.id,
    learnedAt: source.occurredAt, validUntil: null, provenance: 'told' });
  const packet = buildScenePacket(later, state);
  assert.ok(packet.characters.goaden.knownFacts.some((fact) => fact.id === 'north-gate-call-sign'));
  assert.ok(!packet.characters.ashai.knownFacts.some((fact) => fact.id === 'north-gate-call-sign'));
  const scene = validScene(packet);
  scene.beats[0] = {
    speaker: 'ashai', plate: packet.visuals.plates.ashai[0], line: 'Ashai repeats the north-gate call sign.',
    factRefs: ['north-gate-call-sign'],
  };
  assert.equal(validateCinematicScene(scene, packet).reason, 'knowledge:ashai:north-gate-call-sign');
});

test('SAME EVENT / SAME PACKET: construction and packet identity are deterministic', () => {
  const state = snapshot();
  const first = buildScenePacket(incident(), state);
  const second = buildScenePacket(structuredClone(incident()), structuredClone(state));
  assert.deepEqual(first, second);
  assert.equal(scenePacketKey(first), scenePacketKey(second));
});

test('BUDGET CEILING: later candidates fall back without another model call', async (t) => {
  const secondAt = occurredAt + 60_000;
  const firstEvent = incident('evt:budget-1', occurredAt);
  const secondEvent = incident('evt:budget-2', secondAt);
  const state = snapshot([firstEvent, secondEvent]);
  let calls = 0;
  const { store, service } = serviceWith(async (packet) => { calls++; return { scene: validScene(packet), model: 'mock' }; },
    { config: { maxCallsPerDay: 1 } });
  t.after(() => store.close());
  service.ingest(state, { activeViewerCount: 0, now: secondAt });
  await service.generate(firstEvent.id, { now: secondAt + 10_000 });
  const second = await service.generate(secondEvent.id, { now: secondAt + 20_000 });
  assert.equal(calls, 1);
  assert.equal(second.status, 'fallback');
  assert.equal(second.failureReason, 'budget_ceiling');
  assert.equal(store.budget('2026-09-05').calls, 1);
});

test('MULTI-PROCESS LOCK: two services sharing a database cannot duplicate generation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'worldstream-cinematic-lock-'));
  const dbPath = join(directory, 'cinematics.sqlite');
  try {
    const firstStore = openCinematicStore({ dbPath });
    const seedService = new CinematicService({ store: firstStore, config: { ...baseConfig, enabled: false } });
    seedService.ingest(snapshot(), { activeViewerCount: 0, now: occurredAt });
    const secondStore = openCinematicStore({ dbPath });
    let calls = 0;
    const client = async (packet) => {
      calls++; await new Promise((resolve) => setTimeout(resolve, 40));
      return { scene: validScene(packet), model: 'mock' };
    };
    const one = new CinematicService({ store: firstStore, client, config: baseConfig, getPresence: livePresence, now: () => occurredAt + 30_000 });
    const two = new CinematicService({ store: secondStore, client, config: baseConfig, getPresence: livePresence, now: () => occurredAt + 30_000 });
    await Promise.all([one.generate('evt:midnight'), two.generate('evt:midnight')]);
    assert.equal(calls, 1);
    assert.equal(firstStore.get('evt:midnight').status, 'performed');
    firstStore.close(); secondStore.close();
  } finally {
    const root = resolve(directory), parent = resolve(tmpdir());
    if (root.startsWith(parent) && root !== parent) rmSync(root, { recursive: true, force: true });
  }
});

test('MEMORY CALLBACK: an accepted scene is available only to characters who experienced it', async (t) => {
  const first = incident('evt:solo-1', occurredAt, ['goaden']);
  const later = incident('evt:shared-2', occurredAt + 60_000, ['goaden', 'ashai']);
  const stateOne = snapshot([first]);
  const { store, service } = serviceWith(async (packet) => ({ scene: validScene(packet), model: 'mock' }));
  t.after(() => store.close());
  service.ingest(stateOne, { activeViewerCount: 0, now: occurredAt });
  await service.generate(first.id, { now: occurredAt + 10_000 });
  const packet = buildScenePacket(later, snapshot([first, later]), { callbacks: store.callbacksBefore(later.occurredAt) });
  assert.ok(packet.characters.goaden.recentRelevantMemories.some((memory) => memory.id === first.id));
  assert.ok(!packet.characters.ashai.recentRelevantMemories.some((memory) => memory.id === first.id));
  assert.ok(!packet.callbacks.some((memory) => memory.id === first.id), 'a shared callback requires shared experience');
});

test('LLM FAILURE: timeout/failure leaves canonical input untouched and produces a safe fallback', async (t) => {
  const state = snapshot();
  const before = structuredClone(state);
  const { store, service } = serviceWith(async () => { throw new Error('timeout'); });
  t.after(() => store.close());
  const run = service.ingest(state, { presence: livePresence(), now: occurredAt + 30_000 });
  const row = await run.generation;
  assert.deepEqual(state, before);
  assert.equal(row.status, 'fallback');
  assert.equal(row.scene.source, 'canonical');
  assert.match(row.failureReason, /timeout/);
});

test('viewer presence lowers only the performance threshold, never the event score', () => {
  const score = buildScenePacket(incident(), snapshot()).scene.cinematicScore;
  assert.equal(score, buildScenePacket(incident(), snapshot()).scene.cinematicScore);
  assert.equal(effectiveCinematicThreshold(0), Number.POSITIVE_INFINITY);
  assert.ok(effectiveCinematicThreshold(20) < effectiveCinematicThreshold(1));
});

test('deterministic fallback contains only committed prose and authored lines', () => {
  const packet = buildScenePacket(incident(), snapshot());
  const fallback = deterministicFallbackScene(packet, 'test');
  assert.equal(fallback.source, 'canonical');
  assert.equal(fallback.openingNarration, packet.event.canonicalProse);
  assert.equal(fallback.chronicleSummary, packet.event.canonicalSummary);
});
