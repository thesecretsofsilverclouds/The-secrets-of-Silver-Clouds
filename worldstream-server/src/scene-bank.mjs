import { SCENE_BANK_CATALOG, SCENE_BANK_BY_ID, sceneNarrativeParagraphs } from './scene-bank-catalog.mjs';
import { reservoirSceneEligible } from './scene-reservoir-catalog.mjs';
import { areaOf, permitsArea } from './places.mjs';
import { daypart, isShelterWeather } from './sky.mjs';
import { londonDate, londonClock, atLondon, MINUTE_MS as MIN } from './time.mjs';
import { nextVeil } from './veil.mjs';
import { SIDE_CHARACTERS } from './cast.mjs';
import { supportingAvailability } from './faction-agendas.mjs';
import { supportingStoryAvailability, supportingLeadAvailable } from './supporting-stories.mjs';
import { offscreenAvailable } from './offscreen-lives.mjs';
import { nightStoryAvailable } from './night-stories.mjs';
import { outingRecoveryActorAvailable } from './outing-recovery.mjs';
import { competingCommitments } from './intent.mjs';
import { DIRECTOR_RULES } from './director.mjs';
import { rankNarrativeScenes } from './narrative-selection.mjs';

export const SCENE_BANK_EVENT_TYPES = Object.freeze(['SCENE_BANK_GATHER','SCENE_BANK_BEAT','SCENE_BANK_REJOIN']);
export const SCENE_BANK_FACT_KINDS = Object.freeze(['scene_bank_observation']);
export const SCENE_BANK_RULES = Object.freeze({version:1,ordinaryGap:12*60*MIN,nimbusGap:60*MIN,
  gatherDuration:3*MIN,sceneDuration:5*MIN,retainedProofs:16,replayCooldownDays:21});
const TYPES = new Set(SCENE_BANK_EVENT_TYPES), DAY = 24*60*MIN;
const OPPORTUNITIES = new Set(['PRACTICE_BEGIN','PRACTICE_END','MEAL_BEGIN','GAME_BEGIN','GAME_PAUSE',
  'PIANO_BEGIN','ACTIVITY_COMPLETE','CITY_ACTIVITY_BEGIN','CROSS_PATHS','TRAVEL_ARRIVE','TRAVEL_DEPART',
  'LEGION_VISIT','SANCTUARY_VISIT','SIDE_PRESENCE',
  'VENUE_SCENE','CONVERSATION','SUPPORTING_ENCOUNTER','SUPPORTING_OUTCOME','OFFSCREEN_RESULT',
  'OFFSCREEN_ENCOUNTER','AGENDA_RESOLVE','INCIDENT','AFTERMATH']);
const ordinary = new Set(['unhurried_time','quiet_break','eating','gaming','watching_television',
  'listening_to_music','at_the_silver_spoon','visiting_enchanted_ink','walking_the_city','waiting']);
const training = new Set(['training','unhurried_time']);
const visits={ink_visit:['enchanted_ink','visiting_enchanted_ink'],cafe_outing:['cafe','at_the_silver_spoon'],
  city_walk:['big_ben_plaza','walking_the_city']};
const of = state => state.sceneBank ?? initialSceneBank();
const completed = (state,id) => of(state).completed[id];

// Two lifecycles, because the bank holds two different kinds of thing.
//
// The Nimbus chain and the authored one-offs are consequential. Each moves the
// artefact, hands somebody knowledge they later act on, or is the stated cause
// of the next scene. Those play once and stay played: replaying P4 would put
// the coat back in the vending machine after it had left.
//
// Reservoir prose is surface. A quiet moment with Greah, passing in the
// corridor, the end of practice — these narrate conditions the world produces
// over and over, and the entries say so themselves with `effectPolicy` and
// their own cooldown. Sealing them after one performance is what turns a
// reservoir into a fortnight of material. The marker is an opt-in and not a
// guess: an entry is reusable because it declares itself surface-only, never
// because nothing obvious happened in it.
const surface = scene => scene.effectPolicy==='surface_only';
const playCount = record => record?.plays ?? (record ? 1 : 0);
const lastPlayed = record => record?.lastAt ?? record?.at ?? null;
const sceneCooldown = scene =>
  (scene.reservoir?.cooldown?.sceneDays ?? SCENE_BANK_RULES.replayCooldownDays)*DAY;
/** Neighbours: same family, or the same two people, too recently. */
function crowded(bank, scene, now, catalog) {
  const rule=scene.reservoir?.cooldown; if(!rule) return false;
  const family=scene.reservoir?.family, cast=[...scene.cast].sort().join(',');
  return catalog.some(other=>{
    if(other.id===scene.id || !surface(other)) return false;
    const played=lastPlayed(bank.completed[other.id]); if(played===null) return false;
    const since=now-played;
    if(family && other.reservoir?.family===family && since<(rule.familyHours??0)*60*MIN) return true;
    return [...other.cast].sort().join(',')===cast && since<(rule.pairHours??0)*60*MIN;
  });
}
export function sceneSpent(bank, scene, now, catalog=SCENE_BANK_CATALOG) {
  const record=bank.completed[scene.id];
  if (!surface(scene)) return Boolean(record);
  return record && now-lastPlayed(record) < sceneCooldown(scene) || crowded(bank,scene,now,catalog);
}
/** A proof stamped by today's world, not a fact left over from last week. */
const today = (proof, now) => Boolean(proof) && londonDate(proof.at)===londonDate(now);
const ownView = state => ({...state,sceneBank:{...of(state),session:null}});
const save = (ctx,value) => ctx.ops.setSceneBank(value);
const roomName = (location,area) => areaOf(location,area)?.name ?? 'the room';
const name = id => ({goaden:'Goaden',ashai:'Ashai',davis:'Davis',henderson:'Henderson',yukon:'Yukon',emily:'Emily',
  syndicate_man:'a man carrying a capture permit',inspector:'an inspector'}[id] ?? id);
const people = cast => cast.filter(id => ['goaden','ashai'].includes(id));
const stamp = a => JSON.stringify({id:a.id,type:a.type,dueAt:a.dueAt,day:a.day,priority:a.priority,
  actors:a.actors,sceneBankId:a.sceneBankId,version:a.version});

export function initialSceneBank() {
  return {version:1,activatedAt:null,completed:{},knowledge:{},proofs:{},pending:null,session:null,
    nextEligibleAt:0,nextNimbusAt:0,nimbus:{arrivedAt:null,holder:null,place:null,knownBy:{},bounty:null,
      report:null,damage:{},feeders:[],namedAt:null}};
}
export function sceneBankAvailable(state, who, atMs) {
  const session = state.sceneBank?.session;
  return !(session?.cast?.includes(who) && session.startAt <= atMs && atMs < session.until);
}
export function interruptSceneBankSession(ctx, reason, actorId = null) {
  const bank=of(ctx.state), session=bank.session;
  if (!session || session.until<=ctx.now || actorId && !session.cast.includes(actorId)) return false;
  save(ctx,{...bank,session:null,
    // A performed passage remains canon; an interrupted gathering does not.
    pending:bank.pending?.gathered ? null : bank.pending,
    lastInterruption:{sceneId:session.sceneId,sourceEventId:session.id,eventId:ctx.id,
      at:ctx.now,reason,phase:session.performanceEventId?'after_performance':'gathering'}});
  ctx.event.causedBy.push(session.id);
  return true;
}
const DEFERRED_ACTIVITY = new Set(['PRACTICE_BEGIN','PRACTICE_END','ACTIVITY_COMPLETE','REST_BEGIN',
  'MEAL_BEGIN','PIANO_BEGIN','MUSIC_LISTEN_BEGIN','GAME_BEGIN','GAME_RESUME','GAME_PAUSE',
  'QUIET_TIME_BEGIN','TV_BEGIN','WAIT_BEGIN','CROSS_PATHS','END_ENCOUNTER','TRAVEL_DEPART','CITY_ACTIVITY_BEGIN']);
export function guardSceneBankAction(ctx) {
  const a=ctx.action, bank=of(ctx.state), session=bank.session;
  if (!session) return true;
  if (session.until<=ctx.now) {save(ctx,{...bank,session:null});return true;}
  if (TYPES.has(a.type)) return true;
  const actors=a.actors??(a.actor?[a.actor]:a.type==='END_ENCOUNTER'?['goaden','ashai']:[]);
  if (!actors.some(who=>session.cast.includes(who))) return true;
  if (/^(ARCANE_SURGE|INCIDENT|BRIEFING_BEGIN|COMMS_CHECK_BEGIN|STANDBY_BEGIN|NIGHT_)/.test(a.type)) {
    interruptSceneBankSession(ctx,a.type);return true;
  }
  // Signed actions keep their identity and use their own availability checks.
  // Any exceptional replacement still passes the shared activity choke point.
  if (/^(SUPPORTING_|INTENT_|ABILITY_|OFFSCREEN_|AGENDA_|OUTING_RECOVERY_|INK_|ARC_)/.test(a.type)) return true;
  if (DEFERRED_ACTIVITY.has(a.type)) {
    const dueAt=session.until+1;
    ctx.followups.push({...a,id:`${a.id}/after-scene/${session.id}`,dueAt,day:londonDate(dueAt)});
  } else if (!['CONVERSATION','LEGION_VISIT','VENUE_SCENE','SIDE_PRESENCE'].includes(a.type)) return true;
  ctx.event.causedBy.push(session.id);
  ctx.ops.skip('The current authored scene retains its participants');
  return false;
}
function freeLead(state,id,now,{trainingAllowed=false}={}) {
  const actor=state.characters?.[id];
  const arc = state.arcs?.session;
  if (arc?.cast?.includes(id) && arc.startAt <= now && now < arc.until) return false;
  return actor && !actor.journey && actor.activity!=='sleeping'
    && (ordinary.has(actor.activity) || trainingAllowed && training.has(actor.activity))
    && nightStoryAvailable(state,id,{atMs:now}) && outingRecoveryActorAvailable(state,id,{atMs:now})
    && supportingLeadAvailable(state,id,{atMs:now});
}
function freeGuest(state,id,now,location) {
  const arc = state.arcs?.session;
  if (arc?.cast?.includes(id) && arc.startAt <= now && now < arc.until) return false;
  if (['nimbus','kai','greah','syndicate_man','inspector'].includes(id) || id.startsWith('sprite_')) return true;
  const known=SIDE_CHARACTERS[id];
  if (known && !known.dayparts.includes(daypart(now))) return false;
  if (id==='emily' && location!=='big_ben_plaza' && location!=='enchanted_ink' && location!=='cafe') return false;
  return supportingAvailability(state,id,{atMs:now,location})
    && supportingStoryAvailability(state,id,{atMs:now})
    && offscreenAvailable(state,id,{atMs:now,until:now+SCENE_BANK_RULES.gatherDuration+SCENE_BANK_RULES.sceneDuration,location});
}
function observedHere(ctx, scene, id) {
  if (id==='kai') return scene.cast.includes('goaden');
  if (id==='greah') return scene.cast.includes('ashai');
  if (id.startsWith('sprite_')) return scene.location==='big_ben_plaza';
  const event=ctx.event, cast=[...(event.participants??[]),...(event.payload?.cast??[]),
    ...(event.payload?.visitors??[]),event.payload?.who];
  const at=event.type==='SIDE_PRESENCE' ? event.payload?.area : event.area;
  return event.location===scene.location && at===scene.area && cast.includes(id);
}
function guardedPrerequisite(ctx, scene) {
  const state=ctx.state, now=ctx.now, bank=of(state), p=bank.proofs, n=bank.nimbus;
  const alarm=p.north_face_alarm;
  switch(scene.id) {
    case 'D1': return alarm?.eventId===ctx.event.id;
    case 'D5': return alarm && now-alarm.at < DAY && londonDate(alarm.at)!==londonDate(now)
      && daypart(now)==='morning';
    case 'E14': return alarm && now-alarm.at<2*60*MIN && alarm.cast.includes('ashai');
    // The venue original has to have reached the page first; `director.venueScenes`
    // counts performances, not dates, so this is the same fact the selector uses.
    case 'E3': return (state.director?.venueScenes?.plaza_emily_counting ?? 0) > 0;
    case 'E4': return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',weekday:'short'}).format(now)==='Tue';
    case 'C1': return ['ashai','goaden'].every(id=>state.characters[id]?.activity==='training'
      && now-state.characters[id].activitySince>=60*MIN);
    case 'E5': return ctx.event.type==='PIANO_BEGIN' && ctx.event.participants.includes('goaden');
    case 'E8': return Object.values(state.offscreenLives?.projects??{}).some(project=>project.guest==='yukon'&&project.status==='settled');
    case 'H5': return of(state).nimbus.bounty?.status==='active';
    // The bank's east-wing cleanup is a different place and event from P10's
    // absorbed Operations ward. The latter cannot unlock the former.
    case 'H6': return false;
    case 'N6': return state.characters.goaden?.activity==='gaming' && now-state.characters.goaden.activitySince>=10*MIN;
    case 'N7': return ['ashai','goaden'].every(id=>state.characters[id]?.activity==='training'
      && now-state.characters[id].activitySince>=15*MIN);
    case 'N1': return people(scene.cast).every(id=>now-state.characters[id].activitySince>=MIN);
    case 'L5': return state.factions.arcane==='high';

    // Conditions the world produces over and over, read off facts it already
    // commits. Nothing below asks the simulation for a new event; each is a
    // question about something already on the page.
    //
    // The outdoor yard closes on storm and heavy rain and training moves to the
    // covered floor. That closure is the whole premise of the scene.
    case 'C6': return isShelterWeather(state.weather?.code);
    // Said before it arrives. On a sheltering day the storm is published at
    // 13:02; until then a forecast is all anybody has to go on.
    case 'E1': return isShelterWeather(state.weather?.code) && !today(p.storm_broke,now);
    case 'H2': return today(p.storm_broke,now) && now-p.storm_broke.at<=30*MIN;
    case 'N3': return today(p.storm_broke,now) && now-p.storm_broke.at>=60*MIN
      && isShelterWeather(state.weather?.code);
    // The chimes coming in heavier than the hour required is a published
    // notice, so there is something real for Emily to have counted.
    case 'N4': return today(p.chimes_pulse,now);
    // Read at the same midday anchor the rest of the world uses, so the bank
    // and the Church agree about which phase the day is in.
    case 'L1': return ['imminent','underway'].includes(nextVeil(atLondon(londonDate(now),'12:00'),ctx.seed).phase);
    // A day nothing happened in can only be recognised at the end of one.
    case 'N8': return !today(p.last_incident,now) && ['evening','night'].includes(daypart(now));
    // She has to have been on the swing where a reader could see her. Same
    // rule E3 uses for the counting: the venue original comes first.
    case 'K1': return (state.director?.venueScenes?.plaza_emily_swing ?? 0) > 0;
    case 'H4': return n.arrivedAt!==null && Object.keys(n.knownBy).length>0;
    case 'H7': return Boolean(n.knownBy.yukon) && now-n.arrivedAt>=3*DAY;

    // Gated on facts this world does not commit. These were falling through to
    // the default, which answers false for anything not marked enabled, so
    // twenty-four catalogued scenes could never fire and nothing said so out
    // loud. They are still shut, but the reason is now written down. Each needs
    // the simulation to start committing the named fact before it can open.
    case 'E12':   // no path across the plaza is ever closed
    case 'E15':   // no vent shortcut is ever reported to anyone
    case 'F4':    // MI6 never loses power; the only blackout is a cafe scene
    case 'F5':    // no training authorisation is issued for anything extinct
    case 'I9':    // a bear all morning is written, not world state
    case 'L3':    // nothing ever cordons a stall in the plaza
    case 'L4':    // as I9: there is no per-month count of forms to reach four
    case 'M4':    // no camera recording is retained, the ground D6 is shut on
    case 'M5':    // no notice of an unrecognised door is ever posted
    case 'N5':    // no shared-chair routine is established anywhere in state
      return false;
    // Not a missing fact but a decided one: duty beats belong to Goaden at
    // this checkpoint and Ashai is never posted, so nobody can tell her she is
    // on again. See the dutyActor note in director.mjs.
    case 'M1': return false;
    // The scene needs Goaden asleep, and a sleeping lead is never free for a
    // scene. F2 and F3 are the same night continued, so they wait on F1.
    case 'F1': case 'F2': case 'F3': return false;

    default: return scene.status==='enabled';
  }
}
function holderPresent(state,location) {
  const n=of(state).nimbus, actor=state.characters?.[n.holder];
  return actor && actor.location===location && !actor.journey;
}

// This selector proposes from present-tense world state. It never advances a
// character, learns a fact, reads future actions or treats a page request as a
// story trigger. The committed cause persists the exact future action below.
function eligible(ctx, scene, {gather=false}={}) {
  const state=ctx.state, now=ctx.now, bank=of(state), isNimbus=scene.id.startsWith('P');
  if (scene.status==='excluded' || sceneSpent(bank,scene,now) || !scene.location || !areaOf(scene.location,scene.area)) return false;
  // Reservoir prose is presentation of an already committed event. It must not
  // book SCENE_BANK_BEAT actions or share the ordinary-scene cadence window.
  if (scene.reservoir) return false;
  if (scene.dependencies.some(id=>!bank.completed[id])) return false;
  if (scene.night && !['night','small_hours'].includes(daypart(now))) return false;
  if (!isNimbus && !guardedPrerequisite(ctx,scene)) return false;
  if (isNimbus && scene.id!=='P1' && (bank.nimbus.arrivedAt===null || now-bank.nimbus.arrivedAt<scene.minAgeDays*DAY)) return false;
  if (scene.id==='P1' && !['goaden','ashai'].every(id=>state.characters[id]?.activity==='walking_the_city'
    && now-state.characters[id].activitySince>=10*MIN)) return false;
  if (scene.id==='P21') {
    // The delivery is to the edge of the gardens; neither lead watches the
    // private meeting. This is checked again after the actual departure.
    if (!holderPresent(state,'big_ben_plaza')) return false;
  }
  let cast=[...scene.cast];
  if (isNimbus && scene.id!=='P1' && scene.cast.includes('nimbus') && scene.id!=='P21') {
    if (scene.id==='P5') {
      if (bank.nimbus.place?.location!=='big_ben_plaza'||bank.nimbus.place?.area!=='vending_machine') return false;
    } else {
      if (!holderPresent(state,scene.location)) return false;
      if (!cast.includes(bank.nimbus.holder)) cast.push(bank.nimbus.holder);
    }
  }
  if (scene.escort && !cast.includes('goaden')) cast.push('goaden');
  if (scene.id==='P4' && !cast.includes('ashai')) cast.push('ashai');
  if (scene.privateGarden && !cast.includes(bank.nimbus.holder)) cast.push(bank.nimbus.holder);
  if (cast.includes('kai')&&!cast.includes('goaden') || cast.includes('greah')&&!cast.includes('ashai')) return false;
  for(const id of cast) {
    if (state.characters[id]) {
      const actor=state.characters[id];
      if (!freeLead(state,id,now,{trainingAllowed:scene.area==='training'||scene.area==='indoor_yard'})
        || actor.location!==scene.location || !gather && actor.area!==scene.area) return false;
    } else if (!freeGuest(state,id,now,scene.location) || !isNimbus && !observedHere(ctx,scene,id)) return false;
  }
  if (!isNimbus && !people(cast).length) return false;
  if (isNimbus && scene.id!=='P1' && scene.location==='mi6'
    && !people(cast).length && !['morning','midday','evening'].includes(daypart(now))) return false;
  // Gathering never interrupts a lesson or training session just to obtain a
  // convenient room. It uses the gaps people actually have between routines.
  if (gather && people(cast).some(id=>!ordinary.has(state.characters[id].activity))) return false;
  if (gather && people(cast).some(id=>{
    const actor=state.characters[id],until=now+SCENE_BANK_RULES.gatherDuration+SCENE_BANK_RULES.sceneDuration;
    if (actor.activity!=='unhurried_time' && now-actor.activitySince<2*MIN) return true;
    if (Number.isSafeInteger(actor.activityUntil)&&actor.activityUntil<until) return true;
    return competingCommitments(state,id,now,until).some(arrangement=>{
      const visit=visits[arrangement.activity];
      return !(visit && visit[0]===actor.location && visit[1]===actor.activity && arrangement.public
        && arrangement.status==='started' && arrangement.startedEventId===actor.activityId
        && Number.isSafeInteger(actor.activityUntil) && actor.activityUntil>=until);
    });
  })) return false;
  return {cast,actors:people(cast)};
}

// Facts the world has already committed, kept where a gate can ask for them.
//
// Observing is not the same as offering. A storm breaking and the chimes coming
// in heavy are things the gates above need to know about, but neither may be
// allowed to start a scene by itself, so they are recorded here rather than
// added to OPPORTUNITIES. Nothing in this function creates, schedules or alters
// anything; it stamps events that have already happened.
function recordProofs(ctx, bank) {
  const event=ctx.event;
  const mark = (key, extra={}) => {
    bank={...bank,proofs:{...bank.proofs,[key]:{eventId:ctx.id,at:ctx.now,...extra}}};save(ctx,bank);
  };
  if (event.type==='INCIDENT' && event.payload?.kind==='breach')
    mark('north_face_alarm',{cast:[...event.participants]});
  if (event.type==='INSTITUTION_NOTICE') {
    if (event.payload?.notice==='storm_breaks') mark('storm_broke');
    if (event.payload?.notice==='chimes_pulse') mark('chimes_pulse');
  }
  // What makes a quiet day recognisably quiet. UNEASE and MINOR_ANOMALY are
  // deliberately not counted: texture is not an incident.
  if (['INCIDENT','ARCANE_SURGE','AFTERMATH'].includes(event.type)) mark('last_incident',{kind:event.type});
  return bank;
}

export function sceneBankAfterAction(ctx) {
  if (ctx.event.visibility!=='public') return;
  let bank=recordProofs(ctx,of(ctx.state));
  // Atmospheric texture has no consequences. In particular UNEASE and
  // MINOR_ANOMALY cannot activate this feature or issue a physical scene.
  if (!OPPORTUNITIES.has(ctx.action.type)) return;
  if (bank.activatedAt===null) {bank={...bank,activatedAt:ctx.now};save(ctx,bank);}
  if (bank.pending && ctx.now>bank.pending.expiresAt) {
    bank={...bank,pending:null,session:null};save(ctx,bank);
  }
  if (bank.pending || bank.session?.until>ctx.now) return;
  const sceneContext={...ctx,state:ownView(ctx.state)};
  let choice=null, booking=null, narrativeChoice=null;
  for(const scene of SCENE_BANK_CATALOG.filter(s=>s.id.startsWith('P') && (bank.nextNimbusAt??0)<=ctx.now)) {
    const gather=scene.id!=='P1', match=eligible(sceneContext,scene,{gather});
    if(match) {choice=scene;booking={...match,gather};break;}
  }
  // The director's half of the shared spacing window. Its beat has just been
  // on the page; an ordinary scene waits for the next opportunity rather than
  // publishing on top of it. Nimbus keeps his own clock: P1 is a ten-minute
  // window that a deferral would miss.
  const afterDirector=ctx.state.director?.lastBeatAt&&ctx.now-ctx.state.director.lastBeatAt<DIRECTOR_RULES.spacingMinutes*MIN;
  if (!choice && !afterDirector && bank.nextEligibleAt<=ctx.now) {
    const options=SCENE_BANK_CATALOG.filter(scene=>!scene.reservoir && !scene.id.startsWith('P') && eligible(sceneContext,scene));
    // Fewest performances first, then the day's seeded order within that tier.
    // Nothing comes round a second time while the bank still holds something
    // this world has never shown, which is the whole of the repetition rule.
    const fewest=Math.min(...options.map(scene=>playCount(bank.completed[scene.id])),Infinity);
    const fresh=options.filter(scene=>playCount(bank.completed[scene.id])===fewest);
    const ranked=rankNarrativeScenes(fresh,{state:ctx.state,now:ctx.now,disabled:ctx.disableNarrativeSignals,hashLength:24,
      key:scene=>`${ctx.seed}|scene-bank-v1|${scene.id}|${londonDate(ctx.now)}`});
    choice=ranked[0]?.scene; if(choice) booking={...eligible(sceneContext,choice),gather:false};
    if(ranked[0]?.logWeight) narrativeChoice={version:1,logWeight:ranked[0].logWeight,evidence:ranked[0].evidence};
  }
  if (!choice) {
    if (['gardens','venue'].includes(bank.nimbus.place?.area) && ctx.state.characters.goaden?.location==='big_ben_plaza'
      && freeLead(sceneContext.state,'goaden',ctx.now) && ctx.state.characters.goaden.area==='venue') {
      const action={id:`${ctx.action.id}/scene-bank/rejoin`,type:'SCENE_BANK_REJOIN',sceneBankId:'nimbus_rejoin',
        dueAt:ctx.now+1,day:londonDate(ctx.now+1),priority:33,actors:['goaden'],version:1};
      save(ctx,{...bank,pending:{shape:stamp(action),sourceEventId:ctx.id,sourceAt:ctx.now,expiresAt:ctx.now+MIN,
        cast:['goaden','nimbus'],location:'big_ben_plaza',area:'venue'}});ctx.followups.push(action);
    }
    return;
  }
  const action={id:`${ctx.action.id}/scene-bank/${choice.id}`,type:booking.gather?'SCENE_BANK_GATHER':'SCENE_BANK_BEAT',
    sceneBankId:choice.id,dueAt:ctx.now+1,day:londonDate(ctx.now+1),priority:33,actors:booking.actors,version:1};
  const causeIds=choice.dependencies.map(id=>bank.completed[id].eventId);
  for(const proof of narrativeChoice?.evidence??[]) causeIds.push(...(typeof proof==='string'?[proof]:
    [proof.sourceEventId,proof.acquisitionEventId,proof.otherSourceEventId,proof.otherAcquisitionEventId]));
  if (choice.id==='D1'||choice.id==='D5'||choice.id==='E14') causeIds.push(bank.proofs.north_face_alarm?.eventId);
  save(ctx,{...bank,pending:{shape:stamp(action),sourceEventId:ctx.id,sourceAt:ctx.now,expiresAt:ctx.now+MIN,
    sceneId:choice.id,cast:booking.cast,location:choice.location,area:choice.area,causes:causeIds.filter(Boolean),
    ...(narrativeChoice?{narrativeChoice}:{}),
    leadActivityIds:Object.fromEntries(booking.actors.map(id=>[id,ctx.state.characters[id].activityId]))}});
  ctx.followups.push(action);
}

function refuse(ctx,reason) {
  ctx.ops.skip(reason);
  // Only the exact owned action may cancel its own booking. A forged action
  // cannot consume a legitimate scene, reservation or knowledge opportunity.
  const bank=of(ctx.state);
  if (bank.pending?.shape===stamp(ctx.action)) save(ctx,{...bank,pending:null,session:null,nextEligibleAt:ctx.now+30*MIN});
}
function stillHere(ctx, pending, gathered=false) {
  const state=ownView(ctx.state);
  for(const id of pending.cast) {
    if (state.characters[id]) {
      const actor=state.characters[id];
      if (!freeLead(state,id,ctx.now,{trainingAllowed:true}) || actor.location!==pending.location
        || actor.activityId!==pending.leadActivityIds[id]) return false;
      if (gathered && actor.area!==(pending.location==='mi6'?'corridors':'venue')) return false;
      if (!gathered && actor.area!==pending.area) return false;
    } else if (!freeGuest(state,id,ctx.now,pending.location)) return false;
  }
  return true;
}
function sceneEffects(ctx, scene, bank) {
  let n={...bank.nimbus,knownBy:{...bank.nimbus.knownBy},damage:{...bank.nimbus.damage}};
  if(scene.id==='P1') n={...n,arrivedAt:ctx.now,holder:'goaden',knownBy:{goaden:ctx.id,ashai:ctx.id}};
  if(scene.id==='P3') n.bounty={status:'active',issuer:'mi6_higher_leadership',sourceEventId:ctx.id};
  if(scene.id==='P4') {n.holder=null;n.place={location:'big_ben_plaza',area:'vending_machine',sourceEventId:ctx.id};}
  if(scene.id==='P5') {
    const actor=ctx.state.characters.goaden, here=actor.location==='big_ben_plaza'&&actor.area==='venue'
      && freeLead(ownView(ctx.state),'goaden',ctx.now);
    n.holder=here?'goaden':null;n.place=here?null:{location:'big_ben_plaza',area:'venue',sourceEventId:ctx.id};
    n.damage.vending_machine={kind:'forced_open',eventId:ctx.id};
  }
  if(scene.id==='P6') n.feeders=[...new Set([...n.feeders,'goaden','ashai'])];
  if(scene.id==='P8') n.knownBy.yukon=ctx.id;
  if(scene.id==='P7') n.damage.gaming_room={kind:'displaced_chair',eventId:ctx.id};
  if(scene.id==='P10') {n.knownBy.davis=ctx.id;n.report={sourceEventId:ctx.id,subject:'ward_absorbed_in_operations',audience:['davis','henderson']};}
  if(scene.id==='P9') n.knownBy.henderson=ctx.id;
  if(scene.id==='P11') n.damage[scene.area]={kind:'ceiling_damage',eventId:ctx.id};
  if(scene.id==='P14') n.captureAttempt={sourceEventId:ctx.id,participants:2,outcome:'retreated'};
  if(scene.id==='P17') n.unfiledBy={henderson:ctx.id,davis:ctx.id};
  if(scene.id==='P18') n.namedAt=ctx.now;
  if(scene.id==='P21') {n.holder=null;n.place={location:'big_ben_plaza',area:'gardens',sourceEventId:ctx.id};}
  if(scene.id==='P22') n.bounty={...n.bounty,status:'withdrawn',withdrawalEventId:ctx.id};
  return {...bank,nimbus:n};
}

export function resolveSceneBankAction(ctx) {
  const {action:a,now,id}=ctx, bank=of(ctx.state), pending=bank.pending;
  if (!TYPES.has(a.type)||a.version!==1||!pending||pending.shape!==stamp(a)
    || pending.sourceAt>=now||now>pending.expiresAt) return ctx.ops.skip('Unowned or expired scene-bank action');
  if (a.type==='SCENE_BANK_REJOIN') {
    if (!bank.nimbus.place || !freeLead(ownView(ctx.state),'goaden',now)
      || ctx.state.characters.goaden.location!=='big_ben_plaza') return refuse(ctx,'Nimbus and Goaden no longer share the plaza');
    ctx.event.location='big_ben_plaza';ctx.event.area='venue';ctx.event.participants=['goaden','nimbus'];
    ctx.event.causedBy.push(pending.sourceEventId,bank.nimbus.place.sourceEventId);
    ctx.event.payload={sceneEpisodeId:`nimbus:${bank.completed.P1.eventId}`,nimbusPlate:'smile'};
    ctx.ops.publish('Something warm slipped back into Goaden’s coat before he left the plaza. He looked down. Nimbus had already closed both eyes.');
    save(ctx,{...bank,pending:null,nimbus:{...bank.nimbus,holder:'goaden',place:null}});return;
  }
  const scene=SCENE_BANK_BY_ID[a.sceneBankId];
  if (!scene||scene.status==='excluded'||sceneSpent(bank,scene,now)) return refuse(ctx,'Scene unavailable or already spent');
  // The source event was checked once, when the booking was made. Everything
  // physical is checked again now, so a world that moved on between the offer
  // and the performance cannot have the prose anyway.
  if (scene.reservoir && !reservoirSceneEligible({...ctx,state:ownView(ctx.state)},scene,{checkTrigger:false}))
    return refuse(ctx,'The moment this passage needed has passed');
  if (a.type==='SCENE_BANK_GATHER') {
    const match=eligible({...ctx,state:ownView(ctx.state) },scene,{gather:true});
    if(!match || JSON.stringify(match.cast)!==JSON.stringify(pending.cast)
      || people(pending.cast).some(who=>ctx.state.characters[who].activityId!==pending.leadActivityIds[who]))
      return refuse(ctx,'The free time or cast for this scene changed');
    const until=now+SCENE_BANK_RULES.gatherDuration+SCENE_BANK_RULES.sceneDuration;
    const session={id,sceneId:scene.id,cast:pending.cast,startAt:now,until};
    save(ctx,{...bank,session,...(scene.id==='P21'?{nimbus:{...bank.nimbus,holder:null,
      place:{location:'big_ben_plaza',area:'gardens',sourceEventId:id}}}:{})});
    const travelArea=scene.location==='mi6'?'corridors':'venue';
    if(scene.location==='mi6') for(const who of people(pending.cast)) ctx.ops.activity(who,'unhurried_time',8,travelArea);
    const leads=people(pending.cast).map(name).join(' and '), guestNames=pending.cast.filter(who=>!ctx.state.characters[who]
      && !['kai','greah','nimbus'].includes(who) && !who.startsWith('sprite_')).map(name).join(' and ');
    ctx.event.location=scene.location;ctx.event.area=travelArea;ctx.event.participants=people(pending.cast);
    ctx.event.causedBy.push(pending.sourceEventId,...pending.causes);
    ctx.event.payload={sceneBankId:scene.id,sceneEpisodeId:`nimbus:${bank.completed.P1.eventId}`,cast:pending.cast};
    ctx.ops.publish(scene.id==='P21' ? 'At the edge of the plaza gardens, Nimbus slipped out of Goaden’s coat. Goaden stayed on the path and let him go.'
      : leads ? `${leads} found a few minutes between commitments and went towards ${roomName(scene.location,scene.area)}${guestNames?`, where ${guestNames} had agreed to meet them`:''}.`
      : `${guestNames} made time to meet in ${roomName(scene.location,scene.area)}.`);
    const next={...a,id:`${a.id}/arrived`,type:'SCENE_BANK_BEAT',dueAt:now+SCENE_BANK_RULES.gatherDuration,
      day:londonDate(now+SCENE_BANK_RULES.gatherDuration)};
    save(ctx,{...of(ctx.state),pending:{...pending,shape:stamp(next),gathered:true,sourceEventId:id,sourceAt:now,
      expiresAt:next.dueAt+1,leadActivityIds:Object.fromEntries(people(pending.cast).map(who=>[who,ctx.state.characters[who].activityId]))}});
    ctx.followups.push(next);return;
  }
  const machineConsequence=scene.id==='P5' && bank.nimbus.place?.area==='vending_machine'
    && pending.causes.includes(bank.completed.P4?.eventId);
  if (!stillHere(ctx,pending,pending.gathered) && !machineConsequence) return refuse(ctx,'An interruption prevented the scene from happening');
  if(scene.dependencies.some(dep=>!bank.completed[dep])) return refuse(ctx,'The earlier scene has not happened');
  if(scene.id==='P21' && Object.values(ctx.state.characters).some(actor=>actor.location==='big_ben_plaza'&&actor.area==='gardens'))
    return refuse(ctx,'Emily and Nimbus do not have the gardens to themselves');
  if(scene.id==='P22' && bank.nimbus.captureAttempt?.outcome!=='retreated') return refuse(ctx,'No capture attempt supports the withdrawal');
  if (pending.gathered && scene.location==='mi6') for(const who of people(pending.cast)) {
    // The escort stays on the public path during the private garden meeting.
    const area=scene.id==='P21'?'venue':scene.area;
    if(!permitsArea(scene.location,area,'unhurried_time',now)) return refuse(ctx,'The destination is closed');
    ctx.ops.activity(who,'unhurried_time',SCENE_BANK_RULES.sceneDuration/MIN,area);
  }
  let next=sceneEffects(ctx,scene,bank);
  const actualCast=scene.privateGarden?scene.cast:machineConsequence?pending.cast.filter(who=>{
    const actor=ctx.state.characters[who];return !actor || actor.location==='big_ben_plaza'&&actor.area==='venue'
      && freeLead(ownView(ctx.state),who,now);
  }):pending.cast;
  let beats=scene.beats;
  if(machineConsequence) {
    beats=scene.beats.filter(beat=>!(beat.who==='ashai'&&!actualCast.includes('ashai'))
      && !(beat.kind==='prose'&&beat.text.startsWith('Goaden held his coat open.')&&!actualCast.includes('goaden')));
    if(!actualCast.includes('goaden')) beats=[...beats,{kind:'prose',who:'nimbus',expression:'happy',nimbusPlate:'happy',
      text:'Nimbus stayed beside the open machine, comfortably surrounded by the snacks.'}];
  }
  const paragraphs=sceneNarrativeParagraphs({...scene,beats});
  ctx.event.location=scene.location;ctx.event.area=scene.privateGarden?'gardens':scene.area;
  ctx.event.participants=[...actualCast];ctx.event.causedBy.push(pending.sourceEventId,...pending.causes);
  const episodeId=scene.id.startsWith('P')?`nimbus:${scene.id==='P1'?id:bank.completed.P1.eventId}`:`scene-bank:${scene.id}`;
  ctx.event.payload={sceneBankId:scene.id,sceneTitle:scene.title,sceneEpisodeId:episodeId,
    cast:[...actualCast],sourceEventId:pending.sourceEventId,sceneBeats:structuredClone(beats),
    narrativeParagraphs:paragraphs,lines:beats.filter(b=>b.kind==='dialogue').map(b=>({who:b.who,expression:b.expression??'idle',text:b.text})),
    ...(scene.nimbusPlate?{nimbusPlate:scene.nimbusPlate}:{})};
  const text=paragraphs.map(p=>p.text).join('\n\n');ctx.ops.publish(text);ctx.event.prose=text;
  // The fact is the observation, and it is made once. A surface scene coming
  // round again is the world saying a familiar thing a second time, not a
  // second thing to know: the fact key would collide, offscreen lives verify
  // their proofs against the exact source event, and nobody learns anything
  // from a quiet half hour they have already had.
  if(!bank.completed[scene.id]) {
    const fact=ctx.ops.createFact(`scene-bank:${scene.id}`,'scene_bank_observation',scene.id,
      {sceneId:scene.id,presentationText:scene.title},null);
    for(const who of actualCast) {
      if(ctx.state.characters[who]) ctx.ops.learn(who,fact,'participated_in_scene');
      next.knowledge={...next.knowledge,[who]:{...(next.knowledge[who]??{}),[scene.id]:{sourceEventId:id,learnedAt:now,provenance:'participated_in_scene'}}};
    }
  }
  next={...next,pending:null,lastPerformedAt:now,
    session:{id:bank.session?.id??id,sceneId:scene.id,cast:[...actualCast],
      startAt:bank.session?.startAt??now,until:now+SCENE_BANK_RULES.sceneDuration,performanceEventId:id},
    // `eventId` and `at` stay the first performance: dependency ordering, the
    // Nimbus arrival check and every recorded cause read them. A replay adds
    // its own count and time alongside.
    completed:{...next.completed,[scene.id]:{...(next.completed[scene.id]??{eventId:id,at:now}),
      plays:playCount(next.completed[scene.id])+1,lastAt:now,lastEventId:id,cast:[...actualCast]}},
    ...(scene.id.startsWith('P')?{nextNimbusAt:now+(scene.id==='P4'?MIN:SCENE_BANK_RULES.nimbusGap)}
      :{nextEligibleAt:now+SCENE_BANK_RULES.ordinaryGap})};
  save(ctx,next);
  if(scene.id==='P4') {
    // The lockpick and the machine opening are one physical incident. Reserve
    // the whole cast before P4 and carry its exact activity/source ownership
    // into the one-minute consequence. If interrupted, placement stays at the
    // machine and the later return must be an actual plaza visit.
    const action={id:`${a.id}/machine-opens`,type:'SCENE_BANK_BEAT',sceneBankId:'P5',
      dueAt:now+MIN,day:londonDate(now+MIN),priority:33,actors:people(pending.cast),version:1};
    save(ctx,{...of(ctx.state),pending:{shape:stamp(action),sourceEventId:id,sourceAt:now,
      expiresAt:action.dueAt+1,sceneId:'P5',cast:pending.cast,location:'big_ben_plaza',area:'venue',
      causes:[id],leadActivityIds:Object.fromEntries(people(pending.cast).map(who=>[who,ctx.state.characters[who].activityId]))}});
    ctx.followups.push(action);
  }
}

export function assertSceneBank(state) {
  const bank=state.sceneBank;if(!bank) return;
  if(bank.version!==1 || Object.keys(bank.completed).some(id=>!SCENE_BANK_BY_ID[id])) throw new Error('Invalid scene-bank ledger');
  const n=bank.nimbus;
  if(n.arrivedAt!==null && (!bank.completed.P1 || n.arrivedAt!==bank.completed.P1.at)) throw new Error('Nimbus needs his actual coat arrival');
  if(n.bounty && n.bounty.issuer!=='mi6_higher_leadership') throw new Error('Henderson did not issue the Nimbus bounty');
  if(n.knownBy.davis && !bank.completed.P10 || n.knownBy.henderson && !bank.completed.P9) throw new Error('Nimbus knowledge needs its witnessed source');
  for(const [id,record] of Object.entries(bank.completed)) {
    if(!Number.isSafeInteger(record.at)||!record.eventId) throw new Error('Scene completion lacks a committed source');
    for(const dep of SCENE_BANK_BY_ID[id].dependencies) if(!bank.completed[dep] || bank.completed[dep].at>=record.at)
      throw new Error('Scene-bank dependency out of order');
  }
}
