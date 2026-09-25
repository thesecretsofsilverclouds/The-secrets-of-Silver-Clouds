import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createFixture } from '../src/fixture.mjs';
import { initialNarrativeSignals } from '../src/morphos.mjs';
import { SCENE_BANK_BY_ID } from '../src/scene-bank-catalog.mjs';
import { initialSceneBank, sceneBankAfterAction } from '../src/scene-bank.mjs';
import { selectReservoirSurface, createReservoirMemory, reservoirSurfaceMatches } from '../src/scene-reservoir-select.mjs';
import { narrativeSceneTags, NARRATIVE_SCENE_TAGS } from '../src/narrative-scene-tags.mjs';
import { spectraSceneScore, spectraEvidence } from '../src/spectra.mjs';
import { narrativeSelectionSnapshot, rankNarrativeScenes } from '../src/narrative-selection.mjs';
import { INCIDENTS_HIGH } from '../src/pressure.mjs';
import { atLondon, londonDate } from '../src/time.mjs';

const START=atLondon('2026-09-20','00:00'), NOW=atLondon('2026-09-20','14:00'), MIN=60_000;
const fixture=createFixture({startMs:START});
test('a shallow-frozen scene cannot keep its review after nested prose changes', () => {
  const scene=Object.freeze(structuredClone(SCENE_BANK_BY_ID.N1));
  assert.ok(narrativeSceneTags(scene));
  scene.beats.push({kind:'prose',text:'Unreviewed altered content.'});
  assert.equal(narrativeSceneTags(scene),null);
});
function place(state, now=NOW) {
  for(const actor of Object.values(state.characters)) Object.assign(actor,{location:'mi6',area:'common_room',
    journey:null,activity:'unhurried_time',activitySince:now-20*MIN,activityUntil:null,activityId:`present:${actor.id}`});
}
function pressuredWorld() {
  const state=fixture.initialState();place(state);
  const def=INCIDENTS_HIGH.find(s=>s.kind==='deployment');
  const action={id:'spectra/actual-incident',day:londonDate(NOW),dueAt:NOW,priority:48,type:'INCIDENT',
    actors:['goaden','ashai'],kind:def.kind,severity:'high',text:def.text,factKey:'spectra/incident',
    validUntil:NOW+2*24*60*MIN,aftermath:true};
  const result=fixture.reduceAction(state,action,'spectra-proof');
  assert.equal(result.event.visibility,'public');
  state.sceneBank=initialSceneBank();state.director.lastBeatAt=null;place(state,NOW+10*MIN);
  return {state,source:result.event};
}
function probe(state,seed,disabled=false) {
  const now=NOW+10*MIN, id='spectra/opportunity', followups=[];
  const event={id,type:'ACTIVITY_COMPLETE',occurredAt:now,visibility:'public',participants:['goaden','ashai'],
    location:'mi6',area:'common_room',payload:{}};
  sceneBankAfterAction({state,now,id,event,seed,action:{id,type:event.type},followups,disableNarrativeSignals:disabled,
    ops:{setSceneBank:value=>{state.sceneBank=value;}}});
  return followups[0];
}

test('annotations bind inspected text and source metadata, never family membership',()=>{
  for(const id of Object.keys(NARRATIVE_SCENE_TAGS)) assert.ok(narrativeSceneTags(SCENE_BANK_BY_ID[id]),id);
  const original=SCENE_BANK_BY_ID['R:domestic.shared_meal.04'];
  assert.ok(narrativeSceneTags(original));
  const modified=structuredClone(original);modified.beats[0].text+=' A new unreviewed assertion.';
  assert.equal(narrativeSceneTags(modified),null);
  assert.equal(narrativeSceneTags({...original,id:'R:domestic.shared_meal.unreviewed'}),null);
  assert.equal(narrativeSceneTags({...original,reservoir:{...original.reservoir,sourceHash:'changed'}}),null);
});

test('SPECTRA reads a real incident, but unlearned, expired and future evidence stays neutral',()=>{
  const {state,source}=pressuredWorld(),scene=SCENE_BANK_BY_ID.N1,now=NOW+10*MIN;
  const before=JSON.stringify(state), scored=spectraSceneScore(state,scene,now);
  assert.ok(scored.score>0&&scored.score<=1);assert.ok(scored.evidence.every(p=>p.sourceEventId===source.id));
  assert.equal(source.payload.narrativeSelection,undefined,'unmatchable incident prose needs no reservoir capsule');
  const meal=fixture.reduceAction(structuredClone(state),{id:'spectra/meal-proof',type:'MEAL_BEGIN',
    day:londonDate(now),dueAt:now,priority:20,actors:['goaden','ashai']},'spectra-proof').event;
  assert.equal(meal.payload.narrativeSelection?.at,meal.occurredAt,'the real reducer commits event-time weights');
  assert.ok(meal.payload.narrativeSelection.weights.some(row=>row.evidence.some(p=>p.sourceEventId===source.id)));
  assert.equal(JSON.stringify(state),before,'scoring is read-only');
  for(const change of ['unknown','wrong_source','expired','future','disabled','old_world']) {
    const copy=structuredClone(state);
    if(change==='unknown') for(const actor of Object.values(copy.characters)) actor.knowledge=[];
    if(change==='wrong_source') copy.facts['spectra/incident'].sourceEventId='other-event';
    if(change==='expired') copy.facts['spectra/incident'].validUntil=now;
    if(change==='future') copy.facts['spectra/incident'].createdAt=now+1;
    if(change==='disabled') copy.narrativeSignals.enabled=false;
    if(change==='old_world') delete copy.narrativeSignals;
    assert.equal(spectraSceneScore(copy,scene,now).score,0,change);
  }
});

test('interruption sensitivity needs the same unresolved result known by both people',()=>{
  const state=fixture.initialState(),scene=SCENE_BANK_BY_ID.N6,at=NOW-MIN;
  const fact={key:'spectra/meeting',kind:'supporting_result',subject:'goaden',sourceEventId:'evt:interrupted',
    createdAt:at,validUntil:null,value:{guest:'yukon',outcome:'cut_short',interruption:{eventId:'evt:duty'}}};
  state.facts[fact.key]=fact;
  const memory={factKey:fact.key,sourceEventId:fact.sourceEventId,acquisitionEventId:'evt:interrupted',learnedAt:at,validUntil:null};
  state.characters.goaden.knowledge.push({...memory});
  state.supportingStories.people.yukon.knowledge.push({...memory});
  assert.ok(spectraSceneScore(state,scene,NOW).score>0);
  state.supportingStories.people.yukon.knowledge=[];
  assert.equal(spectraSceneScore(state,scene,NOW).score,0,'the lead cannot lend private memory to the guest');
  state.supportingStories.people.yukon.knowledge.push({...memory});
  const resolved={...fact,key:'spectra/later-kept',sourceEventId:'evt:kept',createdAt:NOW-1,
    value:{guest:'yukon',outcome:'kept',interruption:null}};
  state.facts[resolved.key]=resolved;
  state.characters.goaden.knowledge.push({factKey:resolved.key,sourceEventId:resolved.sourceEventId,
    acquisitionEventId:'evt:kept',learnedAt:NOW-1,validUntil:null});
  assert.equal(spectraSceneScore(state,scene,NOW).score,0,'a later completed meeting resolves the precursor');
});

test('fragility needs overlapping accepted obligations with actual provenance',()=>{
  const state=fixture.initialState(),scene=SCENE_BANK_BY_ID.E7;
  state.arrangements.a={status:'accepted',party:['ashai'],startAt:NOW+60*MIN,until:NOW+90*MIN,sourceEventId:'evt:a'};
  state.arrangements.b={status:'accepted',party:['ashai'],startAt:NOW+80*MIN,until:NOW+100*MIN,sourceEventId:'evt:b'};
  assert.equal(spectraEvidence(state,scene,NOW)[0].kind,'fragile_obligation');
  state.arrangements.b.startAt=NOW+90*MIN;
  assert.equal(spectraSceneScore(state,scene,NOW).score,0,'touching endpoints are not overlap');
  state.arrangements.b.startAt=NOW+80*MIN;delete state.arrangements.b.sourceEventId;
  assert.equal(spectraSceneScore(state,scene,NOW).score,0,'an unsourced proposal cannot become pressure');
});

test('actual canonical scene booking changes under evidence and retains guards and causes',()=>{
  const {state,source}=pressuredWorld();let changed=null;
  for(let n=0;n<512&&!changed;n++) {
    const enabled=structuredClone(state),disabled=structuredClone(state),seed=`spectra-${n}`;
    const a=probe(enabled,seed),b=probe(disabled,seed,true);
    if(a?.sceneBankId!==b?.sceneBankId) changed={enabled,seed,a,b};
  }
  assert.ok(changed,'real booking must exhibit measurable influence');
  assert.equal(changed.a.sceneBankId,'N1');
  assert.ok(changed.enabled.sceneBank.pending.causes.includes(source.id));
  const performance=fixture.reduceAction(changed.enabled,changed.a,changed.seed).event;
  assert.equal(performance.visibility,'public');assert.equal(performance.payload.sceneBankId,'N1');
  assert.ok(performance.causedBy.includes(source.id));
  const absent=structuredClone(state);absent.characters.ashai.area='quarters';
  assert.notEqual(probe(absent,changed.seed)?.sceneBankId,'N1','score cannot supply missing cast');
  const spent=structuredClone(state);spent.sceneBank.completed.N1={eventId:'evt:old',at:NOW-MIN,plays:1};
  assert.notEqual(probe(spent,changed.seed)?.sceneBankId,'N1','score cannot replay a one-off');
  const spaced=structuredClone(state);spaced.sceneBank.nextEligibleAt=NOW+60*MIN;
  assert.equal(probe(spaced,changed.seed),undefined,'score cannot override ordinary spacing');
});

test('neutral ranking is exactly the original keyed hash order and relative bias stays bounded',()=>{
  const scenes=['N1','M3','E13'].map(id=>SCENE_BANK_BY_ID[id]);
  const key=s=>`seed|scene-bank-v1|${s.id}|2026-09-20`;
  const original=[...scenes].sort((a,b)=>createHash('sha256').update(key(a)).digest('hex').slice(0,24)
    .localeCompare(createHash('sha256').update(key(b)).digest('hex').slice(0,24)));
  assert.deepEqual(rankNarrativeScenes(scenes,{now:NOW,key,hashLength:24}).map(r=>r.scene.id),original.map(s=>s.id));
  const snapshot={version:1,at:NOW,weights:scenes.filter(narrativeSceneTags).map((s,i)=>({sceneId:s.id,
    ...narrativeSceneTags(s),logWeight:i?-.34:.56}))};
  const ranked=rankNarrativeScenes(scenes,{now:NOW,key,snapshot}), weights=ranked.map(r=>r.weight);
  assert.ok(Math.max(...weights)/Math.min(...weights)<=2+1e-12);
});

test('reservoir choices consume committed event-time weights and keep cast, cooldown and least-played gates',()=>{
  const {state}=pressuredWorld(),now=NOW+10*MIN;
  const event={id:'spectra/meal',type:'MEAL_BEGIN',occurredAt:now,visibility:'public',location:'mi6',area:'common_room',
    participants:['goaden','ashai'],payload:{}};
  const ids=['R:domestic.shared_meal.03','R:domestic.shared_meal.04'],catalog=ids.map(id=>SCENE_BANK_BY_ID[id]);
  const snapshot=narrativeSelectionSnapshot(state,event);assert.ok(snapshot.weights.length);
  assert.ok(snapshot.weights.every(row=>reservoirSurfaceMatches(event,SCENE_BANK_BY_ID[row.sceneId],
    {now,state,weatherCode:state.weather?.code})), 'capsules contain only currently matchable passages');
  const cleared=structuredClone(state);for(const actor of Object.values(cleared.characters)) actor.knowledge=[];
  assert.equal(narrativeSelectionSnapshot(cleared,event),null,'same-timestamp actions cannot reuse an earlier evidence cache');
  const weighted={...event,payload:{narrativeSelection:snapshot}};
  let seed=null;
  for(let n=0;n<512;n++) {
    const key=`meal-${n}`;
    if(selectReservoirSurface(event,{catalog,seed:key})?.id!==selectReservoirSurface(weighted,{catalog,seed:key})?.id){seed=key;break;}
  }
  assert.ok(seed);const choice=selectReservoirSurface(weighted,{catalog,seed});assert.equal(choice.id,ids[1]);
  const future=structuredClone(state);future.pressure.carried=0;future.narrativeSignals=initialNarrativeSignals(now+24*60*MIN);
  assert.equal(selectReservoirSurface(weighted,{catalog,seed,state:future,now:now+100*24*60*MIN}).id,choice.id);
  assert.equal(selectReservoirSurface(JSON.parse(JSON.stringify(weighted)),{catalog,seed}).id,choice.id);
  assert.equal(selectReservoirSurface({...weighted,participants:['goaden']},{catalog,seed}),null);
  const memory=createReservoirMemory();memory.plays.set(ids[1],1);
  assert.equal(selectReservoirSurface(weighted,{catalog,seed,memory}).id,ids[0]);
  assert.equal(selectReservoirSurface(weighted,{catalog,seed,memory}),null,'cooldowns remain authoritative');
});
