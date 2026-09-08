import { locateEveryone, CANON_ABILITIES } from './adapter.mjs';
import { assertNoSpoiler } from '../../src/spoilers.mjs';
import { NAMEABLE } from '../../src/cast.mjs';
import { SEALED_AREAS, areaOf } from '../../src/places.mjs';

// The gate a proposal has to get through, expressed as the checks Worldstream
// would run at commit time. In the lab this is a standalone function; in
// production it is the shape of a reducer case, and it runs against real state
// rather than against the translated view that produced the proposal.
//
// The reason this exists at all is the thing the brief calls "state
// duplication", and it is the failure mode most likely to sink an emergent
// system. The engine reasons over a translation. A translation can be stale, or
// wrong, or built from a snapshot taken a minute ago. So the engine's output is
// a *request*, and every fact it depends on is restated in `requiredFacts` so
// the world can check them again against itself. If the world disagrees, the
// world wins and the moment does not happen.
//
// Praxish has no equivalent. `Praxish.performAction` mutates the database
// directly from whatever bindings the query produced, which is correct for a
// simulator that owns its own world and fatal for one that does not.

export const EFFECT_POLICY = Object.freeze({
  // Effects the world will commit without an author signature.
  ordinary: new Set(['none', 'observation_recorded', 'attention_given', 'knowledge_offered',
    'fact_shared', 'time_spent', 'object_moved', 'reaction', 'memory_formed', 'callback_used', 'witness_memory']),
  // Effects that permanently cost a character something. These may only be
  // committed when the *action definition* was explicitly author-approved, and
  // the approval travels with the proposal so an audit can find it.
  authorApproved: new Set(['ability_used']),
  // Effects no Moment may ever request, whatever it scores.
  never: new Set(['death', 'permanent_injury', 'lore_created', 'arc_resolved',
    'relationship_rewrite', 'reveal', 'faction_status_change']),
});

const failure = (code, detail) => ({ ok: false, code, detail });

/**
 * @returns {{ok: true, effects: object[]} | {ok: false, code: string, detail?: any}}
 */
export function validateProposal(proposal, snapshot, { now, cast, callbacks = [] } = {}) {
  if (!proposal) return failure('no_proposal');
  if (proposal.at !== now) return failure('stale_proposal', { proposedAt: proposal.at, now });

  // 1. Physical presence, re-derived from the world rather than trusted.
  const everyone = locateEveryone(snapshot, now);
  for (const who of proposal.participants) {
    const person = everyone.get(who);
    if (!person) return failure('participant_absent', who);
    if (person.location !== proposal.location || person.area !== proposal.area)
      return failure('participant_elsewhere', { who, at: `${person.location}/${person.area}` });
  }
  if (SEALED_AREAS.includes(proposal.area)) return failure('sealed_area', proposal.area);
  if (!areaOf(proposal.location, proposal.area)) return failure('unknown_area', proposal.area);

  // 2. Every fact the proposal claims. This is the anti-drift check.
  for (const fact of proposal.requiredFacts) {
    const [claim, argument] = fact.split(':');
    if (claim === 'actor_possesses') {
      if (!(CANON_ABILITIES[proposal.actor] ?? []).includes(argument))
        return failure('ability_not_possessed', { actor: proposal.actor, ability: argument });
    } else if (claim === 'co_present') {
      const [a, b] = argument.split(',');
      const first = everyone.get(a), second = everyone.get(b);
      if (!first || !second || first.location !== second.location || first.area !== second.area)
        return failure('not_co_present', argument);
    } else if (claim === 'callback_earned') {
      const found = callbacks.find(item => item.key === argument && !item.spent);
      if (!found) return failure('callback_not_earned', argument);
    } else if (claim === 'author_approved_action') {
      if (!APPROVED_ACTIONS.has(argument)) return failure('action_not_approved', argument);
    }
    // actor_present_at / obstacle_present / affordance_present / helper_present /
    // shadow_present / observable / witnessed are environment claims already
    // covered by the presence check plus the adapter's refusal to assert an
    // affordance a place does not have.
  }

  // 3. Effects.
  for (const effect of proposal.requestedEffects) {
    if (EFFECT_POLICY.never.has(effect.kind)) return failure('forbidden_effect', effect.kind);
    if (EFFECT_POLICY.authorApproved.has(effect.kind)) {
      if (!effect.authorApproved) return failure('effect_needs_author_approval', effect.kind);
      if (!APPROVED_ACTIONS.has(proposal.action))
        return failure('costly_effect_from_unapproved_action', proposal.action);
    } else if (!EFFECT_POLICY.ordinary.has(effect.kind)) {
      return failure('unknown_effect_kind', effect.kind);
    }
  }

  // 4. Presentation. A line that names somebody the world may not name, or that
  // touches a reveal, is rejected here rather than discovered on the page.
  if (proposal.line) {
    try { assertNoSpoiler(proposal.line, `${proposal.actor}/${proposal.presentationKey}`); }
    catch (error) { return failure('spoiler', error.message); }
    // Only mid-sentence capitals can be names. A word after a full stop is
    // capitalised because English capitalises it, and a hand-kept allow-list of
    // sentence openers is a losing game — the first version of this check
    // rejected "Now it is not" on the grounds that Now is not in the cast.
    const midSentence = proposal.line.replace(/(^|[.!?…]\s*|["'‘“]\s*)[A-Z][a-z]*/g, ' ');
    for (const word of midSentence.match(/\b[A-Z][a-z]{2,}\b/g) ?? [])
      if (!NAMEABLE.includes(word)) return failure('unnameable_person', word);
  }

  return { ok: true, effects: proposal.requestedEffects.map(effect => ({ ...effect, by: proposal.actor })) };
}

// The author signature. An action lands here only after a human has read what
// it can do. `use_fade` is the reference case: its effect permanently costs the
// character ten years of life, which is exactly the class of consequence that
// must never arrive by scoring well.
export const APPROVED_ACTIONS = new Set(['use_fade']);


