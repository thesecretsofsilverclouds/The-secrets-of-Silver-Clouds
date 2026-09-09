// A reading edition of already committed world moments. Each correction is
// tied to an exact authored sentence and its owning type/kind. Later text,
// private events and unknown casts pass through untouched. No world state is
// consulted; these words cannot discover a culprit or complete an open story.
// Staging anchors: manuscript P00476–P00522 (MI6, piano and Guardians),
// P00163/P00186 (Kai), P00050–P00068 (Greah). Lintels' cloud-like appearance
// and the Chimes' light are described in the lore book's Lintels and New Big
// Ben sections.
const rules = new Map();
const add = (type, key, original, description, guard = {}) =>
  rules.set(`${type}|${key}|${original}`, { description, ...guard });
const moment = (kind, who, original, description) => add('MOMENT_NOTICED', kind, original, description,
  { location: 'mi6', cast: [who] });
const routine = (type, who, original, description) => add(type, '', original, description,
  { location: 'mi6', cast: [who] });
const arc = (id, stage, original, description) => add('ARC_BEAT', `${id}:${stage}`, original, description);

moment('chimes_pulse', 'ashai',
  'Ashai was sitting with her eyes shut in the quarters, which is the closest she gets to being off duty. The Chimes came over the barracks in one long sheet of sound and she opened one eye, and only one. Greah was already at the window, lit up about it, watching the notes climb over London as though the city had done it for her.',
  'The Chimes of Renewal rolled over the barracks. In her quarters, Ashai opened one eye. Greah was already at the window, glowing as she watched the luminous notes climb over London. Ashai left the other eye shut.');
moment('chimes_pulse', 'goaden',
  'Goaden had stopped for half an hour and was not thinking about anything in particular. The Chimes went through the building. He did not move, but Kai lifted his head off his shoulder and tracked the motes across the window until the last of them was gone.',
  'Goaden stayed where he was as the Chimes of Renewal sounded through MI6. On his shoulder, Kai lifted his head and followed the glowing notes past the window. Goaden rested; the little dragon watched until the last light had passed.');
moment('chimes_pulse', 'goaden',
  'Goaden was at the piano when New Big Ben went through the building, and for about four bars the two of them were in the same key. He noticed. He stopped, listened to the rest of it with his hands still on the keys, and Kai did not stir at all.',
  'New Big Ben’s chimes reached the piano while Goaden was playing. For four bars, bell and piano held the same key. His fingers stopped. He listened with his hands resting on the keys. Kai did not stir on his shoulder.');
moment('chimes_pulse', 'ashai',
  'Ashai had something playing quietly in the quarters and the Chimes went straight over the top of it. She turned her own music off rather than compete, and sat listening to the bigger sound until it let go of the building.',
  'The Chimes of Renewal drowned out the music in Ashai’s quarters. She switched her music off and sat listening to New Big Ben, waiting for the last note to fade through the barracks.');
moment('chimes_pulse', 'ashai',
  'The Chimes reached the barracks and everything with a window in it stopped for a moment. Ashai went to hers. The notes were already high over the river by then, thinning out the way they do, and Greah was on the sill ahead of her.',
  'Ashai went to the window as the Chimes of Renewal reached MI6. High over the river, the glowing notes were thinning into the sky. Greah had reached the sill first.');
moment('chimes_pulse', 'goaden',
  'The Chimes came over MI6 and Goaden did what he always does, which is carry on and pretend he has not noticed. Kai gave him away by staring out of the window for the whole of it.',
  'The Chimes of Renewal sounded over MI6. Goaden carried on with what he was doing, while Kai turned towards the window and stayed watching for the whole peal.');
moment('arcane_surge', 'goaden',
  'In the MI6 barracks, whatever it is that answers a surge in Goaden answered this one. Kai came off his shoulder with his scales up.',
  'Goaden felt the Thames surge inside the barracks. Kai lifted off his shoulder, scales raised. The little dragon stayed close.');
// The previous edition already corrects this exact legacy room transition:
// the committed standby call put Goaden in his quarters, not the lunch hall.
moment('arcane_surge', 'goaden',
  'Goaden was out of the lunch hall before the second tone. Whatever it is that answers a surge in him answered this one, and Kai came off his shoulder into the air over the corridor with his scales up.',
  'Goaden felt the Thames surge inside the barracks. Kai lifted off his shoulder, scales raised. The little dragon stayed close.');
moment('arcane_surge', 'ashai',
  'It woke her. Ashai lay still in the dark with the light off the corridor coming through the blind, working out from the colour of it how bad this one was.',
  'The Thames surge woke Ashai. Light from the river’s magical corridor came through the blind. She lay still, watching its colour, trying to judge the strength of the surge.');
moment('storm_breaks', 'goaden',
  'It came down hard enough to wake him. Goaden lay listening to it hit the window for a while, which is the most restful thing he has done all week, and Kai did not stir.',
  'Rain hammered the quarters window hard enough to wake Goaden. He lay listening to it, making no move to get up. Kai slept through the noise.');
moment('storm_breaks', 'ashai',
  'The storm came up the river and hit the barracks broadside. Ashai went to the corridor window with half the day shift and watched the yard turn into a lake. Greah was on the sill, lit up, absolutely delighted by the whole business.',
  'The storm swept up the Thames and struck the barracks windows. Ashai joined the day-shift soldiers watching rain flood the yard. On the sill, Greah glowed as she watched the water spread.');
moment('order_procession', 'ashai',
  'Ashai was on the yard when word went round, and finished the set facing the wall rather than the river, which she would tell you was about the light.',
  'Word reached the training yard that the Holy Order were passing along the embankment. Ashai finished her set facing the wall. She kept her back to the river.');
moment('order_procession', 'goaden',
  'Goaden stopped mid-set, listened to somebody shout the news across the yard, and started the set again from the top. Faster.',
  'Someone shouted across the training yard that the Holy Order were passing along the embankment. Goaden stopped mid-set to listen. Then he started the set again, faster.');
moment('order_procession', 'goaden',
  'Order colours on the far bank of the river, watched the length of the MI6 corridor windows, moving with purpose and not toward anybody. Goaden watched the whole procession past without changing expression once, which took some doing. Kai\'s scales stayed up the entire time.',
  'Holy Order colours moved along the far bank of the river. Goaden watched from the MI6 corridor until the procession had passed, his expression fixed. Kai’s scales stayed raised.');
moment('veil_notice', 'goaden',
  'Word of the Veil dates reached MI6 and the lanterns went up along the river to make it official. Goaden looked at them for a while. Whatever he was thinking about, it was not the festival.',
  'The Church lanterns went up along the river after the Veil festival dates reached MI6. Goaden watched them from the barracks. He said nothing.');

routine('PIANO_BEGIN', 'goaden',
  'The music room light came on. Goaden, playing something he did not name.',
  'Goaden switched on the music-room light and sat at the piano. He began to play without naming the tune.');
routine('PIANO_BEGIN', 'goaden',
  'Something slow came out of the music room for the best part of an hour.',
  'Goaden played a slow melody in the MI6 music room, letting each phrase settle before beginning the next.');
routine('PIANO_BEGIN', 'goaden',
  'The same eight bars came out of the music room a dozen times before they turned into the rest of it.',
  'At the piano in the music room, Goaden repeated an eight-bar phrase. Each time his hands came back to its beginning, he listened before trying it again.');
routine('PIANO_BEGIN', 'goaden',
  'Goaden played with the door open, which he only does when he thinks nobody is up.',
  'Goaden left the music-room door open as he played. The piano carried into the corridor.');
routine('TV_BEGIN', 'ashai',
  'Ashai found something on the television and stopped arguing with the day.',
  'Ashai found a programme on the gaming-room television and settled back to watch.');
routine('TV_BEGIN', 'ashai',
  'Ashai watched most of something and the back of her eyelids for the rest of it.',
  'Ashai watched television in the gaming room, her eyelids sinking as the programme went on.');
routine('TV_BEGIN', 'ashai',
  'The gaming room television ran all evening with Ashai in front of it and nobody changing the channel.',
  'Ashai settled in front of the gaming-room television and left the channel alone.');
routine('TV_BEGIN', 'ashai',
  'Something loud and daft was on. Ashai stayed for the whole of it and would deny that too.',
  'The television blared across the gaming room. Ashai settled in to watch, enjoying the silliness enough to leave the channel where it was.');
routine('TV_BEGIN', 'ashai',
  'The television went on in the gaming area. Greah settled on the back of the chair.',
  'Ashai switched on the television in the gaming area. Greah settled on the back of her chair.');
for (const [who, name, pronoun] of [['goaden', 'Goaden', 'He'], ['ashai', 'Ashai', 'She']]) {
  routine('MUSIC_LISTEN_BEGIN', who, `${name} put something on and let it run.`,
    `${name} put some music on and sat listening, letting the tracks run.`);
  routine('QUIET_TIME_BEGIN', who, `${name} went quiet for a bit, which with ${name} is a whole activity.`,
    `${name} took a quiet break. ${pronoun} sat without speaking while the sounds of MI6 carried on nearby.`);
  routine('QUIET_TIME_BEGIN', who, `${name} stopped, and let the evening do the rest of it.`,
    `${name} stopped for a quiet break that evening, letting ${who === 'goaden' ? 'his' : 'her'} hands rest.`);
}

add('UNEASE', 'lintel_vigil',
  'A lintel settled outside the quarters window and stayed there. It was still there at six.',
  'A lintel, a drifting cloud-like creature, settled outside an MI6 quarters window. At six it was still there.', { location: 'mi6' });
add('UNEASE', 'burned_docket',
  'A docket arrived for the section with the bottom third burned away. Nobody had sent it.',
  'A dispatch docket arrived at MI6 with its bottom third burned away. Nobody had sent it.', { location: 'mi6' });
add('UNEASE', 'unrecognised',
  'Somebody Goaden has worked beside for months walked straight past him in the corridor without a flicker.',
  'A colleague Goaden had worked beside for months passed him in the MI6 corridor without showing any sign of recognition.', { location: 'mi6', cast: [] });
add('UNEASE', 'clock_disagreement',
  'For one round of the hour the Chimes of Renewal rang thirteen, and the plaza pretended not to notice.',
  'New Big Ben struck thirteen. The Chimes of Renewal faded over the plaza, leaving one note too many.', { location: 'big_ben_plaza' });
add('UNEASE', 'quiet_meu',
  'Every MEU handheld in the building read zero for a minute and a half, which they are not built to do.',
  'Every MEU handheld scanner in MI6 read zero. The impossible reading held for a minute and a half.', { location: 'mi6' });
add('INCIDENT', 'courier',
  'A courier came to the gate with a package for a name nobody at the barracks has heard of, and would not leave it.',
  'A courier arrived at the MI6 gate with a package addressed to someone nobody at the barracks recognised. The courier refused to hand it over.', { location: 'mi6' });
add('INCIDENT', 'confrontation',
  'It found them on the way back and it did not intend to leave. Goaden drew. It took both of them and it took a while.',
  'An attacker caught Goaden and Ashai on the way back. Goaden drew his weapon. Ashai fought beside him; neither could finish the fight alone.', { cast: ['goaden', 'ashai'] });
add('AFTERMATH', 'pursuit',
  'Nobody said much about the run back. Ashai was awake before the alarm went.',
  'Ashai was awake before the morning alarm. Neither she nor Goaden said much about the pursuit that had sent them running back to the barracks.', { cast: ['goaden', 'ashai'] });
add('AFTERMATH', 'hunted',
  'The lit streets, again, and neither of them mentioned why.',
  'Goaden and Ashai kept to the lit streets again. Neither spoke about whatever had been hunting along the embankment.', { cast: ['goaden', 'ashai'] });
add('AFTERMATH', 'confrontation',
  'Neither of them had slept much. It sat over the whole morning without being spoken about.',
  'Goaden and Ashai had slept little after the fight. Through the morning, neither brought it up.', { cast: ['goaden', 'ashai'] });

arc('burned_dockets', 'first',
  'A docket arrived for the section with the bottom third burned away. Nobody had sent it, and the duty officer logged it under nothing in particular.',
  'A dispatch docket arrived at MI6 with its bottom third burned away. Nobody had sent it. The duty officer logged the damaged paper without knowing where to file it.');
arc('burned_dockets', 'second',
  'A second docket, burned the same way, to the same depth, arrived at the same desk. The duty officer stopped logging it under nothing in particular and went to find somebody senior.',
  'A second burned dispatch docket arrived at the same MI6 desk. The burn stopped at exactly the same point on the paper. This time the duty officer went to find somebody senior.');
arc('order_interest', 'noticed',
  'An Order robe stood at the far end of the embankment for most of the evening, facing the barracks. Not watching a door, not watching a window. Watching the building, the way you look at a thing you have been told about.',
  'A figure in Holy Order robes stood at the far end of the embankment for most of the evening, facing MI6. Their attention stayed on the barracks as a whole. They made no move towards a door.');
arc('third_carriage', 'warm',
  'The third carriage was running warm again. It has been running warm for a month and the board has been saying so for a month, in a font that suggests nobody involved considers it their problem.',
  'The third carriage of the Streamliner was running warm again. A month of unexplained warmth, and a month of the same small notice on the station board. The carriage was still in service.');
arc('ink_admirer', 'follows',
  'The small drifting lintel design followed Ashai three shelves at Enchanted Ink, which she has decided to find flattering rather than the alternative.',
  'At Enchanted Ink, a small design of a lintel drifted along the wall after Ashai. She moved past three shelves; the cloud-shaped design followed all three. She chose to take the attention as a compliment.');
arc('ink_runs', 'still',
  'There was a gap in the back wall of Enchanted Ink the size of a hand, four plates in from the left, where there has not been a gap since the shop opened. The tattooist found it at three and reacted to it by sitting down on the floor.',
  'A hand-sized gap had opened among the design plates on Enchanted Ink’s back wall, four places in from the left. The space had been filled since the shop opened. The tattooist found it at three and sat down on the floor.');
arc('familiar_one', 'absent',
  'The roof garden above the market has kept a notebook for two years, and the notebook has a lintel in it most weeks, and this month it has none. The woman who keeps the notebook mentioned it to Ashai in the way people mention a thing they have decided not to be upset about.',
  'For two years, the woman tending the market’s roof garden had noted the visits of a lintel, a drifting cloud-like creature. Most weeks it came. This month her notebook had no sightings. She mentioned the absence to Ashai, trying to keep the worry out of her voice.');
arc('after_the_shield', 'monday',
  'She held a barrier over four people for eleven minutes on the Saturday and everybody has been very nice about it. On the Monday she came in at the usual time, went to the usual place and found that she could not hold a thought through to the end of a sentence.',
  'On Saturday, Ashai had held a barrier over four people for eleven minutes. By Monday, the praise had outlasted her ability to concentrate. She came into MI6 at her usual time and found she could not hold a thought through to the end of a sentence.');
arc('after_the_shield', 'small',
  'It is not dramatic and that is what makes it intolerable. Reading is fine. Reading twice is fine. Reading twice and then being asked a question about the first time is not, and the lunch hall at one o\'clock is a wall of noise she has sat in happily for a year.',
  'Ashai could read a passage, then read it again. Asked about the first reading, she lost the thread. At one o’clock the MI6 lunch hall became a wall of noise she could no longer sit comfortably inside.');

export function worldEditorial(event) {
  if (event?.visibility !== 'public' || typeof event.publicDescription !== 'string'
    || typeof event.id !== 'string' || !event.id || !Number.isSafeInteger(event.occurredAt)) return null;
  const p = event.payload ?? {};
  const key = event.type === 'MOMENT_NOTICED' ? p.moment
    : event.type === 'ARC_BEAT' ? `${p.arcId}:${p.stage}`
      : ['UNEASE', 'INCIDENT', 'AFTERMATH'].includes(event.type) ? p.kind : '';
  const rule = rules.get(`${event.type}|${key}|${event.publicDescription}`);
  if (!rule || (rule.location && event.location !== rule.location)
    || (rule.cast && (event.participants?.length !== rule.cast.length
      || !rule.cast.every(who => event.participants.includes(who))))) return null;
  if (event.type === 'ARC_BEAT' && (typeof p.arcInstanceId !== 'string' || !p.arcInstanceId)) return null;
  // Old caches can repeat the same authored paragraph in both fields. Correct
  // that duplicate together; never overwrite an unrelated accepted performance.
  return { description: rule.description,
    ...(event.prose === event.publicDescription ? { prose: rule.description } : {}) };
}
