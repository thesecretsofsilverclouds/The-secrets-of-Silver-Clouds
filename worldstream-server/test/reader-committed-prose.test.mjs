import test from 'node:test';
import assert from 'node:assert/strict';
import { forwardReadingEvents } from '../../worldstream/app/reader-narrative.js';

const at=Date.parse('2026-09-10T12:00:00Z');
const event=(id,offset,extra={})=>({id,occurredAt:at+offset,location:'mi6',room:'the music room',
  participants:['goaden'],type:'INTENT_COMPLETE',register:'ticker',
  description:'Goaden finished the piano passage and closed the score.',...extra});
const wording=row=>({prose:row.readerProse,description:row.readerDescription});

test('a completed piano pursuit is never replaced with an inferred game result',()=>{
  const committed=event('piano-complete',0);
  const before=structuredClone(committed),[row]=forwardReadingEvents([committed]);
  assert.equal(row.readerDescription,committed.description);
  assert.equal(row.readerProse,'');assert.deepEqual(committed,before);
});
test('a real corridor crossing keeps its committed location and words when retained as context',()=>{
  const crossing=event('crossing',0,{type:'CROSS_PATHS',room:'the MI6 corridors',participants:['goaden','ashai'],
    description:'Ashai met Goaden outside the music room; he was carrying the score.'});
  const response=event('response',60000,{type:'INTENT_RESPONSE',room:'the MI6 corridors',
    description:'Ashai asked him about the score.',contextBridge:{originEventId:crossing.id,snippet:crossing.description}});
  const row=forwardReadingEvents([crossing,response]).find(item=>item.id===crossing.id);
  assert.ok(row.readerWeight>0);assert.equal(row.readerDescription,crossing.description);
  assert.equal(row.readerProse,'');
});
test('loading an older page cannot select a different passage for the same committed event',()=>{
  const current=event('current',0),earlier=event('earlier',-86400000,{description:'Goaden finished a different piano passage.'});
  const initial=forwardReadingEvents([current])[0];
  const expanded=forwardReadingEvents([current],undefined,{history:[earlier]})[0];
  const paged=forwardReadingEvents([earlier,current]).find(row=>row.id===current.id);
  assert.deepEqual(wording(expanded),wording(initial));assert.deepEqual(wording(paged),wording(initial));
});
test('committed authored scenes and domestic prose survive reader rendering without stock substitutions',()=>{
  const prose='Kai landed on the back of Goaden’s chair. “You missed a bit.” Goaden looked up. “Helpful.”';
  const domestic=event('domestic',0,{type:'INTENT_COMPLETE',register:'prose',prose,description:'Goaden cleaned his sword with Kai watching.'});
  const scene=event('authored',60000,{type:'SCENE_BANK_BEAT',register:'prose',prose,
    sceneBeats:[{kind:'prose',text:prose}],participants:['goaden','kai']});
  const rows=forwardReadingEvents([domestic,scene]);
  assert.equal(rows[0].readerProse,prose);assert.equal(rows[1].readerProse,prose);
  assert.equal(rows[1].sceneBeats,scene.sceneBeats);
  assert.equal(rows[0].readerDescription,domestic.description);
});
