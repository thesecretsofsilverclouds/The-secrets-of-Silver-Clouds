import { daypart, DAYPARTS } from './sky.mjs';

// A location was already more than one venue depending on the hour. It is also
// more than one room. MI6's barracks are canon: the pair are driven through
// "the large steel gates of MI6's barracks", a bastion "nicknamed 'The
// Armoured-dillo', comprised of eight interconnected sections living up to its
// namesake's protective shell" [M63]. The eight below are those sections, each
// one drawn from a place the manuscript actually walks through, so a subroom is
// a canon fact rather than a floor plan somebody invented for a simulator.
//
// `common_room` keeps its existing id. It is the lunch hall — "the buzzing
// lunch hall, filled with soldiers' banter, clinking cutlery, and yawning
// Guardians" [M64] — and renaming it would have rewritten every action, area
// and test that already refers to it for no gain in truth.
//
// The manuscript gives the count but never lists the eight, so the eight below
// are the places it actually walks through. One of them is the basement, which
// is why the count works out: the chained door with the warning signs is a
// section of the bastion like any other, and the only one nobody may open.
export const MI6_SECTIONS = Object.freeze({
  corridors:{name:'the MI6 corridors',page:63,indoors:true,social:true,
    permits:['unhurried_time','waiting'],dayparts:[...DAYPARTS]},
  common_room:{name:'the lunch hall',page:64,indoors:true,social:true,
    permits:['unhurried_time','eating','waiting','quiet_break','listening_to_music','gaming','watching_television'],dayparts:[...DAYPARTS]},
  quarters:{name:'the quarters',page:64,indoors:true,social:false,
    permits:['unhurried_time','resting','sleeping','quiet_break','on_call','listening_to_music','watching_television'],dayparts:[...DAYPARTS]},
  // Ashai finds a charm "on the training grounds" [M87]. Outdoors, so the
  // weather has somewhere real to bite.
  training:{name:'the training grounds',page:87,indoors:false,social:false,
    permits:['unhurried_time','training','clearing_training_ground'],dayparts:['morning','midday','evening']},
  music_room:{name:'the music room',page:68,indoors:true,social:false,
    permits:['unhurried_time','playing_piano','listening_to_music','quiet_break'],dayparts:['morning','midday','evening','night']},
  // Its canon name is the assembly room, where Goaden is summoned to the inner
  // circle briefing — "I suggest hastening to the assembly room" [M71]. The id
  // stays `briefing_room` because the schedule has been routing briefings to it
  // since v6; only the name a reader sees is the manuscript's.
  briefing_room:{name:'the assembly room',page:71,indoors:true,social:false,
    permits:['unhurried_time','in_a_briefing','on_call','waiting'],dayparts:[...DAYPARTS]},
  // "a room where surveillance screens buzzed and conversations were hushed
  // with quiet intensity" [M89]. A place to be called to, never a place to
  // research anything: it permits duty and waiting and nothing else.
  ops_room:{name:'the operations room',page:89,indoors:true,social:false,
    permits:['unhurried_time','in_a_briefing','on_call','waiting'],dayparts:[...DAYPARTS]},
  // The eighth. It permits nothing and is sealed besides, so it is a section
  // of the map that exists to be counted and refused.
  basement:{name:'the basement',page:63,indoors:true,social:false,
    permits:[],dayparts:[]},
});
// A zone is part of a section rather than a ninth one. The gaming area is
// "situated amidst the lively chaos at the rear" of the lunch hall [M64] — the
// sofas, the headsets and Yukon — so it is somewhere to be without being
// somewhere new.
export const MI6_ZONES = Object.freeze({
  // Creator-authorised scene-bank staging. These are ordinary accessible
  // zones; the sealed basement remains the inaccessible eighth section.
  reception:{name:'MI6 reception',indoors:true,social:true,within:'corridors',
    permits:['unhurried_time','waiting'],dayparts:[...DAYPARTS]},
  rooftop:{name:'the MI6 rooftop',indoors:false,social:true,within:'corridors',
    permits:['unhurried_time','waiting','quiet_break'],dayparts:[...DAYPARTS]},
  gaming_room:{name:'the gaming area',page:64,indoors:true,social:true,within:'common_room',
    permits:['unhurried_time','gaming','watching_television','listening_to_music','quiet_break'],dayparts:[...DAYPARTS]},
  // The covered half of the training section. This world has published "the
  // outdoor yard is closed; morning training moves indoors" on every sheltered
  // day since v6, and then trained in the yard anyway, because nothing checked
  // where training happened. Naming the indoor half is what makes that sentence
  // true: on a storm day the pair are demonstrably somewhere else.
  indoor_yard:{name:'the covered training floor',page:87,indoors:true,social:false,within:'training',
    permits:['unhurried_time','training','checking_training_ground'],dayparts:['morning','midday','evening']},
});
// The chained door with the warning signs [M63] and the Onari information room.
// Both exist to be refused: what is behind them sits on the far side of the
// knowledge and spoiler boundary. Modelling them as sealed sections rather
// than leaving them off the map means an action that ever tries to put
// somebody there fails loudly instead of quietly working.
export const SEALED_AREAS = Object.freeze(['basement', 'information_room']);

// Onari Village safe public areas and sealed archival storage.
// Early-unlocked as a home/faction location; later doll and parental revelations remain locked.
export const ONARI_VILLAGE_AREAS = Object.freeze({
  village_square: { name: 'the village square', indoors: false, social: true,
    permits: ['unhurried_time', 'waiting', 'eating'], dayparts: [...DAYPARTS] },
  market: { name: 'the village market', indoors: false, social: true,
    permits: ['unhurried_time', 'waiting'], dayparts: ['morning', 'midday', 'evening'] },
  communal_grounds: { name: 'the communal grounds', indoors: false, social: true,
    permits: ['unhurried_time', 'quiet_break'], dayparts: [...DAYPARTS] },
  life_tree_perimeter: { name: 'the Life Tree perimeter', indoors: false, social: false,
    permits: ['unhurried_time', 'quiet_break'], dayparts: [...DAYPARTS] },
  trails: { name: 'the village trails', indoors: false, social: false,
    permits: ['unhurried_time', 'walking_the_city', 'quiet_break'], dayparts: ['morning', 'midday', 'evening'] },
  // Archival room where manuscript parents/doll materials reside. Sealed before checkpoint.
  information_room: { name: 'the information room', indoors: true, social: false,
    permits: [], dayparts: [] },
});

// Sanctuary already named two of its own rooms in the venue phrasing this
// engine has published since v10 — the portal halls and the central hub.
export const SANCTUARY_AREAS = Object.freeze({
  portal_halls:{name:'the portal halls',indoors:true,social:true,
    permits:['unhurried_time','listening_to_music','quiet_break'],dayparts:['morning','midday','evening','night']},
  central_hub:{name:'the central hub',indoors:true,social:true,
    permits:['unhurried_time','listening_to_music','eating'],dayparts:['midday','evening','night']},
});
// Everywhere else is a single room, so the area layer stays out of the way. The
// id and the name are separate here for the same reason they are for the
// assembly room: the reducer has always routed these to `venue` and `transit`,
// while a reader wants to be told they are at a table rather than in an area
// called "venue".
const SINGLE = (id,name,permits,indoors=true) => ({[id]:{name,indoors,social:true,permits,dayparts:[...DAYPARTS]}});
export const AREAS_BY_LOCATION = Object.freeze({
  mi6:{...MI6_SECTIONS,...MI6_ZONES}, sanctuary:SANCTUARY_AREAS,
  // The Legion's warehouse [M99-M102]: a drum kit, a hole in the roof they call
  // the vibe, and Rose up on the kit with a pencil. Goaden and Ashai never
  // travel here — it is not a destination on anybody's afternoon — so it needs
  // a room and an opening time and nothing else.
  legion_hideout:SINGLE('venue','the warehouse floor',['unhurried_time','listening_to_music','quiet_break']),
  streamliner:SINGLE('transit','the carriage',['unhurried_time','travelling','listening_to_music','waiting']),
  enchanted_ink:SINGLE('venue','the parlour floor',['unhurried_time','visiting_enchanted_ink','getting_a_tattoo']),
  cafe:SINGLE('venue','a table',['unhurried_time','at_the_silver_spoon','eating']),
  // Open air, like the training ground — which matters, because it is the only
  // other place the weather can actually reach them.
  big_ben_plaza:{...SINGLE('venue','the plaza',['unhurried_time','walking_the_city'],false),
    gardens:{name:'the plaza gardens',indoors:false,social:false,
      permits:['unhurried_time','walking_the_city'],dayparts:[...DAYPARTS]}},
  onari_village: ONARI_VILLAGE_AREAS,
});
export const areaNames = location => Object.keys(AREAS_BY_LOCATION[location] ?? {});
// Where somebody stands when nothing has put them anywhere in particular. Until
// v13 this was the literal string 'common_room' everywhere, which quietly meant
// the pair were standing in an MI6 lunch hall while at a cafe or aboard the
// Streamliner. Nothing checked, so nothing complained.
export function defaultArea(location,atMs) {
  if(location==='mi6') return 'common_room';
  if(location==='streamliner') return 'transit';
  if(location==='onari_village') return 'village_square';
  if(location!=='sanctuary') return 'venue';
  // Sanctuary's own rooms open on the same clock its modes do: the hub is a
  // middle-of-the-day-onward room, the halls are open whenever it is.
  return ['midday','evening','night'].includes(daypart(atMs))?'central_hub':'portal_halls';
}
export const areaOf = (location,area) => AREAS_BY_LOCATION[location]?.[area] ?? null;
// Somewhere a written line can name without being wrong.
//
// The defect this exists to stop, caught on the live page: an authored line said
// "Goaden walked her as far as the lunch hall" while the event's own location
// read "The Silver Spoon Cafe", because the sentence had a room baked into it
// and the story it belonged to can happen in several. Anybody who can appear in
// more than one place has to be given the place rather than assume it.
//
// MI6 and the Sanctuary have real rooms worth naming; everywhere else is one
// room and the address is the useful part.
const PLACE_LABELS = Object.freeze({
  streamliner:'the carriage', enchanted_ink:'Enchanted Ink',
  cafe:'the Silver Spoon', big_ben_plaza:'the plaza', legion_hideout:'the Legion warehouse',
  onari_village:'the Onari village',
});
export function placePhrase(location,area) {
  if(location==='mi6'||location==='sanctuary'||location==='onari_village') return areaOf(location,area)?.name ?? PLACE_LABELS[location] ?? 'the barracks';
  return PLACE_LABELS[location] ?? areaOf(location,area)?.name ?? 'the borough';
}
// A room is a third gate under the two the world already applies. The venue's
// mode says what may happen at this address at this hour; the area says what
// may happen in this room at all. Both must agree, so "training in the music
// room" and "sleeping in the operations room" are unreachable rather than
// merely unscheduled.
export function permitsArea(location,area,label,atMs) {
  if(SEALED_AREAS.includes(area)) return false;
  const room=areaOf(location,area);
  if(!room) return false;
  if(!room.dayparts.includes(daypart(atMs))) return false;
  return room.permits.includes(label);
}
// Every section of the Armoured-dillo is interconnected [M63], so inside MI6
// anybody can reach anybody. Across addresses nobody can. Stating it rather
// than assuming it is what lets an encounter rule ask the question at all.
export const areasConnected = (location,from,to) =>
  Boolean(areaOf(location,from)) && Boolean(areaOf(location,to));

// What a character is doing that can be walked in on. Sleeping, training and
// standing a duty are not interruptible by somebody wandering past; the rest
// of ordinary downtime is.
export const INTERRUPTIBLE = Object.freeze(['unhurried_time','gaming','eating','waiting']);
// Why an encounter did not happen, in the world's own terms rather than one
// flat "no". The reducer publishes nothing from these; they exist so a skipped
// encounter records which rule refused it and a test can name the rule.
export const ENCOUNTER_REASONS = Object.freeze({
  travelling:'One of them is in transit',
  apart:'They are not at the same address',
  sealed:'That area cannot be entered',
  closed:'That area is not in use at this hour',
  unsociable:'That area is not a place people gather',
  busy:'One of them is doing something that cannot be interrupted',
  unreachable:'That area cannot be reached from where they are',
});
// The single question every encounter now asks. It replaced a check that only
// looked at the building and the activity, which let the pair "cross paths" in
// a room that was shut, or in a room neither of them could have walked to.
export function encounterEligibility(people,{location='mi6',area='common_room',atMs}={}) {
  const crew=Object.values(people);
  if(crew.some(who=>who.journey)) return {ok:false,reason:'travelling'};
  if(crew.some(who=>who.location!==location)) return {ok:false,reason:'apart'};
  if(SEALED_AREAS.includes(area)) return {ok:false,reason:'sealed'};
  const room=areaOf(location,area);
  if(!room) return {ok:false,reason:'unreachable'};
  if(!room.dayparts.includes(daypart(atMs))) return {ok:false,reason:'closed'};
  if(!room.social) return {ok:false,reason:'unsociable'};
  if(crew.some(who=>!INTERRUPTIBLE.includes(who.activity))) return {ok:false,reason:'busy'};
  if(crew.some(who=>!areasConnected(location,who.area,area))) return {ok:false,reason:'unreachable'};
  return {ok:true,reason:null};
}
