import { createHash } from 'node:crypto';
import { daypart } from './sky.mjs';
import { MINUTE_MS as MIN } from './time.mjs';
import { presentableIn, SIDE_CHARACTERS, LEGION_IDS } from './cast.mjs';
import { INTERRUPTIBLE, areaOf } from './places.mjs';

// A director, not a showrunner. It decides *when* a day has gone slack and
// *which family* of authored beat to spend on it. It does not write anything,
// does not improvise, and cannot reach for a beat that is not already written
// down below. Every input it reads is committed world state and every output is
// an ordinary scheduled action that goes through the same reducer, the same
// mode and daypart gates and the same canon assertion as the day's own plan.
//
// The rule it exists to implement, in the shape it was asked for:
//
//     if quiet_for > 90 min and tension < 0.25 and the world allows it:
//         schedule one low-stakes catalyst
//
// The two thresholds are doing opposite jobs and both matter. `quiet_for`
// answers "does this day need anything?" — a busy afternoon is left alone.
// `tension` answers "may I add anything?" — a day the city is already pressing
// on has its own shape, and dropping a catalyst into it would be the machine
// competing with the story instead of filling a silence.
export const BEAT_FAMILIES = Object.freeze(['interruption','invitation','minor_anomaly',
  'awkward_encounter','recall','weather_disruption','decompression','legion_visit']);
export const DIRECTOR_RULES = Object.freeze({
  quietMinutes:90,      // how long nothing may involve either of them
  maxTension:0.25,      // above this the world is carrying its own weight
  maxBeatsPerDay:2,     // a budget, so a slack day does not become a busy one
  minGapMinutes:180,    // and they cannot be spent back to back
  memory:3,             // families used this recently are not chosen again
  // The one rule the director shares with the scene bank. Each keeps its own
  // cadence and cooldowns; this is only a presentation window, so that two
  // substantial beats do not land on the page on top of each other. It defers.
  // It never restarts anybody's clock.
  spacingMinutes:20,
});
// Tension is read off the world, never stored. Institutional posture is most of
// it — an elevated MI6 or the Order working the boroughs is what "a tense day"
// means here — and what the pair are carrying supplies the rest. The weights
// sum to one at the top of every band, so the number is a real 0–1 and a
// threshold written against it means what it says.
const FACTION_WEIGHTS = Object.freeze({arcane:0.30,mi6:0.25,order:0.20});
const FACTION_SCALE = Object.freeze({
  arcane:{low:0,moderate:0.5,high:1}, mi6:{routine:0,briefings:0.5,elevated:1},
  order:{quiet:0,watchful:0.5,active_in_city:1},
});
const RELATION_WEIGHT = 0.25;
const clamp01 = value => Math.max(0,Math.min(1,value));
export function tensionOf({factions={},relationships=[]}={}) {
  let score=0;
  for(const [faction,weight] of Object.entries(FACTION_WEIGHTS))
    score+=weight*(FACTION_SCALE[faction][factions[faction]]??0);
  // The worst either of them feels, not the average: one person worried is a
  // tense day even when the other has not noticed yet.
  const felt=relationships.reduce((worst,r)=>Math.max(worst,(r.concern??0)/3,(r.irritation??0)/3),0);
  return clamp01(score+RELATION_WEIGHT*felt);
}
// How long the world has gone without doing anything to Goaden or Ashai.
// Institutional wallpaper deliberately does not count: an MEU bulletin nobody
// reads is not the world being eventful at them, and if it counted the feed
// would never be quiet enough for this to fire at all.
export const quietMinutes = (director,now) =>
  Math.floor((now-(director?.lastNotableAt??0))/MIN);

// What each family needs to be true before it can be chosen. These are the
// "world_state allows it" clause, written out one family at a time rather than
// as one shared guess. A family with no eligible reading is simply not in the
// draw that tick.
const ELIGIBILITY = Object.freeze({
  // Somebody is wanted on comms. Not on a day MI6 is already standing up — that
  // day has its own briefing and standby, and this would be noise on top.
  interruption:({part,factions,free})=>free&&factions.mi6!=='elevated'
    &&['morning','midday','evening'].includes(part),
  // A free table, a free machine, an afternoon with a hole in it. Never while a
  // plan is already accepted or running: the pair do not double-book.
  invitation:({part,free,arrangementPending})=>free&&!arrangementPending
    &&['midday','evening','night'].includes(part),
  // Only when the sky actually has something in it to notice.
  minor_anomaly:({part,factions,weather})=>part!=='small_hours'
    &&(factions.arcane!=='low'||['clear','fog'].includes(weather?.code)),
  // Somebody they know is in the room; the cast supplies whether that is true.
  // Note what this one does *not* require: the pair can be mid-anything and
  // still pass somebody. Being looked through does not need a free afternoon.
  awkward_encounter:({part,together,colleagues})=>together&&colleagues.length>0
    &&['morning','midday','evening'].includes(part),
  // The ordinary version of being called in, which is why it is barred on the
  // days the extraordinary version already exists.
  recall:({part,factions})=>factions.mi6!=='elevated'&&factions.arcane!=='high'
    &&['morning','midday','evening'].includes(part),
  // The weather has to be doing something, and there has to be somebody out in
  // it. Without that second clause this beat spent most of its firings closing
  // an empty yard: a published sentence with no consequence attached to it,
  // which is the definition of the wallpaper this director exists to avoid.
  // Requiring somebody outdoors means it is rarer and always bites.
  weather_disruption:({part,weather,outdoors})=>outdoors.length>0
    &&['heavy_rain','storm','fog'].includes(weather?.code)
    &&['morning','midday','evening'].includes(part),
  // The one that is always available, and the reason the director can never be
  // stuck: a quiet day is allowed to answer a quiet day.
  decompression:({part,free})=>free&&part!=='small_hours',
  // Goaden's old crew, round for an hour. Both of the pair have to be in and
  // free, because it is a scene rather than a passing sighting, and it wants an
  // hour that people socialise in. Barred while MI6 is standing up: the day the
  // building is on an elevated footing is not the day you sign four members of
  // the Demon's Legion into the lunch hall.
  legion_visit:({part,free,factions})=>free&&factions.mi6!=='elevated'
    &&['midday','evening','night'].includes(part),
});
export const eligibleFamilies = context =>
  BEAT_FAMILIES.filter(family=>ELIGIBILITY[family](context));

const hash = text => createHash('sha256').update(text).digest().readUInt32BE(0);
// Seeded, so the same world always stages the same beat at the same minute and
// a replay changes nothing. Recently used families are held back first; if that
// empties the list the memory is ignored rather than the tick being wasted.
export function chooseFamily(context,seed,key) {
  const eligible=eligibleFamilies(context);
  if(!eligible.length) return null;
  const fresh=eligible.filter(family=>!(context.recent??[]).includes(family));
  const pool=fresh.length?fresh:eligible;
  return pool[hash(`${seed}|director|${key}`)%pool.length];
}
// The gate itself. Returns the chosen family, or the reason it stayed out of
// the way — which is recorded on the tick event, so a quiet afternoon can be
// audited for *why* the director left it alone.
export function directorDecision(context,seed,key) {
  const {director,now}=context;
  if(context.asleep) return {family:null,reason:'asleep'};
  if(context.travelling) return {family:null,reason:'travelling'};
  // "Busy" is deliberately not a gate here any more. It used to be, and it cost
  // the world most of its variety: it blocked two ticks in five, and because it
  // blocked them wholesale the families that survived were the ones needing an
  // already-idle pair, so nearly half of every beat staged was a quiet break.
  // A genuinely busy stretch is already excluded by the quiet rule below —
  // anything either of them is doing has published an event with them in it —
  // so the only job left for "busy" is per-family, where a beat that needs both
  // of them free can ask for that and a recall or a passing colleague need not.
  if((director?.beatsToday??0)>=DIRECTOR_RULES.maxBeatsPerDay) return {family:null,reason:'budget_spent'};
  if(director?.lastBeatAt&&now-director.lastBeatAt<DIRECTOR_RULES.minGapMinutes*MIN)
    return {family:null,reason:'too_soon'};
  // Authored prose has just been on the page. Wait for it to clear; the quiet
  // clock keeps whatever it had accumulated, because a scene the bank staged
  // is not the world being eventful at them.
  if(context.lastAuthoredAt&&now-context.lastAuthoredAt<DIRECTOR_RULES.spacingMinutes*MIN)
    return {family:null,reason:'after_authored_scene'};
  const quiet=quietMinutes(director,now);
  if(quiet<=DIRECTOR_RULES.quietMinutes) return {family:null,reason:'not_quiet_yet',quiet};
  const tension=tensionOf(context);
  if(tension>=DIRECTOR_RULES.maxTension) return {family:null,reason:'world_is_busy',quiet,tension};
  const family=chooseFamily(context,seed,key);
  return family?{family,reason:'staged',quiet,tension}:{family:null,reason:'nothing_eligible',quiet,tension};
}

// The authored repertoire. A family is a shape, not a script: each one below
// expands into ordinary scheduled actions of types the world already reduces,
// so a beat cannot do anything a day's own plan could not have done. Nothing
// here creates a fact, teaches anybody anything, or leaves a memory — the one
// exception is the shared game, which is an ordinary arrangement and is kept or
// broken by exactly the same rules as any other.
const ANOMALY_KINDS = Object.freeze({
  lintel_low:'A lintel came down low enough over the yard to see the underside of it, drifting where the magic was thickest.',
  corridor_light:'The lights along the east corridor phased for a minute and settled again.',
  meu_handheld:'A passing MEU handheld ticked over its baseline and went quiet, the way they do.',
});
export const ANOMALY_KEYS = Object.freeze(Object.keys(ANOMALY_KINDS));
export const anomalyText = kind => ANOMALY_KINDS[kind] ?? ANOMALY_KINDS.lintel_low;
const DISRUPTION_KINDS = Object.freeze({
  yard_shut:'A squall came across the yard and the outdoor training ground was shut for the afternoon.',
  fog_closed:'Fog came up off the river thick enough that the yard was called for the day.',
  storm_over:'The storm sat directly over the building for a while and everything outdoors stopped.',
});
export const DISRUPTION_KEYS = Object.freeze(Object.keys(DISRUPTION_KINDS));
export const disruptionText = kind => DISRUPTION_KINDS[kind] ?? DISRUPTION_KINDS.yard_shut;
const disruptionFor = code => code==='fog'?'fog_closed':code==='storm'?'storm_over':'yard_shut';

// Every beat is built from this one helper so that a beat action is always
// stamped with the tick that caused it, is always in the future, and always
// carries the day it belongs to.
export function beatActions(family,context,seed,key) {
  const {day,now,weather,factions}=context;
  const at=minutes=>now+minutes*MIN;
  const id=suffix=>`${day}/beat/${key}/${family}${suffix?`/${suffix}`:''}`;
  const one=(minutes,type,data={})=>({id:id(data.tag),day,dueAt:at(minutes),priority:45,type,
    ...Object.fromEntries(Object.entries(data).filter(([field])=>field!=='tag'))});
  // Whichever of them the day has not already leaned on. Deterministic, and it
  // stops every callout in the world landing on Goaden.
  const soloist=hash(`${seed}|beat-actor|${key}`)%2?'ashai':'goaden';
  const dutyActor='goaden'; // Duty beats are his; hers is not that kind of post at this checkpoint.
  if(family==='interruption')
    return [one(5,'COMMS_CHECK_BEGIN',{actor:dutyActor,duration:20})];
  if(family==='recall')
    return [one(10,'BRIEFING_BEGIN',{actor:dutyActor,duration:25})];
  if(family==='minor_anomaly') {
    const kind=factions.arcane!=='low'?'lintel_low':weather?.code==='fog'?'corridor_light':'meu_handheld';
    return [one(5,'MINOR_ANOMALY',{actor:soloist,kind})];
  }
  if(family==='weather_disruption')
    return [one(5,'WEATHER_DISRUPTION',{kind:disruptionFor(weather?.code)})];
  if(family==='awkward_encounter') {
    const who=context.colleagues[hash(`${seed}|beat-colleague|${key}`)%context.colleagues.length];
    const line=hash(`${seed}|beat-line|${key}`)%SIDE_CHARACTERS[who].lines.length;
    return [one(5,'SIDE_PRESENCE',{actors:['goaden','ashai'],who,line,area:context.area})];
  }
  if(family==='legion_visit') {
    // Two or three of them, never all four — a crowd stops being a scene. Who
    // turns up is seeded off the day, so the same afternoon always has the same
    // people in it. Anarchy and Balthazar share a body and therefore arrive
    // together or not at all [M99].
    const roster=[...LEGION_IDS];
    const size=2+hash(`${seed}|legion-size|${key}`)%2;
    const visitors=[];
    for(let pick=0;visitors.length<size&&pick<roster.length*3;pick++) {
      const who=roster[hash(`${seed}|legion-who|${key}|${pick}`)%roster.length];
      if(!visitors.includes(who)) visitors.push(who);
    }
    if(visitors.includes('balthazar')&&!visitors.includes('anarchy')) visitors.push('anarchy');
    // A scene needs the pair actually in a room together, which is what an
    // encounter is. Without the meeting first, every visit resolved as "nobody
    // in to receive them" and the whole family silently never happened —
    // the day's own evening conversation has always been staged this way.
    return [
      one(5,'CROSS_PATHS',{actors:['goaden','ashai'],area:'common_room',tag:'meet'}),
      one(6,'LEGION_VISIT',{actors:['goaden','ashai'],visitors,tag:'visit'}),
      one(50,'END_ENCOUNTER',{tag:'off'}),
    ];
  }
  if(family==='decompression')
    return [one(5,'QUIET_TIME_BEGIN',{actors:['goaden','ashai'],duration:40,unhurried:true})];
  if(family==='invitation') {
    const arrangementKey=`${day}:beat-${key}`;
    return [
      one(5,'CROSS_PATHS',{actors:['goaden','ashai'],area:'common_room',tag:'meet'}),
      one(6,'OFFER_ACTIVITY',{actor:soloist,guest:soloist==='goaden'?'ashai':'goaden',
        arrangementKey,activity:'game',startAt:at(35),duration:40,tag:'offer'}),
      one(7,'ACCEPT_ACTIVITY',{arrangementKey,tag:'accept'}),
      one(8,'ANNOUNCE_ARRANGEMENT',{arrangementKey,tag:'announce'}),
      one(9,'END_ENCOUNTER',{tag:'disperse'}),
      one(35,'GAME_BEGIN',{actors:['goaden','ashai'],arrangementKey,tag:'play'}),
      one(80,'ACKNOWLEDGE_ARRANGEMENT',{arrangementKey,tag:'kept'}),
    ];
  }
  throw new Error(`Unknown beat family: ${family}`);
}

// The tick timetable. Ninety-minute spacing is not arbitrary: it is the same
// number as the quiet threshold, so the director cannot miss a gap it is
// supposed to catch, and it keeps a day's private tick events down to eight.
//
// It stops at eight in the evening on purpose. A 21:30 tick used to exist and
// was actively harmful: by then the pair are idle and it is late, so the only
// families still eligible are the quiet ones, and that single slot was taking
// nearly half of every beat the director staged and spending it on a quiet
// break an hour before bed. Ending the day earlier costs a slot that was only
// ever producing the least interesting beat at the least useful hour.
export const TICK_TIMES = Object.freeze(['09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00']);
// The context a tick assembles from live state before deciding anything.
export function tickContext({state,now,day,weather,factions}) {
  const crew=['goaden','ashai'].map(id=>state.characters[id]);
  const part=daypart(now);
  const together=crew.every(who=>who.location==='mi6'&&!who.journey);
  const area=crew[0]?.area==='common_room'?'common_room':'corridors';
  return {day,now,part,weather,factions,director:state.director,
    relationships:state.relationships,
    lastAuthoredAt:state.sceneBank?.lastPerformedAt??null,
    asleep:crew.some(who=>who.activity==='sleeping'),
    travelling:crew.some(who=>Boolean(who.journey)),
    busy:crew.some(who=>!INTERRUPTIBLE.includes(who.activity)),
    free:together&&crew.every(who=>INTERRUPTIBLE.includes(who.activity)),
    // Anybody standing anywhere the weather can reach: the training ground, and
    // the plaza. Restricting it to the yard made the family nearly unreachable
    // once incidents started interrupting training — two firings in six months.
    outdoors:crew.filter(who=>!who.journey&&areaOf(who.location,who.area)?.indoors===false).map(who=>who.id),
    together,area,
    colleagues:together?presentableIn(area,part):[],
    // Only a plan that is still live. Arrangements are never swept from state,
    // so without the window check a single plan left sitting at "accepted" —
    // one whose activity failed its own preconditions and never started —
    // would read as pending for the rest of the world's life and quietly bar
    // the invitation beat from ever being chosen again.
    arrangementPending:Object.values(state.arrangements??{})
      .some(r=>['offered','accepted','started'].includes(r.status)&&(r.until??0)>now),
    recent:state.director?.recent??[]};
}
