import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFixture } from '../src/fixture.mjs';
import { SCENE_BANK_CATALOG, SCENE_BANK_BY_ID } from '../src/scene-bank-catalog.mjs';
import { sceneBankAfterAction, sceneSpent, SCENE_BANK_RULES } from '../src/scene-bank.mjs';
import { reservoirSceneEligible } from '../src/scene-reservoir-catalog.mjs';
import { VENUE_SCENES } from '../src/venues.mjs';
import { sceneEditorial } from '../src/editorial-scenes.mjs';
import { DIRECTOR_RULES, directorDecision, tickContext } from '../src/director.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { applyChange } from '../src/ledger.mjs';

// The two lifecycles, the gates, and the seams between the bank and the rest
// of the world. These are the properties the reservoir work rests on, written
// down so that a later change to the bank cannot quietly undo one of them.

const START=atLondon('2026-09-09','00:00'), DAY=24*60*MIN;
const fixture=createFixture({startMs:START});
function harness() {
  const state=fixture.initialState(), events=[];
  const run=a=>{
    const before=structuredClone(state), result=fixture.reduceAction(state,a,'lifecycle-tests');
    for(const change of result.event.changes) {
      const target=change.entity==='character'?before.characters[change.id]
        :change.entity==='relationship'?before.relationships.find(r=>`${r.from}->${r.to}`===change.id):before;
      applyChange(target,change,'after');
    }
    assert.deepEqual(before,state,'all scene changes must be replayable');
    events.push(result.event);return result;
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
    sceneBankAfterAction({state,now,event,id:event.id,action:{id:event.id,type},seed:'lifecycle-tests',followups,
      ops:{setSceneBank:value=>{state.sceneBank=value;}}});
    return followups;
  };
  const complete=first=>{
    let result=run(first);
    if(first.type==='SCENE_BANK_GATHER') result=run(result.followups.find(a=>a.type==='SCENE_BANK_BEAT'));
    return result.event;
  };
  return {state,events,run,place,probe,complete};
}
const surface=(id,over={})=>({id,status:'enabled',cast:['goaden','ashai'],dependencies:[],
  effectPolicy:'surface_only',reservoir:{family:'f',cooldown:{sceneDays:30,familyHours:36,pairHours:8}},...over});
const record=(at,plays=1)=>({eventId:`evt:${at}`,at,lastAt:at,plays});

test('a consequential scene stays spent for ever; a surface-only scene comes back after its own cooldown',()=>{
  const now=START+100*DAY;
  for (const scene of SCENE_BANK_CATALOG.filter(s=>s.status!=='excluded' && !s.reservoir)) {
    assert.equal(scene.effectPolicy,undefined,`${scene.id}: the authored bank carries no surface marker of its own`);
    assert.ok(sceneSpent({completed:{[scene.id]:record(START)}},scene,now),`${scene.id} must not replay`);
  }
  const s=surface('R:test');
  assert.equal(sceneSpent({completed:{}},s,now),false,'never played is not spent');
  assert.equal(sceneSpent({completed:{'R:test':record(now-29*DAY)}},s,now),true,'inside its own cooldown');
  assert.equal(sceneSpent({completed:{'R:test':record(now-31*DAY)}},s,now),false,'past its own cooldown');
  const unmarked={...s,effectPolicy:undefined};
  assert.equal(sceneSpent({completed:{'R:test':record(now-400*DAY)}},unmarked,now),true,
    'reuse is an opt-in: without the marker a year is not long enough');
});

test('neighbours are respected: the same family, or the same two people, too recently',()=>{
  const now=START+100*DAY;
  const a=surface('R:a'), sibling=surface('R:sib'), cousin=surface('R:cousin',{reservoir:{family:'g',cooldown:{sceneDays:30,familyHours:36,pairHours:8}}});
  const trio=surface('R:trio',{cast:['goaden','ashai','yukon'],reservoir:{family:'g',cooldown:{sceneDays:30,familyHours:36,pairHours:8}}});
  const catalog=[a,sibling,cousin,trio];
  const bank=(id,ago)=>({completed:{[id]:record(now-ago)}});
  assert.equal(sceneSpent(bank('R:sib',35*60*MIN),a,now,catalog),true,'same family inside familyHours');
  assert.equal(sceneSpent(bank('R:sib',37*60*MIN),a,now,catalog),false,'same family once the hours have passed');
  assert.equal(sceneSpent(bank('R:cousin',7*60*MIN),a,now,catalog),true,'same two people inside pairHours');
  assert.equal(sceneSpent(bank('R:cousin',9*60*MIN),a,now,catalog),false,'same two people once the hours have passed');
  assert.equal(sceneSpent(bank('R:trio',1*MIN),a,now,catalog),false,'a different cast is not a pair collision');
  assert.equal(sceneSpent(bank('R:sib',1*MIN),{...a,effectPolicy:undefined},now,catalog),false,
    'neighbour rules belong to surface material; an unmarked scene answers only for itself');
});

test('every prerequisite-gated scene has an explicit handler; none is left to the default',()=>{
  const source=readFileSync(new URL('../src/scene-bank.mjs',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('function guardedPrerequisite'),source.indexOf('function holderPresent'));
  const handled=new Set([...body.matchAll(/case '([A-Z]\d+)'/g)].map(m=>m[1]));
  const gated=SCENE_BANK_CATALOG.filter(s=>s.status==='prerequisite_gated').map(s=>s.id);
  assert.equal(gated.length,34);
  assert.deepEqual(gated.filter(id=>!handled.has(id)),[],'a gated scene with no case is dead and does not say so');
});

test('Part Two is sealed: B6 is excluded like its siblings and can never be booked',()=>{
  for (const id of ['B1','B2','B3','B4','B5','B6','B7','B8']) assert.equal(SCENE_BANK_BY_ID[id].status,'excluded',id);
  assert.match(SCENE_BANK_BY_ID.B6.gate,/after the betrayal/);
  const h=harness(), now=START+15*60*MIN; h.place(now,'mi6','training');
  for (let t=0;t<20;t++) assert.ok(!h.probe(now+t*DAY,{area:'training'}).some(a=>a.sceneBankId==='B6'));
});

test('every venue scene reaches the page with a staging line, not bare dialogue',()=>{
  const bare=[];
  for (const [venue,scenes] of Object.entries(VENUE_SCENES)) for (const scene of scenes) {
    const event={type:'VENUE_SCENE',visibility:'public',location:venue,participants:['goaden','ashai'],lines:scene.lines,payload:{venue}};
    if(!sceneEditorial(event)?.prose) bare.push(`${venue}:${scene.id??scene.summary}`);
  }
  assert.equal(Object.values(VENUE_SCENES).flat().length,41);
  assert.deepEqual(bare,[]);
});

test('a performed ordinary scene is single-use end to end, records one performance, and creates exactly one fact',()=>{
  const h=harness(), now=START+15*60*MIN; h.place(now);
  const first=h.probe(now).find(a=>a.type==='SCENE_BANK_BEAT'||a.type==='SCENE_BANK_GATHER');
  assert.ok(first,'an ordinary scene is offered');
  const performed=h.complete(first), id=performed.payload.sceneBankId, done=h.state.sceneBank.completed[id];
  assert.equal(done.plays,1); assert.equal(done.lastAt,done.at); assert.equal(done.eventId,done.lastEventId);
  assert.ok(h.state.facts[`scene-bank:${id}`],'first performance makes the fact');
  assert.equal(h.state.sceneBank.lastPerformedAt,done.at);
  const later=now+200*DAY; h.place(later);
  assert.ok(!h.probe(later).some(a=>a.sceneBankId===id),'never offered again');
  assert.ok(sceneSpent(h.state.sceneBank,SCENE_BANK_BY_ID[id],later));
});

test('authored prose does not reset the director’s quiet, and the two only share a short spacing window',()=>{
  const h=harness(), now=START+15*60*MIN; h.place(now);
  const quietBefore=h.state.director.lastNotableAt;
  const first=h.probe(now).find(a=>a.type==='SCENE_BANK_BEAT'||a.type==='SCENE_BANK_GATHER');
  const performed=h.complete(first);
  assert.equal(performed.visibility,'public'); assert.ok(performed.participants.length>=2);
  assert.equal(h.state.director.lastNotableAt,quietBefore,'a scene-bank beat is not the world being eventful at them');
  // A real tick context off the real state, with the director's own clocks
  // cleared so the only thing that can say no is the spacing window.
  const at=performed.occurredAt+5*MIN;
  h.state.director={...h.state.director,lastNotableAt:0,lastBeatAt:null,beatsToday:0,recent:[]};
  const context=t=>tickContext({state:h.state,now:t,day:londonDate(t),weather:h.state.weather,factions:h.state.factions});
  assert.equal(directorDecision(context(at),'s','k').reason,'after_authored_scene');
  const clear=performed.occurredAt+(DIRECTOR_RULES.spacingMinutes+1)*MIN;
  assert.notEqual(directorDecision(context(clear),'s','k').reason,'after_authored_scene','the window is short and then it is over');
  assert.ok(SCENE_BANK_RULES.ordinaryGap===12*60*MIN,'the bank keeps its own cadence; nothing here tuned it');
});

test('reservoir prose is presentation-only: the bank never books a reservoir SCENE_BANK_BEAT',()=>{
  const h=harness(), now=START+15*60*MIN; h.place(now);
  h.state.sceneBank={...(h.state.sceneBank??{}),version:1,completed:Object.fromEntries(SCENE_BANK_CATALOG
    .filter(s=>!s.reservoir&&!s.id.startsWith('P')).map(s=>[s.id,{eventId:'evt:spent',at:START,cast:[]}])),knowledge:{},proofs:{},pending:null,session:null,
    nextEligibleAt:0,nextNimbusAt:0,nimbus:{arrivedAt:null,holder:null,place:null,knownBy:{},bounty:null,report:null,damage:{},feeders:[],namedAt:null}};
  assert.ok(SCENE_BANK_CATALOG.some(s=>s.reservoir),'reservoir entries remain in the catalogue for historical beats');
  for (const actor of ['goaden','ashai'].map(id=>h.state.characters[id])) {
    actor.activity='unhurried_time'; actor.activitySince=now-20*MIN;
  }
  assert.deepEqual(h.probe(now,{type:'ACTIVITY_COMPLETE'}).filter(a=>String(a.sceneBankId).startsWith('R:')),[],
    'reservoir size must not mint scene-bank actions');
  assert.deepEqual(h.probe(now,{type:'TRAVEL_DEPART',location:'streamliner',area:'transit'}),[]);
});
