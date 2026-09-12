// The spoiler registry.
//
// This file became load-bearing when the severity rail came down. Until v14 two
// separate things protected Book One: nothing consequential was allowed to
// happen, and nothing past the p.183 checkpoint was allowed to be named. The
// author has now retired the first — the world may fight, may be pursued, may
// lock down, may have consequences — on the explicit understanding that the
// second holds absolutely. So the second is no longer a string list kept in
// three files that had drifted apart. It is this.
//
// The governing idea, in the author's words: the world is *before the major
// reveals*, with some characters and locations deliberately unlocked for
// entertainment. Isolated plausible stories, exciting and mad and dark and
// British. What may never happen is a reveal.
//
// Three reveals, named. Each one has a subtlety that a blocklist alone cannot
// handle: **all three figures legitimately exist before the checkpoint.** The
// Head Captain walks on at [M41], Whisper is lounging in the gaming area at
// [M65], and Ashai's father is spoken about at [M120]. None of those is a
// spoiler. What is forbidden is the *link* — and "the Head Captain took off his
// mask and Goaden knew the face" contains no banned word at all.
//
// So the registry has two tiers. Terms that may never appear, and pairs that
// may never appear together.

export const REVEALS = Object.freeze({
  goaden_brother: {
    id: 'goaden_brother',
    // Named at [M141], confronted at [M426]: "I won't fight you, brother."
    // J'kobi is also the Head Captain of the Holy Order, which is why Order
    // material has to be written with particular care — the faction is fine,
    // its commander's identity is not.
    summary: "Goaden's older brother, whom he believes dead, is J'kobi — and J'kobi is the Head Captain of the Holy Order.",
    firstRevealed: 141,
  },
  ashai_parentage: {
    id: 'ashai_parentage',
    // Her father is talked about well before the checkpoint [M120], and the
    // letters at [M195] and [M205] are where it turns. The doll revelation,
    // the village information room, and parents' Onari ties are strictly phase-locked.
    summary: "Who Ashai's father is, her mother, the Onari doll, and parental ties to Onari.",
    firstRevealed: 195,
  },
  whisper_identity: {
    id: 'whisper_identity',
    // The bandaged, beanie-wearing soldier of [M65-66] is available as ordinary
    // background. What is behind the bandage is not.
    summary: "Whisper's alter ego.",
    firstRevealed: null,
  },
});

// Tier one: terms that may never appear in anything the world emits, in any
// casing. These are names and objects that exist only on the far side of the
// line, so there is no innocent use of them.
export const FORBIDDEN_TERMS = Object.freeze([
  { term: "j'kobi", reveal: 'goaden_brother' },
  { term: 'jkobi', reveal: 'goaden_brother' },
  { term: 'jacobi', reveal: 'goaden_brother' },
  { term: 'grimoire', reveal: null },
  { term: 'prophecy', reveal: null },
  { term: 'chosen one', reveal: null },
  // The chained door at [M63] and the voice behind it.
  { term: 'basement', reveal: null },
  // The archival room in Onari Village where parents/doll records are discovered.
  { term: 'information room', reveal: 'ashai_parentage' },
  { term: 'ashai-doll', reveal: 'ashai_parentage' },
  { term: 'ashai doll', reveal: 'ashai_parentage' },
  { term: 'doll revelation', reveal: 'ashai_parentage' },
]);

// Tier two: pairs. A link fires when a subject term and a reveal term both
// appear in the same passage. This is the part that actually protects the
// three, because each reveal can be written without using a single banned word.
//
// `subject` and `tell` are matched as whole words or phrases, case-insensitively.
export const FORBIDDEN_LINKS = Object.freeze([
  {
    reveal: 'goaden_brother',
    subject: ['goaden', 'reever', 'head captain'],
    tell: ['his brother', 'your brother', 'older brother', 'the brother he', 'brother he had',
      'presumed dead', 'long lost brother', 'long-lost brother', 'thought dead', 'believed dead',
      'same blood', 'his own blood relative'],
    // "Perks of chaotic brotherhood" is Goaden's own line at [M230] and must
    // stay legal, so the tells are kinship claims rather than the bare word.
    note: 'Goaden and a brother, in any combination.',
  },
  {
    reveal: 'goaden_brother',
    subject: ['head captain'],
    tell: ['unmasked', 'took off his mask', 'removed his mask', 'knew the face', 'recognised the face',
      'recognized the face', 'his true face', 'behind the mask'],
    note: 'The Head Captain being identified at all.',
  },
  {
    reveal: 'ashai_parentage',
    subject: ['ashai'],
    tell: ['her father', 'her real father', 'her true father', 'other father', 'her dad',
      'who her father', 'her parentage', 'her bloodline', 'her birth father'],
    note: "Ashai and the question of her father.",
  },
  {
    reveal: 'ashai_parentage',
    subject: ['ashai'],
    tell: ['onari parents', 'onari parent', 'onari mother', 'mother from onari',
      'ties to onari', 'onari ties', 'onari heritage', 'onari blood', 'born in onari',
      'onari doll', 'the doll'],
    note: "Ashai's doll and her parents' ties to the Onari.",
  },
  {
    reveal: 'ashai_parentage',
    subject: ['onari village', 'the village', 'onari'],
    tell: ['information room', 'her mother', 'ashai doll', 'ashai-doll',
      'doll revelation', 'parental history', 'parents history', 'mother history'],
    note: "Onari village tied to Ashai's doll, information room, or maternal parentage.",
  },
  {
    reveal: 'whisper_identity',
    subject: ['whisper'],
    tell: ['alter ego', 'true name', 'real name', 'really is', 'behind the bandage',
      'under the bandage', 'unmasked', 'his true face', 'other identity'],
    note: 'Whisper being anything other than the soldier on the sofa.',
  },
]);

// Generic post-checkpoint vocabulary. Not tied to a named reveal, but nothing
// in this world should be reaching for any of it.
export const FORBIDDEN_TONE = Object.freeze(['parentage', 'birth mother', 'birth father', 'bloodline', 'doll revelation']);

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Whole-word-ish: a phrase must not be matched inside a longer word, but may sit
// against punctuation. "brothers" must not satisfy "brother he".
const contains = (haystack, needle) =>
  new RegExp(`(^|[^a-z0-9'’-])${escape(needle)}([^a-z0-9'’-]|$)`, 'i').test(haystack);

/**
 * Everything in `text` that would spoil something. Returns an array so a caller
 * can report all of it at once rather than one thing at a time.
 */
export function findSpoilers(text) {
  if (typeof text !== 'string' || !text) return [];
  const lower = ` ${text.toLowerCase()} `;
  const found = [];
  for (const { term, reveal } of FORBIDDEN_TERMS) {
    if (contains(lower, term)) found.push({ kind: 'term', match: term, reveal });
  }
  for (const term of FORBIDDEN_TONE) {
    if (contains(lower, term)) found.push({ kind: 'tone', match: term, reveal: null });
  }
  for (const link of FORBIDDEN_LINKS) {
    const subject = link.subject.find(value => contains(lower, value));
    if (!subject) continue;
    const tell = link.tell.find(value => contains(lower, value));
    if (!tell) continue;
    found.push({ kind: 'link', match: `${subject} + ${tell}`, reveal: link.reveal });
  }
  return found;
}

export const isClean = text => findSpoilers(text).length === 0;

/** Throws with everything that is wrong, for use in tests and content gates. */
export function assertNoSpoiler(text, where = 'text') {
  const found = findSpoilers(text);
  if (!found.length) return;
  const detail = found.map(item => `${item.kind}: ${item.match}${item.reveal ? ` (${item.reveal})` : ''}`).join('; ');
  throw new Error(`Spoiler in ${where} — ${detail}`);
}

// What the world is now allowed to be. Recorded here rather than in a comment
// somewhere because it is the decision that lets everything else off the leash,
// and anything that widens it should have to edit this line.
export const SEVERITY = Object.freeze({
  combat: true,
  pursuit: true,
  lockdown: true,
  consequences: true,
  // The line that did not move.
  reveals: false,
});
