// Local author evidence. Fresh databases only; never advances the public save.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { RULES_VERSION, publicEvents } from '../src/fixture.mjs';
import { listStoryThreads, buildStoryThread } from '../src/story-threads.mjs';
import { atLondon } from '../src/time.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root,'artifacts',`world-depth-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`);
mkdirSync(output,{recursive:true});
const json=(file,value)=>writeFileSync(join(output,file),JSON.stringify(value,null,2)+'\n');
let summary;
if(process.argv[2]) summary={output:resolve(process.argv[2])};
else {
  const child=spawn(process.execPath,[join(root,'src/run-verification.mjs')],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',chunk=>{stdout+=chunk;process.stdout.write(chunk);});
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  writeFileSync(join(output,'replay.stdout.txt'),stdout);writeFileSync(join(output,'replay.stderr.txt'),stderr);
  assert.equal(status,0,'A–E replay verification failed');
  summary=JSON.parse(stdout.slice(stdout.lastIndexOf('{\n  "result": "PASS"')));
}
const replay=JSON.parse(readFileSync(join(summary.output,'comparison.json'),'utf8'));
assert.equal(replay.result,'PASS');
const replaySnapshot=JSON.parse(readFileSync(join(summary.output,'B-one-absence','semantic-snapshot-private.json'),'utf8'));
assert.equal(replaySnapshot.world.rulesVersion,RULES_VERSION,'Replay evidence is from another release');
assert.ok(replay.variants.every(row=>row.digest===semanticDigest(replaySnapshot)),'Replay digest mismatch');
const world=openWorld({dbPath:process.argv[3]?resolve(process.argv[3]):join(output,'coverage.sqlite'),startMs:atLondon('2026-09-04','00:00')});
try {
  world.advance(atLondon('2026-10-02','00:00'));
  const snapshot=world.semanticSnapshot(), before=semanticDigest(snapshot);
  const projection=world.publicProjection(), visible=publicEvents(snapshot,Number.MAX_SAFE_INTEGER);
  const eventById=id=>world.eventById(id), threads=listStoryThreads(snapshot);
  const details=threads.map(row=>buildStoryThread(snapshot,row,{eventById}));
  for(let i=0;i<3;i++) {world.publicProjection();world.presentationSnapshot();}
  assert.equal(semanticDigest(world.semanticSnapshot()),before,'Reads changed the world');
  assert.equal(world.advance(snapshot.world.resolvedThrough).appendedEvents,0,'Duplicate request appended events');
  for(const event of snapshot.events) for(const change of event.changes) {
    if(change.entity!=='character'||change.field!=='knowledge') continue;
    for(const memory of change.after.filter(item=>!change.before.some(old=>old.factKey===item.factKey&&old.sourceEventId===item.sourceEventId))) {
      const source=eventById(memory.sourceEventId);
      assert.ok(source&&source.occurredAt<=memory.learnedAt&&memory.learnedAt===event.occurredAt,'Knowledge precedes its source');
    }
  }
  const newEvents=snapshot.events.filter(e=>e.visibility==='public'&&/^(SUPPORTING_|NIGHT_)/.test(e.type));
  const nights=Object.values(snapshot.nightStories.episodes);
  assert.ok(nights.some(story=>story.status==='resolved'&&story.phase==='settled'),'No resolved night with recovery');
  const recovered=Object.values(snapshot.outingRecovery.opportunities).filter(story=>story.status==='recovered');
  assert.ok(recovered.some(story=>story.day==='2026-09-05'),'The original missed outing was not recovered');
  assert.ok(snapshot.events.some(e=>e.type==='SUPPORTING_CALLBACK'&&e.visibility==='public'),'No consequential later supporting encounter');
  assert.ok(details.some(row=>row.id.startsWith('night:')&&row.events.length>=4),'Night history is not readable');
  const exposed=JSON.stringify({projection,details});
  for(const key of ['"knowledge":','"learnedAt":','"sourceEventId":','"issued":','"token":','"reliability":','"familiarity":','"causes":'])
    assert.ok(!exposed.includes(key),`Private field leaked: ${key}`);
  const cast=[...new Set(newEvents.flatMap(event=>event.payload.cast??event.participants))].sort();
  const coreHash=createHash('sha256').update(readFileSync(join(root,'../experiment-l/src/world.mjs'))).digest('hex');
  assert.equal(coreHash,'a136195e198ffac1d985efb2e7626303d3bb232811a79cc980f88488f75c8713');
  const report={result:'PASS',rulesVersion:RULES_VERSION,output,replayArtifacts:summary.output,
    replayVariants:replay.variants,benchmark:replay.benchmark,coreEngineSHA256:coreHash,
    coverage:{days:28,events:snapshot.events.length,publicEvents:visible.length,
      supportingCommitments:newEvents.filter(e=>e.type==='SUPPORTING_COMMITMENT').length,
      supportingOutcomes:newEvents.filter(e=>e.type==='SUPPORTING_OUTCOME').length,
      supportingCallbacks:newEvents.filter(e=>e.type==='SUPPORTING_CALLBACK').length,cast,
      recoveredOutings:recovered.map(story=>({day:story.day,departureAt:story.spec.departureAt})),
      nights:nights.map(story=>({day:story.day,outcome:story.status,phase:story.phase,
        participants:Object.fromEntries(Object.entries(story.participants).map(([who,p])=>[who,{status:p.status,lostSleepMinutes:p.lostSleepMinutes??0}]))}))}};
  json('comparison.json',report);json('public-story-examples.json',details);json('public-projection.json',projection);
  const london=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'medium'});
  writeFileSync(join(output,'PUBLIC-EVENTS.md'),'# World depth · public author sample\n\n28 fictional days, Europe/London. These are isolated verification events, not the live world.\n\n'+
    newEvents.map(event=>`**${london.format(event.occurredAt)} · ${event.type}**\n\n${event.publicDescription}\n\n${event.prose??''}`).join('\n\n'));
  console.log(JSON.stringify(report,null,2));
} finally {world.close();}
