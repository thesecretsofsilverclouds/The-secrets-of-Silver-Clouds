import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture, RULES_VERSION } from '../src/fixture.mjs';
import {
  initialDuskkinComplianceState,
  assertDuskkinCompliance,
  deriveDuskkinEvidence,
  deriveCouncilResponse,
  isQualifyingDuskkinSource,
  duskkinOpportunityActions,
  issueDuskkinComplianceActions,
  resolveDuskkinComplianceAction,
  DUSKKIN_COMPLIANCE_EVENT_TYPES
} from '../src/duskkin-compliance.mjs';
import { atLondon, MINUTE_MS as MIN } from '../src/time.mjs';

const start = atLondon('2026-09-05', '00:00');

function mockStoryContext(state, action, now = start + 30 * MIN) {
  const event = {
    id: `evt-${action.id}`,
    type: action.type,
    occurredAt: now,
    location: 'mi6',
    area: 'ops_room',
    participants: [],
    causedBy: [],
    payload: {},
    changes: [],
    visibility: 'private',
    publicDescription: null
  };
  const followups = [];
  return {
    state,
    action,
    now,
    id: event.id,
    event,
    followups,
    seed: 'duskkin-test-seed',
    ops: {
      setDuskkinCompliance: patch => { state.duskkinCompliance = patch; },
      setWorld: (field, val) => { state[field] = val; },
      setStory: (field, val) => { state[field] = val; },
      setActor: (who, field, val) => { if (state.characters?.[who?.id || who]) state.characters[who?.id || who][field] = val; },
      createFact: (key, kind, subject, value, validUntil) => {
        const fact = { key, kind, subject, value, validUntil, createdAt: now, sourceEventId: event.id };
        state.facts = state.facts || {};
        state.facts[key] = fact;
        return fact;
      },
      learn: (whoId, fact, provenance) => {
        const char = state.characters?.[whoId];
        if (char) {
          char.knowledge = char.knowledge || [];
          char.knowledge.push({
            factKey: fact.key,
            subject: fact.subject,
            sourceEventId: fact.sourceEventId,
            acquisitionEventId: event.id,
            learnedAt: now,
            validUntil: fact.validUntil,
            provenance,
            value: fact.value
          });
        }
      },
      publish: text => { event.visibility = 'public'; event.publicDescription = text; },
      skip: reason => { event.payload.outcome = 'skipped'; event.payload.reason = reason; }
    }
  };
}

test('Duskkin rules version is canon-ambient-p183-v26', () => {
  assert.equal(RULES_VERSION, 'canon-ambient-p183-v26');
});

test('deriveDuskkinEvidence: strictly deterministic from committed source facts (0 rolls)', () => {
  assert.equal(deriveDuskkinEvidence({ evidenceKind: 'verified_feeding' }), 'verified_feeding');
  assert.equal(deriveDuskkinEvidence({ evidenceKind: 'immediate_ongoing_danger' }), 'immediate_ongoing_danger');
  assert.equal(deriveDuskkinEvidence({ evidenceKind: 'human_blood_contact' }), 'human_blood_contact_insufficient_to_prove_feeding');
  assert.equal(deriveDuskkinEvidence({ evidenceKind: 'nonhuman_blood' }), 'unrelated_or_nonhuman_evidence');
  assert.equal(deriveDuskkinEvidence({ evidenceKind: 'unrelated_evidence' }), 'unrelated_or_nonhuman_evidence');
  assert.equal(deriveDuskkinEvidence({}), 'no_feeding_evidence');
  assert.equal(deriveDuskkinEvidence({ finding: 'unverified_rumour' }), 'no_feeding_evidence');
});

test('deriveCouncilResponse: strictly deterministic from evidence and liaison (0 rolls)', () => {
  assert.equal(deriveCouncilResponse('no_feeding_evidence'), 'no_violation_supported');
  assert.equal(deriveCouncilResponse('unrelated_or_nonhuman_evidence'), 'no_violation_supported');
  assert.equal(deriveCouncilResponse('human_blood_contact_insufficient_to_prove_feeding', { hasLiaison: false }), 'further_duskkin_review');
  assert.equal(deriveCouncilResponse('human_blood_contact_insufficient_to_prove_feeding', { hasLiaison: true }), 'liaison_requested');
  assert.equal(deriveCouncilResponse('verified_feeding'), 'violation_acknowledged');
  assert.equal(deriveCouncilResponse('immediate_ongoing_danger'), 'violation_acknowledged');
});

test('isQualifyingDuskkinSource: strictly requires genuine Duskkin source fact', () => {
  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { kind: 'surge_incident' } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { kind: 'artefact' } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: 'MEU_CASE_RESOLVE', payload: { outcome: 'contained' } }), false);
  assert.equal(isQualifyingDuskkinSource({ type: 'CROSS_PATHS', payload: { who: 'zara' } }), false);

  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { duskkinInvolvement: true } }), true);
  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { duskkinRelevant: true } }), true);
  assert.equal(isQualifyingDuskkinSource({ type: 'INCIDENT', payload: { kind: 'duskkin_incident' } }), true);
  assert.equal(isQualifyingDuskkinSource({ type: 'DUSKKIN_COMPLIANCE_INCIDENT', payload: {} }), true);
  assert.equal(isQualifyingDuskkinSource({ type: 'MEU_CASE_RESOLVE', payload: { family: 'duskkin_compliance' } }), true);
});

test('Full lifecycle for unverified rumour: suspicion != guilt, no punishment, clean expiry/closure', () => {
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  state.characters.zara = { id: 'zara', name: 'Zara', location: 'mi6', area: 'ops_room', knowledge: [], activity: 'unhurried_time' };

  // Trigger opportunity
  const sourceEvent = {
    id: 'evt-dusk-source-1',
    type: 'INCIDENT',
    occurredAt: start + 60 * MIN,
    location: 'mi6',
    area: 'ops_room',
    payload: { duskkinInvolvement: true, finding: 'unverified_rumour' }
  };
  const opps = duskkinOpportunityActions({
    state,
    day: '2026-09-05',
    now: start + 60 * MIN,
    seed: 'test-seed',
    parentActionId: 'act-parent-1',
    parentEventId: sourceEvent.id,
    sourceEvent
  });
  assert.equal(opps.length, 1);
  const noticeAction = opps[0];
  assert.equal(noticeAction.type, 'DUSKKIN_COMPLIANCE_NOTICE');

  // Issue & Resolve NOTICE
  const ctxSource = mockStoryContext(state, { type: 'INCIDENT', dueAt: start + 60 * MIN }, start + 60 * MIN);
  issueDuskkinComplianceActions(ctxSource, opps);

  const ctxNotice = mockStoryContext(state, noticeAction, noticeAction.dueAt);
  resolveDuskkinComplianceAction(ctxNotice);

  assert.equal(state.duskkinCompliance.activeCaseId, noticeAction.caseId);
  const getCase = () => state.duskkinCompliance.cases[noticeAction.caseId];
  assert.equal(getCase().status, 'opened');
  assert.equal(getCase().owner, 'duskkin_compliance');
  assert.equal(ctxNotice.followups.length, 1);
  const evidenceAction = ctxNotice.followups[0];
  assert.equal(evidenceAction.type, 'DUSKKIN_COMPLIANCE_EVIDENCE');

  // Resolve EVIDENCE
  const ctxEvidence = mockStoryContext(state, evidenceAction, evidenceAction.dueAt);
  resolveDuskkinComplianceAction(ctxEvidence);

  assert.equal(getCase().status, 'investigating');
  assert.equal(getCase().evidence, 'no_feeding_evidence');
  assert.equal(ctxEvidence.followups.length, 1);
  const transferAction = ctxEvidence.followups[0];
  assert.equal(transferAction.type, 'DUSKKIN_EVIDENCE_TRANSFER');

  // Resolve EVIDENCE_TRANSFER (Zara learns evidence)
  assert.ok(!state.characters.zara.knowledge.some(k => k.factKey.includes('duskkin-evidence')));
  const ctxTransfer = mockStoryContext(state, transferAction, transferAction.dueAt);
  resolveDuskkinComplianceAction(ctxTransfer);

  assert.equal(getCase().status, 'transferred');
  assert.equal(getCase().transferredToLiaison, true);
  assert.equal(getCase().liaisonActor, 'zara');
  assert.ok(state.characters.zara.knowledge.some(k => k.factKey.includes('duskkin-evidence')), 'Zara must learn transferred evidence');
  assert.equal(ctxTransfer.followups.length, 1);
  const notifyAction = ctxTransfer.followups[0];
  assert.equal(notifyAction.type, 'DUSKKIN_COUNCIL_NOTIFY');

  // Resolve COUNCIL_NOTIFY
  const ctxNotify = mockStoryContext(state, notifyAction, notifyAction.dueAt);
  resolveDuskkinComplianceAction(ctxNotify);

  assert.equal(getCase().status, 'notified');
  assert.equal(ctxNotify.followups.length, 1);
  const responseAction = ctxNotify.followups[0];
  assert.equal(responseAction.type, 'DUSKKIN_COUNCIL_RESPONSE');

  // Resolve COUNCIL_RESPONSE
  const ctxResponse = mockStoryContext(state, responseAction, responseAction.dueAt);
  resolveDuskkinComplianceAction(ctxResponse);

  assert.equal(getCase().status, 'responded');
  assert.equal(getCase().councilResponse, 'no_violation_supported');
  assert.ok(state.characters.zara.knowledge.some(k => k.factKey.includes('duskkin-response')), 'Zara must learn Council response');
  assert.equal(ctxResponse.followups.length, 1);
  const closeAction = ctxResponse.followups[0];
  assert.equal(closeAction.type, 'DUSKKIN_COMPLIANCE_CLOSE');

  // Resolve CLOSE
  const ctxClose = mockStoryContext(state, closeAction, closeAction.dueAt);
  resolveDuskkinComplianceAction(ctxClose);

  assert.equal(getCase().status, 'closed');
  assert.equal(state.duskkinCompliance.activeCaseId, null);
  assert.equal(state.duskkinCompliance.closedSummaries.length, 1);
  assert.equal(state.duskkinCompliance.closedSummaries[0].councilResponse, 'no_violation_supported');
  assert.ok(state.duskkinCompliance.nextEligibleAt >= closeAction.dueAt + 14 * 24 * 60 * MIN, 'Cooldown must be >= 14 days');

  // Assert canonical state integrity
  assertDuskkinCompliance(state);
});

test('Full lifecycle for immediate ongoing danger: public safety containment separated from Council disposition', () => {
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  state.characters.zara = { id: 'zara', name: 'Zara', location: 'mi6', area: 'ops_room', knowledge: [], activity: 'unhurried_time' };

  const sourceEvent = {
    id: 'evt-dusk-source-2',
    type: 'INCIDENT',
    occurredAt: start + 60 * MIN,
    location: 'mi6',
    area: 'ops_room',
    payload: { duskkinInvolvement: true, evidenceKind: 'immediate_ongoing_danger' }
  };
  const opps = duskkinOpportunityActions({
    state,
    day: '2026-09-05',
    now: start + 60 * MIN,
    seed: 'test-seed-2',
    parentActionId: 'act-parent-2',
    parentEventId: sourceEvent.id,
    sourceEvent
  });
  const noticeAction = opps[0];
  const ctxSource = mockStoryContext(state, { type: 'INCIDENT', dueAt: start + 60 * MIN }, start + 60 * MIN);
  issueDuskkinComplianceActions(ctxSource, opps);

  const ctxNotice = mockStoryContext(state, noticeAction, noticeAction.dueAt);
  resolveDuskkinComplianceAction(ctxNotice);
  const evidenceAction = ctxNotice.followups[0];

  const ctxEvidence = mockStoryContext(state, evidenceAction, evidenceAction.dueAt);
  resolveDuskkinComplianceAction(ctxEvidence);

  const getCase = () => state.duskkinCompliance.cases[noticeAction.caseId];
  assert.equal(getCase().evidence, 'immediate_ongoing_danger');
  // Must schedule PUBLIC_SAFETY_CONTAIN when immediate ongoing danger
  assert.equal(ctxEvidence.followups[0].type, 'DUSKKIN_PUBLIC_SAFETY_CONTAIN');
  const containAction = ctxEvidence.followups[0];

  // Resolve PUBLIC_SAFETY_CONTAIN
  const ctxContain = mockStoryContext(state, containAction, containAction.dueAt);
  resolveDuskkinComplianceAction(ctxContain);

  assert.equal(getCase().contained, true);
  assert.equal(getCase().status, 'contained');
  assert.equal(ctxContain.event.payload.jurisdiction, 'public_safety_only');
  assert.equal(ctxContain.event.payload.disposition, 'referred_to_duskkin_council');
  assert.equal(ctxContain.event.payload.punishment, undefined, 'MI6 cannot impose Duskkin punishment');

  // Follow-up: evidence transfer to Zara
  const transferAction = ctxContain.followups[0];
  assert.equal(transferAction.type, 'DUSKKIN_EVIDENCE_TRANSFER');
  const ctxTransfer = mockStoryContext(state, transferAction, transferAction.dueAt);
  resolveDuskkinComplianceAction(ctxTransfer);

  // Follow-up: notify Council
  const notifyAction = ctxTransfer.followups[0];
  const ctxNotify = mockStoryContext(state, notifyAction, notifyAction.dueAt);
  resolveDuskkinComplianceAction(ctxNotify);

  // Follow-up: Council response
  const responseAction = ctxNotify.followups[0];
  const ctxResponse = mockStoryContext(state, responseAction, responseAction.dueAt);
  resolveDuskkinComplianceAction(ctxResponse);

  assert.equal(getCase().councilResponse, 'violation_acknowledged');

  // Follow-up: close
  const closeAction = ctxResponse.followups[0];
  const ctxClose = mockStoryContext(state, closeAction, closeAction.dueAt);
  resolveDuskkinComplianceAction(ctxClose);

  assert.equal(getCase().status, 'closed');
  assertDuskkinCompliance(state);
});

test('Invariants: generic liaison, Eirik in London, and MI6 punishment are rejected', () => {
  const state = {
    duskkinCompliance: {
      ...initialDuskkinComplianceState(),
      cases: {
        'case-1': {
          caseId: 'case-1',
          family: 'duskkin.feeding_suspicion',
          status: 'opened',
          owner: 'duskkin_compliance',
          participants: ['duskkin_liaison'] // generic liaison forbidden
        }
      },
      activeCaseId: 'case-1'
    }
  };
  assert.throws(() => assertDuskkinCompliance(state), /generic duskkin_liaison/);

  state.duskkinCompliance.cases['case-1'].participants = ['eirik']; // Eirik in London forbidden
  assert.throws(() => assertDuskkinCompliance(state), /Eirik is not in London/);

  state.duskkinCompliance.cases['case-1'].participants = [];
  state.duskkinCompliance.cases['case-1'].punishment = 'exile'; // MI6 punishment forbidden
  assert.throws(() => assertDuskkinCompliance(state), /MI6 cannot impose Duskkin punishment/);

  delete state.duskkinCompliance.cases['case-1'].punishment;
  state.duskkinCompliance.cases['case-1'].prose = 'Prose inside state'; // Zero prose forbidden
  assert.throws(() => assertDuskkinCompliance(state), /No prose allowed/);

  delete state.duskkinCompliance.cases['case-1'].prose;
  state.duskkinCompliance.cases['case-1'].participants = ['balthazar']; // Balthazar without Anarchy
  assert.throws(() => assertDuskkinCompliance(state), /Balthazar cannot participate without Anarchy/);

  state.duskkinCompliance.cases['case-1'].participants = ['balthazar', 'anarchy'];
  assert.doesNotThrow(() => assertDuskkinCompliance(state));
});

test('Negative gates: max 1 active case and cooldown strictly enforced', () => {
  const fixture = createFixture({ startMs: start });
  const state = fixture.initialState();
  const sourceEvent = {
    id: 'evt-dusk-source-3',
    type: 'INCIDENT',
    occurredAt: start + 60 * MIN,
    payload: { duskkinInvolvement: true }
  };

  // Cooldown active
  state.duskkinCompliance.nextEligibleAt = start + 60 * MIN + 14 * 24 * 60 * MIN;
  let opps = duskkinOpportunityActions({
    state,
    day: '2026-09-05',
    now: start + 60 * MIN,
    seed: 'seed',
    parentActionId: 'p1',
    parentEventId: 'e1',
    sourceEvent
  });
  assert.equal(opps.length, 0, 'Must not open case while cooldown active');

  // Cooldown passed
  state.duskkinCompliance.nextEligibleAt = start;
  opps = duskkinOpportunityActions({
    state,
    day: '2026-09-05',
    now: start + 60 * MIN,
    seed: 'seed',
    parentActionId: 'p1',
    parentEventId: 'e1',
    sourceEvent
  });
  assert.equal(opps.length, 1);

  // Active case already occupies slot
  state.duskkinCompliance.activeCaseId = 'existing-active-case';
  state.duskkinCompliance.cases['existing-active-case'] = { status: 'opened' };
  opps = duskkinOpportunityActions({
    state,
    day: '2026-09-05',
    now: start + 60 * MIN,
    seed: 'seed',
    parentActionId: 'p2',
    parentEventId: 'e2',
    sourceEvent
  });
  assert.equal(opps.length, 0, 'Must not open second active case');
});
