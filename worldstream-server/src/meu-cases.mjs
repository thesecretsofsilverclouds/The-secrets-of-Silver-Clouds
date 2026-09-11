import { createHash } from 'node:crypto';
import { londonDate, MINUTE_MS as MIN } from './time.mjs';

// Addon One: Magical London / MEU incidents
// Grounded in Direct Canon CP-MEU-01..03 and CP-X-02 (Manuscript pp.204-206, Codex & Lore).
// Reuses existing incident pressure (INCIDENT, ARCANE_SURGE, MINOR_ANOMALY, UNEASE).
// Does not create a second random incident generator or second scheduler.

export const MEU_CASE_VERSION = 1;
export const MEU_EVENT_TYPES = Object.freeze([
  'MEU_CASE_OPEN',
  'MEU_CASE_INSPECT',
  'MEU_CASE_REPORT',
  'MEU_CASE_ESCALATE',
  'MEU_CASE_RESOLVE',
  'MEU_CASE_CLOSE',
  'MEU_REPORT_READ'
]);
export const MEU_FACT_KINDS = Object.freeze([
  'meu_case_report',
  'meu_case_result'
]);
export const MEU_FAMILIES = Object.freeze([
  'meu.magic_misuse',
  'meu.artifact_irregularity',
  'meu.rogue_creature',
  'meu.ward_or_containment',
  'meu.weather_consequence'
]);
export const MEU_OUTCOMES = Object.freeze([
  'no_action',
  'advisory_or_monitor',
  'contained',
  'referred_to_mi6',
  'referred_external'
]);

const TYPES = new Set(MEU_EVENT_TYPES);
const FAMILIES = new Set(MEU_FAMILIES);

const FAMILY_SUPPORTED_FINDINGS = Object.freeze({
  'meu.magic_misuse': 'dangerous_magic_residue',
  'meu.artifact_irregularity': 'uncertain_unregistered_artefact',
  'meu.rogue_creature': 'rogue_creature_involvement',
  'meu.ward_or_containment': 'ward_containment_fault',
  'meu.weather_consequence': 'dangerous_magic_residue'
});

export function deriveInspectionEvidence(caseFamily, seed, actionId) {
  const supportedFinding = FAMILY_SUPPORTED_FINDINGS[caseFamily];
  if (!supportedFinding) return 'insufficient_evidence';
  const roll = hashInt(`${seed}|meu-inspect-evidence|${actionId}`) % 100;
  // 60% confirmed supported finding from source incident, 20% no actionable anomaly, 20% insufficient evidence
  if (roll < 60) return supportedFinding;
  if (roll < 80) return 'no_actionable_anomaly';
  return 'insufficient_evidence';
}

const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
const hashInt = value => createHash('sha256').update(String(value)).digest().readUInt32BE(0);

export function initialMeuCasesState() {
  return {
    version: 1,
    cases: {},
    activeCaseId: null,
    waitingReferralId: null,
    nextEligibleAt: 0,
    lastResult: null,
    closedSummaries: [],
    issued: {}
  };
}

export function assertMeuCases(state) {
  if (!state.meuCases) return;
  const current = of(state);
  if (!Number.isInteger(current.version)) throw new Error('Invalid meuCases version');
  if (typeof current.cases !== 'object' || current.cases === null) throw new Error('Invalid meuCases cases');
  if (current.closedSummaries.length > 24) throw new Error('MEU closedSummaries limit exceeded');
  if (Object.keys(current.issued).length > 128) throw new Error('MEU issued limit exceeded');
  for (const c of Object.values(current.cases)) {
    if (!MEU_FAMILIES.includes(c.family)) throw new Error(`Invalid MEU family: ${c.family}`);
    if (!['active', 'reported', 'resolved', 'closed'].includes(c.status)) throw new Error(`Invalid MEU case status: ${c.status}`);
    if (c.result && !['no_action', 'advisory_or_monitor', 'contained', 'referred_to_mi6', 'referred_external'].includes(c.result)) {
      throw new Error(`Invalid MEU case result: ${c.result}`);
    }
    if (c.prose !== undefined || c.text !== undefined) throw new Error('No prose allowed in canonical MEU case state');
  }
}

const of = state => state.meuCases ?? initialMeuCasesState();
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

const canReadReport = actor => actor?.location === 'mi6'
  && ['ops_room', 'briefing_room'].includes(actor.area)
  && !actor.journey
  && ['unhurried_time', 'in_a_briefing', 'on_call', 'waiting'].includes(actor.activity);

function save(ctx, patch) {
  ctx.ops.setMeuCases({ ...of(ctx.state), ...patch });
}

function setCase(ctx, c) {
  save(ctx, { cases: { ...of(ctx.state).cases, [c.caseId]: c } });
}

function touchCase(ctx, c, patch) {
  const next = { ...c, ...patch, lastEventId: ctx.id, causalEventIds: [...new Set([...c.causalEventIds, ctx.id])] };
  setCase(ctx, next);
  return next;
}

export function issueMeuCaseActions(ctx, proposals) {
  const actions = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt) || action.dueAt <= ctx.now) {
      throw new Error('A MEU case action must be an owned future action');
    }
    const current = of(ctx.state);
    if (current.issued[action.id]) continue;
    const retained = Object.entries(current.issued).filter(([, row]) => row.shape.dueAt >= ctx.now - 4 * 24 * 60 * MIN);
    if (retained.length >= 128) throw new Error('MEU action budget exceeded');
    ctx.ops.setMeuCases({
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

export function meuSourceRemit(sourceEvent) {
  if (!sourceEvent) return null;
  const type = sourceEvent.type;
  const kind = sourceEvent.payload?.kind;

  if (type === 'ARCANE_SURGE') {
    return {
      family: 'meu.magic_misuse',
      location: 'mi6',
      area: 'ops_room'
    };
  }

  if (type === 'INCIDENT') {
    if (kind === 'artefact') {
      return { family: 'meu.artifact_irregularity', location: 'mi6', area: 'ops_room' };
    }
    if (kind === 'surge_incident') {
      return { family: 'meu.magic_misuse', location: sourceEvent.location || 'big_ben_plaza', area: sourceEvent.area || 'venue' };
    }
    if (kind === 'sighting' || kind === 'pursuit' || kind === 'confrontation') {
      return { family: 'meu.rogue_creature', location: sourceEvent.location || 'big_ben_plaza', area: sourceEvent.area || 'venue' };
    }
    if (kind === 'breach') {
      return { family: 'meu.ward_or_containment', location: 'mi6', area: 'corridors' };
    }
    if (kind === 'severe_event') {
      return { family: 'meu.weather_consequence', location: sourceEvent.location || 'big_ben_plaza', area: sourceEvent.area || 'venue' };
    }
    if (kind === 'courier') {
      return { family: 'meu.artifact_irregularity', location: 'mi6', area: 'corridors' };
    }
  }

  return null;
}

export function meuCaseOpportunityActions({ state, day, now, seed, parentActionId, parentEventId, sourceEvent }) {
  if (!parentActionId || !parentEventId || !sourceEvent) return [];
  const current = of(state);

  // Negative gate: active-case cap (max 1 active case)
  if (current.activeCaseId) return [];

  // Negative gate: cooldown between openings (≥18h, tuned to 42h to yield 1–3 cases/week)
  if (now < current.nextEligibleAt) return [];

  // Negative gate: authored arc ownership
  if (state.arcs?.session || sourceEvent.payload?.arcId) return [];

  const remit = meuSourceRemit(sourceEvent);
  if (!remit) return [];

  const dedupeKey = `${sourceEvent.type}:${sourceEvent.payload?.kind || sourceEvent.id}`;
  if (current.closedSummaries.some(s => s.dedupeKey === dedupeKey)) return [];
  if (Object.values(current.cases).some(c => c.dedupeKey === dedupeKey)) return [];

  const dueAt = now + 15 * MIN;
  const caseId = `meu:${hash(`${seed}|meu-open|${parentActionId}|${parentEventId}`)}`;

  return [{
    id: `${parentActionId}/meu/open`,
    type: 'MEU_CASE_OPEN',
    dueAt,
    priority: 38,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    caseId,
    family: remit.family,
    sourceEventId: parentEventId,
    sourceLocation: remit.location,
    sourceArea: remit.area,
    dedupeKey
  }];
}

export function meuReportActions({ state, day, now, parentActionId }) {
  if (!parentActionId) return [];
  const reportedCases = Object.values(of(state).cases).filter(c =>
    c.report && c.report.createdAt < now && (now - c.report.createdAt < 3 * 24 * 60 * MIN)
  ).sort((a, b) => b.openedAt - a.openedAt);

  if (!reportedCases.length) return [];
  const latest = reportedCases[0];

  return ['goaden', 'ashai'].filter(who =>
    canReadReport(state.characters[who]) && !known(state.characters[who], latest.report.factKey, now)
  ).map(actor => ({
    id: `${parentActionId}/meu/read/${actor}`,
    type: 'MEU_REPORT_READ',
    dueAt: now + 1,
    priority: 38,
    day,
    actors: [],
    actor,
    version: 1,
    caseId: latest.caseId,
    caseToken: latest.token,
    factKey: latest.report.factKey
  }));
}

export function resolveMeuCaseAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const current = of(state), issuance = current.issued[a.id];
  const refuse = reason => { ops.skip(reason); return true; };

  if (!issuance || issuance.consumed || a.version !== 1 || !equal(shape(a), issuance.shape)) {
    return refuse('No owned MEU case action');
  }

  let c = a.caseId ? caseOf(state, a.caseId) : null;
  if (a.type !== 'MEU_CASE_OPEN' && (!c || a.caseToken !== c.token || c.version !== 1)) {
    return refuse('No matching MEU case');
  }

  if (c && ['MEU_CASE_INSPECT', 'MEU_CASE_REPORT', 'MEU_CASE_ESCALATE'].includes(a.type) && c.status !== 'active') {
    return refuse('Case is not active');
  }

  if (a.type === 'MEU_CASE_OPEN' && current.activeCaseId) {
    return refuse('An active MEU case already exists');
  }

  save(ctx, { issued: { ...current.issued, [a.id]: { ...issuance, consumed: true } } });
  event.causedBy.push(issuance.sourceEventId);

  if (a.type === 'MEU_CASE_OPEN') {
    const caseToken = `${id}:meu-v1`;
    c = {
      caseId: a.caseId,
      token: caseToken,
      version: 1,
      system: 'meu',
      family: a.family,
      status: 'active',
      openedAt: now,
      sourceEventIds: [a.sourceEventId],
      sourceFactIds: [],
      owner: 'meu',
      participants: [],
      location: a.sourceLocation,
      area: a.sourceArea,
      knowledgeAudience: [],
      deadlineAt: now + 24 * 60 * MIN,
      evidence: null,
      result: null,
      escalation: null,
      closedAt: null,
      dedupeKey: a.dedupeKey,
      originEventId: id,
      lastEventId: id,
      causalEventIds: [id]
    };

    save(ctx, {
      cases: { ...current.cases, [c.caseId]: c },
      activeCaseId: c.caseId,
      nextEligibleAt: now + 24 * 60 * MIN // ≥18h cooldown between case openings
    });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: c.family, stage: 'open', sourceEventId: a.sourceEventId };
    ops.publish(`MEU field dispatch: Case ${c.caseId} opened for ${c.family.replace('meu.', '').replace(/_/g, ' ')} inquiry.`);

    ctx.followups.push(...issueMeuCaseActions(ctx, [{
      id: `${c.caseId}/inspect`,
      type: 'MEU_CASE_INSPECT',
      dueAt: now + 60 * MIN,
      priority: 38,
      day: londonDate(now + 60 * MIN),
      actors: [],
      version: 1,
      caseId: c.caseId,
      caseToken: c.token
    }]));
    return true;
  }

  if (a.type === 'MEU_CASE_INSPECT') {
    const evidence = deriveInspectionEvidence(c.family, ctx.seed, a.id);

    touchCase(ctx, c, { evidence });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: c.family, stage: 'inspect', evidence };
    ops.publish(`MEU inspection report for Case ${c.caseId}: ${evidence.replace(/_/g, ' ')}.`);

    ctx.followups.push(...issueMeuCaseActions(ctx, [{
      id: `${c.caseId}/report`,
      type: 'MEU_CASE_REPORT',
      dueAt: now + 45 * MIN,
      priority: 38,
      day: londonDate(now + 45 * MIN),
      actors: [],
      version: 1,
      caseId: c.caseId,
      caseToken: c.token
    }]));
    return true;
  }

  if (a.type === 'MEU_CASE_REPORT') {
    const factKey = `${a.day}:meu-report-${c.caseId}`;
    const reportFact = ops.createFact(
      factKey,
      'meu_case_report',
      'meu',
      { caseId: c.caseId, family: c.family, evidence: c.evidence, location: c.location },
      now + 7 * 24 * 60 * MIN
    );

    const report = { factKey, createdAt: now, factId: reportFact?.id ?? factKey };

    // Serious escalation is rare
    let target = null;
    const roll = hashInt(`${ctx.seed}|meu-escalate|${a.id}`) % 100;
    if (c.evidence === 'uncertain_unregistered_artefact' && roll < 25) {
      target = 'mi6';
    } else if (c.evidence === 'ward_containment_fault' && roll < 20) {
      target = 'external';
    }

    touchCase(ctx, c, { report, sourceFactIds: [...c.sourceFactIds, factKey] });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: c.family, stage: 'report', evidence: c.evidence, factKey };
    ops.publish(`MEU preliminary case file filed: Case ${c.caseId} recorded in the sector ledger.`);

    if (target) {
      ctx.followups.push(...issueMeuCaseActions(ctx, [{
        id: `${c.caseId}/escalate`,
        type: 'MEU_CASE_ESCALATE',
        dueAt: now + 30 * MIN,
        priority: 38,
        day: londonDate(now + 30 * MIN),
        actors: [],
        version: 1,
        caseId: c.caseId,
        caseToken: c.token,
        target
      }]));
    } else {
      ctx.followups.push(...issueMeuCaseActions(ctx, [{
        id: `${c.caseId}/resolve`,
        type: 'MEU_CASE_RESOLVE',
        dueAt: now + 60 * MIN,
        priority: 38,
        day: londonDate(now + 60 * MIN),
        actors: [],
        version: 1,
        caseId: c.caseId,
        caseToken: c.token
      }]));
    }
    return true;
  }

  if (a.type === 'MEU_CASE_ESCALATE') {
    touchCase(ctx, c, { escalation: a.target });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: c.family, stage: 'escalate', target: a.target };
    ops.publish(`MEU Case ${c.caseId} escalated to ${a.target === 'mi6' ? 'MI6 Technical Directorate' : 'External Specialist Council'}.`);

    ctx.followups.push(...issueMeuCaseActions(ctx, [{
      id: `${c.caseId}/resolve`,
      type: 'MEU_CASE_RESOLVE',
      dueAt: now + 60 * MIN,
      priority: 38,
      day: londonDate(now + 60 * MIN),
      actors: [],
      version: 1,
      caseId: c.caseId,
      caseToken: c.token
    }]));
    return true;
  }

  if (a.type === 'MEU_CASE_RESOLVE') {
    let outcome;
    if (c.escalation === 'mi6') {
      outcome = 'referred_to_mi6';
    } else if (c.escalation === 'external') {
      outcome = 'referred_external';
    } else if (c.evidence === 'no_actionable_anomaly') {
      outcome = 'no_action';
    } else if (c.evidence === 'insufficient_evidence') {
      outcome = hashInt(`${ctx.seed}|meu-res|${a.id}`) % 2 === 0 ? 'no_action' : 'advisory_or_monitor';
    } else if (c.evidence === 'dangerous_magic_residue' || c.evidence === 'rogue_creature_involvement') {
      outcome = 'contained';
    } else if (c.evidence === 'ward_containment_fault') {
      outcome = 'advisory_or_monitor';
    } else {
      outcome = 'advisory_or_monitor';
    }

    const resultFactKey = `${a.day}:meu-result-${c.caseId}`;
    ops.createFact(
      resultFactKey,
      'meu_case_result',
      'meu',
      { caseId: c.caseId, outcome, family: c.family },
      now + 7 * 24 * 60 * MIN
    );

    touchCase(ctx, c, { status: 'resolved', result: outcome });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: c.family, stage: 'resolve', outcome, factKey: resultFactKey };
    ops.publish(`MEU Case ${c.caseId} disposition resolved: ${outcome.replace(/_/g, ' ')}.`);

    ctx.followups.push(...issueMeuCaseActions(ctx, [{
      id: `${c.caseId}/close`,
      type: 'MEU_CASE_CLOSE',
      dueAt: now + 30 * MIN,
      priority: 38,
      day: londonDate(now + 30 * MIN),
      actors: [],
      version: 1,
      caseId: c.caseId,
      caseToken: c.token
    }]));
    return true;
  }

  if (a.type === 'MEU_CASE_CLOSE') {
    touchCase(ctx, c, { status: 'closed', closedAt: now });

    const summary = {
      caseId: c.caseId,
      family: c.family,
      openedAt: c.openedAt,
      closedAt: now,
      sourceEventIds: c.sourceEventIds,
      result: c.result,
      dedupeKey: c.dedupeKey
    };

    const closedSummaries = [summary, ...current.closedSummaries].slice(0, 24);
    save(ctx, {
      activeCaseId: null,
      lastResult: c.result,
      closedSummaries
    });

    event.location = c.location;
    event.area = c.area;
    event.participants = [];
    event.payload = { caseId: c.caseId, family: c.family, stage: 'close', result: c.result };
    ops.publish(`MEU Case ${c.caseId} closed and entered into registry.`);
    return true;
  }

  if (a.type === 'MEU_REPORT_READ') {
    if (!c || !c.report || c.report.createdAt >= now || !canReadReport(state.characters[a.actor])
      || known(state.characters[a.actor], c.report.factKey, now)) {
      return refuse('The MEU report cannot be read here');
    }

    const reportFact = state.facts[c.report.factKey];
    if (reportFact) {
      ops.learn(a.actor, reportFact, 'report_reading');
    }

    event.location = 'mi6';
    event.area = state.characters[a.actor]?.area || 'ops_room';
    event.participants = [a.actor];
    event.payload = { caseId: c.caseId, actor: a.actor, factKey: c.report.factKey };
    const actorName = a.actor === 'goaden' ? 'Goaden' : 'Ashai';
    ops.publish(`${actorName} reviewed the recent MEU sector incident brief.`);
    return true;
  }

  return false;
}
