import { actorAlias, normalizeReservoirLocation } from './scene-reservoir-catalog.mjs';
import { SEALED_AREAS } from './places.mjs';
import { LEGION_CONTRACT_BINDINGS } from './legion-job-bindings.mjs';
import { daypart } from './sky.mjs';

const SKIP = new Set(['CONVERSATION','SCENE_BANK_BEAT','SCENE_BANK_GATHER','SCENE_BANK_REJOIN']);

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

function checkDavisBetrayal(state, atMs) {
  if (!state) return false;
  if (state.facts?.['canon.davis_betrayal_overheard'] || state.facts?.['davis_betrayal_overheard']) {
    const fact = state.facts['canon.davis_betrayal_overheard'] || state.facts['davis_betrayal_overheard'];
    if (atMs === undefined || atMs === null || fact.createdAt <= atMs) return true;
  }
  const ashai = state.characters?.ashai;
  if (ashai?.knowledge) {
    return ashai.knowledge.some(k =>
      (k.factKey === 'canon.davis_betrayal_overheard' || k.factKey === 'davis_betrayal_overheard') &&
      (atMs === undefined || atMs === null || k.learnedAt <= atMs)
    );
  }
  return false;
}

export function reservoirSurfaceMatches(event, scene, { now, weatherCode, knownEventIds, state, hasDavisBetrayal } = {}) {
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
  if (scene.reservoir?.family === 'davis_ashai_rivalry') {
    const betrayed = hasDavisBetrayal !== null && hasDavisBetrayal !== undefined
      ? Boolean(hasDavisBetrayal)
      : (state ? checkDavisBetrayal(state, now ?? event.occurredAt) : false);
    if (!betrayed) return false;
  }
  if (scene.reservoir?.family === 'davis_pre_disclosure') {
    const betrayed = hasDavisBetrayal !== null && hasDavisBetrayal !== undefined
      ? Boolean(hasDavisBetrayal)
      : (state ? checkDavisBetrayal(state, now ?? event.occurredAt) : false);
    if (betrayed) return false;
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

