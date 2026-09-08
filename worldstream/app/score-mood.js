// Pure presentation policy. An urgent midnight scene still has an urgent score.
export function scoreMood(world, scene = null) {
  if (scene) {
    if (['INCIDENT', 'ARCANE_SURGE', 'RECALL'].includes(scene.eventType)) return 'pressure';
    if (['gaming', 'watching_television'].includes(scene.activity)) return 'play';
    return scene.time?.dayPhase === 'night' ? 'night' : 'ordinary';
  }
  const people = Array.isArray(world?.characters) ? world.characters : [];
  const factions = world?.factions ?? {};
  if (factions.mi6 === 'elevated' || factions.arcane === 'high' || factions.order === 'active_in_city') return 'pressure';
  if (people.some(p => ['gaming', 'watching_television'].includes(p.activity))) return 'play';
  if ((people.length && people.every(p => p.activity === 'sleeping'))
    || ['small_hours', 'night'].includes(world?.time?.daypart)) return 'night';
  return 'ordinary';
}
