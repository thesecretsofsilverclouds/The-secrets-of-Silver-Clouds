// Authored background cast and ordinary cameos. The creator subsequently
// approved bounded supporting commitments: faction-agendas.mjs now owns the
// Davis/Zara work reservations and explicitly acquired knowledge. A cameo
// checks those reservations and cannot double-book somebody at another scene.
// This catalog itself grants no new authority, abilities or future secrets.
//
// Whisper is deliberately absent despite sharing the gaming area with Yukon. He
// sits behind the same spoiler embargo as the basement and the Grimoire, and a
// world that cannot say his name cannot accidentally start his story.
export const SIDE_CHARACTERS = Object.freeze({
  // "That's Yukon and Whisper. Yukon joined after a rather... creative bank
  // heist. His Onari heritage lets him shape-shift" [M65]. Already the stated
  // cause of this world's gaming nights since v9; this gives him a room.
  yukon:{name:'Yukon',role:'special unit',page:65,attachedTo:null,
    areas:['gaming_room','common_room'],dayparts:['midday','evening','night'],
    lines:['Yukon had the gaming area to himself and was losing loudly to it.',
      'Yukon was in the gaming area running the same level again, angrier and no faster.',
      'Yukon claimed the good chair in the gaming area before either of them reached it.']},
  // "Cliff Henderson, MI6 General" [M53], who leads them through the barracks
  // himself [M63]. The engine has had him walking the corridors since v6.
  henderson:{name:'General Henderson',role:'MI6 General',page:53,attachedTo:null,
    plates:['idle','waiting'],
    areas:['corridors','common_room','briefing_room'],dayparts:['morning','midday','evening'],
    lines:['General Henderson came through on his rounds and did not stop.',
      'General Henderson was in the corridor with two captains and a folder nobody looked at twice.',
      'General Henderson passed the lunch hall, looked in, and carried on.']},
  // "it was here, amidst the clandestine walls, that she first encountered
  // agent Davis" — the long blonde pigtail braid, the smile carrying "both
  // warmth and calculation", and the conversation Ashai later overhears
  // [M86–M89]. The engine never replays that scene. It only knows that the two
  // of them have history and that passing her is not a neutral event.
  davis:{name:'Agent Davis',role:'MI6 agent',page:86,attachedTo:null,
    plates:['idle','closeup'],
    areas:['corridors','ops_room','common_room'],dayparts:['morning','midday','evening'],
    lines:['Agent Davis passed them in the corridor and did not slow down.',
      'Agent Davis was at a screen in the operations room and did not look up.',
      'Agent Davis said something to the agent beside her as they went by, and laughed at it.']},
  // "Your Captain, Kartel Hammond" — an alchemist who "took a vow of silence
  // after the Alchemical society's fall", found alone at a corner table [M66].
  // The safest side character this world could have: his canon behaviour is
  // saying nothing at all.
  kartel:{name:'Captain Hammond',role:'captain, special unit',page:66,attachedTo:null,
    areas:['common_room','briefing_room'],dayparts:['morning','midday','evening','night'],
    lines:['Captain Hammond was at the corner table, and said nothing, which is what he does.',
      'Captain Hammond had the corner table and a cold cup he had not touched.',
      'Captain Hammond looked up as they came in, and back down again.']},
  // "his Guardian, Kai. The small dragon" [M25], who rides Goaden's shoulder
  // throughout. An ever-present, so he is never met — only noticed.
  kai:{name:'Kai',role:"Goaden's Guardian",page:25,attachedTo:'goaden',
    areas:null,dayparts:['morning','midday','evening','night'],
    lines:['Kai stayed on his shoulder for the whole of it.',
      'Kai had found the warm end of the room an hour before either of them did.',
      'Kai yawned at the ceiling and went back to sleep.']},
  // "her Guardian, Greah, fluttered near, her soft glow a comforting" [M69],
  // and "an ever-present" who "kept watch with a solemn vow" [M62].
  greah:{name:'Greah',role:"Ashai's Guardian",page:69,attachedTo:'ashai',
    areas:null,dayparts:['morning','midday','evening','night'],
    lines:['Greah kept close, glowing faintly, and let it be.',
      'Greah settled on the back of the chair and stayed there.',
      'Greah did a slow circuit of the room and came back unimpressed.']},
});
export const SIDE_CHARACTER_IDS = Object.freeze(Object.keys(SIDE_CHARACTERS));

// The Legion are a second kind of side character, and the difference is the
// whole point of keeping them in their own map: **these ones speak.**
//
// Everybody above is observed and silent, because MI6 colleagues acting would
// be the world inventing third-party acts. The Legion are not colleagues. They
// are Goaden's old crew and his old band, and by an explicit author decision
// this world sits after their reunion at the Sanctuary [M228-230] — the duel
// staged as a gig, the VIP ticket, "welcome home brother". The betrayal the
// warehouse scene carries at [M102] is spent by then. So they are simply his
// mates, and mates talk.
//
// What has not changed is the rail underneath. A Legion scene is lines and
// nothing else: it creates no fact, teaches nobody anything, moves no plan and
// leaves no memory, exactly like every Goaden and Ashai conversation since v10.
// They can be in the room and take the piss. They cannot change the world.
//
// Truth and the Dread Twins are deliberately absent from the plate list: they
// are canon and they are named in the banter, but no art exists for them, and a
// written line must never ask for a plate the world does not own.
export const LEGION_CAST = Object.freeze({
  // "Perched atop an aged drum set sat Rose, fiery strands of hair framing her
  // face", holding a conversation with a bird [M101]. At the reunion she gives
  // the whole thing "the barest approving nod" [M229]. Says least, lands most.
  rose:{name:'Rose',role:'Demon\'s Legion',page:101,
    plates:['idle','annoyed','cheeky','happy','intense','observation','sad']},
  // The drummer, and the hype man who vaults his own kit shouting "OHHH SHIT!!"
  // [M228]. Soul-bonded to Balthazar since the Celestial Shattering [M99-100].
  anarchy:{name:'Anarchy',role:'Demon\'s Legion',page:99,
    plates:['idle','curious','grin','intense','smirk','surprised']},
  // The Demon on the other end of that bond, "a vision of chaos and beauty"
  // [M100]. Ancient, and obliged to be present for very small human problems.
  balthazar:{name:'Balthazar',role:'bonded Demon',page:99,
    plates:['idle','smirk','smolder','smolder2']},
  // Blood wings, blond, short, and the Legion's rapper [M100]. Third strongest
  // behind Goaden and Truth, which he cannot let go of — at the reunion he is
  // "alone scowling amidst the bedlam" and spits and spins away [M229].
  gabriel:{name:'Gabriel',role:'Demon\'s Legion',page:100,
    plates:['annoyed','frown','humble','impressed','laughing','showing-off','surprised','thinking']},
  // "Truth's initiation as leader" [M103] — the Legion vote him in after Goaden
  // leaves, and at the reunion he hands over the mic and then tells Goaden to
  // clear off, warmly [M229]. Booming, profane, generous. He calls Goaden
  // "Reever" and nobody else does.
  truth:{name:'Truth',role:"Demon's Legion, leader",page:102,
    plates:['annoyed','disgust','laughing','shock','stern','idle']},
  // "I'll bet my favourite bass we see some fuck up" [M813], and the icy look
  // he gives Gabriel for talking about Rose [M828]. One of the Dread Twins,
  // who navigate a laser grid like dancers [M840]. Dry where Gabriel is loud.
  damien:{name:'Damien',role:"Demon's Legion, Dread Twins",page:99,
    plates:['idle']},
});
// Two more, on their own terms — neither of them a friend of the house.
//
// Emily is in the manuscript long before the checkpoint [M90] and needs no
// permission; she is simply not on anybody's side. Eleven years old, walked
// home by a man who meant her harm, and she killed him with his own shadow and
// gave her name "with sunny indifference" [M93]. She is written cheerful, and
// that is the most unsettling thing about her.
//
// Zara is an author decision and is recorded in ANCHORS the way the Legion
// reunion was. The manuscript introduces her at [M362], well past the
// checkpoint; the ruling is that the pair have worked alongside her before
// then as an MI6 liaison. That is a smaller claim than the book's own
// introduction of her and touches nothing the book needs later.
export const OUTSIDE_CAST = Object.freeze({
  // Written from the text rather than from a summary of it: she speaks in
  // fragments, repeats the last thing she said, and trails off — "No Emily
  // here... not here... who's Emily? Leave... go." [M155] and "Ok... friend...
  // let's play... let's play..." [M158]. Bare feet, raven hair over the eyes,
  // a grey teddy-bear bag. She reads people, and shadow does what she wants.
  // None of that is ever stated by this world; it is only what the cadence is
  // made of.
  emily:{name:'Emily',role:'Emily Grimm',page:90,friendly:false,
    plates:['annoyed','curious','laughing','leans-in-sad','mocking','sad','thinking']},
  zara:{name:'Zara',role:'MI6 liaison',page:362,byAuthorDecision:true,friendly:true,
    plates:['angry','happy','idle','sad','shocked','smile','smiling']},
});
// The two creatures London has instead of pigeons, and the only members of the
// cast who are never sent anywhere. A guest is booked: Zara has a shift, Truth
// has somewhere else to be, and the world checks. Street fauna are simply
// already there, so they are held apart from the guest rosters and merged into
// a venue's availability rather than into its invitations.
//
// Lintels are canon from [P00040] — "cloud-like creatures, attracted to the
// natural magic still lingering in the rural air" — and by [P02734] Ashai is
// watching them feed off the ambient energy over magic-infused London
// buildings. They drift, they graze, and they do not speak; their plates carry
// captions rather than dialogue.
//
// Road sprites are "the ingenious scavengers of the city" [P02157], skin
// "textured like weathered street posters", who move "with a rhythmic cadence
// that mirrored the distant hum of traffic" and trade playful barbs [P02147].
// They are a band, not a species obligation: these four are individuals, and
// nothing written for one of them establishes a rule for the rest.
export const STREET_FAUNA = Object.freeze({
  // Named the way the crew already names them — for the thing you see first.
  sprite_orange:{name:'Orange',role:'road sprite',page:336,speaks:true,
    plates:['idle','asleep']},
  sprite_shades:{name:'Shades',role:'road sprite',page:336,speaks:true,
    plates:['idle','asleep']},
  sprite_purple:{name:'Purple',role:'road sprite',page:336,speaks:true,
    plates:['idle']},
  sprite_blue:{name:'Blue',role:'road sprite',page:336,speaks:true,
    plates:['idle']},
  // One entry, because a lintel is a lintel. The four plates are four moments
  // of the same drifting animal, not four characters.
  lintel:{name:'The lintel',role:'lintel',page:6,speaks:false,
    plates:['idle','curious','bright','content']},
});
export const STREET_FAUNA_IDS = Object.freeze(Object.keys(STREET_FAUNA));
export const OUTSIDE_IDS = Object.freeze(Object.keys(OUTSIDE_CAST));
export const LEGION_IDS = Object.freeze(Object.keys(LEGION_CAST));
// Named in the banter, canon, and never on screen for want of art.
// Named in the banter and still without portrait art of their own.
export const LEGION_OFFSCREEN = Object.freeze(['Marley']);
// The names a presentation layer is allowed to say out loud. Anything outside
// this set appearing in generated prose is a hallucinated person, and the
// vignette carrying it is rejected rather than shown.
export const NAMEABLE = Object.freeze(['Goaden','Ashai','Goaden Reeves','Ashai Bennet',
  // Truth calls him "Reever" at the reunion [M229], so the prose layer must not
  // report his own crew's name for him as an invented person.
  'Reever',
  ...SIDE_CHARACTER_IDS.map(id=>SIDE_CHARACTERS[id].name),
  ...LEGION_IDS.map(id=>LEGION_CAST[id].name), ...LEGION_OFFSCREEN,
  ...OUTSIDE_IDS.map(id=>OUTSIDE_CAST[id].name), 'Emily Grimm',
  ...STREET_FAUNA_IDS.map(id=>STREET_FAUNA[id].name), 'road sprite', 'road sprites', 'lintel', 'lintels',
  "Demon's Legion", 'Legion', 'Celestial Shattering',
  // And the bare surname of anybody whose name carries a rank, because prose
  // that has already said "Agent Davis" once will reasonably say "Davis" the
  // second time, and that is not an invented person.
  ...SIDE_CHARACTER_IDS.map(id=>SIDE_CHARACTERS[id].name.split(' ').at(-1))]);
// Who can plausibly be in this room at this hour. A Guardian is attached to one
// of the pair rather than to a room, so it is never "met" anywhere — it is
// wherever its own character already is.
export function presentableIn(area,part) {
  return SIDE_CHARACTER_IDS.filter(id=>{const who=SIDE_CHARACTERS[id];
    return who.areas!==null && who.areas.includes(area) && who.dayparts.includes(part);});
}
export const guardianOf = actorId =>
  SIDE_CHARACTER_IDS.find(id=>SIDE_CHARACTERS[id].attachedTo===actorId) ?? null;
