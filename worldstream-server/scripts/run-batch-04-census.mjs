// scripts/run-batch-04-census.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openWorld } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { SCENE_RESERVOIR_BATCHES } from '../src/scene-reservoir-data.mjs';
import { CAST } from '../lab/grammar/cast.mjs';
import { PRACTICES } from '../lab/grammar/practices.mjs';
import { bankDepth, satisfiableRequirements, exportGrammar } from '../lab/studio/grammar-io.mjs';

const START_DATE = '2026-03-02';
const DAYS = 90;
const startMs = atLondon(START_DATE, '00:00');
const targetMs = startMs + DAYS * 86_400_000;
const SEEDS = ['silver-clouds-now-v1', 'seed-beta', 'seed-gamma'];

console.log('====================================================');
console.log('       WORLDSTREAM BATCH 04 INGESTION & CENSUS      ');
console.log('====================================================\n');

// ----------------------------------------------------
// Phase 1: 90-Day × 3-Seed Deterministic Simulation
// ----------------------------------------------------
console.log('--- Phase 1: Running 90-day world across 3 seeds ---');
const seedData = [];

for (const seed of SEEDS) {
  console.log(`Simulating seed ${seed}...`);
  const world = openWorld({ dbPath: ':memory:', startMs, seed });
  world.advance(targetMs);
  const events = world.db.prepare('SELECT seq, occurred_at, semantic_json FROM events ORDER BY seq').all()
    .map(r => ({ seq: r.seq, occurredAt: r.occurred_at, ...JSON.parse(r.semantic_json) }));
  
  seedData.push({ seed, events, world });
  console.log(`  Seed ${seed}: ${events.length} canonical events.`);
}

// ----------------------------------------------------
// Phase 2: Loading Batch 04 and Prior Batches
// ----------------------------------------------------
console.log('\n--- Phase 2: Loading Batch 04 Source Files ---');
const b04Path = 'C:/Users/chris/Downloads/MEGA_BATCH_04/WORLDSTREAM_CANON_READY_RESERVOIR_BATCH_04.json';
const fut04Path = 'C:/Users/chris/Downloads/MEGA_BATCH_04/WORLDSTREAM_FUTURE_SIMULATION_LIBRARY_BATCH_04.json';
const mg03Path = 'C:/Users/chris/Downloads/MEGA_BATCH_04/WORLDSTREAM_MOMENT_GRAMMAR_BATCH_03.json';

const b04 = JSON.parse(readFileSync(b04Path, 'utf8')).scenes;
const fut04 = JSON.parse(readFileSync(fut04Path, 'utf8')).scenes;
const mg03 = JSON.parse(readFileSync(mg03Path, 'utf8')).units || JSON.parse(readFileSync(mg03Path, 'utf8')).entries;

// Prior batches
const b01 = SCENE_RESERVOIR_BATCHES[0].entries;
const b02 = JSON.parse(readFileSync('data/scene-reservoir-batch-02.json', 'utf8')).entries;
const b03 = JSON.parse(readFileSync('C:/Users/chris/Downloads/WORLDSTREAM_GROUNDED_SCENE_BATCH_03.json', 'utf8')).scenes;
const readyRarePrior = JSON.parse(readFileSync('data/scene-reservoir-ready-rare.json', 'utf8')).entries;
const misboundPrior = JSON.parse(readFileSync('reports/misbound-report.json', 'utf8')).scenes;
const mg02 = JSON.parse(readFileSync('data/moment-grammar-batch-02-staged.json', 'utf8')).entries;
const futPrior = JSON.parse(readFileSync('data/future-simulation-library.json', 'utf8')).scenes;

console.log(`Loaded Batch 04 Current Candidates: ${b04.length}`);
console.log(`Loaded Batch 04 Future Candidates:  ${fut04.length}`);
console.log(`Loaded Moment Grammar Batch 03:     ${mg03.length}`);

// Opportunity counter helper
function countOpportunities(scene, seedEvents, remap = null) {
  let count = 0;
  const rawTriggers = remap?.newTrigger || scene.triggerCandidates || (scene.triggerFamily || scene.trigger_family || '').split('|').map(t => t.trim()).filter(Boolean);
  const triggers = Array.isArray(rawTriggers) ? rawTriggers : [rawTriggers];
  const rawLocs = remap?.newLoc ? [remap.newLoc] : (scene.locations || (scene.location ? (Array.isArray(scene.location) ? scene.location : [scene.location]) : []));

  for (const ev of seedEvents) {
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
    if (!typeMatch) continue;

    if (rawLocs.length > 0 && ev.location) {
      const locMatch = rawLocs.some(l => {
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
      if (!locMatch) continue;
    }

    count++;
  }
  return count;
}

// ----------------------------------------------------
// Phase 3: Classifying Batch 04 Current Scenes (500)
// ----------------------------------------------------
console.log('\n--- Phase 3: Classifying Batch 04 Current-World Candidates (500) ---');

const b04Classified = [];
const sanctuaryRemap = {
  oldTrigger: 'SANCTUARY_VISIT|VENUE_SCENE|QUIET_TIME_BEGIN|LEGION_PERFORMANCE',
  oldLoc: 'sanctuary/central_hub|portal_halls|balcony|nightclub',
  newTrigger: 'TRAVEL_ARRIVE|MUSIC_LISTEN_BEGIN|ACTIVITY_COMPLETE',
  newLoc: 'sanctuary/central_hub',
  reason: 'Sanctuary visit conceptual triggers bind to actual committed events TRAVEL_ARRIVE, MUSIC_LISTEN_BEGIN, and ACTIVITY_COMPLETE at sanctuary/central_hub.'
};

for (const sc of b04) {
  let classification = 'READY';
  let reason = '';
  let remap = null;

  // 1. Canon check: Balthazar requires Anarchy
  if (sc.cast && sc.cast.includes('balthazar') && !sc.cast.includes('anarchy')) {
    classification = 'CANON_FIX';
    reason = 'Balthazar requires Anarchy co-presence; soul-bonded demon cannot appear independently.';
  }
  // 2. Canon check: Zara as MI6 staff
  else if (sc.cast && sc.cast.includes('zara')) {
    classification = 'CANON_FIX';
    reason = 'Zara is a Duskkin warrior in Duskkin territory, not an MI6 staff member.';
  }
  // 3. Canon check: Davis pre-disclosure
  else if (sc.family === 'davis_pre_disclosure' && /trust issues|teeth.*learning|traitor|mole|betrayal|unmasked/i.test(sc.prose)) {
    classification = 'PHASE_BLOCKED';
    reason = 'Davis/Ashai acute suspicion and mask slip requires post-disclosure relationship phase.';
  }
  // 4. Misbound: Sanctuary visit triggers
  else if (sc.family === 'sanctuary_unlocked') {
    classification = 'MISBOUND';
    remap = sanctuaryRemap;
    reason = sanctuaryRemap.reason;
  }
  // 5. Reachability check
  else {
    let oppTotal = 0;
    for (const s of seedData) {
      oppTotal += countOpportunities(sc, s.events);
    }
    const oppAvg = oppTotal / seedData.length;

    if (sc.family === 'nimbus_reusable') {
      classification = 'RARE';
      reason = `Requires Nimbus unlocked via scene-bank P1 completion; average ${oppAvg.toFixed(1)} occurrences per 90 days.`;
    } else if (oppTotal === 0) {
      classification = 'IMPOSSIBLE_CONJUNCTION';
      reason = 'Required trigger, location, and cast conjunction did not occur in the 90-day simulation.';
    } else if (oppAvg < 3) {
      classification = 'RARE';
      reason = `Valid opportunity profile, but rare occurrence (average ${oppAvg.toFixed(1)} occurrences per 90 days).`;
    } else {
      classification = 'READY';
      reason = `Current simulation genuinely creates matching opportunities (${oppAvg.toFixed(1)} avg occurrences per 90 days).`;
    }
  }

  b04Classified.push({ ...sc, batch: 'batch_04', classification, reason, remap });
}

// ----------------------------------------------------
// Phase 4: Classifying Future Simulation Candidates (200)
// ----------------------------------------------------
console.log('\n--- Phase 4: Classifying Batch 04 Future Candidates (200) ---');
const fut04Classified = [];
for (const sc of fut04) {
  fut04Classified.push({
    ...sc,
    batch: 'batch_04',
    classification: 'FUTURE_SIMULATION',
    reason: `Family ${sc.family} represents future world premise without an existing deterministic simulation generator.`
  });
}

// ----------------------------------------------------
// Phase 5: Auditing Moment Grammar Batch 03 (450)
// ----------------------------------------------------
console.log('\n--- Phase 5: Auditing Moment Grammar Batch 03 (450 units) ---');

const VALID_SURFACES = {
  'ashai:go_around': 'go_around',
  'ashai:wait_it_out': 'wait_it_out',
  'goaden:wait_it_out': 'wait_it_out',
  'goaden:keep_distance': 'keep_distance',
  'emily:count_pattern': 'count_pattern',
  'emily:fade_bypass': 'fade_bypass',
  'yukon:retry_immediately': 'retry_immediately',
  'yukon:elaborate_excuse': 'elaborate_excuse',
  'yukon:victory_lap': 'victory_lap'
};

const mg03Classified = [];
const seenGrammarLines = new Set();
// Add existing grammar lines
for (const g of mg02) seenGrammarLines.add(g.line.trim().toLowerCase());

let mg03ExactDuplicates = 0;
let mg03Violations = 0;

for (const g of mg03) {
  const key = `${g.character}:${g.surface}`;
  const mappedSurface = VALID_SURFACES[key];
  const violations = [];

  if (!mappedSurface) {
    violations.push(`Surface ${g.surface} does not map to an existing semantic action for character ${g.character}`);
  }
  if (/\b(because|since|as a result)\b/i.test(g.line)) {
    violations.push('introduces cause');
  }
  if (/\b\d+\s*(minutes|hours|days|seconds)\b/i.test(g.line)) {
    violations.push('introduces duration');
  }

  const norm = g.line.trim().toLowerCase();
  const isDuplicate = seenGrammarLines.has(norm);
  if (isDuplicate) mg03ExactDuplicates++;
  seenGrammarLines.add(norm);

  if (violations.length > 0) mg03Violations++;

  mg03Classified.push({
    id: g.id,
    character: g.character,
    surface: mappedSurface || g.surface,
    originalSurface: g.surface,
    line: g.line,
    provenance: g.provenance || 'greah_suggested_author_reviewed',
    notes: g.notes,
    isDuplicate,
    valid: violations.length === 0,
    violations
  });
}

console.log(`Moment Grammar Batch 03: ${mg03Classified.length} units.`);
console.log(`  Valid: ${mg03Classified.filter(g => g.valid).length}`);
console.log(`  Violations: ${mg03Violations}`);
console.log(`  Duplicate lines across batches: ${mg03ExactDuplicates}`);

// ----------------------------------------------------
// Phase 6: Moment Grammar Effective Depth
// ----------------------------------------------------
console.log('\n--- Phase 6: Calculating Grammar Effective Depth Before and After ---');
const depthBefore = bankDepth({ satisfiable: satisfiableRequirements() });

// Clone grammar and add valid quips from MG02 and MG03
const currentGrammar = exportGrammar();
// Add MG02
for (const g of mg02) {
  if (!g.valid) continue;
  const char = currentGrammar.characters[g.character];
  if (!char) continue;
  char.quips[g.surface] ??= [];
  char.quips[g.surface].push({
    text: g.line,
    requires: [],
    signature: false,
    filler: false,
    meaning: null
  });
}
// Add MG03 (deduped)
const addedTexts = new Set();
for (const g of mg03Classified) {
  if (!g.valid) continue;
  const norm = g.line.trim().toLowerCase();
  if (addedTexts.has(norm)) continue;
  addedTexts.add(norm);

  const char = currentGrammar.characters[g.character];
  if (!char) continue;
  char.quips[g.surface] ??= [];
  char.quips[g.surface].push({
    text: g.line,
    requires: [],
    signature: false,
    filler: false,
    meaning: null
  });
}

const depthAfter = [];
for (const [id, char] of Object.entries(currentGrammar.characters)) {
  for (const [surface, bank] of Object.entries(char.quips)) {
    const usable = bank.filter(entry => !entry.filler);
    depthAfter.push({
      character: id,
      surface,
      authored: bank.length,
      effectiveDepth: usable.length
    });
  }
}
depthAfter.sort((a, b) => a.character.localeCompare(b.character) || a.surface.localeCompare(b.surface));

// Calculate depth metrics
const totalDepthBefore = depthBefore.reduce((sum, d) => sum + d.effectiveDepth, 0);
const totalDepthAfter = depthAfter.reduce((sum, d) => sum + d.effectiveDepth, 0);
console.log(`Total Moment Grammar Effective Depth: ${totalDepthBefore} -> ${totalDepthAfter} (+${totalDepthAfter - totalDepthBefore} lines, +${((totalDepthAfter / totalDepthBefore - 1) * 100).toFixed(1)}%)`);

// ----------------------------------------------------
// Phase 7: Summarize Census Classifications
// ----------------------------------------------------
console.log('\n--- Phase 7: Census Summary ---');

function countClassifications(list) {
  const c = {};
  for (const item of list) c[item.classification] = (c[item.classification] || 0) + 1;
  return c;
}

const b04CurrentCounts = countClassifications(b04Classified);
const b04FutureCounts = countClassifications(fut04Classified);
console.log('Batch 04 Current-World (500):', b04CurrentCounts);
console.log('Batch 04 Future Candidates (200):', b04FutureCounts);

// ----------------------------------------------------
// Phase 8: Output Staged Datasets and Reports
// ----------------------------------------------------
console.log('\n--- Phase 8: Writing Output Files and Reports ---');
mkdirSync('reports', { recursive: true });
mkdirSync('data', { recursive: true });

// 1. Updated Staged READY + RARE Dataset (combines B01-B03 + B04)
const readyRareB4 = b04Classified.filter(s => s.classification === 'READY' || s.classification === 'RARE');
const updatedReadyRare = {
  batch_id: 'worldstream-staged-ready-rare-v2',
  title: 'Worldstream Staged Active Reservoir Candidates (Batches 01–04)',
  status: 'staged',
  count: readyRarePrior.length + readyRareB4.length,
  counts_by_batch: {
    batch_01: readyRarePrior.filter(e => e.origin === 'batch_01').length,
    batch_02: readyRarePrior.filter(e => e.origin === 'batch_02').length,
    batch_03: readyRarePrior.filter(e => e.origin === 'batch_03').length,
    batch_04: readyRareB4.length
  },
  entries: [
    ...readyRarePrior,
    ...readyRareB4.map(e => ({ origin: 'batch_04', ...e }))
  ]
};
writeFileSync('data/scene-reservoir-ready-rare.json', JSON.stringify(updatedReadyRare, null, 2) + '\n');
console.log(`Updated data/scene-reservoir-ready-rare.json (${updatedReadyRare.count} total scenes: ${JSON.stringify(updatedReadyRare.counts_by_batch)})`);

// 2. Updated MISBOUND Report & Staged Pool
const misboundB4 = b04Classified.filter(s => s.classification === 'MISBOUND');
const updatedMisbound = {
  count: misboundPrior.length + misboundB4.length,
  counts_by_batch: {
    batch_01_03: misboundPrior.length,
    batch_04: misboundB4.length
  },
  scenes: [
    ...misboundPrior,
    ...misboundB4.map(s => ({
      batch: 'batch_04',
      id: s.id,
      family: s.family,
      remap: s.remap,
      prose: s.prose,
      reason: s.reason
    }))
  ]
};
writeFileSync('reports/misbound-report.json', JSON.stringify(updatedMisbound, null, 2) + '\n');
console.log(`Updated reports/misbound-report.json (${updatedMisbound.count} misbound scenes documented with remapped gates)`);

// 3. Staged Future Simulation Library (isolated in data/)
const updatedFutureSim = {
  batch_id: 'worldstream-future-simulation-library-v2',
  title: 'Worldstream Future Simulation Vocabulary Library (Batches 03–04)',
  status: 'staged_isolated',
  count: futPrior.length + fut04Classified.length,
  counts_by_batch: {
    batch_03: futPrior.length,
    batch_04: fut04Classified.length
  },
  notes: [
    'Authored prose vocabulary strictly quarantined until deterministic world logic generators exist.',
    'Prose never activates an incident; world systems must precede prose selection.'
  ],
  scenes: [
    ...futPrior,
    ...fut04Classified
  ]
};
writeFileSync('data/future-simulation-library.json', JSON.stringify(updatedFutureSim, null, 2) + '\n');
console.log(`Updated data/future-simulation-library.json (${updatedFutureSim.count} quarantined future scenes)`);

// 4. Staged Moment Grammar Batch 03
const stagedGrammarB3 = {
  batch_id: 'moment-grammar-batch-03-staged',
  status: 'staged',
  count: mg03Classified.length,
  valid_count: mg03Classified.filter(g => g.valid).length,
  entries: mg03Classified.map(g => ({
    id: g.id,
    character: g.character,
    surface: g.surface,
    original_surface: g.originalSurface,
    line: g.line,
    provenance: g.provenance,
    notes: g.notes,
    valid: g.valid
  }))
};
writeFileSync('data/moment-grammar-batch-03-staged.json', JSON.stringify(stagedGrammarB3, null, 2) + '\n');
console.log(`Wrote data/moment-grammar-batch-03-staged.json (${stagedGrammarB3.count} lines)`);

// 5. Batch 04 Census Report
const batch04Report = {
  batchId: 'worldstream-batch-04-census',
  status: 'completed',
  counts: {
    currentCandidates: b04.length,
    futureCandidates: fut04.length,
    grammarUnits: mg03.length,
    totalUnits: b04.length + fut04.length + mg03.length
  },
  classifications: {
    currentWorld: b04CurrentCounts,
    futureLibrary: b04FutureCounts,
    grammar: {
      total: mg03Classified.length,
      valid: mg03Classified.filter(g => g.valid).length,
      violations: mg03Violations,
      duplicatesWithPrior: mg03ExactDuplicates
    }
  },
  grammarDepth: {
    before: totalDepthBefore,
    after: totalDepthAfter,
    netGain: totalDepthAfter - totalDepthBefore,
    gainPercent: `+${((totalDepthAfter / totalDepthBefore - 1) * 100).toFixed(1)}%`
  }
};
writeFileSync('reports/batch-04-census-report.json', JSON.stringify(batch04Report, null, 2) + '\n');
console.log('Wrote reports/batch-04-census-report.json');

console.log('\n--- Batch 04 Ingestion & Census Completed Successfully ---');
