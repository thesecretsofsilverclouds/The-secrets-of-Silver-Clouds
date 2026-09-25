import { CanonicalFork } from './canonical-fork.mjs';
import { eligibleOrdinaryIntentFamilies } from './intent.mjs';

const HOUR = 60 * 60 * 1000;
export const CSV_RULES = Object.freeze({ version: 1, cooldownMs: 6 * HOUR,
  checkpointHours: Object.freeze([1, 2, 4, 6]), maxActions: 128,
  maxCloneBytes: 2 * 1024 * 1024, maxPendingActions: 4096, maxMultiplier: 1.25,
  evidenceLimit: 8 });
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const norm = values => Math.hypot(...values) / Math.sqrt(values.length);

// Sensitivity describes difference, not goodness. Directional outcome accounting
// below is the sole authority for the live choice multiplier.
export function causalSensitivity(immediate, samples, hours = CSV_RULES.checkpointHours) {
  if (!Array.isArray(hours) || !hours.length || hours.length !== samples.length
    || hours.some((hour, i) => !Number.isFinite(hour) || hour <= (hours[i - 1] ?? 0))
    || !Array.isArray(immediate) || !immediate.length
    || [immediate, ...samples].some(row => row.length !== immediate.length || row.some(v => !Number.isFinite(v))))
    throw new Error('Invalid counterfactual checkpoints');
  const z = immediate.map(() => 0);
  let late = 0, lateWeight = 0, persistence = 0, totalWeight = 0;
  const horizon = hours.at(-1);
  for (let i = 0; i < hours.length; i++) {
    const weight = (hours[i] - (hours[i - 1] ?? 0)) * Math.exp(-(hours[i] - hours[0]) / horizon);
    const size = norm(samples[i]);
    late += weight * hours[i] / horizon * size; lateWeight += weight * hours[i] / horizon;
    totalWeight += weight; if (size > .01) persistence += weight;
    samples[i].forEach((value, j) => { z[j] += weight * Math.abs(value); });
  }
  const sum = z.reduce((a, b) => a + b, 0);
  if (sum === 0 || persistence === 0) return 0;
  const breadth = Math.exp(-z.reduce((entropy, value) => value === 0 ? entropy
    : entropy + value / sum * Math.log(value / sum), 0)) / z.length;
  return persistence / totalWeight * breadth * Math.log1p((late / lateWeight) / (.05 + norm(immediate)));
}

// Only result facts produced along the intervention's real causal chain count.
// Relationship integers, scene bookings, observation knowledge, prose and the
// number of events deliberately do not appear in either features or utility.
export function counterfactualOutcomes({ state, events, rootEventId, now, initialArrangements = {} }) {
  const causal = new Set([rootEventId]);
  const eventById = new Map();
  for (const event of events) {
    eventById.set(event.id, event);
    if (event.causedBy?.some(id => causal.has(id))) causal.add(event.id);
  }
  const totals = [0, 0, 0, 0], evidence = [];
  let utility = 0, disruptions = 0;
  for (const fact of Object.values(state.facts ?? {})) {
    const source = eventById.get(fact.sourceEventId);
    if (!source || !causal.has(source.id) || fact.createdAt !== source.occurredAt || fact.createdAt > now) continue;
    const value = fact.value ?? {};
    let score = 0, group = -1;
    if (fact.kind === 'intent_result') {
      const item = state.intent?.instances?.[value.intentId];
      const arrangement = state.arrangements?.[item?.arrangementKey];
      if (!item || item.resultFactKey !== fact.key || item.resultEventId !== source.id
        || item.status !== value.outcome || !arrangement) continue;
      // A declined counteroffer is legitimate autonomy, not a moral penalty.
      // An actually completed promise has positive value; breaking an accepted
      // promise costs the same bounded duration. Merely reserving it is zero.
      const duration = clamp((item.endAt - item.startAt) / HOUR, 0, 1);
      if (value.outcome === 'completed' && item.startEventId && item.acceptanceEventId
        && arrangement.status === 'completed' && arrangement.completionEventId === source.id
        && item.party.every(who => state.characters[who]?.knowledge.some(memory => memory.factKey === fact.key
          && memory.sourceEventId === source.id && memory.learnedAt <= now))) score = duration;
      else if (value.outcome === 'interrupted' && item.acceptanceEventId
        && arrangement.status === 'broken') { score = -duration; disruptions++; }
      group = 1;
    } else if (fact.kind === 'supporting_result') {
      const item = state.supportingStories?.instances?.[value.storyId];
      if (!item || item.result?.factKey !== fact.key || item.result.sourceEventId !== source.id
        || item.status !== value.outcome) continue;
      if (value.outcome === 'kept' && item.encounterEventId) score = .15;
      else if (['missed', 'cut_short'].includes(value.outcome)) { score = -.15; disruptions++; }
      group = 0;
    } else if (fact.kind === 'ink_delivery_result') {
      const item = Object.values(state.threads?.instances ?? {}).find(entry => entry.factKeys?.result === fact.key
        && entry.result?.sourceEventId === source.id);
      if (!item) continue;
      // Returning a mismatched delivery can be the correct existing outcome;
      // do not classify its difference from reconciliation as harm or gain.
      if (value.outcome === 'reconciled') score = .25;
      else if (value.outcome === 'missed_window') { score = -.25; disruptions++; }
      group = 2;
    }
    if (group < 0 || !score) continue;
    totals[group] += score; utility += score;
    evidence.push({ factKey: fact.key, sourceEventId: source.id, kind: fact.kind, outcome: value.outcome, value: score });
  }
  // Protect accepted commitments that predate this free choice even when a
  // failed appointment does not itself reference the intervention event.
  let existingBroken = 0;
  for (const [key, prior] of Object.entries(initialArrangements)) {
    const after = state.arrangements?.[key];
    if (['accepted', 'started'].includes(prior.status) && after?.status === 'broken') existingBroken++;
  }
  totals[3] = eligibleOrdinaryIntentFamilies(state, now).length / 2;
  return { vector: totals.map(value => clamp(value, -1, 1)), utility: utility - existingBroken,
    disruptions: disruptions + existingBroken, evidence };
}

export function directionalChoiceWeights(loyalty, ambition) {
  const gain = loyalty.utility - ambition.utility;
  if (!Number.isFinite(gain) || Math.abs(gain) < 1e-12)
    return { preferredMotive: null, gain: 0, logWeights: { loyalty: 0, ambition: 0 } };
  const preferredMotive = gain > 0 ? 'loyalty' : 'ambition';
  const winner = gain > 0 ? loyalty : ambition, other = gain > 0 ? ambition : loyalty;
  // A useful completion may never buy permission to break more promises.
  if (winner.disruptions > other.disruptions || !winner.evidence.some(proof => proof.value > 0))
    return { preferredMotive: null, gain: 0, logWeights: { loyalty: 0, ambition: 0 } };
  return { preferredMotive, gain: Math.abs(gain), logWeights: {
    loyalty: preferredMotive === 'loyalty' ? Math.log(CSV_RULES.maxMultiplier) * Math.min(1, Math.abs(gain) / .2) : 0,
    ambition: preferredMotive === 'ambition' ? Math.log(CSV_RULES.maxMultiplier) * Math.min(1, Math.abs(gain) / .2) : 0,
  } };
}

export function evaluateIntentAlternatives({ state, pendingActions, action, seed, rulesVersion,
  startMs, resolvedThrough, sequence = 0, reduceAction, key, baselineMotive, endMs,
  maxActions = CSV_RULES.maxActions, maxCloneBytes = CSV_RULES.maxCloneBytes }) {
  const answer = { version: CSV_RULES.version, status: 'unavailable', reason: 'incomplete_context',
    opportunityId: key, evaluatedAt: action?.dueAt, baselineMotive,
    preferredMotive: null, gain: 0, logWeights: { loyalty: 0, ambition: 0 }, sensitivity: 0,
    processedActions: { loyalty: 0, ambition: 0 }, cloneBytes: 0, evidence: [] };
  if (action?.type !== 'INTENT_RESPONSE' || action.intentId !== key
    || !['loyalty', 'ambition'].includes(baselineMotive)) return answer;
  const branches = {};
  try {
    for (const motive of ['loyalty', 'ambition']) {
      const remainingActions = Math.min(CSV_RULES.maxActions, maxActions)
        - answer.processedActions.loyalty - answer.processedActions.ambition;
      if (remainingActions < 1) throw new Error('Counterfactual pair action budget exceeded');
      const fork = new CanonicalFork({ state, pendingActions, seed, rulesVersion, startMs,
        resolvedThrough, sequence, reduceAction, endMs,
        maxActions: remainingActions,
        maxCloneBytes: Math.min(CSV_RULES.maxCloneBytes, maxCloneBytes),
        maxPendingActions: CSV_RULES.maxPendingActions,
        context: { disableCounterfactual: true, disableNarrativeSignals: true, intentOverride: { key, motive } } });
      answer.cloneBytes = Math.max(answer.cloneBytes, fork.cloneBytes);
      if (fork.pendingActions[0]?.id !== action.id) throw new Error('Counterfactual action is not next');
      const immediateEvent = fork.step();
      answer.processedActions[motive] = fork.processedActions;
      // Ownership and mandatory-motive checks remain in the real resolver.
      const decision = fork.state.intent?.instances?.[key]?.privateDecision;
      if (decision?.reason !== 'ordinary_preference' || decision.motive !== motive)
        throw new Error('Counterfactual choice is not ordinary preference');
      const sample = () => counterfactualOutcomes({ state: fork.state, events: fork.events,
        rootEventId: immediateEvent.id, now: fork.resolvedThrough,
        initialArrangements: state.arrangements });
      // Immediate means after this exact action, before another same-time action.
      const immediate = counterfactualOutcomes({ state: fork.state, events: fork.events,
        rootEventId: immediateEvent.id, now: action.dueAt, initialArrangements: state.arrangements });
      const samples = [];
      for (const hours of CSV_RULES.checkpointHours) {
        try { fork.advance(action.dueAt + hours * HOUR); }
        finally { answer.processedActions[motive] = fork.processedActions; }
        samples.push(sample());
      }
      branches[motive] = { immediate, samples, final: samples.at(-1) };
    }
    const difference = (a, b) => a.vector.map((value, i) => value - b.vector[i]);
    answer.sensitivity = causalSensitivity(difference(branches.loyalty.immediate, branches.ambition.immediate),
      branches.loyalty.samples.map((sample, i) => difference(sample, branches.ambition.samples[i])));
    Object.assign(answer, directionalChoiceWeights(branches.loyalty.final, branches.ambition.final));
    answer.status = 'evaluated'; answer.reason = answer.preferredMotive ? 'completed_obligation_gain' : 'no_reviewed_gain';
    answer.evidence = ['loyalty', 'ambition'].flatMap(motive => branches[motive].final.evidence
      .slice(0, CSV_RULES.evidenceLimit / 2).map(proof => ({ motive, ...proof })));
    return answer;
  } catch (error) {
    // Budget exhaustion, an invalid fork or a reducer failure cannot prefer a
    // partially simulated candidate. No timing-based fallback affects canon.
    answer.reason = /budget/.test(error.message) ? 'bounded_budget' : 'invalid_fork';
    return answer;
  }
}
