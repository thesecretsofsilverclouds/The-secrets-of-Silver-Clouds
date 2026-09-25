import { knownSupportingHistory } from './relationship-choices.mjs';
import { narrativeSceneTags } from './narrative-scene-tags.mjs';

const HOUR = 3_600_000;
const clamp = x => Math.max(0, Math.min(1, x));
export const SPECTRA_RULES = Object.freeze({version: 1, pressureWindow: 7 * 24 * HOUR,
  commitmentHorizon: 6 * HOUR, maxEvidence: 8, maxLogWeight: Math.log(1.25)});
const active = (state, now) => state?.narrativeSignals?.version === 1
  && state.narrativeSignals.enabled !== false && Number.isSafeInteger(now)
  && (state.narrativeSignals.activatedAt == null || now >= state.narrativeSignals.activatedAt);

function pressureEvidence(state, who, now) {
  const actor = state.characters?.[who], carried = state.pressure?.carried;
  if (!actor || !Number.isFinite(carried) || carried <= 0) return [];
  return (actor.knowledge ?? []).flatMap(memory => {
    const fact = state.facts?.[memory.factKey];
    if (fact?.kind !== 'incident' || fact.key !== memory.factKey || !fact.sourceEventId
      || !['high', 'critical'].includes(fact.value?.severity)
      || ![who, 'both'].includes(fact.subject) || memory.sourceEventId !== fact.sourceEventId
      || !memory.acquisitionEventId || !Number.isSafeInteger(fact.createdAt) || fact.createdAt > now
      || now - fact.createdAt > SPECTRA_RULES.pressureWindow
      || !Number.isSafeInteger(memory.learnedAt) || memory.learnedAt < fact.createdAt || memory.learnedAt > now
      || (memory.validUntil != null && memory.validUntil <= now)
      || (fact.validUntil != null && fact.validUntil <= now)) return [];
    return [{kind: 'pressure_residue', who, factKey: fact.key, sourceEventId: fact.sourceEventId,
      acquisitionEventId: memory.acquisitionEventId, at: fact.createdAt,
      confidence: clamp(carried * (1 - (now - fact.createdAt) / SPECTRA_RULES.pressureWindow))}];
  });
}

function obligationEvidence(state, who, now) {
  const upcoming = Object.entries(state.arrangements ?? {}).filter(([, item]) =>
    ['accepted', 'started'].includes(item.status) && item.party?.includes(who)
    && typeof item.sourceEventId === 'string' && item.sourceEventId.length > 0
    && Number.isSafeInteger(item.startAt) && Number.isSafeInteger(item.until)
    && item.until > item.startAt && item.until > now && item.startAt < now + SPECTRA_RULES.commitmentHorizon)
    .sort(([a], [b]) => a.localeCompare(b));
  const evidence = [];
  for (let i = 0; i < upcoming.length && evidence.length < SPECTRA_RULES.maxEvidence; i++) {
    for (let j = i + 1; j < upcoming.length && evidence.length < SPECTRA_RULES.maxEvidence; j++) {
      const [key, a] = upcoming[i], [otherKey, b] = upcoming[j];
      if (a.startAt >= b.until || b.startAt >= a.until) continue;
      evidence.push({kind: 'fragile_obligation', who, arrangementKeys: [key, otherKey],
        sourceEventId: a.sourceEventId, otherSourceEventId: b.sourceEventId,
        at: Math.max(a.startAt, b.startAt), confidence: 1});
    }
  }
  return evidence;
}

/** Exact precursor view of already-committed state. No forecast, synthetic
 * emotions, continuous Jacobian or writes: every signal retains its proof. */
function collectEvidence(state, scene, now, memo = null) {
  if (!active(state, now)) return [];
  const tags = narrativeSceneTags(scene);
  if (!tags?.evidenceKinds.length) return [];
  const evidence = [];
  for (const who of [...new Set(scene.cast ?? [])].sort()) {
    if (!state.characters?.[who]) continue;
    if (tags.evidenceKinds.includes('pressure_residue')) evidence.push(...read(memo,`pressure:${who}`,
      () => pressureEvidence(state, who, now)));
    if (tags.evidenceKinds.includes('fragile_obligation')) evidence.push(...read(memo,`obligation:${who}`,
      () => obligationEvidence(state, who, now)));
    if (tags.evidenceKinds.includes('unresolved_interruption')) {
      for (const guest of scene.cast.filter(id => id !== who && !state.characters?.[id])) {
        const a = read(memo,`history:${who}:${who}:${guest}`,() => knownSupportingHistory(state, who, who, guest, now))[0];
        const b = read(memo,`history:${guest}:${who}:${guest}`,() => knownSupportingHistory(state, guest, who, guest, now))[0];
        // Both people experienced this same interrupted attempt, and neither
        // history has a newer kept meeting that would resolve the signal.
        if (a?.interrupted === true && a.outcome !== 'kept' && b?.sourceEventId === a.sourceEventId)
          evidence.push({kind: 'unresolved_interruption', who, guest, factKey: a.factKey,
            sourceEventId: a.sourceEventId, acquisitionEventId: a.acquisitionEventId,
            otherAcquisitionEventId: b.acquisitionEventId, at: a.createdAt, confidence: 1});
      }
    }
  }
  return evidence.sort((a,b) => b.confidence - a.confidence || b.at - a.at
    || a.sourceEventId.localeCompare(b.sourceEventId) || a.who.localeCompare(b.who))
    .slice(0, SPECTRA_RULES.maxEvidence);
}

function read(memo,key,calculate) {
  if (!memo) return calculate();
  if (!memo.has(key)) memo.set(key,calculate());
  return memo.get(key);
}
export const spectraEvidence = (state, scene, now) => collectEvidence(state, scene, now);
function score(state, scene, now, memo = null) {
  const evidence = collectEvidence(state, scene, now, memo), tags = narrativeSceneTags(scene);
  // Affinity is categorical and content-reviewed; multiple sources or a larger
  // cast cannot multiply the contribution. Subtlety is fixed by that review.
  return {score: evidence.length ? clamp(evidence[0].confidence * tags.subtlety) : 0, evidence};
}
export const spectraSceneScore = (state, scene, now) => score(state, scene, now);

// One synchronous selection call owns this view. It is never stored on world
// state or cached across actions: another action at the same timestamp may
// have committed different facts. Shared actors are scanned once per view.
export function createSpectraScorer(state, now) {
  const memo = new Map();
  return scene => score(state, scene, now, memo);
}
