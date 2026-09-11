// scripts/census-audit.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openWorld } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { normalizeReservoirBatch, reservoirSceneEligible } from '../src/scene-reservoir-catalog.mjs';
import { CAST } from '../lab/grammar/cast.mjs';
import { PRACTICES } from '../lab/grammar/practices.mjs';

console.log('--- Loading authoring assets ---');

// 1. Load Batch 01
const batch01 = SCENE_RESERVOIR_BATCHES[0];
console.log(`Loaded Batch 01: ${batch01.entries.length} entries.`);

// 2. Load Batch 02
const batch02Path = resolve('data/scene-reservoir-batch-02.json');
const batch02 = JSON.parse(readFileSync(batch02Path, 'utf8'));
console.log(`Loaded Batch 02: ${batch02.entries.length} entries.`);

// 3. Load Batch 03
const batch03Path = 'C:/Users/chris/Downloads/WORLDSTREAM_GROUNDED_SCENE_BATCH_03.json';
const batch03 = JSON.parse(readFileSync(batch03Path, 'utf8'));
console.log(`Loaded Batch 03: ${batch03.scenes.length} candidate scenes.`);

// 4. Load Moment Grammar Batch 02
const grammarBatch02Path = 'C:/Users/chris/Downloads/WORLDSTREAM_MOMENT_GRAMMAR_BATCH_02.json';
const grammarBatch02 = JSON.parse(readFileSync(grammarBatch02Path, 'utf8'));
console.log(`Loaded Moment Grammar Batch 02: ${grammarBatch02.entries.length} entries.`);

// Inspect Batch 03 families
const b3Families = {};
for (const s of batch03.scenes) {
  b3Families[s.family] = (b3Families[s.family] || 0) + 1;
}
console.log('Batch 03 families:', b3Families);

// Run 90-day simulation across 3 seeds to collect simulation opportunities
const SEEDS = ['silver-clouds-now-v1', 'seed-beta', 'seed-gamma'];
const DAYS = 90;
const START_DATE = '2026-03-02';
const startMs = atLondon(START_DATE, '00:00');
const targetMs = startMs + DAYS * 86_400_000;

console.log(`--- Running 90-day simulation across 3 seeds ---`);
const allRuns = [];
for (const seed of SEEDS) {
  console.log(`Simulating seed: ${seed}...`);
  const world = openWorld({ dbPath: ':memory:', startMs, seed });
  world.advance(targetMs);
  const events = world.db.prepare('SELECT seq, semantic_json FROM events ORDER BY seq').all()
    .map(r => ({ seq: r.seq, ...JSON.parse(r.semantic_json) }));
  console.log(`  Seed ${seed} produced ${events.length} events.`);
  allRuns.push({ seed, events, world });
}

console.log('Simulation runs complete.');
