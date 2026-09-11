// Monthly, offline-only importer. New content stays staged until its exact hash
// has a reviewed runtime gate mapping. Never reads a saved world or uses a model.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { normalizeReservoirBatch, reservoirSourceHash } from '../src/scene-reservoir-catalog.mjs';

const args=process.argv.slice(2), option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
if(!option('--input')) throw new Error('Usage: node scripts/import-scene-reservoir.mjs --input batch.json [--reviews reviewed-gates.json] [--report report.json] [--write]');
const batch=JSON.parse(readFileSync(resolve(option('--input')),'utf8'));
const reviews={...SCENE_RESERVOIR_REVIEWS,...(option('--reviews')?JSON.parse(readFileSync(resolve(option('--reviews')),'utf8')):{})};
const others=SCENE_RESERVOIR_BATCHES.filter(value=>value.batch_id!==batch.batch_id);
const result=normalizeReservoirBatch(batch,{reviews,existingIds:others.flatMap(value=>value.entries.map(e=>e.id)),
  existingTexts:others.flatMap(value=>value.entries.map(e=>e.prose))});
const reportPath=resolve(option('--report')??`reports/scene-reservoir-import-${String(batch.batch_id).replace(/[^a-z0-9_-]/gi,'_')}.json`);
mkdirSync(dirname(reportPath),{recursive:true});writeFileSync(reportPath,JSON.stringify(result.report,null,2)+'\n');
if(args.includes('--write')) {
  // Already imported identities are immutable so a scene named in a saved
  // ledger cannot disappear or acquire different prose on the next import.
  const previous=SCENE_RESERVOIR_BATCHES.find(value=>value.batch_id===batch.batch_id);
  const incoming=new Map(batch.entries.map(entry=>[entry.id,entry]));
  if(previous?.entries.some(entry=>!incoming.has(entry.id)||reservoirSourceHash(entry)!==reservoirSourceHash(incoming.get(entry.id))))
    throw new Error('Existing source ids are immutable; retain original rows and give revisions new ids. Source file left unchanged.');
  const target=fileURLToPath(new URL('../src/scene-reservoir-data.mjs',import.meta.url));
  writeFileSync(target,'// Imported authored sources retained whole; only content-bound reviewed rows activate.\n'
    +`export const SCENE_RESERVOIR_BATCHES = ${JSON.stringify([...others,batch],null,2)};\n`
    +`export const SCENE_RESERVOIR_REVIEWS = ${JSON.stringify(reviews,null,2)};\n`);
}
console.log(JSON.stringify({batchId:result.report.batchId,total:result.report.total,accepted:result.report.accepted,
  staged:result.report.staged,rejected:result.report.rejected,write:args.includes('--write'),reportPath}));
