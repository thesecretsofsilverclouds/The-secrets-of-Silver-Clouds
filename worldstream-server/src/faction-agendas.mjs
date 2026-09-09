import { createHash } from 'node:crypto';
import { atLondon, londonDate, nextLondonDay, MINUTE_MS as MIN } from './time.mjs';
import { offscreenAvailable } from './offscreen-lives.mjs';

// Bounded authored staging, not an extra incident from Book One. Davis is at
// surveillance screens in manuscript_indexed.txt P00690; the ordinary MEU/MI6
// distinction is P00675. Streamliner control and dispatch are grounded in
// P00161-P00165. Zara uses only the existing author-approved liaison exception.
// No field arrest, new power, revelation, or speech from Captain Hammond occurs.
export const AGENDA_VERSION = 1;
export const AGENDA_EVENT_TYPES = Object.freeze([
  'AGENDA_OPERATION_START', 'AGENDA_OBSERVE', 'AGENDA_REPORT', 'AGENDA_RESOLVE',
  'AGENDA_DEADLINE', 'AGENDA_RELEASE', 'AGENDA_REPORT_READ',
]);
export const AGENDA_FACT_KINDS = Object.freeze(['agenda_report', 'agenda_result']);
export const AGENDA_FAMILIES = Object.freeze(['dispatch_crosscheck', 'record_recheck', 'clearance_handover']);
const TYPES = new Set(AGENDA_EVENT_TYPES);
const STAFF = ['davis', 'zara'];
const NAMES = { davis: 'Agent Davis', zara: 'Zara' };
const OUTCOMES = ['cleared', 'followup_required', 'unverified'];
const of = state => state.agendas ?? initialAgendaState();
const operationOf = (state, id) => of(state).operations[id];
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const known = (actor, key, now) => actor?.knowledge?.some(memory => memory.factKey === key
  && memory.learnedAt <= now && (memory.validUntil == null || memory.validUntil > now));
const canRead = actor => actor?.location === 'mi6' && ['ops_room', 'briefing_room'].includes(actor.area)
  && !actor.journey && ['unhurried_time', 'in_a_briefing', 'on_call', 'waiting'].includes(actor.activity);
const shape = action => ({ type: action.type, dueAt: action.dueAt, priority: action.priority,
  day: action.day, version: action.version, operationId: action.operationId ?? null,
  operationToken: action.operationToken ?? null, actor: action.actor ?? null, actors: action.actors ?? [] });
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const afterDays = (day, count) => { for (let n = 0; n < count; n++) day = nextLondonDay(day); return day; };

export function initialAgendaState() {
  return { version: 1, operations: {}, activeId: null, issued: {}, nextEligibleAt: 0,
    lastResult: null, resources: { attention: 2, capacity: 2 },
    supporting: Object.fromEntries(STAFF.map(id => [id, { commitment: null, knowledge: [] }])) };
}

// An unreserved figure retains the existing cast policy. A reserved figure is
// unavailable to cameos everywhere, including the correct address: a work
// commitment is not permission to stage a second incompatible scene there.
export function supportingAvailability(state, id, { atMs, location, area } = {}) {
  if ([state.sceneBank?.session, state.arcs?.session].some(session =>
    session?.cast?.includes(id) && session.startAt <= atMs && atMs < session.until)) return false;
  const record = of(state).supporting[id];
  if (!record?.commitment) return true;
  const commitment = record.commitment;
  if (!Number.isFinite(atMs)) return false;
  return !(commitment.startAt <= atMs && atMs < commitment.until);
}

export function agendaDayActions({ state, day, now, parentActionId, parentEventId }) {
  const agendas = of(state), dueAt = atLondon(day, '10:05');
  if (!parentActionId || !parentEventId || agendas.activeId || now >= dueAt || dueAt < agendas.nextEligibleAt
    || Object.values(agendas.issued).some(row => !row.consumed && row.shape.type === 'AGENDA_OPERATION_START')) return [];
  return [{ id: `${parentActionId}/agenda/start`, type: 'AGENDA_OPERATION_START', dueAt, priority: 27,
    day, actors: [], version: 1, parentEventId }];
}

export function agendaReportActions({ state, day, now, parentActionId }) {
  if (!parentActionId) return [];
  const latest = Object.values(of(state).operations).filter(operation => operation.report
    && operation.report.createdAt < now).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!latest) return [];
  return ['goaden', 'ashai'].filter(who => canRead(state.characters[who])
    && !known(state.characters[who], latest.report.factKey, now)).map(actor => ({
    id: `${parentActionId}/agenda/read/${actor}`, type: 'AGENDA_REPORT_READ', dueAt: now + 1,
    priority: 27, day, actors: [], actor, version: 1, operationId: latest.id, operationToken: latest.token,
  }));
}

export function issueAgendaActions(ctx, proposals) {
  const actions = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt)
      || action.dueAt <= ctx.now) throw new Error('An agenda action must be an owned future action');
    const current = of(ctx.state);
    if (current.issued[action.id]) continue;
    // The transaction engine has already processed older due actions before a
    // new cause can issue anything. Expired stale deadlines need no permanent
    // ownership entry; keeping them forever would eventually exhaust the cap.
    const retained = Object.entries(current.issued).filter(([, row]) => row.shape.dueAt >= ctx.now - 4 * 24 * 60 * MIN);
    if (retained.length >= 128) throw new Error('Agenda action budget exceeded');
    ctx.ops.setAgendas({ ...current, issued: { ...Object.fromEntries(retained),
      [action.id]: { shape: shape(action), sourceEventId: ctx.id, consumed: false } } });
    actions.push(action);
  }
  return actions;
}

function save(ctx, patch) { ctx.ops.setAgendas({ ...of(ctx.state), ...patch }); }
function setOperation(ctx, operation) {
  save(ctx, { operations: { ...of(ctx.state).operations, [operation.id]: operation } });
}
function touch(ctx, operation, patch) {
  const next = { ...operation, ...patch, lastEventId: ctx.id,
    causalEventIds: [...new Set([...operation.causalEventIds, ctx.id])] };
  setOperation(ctx, next);
  return next;
}
function follow(ctx, operation, type, slug, dueAt, extra = {}) {
  ctx.followups.push(...issueAgendaActions(ctx, [{ id: `${operation.id}/${slug}`, type, dueAt, priority: 27,
    day: londonDate(dueAt), actors: [], version: 1, operationId: operation.id, operationToken: operation.token, ...extra }]));
}
function heldBy(state, who, operation, now) {
  const commitment = of(state).supporting[who]?.commitment;
  return commitment?.operationId === operation.id && commitment.token === operation.token
    && commitment.startAt <= now && now < commitment.until;
}
// The dispatch review, in the register a service actually uses about itself:
// flat, procedural, and quietly aggrieved. Each stage had one sentence and the
// operation runs about twice a week, so over seventy days the same four
// sentences carried ninety-odd firings between them.
//
// Nothing here is decoration. A records review is meant to be boring, and the
// interest is in *how* it is boring — the second copy that does not match, the
// deadline that belongs to somebody else, the check that will now be somebody's
// Monday. Seeded off the event so a given afternoon always reads the same way.
const agendaHash = value => createHash('sha256').update(String(value)).digest().readUInt32BE(0);
const agendaLine = (bank, key) => bank[agendaHash(key) % bank.length];
const AGENDA_RESERVED = Object.freeze([
  'for a bounded dispatch review. The service record had a separate handover deadline.',
  'to cross-check a dispatch record against its own copy. The deadline belongs to somebody else, as usual.',
  'for a records review with a fixed window and an inconveniently fixed handover after it.',
  'to close out a dispatch discrepancy before the handover took it off their hands.',
]);
const AGENDA_RELEASED = Object.freeze([
  'The dispatch-review allocation ended. Its staff and checking time became available again.',
  'The review window closed and the allocation came off the board. Two people got their afternoon back.',
  'The dispatch review released its people on the hour, which is the one part of the process that never slips.',
]);
const AGENDA_OUTCOME = Object.freeze({
  cleared: [
    'The dispatch review closed with the service records reconciled. MI6 cleared its review for handover.',
    'Records reconciled, review closed, handover clean. Nobody will ever read the file again.',
    'The two copies agreed in the end. The review closed on time and told nobody anything they wanted to know.',
  ],
  followup_required: [
    'The dispatch review left a discrepancy unresolved. A replacement record and another check were required.',
    'One entry would not reconcile. A replacement was raised and the whole thing goes round again next week.',
    'The review ended with the discrepancy still in it. Somebody now owns a second check they did not ask for.',
  ],
  unverified: [
    'MI6 could not complete the dispatch review within its allocated window. The next check remained outstanding.',
    'The window closed before the review did. The check is outstanding and will be outstanding on Monday.',
    'The review ran out of time rather than out of discrepancies. It stays open.',
  ],
});
const AGENDA_REPORT = Object.freeze({
  limited: [
    'The MI6 dispatch review produced only a partial cross-check. The record was not cleared.',
    'Only part of the record could be cross-checked. What was checked was fine; what was not remains not.',
    'The cross-check reached about half the entries before the source ran out. The record stays open.',
  ],
  matching: [
    'The MI6 dispatch review found matching service records.',
    'Both copies of the record said the same thing, which surprised at least one person in the room.',
    'The service records matched line for line. The review noted this without enthusiasm.',
  ],
  mismatched: [
    'The MI6 dispatch review found that the service records did not match.',
    'The two copies disagreed, and not in a way anybody could call clerical.',
    'The records did not match. The discrepancy was small, specific, and nobody could account for it.',
  ],
});

function supportKnowledge(ctx, who, evidence) {
  const current = of(ctx.state), record = current.supporting[who];
  const knowledge = [...record.knowledge.filter(item => item.key !== evidence.key), evidence].slice(-16);
  save(ctx, { supporting: { ...current.supporting, [who]: { ...record, knowledge } } });
}
function finish(ctx, operation, outcome) {
  const factKey = `${operation.id}:result`;
  const description = agendaLine(AGENDA_OUTCOME[outcome], ctx.id);
  const result = { outcome, completedAt: ctx.now, sourceEventId: ctx.id, factKey,
    allowsCityInterval: outcome === 'cleared', requiresRecheck: outcome !== 'cleared', family: operation.family };
  ctx.ops.createFact(factKey, 'agenda_result', 'world', { outcome, operationId: operation.id,
    presentationText: description }, null);
  const next = touch(ctx, operation, { status: outcome === 'cleared' ? 'resolved' : 'failed', phase: 'settled', result });
  save(ctx, { activeId: null, lastResult: { ...result, operationId: operation.id } });
  ctx.event.causedBy.push(operation.originEventId, ...(operation.report ? [operation.report.sourceEventId] : []));
  ctx.event.payload = { family: operation.family, outcome, completed: true };
  ctx.ops.publish(description);
  return next;
}

export function resolveAgendaAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const current = of(state), issuance = current.issued[a.id];
  const refuse = reason => { ops.skip(reason); return true; };
  event.location = 'mi6'; event.area = 'ops_room'; event.participants = [];
  if (!issuance || issuance.consumed || a.version !== 1 || !equal(shape(a), issuance.shape))
    return refuse('No owned agenda action');
  let operation = a.operationId ? operationOf(state, a.operationId) : null;
  if (a.type !== 'AGENDA_OPERATION_START' && (!operation || a.operationToken !== operation.token || operation.version !== 1))
    return refuse('No matching operation');
  if (operation && ['AGENDA_OBSERVE', 'AGENDA_REPORT', 'AGENDA_RESOLVE', 'AGENDA_DEADLINE'].includes(a.type)
    && operation.status !== 'active') return refuse('The operation has already ended');
  if (a.type === 'AGENDA_OPERATION_START' && (current.activeId || now < current.nextEligibleAt))
    return refuse('An operation already owns this window');
  if (a.type === 'AGENDA_REPORT_READ' && (!operation.report || operation.report.createdAt >= now
    || !canRead(state.characters[a.actor]) || known(state.characters[a.actor], operation.report.factKey, now)))
    return refuse('The report cannot be read here');
  save(ctx, { issued: { ...current.issued, [a.id]: { ...issuance, consumed: true } } });
  event.causedBy.push(issuance.sourceEventId);

  if (a.type === 'AGENDA_OPERATION_START') {
    const day = londonDate(now), operationId = `agenda:${hash(`${ctx.seed}|agenda-v1|${a.id}`)}`;
    const previous = current.lastResult;
    const family = previous?.requiresRecheck ? 'record_recheck'
      : previous?.family === 'record_recheck' ? 'clearance_handover' : 'dispatch_crosscheck';
    const available = STAFF.filter(who => supportingAvailability(state, who, { atMs: now })
      && offscreenAvailable(state, who, { atMs: now, location:'mi6', until: now + 120 * MIN }));
    const attention = Math.min(current.resources.attention, available.length, 2);
    const team = available.slice(0, attention);
    operation = { id: operationId, token: `${id}:agenda-v1`, version: 1, family,
      status: 'active', phase: 'reserved', startedAt: now, deadlineAt: now + 90 * MIN,
      releaseAt: now + 120 * MIN, originEventId: id, lastEventId: id,
      causalEventIds: [id], previousResultEventId: previous?.sourceEventId ?? null,
      objectives: { mi6: 'verify_before_clearance', streamliner: 'complete_record_handover_within_window' },
      team, allocatedAttention: attention, resourcesReleased: false, observation: null, report: null, result: null };
    const retained = Object.values(current.operations).sort((a, b) => b.startedAt - a.startedAt).slice(0, 11);
    const supporting = { ...current.supporting };
    for (const who of team) supporting[who] = { ...supporting[who], commitment: {
      operationId, token: operation.token, location: 'mi6', area: 'ops_room',
      startAt: now, until: operation.releaseAt, sourceEventId: id,
    } };
    save(ctx, { operations: { ...Object.fromEntries(retained.map(row => [row.id, row])), [operationId]: operation },
      activeId: operationId, nextEligibleAt: atLondon(afterDays(day, 3), '10:05'), supporting,
      resources: { ...current.resources, attention: current.resources.attention - attention } });
    if (previous) event.causedBy.push(previous.sourceEventId);
    event.payload = { family, team: [...team], deadlineAt: operation.deadlineAt };
    ops.publish(team.length ? `MI6 reserved ${team.map(who => NAMES[who]).join(' and ')} ${agendaLine(AGENDA_RESERVED, id)}`
      : 'MI6 opened a dispatch-review window without an available checking team. The service deadline still stood.');
    follow(ctx, operation, 'AGENDA_OBSERVE', 'observe', now + 25 * MIN);
    follow(ctx, operation, 'AGENDA_REPORT', 'report', now + 40 * MIN);
    follow(ctx, operation, 'AGENDA_RESOLVE', 'resolve', now + 70 * MIN);
    follow(ctx, operation, 'AGENDA_DEADLINE', 'deadline', operation.deadlineAt);
    follow(ctx, operation, 'AGENDA_RELEASE', 'release', operation.releaseAt);
  } else if (a.type === 'AGENDA_OBSERVE') {
    const witnesses = operation.team.filter(who => heldBy(state, who, operation, now));
    if (!witnesses.length) return refuse('No allocated team could inspect the records');
    // A bounded dispatch discrepancy, never a claim about an unseen creature,
    // enemy or plot secret. Bad weather consumes part of the same checking time.
    const severeWeather = ['storm', 'heavy_rain', 'snow'].includes(state.weather?.code);
    const roll = parseInt(hash(`${ctx.seed}|dispatch-record-v1|${operation.id}`).slice(0, 8), 16) % 4;
    const reconciled = operation.family !== 'dispatch_crosscheck' || roll !== 0;
    const coverage = witnesses.length >= 2 && operation.allocatedAttention >= 2 && !severeWeather ? 'complete' : 'limited';
    const observation = { key: `${operation.id}:observed`, sourceEventId: id, observedAt: now,
      witnesses, recordStatus: reconciled ? 'matching' : 'discrepant', coverage };
    operation = touch(ctx, operation, { phase: 'observed', observation });
    for (const who of witnesses) supportKnowledge(ctx, who, { ...observation, learnedAt: now,
      acquisitionEventId: id, provenance: 'inspected_dispatch_records' });
    event.payload = { operationId: operation.id, observed: true };
  } else if (a.type === 'AGENDA_REPORT') {
    const evidence = operation.observation;
    const source = operation.team.find(who => heldBy(state, who, operation, now)
      && of(state).supporting[who].knowledge.some(item => item.key === evidence?.key
        && item.sourceEventId === evidence?.sourceEventId && item.learnedAt <= now));
    if (!source || !evidence || evidence.observedAt >= now) return refuse('No source possesses an inspected record');
    const description = agendaLine(AGENDA_REPORT[evidence.coverage === 'limited' ? 'limited'
      : evidence.recordStatus === 'matching' ? 'matching' : 'mismatched'], id);
    const factKey = `${operation.id}:report`;
    ops.createFact(factKey, 'agenda_report', 'world', { operationId: operation.id,
      coverage: evidence.coverage, recordStatus: evidence.coverage === 'complete' ? evidence.recordStatus : 'unverified',
      source, presentationText: description }, null);
    operation = touch(ctx, operation, { phase: 'reported', report: { factKey, source,
      sourceEventId: id, evidenceEventId: evidence.sourceEventId, createdAt: now,
      coverage: evidence.coverage, recordStatus: evidence.coverage === 'complete' ? evidence.recordStatus : 'unverified' } });
    event.causedBy.push(evidence.sourceEventId);
    event.payload = { family: operation.family, source };
    ops.publish(description);
  } else if (a.type === 'AGENDA_RESOLVE') {
    const report = operation.report;
    if (!report || report.createdAt >= now || state.facts[report.factKey]?.sourceEventId !== report.sourceEventId)
      return refuse('No received report can settle the review');
    const outcome = report.coverage !== 'complete' ? 'unverified'
      : report.recordStatus === 'matching' ? 'cleared' : 'followup_required';
    finish(ctx, operation, outcome);
  } else if (a.type === 'AGENDA_DEADLINE') {
    finish(ctx, operation, 'unverified');
  } else if (a.type === 'AGENDA_RELEASE') {
    if (operation.resourcesReleased || now !== operation.releaseAt) return refuse('The staffing allocation has already returned');
    const next = of(state), supporting = { ...next.supporting };
    for (const who of operation.team) if (supporting[who].commitment?.operationId === operation.id
      && supporting[who].commitment.token === operation.token) supporting[who] = { ...supporting[who], commitment: null };
    save(ctx, { supporting, resources: { ...next.resources,
      attention: Math.min(next.resources.capacity, next.resources.attention + operation.allocatedAttention) } });
    touch(ctx, operation, { resourcesReleased: true });
    event.payload = { family: operation.family, personnelReleased: true };
    ops.publish(agendaLine(AGENDA_RELEASED, id));
  } else if (a.type === 'AGENDA_REPORT_READ') {
    const report = operation.report, fact = state.facts[report.factKey];
    if (!fact || fact.sourceEventId !== report.sourceEventId) return refuse('No public report exists');
    ops.learn(a.actor, fact, 'checked_ordinary_notice');
    ops.useMemory(a.actor, report.factKey);
    event.area = state.characters[a.actor].area; event.participants = [a.actor];
    event.payload = { family: operation.family };
    ops.publish(`${a.actor === 'ashai' ? 'Ashai' : 'Goaden'} read the retained MI6 dispatch report. ${fact.value.presentationText}`);
  }
  return true;
}

export function agendaFactionOverrides(state, now) {
  const current = of(state), operation = operationOf(state, current.activeId);
  if (operation?.status === 'active' && operation.startedAt <= now) return {
    mi6: operation.team.length < 2 || state.factions?.mi6 === 'elevated' ? 'elevated' : 'briefings',
  };
  return {};
}

export function agendaOpportunity(state, kind, now) {
  const current = of(state), last = current.lastResult;
  if (!last || last.completedAt > now || current.activeId) return { available: false, sourceEventId: null, reason: 'no_settled_review' };
  const available = kind === 'city_interval' ? last.allowsCityInterval
    : kind === 'service_recheck' ? last.requiresRecheck : false;
  return { available, sourceEventId: last.sourceEventId, reason: available ? last.outcome : 'prior_outcome_does_not_allow_it' };
}

export function publicAgendaSummaries(state, now) {
  return Object.values(of(state).operations).filter(operation => operation.startedAt <= now)
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, 3).map(operation => ({
      title: { dispatch_crosscheck: 'Dispatch cross-check', record_recheck: 'Replacement record check',
        clearance_handover: 'Service clearance handover' }[operation.family],
      location: 'mi6', status: operation.status, startedAt: operation.startedAt,
      deadlineAt: operation.deadlineAt, ...(operation.result && operation.result.completedAt <= now
        ? { outcome: operation.result.outcome, completedAt: operation.result.completedAt, eventId: operation.result.sourceEventId }
        : { description: 'A checking team and a service deadline share the same limited window.' }),
    }));
}

export function assertAgendas(state) {
  const agendas = state.agendas;
  if (!agendas || agendas.version !== 1 || !agendas.operations || !agendas.supporting || !agendas.issued
    || !Number.isInteger(agendas.resources?.attention) || agendas.resources.attention < 0
    || agendas.resources.attention > agendas.resources.capacity || agendas.resources.capacity !== 2
    || Object.keys(agendas.operations).length > 12 || Object.keys(agendas.issued).length > 128
    || Object.keys(agendas.supporting).sort().join(',') !== 'davis,zara')
    throw new Error('Invalid bounded agenda state');
  const active = Object.values(agendas.operations).filter(operation => operation.status === 'active');
  if (active.length > 1 || (active[0]?.id ?? null) !== agendas.activeId) throw new Error('Conflicting active faction operations');
  for (const operation of Object.values(agendas.operations)) {
    if (operation.version !== 1 || !AGENDA_FAMILIES.includes(operation.family)
      || !['active', 'resolved', 'failed'].includes(operation.status) || !operation.originEventId
      || !operation.token || operation.deadlineAt <= operation.startedAt || operation.releaseAt <= operation.deadlineAt
      || operation.team.some(who => !STAFF.includes(who)) || new Set(operation.team).size !== operation.team.length
      || operation.allocatedAttention !== operation.team.length || operation.team.length > 2)
      throw new Error('Invalid faction operation');
    if (operation.report && (!operation.observation || !operation.observation.witnesses.includes(operation.report.source)
      || operation.report.evidenceEventId !== operation.observation.sourceEventId
      || state.facts[operation.report.factKey]?.sourceEventId !== operation.report.sourceEventId))
      throw new Error('An institutional report lacks acquired evidence');
    if (operation.result && (!OUTCOMES.includes(operation.result.outcome)
      || state.facts[operation.result.factKey]?.sourceEventId !== operation.result.sourceEventId
      || state.facts[operation.result.factKey]?.value.outcome !== operation.result.outcome
      || operation.result.completedAt > operation.deadlineAt || operation.status === 'active'
      || operation.result.allowsCityInterval !== (operation.result.outcome === 'cleared')
      || operation.result.requiresRecheck !== (operation.result.outcome !== 'cleared')
      || operation.result.outcome === 'cleared' && (operation.report?.coverage !== 'complete' || operation.report.recordStatus !== 'matching')
      || operation.result.outcome === 'followup_required' && (operation.report?.coverage !== 'complete' || operation.report.recordStatus !== 'discrepant')))
      throw new Error('Invalid lasting faction result');
    if (operation.status !== 'active' && !operation.result) throw new Error('An ended operation needs an outcome');
  }
  for (const [who, person] of Object.entries(agendas.supporting)) {
    if (!STAFF.includes(who) || !Array.isArray(person.knowledge) || person.knowledge.length > 16)
      throw new Error('Invalid supporting character');
    if (person.commitment) {
      const operation = agendas.operations[person.commitment.operationId];
      if (!operation || !operation.team.includes(who) || person.commitment.token !== operation.token
        || person.commitment.location !== 'mi6' || person.commitment.area !== 'ops_room'
        || person.commitment.until !== operation.releaseAt) throw new Error('Invalid supporting commitment');
    }
  }
}
