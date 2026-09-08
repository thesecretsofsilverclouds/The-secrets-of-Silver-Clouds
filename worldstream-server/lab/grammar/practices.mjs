import { definePractices } from '../engine/practices.mjs';

// Seven practices. Not seven scenes.
//
// A practice says what a situation makes possible and for whom. It holds no
// dialogue, names no character, and prefers no outcome. Everything that makes a
// moment feel like a particular person lives in that person's grammar, which is
// why the same seven definitions produce structurally different behaviour from
// Emily, Ashai, Goaden and Yukon rather than four repaints of one action.
//
// Vocabulary the adapter guarantees (see engine/adapter.mjs):
//   char.X                     X is a character the engine may reason about
//   here.X.PLACE               X is physically at PLACE (location_area)
//   free.X                     X is doing something interruptible
//   alone.X                    nobody else the engine knows about is at X's place
//   activity.X.LABEL           X's current Worldstream activity
//   affordance.THING.at.PLACE  THING is present at PLACE
//   affordance.THING.tag.TAG   THING affords TAG
//   obstacle.O.at.PLACE        a trivial physical obstruction exists
//   ability.X.NAME             X possesses NAME  (canon-gated; see adapter)
//   trait.X.TAG                an authored disposition
//   knows.X.KEY                X knows KEY, derived only from X's own knowledge
//   callback.KEY.by.X          X has an earned callback available
//   world.daypart.PART, world.weather.CODE, world.faction.F.LEVEL
//   seen.OBSERVER.ACTOR.WHAT   OBSERVER witnessed ACTOR doing WHAT
//
// `requires` restates, in Worldstream's terms, what the proposal is claiming.
// The engine is never trusted; the world re-checks.

export const PRACTICES = definePractices([

  // ---------------------------------------------------------------- PUBLIC_IDLE
  // Somebody has unscheduled time somewhere public. The thinnest practice there
  // is, and the one that carries Emily.
  {
    id: 'PUBLIC_IDLE',
    roles: ['Place'],
    actions: [
      {
        id: 'observe_and_count',
        intent: 'observe',
        surface: 'count_pattern',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'free.Actor', because: 'is doing something that cannot be set aside' },
          { if: 'trait.Actor.counts_things', because: 'does not count things' },
          { if: 'affordance.Thing.at.Place', because: 'there is nothing here to observe' },
          { if: 'affordance.Thing.tag.countable', because: 'that is not a thing with a number' },
          { if: 'affordance.Thing.tag.perceptible', because: 'that cannot be seen from here' },
        ],
        requires: ['actor_present_at:Place', 'affordance_present:Thing@Place'],
        effects: [
          // `observed` is witness-scoped: `observed.<observer>.<actor>.<thing>`.
          // The observer is filled in at commit time from who was actually
          // present, which is what stops the question affordance leaking to
          // somebody who merely shares a ledger with the event.
          { kind: 'observation_recorded', subject: 'Actor', of: 'Thing',
            experience: 'observed', asserts: [] },
        ],
        seeds: [{ key: 'counted.Thing', topic: 'counting', kind: 'callback_seed', lifespanDays: 14 }],
        // Salience. Which thing gets counted is decided by what the world is
        // actually doing, not by which affordance happens to sort first — that
        // was the failure the first thirty-day run exposed. Every countable
        // thing at the plaza scored identically, so the stable tie-break chose
        // the benches every single time and one behaviour produced one
        // manifestation. These rules are what make the same authored behaviour
        // bind to the crowd during a procession, to the bell strikes when the
        // tower is ringing, to lit windows after dark, and to its own shadow
        // when the arcane level is up.
        influences: [
          { name: 'there is something here worth a number', conditions: [], score: 2 },
          { name: 'it is making a noise, so the count has a beat to it',
            conditions: ['affordance.Thing.tag.audible'], score: 3 },
          { name: 'they are people, and people are the interesting kind of number',
            conditions: ['affordance.Thing.tag.social'], score: 3 },
          { name: 'it only exists because of what the city is doing today',
            conditions: ['affordance.Thing.tag.transient'], score: 4 },
          { name: 'the shadows are behaving oddly and one of them is hers',
            conditions: ['affordance.Thing.tag.shadowed', 'world.faction.arcane.high'], score: 5 },
          { name: 'the shadows are behaving oddly',
            conditions: ['affordance.Thing.tag.shadowed', 'world.faction.arcane.moderate'], score: 3 },
          { name: 'a crowd that is doing something in particular',
            conditions: ['affordance.Thing.tag.countable', 'world.condition.procession'], score: 3 },
        ],
      },
      {
        // The designated nothing. It is a real action with real conditions, and
        // it is deliberately not surfaceable: when it wins, the honest report is
        // that nobody did anything worth a reader's time. Modelling silence as
        // a candidate rather than as the absence of one is what stops the engine
        // reaching for the least bad beat every time two people share a room.
        id: 'sit_and_watch',
        intent: 'observe',
        surface: 'idle_watch',
        surfaceable: false,
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'free.Actor', because: 'is doing something that cannot be set aside' },
          { if: 'affordance.Thing.at.Place', because: 'nothing here to sit at' },
          { if: 'affordance.Thing.tag.sittable', because: 'that cannot be sat on' },
        ],
        requires: ['actor_present_at:Place'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['idled.Actor'] }],
        influences: [{ name: 'somewhere to sit', conditions: [], score: 1 }],
      },
    ],
  },

  // ------------------------------------------------- PERSON_ALONE_ENCOUNTER
  // One or more characters come across somebody by themselves. This is the
  // plaza shape, and it deliberately does not know that the somebody is Emily.
  {
    id: 'PERSON_ALONE_ENCOUNTER',
    roles: ['Place'],
    actions: [
      {
        id: 'approach_person_alone',
        intent: 'check_on',
        surface: 'approach_alone',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'free.Actor', because: 'is doing something that cannot be set aside' },
          { if: 'char.Other', because: 'there is nobody else here' },
          { if: 'neq Actor Other', because: 'cannot approach oneself' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'alone.Other', because: 'the other person is not by themselves' },
          { if: 'not companion.Actor.Other', because: 'they arrived together, so this is not an encounter' },
          { if: 'not familiar.Actor.Other', because: 'they already know each other, so this is not an encounter' },
        ],
        requires: ['actor_present_at:Place', 'other_present_at:Place', 'co_present:Actor,Other'],
        effects: [
          { kind: 'attention_given', subject: 'Actor', to: 'Other', asserts: ['engaged.Actor.Other'] },
        ],
        seeds: [{ key: 'met.Other', topic: 'first_meeting', kind: 'callback_seed', lifespanDays: 30 }],
        influences: [
          { name: 'somebody on their own in a public place', conditions: [], score: 2 },
          { name: 'a child on their own',
            conditions: ['trait.Other.reads_as_child'], score: 3 },
        ],
      },
      {
        id: 'keep_distance',
        intent: 'avoid',
        surface: 'keep_distance',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'char.Other', because: 'there is nobody else here' },
          { if: 'neq Actor Other', because: 'cannot avoid oneself' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'alone.Other', because: 'the other person is not by themselves' },
          { if: 'not familiar.Actor.Other', because: 'they already know each other' },
        ],
        requires: ['co_present:Actor,Other'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['wary.Actor.Other'] }],
        influences: [{ name: 'something about them does not sit right', conditions: [], score: 1 }],
      },
      {
        id: 'ask_what_they_are_doing',
        intent: 'enquire',
        surface: 'ask_about_activity',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody else here' },
          { if: 'neq Actor Other', because: 'cannot question oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is no longer co-present' },
          // "I saw *you* doing that." The actor's own witnessing, not the
          // world's. Anybody who was elsewhere has no such sentence and
          // therefore no question to ask — the rail is the missing fact rather
          // than a politely written condition.
          { if: 'observed.Actor.Other.Thing', because: 'did not see them doing anything' },
          { if: 'not asked.Actor.Other.Thing', because: 'has already asked about that' },
        ],
        requires: ['co_present:Actor,Other', 'observable:Other,Thing'],
        effects: [
          { kind: 'knowledge_offered', subject: 'Other', to: 'Actor', about: 'Thing',
            experience: 'asked', asserts: [] },
        ],
        seeds: [{ key: 'asked_about.Thing', topic: 'the_question', kind: 'callback_seed', lifespanDays: 21 }],
        influences: [{ name: 'a direct question about a visible oddity', conditions: [], score: 3 }],
      },
      {
        id: 'answer_literally',
        intent: 'answer',
        surface: 'literal_answer',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'nobody asked' },
          { if: 'neq Actor Other', because: 'cannot answer oneself' },
          { if: 'asked.Other.Actor.Thing', because: 'has not been asked about anything' },
          { if: 'not answered.Actor.Other.Thing', because: 'has already answered that' },
          { if: 'here.Other.Place', because: 'the questioner has gone' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'trait.Actor.answers_literally', because: 'does not answer questions that way' },
        ],
        requires: ['co_present:Actor,Other'],
        effects: [
          { kind: 'fact_shared', subject: 'Actor', to: 'Other',
            experience: 'answered', asserts: [] },
        ],
        seeds: [{ key: 'literal_answer_from.Actor', topic: 'the_answer', kind: 'callback_seed', lifespanDays: 60 }],
        influences: [
          { name: 'the true answer is also the strangest one', conditions: [], score: 4 },
        ],
      },
    ],
  },

  // ------------------------------------------------------ MINOR_INCONVENIENCE
  // A trivial physical obstruction with several valid answers. The point of
  // this practice is that every listed action is genuinely available to
  // everybody who can reach it, so the difference between characters is
  // entirely in what they want, never in what they can do.
  //
  // Each action declares a `manner`: the *kind* of solution it is — wait it
  // out, go round it, ask somebody, shift it yourself, or spend power on it.
  // This exists because of a measured failure. Without it, Ashai, Goaden and
  // Yukon all chose `ask_for_help` at the same trolley, because their grammars
  // described what they care about (protecting people, resting, winning) and
  // nothing described *how they solve a problem*. Four characters produced two
  // answers, which is precisely the brief's "generic character soup". A
  // practice has to expose the shape of an action or every grammar reaches for
  // whichever one happens to score highest for unrelated reasons.
  {
    id: 'MINOR_INCONVENIENCE',
    roles: ['Place'],
    actions: [
      {
        id: 'wait_it_out', intent: 'bypass', surface: 'wait_it_out', manner: 'patience',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'obstacle.Obstacle.at.Place', because: 'nothing is in the way' },
        ],
        requires: ['actor_present_at:Place', 'obstacle_present:Obstacle@Place'],
        effects: [{ kind: 'time_spent', subject: 'Actor', minutes: 4, asserts: ['solved.Obstacle.Actor'] }],
        influences: [{ name: 'costs nothing but time', conditions: [], score: 1 }],
      },
      {
        id: 'go_around', intent: 'bypass', surface: 'go_around', manner: 'avoidance',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'obstacle.Obstacle.at.Place', because: 'nothing is in the way' },
          { if: 'obstacle.Obstacle.tag.navigable', because: 'there is no way round it' },
        ],
        requires: ['actor_present_at:Place', 'obstacle_present:Obstacle@Place'],
        effects: [{ kind: 'time_spent', subject: 'Actor', minutes: 1, asserts: ['solved.Obstacle.Actor'] }],
        influences: [{ name: 'the ordinary answer', conditions: [], score: 2 }],
      },
      {
        // `Helper` is an affordance, not a person — a serving hatch, a counter,
        // a market stall. It is bound as a role but never listed as a
        // participant, because the validator checks participants for physical
        // presence and a hatch is not somebody who can be somewhere.
        id: 'ask_for_help', intent: 'bypass', surface: 'ask_for_help', manner: 'imposition',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'obstacle.Obstacle.at.Place', because: 'nothing is in the way' },
          { if: 'affordance.Helper.at.Place', because: 'there is nobody to ask' },
          { if: 'affordance.Helper.tag.askable', because: 'that is not somebody who can be asked' },
        ],
        requires: ['actor_present_at:Place', 'helper_present:Helper@Place'],
        effects: [{ kind: 'time_spent', subject: 'Actor', minutes: 3, asserts: ['solved.Obstacle.Actor'] }],
        influences: [{ name: 'somebody here whose job this is', conditions: [], score: 2 }],
      },
      {
        id: 'move_it', intent: 'bypass', surface: 'move_it', manner: 'force',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'obstacle.Obstacle.at.Place', because: 'nothing is in the way' },
          { if: 'obstacle.Obstacle.tag.movable', because: 'it is not something that can be shifted' },
        ],
        requires: ['actor_present_at:Place', 'obstacle_present:Obstacle@Place'],
        effects: [{ kind: 'object_moved', subject: 'Actor', object: 'Obstacle',
          asserts: ['solved.Obstacle.Actor'] }],
        influences: [{ name: 'just deal with it', conditions: [], score: 2 }],
      },
      {
        // Offering to take somebody else's problem on. A different act from
        // `ask_for_help` in both direction and target: it needs another person
        // here with the same obstruction, and something that can actually be
        // shifted. The author caught the original: Ashai's "Do you want a hand
        // shifting it?" was surfaced as `ask_for_help` against a cafe queue —
        // wrong direction, and you cannot shift a queue of people.
        id: 'offer_help', manner: 'assistance', intent: 'assist', surface: 'offer_help',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'char.Other', because: 'there is nobody to offer it to' },
          { if: 'neq Actor Other', because: 'cannot offer to help oneself' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'obstacle.Obstacle.at.Place', because: 'nothing is in the way' },
          { if: 'obstacle.Obstacle.tag.movable', because: 'it is not something two people could shift' },
        ],
        requires: ['co_present:Actor,Other', 'obstacle_present:Obstacle@Place'],
        effects: [{ kind: 'time_spent', subject: 'Actor', minutes: 2,
          asserts: ['solved.Obstacle.Actor'] }],
        influences: [{ name: 'somebody else is stuck with it too', conditions: [], score: 2 }],
      },
      {
        // Canon: the Duskkin Soul Stealing Protocol. **Ten years** of the
        // user's life per invocation; banned by the clan; lethal to ordinary
        // users after as few as three uses.
        //
        // The two canon files disagree and the author has ruled. `lore book.txt`
        // line 2794 reads "Ten years are deducted from the user's life with
        // each use"; `The Secrets of Silver Clouds Codex.txt` line 540 carries
        // the same sentence otherwise word for word and says five. The lore
        // book is correct and the Codex line is a transcription error worth
        // repairing at source.
        //
        // Nothing about the cost is softened here, and — the author's second
        // ruling — nothing about it is used to talk Emily out of it. She wants
        // to perish; casual use is in character. Ten years a time, seven times
        // in ninety days, is seventy years she is glad to be rid of. What is
        // rationed is how often a reader is shown it, not how often she does it.
        id: 'use_fade', intent: 'bypass', surface: 'fade_bypass', manner: 'power',
        reason: 'chose the shortest distance between two points',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'obstacle.Obstacle.at.Place', because: 'nothing is in the way' },
          { if: 'ability.Actor.fade', because: 'does not possess Fade' },
          { if: 'affordance.Shadow.at.Place', because: 'there is no shadow here to move through' },
          { if: 'affordance.Shadow.tag.shadowed', because: 'that is not a shadow' },
        ],
        requires: ['actor_present_at:Place', 'actor_possesses:fade', 'shadow_present:Shadow@Place',
          'author_approved_action:use_fade'],
        effects: [
          { kind: 'ability_used', subject: 'Actor', ability: 'fade',
            cost: { lifespanYears: 10 }, authorApproved: true,
            asserts: ['solved.Obstacle.Actor', 'used_fade.Actor'] },
          { kind: 'witness_memory', subject: 'Actor', asserts: [] },
        ],
        seeds: [{ key: 'saw_fade_used.Actor', topic: 'what_she_did', kind: 'callback_seed', lifespanDays: 90 }],
        influences: [
          { name: 'instant, and no further thought required', conditions: [], score: 3 },
        ],
      },
    ],
    volitions: [
      { name: 'the obstacle is dealt with', conditions: ['solved.Obstacle.Actor'], score: 1 },
    ],
  },

  // -------------------------------------------------------------- SHARED_PAUSE
  //
  // Renamed from SHARED_WAIT, and the rename is the fix rather than cosmetic.
  // The old practice asked for a literal `waiting` activity that this world
  // never produces: `fill_the_silence` was blocked 561 times in ninety days
  // with "is not waiting for anything", so half the practice was written for a
  // situation that does not exist. Rather than inventing a waiting state to
  // satisfy it, the practice now describes what the world actually has —
  // unhurried shared co-presence: two people together, neither holding an
  // obligation or a task that would stop them turning to each other, somewhere
  // that people talk.
  //
  // Silence stays a valid outcome. Being in a room together is a *condition*
  // for conversation, never a cause of one; the scoring and the interest floor
  // still decide whether anything is worth saying, and most of the time they
  // decide it is not.
  {
    id: 'SHARED_PAUSE',
    roles: ['Place'],
    actions: [
      {
        id: 'fill_the_silence', intent: 'converse', surface: 'small_talk',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to talk to' },
          { if: 'neq Actor Other', because: 'cannot talk to oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          // Both genuinely free — an interruptible activity, which is exactly
          // "no immediate obligation or active task that prevents interaction".
          { if: 'free.Actor', because: 'is in the middle of something' },
          { if: 'free.Other', because: 'the other person is in the middle of something' },
          { if: 'sociable.Place', because: 'this is not a place people talk in' },
        ],
        requires: ['co_present:Actor,Other'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['talked.Actor.Other'] }],
        influences: [{ name: 'a gap in the day', conditions: [], score: 1 }],
      },
      {
        // The surface is chosen by the callback's *topic*, not by the action.
        // Without that, every earned callback reaches for the same authored
        // line and Ashai says "Still comfortable?" to a colleague about a coat
        // he was not wearing — which is exactly what the first thirty-day run
        // produced, and exactly the brief's "quip exhaustion" failure.
        id: 'call_back_earlier', intent: 'tease', surface: 'callback_line',
        surfaceBy: 'Topic',
        dialogueFamily: 'callback',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to say it to' },
          { if: 'neq Actor Other', because: 'cannot tease oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is no longer co-present' },
          { if: 'callback.Key.by.Actor', because: 'has no earned callback to reach for' },
          { if: 'callback.Key.about.Other', because: 'that callback is not about this person' },
          { if: 'callback.Key.topic.Topic', because: 'that callback is not about anything in particular' },
          { if: 'not spent.Key', because: 'that callback has already been used' },
        ],
        requires: ['co_present:Actor,Other', 'callback_earned:Key'],
        effects: [
          { kind: 'callback_used', subject: 'Actor', to: 'Other', key: 'Key',
            asserts: ['spent.Key', 'talked.Actor.Other'] },
        ],
        influences: [
          { name: 'a thing already said between them, still standing', conditions: [], score: 5 },
        ],
      },
    ],
  },

  // -------------------------------------------------- NOTICE_UNUSUAL_BEHAVIOUR
  {
    id: 'NOTICE_UNUSUAL_BEHAVIOUR',
    roles: ['Place'],
    actions: [
      {
        id: 'react_to_oddity', intent: 'react', surface: 'react_oddity',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'nobody else is here' },
          { if: 'neq Actor Other', because: 'cannot be surprised by oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is no longer co-present' },
          { if: 'seen.Actor.Other.What', because: 'did not witness it' },
        ],
        requires: ['co_present:Actor,Other', 'witnessed:Actor,Other,What'],
        effects: [
          { kind: 'reaction', subject: 'Actor', to: 'Other', about: 'What',
            asserts: ['reacted.Actor.Other'] },
          { kind: 'memory_formed', subject: 'Actor', about: 'What', asserts: [] },
        ],
        seeds: [{ key: 'witnessed.What', topic: 'what_she_did', kind: 'callback_seed', lifespanDays: 90 }],
        influences: [
          { name: 'that is not a thing people do', conditions: [], score: 3 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------------- CASUAL_MEAL
  {
    id: 'CASUAL_MEAL',
    roles: ['Place'],
    actions: [
      {
        // Not surfaceable, and the reason is a discipline rather than a taste.
        // Worldstream already narrates two people eating together — MEAL_BEGIN
        // is one of the most frequent events in a thirty-day run. A Moment that
        // said the same thing again would be the engine competing with the
        // world instead of filling a gap in it. CASUAL_MEAL earns its place by
        // supplying *roles*: it is what puts two people at one table so that a
        // callback or a tease has somewhere to happen.
        id: 'sit_with', intent: 'join', surface: 'sit_with',
        surfaceable: false,
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to sit with' },
          { if: 'neq Actor Other', because: 'cannot sit with oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'activity.Actor.eating', because: 'is not eating' },
        ],
        requires: ['co_present:Actor,Other'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['talked.Actor.Other'] }],
        influences: [{ name: 'the same table', conditions: [], score: 1 }],
      },
    ],
  },

  // ------------------------------------------------------------ WORK_INTERRUPTED
  {
    id: 'WORK_INTERRUPTED',
    roles: ['Place'],
    actions: [
      {
        id: 'carry_on_regardless', intent: 'persist', surface: 'carry_on',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'interrupted.Actor', because: 'was not interrupted' },
          { if: 'not free.Actor', because: 'was not doing anything to be interrupted from' },
        ],
        requires: ['actor_present_at:Place', 'actor_interrupted:Actor'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['persisted.Actor'] }],
        influences: [{ name: 'finish the thing', conditions: [], score: 2 }],
      },
      {
        id: 'stop_and_look', intent: 'attend', surface: 'stop_and_look',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'interrupted.Actor', because: 'was not interrupted' },
        ],
        requires: ['actor_present_at:Place', 'actor_interrupted:Actor'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['attended.Actor'] }],
        influences: [{ name: 'whatever that was, it was worth a look', conditions: [], score: 2 }],
      },
    ],
  },
  // ================================================== YUKON, and only Yukon
  //
  // The shadow run said this exactly: 30 opportunities with Yukon present, 0
  // proposals, and **0 `no_authored_surface`** — his lines were never the
  // blocker, because his actions never became available. No practice described
  // a short, energetic, trouble-seeking teenager who can turn into anything.
  //
  // Grounded in the public character material rather than invented:
  //   * teenage Onari, grey skin, pointy ears, and *short* where his people are
  //     tall — which canon says he is embarrassed about;
  //   * uniquely transforms into **any** creature, where other Onari manage
  //     three;
  //   * energetic, reckless, courts trouble;
  //   * rapid talker, verbose with fillers when uncertain; puns and wordplay
  //     once comfortable;
  //   * Ashai treats him as a younger brother; he, Ashai and Goaden spend
  //     downtime gaming;
  //   * and the guardrail — "despite his youth and humour, he carries a quiet
  //     authority that even senior agents respect". He is not a comedy goblin.
  //     The register changes with the room, which is what `formal.Place` and
  //     `informal.Place` are for.
  //
  // None of these name Yukon. They describe situations; his grammar is what
  // makes the answers his. Emily could technically enter COMPETITIVE_RETRY —
  // she has no `competitive` trait, so she never does.

  // ------------------------------------------------------ COMPETITIVE_RETRY
  // Losing at something that does not matter. The world already runs Yukon's
  // `game_retry` project — "the section that keeps beating him", with an
  // attempt count — and until now nothing in the grammar asked about it.
  {
    id: 'COMPETITIVE_RETRY',
    roles: ['Place'],
    actions: [
      {
        id: 'try_again_immediately', intent: 'persist', surface: 'retry_immediately',
        manner: 'force',
        reason: 'went straight back in',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'trait.Actor.competitive', because: 'does not mind losing' },
          { if: 'contest.Contest.at.Place', because: 'there is nothing here to lose at' },
          { if: 'contest.Contest.by.Actor', because: 'that is not their contest' },
          { if: 'contest.Contest.tag.losing', because: 'they are not losing it' },
        ],
        requires: ['actor_present_at:Place', 'contest_present:Contest@Place'],
        effects: [{ kind: 'time_spent', subject: 'Actor', minutes: 3,
          asserts: ['retried.Contest.Actor'] }],
        influences: [{ name: 'it was nearly, that time', conditions: [], score: 3 }],
      },
      {
        // Not anger — negotiation with reality. Canon has him bubbly rather
        // than grim, so a loss becomes play rather than a sulk.
        id: 'dispute_the_loss', intent: 'dispute', surface: 'dispute_rules',
        manner: 'imposition',
        reason: 'explained why that one did not count',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'trait.Actor.competitive', because: 'does not mind losing' },
          { if: 'contest.Contest.at.Place', because: 'there is nothing here to lose at' },
          { if: 'contest.Contest.by.Actor', because: 'that is not their contest' },
          { if: 'contest.Contest.tag.losing', because: 'they are not losing it' },
          { if: 'contest.Contest.tag.repeated', because: 'has not lost it often enough to argue' },
        ],
        requires: ['actor_present_at:Place', 'contest_present:Contest@Place'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['disputed.Contest.Actor'] }],
        influences: [{ name: 'that was the machine, not him', conditions: [], score: 2 }],
      },
      {
        // The author's own escalation, and the reason this practice needed an
        // attempt count: lose enough times in a row and Yukon stops being funny
        // about it in the ordinary way.
        //
        // Costly and canonical, like Fade — the cost is committed whether or
        // not a reader is ever shown it. Cliff Henderson replaces the console
        // and takes it out of Yukon's pay, which is why the effect names him:
        // canon has Cliff as the reason the VR room exists at all, and as the
        // closest thing Yukon has to a boss who would notice.
        //
        // Gated hard on `informal.Place`. He would not do this in front of a
        // senior agent, and the same canon line that makes him funny with his
        // friends is the one that stops him here.
        id: 'lose_it_completely', intent: 'destroy', surface: 'shapeshift_tantrum',
        manner: 'force',
        reason: 'stopped being reasonable about a video game',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'ability.Actor.shapeshift', because: 'cannot become anything else' },
          { if: 'trait.Actor.competitive', because: 'does not mind losing' },
          { if: 'contest.Contest.at.Place', because: 'there is nothing here to lose at' },
          { if: 'contest.Contest.by.Actor', because: 'that is not their contest' },
          // Both, and the first is not redundant: the attempt count survives a
          // win, so `humiliating` on its own let a victorious Yukon destroy the
          // console in celebration. Caught by the situation probe, not by luck.
          { if: 'contest.Contest.tag.losing', because: 'they are not losing it' },
          { if: 'contest.Contest.tag.humiliating', because: 'has not lost it enough times for that' },
          { if: 'informal.Place', because: 'there is somebody here he would not do that in front of' },
        ],
        requires: ['actor_present_at:Place', 'actor_possesses:shapeshift',
          'contest_present:Contest@Place', 'author_approved_action:lose_it_completely'],
        effects: [
          { kind: 'ability_used', subject: 'Actor', ability: 'shapeshift',
            cost: { dockedPayBy: 'henderson', replaces: 'gaming_room_console' },
            authorApproved: true,
            asserts: ['broke.Contest.Actor', 'shifted.Actor'] },
          { kind: 'witness_memory', subject: 'Actor', asserts: [] },
        ],
        seeds: [{ key: 'saw_yukon_break_it.Actor', topic: 'what_he_did',
          kind: 'callback_seed', lifespanDays: 60 }],
        influences: [{ name: 'nothing else had worked', conditions: [], score: 4 }],
      },
    ],
  },

  // -------------------------------------------------------- MOCKING_MIMIC
  // The one only he can do. Shapeshifting used *socially* rather than
  // tactically — his equivalent of Emily spending ten years to skip a queue.
  //
  // Teasing, never hostility: it needs familiarity, an informal room, and
  // something he actually watched the other person do.
  {
    id: 'MOCKING_MIMIC',
    roles: ['Place'],
    actions: [
      {
        id: 'mimic_person', intent: 'tease', surface: 'mimic_line',
        // One bank per person impersonated. An impression of Goaden and an
        // impression of Ashai are different jokes, and a shared bank would have
        // Yukon doing the same voice for both — the "quip exhaustion" failure
        // the callback surfaces already solved.
        surfaceBy: 'Other',
        dialogueFamily: 'mimic',
        manner: 'imposition',
        reason: 'became somebody else for about four seconds',
        participants: ['Other'],
        // Presentation metadata, so this costs no bespoke artwork. The renderer
        // reuses the target's existing plate under a grey Onari tint rather
        // than needing a drawing of Yukon-as-Goaden.
        presentation: {
          kind: 'TRANSFORM_MIMIC', source: 'Actor', target: 'Other',
          durationMs: 4500, tint: 'onari_grey', reuseTargetPlate: true,
          returnTo: 'Actor',
        },
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to do an impression of' },
          { if: 'neq Actor Other', because: 'cannot do an impression of oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'free.Actor', because: 'is in the middle of something' },
          { if: 'ability.Actor.shapeshift', because: 'cannot take another shape' },
          { if: 'familiar.Actor.Other', because: 'does not know them well enough to take the mickey' },
          { if: 'informal.Place', because: 'this is not a room for that' },
          // Something they actually just did. Without this he mocks people for
          // nothing, which is neither funny nor in character.
          { if: 'seen.Actor.Other.What', because: 'they have not just done anything worth copying' },
        ],
        requires: ['co_present:Actor,Other', 'actor_possesses:shapeshift',
          'actor_witnessed:Actor,Other,What'],
        effects: [
          { kind: 'none', subject: 'Actor', of: 'Other',
            experience: 'observed', asserts: ['mocked.Actor.Other', 'shifted.Actor'] },
        ],
        seeds: [{ key: 'yukon_did_you.Other', topic: 'the_impression',
          kind: 'callback_seed', lifespanDays: 30 }],
        influences: [{ name: 'it was right there to be done', conditions: [], score: 4 }],
      },
    ],
  },

  // ---------------------------------------------------- SHAPESHIFT_OVERKILL
  // A trivial obstruction and a boy who can become anything. The joke is not
  // the shapeshifting; it is that he has unlimited forms and uses them like a
  // teenager.
  //
  // His grammar already forbids `shapeshift_bypass` — "Yukon does not shift
  // shape to get past a trolley in an MI6 corridor" — and that forbid stays.
  // This is the off-duty case it was never meant to cover, which is why the
  // condition is `informal.Place` rather than merely `not fixed`.
  {
    id: 'SHAPESHIFT_OVERKILL',
    roles: ['Place'],
    actions: [
      {
        id: 'overkill_the_problem', intent: 'bypass', surface: 'shapeshift_overkill',
        manner: 'force',
        reason: 'solved a small problem enormously',
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'free.Actor', because: 'is in the middle of something' },
          { if: 'ability.Actor.shapeshift', because: 'cannot take another shape' },
          { if: 'obstacle.Obstacle.at.Place', because: 'nothing is in the way' },
          { if: 'informal.Place', because: 'not somewhere he would clown about' },
        ],
        requires: ['actor_present_at:Place', 'actor_possesses:shapeshift'],
        effects: [{ kind: 'none', subject: 'Actor',
          asserts: ['solved.Obstacle.Actor', 'shifted.Actor'] }],
        influences: [{ name: 'why walk round it', conditions: [], score: 3 }],
      },
    ],
  },

  // ------------------------------------------ COMPETITIVE_GLOAT_OR_RECOVER
  // Winning and losing in front of somebody. Kept separate from
  // COMPETITIVE_RETRY because the presence of an audience is the whole point,
  // and because a win and a loss must not collapse into one behaviour.
  {
    id: 'COMPETITIVE_GLOAT_OR_RECOVER',
    roles: ['Place'],
    actions: [
      {
        id: 'victory_lap', intent: 'gloat', surface: 'victory_lap',
        manner: 'imposition',
        reason: 'made sure it had been witnessed',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to have seen it' },
          { if: 'neq Actor Other', because: 'a victory lap needs somebody else' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'trait.Actor.competitive', because: 'does not keep score' },
          { if: 'contest.Contest.at.Place', because: 'there is nothing here to have won' },
          { if: 'contest.Contest.by.Actor', because: 'that is not their contest' },
          { if: 'contest.Contest.tag.won', because: 'they have not won it' },
        ],
        requires: ['co_present:Actor,Other', 'contest_present:Contest@Place'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['gloated.Actor.Other'] }],
        seeds: [{ key: 'yukon_won_one.Other', topic: 'the_result',
          kind: 'callback_seed', lifespanDays: 21 }],
        influences: [{ name: 'skill, obviously, and never in doubt', conditions: [], score: 3 }],
      },
      {
        // Losing in company. Getting more ridiculous rather than more angry is
        // the character note that keeps him likeable.
        id: 'narrate_the_excuse', intent: 'excuse', surface: 'elaborate_excuse',
        manner: 'avoidance',
        reason: 'explained at length what had been meant to happen',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to explain it to' },
          { if: 'neq Actor Other', because: 'an excuse needs an audience' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'trait.Actor.competitive', because: 'does not mind losing' },
          { if: 'contest.Contest.at.Place', because: 'there is nothing here to have lost' },
          { if: 'contest.Contest.by.Actor', because: 'that is not their contest' },
          { if: 'contest.Contest.tag.losing', because: 'they are not losing it' },
        ],
        requires: ['co_present:Actor,Other', 'contest_present:Contest@Place'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['excused.Contest.Actor'] }],
        influences: [{ name: 'it is important that this is understood properly', conditions: [], score: 2 }],
      },
    ],
  },

  // -------------------------------------------------------------- COLD_RIVALRY
  // Two people with history, in the same room, both perfectly polite.
  //
  // Ashai and Davis, after the charm. Manuscript [P00667]-[P00713]: the tour,
  // the charm from the training grounds, Davis overheard calling her "too
  // naive, too... emotional", and the ops-room confrontation. At p.183 that is
  // behind them, and what is left is colder and much quieter.
  //
  // **The dominant action is deliberately the one where nothing happens.**
  // Greah's advice at [P00681] is the design note: *"People like Davis, they
  // thrive on this. Don't give her the satisfaction."* A rivalry practice whose
  // best move is a cutting remark would be a different pair of people, and the
  // author's own steer — she is not the type to snap easily — says the same.
  {
    id: 'COLD_RIVALRY',
    roles: ['Place'],
    actions: [
      {
        // The canonical answer, and it is surfaceable: a reader should be able
        // to watch somebody decide not to.
        id: 'withhold_the_reaction', intent: 'withhold', surface: 'withheld',
        manner: 'avoidance',
        reason: 'did not give them the satisfaction',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody here to not react to' },
          { if: 'neq Actor Other', because: 'cannot have a rivalry with oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'rival.Actor.Other', because: 'there is no history between them' },
          { if: 'trait.Actor.does_not_take_the_bait', because: 'would simply say something' },
        ],
        requires: ['co_present:Actor,Other'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['withheld.Actor.Other'] }],
        influences: [
          { name: 'nothing to be gained by starting it again', conditions: [], score: 3 },
        ],
      },
      {
        // Both of them can take this one, and it reads differently from each.
        id: 'measured_civility', intent: 'converse', surface: 'measured_civility',
        manner: 'patience',
        reason: 'was entirely civil about it',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to be civil to' },
          { if: 'neq Actor Other', because: 'cannot be civil at oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'free.Actor', because: 'is in the middle of something' },
          { if: 'rival.Actor.Other', because: 'there is no history between them' },
        ],
        requires: ['co_present:Actor,Other'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['talked.Actor.Other'] }],
        influences: [{ name: 'the room is watching, slightly', conditions: [], score: 2 }],
      },
      {
        // [P01374]: "Davis, ever competitive, pushed herself higher, her eyes
        // locked on Ashai who responded in kind." Neither of them says a word;
        // the rivalry moves into the work instead.
        id: 'match_them', intent: 'compete', surface: 'match_them',
        manner: 'force',
        reason: 'answered it without saying anything',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to match' },
          { if: 'neq Actor Other', because: 'cannot compete with oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'rival.Actor.Other', because: 'there is no history between them' },
          { if: 'trait.Actor.competitive', because: 'does not keep score' },
          // Somewhere the work itself can carry it. Standing in a corridor
          // being quietly better at something is not available.
          { if: 'activity.Actor.training', because: 'there is nothing here to be better at' },
        ],
        requires: ['co_present:Actor,Other'],
        effects: [{ kind: 'time_spent', subject: 'Actor', minutes: 5,
          asserts: ['matched.Actor.Other'] }],
        influences: [{ name: 'they are watching, and both of them know it', conditions: [], score: 3 }],
      },
      {
        // The rare one. It needs an actual provocation she has just witnessed —
        // she does not reopen it out of nowhere, and this is the action that
        // must stay hard to reach or the whole pair reads wrong.
        id: 'name_it', intent: 'confront', surface: 'name_it',
        manner: 'imposition',
        reason: 'said the thing out loud',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to say it to' },
          { if: 'neq Actor Other', because: 'cannot confront oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'rival.Actor.Other', because: 'there is no history between them' },
          { if: 'seen.Actor.Other.What', because: 'they have not just done anything to answer' },
          // `formal.Place` rather than a senior-shaped pattern: the engine's own
          // validator refused `not senior.Any.at.Place` because `Any` is never
          // bound, which was right — a negation over an unbound variable is not
          // a question with an answer.
          { if: 'not formal.Place', because: 'not in front of a senior officer' },
        ],
        requires: ['co_present:Actor,Other', 'actor_witnessed:Actor,Other,What'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['named.Actor.Other'] }],
        influences: [{ name: 'that one was deliberate', conditions: [], score: 2 }],
      },
    ],
  },

  // -------------------------------------------------------------- NIGHT_PRANK
  // The author's scene: Yukon creeping into Goaden's room wearing somebody
  // else's face at three in the morning.
  //
  // It goes in as a practice rather than a scene because Worldstream is already
  // asking for it. There is a `NIGHT_WINDOW` slot in the ledger and both
  // instances of it closed with the payload `{"outcome":"skipped","reason":"No
  // rare, available night follow-up"}` — the world opens a window for something
  // unusual at night and currently has nothing to put in it.
  //
  // Three roles, which is what makes this different from MOCKING_MIMIC:
  //   Actor    — Yukon, who can look like anyone
  //   Target   — whoever is asleep, and is about to stop being asleep
  //   Disguise — the person whose face he borrows, who need not be here at all
  //
  // The Disguise role is the reason this is worth the machinery. Yukon can only
  // wear a face he has actually seen, so a grey Emily at the foot of the bed is
  // *earned* — it requires that he met her, which given how sparse she is makes
  // it genuinely rare rather than merely random.
  {
    id: 'NIGHT_PRANK',
    roles: ['Place'],
    actions: [
      {
        id: 'creep_in_wearing_a_face', intent: 'tease', surface: 'night_prank',
        // One bank per face worn. Being woken by Emily is not the same joke as
        // being woken by Ashai.
        surfaceBy: 'Disguise',
        dialogueFamily: 'mimic',
        manner: 'imposition',
        reason: 'thought this would be funny at three in the morning',
        participants: ['Target'],
        presentation: {
          kind: 'TRANSFORM_MIMIC', source: 'Actor', target: 'Disguise',
          durationMs: 6000, tint: 'onari_grey', reuseTargetPlate: true,
          returnTo: 'Actor', lighting: 'night',
        },
        // The handoff. This Moment is the first beat and the provenance; the
        // chase across rooms belongs to the authored night layer, which owns
        // `PRANK_SCENE` in src/night-stories.mjs. The engine decides whether it
        // may happen; it does not decide how it plays.
        scene: { scene: 'night_prank_chase', actor: 'Actor', target: 'Target',
          disguise: 'Disguise', owner: 'night-story' },
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'ability.Actor.shapeshift', because: 'cannot take another shape' },
          { if: 'trait.Actor.reckless', because: 'would not think this was a good idea' },
          // He sleeps in the same quarters. Almost every night he is asleep in
          // them, which is the whole reason this stays rare.
          { if: 'not asleep.Actor', because: 'is asleep himself' },
          { if: 'char.Target', because: 'there is nobody to wake up' },
          { if: 'neq Actor Target', because: 'cannot creep up on oneself' },
          { if: 'here.Target.Place', because: 'the sleeper is not here' },
          { if: 'asleep.Target', because: 'they are already awake, which ruins it' },
          { if: 'familiar.Actor.Target', because: 'you do not do this to a stranger' },
          // The borrowed face. Must be somebody, must not be the sleeper, and
          // must be somebody he has actually laid eyes on.
          // Deliberately **no** `char.Disguise`. That condition would require the
          // borrowed face to be standing in the room, which is the opposite of
          // the point — Emily is a sparse actor who is almost never anywhere,
          // and a grey Emily at the foot of the bed is frightening precisely
          // because she is not there. `seen.` binds the role on its own, and it
          // binds it to somebody he has genuinely met.
          { if: 'seen.Actor.Disguise.What', because: 'has never actually seen that person' },
          { if: 'neq Disguise Target', because: 'being woken by yourself is a different problem' },
          { if: 'neq Disguise Actor', because: 'his own face is not a disguise' },
          { if: 'not senior.Disguise.at.Place', because: 'not a face he would dare borrow' },
          // And not the act either. The earlier version guarded only the
          // borrowed face, so a general could be standing in the quarters and
          // Yukon would still creep about in a mask. Same canon line as
          // everywhere else: the humour has a room it stops in.
          { if: 'not formal.Place', because: 'somebody senior is in the room' },
          { if: 'world.dark', because: 'this is only funny in the dark' },
        ],
        requires: ['actor_present_at:Place', 'actor_possesses:shapeshift',
          'co_present:Actor,Target', 'actor_witnessed:Actor,Disguise,What',
          'author_approved_action:creep_in_wearing_a_face'],
        effects: [
          // The waking is the consequence, and it is committed whether or not a
          // reader is shown it. The chase down the corridor that the author
          // imagines after it is a *scene*, not a Moment — several beats, two
          // people moving through rooms — so this seeds it rather than claiming
          // to be it. See the note in SHADOW-FINDINGS.
          { kind: 'attention_given', subject: 'Actor', to: 'Target',
            authorApproved: true,
            asserts: ['startled.Target.Actor', 'awake.Target', 'shifted.Actor'] },
          { kind: 'witness_memory', subject: 'Actor', asserts: [] },
        ],
        seeds: [
          { key: 'the_night_yukon_did_that.Target', topic: 'the_prank',
            kind: 'callback_seed', lifespanDays: 120 },
        ],
        influences: [
          { name: 'nobody is awake to tell him not to', conditions: [], score: 5 },
          { name: 'the face is the funny part', conditions: ['trait.Actor.loud'], score: 2 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------- NERVOUS_RAMBLE
  // The other half of him, and the reason he does not read as one note. Canon
  // is explicit: verbose and full of fillers when uncertain, puns once
  // comfortable. So seniority and seriousness move him *away* from the jokes.
  //
  // This is also what keeps the MI6 liaison intact — the boy who "carries a
  // quiet authority that even senior agents respect" is the same boy who talks
  // too much when Cliff walks in.
  {
    id: 'NERVOUS_RAMBLE',
    roles: ['Place'],
    actions: [
      {
        id: 'talk_too_much', intent: 'converse', surface: 'nervous_ramble',
        manner: 'assistance',
        reason: 'filled the room with words',
        participants: ['Other'],
        conditions: [
          { if: 'char.Actor', because: 'not a character the engine tracks' },
          { if: 'char.Other', because: 'there is nobody to talk at' },
          { if: 'neq Actor Other', because: 'cannot ramble at oneself' },
          { if: 'here.Actor.Place', because: 'is not at this place' },
          { if: 'here.Other.Place', because: 'the other person is not here' },
          { if: 'trait.Actor.nervous_when_serious', because: 'is not thrown by that sort of thing' },
          { if: 'formal.Place', because: 'nothing here is making him nervous' },
        ],
        requires: ['co_present:Actor,Other'],
        effects: [{ kind: 'none', subject: 'Actor', asserts: ['talked.Actor.Other'] }],
        influences: [{ name: 'somebody senior is standing right there', conditions: [], score: 4 }],
      },
    ],
  },
]);

export const PRACTICE_IDS = [...PRACTICES.keys()];
