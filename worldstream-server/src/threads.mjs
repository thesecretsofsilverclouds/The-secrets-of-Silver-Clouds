import { createHash } from 'node:crypto';
import { atLondon, londonDate, MINUTE_MS as MIN } from './time.mjs';

// Authored sandbox staging, not a manuscript incident: one ordinary delivery
// needs its dispatch copy checked. No conspiracy, new ability or book revelation
// is an admissible explanation. Characters can help; the shop's deadline does
// not wait for them or for a reader. All semantic writes use fixture ledger ops.
export const DELIVERY_DEFINITION = Object.freeze({
  id: 'ink_delivery_dispute', version: 1, venue: 'enchanted_ink',
  deadlineMinutes: 45, copyMinutes: 15,
  outcomes: Object.freeze(['reconciled', 'returned', 'missed_window']),
});
export const THREAD_EVENT_TYPES = Object.freeze([
  'THREAD_DELIVERY_OPEN', 'THREAD_DELIVERY_CHECK', 'THREAD_DISPATCH_RECEIVED',
  'THREAD_DELIVERY_DECIDE', 'THREAD_DELIVERY_DEADLINE',
  'THREAD_DELIVERY_RESULT_NOTICED', 'THREAD_DELIVERY_REMEMBERED',
]);
export const THREAD_FACT_KINDS = Object.freeze([
  'ink_delivery_problem', 'ink_delivery_request', 'ink_delivery_dispatch', 'ink_delivery_result',
]);
const TYPES = new Set(THREAD_EVENT_TYPES);
const SCENARIOS = ['matching_reference', 'mismatched_reference', 'delayed_copy'];
const atInk = actor => actor?.location === 'enchanted_ink' && actor.area === 'venue'
  && !actor.journey && actor.activity !== 'sleeping';
const eligible = actor => atInk(actor)
  && ['visiting_enchanted_ink', 'unhurried_time'].includes(actor.activity);
const present = state => ['ashai', 'goaden'].filter(who => atInk(state.characters[who]));
const available = state => ['ashai', 'goaden'].filter(who => eligible(state.characters[who]));
const memory = (state, who, key, now) => key && state.characters[who]?.knowledge?.find(item =>
  item.factKey === key && item.learnedAt <= now && (item.validUntil == null || item.validUntil > now));
const threadsOf = state => state.threads ?? initialThreads();
const instanceOf = (state, id) => threadsOf(state).instances[id];
const openAt = now => now >= atLondon(londonDate(now), '11:00')
  && now < atLondon(londonDate(now), '17:00');
const scenarioFor = (seed, originActionId) => SCENARIOS[createHash('sha256')
  .update(`${seed}|ink-delivery-v1|${originActionId}`).digest().readUInt32BE(0) % SCENARIOS.length];
const name = who => who === 'ashai' ? 'Ashai' : 'Goaden';

export function initialThreads() { return { instances: {}, completedDefinitions: {}, opportunity: null }; }

function action(thread, type, id, dueAt, extra = {}) {
  return { id, type, dueAt, priority: 26, day: londonDate(dueAt), actors: [],
    threadId: thread.id, threadToken: thread.token, definitionVersion: 1, ...extra };
}

const issuedShape = a => ({ type: a.type, dueAt: a.dueAt, definitionVersion: a.definitionVersion,
  day: a.day, priority: a.priority, actors: a.actors ?? [],
  actor: a.actor ?? null, choice: a.choice ?? null });
const matchesIssued = (a, issued) => issued && JSON.stringify(issuedShape(a)) === JSON.stringify(issued.shape);

// Pure selectors propose; the committed cause issues and persists ownership.
// A copied token alone cannot invent a new check, callback or appointment stage.
export function issueThreadActions(ctx, actions) {
  const issued = [];
  for (const a of actions) {
    if (!TYPES.has(a.type) || a.definitionVersion !== 1 || !Number.isFinite(a.dueAt) || a.dueAt <= ctx.now)
      throw new Error('Episode actions must be owned future actions');
    const current = threadsOf(ctx.state);
    if (a.type === 'THREAD_DELIVERY_OPEN') {
      if (Object.keys(current.instances).length || current.opportunity) continue;
      ctx.ops.setThreads({ ...current, opportunity: { actionId: a.id, shape: issuedShape(a),
        sourceEventId: ctx.id, originActionId: a.originActionId, originAt: a.originAt, scenario: a.scenario } });
    } else {
      const thread = current.instances[a.threadId];
      if (!thread || a.threadToken !== thread.token || thread.issuedActions[a.id]) continue;
      if (Object.keys(thread.issuedActions).length >= 32) throw new Error('Delivery action budget exceeded');
      save(ctx, { ...thread, issuedActions: { ...thread.issuedActions,
        [a.id]: { shape: issuedShape(a), sourceEventId: ctx.id, consumed: false } } });
    }
    issued.push(a);
  }
  return issued;
}
function follow(ctx, actions) { ctx.followups.push(...issueThreadActions(ctx, actions)); }

// The originating committed visit owns the opportunity. Existing roots, future
// reads, and return visits cannot create a second instance of this definition.
export function threadVisitActions({ state, day, now, parentActionId, parentEventId, seed }) {
  if (Object.values(threadsOf(state).instances).some(item => item.definitionId === DELIVERY_DEFINITION.id))
    return threadEncounterActions({ state, day, now, parentActionId, eventType: 'CITY_ACTIVITY_BEGIN' });
  if (!parentActionId || !parentEventId || threadsOf(state).opportunity || !present(state).length
    || !openAt(now) || now + 7 * MIN > atLondon(day, '17:00')) return [];
  return [{ id: `${parentActionId}/delivery/open`, type: 'THREAD_DELIVERY_OPEN',
    dueAt: now + 2 * MIN, priority: 26, day, actors: [], originActionId: parentActionId,
    originEventId: parentEventId, originAt: now, definitionVersion: 1, scenario: scenarioFor(seed, parentActionId) }];
}

// Hooked to committed local activity/encounter transitions, never API reads.
// There is at most one check per triggering action and one terminal callback.
export function threadEncounterActions({ state, day, now, parentActionId, eventType }) {
  if (!parentActionId || !available(state).length || !openAt(now)) return [];
  const thread = Object.values(threadsOf(state).instances).find(item => item.definitionId === DELIVERY_DEFINITION.id);
  if (!thread) return [];
  if (thread.status === 'active') {
    if (now >= thread.deadlineAt || thread.pendingDecision) return [];
    const needsCheck = available(state).some(who =>
      !memory(state, who, thread.factKeys.problem, now)
      || thread.factKeys.dispatch && !memory(state, who, thread.factKeys.dispatch, now)
      || availableDeliveryActions(state, thread.id, who, now).length);
    return needsCheck ? [action(thread, 'THREAD_DELIVERY_CHECK', `${parentActionId}/delivery/check`, now + 1)] : [];
  }
  if (eventType !== 'CITY_ACTIVITY_BEGIN' || thread.callbackEventId || now <= thread.result.completedAt) return [];
  const allKnow = available(state).every(who => memory(state, who, thread.factKeys.result, now));
  const type = allKnow ? 'THREAD_DELIVERY_REMEMBERED' : 'THREAD_DELIVERY_RESULT_NOTICED';
  return [action(thread, type, `${parentActionId}/delivery/return`, now + 1)];
}

// This is a pure policy view, not a player command endpoint. Missing evidence
// changes the actual action set; a private latent cause never unlocks a choice.
export function availableDeliveryActions(state, threadId, who, now) {
  const thread = instanceOf(state, threadId);
  if (!thread || thread.status !== 'active' || now >= thread.deadlineAt || !openAt(now)
    || !eligible(state.characters[who]) || !memory(state, who, thread.factKeys.problem, now)) return [];
  const dispatch = memory(state, who, thread.factKeys.dispatch, now);
  if (dispatch) return dispatch.value.reference === 'matching'
    ? ['confirm_dispatch'] : ['return_mismatched_delivery'];
  return thread.request ? [] : ['request_dispatch_copy'];
}

function save(ctx, thread) {
  const current = threadsOf(ctx.state);
  ctx.ops.setThreads({ ...current, instances: { ...current.instances, [thread.id]: thread },
    completedDefinitions: thread.status === 'active' ? current.completedDefinitions
      : { ...current.completedDefinitions, [thread.definitionId]: thread.id } });
}
function mark(ctx, thread, patch = {}) {
  const next = { ...thread, ...patch, lastEventId: ctx.id,
    causalEventIds: [...new Set([...thread.causalEventIds, ctx.id])] };
  save(ctx, next);
  return next;
}
function causal(ctx, ...ids) { ctx.event.causedBy.push(...ids.filter(Boolean)); }
function factValue(thread, presentationText, extra = {}) {
  return { threadId: thread.id, presentationText, ...extra };
}
function abandonUnavailable(ctx, thread) {
  const participants = { ...thread.participation };
  let changed = false;
  for (const [who, participation] of Object.entries(participants)) {
    if (['volunteered', 'checking'].includes(participation.status) && !eligible(ctx.state.characters[who])) {
      participants[who] = { ...participation, status: 'abandoned', abandonedAt: ctx.now,
        abandonmentEventId: ctx.id, reason: 'no_longer_available_at_venue' };
      causal(ctx, participation.sourceEventId);
      changed = true;
    }
  }
  return changed ? mark(ctx, thread, { participation: participants }) : thread;
}
function resultText(outcome) {
  return {
    reconciled: 'The dispatch copy matched. Enchanted Ink accepted the ordinary delivery and closed the discrepancy.',
    returned: 'The dispatch references did not match. Enchanted Ink returned the delivery instead of accepting it.',
    missed_window: 'The dispatch copy missed the deadline. Enchanted Ink lost that delivery window and left the supplies outstanding.',
  }[outcome];
}
function settle(ctx, thread, outcome, resolver) {
  const factKey = `${thread.id}:result`;
  const result = { outcome, deliveryDisposition: { reconciled: 'accepted', returned: 'returned', missed_window: 'outstanding' }[outcome],
    resolver, completedAt: ctx.now, sourceEventId: ctx.id,
    nextVisitNote: { reconciled: 'delivery_record_closed', returned: 'replacement_still_required', missed_window: 'next_delivery_window_required' }[outcome] };
  const participation = Object.fromEntries(Object.entries(thread.participation).map(([who, item]) => [who,
    who !== resolver && ['volunteered', 'checking'].includes(item.status)
      ? { ...item, status: 'ended', endedAt: ctx.now, endingEventId: ctx.id } : item]));
  if (resolver !== 'enchanted_ink') participation[resolver] = { ...participation[resolver],
    status: 'completed', completionEventId: ctx.id, completedAt: ctx.now };
  const fact = ctx.ops.createFact(factKey, 'ink_delivery_result', 'world',
    factValue(thread, resultText(outcome), { outcome, deliveryDisposition: result.deliveryDisposition }), null);
  // The person completing the check knows its result. A shop-only settlement
  // teaches nobody automatically; a later visitor must read the retained entry.
  if (resolver !== 'enchanted_ink') ctx.ops.learn(resolver, fact, 'participated');
  causal(ctx, thread.originEventId, thread.dispatchEventId, thread.request?.sourceEventId);
  mark(ctx, thread, { status: outcome === 'missed_window' ? 'failed' : 'resolved', stage: 'settled',
    result, pendingDecision: null, participation, factKeys: { ...thread.factKeys, result: factKey } });
  ctx.event.participants = resolver === 'enchanted_ink' ? [] : [resolver];
  ctx.event.payload = { threadId: thread.id, outcome, deliveryDisposition: result.deliveryDisposition,
    resolver, completed: true };
  ctx.ops.publish(resultText(outcome));
}

export function resolveThreadAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const refuse = reason => { ops.skip(reason); return true; };
  event.location = 'enchanted_ink'; event.area = 'venue'; event.participants = [];
  if (a.type === 'THREAD_DELIVERY_OPEN') {
    if (Object.values(threadsOf(state).instances).some(item => item.definitionId === DELIVERY_DEFINITION.id))
      return refuse('This delivery episode already exists');
    const opportunity = threadsOf(state).opportunity;
    if (!opportunity || opportunity.actionId !== a.id || !matchesIssued(a, opportunity)
      || a.originEventId !== opportunity.sourceEventId || a.originActionId !== opportunity.originActionId
      || a.originAt !== opportunity.originAt || a.scenario !== opportunity.scenario
      || !a.originActionId || a.id !== `${a.originActionId}/delivery/open` || now !== a.originAt + 2 * MIN
      || a.scenario !== scenarioFor(ctx.seed, a.originActionId))
      return refuse('No owned ordinary visit for this delivery episode');
    if (!present(state).length || !openAt(now) || now + 5 * MIN > atLondon(a.day, '17:00')) {
      ops.setThreads({ ...threadsOf(state), opportunity: null });
      return refuse('The originating visit ended before the episode opened; its opportunity was released');
    }
    const threadId = `thread:${createHash('sha256').update(`${id}|ink-delivery-v1`).digest('hex').slice(0, 24)}`;
    const deadlineAt = Math.min(now + DELIVERY_DEFINITION.deadlineMinutes * MIN, atLondon(a.day, '17:00'));
    const copyAt = a.scenario === 'delayed_copy' ? deadlineAt + 2 * MIN
      : Math.min(now + DELIVERY_DEFINITION.copyMinutes * MIN, deadlineAt - MIN);
    const thread = { id: threadId, token: `${id}:delivery-v1`, definitionId: DELIVERY_DEFINITION.id,
      definitionVersion: 1, originEventId: id, originActionId: a.originActionId,
      openedAt: now, deadlineAt, status: 'active', stage: 'problem_known',
      bindings: { venue: 'enchanted_ink', deliveryId: `${threadId}:ordinary-delivery` },
      hidden: { scenario: a.scenario, copyAt, reference: a.scenario === 'mismatched_reference' ? 'mismatched' : 'matching' },
      schedule: { dispatchActionId: `${a.id}/dispatch`, deadlineActionId: `${a.id}/deadline` },
      factKeys: { problem: `${threadId}:problem`, dispatch: null, result: null },
      request: null, dispatchEventId: null, pendingDecision: null, participation: {},
      result: null, callbackEventId: null, causalEventIds: [id], lastEventId: id, issuedActions: {} };
    save(ctx, thread);
    const text = 'An ordinary delivery at Enchanted Ink remained unconfirmed: its dispatch copy had not arrived. The delivery window had a deadline.';
    const fact = ops.createFact(thread.factKeys.problem, 'ink_delivery_problem', 'world',
      factValue(thread, text, { deadlineAt }), null);
    for (const who of present(state)) ops.learn(who, fact, 'self_observation');
    event.participants = present(state); event.payload = { threadId, deadlineAt, stage: thread.stage };
    causal(ctx, a.originEventId);
    ops.publish(text);
    follow(ctx, [action(thread, 'THREAD_DELIVERY_CHECK', `${a.id}/check`, now + MIN),
      action(thread, 'THREAD_DISPATCH_RECEIVED', thread.schedule.dispatchActionId, copyAt),
      action(thread, 'THREAD_DELIVERY_DEADLINE', thread.schedule.deadlineActionId, deadlineAt)]);
    return true;
  }
  let thread = instanceOf(state, a.threadId);
  if (!thread || thread.definitionVersion !== 1 || a.definitionVersion !== 1 || a.threadToken !== thread.token
    || !matchesIssued(a, thread.issuedActions[a.id]) || thread.issuedActions[a.id].consumed)
    return refuse('No matching versioned delivery episode');
  if (thread.status !== 'active' && !['THREAD_DISPATCH_RECEIVED',
    'THREAD_DELIVERY_RESULT_NOTICED', 'THREAD_DELIVERY_REMEMBERED'].includes(a.type))
    return refuse('This delivery episode has already ended');
  const issuance = thread.issuedActions[a.id];
  thread = { ...thread, issuedActions: { ...thread.issuedActions,
    [a.id]: { ...issuance, consumed: true } } };
  save(ctx, thread);
  causal(ctx, issuance.sourceEventId);
  causal(ctx, thread.originEventId);
  if (a.type === 'THREAD_DELIVERY_RESULT_NOTICED' || a.type === 'THREAD_DELIVERY_REMEMBERED') {
    if (thread.status === 'active' || !thread.result || thread.callbackEventId || now <= thread.result.completedAt
      || !available(state).length || !openAt(now)) return refuse('No completed delivery record to revisit here');
    const fact = state.facts[thread.factKeys.result];
    if (!fact || fact.sourceEventId !== thread.result.sourceEventId) return refuse('No committed delivery result');
    if (a.type === 'THREAD_DELIVERY_RESULT_NOTICED') {
      const newcomers = available(state).filter(who => !memory(state, who, fact.key, now));
      if (!newcomers.length) return refuse('The available visitors already know the result');
      for (const who of newcomers) ops.learn(who, fact, 'checked_ordinary_notice');
      event.participants = newcomers; event.payload = { threadId: thread.id, outcome: thread.result.outcome };
      ops.publish(`${newcomers.map(name).join(' and ')} read the retained delivery entry at Enchanted Ink. ${resultText(thread.result.outcome)}`);
      follow(ctx, [action(thread, 'THREAD_DELIVERY_REMEMBERED', `${a.id}/remember`, now + 1)]);
    } else {
      const informed = available(state).filter(who => memory(state, who, fact.key, now));
      if (!informed.length) return refuse('Nobody here knows the previous outcome');
      for (const who of informed) ops.useMemory(who, fact.key);
      mark(ctx, thread, { callbackEventId: id });
      event.participants = informed; event.payload = { threadId: thread.id, outcome: thread.result.outcome };
      ops.publish(`${informed.map(name).join(' and ')} returned to Enchanted Ink with the previous delivery outcome remembered. ${resultText(thread.result.outcome)}`);
    }
    return true;
  }
  if (a.type === 'THREAD_DISPATCH_RECEIVED') {
    if (a.id !== thread.schedule.dispatchActionId || now !== thread.hidden.copyAt || thread.dispatchEventId)
      return refuse('No owned dispatch arrival');
    const key = `${thread.id}:dispatch`;
    ops.createFact(key, 'ink_delivery_dispatch', 'world', factValue(thread,
      thread.hidden.reference === 'matching' ? 'The received dispatch copy matches the delivery reference.'
        : 'The received dispatch copy has a different delivery reference.', { reference: thread.hidden.reference }), null);
    const finished = thread.status !== 'active';
    thread = mark(ctx, thread, { dispatchEventId: id, stage: finished ? 'settled' : 'dispatch_available',
      factKeys: { ...thread.factKeys, dispatch: key } });
    event.payload = { threadId: thread.id, stage: thread.stage };
    ops.publish(finished ? 'The dispatch copy reached Enchanted Ink after the delivery deadline. The missed window stayed closed.'
      : 'The missing dispatch copy reached Enchanted Ink. Its references still needed checking.');
    if (!finished) follow(ctx, [action(thread, 'THREAD_DELIVERY_CHECK', `${a.id}/check`, now + 1)]);
  } else if (thread.status !== 'active') {
    return refuse('This delivery episode has already ended');
  } else if (a.type === 'THREAD_DELIVERY_CHECK') {
    if (now >= thread.deadlineAt || !openAt(now)) return refuse('The delivery checking window is closed');
    const beforeAbandonment = thread;
    thread = abandonUnavailable(ctx, thread);
    const who = available(state).find(candidate => thread.participation[candidate]?.status !== 'abandoned');
    if (!who || thread.pendingDecision) {
      if (beforeAbandonment !== thread) {
        event.payload = { threadId: thread.id, participation: 'abandoned' };
        ops.publish('The offered help with Enchanted Ink’s delivery check could not continue. The shop retained its own deadline.');
        return true;
      }
      return refuse('No available reader for the delivery records');
    }
    const problem = state.facts[thread.factKeys.problem];
    if (!memory(state, who, problem.key, now)) ops.learn(who, problem, 'checked_ordinary_notice');
    ops.useMemory(who, problem.key);
    const dispatch = state.facts[thread.factKeys.dispatch];
    if (dispatch && !memory(state, who, dispatch.key, now)) ops.learn(who, dispatch, 'checked_ordinary_notice');
    const choices = availableDeliveryActions(state, thread.id, who, now);
    if (!choices.length) return refuse('No new informed action is available');
    if (choices[0] === 'request_dispatch_copy') {
      const request = { actor: who, requestedAt: now, sourceEventId: id, factKey: `${thread.id}:request` };
      const text = `${name(who)} offered to check the delivery and asked Enchanted Ink for the missing dispatch copy. Confirmation would have to wait for it.`;
      const fact = ops.createFact(request.factKey, 'ink_delivery_request', who,
        factValue(thread, text), null);
      ops.learn(who, fact, 'participated');
      thread = mark(ctx, thread, { request, stage: 'awaiting_dispatch', participation: {
        ...thread.participation, [who]: { status: 'volunteered', sourceEventId: id, startedAt: now } } });
      event.participants = [who]; event.payload = { threadId: thread.id, action: 'request_dispatch_copy' };
      ops.publish(text);
    } else {
      ops.useMemory(who, dispatch.key);
      const pendingDecision = { actor: who, choice: choices[0], dueAt: now + MIN,
        actionId: `${a.id}/decide`, sourceEventId: id };
      thread = mark(ctx, thread, { stage: 'decision_pending', pendingDecision, participation: {
        ...thread.participation, [who]: { ...thread.participation[who], status: 'checking',
          sourceEventId: thread.participation[who]?.sourceEventId ?? id, inspectionEventId: id } } });
      event.participants = [who]; event.payload = { threadId: thread.id, stage: thread.stage };
      ops.publish(`${name(who)} checked the dispatch copy against the delivery record at Enchanted Ink.`);
      follow(ctx, [action(thread, 'THREAD_DELIVERY_DECIDE', pendingDecision.actionId,
        pendingDecision.dueAt, { actor: who, choice: pendingDecision.choice })]);
    }
  } else if (a.type === 'THREAD_DELIVERY_DECIDE') {
    const pending = thread.pendingDecision;
    if (!pending || a.id !== pending.actionId || now !== pending.dueAt || a.actor !== pending.actor
      || a.choice !== pending.choice || now >= thread.deadlineAt) return refuse('No owned informed delivery decision');
    thread = abandonUnavailable(ctx, thread);
    if (!availableDeliveryActions(state, thread.id, a.actor, now).includes(a.choice)) {
      thread = mark(ctx, thread, { stage: thread.dispatchEventId ? 'dispatch_available' : 'awaiting_dispatch', pendingDecision: null });
      event.payload = { threadId: thread.id, participation: 'abandoned' };
      ops.publish(`${name(a.actor)} could not continue the delivery check. Enchanted Ink would settle it by the recorded deadline.`);
      return true;
    }
    ops.useMemory(a.actor, thread.factKeys.problem); ops.useMemory(a.actor, thread.factKeys.dispatch);
    causal(ctx, pending.sourceEventId);
    settle(ctx, thread, a.choice === 'confirm_dispatch' ? 'reconciled' : 'returned', a.actor);
  } else if (a.type === 'THREAD_DELIVERY_DEADLINE') {
    if (a.id !== thread.schedule.deadlineActionId || now !== thread.deadlineAt)
      return refuse('No owned delivery deadline');
    thread = abandonUnavailable(ctx, thread);
    const dispatch = state.facts[thread.factKeys.dispatch];
    const outcome = dispatch && dispatch.createdAt <= now && dispatch.sourceEventId === thread.dispatchEventId
      ? (dispatch.value.reference === 'matching' ? 'reconciled' : 'returned') : 'missed_window';
    settle(ctx, thread, outcome, 'enchanted_ink');
  }
  return true;
}

// Projection names every permitted field. Hidden reference, receipt timing,
// ownership token, knowledge keys and individual decision state stay private.
export function publicThreadSummaries(state, now) {
  return Object.values(threadsOf(state).instances).filter(thread => thread.openedAt <= now).map(thread => ({
    id: thread.id, title: 'The missing dispatch copy', location: 'enchanted_ink',
    status: thread.status, openedAt: thread.openedAt, deadlineAt: thread.deadlineAt,
    ...(thread.result && thread.result.completedAt <= now ? { outcome: thread.result.outcome,
      deliveryDisposition: thread.result.deliveryDisposition, completedAt: thread.result.completedAt,
      eventId: thread.result.sourceEventId, description: resultText(thread.result.outcome) }
      : { description: 'An ordinary delivery awaits its dispatch check at Enchanted Ink.' }),
  }));
}

export function assertThreads(state) {
  const threads = state.threads;
  if (!threads || !threads.instances || !threads.completedDefinitions) throw new Error('Invalid episode state');
  const instances = Object.values(threads.instances);
  if (instances.length > 1) throw new Error('Only one delivery episode is permitted');
  for (const thread of instances) {
    if (threads.instances[thread.id] !== thread || thread.definitionId !== DELIVERY_DEFINITION.id
      || thread.definitionVersion !== 1 || !thread.token || !thread.originEventId
      || thread.bindings.venue !== 'enchanted_ink' || !SCENARIOS.includes(thread.hidden.scenario)
      || thread.hidden.reference !== (thread.hidden.scenario === 'mismatched_reference' ? 'mismatched' : 'matching')
      || !['active', 'resolved', 'failed'].includes(thread.status)
      || !['problem_known', 'awaiting_dispatch', 'dispatch_available', 'decision_pending', 'settled'].includes(thread.stage)
      || !Number.isFinite(thread.openedAt) || !Number.isFinite(thread.deadlineAt) || thread.deadlineAt <= thread.openedAt
      || !Number.isFinite(thread.hidden.copyAt) || thread.hidden.copyAt <= thread.openedAt
      || !thread.schedule.dispatchActionId || !thread.schedule.deadlineActionId
      || !thread.issuedActions || Object.keys(thread.issuedActions).length > 32
      || !thread.causalEventIds.includes(thread.originEventId) || thread.causalEventIds.length > 16)
      throw new Error('Invalid versioned delivery instance');
    for (const [who, participation] of Object.entries(thread.participation)) {
      if (!['goaden', 'ashai'].includes(who) || !['volunteered', 'checking', 'abandoned', 'completed', 'ended'].includes(participation.status)
        || !participation.sourceEventId || participation.status === 'abandoned' && !participation.abandonmentEventId)
        throw new Error('Invalid delivery participation');
    }
    for (const [kind, key] of Object.entries(thread.factKeys)) if (key) {
      const fact = state.facts[key];
      if (!fact || fact.kind !== `ink_delivery_${kind}` || fact.value.threadId !== thread.id
        || fact.createdAt < thread.openedAt) throw new Error('Delivery knowledge lacks its episode source');
    }
    if (thread.pendingDecision && (thread.stage !== 'decision_pending'
      || !thread.pendingDecision.actionId || !thread.pendingDecision.sourceEventId || !thread.factKeys.dispatch))
      throw new Error('Delivery decision lacks inspected evidence');
    if (thread.status !== 'active') {
      const result = thread.result, fact = state.facts[thread.factKeys.result];
      if (thread.stage !== 'settled' || !result || !DELIVERY_DEFINITION.outcomes.includes(result.outcome)
        || result.completedAt < thread.openedAt || result.completedAt > thread.deadlineAt || !result.sourceEventId
        || fact?.sourceEventId !== result.sourceEventId || fact.value.outcome !== result.outcome
        || !['goaden', 'ashai', 'enchanted_ink'].includes(result.resolver)
        || result.deliveryDisposition !== { reconciled: 'accepted', returned: 'returned', missed_window: 'outstanding' }[result.outcome]
        || fact.value.deliveryDisposition !== result.deliveryDisposition
        || result.nextVisitNote !== { reconciled: 'delivery_record_closed', returned: 'replacement_still_required',
          missed_window: 'next_delivery_window_required' }[result.outcome]
        || result.outcome !== 'missed_window' && (!thread.dispatchEventId
          || state.facts[thread.factKeys.dispatch]?.createdAt > result.completedAt)
        || thread.pendingDecision || threads.completedDefinitions[thread.definitionId] !== thread.id
        || (result.outcome === 'missed_window') !== (thread.status === 'failed'))
        throw new Error('Delivery ending lacks its durable outcome');
    } else if (thread.result || threads.completedDefinitions[thread.definitionId]) throw new Error('Active episode has a terminal result');
  }
}
