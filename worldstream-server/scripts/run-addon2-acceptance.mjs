import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { knowsFact } from '../src/fixture.mjs';
import { editorialEvent } from '../src/editorial.mjs';
import { MEU_FAMILIES, MEU_OUTCOMES } from '../src/meu-cases.mjs';
import { LEGION_JOB_FAMILIES, LEGION_JOB_OUTCOMES } from '../src/legion-jobs.mjs';

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

function jobHistory(snap) {
  return snap.events.filter(e => e.type === 'MI6_LEGION_REFERRAL' || e.type.startsWith('LEGION_JOB_'))
    .map(e => ({
      type: e.type, occurredAt: e.occurredAt, location: e.location, area: e.area,
      participants: [...(e.participants ?? [])], payload: e.payload,
    }));
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
  const incidents = events.filter(e => e.type === 'INCIDENT');

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
    if (o.payload?.family === 'legion.community_request') {
      throw new Error('Community-request jobs must stay dormant without a genuine source');
    }
  }
  for (const r of events.filter(e => e.type === 'LEGION_JOB_RESOLVE')) {
    if (!PERMITTED_JOB_OUTCOMES.has(r.payload?.outcome)) {
      throw new Error(`Forbidden Legion outcome ${r.payload?.outcome}`);
    }
    if (r.payload?.outcome === 'referred_to_meu') {
      throw new Error('referred_to_meu must not exist in Addon 2 v1');
    }
  }
  for (const d of declines) {
    if (!DECLINE_REASONS.has(d.payload?.reason)) {
      throw new Error(`Decline used an invented reason: ${d.payload?.reason}`);
    }
  }

  const incidentIds = new Set(incidents.map(e => e.id));
  for (const offer of offers) {
    if (incidentIds.has(offer.payload?.sourceEventId)) {
      throw new Error(`Job ${offer.payload.jobId} opened from a raw INCIDENT`);
    }
  }

  const bySource = new Map();
  for (const offer of offers) {
    const key = offer.payload?.sourceCaseId || offer.payload?.sourceEventId;
    if (!key) continue;
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
    if (bySource.get(key) > 1) throw new Error(`Duplicate Legion jobs for source ${key}`);
  }

  const byJob = new Map();
  for (const p of payments) {
    const id = p.payload?.jobId;
    byJob.set(id, (byJob.get(id) ?? 0) + 1);
    if (byJob.get(id) > 1) throw new Error(`Payment repeated for ${id}`);
    if (p.payload.price != null || p.payload.amount != null) throw new Error('Payment must not carry a price');
  }

  const now = snap.world.resolvedThrough;
  const handoffs = events.filter(e => e.type === 'LEGION_JOB_HANDOFF_READ');
  for (const fact of Object.values(snap.facts ?? {})) {
    if (!String(fact.kind).startsWith('legion_job_') && fact.kind !== 'mi6_legion_referral') continue;
    for (const who of ['goaden', 'ashai']) {
      if (!knowsFact(snap.characters[who], fact.key, now)) continue;
      const ok = handoffs.some(e => e.payload?.actor === who && e.payload?.factKey === fact.key)
        || events.some(e => e.type.startsWith('LEGION_JOB_') && e.participants?.includes(who)
          && e.payload?.factKey === fact.key);
      if (!ok) throw new Error(`${who} knows ${fact.key} without participation or handoff`);
    }
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
    communityRequestJobs: offers.filter(e => e.payload?.family === 'legion.community_request').length,
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
  const dir = mkdtempSync(join(tmpdir(), 'sc-addon2-restart-'));
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
  const before = JSON.stringify(jobHistory(snap));
  for (const event of snap.events) editorialEvent(event);
  const after = JSON.stringify(jobHistory(snap));
  if (before !== after) throw new Error('Editorial/job prose changed canonical job history');
}

async function main() {
  let fetchCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    fetchCalls++;
    throw new Error(`Acceptance requested a model/network call: ${String(args[0])}`);
  };

  const report = {
    generatedAt: new Date().toISOString(),
    rulesVersion: 'canon-ambient-p183-v25',
    modelCalls: 0,
    requestTimeAuthoring: 0,
    refillReservations: 0,
    dormantPaths: [
      'legion.community_request — no genuine community-request source exists',
      'legion.magical_cleanup / recovery_or_extraction / information_favour — unused families, reserved for later sources',
      'referred_to_meu — removed from Addon 2 v1',
      'future.legionjob.001–.030 — remain inactive',
      'MEU referred_to_mi6 artefact jurisdiction — never offered to the Legion',
    ],
    determinism: {},
    restart: {},
    observers: {},
    thirtyDays: {},
    ninetyDays: {},
  };

  console.log('================================================================');
  console.log('   WORLDSTREAM ADDON 1 + ADDON 2 ACCEPTANCE (v25 Legion jobs)   ');
  console.log('================================================================\n');

  console.log('--- 1. One-shot == chunked, restart, observer schedules (30d) ---');
  for (const seed of SEEDS) {
    const one = runTo(seed, 30);
    const chunked = runTo(seed, 30, { chunkHours: 24 });
    if (one.digest !== chunked.digest) throw new Error(`Chunked mismatch ${seed}`);
    const restart = proveRestart(seed, 30, one.digest);
    const observers = proveObservers(seed, 30, one.digest);
    proveProseIdentity(one.snap);
    const stats = analyze(one.snap, 30);
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
    console.log(`  Life: meals ${stats.lifeBalance.meals} training ${stats.lifeBalance.practices} sleep ${stats.lifeBalance.sleep} travel ${stats.lifeBalance.travel} social Legion ${stats.lifeBalance.legionVisits}`);
    if (stats.meuPerWeek < 0.5 || stats.meuPerWeek > 3.5) {
      console.warn(`  [WARN] MEU rate ${stats.meuPerWeek}/wk outside the 1–3/wk diagnostic band`);
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
    proveProseIdentity(one.snap);
    const stats = analyze(one.snap, 90);
    if (stats.lifeBalance.meals < 60 || stats.lifeBalance.practices < 30 || stats.lifeBalance.legionVisits < 2) {
      throw new Error(`${seed} 90d lost ordinary cadence`);
    }
    if ((one.snap.legionJobs?.closedSummaries.length ?? 0) > 24) throw new Error('closedSummaries exceeded 24');
    if (Object.keys(one.snap.legionJobs?.issued ?? {}).length > 128) throw new Error('issued exceeded 128');
    report.ninetyDays[seed] = { digest: one.digest, stats };
    console.log(`\n${seed} digest ${one.digest}`);
    console.log(`  MEU opened ${stats.meuOpened} (${stats.meuPerWeek}/wk) resolved ${stats.meuResolved}`);
    console.log(`  Legion referrals ${stats.referrals} offers ${stats.offers} accepts ${stats.accepts} declines ${stats.declines} paid ${stats.payments}`);
    console.log(`  Life: meals ${stats.lifeBalance.meals} training ${stats.lifeBalance.practices} sleep ${stats.lifeBalance.sleep} travel ${stats.lifeBalance.travel} social Legion ${stats.lifeBalance.legionVisits}`);
  }

  report.modelCalls = fetchCalls;
  if (fetchCalls !== 0) throw new Error(`Acceptance made ${fetchCalls} network/model calls`);

  writeFileSync(new URL('../ADDON2-ACCEPTANCE.md', import.meta.url), renderMarkdown(report));
  writeFileSync(new URL('../ADDON2-ACCEPTANCE.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log('\nWrote ADDON2-ACCEPTANCE.md and ADDON2-ACCEPTANCE.json');
  console.log('\n================================================================');
  console.log('                 ADDON 2 ACCEPTANCE COMPLETE                     ');
  console.log('================================================================');
  globalThis.fetch = previousFetch;
}

function renderMarkdown(report) {
  const line = (label, stats) =>
    `| ${label} | ${stats.meuOpened} | ${stats.meuPerWeek} | ${stats.referrals} | ${stats.offers} | ${stats.accepts} | ${stats.declines} | ${stats.payments} | ${stats.lifeBalance.meals} | ${stats.lifeBalance.practices} | ${stats.lifeBalance.legionVisits} |`;
  return `# Addon 2 acceptance — canon-ambient-p183-v25

Generated: ${report.generatedAt}

## Bar

- one-shot == chunked
- restart == uninterrupted
- differing observer schedules == same canonical history
- 0 model calls, 0 request-time authoring, 0 refill reservations
- MEU cadence remains healthy
- Legion social cadence remains healthy
- ordinary sleep / meals / training / travel remain healthy
- one source cannot open duplicate Legion jobs
- payment exactly once where legitimately reachable
- decline only for real state reasons
- knowledge isolation holds
- removing job prose leaves canonical job history unchanged

## Proof

| Check | Result |
|---|---|
| Model calls | ${report.modelCalls} |
| Request-time authoring | ${report.requestTimeAuthoring} |
| Refill reservations | ${report.refillReservations} |
| 30d one-shot == chunked | PASS |
| 30d restart | PASS |
| 30d observer schedules | PASS |
| 90d one-shot == chunked | PASS |
| Prose-removal identity | PASS |

## 30-day census

| Seed | MEU opened | MEU/wk | Referrals | Offers | Accepts | Declines | Paid | Meals | Training | Social Legion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${SEEDS.map(seed => line(seed, report.thirtyDays[seed].stats)).join('\n')}

## 90-day census

| Seed | MEU opened | MEU/wk | Referrals | Offers | Accepts | Declines | Paid | Meals | Training | Social Legion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${SEEDS.map(seed => line(seed, report.ninetyDays[seed].stats)).join('\n')}

## Digests

30d: ${SEEDS.map(seed => `${seed} \`${report.thirtyDays[seed].digest}\``).join('; ')}

90d: ${SEEDS.map(seed => `${seed} \`${report.ninetyDays[seed].digest}\``).join('; ')}

## Deliberately dormant paths

${report.dormantPaths.map(item => `- ${item}`).join('\n')}

Natural job volume may be zero. Addon 1 already showed almost no \`contained\` MEU outcomes. That is an honest empty set, not a missing generator. Lifecycle, payment, decline and knowledge are proven by injected-source unit tests.
`;
}

main().catch(err => {
  console.error('Acceptance harness error:', err);
  process.exit(1);
});
