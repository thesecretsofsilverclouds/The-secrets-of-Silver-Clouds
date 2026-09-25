import { AREAS_BY_LOCATION } from './places.mjs';
import { narrativeSceneTags } from './narrative-scene-tags.mjs';

// Local reaction/diffusion memory, not a knowledge or emotion simulator.
// A long memory and a shorter refractory field give a committed event a delayed
// echo. 36h/6h lifetimes leave a signal at the existing 12h/36h scene gates.
export const MORPHOS_RULES = Object.freeze({ stepMs: 900_000, memoryHours: 36,
  refractoryHours: 6, memoryMix: .06, refractoryMix: .12, extinction: 1e-6,
  maxNodes: 32, maxSources: 16 });
export const MORPHOS_MOTIFS = Object.freeze(['shared_recovery', 'companionship', 'practice', 'everyday_competition']);
const clamp = (n, low = 0, high = 1) => Math.min(high, Math.max(low, n));
const bucket = now => Math.floor(now / MORPHOS_RULES.stepMs);
const emptyFields = n => Object.fromEntries(MORPHOS_MOTIFS.map(m => [m, { a: Array(n).fill(0), i: Array(n).fill(0), sources: [] }]));
export function initialNarrativeSignals(now) {
  return { version: 1, enabled: true, activatedAt: now,
    morphos: { bucket: bucket(now), nodes: [], graph: [], fields: emptyFields(0), pending: [], sourceCursor: null },
    csv: { lastEvaluatedAt: null, lastEvaluation: null } };
}
export const narrativeSignalsActive = state => state?.narrativeSignals?.version === 1 && state.narrativeSignals.enabled !== false;

function topology(state) {
  const nodes = [...Object.keys(state.characters).sort().map(id => `actor:${id}`),
    ...Object.keys(AREAS_BY_LOCATION).sort().map(id => `place:${id}`)].slice(0, MORPHOS_RULES.maxNodes);
  const links = nodes.map(() => new Set());
  const link = (a, b) => { const i = nodes.indexOf(a), j = nodes.indexOf(b); if (i >= 0 && j >= 0 && i !== j) { links[i].add(j); links[j].add(i); } };
  const actors = Object.values(state.characters).filter(a => !a.journey);
  for (const actor of actors) link(`actor:${actor.id}`, `place:${actor.location}`);
  for (const a of actors) for (const b of actors) if (a.location === b.location && a.area === b.area) link(`actor:${a.id}`, `actor:${b.id}`);
  return { nodes, graph: links.map(row => [...row].sort((a, b) => a - b)) };
}
function diffuse(values, graph, mixing, hours) {
  const d = .25 * mixing, decay = Math.exp(-.25 / hours);
  return values.map((v, n) => decay * ((1 - d) * v + d * (graph[n].length
    ? graph[n].reduce((sum, j) => sum + values[j], 0) / graph[n].length : v)));
}
function alive(fields) { return Object.values(fields).some(f => f.a.some(Boolean) || f.i.some(Boolean)); }

// Called ONLY before a canonical action. With no actions between two buckets,
// topology cannot change. At a boundary, earlier pulses land before that
// timestamp's actions; actions at the boundary deposit in the NEXT bucket.
// This lazy fixed-step integration needs neither a second scheduler nor ticks
// driven by observers, and is identical across catch-up/restart chunk sizes.
export function advanceMorphos(signals, now) {
  if (!signals || signals.enabled === false) return signals;
  const target = bucket(now), old = signals.morphos;
  if (target <= old.bucket) return signals;
  const m = { ...old, fields: Object.fromEntries(Object.entries(old.fields).map(([key, field]) => [key, { ...field }])) };
  while (m.bucket < target) {
    if (!alive(m.fields) && !m.pending.length) { m.bucket = target; break; }
    m.bucket++;
    for (const field of Object.values(m.fields)) {
      field.a = diffuse(field.a, m.graph, MORPHOS_RULES.memoryMix, MORPHOS_RULES.memoryHours);
      field.i = diffuse(field.i, m.graph, MORPHOS_RULES.refractoryMix, MORPHOS_RULES.refractoryHours);
      if (Math.max(0, ...field.a, ...field.i) < MORPHOS_RULES.extinction) { field.a.fill(0); field.i.fill(0); field.sources = []; }
    }
    for (const pulse of m.pending.filter(p => p.bucket <= m.bucket)) {
      const field = m.fields[pulse.motif];
      for (const anchor of pulse.anchors) {
        const n = m.nodes.indexOf(anchor); if (n < 0) continue;
        field.a[n] = clamp(field.a[n] + .6); field.i[n] = clamp(field.i[n] + 1);
      }
      field.sources = [...new Set([...field.sources, pulse.sourceEventId])].slice(-MORPHOS_RULES.maxSources);
    }
    m.pending = m.pending.filter(p => p.bucket > m.bucket);
  }
  return { ...signals, morphos: m };
}

function eventMotifs(event) {
  if (event.visibility !== 'public') return [];
  if (event.type === 'PRACTICE_END') return ['practice'];
  if (event.type === 'INTENT_COMPLETE') {
    const activity = event.payload?.activity;
    return activity === 'practice' ? ['practice', 'companionship']
      : activity === 'game' ? ['everyday_competition', 'companionship'] : ['shared_recovery', 'companionship'];
  }
  if (event.type === 'SUPPORTING_OUTCOME' && event.payload?.outcome === 'kept') return ['companionship'];
  if (event.type === 'AFTERMATH') return ['shared_recovery'];
  return []; // Observations, selected echoes and conversations NEVER excite it.
}
function later(a, b) {
  return !b || a[0] > b[0] || a[0] === b[0] && (a[1] > b[1] || a[1] === b[1] && a[2] > b[2]);
}
export function commitMorphos(signals, state, event, action) {
  if (!signals || signals.enabled === false) return signals;
  const old = signals.morphos, next = topology(state);
  const motifs = eventMotifs(event), cursor = [event.occurredAt, action.priority ?? 0, action.id];
  const newPulse = motifs.length && later(cursor, old.sourceCursor);
  const sameNodes = old.nodes.length === next.nodes.length && old.nodes.every((id, n) => id === next.nodes[n]);
  const sameGraph = sameNodes && old.graph.every((row, n) => row.length === next.graph[n].length && row.every((v, j) => v === next.graph[n][j]));
  if (!newPulse && sameGraph) return signals;
  const m = { ...old, ...next };
  if (!sameNodes) m.fields = Object.fromEntries(Object.entries(old.fields).map(([key, field]) => [key, { ...field,
    a: next.nodes.map(id => field.a[old.nodes.indexOf(id)] ?? 0),
    i: next.nodes.map(id => field.i[old.nodes.indexOf(id)] ?? 0) }]));
  if (newPulse) {
    m.pending = [...old.pending];
    const anchors = [...new Set([...(event.participants ?? []).map(id => `actor:${id}`), `place:${event.location}`])]
      .filter(id => m.nodes.includes(id));
    for (const motif of motifs) {
      const pulse = { motif, bucket: bucket(event.occurredAt) + 1, anchors, sourceEventId: event.id };
      // At most one pulse per motif/source and a hard bounded pending queue.
      m.pending.push(pulse);
    }
    m.pending = m.pending.slice(-MORPHOS_RULES.maxSources * MORPHOS_MOTIFS.length);
    m.sourceCursor = cursor; // Retained after extinction: old events cannot revive a motif.
  }
  return { ...signals, morphos: m };
}

export function morphosSceneScore(state, scene, now) {
  if (!narrativeSignalsActive(state)) return { score: 0, evidence: [] };
  const tags = narrativeSceneTags(scene);
  if (!tags?.motifs?.length) return { score: 0, evidence: [] };
  const m = state.narrativeSignals.morphos;
  // Scoring is read-only and uses already-integrated simulation state.
  if (m.bucket > bucket(now)) return { score: 0, evidence: [] };
  const anchors = [...new Set([...(scene.cast ?? []).map(id => `actor:${id}`), `place:${scene.location}`])];
  const indices = anchors.map(id => m.nodes.indexOf(id)).filter(n => n >= 0);
  if (!indices.length) return { score: 0, evidence: [] };
  const fields = tags.motifs.map(id => m.fields[id]).filter(Boolean);
  if (!fields.length) return { score: 0, evidence: [] };
  const score = fields.reduce((sum, f) => sum + indices.reduce((n, j) => n + f.a[j] - f.i[j], 0) / indices.length, 0) / fields.length;
  return { score: clamp(score, -1, 1), evidence: [...new Set(fields.flatMap(f => f.sources))].slice(-MORPHOS_RULES.maxSources) };
}

/** One actor's own node, one motif: memory minus suppression in [-1,1]. A
 * read-only view for RHYTHM; it neither advances nor excites the field. */
export function morphosActorAffinity(state, who, motif, now) {
  if (!narrativeSignalsActive(state) || !MORPHOS_MOTIFS.includes(motif)) return 0;
  const m = state.narrativeSignals.morphos;
  if (m.bucket > bucket(now)) return 0;
  const n = m.nodes.indexOf(`actor:${who}`), field = m.fields[motif];
  return n < 0 || !field ? 0 : clamp(field.a[n] - field.i[n], -1, 1);
}

export function assertNarrativeSignals(state) {
  const s = state.narrativeSignals; if (!s) return;
  const m = s.morphos;
  if (s.version !== 1 || !Number.isSafeInteger(s.activatedAt) || !Number.isSafeInteger(m?.bucket)
    || m.nodes.length > MORPHOS_RULES.maxNodes || new Set(m.nodes).size !== m.nodes.length
    || m.graph.length !== m.nodes.length || m.pending.length > 64) throw new Error('Invalid narrative signals');
  for (const row of m.graph) if (row.some(n => !Number.isInteger(n) || n < 0 || n >= m.nodes.length)) throw new Error('Invalid motif graph');
  for (const motif of MORPHOS_MOTIFS) {
    const f = m.fields[motif];
    if (!f || f.a.length !== m.nodes.length || f.i.length !== m.nodes.length || f.sources.length > 16
      || [...f.a, ...f.i].some(n => !Number.isFinite(n) || n < 0 || n > 1)) throw new Error('Unbounded motif field');
  }
  for (const p of m.pending) if (!MORPHOS_MOTIFS.includes(p.motif) || p.bucket <= m.bucket
    || !p.sourceEventId || p.anchors.some(id => !m.nodes.includes(id))) throw new Error('Invalid motif pulse');
}
