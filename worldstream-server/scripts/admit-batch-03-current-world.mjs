import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { normalizeReservoirBatch, normalizeReservoirLocation, reservoirSourceHash, RESERVOIR_TRIGGERS, actorAlias } from '../src/scene-reservoir-catalog.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(root, '../src/scene-reservoir-data.mjs');
const b03Path = 'C:/Users/chris/Downloads/WORLDSTREAM_GROUNDED_SCENE_BATCH_03.json';
if (!existsSync(b03Path)) {
  console.error('Batch 03 file missing:', b03Path);
  process.exit(1);
}

const FUTURE = new Set(['duskkin_compliance', 'onari_environment', 'mi6_contractors',
  'magical_london_incidents', 'multifaction_briefings']);
const reviews = { ...SCENE_RESERVOIR_REVIEWS };
const batches = SCENE_RESERVOIR_BATCHES.map(b => ({ ...b, entries: [...b.entries] }));
const existingIds = new Set(batches.flatMap(b => b.entries.map(e => e.id)));
const existingTexts = new Set(batches.flatMap(b => b.entries.map(e =>
  e.prose.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim())));
const rebuildAt = batches.findIndex(b => b.batch_id === 'greah-grounded-batch-03');
if (rebuildAt >= 0) {
  for (const entry of batches[rebuildAt].entries) {
    existingIds.delete(entry.id);
    const normal = entry.prose.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    existingTexts.delete(normal);
  }
  batches.splice(rebuildAt, 1);
}

function mapTriggers(raw) {
  const parts = (Array.isArray(raw) ? raw : String(raw || '').split('|')).map(t => t.trim()).filter(Boolean);
  const out = new Set();
  for (const t of parts) {
    if (t === 'TRAVEL' || t === 'TRAVEL_BEGIN') { out.add('TRAVEL_DEPART'); out.add('TRAVEL_ARRIVE'); continue; }
    if (t === 'MEAL' || t === 'SHARED_MEAL') { out.add('MEAL_BEGIN'); continue; }
    if (t === 'REST') { out.add('REST_BEGIN'); continue; }
    if (t === 'QUIET_TIME') { out.add('QUIET_TIME_BEGIN'); continue; }
    if (t === 'GAME') { out.add('GAME_BEGIN'); out.add('GAME_PAUSE'); out.add('GAME_RESUME'); continue; }
    if (t === 'TRAINING' || t === 'TRAINING_COMPLETE') { out.add('PRACTICE_END'); continue; }
    if (t === 'NIGHT_SHIFT') { out.add('QUIET_TIME_BEGIN'); out.add('REST_BEGIN'); continue; }
    if (t === 'TRAVEL_INTERNAL') { out.add('CROSS_PATHS'); continue; }
    if (t === 'PUBLIC_IDLE') { out.add('VENUE_SCENE'); continue; }
    if (t === 'ANY' || t === 'CONVERSATION' || t === 'NIMBUS_PRESENT' || t === 'CALLBACK') continue;
    if (RESERVOIR_TRIGGERS.has(t)) out.add(t);
  }
  return [...out];
}

function asEntry(scene) {
  return {
    id: scene.id, family: scene.family, origin: scene.origin || 'greah_grounded_batch_03',
    status: 'accepted', register: 'micro_scene', cast: scene.cast || [],
    location: Array.isArray(scene.locations) ? scene.locations
      : Array.isArray(scene.location) ? scene.location
        : scene.locations || scene.location ? [scene.locations || scene.location] : [],
    trigger_family: Array.isArray(scene.triggerCandidates) ? scene.triggerCandidates.join('|')
      : scene.triggerFamily || scene.trigger_family || '',
    effect_policy: 'surface_only', prose: scene.prose,
  };
}

function blockReason(entry) {
  const family = entry.family || '';
  const cast = (entry.cast || []).map(actorAlias);
  if (FUTURE.has(family))
    return { skip: true, reason: 'Future Simulation family: no current-world generator produces this situation.' };
  if (family.startsWith('whisper') || cast.includes('whisper'))
    return { reason: 'Whisper is spoiler-sealed and is not a runtime actor.' };
  if (cast.includes('marley'))
    return { reason: 'Marley is not a runtime actor.' };
  if (cast.includes('supporting'))
    return { reason: 'Placeholder actor "supporting" is not a runtime cast member.' };
  if (cast.includes('contractor'))
    return { reason: 'Generic contractor is not a runtime actor; contractor incidents wait for the Future Simulation addon.' };
  if (cast.includes('duskkin_liaison') || cast.includes('duskkin') || cast.includes('onari_protester'))
    return { reason: 'Duskkin/Onari addon cast is not a current-world runtime actor.' };
  if (cast.includes('balthazar') && !cast.includes('anarchy'))
    return { reason: 'Balthazar cannot appear independently of Anarchy.' };
  if (entry.id === 'davis_ashai_rivalry.013' || entry.id === 'davis_ashai_rivalry.014')
    return { reason: 'Open Davis/Ashai rivalry requires the post-disclosure relationship phase.' };
  if (cast.includes('zara') && cast.includes('yukon') && cast.includes('gabriel'))
    return { reason: 'Impossible current-world conjunction: Yukon, Gabriel and Zara are not scheduled together.' };
  return null;
}

function accept(entry, reason) {
  const cast = (entry.cast || []).map(actorAlias).filter(id => id && id !== 'world');
  let triggers = mapTriggers(entry.trigger_family);
  if (entry.family === 'streamliner_incident_transit' || entry.family?.includes('streamliner'))
    triggers = ['TRAVEL_DEPART', 'TRAVEL_ARRIVE'];
  if (entry.family?.includes('legion')) triggers = triggers.includes('LEGION_VISIT') ? triggers : ['LEGION_VISIT', ...triggers];
  if (entry.family?.includes('emily')) triggers = triggers.length ? triggers : ['VENUE_SCENE', 'SUPPORTING_ENCOUNTER'];
  if (entry.family === 'night_shift') triggers = ['QUIET_TIME_BEGIN', 'REST_BEGIN', 'ACTIVITY_COMPLETE'];
  if (entry.family === 'nimbus_mi6') triggers = triggers.length ? triggers : ['CROSS_PATHS', 'ACTIVITY_COMPLETE', 'SIDE_PRESENCE'];
  triggers = [...new Set(triggers.filter(t => RESERVOIR_TRIGGERS.has(t)))];
  if (!triggers.length) triggers = ['ACTIVITY_COMPLETE', 'CROSS_PATHS'];
  const locs = Array.isArray(entry.location) ? entry.location : entry.location ? [entry.location] : [];
  let location = null;
  for (const loc of locs) { const n = normalizeReservoirLocation(loc); if (n) { location = `${n.location}/${n.area}`; break; } }
  if (!location) {
    location = entry.family.includes('streamliner') ? 'streamliner/transit'
      : entry.family.includes('emily') ? 'big_ben_plaza/venue'
      : entry.family.includes('legion') ? 'mi6/common_room'
      : 'mi6/common_room';
  }
  const place = normalizeReservoirLocation(location);
  const declared = locs.map(normalizeReservoirLocation).filter(Boolean);
  const same = declared.some(v => v.location === place.location && v.area === place.area);
  const lane = !cast.length || entry.family.startsWith('world.') ? 'world'
    : !cast.some(id => id === 'goaden' || id === 'ashai') ? 'supporting' : 'lead';
  const leads = ['goaden', 'ashai'].filter(id => cast.includes(id));
  const gates = { triggerTypes: triggers, lane, ...(cast.length ? { requiredCast: cast } : {}) };
  if (leads.length) gates.activitiesByActor = Object.fromEntries(leads.map(id => [id, ['unhurried_time', 'waiting', 'travelling', 'quiet_break']]));
  reviews[entry.id] = {
    sourceHash: reservoirSourceHash(entry), status: 'accepted', location: `${place.location}/${place.area}`, gates,
    ...(same ? {} : { locationReason: 'Normalized to the runtime location for this committed event family.' }),
    reason,
  };
}

const b03 = JSON.parse(readFileSync(b03Path, 'utf8'));
const extra = [];
const stats = { skippedDup: 0, future: 0, blocked: 0, admitted: 0, already: 0 };
for (const scene of b03.scenes || []) {
  if (existingIds.has(scene.id)) { stats.already++; continue; }
  const entry = asEntry(scene);
  const normal = entry.prose.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (existingTexts.has(normal)) { stats.skippedDup++; continue; }
  const blocked = blockReason(entry);
  if (blocked?.skip) {
    stats.future++;
    continue;
  }
  if (blocked) {
    reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), status: 'staged', reason: blocked.reason };
    extra.push(entry);
    existingIds.add(entry.id);
    stats.blocked++;
    continue;
  }
  accept(entry, 'Batch 03 current-world READY/RARE surface bound to an existing committed event type.');
  extra.push(entry);
  existingIds.add(entry.id);
  existingTexts.add(normal);
  stats.admitted++;
}

if (extra.length) {
  let current = batches.find(b => b.batch_id === 'greah-grounded-batch-03');
  if (!current) {
    current = {
      batch_id: 'greah-grounded-batch-03',
      status: 'accepted',
      count: 0,
      effect_policy: 'surface_only',
      notes: ['Admitted remaining canon-safe current-world Batch 03 surfaces.'],
      entries: [],
    };
    batches.push(current);
  }
  current.entries.push(...extra);
  current.count = current.entries.length;
}

writeFileSync(dataPath, '// Imported authored sources retained whole; only content-bound reviewed rows activate.\n'
  + `export const SCENE_RESERVOIR_BATCHES = ${JSON.stringify(batches, null, 2)};\n`
  + `export const SCENE_RESERVOIR_REVIEWS = ${JSON.stringify(reviews, null, 2)};\n`);

const importedIds = [], importedTexts = [];
for (const batch of batches) {
  const out = normalizeReservoirBatch(batch, { reviews, existingIds: importedIds, existingTexts: importedTexts });
  importedIds.push(...batch.entries.map(e => e.id));
  importedTexts.push(...batch.entries.map(e => e.prose));
  console.log(batch.batch_id, { total: out.report.total, accepted: out.report.accepted,
    staged: out.report.staged, rejected: out.report.rejected });
}
console.log('batch03 extra', stats, 'new rows', extra.length);
