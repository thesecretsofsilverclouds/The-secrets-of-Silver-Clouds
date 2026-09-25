import { createHash } from 'node:crypto';
import { SCENE_BANK_BY_ID } from './scene-bank-catalog.mjs';
import { NARRATIVE_SCENE_TAGS, narrativeSceneTags } from './narrative-scene-tags.mjs';
import { spectraSceneScore, createSpectraScorer, SPECTRA_RULES } from './spectra.mjs';
import { morphosSceneScore } from './morphos.mjs';
import { eventSatisfiesTrigger, reservoirSurfaceMatches } from './scene-reservoir-matches.mjs';

export const NARRATIVE_SELECTION_RULES = Object.freeze({version: 1, maxRelativeBias: 2,
  morphosLogWeight: Math.log(1.4), maxSnapshotEntries: 32, maxEvidencePerEntry: 3});
const hash = key => createHash('sha256').update(key).digest('hex');
const clamp = (x, lo, hi) => Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : 0;
const on = (state, now) => state?.narrativeSignals?.version === 1 && state.narrativeSignals.enabled !== false
  && (state.narrativeSignals.activatedAt == null || state.narrativeSignals.activatedAt <= now);

export function narrativeSceneWeight(state, scene, now, spectraScorer = null) {
  if (!on(state, now) || !narrativeSceneTags(scene)) return {logWeight: 0, evidence: []};
  const spectra = spectraScorer ? spectraScorer(scene) : spectraSceneScore(state, scene, now);
  const morphos = morphosSceneScore(state, scene, now);
  return {logWeight: SPECTRA_RULES.maxLogWeight * clamp(spectra.score, 0, 1)
      + NARRATIVE_SELECTION_RULES.morphosLogWeight * clamp(morphos.score, -1, 1),
    evidence: [...spectra.evidence, ...morphos.evidence].slice(0, NARRATIVE_SELECTION_RULES.maxEvidencePerEntry)};
}

/** Only call with the existing eligible, least-performed tier. Hashes retain
 * exactly the old order for neutral scores. A keyed exponential race changes
 * probability continuously with weight without consuming mutable RNG state. */
export function rankNarrativeScenes(scenes, {state = null, now, key, snapshot = null, disabled = false, hashLength = 64} = {}) {
  const spectraScorer = state && !snapshot && !disabled ? createSpectraScorer(state, now) : null;
  const scores = scenes.map(scene => {
    const annotation = narrativeSceneTags(scene);
    const record = !disabled && annotation && snapshot?.version === 1
      && snapshot.at === now && Array.isArray(snapshot.weights) && snapshot.weights.find(item => item.sceneId === scene.id
        && item.contentHash === annotation.contentHash && item.sourceHash === annotation.sourceHash);
    const live = !disabled && !snapshot ? narrativeSceneWeight(state, scene, now, spectraScorer) : null;
    const logWeight = disabled ? 0 : snapshot ? clamp(record?.logWeight,
      -NARRATIVE_SELECTION_RULES.morphosLogWeight,
      NARRATIVE_SELECTION_RULES.morphosLogWeight + SPECTRA_RULES.maxLogWeight)
      : live.logWeight;
    return {scene, logWeight, evidence: disabled ? [] : record?.evidence ?? live?.evidence ?? [],
      hash: hash(key(scene)).slice(0, hashLength)};
  });
  const lo = Math.min(...scores.map(item => item.logWeight));
  const hi = Math.max(...scores.map(item => item.logWeight));
  const scale = hi > lo ? Math.min(1, Math.log(NARRATIVE_SELECTION_RULES.maxRelativeBias) / (hi - lo)) : 1;
  for (const item of scores) {
    item.weight = Math.exp(item.logWeight * scale);
    const unit = (parseInt(item.hash.slice(0,13),16) + 1) / (0x10000000000000 + 1);
    item.race = -Math.log1p(-unit) / item.weight;
  }
  return scores.sort((a,b) => (hi === lo ? a.hash.localeCompare(b.hash)
    : a.race - b.race || a.hash.localeCompare(b.hash)) || a.scene.id.localeCompare(b.scene.id));
}

// Static source index, never world state. Most committed event types have no
// annotated reservoir passage and therefore need no signal reads or capsule.
const annotatedByTrigger = new Map();
for (const id of Object.keys(NARRATIVE_SCENE_TAGS).sort()) {
  const scene = SCENE_BANK_BY_ID[id];
  if (!scene?.reservoir || scene.status !== 'enabled' || !narrativeSceneTags(scene)) continue;
  for (const trigger of scene.reservoir.triggerTypes ?? []) {
    if (!annotatedByTrigger.has(trigger)) annotatedByTrigger.set(trigger, []);
    annotatedByTrigger.get(trigger).push(scene);
  }
}

/** Record event-time selection context once in the canonical event. A reader
 * cannot score an old event with today's pressure or today's motif field. */
export function narrativeSelectionSnapshot(state, event) {
  const now = event?.occurredAt;
  if (!Number.isSafeInteger(now) || !on(state, now) || event.visibility !== 'public'
    || ['CONVERSATION','SCENE_BANK_BEAT','SCENE_BANK_GATHER','SCENE_BANK_REJOIN'].includes(event.type)) return null;
  const candidates = new Set(annotatedByTrigger.get(event.type) ?? []);
  for (const alias of ['SANCTUARY_VISIT','LEGION_VISIT']) if (annotatedByTrigger.has(alias) && eventSatisfiesTrigger(event, alias))
    for (const scene of annotatedByTrigger.get(alias)) candidates.add(scene);
  if (!candidates.size) return null;
  const weights = [], spectraScorer = createSpectraScorer(state, now);
  const context = {now, weatherCode: state.weather?.code, state, knownEventIds: new Set(event.causedBy ?? [])};
  for (const scene of [...candidates].sort((a,b) => a.id.localeCompare(b.id))) {
    // Reuse the selector's exact gates before scanning memory or serializing
    // proofs. Scores for absent cast or the wrong trigger cannot be consumed.
    if (!reservoirSurfaceMatches(event, scene, context)) continue;
    const sceneId = scene.id, review = narrativeSceneTags(scene);
    const result = narrativeSceneWeight(state, scene, now, spectraScorer);
    if (!result.logWeight) continue;
    weights.push({sceneId, contentHash: review.contentHash, sourceHash: review.sourceHash,
      logWeight: result.logWeight, evidence: result.evidence});
    if (weights.length >= NARRATIVE_SELECTION_RULES.maxSnapshotEntries) break;
  }
  return weights.length ? {version: 1, at: now, weights} : null;
}
