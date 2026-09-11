import { properNouns } from './presentation.mjs';
import { findSpoilers } from './spoilers.mjs';

// A deliberately small equivalence vocabulary. Automatic admission is limited
// to this lane, not a claim that a blacklist understands arbitrary fiction.
// Assertions retain their words and order after these explicit replacements;
// the source's agents, objects, negation, time, causality and dialogue survive.
const EQUIVALENCES = Object.freeze([
  ['beside', 'next to'], ['beneath', 'underneath'], ['near', 'close to'],
  ['around', 'round'], ['toward', 'towards'], ['among', 'amongst'], ['while', 'whilst'],
  ['as though', 'as if'], ['once more', 'again'], ['at once', 'immediately'],
  ['for a moment', 'briefly'], ['a little', 'slightly'], ['farther', 'further'],
  ['was sitting', 'was seated', 'sat'], ['were sitting', 'were seated'],
  ['was standing', 'stood'], ['were standing'], ['sat down', 'took a seat'],
  ['recoiled', 'drew back'], ['rim', 'brim'], ['without drinking', 'without taking a drink'],
  ['remained still', 'kept still'], ['began', 'started'], ['finished', 'completed'],
  ['answered', 'replied'], ['lifted', 'raised'], ['looked up', 'looked upwards'],
  ['looked down', 'looked downwards'], ['did not', "didn't"], ['was not', "wasn't"],
  ['were not', "weren't"], ['had not', "hadn't"], ['could not', "couldn't"],
  ['would not', "wouldn't"], ['should not', "shouldn't"], ['it was', "it'd been"],
].filter(group => group.length > 1).map(group => Object.freeze(group)));
// Avoid a tense-changing contraction: the permitted dictionary has no general
// stemming, subject substitution or rewriting of auxiliaries.
const groups = EQUIVALENCES.filter(group => group[0] !== 'it was');
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const replacements = groups.flatMap((group, index) => group.map(phrase => ({
  pattern: new RegExp(`\\b${escaped(phrase)}\\b`, 'g'), phrase, token: `equivalence_${index}`,
}))).sort((a, b) => b.phrase.length - a.phrase.length);
const normalized = text => String(text).normalize('NFKC').replace(/[‘’]/g, "'").toLowerCase()
  .replace(/[^\p{L}\p{N}\s']/gu, ' ').replace(/\s+/g, ' ').trim();
function assertion(text) {
  let value = String(text).normalize('NFKC').replace(/[‘’]/g, "'").toLowerCase();
  for (const replacement of replacements) value = value.replace(replacement.pattern, replacement.token);
  return value.replace(/[^\p{L}\p{N}\s_']/gu, ' ').replace(/\s+/g, ' ').trim();
}
const statements = text => String(text).match(/[^.!?]+(?:[.!?]+|$)/g)?.map(assertion).filter(Boolean) ?? [];
const quotes = text => [...String(text).matchAll(/[“"]([^”"]+)[”"]/g)].map(match => normalized(match[1]));
const stable = value => JSON.stringify(value, (key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item);
const risky = /\b(?:knows?|knew|known|realised?|realized?|remembered|learned|learnt|discovered|revealed|betray\w*|confess\w*|bounty|mission|orders?|killed|murder\w*|wound\w*|injur\w*|bleed\w*|blood|summon\w*|teleport\w*|healed|mind.?read\w*|prophe\w*|secret\w*)\b/gi;
function overlap(a, b) {
  const left = new Set(normalized(a).split(' ')), right = new Set(normalized(b).split(' '));
  const common = [...left].filter(word => right.has(word)).length;
  return common / Math.max(1, left.size + right.size - common);
}

export const SCENE_REFILL_APPROVAL_POLICY = 'Automatic surface admission preserves every source sentence, '
  + 'in its original order, with all named actors, objects, negation, causes, timing and quoted dialogue. '
  + 'Keep dialogue verbatim. Use only these small phrase-equivalence alternatives in narration: '
  + groups.map(group => group.join(' / ')).join('; ') + '. '
  + 'Do not merely change punctuation, word order or one word. Prefer several natural supported changes. '
  + 'Freer rewrites remain quarantined for review; do not invent facts to make an alternative distinct.';

/**
 * Conservative automatic approval of a surface of an already approved source.
 * This checks equivalence under an explicit finite policy, not general natural
 * language entailment. It does not create eligibility, a scene or an event.
 */
export function validateSceneReservoirCandidate(candidate, { archetype, existing = [] } = {}) {
  const fail = reason => ({ ok: false, approved: false, reason });
  if (!candidate || !archetype || candidate.archetypeId !== archetype.id
    || !Array.isArray(candidate.paragraphs) || !candidate.paragraphs.length || candidate.paragraphs.length > 4
    || candidate.paragraphs.some(item => typeof item !== 'string' || !item.trim())
    || !Array.isArray(archetype.allowedFacts) || !archetype.allowedFacts.length
    || archetype.allowedFacts.some(item => typeof item !== 'string' || !item.trim())) return fail('malformed');
  if (archetype.metadata?.effectPolicy !== 'surface_only' || !archetype.provenance?.sourceHash
    || !archetype.metadata?.gates?.triggerTypes?.length || !archetype.metadata?.cast?.length
    || stable(candidate.metadata) !== stable(archetype.metadata)) return fail('unapproved_or_changed_archetype');
  const text = candidate.paragraphs.join('\n\n'), source = archetype.allowedFacts.join('\n\n');
  if (text.length < 80 || text.length > 2200 || text.split(/\s+/).length > 240) return fail('length');
  if (/https?:\/\/|<[^>]+>|^\s*(?:#|[-*] )|\*\*|\b(?:as an ai|simulation tick|language model)\b/im.test(text)) return fail('nonprose');
  if (findSpoilers(text).length) return fail('embargoed');
  const sourceNouns = new Set(properNouns(source));
  if (properNouns(text).some(noun => !sourceNouns.has(noun))) return fail('unsupported_proper_noun');
  const sourceRisk = new Set([...source.matchAll(risky)].map(match => match[0].toLowerCase()));
  if ([...text.matchAll(risky)].some(match => !sourceRisk.has(match[0].toLowerCase()))) return fail('unsupported_knowledge_or_consequence');
  if (stable(quotes(text)) !== stable(quotes(source))) return fail('authored_dialogue_changed');
  // This also catches unsupported sentence-initial names that generic proper
  // noun heuristics cannot distinguish from ordinary sentence capitalisation.
  if (stable(statements(text)) !== stable(statements(source))) return fail('assertion_changed_or_ambiguous');
  const originals = [source, ...existing.map(item => typeof item === 'string' ? item : item?.paragraphs?.join(' ') ?? '')];
  if (originals.some(prior => overlap(text, prior) >= 0.82)) return fail('duplicate_or_trivial_rewrite');
  return { ok: true, approved: true, reason: null, policy: 'source_assertion_equivalence_v1' };
}
