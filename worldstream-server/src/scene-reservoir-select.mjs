import { createHash } from 'node:crypto';
import { SCENE_RESERVOIR_CATALOG, actorAlias, normalizeReservoirLocation } from './scene-reservoir-catalog.mjs';
import { SEALED_AREAS } from './places.mjs';
import { LEGION_CONTRACT_BINDINGS } from './legion-job-bindings.mjs';
import { daypart } from './sky.mjs';

const SKIP = new Set(['CONVERSATION','SCENE_BANK_BEAT','SCENE_BANK_GATHER','SCENE_BANK_REJOIN']);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const hash = text => createHash('sha256').update(text).digest('hex');
const byTrigger = new Map();
for (const scene of SCENE_RESERVOIR_CATALOG) {
  if (scene.status !== 'enabled' || scene.effectPolicy !== 'surface_only') continue;
  for (const trigger of scene.reservoir?.triggerTypes ?? []) {
    const list = byTrigger.get(trigger);
    if (list) list.push(scene); else byTrigger.set(trigger, [scene]);
  }
}
function indexedCandidates(event, catalog) {
  if (catalog !== SCENE_RESERVOIR_CATALOG) {
    return catalog.filter(scene => scene.status === 'enabled' && scene.effectPolicy === 'surface_only');
  }
  const found = new Set(byTrigger.get(event.type) ?? []);
  if (eventSatisfiesTrigger(event, 'SANCTUARY_VISIT')) {
    for (const scene of byTrigger.get('SANCTUARY_VISIT') ?? []) found.add(scene);
  }
  if (eventSatisfiesTrigger(event, 'LEGION_VISIT')) {
    for (const scene of byTrigger.get('LEGION_VISIT') ?? []) found.add(scene);
  }
  return [...found];
}

export function reservoirEventPlace(event) {
  if (!event) return null;
  let location = event.location, area = event.area;
  if (event.type === 'TRAVEL_DEPART') { location = location || 'streamliner'; area = area || 'transit'; }
  if (location === 'streamliner') area = area || 'transit';
  if (location === 'sanctuary' && (area === 'venue' || !area)) area = 'central_hub';
  if (location === 'big_ben_plaza' && !area) area = 'venue';
  if (location === 'cafe' && !area) area = 'venue';
  if (location === 'enchanted_ink' && !area) area = 'venue';
  if (location === 'legion_hideout' && !area) area = 'venue';
  if (event.type === 'SIDE_PRESENCE') area = event.payload?.area || area;
  if (SEALED_AREAS.includes(area)) return null;
  const resolved = normalizeReservoirLocation(area ? `${location}/${area}` : location);
  return resolved ?? (location ? { location, area: area ?? null } : null);
}

export function eventSatisfiesTrigger(event, trigger) {
  if (!event?.type || !trigger) return false;
  if (event.type === trigger) return true;
  if (trigger === 'SANCTUARY_VISIT') {
    return (event.type === 'TRAVEL_ARRIVE' && (event.location === 'sanctuary' || event.payload?.to === 'sanctuary'))
      || (event.type === 'VENUE_SCENE' && event.location === 'sanctuary')
      || (event.type === 'LEGION_VISIT' && event.location === 'sanctuary');
  }
  if (trigger === 'LEGION_VISIT' && event.type.startsWith('LEGION_JOB_')) {
    return true;
  }
  return false;
}

export function reservoirWitnesses(event) {
  const ids = new Set([...(event.participants ?? []), ...(event.payload?.cast ?? []),
    ...(event.payload?.visitors ?? []), event.payload?.who, event.payload?.guest]
    .filter(Boolean).map(actorAlias));
  if (ids.has('goaden')) ids.add('kai');
  if (ids.has('ashai')) ids.add('greah');
  return ids;
}

function requiredCast(scene) {
  const named = scene.reservoir?.requiredCast ?? scene.cast ?? [];
  return named.map(actorAlias).filter(id => id && id !== 'world');
}

function locationCompatible(event, scene) {
  const gate = scene.reservoir ?? {};
  const triggers = gate.triggerTypes ?? [];
  if (triggers.includes('WEATHER_CHANGE') && event.type === 'WEATHER_CHANGE') return true;
  if (triggers.includes('INSTITUTION_NOTICE') && event.type === 'INSTITUTION_NOTICE') return true;
  if (triggers.includes('LEGION_VISIT') && (event.type === 'LEGION_VISIT' || event.type.startsWith('LEGION_JOB_'))) {
    return scene.location === 'legion_hideout' || String(scene.reservoir?.family ?? '').includes('legion')
      || (event.location === scene.location && (!scene.area || !event.area || scene.area === event.area));
  }
  if (triggers.includes('SANCTUARY_VISIT') && eventSatisfiesTrigger(event, 'SANCTUARY_VISIT')) {
    return event.location === 'sanctuary' || event.payload?.to === 'sanctuary';
  }
  const place = reservoirEventPlace(event);
  if (!place) return gate.lane === 'world';
  return place.location === scene.location && (!scene.area || !place.area || place.area === scene.area);
}

export function reservoirSurfaceMatches(event, scene, { now, weatherCode, knownEventIds } = {}) {
  const gate = scene?.reservoir;
  if (!event || event.visibility !== 'public' || !gate || SKIP.has(event.type)) return false;
  if (!(gate.triggerTypes ?? []).some(trigger => eventSatisfiesTrigger(event, trigger))) return false;
  if (!locationCompatible(event, scene)) return false;
  if (scene.reservoir?.family === 'legion_contracts') {
    const bind = LEGION_CONTRACT_BINDINGS[scene.reservoir.sourceId];
    if (!bind || !event.type?.startsWith('LEGION_JOB_')) return false;
    if (!bind.stages.includes(event.payload?.stage)) return false;
    if (bind.requirePaid && event.payload?.paymentStatus !== 'paid' && event.type !== 'LEGION_JOB_PAYMENT') return false;
  }
  const required = requiredCast(scene);
  const witnesses = reservoirWitnesses(event);
  if (required.some(id => !witnesses.has(id))) return false;
  if (gate.dayparts && !gate.dayparts.includes(daypart(now ?? event.occurredAt))) return false;
  if (gate.weatherCodes && weatherCode && !gate.weatherCodes.includes(weatherCode)) return false;
  if (gate.originTypes?.length) {
    if (!knownEventIds || ![...knownEventIds].length) return false;
  }
  if (scene.reservoir.family === 'callback.shared_recent' && !(knownEventIds && knownEventIds.size)) return false;
  return true;
}

function cooling(scene, event, memory) {
  const rule = scene.reservoir?.cooldown ?? { sceneDays: 30, familyHours: 36, pairHours: 8 };
  const last = memory.lastAt.get(scene.id);
  if (Number.isFinite(last) && event.occurredAt - last < (rule.sceneDays ?? 30) * DAY) return true;
  const familyAt = memory.familyAt.get(scene.reservoir.family);
  if (Number.isFinite(familyAt) && event.occurredAt - familyAt < (rule.familyHours ?? 36) * HOUR) return true;
  const pairKey = [...scene.cast].sort().join(',');
  const pairAt = memory.pairAt.get(pairKey);
  if (pairKey && Number.isFinite(pairAt) && event.occurredAt - pairAt < (rule.pairHours ?? 8) * HOUR) return true;
  return false;
}

function remember(memory, scene, event) {
  memory.plays.set(scene.id, (memory.plays.get(scene.id) ?? 0) + 1);
  memory.lastAt.set(scene.id, event.occurredAt);
  memory.familyAt.set(scene.reservoir.family, event.occurredAt);
  const pairKey = [...scene.cast].sort().join(',');
  if (pairKey) memory.pairAt.set(pairKey, event.occurredAt);
}

export function createReservoirMemory() {
  return { plays: new Map(), lastAt: new Map(), familyAt: new Map(), pairAt: new Map() };
}

/** Deterministic presentation pick. Memory is optional: without it, eligibility
 * is a function of the committed event alone and the event identity breaks ties.
 * Request time and viewer count are never consulted.
 */
export function selectReservoirSurface(event, {
  catalog = SCENE_RESERVOIR_CATALOG, memory = null, seed = '', weatherCode = null, knownEventIds = null, now = null,
} = {}) {
  if (!event || SKIP.has(event.type) || event.visibility !== 'public') return null;
  const eligible = indexedCandidates(event, catalog).filter(scene =>
    reservoirSurfaceMatches(event, scene, { now: now ?? event.occurredAt, weatherCode, knownEventIds }));
  const available = memory ? eligible.filter(scene => !cooling(scene, event, memory)) : eligible;
  const pool = available.length ? available : [];
  if (!pool.length) return null;
  const fewest = memory ? Math.min(...pool.map(scene => memory.plays.get(scene.id) ?? 0)) : 0;
  const fresh = memory ? pool.filter(scene => (memory.plays.get(scene.id) ?? 0) === fewest) : pool;
  fresh.sort((a, b) => hash(`${seed}|reservoir-select-v1|${event.id}|${a.id}`)
    .localeCompare(hash(`${seed}|reservoir-select-v1|${event.id}|${b.id}`)));
  const choice = fresh[0];
  if (memory && choice) remember(memory, choice, event);
  return choice;
}

export function reservoirPresentation(event, options = {}) {
  const scene = selectReservoirSurface(event, options);
  if (!scene) return null;
  const prose = scene.beats?.find(beat => beat.kind === 'prose')?.text;
  return prose ? { prose, reservoirSourceId: scene.reservoir.sourceId, reservoirFamily: scene.reservoir.family,
    reservoirSceneId: scene.id } : null;
}
