import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { normalizeReservoirBatch, normalizeReservoirLocation, reservoirSourceHash, RESERVOIR_TRIGGERS, actorAlias } from '../src/scene-reservoir-catalog.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const b04Path = resolve(root, '../../../../WORLDSTREAM_CANON_CONTENT_MEGA_BATCH_04/WORLDSTREAM_CANON_READY_RESERVOIR_BATCH_04.json');
const scenes = JSON.parse(readFileSync(b04Path, 'utf8')).scenes;
const reviews = { ...SCENE_RESERVOIR_REVIEWS };
const batches = SCENE_RESERVOIR_BATCHES.map(b => ({ ...b, entries: [...b.entries] }));
const existingIds = new Set(batches.flatMap(b => b.entries.map(e => e.id)));
const existingTexts = new Set(batches.flatMap(b => b.entries.map(e =>
  e.prose.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim())));

function mapTriggers(raw) {
  const parts = (Array.isArray(raw) ? raw : String(raw || '').split('|')).map(t => t.trim()).filter(Boolean);
  const out = new Set();
  for (const t of parts) {
    if (t === 'TRAVEL' || t === 'TRAVEL_BEGIN') { out.add('TRAVEL_DEPART'); out.add('TRAVEL_ARRIVE'); continue; }
    if (t === 'MEAL' || t === 'SHARED_MEAL') { out.add('MEAL_BEGIN'); continue; }
    if (t === 'REST') { out.add('REST_BEGIN'); continue; }
    if (t === 'QUIET_TIME') { out.add('QUIET_TIME_BEGIN'); continue; }
    if (t === 'GAME') { out.add('GAME_BEGIN'); out.add('GAME_PAUSE'); continue; }
    if (t === 'TRAINING' || t === 'TRAINING_COMPLETE') { out.add('PRACTICE_END'); continue; }
    if (t === 'PUBLIC_IDLE') { out.add('VENUE_SCENE'); continue; }
    if (t === 'ANY' || t === 'CONVERSATION' || t === 'NIMBUS_PRESENT' || t === 'CALLBACK') continue;
    if (RESERVOIR_TRIGGERS.has(t)) out.add(t);
  }
  return [...out];
}

function accept(entry, reason, extra = {}) {
  const cast = (entry.cast || []).map(actorAlias).filter(id => id && id !== 'world');
  let triggers = mapTriggers(entry.trigger_family);
  if (entry.family === 'streamliner_reusable') triggers = ['TRAVEL_DEPART', 'TRAVEL_ARRIVE'];
  if (entry.family === 'sanctuary_unlocked') triggers = ['TRAVEL_ARRIVE', 'VENUE_SCENE', 'SANCTUARY_VISIT'];
  if (entry.family === 'legion_current') triggers = ['LEGION_VISIT'];
  if (entry.family === 'emily_early_unlocked') triggers = ['VENUE_SCENE', 'SUPPORTING_ENCOUNTER'];
  if (entry.family === 'nimbus_reusable') triggers = triggers.length ? triggers : ['CROSS_PATHS', 'ACTIVITY_COMPLETE'];
  if (entry.family === 'guardian_micro') triggers = triggers.length ? triggers : ['QUIET_TIME_BEGIN', 'REST_BEGIN', 'ACTIVITY_COMPLETE'];
  triggers = triggers.filter(t => RESERVOIR_TRIGGERS.has(t));
  if (!triggers.length) triggers = ['ACTIVITY_COMPLETE', 'CROSS_PATHS'];
  const locs = entry.location || [];
  let location = null;
  for (const loc of locs) { const n = normalizeReservoirLocation(loc); if (n) { location = `${n.location}/${n.area}`; break; } }
  if (!location) {
    location = entry.family.includes('streamliner') ? 'streamliner/transit'
      : entry.family.includes('sanctuary') ? 'sanctuary/central_hub'
      : entry.family.includes('emily') ? 'big_ben_plaza/venue'
      : entry.family.includes('music') ? 'mi6/music_room'
      : 'mi6/common_room';
  }
  const place = normalizeReservoirLocation(location);
  const declared = locs.map(normalizeReservoirLocation).filter(Boolean);
  const same = declared.some(v => v.location === place.location && v.area === place.area);
  const lane = !cast.length || entry.family.startsWith('world.') ? 'world'
    : !cast.some(id => id === 'goaden' || id === 'ashai') ? 'supporting' : 'lead';
  const leads = ['goaden', 'ashai'].filter(id => cast.includes(id));
  const gates = { triggerTypes: triggers, lane, ...(cast.length ? { requiredCast: cast } : {}) };
  if (leads.length) {
    const acts = new Set(['unhurried_time']);
    if (triggers.some(t => t.startsWith('TRAVEL'))) ['travelling', 'waiting'].forEach(a => acts.add(a));
    if (triggers.includes('MEAL_BEGIN')) acts.add('eating');
    if (triggers.includes('REST_BEGIN')) acts.add('resting');
    if (triggers.includes('PRACTICE_END')) acts.add('training');
    gates.activitiesByActor = Object.fromEntries(leads.map(id => [id, [...acts]]));
  }
  reviews[entry.id] = {
    sourceHash: reservoirSourceHash(entry), status: extra.status || 'accepted', location, gates,
    ...(same ? {} : { locationReason: 'Normalized to the runtime location for this committed event family.' }),
    reason, ...extra.review,
  };
}

const extra = [];
for (const scene of scenes) {
  if (existingIds.has(scene.id)) continue;
  const entry = {
    id: scene.id, family: scene.family, origin: scene.origin || 'batch_04', status: 'accepted',
    register: 'micro_scene', cast: scene.cast || [], location: scene.locations || [],
    trigger_family: (scene.triggerCandidates || []).join('|'), effect_policy: 'surface_only', prose: scene.prose,
  };
  const normal = entry.prose.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (existingTexts.has(normal)) continue;
  if (entry.family === 'whisper_downtime' || (entry.cast || []).includes('whisper')) {
    reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), status: 'staged',
      reason: 'Whisper is under the spoiler embargo; no runtime actor id exists until that story is admitted.' };
    extra.push(entry); existingIds.add(entry.id); continue;
  }
  if ((entry.cast || []).includes('marley')) {
    reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), status: 'staged',
      reason: 'Marley is not a current runtime actor; the simulation does not produce this cast.' };
    extra.push(entry); existingIds.add(entry.id); continue;
  }
  accept(entry, 'Batch 04 current-world surface bound to an existing committed event type.');
  extra.push(entry); existingIds.add(entry.id); existingTexts.add(normal);
}

const current = batches.find(b => b.batch_id === 'worldstream-canon-ready-batch-04');
current.entries.push(...extra);
current.count = current.entries.length;

// Whisper/marley already in production: restage rather than reject as unknown actor.
for (const batch of batches) {
  for (const entry of batch.entries) {
    const cast = entry.cast || [];
    if (cast.includes('whisper') || entry.family === 'whisper_downtime') {
      reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), status: 'staged',
        reason: 'Whisper is under the spoiler embargo; no runtime actor id exists until that story is admitted.' };
    } else if (cast.includes('marley')) {
      reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), status: 'staged',
        reason: 'Marley is not a current runtime actor; the simulation does not produce this cast.' };
    } else if (cast.includes('supporting')) {
      reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), status: 'staged',
        reason: 'Placeholder actor id “supporting” is not a runtime character; the actual named cast is required.' };
    }
  }
}

const target = resolve(root, '../src/scene-reservoir-data.mjs');
writeFileSync(target, '// Imported authored sources retained whole; only content-bound reviewed rows activate.\n'
  + `export const SCENE_RESERVOIR_BATCHES = ${JSON.stringify(batches, null, 2)};\n`
  + `export const SCENE_RESERVOIR_REVIEWS = ${JSON.stringify(reviews, null, 2)};\n`);

const importedIds = [], importedTexts = [];
for (const batch of batches) {
  const out = normalizeReservoirBatch(batch, { reviews, existingIds: importedIds, existingTexts: importedTexts });
  importedIds.push(...batch.entries.map(e => e.id));
  importedTexts.push(...batch.entries.map(e => e.prose));
  console.log(batch.batch_id, { total: out.report.total, accepted: out.report.accepted, staged: out.report.staged, rejected: out.report.rejected });
}
console.log('added batch04 extras', extra.length);
console.log('catalog', importedIds.length, 'wait accepted sum next');
