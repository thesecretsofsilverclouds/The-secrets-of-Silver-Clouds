import { MINUTE_MS as MIN } from './time.mjs';

// A view of experienced meetings, not an omniscient personality meter. The
// aggregate rapport remains useful accounting; decisions use its actual known
// result facts so an absent guest cannot react to a result they never learned.
export const RELATIONSHIP_CHOICE_RULES = Object.freeze({ history: 14 * 24 * 60 * MIN,
  cautionWindow: 7 * 24 * 60 * MIN, evidenceLimit: 3 });
const LEADS = new Set(['goaden', 'ashai']);
const outcomes = new Set(['kept', 'missed', 'cut_short']);
const unit = id => ['anarchy', 'balthazar'].includes(id) ? 'anarchy+balthazar' : id;
const nonverbal = new Set(['kai', 'greah', 'kartel']);

export function knownSupportingHistory(state, who, lead, guest, now) {
  if (!LEADS.has(lead) || !Number.isSafeInteger(now)) return [];
  const person = state.characters?.[who] ?? state.supportingStories?.people?.[who];
  const seen = new Set();
  return (person?.knowledge ?? []).flatMap(memory => {
    const fact = state.facts?.[memory.factKey];
    if (!fact || fact.key !== memory.factKey || !fact.sourceEventId || fact.kind !== 'supporting_result' || fact.subject !== lead
      || unit(fact.value?.guest) !== unit(guest) || !outcomes.has(fact.value?.outcome)
      || !Number.isSafeInteger(fact.createdAt) || fact.createdAt > now
      || now - fact.createdAt > RELATIONSHIP_CHOICE_RULES.history
      || memory.sourceEventId !== fact.sourceEventId || !memory.acquisitionEventId
      || !Number.isSafeInteger(memory.learnedAt) || memory.learnedAt < fact.createdAt || memory.learnedAt > now
      || (memory.validUntil != null && memory.validUntil <= now)
      || (fact.validUntil != null && fact.validUntil <= now) || seen.has(fact.sourceEventId)) return [];
    seen.add(fact.sourceEventId);
    return [{ who, factKey: fact.key, sourceEventId: fact.sourceEventId,
      acquisitionEventId: memory.acquisitionEventId, createdAt: fact.createdAt, learnedAt: memory.learnedAt,
      outcome: fact.value.outcome, interrupted: fact.value.interruption?.eventId ? true
        : fact.value.interruption === null ? false : null }];
  }).sort((a, b) => b.createdAt - a.createdAt || a.sourceEventId.localeCompare(b.sourceEventId));
}

export function supportingRelationshipChoice(state, lead, guest, now) {
  const leadHistory = knownSupportingHistory(state, lead, lead, guest, now);
  const guestHistory = knownSupportingHistory(state, guest, lead, guest, now);
  const ordinary = { version: 1, lead, guest, response: 'accepted', reason: 'ordinary_company', score: 0, evidence: [] };
  // A failed appointment need not mean anyone was at fault. Only two known,
  // uncompleted meetings with no recorded interruption prompt scheduling
  // caution. A later kept meeting ends the sequence. This is a brief deferral,
  // never anger, loss of friendship, or a claim of deliberate neglect.
  const caution = [];
  for (const memory of guestHistory) {
    if (memory.createdAt < now - RELATIONSHIP_CHOICE_RULES.cautionWindow || memory.outcome === 'kept') break;
    // Legacy facts did not preserve interruption causes. Missing metadata is
    // uncertainty, not evidence that an old blameless absence was unexplained.
    if (memory.outcome === 'missed' && memory.interrupted === false) caution.push(memory);
  }
  if (!nonverbal.has(guest) && caution.length >= 2) return { ...ordinary, response: 'deferred',
    reason: 'uncertain_time', score: -1, evidence: caution.slice(0, 2) };
  const last = leadHistory[0];
  if (last && last.outcome !== 'kept') return { ...ordinary, reason: 'try_again', score: 2, evidence: [last] };
  if (last?.outcome === 'kept') return { ...ordinary, reason: 'familiar_company', score: 1, evidence: [last] };
  return ordinary;
}

export function recordRelationshipChoice(ctx, choice) {
  for (const proof of choice.evidence) {
    // useMemory is restricted to the main characters; guest knowledge has
    // already passed the same source/acquisition/time checks in the pure view.
    if (LEADS.has(proof.who)) ctx.ops.useMemory(proof.who, proof.factKey);
    ctx.event.causedBy.push(proof.sourceEventId, proof.acquisitionEventId);
  }
  const { score, ...record } = choice;
  return record;
}

// The commitment stores this tiny decision at the moment it is made. The
// reader never consults today's relationship state to rewrite an older scene.
export function relationshipChoicePresentation(event, { lead, guest, leadName, guestName } = {}) {
  const choice = event?.payload?.relationshipChoice;
  if (event?.type !== 'SUPPORTING_COMMITMENT' || event.visibility !== 'public' || !Number.isSafeInteger(event.occurredAt)
    || choice?.version !== 1 || choice.lead !== lead || choice.guest !== guest
    || !LEADS.has(lead) || !leadName || !guestName || !event.participants?.includes(lead)
    || !event.payload.cast?.includes(guest) || !Array.isArray(choice.evidence)
    || !choice.evidence.length || choice.evidence.length > RELATIONSHIP_CHOICE_RULES.evidenceLimit
    || !choice.evidence.every(proof => (proof.who === lead || proof.who === guest)
      && outcomes.has(proof.outcome) && typeof proof.sourceEventId === 'string' && proof.sourceEventId.length > 0
      && typeof proof.acquisitionEventId === 'string' && proof.acquisitionEventId.length > 0
      && proof.sourceEventId !== event.id && proof.acquisitionEventId !== event.id
      && event.causedBy?.includes(proof.sourceEventId) && event.causedBy.includes(proof.acquisitionEventId)
      && Number.isSafeInteger(proof.createdAt) && Number.isSafeInteger(proof.learnedAt)
      && proof.createdAt <= proof.learnedAt && proof.learnedAt <= event.occurredAt)) return null;
  if (choice.reason === 'uncertain_time' && choice.response === 'deferred' && event.payload.outcome === 'deferred'
    && !nonverbal.has(guest) && choice.evidence.length === 2
    && new Set(choice.evidence.map(proof => proof.sourceEventId)).size === 2
    && choice.evidence.every(proof => proof.who === guest && proof.outcome === 'missed' && proof.interrupted === false)) {
    return { description: `${guestName} left another meeting with ${leadName} for now.`,
      prose: `${leadName} stopped nearby. ${guestName} remembered the two meetings that had never begun.`,
      lines: [{ who: guest, text: {
        yukon: 'We keep not doing this. Leave it for now.',
        henderson: 'There is no point setting another time we may not keep. We will leave it there.',
        davis: 'Leave it for now. We keep setting time aside and not getting it.',
        rose: "Don't promise me another few minutes. Leave it for now.",
        anarchy: 'Not another arrangement. Leave it for now.',
        balthazar: 'We have tried arranging this. Leave it for now.',
        gabriel: 'No. We have arranged this before. Let us leave it for now.',
        damien: "Forget setting a time. Hasn't worked, has it?",
        truth: 'Leave it! We keep setting time aside and not getting it!',
        emily: "We don't have to arrange it again. We can leave it.",
        zara: "Not another time to keep. Let's leave it for now.",
      }[guest] ?? 'Leave it for now. We keep setting time aside and not getting it.' },
        { who: lead, text: lead === 'goaden' ? 'All right. No promise this time.' : 'All right. We can leave it there.' }] };
  }
  if (choice.response !== 'accepted' || event.payload.outcome != null
    || choice.evidence.length !== 1 || choice.evidence[0].who !== lead) return null;
  const prior = choice.evidence[0];
  if (choice.reason === 'try_again' && prior.outcome !== 'kept') return { prose: prior.outcome === 'cut_short'
    ? `${leadName} remembered how the last few minutes with ${guestName} had been cut short. There was time to stop now.`
    : `The last meeting between ${leadName} and ${guestName} had never begun. ${leadName} remembered it now, with time to stop.` };
  if (choice.reason === 'familiar_company' && prior.outcome === 'kept') return {
    prose: `${leadName} remembered the last time with ${guestName}, and staying through to the end. That made the answer easy.` };
  return null;
}
