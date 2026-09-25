import test from 'node:test';
import assert from 'node:assert/strict';
import {WorldStore} from '../experiment-l/src/world.mjs';
import {createFixture} from '../src/fixture.mjs';
import {parityView,parityDigest,PARITY_START,PARITY_DAYS} from './helpers/rhythm-parity.mjs';

// Captured on the actual v29 checkout before RHYTHM edits. Do not regenerate
// these from v30 code to make a regression disappear.
const REFERENCES={
  'silver-clouds-now-v1':{events:'264da324c1220628d7777cd6382a844438b56af6a5197023f21b391ab1ae3f88',state:'b93a9191e61d9c8fef0141b8baa752f5a479fd5cc59dbb57ceb0e841e19ff211',eventCount:749},
  'rhythm-parity-b':{events:'eb9a6083d51fc2e8856512a9c5cb81c92c0a1f12db3d14557222ebfc635f0521',state:'6fd9716a591c4e4a1a190469dd29fa882bddb62b95ce11a73f48b2d1bc18bb0a',eventCount:735},
};
function run(seed,disabled=false){
  const fixture=createFixture({startMs:PARITY_START}),initial=fixture.initialState();
  if(disabled)initial.rhythm.enabled=false;else delete initial.rhythm;
  const world=new WorldStore({dbPath:':memory:',seed,fixture:{...fixture,initialState:()=>structuredClone(initial)}});
  try{world.advance(PARITY_START+PARITY_DAYS*86400000);return world.semanticSnapshot();}finally{world.close();}
}
for(const [seed,expected]of Object.entries(REFERENCES))test(`preactivation reproduces the captured v29 ledger and state: ${seed}`,()=>{
  const snapshot=run(seed);
  assert.deepEqual(parityDigest(parityView(snapshot)),expected);
  assert.ok(!snapshot.events.some(e=>e.type==='RHYTHM_CHOOSE'));
  assert.ok(!snapshot.pendingActions.some(a=>a.type==='RHYTHM_CHOOSE'||a.rhythm));
});

test('explicitly disabled stored RHYTHM preserves behaviour and queue while CSV honestly measures its extra bytes',()=>{
  const seed='silver-clouds-now-v1',absent=run(seed),disabled=run(seed,true);
  assert.deepEqual(disabled.pendingActions,absent.pendingActions);
  assert.deepEqual(disabled.rhythm,{...createFixture({startMs:PARITY_START}).initialState().rhythm,enabled:false});
  assert.ok(disabled.narrativeSignals.csv.lastEvaluation.cloneBytes>absent.narrativeSignals.csv.lastEvaluation.cloneBytes);
  // Keeping an inert canonical bag really does cost clone bytes. Preserve that
  // diagnostic (and the unchanged hard budget) in the engine. The explicit
  // disabled-state comparison alone normalizes it; captured v29 hashes above
  // are completely unmodified, including their CSV diagnostics.
  const normalize=value=>JSON.parse(JSON.stringify(value,(_key,item)=>item?.processedActions&&item?.opportunityId&&item?.logWeights
    ?{...item,cloneBytes:'measured canonical size'}:item));
  assert.deepEqual(normalize(parityView(disabled)),normalize(parityView(absent)));
});
