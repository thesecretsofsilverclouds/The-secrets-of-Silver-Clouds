import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixture } from '../src/fixture.mjs';
import { SCENE_BANK_CATALOG, SCENE_BANK_BY_ID, SCENE_BANK_MANIFEST } from '../src/scene-bank-catalog.mjs';
import { SCENE_RESERVOIR_CATALOG } from '../src/scene-reservoir-catalog.mjs';
import { initialSceneBank, sceneBankAfterAction, sceneBankAvailable, assertSceneBank } from '../src/scene-bank.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { areaOf, SEALED_AREAS } from '../src/places.mjs';
import { CHARACTER_PLATES } from '../src/cinematic-assets.mjs';
import { applyChange } from '../src/ledger.mjs';

const START=atLondon('2026-09-09','00:00'), DAY=24*60*MIN;
const fixture=createFixture({startMs:START});
function harness() {
  const state=fixture.initialState(), events=[], queue=[];
  const run=a=>{
    const before=structuredClone(state), result=fixture.reduceAction(state,a,'scene-bank-tests');
    // The production ledger alone must reconstruct every mutation from a
    // scene, including lazy activation, knowledge and interrupted gatherings.
    for(const change of result.event.changes) {
      const target=change.entity==='character'?before.characters[change.id]
        :change.entity==='relationship'?before.relationships.find(r=>`${r.from}->${r.to}`===change.id):before;
      applyChange(target,change,'after');
    }
    assert.deepEqual(before,state,'all scene changes must be replayable');
    events.push(result.event);queue.push(...result.followups);return result;
  };
  const place=(now,location='mi6',area='common_room')=>{
    for(const actor of Object.values(state.characters)) Object.assign(actor,{location,area,journey:null,
      activity:location==='big_ben_plaza'?'walking_the_city':'unhurried_time',
      activitySince:now-20*MIN,activityUntil:null,activityId:`present:${now}:${actor.id}`});
  };
  const probe=(now,{cast=['goaden','ashai'],type='ACTIVITY_COMPLETE',location=state.characters.goaden.location,
    area=state.characters.goaden.area,payload={}}={})=>{
    const event={id:`source:${now}`,type,occurredAt:now,visibility:'public',publicDescription:'An actual local opportunity.',
      participants:cast,location,area,payload}, followups=[];
    sceneBankAfterAction({state,now,event,id:event.id,action:{id:event.id,type},seed:'scene-bank-tests',followups,
      ops:{setSceneBank:value=>{state.sceneBank=value;}}});
    return followups;
  };
  const take=(actions,type)=>actions.find(a=>a.type===type);
  const complete=first=>{
    let result=run(first);
    if(first.type==='SCENE_BANK_GATHER') result=run(take(result.followups,'SCENE_BANK_BEAT'));
    return result.event;
  };
  return {state,events,queue,run,place,probe,complete};
}

test('every source scene has an explicit status; sealed and future material cannot slip into the enabled bank',()=>{
  assert.equal(SCENE_BANK_MANIFEST.length,134+SCENE_RESERVOIR_CATALOG.length);
  assert.equal(new Set(SCENE_BANK_MANIFEST.map(s=>s.id)).size,134+SCENE_RESERVOIR_CATALOG.length);
  for(const s of SCENE_BANK_MANIFEST) {
    assert.ok(['enabled','prerequisite_gated','excluded'].includes(s.status));
    if(s.status!=='enabled') assert.ok(s.gate,`${s.id} lacks a reason`);
  }
  for(const id of ['A1','A12','D4','D7','I4','I6','K2','K4','L6']) assert.equal(SCENE_BANK_BY_ID[id].status,'excluded');
  assert.ok(SEALED_AREAS.includes('basement'));
  assert.ok(areaOf('mi6','rooftop'));assert.ok(areaOf('mi6','reception'));assert.ok(areaOf('big_ben_plaza','gardens'));
});

test('all Nimbus plates exist and every Nimbus performance is silent',()=>{
  assert.deepEqual(CHARACTER_PLATES.nimbus.map(p=>p.emotion).sort(),['angry','happy','showoff','smile','surprised','wink'].sort());
  for(const scene of SCENE_BANK_CATALOG) assert.ok(!scene.beats.some(beat=>beat.who==='nimbus'&&beat.kind==='dialogue'));
});

test('saved pre-feature state activates on a committed opportunity without inheriting world age',()=>{
  const h=harness();delete h.state.sceneBank;
  const now=START+200*DAY+14*60*MIN;h.place(now,'big_ben_plaza','venue');
  const actions=h.probe(now);assert.equal(h.state.sceneBank.activatedAt,now);
  assert.equal(h.state.sceneBank.nimbus.arrivedAt,null);
  assert.equal(actions[0].sceneBankId,'P1');
  const event=h.complete(actions[0]);
  assert.equal(event.payload.sceneBankId,'P1');assert.equal(h.state.sceneBank.nimbus.arrivedAt,event.occurredAt);
  h.place(now+60*MIN);h.state.sceneBank.nextEligibleAt=0;
  assert.ok(h.probe(now+60*MIN).every(a=>!['P2','P3','P22'].includes(a.sceneBankId)),'old world age did not unlock months of Nimbus scenes');
});

test('forged actions cannot consume the owned scene and a character leaving prevents performance',()=>{
  const h=harness(), now=START+14*60*MIN;h.place(now,'big_ben_plaza','venue');
  const [action]=h.probe(now), pending=structuredClone(h.state.sceneBank.pending);
  const forged=h.run({...action,sceneBankId:'P22'}).event;
  assert.equal(forged.visibility,'private');assert.deepEqual(h.state.sceneBank.pending,pending);
  h.state.characters.ashai.location='mi6';h.state.characters.ashai.area='common_room';
  const denied=h.run(action).event;assert.equal(denied.visibility,'private');assert.equal(h.state.sceneBank.nimbus.arrivedAt,null);
});

test('an accepted upcoming commitment blocks a Nimbus gathering',()=>{
  const h=harness(), now=START+14*60*MIN;h.place(now,'big_ben_plaza','venue');h.complete(h.probe(now)[0]);
  const later=now+2*DAY;h.place(later);
  h.state.arrangements.busy={status:'accepted',party:['goaden'],startAt:later+MIN,until:later+10*MIN};
  assert.ok(h.probe(later).every(a=>a.sceneBankId!=='P2'));
});

test('all 22 Nimbus scenes can follow actual ordered actions; time, knowledge and the bounty have one causal chain',()=>{
  const h=harness(), first=START+14*60*MIN;h.place(first,'big_ben_plaza','venue');
  h.complete(h.probe(first)[0]);
  const order=['P2','P3','P4','P5','P6','P8','P7','P10','P9','P11','P12','P13','P14','P15','P16','P17','P18','P19','P20','P21','P22'];
  let now=first;
  for(const id of order) {
    const scene=SCENE_BANK_BY_ID[id];
    now=Math.max(now+DAY,h.state.sceneBank.nimbus.arrivedAt+scene.minAgeDays*DAY+MIN);
    // Use actual local clocks for the nightly rooftop scene and daytime staff.
    now=atLondon(londonDate(now),scene.night?'21:30':'14:30');
    h.place(now,scene.location,scene.location==='mi6'?'common_room':'venue');
    if(scene.cast.includes('nimbus') && h.state.sceneBank.nimbus.holder===null && id!=='P5') {
      assert.fail(`unexpected lost Nimbus before ${id}`);
    }
    const actions=h.probe(now), action=actions.find(a=>a.sceneBankId===id);
    assert.ok(action,`${id} should have a real owned gathering; got ${actions.map(a=>a.sceneBankId)}`);
    assert.equal(action.type,'SCENE_BANK_GATHER');
    const gather=h.run(action), next=gather.followups.find(a=>a.type==='SCENE_BANK_BEAT');
    assert.ok(next);assert.equal(next.dueAt-action.dueAt,3*MIN);
    assert.equal(sceneBankAvailable(h.state,scene.cast[0],action.dueAt),false);
    const record=h.run(next).event;
    assert.equal(record.visibility,'public',`${id}: ${record.payload.reason}`);
    assert.equal(record.payload.sceneBankId,id);
    assert.ok(record.causedBy.includes(gather.event.id));
    assert.ok(record.payload.narrativeParagraphs.length);
    if(id==='P3') assert.equal(h.state.sceneBank.nimbus.bounty.issuer,'mi6_higher_leadership');
    if(id==='P10') {assert.ok(h.state.sceneBank.nimbus.knownBy.davis);assert.equal(h.state.sceneBank.nimbus.knownBy.henderson,undefined);}
    if(id==='P9') assert.ok(h.state.sceneBank.nimbus.knownBy.henderson);
    if(id==='P21') {
      assert.deepEqual(record.participants,['emily','nimbus']);
      assert.equal(h.state.sceneBank.knowledge.ashai?.P21,undefined);assert.equal(h.state.sceneBank.knowledge.goaden?.P21,undefined);
    }
    assertSceneBank(h.state);
  }
  assert.equal(Object.keys(h.state.sceneBank.completed).filter(id=>id.startsWith('P')).length,22);
  assert.equal(h.state.sceneBank.nimbus.bounty.status,'withdrawn');
  assert.ok(h.state.sceneBank.nimbus.unfiledBy.henderson);assert.ok(h.state.sceneBank.nimbus.unfiledBy.davis);
  const restored=JSON.parse(JSON.stringify(h.state));assertSceneBank(restored);
});

test('an interrupted gathering never teaches the proposed scene or teleports the interrupted reader',()=>{
  const h=harness(), now=START+14*60*MIN;h.place(now,'big_ben_plaza','venue');h.complete(h.probe(now)[0]);
  const later=now+2*DAY;h.place(later);const action=h.probe(later).find(a=>a.sceneBankId==='P2');
  const gathered=h.run(action), next=gathered.followups.find(a=>a.type==='SCENE_BANK_BEAT');
  Object.assign(h.state.characters.ashai,{activity:'on_call',area:'quarters',activityId:'actual-emergency'});
  const event=h.run(next).event;
  assert.equal(event.visibility,'private');assert.equal(h.state.characters.ashai.area,'quarters');
  assert.equal(h.state.sceneBank.completed.P2,undefined);assert.equal(h.state.sceneBank.knowledge.ashai?.P2,undefined);
});

test('UNEASE and minor scenery neither activate nor schedule the scene bank',()=>{
  const h=harness(),now=START+14*60*MIN;h.place(now,'big_ben_plaza','venue');delete h.state.sceneBank;
  assert.deepEqual(h.probe(now,{type:'UNEASE'}),[]);assert.equal(h.state.sceneBank,undefined);
  assert.deepEqual(h.probe(now+1,{type:'MINOR_ANOMALY'}),[]);assert.equal(h.state.sceneBank,undefined);
});

test('a routine waits for the owned gathering and passage, and survives save/load',()=>{
  const h=harness(),now=START+14*60*MIN;h.place(now,'big_ben_plaza','venue');h.complete(h.probe(now)[0]);
  const later=now+2*DAY;h.place(later);
  const gathered=h.run(h.probe(later).find(a=>a.sceneBankId==='P2'));
  const beat=gathered.followups.find(a=>a.type==='SCENE_BANK_BEAT');
  const before=structuredClone(h.state.characters.goaden),until=h.state.sceneBank.session.until;
  const delayed=h.run({id:'meal-during-gather',type:'MEAL_BEGIN',actor:'goaden',
    dueAt:beat.dueAt-MIN,day:londonDate(later),duration:20});
  assert.equal(delayed.event.visibility,'private');assert.deepEqual(h.state.characters.goaden,before);
  const meal=delayed.followups.find(a=>a.type==='MEAL_BEGIN');assert.equal(meal.dueAt,until+1);
  assert.equal(h.run(beat).event.visibility,'public');
  const loaded=JSON.parse(JSON.stringify(h.state));
  const restored=fixture.reduceAction(loaded,structuredClone(meal),'scene-bank-tests');
  const resumed=h.run(meal);
  assert.deepEqual(loaded,h.state);assert.deepEqual(restored.event,resumed.event);
  assert.equal(h.state.characters.goaden.activity,'eating');assert.equal(h.state.sceneBank.session,null);
});

test('urgent duty explicitly interrupts a gathering without granting its proposed knowledge',()=>{
  const h=harness(),now=START+14*60*MIN;h.place(now,'big_ben_plaza','venue');h.complete(h.probe(now)[0]);
  const later=now+2*DAY;h.place(later);
  const gathered=h.run(h.probe(later).find(a=>a.sceneBankId==='P2'));
  const beat=gathered.followups.find(a=>a.type==='SCENE_BANK_BEAT');
  const duty=h.run({id:'urgent-comms',type:'COMMS_CHECK_BEGIN',actor:'ashai',dueAt:beat.dueAt-MIN,
    day:londonDate(later),duration:20});
  assert.equal(h.state.sceneBank.session,null);
  assert.equal(h.state.sceneBank.lastInterruption.reason,'COMMS_CHECK_BEGIN');
  assert.equal(h.state.sceneBank.lastInterruption.phase,'gathering');
  assert.ok(duty.event.causedBy.includes(gathered.event.id));
  assert.equal(h.run(beat).event.visibility,'private');
  assert.equal(h.state.sceneBank.completed.P2,undefined);assert.equal(h.state.sceneBank.knowledge.ashai?.P2,undefined);
  assert.equal(h.state.characters.ashai.activity,'on_call');
});

test('an ungathered authored passage reserves its participants for its real duration',()=>{
  const h=harness(),now=START+14*60*MIN;h.place(now,'big_ben_plaza','venue');
  const passage=h.complete(h.probe(now)[0]);
  assert.equal(passage.payload.sceneBankId,'P1');
  const session=h.state.sceneBank.session;
  assert.equal(session.performanceEventId,passage.id);assert.equal(session.until-passage.occurredAt,5*MIN);
  const before=structuredClone(h.state.characters);
  const conversation=h.run({id:'simultaneous-conversation',type:'CONVERSATION',actors:['goaden','ashai'],
    dueAt:passage.occurredAt+MIN,day:londonDate(now)}).event;
  assert.equal(conversation.visibility,'private');assert.deepEqual(h.state.characters,before);
});

test('the machine opens one minute later even if duty removes both protagonists; save/reopen preserves the consequence',()=>{
  const h=harness(),first=START+14*60*MIN;h.place(first,'big_ben_plaza','venue');h.complete(h.probe(first)[0]);
  let now=first;
  for(const id of ['P2','P3','P4']) {
    const scene=SCENE_BANK_BY_ID[id];now=Math.max(now+DAY,first+scene.minAgeDays*DAY+MIN);
    now=atLondon(londonDate(now),'14:30');h.place(now,scene.location,scene.location==='mi6'?'common_room':'venue');
    h.complete(h.probe(now).find(a=>a.sceneBankId===id));
  }
  const p4=h.events.find(e=>e.payload.sceneBankId==='P4'&&e.type==='SCENE_BANK_BEAT');
  const next=h.queue.find(a=>a.sceneBankId==='P5');
  assert.equal(next.dueAt,p4.occurredAt+MIN);assert.equal(h.state.sceneBank.nimbus.holder,null);
  assert.equal(h.state.sceneBank.nimbus.place.area,'vending_machine');
  for(const actor of Object.values(h.state.characters)) Object.assign(actor,{location:'mi6',area:'quarters',
    activity:'on_call',activityId:'actual-emergency'});
  const restored=JSON.parse(JSON.stringify(h.state));
  const reopened=fixture.reduceAction(restored,structuredClone(next),'scene-bank-tests');
  const result=h.run(next);
  assert.deepEqual(restored,h.state);assert.deepEqual(reopened.event,result.event);
  assert.equal(result.event.visibility,'public');assert.ok(!result.event.participants.includes('ashai'));
  assert.ok(!result.event.participants.includes('goaden'));assert.doesNotMatch(result.event.prose,/Ashai|Goaden|coat/);
  assert.equal(h.state.sceneBank.nimbus.place.area,'venue');assert.equal(h.state.sceneBank.nimbus.holder,null);
  assert.equal(h.state.sceneBank.knowledge.ashai?.P5,undefined);assert.equal(h.state.sceneBank.knowledge.goaden?.P5,undefined);
});
