import { createHash } from 'node:crypto';
import { londonDate, MINUTE_MS as MIN } from './time.mjs';
import { learnOffscreenFact, offscreenAvailable, offscreenKnowsFact } from './offscreen-lives.mjs';

// Addon Three: Duskkin compliance and diplomatic protocols
// Grounded in Canon CP-DUS-01..03, CP-X-01, and Silent PE-A (Duskkin authorities/Council manage violators).
// Models: committed source fact → notice → evidence → [public-safety contain] → evidence transfer → council notify → council response → close.
// Strict invariants:
// - Suspicion is not guilt (unverified rumours expire / resolve without guilt).
// - No random evidence rolls (deterministic derivation from named committed evidence refs).
// - No invented feeding incidents merely to make addon fire.
// - No MI6 power to impose Duskkin punishment. Immediate London public safety handled by MEU/MI6 under public-safety remit.
// - Internal Duskkin disposition remains Duskkin-owned (Council).
// - Zara is an author-approved liaison (CP-DUS-03), never MI6 staff.
// - Zara learns evidence only when explicitly transferred, and only through offscreen supporting knowledge.
// - No generic duskkin_liaison placeholder actor. Eirik is never in London.
// - No blood-ration economy.
// - Zero prose in canonical state or event payloads.

export const DUSKKIN_COMPLIANCE_VERSION = 1;
export const DUSKKIN_SOURCE_EVENT_TYPE = 'DUSKKIN_COMPLIANCE_INCIDENT';
export const DUSKKIN_SOURCE_FACT_KIND = 'duskkin_compliance_source';
export const DUSKKIN_PROVENANCE_PATHS = Object.freeze(['observation', 'committed_report']);

export const DUSKKIN_COMPLIANCE_EVENT_TYPES = Object.freeze([
  DUSKKIN_SOURCE_EVENT_TYPE,
  'DUSKKIN_COMPLIANCE_NOTICE',
  'DUSKKIN_COMPLIANCE_EVIDENCE',
  'DUSKKIN_PUBLIC_SAFETY_CONTAIN',
  'DUSKKIN_EVIDENCE_TRANSFER',
  'DUSKKIN_COUNCIL_NOTIFY',
  'DUSKKIN_COUNCIL_RESPONSE',
  'DUSKKIN_COMPLIANCE_CLOSE'
]);

export const DUSKKIN_COMPLIANCE_FACT_KINDS = Object.freeze([
  DUSKKIN_SOURCE_FACT_KIND,
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

export const DUSKKIN_EVIDENCE_ESTABLISHES = Object.freeze({
  ACTUAL_FEEDING: 'actual_feeding',
  HUMAN_BLOOD_CONTACT: 'human_blood_contact',
  RUMOUR: 'rumour',
  IMMEDIATE_DANGER: 'immediate_ongoing_danger',
  NONHUMAN_BLOOD: 'nonhuman_blood',
  UNRELATED: 'unrelated_evidence',
});

const NEVER_PROOF = new Set([
  'appearance',
  'duskkin_appearance',
  'species',
  'hunt_marks',
  'hunt_trait',
  'zara_presence',
  'blood_looking',
  'imagery',
]);

const TYPES = new Set(DUSKKIN_COMPLIANCE_EVENT_TYPES);
const FAMILIES = new Set(DUSKKIN_COMPLIANCE_FAMILIES);
const EVIDENCE_STATES = new Set(DUSKKIN_EVIDENCE_STATES);
const COUNCIL_OUTCOMES = new Set(DUSKKIN_COUNCIL_OUTCOMES);
const STATUSES = new Set(DUSKKIN_COMPLIANCE_STATUSES);
const OPEN_STATUSES = new Set(['opened', 'investigating', 'contained', 'transferred', 'notified', 'responded']);
const CASELESS = new Set([DUSKKIN_SOURCE_EVENT_TYPE, 'DUSKKIN_COMPLIANCE_NOTICE']);

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
  if (state.characters?.zara) throw new Error('Zara is not a core protagonist actor');
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

    if (c.punishment !== undefined || c.sentence !== undefined || c.verdict !== undefined) {
      throw new Error('MI6 cannot impose Duskkin punishment');
    }

    if (c.actor === 'duskkin_liaison' || c.participants?.includes('duskkin_liaison')
      || c.liaisonRole === 'duskkin_liaison' || c.actor === 'duskkin_emissary'
      || c.participants?.includes('duskkin_emissary')) {
      throw new Error('No generic duskkin_liaison placeholder actor permitted');
    }
    if (c.participants?.includes('eirik')) {
      throw new Error('Eirik is not in London and cannot participate in London compliance cases');
    }

    if (Array.isArray(c.participants) && c.participants.includes('balthazar')) {
      if (!c.participants.includes('anarchy')) {
        throw new Error('Balthazar cannot participate without Anarchy');
      }
    }

    if (c.zaraIsStaff === true || c.zaraRole === 'mi6_staff') {
      throw new Error('Zara cannot be designated as MI6 staff');
    }

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

export function isValidDuskkinProvenance(provenance) {
  return Boolean(provenance && typeof provenance === 'object' && !Array.isArray(provenance)
    && DUSKKIN_PROVENANCE_PATHS.includes(provenance.path));
}

export function normalizeEvidenceRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return refs
    .filter(ref => ref && typeof ref.factKey === 'string' && ref.factKey.trim())
    .map(ref => ({
      factKey: ref.factKey.trim(),
      kind: typeof ref.kind === 'string' ? ref.kind : null,
      establishes: typeof ref.establishes === 'string' ? ref.establishes : 'rumour',
    }));
}

export function sourceEvidenceRefs(source = {}) {
  return normalizeEvidenceRefs(
    source.evidenceRefs
    ?? source.value?.evidenceRefs
    ?? source.payload?.evidenceRefs
  );
}

/**
 * Deterministically derive Duskkin evidence from named committed evidence refs.
 * Self-labels such as evidenceKind / finding / sourceKind are ignored.
 */
export function deriveDuskkinEvidence(source = {}) {
  const established = new Set();
  for (const ref of sourceEvidenceRefs(source)) {
    if (!ref.establishes || NEVER_PROOF.has(ref.establishes) || ref.establishes === 'rumour') continue;
    established.add(ref.establishes);
  }
  if (established.has('immediate_ongoing_danger')) return 'immediate_ongoing_danger';
  if (established.has('actual_feeding')) return 'verified_feeding';
  if (established.has('human_blood_contact')) return 'human_blood_contact_insufficient_to_prove_feeding';
  if (established.has('nonhuman_blood') || established.has('unrelated_evidence')) {
    return 'unrelated_or_nonhuman_evidence';
  }
  return 'no_feeding_evidence';
}

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
 * Only a dedicated DUSKKIN_COMPLIANCE_INCIDENT with provenance, a source fact
 * key, and an evidenceRefs array qualifies. Generic INCIDENT flags do not.
 */
export function isQualifyingDuskkinSource(sourceEvent) {
  if (!sourceEvent || sourceEvent.type !== DUSKKIN_SOURCE_EVENT_TYPE) return false;
  const payload = sourceEvent.payload ?? {};
  if (!isValidDuskkinProvenance(payload.provenance)) return false;
  if (typeof payload.sourceFactKey !== 'string' || !payload.sourceFactKey) return false;
  if (!Array.isArray(payload.evidenceRefs)) return false;
  return true;
}

export function zaraCandidateAvailable(state, atMs, until = atMs + 1) {
  if (!Number.isFinite(atMs) || !Number.isFinite(until) || until <= atMs) return false;
  if (!offscreenAvailable(state, 'zara', { atMs, until, location: 'mi6' })) return false;
  const support = state.agendas?.supporting?.zara?.commitment;
  if (support && support.startAt < until && atMs < support.until) return false;
  return true;
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

function teachZara(ctx, fact) {
  return learnOffscreenFact(ctx, 'zara', fact);
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

  if (current.activeCaseId) return [];
  if (Object.values(current.cases).some(c => OPEN_STATUSES.has(c.status))) return [];
  if (now < current.nextEligibleAt) return [];
  if (state.arcs?.session || sourceEvent.payload?.arcId) return [];
  if (!isQualifyingDuskkinSource(sourceEvent)) return [];

  const sourceFact = state.facts?.[sourceEvent.payload.sourceFactKey];
  if (!sourceFact || sourceFact.kind !== DUSKKIN_SOURCE_FACT_KIND) return [];

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
    sourceFactKey: sourceEvent.payload.sourceFactKey,
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
  if (!CASELESS.has(a.type) && (!c || a.caseToken !== c.token || c.version !== 1)) {
    return refuse('No matching Duskkin compliance case');
  }

  if (a.type === 'DUSKKIN_COMPLIANCE_NOTICE' && (current.activeCaseId || Object.values(current.cases).some(caseItem => OPEN_STATUSES.has(caseItem.status)))) {
    return refuse('An open Duskkin compliance case already exists');
  }
  if (a.type === 'DUSKKIN_COMPLIANCE_CLOSE' && c?.status === 'closed') {
    return refuse('Case already closed');
  }

  if (a.type === DUSKKIN_SOURCE_EVENT_TYPE) {
    save(ctx, { issued: { ...of(ctx.state).issued, [a.id]: { ...issuance, consumed: true } } });
    event.causedBy.push(issuance.sourceEventId);
    const evidenceRefs = normalizeEvidenceRefs(a.evidenceRefs);
    const provenance = a.provenance;
    if (!isValidDuskkinProvenance(provenance)) {
      return refuse('Duskkin source missing provenance');
    }
    const sourceFactKey = `${a.day}:duskkin-source-${id}`;
    ops.createFact(sourceFactKey, DUSKKIN_SOURCE_FACT_KIND, 'duskkin_compliance', {
      evidenceRefs,
      provenance,
      location: a.location || 'mi6',
      area: a.area || 'ops_room',
    }, now + 7 * 24 * 60 * MIN);
    event.location = a.location || 'mi6';
    event.area = a.area || 'ops_room';
    event.participants = [];
    event.payload = {
      sourceFactKey,
      evidenceRefs,
      provenance,
      stage: 'source',
    };
    ops.publish('Duskkin compliance source recorded.');
    return true;
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
      sourceFactKey: a.sourceFactKey ?? null,
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
    ops.createFact(noticeKey, 'duskkin_compliance_notice', 'duskkin_compliance', {
      caseId: c.caseId, family: c.family, sourceEventId: a.sourceEventId, sourceFactKey: c.sourceFactKey
    }, now + 7 * 24 * 60 * MIN);
    touchCase(ctx, c, { sourceFactIds: [...c.sourceFactIds, noticeKey] });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: c.family, stage: 'notice', factKey: noticeKey, sourceEventId: a.sourceEventId, sourceFactKey: c.sourceFactKey };
    ops.publish('Duskkin compliance notice recorded: preliminary review open under Sector Oversight.');

    follow(ctx, c, 'DUSKKIN_COMPLIANCE_EVIDENCE', 'evidence', now + 30 * MIN);
    return true;
  }

  if (a.type === 'DUSKKIN_COMPLIANCE_EVIDENCE') {
    const sourceFact = state.facts?.[c.sourceFactKey];
    const evidence = deriveDuskkinEvidence(sourceFact);

    const factKey = `${a.day}:duskkin-evidence-${c.caseId}`;
    ops.createFact(factKey, 'duskkin_compliance_evidence', 'duskkin_compliance', {
      caseId: c.caseId, evidence, family: 'duskkin.feeding_evidence', sourceFactKey: c.sourceFactKey
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
    event.payload = { caseId: c.caseId, family: 'duskkin.feeding_evidence', stage: 'evidence', evidence, factKey, sourceFactKey: c.sourceFactKey };
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
    const factKey = `${a.day}:duskkin-public-safety-${c.caseId}`;
    ops.createFact(factKey, 'duskkin_public_safety', 'meu', {
      caseId: c.caseId,
      jurisdiction: 'public_safety_only',
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
    if (!zaraCandidateAvailable(state, now)) {
      event.location = c.location;
      event.area = c.area;
      event.participants = [];
      event.payload = {
        caseId: c.caseId,
        family: c.family,
        stage: 'evidence_transfer',
        outcome: 'skipped',
        reason: 'zara_unavailable',
        liaison: 'zara',
      };
      ops.skip('Zara unavailable for evidence transfer');
      event.payload = {
        caseId: c.caseId,
        family: c.family,
        stage: 'evidence_transfer',
        outcome: 'skipped',
        reason: 'zara_unavailable',
        liaison: 'zara',
      };
      follow(ctx, c, 'DUSKKIN_COUNCIL_NOTIFY', 'notify', now + 30 * MIN);
      return true;
    }

    const evidenceFact = state.facts[`${londonDate(c.openedAt)}:duskkin-evidence-${c.caseId}`]
      ?? Object.values(state.facts).find(fact => fact.kind === 'duskkin_compliance_evidence' && fact.value?.caseId === c.caseId);

    if (evidenceFact && !offscreenKnowsFact(state, 'zara', evidenceFact.key, now)) {
      teachZara(ctx, evidenceFact);
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

    if (c.liaisonActor === 'zara' && c.transferredToLiaison && responseFact) {
      teachZara(ctx, responseFact);
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
