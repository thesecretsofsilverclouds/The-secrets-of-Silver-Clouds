import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateRhythm, verifyRhythmDeterminism } from '../scripts/verify-rhythm-behaviour.mjs';

test('actual RHYTHM choices, successful completions and habit changes retain ledger ownership and privacy', () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('Unexpected runtime network/model call'); };
  try {
    const run = simulateRhythm({ seed: 'rhythm-acceptance-00', days: 3 });
    assert.ok(run.choices.length > 0);
    assert.ok(run.choices.some(row => row.completed));
    assert.ok(run.habitIncrements > 0);
    assert.ok(run.choices.every(row => !row.completed || row.started));
    assert.ok(Object.values(run.maxActorBytes).every(size => size <= 4096));
    assert.deepEqual(run.replay, { forward: true, reverse: true });
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('RHYTHM produces the same full canonical ledger/state through chunks and SQLite restarts', () => {
  const result = verifyRhythmDeterminism({ days: 3 });
  assert.ok(result.choices > 0);
  assert.equal(result.digests.single, result.digests.chunked);
  assert.equal(result.digests.single, result.digests.restarted);
  assert.equal(result.forward, true); assert.equal(result.reverse, true);
});
