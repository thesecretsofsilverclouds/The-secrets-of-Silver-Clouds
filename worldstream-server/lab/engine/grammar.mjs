import { assertConditions } from './query.mjs';

// An authored surface. A bank entry may be a bare string, or an object that
// declares what the wording needs to be true of its target.
//
//   requires   conditions the bound target must satisfy for this wording to
//              make sense. "One came back" needs members that can leave and
//              return; "You are number nine" needs a listener who could be one
//              of them. Eight of the author's eighteen rejections in the first
//              review were this and nothing else.
//   signature  distinctive wording. Gets a long resurfacing cooldown, because
//              "Forty-one so far. Forty-one." cannot repeat at the frequency
//              that "Right." can.
//   filler     fine to say, not worth printing. The action still happens and
//              stays canonical; the reader is simply not stopped to be told.
//   meaning    what the line refers to internally, when the page must not say.
export const quip = (text, options = {}) => ({ text, requires: [], signature: false,
  filler: false, meaning: null, ...options });

const normaliseQuip = entry => (typeof entry === 'string' ? quip(entry) : quip(entry.text, entry));

// Reusable character truth. What a character is, expressed as things they want,
// things they will not do, and what their behaviour sounds like when it lands.
//
// Deliberately not "Emily has creepy = 0.9". A single scalar produces the
// failure mode the brief names as "generic character soup": everyone chooses
// the same action and the prose is repainted. What separates characters here is
// which *drives* they have at all, and which actions their drives are even
// capable of noticing — Emily has a drive that reads a crowd's size; Goaden
// does not have that drive, so a crowd is not an affordance for him.
//
//   forbids   Hard. Removes the action from the candidate set entirely, and
//             says why. Never a large negative number — see the finding in
//             lab/research/probe-02: Praxish's Swaygent sorts `forbidden`
//             actions last but still returns one when nothing else survives,
//             which is a canon rail that does not hold.
//   drives    Soft. Scored after the action has been speculatively applied, so
//             a character is choosing by the state the action *leads to*.
//             This is Swaygent's influence/volition split, which is the right
//             idea and is kept.
//   reactions Grammar for responding to what somebody else just did.
//   quips     Authored surfaces, keyed by an action's `surface`. Runtime
//             recombines; it never writes.
//   mystery   Surfaces whose motive the presentation layer must not explain.

export function defineGrammar(def) {
  if (!def.id) throw new Error('grammar: missing id');
  for (const rule of def.forbids ?? []) {
    if (!rule.why) throw new Error(`${def.id}: every forbids rule needs a why, it is the debug output`);
    assertConditions(rule.conditions, `${def.id}/forbids/${rule.name ?? '?'}`);
  }
  for (const rule of [...(def.drives ?? []), ...(def.influences ?? [])]) {
    assertConditions(rule.conditions, `${def.id}/${rule.name ?? '?'}`);
    if (typeof rule.score !== 'number') throw new Error(`${def.id}/${rule.name}: drives need a numeric score`);
  }
  for (const rule of def.reactions ?? []) assertConditions(rule.conditions, `${def.id}/reaction/${rule.name ?? '?'}`);
  const quips = {};
  for (const [surface, bank] of Object.entries(def.quips ?? {})) {
    quips[surface] = bank.map(entry => {
      const normalised = normaliseQuip(entry);
      assertConditions(normalised.requires, `${def.id}/quip/${surface}`);
      return Object.freeze(normalised);
    });
  }
  return Object.freeze({
    drives: [], influences: [], forbids: [], reactions: [], mystery: [], manners: {},
    ...def, quips,
  });
}

export function defineCast(defs) {
  const byId = new Map();
  for (const def of defs) byId.set(def.id, defineGrammar(def));
  return byId;
}

/** Count of authored units, for the authoring-leverage measurement. */
export function grammarSize(grammar) {
  return {
    drives: grammar.drives.length,
    influences: grammar.influences.length,
    forbids: grammar.forbids.length,
    reactions: grammar.reactions.length,
    quipFamilies: Object.keys(grammar.quips).length,
    quipLines: Object.values(grammar.quips).reduce((n, lines) => n + lines.length, 0),
    signatureLines: Object.values(grammar.quips)
      .reduce((n, lines) => n + lines.filter(entry => entry.signature).length, 0),
    fillerLines: Object.values(grammar.quips)
      .reduce((n, lines) => n + lines.filter(entry => entry.filler).length, 0),
  };
}
