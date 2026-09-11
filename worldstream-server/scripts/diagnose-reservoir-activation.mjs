import { readFileSync, existsSync } from 'node:fs';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { SCENE_RESERVOIR_CATALOG, SCENE_RESERVOIR_IMPORT_REPORT, reservoirSourceHash } from '../src/scene-reservoir-catalog.mjs';

console.log('catalog', SCENE_RESERVOIR_CATALOG.length);
for (const r of SCENE_RESERVOIR_IMPORT_REPORT) {
  console.log(r.batchId, { total: r.total, accepted: r.accepted, staged: r.staged, rejected: r.rejected });
  const buckets = {};
  for (const row of r.rows.filter(x => x.status !== 'accepted')) {
    const key = `${row.status}: ${(row.reason || '').slice(0, 90)}`;
    buckets[key] = (buckets[key] || 0) + 1;
  }
  if (Object.keys(buckets).length) console.log(buckets);
}

const productionIds = new Set(SCENE_RESERVOIR_BATCHES.flatMap(b => b.entries.map(e => e.id)));
const catalogIds = new Set(SCENE_RESERVOIR_CATALOG.map(s => s.reservoir.sourceId));
const b04p = 'C:/Users/chris/Desktop/SilverClouds_Project/WORLDSTREAM_CANON_CONTENT_MEGA_BATCH_04/WORLDSTREAM_CANON_READY_RESERVOIR_BATCH_04.json';
if (existsSync(b04p)) {
  const scenes = JSON.parse(readFileSync(b04p, 'utf8')).scenes;
  const missing = scenes.filter(s => !productionIds.has(s.id));
  const families = {};
  for (const s of missing) families[s.family] = (families[s.family] || 0) + 1;
  console.log('\nBatch 04 file scenes', scenes.length, 'missing from production', missing.length, families);
  console.log('missing sample', missing.slice(0, 8).map(s => s.id));
}

console.log('\nInactive current-world production rows:');
for (const batch of SCENE_RESERVOIR_BATCHES) {
  for (const e of batch.entries) {
    if (catalogIds.has(e.id)) continue;
    const rev = SCENE_RESERVOIR_REVIEWS[e.id];
    console.log(e.id, e.family, rev?.status, (rev?.reason || '').slice(0, 120));
  }
}

console.log('\nlanes', SCENE_RESERVOIR_CATALOG.reduce((m, s) => {
  const lane = s.reservoir.lane || 'lead';
  m[lane] = (m[lane] || 0) + 1; return m;
}, {}));
console.log('no-lead', SCENE_RESERVOIR_CATALOG.filter(s => !['goaden','ashai'].some(id => s.cast.includes(id))).length);
