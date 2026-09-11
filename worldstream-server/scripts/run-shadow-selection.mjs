// scripts/run-shadow-selection.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { SCENE_RESERVOIR_BATCHES } from '../src/scene-reservoir-data.mjs';

const START_DATE = '2026-03-02';
const DAYS = 90;
const startMs = atLondon(START_DATE, '00:00');
const targetMs = startMs + DAYS * 86_400_000;
const SEEDS = ['silver-clouds-now-v1', 'seed-beta', 'seed-gamma'];

console.log('=== Shadow Selection Verification ===');

// 1. Load census datasets
const readyRare = JSON.parse(readFileSync('data/scene-reservoir-ready-rare.json', 'utf8')).entries;
const misbound = JSON.parse(readFileSync('reports/misbound-report.json', 'utf8')).scenes;

console.log(`Loaded ${readyRare.length} READY/RARE entries and ${misbound.length} repaired MISBOUND entries.`);

// 2. Prepare combined admitted candidate pool with repaired gates
const candidatePool = [];

// From readyRare
for (const entry of readyRare) {
  candidatePool.push({
    id: entry.id,
    batch: entry.origin || 'batch_01',
    family: entry.family,
    cast: entry.cast,
    location: entry.locations || entry.location,
    trigger_family: entry.triggerCandidates || entry.trigger_family || entry.triggerFamily,
    prose: entry.prose,
    source: 'ready_rare'
  });
}

// From misbound (repaired)
for (const m of misbound) {
  candidatePool.push({
    id: m.id,
    batch: m.batch,
    family: m.family,
    cast: m.cast,
    location: m.remap?.newLoc ? [m.remap.newLoc] : (m.locations || m.location),
    trigger_family: m.remap?.newTrigger || m.triggerCandidates || m.trigger_family,
    prose: m.prose,
    source: 'repaired_misbound'
  });
}

console.log(`Total admitted candidate pool: ${candidatePool.length} scenes.`);

// 3. Helper to match event against candidate scene
function matchScene(scene, ev) {
  const rawTriggers = scene.trigger_family || '';
  const triggers = Array.isArray(rawTriggers) ? rawTriggers : rawTriggers.split('|').map(t => t.trim()).filter(Boolean);
  const locs = Array.isArray(scene.location) ? scene.location : [scene.location];

  const typeMatch = triggers.some(t => {
    if (t === 'ANY') return true;
    if (t === 'MEAL' && ev.type.startsWith('MEAL')) return true;
    if (t === 'TRAINING' && (ev.type === 'PRACTICE_BEGIN' || ev.type === 'PRACTICE_END')) return true;
    if (t === 'TRAVEL' && (ev.type === 'TRAVEL_DEPART' || ev.type === 'TRAVEL_ARRIVE')) return true;
    if (t === 'PIANO' && ev.type === 'PIANO_BEGIN') return true;
    if (t === 'REST' && ev.type === 'REST_BEGIN') return true;
    if (t === 'QUIET_TIME' && ev.type === 'QUIET_TIME_BEGIN') return true;
    if (t === 'GAME' && (ev.type === 'GAME_BEGIN' || ev.type === 'GAME_PAUSE' || ev.type === 'GAME_RESUME')) return true;
    return ev.type === t;
  });
  if (!typeMatch) return false;

  if (locs.length > 0 && ev.location) {
    const locMatch = locs.some(l => {
      if (!l) return true;
      let [loc, area] = l.split('/');
      if (loc === 'mi6' && (area === 'lunch_hall')) area = 'common_room';
      if (loc === 'mi6' && (area === 'corridor' || area === 'lift' || area === 'security')) area = 'corridors';
      if (loc === 'streamliner' && !area) area = 'transit';
      if (loc === 'big_ben_plaza' && !area) area = 'venue';
      if (loc === 'legion' && area === 'warehouse') { loc = 'legion_hideout'; area = 'venue'; }
      if (loc === 'sanctuary' && area !== 'central_hub') area = 'central_hub';
      if (ev.location !== loc) return false;
      if (area && ev.area && ev.area !== area && ev.area !== 'common_room') return false;
      return true;
    });
    if (!locMatch) return false;
  }
  return true;
}

// 4. Run shadow simulation across 3 seeds
const resultsBySeed = {};
const globalSelections = {};
const baselineDigests = {};

for (const seed of SEEDS) {
  console.log(`\nSimulating shadow selection for seed: ${seed}...`);
  const world = openWorld({ dbPath: ':memory:', startMs, seed });
  world.advance(targetMs);

  const digest = semanticDigest(world.semanticSnapshot());
  baselineDigests[seed] = digest;

  const events = world.db.prepare('SELECT seq, id, semantic_json FROM events ORDER BY seq').all()
    .map(r => ({ seq: r.seq, id: r.id, ...JSON.parse(r.semantic_json) }));

  // Simulate shadow selector with cooldowns
  const cooldowns = new Map(); // id -> lastUsedAt
  const pairCooldowns = new Map(); // pair -> lastUsedAt
  const familyCooldowns = new Map(); // family -> lastUsedAt

  const selectedScenes = [];
  let eligibleOpportunities = 0;

  for (const ev of events) {
    // Find eligible candidates
    const eligible = candidatePool.filter(sc => matchScene(sc, ev));
    if (eligible.length > 0) eligibleOpportunities++;

    // Filter by cooldowns
    const available = eligible.filter(sc => {
      const last = cooldowns.get(sc.id) || 0;
      if (ev.occurredAt - last < 30 * 86_400_000) return false; // 30 day scene cooldown

      const famLast = familyCooldowns.get(sc.family) || 0;
      if (ev.occurredAt - famLast < 36 * 3600_000) return false; // 36 hour family cooldown

      return true;
    });

    if (available.length > 0) {
      // Pick cleanest available candidate (least used, deterministic tie break)
      available.sort((a, b) => {
        const countA = globalSelections[a.id] || 0;
        const countB = globalSelections[b.id] || 0;
        if (countA !== countB) return countA - countB;
        return a.id.localeCompare(b.id);
      });

      const choice = available[0];
      selectedScenes.push({
        eventId: ev.id,
        eventType: ev.type,
        occurredAt: ev.occurredAt,
        sceneId: choice.id,
        family: choice.family,
        prose: choice.prose
      });

      cooldowns.set(choice.id, ev.occurredAt);
      familyCooldowns.set(choice.family, ev.occurredAt);
      globalSelections[choice.id] = (globalSelections[choice.id] || 0) + 1;
    }
  }

  resultsBySeed[seed] = {
    totalEvents: events.length,
    digest,
    eligibleOpportunities,
    selectedCount: selectedScenes.length,
    uniqueScenesSelected: new Set(selectedScenes.map(s => s.sceneId)).size
  };

  console.log(`  Events: ${events.length}`);
  console.log(`  Canonical Digest: ${digest}`);
  console.log(`  Eligible Opportunities: ${eligibleOpportunities}`);
  console.log(`  Shadow Scenes Selected: ${selectedScenes.length}`);
  console.log(`  Unique Scenes Used: ${resultsBySeed[seed].uniqueScenesSelected}`);
}

// 5. Measure repetition statistics
const selectionCounts = Object.values(globalSelections);
const totalSelections = selectionCounts.reduce((a, b) => a + b, 0);
const maxRepeats = Math.max(...selectionCounts, 0);
const distinctScenesUsed = Object.keys(globalSelections).length;

console.log('\n=== Shadow Selection Global Summary ===');
console.log(`Total Candidate Pool: ${candidatePool.length}`);
console.log(`Distinct Scenes Selected Across All 3 Seeds: ${distinctScenesUsed}`);
console.log(`Total Shadow Selections: ${totalSelections}`);
console.log(`Max Repetitions of Any Single Scene (Across 270 Days): ${maxRepeats}`);
console.log('Baseline Digests by Seed:', baselineDigests);

// Save report
writeFileSync('reports/shadow-selection-report.json', JSON.stringify({
  summary: {
    poolSize: candidatePool.length,
    distinctSelected: distinctScenesUsed,
    totalSelections,
    maxRepeats,
    resultsBySeed,
    baselineDigests
  },
  selections: globalSelections
}, null, 2) + '\n');
console.log('\nWrote shadow selection report to reports/shadow-selection-report.json');
