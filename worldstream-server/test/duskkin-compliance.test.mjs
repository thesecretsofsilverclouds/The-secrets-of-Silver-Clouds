import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { openWorld } from '../src/world.mjs';
import { createFixture, RULES_VERSION } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { offscreenKnowsFact } from '../src/offscreen-lives.mjs';
import {
  initialDuskkinComplianceState,
  assertDuskkinCompliance,
  deriveDuskkinEvidence,
  deriveCouncilResponse,
  isQualifyingDuskkinSource,
  duskkinOpportunityActions,
  DUSKKIN_SOURCE_EVENT_TYPE,
  DUSKKIN_SOURCE_FACT_KIND,
  DUSKKIN_COMPLIANCE_EVENT_TYPES,
} from '../src/duskkin-compliance.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEED = 'test-seed-duskkin-v1';

const shape = action => ({
  type: action.type, dueAt: action.dueAt, priority: action.priority, day: action.day,
  version: action.version, caseId: action.caseId ?? null, caseToken: action.caseToken ?? null,
  actor: action.actor ?? null, actors: action.actors ?? [],
});

function sourceIncident({
  id = 'test/duskkin-source',
  dueAt = START + 2 * 60 * MIN,
  evidenceRefs = [],
  provenance = { path: 'committed_report' },
  extra = {},
} = {}) {
  return {
    id,
    type: DUSKKIN_SOURCE_EVENT_TYPE,
    dueAt,
    priority: 37,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    evidenceRefs,
    provenance,
    location: 'mi6',
    area: 'ops_room',
    ...extra,
  };
}

function seededWorld({
  seed = SEED,
  incidents = [sourceIncident()],
  extraState = {},
  offscreenPatch = null,
} = {}) {
  const current = createFixture({ startMs: START });
  const initial = current.initialState();
  initial.duskkinCompliance = {
    ...initialDuskkinComplianceState(),
    issued: Object.fromEntries(incidents.map(action => [action.id, {
      shape: shape(action), sourceEventId: `seed:${action.id}`, consumed: false,
    }])),
    ...extraState,
  };
  if (offscreenPatch) {
    initial.offscreenLives.people.zara = {
      ...initial.offscreenLives.people.zara,
      ...offscreenPatch,
    };
  }
  const fixture = {
    ...current,
    initialState: () => structuredClone(initial),
    initialActions: () => [...current.initialActions(), ...incidents],
    reduceAction: (state, action, seedValue) => current.reduceAction(state, action, seedValue),
  };
  return { world: new WorldStore({ dbPath: ':memory:', seed, fixture }), fixture };
}

function duskkinEvents(snap) {
  return snap.events.filter(e => DUSKKIN_COMPLIANCE_EVENT_TYPES.includes(e.type));
}

function typesOf(snap) {
  return duskkinEvents(snap).map(e => e.type);
}

function activeCase(snap) {
  const id = snap.duskkinCompliance.activeCaseId;
  return id ? snap.duskkinCompliance.cases[id] : null;
}

function firstCase(snap) {
  return Object.values(snap.duskkinCompliance.cases)[0] ?? null;
}

test('Duskkin rules version is active under current release', () => {
  assert.ok(['canon-ambient-p183-v26', 'canon-ambient-p183-v27', 'canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION));
  assert.ok(DUSKKIN_COMPLIANCE_EVENT_TYPES.includes(DUSKKIN_SOURCE_EVENT_TYPE));
});

test('deriveDuskkinEvidence uses named committed refs and ignores self-labels', () => {
  assert.equal(deriveDuskkinEvidence({ evidenceKind: 'verified_feeding' }), 'no_feeding_evidence');
  assert.equal(deriveDuskkinEvidence({ finding: 'verified_feeding' }), 'no_feeding_evidence');
  assert.equal(deriveDuskkinEvidence({ sourceKind: 'immediate_ongoing_danger' }), 'no_feeding_evidence');
  assert.equal(deriveDuskkinEvidence({}), 'no_feeding_evidence');
  assert.equal(deriveDuskkinEvidence({ evidenceRefs: [] }), 'no_feeding_evidence');
  assert.equal(deriveDuskkinEvidence({
    evidenceRefs: [{ factKey: 'rumour-1', kind: 'report', establishes: 'rumour' }],
  }), 'no_feeding_evidence');
  assert.equal(deriveDuskkinEvidence({
    evidenceRefs: [
      { factKey: 'looks-1', kind: 'observation', establishes: 'appearance' },
      { factKey: 'marks-1', kind: 'observation', establishes: 'hunt_marks' },
      { factKey: 'species-1', kind: 'observation', establishes: 'species' },
      { factKey: 'zara-1', kind: 'observation', establishes: 'zara_presence' },
    ],
  }), 'no_feeding_evidence');
  assert.equal(deriveDuskkinEvidence({
    evidenceKind: 'verified_feeding',
    evidenceRefs: [{ factKey: 'blood-1', kind: 'observation', establishes: 'human_blood_contact' }],
  }), 'human_blood_contact_insufficient_to_prove_feeding');
  assert.equal(deriveDuskkinEvidence({
    value: { evidenceRefs: [{ factKey: 'feed-1', kind: 'observation', establishes: 'actual_feeding' }] },
  }), 'verified_feeding');
  assert.equal(deriveDuskkinEvidence({
    evidenceRefs: [{ factKey: 'danger-1', kind: 'observation', establishes: 'immediate_ongoing_danger' }],
  }), 'immediate_ongoing_danger');
});

test('deriveCouncilResponse remains deterministic from evidence and liaison', () => {
  assert.equal(deriveCouncilResponse('no_feeding_evidence'), 'no_violation_supported');
  assert.equal(deriveCouncilResponse('unrelated_or_nonhuman_evidence'), 'no_violation_supported');
  assert.equal(deriveCouncilResponse('human_blood_contact_insufficient_to_prove_feeding', { hasLiaison: false }), 'further_duskkin_review');
  assert.equal(deriveCouncilResponse('human_blood_contact_insufficient_to_prove_feeding', { hasLiaison: true }), 'liaison_requested');
  assert.equal(deriveCouncilResponse('verified_feeding'), 'violation_acknowledged');
  assert.equal(deriveCouncilResponse('immediate_ongoing_danger'), 'violation_acknowledged');
});

test('isQualifyingDuskkinSource rejects generic INCIDENT flags and self-stamps', () => {
  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { kind: 'surge_incident' } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { duskkinInvolvement: true } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { duskkinRelevant: true } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { kind: 'duskkin_incident' } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: 'MEU_CASE_RESOLVE', payload: { family: 'duskkin_compliance' } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: 'CROSS_PATHS', payload: { who: 'zara' } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: DUSKKIN_SOURCE_EVENT_TYPE, payload: {} }), false);
  assert.equal(isQualifyingDuskkinSource({
    type: DUSKKIN_SOURCE_EVENT_TYPE,
    payload: { duskkinInvolvement: true, sourceFactKey: 'x', evidenceRefs: [] },
  }), false);
  assert.equal(isQualifyingDuskkinSource({
    type: DUSKKIN_SOURCE_EVENT_TYPE,
    payload: {
      sourceFactKey: 'day:duskkin-source-1',
      evidenceRefs: [],
      provenance: { path: 'committed_report' },
    },
  }), true);
});

test('canonical seeds do not manufacture Duskkin incidents through openWorld', () => {
  const world = openWorld({ dbPath: ':memory:', seed: 'silver-clouds-now-v1', startMs: START });
  try {
    world.advance(START + 3 * 24 * 3600_000);
    const snap = world.semanticSnapshot();
    assert.equal(snap.events.filter(e => e.type === DUSKKIN_SOURCE_EVENT_TYPE).length, 0);
    assert.equal(snap.events.filter(e => e.type === 'DUSKKIN_COMPLIANCE_NOTICE').length, 0);
    assert.equal(snap.characters.zara, undefined);
    assertDuskkinCompliance(snap);
  } finally {
    world.close();
  }
});

test('dedicated source through WorldStore opens a notice', () => {
  const { world } = seededWorld({
    incidents: [sourceIncident({ evidenceRefs: [], provenance: { path: 'committed_report' } })],
  });
  try {
    world.advance(START + 2 * 60 * MIN + 20 * MIN);
    const snap = world.semanticSnapshot();
    assert.ok(typesOf(snap).includes(DUSKKIN_SOURCE_EVENT_TYPE));
    assert.ok(typesOf(snap).includes('DUSKKIN_COMPLIANCE_NOTICE'));
    const source = snap.events.find(e => e.type === DUSKKIN_SOURCE_EVENT_TYPE);
    assert.equal(snap.facts[source.payload.sourceFactKey].kind, DUSKKIN_SOURCE_FACT_KIND);
    assert.ok(activeCase(snap));
    assert.equal(activeCase(snap).status, 'opened');
    assert.equal(snap.characters.zara, undefined);
  } finally {
    world.close();
  }
});

test('generic INCIDENT flags never open a Duskkin case even with a planted source fact', () => {
  const fixture = createFixture({ startMs: START });
  const state = fixture.initialState();
  state.facts['planted-duskkin'] = {
    key: 'planted-duskkin',
    kind: DUSKKIN_SOURCE_FACT_KIND,
    value: { evidenceRefs: [], provenance: { path: 'committed_report' } },
  };
  const opps = duskkinOpportunityActions({
    state,
    day: '2026-09-04',
    now: START + 60 * MIN,
    seed: SEED,
    parentActionId: 'act-1',
    parentEventId: 'evt-1',
    sourceEvent: {
      type: 'INCIDENT',
      payload: {
        duskkinInvolvement: true,
        duskkinRelevant: true,
        kind: 'duskkin_incident',
        sourceFactKey: 'planted-duskkin',
        evidenceRefs: [],
        provenance: { path: 'committed_report' },
      },
    },
  });
  assert.equal(opps.length, 0);
});

test('rumour source closes with no_violation_supported and teaches Zara offscreen', () => {
  const { world } = seededWorld({
    incidents: [sourceIncident({
      evidenceRefs: [],
      provenance: { path: 'committed_report' },
    })],
  });
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const types = typesOf(snap);
    assert.ok(types.includes('DUSKKIN_COMPLIANCE_EVIDENCE'));
    assert.ok(types.includes('DUSKKIN_EVIDENCE_TRANSFER'));
    assert.ok(types.includes('DUSKKIN_COUNCIL_RESPONSE'));
    assert.ok(types.includes('DUSKKIN_COMPLIANCE_CLOSE'));
    const closed = firstCase(snap);
    assert.equal(closed.status, 'closed');
    assert.equal(closed.evidence, 'no_feeding_evidence');
    assert.equal(closed.councilResponse, 'no_violation_supported');
    assert.equal(snap.duskkinCompliance.activeCaseId, null);
    assert.equal(snap.duskkinCompliance.closedSummaries.length, 1);
    assert.ok(snap.duskkinCompliance.nextEligibleAt >= START + 14 * 24 * 60 * MIN);
    const evidence = snap.events.find(e => e.type === 'DUSKKIN_COMPLIANCE_EVIDENCE');
    assert.ok(offscreenKnowsFact(snap, 'zara', evidence.payload.factKey, evidence.occurredAt + 2 * 60 * MIN));
    const response = snap.events.find(e => e.type === 'DUSKKIN_COUNCIL_RESPONSE');
    assert.ok(offscreenKnowsFact(snap, 'zara', response.payload.factKey, response.occurredAt + MIN));
    assert.equal(snap.characters.zara, undefined);
    assert.equal(response.payload.punishment, undefined);
    assert.equal(response.payload.sentence, undefined);
    assert.doesNotMatch(response.publicDescription ?? '', /punish|sentence|exile|MEU|MI6 punishment/i);
    assertDuskkinCompliance(snap);
  } finally {
    world.close();
  }
});

test('human-blood contact is insufficient to prove feeding', () => {
  const { world } = seededWorld({
    incidents: [sourceIncident({
      evidenceRefs: [{ factKey: 'obs:blood-1', kind: 'observation', establishes: 'human_blood_contact' }],
      provenance: { path: 'observation', observer: 'sector_watch' },
    })],
  });
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const evidence = snap.events.find(e => e.type === 'DUSKKIN_COMPLIANCE_EVIDENCE');
    assert.equal(evidence.payload.evidence, 'human_blood_contact_insufficient_to_prove_feeding');
    assert.equal(firstCase(snap).councilResponse, 'liaison_requested');
    assert.equal(snap.characters.zara, undefined);
  } finally {
    world.close();
  }
});

test('self-labelled verified_feeding is ignored unless a source fact establishes actual feeding', () => {
  const { world } = seededWorld({
    incidents: [sourceIncident({
      evidenceRefs: [],
      provenance: { path: 'committed_report' },
      extra: { evidenceKind: 'verified_feeding', finding: 'verified_feeding' },
    })],
  });
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const evidence = snap.events.find(e => e.type === 'DUSKKIN_COMPLIANCE_EVIDENCE');
    assert.equal(evidence.payload.evidence, 'no_feeding_evidence');
    assert.equal(firstCase(snap).councilResponse, 'no_violation_supported');
  } finally {
    world.close();
  }
});

test('legitimate actual_feeding source follows the verified-feeding evidence path', () => {
  const { world } = seededWorld({
    incidents: [sourceIncident({
      evidenceRefs: [{ factKey: 'obs:feed-1', kind: 'observation', establishes: 'actual_feeding' }],
      provenance: { path: 'observation', observer: 'sector_watch' },
    })],
  });
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const evidence = snap.events.find(e => e.type === 'DUSKKIN_COMPLIANCE_EVIDENCE');
    assert.equal(evidence.payload.evidence, 'verified_feeding');
    assert.equal(firstCase(snap).councilResponse, 'violation_acknowledged');
    assert.equal(firstCase(snap).contained, false);
    const response = snap.events.find(e => e.type === 'DUSKKIN_COUNCIL_RESPONSE');
    assert.equal(response.payload.punishment, undefined);
    assert.doesNotMatch(JSON.stringify(response.payload), /punish|sentence|exile|detention/);
  } finally {
    world.close();
  }
});

test('immediate danger uses public-safety containment without writing Council disposition', () => {
  const { world } = seededWorld({
    incidents: [sourceIncident({
      evidenceRefs: [{ factKey: 'obs:danger-1', kind: 'observation', establishes: 'immediate_ongoing_danger' }],
      provenance: { path: 'observation', observer: 'sector_watch' },
    })],
  });
  try {
    world.advance(START + 4 * 60 * MIN);
    const mid = world.semanticSnapshot();
    const contain = mid.events.find(e => e.type === 'DUSKKIN_PUBLIC_SAFETY_CONTAIN');
    assert.ok(contain);
    assert.equal(contain.payload.jurisdiction, 'public_safety_only');
    assert.equal(contain.payload.disposition, undefined);
    assert.equal(contain.payload.punishment, undefined);
    const during = Object.values(mid.duskkinCompliance.cases)[0];
    assert.equal(during.contained, true);
    assert.equal(during.councilResponse, null);
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    assert.equal(firstCase(snap).councilResponse, 'violation_acknowledged');
    assert.equal(firstCase(snap).status, 'closed');
    assertDuskkinCompliance(snap);
  } finally {
    world.close();
  }
});

test('Zara unavailable at evidence time skips transfer and still notifies Council', () => {
  const { world } = seededWorld({
    incidents: [sourceIncident({ evidenceRefs: [], provenance: { path: 'committed_report' } })],
    offscreenPatch: {
      lastSeen: {
        at: START + 10 * 60 * MIN,
        eventId: 'seed:zara-elsewhere',
        location: 'sanctuary',
        area: 'central_hub',
      },
    },
  });
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    assert.ok(!typesOf(snap).includes('DUSKKIN_EVIDENCE_TRANSFER'));
    assert.ok(typesOf(snap).includes('DUSKKIN_COUNCIL_NOTIFY'));
    assert.equal(firstCase(snap).transferredToLiaison, false);
    assert.equal(firstCase(snap).liaisonActor, null);
    const evidence = snap.events.find(e => e.type === 'DUSKKIN_COMPLIANCE_EVIDENCE');
    assert.equal(offscreenKnowsFact(snap, 'zara', evidence.payload.factKey, START + 8 * 60 * MIN), false);
    assert.equal(firstCase(snap).councilResponse, 'no_violation_supported');
    assert.equal(snap.characters.zara, undefined);
  } finally {
    world.close();
  }
});

test('issued transfer skips learn when Zara is busy and does not mark transferred', () => {
  const current = createFixture({ startMs: START });
  const initial = current.initialState();
  const caseId = 'duskkin:test-transfer-skip';
  const token = 'evt:seed:duskkin-v1';
  const transfer = {
    id: `${caseId}/transfer`,
    type: 'DUSKKIN_EVIDENCE_TRANSFER',
    dueAt: START + 2 * 60 * MIN,
    priority: 38,
    day: londonDate(START + 2 * 60 * MIN),
    actors: [],
    version: 1,
    caseId,
    caseToken: token,
  };
  initial.facts['2026-09-04:duskkin-evidence-duskkin:test-transfer-skip'] = {
    key: '2026-09-04:duskkin-evidence-duskkin:test-transfer-skip',
    kind: 'duskkin_compliance_evidence',
    subject: 'duskkin_compliance',
    value: { caseId, evidence: 'no_feeding_evidence' },
    createdAt: START,
    sourceEventId: 'evt:seed',
    validUntil: START + 7 * 24 * 60 * MIN,
  };
  initial.duskkinCompliance = {
    ...initialDuskkinComplianceState(),
    activeCaseId: caseId,
    cases: {
      [caseId]: {
        caseId, token, version: 1, system: 'duskkin_compliance',
        family: 'duskkin.feeding_evidence', status: 'investigating',
        openedAt: START, sourceEventIds: ['evt:seed'], sourceFactIds: [],
        owner: 'duskkin_compliance', participants: [],
        location: 'mi6', area: 'ops_room',
        evidence: 'no_feeding_evidence',
        contained: false, transferredToLiaison: false,
        liaisonActor: null, councilResponse: null, closedAt: null,
        dedupeKey: 'source:seed', originEventId: 'evt:seed',
        lastEventId: 'evt:seed', causalEventIds: ['evt:seed'],
      },
    },
    issued: {
      [transfer.id]: { shape: shape(transfer), sourceEventId: 'evt:seed', consumed: false },
    },
  };
  initial.offscreenLives.people.zara.lastSeen = {
    at: START + 10 * 60 * MIN,
    eventId: 'seed:zara-elsewhere',
    location: 'sanctuary',
    area: 'central_hub',
  };
  const fixture = {
    ...current,
    initialState: () => structuredClone(initial),
    initialActions: () => [...current.initialActions(), transfer],
    reduceAction: (state, action, seedValue) => current.reduceAction(state, action, seedValue),
  };
  const world = new WorldStore({ dbPath: ':memory:', seed: SEED, fixture });
  try {
    world.advance(START + 6 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const skipped = snap.events.find(e => e.type === 'DUSKKIN_EVIDENCE_TRANSFER');
    assert.equal(skipped.payload.outcome, 'skipped');
    assert.equal(skipped.payload.reason, 'zara_unavailable');
    assert.equal(firstCase(snap).transferredToLiaison, false);
    assert.equal(offscreenKnowsFact(snap, 'zara', '2026-09-04:duskkin-evidence-duskkin:test-transfer-skip', START + 6 * 60 * MIN), false);
    assert.ok(typesOf(snap).includes('DUSKKIN_COUNCIL_NOTIFY'));
    assert.equal(snap.characters.zara, undefined);
  } finally {
    world.close();
  }
});

test('terminal close releases the slot and a second close stays idempotent', () => {
  const { world, fixture } = seededWorld({
    incidents: [sourceIncident({ evidenceRefs: [], provenance: { path: 'committed_report' } })],
  });
  try {
    world.advance(START + 8 * 60 * MIN);
    const snap = world.semanticSnapshot();
    const closed = firstCase(snap);
    assert.equal(closed.status, 'closed');
    assert.equal(snap.duskkinCompliance.activeCaseId, null);
    const extraClose = {
      id: `${closed.caseId}/close-again`,
      type: 'DUSKKIN_COMPLIANCE_CLOSE',
      dueAt: START + 9 * 60 * MIN,
      priority: 38,
      day: londonDate(START + 9 * 60 * MIN),
      actors: [],
      version: 1,
      caseId: closed.caseId,
      caseToken: closed.token,
    };
    const replay = structuredClone(snap);
    replay.duskkinCompliance.issued[extraClose.id] = {
      shape: shape(extraClose), sourceEventId: 'evt:replay', consumed: false,
    };
    const { event } = fixture.reduceAction(replay, extraClose, SEED);
    assert.equal(event.payload.outcome, 'skipped');
    assert.equal(event.payload.reason, 'Case already closed');
    assert.equal(replay.duskkinCompliance.activeCaseId, null);
    assert.equal(replay.duskkinCompliance.closedSummaries.length, 1);
    assert.equal(replay.duskkinCompliance.cases[closed.caseId].status, 'closed');
  } finally {
    world.close();
  }
});

test('invariants reject generic liaison, Eirik, punishment, prose, and Zara-as-character', () => {
  const state = {
    duskkinCompliance: {
      ...initialDuskkinComplianceState(),
      cases: {
        'case-1': {
          caseId: 'case-1',
          family: 'duskkin.feeding_suspicion',
          status: 'opened',
          owner: 'duskkin_compliance',
          participants: ['duskkin_liaison']
        }
      },
      activeCaseId: 'case-1'
    }
  };
  assert.throws(() => assertDuskkinCompliance(state), /generic duskkin_liaison/);

  state.duskkinCompliance.cases['case-1'].participants = ['eirik'];
  assert.throws(() => assertDuskkinCompliance(state), /Eirik is not in London/);

  state.duskkinCompliance.cases['case-1'].participants = [];
  state.duskkinCompliance.cases['case-1'].punishment = 'exile';
  assert.throws(() => assertDuskkinCompliance(state), /MI6 cannot impose Duskkin punishment/);

  delete state.duskkinCompliance.cases['case-1'].punishment;
  state.duskkinCompliance.cases['case-1'].prose = 'Prose inside state';
  assert.throws(() => assertDuskkinCompliance(state), /No prose allowed/);

  delete state.duskkinCompliance.cases['case-1'].prose;
  state.duskkinCompliance.cases['case-1'].participants = ['balthazar'];
  assert.throws(() => assertDuskkinCompliance(state), /Balthazar cannot participate without Anarchy/);

  state.duskkinCompliance.cases['case-1'].participants = ['balthazar', 'anarchy'];
  assert.doesNotThrow(() => assertDuskkinCompliance(state));

  state.characters = { zara: { id: 'zara', knowledge: [] } };
  assert.throws(() => assertDuskkinCompliance(state), /not a core protagonist/);
});

test('opportunity gates still require a dedicated committed source fact', () => {
  const fixture = createFixture({ startMs: START });
  const state = fixture.initialState();
  const sourceEvent = {
    id: 'evt-dusk-source-3',
    type: DUSKKIN_SOURCE_EVENT_TYPE,
    occurredAt: START + 60 * MIN,
    payload: {
      sourceFactKey: 'missing',
      evidenceRefs: [],
      provenance: { path: 'committed_report' },
    }
  };

  state.duskkinCompliance.nextEligibleAt = START + 60 * MIN + 14 * 24 * 60 * MIN;
  let opps = duskkinOpportunityActions({
    state, day: '2026-09-04', now: START + 60 * MIN, seed: 'seed',
    parentActionId: 'p1', parentEventId: 'e1', sourceEvent
  });
  assert.equal(opps.length, 0, 'Must not open case while cooldown active');

  state.duskkinCompliance.nextEligibleAt = START;
  opps = duskkinOpportunityActions({
    state, day: '2026-09-04', now: START + 60 * MIN, seed: 'seed',
    parentActionId: 'p1', parentEventId: 'e1', sourceEvent
  });
  assert.equal(opps.length, 0, 'Missing source fact must not qualify');

  state.facts[sourceEvent.payload.sourceFactKey] = {
    key: sourceEvent.payload.sourceFactKey,
    kind: DUSKKIN_SOURCE_FACT_KIND,
    value: { evidenceRefs: [], provenance: sourceEvent.payload.provenance },
  };
  opps = duskkinOpportunityActions({
    state, day: '2026-09-04', now: START + 60 * MIN, seed: 'seed',
    parentActionId: 'p1', parentEventId: 'e1', sourceEvent
  });
  assert.equal(opps.length, 1);

  state.duskkinCompliance.activeCaseId = 'existing-active-case';
  state.duskkinCompliance.cases['existing-active-case'] = { status: 'opened' };
  opps = duskkinOpportunityActions({
    state, day: '2026-09-04', now: START + 60 * MIN, seed: 'seed',
    parentActionId: 'p2', parentEventId: 'e2', sourceEvent
  });
  assert.equal(opps.length, 0, 'Must not open second active case');
});
