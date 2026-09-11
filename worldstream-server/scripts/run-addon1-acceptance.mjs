import { writeFileSync } from 'node:fs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { knowsFact } from '../src/fixture.mjs';
import { MEU_FAMILIES, MEU_OUTCOMES } from '../src/meu-cases.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEEDS = ['silver-clouds-now-v1', 'seed-beta', 'seed-gamma'];
const PERMITTED_OUTCOMES = new Set(MEU_OUTCOMES);
const PERMITTED_FAMILIES = new Set(MEU_FAMILIES);

async function runSimulation(seed, days) {
  const endMs = START + days * 24 * 3600_000;
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed });
  world.advance(endMs);
  const snap = world.semanticSnapshot();
  const digest = semanticDigest(snap);
  world.close();
  return { snap, digest, days, seed };
}

async function verifyDeterminismChunked(seed, days) {
  const endMs = START + days * 24 * 3600_000;
  // One-shot
  const w1 = openWorld({ dbPath: ':memory:', startMs: START, seed });
  w1.advance(endMs);
  const d1 = semanticDigest(w1.semanticSnapshot());
  w1.close();

  // Chunked day-by-day
  const w2 = openWorld({ dbPath: ':memory:', startMs: START, seed });
  for (let d = 1; d <= days; d++) {
    w2.advance(START + d * 24 * 3600_000);
  }
  const d2 = semanticDigest(w2.semanticSnapshot());
  w2.close();

  return { matched: d1 === d2, digest: d1 };
}

function analyzeCases(snap, days) {
  const events = snap.events;
  const opened = events.filter(e => e.type === 'MEU_CASE_OPEN');
  const inspected = events.filter(e => e.type === 'MEU_CASE_INSPECT');
  const reported = events.filter(e => e.type === 'MEU_CASE_REPORT');
  const escalated = events.filter(e => e.type === 'MEU_CASE_ESCALATE');
  const resolved = events.filter(e => e.type === 'MEU_CASE_RESOLVE');
  const closed = events.filter(e => e.type === 'MEU_CASE_CLOSE');
  const reportReads = events.filter(e => e.type === 'MEU_REPORT_READ');

  const outcomes = {};
  for (const r of resolved) {
    const out = r.payload?.outcome;
    if (!PERMITTED_OUTCOMES.has(out)) {
      throw new Error(`Forbidden outcome: ${out} in event ${r.id}`);
    }
    outcomes[out] = (outcomes[out] || 0) + 1;
  }

  const families = {};
  for (const o of opened) {
    const fam = o.payload?.family;
    if (!PERMITTED_FAMILIES.has(fam)) {
      throw new Error(`Forbidden case family: ${fam} in event ${o.id}`);
    }
    families[fam] = (families[fam] || 0) + 1;
  }

  // Verify Zero Prose in Case State and Events
  for (const e of events) {
    if (e.type.startsWith('MEU_CASE_')) {
      if (e.description || e.prose) {
        throw new Error(`Prose found in MEU event ${e.id}: ${e.description || e.prose}`);
      }
      if (e.payload?.prose || e.payload?.narrative || e.payload?.text) {
        throw new Error(`Prose found in MEU event payload ${e.id}`);
      }
    }
  }
  const meuState = snap.meuCases;
  if (meuState.activeCase) {
    if (meuState.activeCase.prose || meuState.activeCase.narrative || meuState.activeCase.notes) {
      throw new Error(`Prose found in active case state ${meuState.activeCase.id}`);
    }
    if (meuState.activeCase.owner !== 'meu') {
      throw new Error(`Expected case owner to be 'meu', found ${meuState.activeCase.owner}`);
    }
    if (meuState.activeCase.participants && meuState.activeCase.participants.length > 0) {
      throw new Error(`activeCase.participants must be empty, found ${JSON.stringify(meuState.activeCase.participants)}`);
    }
  }

  // Verify Knowledge Isolation:
  // Goaden and Ashai should ONLY know meu case facts if a MEU_REPORT_READ event exists
  const readCaseIds = new Set(reportReads.map(e => e.payload?.caseId));
  for (const r of reported) {
    const caseId = r.payload?.caseId;
    const factKey = r.payload?.factKey;
    if (!readCaseIds.has(caseId) && factKey) {
      if (knowsFact(snap.characters.goaden, factKey, snap.world.resolvedThrough)
        || knowsFact(snap.characters.ashai, factKey, snap.world.resolvedThrough)) {
        throw new Error(`Knowledge leak! Goaden/Ashai knows ${factKey} without MEU_REPORT_READ`);
      }
    }
  }

  const weeks = days / 7;
  const casesPerWeek = (opened.length / weeks).toFixed(2);

  // Life balance counts
  const meals = events.filter(e => e.type === 'MEAL_BEGIN').length;
  const practices = events.filter(e => e.type === 'PRACTICE_BEGIN').length;
  const sanctuary = events.filter(e => e.type === 'VENUE_SCENE' && e.location === 'sanctuary').length;
  const legion = events.filter(e => e.type === 'LEGION_VISIT').length;

  return {
    opened: opened.length,
    inspected: inspected.length,
    reported: reported.length,
    escalated: escalated.length,
    resolved: resolved.length,
    closed: closed.length,
    reportReads: reportReads.length,
    casesPerWeek: Number(casesPerWeek),
    outcomes,
    families,
    lifeBalance: { meals, practices, sanctuary, legion }
  };
}

async function main() {
  console.log('================================================================');
  console.log('      WORLDSTREAM ADDON 1: MEU CASES ACCEPTANCE HARNESS         ');
  console.log('================================================================\n');

  const report = {
    generatedAt: new Date().toISOString(),
    determinism: {},
    thirtyDays: {},
    ninetyDays: {},
  };

  console.log('--- 1. Determinism Verification (One-shot vs Chunked, 30 Days) ---');
  for (const seed of SEEDS) {
    const { matched, digest } = await verifyDeterminismChunked(seed, 30);
    console.log(`Seed: ${seed.padEnd(22)} | Chunked Match: ${matched ? 'PASS' : 'FAIL'} | Digest: ${digest}`);
    if (!matched) throw new Error(`Determinism failure on seed ${seed}`);
    report.determinism[seed] = { matched, digest };
  }

  console.log('\n--- 2. 30-Day Simulation Census (3 Seeds) ---');
  for (const seed of SEEDS) {
    const { snap, digest } = await runSimulation(seed, 30);
    const stats = analyzeCases(snap, 30);
    console.log(`\nSeed: ${seed} (30 days)`);
    console.log(`  Digest: ${digest}`);
    console.log(`  Cases Opened: ${stats.opened} (${stats.casesPerWeek}/week) | Resolved: ${stats.resolved} | Closed: ${stats.closed}`);
    console.log(`  Families:`, stats.families);
    console.log(`  Outcomes:`, stats.outcomes);
    console.log(`  Report Reads: ${stats.reportReads}`);
    console.log(`  Life Balance: Meals: ${stats.lifeBalance.meals}, Practices: ${stats.lifeBalance.practices}, Sanctuary: ${stats.lifeBalance.sanctuary}, Legion: ${stats.lifeBalance.legion}`);

    // Rate check (diagnostic range: 1–3 cases/week)
    if (stats.casesPerWeek < 0.5 || stats.casesPerWeek > 3.5) {
      console.warn(`  [WARN] Case rate ${stats.casesPerWeek}/wk outside expected diagnostic range (1-3/wk)`);
    }

    report.thirtyDays[seed] = { digest, stats };
  }

  console.log('\n--- 3. 90-Day Simulation Census (3 Seeds) ---');
  for (const seed of SEEDS) {
    const { snap, digest } = await runSimulation(seed, 90);
    const stats = analyzeCases(snap, 90);
    console.log(`\nSeed: ${seed} (90 days)`);
    console.log(`  Digest: ${digest}`);
    console.log(`  Cases Opened: ${stats.opened} (${stats.casesPerWeek}/week) | Resolved: ${stats.resolved} | Closed: ${stats.closed}`);
    console.log(`  Families:`, stats.families);
    console.log(`  Outcomes:`, stats.outcomes);
    console.log(`  Report Reads: ${stats.reportReads}`);
    console.log(`  Life Balance: Meals: ${stats.lifeBalance.meals}, Practices: ${stats.lifeBalance.practices}, Sanctuary: ${stats.lifeBalance.sanctuary}, Legion: ${stats.lifeBalance.legion}`);

    // Verify bounded persistence in 90-day state
    const meuState = snap.meuCases;
    if (meuState.closedSummaries.length > 24) throw new Error('closedSummaries exceeded 24');
    if (Object.keys(meuState.issued).length > 128) throw new Error('issued actions exceeded 128');

    report.ninetyDays[seed] = { digest, stats };
  }

  writeFileSync('reports/addon1-acceptance.json', JSON.stringify(report, null, 2));
  console.log('\nWrote reports/addon1-acceptance.json');

  console.log('\n================================================================');
  console.log('              ACCEPTANCE VERIFICATION COMPLETE                   ');
  console.log('================================================================');
}

main().catch(err => {
  console.error('Acceptance harness error:', err);
  process.exit(1);
});
