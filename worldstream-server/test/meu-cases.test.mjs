import test from 'node:test';
import assert from 'node:assert/strict';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { MEU_FAMILIES } from '../src/meu-cases.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEED = 'test-seed-meu';

test('MEU cases: full bounded lifecycle executes from committed incident to close', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: SEED });
  try {
    // Advance 7 days to observe incident generation and MEU case lifecycle
    world.advance(START + 7 * 24 * 3600_000);
    const snap = world.semanticSnapshot();

    const meuEvents = snap.events.filter(e => e.type.startsWith('MEU_CASE_'));
    assert.ok(meuEvents.length > 0, 'MEU case events must be emitted when incidents occur');

    const openEvents = meuEvents.filter(e => e.type === 'MEU_CASE_OPEN');
    const inspectEvents = meuEvents.filter(e => e.type === 'MEU_CASE_INSPECT');
    const reportEvents = meuEvents.filter(e => e.type === 'MEU_CASE_REPORT');
    const resolveEvents = meuEvents.filter(e => e.type === 'MEU_CASE_RESOLVE');
    const closeEvents = meuEvents.filter(e => e.type === 'MEU_CASE_CLOSE');

    assert.ok(openEvents.length >= 1, 'At least one MEU case must open across 7 days');
    assert.ok(inspectEvents.length >= 1, 'MEU inspection must occur');
    assert.ok(reportEvents.length >= 1, 'MEU report must be filed');
    assert.ok(resolveEvents.length >= 1, 'MEU case must be resolved');
    assert.ok(closeEvents.length >= 1, 'MEU case must be closed');

    // Verify ordering per case
    for (const open of openEvents) {
      const caseId = open.payload.caseId;
      const caseEvents = meuEvents.filter(e => e.payload.caseId === caseId);
      const types = caseEvents.map(e => e.type);

      assert.equal(types[0], 'MEU_CASE_OPEN');
      assert.ok(types.includes('MEU_CASE_INSPECT'), 'Case must include inspection');
      assert.ok(types.includes('MEU_CASE_REPORT'), 'Case must include report');
      assert.ok(types.includes('MEU_CASE_RESOLVE'), 'Case must include resolve');
      assert.ok(types.includes('MEU_CASE_CLOSE'), 'Case must include close');

      // Verify closed case state in world
      const meuState = snap.meuCases;
      assert.ok(meuState.closedSummaries.some(s => s.caseId === caseId), 'Closed case must be recorded in summaries');
    }
  } finally {
    world.close();
  }
});

test('MEU cases: active-case cap is strictly enforced (max 1 active case)', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: SEED });
  try {
    world.advance(START + 14 * 24 * 3600_000);
    const snap = world.semanticSnapshot();

    // Check history: at no point can two active cases exist simultaneously
    const openTimes = [];
    const closeTimes = {};

    for (const e of snap.events) {
      if (e.type === 'MEU_CASE_OPEN') {
        openTimes.push({ caseId: e.payload.caseId, time: e.occurredAt });
      } else if (e.type === 'MEU_CASE_CLOSE') {
        closeTimes[e.payload.caseId] = e.occurredAt;
      }
    }

    for (let i = 0; i < openTimes.length - 1; i++) {
      const current = openTimes[i];
      const next = openTimes[i + 1];
      const closedAt = closeTimes[current.caseId];
      assert.ok(closedAt !== undefined, 'First case must have closed');
      assert.ok(closedAt <= next.time, `Next case ${next.caseId} opened at ${next.time} before previous ${current.caseId} closed at ${closedAt}`);
    }
  } finally {
    world.close();
  }
});

test('MEU cases: permitted outcomes match Bible specifications exactly', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: 'seed-outcomes' });
  try {
    world.advance(START + 30 * 24 * 3600_000);
    const snap = world.semanticSnapshot();

    const resolveEvents = snap.events.filter(e => e.type === 'MEU_CASE_RESOLVE');
    const allowedOutcomes = new Set([
      'no_action',
      'advisory_or_monitor',
      'contained',
      'referred_to_mi6',
      'referred_external'
    ]);

    for (const res of resolveEvents) {
      assert.ok(allowedOutcomes.has(res.payload.outcome), `Outcome ${res.payload.outcome} must be in allowed outcomes`);
      assert.ok(MEU_FAMILIES.includes(res.payload.family), `Family ${res.payload.family} must be in stable MEU families`);
    }

    // Verify result facts are created
    const resultFacts = Object.values(snap.facts).filter(f => f.kind === 'meu_case_result');
    assert.equal(resultFacts.length, resolveEvents.length, 'Every resolved case must have a result fact');
  } finally {
    world.close();
  }
});

test('MEU cases: bounded persistence limits (closedSummaries <= 24, issued <= 128, zero prose in state)', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: 'seed-bounded' });
  try {
    // Advance 60 days
    world.advance(START + 60 * 24 * 3600_000);
    const snap = world.semanticSnapshot();
    const meuState = snap.meuCases;

    assert.ok(meuState.closedSummaries.length <= 24, `closedSummaries (${meuState.closedSummaries.length}) must not exceed 24`);
    assert.ok(Object.keys(meuState.issued).length <= 128, `issued actions (${Object.keys(meuState.issued).length}) must not exceed 128`);

    // Ensure zero prose is stored in state
    for (const c of Object.values(meuState.cases)) {
      assert.equal(c.prose, undefined, 'No prose may be stored in case state');
      assert.equal(c.text, undefined, 'No text may be stored in case state');
    }
    for (const s of meuState.closedSummaries) {
      assert.equal(s.prose, undefined, 'No prose may be stored in closed summary');
    }
  } finally {
    world.close();
  }
});

test('MEU cases: knowledge isolation — characters only learn report facts by reading them in ops room', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: 'seed-knowledge' });
  try {
    world.advance(START + 14 * 24 * 3600_000);
    const snap = world.semanticSnapshot();

    const reportEvents = snap.events.filter(e => e.type === 'MEU_CASE_REPORT');

    for (const report of reportEvents) {
      const factKey = report.payload.factKey;
      for (const who of ['goaden', 'ashai']) {
        const actor = snap.characters[who];
        const hasKnowledge = actor.knowledge.some(m => m.factKey === factKey);
        const readReport = snap.events.some(e => e.type === 'MEU_REPORT_READ' && e.payload.actor === who && e.payload.factKey === factKey);

        if (hasKnowledge) {
          assert.ok(readReport, `${who} must only know fact ${factKey} if an explicit read event occurred`);
        } else {
          assert.ok(!readReport, `${who} must not have read event without having the knowledge`);
        }
      }
    }
  } finally {
    world.close();
  }
});

test('MEU cases: determinism — same seed reproduces identical cases and digest', () => {
  const world1 = openWorld({ dbPath: ':memory:', startMs: START, seed: 'seed-determ-test' });
  const world2 = openWorld({ dbPath: ':memory:', startMs: START, seed: 'seed-determ-test' });
  try {
    world1.advance(START + 14 * 24 * 3600_000);
    world2.advance(START + 14 * 24 * 3600_000);

    const digest1 = semanticDigest(world1.semanticSnapshot());
    const digest2 = semanticDigest(world2.semanticSnapshot());

    assert.equal(digest1, digest2, 'Digests must match identically across independent deterministic runs');

    const meu1 = world1.semanticSnapshot().events.filter(e => e.type.startsWith('MEU_CASE_'));
    const meu2 = world2.semanticSnapshot().events.filter(e => e.type.startsWith('MEU_CASE_'));

    assert.deepEqual(meu1, meu2, 'MEU events must match identically across independent runs');
  } finally {
    world1.close();
    world2.close();
  }
});
