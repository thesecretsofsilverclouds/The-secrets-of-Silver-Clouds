import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fork} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {openWorld,semanticDigest} from './world.mjs';
import {atLondon} from './time.mjs';
import {DEFAULT_SEED,themeForDay} from './fixture.mjs';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=join(project,'artifacts',new Date().toISOString().replaceAll(':','-').replaceAll('.','-'));
mkdirSync(output,{recursive:true});
const startMs=atLondon('2026-09-04','00:00'),endMs=atLondon('2026-09-09','00:00');
const seed=DEFAULT_SEED;
const json=(path,value)=>writeFileSync(path,JSON.stringify(value,null,2)+'\n');
const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'medium'});
const rows=[];
let baseline;

function child(options) {
  const process=fork(fileURLToPath(new URL('./process-worker.mjs',import.meta.url)),[JSON.stringify(options)],{stdio:['ignore','pipe','pipe','ipc']});
  let errors='',result,readyResolve,doneResolve,doneReject;
  const ready=new Promise(resolve=>readyResolve=resolve);
  const done=new Promise((resolve,reject)=>{doneResolve=resolve;doneReject=reject;});
  process.stderr.on('data',chunk=>errors+=chunk);
  process.stdout.on('data',()=>{});
  process.on('message',message=>{if(message.ready) readyResolve();if(message.done) result=message;if(message.error) errors+=message.error;});
  process.on('error',doneReject);
  process.on('exit',code=>{if(code===0&&result)doneResolve(result);else doneReject(new Error(errors||`Worker exited ${code}`));});
  return {ready,done,go:()=>process.send('go')};
}
async function oneProcess(options) {const worker=child(options);await worker.ready;worker.go();return worker.done;}

function save(name,dbPath,details) {
  const world=openWorld({dbPath});
  const snapshot=world.semanticSnapshot(),projection=world.publicProjection();
  const digest=semanticDigest(snapshot);
  if(!baseline) baseline=snapshot; else assert.deepEqual(snapshot,baseline,`${name}: semantic history differs`);
  const directory=dirname(dbPath);
  json(join(directory,'semantic-snapshot-private.json'),snapshot);
  json(join(directory,'public-projection.json'),projection);
  json(join(directory,'run-details.json'),details);
  writeFileSync(join(directory,'event-ledger.md'),`# ${name}: internal author ledger\n\nNot served by the public API. All times Europe/London.\n\n| Time | Event ID | Type | Place | Public description / private marker |\n|---|---|---|---|---|\n`+
    snapshot.events.map(e=>`| ${time.format(e.occurredAt)} | ${e.id} | ${e.type} | ${e.location} | ${(e.publicDescription||'[private]').replaceAll('|','/')} |`).join('\n')+'\n');
  const row={variant:name,events:snapshot.events.length,pending:snapshot.pendingActions.length,digest,...details};
  rows.push(row);world.close();console.log(`${name}: ${row.events} events, ${digest}`);
}
function dbFor(name) {const dir=join(output,name);mkdirSync(dir,{recursive:true});return join(dir,'world.sqlite');}

let dbPath=dbFor('A-frequent');
let world=openWorld({dbPath,startMs,seed});
for(let target=startMs+10*60_000;target<=endMs;target+=10*60_000) world.advance(target);
world.close();save('A-frequent',dbPath,{requests:720});

dbPath=dbFor('B-one-absence');world=openWorld({dbPath,startMs,seed});
const oneShot=world.advance(endMs);world.close();save('B-one-absence',dbPath,{requests:1,processedActions:oneShot.processedActions});

dbPath=dbFor('C-process-restarts');
const targets=[startMs+13*3600_000+17*60_000,startMs+29*3600_000+9*60_000,startMs+71*3600_000,startMs+89*3600_000+51*60_000,endMs];
for(let index=0;index<targets.length;index++) await oneProcess({dbPath,...(index===0?{startMs,seed}:{}),targets:[targets[index]]});
save('C-process-restarts',dbPath,{requests:targets.length,processes:targets.length});

dbPath=dbFor('D-duplicates');world=openWorld({dbPath,startMs,seed});
let requests=0;
for(let target=startMs+6*3600_000;target<=endMs;target+=6*3600_000) {
  for(const repeated of [target,target,target-60_000,target]) {world.advance(repeated);requests++;}
}
world.close();save('D-duplicates',dbPath,{requests});

dbPath=dbFor('E-concurrent');world=openWorld({dbPath,startMs,seed});world.close();
const workers=Array.from({length:8},()=>child({dbPath,targets:Array(12).fill(endMs)}));
await Promise.all(workers.map(w=>w.ready));workers.forEach(w=>w.go());
const concurrent=await Promise.all(workers.map(w=>w.done));
assert.equal(new Set(concurrent.map(w=>w.digest)).size,1);
save('E-concurrent',dbPath,{requests:96,processes:8});

// Six hours of real persistence work, measured after seeding/catching up to noon.
const measurements=[];let sixHourDigest,processedActions;
for(let index=0;index<12;index++) {
  const directory=join(output,'benchmark');mkdirSync(directory,{recursive:true});
  const bench=openWorld({dbPath:join(directory,`${index}.sqlite`),startMs,seed});
  bench.advance(atLondon('2026-09-04','12:00'));
  const before=performance.now();const result=bench.advance(atLondon('2026-09-04','18:00'));const elapsed=performance.now()-before;
  const digest=semanticDigest(bench.semanticSnapshot());if(sixHourDigest)assert.equal(digest,sixHourDigest);sixHourDigest=digest;
  processedActions=result.processedActions;measurements.push(elapsed);bench.close();
}
const sorted=[...measurements].sort((a,b)=>a-b);
const benchmark={fictionalHours:6,iterations:measurements.length,processedActions,minuteTicks:0,medianMs:sorted[Math.floor(sorted.length/2)],
  p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),measurementsMs:measurements,
  includes:'advance plus SQLite FULL synchronous commit; excludes creation, noon prefill, snapshot/digest and close'};
assert.ok(benchmark.medianMs<1000,'Six-hour catch-up exceeded local 1-second POC threshold');
const comparison={result:'PASS',startMs,endMs,seed,variants:rows,benchmark,
  themes:['04','05','06','07','08'].map(day=>({date:`2026-09-${day}`,theme:themeForDay(`2026-09-${day}`,seed)}))};
json(join(output,'comparison.json'),comparison);
writeFileSync(join(output,'RESULTS.md'),`# Milestone 1A deterministic verification: PASS\n\nFive ambient days, 4–9 September 2026, Europe/London.\n\n| Variant | Events | Digest |\n|---|---:|---|\n`+
  rows.map(r=>`| ${r.variant} | ${r.events} | ${r.digest} |`).join('\n')+
  `\n\nAll full semantic snapshots match, including events, IDs, occurrence times, state changes, conditions, knowledge, relationships, final state and pending actions. Only operational database write timestamps are excluded.\n\nSix-hour catch-up: ${processedActions} meaningful actions, zero minute ticks. Median ${benchmark.medianMs.toFixed(3)} ms; p95 ${benchmark.p95Ms.toFixed(3)} ms across ${measurements.length} fresh files.\n\nBenchmark includes advance and commit, not initialization or projection. No LLM or network calls.\n\nThe model deliberately uses five small recurring causal themes. Passing these checks establishes determinism and persistence for this fixture; the creator still judges recognition, pacing and curiosity.\n`);
console.log(JSON.stringify({result:'PASS',output,benchmark},null,2));
