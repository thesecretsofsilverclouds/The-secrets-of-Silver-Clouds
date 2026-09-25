import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server.mjs';
import { openWorld } from '../src/world.mjs';
import { CinematicService, ViewerRegistry } from '../src/cinematic-service.mjs';
import { openCinematicStore } from '../src/cinematic-store.mjs';
import { createSceneReservoirRuntime } from '../src/scene-reservoir-runtime.mjs';
import { SceneReservoirRefill } from '../src/scene-reservoir-refill.mjs';
import { readProductionPathSpies, resetProductionPathSpies } from '../src/production-path-spies.mjs';
import { WorldDurableObject } from '../cloudflare/src/world-durable-object.mjs';
import { createMockSqlStorage } from '../cloudflare/src/sqlite-adapter.mjs';
import { atLondon } from '../src/time.mjs';

const START=atLondon('2026-09-20','00:00'), NOW=START+3_600_000;
const enabledEnv={RESERVOIR_REFILL_ENABLED:'true',WORLDSTREAM_CINEMATICS_ENABLED:'true',OPENAI_API_KEY:'test-only'};
const noCalls=()=>assert.deepEqual(readProductionPathSpies(),{modelCalls:0,requestTimeAuthoring:0,refillReservations:0});

test('Node reader routes cannot generate or claim even with an enabled injected service and live viewers',async t=>{
  resetProductionPathSpies();
  const canonical=openWorld({dbPath:':memory:',startMs:START,seed:'no-llm'});canonical.advance(NOW);
  const store=openCinematicStore({dbPath:':memory:'}),viewers=new ViewerRegistry();viewers.touch('present',NOW-2000);
  t.after(()=>{canonical.close();store.close();});
  const snapshot=canonical.semanticSnapshot();
  const event={seq:999999,id:'evt:no-llm-worthy',occurredAt:NOW-1000,type:'INCIDENT',visibility:'public',
    location:'mi6',area:'ops_room',participants:['goaden','ashai'],payload:{kind:'breach',severity:'critical'},
    publicDescription:'The perimeter alarm cut through MI6.',prose:'The perimeter alarm cut through MI6.'};
  // A deliberately worthy, current committed-event fixture exercises the
  // branch that previously called the model; an empty feed cannot pass this.
  snapshot.events.push(event);
  const client=t.mock.fn(async()=>{throw new Error('runtime attempted a model');});
  const service=new CinematicService({store,client,now:()=>NOW,getPresence:()=>viewers.snapshot(NOW),
    config:{enabled:true,model:'mock',minScore:0,minSceneGapMs:0}});
  const generate=t.mock.method(service,'generate'),claim=t.mock.method(store,'claim');
  const world={db:canonical.db,advance:at=>canonical.advance(at),publicProjection:()=>canonical.publicProjection(),
    semanticSnapshot:()=>snapshot,presentationSnapshot:()=>snapshot,eventById:id=>id===event.id?event:canonical.eventById(id)};
  const server=createApp({world,cinematicStore:store,cinematicService:service,viewerRegistry:viewers,
    cinematicOptions:{enabled:true,minScore:0},now:()=>NOW});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const base=`http://127.0.0.1:${server.address().port}`;
  for(let round=0;round<3;round++) for(const [path,method,body] of [
    ['/api/presence','POST'],['/api/observe','POST'],['/api/cinematics/live','GET']]) {
    const response=await fetch(`${base}${path}`,{method,...(body?{body,headers:{'content-type':'application/json'}}:{})});
    assert.equal(response.status,200,await response.text());
  }
  assert.equal(store.get(event.id)?.status,'fallback','authored fallback remains performable');
  assert.ok(store.get(event.id).scene);
  assert.equal(client.mock.callCount(),0);assert.equal(generate.mock.callCount(),0);assert.equal(claim.mock.callCount(),0);
  assert.equal(store.budget('2026-09-20').calls,0);noCalls();
  const status=await (await fetch(`${base}/api/cinematics/status`)).json();assert.equal(status.enabled,false);
});

test('maintenance stays health-only even when legacy environment flags and authoring state are enabled',t=>{
  resetProductionPathSpies();const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec('CREATE TABLE scene_refill_state(id INTEGER PRIMARY KEY,state_json TEXT NOT NULL)');
  const stored=JSON.stringify({version:1,pending:{},attempts:[],quarantine:[]});
  db.prepare('INSERT INTO scene_refill_state VALUES(1,?)').run(stored);
  const tick=t.mock.method(SceneReservoirRefill.prototype,'tick');
  const fetchSpy=t.mock.method(globalThis,'fetch',async()=>{throw new Error('maintenance attempted network');});
  const runtime=createSceneReservoirRuntime({db,env:enabledEnv});
  for(let day=0;day<3;day++) assert.equal(runtime.tick({},NOW+day*86_400_000).status,'disabled');
  assert.equal(tick.mock.callCount(),0);assert.equal(fetchSpy.mock.callCount(),0);noCalls();
  assert.equal(db.prepare('SELECT state_json FROM scene_refill_state WHERE id=1').get().state_json,stored);
});

test('Cloudflare observe, presence, live and alarms never call models or reserve authoring with enabled flags',async t=>{
  resetProductionPathSpies();const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  t.mock.method(Date,'now',()=>NOW);
  const urls=[];
  t.mock.method(globalThis,'fetch',async url=>{urls.push(String(url));return new Response('',{status:503});});
  let nextAlarm=null;const background=[];
  const ctx={storage:{sql:createMockSqlStorage(db),async setAlarm(at){nextAlarm=at;},async getAlarm(){return nextAlarm;}},
    getWebSockets(){return [];},waitUntil(p){background.push(p);}};
  const runtime=new WorldDurableObject(ctx,{...enabledEnv,START_MS:START,WORLD_SEED:'no-llm-cf'});
  const tick=t.mock.method(SceneReservoirRefill.prototype,'tick');
  for(let round=0;round<2;round++) {
    for(const [path,method] of [['/api/presence','GET'],['/api/observe','POST'],['/api/cinematics/live','GET']]) {
      const response=await runtime.fetch(new Request(`https://local.test${path}`,{method}));assert.equal(response.status,200);
    }
    await runtime.alarm();
  }
  await Promise.all(background);
  assert.ok(nextAlarm>NOW);assert.equal(tick.mock.callCount(),0);noCalls();
  assert.ok(urls.every(url=>url.startsWith('https://api.open-meteo.com/')),'weather is the only allowed external call');
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scene_refill_state'").get(),undefined);
});
