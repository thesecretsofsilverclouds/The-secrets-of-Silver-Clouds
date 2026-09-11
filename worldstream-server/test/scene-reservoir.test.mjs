import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { SCENE_BANK_BY_ID } from '../src/scene-bank-catalog.mjs';
import { SCENE_RESERVOIR_CATALOG, SCENE_RESERVOIR_IMPORT_REPORT,
  normalizeReservoirBatch, normalizeReservoirLocation, reservoirSourceHash, reservoirSceneEligible } from '../src/scene-reservoir-catalog.mjs';
import { atLondon } from '../src/time.mjs';

const batch=SCENE_RESERVOIR_BATCHES[0], byId=id=>SCENE_RESERVOIR_CATALOG.find(s=>s.reservoir.sourceId===id);
const accepted=batch.entries.find(e=>e.id==='domestic.shared_meal.02');
const one=entry=>({...batch,entries:[entry]});
const sceneContext=(scene,{type=scene.reservoir.triggerTypes[0],at=atLondon('2026-09-10','13:00'),weather='storm'}={})=>({
  now:at,event:{type,visibility:'public',location:scene.location,area:scene.area},
  state:{weather:{code:weather},characters:Object.fromEntries(Object.entries(scene.reservoir.activitiesByActor)
    .map(([id,activities])=>[id,{id,activity:activities[0],location:scene.location,area:scene.area,journey:null,activitySince:at-3600000}]))}});

test('all 140 supplied surfaces are retained, with 22 unchanged reviewed scenes and explicit rejection/staging reasons',()=>{
  assert.equal(batch.entries.length,140);
  const report=SCENE_RESERVOIR_IMPORT_REPORT[0];
  assert.equal(report.total,140);assert.equal(report.accepted,22);assert.equal(report.staged,111);assert.equal(report.rejected,7);
  const allEntries = SCENE_RESERVOIR_BATCHES.flatMap(b=>b.entries);
  for(const scene of SCENE_RESERVOIR_CATALOG) {
    const source=allEntries.find(entry=>entry.id===scene.reservoir.sourceId);
    assert.equal(scene.beats[0].text,source.prose);
    assert.equal(SCENE_BANK_BY_ID[scene.id],scene);
    assert.equal(scene.origin,'authored');assert.equal(scene.reservoir.origin,'authored');
    assert.equal(scene.effectPolicy,'surface_only');assert.deepEqual(scene.dependencies,[]);
    assert.ok(Object.isFrozen(scene)&&Object.isFrozen(scene.reservoir)&&Object.isFrozen(scene.beats[0]));
    assert.equal(scene.reservoir.sourceHash,reservoirSourceHash(source));
  }
});
test('new and changed monthly entries stay staged regardless of self-declared enabled status',()=>{
  const novel={...accepted,id:'next-month.meal.01',status:'enabled'};
  assert.equal(normalizeReservoirBatch(one(novel)).report.staged,1);
  for(const changed of [{...accepted,prose:accepted.prose+' They learned a secret.'},{...accepted,cast:['goaden']}]) {
    const result=normalizeReservoirBatch(one(changed));assert.equal(result.scenes.length,0);
    assert.match(result.report.rows[0].reason,/changed since review/);
  }
});
test('unsupported fact gates, inaccessible locations and actor placeholders fail closed',()=>{
  const current=SCENE_RESERVOIR_REVIEWS[accepted.id];
  for(const review of [{...current,gates:{...current.gates,requiredTelepathy:true}},
    {...current,location:'mi6/basement'},{...current,gates:{...current.gates,triggerTypes:['ANY']}}]) {
    const result=normalizeReservoirBatch(one(accepted),{reviews:{[accepted.id]:review}});
    assert.equal(result.scenes.length,0);assert.equal(result.report.rejected,1);
  }
  const result=normalizeReservoirBatch(one({...accepted,cast:['supporting']}));
  assert.equal(result.report.rejected,1);assert.match(result.report.rows[0].reason,/supporting/);
  assert.deepEqual(normalizeReservoirLocation('mi6/lunch_hall'),{location:'mi6',area:'common_room'});
  assert.deepEqual(normalizeReservoirLocation('mi6/corridor'),{location:'mi6',area:'corridors'});
  assert.equal(normalizeReservoirLocation('mi6/new-room'),null);
});
test('duplicate ids and punctuation-only duplicate prose cannot enter another batch',()=>{
  const result=normalizeReservoirBatch({...batch,entries:[accepted,{...accepted,id:'different-id',prose:accepted.prose.replaceAll('.', '!')}]});
  assert.equal(result.report.accepted,1);assert.equal(result.report.rejected,1);assert.match(result.report.rows[1].reason,/Duplicate normalized prose/);
  assert.equal(normalizeReservoirBatch(one(accepted),{existingIds:[accepted.id]}).report.rejected,1);
});
test('shared meal prose needs a real public local meal or encounter and both participants already eating',()=>{
  const scene=byId('domestic.shared_meal.02'),ctx=sceneContext(scene);
  assert.equal(reservoirSceneEligible(ctx,scene),true);
  for(const type of ['WEATHER_CHANGE','OFFSCREEN_RESULT','PRACTICE_BEGIN']) assert.equal(reservoirSceneEligible({...ctx,event:{...ctx.event,type}},scene),false);
  ctx.state.characters.ashai.activity='sleeping';assert.equal(reservoirSceneEligible(ctx,scene),false);
  ctx.state.characters.ashai.activity='eating';ctx.state.characters.ashai.location='cafe';assert.equal(reservoirSceneEligible(ctx,scene),false);
  ctx.state.characters.ashai.location='mi6';ctx.state.characters.ashai.journey={to:'cafe'};assert.equal(reservoirSceneEligible(ctx,scene),false);
  ctx.state.characters.ashai.journey=null;ctx.event.visibility='private';assert.equal(reservoirSceneEligible(ctx,scene),false);
});
test('covered-floor storm scene requires actual completed practice and wet weather, including revalidation at commit',()=>{
  const scene=byId('domestic.practice_end.03'),ctx=sceneContext(scene);
  assert.equal(reservoirSceneEligible(ctx,scene),true);
  ctx.state.weather.code='clear';assert.equal(reservoirSceneEligible(ctx,scene),false);
  ctx.state.weather.code='storm';ctx.event.type='SCENE_BANK_BEAT';
  assert.equal(reservoirSceneEligible(ctx,scene),false);
  assert.equal(reservoirSceneEligible(ctx,scene,{checkTrigger:false}),true);
  ctx.state.characters.goaden.activity='training';assert.equal(reservoirSceneEligible(ctx,scene,{checkTrigger:false}),false);
});
test('night and elapsed-activity prose cannot borrow unrelated time or an activity that just began',()=>{
  const night=byId('night.low_stakes.04');
  assert.equal(reservoirSceneEligible(sceneContext(night),night),false);
  assert.equal(reservoirSceneEligible(sceneContext(night,{at:atLondon('2026-09-10','04:00')}),night),true);
  const tea=byId('domestic.ashai_greah.quiet.04'),ctx=sceneContext(tea);
  assert.equal(reservoirSceneEligible(ctx,tea),true);
  ctx.state.characters.ashai.activitySince=ctx.now;assert.equal(reservoirSceneEligible(ctx,tea),false);
});
test('monthly importer produces an explicit report without any saved-world or provider dependency',()=>{
  const directory=mkdtempSync(join(tmpdir(),'worldstream-reservoir-'));
  try {
    const input=join(directory,'batch.json'),output=join(directory,'report.json');writeFileSync(input,JSON.stringify(batch));
    const script=fileURLToPath(new URL('../scripts/import-scene-reservoir.mjs',import.meta.url));
    const run=spawnSync(process.execPath,[script,'--input',input,'--report',output],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const report=JSON.parse(readFileSync(output,'utf8'));
    assert.equal(report.accepted,22);assert.equal(report.rows.length,140);
    assert.equal(JSON.parse(run.stdout).write,false);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
