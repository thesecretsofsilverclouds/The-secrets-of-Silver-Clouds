import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openWorld,semanticDigest } from '../src/world.mjs';
import { publicProjection } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';
import { startWorldRunner } from '../src/world-runner.mjs';
import { openPinnedWorld,backupWorld,restoreWorldBackup } from '../src/world-operations.mjs';
const START=atLondon('2026-09-04','00:00');

test('bounded presentation agrees with full projection after a fortnight; all history remains addressable',()=>{
  const world=openWorld({dbPath:':memory:',startMs:START});
  try {
    world.advance(atLondon('2026-09-18','00:00'));
    const full=world.semanticSnapshot(),before=semanticDigest(full);
    assert.ok(full.events.length>1024);
    assert.deepEqual(world.publicProjection(),publicProjection(full));
    // Prove refresh and index readers cannot silently call the full-ledger API.
    world.semanticSnapshot=()=>{throw new Error('Unexpected full ledger read');};
    for(let i=0;i<5;i++) world.publicProjection();
    const ids=[];let cursor;
    do {const page=world.publicHistory({beforeSeq:cursor});ids.push(...page.events.map(e=>e.id));cursor=page.nextCursor;}while(cursor);
    assert.equal(new Set(ids).size,ids.length);
    assert.equal(ids.length,full.events.filter(e=>e.visibility==='public'&&e.publicDescription).length);
    assert.deepEqual(world.publicHistory().events.every(e=>!('payload'in e)&&!('changes'in e)),true);
    const {presentationFloor,...read}=world.presentationSnapshot();
    assert.ok(Number.isSafeInteger(presentationFloor));
    assert.equal(semanticDigest({...full,...read,events:full.events}),before);
  } finally {world.close();}
});

test('headless clock adapter preserves the same canonical world with zero presentation work',()=>{
  const a=openWorld({dbPath:':memory:',startMs:START}),b=openWorld({dbPath:':memory:',startMs:START});
  try {
    const now=atLondon('2026-09-07','00:00'),runner=startWorldRunner(a,{now:()=>now,autoStart:false});
    runner.tick();assert.equal(runner.tick().processedActions,0);b.advance(now);
    assert.equal(semanticDigest(a.semanticSnapshot()),semanticDigest(b.semanticSnapshot()));
    runner.stop();assert.equal(runner.tick().stopped,true);
  } finally {a.close();b.close();}
});

test('pinned release restart and verified backup restore preserve pending work; mismatched activation refuses',()=>{
  const dir=mkdtempSync(join(tmpdir(),'worldstream-service-')),live=join(dir,'live');
  let world=openPinnedWorld({directory:live,startMs:START});
  world.advance(START+36*3_600_000);
  const digest=semanticDigest(world.semanticSnapshot()),backup=join(dir,'copy.sqlite');
  backupWorld(world,backup);assert.throws(()=>backupWorld(world,backup),/already exists/);world.close();
  world=openPinnedWorld({directory:live});assert.equal(semanticDigest(world.semanticSnapshot()),digest);world.close();
  const recovered=join(dir,'recovered.sqlite');restoreWorldBackup(backup,recovered);
  assert.throws(()=>restoreWorldBackup(backup,recovered),/empty destination/);
  world=openWorld({dbPath:recovered});assert.equal(semanticDigest(world.semanticSnapshot()),digest);world.advance(START+48*3_600_000);world.close();
  const manifest=join(live,'active-world.json'),before=readFileSync(join(live,'world.sqlite'));
  writeFileSync(manifest,JSON.stringify({format:1,database:'world.sqlite',rulesVersion:'future-unreviewed'}));
  assert.throws(()=>openPinnedWorld({directory:live}),/Pinned world release differs/);
  assert.deepEqual(readFileSync(join(live,'world.sqlite')),before);
});
