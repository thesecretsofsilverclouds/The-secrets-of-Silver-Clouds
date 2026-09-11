import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENE_RESERVOIR_BATCHES, SCENE_RESERVOIR_REVIEWS } from '../src/scene-reservoir-data.mjs';
import { normalizeReservoirBatch, normalizeReservoirLocation, reservoirSourceHash, RESERVOIR_TRIGGERS, actorAlias } from '../src/scene-reservoir-catalog.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(root, '../src/scene-reservoir-data.mjs');
const reviews = { ...SCENE_RESERVOIR_REVIEWS };
const batches = SCENE_RESERVOIR_BATCHES.map(batch => ({ ...batch, entries: [...batch.entries] }));

const BLOCK_FAMILIES = new Set(['whisper_downtime', 'duskkin_compliance', 'onari_environment',
  'mi6_contractors', 'magical_london_incidents', 'multifaction_briefings']);
const CANON_BLOCK_IDS = new Set([
  'davis_ashai_rivalry.013', 'davis_ashai_rivalry.014',
]);

function mapTriggers(raw) {
  const parts = (Array.isArray(raw) ? raw : String(raw || '').split('|')).map(t => t.trim()).filter(Boolean);
  const out = new Set();
  for (const t of parts) {
    if (t === 'TRAVEL' || t === 'TRAVEL_BEGIN') { out.add('TRAVEL_DEPART'); out.add('TRAVEL_ARRIVE'); continue; }
    if (t === 'MEAL' || t === 'SHARED_MEAL' || t === 'MEAL_BEGIN') { out.add('MEAL_BEGIN'); continue; }
    if (t === 'REST' || t === 'REST_BEGIN') { out.add('REST_BEGIN'); continue; }
    if (t === 'QUIET_TIME' || t === 'QUIET_TIME_BEGIN') { out.add('QUIET_TIME_BEGIN'); continue; }
    if (t === 'GAME' || t === 'GAME_BEGIN') { out.add('GAME_BEGIN'); out.add('GAME_PAUSE'); out.add('GAME_RESUME'); continue; }
    if (t === 'TRAINING' || t === 'TRAINING_COMPLETE' || t === 'PRACTICE_END') { out.add('PRACTICE_END'); continue; }
    if (t === 'ACTIVITY_BEGIN' || t === 'PRACTICE_BEGIN') { out.add('PRACTICE_BEGIN'); continue; }
    if (t === 'PIANO' || t === 'PIANO_BEGIN') { out.add('PIANO_BEGIN'); continue; }
    if (t === 'NIGHT_SHIFT') { out.add('QUIET_TIME_BEGIN'); out.add('REST_BEGIN'); continue; }
    if (t === 'PUBLIC_IDLE') { out.add('VENUE_SCENE'); continue; }
    if (t === 'OFFSCREEN_END') { out.add('OFFSCREEN_RESULT'); continue; }
    if (t === 'CALLBACK') continue;
    if (t === 'ANY' || t === 'CONVERSATION' || t === 'NIMBUS_PRESENT') continue;
    if (RESERVOIR_TRIGGERS.has(t)) out.add(t);
  }
  return [...out];
}

function pickLocation(entry, family) {
  const locs = entry.location || entry.locations || [];
  for (const loc of locs) {
    const n = normalizeReservoirLocation(loc);
    if (n) return `${n.location}/${n.area}`;
  }
  if (family?.includes('streamliner') || family === 'travel.streamliner') return 'streamliner/transit';
  if (family?.includes('sanctuary')) return 'sanctuary/central_hub';
  if (family?.includes('legion')) return 'mi6/common_room';
  if (family?.includes('emily') || family?.includes('plaza')) return 'big_ben_plaza/venue';
  if (family?.includes('weather')) return 'mi6/common_room';
  if (family?.includes('music')) return 'mi6/music_room';
  if (family?.includes('training')) return 'mi6/training';
  if (family?.includes('gaming') || family?.includes('yukon')) return 'mi6/common_room';
  return 'mi6/common_room';
}

function activitiesFor(triggers, cast) {
  const leads = ['goaden', 'ashai'].filter(id => cast.includes(id));
  if (!leads.length) return {};
  const set = new Set();
  if (triggers.some(t => t.startsWith('TRAVEL'))) ['travelling', 'unhurried_time', 'waiting'].forEach(a => set.add(a));
  if (triggers.includes('MEAL_BEGIN')) set.add('eating');
  if (triggers.includes('REST_BEGIN')) ['resting', 'quiet_break'].forEach(a => set.add(a));
  if (triggers.includes('QUIET_TIME_BEGIN')) ['quiet_break', 'unhurried_time'].forEach(a => set.add(a));
  if (triggers.includes('PRACTICE_END') || triggers.includes('PRACTICE_BEGIN')) set.add('training');
  if (triggers.includes('CROSS_PATHS') || triggers.includes('ACTIVITY_COMPLETE')) set.add('unhurried_time');
  if (triggers.includes('LEGION_VISIT') || triggers.includes('VENUE_SCENE') || triggers.includes('SANCTUARY_VISIT') || triggers.includes('SIDE_PRESENCE'))
    ['unhurried_time', 'waiting'].forEach(a => set.add(a));
  if (triggers.includes('GAME_BEGIN') || triggers.includes('GAME_PAUSE')) set.add('gaming');
  if (triggers.includes('TV_BEGIN')) set.add('watching_television');
  if (triggers.includes('PIANO_BEGIN')) set.add('listening_to_music');
  if (triggers.includes('WEATHER_CHANGE') || triggers.includes('MOMENT_NOTICED')) ['unhurried_time', 'quiet_break'].forEach(a => set.add(a));
  if (!set.size) set.add('unhurried_time');
  return Object.fromEntries(leads.map(id => [id, [...set]]));
}

function laneFor(cast, family) {
  if (!cast.length || family?.startsWith('world.')) return 'world';
  if (!cast.some(id => id === 'goaden' || id === 'ashai')) return 'supporting';
  return 'lead';
}

function classifyBlock(entry) {
  const family = entry.family || '';
  const cast = (entry.cast || []).map(actorAlias);
  if (BLOCK_FAMILIES.has(family) || family.startsWith('whisper'))
    return { status: 'staged', reason: 'Whisper/future-simulation material is embargoed until that addon generator exists.' };
  if (CANON_BLOCK_IDS.has(entry.id))
    return { status: 'staged', reason: 'Open Davis/Ashai rivalry requires the post-disclosure relationship phase.' };
  if (cast.includes('balthazar') && !cast.includes('anarchy'))
    return { status: 'staged', reason: 'Balthazar cannot appear independently of Anarchy.' };
  if (family.startsWith('callback.'))
    return { status: 'staged', reason: 'Requires an exact earlier public origin event and knowledge path; no callback source is supplied.' };
  const current = reviews[entry.id];
  if (current?.status === 'staged' && /Pendant warmth|unverified magical/.test(current.reason || ''))
    return { status: 'staged', reason: current.reason };
  if (current?.status === 'staged' && /spilled-tray|safety notice|third agent|staggered arrivals|hall emptying|ten elapsed/.test(current.reason || ''))
    return { status: 'staged', reason: current.reason };
  return null;
}

function acceptReview(entry, reason) {
  const cast = (entry.cast || []).map(actorAlias).filter(id => id && id !== 'world');
  let triggers = mapTriggers(entry.trigger_family || entry.triggerFamily || entry.triggerCandidates);
  if (entry.family === 'travel.streamliner' || entry.family === 'streamliner_reusable')
    triggers = ['TRAVEL_DEPART', 'TRAVEL_ARRIVE'];
  if (entry.family === 'sanctuary.visit' || entry.family === 'sanctuary_unlocked')
    triggers = ['TRAVEL_ARRIVE', 'VENUE_SCENE', 'SANCTUARY_VISIT'];
  if (entry.family === 'legion_current') triggers = ['LEGION_VISIT'];
  if (entry.family === 'offscreen.emily_plaza' || entry.family === 'emily_early_unlocked')
    triggers = ['VENUE_SCENE', 'SUPPORTING_ENCOUNTER'];
  if (entry.family === 'world.weather_magic') triggers = ['WEATHER_CHANGE', 'INSTITUTION_NOTICE', 'MOMENT_NOTICED'];
  if (entry.family === 'supporting.hammond') triggers = ['SIDE_PRESENCE', 'SUPPORTING_ENCOUNTER'];
  if (entry.family === 'supporting.henderson') triggers = ['SIDE_PRESENCE', 'SUPPORTING_ENCOUNTER', 'CROSS_PATHS'];
  if (entry.family === 'nimbus_reusable') triggers = triggers.length ? triggers : ['CROSS_PATHS', 'ACTIVITY_COMPLETE', 'QUIET_TIME_BEGIN'];
  triggers = triggers.filter(t => RESERVOIR_TRIGGERS.has(t));
  if (!triggers.length) triggers = ['ACTIVITY_COMPLETE', 'CROSS_PATHS'];
  const location = pickLocation(entry, entry.family);
  const declared = (entry.location || entry.locations || []).map(normalizeReservoirLocation).filter(Boolean);
  const place = normalizeReservoirLocation(location);
  const same = declared.some(value => value.location === place.location && value.area === place.area);
  const lane = laneFor(cast, entry.family);
  const gates = { triggerTypes: triggers, lane };
  const acts = activitiesFor(triggers, cast);
  if (Object.keys(acts).length) gates.activitiesByActor = acts;
  if (cast.length) gates.requiredCast = cast;
  reviews[entry.id] = {
    sourceHash: reservoirSourceHash(entry),
    status: 'accepted',
    location,
    gates,
    ...(same ? {} : { locationReason: 'Normalized to the runtime location that already hosts this committed event family.' }),
    reason,
  };
}

function asEntry(scene) {
  return {
    id: scene.id,
    family: scene.family,
    origin: scene.origin || 'batch_04',
    status: 'accepted',
    register: 'micro_scene',
    cast: scene.cast || [],
    location: scene.locations || scene.location || [],
    trigger_family: Array.isArray(scene.triggerCandidates) ? scene.triggerCandidates.join('|') : (scene.trigger_family || ''),
    effect_policy: 'surface_only',
    prose: scene.prose,
  };
}

// 1. Promote eligible existing reviews.
const promoted = { travel: 0, world: 0, supporting: 0, emily: 0, other: 0 };
for (const batch of batches) {
  for (const entry of batch.entries) {
    const block = classifyBlock(entry);
    if (block) {
      const prev = reviews[entry.id];
      if (prev?.status === 'accepted') continue;
      reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), ...block };
      continue;
    }
    const prev = reviews[entry.id];
    if (prev?.status === 'accepted' && prev.location && prev.gates?.triggerTypes?.length) continue;
    const family = entry.family || '';
    let reason = 'Presentation overlay for a committed current-world event; review gates bind trigger, location and required cast.';
    if (family.includes('streamliner') || family === 'travel.streamliner') { reason = 'Streamliner travel already commits TRAVEL_DEPART/TRAVEL_ARRIVE; presentation overlay does not require freeLead.'; promoted.travel++; }
    else if (family.startsWith('world.')) { reason = 'World/weather lane: WEATHER_CHANGE and related notices already commit.'; promoted.world++; }
    else if (family.startsWith('supporting.') || family.includes('cliff') || family.includes('hammond')) { reason = 'Supporting/world presentation lane; required cast must be present on the committed event.'; promoted.supporting++; }
    else if (family.includes('emily')) { reason = 'Emily plaza prose binds to VENUE_SCENE/SUPPORTING_ENCOUNTER when Emily is present.'; promoted.emily++; }
    else promoted.other++;
    acceptReview(entry, reason);
  }
}

// 2. Apply leftover batch-01 promoted-review metadata if still unused.
const promotedPath = resolve(root, '../data/batch-01-promoted-reviews.json');
if (existsSync(promotedPath)) {
  const extra = JSON.parse(readFileSync(promotedPath, 'utf8'));
  const b01 = batches.find(b => b.batch_id === 'greah-batch-01');
  for (const [id, meta] of Object.entries(extra)) {
    const entry = b01?.entries.find(e => e.id === id);
    if (!entry || classifyBlock(entry)) continue;
    if (reviews[id]?.status === 'accepted' && reviews[id].gates?.triggerTypes) continue;
    acceptReview(entry, meta.reason || 'Promoted from existing valid review/gate metadata.');
    if (meta.location) reviews[id].location = meta.location;
    if (meta.gates) reviews[id].gates = { ...reviews[id].gates, ...meta.gates, lane: reviews[id].gates.lane };
    promoted.other++;
  }
}

// 3. Import Batch 02 if absent.
if (!batches.some(b => b.batch_id === 'reservoir-batch-02')) {
  const b02 = JSON.parse(readFileSync(resolve(root, '../data/scene-reservoir-batch-02.json'), 'utf8'));
  for (const entry of b02.entries) {
    if (classifyBlock(entry)) {
      reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), ...classifyBlock(entry) };
      continue;
    }
    acceptReview(entry, 'Batch 02 current-world reusable surface bound to existing committed triggers.');
  }
  batches.push({ ...b02, status: 'accepted', effect_policy: 'surface_only' });
}

// 4. Remaining Batch 04 scenes not already in a production batch.
const b04Path = resolve(root, '../../../WORLDSTREAM_CANON_CONTENT_MEGA_BATCH_04/WORLDSTREAM_CANON_READY_RESERVOIR_BATCH_04.json');
const existingIds = new Set(batches.flatMap(b => b.entries.map(e => e.id)));
const existingTexts = new Set(batches.flatMap(b => b.entries.map(e => e.prose.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim())));
if (existsSync(b04Path)) {
  const b04 = JSON.parse(readFileSync(b04Path, 'utf8'));
  const extra = [];
  for (const scene of b04.scenes || []) {
    if (existingIds.has(scene.id)) continue;
    const entry = asEntry(scene);
    const normal = entry.prose.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (existingTexts.has(normal)) continue;
    if (classifyBlock(entry)) {
      reviews[entry.id] = { sourceHash: reservoirSourceHash(entry), ...classifyBlock(entry) };
      extra.push(entry);
      existingIds.add(entry.id);
      continue;
    }
    acceptReview(entry, 'Batch 04 current-world READY/RARE surface bound to an existing committed event type.');
    extra.push(entry);
    existingIds.add(entry.id);
    existingTexts.add(normal);
  }
  if (extra.length) {
    const current = batches.find(b => b.batch_id === 'worldstream-canon-ready-batch-04');
    if (current) {
      current.entries.push(...extra);
      current.count = current.entries.length;
    } else {
      batches.push({
        batch_id: 'worldstream-canon-ready-batch-04',
        status: 'accepted',
        count: extra.length,
        effect_policy: 'surface_only',
        notes: ['Admitted remaining canon-ready current-world Batch 04 surfaces.'],
        entries: extra,
      });
    }
  }
}

writeFileSync(dataPath, '// Imported authored sources retained whole; only content-bound reviewed rows activate.\n'
  + `export const SCENE_RESERVOIR_BATCHES = ${JSON.stringify(batches, null, 2)};\n`
  + `export const SCENE_RESERVOIR_REVIEWS = ${JSON.stringify(reviews, null, 2)};\n`);

const result = batches.map(batch => normalizeReservoirBatch(batch, {
  reviews,
  existingIds: batches.filter(b => b !== batch).flatMap(b => b.entries.map(e => e.id)).filter(id =>
    batches.find(x => x === batch) && false),
}));

// Recount with sequential existing-id accumulation like the catalog.
const importedIds = [], importedTexts = [];
const reports = batches.map(batch => {
  const out = normalizeReservoirBatch(batch, { reviews, existingIds: importedIds, existingTexts: importedTexts });
  importedIds.push(...batch.entries.map(e => e.id));
  importedTexts.push(...batch.entries.map(e => e.prose));
  return out.report;
});

console.log('promoted buckets', promoted);
for (const report of reports) {
  console.log(report.batchId, { total: report.total, accepted: report.accepted, staged: report.staged, rejected: report.rejected });
}
console.log('catalog scenes', reports.reduce((n, r) => n + r.accepted, 0));
writeFileSync(resolve(root, '../reports/reservoir-activation-import.json'), JSON.stringify({ promoted, reports }, null, 2));
