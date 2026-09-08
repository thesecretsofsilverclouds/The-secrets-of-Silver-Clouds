import { defineCast, quip } from '../engine/grammar.mjs';

// Four grammars. Emily is the quality fixture; the other three exist to prove
// that the same seven practices produce structurally different behaviour rather
// than one generic solution repainted four ways.
//
// Everything load-bearing here is sourced. Where a weight already exists in
// production it is reused rather than reinvented — Goaden's duty/rest/loyalty/
// ambition numbers below are lifted verbatim from MOTIVE_WEIGHTS in
// src/intent.mjs, because a second personality model that disagreed with the
// first would be exactly the "state duplication" failure the brief warns about.
//
// ---------------------------------------------------------------------------
// A correction to the brief, and it makes the fixture stronger.
//
// The brief models Emily's Fade decision as "convenience/impatience incentives"
// plus "Emily's unusually low aversion to that consequence". The canon is
// sharper than that, and it is better:
//
//   "Ten years are deducted from the user's life with each use."
//        — canon/lore book.txt:2794. Note that the Codex carries the same
//          sentence and says five; the author has ruled for the lore book, and
//          the Codex line should be repaired at source.
//   "she's determined to use it till it kills her"
//        — manuscript [P00971], Landis
//   "I need that power. I need it to end this curse!"
//        — manuscript [P03477], Emily
//   "trapping her in the form of a 12-year-old girl, possibly for thousands of
//    years... she has grown weary of her eternal existence and harbors a deep
//    desire for death."
//        — Codex, Emily Grimm
//
// So the cost is not something Emily tolerates. It is the thing she is buying.
// Ten years off a life she cannot end any other way is not a price; it is an
// instalment on the only outcome she wants. That is why she will spend it on a
// turnstile, and it is a comprehensible internal reason rather than chaos —
// which is precisely the standard the brief sets.
//
// The author has ruled explicitly on the frequency question the first review
// left open: **she wants to perish, so she does casually use it.** Her utility
// is therefore untouched, and the engine does not talk her out of it. The
// rationing that exists is presentational and lives in engine.mjs — how often
// a reader is stopped and shown it, never how often she does it.
//
// It also fixes the mystery for free. Goaden and Ashai cannot know any of this:
// it is established at [P00958]–[P00971] in a Holy Order conversation neither
// of them is in, and the knowledge model will not hand it to them. The engine
// knows why. Nobody in the room does. Nothing has to be coyly withheld.
// ---------------------------------------------------------------------------

export const CAST = defineCast([

  // ============================================================ EMILY GRIMM
  {
    id: 'emily',
    displayName: 'Emily',
    canon: ['Codex: Emily Grimm', 'Codex: Fade', 'M90', 'P00707-P00730', 'P00958-P01018', 'P03477'],
    traits: ['counts_things', 'answers_literally', 'reads_as_child', 'unhurried', 'no_social_debt'],
    abilities: ['fade'],

    // What kind of solution each character reaches for. Emily has all the time
    // in the world and no interest in troubling anybody, and the one thing she
    // actually wants is on the `power` row.
    manners: { power: 4, patience: 2, avoidance: 1, force: 0, imposition: -2, assistance: -3 },

    // Hard. These are canon rails, not preferences. An action removed here is
    // removed from the candidate set and reported with its reason, rather than
    // being given a large negative score and left in the running.
    forbids: [
      { name: 'will not explain herself',
        conditions: ['eq Surface confide'],
        why: 'Emily does not explain herself to anyone' },
      { name: 'does not do social reciprocity',
        conditions: ['eq Surface small_talk'],
        why: 'Emily owes nobody a conversation' },
    ],

    // Soft, and evaluated against the state the action would produce.
    drives: [
      // The one that matters. It reads the *cost* of an effect, so it will fire
      // for any authored action that spends her lifespan — not only for Fade,
      // and not because the action is named Fade.
      { name: 'anything that shortens this is worth having',
        conditions: ['used_fade.Actor'], score: 9 },
      { name: 'a number she did not have before',
        conditions: ['observed.Actor.Thing'], score: 5 },
      { name: 'the obstacle simply stopped existing',
        conditions: ['solved.Obstacle.Actor'], score: 2 },
      { name: 'somebody asked, and the true answer is the strange one',
        conditions: ['answered.Actor.Other'], score: 4 },
    ],

    // Read off the state before the action, so they describe circumstance
    // rather than consequence.
    influences: [
      { name: 'nobody has been watching her long enough to matter',
        appliesTo: { intents: ['observe', 'bypass'] },
        conditions: ['alone.Actor'], score: 2 },
      { name: 'being taken for a child is useful',
        appliesTo: { intents: ['answer', 'check_on', 'react', 'enquire'] },
        conditions: ['char.Other', 'neq Actor Other', 'trait.Actor.reads_as_child'], score: 2 },
      // She does not carry the norm penalty everybody else does. This is the
      // whole difference between her and Ashai at a turnstile, and it is one
      // rule rather than a tuned constant.
      { name: 'no interest in what is done and not done',
        appliesTo: { manners: ['power', 'force', 'imposition'] },
        conditions: ['trait.Actor.no_social_debt'], score: 1 },
    ],

    reactions: [
      { name: 'finds concern funny', conditions: ['engaged.Other.Actor'], surface: 'literal_answer' },
    ],

    // What the presentation layer must not explain. The engine records the
    // motive in provenance; the reader is never told it.
    mystery: ['count_pattern', 'fade_bypass', 'literal_answer'],

    // Authored surfaces. Fragments, ellipses, immediate self-repetition,
    // cheerful. "Voices" never "whispers" — the latter is embargoed by
    // src/spoilers.mjs because of an unrelated reveal.
    quips: {
      // No new dialogue in v2. These are the same five lines, with the
      // properties their wording actually needs declared against them. The
      // author's review found each bound to something it could not sensibly be
      // said about, and this is the whole fix.
      count_pattern: [
        quip('Six hundred and fourteen... no. Six hundred and fifteen. One came back.',
          { requires: ['affordance.Thing.prop.can_depart_return'], signature: true }),
        quip('I lost count at the bell. Starting again... starting again from the other end.',
          { requires: ['affordance.Thing.prop.spatially_ordered'], signature: true }),
        // "They do it without knowing" needs somebody capable of not knowing.
        quip('Forty-one so far. Forty-one. They do it without knowing they do it.',
          { requires: ['affordance.Thing.prop.animate_population',
            'affordance.Thing.prop.unconscious_behaviour'], signature: true }),
        quip('In twos is faster. In twos... but you miss the odd one, and the odd one is the interesting one.',
          { requires: ['affordance.Thing.prop.pairable'], signature: true }),
        // Needs somebody who could be number nine, and somebody to say it to.
        quip('Nine since you got here. You are number nine.',
          { requires: ['affordance.Thing.prop.listener_can_be_member', 'not alone.Actor'],
            signature: true }),
        // Added in the metered hour. Target-sensitive rather than paraphrase:
        // each of these is a different *kind* of counting, reachable only where
        // the thing being counted can bear it.
        quip('Two went. Two came back. Not the same two.',
          { requires: ['affordance.Thing.prop.can_depart_return'], signature: true }),
        quip('None of them know I am doing this. That is most of it.',
          { requires: ['affordance.Thing.prop.animate_population',
            'affordance.Thing.prop.unconscious_behaviour'], signature: true }),
        quip('From this end it comes out different. It should not come out different.',
          { requires: ['affordance.Thing.prop.spatially_ordered'], signature: true }),
        quip('Odd number today. Somebody is missing... somebody is always missing.',
          { requires: ['affordance.Thing.prop.pairable'], signature: true }),
        quip('You make it an odd number. Sorry.',
          { requires: ['affordance.Thing.prop.listener_can_be_member', 'not alone.Actor'],
            signature: true }),
        // The first line to bind on `animate_population`, which nothing reached
        // before — a whole property of the world that had no words.
        quip('They keep moving. It is harder when they move. I do not mind.',
          { requires: ['affordance.Thing.prop.animate_population'], signature: true }),
      ],
      idle_watch: [
        'This is a good spot. Nobody looks at benches.',
        'I am not waiting for anything. I am just here... just here for a bit.',
      ],
      literal_answer: [
        'Counting. I said. Counting.',
        'People who look up. Not everyone does. You did.',
        'How many there are. That is all. That is the whole of it.',
        'It is not for anything. Things do not have to be for anything.',
        quip('It is not a secret. Nobody ever asks.', { signature: true }),
      ],
      fade_bypass: [
        quip('Quicker.'),
        quip('It was in the way. Now it is not.', { signature: true }),
        // Ten years. She is counting what it costs, in the same voice she
        // counts everything else. The meaning is recorded internally; the
        // reader is never told it. (Corrected from five after the author's
        // ruling on the lore book / Codex discrepancy.)
        quip('Ten. That one was ten.',
          { signature: true, meaning: 'the ten-year cost of one use of Fade' }),
        // Disproportionate use treated as an errand. The horror is that none of
        // these sound like a decision.
        quip('That was easier.'),
        quip('I had it to spend.',
          { signature: true, meaning: 'she means the years, and she is pleased to be rid of them' }),
        quip('It is only time. There is a great deal of time.', { signature: true }),
        quip('You would have gone round. I know. I know you would.',
          { requires: ['not alone.Actor'], signature: true }),
      ],
      go_around: [
        quip('The long way is fine. I have got the time. I have got all of it.', { signature: true }),
        quip('This way is longer. That is not a problem I have.'),
        quip('I will see more of it this way.'),
      ],
      // Unsettling patience. She is not being polite; she genuinely does not
      // experience waiting as a cost.
      wait_it_out: [
        quip('I can wait. I am extremely good at waiting.', { signature: true }),
        quip('It will move before I do.', { signature: true }),
        quip('I do not mind. Things end.',
          { signature: true, meaning: 'she is not talking about the obstacle' }),
        quip('Take your time. Really.', { requires: ['not alone.Actor'] }),
      ],
      // Socially alarming versions of entirely ordinary requests.
      ask_for_help: [
        quip('Excuse me. Can you move that, or shall I?', { signature: true }),
        quip('You are closer to it than me. Would you mind?'),
      ],
      move_it: [
        quip('There. It was not heavy.'),
        quip('It did not want to move. It has moved.', { signature: true }),
      ],
      keep_distance: [
        quip('Not that one. That one is in a hurry.'),
        quip('I will let them go past.'),
      ],
      stop_and_look: [
        quip('What was that? ... I liked that.'),
      ],
      // Treating something horrifying as completely unremarkable.
      react_oddity: [
        quip('Oh. Do that again.'),
        quip('That is not the worst thing I have seen today.', { signature: true }),
        quip('Is that meant to happen? It is fine either way.'),
        quip('Oh good. I was hoping something would.', { signature: true }),
      ],
      approach_alone: [
        quip('Hello. You are new... you are new here.'),
        quip('You are on your own as well. That is nice.', { signature: true }),
        quip('Sit down if you like. I am not using all of it.'),
      ],
    },
  },

  // ================================================================== ASHAI
  {
    id: 'ashai',
    displayName: 'Ashai Bennet',
    canon: ['M63', 'M87', 'M161 (wants to be useful)', 'M170', 'src/intent.mjs MOTIVE_WEIGHTS'],
    traits: ['protective', 'norm_compliant', 'finishes_the_movement'],
    abilities: [],

    // Ashai's answer to being in the way is to stop being in the way. Asking is
    // fine; making it somebody else's afternoon is not.
    manners: { avoidance: 5, assistance: 5, imposition: 2, patience: 1, force: 1, power: -6 },

    forbids: [
      // She does not possess Fade, so the practice's own `ability.Actor.fade`
      // condition already makes it unreachable. This rule exists anyway,
      // because "could not" and "would not" are different sentences and an
      // author debugging a run needs to be told which one applied.
      { name: 'would not spend a life on a small problem',
        conditions: ['ability.Actor.fade'],
        why: 'Ashai would not use a forbidden technique on something this small even if she could' },
      { name: 'does not walk past somebody who might need help',
        conditions: ['eq Surface keep_distance', 'trait.Other.reads_as_child'],
        why: 'Ashai does not leave a child sitting on their own' },
    ],

    drives: [
      { name: 'somebody was checked on', conditions: ['engaged.Actor.Other'], score: 6 },
      { name: 'nobody had to be troubled about it', conditions: ['solved.Obstacle.Actor'], score: 3 },
      { name: 'she knows something she did not know before',
        conditions: ['asked.Actor.Other'], score: 3 },
      { name: 'a thing between them, still standing', conditions: ['spent.Key'], score: 4 },
    ],

    influences: [
      { name: 'a child on their own is not a thing you walk past',
        conditions: ['char.Other', 'trait.Other.reads_as_child', 'alone.Other'], score: 6 },
      { name: 'wants to be useful',
        appliesTo: { intents: ['check_on', 'enquire', 'join', 'attend'] },
        conditions: ['free.Actor'], score: 2 },
      { name: 'the ordinary way is usually the right way',
        appliesTo: { manners: ['avoidance', 'imposition', 'patience'] },
        conditions: ['trait.Actor.norm_compliant'], score: 2 },
      { name: 'would rather not make a scene about it',
        appliesTo: { manners: ['avoidance', 'patience'] },
        conditions: ['obstacle.Obstacle.at.Place'], score: 1 },
    ],

    reactions: [
      { name: 'worries out loud', conditions: ['seen.Actor.Other.used_fade'], surface: 'react_oddity' },
    ],
    mystery: [],

    quips: {
      // --- COLD_RIVALRY. Minimum banks to exercise the actions. The register
      // is that nothing is happening, and both of them are making sure of it.
      withheld: [
        quip('Davis.', { signature: true }),
        quip('Morning.'),
      ],
      measured_civility: [
        quip('You are in early.'),
        quip('No, go on. I can wait.'),
      ],
      match_them: [
        quip('I have got another set in me.'),
      ],
      // Rare, and it reaches for the line she already used on her once:
      // "It's a commodity that's earned, not given. Once lost, hard to
      // regain." [P00695]. Reaching for it again is the point.
      name_it: [
        quip('Earned, not given. That has not changed.', { signature: true }),
      ],
      approach_alone: [
        'Are you here with someone?',
        'It is cold to be sitting still. Do you want to walk about a bit?',
        'You have been here a while. Is somebody coming for you?',
      ],
      ask_about_activity: [
        'What are you counting?',
        'Go on then. What is it you are keeping track of?',
        'You have not looked away from them once. What am I missing?',
      ],
      // The bank that carried three of eighteen Moments on one line. Avoidance
      // is her whole manner and it had one way of sounding.
      go_around: [
        quip('It is two minutes round. It is not worth the argument.', { signature: true }),
        quip('Round it is. Come on.'),
        quip('I will take the long way. This is not a hill worth dying on.', { signature: true }),
        quip('Round. Faster than standing here deciding.'),
      ],
      ask_for_help: [
        'Excuse me — is there a way through, or do we go round?',
        'Sorry, is this the queue, or is this just where people are standing?',
        quip('Is there somebody who deals with this, or is it just us?'),
      ],
      // Moved out of `ask_for_help`, which was the wrong direction entirely:
      // this is Ashai *offering*, not asking, and it was landing on a queue of
      // people at a cafe counter. Its own action, its own affordance test.
      offer_help: [
        quip('Do you want a hand shifting it?'),
        quip('Two of us will move that in a second.'),
      ],
      wait_it_out: [
        quip('It will clear. Everything clears.', { signature: true }),
        quip('Give it a minute.'),
        quip('I have got a minute. Have you got a minute?', { requires: ['not alone.Actor'] }),
      ],
      react_oddity: [
        'What was that?',
        'You should not have done that. Whatever that cost you, you should not have done that.',
        'Do you know what that does to you?',
      ],
      // Her door, at three in the morning, opening far enough to establish that
      // she has seen everything and is going back to bed. The comedy is that
      // the protective older sister makes an exception exactly once.
      decline_involvement: [
        quip('...I am not getting involved.', { signature: true }),
        quip('No. Whatever that is, it is not mine.'),
      ],
      // Keyed by the callback's topic. src/callbacks.mjs already owns the coat
      // exchange as an authored pair; the lab consumes that registry rather
      // than reinventing it, which is why `coat_comfortable` appears here as a
      // topic and not as a hardcoded line attached to an action.
      'callback_line:coat_comfortable': ['Still comfortable?', 'You slept in it again.'],
      'callback_line:what_she_did': [
        'You have not said anything about the girl.',
        'I keep thinking about the shadow. The one that came back late.',
      ],
      'callback_line:counting': ['Did you ever find out what the number was for?'],
      // The Gazette loop. The paper printed a claim, the world contradicted it,
      // and the contradiction is now something two people can say to each other.
      'callback_line:failed_prediction': [
        'You believed the paper?',
        'The Gazette was very confident about that.',
        'They printed a correction. Two lines, page eleven.',
      ],
      'callback_line:first_meeting': ['That was the one from the plaza, was it not?'],
      small_talk: ['Long enough to be a problem, or long enough to sit down?'],
      sit_with: ['Room?'],
      stop_and_look: ['Hold on.'],
    },
  },

  // ================================================================= GOADEN
  {
    id: 'goaden',
    displayName: 'Goaden Reeves',
    canon: ['M25 (Kai)', 'M63', 'M99-M103', 'M229', 'src/intent.mjs MOTIVE_WEIGHTS'],
    traits: ['watchful', 'deadpan', 'unbothered', 'deflects_concern'],
    abilities: [],

    // Goaden waits. It costs nothing, it is not his problem, and the coat is warm.
    manners: { patience: 5, force: 2, avoidance: 1, assistance: 1, imposition: 0, power: -6 },
    // Verbatim from src/intent.mjs so the two systems cannot drift.
    motives: { duty: 10, rest: 8, loyalty: 4, ambition: 3 },

    forbids: [
      { name: 'does not question children in the street',
        conditions: ['eq Surface ask_about_activity', 'trait.Other.reads_as_child'],
        why: 'Goaden is not going to interrogate a child in a public park' },
      { name: 'would not spend a life on a small problem',
        conditions: ['ability.Actor.fade'],
        why: 'Goaden neither possesses Fade nor would consider it' },
    ],

    drives: [
      { name: 'nothing was expended on it', conditions: ['solved.Obstacle.Actor'], score: 4 },
      { name: 'he now knows where she is', conditions: ['wary.Actor.Other'], score: 5 },
      { name: 'a thing between them, still standing', conditions: ['spent.Key'], score: 5 },
      { name: 'the work got finished', conditions: ['persisted.Actor'], score: 4 },
    ],

    influences: [
      { name: 'something about them does not sit right',
        conditions: ['char.Other', 'trait.Other.reads_as_child', 'alone.Other'], score: 4 },
      { name: 'rest is worth more than most things',
        appliesTo: { manners: ['patience', 'avoidance'] },
        conditions: ['free.Actor'], score: 3 },
      { name: 'not worth getting up for',
        appliesTo: { manners: ['patience', 'avoidance'] },
        conditions: ['obstacle.Obstacle.at.Place'], score: 2 },
      { name: 'watching costs less than asking',
        appliesTo: { intents: ['avoid', 'observe'] },
        conditions: ['trait.Actor.watchful'], score: 2 },
    ],

    reactions: [
      { name: 'says less, not more', conditions: ['seen.Actor.Other.used_fade'], surface: 'react_oddity' },
    ],
    mystery: [],

    quips: {
      keep_distance: [
        'Leave it.',
        'She is fine. She is not the one I would be worrying about.',
        'I would rather see her from here.',
        quip('I have seen her before. That is the part I do not like.', { signature: true }),
        quip('No. From here.'),
      ],
      wait_it_out: [
        quip('It will move.'),
        quip('I am in no hurry. Are you in a hurry?', { requires: ['not alone.Actor'] }),
        quip('Coat is warm. I can stand here all day.', { signature: true }),
        quip('Somebody will shift it. Might even be me, eventually.'),
        quip('I have waited for worse.', { signature: true }),
        quip('It is not going anywhere. Neither am I.', { signature: true }),
      ],
      // Valid, in character, and not content. The action still happens.
      move_it: [quip('Right.', { filler: true })],
      ask_for_help: [
        'Is this meant to be here, or has somebody just left it?',
        'Whose is this, and are they coming back for it?',
        'Any chance of getting past, or shall I take the long way?',
      ],
      react_oddity: [
        'Hm.',
        'Did you see where she went?',
        'No. Do not follow her.',
      ],
      // Woken at three in the morning by somebody wearing somebody else's face.
      // Two beats, and the gap between them is the whole joke: the first is
      // Goaden refusing to accept it is happening, the second is him working
      // out who it actually is.
      startled_awake: [
        quip('...No.', { signature: true }),
        quip('No. Absolutely not. Go back to whatever you were.'),
      ],
      chase_him_down: [
        quip('YOU LITTLE—', { signature: true }),
        quip('Come here. Come HERE.'),
      ],
      'callback_line:coat_comfortable': ['Extremely.', 'It has not got any less comfortable.'],
      'callback_line:what_she_did': ['No.', 'I said do not follow her. That still stands.'],
      'callback_line:first_meeting': ['She was. I would know that hair anywhere.'],
      'callback_line:failed_prediction': [
        'Paper said they fixed this.',
        'That is not what the Gazette told me this morning.',
      ],
      small_talk: ['Long enough.'],
      carry_on: ['It can wait. This cannot.'],
      sit_with: ['Move up.'],
      approach_alone: ['You lost?'],
    },
  },

  // ================================================================== YUKON
  {
    id: 'yukon',
    displayName: 'Yukon',
    canon: ['M65 (Onari heritage, shape-shifts, joined after a bank heist)', 'M64 (gaming area)'],
    traits: ['loud', 'competitive', 'impatient', 'physical', 'nervous_when_serious'],
    abilities: ['shapeshift'],

    // Yukon moves it, loudly, and would like that noted.
    manners: { force: 6, imposition: 3, assistance: 2, avoidance: 0, patience: -2, power: -6 },

    forbids: [
      { name: 'not a party trick',
        conditions: ['eq Surface shapeshift_bypass'],
        why: 'Yukon does not shift shape to get past a trolley in an MI6 corridor' },
      { name: 'would not spend a life on a small problem',
        conditions: ['ability.Actor.fade'],
        why: 'Yukon does not possess Fade' },
      // The line that keeps him employable. Canon insists on both halves:
      // "despite his youth and humour, he carries a quiet authority that even
      // senior agents respect". The humour is real; it has a room it stops in.
      { name: 'never the boss',
        conditions: ['eq Surface mimic_line', 'senior.Other.at.Place'],
        why: 'Yukon does not do an impression of a senior officer to their face' },
      { name: 'not while somebody senior is standing there',
        conditions: ['eq Surface shapeshift_tantrum', 'formal.Place'],
        why: 'the liaison MI6 recruited does not wreck a console in front of a general' },
    ],

    drives: [
      { name: 'it is out of the way now and everybody saw',
        conditions: ['solved.Obstacle.Actor'], score: 5 },
      { name: 'somebody to lose to', conditions: ['talked.Actor.Other'], score: 2 },
      { name: 'it has been beaten, and beaten by him specifically',
        conditions: ['retried.Contest.Actor'], score: 4 },
      { name: 'they will be doing that walk for a week',
        conditions: ['mocked.Actor.Other'], score: 5 },
      { name: 'it is on the record that he won',
        conditions: ['gloated.Actor.Other'], score: 4 },
    ],

    influences: [
      { name: 'faster to shift it than to go round',
        appliesTo: { manners: ['force'] },
        conditions: ['obstacle.Obstacle.at.Place', 'trait.Actor.physical'], score: 5 },
      { name: 'has no patience for queuing',
        appliesTo: { manners: ['force', 'imposition', 'power'] },
        conditions: ['trait.Actor.impatient'], score: 3 },
      // The competitive core. Losing is not upsetting, it is *unfinished*.
      { name: 'it is not beating him, it is just taking a while',
        appliesTo: { manners: ['force'] },
        conditions: ['contest.Contest.tag.losing', 'trait.Actor.competitive'], score: 4 },
      { name: 'that is three times now',
        appliesTo: { manners: ['force', 'imposition'] },
        conditions: ['contest.Contest.tag.humiliating'], score: 4 },
      // Shapeshifting as a social instrument rather than a tactical one. This
      // is his equivalent of Emily spending ten years to skip a queue: the
      // ability is extraordinary and he uses it like a teenager.
      { name: 'he can be anything, and being himself is not the funny option',
        appliesTo: { manners: ['imposition'] },
        conditions: ['ability.Actor.shapeshift', 'informal.Place'], score: 5 },
      { name: 'they walked right into it',
        appliesTo: { manners: ['imposition'] },
        conditions: ['seen.Actor.Other.What', 'familiar.Actor.Other'], score: 3 },
      // And the brake. Seniority moves him off the jokes entirely.
      { name: 'somebody senior is in the room',
        appliesTo: { manners: ['imposition', 'force'] },
        conditions: ['formal.Place'], score: -7 },
      { name: 'talks more when he is less sure',
        appliesTo: { manners: ['assistance'] },
        conditions: ['formal.Place', 'trait.Actor.nervous_when_serious'], score: 5 },
    ],

    reactions: [],
    mystery: [],

    // Minimum viable banks — enough to exercise and validate the new semantic
    // actions, deliberately not a Studio enrichment pass. Voice per canon:
    // rapid and full of fillers when uncertain, wordplay once comfortable.
    quips: {
      move_it: [
        // "You are all welcome" is addressed to a room. This line predates the
        // Yukon practice set and was never wrong before, because Yukon had
        // never once been given an opportunity — 30 of them across four worlds
        // produced nothing. The moment he had reach, the engine had him
        // thanking an empty MI6 corridor. Same semantic-binding class as the
        // v1 review; found by giving a character somewhere to stand.
        quip('Out the way, out the way — there. Done. You are all welcome.',
          { requires: ['not alone.Actor'], signature: true }),
        quip('Nobody was going to do it, so.'),
      ],
      ask_for_help: ['Oi! Is this thing supposed to be here?'],
      wait_it_out: ['This is the worst thing that has ever happened to me.'],
      small_talk: ['Tell me you saw that. Tell me somebody saw that.'],
      react_oddity: ['What. What? No — what?'],
      sit_with: ['You are in my chair. That is my chair.'],

      // --- COMPETITIVE_RETRY
      retry_immediately: [
        // "watch this bit" needs somebody to watch. Without this requirement the
        // engine had him saying it to an empty gaming room — the same
        // semantic-binding failure the v1 review caught, arriving by a new
        // route. `informal.Place` is true only when friends are actually here.
        quip('Again. Again — no, I have got the timing now, watch this bit.',
          { requires: ['informal.Place'] }),
        quip('One more. That is the last one. That is definitely the last one.'),
        // Alone, and no audience presupposed.
        quip('Nearly. That was nearly, that was.'),
      ],
      dispute_rules: [
        quip('That was a load screen. You cannot lose on a load screen, that is just physics.'),
        quip('It hit me before it hit me. You saw it. It hit me before it hit me.'),
      ],
      // The author's escalation. Signature, because it should land once and be
      // remembered rather than become a running gag.
      shapeshift_tantrum: [
        quip('It has been asking for that since Tuesday.', { signature: true }),
        quip('I am going to pay for that. I know. I know I am.', { signature: true }),
      ],

      // --- MOCKING_MIMIC, one bank per person (surfaceBy: 'Other')
      'mimic_line:ashai': [
        quip('Yukon, be careful. Yukon, sit down. Yukon, is that yours?', { signature: true }),
        quip('I am going to worry about everybody in this building, and then I am going to start again.'),
      ],

      // --- SHAPESHIFT_OVERKILL
      shapeshift_overkill: [
        quip('Watch. Watch — you did not need to see that bit, but watch.'),
        quip('That was faster. That was objectively faster and you know it.'),
      ],

      // --- COMPETITIVE_GLOAT_OR_RECOVER
      victory_lap: [
        quip('Say it. Say the thing. Say I am the best at this.'),
        quip('Did you see it? You saw it. You are a witness now, that is how it works.'),
        quip('Skill. That was skill, that. That was never in doubt at any point.'),
      ],
      elaborate_excuse: [
        quip('Right, so — the thing is, that section, um, it is not actually possible the way they built it.'),
        quip('I meant to do that. That was a strategy. That was a whole strategy, that was.'),
      ],

      // --- NIGHT_PRANK, one bank per borrowed face (surfaceBy: 'Disguise').
      //
      // THE RULE THAT MAKES AN IMPRESSION READ AS AN IMPRESSION, and it is the
      // author's, from the staging note: *"fake-Emily is doing too much. Real
      // Emily would somehow be worse while doing less."*
      //
      // That is encodable rather than merely good advice. A mimic line must do
      // the thing the real person's grammar refuses. Emily's own grammar
      // forbids social reciprocity, scores `assistance` at -3, and gives her
      // `no_social_debt` — she does not notice how you are feeling and she
      // certainly does not tell you about it. So "You look frightened" is not a
      // line Emily would ever have; it is Yukon's idea of her, and that is
      // exactly why Goaden works it out.
      //
      // The horror is in the first beat, where he does almost nothing. The
      // comedy arrives when he overplays it.
      'night_prank:emily': [
        // In the doorway, not moving. The tell is that she has commented at all.
        quip('You look frightened.', { signature: true }),
        quip('You look frightened. Are you frightened? I think you might be frightened.',
          { signature: true }),
      ],
      // Mid-chase, and not even tactically useful. The joke is that a boy who
      // can be anything picks *this*.
      'night_prank:ashai': [
        quip('Goaden, perhaps murdering him would be excessive.', { signature: true }),
      ],
      // Wearing Goaden, running backwards. Goaden's own grammar is deadpan and
      // withholding, so an impression of him is necessarily a boast he would
      // never make.
      'mimic_line:goaden': [
        quip('I am Goaden. I am very mysterious. I own three expressions.', { signature: true }),
        quip('It is fine. Everything is fine. I have simply chosen to stand here for forty minutes.'),
        quip('I am not cold. I have never been cold. The coat is a lifestyle.'),
      ],

      // --- NERVOUS_RAMBLE. Fillers are the point, not an accident.
      nervous_ramble: [
        quip('Yes — no, yes. That is, um, that is within what I can, like, do. Probably. Yes.'),
        quip('I can be there. I can be there early, even, if early is — you know. If early helps.'),
      ],
    },
  },

  // ============================================================ AGENT DAVIS
  //
  // Sources, all manuscript: the grand tour and the charm [P00667]-[P00677];
  // overheard — "Ashai? She's not cut out for this. Too naive, too...
  // emotional. And that charm she gave me? Please" [P00679]; the ops-room
  // confrontation [P00689]-[P00713], which ends "Power, Ashai. The same thing
  // we're all after. Some of us are just more honest about it." Production's
  // own supporting voice has her answering "obliquely and while walking" and
  // checking the clock before the other person can.
  //
  // At p.183 the betrayal is behind them. This is the settled state, and it is
  // colder and quieter than the confrontation was: neither of them wants to be
  // the one who makes it a thing again.
  {
    id: 'davis',
    displayName: 'Agent Davis',
    canon: ['Codex: Agent Davis', 'P00667-P00713', 'P01350', 'P01374'],
    traits: ['composed', 'transactional', 'competitive', 'withholding'],
    abilities: [],

    // Everything she does is a transaction. `assistance` is the lowest thing on
    // her board because helping without return is the one move she has no use
    // for; `power` is the highest because she says so in her own words.
    manners: { power: 5, patience: 3, avoidance: 2, imposition: 1, force: 0, assistance: -4 },

    forbids: [
      { name: 'never the first to raise it',
        conditions: ['eq Surface confide'],
        why: 'Davis does not explain herself, and would not start with Ashai' },
      { name: 'no warmth she has not costed',
        conditions: ['eq Surface offer_help'],
        why: 'Davis does not do favours that cannot be called in' },
    ],

    drives: [
      { name: 'the other person moved first', conditions: ['withheld.Other.Actor'], score: 4 },
      { name: 'it cost her nothing', conditions: ['talked.Actor.Other'], score: 2 },
    ],

    influences: [
      { name: 'a rival in the room is a reason to be pleasant',
        appliesTo: { manners: ['patience', 'power'] },
        conditions: ['rival.Actor.Other'], score: 4 },
      { name: 'never visibly wants anything',
        appliesTo: { manners: ['imposition', 'force'] },
        conditions: ['trait.Actor.withholding'], score: -4 },
    ],

    reactions: [],
    mystery: ['measured_civility'],

    quips: {
      measured_civility: [
        quip('Ashai. You are up early.', { requires: ['rival.Actor.Other'] }),
        quip('I have four minutes. You are welcome to two of them.', { signature: true }),
      ],
      cool_exchange: [
        quip('In our world, trust is a rare thing.', { signature: true }),
        quip('A valuable commodity, in our line of work.'),
      ],
      small_talk: [
        quip('Mm. Long week.'),
      ],
      react_oddity: [
        'And nobody is writing that down.',
        'Interesting. Not mine, though.',
      ],
    },
  },
]);

export const CAST_IDS = [...CAST.keys()];
