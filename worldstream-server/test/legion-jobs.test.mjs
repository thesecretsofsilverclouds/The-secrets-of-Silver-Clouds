import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { openWorld } from '../src/world.mjs';
import { createFixture } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import {
  LEGION_JOB_OUTCOMES,
  initialLegionJobsState,
  assertLegionJobs,
  selectLegionJobParticipants,
  legionSourceRemit,
  legionJobOpportunityActions,
  mi6MayOfferLegionJob,
  mi6LegionReferralActions,
  legionCandidateAvailable,
} from '../src/legion-jobs.mjs';
import { LEGION_CONTRACT_BINDINGS } from '../src/legion-job-bindings.mjs';
import { selectReservoirSurface, reservoirSurfaceMatches } from '../src/scene-reservoir-select.mjs';
import { SCENE_RESERVOIR_CATALOG } from '../src/scene-reservoir-catalog.mjs';
import { editorialEvent } from '../src/editorial.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEED = 'test-seed-legion-v1';
const DECLINE_REASONS = new Set([
  'no_viable_roster', 'conflicting_commitment', 'physically_unavailable',
  'unsupported_job_fit', 'source_no_longer_valid',
]);

const shape = action => ({
  type: action.type, dueAt: action.dueAt, priority: action.priority, day: action.day,
  version: action.version, jobId: action.jobId ?? null, jobToken: action.jobToken ?? null,
  actor: action.actor ?? null, actors: action.actors ?? [],
});

function referralAction({ id = 'test/mi6-legion-referral', caseId = 'meu:test-contained', dueAt = START + 2 * 60 * MIN } = {}) {
  return {
    id, type: 'MI6_LEGION_REFERRAL', dueAt, priority: 36, day: londonDate(dueAt),
    actors: [], version: 1, caseId, sourceEventId: `evt:${caseId}`,
    meuFamily: 'meu.magic_misuse', location: 'mi6', area: 'ops_room',
  };
}

function seededWorld({ seed = SEED, referrals = [referralAction()], reservations = {}, extraState = {} } = {}) {
  const current = createFixture({ startMs: START });
  const initial = current.initialState();
  initial.legionJobs = {
    ...initialLegionJobsState(),
    reservations,
    issued: Object.fromEntries(referrals.map(action => [action.id, {
      shape: shape(action), sourceEventId: action.sourceEventId, consumed: false,
    }])),
    ...extraState,
  };
  const fixture = {
    ...current,
    initialState: () => structuredClone(initial),
    initialActions: () => [...current.initialActions(), ...referrals],
    reduceAction: (state, action, seedValue) => current.reduceAction(state, action, seedValue),
  };
  return new WorldStore({ dbPath: ':memory:', seed, fixture });
}

function jobCanon(snap) {
  return {
    jobs: snap.legionJobs,
    events: snap.events.filter(e => e.type === 'MI6_LEGION_REFERRAL' || e.type.startsWith('LEGION_JOB_'))
      .map(e => ({
        type: e.type, occurredAt: e.occurredAt, location: e.location, area: e.area,
        participants: e.participants, payload: e.payload,
      })),
  };
}

test('assertLegionJobs enforces leadership, roster, payment, slot and zero-prose rails', () => {
  assert.doesNotThrow(() => assertLegionJobs({ legionJobs: initialLegionJobsState() }));

  const goadenLead = { legionJobs: { ...initialLegionJobsState(), jobs: {
    j1: { jobId: 'j1', token: 't1', version: 1, system: 'legion', family: 'legion.mi6_offbook_job',
      status: 'offered', owner: 'legion', leader: 'goaden', participants: ['truth', 'rose'],
      paymentStatus: 'unpaid' },
  }, activeJobId: 'j1' } };
  assert.throws(() => assertLegionJobs(goadenLead), /Goaden cannot be Legion job leader/);

  const balthazarSolo = { legionJobs: { ...initialLegionJobsState(), jobs: {
    j2: { jobId: 'j2', token: 't2', version: 1, system: 'legion', family: 'legion.mi6_offbook_job',
      status: 'offered', owner: 'legion', leader: 'truth', participants: ['truth', 'balthazar'],
      paymentStatus: 'unpaid' },
  }, activeJobId: 'j2' } };
  assert.throws(() => assertLegionJobs(balthazarSolo), /Balthazar cannot participate without Anarchy/);

  const ashaiDefault = { legionJobs: { ...initialLegionJobsState(), jobs: {
    j3: { jobId: 'j3', token: 't3', version: 1, system: 'legion', family: 'legion.mi6_offbook_job',
      status: 'offered', owner: 'legion', leader: 'truth', participants: ['truth', 'ashai'],
      paymentStatus: 'unpaid' },
  }, activeJobId: 'j3' } };
  assert.throws(() => assertLegionJobs(ashaiDefault), /Ashai and Yukon are not default Legion members/);

  const paidCommunity = { legionJobs: { ...initialLegionJobsState(), jobs: {
    j4: { jobId: 'j4', token: 't4', version: 1, system: 'legion', family: 'legion.community_request',
      status: 'closed', owner: 'legion', leader: 'truth', participants: ['truth', 'rose'],
      paymentStatus: 'paid' },
  } } };
  assert.throws(() => assertLegionJobs(paidCommunity), /Payment is only permitted for MI6 off-book work/);

  const referred = { legionJobs: { ...initialLegionJobsState(), jobs: {
    j5: { jobId: 'j5', token: 't5', version: 1, system: 'legion', family: 'legion.mi6_offbook_job',
      status: 'closed', owner: 'legion', leader: 'truth', participants: ['truth', 'rose'],
      paymentStatus: 'unpaid', result: 'referred_to_meu' },
  } } };
  assert.throws(() => assertLegionJobs(referred), /Invalid Legion job result/);

  const openWithoutSlot = { legionJobs: { ...initialLegionJobsState(), jobs: {
    j6: { jobId: 'j6', token: 't6', version: 1, system: 'legion', family: 'legion.mi6_offbook_job',
      status: 'offered', owner: 'legion', leader: 'truth', participants: ['truth', 'rose'],
      paymentStatus: 'unpaid' },
  } } };
  assert.throws(() => assertLegionJobs(openWithoutSlot), /open Legion job must occupy activeJobId/);

  assert.ok(!LEGION_JOB_OUTCOMES.includes('referred_to_meu'));
});

test('selectLegionJobParticipants uses real availability and never auto-leads Goaden', () => {
  const free = { legionJobs: initialLegionJobsState(), characters: {} };
  const picked = selectLegionJobParticipants(free, START, 'seed-a', 'job-a');
  assert.ok(picked.participants.includes('truth'));
  assert.ok(!picked.participants.includes('goaden'));
  assert.ok(!picked.participants.includes('ashai'));
  assert.ok(!picked.participants.includes('yukon'));
  if (picked.participants.includes('balthazar')) {
    assert.ok(picked.participants.includes('anarchy'));
  }

  const busyTruth = {
    legionJobs: { ...initialLegionJobsState(), reservations: {
      truth: { jobId: 'other', startAt: START, until: START + 60 * MIN },
    } },
    characters: {},
  };
  const none = selectLegionJobParticipants(busyTruth, START + 10, 'seed-b', 'job-b');
  assert.deepEqual(none.participants, []);
  assert.equal(none.reason, 'no_viable_roster');
  assert.equal(legionCandidateAvailable(busyTruth, 'truth', START + 10), false);
});

test('raw incidents and referred_to_mi6 are not Legion job sources', () => {
  assert.equal(legionSourceRemit({ type: 'INCIDENT', payload: { kind: 'surge_incident' } }), null);
  assert.equal(legionSourceRemit({ type: 'INCIDENT', payload: { kind: 'confrontation' } }), null);
  assert.equal(legionSourceRemit({
    type: 'MEU_CASE_RESOLVE',
    payload: { outcome: 'referred_to_mi6', family: 'meu.artifact_irregularity' },
  }), null);
  assert.equal(legionSourceRemit({
    type: 'MEU_CASE_RESOLVE',
    payload: { outcome: 'contained', family: 'meu.magic_misuse' },
  }), null);
  assert.deepEqual(legionSourceRemit({
    type: 'MI6_LEGION_REFERRAL',
    payload: { caseId: 'meu:1', family: 'legion.mi6_offbook_job' },
  }), { family: 'legion.mi6_offbook_job', location: 'mi6', area: 'ops_room' });

  assert.equal(mi6MayOfferLegionJob({
    type: 'MEU_CASE_RESOLVE', payload: { outcome: 'referred_to_mi6', family: 'meu.artifact_irregularity' },
  }), false);
  assert.equal(mi6MayOfferLegionJob({
    type: 'MEU_CASE_RESOLVE', payload: { outcome: 'contained', family: 'meu.artifact_irregularity' },
  }), false);
  assert.equal(mi6MayOfferLegionJob({
    type: 'MEU_CASE_RESOLVE', payload: { outcome: 'contained', family: 'meu.magic_misuse' },
  }), true);

  const incidentOffer = legionJobOpportunityActions({
    state: { legionJobs: initialLegionJobsState(), arcs: { session: null } },
    day: '2026-09-04', now: START, seed: SEED,
    parentActionId: 'act-1', parentEventId: 'evt-1',
    sourceEvent: { type: 'INCIDENT', payload: { kind: 'surge_incident' } },
  });
  assert.equal(incidentOffer.length, 0);

  const artefactReferral = mi6LegionReferralActions({
    state: { legionJobs: initialLegionJobsState(), facts: {} },
    day: '2026-09-04', now: START, parentActionId: 'act-1', parentEventId: 'evt-1',
    sourceEvent: { type: 'MEU_CASE_RESOLVE', payload: {
      caseId: 'meu:art', outcome: 'referred_to_mi6', family: 'meu.artifact_irregularity',
    } },
  });
  assert.equal(artefactReferral.length, 0);
});

test('injected MI6 referral drives a bounded paid lifecycle with one slot from offer', () => {
  const world = seededWorld();
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const types = snap.events.filter(e => e.type === 'MI6_LEGION_REFERRAL' || e.type.startsWith('LEGION_JOB_'))
      .map(e => e.type);
    assert.ok(types.includes('MI6_LEGION_REFERRAL'));
    assert.ok(types.includes('LEGION_JOB_OFFER'));
    assert.ok(types.includes('LEGION_JOB_ACCEPT'), 'a free roster must accept rather than roll a decline');

    const offer = snap.events.find(e => e.type === 'LEGION_JOB_OFFER');
    assert.ok(offer.participants.includes('truth'));
    assert.ok(!offer.participants.includes('goaden'));
    assert.equal(offer.payload.family, 'legion.mi6_offbook_job');

    assert.ok(types.includes('LEGION_JOB_START'));
    assert.ok(types.includes('LEGION_JOB_REPORT'));
    assert.ok(types.includes('LEGION_JOB_RESOLVE'));
    assert.ok(types.includes('LEGION_JOB_PAYMENT'));
    assert.ok(types.includes('LEGION_JOB_CLOSE'));
    assert.equal(snap.events.filter(e => e.type === 'LEGION_JOB_PAYMENT').length, 1);
    const payment = snap.events.find(e => e.type === 'LEGION_JOB_PAYMENT');
    assert.equal(payment.payload.paymentStatus, 'paid');
    assert.equal(snap.facts[payment.payload.factKey].value.price, undefined);

    for (const e of snap.events.filter(e => e.type.startsWith('LEGION_JOB_'))) {
      assert.equal(e.payload.prose, undefined);
      if (e.participants.includes('balthazar')) assert.ok(e.participants.includes('anarchy'));
    }
    assert.ok(!snap.events.some(e => e.payload?.reason && !DECLINE_REASONS.has(e.payload.reason)
      && e.type === 'LEGION_JOB_DECLINE'));
  } finally {
    world.close();
  }
});

test('one-job slot is held from OFFER and a second source cannot open a duplicate', () => {
  const first = referralAction({ id: 'test/referral-a', caseId: 'meu:case-a', dueAt: START + 2 * 60 * MIN });
  const secondSame = referralAction({ id: 'test/referral-a-dup', caseId: 'meu:case-a', dueAt: START + 3 * 60 * MIN });
  const secondOther = referralAction({ id: 'test/referral-b', caseId: 'meu:case-b', dueAt: START + 3 * 60 * MIN });
  const world = seededWorld({ referrals: [first, secondSame, secondOther] });
  try {
    world.advance(START + 3 * 60 * MIN + 15 * MIN);
    const snap = world.semanticSnapshot();
    const offers = snap.events.filter(e => e.type === 'LEGION_JOB_OFFER');
    assert.equal(offers.length, 1, 'only the first source may occupy the offer slot');
    assert.ok(snap.legionJobs.activeJobId, 'offer occupies activeJobId');
    const open = Object.values(snap.legionJobs.jobs).filter(j => ['offered', 'active', 'reported', 'resolved'].includes(j.status));
    assert.equal(open.length, 1);
    assert.equal(new Set(offers.map(e => e.payload.sourceCaseId)).size, 1);
  } finally {
    world.close();
  }
});

test('decline occurs only when the roster is actually unavailable', () => {
  const world = seededWorld({
    reservations: { truth: { jobId: 'blocking', startAt: START, until: START + 24 * 60 * MIN } },
  });
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const declines = snap.events.filter(e => e.type === 'LEGION_JOB_DECLINE');
    assert.equal(declines.length, 1);
    assert.equal(declines[0].payload.reason, 'no_viable_roster');
    assert.ok(DECLINE_REASONS.has(declines[0].payload.reason));
    assert.equal(snap.events.filter(e => e.type === 'LEGION_JOB_ACCEPT').length, 0);
    assert.equal(snap.legionJobs.activeJobId, null);
  } finally {
    world.close();
  }
});

test('Goaden does not know a job he did not participate in or hear about', () => {
  const world = seededWorld();
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const jobFacts = Object.values(snap.facts).filter(f => String(f.kind).startsWith('legion_job_')
      || f.kind === 'mi6_legion_referral');
    const goadenKeys = new Set((snap.characters.goaden.knowledge ?? []).map(m => m.factKey));
    const ashaiKeys = new Set((snap.characters.ashai.knowledge ?? []).map(m => m.factKey));
    const handoffs = snap.events.filter(e => e.type === 'LEGION_JOB_HANDOFF_READ');
    for (const fact of jobFacts) {
      if (goadenKeys.has(fact.key)) {
        assert.ok(handoffs.some(e => e.payload?.actor === 'goaden' && e.payload?.factKey === fact.key),
          'Goaden may learn a job report only through an explicit handoff');
      }
      if (ashaiKeys.has(fact.key)) {
        assert.ok(handoffs.some(e => e.payload?.actor === 'ashai' && e.payload?.factKey === fact.key),
          'Ashai may learn a job report only through an explicit handoff');
      }
    }
    assert.ok(snap.events.some(e => e.type === 'LEGION_JOB_OFFER' && e.publicDescription),
      'public publish exists');
    assert.ok(!(snap.characters.goaden.knowledge ?? []).some(m => m.provenance === 'public_publish'));
  } finally {
    world.close();
  }
});

test('removing job prose leaves canonical job history unchanged', () => {
  const world = seededWorld();
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const before = jobCanon(snap);
    for (const event of snap.events.filter(e => e.type.startsWith('LEGION_JOB_') || e.type === 'LEGION_VISIT')) {
      editorialEvent(event);
    }
    assert.deepEqual(jobCanon(world.semanticSnapshot()), before);
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
      assert.equal(v.payload.activeJobId, undefined);
      assert.ok(v.payload.mood, 'LEGION_VISIT must retain social mood');
      assert.ok(Array.isArray(v.payload.lines), 'LEGION_VISIT must retain banter lines');
    }
  } finally {
    world.close();
  }
});

test('reservoir legion_contracts bind only to reviewed job stages', () => {
  const contractScenes = SCENE_RESERVOIR_CATALOG.filter(s => s.reservoir.family === 'legion_contracts');
  assert.ok(contractScenes.length > 0);
  assert.ok(!SCENE_RESERVOIR_CATALOG.some(s => String(s.reservoir.sourceId).startsWith('future.legionjob.')));

  const social = {
    type: 'LEGION_VISIT', occurredAt: START + 1000, visibility: 'public',
    location: 'mi6', area: 'ops_room', participants: ['goaden', 'anarchy'],
    payload: { visitors: ['anarchy', 'gabriel'], mood: 'billing', lines: ['x'] },
  };
  for (const scene of contractScenes) {
    assert.equal(reservoirSurfaceMatches(social, scene), false, `${scene.reservoir.sourceId} must not bind a social visit`);
  }

  const unbound = contractScenes.find(s => !LEGION_CONTRACT_BINDINGS[s.reservoir.sourceId]);
  assert.ok(unbound, 'catalog still contains unbound contract rows');
  const fakeJob = {
    type: 'LEGION_JOB_PAYMENT', occurredAt: START + 1000, visibility: 'public',
    location: unbound.location, area: unbound.area,
    participants: [...unbound.cast],
    payload: { stage: 'payment', paymentStatus: 'paid', family: 'legion.mi6_offbook_job' },
  };
  assert.equal(reservoirSurfaceMatches(fakeJob, unbound), false, 'unbound scene must not narrate a job');

  const offerBound = contractScenes.find(s => LEGION_CONTRACT_BINDINGS[s.reservoir.sourceId]?.stages.includes('offer'));
  if (offerBound) {
    const offerEvent = {
      type: 'LEGION_JOB_OFFER', occurredAt: START + 1000, visibility: 'public',
      location: offerBound.location, area: offerBound.area,
      participants: [...offerBound.cast],
      payload: { stage: 'offer', family: 'legion.mi6_offbook_job' },
    };
    assert.equal(reservoirSurfaceMatches(offerEvent, offerBound), true);
    assert.equal(reservoirSurfaceMatches({ ...offerEvent, payload: { ...offerEvent.payload, stage: 'payment' } }, offerBound), false);
  }

  const paymentBound = contractScenes.find(s => LEGION_CONTRACT_BINDINGS[s.reservoir.sourceId]?.requirePaid);
  if (paymentBound) {
    const payEvent = {
      type: 'LEGION_JOB_PAYMENT', occurredAt: START + 1000, visibility: 'public',
      location: paymentBound.location, area: paymentBound.area,
      participants: [...paymentBound.cast],
      payload: { stage: 'payment', paymentStatus: 'paid', family: 'legion.mi6_offbook_job' },
    };
    assert.equal(reservoirSurfaceMatches(payEvent, paymentBound), true);
    assert.equal(reservoirSurfaceMatches({
      ...payEvent, type: 'LEGION_JOB_START', payload: { stage: 'start' },
    }, paymentBound), false);
  }

  assert.equal(selectReservoirSurface(social, { catalog: contractScenes }), null);
});
