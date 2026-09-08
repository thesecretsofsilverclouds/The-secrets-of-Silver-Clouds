import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveMemories, deriveCarrying, publicNarrativeBlock, summariseMemory } from '../src/narrative.mjs';

const DAY=86_400_000;
function fixture() {
  const source={id:'attempt-result',type:'OFFSCREEN_RESULT',occurredAt:100,visibility:'public',location:'mi6',area:'gaming_room',
    participants:[],publicDescription:'Yukon left the game section unfinished.',payload:{},changes:[]};
  const fact={key:'attempt',kind:'offscreen_result',subject:'yukon',createdAt:100,sourceEventId:source.id,
    validUntil:null,value:{guest:'yukon',family:'game_retry',outcome:'unfinished',presentationText:source.publicDescription}};
  return {world:{resolvedThrough:300},facts:{attempt:fact},events:[source,
    {id:'telling',type:'OFFSCREEN_ENCOUNTER',occurredAt:200,visibility:'public',publicDescription:'Goaden heard about the attempt.'}],
    characters:{goaden:{knowledge:[],conditions:[],location:'mi6',area:'common_room'},
      ashai:{knowledge:[],conditions:[],location:'mi6',area:'common_room'}},relationships:[]};
}
function learn(state) {state.characters.goaden.knowledge.push({factKey:'attempt',sourceEventId:'attempt-result',acquisitionEventId:'telling',
  learnedAt:200,validUntil:null,provenance:'told_by_participant'});}

test('readers can see an offscreen result while neither protagonist knows it',()=>{
  const state=fixture(); const before=structuredClone(state);
  for(const id of ['goaden','ashai']) assert.deepEqual(deriveMemories(state,id,300),[]);
  assert.deepEqual(state,before);
  learn(state);
  assert.deepEqual(deriveMemories(state,'goaden',199),[]);
  const memory=deriveMemories(state,'goaden',300)[0];
  assert.equal(memory.acquiredVia,'told');assert.equal(memory.sourceEvent,'attempt-result');
  assert.match(memory.summary,/Yukon.*game section.*unfinished/);
  assert.deepEqual(deriveMemories(state,'ashai',300),[]);
});

test('private, future, and mismatched evidence cannot furnish public memory',()=>{
  for(const corrupt of [state=>state.events[0].visibility='private',state=>state.events[0].occurredAt=500,
    state=>state.facts.attempt.createdAt=500,state=>state.facts.attempt.sourceEventId='different-source']) {
    const state=fixture();learn(state);corrupt(state);
    assert.deepEqual(deriveMemories(state,'goaden',300),[]);
  }
});

test('a recent learned conversation may foreground an older incident without erasing it',()=>{
  const state=fixture();learn(state);
  const now=8*DAY, actor=state.characters.goaden;
  state.events[1].occurredAt=now-60_000;actor.knowledge[0].learnedAt=now-60_000;
  state.facts.incident={key:'incident',kind:'incident',subject:'goaden',createdAt:100,sourceEventId:'alarm',
    value:{kind:'breach',severity:'high'}};
  state.events.push({id:'alarm',occurredAt:100,visibility:'public',publicDescription:'The perimeter alarm cut through MI6.'});
  actor.knowledge.push({factKey:'incident',sourceEventId:'alarm',acquisitionEventId:'alarm',learnedAt:100,validUntil:null,provenance:'lived_through'});
  const echo=deriveCarrying(state,'goaden',now);
  assert.equal(echo.because.sourceEvent,'attempt-result');assert.match(echo.echo,/What Yukon said/);
  assert.ok(deriveMemories(state,'goaden',now).some(memory=>memory.kind==='incident'));
  const before=structuredClone(state);for(let i=0;i<5;i++)deriveCarrying(state,'goaden',now);
  assert.deepEqual(state,before);
});

test('expired conditions do not overshadow a real later memory, and public projection hides raw knowledge',()=>{
  const state=fixture();learn(state);
  state.characters.goaden.conditions=[{kind:'ordinary_fatigue',since:1,until:100,sourceEventId:'private-fatigue'}];
  assert.match(deriveCarrying(state,'goaden',300).echo,/Yukon/);
  state.characters.goaden.knowledge[0].privateThought='PRIVATE_THOUGHT';
  state.facts.attempt.value.privateNote='PRIVATE_NOTE';
  const projected=JSON.stringify(publicNarrativeBlock(state,300));
  assert.doesNotMatch(projected,/PRIVATE_|private-fatigue|"knowledge"|"factKey"|"sourceEventId"|"acquisitionEventId"/);
});

test('remembered subjects distinguish characters and do not interpolate unknown names',()=>{
  assert.match(summariseMemory('offscreen_result',{guest:'gabriel',outcome:'settled'}),/Gabriel.*last line.*came together/);
  assert.match(summariseMemory('offscreen_help',{guest:'rose'}),/Rose.*rhythm/);
  assert.doesNotMatch(summariseMemory('offscreen_help',{guest:'PRIVATE_CHARACTER'}),/PRIVATE/);
  assert.doesNotThrow(()=>summariseMemory('offscreen_result',{guest:'__proto__'}));
});
