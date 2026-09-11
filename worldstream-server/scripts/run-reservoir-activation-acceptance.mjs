import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { editorialEvent } from '../src/editorial.mjs';
import { SCENE_RESERVOIR_CATALOG } from '../src/scene-reservoir-catalog.mjs';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { SCENE_RESERVOIR_IMPORT_REPORT } from '../src/scene-reservoir-catalog.mjs';
import { CAST } from '../lab/grammar/cast.mjs';
import { VALIDATED_MOMENT_GRAMMAR_REPORT } from '../lab/grammar/validated-lines.mjs';
import { createReservoirMemory, selectReservoirSurface } from '../src/scene-reservoir-select.mjs';

const START_DATE = '2026-03-02';
const DAYS = 90;
const startMs = atLondon(START_DATE, '00:00');
const targetMs = startMs + DAYS * 86_400_000;
const SEEDS = ['silver-clouds-now-v1', 'seed-beta', 'seed-gamma'];
const EXPECTED_DIGESTS = {
  'silver-clouds-now-v1': 'd3d0716f9545f04e782beab7fe1359120a71422615c86cf38c44612dc2e4fcd7',
  'seed-beta': '7cf76007bf700913a9a779aa00cd6c72fde65975d3d451bb7636e9a37b1a744a',
  'seed-gamma': '4d7f13280e672ca3be43f9428ff2e07d8afc3644a430ee742765755b5a524a97',
};

const baselineCatalog = SCENE_RESERVOIR_CATALOG.slice(0, 80);
const identity = (events) => events.map(e => `${e.id}|${e.occurredAt}|${e.type}`).join('\n');
const hash = text => createHash('sha256').update(text).digest('hex');

function present(events, catalog, seed) {
  const memory = createReservoirMemory();
  const known = new Set();
  let hits = 0;
  const used = new Map();
  for (const ev of events) {
    if (ev.visibility !== 'public') continue;
    known.add(ev.id);
    const scene = selectReservoirSurface(ev, { catalog, memory, seed, knownEventIds: known });
    if (scene) {
      hits++;
      used.set(scene.id, (used.get(scene.id) ?? 0) + 1);
    }
  }
  return { hits, used };
}

console.log('=== Reservoir activation 90d × 3 A/B ===\n');
console.log('Active catalog', SCENE_RESERVOIR_CATALOG.length);
console.log('Moment grammar added', VALIDATED_MOMENT_GRAMMAR_REPORT.added, 'skipped', VALIDATED_MOMENT_GRAMMAR_REPORT.skipped);

const seedReports = [];
for (const seed of SEEDS) {
  console.log(`\n--- ${seed} ---`);
  const world = openWorld({ dbPath: ':memory:', startMs, seed });
  world.advance(targetMs);
  const digest = semanticDigest(world.semanticSnapshot());
  const events = world.db.prepare('SELECT seq, id, occurred_at, semantic_json FROM events ORDER BY seq').all()
    .map(r => ({ seq: r.seq, id: r.id, occurredAt: r.occurred_at, ...JSON.parse(r.semantic_json) }));
  const reservoirBeats = events.filter(e => e.type === 'SCENE_BANK_BEAT'
    && String(e.payload?.sceneBankId || e.id || '').includes('R:')).length;
  const legionVisits = events.filter(e => e.type === 'LEGION_VISIT').map(e => `${e.occurredAt}:${e.id}`);
  const a = present(events, baselineCatalog, seed);
  const b = present(events, SCENE_RESERVOIR_CATALOG, seed);
  const opportunities = events.filter(e => e.visibility === 'public').length;
  seedReports.push({
    seed, eventCount: events.length, digest, digestMatch: digest === EXPECTED_DIGESTS[seed],
    identity: hash(identity(events)), opportunities, baselineHits: a.hits, fullHits: b.hits,
    uniqueSurfaces: b.used.size, worstRepeat: Math.max(0, ...b.used.values()),
    reservoirBeats, legionVisitCount: legionVisits.length, legionFingerprint: hash(legionVisits.join('|')),
  });
  console.log(' events', events.length, 'digest', digest);
  console.log(' vs stored baseline', digest === EXPECTED_DIGESTS[seed] ? 'MATCH' : 'DIFFERENT (same-run A/B still share this digest)');
  console.log(' R: beats', reservoirBeats, 'Legion visits', legionVisits.length);
  console.log(' opportunities', opportunities, 'A hits', a.hits, 'B hits', b.hits,
    'unique B', b.used.size, 'worst repeat', Math.max(0, ...b.used.values()));
}

const catalogIds = new Set(SCENE_RESERVOIR_CATALOG.map(s => s.reservoir.sourceId));
const inactive = [];
for (const batch of SCENE_RESERVOIR_BATCHES) {
  for (const entry of batch.entries) {
    if (catalogIds.has(entry.id)) continue;
    const row = SCENE_RESERVOIR_IMPORT_REPORT.find(r => r.batchId === batch.batch_id)
      ?.rows.find(r => r.id === entry.id);
    inactive.push({
      batch: batch.batch_id, id: entry.id, family: entry.family,
      status: row?.status || SCENE_RESERVOIR_REVIEWS[entry.id]?.status,
      reason: row?.reason || SCENE_RESERVOIR_REVIEWS[entry.id]?.reason,
    });
  }
}

const grammarLines = [...CAST.values()].reduce((n, g) => n + Object.values(g.quips ?? {})
  .reduce((m, bank) => m + bank.length, 0), 0);

const report = {
  seeds: seedReports,
  catalog: SCENE_RESERVOIR_CATALOG.length,
  grammarAdded: VALIDATED_MOMENT_GRAMMAR_REPORT,
  grammarLines,
  inactive,
  llmCalls: 0,
  observeRefillReservations: 0,
  observeModelCalls: 0,
};
writeFileSync('reports/reservoir-activation-acceptance.json', JSON.stringify(report, null, 2));
console.log('\nWrote reports/reservoir-activation-acceptance.json');
console.log('inactive current-world rows', inactive.length);
