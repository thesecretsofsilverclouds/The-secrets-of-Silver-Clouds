import { rankNarrativeScenes } from './narrative-selection.mjs';
import { SCENE_RESERVOIR_CATALOG } from './scene-reservoir-catalog.mjs';
import { eventSatisfiesTrigger, reservoirSurfaceMatches } from './scene-reservoir-matches.mjs';
export { eventSatisfiesTrigger, reservoirEventPlace, reservoirWitnesses, reservoirSurfaceMatches } from './scene-reservoir-matches.mjs';




const SKIP = new Set(['CONVERSATION','SCENE_BANK_BEAT','SCENE_BANK_GATHER','SCENE_BANK_REJOIN']);
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
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
  catalog = SCENE_RESERVOIR_CATALOG, memory = null, seed = '', weatherCode = null, knownEventIds = null, now = null, state = null, hasDavisBetrayal = null,
} = {}) {
  if (!event || SKIP.has(event.type) || event.visibility !== 'public') return null;
  const eligible = indexedCandidates(event, catalog).filter(scene =>
    reservoirSurfaceMatches(event, scene, { now: now ?? event.occurredAt, weatherCode, knownEventIds, state, hasDavisBetrayal }));
  const available = memory ? eligible.filter(scene => !cooling(scene, event, memory)) : eligible;
  const pool = available.length ? available : [];
  if (!pool.length) return null;
  const fewest = memory ? Math.min(...pool.map(scene => memory.plays.get(scene.id) ?? 0)) : 0;
  const fresh = memory ? pool.filter(scene => (memory.plays.get(scene.id) ?? 0) === fewest) : pool;
  const ranked = rankNarrativeScenes(fresh, {now: event.occurredAt,
    snapshot: event.payload?.narrativeSelection ?? {version: 1, at: event.occurredAt, weights: []},
    key: scene => `${seed}|reservoir-select-v1|${event.id}|${scene.id}`});
  const choice = ranked[0]?.scene;
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
