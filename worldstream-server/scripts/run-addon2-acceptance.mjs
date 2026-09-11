import { writeFileSync, mkdirSync } from 'node:fs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import {
  LEGION_JOB_FAMILIES,
  LEGION_JOB_OUTCOMES,
  LEGION_JOB_EVENT_TYPES
} from '../src/legion-jobs.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEEDS = ['silver-clouds-now-v1', 'seed-beta', 'seed-gamma'];
const PERMITTED_OUTCOMES = new Set(LEGION_JOB_OUTCOMES);
const PERMITTED_FAMILIES = new Set(LEGION_JOB_FAMILIES);

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

function analyzeLegionJobs(snap, days) {
  const events = snap.events;
  const offers = events.filter(e => e.type === 'LEGION_JOB_OFFER');
  const accepts = events.filter(e => e.type === 'LEGION_JOB_ACCEPT');
  const declines = events.filter(e => e.type === 'LEGION_JOB_DECLINE');
  const starts = events.filter(e => e.type === 'LEGION_JOB_START');
  const reports = events.filter(e => e.type === 'LEGION_JOB_REPORT');
  const resolves = events.filter(e => e.type === 'LEGION_JOB_RESOLVE');
  const payments = events.filter(e => e.type === 'LEGION_JOB_PAYMENT');
  const closes = events.filter(e => e.type === 'LEGION_JOB_CLOSE');

  // Verify spacing (>=24h between starts)
  for (let i = 1; i < starts.length; i++) {
    const gapMs = starts[i].occurredAt - starts[i - 1].occurredAt;
    if (gapMs < 24 * 3600_000) {
      throw new Error(`Spacing violation: only ${gapMs / 3600_000}h between job starts`);
    }
  }

  // Outcomes census
  const outcomes = {};
  for (const r of resolves) {
    const out = r.payload?.outcome;
    if (!PERMITTED_OUTCOMES.has(out)) {
      throw new Error(`Forbidden outcome: ${out} in event ${r.id}`);
    }
    outcomes[out] = (outcomes[out] || 0) + 1;
  }

  // Families census
  const families = {};
  for (const o of offers) {
    const fam = o.payload?.family;
    if (!PERMITTED_FAMILIES.has(fam)) {
      throw new Error(`Forbidden job family: ${fam} in event ${o.id}`);
    }
    families[fam] = (families[fam] || 0) + 1;
  }

  // Zero prose in event payloads and state
  for (const e of events) {
    if (e.type.startsWith('LEGION_JOB_')) {
      if (e.prose || e.description) {
        throw new Error(`Prose found in event ${e.id}`);
      }
      if (e.payload?.prose || e.payload?.narrative || e.payload?.text) {
        throw new Error(`Prose found in payload of ${e.id}`);
      }
      // Rule 5: Balthazar requires Anarchy
      if (e.participants?.includes('balthazar') && !e.participants?.includes('anarchy')) {
        throw new Error(`Balthazar invariant violated in event ${e.id}`);
      }
    }
  }

  const legionState = snap.legionJobs;
  if (legionState) {
    if (legionState.closedSummaries.length > 24) {
      throw new Error(`closedSummaries limit exceeded: ${legionState.closedSummaries.length}`);
    }
    if (Object.keys(legionState.issued).length > 128) {
      throw new Error(`issued limit exceeded: ${Object.keys(legionState.issued).length}`);
    }
    for (const summary of legionState.closedSummaries) {
      if (summary.prose || summary.text) throw new Error('Prose in closed summary');
    }
  }

  const weeks = days / 7;
  const jobsPerWeek = (starts.length / weeks).toFixed(2);

  // Life balance counts
  const meals = events.filter(e => e.type === 'MEAL_BEGIN').length;
  const practices = events.filter(e => e.type === 'PRACTICE_BEGIN').length;
  const sanctuary = events.filter(e => e.type === 'VENUE_SCENE' && e.location === 'sanctuary').length;
  const legionVisits = events.filter(e => e.type === 'LEGION_VISIT' && e.visibility === 'public').length;

  return {
    offers: offers.length,
    accepts: accepts.length,
    declines: declines.length,
    starts: starts.length,
    reports: reports.length,
    resolves: resolves.length,
    payments: payments.length,
    closes: closes.length,
    jobsPerWeek: Number(jobsPerWeek),
    outcomes,
    families,
    lifeBalance: { meals, practices, sanctuary, legionVisits }
  };
}

async function main() {
  console.log('================================================================');
  console.log('    WORLDSTREAM ADDON 2: DEMON’S LEGION JOBS ACCEPTANCE         ');
  console.log('================================================================\n');

  try { mkdirSync('reports', { recursive: true }); } catch {}

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
    const stats = analyzeLegionJobs(snap, 30);
    console.log(`\nSeed: ${seed} (30 days)`);
    console.log(`  Digest: ${digest}`);
    console.log(`  Jobs Offered: ${stats.offers} | Accepted: ${stats.accepts} | Declined: ${stats.declines}`);
    console.log(`  Jobs Started: ${stats.starts} (${stats.jobsPerWeek}/week) | Resolved: ${stats.resolves} | Paid: ${stats.payments} | Closed: ${stats.closes}`);
    console.log(`  Families:`, stats.families);
    console.log(`  Outcomes:`, stats.outcomes);
    console.log(`  Life Balance: Meals: ${stats.lifeBalance.meals}, Practices: ${stats.lifeBalance.practices}, Sanctuary: ${stats.lifeBalance.sanctuary}, Social Visits: ${stats.lifeBalance.legionVisits}`);

    report.thirtyDays[seed] = { digest, stats };
  }

  console.log('\n--- 3. 90-Day Simulation Census (3 Seeds) ---');
  for (const seed of SEEDS) {
    const { snap, digest } = await runSimulation(seed, 90);
    const stats = analyzeLegionJobs(snap, 90);
    console.log(`\nSeed: ${seed} (90 days)`);
    console.log(`  Digest: ${digest}`);
    console.log(`  Jobs Offered: ${stats.offers} | Accepted: ${stats.accepts} | Declined: ${stats.declines}`);
    console.log(`  Jobs Started: ${stats.starts} (${stats.jobsPerWeek}/week) | Resolved: ${stats.resolves} | Paid: ${stats.payments} | Closed: ${stats.closes}`);
    console.log(`  Families:`, stats.families);
    console.log(`  Outcomes:`, stats.outcomes);
    console.log(`  Life Balance: Meals: ${stats.lifeBalance.meals}, Practices: ${stats.lifeBalance.practices}, Sanctuary: ${stats.lifeBalance.sanctuary}, Social Visits: ${stats.lifeBalance.legionVisits}`);

    report.ninetyDays[seed] = { digest, stats };
  }

  writeFileSync('reports/addon2-acceptance.json', JSON.stringify(report, null, 2));
  console.log('\nWrote reports/addon2-acceptance.json');

  console.log('\n================================================================');
  console.log('          ADDON 2 ACCEPTANCE VERIFICATION COMPLETE              ');
  console.log('================================================================');
}

main().catch(err => {
  console.error('Acceptance harness error:', err);
  process.exit(1);
});
