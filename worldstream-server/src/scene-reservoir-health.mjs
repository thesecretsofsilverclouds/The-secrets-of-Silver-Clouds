import { SCENE_RESERVOIR_CATALOG } from './scene-reservoir-catalog.mjs';

const HOUR = 3_600_000, DAY = 24 * HOUR, WINDOW = 72 * HOUR;
const LEADS = new Set(['goaden', 'ashai']);
const GATES = ['triggerTypes', 'activitiesByActor', 'minimumActivityMsByActor', 'weatherCodes', 'dayparts',
  'lane', 'requiredCast', 'optionalCast', 'originTypes'];
const lastAt = record => record?.lastAt ?? record?.at;
const valid = scene => scene.status === 'enabled' && scene.effectPolicy === 'surface_only'
  && scene.reservoir?.family && scene.reservoir?.sourceId && !scene.dependencies?.length
  && scene.reservoir.triggerTypes?.length
  && scene.beats?.some(beat => beat.kind === 'prose' && beat.text?.trim());
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function matches(event, scene) {
  if (!scene.reservoir.triggerTypes.includes(event.type) &&
      !(scene.reservoir.triggerTypes.includes('SANCTUARY_VISIT')
        && ((event.type === 'TRAVEL_ARRIVE' && event.location === 'sanctuary')
          || (event.type === 'VENUE_SCENE' && event.location === 'sanctuary')))) return false;
  if (scene.reservoir.triggerTypes.includes('LEGION_VISIT') && event.type === 'LEGION_VISIT') {
    /* Legion visits occur wherever the pair actually are, not at the warehouse. */
  } else if (scene.reservoir.triggerTypes.includes('WEATHER_CHANGE') && event.type === 'WEATHER_CHANGE') {
    /* World weather has no single room. */
  } else if (event.location !== scene.location || (scene.area && event.area && event.area !== scene.area
      && !(event.type === 'TRAVEL_DEPART' && scene.location === 'streamliner'))) return false;
  const witnesses = new Set([...(event.participants ?? []), ...(event.payload?.cast ?? []),
    ...(event.payload?.visitors ?? []), event.payload?.who]);
  if (witnesses.has('goaden')) witnesses.add('kai');
  if (witnesses.has('ashai')) witnesses.add('greah');
  const required = (scene.reservoir.requiredCast ?? scene.cast ?? []).filter(id => id && id !== 'world');
  return required.every(id => LEADS.has(id) ? event.participants?.includes(id)
    : id === 'kai' ? event.participants?.includes('goaden')
      : id === 'greah' ? event.participants?.includes('ashai') : witnesses.has(id));
}

/** Pure coverage, not admission. Historical demand means exact committed
 * source signatures, not a claim that current actor/weather gates held then.
 * Temporary family/pair cooldowns never manufacture a content deficit.
 */
export function sceneReservoirHealth(snapshot = {}, { catalog = SCENE_RESERVOIR_CATALOG } = {}) {
  const scenes = catalog.filter(valid).slice().sort((a, b) => a.id.localeCompare(b.id));
  const completed = snapshot.sceneBank?.completed ?? {};
  const events = snapshot.events ?? [];
  const now = Number.isFinite(snapshot.world?.resolvedThrough) ? snapshot.world.resolvedThrough
    : events.reduce((time, event) => Math.max(time, event.occurredAt || 0), snapshot.meta?.startMs || 0);
  const recent = [...new Map(events.filter(event => event.visibility === 'public' && event.id
    && Number.isFinite(event.occurredAt) && event.occurredAt <= now && now - event.occurredAt < WINDOW)
    .map(event => [event.id, event])).values()];
  const fresh = scene => !completed[scene.id] || (Number.isFinite(lastAt(completed[scene.id]))
    && now - lastAt(completed[scene.id]) >= (scene.reservoir.cooldown?.sceneDays ?? 30) * DAY);
  const cooling = scene => scenes.some(prior => {
    if (prior.id === scene.id) return false;
    const at = lastAt(completed[prior.id]);
    if (!Number.isFinite(at)) return false;
    const ago = now - at;
    return (prior.reservoir.family === scene.reservoir.family
      && ago < (scene.reservoir.cooldown?.familyHours ?? 36) * HOUR)
      || (prior.location === scene.location && [...prior.cast].sort().join('|') === [...scene.cast].sort().join('|')
        && ago < (scene.reservoir.cooldown?.pairHours ?? 8) * HOUR);
  });
  const archetypes = Object.fromEntries(scenes.map(scene => [scene.id, {
    id: scene.id, metadata: { sourceId: scene.reservoir.sourceId, familyId: scene.reservoir.family,
      cast: [...scene.cast], location: scene.location, area: scene.area,
      gates: structuredClone(Object.fromEntries(GATES.filter(key => scene.reservoir[key] !== undefined)
        .map(key => [key, scene.reservoir[key]]))), effectPolicy: 'surface_only' },
    allowedFacts: scene.beats.filter(beat => beat.kind === 'prose').map(beat => beat.text),
    provenance: { sourceHash: scene.reservoir.sourceHash, batchId: scene.reservoir.batchId,
      origin: scene.reservoir.origin, sourceProvenance: scene.reservoir.sourceProvenance },
  }]));
  const deficits = [], families = [];
  for (const familyId of [...new Set(scenes.map(scene => scene.reservoir.family))].sort()) {
    const bank = scenes.filter(scene => scene.reservoir.family === familyId);
    const demand = recent.filter(event => bank.some(scene => matches(event, scene)));
    // An unused scene in another room/cast cannot conceal this signature's gap.
    const exhausted = bank.find(scene => {
      const recurring = demand.filter(event => matches(event, scene));
      return !fresh(scene) && recurring.length >= 2 && recurring.every(event =>
        !bank.some(alternate => matches(event, alternate) && fresh(alternate)));
    });
    const freshCount = bank.filter(fresh).length;
    const eligibleFreshCount = bank.filter(scene => fresh(scene) && !cooling(scene)).length;
    families.push({ familyId, approvedCount: bank.length, freshCount, eligibleFreshCount,
      coolingCount: freshCount - eligibleFreshCount, recentExposureCount: demand.length });
    if (exhausted) deficits.push({ familyId, archetypeId: exhausted.id, eligibleFreshCount: 0,
      recentExposureCount: demand.filter(event => matches(event, exhausted)).length });
  }
  return freeze({ status: deficits.length ? 'needs_refill' : scenes.length ? 'covered' : 'no_approved_reserve',
    families, deficits, metrics: { approvedSceneCount: scenes.length,
      freshSceneCount: families.reduce((sum, family) => sum + family.freshCount, 0),
      eligibleFreshCount: families.reduce((sum, family) => sum + family.eligibleFreshCount, 0),
      deficitFamilyCount: deficits.length, recentPublicEventCount: recent.length, windowMs: WINDOW, asOf: now }, archetypes });
}
