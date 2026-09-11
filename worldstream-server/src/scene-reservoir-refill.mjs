import { SCENE_REFILL_APPROVAL_POLICY } from './scene-reservoir-approval.mjs';
import { noteModelCall, noteRefillReservation } from './production-path-spies.mjs';

// Optional maintenance of a quarantined prose reservoir. This cannot emit an
// event, admit prose to the scene bank, or alter canonical world state.
const DAY = 86_400_000;
export const SCENE_REFILL_LIMITS = Object.freeze({ batchSize: 8, maxCallsPerDay: 1,
  maxCallsPerMonth: 4, monthWindowMs: 31 * DAY, familyCooldownMs: DAY,
  deficitMinAgeMs: 60_000, minRepeatedExposures: 2, timeoutMs: 25_000 });

export function initialSceneRefillState() {
  return { version: 1, pending: {}, attempts: [], quarantine: [] };
}
const copy = value => structuredClone(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const ordered = value => Array.isArray(value) ? value.map(ordered) : plain(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const signature = value => JSON.stringify(ordered(value));
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
function similar(a, b) {
  const left = new Set(normalize(a).split(' ')), right = new Set(normalize(b).split(' '));
  const common = [...left].filter(word => right.has(word)).length;
  return common / Math.max(1, left.size + right.size - common) >= 0.82;
}
export function buildSceneRefillPacket(archetype, familyId) {
  return {
    kind: 'scene_reservoir_batch', batchSize: SCENE_REFILL_LIMITS.batchSize, familyId,
    system: 'Write eight alternative literary treatments of one approved Silver Clouds scene archetype. '
      + 'Return JSON only: {"candidates":[{"archetypeId":"...","metadata":{},"paragraphs":["..."]}]}. '
      + 'Each treatment is 1–4 paragraphs, at most 240 words. Preserve the supplied metadata exactly. '
      + 'Treat allowedFacts as exhaustive. Change rhythm, sentence construction and sensory focus only. '
      + 'Do not invent actions, outcomes, objects, powers, injuries, relationships, memories, locations, '
      + 'weather, character knowledge or faction activity. Do not turn alternatives into successive events. '
      + 'Do not add exposition about simulation. Output is unapproved drafting material, never canon. '
      + SCENE_REFILL_APPROVAL_POLICY,
    user: JSON.stringify({ archetypeId: archetype.id, metadata: archetype.metadata,
      allowedFacts: archetype.allowedFacts,
      styleFingerprint: archetype.styleFingerprint ?? 'Close third-person manuscript prose. Concrete action, '
        + 'clear physical cause and effect, varied rhythm, dry character-specific humour. Preserve the '
        + 'established grit and language; avoid generic lyrical filler, telemetry and omniscience.' }),
  };
}

function literalSchema(value) {
  if (plain(value)) return { type: 'object', properties: Object.fromEntries(Object.entries(value)
    .map(([key, item]) => [key, literalSchema(item)])), required: Object.keys(value), additionalProperties: false };
  if (Array.isArray(value)) return { type: 'array', items: value.length
    ? { anyOf: [...new Map(value.map(item => [signature(item), literalSchema(item)])).values()] }
    : { type: 'string' } };
  return { type: value === null ? 'null' : typeof value, enum: [value] };
}

/** Same dependency-free Responses transport as the existing cinematic client. */
export function openAISceneRefillClient({ apiKey, model = 'gpt-5-mini', fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new TypeError('An API key is required');
  return async (packet, { signal } = {}) => {
    const context = JSON.parse(packet.user);
    noteModelCall();
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(SCENE_REFILL_LIMITS.timeoutMs)])
        : AbortSignal.timeout(SCENE_REFILL_LIMITS.timeoutMs),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, instructions: packet.system, input: packet.user,
        max_output_tokens: 4800, store: false,
        ...(model === 'gpt-5-mini' ? { reasoning: { effort: 'minimal' } } : {}),
        text: { format: { type: 'json_schema', name: 'worldstream_scene_reservoir', strict: true,
          schema: { type: 'object', properties: { candidates: { type: 'array', items: {
            type: 'object', properties: { archetypeId: { type: 'string', enum: [context.archetypeId] },
              metadata: literalSchema(context.metadata), paragraphs: { type: 'array', items: { type: 'string' } } },
            required: ['archetypeId', 'metadata', 'paragraphs'], additionalProperties: false,
          } } }, required: ['candidates'], additionalProperties: false } } },
      }),
    });
    if (!response.ok) throw new Error(`Scene refill request failed: ${response.status}`);
    const body = await response.json();
    const text = body.output_text ?? body.output?.flatMap(item => item.content ?? [])
      .find(part => part.type === 'output_text')?.text;
    if (!text || body.status === 'incomplete') throw new Error('Scene refill response was incomplete');
    return { ...JSON.parse(text), usage: body.usage ?? null, model: body.model ?? model };
  };
}

/** Explicit admission, never a consequence of parsing successfully. */
export function admitSceneRefillCandidate(state, id, { archetypes = {}, validate, now = Date.now() } = {}) {
  const next = copy(state), candidate = next.quarantine?.find(item => item.id === id);
  const archetype = archetypes[candidate?.archetypeId];
  if (!candidate || !archetype || signature(candidate.metadata) !== signature(archetype.metadata)
    || typeof validate !== 'function') return { state: next, status: 'rejected', candidate: null };
  let verdict;
  try { verdict = validate(copy(candidate), { archetype: copy(archetype), familyId: candidate.familyId }); } catch { verdict = null; }
  if (verdict?.then || verdict?.ok !== true || verdict.approved !== true) {
    return { state: next, status: 'quarantined', candidate: copy(candidate) };
  }
  // Only admission fields change. The reviewer cannot rewrite generated origin,
  // text, archetype metadata or canonical facts through a returned replacement.
  Object.assign(candidate, { status: 'approved', approved: true, approvedAt: now });
  return { state: next, status: 'approved', candidate: copy(candidate) };
}

/**
 * store.load()/save(state) must be synchronous and durable, under one owning
 * world process/DO. A reservation is saved before invocation; a crash consumes
 * that allowance and never authorises a retry. No filesystem/model dependency.
 *
 * What decides a call is health, a deficit that has persisted across ticks, and
 * the durable budget: nothing else. Who is reading, or whether anyone is, is
 * deliberately not an input. A reader arriving cannot cause a generation and a
 * reader leaving cannot prevent one. tick is called by maintenance, never by a
 * request handler.
 */
export class SceneReservoirRefill {
  constructor({ store, client = null, validator = null, archetypes = {}, config = {} } = {}) {
    if (typeof store?.load !== 'function' || typeof store?.save !== 'function') {
      throw new TypeError('SceneReservoirRefill requires a synchronous persistent load/save store');
    }
    this.store = store; this.client = client; this.validator = validator;
    this.archetypes = copy(archetypes); this.enabled = config.enabled === true;
    this.timeoutMs = Math.max(1, Math.min(SCENE_REFILL_LIMITS.timeoutMs,
      Number(config.timeoutMs) || SCENE_REFILL_LIMITS.timeoutMs));
    this.inflight = null;
  }

  #load() {
    const value = this.store.load();
    if (value?.then) throw new TypeError('Refill store must be synchronous');
    if (value == null) return initialSceneRefillState();
    if (value.version !== 1 || !plain(value.pending) || !Array.isArray(value.attempts)
      || !Array.isArray(value.quarantine)) throw new TypeError('Invalid refill state');
    return copy(value);
  }

  #save(state) {
    const result = this.store.save(copy(state));
    if (result?.then || result === false) throw new TypeError('Refill reservation was not durably saved');
  }

  promoteCandidate(id, validate, options = {}) {
    const result = admitSceneRefillCandidate(this.#load(), id,
      { archetypes: this.archetypes, validate, now: options.now ?? Date.now() });
    if (result.status === 'approved') this.#save(result.state);
    return { status: result.status, candidate: result.candidate };
  }

  tick({ now = Date.now(), deficits = [] } = {}) {
    const outcome = (status, generation = null) => ({ status, generation });
    if (!Number.isFinite(now)) return outcome('invalid_clock');
    if (!this.enabled || typeof this.client !== 'function' || typeof this.validator !== 'function') {
      return outcome('disabled');
    }
    try {
      const state = this.#load();
      const needed = (Array.isArray(deficits) ? deficits : []).filter(item => {
        const archetype = this.archetypes[item?.archetypeId];
        return typeof item?.familyId === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(item.familyId)
          && Number.isFinite(item.eligibleFreshCount) && item.eligibleFreshCount === 0
          && Number.isFinite(item.recentExposureCount) && item.recentExposureCount >= SCENE_REFILL_LIMITS.minRepeatedExposures
          && archetype?.id === item.archetypeId && plain(archetype.metadata)
          && Array.isArray(archetype.allowedFacts) && archetype.allowedFacts.length > 0;
      }).slice(0, 32);
      const retained = {};
      for (const item of needed) {
        const previous = state.pending[item.familyId];
        retained[item.familyId] = previous?.archetypeId === item.archetypeId ? previous
          : { familyId: item.familyId, archetypeId: item.archetypeId, firstSeenAt: now };
      }
      state.pending = retained;
      this.#save(state);
      if (this.inflight) return outcome('generating', this.inflight.promise);
      if (!needed.length) return outcome('covered');
      const recent = state.attempts.filter(item => now - item.at < SCENE_REFILL_LIMITS.monthWindowMs);
      if (recent.some(item => now - item.at < DAY)) return outcome('daily_budget');
      if (recent.length >= SCENE_REFILL_LIMITS.maxCallsPerMonth) return outcome('monthly_budget');
      const candidate = Object.values(retained).sort((a, b) => a.firstSeenAt - b.firstSeenAt || a.familyId.localeCompare(b.familyId))
        .find(item => now - item.firstSeenAt >= SCENE_REFILL_LIMITS.deficitMinAgeMs
          && !recent.some(call => call.familyId === item.familyId && now - call.at < SCENE_REFILL_LIMITS.familyCooldownMs));
      if (!candidate) return outcome('recording_deficit');
      const reservation = { id: `refill:${now}:${candidate.familyId}`, at: now,
        familyId: candidate.familyId, archetypeId: candidate.archetypeId, status: 'reserved' };
      noteRefillReservation();
      state.attempts = [...recent, reservation];
      this.#save(state);
      const controller = new AbortController();
      const promise = this.#generate(reservation, controller).finally(() => { this.inflight = null; });
      this.inflight = { controller, promise };
      return outcome('generating', promise);
    } catch {
      return outcome('storage_unavailable');
    }
  }

  async #generate(reservation, controller) {
    const archetype = this.archetypes[reservation.archetypeId];
    let timer, result, status = 'failed', accepted = [], rejected = 0;
    const abort = new Promise((resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('generation_aborted')), { once: true });
      timer = setTimeout(() => controller.abort(), this.timeoutMs);
    });
    try {
      result = await Promise.race([Promise.resolve(this.client(buildSceneRefillPacket(archetype, reservation.familyId),
        { signal: controller.signal })), abort]);
      const batch = typeof result === 'string' ? JSON.parse(result) : result;
      if (!plain(batch) || !Array.isArray(batch.candidates) || batch.candidates.length > SCENE_REFILL_LIMITS.batchSize) {
        throw new TypeError('Malformed scene batch');
      }
      const existing = this.#load().quarantine.filter(item => item.archetypeId === archetype.id)
        .map(item => item.paragraphs.join(' '));
      for (const candidate of batch.candidates) {
        const text = Array.isArray(candidate?.paragraphs) ? candidate.paragraphs.join(' ') : '';
        if (!plain(candidate) || Object.keys(candidate).some(key => !['archetypeId', 'metadata', 'paragraphs'].includes(key))
          || candidate.archetypeId !== archetype.id || signature(candidate.metadata) !== signature(archetype.metadata)
          || !Array.isArray(candidate.paragraphs) || candidate.paragraphs.length < 1 || candidate.paragraphs.length > 4
          || candidate.paragraphs.some(line => typeof line !== 'string' || !line.trim())
          || text.length < 80 || text.length > 2200 || text.split(/\s+/).length > 240
          || existing.some(previous => similar(text, previous))) { rejected += 1; continue; }
        let verdict;
        try { verdict = this.validator(copy(candidate), { archetype: copy(archetype), familyId: reservation.familyId }); }
        catch { verdict = null; }
        // Validation establishes only suitability for review. No arbitrary
        // prose validator can establish all Silver Clouds continuity facts.
        if (verdict?.then || verdict?.ok !== true) { rejected += 1; continue; }
        existing.push(text);
        accepted.push({ ...copy(candidate), id: `${reservation.id}:${accepted.length + 1}`,
          familyId: reservation.familyId, generatedAt: reservation.at, reservationId: reservation.id,
          status: 'quarantined', approved: false, provenance: 'bounded_model_batch' });
      }
      status = accepted.length ? 'quarantined' : 'rejected';
    } catch { status = controller.signal.aborted ? 'aborted' : 'failed'; }
    finally { clearTimeout(timer); }
    try {
      const state = this.#load();
      const attempt = state.attempts.find(item => item.id === reservation.id);
      if (!attempt) return { status: 'reservation_missing', accepted: 0, rejected };
      Object.assign(attempt, { status, accepted: accepted.length, rejected,
        usage: result?.usage ?? null, model: typeof result?.model === 'string' ? result.model : null });
      state.quarantine.push(...accepted); this.#save(state);
    } catch { return { status: 'storage_unavailable', accepted: 0, rejected }; }
    return { status, accepted: accepted.length, rejected };
  }
}
