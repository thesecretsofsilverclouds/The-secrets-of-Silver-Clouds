import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldStore} from '../experiment-l/src/world.mjs';
import {createFixture,publicProjection} from '../src/fixture.mjs';
import {atLondon} from '../src/time.mjs';

const startMs=atLondon('2026-09-05','00:00'),seed='silver-clouds-now-v1',fixture=createFixture({startMs});
function setup(){
  const store=new WorldStore({dbPath:':memory:',seed,fixture});
  try{
    store.advance(startMs+1);
    const action=store.semanticSnapshot().pendingActions.find(a=>a.type==='RHYTHM_CHOOSE');
    assert.ok(action);store.advance(action.dueAt-1);
    const {world,events,pendingActions,...state}=store.semanticSnapshot();
    return {state,action,context:{pendingActions,resolvedThrough:world.resolvedThrough},world,events};
  }finally{store.close();}
}
function reduce(input,action=input.action){return fixture.reduceAction(input.state,action,seed,input.context);}

test('a canonical free slot schedules one legal routine at exactly its original time and duration',()=>{
  const input=setup(),before=structuredClone(input.state.rhythm);
  const {event,followups}=reduce(input);
  assert.equal(event.visibility,'private');assert.ok(event.payload.scores.length);
  assert.ok(event.payload.scores.every(row=>row.type!=='PIANO_BEGIN'&&row.type!=='PRACTICE_BEGIN'));
  assert.deepEqual(input.state.rhythm,before,'choosing is not completing');
  assert.equal(followups.length,1);
  assert.equal(followups[0].id,input.action.legacyId);
  assert.equal(followups[0].dueAt,input.action.slotAt);
  assert.equal(followups[0].duration,input.action.duration);
  assert.equal(followups[0].rhythm.decisionEventId,event.id);
});

for(const kind of ['shifted time','invented slot','changed duration','changed actor'])test(`RHYTHM refuses a ${kind}`,()=>{
  const input=setup(),before=structuredClone(input.state),action={...input.action};
  if(kind==='shifted time')action.slotAt+=60000;
  if(kind==='invented slot')action.id+='/extra';
  if(kind==='changed duration')action.duration+=60;
  if(kind==='changed actor')action.actor='goaden';
  const result=reduce(input,action);
  assert.equal(result.event.payload.outcome,'skipped');assert.deepEqual(result.followups,[]);
  assert.deepEqual(input.state,before);
});

for(const blocker of ['current duty','accepted commitment','impending duty'])test(`RHYTHM cannot replace ${blocker}`,()=>{
  const input=setup(),actor=input.state.characters[input.action.actor];
  if(blocker==='current duty'){actor.activity='on_call';actor.activityUntil=input.action.slotAt+7200000;}
  if(blocker==='accepted commitment')input.state.arrangements['test:prior-commitment']={status:'accepted',party:[actor.id],
    startAt:input.action.slotAt+60000,until:input.action.slotAt+1800000};
  if(blocker==='impending duty')input.context.pendingActions.push({id:'test:existing-duty',type:'BRIEFING_BEGIN',actor:actor.id,
    dueAt:input.action.slotAt+60000,priority:10,duration:30});
  const before=structuredClone(input.state),result=reduce(input);
  assert.equal(result.event.payload.outcome,'skipped');assert.deepEqual(result.followups,[]);
  assert.deepEqual(input.state,before,'blocked decision must change no canonical truth');
});

test('a duty arriving after a choice wins again at the actual start, with no invented retry or habit',()=>{
  const input=setup(),choice=reduce(input),routine=choice.followups[0];
  input.state.characters[routine.actor].activity='on_call';
  input.state.characters[routine.actor].activityUntil=routine.dueAt+3600000;
  const before=structuredClone(input.state),result=reduce(input,routine);
  assert.equal(result.event.payload.outcome,'skipped');assert.deepEqual(result.followups,[]);
  assert.deepEqual(input.state,before);
});

test('completion ownership prevents interrupted and forged completions from earning habit',()=>{
  for(const forged of [false,true]){
    const input=setup(),choice=reduce(input),routine=choice.followups[0],started=reduce(input,routine);
    const completion=started.followups.find(a=>a.type==='ACTIVITY_COMPLETE');assert.ok(completion);
    if(forged)completion.rhythm.family='invented-family';
    else input.state.characters[routine.actor].activityId='another-real-activity';
    const before=structuredClone(input.state.rhythm),result=reduce(input,completion);
    assert.equal(result.event.payload.outcome,'skipped');assert.deepEqual(input.state.rhythm,before);
  }
});

test('a successful owned completion, and no earlier decision or start, earns its habit',()=>{
  const input=setup(),before=structuredClone(input.state.rhythm),choice=reduce(input),routine=choice.followups[0];
  const started=reduce(input,routine),label=input.state.characters[routine.actor].activity;
  assert.deepEqual(input.state.rhythm,before);
  const completion=started.followups.find(a=>a.type==='ACTIVITY_COMPLETE');assert.ok(completion);
  const finished=reduce(input,completion);assert.notEqual(finished.event.payload.outcome,'skipped');
  assert.ok(input.state.rhythm.actors[routine.actor].habits[label]>before.actors[routine.actor].habits[label]);
  assert.equal(input.state.rhythm.actors[routine.actor].history.at(-1).label,label);
});

test('private RHYTHM choices and pending routine tags never leak through public projection',()=>{
  const input=setup(),choice=reduce(input);
  const snapshot={...input.state,world:{...input.world,resolvedThrough:input.action.dueAt},
    events:[...input.events,{seq:input.events.length+1,...choice.event}],pendingActions:choice.followups};
  const projected=publicProjection(snapshot),serialized=JSON.stringify(projected);
  for(const forbidden of ['RHYTHM_CHOOSE','rhythm-v1','"needs"','"habits"','"scores"','"rhythm"'])
    assert.ok(!serialized.includes(forbidden),forbidden);
  const person=projected.characters.find(c=>c.id===input.action.actor);
  assert.ok(!(person.upcoming??[]).some(item=>item.at===input.action.slotAt),'unperformed private choice is not a public announcement');
});
