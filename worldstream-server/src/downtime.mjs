import { createHash } from 'node:crypto';

// The hum, with a pulse.
//
// "Even some of the downtime could do with a little something." It does — and
// the book proves it, because the best writing in Book One is a downtime scene.
// Ashai cannot sleep, hears a piano at the end of a dark corridor, and finds
// Goaden playing his mother's melody with Kai on his shoulder. Nothing happens.
// It is the best chapter in the barracks.
//
// So these stay one line. They stay a ticker. What they stop being is *the same
// line every time*, which is what made the feed read like a status board: the
// world said "Goaden began training" one hundred and forty times.
//
// Each label has a small bank, chosen by a seeded hash off the day and the
// actor, so a given morning always reads the same way and a replay is a no-op.
// The first entry is always the plain one — the world can still speak flatly,
// and should, most of the time.
const hash = text => createHash('sha256').update(text).digest().readUInt32BE(0);
/**
 * A ticker line chosen by the event it describes, so a replay says the same
 * thing and two events stop saying the same thing. The 90-day census found
 * one-string tickers to be the most repeated text the reader sees; a bank of
 * four or five, keyed this way, is the smallest fix that changes that.
 */
export const surfaceLine = (key, choices) => choices[hash(`silver-clouds-surface-v1|${key}`) % choices.length];

// Canon the lines lean on, so the texture is the book's rather than invented:
// Kai rides Goaden's shoulder while he plays [M68]; the melody is his mother's
// and he does not volunteer that [M68]; the lunch hall is loud and full of
// soldiers and yawning Guardians [M64]; the gaming area exists because "brass
// insisted on this area for morale" [M65]; Greah keeps close to Ashai [M69].
const SOLO = Object.freeze({
  training: [
    '{who} began training.',
    '{who} was out on the yard before the hour.',
    '{who} started training, and kept going past the point of sense.',
    '{who} went out to train. The yard was empty and stayed that way.',
  ],
  sleeping: [
    '{who} turned in for the night.',
    '{who} turned in. The corridor light stayed on a while after.',
    '{who} went to bed and the barracks got on with being quiet.',
  ],
  resting: [
    '{who} settled down to rest.',
    '{who} stopped for a while and let the building carry on without them.',
  ],
  eating: [
    '{who} stopped for a meal.',
    '{who} ate in the lunch hall, in the noise, without seeming to hear it.',
    '{who} took a plate and a corner of the long table.',
  ],
  playing_piano: [
    'Goaden began playing piano.',
    'The music room light came on. Goaden, playing something he did not name.',
    'Goaden went to the piano. Kai settled on his shoulder and stayed there.',
    'Something slow came out of the music room for the best part of an hour.',
    'Goaden played with the door open, which he only does when he thinks nobody is up.',
    'The same eight bars came out of the music room a dozen times before they turned into the rest of it.',
    'Goaden sat at the piano a while before he touched it.',
  ],
  listening_to_music: [
    '{who} settled down to listen to music.',
    '{who} put something on and let it run.',
  ],
  gaming: [
    '{who} started a game.',
    '{who} took the good chair in the gaming area while it was going.',
  ],
  watching_television: [
    'Ashai settled down to watch television.',
    'Ashai found something on the television and stopped arguing with the day.',
    'The television went on in the gaming area. Greah settled on the back of the chair.',
    'Ashai watched most of something and the back of her eyelids for the rest of it.',
    'The gaming room television ran all evening with Ashai in front of it and nobody changing the channel.',
    'Ashai put the television on for the noise more than the programme.',
    'Something loud and daft was on. Ashai stayed for the whole of it and would deny that too.',
  ],
  quiet_break: [
    '{who} took a quiet break.',
    '{who} went quiet for a bit, which with {who} is a whole activity.',
  ],
  waiting: ['{who} waited for their agreed break.'],
  in_a_briefing: [
    '{who} was called into an inner circle briefing.',
    '{who} went up to the assembly room and the door shut behind them.',
    '{who} was wanted upstairs. Whatever it was, it was not the sort of thing they came back talking about.',
    'The assembly room took {who} for the best part of an hour and gave nothing back.',
    '{who} went up. Two captains and a folder went up after them, which is never a good sign.',
  ],
  on_call: [
    '{who} went on call for the night.',
    '{who} took the night watch, boots on, doing nothing at considerable intensity.',
  ],
});
// Meals are the single biggest thing the world does — 348 of them over sixty
// days, twelve per cent of everything published — so a flat bank of three was
// never going to be enough however good the three were. Splitting by daypart
// buys variety and truth at the same time: breakfast in a barracks is not
// supper in a barracks, and the feed may as well know which one it is saying.
const SOLO_BY_PART = Object.freeze({
  eating: {
    morning: [
      '{who} got breakfast early, before the hall filled up.',
      '{who} ate standing up, which is not eating, but it was breakfast.',
      '{who} had breakfast with the shift change going on around them.',
      '{who} took the first pot of tea of the day and did not share it.',
      'Breakfast for {who}, and most of a conversation with somebody on their way out.',
    ],
    midday: [
      '{who} went down for lunch in the middle of the rush.',
      '{who} ate lunch in twenty minutes flat and went back to it.',
      'The hall was loud. {who} ate through it.',
      '{who} queued, ate, and was gone before the tables turned over.',
    ],
    evening: [
      '{who} had the evening meal late, when the hall had thinned out.',
      '{who} ate slowly, which for once there was time for.',
      'Dinner for {who}, at the long table, with the day coming off them.',
      '{who} took the evening meal and stayed sitting a while after it.',
    ],
    night: [
      '{who} raided the kitchen at an hour that does not count as a meal.',
      'Something was eaten, late, standing at a counter. {who} would call it dinner.',
    ],
    small_hours: [
      '{who} ate something in the dark rather than admit to being awake.',
    ],
  },
  quiet_break: {
    morning: ['{who} took ten minutes before the day properly started.'],
    evening: ['{who} stopped, and let the evening do the rest of it.'],
    night: ['{who} took a quiet half hour that the building did not notice.'],
  },
  resting: {
    midday: ['{who} put their head down for twenty minutes and denied it afterwards.'],
    evening: ['{who} stopped for the evening earlier than usual.'],
  },
});
// The same, for the moments both of them are in.
const SHARED = Object.freeze({
  eating: ['Goaden and Ashai stopped for a meal.', 'They ate together, which they do not always manage.',
    'They got the same table at the same hour, which after this long is not coincidence.',
    'Both of them ate, at once, sitting down, which the week had not previously allowed.'],
  gaming: ['Goaden and Ashai started a game.', 'A game went on between them for longer than either meant it to.'],
  quiet_break: ['Goaden and Ashai took a quiet break.', 'Neither of them did anything much for half an hour, together.'],
  listening_to_music: ['Goaden and Ashai settled down to listen to music.'],
});

// The two worst repeaters in the whole feed, measured over sixty days:
//
//   145x  Goaden and Ashai crossed paths in the lunch hall.
//    71x  Ashai finished training.
//    65x  Goaden finished training.
//
// One sentence, 145 times, was five per cent of everything the world published.
// That is what made a reader call the feed a status board — not the absence of
// prose, of which there is plenty, but the drumbeat of identical lines between
// the prose. Two banks fix more of the reading experience than any amount of
// new machinery would.
//
// Both keep the plain phrasing first, because the world should still be able to
// say a thing flatly, and most of the time should.
const ENCOUNTER = Object.freeze([
  'Goaden and Ashai crossed paths in {room}.',
  'They ran into each other in {room}. Neither of them was going anywhere.',
  'Goaden and Ashai ended up in {room} at the same time, which happens most days.',
  '{room}, and both of them in it, and no particular reason for either.',
  'They found each other in {room} without either of them having arranged it.',
  'Goaden came through {room}. Ashai was already there and did not move.',
  'Ashai was in {room} first. Goaden arrived and made it look accidental.',
  'The two of them fell into step in {room} and stopped there.',
  'Goaden and Ashai were in {room} at the same time. Neither had planned it and neither minded.',
  '{room} again, and the two of them in it again.',
  'Ashai looked up in {room} and Goaden was there. That was the whole of it.',
]);
// The room does some of the work. A wet training ground and a warm lunch hall
// are not the same meeting, and the feed can say so for free.
const ENCOUNTER_BY_ROOM = Object.freeze({
  corridors: [
    'They met in the corridor, both walking, and both stopped walking.',
    'Goaden and Ashai crossed in the corridor and held up traffic doing it.',
  ],
  common_room: [
    'The lunch hall had them both in it again. It usually does around then.',
    'They took the same table in the lunch hall without discussing it.',
    'Goaden found Ashai in the lunch hall, or the other way round; it was not clear which.',
    'The lunch hall put the two of them at the same table without either of them choosing it.',
    'Ashai had a table in the lunch hall. Goaden had the other chair before she had looked up.',
  ],
  gaming_room: [
    'Both of them turned up in the gaming area within a minute of each other.',
    'Goaden and Ashai met over the good chair. Neither got it.',
    'They arrived in the gaming area a minute apart and pretended it was longer.',
    'The gaming area had them both in it before either had sat down.',
  ],
  music_room: [
    'Ashai followed the sound to the music room and found who she expected.',
  ],
});
const TRAINING_END = Object.freeze([
  '{who} finished training.',
  '{who} finished on the yard and stood a while getting their breath back.',
  '{who} called it. The yard went quiet again.',
  '{who} stopped training, later than they said they would.',
  '{who} finished, and did the last set anyway, because {who} is like that.',
]);
// The world already knows they overdid it — the fatigue fact says so — so the
// line can carry it rather than the reader being told twice.
const TRAINING_END_SPENT = Object.freeze([
  '{who} finished training, and felt it.',
  '{who} stopped, finally, and was slow about leaving the yard.',
  '{who} finished training. Whatever was being worked out did not get worked out.',
  '{who} went past the point of useful and then went a bit further, and stopped.',
]);

/** One line for the pair being in the same room, varied by room and day. */
export function encounterLine({ room, area = '', seed = '', key = '' }) {
  const bank = [...ENCOUNTER, ...(ENCOUNTER_BY_ROOM[area] ?? [])];
  return bank[hash(`${seed}|encounter|${key}`) % bank.length].replace(/\{room\}/g, room);
}

/** One line for the end of a training block, heavier when they overdid it. */
export function trainingEndLine({ who, spent = false, seed = '', key = '' }) {
  const bank = spent ? TRAINING_END_SPENT : TRAINING_END;
  return bank[hash(`${seed}|training-end|${key}`) % bank.length].replace(/\{who\}/g, who);
}

/**
 * One ticker line for a routine moment. Falls back to the plain phrasing the
 * world has always used, so an unwritten label is never a blank.
 */
// The two lines the pair say most often between places, and the door that shuts
// on them. Twenty-eight, twenty-eight and thirty-four firings over seventy days,
// one sentence each. The homeward leg in particular is the most repeated thing
// in a world that is supposed to be about going out.
const HOME_BOARDED = Object.freeze([
  'Goaden and Ashai boarded the Streamliner on their return to MI6.',
  'They got the Streamliner back. The carriage was half empty and neither of them said much.',
  'The homeward carriage, and the city going past in the other direction for once.',
  'They took the Streamliner home with the afternoon behind them and the evening not yet started.',
]);
const HOME_ARRIVED = Object.freeze([
  'Goaden and Ashai returned to MI6.',
  'They came back in through the gate. The scanner took its usual moment too long over Goaden.',
  'Back at the barracks, and the building closed around them the way it does.',
  'Home. The corridors had carried on perfectly well without either of them.',
]);
export const homewardLine = (leg, seed = '', key = '') => {
  const bank = leg === 'boarded' ? HOME_BOARDED : HOME_ARRIVED;
  return bank[hash(`${seed}|homeward|${leg}|${key}`) % bank.length];
};

export function downtimeLine({ label, who, shared = false, plain, part = '', seed = '', key = '' }) {
  // The hour widens the bank rather than replacing it, so a label with nothing
  // written for this daypart still has everything written for the label.
  const bank = shared
    ? (SHARED[label] ?? [])
    : [...(SOLO[label] ?? []), ...(SOLO_BY_PART[label]?.[part] ?? [])];
  if (!bank.length) return plain;
  const chosen = bank[hash(`${seed}|downtime|${key}`) % bank.length];
  return chosen.replace(/\{who\}/g, who);
}

export const ALL_DOWNTIME = Object.freeze([
  ...Object.values(SOLO).flat(), ...Object.values(SHARED).flat(),
  ...Object.values(SOLO_BY_PART).flatMap(byPart => Object.values(byPart).flat()),
  ...ENCOUNTER, ...Object.values(ENCOUNTER_BY_ROOM).flat(), ...TRAINING_END, ...TRAINING_END_SPENT,
  ...HOME_BOARDED, ...HOME_ARRIVED,
]);
