import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_RESERVOIR_CATALOG } from '../src/scene-reservoir-catalog.mjs';
import { SCENE_RESERVOIR_BATCHES } from '../src/scene-reservoir-data.mjs';
import { CAST } from '../lab/grammar/cast.mjs';
import { VALIDATED_MOMENT_GRAMMAR_REPORT } from '../lab/grammar/validated-lines.mjs';

const FUTURE_LIBRARY_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..', '..',
  'WORLDSTREAM_CANON_CONTENT_MEGA_BATCH_04',
  'WORLDSTREAM_FUTURE_SIMULATION_LIBRARY_BATCH_04.json'
);

test('reservoir baseline identity: exact catalog size, quip counts, quarantined future scenes, and content digest', () => {
  // 1. Active current-world reservoir surfaces
  assert.equal(SCENE_RESERVOIR_CATALOG.length, 874, 'Must have exactly 874 active reservoir scenes');

  // Verify unique scene IDs and that all have valid prose in beats[0] and sourceHash
  const seenIds = new Set();
  for (const scene of SCENE_RESERVOIR_CATALOG) {
    assert.ok(scene.id, 'Scene must have an id');
    assert.ok(!seenIds.has(scene.id), `Duplicate scene ID: ${scene.id}`);
    seenIds.add(scene.id);
    const prose = scene.beats?.[0]?.text;
    assert.ok(prose && prose.trim().length > 0, `Scene ${scene.id} must have non-empty prose beat`);
    assert.ok(scene.reservoir.sourceHash, `Scene ${scene.id} must have a sourceHash`);
  }

  // 2. Quip grammar lines
  const quipLines = [...CAST.values()].reduce((n, g) => n + Object.values(g.quips ?? {})
    .reduce((m, bank) => m + bank.length, 0), 0);
  assert.equal(quipLines, 673, 'Must have exactly 673 Moment quip lines across CAST');
  assert.equal(VALIDATED_MOMENT_GRAMMAR_REPORT.added, 515, 'Validated moment grammar must have 515 added lines');
  assert.equal(VALIDATED_MOMENT_GRAMMAR_REPORT.skipped, 0, 'Validated moment grammar must have 0 skipped lines');

  // 3. Quarantined Future Simulation library
  // Future simulation families must NOT appear anywhere in the active catalog
  const FUTURE_FAMILIES = new Set([
    'duskkin_compliance',
    'onari_environment',
    'mi6_contractors',
    'magical_london_incidents',
    'multifaction_briefings',
    'celestial_veil_phenomena',
    'streamliner_deep_corridor',
    'high_order_containment',
  ]);
  for (const scene of SCENE_RESERVOIR_CATALOG) {
    assert.ok(!FUTURE_FAMILIES.has(scene.reservoir.family),
      `Future simulation family ${scene.reservoir.family} leaked into active catalog in scene ${scene.id}`);
  }

  // Inactive production batch rows count
  const catalogIds = new Set(SCENE_RESERVOIR_CATALOG.map(s => s.reservoir.sourceId));
  const allEntries = SCENE_RESERVOIR_BATCHES.flatMap(b => b.entries);
  const inactiveProductionRows = allEntries.filter(e => !catalogIds.has(e.id));
  assert.equal(inactiveProductionRows.length, 91, 'Must have exactly 91 production rows legitimately inactive');

  // Check Batch 04 Future Simulation library from this file's location, not cwd.
  assert.equal(existsSync(FUTURE_LIBRARY_PATH), true,
    `Future Simulation library must resolve from the test file: ${FUTURE_LIBRARY_PATH}`);
  const b04 = JSON.parse(readFileSync(FUTURE_LIBRARY_PATH, 'utf8'));
  assert.equal(b04.scenes.length, 200, 'Batch 04 Future Simulation library must have 200 scenes');
  for (const s of b04.scenes) {
    assert.ok(!catalogIds.has(s.id), `Future simulation scene ${s.id} must not be in active catalog`);
    assert.equal(s.status, 'staged_future', `Future simulation scene ${s.id} must remain staged`);
  }

  // 4. Deterministic SHA-256 digests
  const sceneSignature = SCENE_RESERVOIR_CATALOG
    .map(s => `${s.id}|${s.reservoir.sourceHash}|${s.reservoir.family}`)
    .sort()
    .join('\n');
  const sceneDigest = createHash('sha256').update(sceneSignature).digest('hex');

  const quipSignature = [...CAST.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([char, g]) => Object.entries(g.quips ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([surf, bank]) => bank.map(b => `${char}|${surf}|${b.text}`).sort()))
    .join('\n');
  const quipDigest = createHash('sha256').update(quipSignature).digest('hex');

  const combinedDigest = createHash('sha256').update(`${sceneDigest}|${quipDigest}`).digest('hex');

  // Assert exact golden digests
  assert.equal(sceneDigest, '8c70a4a37a9a0fcf42e5a370d811e55344d37d6551bacad257e2ab22fd13e8b9');
  assert.equal(quipDigest, '26f2f684c861e746cfa5a8b7dfb7b3b5c1ee1e1640dc596479047ff9c1efea51');
  assert.equal(combinedDigest, '10298895a12c9645e28d6f4cf5e8c7dfbbb5f9eb12506f05a17accc98e963e5e');
});
