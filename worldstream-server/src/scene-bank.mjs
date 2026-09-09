import { createHash } from 'node:crypto';
import { SCENE_BANK_CATALOG, SCENE_BANK_BY_ID, sceneNarrativeParagraphs } from './scene-bank-catalog.mjs';
import { areaOf, permitsArea } from './places.mjs';
import { daypart } from './sky.mjs';
import { londonDate, londonClock, MINUTE_MS as MIN } from './time.mjs';
import { SIDE_CHARACTERS } from './cast.mjs';
import { supportingAvailability } from './faction-agendas.mjs';
import { supportingStoryAvailability, supportingLeadAvailable } from './supporting-stories.mjs';
import { offscreenAvailable } from './offscreen-lives.mjs';
import { nightStoryAvailable } from './night-stories.mjs';
import { outingRecoveryActorAvailable } from './outing-recovery.mjs';
import { competingCommitments } from './intent.mjs';

export const SCENE_BANK_EVENT_TYPES = Object.freeze(['SCENE_BANK_GATHER','SCENE_BANK_BEAT','SCENE_BANK_REJOIN']);
export const SCENE_BANK_FACT_KINDS = Object.freeze(['scene_bank_observation']);
export const SCENE_BANK_RULES = Object.freeze({version:1,ordinaryGap:12*60*MIN,nimbusGap:60*MIN,
  gatherDuration:3*MIN,sceneDuration:5*MIN,retainedProofs:16});
const TYPES = new Set(SCENE_BANK_EVENT_TYPES), DAY = 24*60*MIN;
const OPPORTUNITIES = new Set(['PRACTICE_BEGIN','PRACTICE_END','MEAL_BEGIN','GAME_BEGIN','GAME_PAUSE',
  'PIANO_BEGIN','ACTIVITY_COMPLETE','CITY_ACTIVITY_BEGIN','CROSS_PATHS','TRAVEL_ARRIVE','SIDE_PRESENCE',
  'VENUE_SCENE','CONVERSATION','SUPPORTING_ENCOUNTER','SUPPORTING_OUTCOME','OFFSCREEN_RESULT',
  'OFFSCREEN_ENCOUNTER','AGENDA_RESOLVE','INCIDENT','AFTERMATH']);
const ordinary = new Set(['unhurried_time','quiet_break','eating','gaming','watching_television',
  'listening_to_music','at_the_silver_spoon','visiting_enchanted_ink','walking_the_city','waiting']);
const training = new Set(['training','unhurried_time']);
const visits={ink_visit:['enchanted_ink','visiting_enchanted_ink'],cafe_outing:['cafe','at_the_silver_spoon'],
  city_walk:['big_ben_plaza','walking_the_city']};
const hash = text => createHash('sha256').update(text).digest('hex').slice(0,24);
const of = state => state.sceneBank ?? initialSceneBank();
const completed = (state,id) => of(state).completed[id];
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
  const state=ctx.state, now=ctx.now, p=of(state).proofs;
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
  if (scene.status==='excluded' || bank.completed[scene.id] || !scene.location || !areaOf(scene.location,scene.area)) return false;
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

export function sceneBankAfterAction(ctx) {
  // Atmospheric texture has no consequences. In particular UNEASE and
  // MINOR_ANOMALY cannot activate this feature or issue a physical scene.
  if (!OPPORTUNITIES.has(ctx.action.type) || ctx.event.visibility!=='public') return;
  let bank=of(ctx.state);
  if (bank.activatedAt===null) {bank={...bank,activatedAt:ctx.now};save(ctx,bank);}
  if (ctx.event.type==='INCIDENT' && ctx.event.payload?.kind==='breach') {
    bank={...bank,proofs:{...bank.proofs,north_face_alarm:{eventId:ctx.id,at:ctx.now,cast:[...ctx.event.participants]}}};save(ctx,bank);
  }
  if (bank.pending && ctx.now>bank.pending.expiresAt) {
    bank={...bank,pending:null,session:null};save(ctx,bank);
  }
  if (bank.pending || bank.session?.until>ctx.now) return;
  const sceneContext={...ctx,state:ownView(ctx.state)};
  let choice=null, booking=null;
  for(const scene of SCENE_BANK_CATALOG.filter(s=>s.id.startsWith('P') && (bank.nextNimbusAt??0)<=ctx.now)) {
    const gather=scene.id!=='P1', match=eligible(sceneContext,scene,{gather});
    if(match) {choice=scene;booking={...match,gather};break;}
  }
  if (!choice && bank.nextEligibleAt<=ctx.now) {
    const options=SCENE_BANK_CATALOG.filter(scene=>!scene.id.startsWith('P') && eligible(sceneContext,scene));
    options.sort((a,b)=>hash(`${ctx.seed}|scene-bank-v1|${a.id}|${londonDate(ctx.now)}`)
      .localeCompare(hash(`${ctx.seed}|scene-bank-v1|${b.id}|${londonDate(ctx.now)}`)));
    choice=options[0]; if(choice) booking={...eligible(sceneContext,choice),gather:false};
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
  if (choice.id==='D1'||choice.id==='D5'||choice.id==='E14') causeIds.push(bank.proofs.north_face_alarm?.eventId);
  save(ctx,{...bank,pending:{shape:stamp(action),sourceEventId:ctx.id,sourceAt:ctx.now,expiresAt:ctx.now+MIN,
    sceneId:choice.id,cast:booking.cast,location:choice.location,area:choice.area,causes:causeIds.filter(Boolean),
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
  if (!scene||scene.status==='excluded'||bank.completed[scene.id]) return refuse(ctx,'Scene unavailable or already spent');
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
  const fact=ctx.ops.createFact(`scene-bank:${scene.id}`,'scene_bank_observation',scene.id,
    {sceneId:scene.id,presentationText:scene.title},null);
  for(const who of actualCast) {
    if(ctx.state.characters[who]) ctx.ops.learn(who,fact,'participated_in_scene');
    next.knowledge={...next.knowledge,[who]:{...(next.knowledge[who]??{}),[scene.id]:{sourceEventId:id,learnedAt:now,provenance:'participated_in_scene'}}};
  }
  next={...next,pending:null,
    session:{id:bank.session?.id??id,sceneId:scene.id,cast:[...actualCast],
      startAt:bank.session?.startAt??now,until:now+SCENE_BANK_RULES.sceneDuration,performanceEventId:id},
    completed:{...next.completed,[scene.id]:{eventId:id,at:now,cast:[...actualCast]}},
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
