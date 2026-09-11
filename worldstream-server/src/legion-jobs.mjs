import { createHash } from 'node:crypto';
import { londonDate, MINUTE_MS as MIN } from './time.mjs';

// Addon Two: Demon's Legion contracts / jobs
// Grounded in Direct Canon CP-LEG-01..03, CP-MEU-03, and Silent approval PE-A.
// Reuses existing incident, MEU referral, and street community pressure.
// Does not build a second incident generator, second scheduler, or an economy simulator.

export const LEGION_JOB_VERSION = 1;

export const LEGION_JOB_EVENT_TYPES = Object.freeze([
  'LEGION_JOB_OFFER',
  'LEGION_JOB_ACCEPT',
  'LEGION_JOB_DECLINE',
  'LEGION_JOB_START',
  'LEGION_JOB_REPORT',
  'LEGION_JOB_RESOLVE',
  'LEGION_JOB_PAYMENT',
  'LEGION_JOB_CLOSE'
]);

export const LEGION_JOB_FACT_KINDS = Object.freeze([
  'legion_job_report',
  'legion_job_result',
  'legion_job_payment'
]);

export const LEGION_JOB_FAMILIES = Object.freeze([
  'legion.community_request',
  'legion.mi6_offbook_job',
  'legion.magical_cleanup',
  'legion.recovery_or_extraction',
  'legion.information_favour'
]);

export const LEGION_JOB_OUTCOMES = Object.freeze([
  'success',
  'partial_success',
  'safe_failure',
  'target_not_found',
  'referred_to_meu',
  'cancelled'
]);

export const LEGION_JOB_STATUSES = Object.freeze([
  'offered',
  'active',
  'declined',
  'reported',
  'resolved',
  'closed'
]);

const TYPES = new Set(LEGION_JOB_EVENT_TYPES);
const FAMILIES = new Set(LEGION_JOB_FAMILIES);
const OUTCOMES = new Set(LEGION_JOB_OUTCOMES);
const STATUSES = new Set(LEGION_JOB_STATUSES);

const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);

export function initialLegionJobsState() {
  return {
    version: 1,
    jobs: {},
    activeJobId: null,
    nextEligibleAt: 0,
    lastResult: null,
    closedSummaries: [],
    issued: {}
  };
}

export function assertLegionJobs(state) {
  if (!state.legionJobs) return;
  const current = of(state);
  if (!Number.isInteger(current.version)) throw new Error('Invalid legionJobs version');
  if (typeof current.jobs !== 'object' || current.jobs === null) throw new Error('Invalid legionJobs jobs');
  if (current.closedSummaries.length > 24) throw new Error('Legion closedSummaries limit exceeded');
  if (Object.keys(current.issued).length > 128) throw new Error('Legion issued limit exceeded');
  if (current.activeJobId != null) {
    if (typeof current.activeJobId !== 'string' || !current.jobs[current.activeJobId]) {
      throw new Error('Legion activeJobId must name an existing job');
    }
  }

  for (const j of Object.values(current.jobs)) {
    if (!FAMILIES.has(j.family)) throw new Error(`Invalid Legion job family: ${j.family}`);
    if (!STATUSES.has(j.status)) throw new Error(`Invalid Legion job status: ${j.status}`);
    if (j.result && !OUTCOMES.has(j.result)) throw new Error(`Invalid Legion job result: ${j.result}`);
    if (j.owner !== 'legion') throw new Error(`Invalid Legion job owner: ${j.owner}`);

    // Rule 4: Goaden does not auto-lead. Truth is canon leader.
    if (j.leader === 'goaden') throw new Error('Goaden cannot be Legion job leader');

    // Rule 5: Balthazar requires Anarchy unless separate manifestation exists
    if (Array.isArray(j.participants) && j.participants.includes('balthazar')) {
      if (!j.participants.includes('anarchy')) {
        throw new Error('Balthazar cannot participate without Anarchy');
      }
    }

    // Rule 6 & 8: Payment status bounds
    if (!['not_applicable', 'unpaid', 'paid'].includes(j.paymentStatus)) {
      throw new Error(`Invalid paymentStatus: ${j.paymentStatus}`);
    }
    if (j.paymentStatus === 'paid' && j.family !== 'legion.mi6_offbook_job') {
      throw new Error('Payment is only permitted for MI6 off-book work');
    }

    // Rule 10: Zero prose in state
    if (j.prose !== undefined || j.text !== undefined || j.narrative !== undefined || j.notes !== undefined) {
      throw new Error('No prose allowed in canonical Legion job state');
    }
  }
}

const of = state => state.legionJobs ?? initialLegionJobsState();
const jobOf = (state, id) => of(state).jobs[id];

const shape = action => ({
  type: action.type,
  dueAt: action.dueAt,
  priority: action.priority,
  day: action.day,
  version: action.version,
  jobId: action.jobId ?? null,
  jobToken: action.jobToken ?? null,
  actor: action.actor ?? null,
  actors: action.actors ?? []
});

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function save(ctx, patch) {
  ctx.ops.setLegionJobs({ ...of(ctx.state), ...patch });
}

function setJob(ctx, j) {
  save(ctx, { jobs: { ...of(ctx.state).jobs, [j.jobId]: j } });
}

function touchJob(ctx, j, patch) {
  const next = { ...j, ...patch, lastEventId: ctx.id, causalEventIds: [...new Set([...j.causalEventIds, ctx.id])] };
  setJob(ctx, next);
  return next;
}

export function issueLegionJobActions(ctx, proposals) {
  const actions = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt) || action.dueAt <= ctx.now) {
      throw new Error('A Legion job action must be an owned future action');
    }
    const current = of(ctx.state);
    if (current.issued[action.id]) continue;
    const retained = Object.entries(current.issued).filter(([, row]) => row.shape.dueAt >= ctx.now - 4 * 24 * 60 * MIN);
    if (retained.length >= 128) throw new Error('Legion action budget exceeded');
    ctx.ops.setLegionJobs({
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

/**
 * Maps qualifying committed source events to a Legion job remit.
 */
export function legionSourceRemit(sourceEvent) {
  if (!sourceEvent) return null;
  const type = sourceEvent.type;
  const payload = sourceEvent.payload ?? {};

  // Source 1: MEU referrals (from MEU_CASE_RESOLVE)
  if (type === 'MEU_CASE_RESOLVE') {
    const outcome = payload.outcome;
    if (outcome === 'referred_to_mi6') {
      return {
        family: 'legion.mi6_offbook_job',
        location: 'mi6',
        area: 'common_room',
        sourceSummary: `MEU referral ${payload.caseId} transferred off-book to Legion`
      };
    }
    if (outcome === 'referred_external') {
      return {
        family: payload.family === 'meu.ward_or_containment' ? 'legion.magical_cleanup' : 'legion.recovery_or_extraction',
        location: sourceEvent.location || 'boroughs',
        area: sourceEvent.area || 'street',
        sourceSummary: `MEU referral ${payload.caseId} taken by community specialists`
      };
    }
  }

  // Source 2: Street community incidents (INCIDENT)
  if (type === 'INCIDENT') {
    const kind = payload.kind;
    if (kind === 'surge_incident') {
      return {
        family: 'legion.magical_cleanup',
        location: sourceEvent.location || 'boroughs',
        area: sourceEvent.area || 'street',
        sourceSummary: 'Community request to clear residual surge fallout'
      };
    }
    if (kind === 'sighting' || kind === 'pursuit') {
      return {
        family: 'legion.recovery_or_extraction',
        location: sourceEvent.location || 'boroughs',
        area: sourceEvent.area || 'street',
        sourceSummary: 'Community report of displaced rogue element'
      };
    }
    if (kind === 'courier') {
      return {
        family: 'legion.information_favour',
        location: sourceEvent.location || 'big_ben_plaza',
        area: sourceEvent.area || 'venue',
        sourceSummary: 'Intercepted street communication'
      };
    }
    if (kind === 'confrontation' || kind === 'breach') {
      return {
        family: 'legion.community_request',
        location: sourceEvent.location || 'boroughs',
        area: sourceEvent.area || 'street',
        sourceSummary: 'Local residents seeking protection or assistance'
      };
    }
  }

  return null;
}

/**
 * Selects Legion roster for the job, strictly enforcing:
 * 1. Truth is leader (or designated leader). Goaden never auto-leads.
 * 2. If Balthazar participates, Anarchy MUST also participate.
 */
export function selectLegionJobParticipants(family, seed, jobToken) {
  const h = hash(`${seed}|legion-roster|${jobToken}`);
  const val = parseInt(h.slice(0, 4), 16);

  // Roster templates (all satisfy Balthazar/Anarchy invariant and Truth leadership)
  const rosters = [
    ['truth', 'rose'],
    ['truth', 'gabriel'],
    ['truth', 'anarchy', 'balthazar'],
    ['truth', 'damien'],
    ['truth', 'rose', 'anarchy', 'balthazar'],
    ['truth', 'gabriel', 'damien']
  ];

  const picked = rosters[val % rosters.length];
  // Strict assert check
  if (picked.includes('balthazar') && !picked.includes('anarchy')) {
    throw new Error('Invariant violation: Balthazar picked without Anarchy');
  }
  return picked;
}

/**
 * Proposes a new Legion job offer from a committed source event.
 */
export function legionJobOpportunityActions({ state, day, now, seed, parentActionId, parentEventId, sourceEvent }) {
  if (!parentActionId || !parentEventId || !sourceEvent) return [];
  const current = of(state);

  // Negative gate: max 1 active Legion job
  if (current.activeJobId) return [];

  // Negative gate: cooldown between starts (≥24h)
  if (now < current.nextEligibleAt) return [];

  // Negative gate: authored arc ownership
  if (state.arcs?.session || sourceEvent.payload?.arcId) return [];

  const remit = legionSourceRemit(sourceEvent);
  if (!remit) return [];

  const dedupeKey = `source:${parentEventId}`;
  if (current.closedSummaries.some(s => s.dedupeKey === dedupeKey)) return [];
  if (Object.values(current.jobs).some(j => j.dedupeKey === dedupeKey)) return [];

  const dueAt = now + 15 * MIN;
  const jobId = `legion:${hash(`${seed}|legion-offer|${parentActionId}|${parentEventId}`)}`;
  const participants = selectLegionJobParticipants(remit.family, seed, jobId);

  return [{
    id: `${parentActionId}/legion/offer`,
    type: 'LEGION_JOB_OFFER',
    dueAt,
    priority: 37,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    jobId,
    family: remit.family,
    sourceEventId: parentEventId,
    sourceType: sourceEvent.type,
    sourceKind: sourceEvent.payload?.kind ?? null,
    sourceCaseId: sourceEvent.payload?.caseId ?? null,
    location: remit.location,
    area: remit.area,
    participants,
    dedupeKey
  }];
}

export function resolveLegionJobAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const current = of(state), issuance = current.issued[a.id];
  const refuse = reason => { ops.skip(reason); return true; };

  if (!issuance || issuance.consumed || a.version !== 1 || !equal(shape(a), issuance.shape)) {
    return refuse('No owned Legion job action');
  }

  let j = a.jobId ? jobOf(state, a.jobId) : null;
  if (a.type !== 'LEGION_JOB_OFFER' && (!j || a.jobToken !== j.token || j.version !== 1)) {
    return refuse('No matching Legion job');
  }

  if (j && ['LEGION_JOB_ACCEPT', 'LEGION_JOB_DECLINE'].includes(a.type) && j.status !== 'offered') {
    return refuse('Job is not in offered status');
  }

  if (j && ['LEGION_JOB_START', 'LEGION_JOB_REPORT'].includes(a.type) && j.status !== 'active') {
    return refuse('Job is not active');
  }

  if (a.type === 'LEGION_JOB_OFFER' && current.activeJobId) {
    return refuse('An active Legion job already exists');
  }

  save(ctx, { issued: { ...current.issued, [a.id]: { ...issuance, consumed: true } } });
  event.causedBy.push(issuance.sourceEventId);

  // 1. LEGION_JOB_OFFER
  if (a.type === 'LEGION_JOB_OFFER') {
    // Rule 5 check:
    if (a.participants.includes('balthazar') && !a.participants.includes('anarchy')) {
      return refuse('Balthazar cannot be in participants without Anarchy');
    }

    const jobToken = `${id}:legion-v1`;
    j = {
      jobId: a.jobId,
      token: jobToken,
      version: 1,
      system: 'legion',
      family: a.family,
      status: 'offered',
      openedAt: now,
      sourceEventIds: [a.sourceEventId],
      sourceFactIds: [],
      sourceType: a.sourceType ?? null,
      sourceKind: a.sourceKind ?? null,
      sourceCaseId: a.sourceCaseId ?? null,
      owner: 'legion',
      leader: 'truth',
      participants: [...a.participants],
      location: a.location,
      area: a.area,
      deadlineAt: now + 48 * 60 * MIN,
      result: null,
      paymentStatus: a.family === 'legion.mi6_offbook_job' ? 'unpaid' : 'not_applicable',
      closedAt: null,
      dedupeKey: a.dedupeKey,
      originEventId: id,
      lastEventId: id,
      causalEventIds: [id]
    };

    save(ctx, {
      jobs: { ...current.jobs, [j.jobId]: j }
    });

    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'offer', sourceEventId: a.sourceEventId };
    ops.publish(`Demon's Legion received word of a callout in ${j.location}: ${j.family.replace('legion.', '').replace(/_/g, ' ')}.`);

    // Evaluate accept vs decline deterministically
    // Rule 3: Decline is a valid first-class branch
    const evalHash = hash(`${ctx.seed}|legion-decision|${j.jobId}`);
    const evalVal = parseInt(evalHash.slice(0, 4), 16);
    // MI6 off-book work is treated with caution (~25% decline), community requests have higher accept rate (~12% decline)
    const declineThreshold = j.family === 'legion.mi6_offbook_job' ? 4 : 8;
    const shouldDecline = (evalVal % declineThreshold === 0);

    if (shouldDecline) {
      ctx.followups.push(...issueLegionJobActions(ctx, [{
        id: `${j.jobId}/decline`,
        type: 'LEGION_JOB_DECLINE',
        dueAt: now + 15 * MIN,
        priority: 37,
        day: londonDate(now + 15 * MIN),
        actors: [],
        version: 1,
        jobId: j.jobId,
        jobToken: j.token,
        reason: j.family === 'legion.mi6_offbook_job' ? 'bureaucratic_distrust' : 'prior_crew_commitments'
      }]));
    } else {
      ctx.followups.push(...issueLegionJobActions(ctx, [{
        id: `${j.jobId}/accept`,
        type: 'LEGION_JOB_ACCEPT',
        dueAt: now + 15 * MIN,
        priority: 37,
        day: londonDate(now + 15 * MIN),
        actors: [],
        version: 1,
        jobId: j.jobId,
        jobToken: j.token
      }]));
    }
    return true;
  }

  // 2. LEGION_JOB_DECLINE (Terminal branch)
  if (a.type === 'LEGION_JOB_DECLINE') {
    touchJob(ctx, j, { status: 'declined', result: 'cancelled', closedAt: now });

    const summary = {
      jobId: j.jobId,
      family: j.family,
      openedAt: j.openedAt,
      closedAt: now,
      sourceEventIds: j.sourceEventIds,
      result: 'cancelled',
      dedupeKey: j.dedupeKey
    };

    const closedSummaries = [summary, ...current.closedSummaries].slice(0, 24);
    save(ctx, {
      activeJobId: null,
      lastResult: 'cancelled',
      nextEligibleAt: now + 24 * 60 * MIN, // ≥24h cooldown
      closedSummaries
    });

    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'decline', reason: a.reason };
    ops.publish(`The Legion turned down the ${j.family.replace('legion.', '').replace(/_/g, ' ')} offer.`);
    return true;
  }

  // 3. LEGION_JOB_ACCEPT
  if (a.type === 'LEGION_JOB_ACCEPT') {
    touchJob(ctx, j, { status: 'active' });

    save(ctx, {
      activeJobId: j.jobId,
      nextEligibleAt: now + 24 * 60 * MIN // ≥24h cooldown between starts
    });

    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'accept' };
    ops.publish(`Truth confirmed the crew would handle the ${j.family.replace('legion.', '').replace(/_/g, ' ')}.`);

    ctx.followups.push(...issueLegionJobActions(ctx, [{
      id: `${j.jobId}/start`,
      type: 'LEGION_JOB_START',
      dueAt: now + 30 * MIN,
      priority: 37,
      day: londonDate(now + 30 * MIN),
      actors: [],
      version: 1,
      jobId: j.jobId,
      jobToken: j.token
    }]));
    return true;
  }

  // 4. LEGION_JOB_START
  if (a.type === 'LEGION_JOB_START') {
    // Invariant check on participants
    if (j.participants.includes('balthazar') && !j.participants.includes('anarchy')) {
      return refuse('Balthazar cannot be on a job without Anarchy');
    }

    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'start' };
    ops.publish(`The Legion set out on the ${j.family.replace('legion.', '').replace(/_/g, ' ')}.`);

    ctx.followups.push(...issueLegionJobActions(ctx, [{
      id: `${j.jobId}/report`,
      type: 'LEGION_JOB_REPORT',
      dueAt: now + 60 * MIN,
      priority: 37,
      day: londonDate(now + 60 * MIN),
      actors: [],
      version: 1,
      jobId: j.jobId,
      jobToken: j.token
    }]));
    return true;
  }

  // 5. LEGION_JOB_REPORT
  if (a.type === 'LEGION_JOB_REPORT') {
    // Derive evidence-based outcome deterministically from source facts/family
    const outcomeHash = hash(`${ctx.seed}|legion-outcome|${j.jobId}`);
    const outcomeVal = parseInt(outcomeHash.slice(0, 4), 16);

    let outcome;
    if (j.family === 'legion.information_favour' && outcomeVal % 5 === 0) {
      outcome = 'target_not_found';
    } else if (j.family === 'legion.magical_cleanup' && outcomeVal % 7 === 0) {
      outcome = 'referred_to_meu';
    } else if (outcomeVal % 9 === 0) {
      outcome = 'safe_failure';
    } else if (outcomeVal % 4 === 0) {
      outcome = 'partial_success';
    } else {
      outcome = 'success';
    }

    const factKey = `${a.day}:legion-report-${j.jobId}`;
    const reportFact = ops.createFact(
      factKey,
      'legion_job_report',
      'legion',
      { jobId: j.jobId, family: j.family, outcome, location: j.location },
      now + 7 * 24 * 60 * MIN
    );

    touchJob(ctx, j, {
      status: 'reported',
      result: outcome,
      sourceFactIds: [...j.sourceFactIds, factKey]
    });

    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'report', outcome, factKey };
    ops.publish(`The Legion completed work on Case ${j.jobId}: preliminary result ${outcome.replace(/_/g, ' ')}.`);

    ctx.followups.push(...issueLegionJobActions(ctx, [{
      id: `${j.jobId}/resolve`,
      type: 'LEGION_JOB_RESOLVE',
      dueAt: now + 45 * MIN,
      priority: 37,
      day: londonDate(now + 45 * MIN),
      actors: [],
      version: 1,
      jobId: j.jobId,
      jobToken: j.token,
      outcome
    }]));
    return true;
  }

  // 6. LEGION_JOB_RESOLVE
  if (a.type === 'LEGION_JOB_RESOLVE') {
    const outcome = a.outcome || j.result || 'success';
    const resultFactKey = `${a.day}:legion-result-${j.jobId}`;

    ops.createFact(
      resultFactKey,
      'legion_job_result',
      'legion',
      { jobId: j.jobId, outcome, family: j.family },
      now + 7 * 24 * 60 * MIN
    );

    touchJob(ctx, j, { status: 'resolved', result: outcome });

    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'resolve', outcome, factKey: resultFactKey };
    ops.publish(`Legion job ${j.jobId} resolved: ${outcome.replace(/_/g, ' ')}.`);

    // Rule 6: Payment allowed ONLY for MI6 off-book work
    if (j.family === 'legion.mi6_offbook_job' && ['success', 'partial_success'].includes(outcome)) {
      ctx.followups.push(...issueLegionJobActions(ctx, [{
        id: `${j.jobId}/payment`,
        type: 'LEGION_JOB_PAYMENT',
        dueAt: now + 30 * MIN,
        priority: 37,
        day: londonDate(now + 30 * MIN),
        actors: [],
        version: 1,
        jobId: j.jobId,
        jobToken: j.token
      }]));
    } else {
      ctx.followups.push(...issueLegionJobActions(ctx, [{
        id: `${j.jobId}/close`,
        type: 'LEGION_JOB_CLOSE',
        dueAt: now + 30 * MIN,
        priority: 37,
        day: londonDate(now + 30 * MIN),
        actors: [],
        version: 1,
        jobId: j.jobId,
        jobToken: j.token
      }]));
    }
    return true;
  }

  // 7. LEGION_JOB_PAYMENT (Idempotent payment flag)
  if (a.type === 'LEGION_JOB_PAYMENT') {
    // Rule 6 & 7: Check family and idempotency
    if (j.family !== 'legion.mi6_offbook_job') {
      return refuse('Payment not applicable to this job family');
    }
    if (j.paymentStatus === 'paid') {
      return refuse('Job is already paid');
    }

    const paymentFactKey = `${a.day}:legion-payment-${j.jobId}`;
    ops.createFact(
      paymentFactKey,
      'legion_job_payment',
      'legion',
      { jobId: j.jobId, paymentStatus: 'paid' },
      now + 7 * 24 * 60 * MIN
    );

    touchJob(ctx, j, { paymentStatus: 'paid' });

    event.location = 'mi6';
    event.area = 'common_room';
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, stage: 'payment', paymentStatus: 'paid', factKey: paymentFactKey };
    ops.publish(`Off-book remittance settled for Legion job ${j.jobId}.`);

    ctx.followups.push(...issueLegionJobActions(ctx, [{
      id: `${j.jobId}/close`,
      type: 'LEGION_JOB_CLOSE',
      dueAt: now + 30 * MIN,
      priority: 37,
      day: londonDate(now + 30 * MIN),
      actors: [],
      version: 1,
      jobId: j.jobId,
      jobToken: j.token
    }]));
    return true;
  }

  // 8. LEGION_JOB_CLOSE
  if (a.type === 'LEGION_JOB_CLOSE') {
    touchJob(ctx, j, { status: 'closed', closedAt: now });

    const summary = {
      jobId: j.jobId,
      family: j.family,
      openedAt: j.openedAt,
      closedAt: now,
      sourceEventIds: j.sourceEventIds,
      result: j.result,
      paymentStatus: j.paymentStatus,
      dedupeKey: j.dedupeKey
    };

    const closedSummaries = [summary, ...current.closedSummaries].slice(0, 24);
    save(ctx, {
      activeJobId: null,
      lastResult: j.result,
      nextEligibleAt: now + 48 * 60 * MIN, // 48h cooldown after completion (yielding ~1-2 jobs/wk)
      closedSummaries
    });

    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'close', result: j.result };
    ops.publish(`Legion job ${j.jobId} closed.`);
    return true;
  }

  return false;
}
