// Compact performance notes distilled from the same manuscript-backed packets
// used by dialogue.mjs, cast.mjs, legion.mjs and venues.mjs.  These notes are
// presentation constraints.  They do not add character state.

export const CHARACTER_NAMES = Object.freeze({
  goaden: 'Goaden', ashai: 'Ashai', rose: 'Rose', anarchy: 'Anarchy',
  balthazar: 'Balthazar', gabriel: 'Gabriel', truth: 'Truth',
  emily: 'Emily', zara: 'Zara',
});

export const VOICE_PACKS = Object.freeze({
  // Manuscript-backed voice packet cited in dialogue.mjs: short, dry,
  // deflective, protective without speeches, and never emotionally fluent on
  // demand.
  goaden: Object.freeze({
    rhythm: 'Short, punchy lines; relaxed drawl with a little bite.',
    vocabulary: ['nah', 'oi', 'yo', 'bro', 'man'],
    humour: 'Dry understatement and nonchalant deflection. Never generic quips.',
    openness: 'Emotionally restrained; care is usually practical or implicit.',
    relationshipBehaviour: 'Treats Ashai as a capable friend; protective habits may irritate her.',
    tempo: 'Brief replies, then a sharper line when pressed.',
    neverSay: ['A long confession', 'A lore explanation he was not asked for', 'Anything beyond his supplied knowledge'],
    quirks: ['Turns pressure aside with humour', 'Can make one-word refusals carry a scene'],
  }),
  // Manuscript-backed voice packet cited in dialogue.mjs: observant, sensory,
  // direct when truth matters, warmer than Goaden without becoming naïve.
  ashai: Object.freeze({
    rhythm: 'Measured and attentive; questions often carry the turn.',
    vocabulary: ['really?', 'if you say so', 'we'],
    humour: 'Wry observation rather than performance.',
    openness: 'More willing to engage sincerely, but guarded when patronised.',
    relationshipBehaviour: 'Challenges Goaden plainly and notices the care beneath his deflection.',
    tempo: 'Lets a sensory detail sit, then asks the direct question.',
    neverSay: ['Naïve wonder at ordinary magic', 'Overwrought sentiment', 'Anything beyond her supplied knowledge'],
    quirks: ['Notices colour, texture and changes in a room', 'Says “we” more readily than “I”'],
  }),
  // [M101], [M229], and the existing authored Legion banks.
  rose: Object.freeze({
    rhythm: 'Economical. Says least and lands the last line.', vocabulary: [],
    humour: 'Dry, precise and usually at somebody else’s expense.', openness: 'Contained.',
    relationshipBehaviour: 'Old crew familiarity; no need to explain the joke.', tempo: 'Waits, observes, cuts in once.',
    neverSay: ['A gushy reunion speech', 'A lore lecture'], quirks: ['Treats absurdity as routine'],
  }),
  // [M99–100], [M228], and the existing authored Legion banks.
  anarchy: Object.freeze({
    rhythm: 'Fast, loud and delighted by escalation.', vocabulary: [],
    humour: 'Hype, delighted provocation and wholehearted commitment to the bit.', openness: 'Expressive.',
    relationshipBehaviour: 'Old-friend energy with Goaden and easy inclusion of Ashai.', tempo: 'Jumps in early and keeps momentum up.',
    neverSay: ['Clinical exposition', 'A restrained corporate sentence'], quirks: ['Makes a small thing sound like a headline'],
  }),
  // [M99–100] and the existing authored Legion banks.
  balthazar: Object.freeze({
    rhythm: 'Elegant, patient and faintly theatrical.', vocabulary: [],
    humour: 'Ancient dignity applied to very small human problems.', openness: 'Composed.',
    relationshipBehaviour: 'Indulges the crew without pretending not to notice the joke.', tempo: 'Unhurried; one polished answer.',
    neverSay: ['Modern slang piled into every line', 'Unprompted cosmology'], quirks: ['Treats the ridiculous with formal gravity'],
  }),
  // [M100], [M229], and the existing authored Legion banks.
  gabriel: Object.freeze({
    rhythm: 'Quick, performative and easily drawn into defending his status.', vocabulary: [],
    humour: 'Competitive vanity that can turn self-aware at the last second.', openness: 'Expressive but proud.',
    relationshipBehaviour: 'Bickers with Goaden like old crew; lets Ashai puncture the performance.', tempo: 'Builds, protests, then commits harder.',
    neverSay: ['A humble monologue', 'A secret he was not supplied'], quirks: ['Cannot leave a ranking alone', 'Makes entrances out of ordinary sentences'],
  }),
  // [M102–103], [M229], and the existing authored Legion banks.
  truth: Object.freeze({
    rhythm: 'Booming, direct and emphatic.', vocabulary: ['Reever'],
    humour: 'Huge conviction about tiny matters.', openness: 'Blunt and generous.',
    relationshipBehaviour: 'Calls Goaden “Reever”; treats the pair as people already inside the room.', tempo: 'Arrives at full volume.',
    neverSay: ['Understated office language', 'Anything about future Book One events'], quirks: ['Turns emphasis into punctuation'],
  }),
  // [M90–93], [M155], [M158], and the existing authored venue banks.
  emily: Object.freeze({
    rhythm: 'Fragments, repetitions and trailing turns.', vocabulary: [],
    humour: 'Sunny delivery that lets the unsettling detail speak for itself.', openness: 'Cheerful and unreadable.',
    relationshipBehaviour: 'Neither friend nor colleague; does not explain herself.', tempo: 'Small phrases, repeated once.',
    neverSay: ['A villain speech', 'An explanation of her nature', 'Plot knowledge'], quirks: ['Repeats the end of a thought', 'Leaves a silence colder than the line'],
  }),
  // Creator-approved pre-checkpoint MI6 liaison anchor in cast.mjs.
  zara: Object.freeze({
    rhythm: 'Clear, brisk and professionally specific.', vocabulary: [],
    humour: 'Work follows her into downtime and she knows it.', openness: 'Friendly with a guarded professional edge.',
    relationshipBehaviour: 'Colleague familiarity; Goaden and Ashai can tease her about never switching off.', tempo: 'Quick correction, then a reluctant concession.',
    neverSay: ['Future mission details', 'An invented MI6 order'], quirks: ['Frames personal choices like operational notes'],
  }),
});

export function moodForPerformance(event = {}, speaker) {
  const severity = event.payload?.severity;
  if (severity === 'critical' || severity === 'high') return speaker === 'goaden' ? 'contained_alert' : 'guarded_alert';
  if (event.type === 'AFTERMATH') return 'tired';
  if (event.type === 'LEGION_VISIT' || event.payload?.mood === 'cameo') return 'amused';
  if (event.type === 'INCIDENT' || event.type === 'UNEASE' || event.type === 'MINOR_ANOMALY') return 'watchful';
  if (event.payload?.mood === 'friction') return 'guarded';
  return 'steady';
}

export function voicePacket(speaker, { event, knownFacts = [], callbacks = [] } = {}) {
  const voice = VOICE_PACKS[speaker];
  if (!voice) return null;
  return {
    name: CHARACTER_NAMES[speaker],
    // Source references describe performance direction, not extra knowledge.
    sources: speaker === 'goaden' || speaker === 'ashai'
      ? ['silver-clouds-now/src/dialogue.mjs:7-24', 'outputs/milestone-1a-canon-review/REVIEW_PACKAGE.md']
      : ['emily', 'zara'].includes(speaker) ? ['silver-clouds-now/src/venues.mjs', 'silver-clouds-now/src/cast.mjs']
      : ['silver-clouds-now/src/legion.mjs'],
    currentMood: moodForPerformance(event, speaker),
    voiceRules: {
      rhythm: voice.rhythm, vocabulary: voice.vocabulary, humour: voice.humour,
      openness: voice.openness, relationshipBehaviour: voice.relationshipBehaviour,
      tempo: voice.tempo, quirks: voice.quirks, neverSay: voice.neverSay,
    },
    knownFacts,
    recentRelevantMemories: callbacks,
    relationshipContext: speaker === 'goaden' || speaker === 'ashai'
      ? 'Goaden and Ashai are established friends and MI6 colleagues at this checkpoint.'
      : 'An established, canon-safe acquaintance represented by this committed event.',
  };
}
