import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { openWorld } from '../../src/world.mjs';
import { atLondon } from '../../src/time.mjs';
import { DEFAULT_SEED, publicEvents } from '../../src/fixture.mjs';
import { evaluatePlotClocks } from '../../src/clocks.mjs';
import { WorldDurableObject } from '../src/world-durable-object.mjs';
import { createMockSqlStorage } from '../src/sqlite-adapter.mjs';

function createMockDoContext(rawDb = null) {
  const nodeDb = rawDb ?? new DatabaseSync(':memory:');
  const mockSql = createMockSqlStorage(nodeDb);
  const storage = {
    sql: mockSql,
    async getAlarm() { return null; },
    async setAlarm() {},
    async deleteAlarm() {}
  };
  const ctx = {
    storage,
    acceptWebSocket() {},
    getWebSockets() { return []; }
  };
  return { ctx, nodeDb };
}

test('Fidelity: 100% parity between Node engine and Cloudflare DO adapter for identical seed and inputs', () => {
  const startMs = atLondon('2026-09-04', '00:00');
  const targetMs = startMs + 20 * 3600_000; // 20:00 London time, includes evening conversation

  // 1. Initialize local reference engine
  const localWorld = openWorld({ dbPath: ':memory:', seed: DEFAULT_SEED, startMs });

  // 2. Initialize Cloudflare Durable Object engine
  const { ctx } = createMockDoContext();
  const cfWorld = new WorldDurableObject(ctx, { WORLD_SEED: DEFAULT_SEED, START_MS: startMs });

  try {
    // Advance both engines to the exact same moment
    const localAdvance = localWorld.advance(targetMs);
    const cfDeltas = cfWorld.advance(targetMs);

    // -------------------------------------------------------------
    // Part A: World Fidelity Verification
    // -------------------------------------------------------------
    const localStats = localWorld.operationalStats();
    const cfStats = cfWorld.operationalStats();

    assert.equal(cfStats.resolvedThrough, localStats.resolvedThrough, 'Watermarks must match');
    assert.equal(cfStats.eventCount, localStats.eventCount, 'Event counts must match');
    assert.equal(cfStats.pendingActionCount, localStats.pendingActionCount, 'Pending action counts must match');

    const localSnap = localWorld.presentationSnapshot();
    const cfSnap = cfWorld.presentationSnapshot();

    // Characters state parity
    for (const charId of ['goaden', 'ashai']) {
      const localChar = localSnap.characters[charId];
      const cfChar = cfSnap.characters[charId];
      assert.ok(cfChar, `Character ${charId} exists in CF DO`);
      assert.equal(cfChar.location, localChar.location, `${charId} location matches`);
      assert.equal(cfChar.activity, localChar.activity, `${charId} activity matches`);
      assert.equal(cfChar.knowledge.length, localChar.knowledge.length, `${charId} knowledge length matches`);
      assert.deepEqual(cfChar.conditions, localChar.conditions, `${charId} conditions match`);
    }

    // Relationships parity
    assert.deepEqual(cfSnap.relationships, localSnap.relationships, 'Relationships match');

    // Canonical events list parity
    assert.equal(cfSnap.events.length, localSnap.events.length, 'Total snapshot events count matches');
    for (let i = 0; i < localSnap.events.length; i++) {
      const le = localSnap.events[i];
      const ce = cfSnap.events[i];
      assert.equal(ce.seq, le.seq, `Event [${i}] seq matches`);
      assert.equal(ce.id, le.id, `Event [${i}] id matches`);
      assert.equal(ce.occurredAt, le.occurredAt, `Event [${i}] occurredAt matches`);
      assert.equal(ce.type, le.type, `Event [${i}] type matches`);
      assert.equal(ce.location, le.location, `Event [${i}] location matches`);
      assert.deepEqual(ce.participants, le.participants, `Event [${i}] participants match`);
      assert.equal(ce.publicDescription, le.publicDescription, `Event [${i}] description matches`);
    }

    // -------------------------------------------------------------
    // Part B: Reader Fidelity Verification
    // -------------------------------------------------------------
    const localProj = localWorld.publicProjection();
    const cfProj = cfWorld.publicProjection();

    assert.equal(cfProj.events.length, localProj.events.length, 'Projected public events count matches');

    let verifiedDialogueBeats = 0;
    let verifiedProseBeats = 0;
    let verifiedEarlierContext = 0;

    for (let i = 0; i < localProj.events.length; i++) {
      const lp = localProj.events[i];
      const cp = cfProj.events[i];

      assert.equal(cp.id, lp.id);
      assert.equal(cp.occurredAt, lp.occurredAt);
      assert.equal(cp.register, lp.register);
      assert.equal(cp.description, lp.description);

      if (lp.prose) {
        assert.equal(cp.prose, lp.prose, `Event ${lp.id} prose matches`);
        verifiedProseBeats++;
      }

      if (Array.isArray(lp.lines) && lp.lines.length > 0) {
        assert.deepEqual(cp.lines, lp.lines, `Event ${lp.id} dialogue lines match`);
        verifiedDialogueBeats++;
      }

      if (lp.contextBridge) {
        assert.deepEqual(cp.contextBridge, lp.contextBridge, `Event ${lp.id} ↩ Earlier context bridge matches`);
        verifiedEarlierContext++;
      }

      if (lp.memoryCallback) {
        assert.deepEqual(cp.memoryCallback, lp.memoryCallback, `Event ${lp.id} memoryCallback matches`);
      }
    }

    assert.ok(verifiedDialogueBeats > 0, 'Must have verified at least one dialogue beat');
    assert.ok(verifiedProseBeats > 0, 'Must have verified at least one prose beat');

    // Continuous reader stretch verification
    const dialogueEvent = cfProj.events.find(e => Array.isArray(e.lines) && e.lines.length > 0);
    assert.ok(dialogueEvent, 'Continuous reader stretch contains genuine dialogue');
    assert.ok(dialogueEvent.lines.length >= 2, 'Dialogue contains multiple authored lines');

    // -------------------------------------------------------------
    // Part C: Plot Clocks & History Parity
    // -------------------------------------------------------------
    const localClocks = evaluatePlotClocks(localWorld, targetMs);
    const cfClocks = evaluatePlotClocks(cfWorld, targetMs);
    assert.deepEqual(cfClocks, localClocks, 'Plot clocks evaluate identically');

    const localHistory = localWorld.publicHistory();
    const cfHistory = cfWorld.publicHistory();
    assert.equal(cfHistory.events.length, localHistory.events.length, 'Public history count matches');
    assert.deepEqual(cfHistory.events.map(e => e.id), localHistory.events.map(e => e.id), 'Public history IDs match');

  } finally {
    localWorld.close();
  }
});
