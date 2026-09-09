// Literary staging of the creator's recorded scene directions. These become
// part of the authored action before it is committed, never inferred by readers.
const names = { goaden:'Goaden', ashai:'Ashai', yukon:'Yukon', davis:'Davis', henderson:'Henderson',
  emily:'Emily', greah:'Greah', sprite_orange:'The first sprite', sprite_shades:'The second sprite',
  syndicate_man:'The man', inspector:'The inspector' };
const p = (text, who) => ({ kind:'prose', text, ...(who ? {who} : {}) });
const physical = {
  'rolling his shoulder': n => `${n} rolled his shoulder.`,
  'already circling': n => `${n} was already circling.`,
  'from the floor, still a dog': () => 'Yukon was still a dog, still on the floor.',
  'winded': () => 'Yukon dragged a breath into his lungs.',
  'not out of breath': () => 'Ashai was not even out of breath.',
  'turning her cup': () => 'Ashai turned her cup between her hands.',
  'closing the lid': () => 'Goaden closed the piano lid.',
  'writing it down anyway': () => 'Henderson wrote it down anyway.',
  'passing, not stopping': () => 'Davis spoke as she passed, without stopping.',
  'not moving': n => `${n} did not move.`,
  'not breaking': () => 'Yukon held the impersonation.',
  'pulling the blanket back over his head': () => 'Goaden pulled the blanket back over his head.',
  'still running': () => 'Yukon kept running.',
  'through the door': () => 'Ashai answered through the door.',
  'not looking up': n => `${n} did not look up.`,
  'without looking up': n => `${n} did not look up.`,
  'to her tea': () => 'Ashai addressed her tea.',
  'already leaving': () => 'Henderson was already leaving.',
  'sitting on the other chair': () => 'Ashai sat on the other chair.',
  'catching a jar mid-air': () => 'Ashai caught a jar in mid-air.',
  'from the floor, with enormous dignity': () => 'The first sprite spoke from the floor with enormous dignity.',
  'setting the jar down': () => 'Ashai set the jar down.',
  'not stopping': n => `${n} kept walking.`,
  'scrambling to keep up': () => 'The sprite scrambled to keep up.',
  'deflating': () => 'The sprite seemed to shrink.',
  'in ragged unison': () => 'The sprites answered together, badly.',
  'righting the stall': () => 'Ashai righted the stall.',
  'settling': () => 'Greah settled on Ashai’s shoulder.',
  'perfectly still': () => 'Emily held perfectly still.',
  'setting it down': () => 'Davis put the notice down.',
  'passing': () => 'Ashai was passing them as she spoke.',
  'mid-round': () => 'Goaden opened his mouth in the middle of the round.',
  'putting him down': () => 'Ashai put him on the floor.',
  'from the floor': () => 'Goaden looked up from the floor.',
  'already grey and small and four-legged': () => 'Yukon was already small and four-legged. His skin stayed grey; his pointed ears gave him away.',
  'instantly, furiously focused': () => 'Yukon’s attention snapped back to the game.',
  'the chains keep moving': () => 'The swing chains kept moving.',
  'sitting down on the grass, at a distance': () => 'Ashai sat on the grass, leaving a little distance between them.',
  'eating, unbothered': () => 'Emily kept eating, unbothered.',
  'still watching': () => 'Ashai kept watching.',
  'rewinding': () => 'Davis rewound the recording.',
  'walking on': n => `${n} walked on.`,
  'stopping': () => 'Ashai stopped.',
  'sitting down anyway': () => 'Goaden sat beside him anyway.',
  'collecting her jacket': () => 'Davis collected her jacket.',
  'arriving, taking it in': () => 'Ashai took in the machine and the flood of snacks at her feet.',
  'already reaching for the tin': () => 'Goaden was already reaching for the tin.',
  'from under the chair': () => 'Yukon’s shout came from under the chair.',
  'following, delighted, at volume': () => 'Yukon followed, delighted, getting louder.',
  'instantly quieter, entirely conspiratorial': () => 'Yukon lowered his voice at once and leaned closer.',
  'not looking at it': () => 'Goaden did not look at the filing cabinet.',
  'after the dust': () => 'The dust began to settle.',
  'returning to work': () => 'Davis turned back to her work.',
  'sliding the photograph over': () => 'The man slid the photograph towards Goaden.',
  'pushing the photograph back': () => 'Goaden pushed the photograph back.',
  'a long pause': () => 'Ashai looked at the sleeping creature for a long time.',
  'a beat too long': () => 'Davis left the pause a little too long.',
  'waiting': () => 'The inspector waited.',
};
const delivery = { 'eventually, evenly':'evenly', delighted:'with delight', brightly:'brightly', mildly:'mildly',
  booming:'at full volume', 'to nobody, cheerfully':'cheerfully, to nobody in particular', low:'quietly',
  reverently:'reverently', evenly:'evenly', quietly:'quietly', 'to nobody, quietly':'quietly, to nobody' };
const timed = new Set(['eventually','after a while','after a moment','beat']);

// Exact scene directions, in their original order. Dialogue keeps its own
// tense; these replacements describe only the action already in that scene.
const ordinaryNarration = {
  B6: ['Neither spoke. Davis raised the bar. Ashai matched it. Davis raised it again.'],
  C1: ['Ashai put him down twice. The third time he stayed up.'],
  C2: ['Yukon went down hard and came up two feet shorter and considerably faster. His skin stayed grey and his ears stayed pointed.'],
  C3: ['Ashai’s hand did not go to Thyia. Both of them noticed.'],
  C6: ['Yukon skidded, recovered as something four-legged, and skidded again.'],
  C7: ['Goaden and Yukon took her together. It went badly for them.'],
  C9: ['The small dragon landed on Goaden’s shoulder in the middle of the round and refused to move.',
    'Kai yawned, letting out silver smoke. Goaden conceded with the worst grace available.'],
  D1: ['The perimeter alarm cut through the building. Every conversation stopped.',
    'They waited. The alarm stopped. The silence afterwards was worse than the noise.'],
  D5: ['Neither of them said anything else about it.'],
  F1: ['Goaden woke because something was standing in his doorway. It was Emily’s shape. It was also grey, with pointy ears.'],
  F2: ['Goaden chased him. Yukon ran backwards, becoming a grey, pointy-eared Goaden.',
    'Ashai’s door opened. She took in one furious agent, half dressed, and one grey Goaden running backwards. She closed the door.'],
  F4: ['The lights were out. Yukon contorted upward into Davis’s prim posture — grey, pointy-eared, and unmistakably her.',
    'He did not get to the end. He never got to the end.'],
  F5: ['Something very large, very grey and long extinct stood on the training floor with pointy ears.'],
  F6: ['Ashai came in. A grey dog with pointy ears was on the good chair.',
    'The dog did not move.', 'The dog’s ears went flat, which did not help, and everyone involved knew it.'],
  G1: ['Four sprites in patchwork motley traded barbs with a stallholder. One gestured grandly. Knobbly legs tangled. Two went down, then a third, on principle.'],
  G5: ['A stall lay on its side. The sprites had formed a line and were all looking somewhere else with tremendous concentration.',
    'Then an apple was put down, very slowly.'],
  H1: ['A lintel drifted in over the gardens, got one good look at the traffic, and turned around.'],
  H2: ['It began to rain, gently. Within a minute there were four lintels over the yard.'],
  H3: ['A lintel had settled on Emily’s head and showed no sign of moving.'],
  H4: ['Something four-legged and made of weather went over the chimneys, leaving a trail of mist.'],
  H7: ['It had followed Yukon for three days. It would not follow anyone else.'],
  I8: ['Six squirrels stood in a line, all facing the same way.',
    'He came back thirty seconds later at a flat sprint, pursued.'],
  J2: ['Ashai found her on the swing. The chains were moving. Emily was not pushing.',
    'After a while the chains slowed. After a longer while Emily said her own name, as though checking it still fitted.'],
  K1: ['They heard it before they saw it: metal links, rhythmic and unhurried, from the dark end of the gardens where the swing was.',
    'They went the long way round. Neither mentioned it afterwards.'],
  L1: ['The Church lanterns came on down the length of the plaza. Everything under them looked slightly further away than it was.',
    'He looked. She was right.'],
  L3: ['Armoured figures stood shoulder to shoulder around an empty stall.'],
  L4: ['They kept walking. Behind them, whatever it was, made no move to follow.'],
  L5: ['The scanners were lit along the Thames corridor. Neither of them could see anything at all.'],
  M3: ['Kai woke, lifted his head, and stared at the doorway. He did not growl. He did not smoke. He simply looked, without blinking, for four minutes.',
    'Goaden watched the doorway with him and saw nothing the entire time.'],
  N1: ['Neither of them said anything for a full minute. It was not uncomfortable. It was just long, and both of them noticed it being long, and neither mentioned it.'],
  N4: ['Emily counted the bell strikes. There were the right number. She counted them again from memory and got the same number, and was disappointed.'],
  N5: ['The second chair came out at the usual hour. Ashai took it. Neither of them said anything over a cold cup, and it was the best part of her week.'],
  N7: ['They finished and sat on the floor with their backs to the wall, breathing. Kai came down and settled between them. Neither of them moved him.'],
};

const nimbusNarration = {
  P1: ["Goaden had been walking for ten minutes before he noticed his coat was heavier on one side, and warm, and purring like weather a long way off.",
    'He did not take the coat off. It was, after all, his coat.'],
  P4: ['The sprites had a plan, a target, and a vending machine. What they lacked was anybody who could open it.',
    'A shape made of weather settled onto the machine, considered the coin slot, and dispersed into vapour through a gap the width of a coin.'],
  P5: ['The machine opened. It kept opening. It opened in a way vending machines were not built to open, and everything inside came out at once, and went on coming out.',
    'The sprites fled. Nimbus sat in the middle of the avalanche looking extremely pleased.'],
  P7: ['A small sneeze. A very small one.',
    'Every loose object in the gaming room went anticlockwise around the room once and came back down roughly where it had started. A chair did not come back down where it had started.'],
  P10: ["Somebody’s containment ward discharged across the room. The bang was considerable. The effect was nil, because something had absorbed all of it and was now asleep on the filing cabinet, snoring like a distant front coming in."],
  P11: ['Ashai drew Thyia. Light gathered. Nimbus swallowed the entire thing before it arrived anywhere, sat with it for a moment, and burped it back at roughly four times the size, directly into the ceiling.'],
  P13: ['The man had a case, a permit that did not quite work, and a photograph of something made of cloud.',
    'Inside Goaden’s coat, the temperature dropped several degrees.'],
  P14: ['Two men came over the parapet with a net and something that hummed.',
    'They were met by a silhouette four storeys high, made entirely of storm, standing between them and the stairwell door.',
    'They went back over the parapet.'],
  P19: ['The inspector looked at the saucer for a long moment. The saucer, being a saucer, declined to comment.'],
  P20: ['They sat. Something warm and made of weather resettled between them.'],
  P21: ['Nimbus approached her the way he approached everyone, which was directly and with enormous confidence.',
    'Emily looked at him. He stopped.',
    'She held out one hand, palm up, empty. He considered it for a long moment, then put his head under it, and stayed there.'],
};

export function polishSceneBeats(id, source) {
  let narrationIndex = 0;
  const narration = ordinaryNarration[id] ?? nimbusNarration[id];
  const result = [];
  for (const original of source) {
    let beat = {...original};
    if (beat.kind === 'prose' && narration?.[narrationIndex])
      beat.text = narration[narrationIndex++];
    if (id === 'P6' && beat.text === "It's been four hours.") beat.text = 'It wants feeding.';
    if (id === 'P6' && beat.text.startsWith('The air pressure'))
      beat.text = 'The air pressure in the room dropped. Somewhere below them a door banged shut in its frame.';
    if (id === 'H3') beat.text = beat.text.replace('It has been there four minutes.', 'It has been there a while.');
    if (id === 'N6' && beat.who === 'goaden' && beat.text.startsWith("You've not said anything"))
      beat.text = "You've gone quiet.";
    if (id === 'N6' && beat.text.includes('They watch the screen.')) {
      beat.text = 'Right.';
      beat.after = 'They watched the screen. Goaden did not ask again.';
    }
    if (id === 'I7' && beat.text === 'Pause.') beat.text = 'Goaden waited. Emily offered nothing further.';
    // The action between Ashai’s two attempts to finish this sentence matters.
    if (id === 'P16' && beat.who === 'ashai' && beat.text.includes('— —')) {
      result.push({...beat,text:"It sleeps in the coat. That's not ownership, that's —",directions:undefined},
        p('Ashai gave up.', 'ashai'), {...beat,text:"It's a coat it likes.",directions:undefined});
      continue;
    }
    for (const raw of beat.directions ?? []) {
      const direction = raw.replace(/\s+/g,' ').trim(), name = names[beat.who] ?? beat.who;
      if (physical[direction]) result.push(p(physical[direction](name),beat.who));
      else if (delivery[direction]) beat.delivery = delivery[direction];
      else if (timed.has(direction)) beat.delivery ??= 'after a pause';
    }
    delete beat.directions;
    const after = beat.after; delete beat.after;
    result.push(beat);
    if (after) result.push(p(after));
  }
  return result;
}
