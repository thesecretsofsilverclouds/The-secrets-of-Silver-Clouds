import { createHash } from 'node:crypto';
import { londonDate, MINUTE_MS as MIN } from './time.mjs';

// Addon Three: Duskkin compliance and diplomatic protocols
// Grounded in Canon CP-DUS-01..03, CP-X-01, and Silent PE-A (Duskkin authorities/Council manage violators).
// Models: credible source fact → notice → evidence → [public-safety contain] → evidence transfer → council notify → council response → close.
// Strict invariants:
// - Suspicion is not guilt (unverified rumours expire / resolve without guilt).
// - No random evidence rolls (deterministic derivation from committed source facts).
// - No invented feeding incidents merely to make addon fire.
// - No MI6 power to impose Duskkin punishment. Immediate London public safety handled by MEU/MI6 under public-safety remit.
// - Internal Duskkin disposition remains Duskkin-owned (Council).
// - Zara is an author-approved liaison (CP-DUS-03), never MI6 staff.
// - Zara learns evidence only when explicitly transferred.
// - No generic duskkin_liaison placeholder actor. Eirik is never in London.
// - No blood-ration economy.
// - Zero prose in canonical state or event payloads.

export const DUSKKIN_COMPLIANCE_VERSION = 1;

export const DUSKKIN_COMPLIANCE_EVENT_TYPES = Object.freeze([
  'DUSKKIN_COMPLIANCE_NOTICE',
  'DUSKKIN_COMPLIANCE_EVIDENCE',
  'DUSKKIN_PUBLIC_SAFETY_CONTAIN',
  'DUSKKIN_EVIDENCE_TRANSFER',
  'DUSKKIN_COUNCIL_NOTIFY',
  'DUSKKIN_COUNCIL_RESPONSE',
  'DUSKKIN_COMPLIANCE_CLOSE'
]);

export const DUSKKIN_COMPLIANCE_FACT_KINDS = Object.freeze([
  'duskkin_compliance_notice',
  'duskkin_compliance_evidence',
  'duskkin_public_safety',
  'duskkin_council_response'
]);

export const DUSKKIN_COMPLIANCE_FAMILIES = Object.freeze([
  'duskkin.feeding_suspicion',
  'duskkin.feeding_evidence',
  'duskkin.public_safety',
  'duskkin.council_referral',
  'duskkin.liaison_followup'
]);

export const DUSKKIN_EVIDENCE_STATES = Object.freeze([
  'no_feeding_evidence',
  'unrelated_or_nonhuman_evidence',
  'human_blood_contact_insufficient_to_prove_feeding',
  'verified_feeding',
  'immediate_ongoing_danger'
]);

export const DUSKKIN_COUNCIL_OUTCOMES = Object.freeze([
  'no_violation_supported',
  'further_duskkin_review',
  'violation_acknowledged',
  'liaison_requested'
]);

export const DUSKKIN_COMPLIANCE_STATUSES = Object.freeze([
  'opened',
  'investigating',
  'contained',
  'transferred',
  'notified',
  'responded',
  'closed'
]);

const TYPES = new Set(DUSKKIN_COMPLIANCE_EVENT_TYPES);
const FAMILIES = new Set(DUSKKIN_COMPLIANCE_FAMILIES);
const EVIDENCE_STATES = new Set(DUSKKIN_EVIDENCE_STATES);
const COUNCIL_OUTCOMES = new Set(DUSKKIN_COUNCIL_OUTCOMES);
const STATUSES = new Set(DUSKKIN_COMPLIANCE_STATUSES);
const OPEN_STATUSES = new Set(['opened', 'investigating', 'contained', 'transferred', 'notified', 'responded']);

const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);

export function initialDuskkinComplianceState() {
  return {
    version: 1,
    cases: {},
    activeCaseId: null,
    nextEligibleAt: 0,
    lastResult: null,
    closedSummaries: [],
    issued: {}
  };
}

export function assertDuskkinCompliance(state) {
  if (!state.duskkinCompliance) return;
  const current = of(state);
  if (!Number.isInteger(current.version)) throw new Error('Invalid duskkinCompliance version');
  if (typeof current.cases !== 'object' || current.cases === null) throw new Error('Invalid duskkinCompliance cases');
  if (current.closedSummaries.length > 24) throw new Error('Duskkin closedSummaries limit exceeded');
  if (Object.keys(current.issued).length > 128) throw new Error('Duskkin issued limit exceeded');

  const open = Object.values(current.cases).filter(c => OPEN_STATUSES.has(c.status));
  if (open.length > 1) throw new Error('At most one open Duskkin compliance case');

  if (current.activeCaseId != null) {
    if (typeof current.activeCaseId !== 'string' || !current.cases[current.activeCaseId]) {
      throw new Error('Duskkin activeCaseId must name an existing case');
    }
    if (!OPEN_STATUSES.has(current.cases[current.activeCaseId].status)) {
      throw new Error('Duskkin activeCaseId must name an open case');
    }
  } else if (open.length) {
    throw new Error('An open Duskkin compliance case must occupy activeCaseId');
  }

  for (const c of Object.values(current.cases)) {
    if (!FAMILIES.has(c.family)) throw new Error(`Invalid Duskkin compliance family: ${c.family}`);
    if (!STATUSES.has(c.status)) throw new Error(`Invalid Duskkin compliance status: ${c.status}`);
    if (c.evidence && !EVIDENCE_STATES.has(c.evidence)) throw new Error(`Invalid Duskkin evidence state: ${c.evidence}`);
    if (c.councilResponse && !COUNCIL_OUTCOMES.has(c.councilResponse)) throw new Error(`Invalid Duskkin Council response: ${c.councilResponse}`);
    if (c.owner !== 'duskkin_compliance' && c.owner !== 'duskkin') throw new Error(`Invalid Duskkin case owner: ${c.owner}`);

    // Canon Invariant: No MI6 power to impose Duskkin punishment
    if (c.punishment !== undefined || c.sentence !== undefined || c.verdict !== undefined) {
      throw new Error('MI6 cannot impose Duskkin punishment');
    }

    // Canon Invariant: No generic liaison actor; Eirik not in London
    if (c.actor === 'duskkin_liaison' || c.participants?.includes('duskkin_liaison')) {
      throw new Error('No generic duskkin_liaison placeholder actor permitted');
    }
    if (c.participants?.includes('eirik')) {
      throw new Error('Eirik is not in London and cannot participate in London compliance cases');
    }

    // Balthazar / Anarchy invariant
    if (Array.isArray(c.participants) && c.participants.includes('balthazar')) {
      if (!c.participants.includes('anarchy')) {
        throw new Error('Balthazar cannot participate without Anarchy');
      }
    }

    // Canon Invariant: Zara is liaison, not MI6 staff
    if (c.zaraIsStaff === true || c.zaraRole === 'mi6_staff') {
      throw new Error('Zara cannot be designated as MI6 staff');
    }

    // Zero prose invariant
    if (c.prose !== undefined || c.text !== undefined || c.narrative !== undefined || c.notes !== undefined) {
      throw new Error('No prose allowed in canonical Duskkin compliance state');
    }
  }
}

const of = state => state.duskkinCompliance ?? initialDuskkinComplianceState();
const caseOf = (state, id) => of(state).cases[id];

const shape = action => ({
  type: action.type,
  dueAt: action.dueAt,
  priority: action.priority,
  day: action.day,
  version: action.version,
  caseId: action.caseId ?? null,
  caseToken: action.caseToken ?? null,
  actor: action.actor ?? null,
  actors: action.actors ?? []
});

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const known = (actor, key, now) => actor?.knowledge?.some(memory =>
  memory.factKey === key && memory.learnedAt <= now && (memory.validUntil == null || memory.validUntil > now));

export function zaraCandidateAvailable(state, atMs) {
  if (!Number.isFinite(atMs)) return false;
  const arc = state.arcs?.session;
  if (arc?.cast?.includes('zara') && arc.startAt <= atMs && atMs < arc.until) return false;
  const bank = state.sceneBank?.session;
  if (bank?.cast?.includes('zara') && bank.startAt <= atMs && atMs < bank.until) return false;
  const support = state.agendas?.supporting?.zara?.commitment;
  if (support && support.startAt <= atMs && atMs < support.until) return false;
  const ch = state.characters?.zara;
  if (ch) {
    if (ch.journey) return false;
    if (ch.activity === 'sleeping') return false;
  }
  return true;
}

/**
 * Deterministically derive Duskkin evidence from committed source facts/properties.
 * Zero random rolls.
 */
export function deriveDuskkinEvidence(source = {}) {
  const { evidenceKind, finding, sourceKind } = source;
  const raw = evidenceKind || finding || sourceKind;
  if (raw === 'verified_feeding') return 'verified_feeding';
  if (raw === 'immediate_ongoing_danger') return 'immediate_ongoing_danger';
  if (raw === 'human_blood_contact') return 'human_blood_contact_insufficient_to_prove_feeding';
  if (raw === 'nonhuman_blood' || raw === 'unrelated_evidence') return 'unrelated_or_nonhuman_evidence';
  return 'no_feeding_evidence';
}

/**
 * Deterministically derive Council response from committed evidence and liaison state.
 * Zero random rolls.
 */
export function deriveCouncilResponse(evidence, { hasLiaison = false } = {}) {
  if (evidence === 'no_feeding_evidence' || evidence === 'unrelated_or_nonhuman_evidence') {
    return 'no_violation_supported';
  }
  if (evidence === 'human_blood_contact_insufficient_to_prove_feeding') {
    return hasLiaison ? 'liaison_requested' : 'further_duskkin_review';
  }
  if (evidence === 'verified_feeding' || evidence === 'immediate_ongoing_danger') {
    return 'violation_acknowledged';
  }
  return 'no_violation_supported';
}

/**
 * A Duskkin notice requires an explicit committed source fact carrying Duskkin relevance.
 * Generic INCIDENT, MEU case, or ordinary Zara presence do NOT qualify.
 */
export function isQualifyingDuskkinSource(sourceEvent) {
  if (!sourceEvent) return false;
  const payload = sourceEvent.payload ?? {};
  if (payload.duskkinInvolvement === true) return true;
  if (payload.duskkinRelevant === true) return true;
  if (payload.kind === 'duskkin_incident') return true;
  if (sourceEvent.type === 'DUSKKIN_COMPLIANCE_INCIDENT') return true;
  if (payload.family === 'duskkin_compliance') return true;
  return false;
}

function save(ctx, patch) {
  ctx.ops.setDuskkinCompliance({ ...of(ctx.state), ...patch });
}

function setCase(ctx, c) {
  save(ctx, { cases: { ...of(ctx.state).cases, [c.caseId]: c } });
}

function touchCase(ctx, c, patch) {
  const next = { ...c, ...patch, lastEventId: ctx.id, causalEventIds: [...new Set([...c.causalEventIds, ctx.id])] };
  setCase(ctx, next);
  return next;
}

function occupySlot(ctx, caseId) {
  save(ctx, { activeCaseId: caseId });
}

function releaseSlot(ctx, caseId, result, now, cooldown) {
  const current = of(ctx.state);
  save(ctx, {
    activeCaseId: current.activeCaseId === caseId ? null : current.activeCaseId,
    lastResult: result,
    nextEligibleAt: now + cooldown
  });
}

export function issueDuskkinComplianceActions(ctx, proposals) {
  const actions = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt) || action.dueAt <= ctx.now) {
      throw new Error('A Duskkin compliance action must be an owned future action');
    }
    const current = of(ctx.state);
    if (current.issued[action.id]) continue;
    const retained = Object.entries(current.issued).filter(([, row]) => row.shape.dueAt >= ctx.now - 4 * 24 * 60 * MIN);
    if (retained.length >= 128) throw new Error('Duskkin action budget exceeded');
    ctx.ops.setDuskkinCompliance({
      ...current,
      issued: {
        ...Object.fromEntries(retained),
        [action.id]: { shape: shape(action), sourceEventId: ctx.id, consumed: false }
      }
    });
    actions.push(action);
  }
  return actions;
}

export function duskkinOpportunityActions({ state, day, now, seed, parentActionId, parentEventId, sourceEvent }) {
  if (!parentActionId || !parentEventId || !sourceEvent) return [];
  const current = of(state);

  // Negative gate: at most 1 active compliance case
  if (current.activeCaseId) return [];
  if (Object.values(current.cases).some(c => OPEN_STATUSES.has(c.status))) return [];

  // Negative gate: cooldown between notices (≥14 days)
  if (now < current.nextEligibleAt) return [];

  // Negative gate: authored arc ownership
  if (state.arcs?.session || sourceEvent.payload?.arcId) return [];

  // Negative gate: genuine Duskkin source fact required
  if (!isQualifyingDuskkinSource(sourceEvent)) return [];

  const dedupeKey = `source:${parentEventId}`;
  if (current.closedSummaries.some(s => s.dedupeKey === dedupeKey)) return [];
  if (Object.values(current.cases).some(c => c.dedupeKey === dedupeKey)) return [];

  const dueAt = now + 15 * MIN;
  const caseId = `duskkin:${hash(`${seed}|duskkin-notice|${parentActionId}|${parentEventId}`)}`;
  const family = 'duskkin.feeding_suspicion';

  return [{
    id: `${parentActionId}/duskkin/notice`,
    type: 'DUSKKIN_COMPLIANCE_NOTICE',
    dueAt,
    priority: 38,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    caseId,
    family,
    sourceEventId: parentEventId,
    sourceType: sourceEvent.type,
    sourceKind: sourceEvent.payload?.kind ?? null,
    sourceFactKey: sourceEvent.payload?.factKey ?? null,
    evidenceKind: sourceEvent.payload?.evidenceKind ?? null,
    finding: sourceEvent.payload?.finding ?? null,
    location: sourceEvent.location || 'mi6',
    area: sourceEvent.area || 'ops_room',
    dedupeKey
  }];
}

function follow(ctx, c, type, slug, dueAt, extra = {}) {
  ctx.followups.push(...issueDuskkinComplianceActions(ctx, [{
    id: `${c.caseId}/${slug}`,
    type,
    dueAt,
    priority: 38,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    caseId: c.caseId,
    caseToken: c.token,
    ...extra
  }]));
}

export function resolveDuskkinComplianceAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const current = of(state), issuance = current.issued[a.id];
  const refuse = reason => { ops.skip(reason); return true; };

  if (!issuance || issuance.consumed || a.version !== 1 || !equal(shape(a), issuance.shape)) {
    return refuse('No owned Duskkin compliance action');
  }

  let c = a.caseId ? caseOf(state, a.caseId) : null;
  if (a.type !== 'DUSKKIN_COMPLIANCE_NOTICE' && (!c || a.caseToken !== c.token || c.version !== 1)) {
    return refuse('No matching Duskkin compliance case');
  }

  if (a.type === 'DUSKKIN_COMPLIANCE_NOTICE' && (current.activeCaseId || Object.values(current.cases).some(caseItem => OPEN_STATUSES.has(caseItem.status)))) {
    return refuse('An open Duskkin compliance case already exists');
  }

  save(ctx, { issued: { ...of(ctx.state).issued, [a.id]: { ...issuance, consumed: true } } });
  event.causedBy.push(issuance.sourceEventId);

  if (a.type === 'DUSKKIN_COMPLIANCE_NOTICE') {
    const caseToken = `${id}:duskkin-v1`;
    c = {
      caseId: a.caseId,
      token: caseToken,
      version: 1,
      system: 'duskkin_compliance',
      family: a.family,
      status: 'opened',
      openedAt: now,
      sourceEventIds: [a.sourceEventId],
      sourceFactIds: a.sourceFactKey ? [a.sourceFactKey] : [],
      sourceType: a.sourceType ?? null,
      sourceKind: a.sourceKind ?? null,
      sourceFactKey: a.sourceFactKey ?? null,
      evidenceKind: a.evidenceKind ?? null,
      finding: a.finding ?? null,
      owner: 'duskkin_compliance',
      participants: [],
      location: a.location,
      area: a.area,
      evidence: null,
      contained: false,
      transferredToLiaison: false,
      liaisonActor: null,
      councilResponse: null,
      closedAt: null,
      dedupeKey: a.dedupeKey,
      originEventId: id,
      lastEventId: id,
      causalEventIds: [id]
    };

    save(ctx, { cases: { ...of(ctx.state).cases, [c.caseId]: c } });
    occupySlot(ctx, c.caseId);

    const noticeKey = `${a.day}:duskkin-notice-${c.caseId}`;
    const noticeFact = ops.createFact(noticeKey, 'duskkin_compliance_notice', 'duskkin_compliance', {
      caseId: c.caseId, family: c.family, sourceEventId: a.sourceEventId
    }, now + 7 * 24 * 60 * MIN);
    touchCase(ctx, c, { sourceFactIds: [...c.sourceFactIds, noticeKey] });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: c.family, stage: 'notice', factKey: noticeKey, sourceEventId: a.sourceEventId };
    ops.publish(`Duskkin compliance notice recorded: preliminary review open under Sector Oversight.`);

    follow(ctx, c, 'DUSKKIN_COMPLIANCE_EVIDENCE', 'evidence', now + 30 * MIN);
    return true;
  }

  if (a.type === 'DUSKKIN_COMPLIANCE_EVIDENCE') {
    const evidence = deriveDuskkinEvidence({
      evidenceKind: c.evidenceKind,
      finding: c.finding,
      sourceKind: c.sourceKind
    });

    const factKey = `${a.day}:duskkin-evidence-${c.caseId}`;
    const evidenceFact = ops.createFact(factKey, 'duskkin_compliance_evidence', 'duskkin_compliance', {
      caseId: c.caseId, evidence, family: 'duskkin.feeding_evidence', sourceCaseId: c.caseId
    }, now + 7 * 24 * 60 * MIN);

    touchCase(ctx, c, {
      status: 'investigating',
      family: 'duskkin.feeding_evidence',
      evidence,
      sourceFactIds: [...c.sourceFactIds, factKey]
    });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: 'duskkin.feeding_evidence', stage: 'evidence', evidence, factKey };
    ops.publish(`Duskkin compliance evidence derived: ${evidence.replace(/_/g, ' ')}.`);

    if (evidence === 'immediate_ongoing_danger') {
      follow(ctx, c, 'DUSKKIN_PUBLIC_SAFETY_CONTAIN', 'contain', now + 20 * MIN);
    } else if (zaraCandidateAvailable(state, now + 30 * MIN)) {
      follow(ctx, c, 'DUSKKIN_EVIDENCE_TRANSFER', 'transfer', now + 30 * MIN);
    } else {
      follow(ctx, c, 'DUSKKIN_COUNCIL_NOTIFY', 'notify', now + 45 * MIN);
    }
    return true;
  }

  if (a.type === 'DUSKKIN_PUBLIC_SAFETY_CONTAIN') {
    // London public safety containment under MEU/MI6 remit (DC/LSE).
    // Invariant: This does NOT establish power to impose Duskkin punishment.
    const factKey = `${a.day}:duskkin-public-safety-${c.caseId}`;
    const safetyFact = ops.createFact(factKey, 'duskkin_public_safety', 'meu', {
      caseId: c.caseId,
      jurisdiction: 'public_safety_only',
      disposition: 'referred_to_duskkin_council'
    }, now + 7 * 24 * 60 * MIN);

    c = touchCase(ctx, c, {
      status: 'contained',
      contained: true,
      family: 'duskkin.public_safety',
      sourceFactIds: [...c.sourceFactIds, factKey]
    });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = {
      caseId: c.caseId,
      family: 'duskkin.public_safety',
      stage: 'public_safety_contain',
      jurisdiction: 'public_safety_only',
      disposition: 'referred_to_duskkin_council',
      factKey
    };
    ops.publish(`London public safety containment enacted for Case ${c.caseId}; Duskkin internal disposition remains Council-owned.`);

    if (zaraCandidateAvailable(state, now + 30 * MIN)) {
      follow(ctx, c, 'DUSKKIN_EVIDENCE_TRANSFER', 'transfer', now + 30 * MIN);
    } else {
      follow(ctx, c, 'DUSKKIN_COUNCIL_NOTIFY', 'notify', now + 45 * MIN);
    }
    return true;
  }

  if (a.type === 'DUSKKIN_EVIDENCE_TRANSFER') {
    // Evidence transfer to liaison Zara (CP-DUS-03).
    // Invariant: Zara is liaison, not MI6 staff.
    // Invariant: Zara learns evidence ONLY when transferred.
    const evidenceFact = state.facts[`${londonDate(c.openedAt)}:duskkin-evidence-${c.caseId}`]
      ?? Object.values(state.facts).find(fact => fact.kind === 'duskkin_compliance_evidence' && fact.value?.caseId === c.caseId);

    if (state.characters?.zara && evidenceFact && !known(state.characters.zara, evidenceFact.key, now)) {
      ops.learn('zara', evidenceFact, 'liaison_transfer');
    }

    touchCase(ctx, c, {
      status: 'transferred',
      transferredToLiaison: true,
      liaisonActor: 'zara',
      family: 'duskkin.liaison_followup',
      participants: ['zara']
    });

    event.location = 'mi6';
    event.area = 'ops_room';
    event.participants = ['zara'];
    event.payload = {
      caseId: c.caseId,
      family: 'duskkin.liaison_followup',
      stage: 'evidence_transfer',
      liaison: 'zara',
      liaisonRole: 'duskkin_liaison',
      evidence: c.evidence
    };
    ops.publish(`Evidence for Case ${c.caseId} transferred to Duskkin liaison Zara for Council review.`);

    follow(ctx, c, 'DUSKKIN_COUNCIL_NOTIFY', 'notify', now + 30 * MIN);
    return true;
  }

  if (a.type === 'DUSKKIN_COUNCIL_NOTIFY') {
    touchCase(ctx, c, {
      status: 'notified',
      family: 'duskkin.council_referral'
    });

    event.location = c.location;
    event.area = c.area;
    event.participants = c.liaisonActor ? [c.liaisonActor] : [];
    event.payload = {
      caseId: c.caseId,
      family: 'duskkin.council_referral',
      stage: 'council_notify',
      evidence: c.evidence
    };
    ops.publish(`Formal transmission dispatched to Duskkin Council for Case ${c.caseId}.`);

    follow(ctx, c, 'DUSKKIN_COUNCIL_RESPONSE', 'response', now + 60 * MIN);
    return true;
  }

  if (a.type === 'DUSKKIN_COUNCIL_RESPONSE') {
    const outcome = deriveCouncilResponse(c.evidence, { hasLiaison: c.transferredToLiaison });

    const factKey = `${a.day}:duskkin-response-${c.caseId}`;
    const responseFact = ops.createFact(factKey, 'duskkin_council_response', 'duskkin', {
      caseId: c.caseId,
      outcome,
      family: 'duskkin.council_referral',
      evidence: c.evidence
    }, now + 7 * 24 * 60 * MIN);

    touchCase(ctx, c, {
      status: 'responded',
      councilResponse: outcome,
      sourceFactIds: [...c.sourceFactIds, factKey]
    });

    // Invariant: If Zara is liaison, Zara learns the Council response
    if (c.liaisonActor === 'zara' && state.characters?.zara && responseFact) {
      ops.learn('zara', responseFact, 'council_response');
    }

    event.location = c.location;
    event.area = c.area;
    event.participants = c.liaisonActor ? [c.liaisonActor] : [];
    event.payload = {
      caseId: c.caseId,
      family: 'duskkin.council_referral',
      stage: 'council_response',
      outcome,
      factKey
    };
    ops.publish(`Duskkin Council response received: ${outcome.replace(/_/g, ' ')}.`);

    follow(ctx, c, 'DUSKKIN_COMPLIANCE_CLOSE', 'close', now + 30 * MIN);
    return true;
  }

  if (a.type === 'DUSKKIN_COMPLIANCE_CLOSE') {
    touchCase(ctx, c, { status: 'closed', closedAt: now });

    const summary = {
      caseId: c.caseId,
      family: c.family,
      openedAt: c.openedAt,
      closedAt: now,
      evidence: c.evidence,
      contained: c.contained,
      councilResponse: c.councilResponse,
      dedupeKey: c.dedupeKey
    };

    save(ctx, { closedSummaries: [summary, ...of(ctx.state).closedSummaries].slice(0, 24) });
    // 14 days cooldown between notices
    releaseSlot(ctx, c.caseId, c.councilResponse, now, 14 * 24 * 60 * MIN);

    event.location = c.location;
    event.area = c.area;
    event.participants = c.liaisonActor ? [c.liaisonActor] : [];
    event.payload = {
      caseId: c.caseId,
      family: c.family,
      stage: 'close',
      outcome: c.councilResponse,
      evidence: c.evidence
    };
    ops.publish(`Duskkin compliance case ${c.caseId} closed.`);
    return true;
  }

  return false;
}
