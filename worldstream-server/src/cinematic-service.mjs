import {
  CINEMATIC_PROMPT_VERSION, CINEMATIC_RULES_VERSION, acceptCinematicScene,
  buildScenePacket, deterministicFallbackScene,
  effectiveCinematicThreshold, scoreCinematicEvent, scenePacketKey,
  validateCinematicScene, performancePacket,
} from './cinematics.mjs';
import { editorialCinematicRecordForApi } from './editorial-cinematics.mjs';
import { londonDate } from './time.mjs';

const NO_PRESENCE = Object.freeze({ count: 0, activeSinceMs: null, checkedAt: null });

function publicPresence(value, now) {
  const count = Number.isFinite(Number(value?.count)) ? Math.max(0, Math.trunc(Number(value.count))) : 0;
  const activeSinceMs = count > 0 && typeof value?.activeSinceMs === 'number' && Number.isFinite(value.activeSinceMs)
    ? Number(value.activeSinceMs) : null;
  return Object.freeze({ count: activeSinceMs === null ? 0 : count, activeSinceMs, checkedAt: now });
}

/** In-memory liveness only. Canonical world state never depends on this map. */
export class ViewerRegistry {
  constructor({ ttlMs = 60_000, reconnectGraceMs = 15_000 } = {}) {
    this.ttlMs = Math.max(1, Number(ttlMs) || 60_000);
    this.reconnectGraceMs = Math.max(0, Number(reconnectGraceMs) || 0);
    this.viewers = new Map();
  }

  touch(id, now = Date.now()) {
    const key = String(id || '').trim().slice(0, 128);
    if (!key || !Number.isFinite(Number(now))) return null;
    const timestamp = Number(now);
    const previous = this.viewers.get(key);
    this.prune(timestamp);
    const joinedAt = previous && timestamp - previous.lastSeenAt <= this.ttlMs + this.reconnectGraceMs
      ? previous.joinedAt : timestamp;
    const viewer = { id: key, joinedAt, lastSeenAt: timestamp };
    this.viewers.set(key, viewer);
    return { ...viewer };
  }

  disconnect(id) {
    return this.viewers.delete(String(id || '').trim().slice(0, 128));
  }

  prune(now = Date.now()) {
    const timestamp = Number(now);
    for (const [id, viewer] of this.viewers) {
      if (!Number.isFinite(timestamp) || timestamp - viewer.lastSeenAt > this.ttlMs) this.viewers.delete(id);
    }
  }

  snapshot(now = Date.now()) {
    const timestamp = Number(now);
    this.prune(timestamp);
    const values = [...this.viewers.values()];
    // IDs never leave the registry. The generation service needs only proof of
    // liveness and the start of the current continuous viewing window.
    return Object.freeze({
      count: values.length,
      activeSinceMs: values.length ? Math.min(...values.map((viewer) => viewer.joinedAt)) : null,
      checkedAt: timestamp,
    });
  }
}

function candidateFrom(event, snapshot, store, now) {
  // The scene bank already contains the complete ordered performance.
  if (event.type === 'SCENE_BANK_BEAT') return null;
  const score = scoreCinematicEvent(event, { priorEvents: snapshot.events });
  if (score.score < 30) return null;
  const packet = buildScenePacket(event, snapshot, { callbacks: store.callbacksBefore(event.occurredAt) });
  return {
    eventId: event.id,
    rulesVersion: CINEMATIC_RULES_VERSION,
    promptVersion: CINEMATIC_PROMPT_VERSION,
    packetKey: scenePacketKey(packet), occurredAt: event.occurredAt,
    score: score.score, band: score.band, dimensions: score.dimensions, packet,
    createdAt: now,
  };
}

const DEFAULTS = Object.freeze({
  enabled: false, model: null, minScore: 52, maxCallsPerDay: 16,
  maxDailyCostUsd: 1, estimatedCostPerCallUsd: 0.05,
  reconnectGraceMs: 15_000, generationLeaseMs: 90_000, maxAttempts: 2,
  timeoutMs: 30_000, minSceneGapMs: 10 * 60_000, liveWindowMs: 180_000,
});

function terminalReason(reason) {
  return ['budget_ceiling', 'attempt_limit', 'generation_uncertain', 'fallback'].includes(reason);
}

export class CinematicService {
  constructor({ store, client = null, config = {}, now = Date.now, getPresence = null } = {}) {
    if (!store) throw new TypeError('CinematicService requires a store');
    this.store = store;
    this.client = client;
    this.config = Object.freeze({ ...DEFAULTS, ...(config ?? {}) });
    this.now = now;
    // Failing closed is intentional: a caller-supplied count must never be able
    // to stand in for the live ViewerRegistry.
    this.getPresence = typeof getPresence === 'function' ? getPresence : () => NO_PRESENCE;
    this.inflight = new Map();
    this.indexedIdentity = null;
    this.indexedSequence = 0;
  }

  #presence(now) {
    try { return publicPresence(this.getPresence(now), now); } catch { return publicPresence(null, now); }
  }

  #fallback(record, reason, now) {
    if (!record) return null;
    if (record.status !== 'fallback') return record;
    if (record.scene) return record;
    return this.store.setFallbackScene(record.eventId,
      deterministicFallbackScene(record.packet, reason || record.failureReason || 'fallback'), now);
  }

  #claimOptions(now) {
    return {
      londonDay: londonDate(now), now,
      maxAttempts: this.config.maxAttempts,
      leaseMs: this.config.generationLeaseMs,
      minSceneGapMs: this.config.minSceneGapMs,
      maxCallsPerDay: this.config.maxCallsPerDay,
      maxDailyCostUsd: this.config.maxDailyCostUsd,
      estimatedCostPerCallUsd: this.config.estimatedCostPerCallUsd,
    };
  }

  /**
   * Index committed events even with no audience. Performance selection uses
   * the explicitly supplied registry snapshot; actual generation independently
   * rechecks the injected registry.
   */
  ingest(snapshot, { presence = null, now = this.now() } = {}) {
    const records = [];
    const identity=JSON.stringify([snapshot?.world?.id,snapshot?.world?.seed,snapshot?.world?.rulesVersion]);
    if(identity!==this.indexedIdentity) {this.indexedIdentity=identity;this.indexedSequence=0;}
    let highWater=this.indexedSequence;
    for (const event of snapshot?.events ?? []) {
      if(Number.isSafeInteger(event.seq)) highWater=Math.max(highWater,event.seq);
      if (event.visibility !== 'public' || !event.publicDescription) continue;
      // Old source events in a bounded read support memories, not new scene packets.
      if(event.occurredAt < (snapshot.presentationFloor??-Infinity)) continue;
      // New committed events are indexed once. Reconsider only the small live
      // window for late-arriving viewers; its cached scene remains shared.
      if(Number.isSafeInteger(event.seq)&&event.seq<=this.indexedSequence
        &&event.occurredAt<now-this.config.liveWindowMs) continue;
      let current = this.store.get(event.id);
      if (!current) {
        const candidate = candidateFrom(event, snapshot, this.store, now);
        if (!candidate) continue;
        current = this.store.upsertCandidate(candidate, now);
      }
      records.push(current);
    }
    this.indexedSequence=highWater;

    const supplied = publicPresence(presence, now);
    if (supplied.count <= 0) {
      return { candidates: records, selected: null, generation: null };
    }
    const threshold = effectiveCinematicThreshold(supplied.count, this.config.minScore);
    const beginning = Math.max(supplied.activeSinceMs - this.config.reconnectGraceMs,
      now - this.config.liveWindowMs);
    const eligible = records.filter((item) => ['candidate', 'generating'].includes(item.status)
      && item.occurredAt >= beginning && item.occurredAt <= now
      && item.score >= threshold)
      .sort((a, b) => b.score - a.score || b.occurredAt - a.occurredAt
        || a.eventId.localeCompare(b.eventId));
    const selected = eligible[0] ?? null;
    if (!selected) return { candidates: records, selected: null, generation: null };
    if (!this.config.enabled || !this.client) {
      if (this.#presence(now).count <= 0) return { candidates: records, selected: null, generation: null };
      // The authored world can perform without a network connection. This is
      // cached presentation of an existing event, never a new simulation beat.
      const canonical = this.store.performCanonical(selected.eventId,
        deterministicFallbackScene(selected.packet, 'canonical_only'), { now, minSceneGapMs: this.config.minSceneGapMs });
      return { candidates: records, selected, generation: Promise.resolve(canonical) };
    }
    return {
      candidates: records, selected,
      generation: this.generate(selected.eventId, { now, presence: supplied })
        .catch(() => this.store.get(selected.eventId)),
    };
  }

  generate(eventId, { now = this.now(), presence = null } = {}) {
    const current = this.store.get(eventId);
    if (!current) return Promise.reject(new Error('Unknown cinematic candidate'));
    if (current.status === 'performed' || current.status === 'fallback'
      || !this.config.enabled || !this.client) return Promise.resolve(current);
    if (this.inflight.has(eventId)) return this.inflight.get(eventId);
    const promise = this.#generate(eventId, now, presence).finally(() => this.inflight.delete(eventId));
    this.inflight.set(eventId, promise);
    return promise;
  }

  async #callClient(packet, metadata) {
    const timeoutMs = Math.max(1, Number(this.config.timeoutMs) || DEFAULTS.timeoutMs);
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        const error = new Error('timeout');
        error.code = 'CINEMATIC_TIMEOUT';
        reject(error);
      }, timeoutMs);
      timer.unref?.();
    });
    let modelPromise;
    try {
      // Invoke synchronously after the last presence check and the durable claim.
      modelPromise = Promise.resolve(this.client(packet, { ...metadata, signal: controller.signal }));
    } catch (error) {
      clearTimeout(timer);
      throw error;
    }
    try { return await Promise.race([modelPromise, timeout]); }
    finally { clearTimeout(timer); }
  }

  async #generate(eventId, initialNow, suppliedPresence) {
    let current = this.store.get(eventId);
    if (!current) throw new Error('Unknown cinematic candidate');
    if (current.status === 'performed' || current.status === 'fallback') return current;

    // The explicit snapshot proves ingest selected this event during a viewing
    // window. The getter is the security boundary and is checked again now.
    const selectedPresence = publicPresence(suppliedPresence, initialNow);
    const live = this.#presence(initialNow);
    if (live.count <= 0 || (suppliedPresence && selectedPresence.count <= 0)) return current;

    let claim = this.store.claim(eventId, this.#claimOptions(initialNow));
    if (!claim.claimed) {
      if (claim.staleRecord?.status === 'fallback') {
        this.#fallback(claim.staleRecord, claim.reason, initialNow);
      }
      return terminalReason(claim.reason) ? this.#fallback(claim.record, claim.reason, initialNow) : claim.record;
    }

    let repairReason = null;
    while (claim.claimed) {
      const packet = claim.record.packet;
      const attempt = claim.record.attempts;
      try {
        const visiblePacket = performancePacket(packet);
        const result = await this.#callClient(visiblePacket, { attempt, repairReason });
        const scene = result?.scene ?? result;
        this.store.recordResponse(eventId, claim.ownerToken, scene, result?.usage ?? null);
        const verdict = validateCinematicScene(scene, visiblePacket);
        if (verdict.ok) {
          const accepted = acceptCinematicScene(scene, packet, { source: 'model' });
          return this.store.complete(eventId, claim.ownerToken, accepted, {
            model: result?.model ?? this.config.model, now: this.now(),
            minSceneGapMs: this.config.minSceneGapMs, usage: result?.usage ?? null,
          });
        }

        repairReason = verdict.reason;
        const retryNow = this.now();
        const canRetry = attempt < this.config.maxAttempts && this.#presence(retryNow).count > 0;
        if (!canRetry) {
          return this.store.fail(eventId, claim.ownerToken, verdict.reason, {
            fallbackScene: deterministicFallbackScene(packet, verdict.reason), now: retryNow,
            minSceneGapMs: this.config.minSceneGapMs,
          });
        }
        const retry = this.store.retry(eventId, claim.ownerToken, {
          ...this.#claimOptions(retryNow), priorOutcome: `rejected:${verdict.reason}`,
        });
        if (!retry.claimed) {
          if (retry.record.status === 'generating' && retry.reason === 'attempt_limit') {
            return this.store.fail(eventId, retry.ownerToken ?? claim.ownerToken, verdict.reason, {
              fallbackScene: deterministicFallbackScene(packet, verdict.reason), now: retryNow,
              minSceneGapMs: this.config.minSceneGapMs,
            });
          }
          return this.#fallback(retry.record, retry.reason, retryNow);
        }
        claim = retry;
      } catch (error) {
        // A timeout or transport exception can leave the provider's work
        // uncertain. Never launch a replacement attempt. Fence this owner,
        // preserve canonical fallback, and quarantine the global slot.
        const reason = `model:${error?.message ?? 'failure'}`;
        return this.store.fail(eventId, claim.ownerToken, reason, {
          fallbackScene: deterministicFallbackScene(packet, reason), now: this.now(),
          minSceneGapMs: this.config.minSceneGapMs,
          uncertain: true, leaseMs: this.config.generationLeaseMs,
        });
      }
    }
    return this.store.get(eventId);
  }

  nextPresentation({ afterAcceptedAt = 0, now = this.now(), eventById = null, publicSourcesForEvent = null } = {}) {
    const record = this.store.nextPresentation({
      afterAcceptedAt, now, maxAgeMs: Math.max(this.config.liveWindowMs, 180_000),
    });
    return editorialCinematicRecordForApi(record, {
      event: record && typeof eventById === 'function' ? eventById(record.eventId) : null,
      publicSourcesForEvent,
    });
  }

  status(now = this.now()) {
    const day = londonDate(now);
    const counts = this.store.counts();
    return {
      enabled: Boolean(this.config.enabled && this.client),
      model: this.config.model ?? null,
      candidateCount: counts.candidate ?? 0,
      performedCount: counts.performed ?? 0,
      fallbackCount: counts.fallback ?? 0,
      budget: this.store.budget(day),
      limits: {
        callsPerDay: this.config.maxCallsPerDay,
        dailyCostUsd: this.config.maxDailyCostUsd,
        minScore: this.config.minScore,
      },
    };
  }
}
