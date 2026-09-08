import { createHash } from 'node:crypto';

// Two registers, one feed.
//
// The note this answers: "in my head I see those lines for down time and actual
// beautiful prose sections for the story parts." That is the right shape and it
// is also the right architecture, because it is the difference between a ticker
// and a novel and the world already knows which of its events is which.
//
//   **ticker** — Goaden began training. Ashai stopped for a meal.
//                Terse, timestamped, unadorned. This is the live stream, and
//                the flatness is the point: it is the hum between the story.
//
//   **prose**  — The corridor lit up along a mile of the Thames and everything
//                with a Presence in it felt the pull.
//                A paragraph. This is the novel, and it only ever runs for
//                moments that have earned it.
//
// Nothing here is generated. Every line is written, chosen by a seeded hash off
// the moment, so the same afternoon always reads the same way and a replay is a
// no-op — the same rule every other authored bank in this world runs under.
//
// The register is a property of the event type, not a judgement made per event,
// so a routine meal can never accidentally become a set piece.
export const PROSE_TYPES = Object.freeze(new Set([
  // Already written as prose and simply marked as such.
  'INCIDENT', 'UNEASE', 'AFTERMATH', 'VENUE_SCENE', 'CONVERSATION', 'LEGION_VISIT',
  // Story beats that were single flat lines and now are not.
  'TRAVEL_DEPART', 'TRAVEL_ARRIVE', 'CITY_ACTIVITY_BEGIN',
  'OUTING_CUT_SHORT', 'ARCANE_SURGE', 'PLAN_BROKEN', 'INVITATION_ACCEPTED',
  'THREAD_DELIVERY_OPEN', 'THREAD_DELIVERY_DECIDE', 'THREAD_DELIVERY_DEADLINE',
  'INTENT_RESPONSE', 'INTENT_RENEGOTIATE', 'INTENT_COMPLETE', 'INTENT_INTERRUPTED',
  'AGENDA_RESOLVE', 'AGENDA_DEADLINE', 'GROUND_WORK_COMPLETED', 'GROUND_WORK_INTERRUPTED',
  'SUPPORTING_OUTCOME', 'SUPPORTING_CALLBACK',
  'NIGHT_CALL', 'NIGHT_WORK_BEGIN', 'NIGHT_WORK_END', 'NIGHT_RETURN', 'NIGHT_DEBRIEF',
  // A shared moment is a paragraph by construction — the whole point of it is
  // one event described from inside a particular room — so it belongs in the
  // novel register. Caught on the live page: the Chimes landing on Ashai at her
  // window was being set as a terse status line directly under the wire copy
  // that announced them, which is the two registers exactly the wrong way round.
  'MOMENT_NOTICED', 'OFFSCREEN_WITNESS',
  // A multi-day arc is the novel half of the feed by definition.
  'ARC_BEAT', 'ARC_CONFRONTATION', 'ARC_CLOSED',
  // Same reasoning for the offscreen lives: editorial-lives writes these as
  // full scenes and they were being rendered as one-line status updates.
  'OFFSCREEN_START', 'OFFSCREEN_RESULT', 'OFFSCREEN_ENCOUNTER',
  'SUPPORTING_COMMITMENT', 'SUPPORTING_ENCOUNTER',
]));
export const registerFor = type => (PROSE_TYPES.has(type) ? 'prose' : 'ticker');

const hash = text => createHash('sha256').update(text).digest().readUInt32BE(0);
const pick = (bank, seed, key) => bank[hash(`${seed}|prose|${key}`) % bank.length];

// Where they are going, written as a journey rather than a boarding notice.
const DEPART = Object.freeze({
  sanctuary: [
    'They took the Streamliner up. London fell away underneath in a long grey curve, and the Sanctuary came out of the cloud the way it always does — all at once, and further up than the eye had budgeted for.',
    'The carriage was half empty. Ashai watched the city drop away through the window and Goaden watched Ashai watch it, and neither of them said anything the whole way up.',
  ],
  cafe: [
    'Ten minutes on the Streamliner with the afternoon going gold outside it. Neither of them had anywhere to be, which is rare enough that both of them noticed.',
    'They got the seats by the door. The city went past in pieces — a bridge, a market, a stretch of water doing something odd with the light — and then the stop came up.',
  ],
  enchanted_ink: [
    'The Ink had moved again. It was two streets from where it had been on Tuesday, wedged between a locksmith and nothing at all, and the door was where the door always is regardless.',
    'Fifteen minutes across town to a shop that would not be there next week. Goaden knew the way anyway. Nobody knows how that works and the Ink does not explain.',
  ],
  big_ben_plaza: [
    'Out to the plaza with the Chimes already going. You hear New Big Ben before you see it, and then you feel it, and then you arrive.',
    'The Streamliner let them out three streets short and they walked the rest. The Chimes were doing something long and low that you could feel through the paving.',
  ],
  mi6: [
    'Back the way they came, slower. The barracks lights were on by the time the carriage pulled in.',
    'The ride home. Goaden slept through most of it and would deny it later.',
  ],
});
const ARRIVE = Object.freeze({
  sanctuary: [
    'They came in through the portal halls with the music already going somewhere above them. Whatever else the Sanctuary is, it is loud in a way that makes you quieter.',
  ],
  cafe: [
    'The Silver Spoon at that hour is mostly steam and other people\'s conversations. They got the corner table by luck rather than planning.',
  ],
  enchanted_ink: [
    'Inside, the whole back wall turned over to look at them. That is not a figure of speech at the Ink — the designs move, and they are nosy.',
  ],
  big_ben_plaza: [
    'The plaza was full and going nowhere, the way it does under the Chimes, and they joined it.',
  ],
  mi6: ['Home, and the gate scanner took its usual moment too long over Goaden.'],
});
// The hour at the venue, when nothing more specific is scheduled.
const CITY_ACTIVITY = Object.freeze({
  visiting_enchanted_ink: [
    'An hour among the designs. Half of them followed the pair around the shop and the other half made a point of not.',
  ],
  at_the_silver_spoon: [
    'They took the table by the window and let the afternoon go on without them for a while.',
  ],
  walking_the_city: [
    'They walked the plaza until the Chimes came round again, which is the correct amount of time to spend at New Big Ben.',
  ],
});
// The three that were one flat line each and are the most dramatic things the
// ordinary week produces.
const CUT_SHORT = Object.freeze({
  mi6_recall: [
    'The callout came through mid-sentence. Goaden read it, said nothing, and was already looking for the door — and Ashai was already standing, because she has learned to read the not-saying.',
    'One line on a handheld and the afternoon was over. They did not finish what they were doing. They rarely do.',
  ],
  order_activity: [
    'Order colours at the end of the street, moving with purpose. Not toward them. It did not matter — the pair were out of the door inside a minute and took the long way back.',
    'Somebody put the word out that the Holy Order were working the borough, and the borough emptied politely around them. So did the pair.',
  ],
});
const SURGE = Object.freeze([
  'The scanners went at twenty to eight and did not settle. Goaden was on his feet before the second tone, jacket in hand, already half a room away. Ashai watched him go and then watched the door for a while after it shut.',
  'A surge on the corridor, and the building changed temperature. He was called; she was not. That is the arrangement and neither of them has ever said out loud how much they hate it.',
]);
const PLAN_BROKEN = Object.freeze([
  'The night halls were open, the invitation was good, and none of that mattered by nine. The callout took the evening whole. Nobody was hurt, which is not the same as nothing being lost.',
  'They had arranged it days ago. It went in a sentence. Goaden apologised the way he does — obliquely, and about something else — and Ashai let him.',
]);
// The evening scene. This is the one prose beat every day is guaranteed, which
// is what "the prose needs to happen enough" comes down to: on a quiet Tuesday
// with no outing and no incident there was previously nothing in the novel
// register at all.
//
// Written toward the book's own downtime voice rather than my drier one —
// atmosphere first, then the people, and then a flat line that undercuts it.
// Book One does exactly this and does it best when nothing is happening:
// Ashai cannot sleep, follows a melody down a dark corridor, and finds Goaden
// playing his mother's song with Kai on his shoulder. Nothing occurs. It is the
// best chapter in the barracks.
const EVENING = Object.freeze({
  ordinary: [
    'The lunch hall emptied out by degrees until it was the two of them and the hum of the lights. Neither made a move to be the one who left first.',
    'Evening settled over the Armoured-dillo the way it does — all at once, from the corridors inward. They found the end of the day at the same table without arranging to.',
  ],
  close: [
    'The building had gone quiet enough to hear itself. Somewhere below them a door closed, and the sound travelled the whole length of the hall before it gave up.',
    'There is an hour at the barracks when the day shift has gone and the night watch has not settled, and the place belongs to whoever is still sitting in it. They were still sitting in it.',
  ],
  strained: [
    'The scanners had been going all week and the building was carrying it in the way buildings do — too many lights on, nobody quite finishing a sentence.',
    'Neither of them had said anything about the week. It sat at the table with them anyway, taking up more room than either was willing to name.',
  ],
  friction: [
    'They took the same table and left more space at it than usual. The lunch hall noise went on around the gap and did not fill it.',
    'Something had gone wrong in the afternoon and neither of them had put it down since.',
  ],
  repair: [
    'The evening they had lost sat between them, and one of them was going to have to mention it. The lights hummed. Neither of them hurried.',
  ],
  sidelong: [
    'The corridors had been busy all day with people who did not stop. It followed them to the table, the way that sort of thing does.',
  ],
  weathered: [
    'Rain had been going at the windows since four and had not let up for the evening. It made the lunch hall feel further underground than it is.',
    'The weather sat over the building all evening, and the building sat under it, and the two of them sat under both.',
  ],
  veil: [
    'The Veil talk had reached the lunch hall, the way it reaches everywhere in the end. You could hear it at three tables at once, all of it slightly wrong.',
  ],
});
export const eveningProse = (mood, seed, key) =>
  EVENING[mood] ? pick(EVENING[mood], seed, key) : null;

const INVITED = Object.freeze([
  'A guest window came up on short notice, the way they occasionally do, and Goaden got to it before it lapsed.',
  'An unclaimed allocation, going spare, valid for a party of two. Sometimes the city hands you something.',
]);

// Authored texture for an already committed delivery episode. No protagonists
// are placed in these endings: the shop may settle it after they have left.
const DELIVERY_OPENING = 'A ribbon of ink curled through a design on the wall. Beside it, the delivery entry stayed stubbornly incomplete: one dispatch copy missing, one closing time that would not move.';
const DELIVERY_ENDINGS = Object.freeze({
  reconciled: 'The two references matched. The hold came off the delivery, and the entry at Enchanted Ink finally read accepted. Around it, the wall designs went on with their restless little lives; this particular snag had an ending.',
  returned: 'One reference on the delivery, another on the copy. The discrepancy was small enough to miss and large enough to stop it. Enchanted Ink marked the delivery for return. The check was over; a replacement was still needed.',
  missed_window: 'The deadline passed with no dispatch copy to check. Enchanted Ink closed the entry for that window, the supplies still outstanding. Designs shifted across the walls. The unresolved need stayed on the page.',
});

// These passages read only the committed public outcome. Private motives,
// evidence and staff knowledge remain outside the narrator's packet. In
// particular, an institutional ending never puts the protagonists in the room.
const INTENT_RESERVED = Object.freeze({
  game: 'The offer had become an agreement. Twelve minutes of the evening were set aside for a short game; a little time together, with a beginning they could actually reach.',
  practice: 'The counteroffer had found an answer. A short practice session, twelve minutes and no more. The original plan had changed; the time together had survived the change.',
  quiet: 'The agreement made room for a quiet break. Twelve minutes without a contest to fill them. The rest of the evening could wait its turn.',
});
const INTENT_COUNTER = Object.freeze({
  practice: 'The offer paused on a different suggestion: a short practice session. It was still a question. Agreement, if it came, would have to come from both sides.',
  quiet: 'A quiet break had taken the place of the original suggestion. It was not agreed yet. For the moment, the small space between question and answer stayed open.',
});
const INTENT_ENDINGS = Object.freeze({
  game: 'Twelve minutes, kept. The short game had made it all the way from an offer to an ending. The rest of MI6 could have the evening back.',
  practice: 'The short practice session reached its agreed end. They had kept the twelve minutes, and the small promise inside them.',
  quiet: 'The quiet break ended at the limit they had agreed. A modest promise had acquired an ordinary, solid ending: the time had been theirs, and they had kept it.',
});
const INTENT_DECLINED = 'The offer ended there. The evening would go on without that particular twelve minutes together; no agreement had been reached to fill them.';
const INTENT_INTERRUPTED = 'The shared session remained unfinished. The time they had set aside had not made it intact to its ending. The unkept interval now had its own ending.';
const AGENDA_ENDINGS = Object.freeze({
  cleared: 'Matching service records gave the review something definite to close on. The temporary caution was lifted. An entry that had held the day back could finally be put behind it.',
  followup_required: 'The review ended; the discrepancy did not. A replacement record and another check remained outstanding. Closing an entry could not make the two records agree.',
  unverified: 'The review had no complete result to stand on. Its entry stayed unverified, with another check outstanding. This part of the work would have to be carried forward.',
});
const GROUND_ENDINGS = Object.freeze({
  cooperative_reset: 'The shared reset was complete, and the restriction came off the outdoor training ground. Cooperation had shortened the work; finishing it was what made the space available again.',
  manual_reset: 'The reset was complete. The restriction came off the outdoor training ground, turning a space that had been unavailable into somewhere ordinary training could happen again.',
  interrupted: 'The interruption left the reset unfinished and the outdoor ground closed. The covered floor remained available. The work outside would still be there after the interruption had passed.',
});

/**
 * The prose for a moment, or null if there is none written and the canonical
 * line should stand. Never invents: an unwritten shape falls back rather than
 * being filled in.
 */
export function proseFor(event, { seed = '', key = '' } = {}) {
  const payload = event?.payload ?? {};
  switch (event?.type) {
    case 'INTENT_RESPONSE': case 'INTENT_RENEGOTIATE':
      if (event.visibility === 'private') return null;
      return payload.status === 'reserved' ? INTENT_RESERVED[payload.activity] ?? null
        : payload.status === 'renegotiating' ? INTENT_COUNTER[payload.activity] ?? null
          : payload.status === 'declined' ? INTENT_DECLINED : null;
    case 'INTENT_COMPLETE':
      return event.visibility !== 'private' && payload.status === 'completed' ? INTENT_ENDINGS[payload.activity] ?? null : null;
    case 'INTENT_INTERRUPTED':
      return event.visibility !== 'private' && payload.status === 'interrupted' ? INTENT_INTERRUPTED : null;
    case 'AGENDA_RESOLVE': case 'AGENDA_DEADLINE':
      return event.visibility !== 'private' && payload.completed === true ? AGENDA_ENDINGS[payload.outcome] ?? null : null;
    case 'GROUND_WORK_COMPLETED':
      return event.visibility !== 'private' && payload.outcome === 'reopened' ? GROUND_ENDINGS[payload.method] ?? null : null;
    case 'GROUND_WORK_INTERRUPTED':
      return event.visibility !== 'private' && event.publicDescription ? GROUND_ENDINGS.interrupted : null;
    case 'THREAD_DELIVERY_OPEN': return DELIVERY_OPENING;
    case 'THREAD_DELIVERY_DECIDE': case 'THREAD_DELIVERY_DEADLINE':
      return payload.completed === true ? DELIVERY_ENDINGS[payload.outcome] ?? null : null;
    // Already written as prose by whatever produced them.
    case 'INCIDENT': case 'UNEASE': case 'AFTERMATH':
      return event.publicDescription ?? null;
    case 'TRAVEL_DEPART': {
      const bank = DEPART[payload.to ?? event.to];
      return bank ? pick(bank, seed, key) : null;
    }
    case 'TRAVEL_ARRIVE': {
      const bank = ARRIVE[payload.to ?? event.to];
      return bank ? pick(bank, seed, key) : null;
    }
    case 'CITY_ACTIVITY_BEGIN': {
      const bank = CITY_ACTIVITY[payload.label];
      return bank ? pick(bank, seed, key) : null;
    }
    case 'OUTING_CUT_SHORT': {
      const bank = CUT_SHORT[payload.reason];
      return bank ? pick(bank, seed, key) : null;
    }
    case 'CONVERSATION': {
      const bank = EVENING[payload.mood];
      return bank ? pick(bank, seed, key) : null;
    }
    case 'ARCANE_SURGE': return pick(SURGE, seed, key);
    case 'PLAN_BROKEN': return pick(PLAN_BROKEN, seed, key);
    case 'INVITATION_ACCEPTED': return pick(INVITED, seed, key);
    default: return null;
  }
}

export const ALL_PROSE = Object.freeze([
  ...Object.values(DEPART).flat(), ...Object.values(ARRIVE).flat(),
  ...Object.values(CITY_ACTIVITY).flat(), ...Object.values(CUT_SHORT).flat(),
  ...SURGE, ...PLAN_BROKEN, ...INVITED, ...Object.values(EVENING).flat(),
  DELIVERY_OPENING, ...Object.values(DELIVERY_ENDINGS),
  ...Object.values(INTENT_RESERVED), ...Object.values(INTENT_COUNTER), ...Object.values(INTENT_ENDINGS),
  INTENT_DECLINED, INTENT_INTERRUPTED, ...Object.values(AGENDA_ENDINGS), ...Object.values(GROUND_ENDINGS),
]);
