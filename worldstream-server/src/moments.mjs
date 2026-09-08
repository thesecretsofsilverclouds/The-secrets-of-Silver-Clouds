import { createHash } from 'node:crypto';

// One moment, every window it reaches.
//
// The note this answers, and it is now the standard the rest of the world gets
// audited against: "scenes need to make sense and it's a shared world. Not
// isolated feeds. The language needs to be less vague."
//
// The failure it replaces was a feed that reported the Chimes ringing over New
// Big Ben and, in the next item, Rose working on "the ending of the repeated
// rhythm" — two events, no relation, and the second one made of abstract nouns
// with no object in them. Same minute, same city, two separate newspapers.
//
// Three rules come out of that, and they apply to anything written here:
//
//   1. Name the place and the work. Not "at Sanctuary, working"; "up in the
//      quiet end of the central hub, cutting the second verse down".
//   2. Give it one physical detail that stops. A stylus stalling, an eye
//      opening, a hand going flat on a drum kit. The interruption is the scene.
//   3. Everybody sees the *same* thing. A moment has a `sight` — for the Chimes
//      it is motes shaped like musical notes going up across the sky — and each
//      vantage point reaches for that same image from where it happens to be
//      standing. That shared image is the difference between one world and four
//      feeds that happen to share a timestamp.
//
// Guardians count as vantage points. Kai and Greah are ever-presents [M25,
// M62], they are attached rather than placed, and letting them react is free
// characterisation: Greah at the window is doing something Ashai is not.
//
// Rail, unchanged from every other ambient scene: lines and nothing else. No
// fact, no memory, no plan, no relationship, no change of what anybody is doing.
// Somebody looked up.

export const MOMENT_EVENT_TYPE = 'MOMENT_NOTICED';

const hash = value => createHash('sha256').update(value).digest().readUInt32BE(0);

// What the moment looks like, so every window describes one event.
export const MOMENT_SIGHTS = Object.freeze({
  chimes_pulse: 'motes shaped like musical notes, going up across the sky',
  arcane_surge: 'the corridor light running the length of the river',
  veil_notice: 'the Church lanterns going up along the embankment',
  storm_breaks: 'the whole front coming up the river in one wall',
  order_procession: 'Order colours moving along the embankment',
});

// The coarse shape of what somebody is doing, because a bell means one thing to
// a woman sitting still with her eyes shut and another to a man mid-set on a
// wet yard. Anything unlisted falls to `default`, which is written to work.
const CLASSES = Object.freeze({
  sleeping: 'sleeping', resting: 'resting', quiet_break: 'resting',
  training: 'training', playing_piano: 'piano', listening_to_music: 'piano',
  eating: 'eating', gaming: 'play', watching_television: 'play',
});
export const classOf = activity => CLASSES[activity] ?? 'default';

// Goaden and Ashai, from inside whatever they were doing at the time.
const LEADS = Object.freeze({
  chimes_pulse: {
    resting: {
      ashai: 'Ashai was sitting with her eyes shut in the quarters, which is the closest she gets to being off duty. The Chimes came over the barracks in one long sheet of sound and she opened one eye, and only one. Greah was already at the window, lit up about it, watching the notes climb over London as though the city had done it for her.',
      goaden: 'Goaden had stopped for half an hour and was not thinking about anything in particular. The Chimes went through the building. He did not move, but Kai lifted his head off his shoulder and tracked the motes across the window until the last of them was gone.',
    },
    training: {
      ashai: 'Ashai was on the yard when the Chimes came over the wall. She finished the movement, because she always finishes the movement, and then stood in the middle of the ground with her head back watching the notes go up. Greah drifted out to join her and neither of them said anything.',
      goaden: 'The Chimes caught Goaden mid-set. He held the position a beat too long, looking up at the motes coming over the roofline, then swore quietly at himself and started the set again from the top.',
    },
    piano: {
      goaden: 'Goaden was at the piano when New Big Ben went through the building, and for about four bars the two of them were in the same key. He noticed. He stopped, listened to the rest of it with his hands still on the keys, and Kai did not stir at all.',
      ashai: 'Ashai had something playing quietly in the quarters and the Chimes went straight over the top of it. She turned her own music off rather than compete, and sat listening to the bigger sound until it let go of the building.',
    },
    default: {
      ashai: 'The Chimes reached the barracks and everything with a window in it stopped for a moment. Ashai went to hers. The notes were already high over the river by then, thinning out the way they do, and Greah was on the sill ahead of her.',
      goaden: 'The Chimes came over MI6 and Goaden did what he always does, which is carry on and pretend he has not noticed. Kai gave him away by staring out of the window for the whole of it.',
    },
    sleeping: {
      ashai: 'The Chimes went over the barracks and did not wake Ashai. Greah woke, went to the window, and watched the whole thing on her behalf.',
      goaden: 'Goaden slept through the Chimes entirely. Kai did not, and spent the duration sitting up on the end of the bed with his head on one side.',
    },
  },
  arcane_surge: {
    default: {
      ashai: 'The pull went through the barracks and Ashai felt it in her teeth before she heard anybody shout about it. She was at the window in three steps. The corridor light was running the whole length of the river, and Greah had gone very still on her shoulder.',
      goaden: 'Goaden was out of the lunch hall before the second tone. Whatever it is that answers a surge in him answered this one, and Kai came off his shoulder into the air over the corridor with his scales up.',
    },
    sleeping: {
      ashai: 'It woke her. Ashai lay still in the dark with the light off the corridor coming through the blind, working out from the colour of it how bad this one was.',
      goaden: 'The surge got him out of bed and half into a jacket before he was properly awake. Kai was at the door first.',
    },
  },
  storm_breaks: {
    training: {
      ashai: 'The storm caught Ashai on the yard with half a set left, and she finished the half. By the end of it the ground was running and her hair was flat to her head and Greah had given up entirely and gone in. Ashai came in last, dripping, extremely pleased with herself.',
      goaden: 'Goaden was outdoors when it broke and stayed outdoors, on the grounds that he was already wet. Kai did not share the reasoning and watched the rest of the set from a doorway.',
    },
    resting: {
      ashai: 'The rain arrived on the quarters window all at once, like something thrown. Ashai opened her eyes, established that it was only weather, and shut them again. Greah spent the entire storm on the sill with her nose almost touching the glass.',
      goaden: 'It came down hard enough to wake him. Goaden lay listening to it hit the window for a while, which is the most restful thing he has done all week, and Kai did not stir.',
    },
    default: {
      ashai: 'The storm came up the river and hit the barracks broadside. Ashai went to the corridor window with half the day shift and watched the yard turn into a lake. Greah was on the sill, lit up, absolutely delighted by the whole business.',
      goaden: 'The rain arrived and the building filled with the noise of it. Goaden carried on with what he was doing and let it. Kai relocated to somewhere further from the window without comment.',
    },
  },
  order_procession: {
    default: {
      ashai: 'The Order went along the embankment and MI6 watched them go from every window on that side. Ashai stood with the others and did not say anything. Greah stayed on her shoulder rather than the sill, which she does not usually do.',
      goaden: 'Order colours on the far bank of the river, watched the length of the MI6 corridor windows, moving with purpose and not toward anybody. Goaden watched the whole procession past without changing expression once, which took some doing. Kai\'s scales stayed up the entire time.',
    },
    training: {
      ashai: 'Ashai was on the yard when word went round, and finished the set facing the wall rather than the river, which she would tell you was about the light.',
      goaden: 'Goaden stopped mid-set, listened to somebody shout the news across the yard, and started the set again from the top. Faster.',
    },
  },
  veil_notice: {
    default: {
      ashai: 'The Church lanterns went up along the embankment while Ashai was at the window, which meant the Veil dates were real now and not just talk in the lunch hall. She counted the weeks on her fingers, twice, and got a different answer the second time.',
      goaden: 'Word of the Veil dates reached MI6 and the lanterns went up along the river to make it official. Goaden looked at them for a while. Whatever he was thinking about, it was not the festival.',
    },
  },
});

/** Whether this pair member has an authored beat for the moment they are in. */
export function leadMomentLine({ moment, who, activity, seed = '', key = '' }) {
  const bank = LEADS[moment];
  if (!bank) return null;
  const byClass = bank[classOf(activity)] ?? bank.default;
  const line = byClass?.[who] ?? bank.default?.[who] ?? null;
  // Seeded for shape rather than choice — one authored line per person per
  // class, so the hash is here only to keep the signature honest if a bank
  // later grows a second option.
  return Array.isArray(line) ? line[hash(`${seed}|moment|${key}`) % line.length] : line;
}

export const ALL_MOMENT_TEXT = Object.freeze(Object.values(LEADS)
  .flatMap(byClass => Object.values(byClass).flatMap(byWho => Object.values(byWho)))
  .flat());
