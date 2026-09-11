import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { editorialEvent } from '../src/editorial.mjs';
import { MEU_FAMILIES, MEU_OUTCOMES } from '../src/meu-cases.mjs';
import { LEGION_JOB_FAMILIES, LEGION_JOB_OUTCOMES } from '../src/legion-jobs.mjs';
import { DUSKKIN_COMPLIANCE_EVENT_TYPES, DUSKKIN_SOURCE_EVENT_TYPE, assertDuskkinCompliance } from '../src/duskkin-compliance.mjs';
import { SCENE_RESERVOIR_CATALOG } from '../src/scene-reservoir-catalog.mjs';
import { SCENE_RESERVOIR_BATCHES } from '../src/scene-reservoir-data.mjs';
import { CAST } from '../lab/grammar/cast.mjs';
import { readProductionPathSpies, resetProductionPathSpies, noteModelCall } from '../src/production-path-spies.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEEDS = ['silver-clouds-now-v1', 'seed-beta', 'seed-gamma'];
const DECLINE_REASONS = new Set([
  'no_viable_roster', 'conflicting_commitment', 'physically_unavailable',
  'unsupported_job_fit', 'source_no_longer_valid',
]);
const PERMITTED_MEU_OUTCOMES = new Set(MEU_OUTCOMES);
const PERMITTED_MEU_FAMILIES = new Set(MEU_FAMILIES);
const PERMITTED_JOB_OUTCOMES = new Set(LEGION_JOB_OUTCOMES);
const PERMITTED_JOB_FAMILIES = new Set(LEGION_JOB_FAMILIES);

function runTo(seed, days, { dbPath = ':memory:', chunkHours = null } = {}) {
  const endMs = START + days * 24 * 3600_000;
  const world = openWorld({ dbPath, startMs: START, seed });
  if (!chunkHours) world.advance(endMs);
  else {
    const step = chunkHours * 3600_000;
    for (let t = START + step; t < endMs; t += step) world.advance(t);
    world.advance(endMs);
  }
  const snap = world.semanticSnapshot();
  const digest = semanticDigest(snap);
  world.close();
  return { snap, digest };
}

function analyze(snap, days) {
  const events = snap.events;
  const meuOpen = events.filter(e => e.type === 'MEU_CASE_OPEN');
  const meuResolved = events.filter(e => e.type === 'MEU_CASE_RESOLVE');
  const referrals = events.filter(e => e.type === 'MI6_LEGION_REFERRAL');
  const offers = events.filter(e => e.type === 'LEGION_JOB_OFFER');
  const accepts = events.filter(e => e.type === 'LEGION_JOB_ACCEPT');
  const declines = events.filter(e => e.type === 'LEGION_JOB_DECLINE');
  const payments = events.filter(e => e.type === 'LEGION_JOB_PAYMENT');
  const closes = events.filter(e => e.type === 'LEGION_JOB_CLOSE');

  const duskkinSources = events.filter(e => e.type === DUSKKIN_SOURCE_EVENT_TYPE);
  const duskkinNotices = events.filter(e => e.type === 'DUSKKIN_COMPLIANCE_NOTICE');
  const duskkinEvidence = events.filter(e => e.type === 'DUSKKIN_COMPLIANCE_EVIDENCE');
  const duskkinTransfers = events.filter(e => e.type === 'DUSKKIN_EVIDENCE_TRANSFER');
  const duskkinNotifies = events.filter(e => e.type === 'DUSKKIN_COUNCIL_NOTIFY');
  const duskkinResponses = events.filter(e => e.type === 'DUSKKIN_COUNCIL_RESPONSE');
  const duskkinContains = events.filter(e => e.type === 'DUSKKIN_PUBLIC_SAFETY_CONTAIN');
  const duskkinCloses = events.filter(e => e.type === 'DUSKKIN_COMPLIANCE_CLOSE');

  for (const r of meuResolved) {
    if (!PERMITTED_MEU_OUTCOMES.has(r.payload?.outcome)) {
      throw new Error(`Forbidden MEU outcome ${r.payload?.outcome}`);
    }
  }
  for (const o of meuOpen) {
    if (!PERMITTED_MEU_FAMILIES.has(o.payload?.family)) {
      throw new Error(`Forbidden MEU family ${o.payload?.family}`);
    }
  }
  for (const o of offers) {
    if (!PERMITTED_JOB_FAMILIES.has(o.payload?.family)) {
      throw new Error(`Forbidden Legion family ${o.payload?.family}`);
    }
  }
  for (const r of events.filter(e => e.type === 'LEGION_JOB_RESOLVE')) {
    if (!PERMITTED_JOB_OUTCOMES.has(r.payload?.outcome)) {
      throw new Error(`Forbidden Legion outcome ${r.payload?.outcome}`);
    }
  }
  for (const d of declines) {
    if (!DECLINE_REASONS.has(d.payload?.reason)) {
      throw new Error(`Decline used an invented reason: ${d.payload?.reason}`);
    }
  }

  // Duskkin Invariants Verification
  assertDuskkinCompliance(snap);

  // Invariant: Zero prose in canonical state or event payloads
  for (const e of events) {
    if (DUSKKIN_COMPLIANCE_EVENT_TYPES.includes(e.type)) {
      if (e.payload?.prose || e.payload?.text || e.payload?.description) {
        throw new Error(`Prose detected in Duskkin event ${e.type} payload`);
      }
      if (e.participants?.includes('duskkin_liaison') || e.payload?.liaisonRole === 'duskkin_liaison') {
        throw new Error('Generic duskkin_liaison placeholder actor detected');
      }
      if (e.participants?.includes('eirik')) {
        throw new Error('Eirik present in London event');
      }
    }
  }

  // Invariant: Bounded compliance collections
  if ((snap.duskkinCompliance?.closedSummaries?.length ?? 0) > 24) {
    throw new Error('Duskkin closedSummaries exceeded 24');
  }
  if (Object.keys(snap.duskkinCompliance?.issued ?? {}).length > 128) {
    throw new Error('Duskkin issued actions exceeded 128');
  }

  const weeks = days / 7;
  return {
    meuOpened: meuOpen.length,
    meuResolved: meuResolved.length,
    meuPerWeek: Number((meuOpen.length / weeks).toFixed(2)),
    referrals: referrals.length,
    offers: offers.length,
    accepts: accepts.length,
    declines: declines.length,
    payments: payments.length,
    closes: closes.length,
    duskkin: {
      sources: duskkinSources.length,
      notices: duskkinNotices.length,
      evidence: duskkinEvidence.length,
      transfers: duskkinTransfers.length,
      notifies: duskkinNotifies.length,
      responses: duskkinResponses.length,
      contains: duskkinContains.length,
      closes: duskkinCloses.length,
    },
    lifeBalance: {
      meals: events.filter(e => e.type === 'MEAL_BEGIN').length,
      practices: events.filter(e => e.type === 'PRACTICE_BEGIN').length,
      sleep: events.filter(e => e.type === 'REST_BEGIN').length,
      travel: events.filter(e => e.type === 'TRAVEL_DEPART').length,
      legionVisits: events.filter(e => e.type === 'LEGION_VISIT' && e.visibility === 'public').length,
    },
  };
}

function proveRestart(seed, days, expectedDigest) {
  const endMs = START + days * 24 * 3600_000;
  const mid = START + Math.floor(days / 2) * 24 * 3600_000;
  const dir = mkdtempSync(join(tmpdir(), 'sc-addon3-restart-'));
  const dbPath = join(dir, 'world.sqlite');
  try {
    const first = openWorld({ dbPath, startMs: START, seed });
    first.advance(mid);
    first.close();
    const resumed = openWorld({ dbPath });
    resumed.advance(endMs);
    const restarted = semanticDigest(resumed.semanticSnapshot());
    resumed.close();
    if (restarted !== expectedDigest) throw new Error(`Restart digest mismatch for ${seed}`);
    return { matched: true, digest: expectedDigest };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function proveObservers(seed, days, expectedDigest) {
  const other = runTo(seed, days, { chunkHours: 6 });
  if (other.digest !== expectedDigest) {
    throw new Error(`Observer schedule changed history for ${seed}`);
  }
  return { matched: true, digest: expectedDigest };
}

function proveProseIdentity(snap) {
  const before = JSON.stringify(snap.events.filter(e => DUSKKIN_COMPLIANCE_EVENT_TYPES.includes(e.type)));
  for (const event of snap.events) editorialEvent(event);
  const after = JSON.stringify(snap.events.filter(e => DUSKKIN_COMPLIANCE_EVENT_TYPES.includes(e.type)));
  if (before !== after) throw new Error('Editorial prose changed canonical Duskkin history');
}

function measureReservoirGoldens() {
  const catalogIds = new Set(SCENE_RESERVOIR_CATALOG.map(s => s.reservoir.sourceId));
  const inactiveProduction = SCENE_RESERVOIR_BATCHES.flatMap(b => b.entries).filter(e => !catalogIds.has(e.id)).length;
  const quips = [...CAST.values()].reduce((n, g) => n + Object.values(g.quips ?? {}).reduce((m, bank) => m + bank.length, 0), 0);
  const futurePath = resolve(dirname(fileURLToPath(import.meta.url)),
    '../../../../WORLDSTREAM_CANON_CONTENT_MEGA_BATCH_04/WORLDSTREAM_FUTURE_SIMULATION_LIBRARY_BATCH_04.json');
  let futureInactive = 0;
  let futureDuskkin = 0;
  if (existsSync(futurePath)) {
    const library = JSON.parse(readFileSync(futurePath, 'utf8'));
    futureInactive = library.scenes.length;
    futureDuskkin = library.scenes.filter(s => String(s.id).startsWith('future.duskkin.')).length;
    for (const scene of library.scenes) {
      if (catalogIds.has(scene.id)) throw new Error(`Future simulation scene ${scene.id} leaked into the active catalog`);
      if (scene.status !== 'staged_future') throw new Error(`Future scene ${scene.id} is not staged_future`);
    }
  }
  if (SCENE_RESERVOIR_CATALOG.some(s => String(s.reservoir.sourceId).startsWith('future.duskkin.'))) {
    throw new Error('future.duskkin prose leaked into the active catalog');
  }
  if (SCENE_RESERVOIR_CATALOG.some(s => s.reservoir.family === 'duskkin_compliance')) {
    throw new Error('duskkin_compliance family leaked into the active catalog');
  }
  return {
    activeScenes: SCENE_RESERVOIR_CATALOG.length,
    activeQuips: quips,
    inactiveProduction,
    futureInactive,
    futureDuskkin,
  };
}

const ADDON1_2_GOLDENS = {
  thirtyDays: {
    'silver-clouds-now-v1': { meuOpened: 6, meals: 178, practices: 78, legionVisits: 2 },
    'seed-beta': { meuOpened: 6, meals: 178, practices: 81, legionVisits: 3 },
    'seed-gamma': { meuOpened: 7, meals: 177, practices: 79, legionVisits: 1 },
  },
  ninetyDays: {
    'silver-clouds-now-v1': { meuOpened: 18, meals: 534, practices: 237, legionVisits: 6 },
    'seed-beta': { meuOpened: 20, meals: 533, practices: 236, legionVisits: 7 },
    'seed-gamma': { meuOpened: 14, meals: 534, practices: 236, legionVisits: 4 },
  },
};

function assertAddonCadence(seed, days, stats) {
  const expected = days === 30 ? ADDON1_2_GOLDENS.thirtyDays[seed] : ADDON1_2_GOLDENS.ninetyDays[seed];
  if (stats.meuOpened !== expected.meuOpened) {
    throw new Error(`${seed} ${days}d Addon 1 MEU cadence changed: ${stats.meuOpened} !== ${expected.meuOpened}`);
  }
  if (stats.lifeBalance.meals !== expected.meals || stats.lifeBalance.practices !== expected.practices
    || stats.lifeBalance.legionVisits !== expected.legionVisits) {
    throw new Error(`${seed} ${days}d Addon 2 / ordinary cadence changed`);
  }
  if (stats.duskkin.sources !== 0 || stats.duskkin.notices !== 0) {
    throw new Error(`${seed} ${days}d manufactured Duskkin volume; expected 0`);
  }
}

async function main() {
  resetProductionPathSpies();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    noteModelCall();
    throw new Error(`Acceptance requested a model/network call: ${String(args[0])}`);
  };

  const goldens = measureReservoirGoldens();
  if (goldens.activeScenes !== 874 || goldens.activeQuips !== 673 || goldens.inactiveProduction !== 91) {
    throw new Error(`Reservoir goldens drifted: ${goldens.activeScenes}/${goldens.activeQuips}/${goldens.inactiveProduction}`);
  }
  if (goldens.futureDuskkin !== 30) {
    throw new Error(`future.duskkin rows drifted: ${goldens.futureDuskkin}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    rulesVersion: 'canon-ambient-p183-v26',
    modelCalls: null,
    requestTimeAuthoring: null,
    refillReservations: null,
    activeScenes: goldens.activeScenes,
    activeQuips: goldens.activeQuips,
    inactiveProduction: goldens.inactiveProduction,
    futureInactive: goldens.futureInactive,
    futureDuskkin: goldens.futureDuskkin,
    dormantPaths: [
      'duskkin.feeding_suspicion — no unverified rumours committed on canonical seeds',
      'duskkin.verified_feeding — no feeding incidents manufactured; natural volume is 0',
      'duskkin.public_safety — immediate ongoing danger containment dormant without live incident',
      'future_duskkin_compliance — 30 staged scenes remain quarantined in batch library',
      'Zara liaison knowledge transfer — dormant when no compliance cases arise',
      'Council response referral — dormant when no cases are notified',
    ],
    determinism: {},
    restart: {},
    observers: {},
    ninetyRestart: {},
    ninetyObservers: {},
    thirtyDays: {},
    ninetyDays: {},
  };

  console.log('================================================================');
  console.log('   WORLDSTREAM ADDON 3 ACCEPTANCE (v26 Duskkin compliance)     ');
  console.log('================================================================\n');

  console.log(`Active Scene Reservoir: ${report.activeScenes} scenes`);
  console.log(`Active Quip Reservoir: ${report.activeQuips} quips\n`);

  if (report.activeScenes !== 874) {
    console.warn(`[WARN] Active reservoir count is ${report.activeScenes}, expected 874`);
  }
  if (report.activeQuips !== 673) {
    console.warn(`[WARN] Active quip count is ${report.activeQuips}, expected 673`);
  }

  console.log('--- 1. One-shot == chunked, restart, observer schedules (30d) ---');
  for (const seed of SEEDS) {
    const one = runTo(seed, 30);
    const chunked = runTo(seed, 30, { chunkHours: 24 });
    if (one.digest !== chunked.digest) throw new Error(`Chunked mismatch ${seed}`);
    const restart = proveRestart(seed, 30, one.digest);
    const observers = proveObservers(seed, 30, one.digest);
    proveProseIdentity(one.snap);
    const stats = analyze(one.snap, 30);
    assertAddonCadence(seed, 30, stats);
    console.log(`${seed}: one-shot==chunked PASS | restart PASS | observers PASS | digest ${one.digest}`);
    report.determinism[seed] = { matched: true, digest: one.digest };
    report.restart[seed] = restart;
    report.observers[seed] = observers;
    report.thirtyDays[seed] = { digest: one.digest, stats };
  }

  console.log('\n--- 2. 30-day census ---');
  for (const seed of SEEDS) {
    const { stats } = report.thirtyDays[seed];
    console.log(`\n${seed}`);
    console.log(`  MEU opened ${stats.meuOpened} (${stats.meuPerWeek}/wk) resolved ${stats.meuResolved}`);
    console.log(`  Legion referrals ${stats.referrals} offers ${stats.offers} accepts ${stats.accepts} declines ${stats.declines} paid ${stats.payments}`);
    console.log(`  Duskkin compliance notices ${stats.duskkin.notices} evidence ${stats.duskkin.evidence} responses ${stats.duskkin.responses} closed ${stats.duskkin.closes}`);
    console.log(`  Life: meals ${stats.lifeBalance.meals} training ${stats.lifeBalance.practices} sleep ${stats.lifeBalance.sleep} travel ${stats.lifeBalance.travel} social Legion ${stats.lifeBalance.legionVisits}`);
    if (stats.meuPerWeek < 0.5 || stats.meuPerWeek > 3.5) {
      console.warn(`  [WARN] MEU rate ${stats.meuPerWeek}/wk outside diagnostic band`);
    }
    if (stats.lifeBalance.meals < 20 || stats.lifeBalance.practices < 10 || stats.lifeBalance.legionVisits < 1) {
      throw new Error(`${seed} lost ordinary cadence`);
    }
  }

  console.log('\n--- 3. 90-day census ---');
  for (const seed of SEEDS) {
    const one = runTo(seed, 90);
    const chunked = runTo(seed, 90, { chunkHours: 24 });
    if (one.digest !== chunked.digest) throw new Error(`90d chunked mismatch ${seed}`);
    const restart = proveRestart(seed, 90, one.digest);
    const observers = proveObservers(seed, 90, one.digest);
    proveProseIdentity(one.snap);
    const stats = analyze(one.snap, 90);
    assertAddonCadence(seed, 90, stats);
    report.ninetyDays[seed] = { digest: one.digest, stats };
    report.ninetyRestart[seed] = restart;
    report.ninetyObservers[seed] = observers;
    console.log(`\n${seed} digest ${one.digest}`);
    console.log(`  MEU opened ${stats.meuOpened} (${stats.meuPerWeek}/wk) resolved ${stats.meuResolved}`);
    console.log(`  Legion referrals ${stats.referrals} offers ${stats.offers} accepts ${stats.accepts} declines ${stats.declines} paid ${stats.payments}`);
    console.log(`  Duskkin compliance notices ${stats.duskkin.notices} evidence ${stats.duskkin.evidence} responses ${stats.duskkin.responses} closed ${stats.duskkin.closes}`);
    console.log(`  Life: meals ${stats.lifeBalance.meals} training ${stats.lifeBalance.practices} sleep ${stats.lifeBalance.sleep} travel ${stats.lifeBalance.travel} social Legion ${stats.lifeBalance.legionVisits}`);
  }

  const spies = readProductionPathSpies();
  report.modelCalls = spies.modelCalls;
  report.requestTimeAuthoring = spies.requestTimeAuthoring;
  report.refillReservations = spies.refillReservations;
  if (spies.modelCalls !== 0 || spies.requestTimeAuthoring !== 0 || spies.refillReservations !== 0) {
    throw new Error(`Acceptance production-path spies were ${spies.modelCalls}/${spies.requestTimeAuthoring}/${spies.refillReservations}`);
  }

  writeFileSync(new URL('../ADDON3-ACCEPTANCE.md', import.meta.url), renderMarkdown(report));
  writeFileSync(new URL('../ADDON3-ACCEPTANCE.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log('\nWrote ADDON3-ACCEPTANCE.md and ADDON3-ACCEPTANCE.json');
  console.log('\n================================================================');
  console.log('                 ADDON 3 ACCEPTANCE COMPLETE                     ');
  console.log('================================================================');
  globalThis.fetch = previousFetch;
}

function renderMarkdown(report) {
  const line = (label, stats) =>
    `| ${label} | ${stats.meuOpened} | ${stats.meuPerWeek} | ${stats.referrals} | ${stats.offers} | ${stats.duskkin.notices} | ${stats.duskkin.closes} | ${stats.lifeBalance.meals} | ${stats.lifeBalance.practices} | ${stats.lifeBalance.legionVisits} |`;
  return `# Addon 3 acceptance — canon-ambient-p183-v26

Generated: ${report.generatedAt}

## Bar

- one-shot == chunked
- restart == uninterrupted
- differing observer schedules == same canonical history
- 0 model calls, 0 request-time authoring, 0 refill reservations
- Active reservoir identity preserved (874 / 673 / 91 / ${report.futureInactive}-inactive)
- Addon 1 MEU cadence unchanged
- Addon 2 Legion behaviour/social cadence unchanged
- ordinary sleep / meals / training / travel remain healthy
- zero manufactured feeding events (natural volume is 0)
- suspicion != guilt (unverified notices resolve cleanly)
- MI6 public safety separation from Council internal disposition
- Zara is liaison, not MI6 staff; learns evidence only upon transfer
- generic duskkin_liaison and Eirik in London rejected
- zero prose in canonical state or event payloads
- future Duskkin prose library remains quarantined

## Proof

| Check | Result |
|---|---|
| Model calls | ${report.modelCalls} |
| Request-time authoring | ${report.requestTimeAuthoring} |
| Refill reservations | ${report.refillReservations} |
| Active Scenes | ${report.activeScenes} |
| Active Quips | ${report.activeQuips} |
| Inactive production rows | ${report.inactiveProduction} |
| Future simulation inactive | ${report.futureInactive} |
| future.duskkin quarantined | ${report.futureDuskkin} |
| 30d one-shot == chunked | PASS |
| 30d restart | PASS |
| 30d observer schedules | PASS |
| 90d one-shot == chunked | PASS |
| 90d restart | PASS |
| 90d observer schedules | PASS |
| Prose-removal identity | PASS |

## 30-day census

| Seed | MEU opened | MEU/wk | Referrals | Legion Offers | Duskkin Notices | Duskkin Closes | Meals | Training | Social Legion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${SEEDS.map(seed => line(seed, report.thirtyDays[seed].stats)).join('\n')}

## 90-day census

| Seed | MEU opened | MEU/wk | Referrals | Legion Offers | Duskkin Notices | Duskkin Closes | Meals | Training | Social Legion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${SEEDS.map(seed => line(seed, report.ninetyDays[seed].stats)).join('\n')}

## Digests

30d: ${SEEDS.map(seed => `${seed} \`${report.thirtyDays[seed].digest}\``).join('; ')}

90d: ${SEEDS.map(seed => `${seed} \`${report.ninetyDays[seed].digest}\``).join('; ')}

## Deliberately dormant paths

${report.dormantPaths.map(item => `- ${item}`).join('\n')}

Natural Duskkin case volume is zero on canonical seeds because no dedicated DUSKKIN_COMPLIANCE_INCIDENT is issued. This is an honest invariant, not a missing generator. Lifecycle proof, evidence sufficiency, containment jurisdiction, Zara offscreen transfer, Council notification, and clean closure are proven through the Worldstream reducer in production-path tests.
`;
}

main().catch(err => {
  console.error('Acceptance harness error:', err);
  process.exit(1);
});
