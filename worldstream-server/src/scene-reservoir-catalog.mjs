import { createHash } from 'node:crypto';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from './scene-reservoir-data.mjs';
import { areaOf } from './places.mjs';
import { daypart } from './sky.mjs';
import { SIDE_CHARACTERS, LEGION_CAST, OUTSIDE_CAST, STREET_FAUNA } from './cast.mjs';

export const RESERVOIR_SCHEMA_VERSION = 1;
const ACTORS = new Set(['goaden','ashai',...Object.keys(SIDE_CHARACTERS),...Object.keys(LEGION_CAST),
  ...Object.keys(OUTSIDE_CAST),...Object.keys(STREET_FAUNA)]);
const actorAlias = id => id === 'hammond' ? 'kartel' : id;
const sourceActors = values => Array.isArray(values) && values.length>0
  && values.every(value=>value==='world'||ACTORS.has(actorAlias(value)));
const LEADS = ['goaden','ashai'];
const WEATHER = new Set(['clear','cloudy','fog','light_rain','rain','heavy_rain','storm','snow']);
const TRIGGERS = new Set(['QUIET_TIME_BEGIN','REST_BEGIN','ACTIVITY_COMPLETE','MEAL_BEGIN','CROSS_PATHS',
  'PRACTICE_END','GAME_BEGIN','GAME_PAUSE','GAME_RESUME','SUPPORTING_ENCOUNTER','OFFSCREEN_ENCOUNTER','TV_BEGIN']);
// CONVERSATION is deliberately not a source. It is already an authored surface on
// the page, and a conversation is a rail the canon tests hold to: it moves no
// state, not even a booking. A reservoir scene stacked a minute behind one was
// the pile-up the spacing rule exists to prevent.
const ACTIVITIES = new Set(['unhurried_time','quiet_break','resting','eating','gaming','watching_television',
  'listening_to_music','waiting','training']);
const PHASES = new Set(['morning','midday','evening','night','small_hours']);
const GATE_KEYS = new Set(['triggerTypes','activitiesByActor','minimumActivityMsByActor','weatherCodes','dayparts']);
const aliases = {'mi6/lunch_hall':'mi6/common_room','mi6/corridor':'mi6/corridors','mi6/operations':'mi6/ops_room',
  big_ben_plaza:'big_ben_plaza/venue',streamliner:'streamliner/transit',cafe:'cafe/venue',enchanted_ink:'enchanted_ink/venue'};
const TITLES = {'domestic.ashai_greah.quiet':'A quiet moment with Greah','domestic.goaden_kai.quiet':'A quiet moment with Kai',
  'domestic.shared_meal':'Over lunch','domestic.cross_paths':'Passing in the corridor','domestic.practice_end':'At the end of practice',
  'domestic.yukon_shared':'In the gaming area','night.low_stakes':'After midnight'};
const text = value => typeof value === 'string' && value.trim().length > 0;
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const members = (values,set) => Array.isArray(values) && values.length > 0 && values.every(value=>set.has(value));
const normal = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
export const reservoirSourceHash = entry => createHash('sha256').update(JSON.stringify(entry)).digest('hex');
function freeze(value) { if(value&&typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);} return value; }
export function normalizeReservoirLocation(value) {
  const resolved = aliases[value] ?? value;
  if (!text(resolved)) return null;
  const [location,area,...rest] = resolved.split('/');
  return !rest.length && areaOf(location,area) && area !== 'basement' ? {location,area} : null;
}
function gateError(gates,cast) {
  if (!plain(gates) || Object.keys(gates).some(key=>!GATE_KEYS.has(key))) return 'unsupported eligibility gate';
  if (!members(gates.triggerTypes,TRIGGERS)) return 'unsupported or missing exact source event types';
  if (!plain(gates.activitiesByActor)) return 'missing actor activity gates';
  for (const id of LEADS.filter(id=>cast.includes(id))) if (!members(gates.activitiesByActor[id],ACTIVITIES)) return `missing or unsupported activity gate for ${id}`;
  if (Object.keys(gates.activitiesByActor).some(id=>!LEADS.includes(id)||!cast.includes(id))) return 'activity gate names an unsupported actor';
  if (gates.weatherCodes && !members(gates.weatherCodes,WEATHER)) return 'unsupported weather gate';
  if (gates.dayparts && !members(gates.dayparts,PHASES)) return 'unsupported daypart gate';
  if (gates.minimumActivityMsByActor && (!plain(gates.minimumActivityMsByActor)
    || Object.entries(gates.minimumActivityMsByActor).some(([id,ms])=>!LEADS.includes(id)||!cast.includes(id)||!Number.isSafeInteger(ms)||ms<0||ms>86400000))) return 'unsupported activity duration gate';
  return null;
}

/** Imported text has no authority to activate itself. A content hash binds each
 * explicit review to the exact submitted prose AND metadata. New monthly rows,
 * changed text and unknown facts remain staged until a review maps their gates.
 * The returned scene is the existing scene-bank shape, never a second selector.
 */
export function normalizeReservoirBatch(batch,{reviews=SCENE_RESERVOIR_REVIEWS,existingIds=[],existingTexts=[]}={}) {
  const scenes=[], rows=[], seen=new Set(existingIds), seenTexts=new Set(existingTexts.filter(text).map(normal));
  if (!plain(batch)||!text(batch.batch_id)||!Array.isArray(batch.entries)||batch.entries.length>2000)
    throw new TypeError('Reservoir batch needs batch_id and at most 2000 entries');
  const report=(entry,status,reason,extra={})=>rows.push({id:entry?.id??null,family:entry?.family??null,status,reason,...extra});
  for (const entry of batch.entries) {
    if (!plain(entry)||!text(entry.id)||!text(entry.family)||!text(entry.prose)||entry.prose.length>12000) {
      report(entry,'rejected','Malformed entry: id, family and bounded prose are required.');continue;
    }
    if (seen.has(entry.id)||seen.has(`R:${entry.id}`)) {report(entry,'rejected','Duplicate source id.');continue;}
    seen.add(entry.id);
    if (seenTexts.has(normal(entry.prose))) {report(entry,'rejected','Duplicate normalized prose.');continue;}
    seenTexts.add(normal(entry.prose));
    if (entry.effect_policy!=='surface_only'||batch.effect_policy!=='surface_only') {
      report(entry,'rejected','Only explicit surface_only content is admitted.');continue;
    }
    if (!sourceActors(entry.cast)) {report(entry,'rejected',`Unknown actor id or missing cast: ${(Array.isArray(entry.cast)?entry.cast:[]).filter(id=>id!=='world'&&!ACTORS.has(actorAlias(id))).join(', ')||'(empty)'}.`);continue;}
    if (!Array.isArray(entry.location)||!entry.location.every(text)) {report(entry,'rejected','Missing location candidates.');continue;}
    const sourceHash=reservoirSourceHash(entry), review=reviews[entry.id];
    if (!review) {report(entry,'staged','No content-bound review maps this entry’s facts and source event to runtime gates.',{sourceHash});continue;}
    if (review.sourceHash!==sourceHash) {report(entry,'staged','Source changed since review; prose and metadata need a new review.',{sourceHash});continue;}
    if (review.status!=='accepted') {report(entry,'staged',review.reason||'Required fact has no runtime proof.',{sourceHash});continue;}
    const place=normalizeReservoirLocation(review.location);
    if (!place) {report(entry,'rejected','Review names an unknown or inaccessible runtime location.',{sourceHash});continue;}
    if (review.cast && !Array.isArray(review.cast)) {report(entry,'rejected','Review cast must be an array of known actor ids.',{sourceHash});continue;}
    const cast=(review.cast??entry.cast).map(actorAlias);
    if (!members(cast,ACTORS)||!LEADS.some(id=>cast.includes(id))||cast.includes('world')
      ||entry.cast.some(id=>!cast.includes(actorAlias(id)))) {report(entry,'staged','The existing scene selector requires a present lead and a complete known cast.',{sourceHash});continue;}
    const declared=entry.location.map(normalizeReservoirLocation).filter(Boolean);
    const same=declared.some(value=>value.location===place.location&&value.area===place.area);
    if (!same && !text(review.locationReason)) {report(entry,'rejected','Location narrowing requires an explicit review reason.',{sourceHash});continue;}
    const reason=gateError(review.gates,cast);
    if (reason) {report(entry,'rejected',`Review rejected: ${reason}.`,{sourceHash});continue;}
    const scene={id:`R:${entry.id}`,title:TITLES[entry.family]??'A passing moment',location:place.location,area:place.area,
      cast:[...cast],status:'enabled',gate:null,dependencies:[],minAgeDays:0,nimbusPlate:null,escort:false,
      privateGarden:false,night:false,origin:'authored',effectPolicy:'surface_only',
      setting:`${place.location}/${place.area}`,beats:[{kind:'prose',text:entry.prose}],
      adaptation:'Unchanged creator prose; reviewed metadata narrows location, cast and existing-event eligibility.',
      reservoir:{schemaVersion:RESERVOIR_SCHEMA_VERSION,sourceId:entry.id,family:entry.family,batchId:batch.batch_id,
        sourceHash,origin:'authored',sourceProvenance:entry.origin??batch.batch_id,
        cooldown:{sceneDays:30,familyHours:36,pairHours:8},...structuredClone(review.gates)}};
    scenes.push(freeze(scene));report(entry,'accepted',review.reason,{sourceHash,sceneId:scene.id,location:scene.location,area:scene.area});
  }
  return {scenes,report:{batchId:batch.batch_id,schemaVersion:RESERVOIR_SCHEMA_VERSION,total:batch.entries.length,
    accepted:rows.filter(r=>r.status==='accepted').length,staged:rows.filter(r=>r.status==='staged').length,
    rejected:rows.filter(r=>r.status==='rejected').length,rows}};
}

/** Called before existing scene-bank availability checks and at commit. The
 * owned pending source checks the trigger once; physical/context gates stay live.
 */
export function reservoirSceneEligible(ctx,scene,{checkTrigger=true}={}) {
  const gate=scene?.reservoir;
  if(!gate) return true;
  if(gate.schemaVersion!==RESERVOIR_SCHEMA_VERSION||gateError(gateForValidation(gate),scene.cast)) return false;
  if(checkTrigger && (!gate.triggerTypes.includes(ctx.event?.type)||ctx.event?.visibility!=='public'
    ||ctx.event?.location!==scene.location||ctx.event?.area!==scene.area)) return false;
  if(gate.weatherCodes && !gate.weatherCodes.includes(ctx.state.weather?.code)) return false;
  if(gate.dayparts && !gate.dayparts.includes(daypart(ctx.now))) return false;
  for(const [id,allowed] of Object.entries(gate.activitiesByActor)) {
    const actor=ctx.state.characters?.[id];
    if(!actor||!allowed.includes(actor.activity)||actor.journey||actor.location!==scene.location||actor.area!==scene.area) return false;
    const elapsed=gate.minimumActivityMsByActor?.[id];
    if(elapsed && (!Number.isSafeInteger(actor.activitySince)||ctx.now-actor.activitySince<elapsed)) return false;
  }
  return true;
}
const gateForValidation = gate => Object.fromEntries(Object.entries(gate).filter(([key])=>GATE_KEYS.has(key)));
const importedIds=[],importedTexts=[];
const normalized=SCENE_RESERVOIR_BATCHES.map(batch=>{
  const result=normalizeReservoirBatch(batch,{existingIds:importedIds,existingTexts:importedTexts});
  importedIds.push(...batch.entries.map(entry=>entry.id));importedTexts.push(...batch.entries.map(entry=>entry.prose));
  return result;
});
export const SCENE_RESERVOIR_CATALOG=freeze(normalized.flatMap(batch=>batch.scenes));
export const SCENE_RESERVOIR_IMPORT_REPORT=freeze(normalized.map(batch=>batch.report));
