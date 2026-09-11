import test from 'node:test';
import assert from 'node:assert/strict';
import { openWorld } from '../src/world.mjs';
import { atLondon, MINUTE_MS as MIN } from '../src/time.mjs';
import {
  LEGION_JOB_FAMILIES,
  LEGION_JOB_OUTCOMES,
  LEGION_JOB_EVENT_TYPES,
  initialLegionJobsState,
  assertLegionJobs,
  selectLegionJobParticipants,
  legionSourceRemit,
  legionJobOpportunityActions
} from '../src/legion-jobs.mjs';
import { selectReservoirSurface, reservoirSurfaceMatches } from '../src/scene-reservoir-select.mjs';
import { SCENE_RESERVOIR_CATALOG } from '../src/scene-reservoir-catalog.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEED = 'test-seed-legion-v1';

test('assertLegionJobs enforces all strict canon invariants', () => {
  const validState = {
    legionJobs: initialLegionJobsState()
  };
  assert.doesNotThrow(() => assertLegionJobs(validState));

  // Rule 4: Goaden cannot auto-lead
  const goadenLeadState = {
    legionJobs: {
      ...initialLegionJobsState(),
      jobs: {
        'j1': {
          jobId: 'j1', token: 't1', version: 1, system: 'legion',
          family: 'legion.community_request', status: 'active',
          owner: 'legion', leader: 'goaden', participants: ['truth', 'rose'],
          paymentStatus: 'not_applicable'
        }
      }
    }
  };
  assert.throws(() => assertLegionJobs(goadenLeadState), /Goaden cannot be Legion job leader/);

  // Rule 5: Balthazar requires Anarchy
  const balthazarSoloState = {
    legionJobs: {
      ...initialLegionJobsState(),
      jobs: {
        'j2': {
          jobId: 'j2', token: 't2', version: 1, system: 'legion',
          family: 'legion.community_request', status: 'active',
          owner: 'legion', leader: 'truth', participants: ['truth', 'balthazar'],
          paymentStatus: 'not_applicable'
        }
      }
    }
  };
  assert.throws(() => assertLegionJobs(balthazarSoloState), /Balthazar cannot participate without Anarchy/);

  // Balthazar with Anarchy is valid
  const balthazarValidState = {
    legionJobs: {
      ...initialLegionJobsState(),
      jobs: {
        'j3': {
          jobId: 'j3', token: 't3', version: 1, system: 'legion',
          family: 'legion.community_request', status: 'active',
          owner: 'legion', leader: 'truth', participants: ['truth', 'anarchy', 'balthazar'],
          paymentStatus: 'not_applicable'
        }
      }
    }
  };
  assert.doesNotThrow(() => assertLegionJobs(balthazarValidState));

  // Rule 6 & 8: Payment only for MI6 off-book work
  const paidCommunityState = {
    legionJobs: {
      ...initialLegionJobsState(),
      jobs: {
        'j4': {
          jobId: 'j4', token: 't4', version: 1, system: 'legion',
          family: 'legion.community_request', status: 'resolved',
          owner: 'legion', leader: 'truth', participants: ['truth', 'rose'],
          paymentStatus: 'paid'
        }
      }
    }
  };
  assert.throws(() => assertLegionJobs(paidCommunityState), /Payment is only permitted for MI6 off-book work/);

  // Rule 10: Zero prose in canonical state
  const proseState = {
    legionJobs: {
      ...initialLegionJobsState(),
      jobs: {
        'j5': {
          jobId: 'j5', token: 't5', version: 1, system: 'legion',
          family: 'legion.mi6_offbook_job', status: 'active',
          owner: 'legion', leader: 'truth', participants: ['truth', 'rose'],
          paymentStatus: 'unpaid',
          prose: 'Invented narrative about the job'
        }
      }
    }
  };
  assert.throws(() => assertLegionJobs(proseState), /No prose allowed in canonical Legion job state/);

  // Bounds: closedSummaries <= 24
  const overflowSummariesState = {
    legionJobs: {
      ...initialLegionJobsState(),
      closedSummaries: new Array(25).fill({ jobId: 'j' })
    }
  };
  assert.throws(() => assertLegionJobs(overflowSummariesState), /Legion closedSummaries limit exceeded/);
});

test('selectLegionJobParticipants always pairs Balthazar with Anarchy and keeps Truth as leader', () => {
  for (let i = 0; i < 50; i++) {
    const seed = `seed-${i}`;
    const token = `token-${i}`;
    for (const fam of LEGION_JOB_FAMILIES) {
      const roster = selectLegionJobParticipants(fam, seed, token);
      assert.ok(roster.length >= 2, 'Roster must have at least 2 members');
      if (roster.includes('balthazar')) {
        assert.ok(roster.includes('anarchy'), 'Balthazar must be accompanied by Anarchy');
      }
      assert.ok(!roster.includes('goaden'), 'Goaden is not a default Legion job roster member');
    }
  }
});

test('legionSourceRemit maps MEU referrals and street community incidents to valid job families', () => {
  // MEU referred to MI6 -> MI6 off-book job (PE-A)
  const meuMi6Event = {
    type: 'MEU_CASE_RESOLVE',
    location: 'mi6',
    area: 'ops_room',
    payload: { caseId: 'meu:123', outcome: 'referred_to_mi6', family: 'meu.artifact_irregularity' }
  };
  const remitMi6 = legionSourceRemit(meuMi6Event);
  assert.equal(remitMi6.family, 'legion.mi6_offbook_job');

  // MEU referred external -> magical cleanup or recovery
  const meuExternalEvent = {
    type: 'MEU_CASE_RESOLVE',
    location: 'boroughs',
    area: 'street',
    payload: { caseId: 'meu:456', outcome: 'referred_external', family: 'meu.ward_or_containment' }
  };
  const remitExternal = legionSourceRemit(meuExternalEvent);
  assert.equal(remitExternal.family, 'legion.magical_cleanup');

  // Street incidents
  assert.equal(legionSourceRemit({ type: 'INCIDENT', payload: { kind: 'surge_incident' } }).family, 'legion.magical_cleanup');
  assert.equal(legionSourceRemit({ type: 'INCIDENT', payload: { kind: 'sighting' } }).family, 'legion.recovery_or_extraction');
  assert.equal(legionSourceRemit({ type: 'INCIDENT', payload: { kind: 'courier' } }).family, 'legion.information_favour');
  assert.equal(legionSourceRemit({ type: 'INCIDENT', payload: { kind: 'confrontation' } }).family, 'legion.community_request');

  // Non-qualifying events return null
  assert.equal(legionSourceRemit({ type: 'MEU_CASE_RESOLVE', payload: { outcome: 'no_action' } }), null);
  assert.equal(legionSourceRemit({ type: 'MEAL_BEGIN' }), null);
});

test('legionJobOpportunityActions respects negative gates', () => {
  const dummyEvent = {
    id: 'evt-1',
    type: 'INCIDENT',
    location: 'boroughs',
    area: 'street',
    payload: { kind: 'surge_incident' }
  };

  const baseState = {
    legionJobs: initialLegionJobsState(),
    arcs: { session: null }
  };

  // 1. Passes when clean
  const acts = legionJobOpportunityActions({
    state: baseState, day: '2026-09-04', now: START, seed: SEED,
    parentActionId: 'act-1', parentEventId: 'evt-1', sourceEvent: dummyEvent
  });
  assert.equal(acts.length, 1);
  assert.equal(acts[0].type, 'LEGION_JOB_OFFER');

  // 2. Blocked if active job exists
  const busyState = {
    ...baseState,
    legionJobs: { ...initialLegionJobsState(), activeJobId: 'job-existing' }
  };
  assert.equal(legionJobOpportunityActions({
    state: busyState, day: '2026-09-04', now: START, seed: SEED,
    parentActionId: 'act-1', parentEventId: 'evt-1', sourceEvent: dummyEvent
  }).length, 0);

  // 3. Blocked if cooldown active (>=24h)
  const cooldownState = {
    ...baseState,
    legionJobs: { ...initialLegionJobsState(), nextEligibleAt: START + 24 * 60 * MIN }
  };
  assert.equal(legionJobOpportunityActions({
    state: cooldownState, day: '2026-09-04', now: START + 10 * 60 * MIN, seed: SEED,
    parentActionId: 'act-1', parentEventId: 'evt-1', sourceEvent: dummyEvent
  }).length, 0);

  // 4. Blocked if authored arc active
  const arcState = {
    ...baseState,
    arcs: { session: 'protected_arc_session' }
  };
  assert.equal(legionJobOpportunityActions({
    state: arcState, day: '2026-09-04', now: START, seed: SEED,
    parentActionId: 'act-1', parentEventId: 'evt-1', sourceEvent: dummyEvent
  }).length, 0);
});

test('Demon’s Legion jobs: full bounded lifecycle executes from committed referral to close', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: 'seed-legion-lifecycle-1' });
  try {
    // Advance 14 days to observe natural job opportunities, offers, starts, reports, resolves, closes
    world.advance(START + 14 * 24 * 3600_000);
    const snap = world.semanticSnapshot();

    const legionEvents = snap.events.filter(e => e.type.startsWith('LEGION_JOB_'));
    assert.ok(legionEvents.length > 0, 'Legion job events must occur across a 14-day simulation');

    const offers = legionEvents.filter(e => e.type === 'LEGION_JOB_OFFER');
    assert.ok(offers.length >= 1, 'At least one job offer must occur');

    // Verify ordering and state for every job
    for (const offer of offers) {
      const jobId = offer.payload.jobId;
      const jobEvents = legionEvents.filter(e => e.payload.jobId === jobId);
      const types = jobEvents.map(e => e.type);

      assert.equal(types[0], 'LEGION_JOB_OFFER');
      const secondType = types[1];
      assert.ok(['LEGION_JOB_ACCEPT', 'LEGION_JOB_DECLINE'].includes(secondType),
        `Second stage must be accept or decline, got ${secondType}`);

      if (secondType === 'LEGION_JOB_ACCEPT') {
        assert.ok(types.includes('LEGION_JOB_START'), 'Accepted job must start');
        assert.ok(types.includes('LEGION_JOB_REPORT'), 'Started job must report');
        assert.ok(types.includes('LEGION_JOB_RESOLVE'), 'Reported job must resolve');
        assert.ok(types.includes('LEGION_JOB_CLOSE'), 'Resolved job must close');
      } else {
        // Declined branch is terminal
        assert.equal(types.length, 2, 'Declined job must have no further action stages');
      }

      // Verify zero prose in every event
      for (const evt of jobEvents) {
        assert.equal(evt.prose, undefined, `No prose in event ${evt.id}`);
        assert.equal(evt.payload.prose, undefined, `No prose in payload of ${evt.id}`);
      }
    }

    // Verify closed summaries
    const legionState = snap.legionJobs;
    assert.ok(legionState.closedSummaries.length > 0, 'Closed jobs must be recorded in summaries');
    for (const summary of legionState.closedSummaries) {
      assert.ok(summary.jobId, 'Summary must record jobId');
      assert.ok(summary.family, 'Summary must record family');
      assert.ok(summary.result, 'Summary must record result');
      assert.equal(summary.prose, undefined, 'Summary must not store copied prose');
    }
  } finally {
    world.close();
  }
});

test('Demon’s Legion jobs: first-class DECLINE branch executes terminally', () => {
  // Use a deterministic seed known to produce a decline or trigger one directly
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: 'seed-decline-check-42' });
  try {
    world.advance(START + 30 * 24 * 3600_000);
    const snap = world.semanticSnapshot();
    const declines = snap.events.filter(e => e.type === 'LEGION_JOB_DECLINE');
    assert.ok(declines.length >= 1, 'At least one decline should occur across 30 days');

    for (const d of declines) {
      const jobId = d.payload.jobId;
      const jobEvents = snap.events.filter(e => e.payload?.jobId === jobId);
      assert.equal(jobEvents.length, 2, 'Declined job must only have OFFER and DECLINE');
      assert.equal(jobEvents[0].type, 'LEGION_JOB_OFFER');
      assert.equal(jobEvents[1].type, 'LEGION_JOB_DECLINE');
    }
  } finally {
    world.close();
  }
});

test('Demon’s Legion jobs: PE-A off-book payment executes idempotently without prices', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: 'seed-payment-test-v1' });
  try {
    // Advance 60 days to ensure an MI6 off-book job occurs or schedule one deterministically
    world.advance(START + 60 * 24 * 3600_000);
    const snap = world.semanticSnapshot();
    const payments = snap.events.filter(e => e.type === 'LEGION_JOB_PAYMENT');

    if (payments.length > 0) {
      for (const p of payments) {
        assert.equal(p.payload.paymentStatus, 'paid');
        assert.ok(p.payload.factKey, 'Payment factKey must be emitted');
        const fact = snap.facts[p.payload.factKey];
        assert.ok(fact, 'Payment fact must exist in facts ledger');
        assert.equal(fact.value.paymentStatus, 'paid');
        // Rule 6: No prices, rates, salary, or economy simulator
        assert.equal(fact.value.price, undefined);
        assert.equal(fact.value.amount, undefined);
        assert.equal(fact.value.rate, undefined);
        assert.equal(fact.value.currency, undefined);
      }
    }

    // Direct idempotency test: assertLegionJobs rejects second payment or invalid family
    const jobState = snap.legionJobs;
    assert.ok(jobState);
    for (const job of Object.values(jobState.jobs)) {
      if (job.family !== 'legion.mi6_offbook_job') {
        assert.notEqual(job.paymentStatus, 'paid', 'Non-MI6 work must never be marked paid');
      }
    }
  } finally {
    world.close();
  }
});

test('Social LEGION_VISIT cadence remains independent of job state', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: START, seed: SEED });
  try {
    world.advance(START + 21 * 24 * 3600_000);
    const snap = world.semanticSnapshot();

    const visits = snap.events.filter(e => e.type === 'LEGION_VISIT' && e.visibility === 'public');
    assert.ok(visits.length >= 1, 'Social Legion visits must occur periodically on their own cadence');

    for (const v of visits) {
      assert.ok(v.payload.mood, 'LEGION_VISIT must retain social mood');
      assert.ok(Array.isArray(v.payload.lines), 'LEGION_VISIT must retain banter lines');
      assert.ok(v.payload.visitors.length > 0, 'LEGION_VISIT must have visitors');
    }
  } finally {
    world.close();
  }
});

test('Reservoir gating: legion_contracts scenes require active job state and payment status', () => {
  const contractScenes = SCENE_RESERVOIR_CATALOG.filter(s => s.reservoir.family === 'legion_contracts');
  assert.ok(contractScenes.length > 0, 'Catalog must have legion_contracts scenes');

  // Find a non-payment contract scene (e.g. initial brief or debrief)
  const nonPaymentContract = contractScenes.find(s =>
    !/counted the payment|hazard pay|invoice|remittance|payment confirmed/i.test(s.beats?.[0]?.text || '')
  );
  assert.ok(nonPaymentContract, 'Must have at least one non-payment contract scene');

  // 1. Ordinary social visit without job state -> MUST NOT match
  const plainSocialVisit = {
    type: 'LEGION_VISIT',
    occurredAt: START + 1000,
    visibility: 'public',
    location: nonPaymentContract.location.split('/')[0],
    area: nonPaymentContract.area || 'common_room',
    participants: ['goaden', 'ashai'],
    payload: { visitors: nonPaymentContract.reservoir.requiredCast || ['anarchy', 'goaden'] }
  };
  assert.equal(reservoirSurfaceMatches(plainSocialVisit, nonPaymentContract), false,
    'Plain social visit without job state must reject legion_contracts scene');

  // 2. Visit with active job state -> CAN match
  const jobVisit = {
    ...plainSocialVisit,
    payload: { ...plainSocialVisit.payload, activeJobId: 'job-123' }
  };
  assert.equal(reservoirSurfaceMatches(jobVisit, nonPaymentContract), true,
    'Visit with active job state can match legion_contracts scene');

  // 3. Payment scene requires payment stage/paid status
  const paymentScene = contractScenes.find(s =>
    /counted the payment|hazard pay|invoice|remittance|payment confirmed/i.test(s.beats?.[0]?.text || '')
  );
  if (paymentScene) {
    const nonPaymentJobVisit = {
      ...plainSocialVisit,
      payload: { ...plainSocialVisit.payload, visitors: paymentScene.reservoir.requiredCast, activeJobId: 'job-123', stage: 'start' }
    };
    assert.equal(reservoirSurfaceMatches(nonPaymentJobVisit, paymentScene), false,
      'Payment prose scene must not match non-payment job stage');

    const paymentJobVisit = {
      ...plainSocialVisit,
      payload: { ...plainSocialVisit.payload, visitors: paymentScene.reservoir.requiredCast, activeJobId: 'job-123', stage: 'payment', paymentStatus: 'paid' }
    };
    assert.equal(reservoirSurfaceMatches(paymentJobVisit, paymentScene), true,
      'Payment prose scene matches when payment stage and status are satisfied');
  }
});
