import { createHash } from 'node:crypto';
import { londonDate, MINUTE_MS as MIN } from './time.mjs';
// Addon Two: Demon's Legion contracts / jobs
// Grounded in CP-LEG-01..03, CP-MEU-03, and Silent PE-A (MI6 may pay for
// magical-disaster work). Jobs open only from an explicit committed
// MI6→Legion referral. Community-request sources are dormant until one exists.
// No second incident generator. No drama RNG.

export const LEGION_JOB_VERSION = 1;

export const LEGION_JOB_EVENT_TYPES = Object.freeze([
  'MI6_LEGION_REFERRAL',
  'LEGION_JOB_OFFER',
  'LEGION_JOB_ACCEPT',
  'LEGION_JOB_DECLINE',
  'LEGION_JOB_START',
  'LEGION_JOB_REPORT',
  'LEGION_JOB_RESOLVE',
  'LEGION_JOB_PAYMENT',
  'LEGION_JOB_CLOSE',
  'LEGION_JOB_HANDOFF_READ'
]);

export const LEGION_JOB_FACT_KINDS = Object.freeze([
  'mi6_legion_referral',
  'legion_job_offer',
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

export const PE_A_MEU_FAMILIES = Object.freeze([
  'meu.magic_misuse',
  'meu.rogue_creature',
  'meu.weather_consequence'
]);

const TYPES = new Set(LEGION_JOB_EVENT_TYPES);
const FAMILIES = new Set(LEGION_JOB_FAMILIES);
const OUTCOMES = new Set(LEGION_JOB_OUTCOMES);
const STATUSES = new Set(LEGION_JOB_STATUSES);
const OPEN_STATUSES = new Set(['offered', 'active', 'reported', 'resolved']);
const DEFAULT_CREW = Object.freeze(['rose', 'gabriel', 'damien']);

const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);

export function initialLegionJobsState() {
  return {
    version: 1,
    jobs: {},
    activeJobId: null,
    nextEligibleAt: 0,
    lastResult: null,
    closedSummaries: [],
    issued: {},
    reservations: {}
  };
}

export function assertLegionJobs(state) {
  if (!state.legionJobs) return;
  const current = of(state);
  if (!Number.isInteger(current.version)) throw new Error('Invalid legionJobs version');
  if (typeof current.jobs !== 'object' || current.jobs === null) throw new Error('Invalid legionJobs jobs');
  if (current.closedSummaries.length > 24) throw new Error('Legion closedSummaries limit exceeded');
  if (Object.keys(current.issued).length > 128) throw new Error('Legion issued limit exceeded');
  const open = Object.values(current.jobs).filter(j => OPEN_STATUSES.has(j.status));
  if (open.length > 1) throw new Error('At most one offered or active Legion job');
  if (current.activeJobId != null) {
    if (typeof current.activeJobId !== 'string' || !current.jobs[current.activeJobId]) {
      throw new Error('Legion activeJobId must name an existing job');
    }
    if (!OPEN_STATUSES.has(current.jobs[current.activeJobId].status)) {
      throw new Error('Legion activeJobId must name an open job');
    }
  } else if (open.length) {
    throw new Error('An open Legion job must occupy activeJobId');
  }

  for (const j of Object.values(current.jobs)) {
    if (!FAMILIES.has(j.family)) throw new Error(`Invalid Legion job family: ${j.family}`);
    if (!STATUSES.has(j.status)) throw new Error(`Invalid Legion job status: ${j.status}`);
    if (j.result && !OUTCOMES.has(j.result)) throw new Error(`Invalid Legion job result: ${j.result}`);
    if (j.owner !== 'legion') throw new Error(`Invalid Legion job owner: ${j.owner}`);
    if (j.leader === 'goaden') throw new Error('Goaden cannot be Legion job leader');
    if (j.leader !== 'truth') throw new Error('Truth must lead Legion jobs');
    if (Array.isArray(j.participants) && j.participants.includes('balthazar')) {
      if (!j.participants.includes('anarchy')) {
        throw new Error('Balthazar cannot participate without Anarchy');
      }
    }
    if (j.participants?.includes('ashai') || j.participants?.includes('yukon')) {
      throw new Error('Ashai and Yukon are not default Legion members');
    }
    if (!['not_applicable', 'unpaid', 'paid'].includes(j.paymentStatus)) {
      throw new Error(`Invalid paymentStatus: ${j.paymentStatus}`);
    }
    if (j.paymentStatus === 'paid' && j.family !== 'legion.mi6_offbook_job') {
      throw new Error('Payment is only permitted for MI6 off-book work');
    }
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

const known = (actor, key, now) => actor?.knowledge?.some(memory =>
  memory.factKey === key && memory.learnedAt <= now && (memory.validUntil == null || memory.validUntil > now));

const canReadHandoff = actor => actor?.location === 'mi6'
  && ['ops_room', 'briefing_room'].includes(actor.area)
  && !actor.journey
  && ['unhurried_time', 'in_a_briefing', 'on_call', 'waiting'].includes(actor.activity);

export function legionJobMemberAvailable(state, id, atMs, jobId = null) {
  const reservation = of(state).reservations?.[id];
  if (!reservation || !Number.isFinite(atMs)) return true;
  if (jobId && reservation.jobId === jobId) return true;
  return !(reservation.startAt <= atMs && atMs < reservation.until);
}

export function legionCandidateAvailable(state, id, atMs, jobId = null) {
  if (!Number.isFinite(atMs)) return false;
  if (!legionJobMemberAvailable(state, id, atMs, jobId)) return false;
  const arc = state.arcs?.session;
  if (arc?.cast?.includes(id) && arc.startAt <= atMs && atMs < arc.until) return false;
  const bank = state.sceneBank?.session;
  if (bank?.cast?.includes(id) && bank.startAt <= atMs && atMs < bank.until) return false;
  const support = state.agendas?.supporting?.[id]?.commitment;
  if (support && support.startAt <= atMs && atMs < support.until) return false;
  const ch = state.characters?.[id];
  if (ch) {
    if (ch.journey) return false;
    if (ch.activity === 'sleeping') return false;
  }
  return true;
}

export function mi6MayOfferLegionJob(sourceEvent) {
  if (!sourceEvent || sourceEvent.type !== 'MEU_CASE_RESOLVE') return false;
  const outcome = sourceEvent.payload?.outcome;
  const family = sourceEvent.payload?.family;
  if (outcome !== 'contained') return false;
  if (family === 'meu.artifact_irregularity') return false;
  return PE_A_MEU_FAMILIES.includes(family);
}

/**
 * Maps a committed referral/request event to a job remit.
 * Raw INCIDENT is never a request. Community-request stays dormant.
 */
export function legionSourceRemit(sourceEvent) {
  if (!sourceEvent) return null;
  if (sourceEvent.type === 'MI6_LEGION_REFERRAL') {
    return {
      family: 'legion.mi6_offbook_job',
      location: 'mi6',
      area: 'ops_room'
    };
  }
  return null;
}

export function selectLegionJobParticipants(state, now, seed, jobToken) {
  if (!legionCandidateAvailable(state, 'truth', now)) {
    return { participants: [], reason: 'no_viable_roster' };
  }
  const extras = DEFAULT_CREW.filter(id => legionCandidateAvailable(state, id, now));
  const anarchyFree = legionCandidateAvailable(state, 'anarchy', now);
  const balthazarFree = anarchyFree && legionCandidateAvailable(state, 'balthazar', now);
  if (balthazarFree && extras.length === 0) {
    return { participants: ['truth', 'anarchy', 'balthazar'], reason: null };
  }
  if (extras.length === 0 && !anarchyFree) {
    return { participants: [], reason: 'no_viable_roster' };
  }
  const pool = extras.length ? extras : (anarchyFree ? ['anarchy'] : []);
  if (!pool.length) return { participants: [], reason: 'no_viable_roster' };
  const pick = pool[parseInt(hash(`${seed}|legion-crew|${jobToken}`).slice(0, 4), 16) % pool.length];
  const participants = ['truth', pick];
  if (pick === 'anarchy' && balthazarFree) participants.push('balthazar');
  if (participants.includes('balthazar') && !participants.includes('anarchy')) {
    return { participants: [], reason: 'no_viable_roster' };
  }
  return { participants, reason: null };
}

function declineReason(state, now, job, participants) {
  if (!job) return 'source_no_longer_valid';
  if (!participants?.length || !participants.includes('truth')) return 'no_viable_roster';
  if (participants.includes('balthazar') && !participants.includes('anarchy')) return 'no_viable_roster';
  if (participants.some(id => !legionCandidateAvailable(state, id, now, job.jobId))) {
    const busy = participants.find(id => !legionCandidateAvailable(state, id, now, job.jobId));
    const ch = state.characters?.[busy];
    if (ch?.journey) return 'physically_unavailable';
    if (ch?.activity === 'sleeping') return 'physically_unavailable';
    return 'conflicting_commitment';
  }
  const sourceFact = job.sourceFactKey ? state.facts?.[job.sourceFactKey] : null;
  if (job.sourceFactKey && (!sourceFact || (sourceFact.validUntil != null && sourceFact.validUntil <= now))) {
    return 'source_no_longer_valid';
  }
  return null;
}

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

function reserveCrew(ctx, participants, jobId, startAt, until) {
  const reservations = { ...of(ctx.state).reservations };
  for (const id of participants) {
    reservations[id] = { jobId, startAt, until };
  }
  save(ctx, { reservations });
}

function releaseCrew(ctx, jobId, now) {
  const reservations = { ...of(ctx.state).reservations };
  for (const [id, row] of Object.entries(reservations)) {
    if (row.jobId === jobId) {
      reservations[id] = { ...row, until: Math.min(row.until, now) };
    }
  }
  save(ctx, { reservations });
}

function occupySlot(ctx, jobId) {
  save(ctx, { activeJobId: jobId });
}

function releaseSlot(ctx, jobId, result, now, cooldown) {
  const current = of(ctx.state);
  save(ctx, {
    activeJobId: current.activeJobId === jobId ? null : current.activeJobId,
    lastResult: result,
    nextEligibleAt: now + cooldown
  });
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

export function mi6LegionReferralActions({ state, day, now, parentActionId, parentEventId, sourceEvent }) {
  if (!parentActionId || !parentEventId || !sourceEvent) return [];
  if (!mi6MayOfferLegionJob(sourceEvent)) return [];
  const caseId = sourceEvent.payload?.caseId;
  if (!caseId) return [];
  const current = of(state);
  if (Object.values(state.facts ?? {}).some(fact => fact.kind === 'mi6_legion_referral'
    && fact.value?.caseId === caseId)) return [];
  if (Object.values(current.jobs).some(j => j.sourceCaseId === caseId)) return [];
  if (current.closedSummaries.some(s => s.sourceCaseId === caseId)) return [];
  const dueAt = now + 10 * MIN;
  return [{
    id: `${parentActionId}/legion/referral`,
    type: 'MI6_LEGION_REFERRAL',
    dueAt,
    priority: 36,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    caseId,
    sourceEventId: parentEventId,
    meuFamily: sourceEvent.payload?.family ?? null,
    location: sourceEvent.location || 'mi6',
    area: sourceEvent.area || 'ops_room'
  }];
}

export function legionJobOpportunityActions({ state, day, now, seed, parentActionId, parentEventId, sourceEvent }) {
  if (!parentActionId || !parentEventId || !sourceEvent) return [];
  const current = of(state);
  if (current.activeJobId) return [];
  if (Object.values(current.jobs).some(j => OPEN_STATUSES.has(j.status))) return [];
  if (now < current.nextEligibleAt) return [];
  if (state.arcs?.session || sourceEvent.payload?.arcId) return [];
  const remit = legionSourceRemit(sourceEvent);
  if (!remit) return [];
  const dedupeKey = `source:${parentEventId}`;
  if (current.closedSummaries.some(s => s.dedupeKey === dedupeKey)) return [];
  if (Object.values(current.jobs).some(j => j.dedupeKey === dedupeKey)) return [];
  const sourceCaseId = sourceEvent.payload?.caseId ?? null;
  if (sourceCaseId && (Object.values(current.jobs).some(j => j.sourceCaseId === sourceCaseId)
    || current.closedSummaries.some(s => s.sourceCaseId === sourceCaseId))) return [];
  const dueAt = now + 15 * MIN;
  const jobId = `legion:${hash(`${seed}|legion-offer|${parentActionId}|${parentEventId}`)}`;
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
    sourceFactKey: sourceEvent.payload?.factKey ?? null,
    location: remit.location,
    area: remit.area,
    dedupeKey
  }];
}

export function legionHandoffReadActions({ state, day, now, parentActionId }) {
  if (!parentActionId) return [];
  const reported = Object.values(of(state).jobs).filter(j =>
    j.report && j.report.createdAt < now && (now - j.report.createdAt < 3 * 24 * 60 * MIN)
  ).sort((a, b) => b.openedAt - a.openedAt);
  if (!reported.length) return [];
  const latest = reported[0];
  return ['goaden', 'ashai'].filter(who =>
    canReadHandoff(state.characters[who]) && !known(state.characters[who], latest.report.factKey, now)
  ).map(actor => ({
    id: `${parentActionId}/legion/handoff/${actor}`,
    type: 'LEGION_JOB_HANDOFF_READ',
    dueAt: now + 1,
    priority: 37,
    day,
    actors: [],
    actor,
    version: 1,
    jobId: latest.jobId,
    jobToken: latest.token,
    factKey: latest.report.factKey
  }));
}

function follow(ctx, job, type, slug, dueAt, extra = {}) {
  ctx.followups.push(...issueLegionJobActions(ctx, [{
    id: `${job.jobId}/${slug}`,
    type,
    dueAt,
    priority: 37,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    jobId: job.jobId,
    jobToken: job.token,
    ...extra
  }]));
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
  if (!['MI6_LEGION_REFERRAL', 'LEGION_JOB_OFFER'].includes(a.type)
    && (!j || a.jobToken !== j.token || j.version !== 1)) {
    return refuse('No matching Legion job');
  }

  if (j && ['LEGION_JOB_ACCEPT', 'LEGION_JOB_DECLINE'].includes(a.type) && j.status !== 'offered') {
    return refuse('Job is not in offered status');
  }
  if (j && ['LEGION_JOB_START', 'LEGION_JOB_REPORT'].includes(a.type) && j.status !== 'active') {
    return refuse('Job is not active');
  }
  if (a.type === 'LEGION_JOB_OFFER' && (current.activeJobId || Object.values(current.jobs).some(job => OPEN_STATUSES.has(job.status)))) {
    return refuse('An open Legion job already exists');
  }
  if (a.type === 'MI6_LEGION_REFERRAL' && Object.values(state.facts ?? {}).some(fact =>
    fact.kind === 'mi6_legion_referral' && fact.value?.caseId === a.caseId)) {
    return refuse('Referral already committed for this case');
  }

  save(ctx, { issued: { ...of(ctx.state).issued, [a.id]: { ...issuance, consumed: true } } });
  event.causedBy.push(issuance.sourceEventId);

  if (a.type === 'MI6_LEGION_REFERRAL') {
    const factKey = `${a.day}:mi6-legion-referral-${a.caseId}`;
    const fact = ops.createFact(factKey, 'mi6_legion_referral', 'mi6', {
      caseId: a.caseId, sourceEventId: a.sourceEventId, meuFamily: a.meuFamily,
      family: 'legion.mi6_offbook_job'
    }, now + 7 * 24 * 60 * MIN);
    event.location = a.location || 'mi6';
    event.area = a.area || 'ops_room';
    event.participants = [];
    event.payload = { caseId: a.caseId, sourceEventId: a.sourceEventId, factKey, family: 'legion.mi6_offbook_job' };
    ops.publish('MI6 recorded an off-book disaster referral for the Legion.');
    event.causedBy.push(a.sourceEventId);
    if (fact) event.payload.factId = fact.id ?? factKey;
    return true;
  }

  if (a.type === 'LEGION_JOB_OFFER') {
    const picked = selectLegionJobParticipants(state, now, ctx.seed, a.jobId);
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
      sourceFactIds: a.sourceFactKey ? [a.sourceFactKey] : [],
      sourceType: a.sourceType ?? null,
      sourceKind: a.sourceKind ?? null,
      sourceCaseId: a.sourceCaseId ?? null,
      sourceFactKey: a.sourceFactKey ?? null,
      owner: 'legion',
      leader: 'truth',
      participants: picked.participants.length ? [...picked.participants] : ['truth'],
      location: a.location,
      area: a.area,
      deadlineAt: now + 48 * 60 * MIN,
      result: null,
      paymentStatus: a.family === 'legion.mi6_offbook_job' ? 'unpaid' : 'not_applicable',
      closedAt: null,
      declineReason: null,
      interrupted: false,
      report: null,
      dedupeKey: a.dedupeKey,
      originEventId: id,
      lastEventId: id,
      causalEventIds: [id]
    };

    save(ctx, { jobs: { ...of(ctx.state).jobs, [j.jobId]: j } });
    occupySlot(ctx, j.jobId);
    if (picked.participants.length) reserveCrew(ctx, picked.participants, j.jobId, now, j.deadlineAt);

    const offerKey = `${a.day}:legion-offer-${j.jobId}`;
    const offerFact = ops.createFact(offerKey, 'legion_job_offer', 'legion', {
      jobId: j.jobId, family: j.family, sourceCaseId: j.sourceCaseId, sourceEventId: a.sourceEventId
    }, now + 7 * 24 * 60 * MIN);
    touchJob(ctx, j, { sourceFactIds: [...j.sourceFactIds, offerKey] });
    for (const who of j.participants) {
      if (state.characters?.[who] && offerFact) ops.learn(who, offerFact, 'job_offer');
    }

    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'offer', sourceEventId: a.sourceEventId,
      factKey: offerKey, sourceCaseId: j.sourceCaseId };
    ops.publish(`Demon's Legion received an off-book disaster offer at ${j.location}.`);

    const reason = picked.reason ?? declineReason(ctx.state, now, j, j.participants);
    if (reason) {
      follow(ctx, j, 'LEGION_JOB_DECLINE', 'decline', now + 15 * MIN, { reason });
    } else {
      follow(ctx, j, 'LEGION_JOB_ACCEPT', 'accept', now + 15 * MIN);
    }
    return true;
  }

  if (a.type === 'LEGION_JOB_DECLINE') {
    const reason = a.reason ?? declineReason(state, now, j, j.participants) ?? 'source_no_longer_valid';
    touchJob(ctx, j, { status: 'declined', result: 'cancelled', closedAt: now, declineReason: reason });
    releaseCrew(ctx, j.jobId, now);
    const summary = {
      jobId: j.jobId, family: j.family, openedAt: j.openedAt, closedAt: now,
      sourceEventIds: j.sourceEventIds, sourceCaseId: j.sourceCaseId,
      result: 'cancelled', declineReason: reason, dedupeKey: j.dedupeKey
    };
    save(ctx, { closedSummaries: [summary, ...of(ctx.state).closedSummaries].slice(0, 24) });
    releaseSlot(ctx, j.jobId, 'cancelled', now, 24 * 60 * MIN);
    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'decline', reason };
    ops.publish(`The Legion turned down the off-book disaster offer.`);
    return true;
  }

  if (a.type === 'LEGION_JOB_ACCEPT') {
    const reason = declineReason(state, now, j, j.participants);
    if (reason) {
      follow(ctx, j, 'LEGION_JOB_DECLINE', 'decline-late', now + 1, { reason });
      return true;
    }
    touchJob(ctx, j, { status: 'active' });
    reserveCrew(ctx, j.participants, j.jobId, now, j.deadlineAt);
    save(ctx, { nextEligibleAt: now + 24 * 60 * MIN });
    for (const who of j.participants) {
      const actor = state.characters?.[who];
      const offerFact = state.facts[`${londonDate(j.openedAt)}:legion-offer-${j.jobId}`]
        ?? Object.values(state.facts).find(fact => fact.kind === 'legion_job_offer' && fact.value?.jobId === j.jobId);
      if (actor && offerFact && !known(actor, offerFact.key, now)) ops.learn(who, offerFact, 'participated');
    }
    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'accept' };
    ops.publish('Truth confirmed the crew would take the off-book disaster work.');
    follow(ctx, j, 'LEGION_JOB_START', 'start', now + 30 * MIN);
    return true;
  }

  if (a.type === 'LEGION_JOB_START') {
    const reason = declineReason(state, now, j, j.participants);
    if (reason) {
      touchJob(ctx, j, { status: 'resolved', result: 'cancelled', declineReason: reason });
      follow(ctx, j, 'LEGION_JOB_CLOSE', 'close', now + 30 * MIN);
      event.location = j.location;
      event.area = j.area;
      event.participants = [...j.participants];
      event.payload = { jobId: j.jobId, family: j.family, stage: 'start', outcome: 'cancelled', reason };
      ops.publish('The Legion could not start the off-book work.');
      return true;
    }
    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'start' };
    ops.publish('The Legion set out on the off-book disaster work.');
    follow(ctx, j, 'LEGION_JOB_REPORT', 'report', now + 60 * MIN);
    return true;
  }

  if (a.type === 'LEGION_JOB_REPORT') {
    const sourceGone = j.sourceFactKey && (!(state.facts?.[j.sourceFactKey])
      || (state.facts[j.sourceFactKey].validUntil != null && state.facts[j.sourceFactKey].validUntil <= now));
    const interrupted = j.interrupted || j.participants.some(id => !legionJobMemberAvailable(state, id, now)
      && of(state).reservations?.[id]?.jobId !== j.jobId);
    let outcome = 'success';
    if (sourceGone) outcome = 'cancelled';
    else if (interrupted) outcome = 'partial_success';

    const factKey = `${a.day}:legion-report-${j.jobId}`;
    const reportFact = ops.createFact(factKey, 'legion_job_report', 'legion', {
      jobId: j.jobId, family: j.family, outcome, location: j.location, sourceCaseId: j.sourceCaseId
    }, now + 7 * 24 * 60 * MIN);
    for (const who of j.participants) {
      if (state.characters?.[who] && reportFact) ops.learn(who, reportFact, 'participated');
    }
    touchJob(ctx, j, {
      status: 'reported', result: outcome,
      report: { factKey, createdAt: now, factId: reportFact?.id ?? factKey },
      sourceFactIds: [...j.sourceFactIds, factKey]
    });
    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'report', outcome, factKey };
    ops.publish(`The Legion reported the off-book work as ${outcome.replace(/_/g, ' ')}.`);
    follow(ctx, j, 'LEGION_JOB_RESOLVE', 'resolve', now + 45 * MIN, { outcome });
    return true;
  }

  if (a.type === 'LEGION_JOB_RESOLVE') {
    const outcome = a.outcome || j.result || 'success';
    const resultFactKey = `${a.day}:legion-result-${j.jobId}`;
    const resultFact = ops.createFact(resultFactKey, 'legion_job_result', 'legion', {
      jobId: j.jobId, outcome, family: j.family, sourceCaseId: j.sourceCaseId
    }, now + 7 * 24 * 60 * MIN);
    for (const who of j.participants) {
      if (state.characters?.[who] && resultFact) ops.learn(who, resultFact, 'participated');
    }
    touchJob(ctx, j, { status: 'resolved', result: outcome });
    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'resolve', outcome, factKey: resultFactKey };
    ops.publish(`Legion job ${j.jobId} resolved: ${outcome.replace(/_/g, ' ')}.`);
    if (j.family === 'legion.mi6_offbook_job' && ['success', 'partial_success'].includes(outcome)) {
      follow(ctx, j, 'LEGION_JOB_PAYMENT', 'payment', now + 30 * MIN);
    } else {
      follow(ctx, j, 'LEGION_JOB_CLOSE', 'close', now + 30 * MIN);
    }
    return true;
  }

  if (a.type === 'LEGION_JOB_PAYMENT') {
    if (j.family !== 'legion.mi6_offbook_job') return refuse('Payment not applicable to this job family');
    if (j.paymentStatus === 'paid') return refuse('Job is already paid');
    const paymentFactKey = `${a.day}:legion-payment-${j.jobId}`;
    const paymentFact = ops.createFact(paymentFactKey, 'legion_job_payment', 'legion', {
      jobId: j.jobId, paymentStatus: 'paid'
    }, now + 7 * 24 * 60 * MIN);
    for (const who of j.participants) {
      if (state.characters?.[who] && paymentFact) ops.learn(who, paymentFact, 'participated');
    }
    touchJob(ctx, j, { paymentStatus: 'paid' });
    event.location = 'mi6';
    event.area = 'common_room';
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'payment', paymentStatus: 'paid', factKey: paymentFactKey };
    ops.publish(`Off-book remittance settled for Legion job ${j.jobId}.`);
    follow(ctx, j, 'LEGION_JOB_CLOSE', 'close', now + 30 * MIN);
    return true;
  }

  if (a.type === 'LEGION_JOB_CLOSE') {
    touchJob(ctx, j, { status: 'closed', closedAt: now });
    releaseCrew(ctx, j.jobId, now);
    const summary = {
      jobId: j.jobId, family: j.family, openedAt: j.openedAt, closedAt: now,
      sourceEventIds: j.sourceEventIds, sourceCaseId: j.sourceCaseId,
      result: j.result, paymentStatus: j.paymentStatus, dedupeKey: j.dedupeKey
    };
    save(ctx, { closedSummaries: [summary, ...of(ctx.state).closedSummaries].slice(0, 24) });
    releaseSlot(ctx, j.jobId, j.result, now, 48 * 60 * MIN);
    event.location = j.location;
    event.area = j.area;
    event.participants = [...j.participants];
    event.payload = { jobId: j.jobId, family: j.family, stage: 'close', result: j.result };
    ops.publish(`Legion job ${j.jobId} closed.`);
    return true;
  }

  if (a.type === 'LEGION_JOB_HANDOFF_READ') {
    if (!j || !j.report || j.report.createdAt >= now || !canReadHandoff(state.characters[a.actor])
      || known(state.characters[a.actor], j.report.factKey, now)) {
      return refuse('The Legion handoff cannot be read here');
    }
    const reportFact = state.facts[j.report.factKey];
    if (reportFact) ops.learn(a.actor, reportFact, 'handoff_reading');
    event.location = state.characters[a.actor].location;
    event.area = state.characters[a.actor].area;
    event.participants = [a.actor];
    event.payload = { jobId: j.jobId, stage: 'handoff', actor: a.actor, factKey: j.report.factKey };
    return true;
  }

  return false;
}
