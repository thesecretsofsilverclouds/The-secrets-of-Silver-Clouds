import test from 'node:test';
import assert from 'node:assert/strict';
import { diffLeaves, applyChange, readChange, sideOf } from '../src/ledger.mjs';

function exactRoundTrip(before, after) {
  const leaves = diffLeaves(before, after);
  assert.ok(leaves?.length, 'the bounded example should use the actual leaf ledger');
  const changes = JSON.parse(JSON.stringify(leaves.map(leaf => ({ field: 'bag', ...leaf }))));
  const target = { bag: structuredClone(before) };
  for (const change of changes) {
    assert.deepEqual(readChange(target, change), sideOf(change, 'before'), `forward before-value at ${change.path}`);
    applyChange(target, change, 'after');
  }
  assert.deepEqual(target.bag, after);
  for (const change of [...changes].reverse()) {
    assert.deepEqual(readChange(target, change), sideOf(change, 'after'), `reverse after-value at ${change.path}`);
    applyChange(target, change, 'before');
  }
  assert.deepEqual(target.bag, before);
}

test('the actual day20 incident pressure-history contraction preserves every sequential before-value', () => {
  // First found at evt:9c55c8ef8ba7f23672002e2db8906560, 2026-09-23,
  // in the preserved 210-day audit. Deleting index6 first truncated index7,
  // so the next leaf claimed a value already removed despite a correct final bag.
  exactRoundTrip({ recent: ['wrong_platform', 'ink_relocation', 'burned_docket', 'listening_rain',
    'sealed_corridor', 'wet_footprint', 'quiet_meu', 'clock_disagreement'] },
  { recent: ['courier', 'wrong_platform', 'ink_relocation', 'burned_docket', 'listening_rain', 'sealed_corridor'] });
});

test('replacing a larger scene cast retains reversible participant history', () => {
  exactRoundTrip({ session: { cast: ['sprite_orange', 'sprite_shades', 'nimbus', 'goaden', 'ashai'] } },
    { session: { cast: ['goaden', 'ashai', 'nimbus'] } });
});

test('rolling night evidence remains reversible when two old causes leave together', () => {
  const causes = Array.from({ length: 6 }, (_, index) => ({ eventId: `event-${index}`, at: 100 + index }));
  exactRoundTrip({ causes }, { causes: causes.slice(2) });
});

test('array contraction, expansion, clearing and simultaneous replacement round-trip at every depth', () => {
  const pairs = [
    [[1, 2, 3, 4], [1]], [[1], [1, 2, 3, 4]], [[1, 2, 3], []], [[], [1, 2, 3]],
    [[1, 2, 3, 4, 5], [9, 8]], [[{ a: 1 }, { a: 2 }, { a: 3 }], [{ a: 4 }]],
  ];
  for (const [before, after] of pairs) {
    exactRoundTrip(before, after);
    exactRoundTrip({ items: before }, { items: after });
    exactRoundTrip({ session: { cast: before } }, { session: { cast: after } });
  }
});
