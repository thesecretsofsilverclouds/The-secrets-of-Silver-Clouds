import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture, eventId } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { editorialEvent } from '../src/editorial.mjs';
import { MEU_FAMILIES, MEU_OUTCOMES } from '../src/meu-cases.mjs';
import { LEGION_JOB_FAMILIES, LEGION_JOB_OUTCOMES } from '../src/legion-jobs.mjs';
import { DUSKKIN_COMPLIANCE_EVENT_TYPES, DUSKKIN_SOURCE_EVENT_TYPE, assertDuskkinCompliance } from '../src/duskkin-compliance.mjs';
import {
  LIVING_PLACES_EVENT_TYPES,
  ECOLOGICAL_SOURCE_EVENT_TYPE,
  ECOLOGICAL_SOURCE_END_TYPE,
  LIVING_PLACES_STATE_BUDGET,
  assertLivingPlaces,
  initialLivingPlacesState,
  livingPlacesSerializedBytes,
  RECOVERY_DURATIONS
} from '../src/living-places.mjs';
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

  // Living Places events
  const siteImpacts = events.filter(e => e.type === 'SITE_IMPACT_REGISTER');
  const siteRecoveryBegins = events.filter(e => e.type === 'SITE_RECOVERY_BEGIN');
  const siteRecoveriesDue = events.filter(e => e.type === 'SITE_RECOVERY_DUE');
  const siteRecovereds = events.filter(e => e.type === 'SITE_RECOVERED');
  const onariNotices = events.filter(e => e.type === 'ONARI_ECOLOGY_NOTICE');
  const onariConsultations = events.filter(e => e.type === 'ONARI_CONSULTATION');
  const onariProtestsBegin = events.filter(e => e.type === 'ONARI_PROTEST_BEGIN');
  const onariProtestsEnd = events.filter(e => e.type === 'ONARI_PROTEST_END');
  const onariRemediations = events.filter(e => e.type === 'ONARI_REMEDIATION');
  const onariNoChanges = events.filter(e => e.type === 'ONARI_NO_CHANGE');
  const onariCloses = events.filter(e => e.type === 'ONARI_ECOLOGY_CLOSE');

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

  // Subsystem Invariants Verification
  assertDuskkinCompliance(snap);
  assertLivingPlaces(snap);

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
    if (LIVING_PLACES_EVENT_TYPES.includes(e.type)) {
      if (e.payload?.prose || e.payload?.text || e.payload?.description) {
        throw new Error(`Prose detected in Living Places event ${e.type} payload`);
      }
      const forbiddenActors = ['contractor', 'onari_protester', 'planner', 'onari_liaison'];
      for (const actor of forbiddenActors) {
        if (e.participants?.includes(actor) || e.payload?.actor === actor || e.payload?.role === actor) {
          throw new Error(`Placeholder actor ${actor} detected in Living Places event ${e.type}`);
        }
      }
    }
  }

  // Invariant: Zero travel departures/arrivals to onari_village on canonical seeds
  for (const e of events) {
    if ((e.type === 'TRAVEL_DEPART' || e.type === 'TRAVEL_ARRIVE') &&
        (e.location === 'onari_village' || e.payload?.to === 'onari_village' || e.payload?.from === 'onari_village')) {
      throw new Error(`Forbidden travel event to/from onari_village on canonical seed: ${e.type} at ${e.at}`);
    }
  }

  // Invariant: Bounded compliance collections
  if ((snap.duskkinCompliance?.closedSummaries?.length ?? 0) > 24) {
    throw new Error('Duskkin closedSummaries exceeded 24');
  }
  if (Object.keys(snap.duskkinCompliance?.issued ?? {}).length > 128) {
    throw new Error('Duskkin issued actions exceeded 128');
  }

  // Invariant: Bounded living places collections
  if ((snap.livingPlaces?.closedSummaries?.length ?? 0) > 16) {
    throw new Error('Living Places closedSummaries exceeded 16');
  }
  if ((snap.livingPlaces?.recoveredSummaries?.length ?? 0) > 16) {
    throw new Error('Living Places recoveredSummaries exceeded 16');
  }
  if (Object.keys(snap.livingPlaces?.issued ?? {}).length > 24) {
    throw new Error('Living Places issued actions exceeded 24');
  }
  if ((snap.livingPlaces?.endedSourceSummaries?.length ?? 0) > 16) {
    throw new Error('Living Places endedSourceSummaries exceeded 16');
  }
  if (Object.values(snap.livingPlaces?.cases ?? {}).some(c => c.status === 'closed')) {
    throw new Error('Closed Onari cases must not remain in cases{}');
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
    livingPlaces: {
      siteImpacts: siteImpacts.length,
      siteRecoveryBegins: siteRecoveryBegins.length,
      siteRecoveriesDue: siteRecoveriesDue.length,
      siteRecovereds: siteRecovereds.length,
      onariNotices: onariNotices.length,
      onariConsultations: onariConsultations.length,
      onariProtestsBegin: onariProtestsBegin.length,
      onariProtestsEnd: onariProtestsEnd.length,
      onariRemediations: onariRemediations.length,
      onariNoChanges: onariNoChanges.length,
      onariCloses: onariCloses.length,
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
  const dir = mkdtempSync(join(tmpdir(), 'sc-addon4-restart-'));
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
  const trackedTypes = new Set([...DUSKKIN_COMPLIANCE_EVENT_TYPES, ...LIVING_PLACES_EVENT_TYPES]);
  const before = JSON.stringify(snap.events.filter(e => trackedTypes.has(e.type)));
  for (const event of snap.events) editorialEvent(event);
  const after = JSON.stringify(snap.events.filter(e => trackedTypes.has(e.type)));
  if (before !== after) throw new Error('Editorial prose changed canonical tracked history');
}

function measureReservoirGoldens() {
  const catalogIds = new Set(SCENE_RESERVOIR_CATALOG.map(s => s.reservoir.sourceId));
  const inactiveProduction = SCENE_RESERVOIR_BATCHES.flatMap(b => b.entries).filter(e => !catalogIds.has(e.id)).length;
  const quips = [...CAST.values()].reduce((n, g) => n + Object.values(g.quips ?? {}).reduce((m, bank) => m + bank.length, 0), 0);
  const futurePath = resolve(dirname(fileURLToPath(import.meta.url)),
    '../../../../WORLDSTREAM_CANON_CONTENT_MEGA_BATCH_04/WORLDSTREAM_FUTURE_SIMULATION_LIBRARY_BATCH_04.json');
  let futureInactive = 0;
  let futureDuskkin = 0;
  let futureOnari = 0;
  if (existsSync(futurePath)) {
    const library = JSON.parse(readFileSync(futurePath, 'utf8'));
    futureInactive = library.scenes.length;
    futureDuskkin = library.scenes.filter(s => String(s.id).startsWith('future.duskkin.')).length;
    futureOnari = library.scenes.filter(s => String(s.id).startsWith('future.onari.')).length;
    for (const scene of library.scenes) {
      if (catalogIds.has(scene.id)) throw new Error(`Future simulation scene ${scene.id} leaked into the active catalog`);
      if (scene.status !== 'staged_future') throw new Error(`Future scene ${scene.id} is not staged_future`);
    }
  }
  if (SCENE_RESERVOIR_CATALOG.some(s => String(s.reservoir.sourceId).startsWith('future.duskkin.'))) {
    throw new Error('future.duskkin prose leaked into the active catalog');
  }
  if (SCENE_RESERVOIR_CATALOG.some(s => String(s.reservoir.sourceId).startsWith('future.onari.'))) {
    throw new Error('future.onari prose leaked into the active catalog');
  }
  if (SCENE_RESERVOIR_CATALOG.some(s => ['duskkin_compliance', 'living_places', 'site_impact', 'onari_ecology'].includes(s.reservoir.family))) {
    throw new Error('prohibited family leaked into the active catalog');
  }
  return {
    activeScenes: SCENE_RESERVOIR_CATALOG.length,
    activeQuips: quips,
    inactiveProduction,
    futureInactive,
    futureDuskkin,
    futureOnari,
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
  if (stats.livingPlaces.siteImpacts !== 0 || stats.livingPlaces.onariNotices !== 0) {
    throw new Error(`${seed} ${days}d manufactured Living Places volume; expected 0`);
  }
}

function proveLivingPlacesLifecycle() {
  const DAY = START + 10 * 60 * MIN;
  const shape = action => ({
    id: action.id,
    type: action.type,
    dueAt: action.dueAt,
    priority: action.priority,
    day: action.day
  });
  const seedWorld = (seed, incidents) => {
    const current = createFixture({ startMs: START });
    const initial = current.initialState();
    initial.livingPlaces = {
      ...initialLivingPlacesState(),
      issued: Object.fromEntries(incidents.map(action => [action.id, {
        shape: shape(action), sourceEventId: `seed:${action.id}`, consumed: false
      }]))
    };
    const fixture = {
      ...current,
      initialState: () => structuredClone(initial),
      initialActions: () => [...current.initialActions(), ...incidents],
      reduceAction: (state, action, seedValue) => current.reduceAction(state, action, seedValue)
    };
    return new WorldStore({ dbPath: ':memory:', seed, fixture });
  };
  const source = ({ id, dueAt = DAY, locationId = 'big_ben_plaza', areaId = 'gardens',
    consequenceKind = 'vegetation_damage', impact = 'minor', authorityActor = null }) => ({
    id, type: ECOLOGICAL_SOURCE_EVENT_TYPE, dueAt, priority: 36, day: londonDate(dueAt),
    actors: [], version: 1, locationId, areaId, consequenceKind, impact,
    affectsLivingHabitat: true, provenance: { path: 'committed_report' }, authorityActor
  });
  const sourceKey = (seed, action) => `${action.day}:eco-source-${eventId(seed, action.id)}`;

  {
    const src = source({ id: 'synthetic/natural_source' });
    const end = {
      id: 'synthetic/natural_source_end', type: ECOLOGICAL_SOURCE_END_TYPE,
      dueAt: DAY + 30 * 60 * MIN, priority: 36, day: londonDate(DAY + 30 * 60 * MIN),
      actors: [], version: 1, sourceFactKey: sourceKey('lifecycle-proof-1', src)
    };
    const world = seedWorld('lifecycle-proof-1', [src, end]);
    world.advance(DAY + 26 * 60 * MIN);
    let snap = world.semanticSnapshot();
    assert.equal(snap.livingPlaces.sites.big_ben_plaza.status, 'disturbed');
    world.advance(DAY + 31 * 60 * MIN);
    snap = world.semanticSnapshot();
    assert.equal(snap.livingPlaces.sites.big_ben_plaza.status, 'recovering');
    const begin = snap.events.find(e => e.type === 'SITE_RECOVERY_BEGIN' && e.payload?.status === 'recovering');
    assert.equal(snap.livingPlaces.sites.big_ben_plaza.recoveryDueAt - begin.occurredAt, RECOVERY_DURATIONS.minor_natural);
    world.advance(snap.livingPlaces.sites.big_ben_plaza.recoveryDueAt + 10 * MIN);
    snap = world.semanticSnapshot();
    assert.equal(snap.livingPlaces.sites.big_ben_plaza.status, 'stable');
    assert.equal(snap.livingPlaces.activeCaseIds.length, 0);
    assertLivingPlaces(snap);
    world.close();
  }

  {
    const src = source({ id: 'synthetic/authority_source', locationId: 'mi6', areaId: 'training', authorityActor: 'goaden' });
    const referral = {
      id: 'synthetic/authority_referral', type: 'ONARI_ECOLOGY_REFERRAL',
      dueAt: DAY + 20 * MIN, priority: 37, day: londonDate(DAY + 20 * MIN),
      actors: [], version: 1, locationId: 'mi6', sourceFactKey: sourceKey('lifecycle-proof-2', src)
    };
    const notice = {
      id: 'synthetic/authority_notice', type: 'ONARI_ECOLOGY_NOTICE',
      dueAt: DAY + 40 * MIN, priority: 37, day: londonDate(DAY + 40 * MIN),
      actors: [], version: 1, caseId: 'onari:authority-proof', locationId: 'mi6',
      consequenceKind: 'vegetation_damage', impact: 'minor',
      sourceEventId: 'synthetic-authority', sourceFactKey: sourceKey('lifecycle-proof-2', src)
    };
    const world = seedWorld('lifecycle-proof-2', [src, referral, notice]);
    world.advance(DAY + 50 * MIN);
    let snap = world.semanticSnapshot();
    assert.ok(snap.livingPlaces.activeCaseIds[0], 'An Onari case should open after referral');
    world.advance(DAY + 3 * 60 * MIN);
    snap = world.semanticSnapshot();
    assert.equal(snap.events.find(e => e.type === 'ONARI_CONSULTATION')?.payload?.outcome, 'remediation_agreed');
    world.advance(DAY + 5 * 24 * 60 * MIN);
    snap = world.semanticSnapshot();
    assert.equal(snap.livingPlaces.sites.mi6.status, 'stable');
    assert.ok(snap.livingPlaces.closedSummaries.some(c => c.locationId === 'mi6'));
    assert.equal(snap.livingPlaces.activeCaseIds.length, 0);
    assertLivingPlaces(snap);
    world.close();
  }

  {
    const src = source({
      id: 'synthetic/protest_source',
      consequenceKind: 'magical_contamination_of_living_area',
      impact: 'moderate'
    });
    const referral = {
      id: 'synthetic/protest_referral', type: 'ONARI_ECOLOGY_REFERRAL',
      dueAt: DAY + 20 * MIN, priority: 37, day: londonDate(DAY + 20 * MIN),
      actors: [], version: 1, locationId: 'big_ben_plaza', sourceFactKey: sourceKey('lifecycle-proof-3', src)
    };
    const notice = {
      id: 'synthetic/protest_notice', type: 'ONARI_ECOLOGY_NOTICE',
      dueAt: DAY + 40 * MIN, priority: 37, day: londonDate(DAY + 40 * MIN),
      actors: [], version: 1, caseId: 'onari:protest-proof', locationId: 'big_ben_plaza',
      consequenceKind: 'magical_contamination_of_living_area', impact: 'moderate',
      sourceEventId: 'synthetic-protest', sourceFactKey: sourceKey('lifecycle-proof-3', src)
    };
    const world = seedWorld('lifecycle-proof-3', [src, referral, notice]);
    world.advance(DAY + 5 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const protest = snap.events.find(e => e.type === 'ONARI_PROTEST_BEGIN');
    assert.ok(protest, 'Peaceful protest should be initiated when referred and Yukon is present');
    assert.equal(protest.payload.peaceful, true);
    assert.deepEqual(protest.participants, ['yukon']);
    assert.equal(snap.events.some(e => e.type === 'ONARI_REMEDIATION'), false);
    assertLivingPlaces(snap);
    const bytes = livingPlacesSerializedBytes(snap);
    if (bytes > LIVING_PLACES_STATE_BUDGET) {
      throw new Error(`Living Places serialized state ${bytes} exceeded ${LIVING_PLACES_STATE_BUDGET}`);
    }
    world.close();
  }

  return true;
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
  if (goldens.futureOnari !== 30) {
    throw new Error(`future.onari rows drifted: ${goldens.futureOnari}`);
  }

  console.log('Running synthetic Living Places lifecycle proof...');
  proveLivingPlacesLifecycle();
  console.log('Synthetic Living Places lifecycle proof PASS\n');

  const report = {
    generatedAt: new Date().toISOString(),
    rulesVersion: 'canon-ambient-p183-v27',
    modelCalls: null,
    requestTimeAuthoring: null,
    refillReservations: null,
    activeScenes: goldens.activeScenes,
    activeQuips: goldens.activeQuips,
    inactiveProduction: goldens.inactiveProduction,
    futureInactive: goldens.futureInactive,
    futureDuskkin: goldens.futureDuskkin,
    futureOnari: goldens.futureOnari,
    dormantPaths: [
      'site_impact — no uncommitted/random physical damage manufactured on canonical seeds',
      'onari_ecology_notice — natural case volume is 0 without qualifying committed source facts',
      'onari_protest — rare escalation path dormant when no ongoing unresolved habitat harm occurs',
      'future_onari_environment — 30 staged scenes remain quarantined in batch library',
      'Yukon Onari participation — dormant when no ecological cases arise; strictly optional when active',
      'Onari remediation — expedited recovery dormant when no damage is committed',
      'onari_village travel — natural travel volume is 0 without qualifying committed access facts',
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
  console.log('   WORLDSTREAM ADDON 4 ACCEPTANCE (v27 Living Places / Onari)   ');
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
    console.log(`  Living Places site impacts ${stats.livingPlaces.siteImpacts} recovered ${stats.livingPlaces.siteRecovereds} onari notices ${stats.livingPlaces.onariNotices} closes ${stats.livingPlaces.onariCloses}`);
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
    console.log(`  Living Places site impacts ${stats.livingPlaces.siteImpacts} recovered ${stats.livingPlaces.siteRecovereds} onari notices ${stats.livingPlaces.onariNotices} closes ${stats.livingPlaces.onariCloses}`);
    console.log(`  Life: meals ${stats.lifeBalance.meals} training ${stats.lifeBalance.practices} sleep ${stats.lifeBalance.sleep} travel ${stats.lifeBalance.travel} social Legion ${stats.lifeBalance.legionVisits}`);
  }

  const spies = readProductionPathSpies();
  report.modelCalls = spies.modelCalls;
  report.requestTimeAuthoring = spies.requestTimeAuthoring;
  report.refillReservations = spies.refillReservations;
  if (spies.modelCalls !== 0 || spies.requestTimeAuthoring !== 0 || spies.refillReservations !== 0) {
    throw new Error(`Acceptance production-path spies were ${spies.modelCalls}/${spies.requestTimeAuthoring}/${spies.refillReservations}`);
  }

  writeFileSync(new URL('../ADDON4-ACCEPTANCE.md', import.meta.url), renderMarkdown(report));
  writeFileSync(new URL('../ADDON4-ACCEPTANCE.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log('\nWrote ADDON4-ACCEPTANCE.md and ADDON4-ACCEPTANCE.json');
  console.log('\n================================================================');
  console.log('                 ADDON 4 ACCEPTANCE COMPLETE                     ');
  console.log('================================================================');
  globalThis.fetch = previousFetch;
}

function renderMarkdown(report) {
  const line = (label, stats) =>
    `| ${label} | ${stats.meuOpened} | ${stats.meuPerWeek} | ${stats.referrals} | ${stats.offers} | ${stats.duskkin.notices} | ${stats.livingPlaces.siteImpacts} | ${stats.livingPlaces.onariNotices} | ${stats.lifeBalance.meals} | ${stats.lifeBalance.practices} | ${stats.lifeBalance.legionVisits} |`;
  return `# Addon 4 acceptance — canon-ambient-p183-v27

Generated: ${report.generatedAt}

## Bar

- one-shot == chunked
- restart == uninterrupted
- differing observer schedules == same canonical history
- 0 model calls, 0 request-time authoring, 0 refill reservations
- Active reservoir identity preserved (874 / 673 / 91 / ${report.futureInactive}-inactive)
- Addon 1 MEU cadence unchanged
- Addon 2 Legion behaviour/social cadence unchanged
- Addon 3 Duskkin compliance behaviour unchanged
- ordinary sleep / meals / training / travel remain healthy
- zero manufactured disturbance or Onari events (natural volume is 0)
- zero natural travel to onari_village on canonical seeds (access requires committed fact)
- site memory operates independently from Onari response
- discrete states only (stable | disturbed | recovering; minor | moderate); 0 continuous meters
- existing canonical locations only (src/places.mjs); no invented london/park or embankment
- Yukon is strictly optional (joins only if available and awake; no divided loyalty meter)
- zero placeholder actors (no contractor, onari_protester, planner, onari_liaison)
- zero prose in canonical state or event payloads
- future Onari prose library (30 scenes) remains quarantined in staged_future

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
| future.onari quarantined | ${report.futureOnari} |
| 30d one-shot == chunked | PASS |
| 30d restart | PASS |
| 30d observer schedules | PASS |
| 90d one-shot == chunked | PASS |
| 90d restart | PASS |
| 90d observer schedules | PASS |
| Prose-removal identity | PASS |
| Synthetic lifecycle proof | PASS |

## 30-day census

| Seed | MEU opened | MEU/wk | Referrals | Legion Offers | Duskkin Notices | Site Impacts | Onari Notices | Meals | Training | Social Legion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${SEEDS.map(seed => line(seed, report.thirtyDays[seed].stats)).join('\n')}

## 90-day census

| Seed | MEU opened | MEU/wk | Referrals | Legion Offers | Duskkin Notices | Site Impacts | Onari Notices | Meals | Training | Social Legion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${SEEDS.map(seed => line(seed, report.ninetyDays[seed].stats)).join('\n')}

## Digests

30d: ${SEEDS.map(seed => `${seed} \`${report.thirtyDays[seed].digest}\``).join('; ')}

90d: ${SEEDS.map(seed => `${seed} \`${report.ninetyDays[seed].digest}\``).join('; ')}

## Deliberately dormant paths

${report.dormantPaths.map(item => `- ${item}`).join('\n')}

Natural site consequence and Onari case volume is zero on canonical seeds because no dedicated ECOLOGICAL_IMPACT_SOURCE is authored on those seeds. That is an honest invariant. Lifecycle proof injects committed sources through WorldStore: active sources block recovery, source-ended sites recover on the natural schedule, referral-gated Onari notice, authority-present remediation, and protest only when Yukon can participate.
`;
}

main().catch(err => {
  console.error('Acceptance harness error:', err);
  process.exit(1);
});
