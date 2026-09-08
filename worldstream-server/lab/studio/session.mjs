import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// TRACK B — instrumentation for the one-hour Studio authoring experiment.
//
// The experiment's claim is economic, not aesthetic: *authoring character
// grammar expands runtime fiction faster than authoring scenes does.* A claim
// like that is worth nothing unless the cost side is measured as carefully as
// the benefit side, so this records the cost honestly — wall-clock authoring
// time, model calls, tokens, money, and how long the human spent reviewing.
//
// **This file adds no grammar and generates nothing.** It is the meter. The
// authoring itself happens only when the 18-Moment review has landed and named
// its targets.
//
// The one number that must not be gamed: an hour is an hour of *wall clock*,
// including the time spent reading model output and rejecting it. A session
// that produces forty lines in twenty minutes of generation and forty minutes
// of the author saying "no, she wouldn't" cost an hour.

const DIR = new URL('../runs/studio/', import.meta.url).pathname.replace(/^\//, '');

export const BUDGET_MINUTES = 60;

/** Start, or resume, a metered authoring session. */
export function openSession({ id, targets = [], budgetMinutes = BUDGET_MINUTES } = {}) {
  mkdirSync(DIR, { recursive: true });
  const path = `${DIR}${id}.json`;
  if (existsSync(path)) return { ...JSON.parse(readFileSync(path, 'utf8')), path };
  const session = {
    id, path, budgetMinutes,
    openedAt: new Date().toISOString(),
    closedAt: null,
    // Candidate targets are carried in so the session can be audited against
    // what it was *authorised* to touch. Anything authored outside this list is
    // scope creep and the report says so.
    targets,
    clock: { spans: [], totalMs: 0, running: null },
    model: { calls: [], inputTokens: 0, outputTokens: 0, costUsd: 0 },
    humanReview: { spans: [], totalMs: 0, running: null },
    authored: [],      // every unit accepted, with provenance
    rejected: [],      // every unit the author turned down — the honest denominator
  };
  save(session);
  return session;
}

const save = session => writeFileSync(session.path,
  JSON.stringify({ ...session, path: undefined }, null, 1));

const startSpan = (bucket, label) => {
  if (bucket.running) return bucket;
  bucket.running = { label, from: Date.now() };
  return bucket;
};
const stopSpan = bucket => {
  if (!bucket.running) return bucket;
  const span = { ...bucket.running, to: Date.now() };
  span.ms = span.to - span.from;
  bucket.spans.push(span);
  bucket.totalMs += span.ms;
  bucket.running = null;
  return bucket;
};

/** Authoring clock. Stop it while waiting on the human — that is review time. */
export function startAuthoring(session, label = 'authoring') {
  startSpan(session.clock, label); save(session); return session;
}
export function stopAuthoring(session) { stopSpan(session.clock); save(session); return session; }

/** Human review clock, kept separate so the two costs never blur. */
export function startReview(session, label = 'review') {
  startSpan(session.humanReview, label); save(session); return session;
}
export function stopReview(session) { stopSpan(session.humanReview); save(session); return session; }

// Per-million-token prices, so the cost column is real money rather than a
// token count nobody can interpret. Update if the model changes.
export const PRICING = Object.freeze({
  'claude-opus-5': { inputPerM: 15, outputPerM: 75 },
  'claude-sonnet-5': { inputPerM: 3, outputPerM: 15 },
});

/** Record one model call. Every call, including the ones that produced nothing. */
export function recordCall(session, { model, purpose, inputTokens, outputTokens,
  accepted = null, note = null }) {
  const price = PRICING[model] ?? { inputPerM: 0, outputPerM: 0 };
  const costUsd = (inputTokens / 1e6) * price.inputPerM + (outputTokens / 1e6) * price.outputPerM;
  session.model.calls.push({ at: new Date().toISOString(), model, purpose,
    inputTokens, outputTokens, costUsd, accepted, note });
  session.model.inputTokens += inputTokens;
  session.model.outputTokens += outputTokens;
  session.model.costUsd += costUsd;
  save(session);
  return session;
}

/**
 * Record an authored unit. `provenance` is the point: a family has to say where
 * it came from, so a later reader can tell an author's line from a model's
 * suggestion the author approved, and both from something copied out of canon.
 */
export function recordAuthored(session, { kind, character, family, surface, value,
  provenance, canon = [], reusableAcross = [] }) {
  if (!['drive', 'influence', 'forbid', 'manner', 'quip', 'practice', 'affordance'].includes(kind))
    throw new Error(`unknown authored kind: ${kind}`);
  if (!['author', 'model_suggested_author_approved', 'canon_transcribed'].includes(provenance))
    throw new Error(`unknown provenance: ${provenance}`);
  const onTarget = session.targets.length === 0
    || session.targets.some(target => target.character === character
      && (target.surface === surface || target.family === family));
  session.authored.push({ at: new Date().toISOString(), kind, character, family, surface,
    value, provenance, canon, reusableAcross, onTarget,
    hash: createHash('sha256').update(String(value)).digest('hex').slice(0, 12) });
  save(session);
  return session;
}

/** Every rejection is data. A high rejection rate is a finding, not a failure. */
export function recordRejected(session, { character, surface, value, why }) {
  session.rejected.push({ at: new Date().toISOString(), character, surface, value, why });
  save(session);
  return session;
}

export function closeSession(session) {
  stopSpan(session.clock); stopSpan(session.humanReview);
  session.closedAt = new Date().toISOString();
  save(session);
  return session;
}

/** What the session cost and produced, in the shape the finish-line report wants. */
export function summarise(session) {
  const minutes = ms => +(ms / 60000).toFixed(1);
  const accepted = session.authored.length;
  const offered = accepted + session.rejected.length;
  return {
    id: session.id,
    authoringMinutes: minutes(session.clock.totalMs),
    humanReviewMinutes: minutes(session.humanReview.totalMs),
    totalHumanMinutes: minutes(session.clock.totalMs + session.humanReview.totalMs),
    budgetMinutes: session.budgetMinutes,
    withinBudget: minutes(session.clock.totalMs + session.humanReview.totalMs) <= session.budgetMinutes,
    modelCalls: session.model.calls.length,
    inputTokens: session.model.inputTokens,
    outputTokens: session.model.outputTokens,
    costUsd: +session.model.costUsd.toFixed(4),
    unitsAuthored: accepted,
    unitsRejected: session.rejected.length,
    acceptanceRate: offered ? +(accepted / offered).toFixed(2) : null,
    offTarget: session.authored.filter(unit => !unit.onTarget).length,
    byKind: session.authored.reduce((map, unit) => ({ ...map, [unit.kind]: (map[unit.kind] ?? 0) + 1 }), {}),
    byProvenance: session.authored.reduce((map, unit) =>
      ({ ...map, [unit.provenance]: (map[unit.provenance] ?? 0) + 1 }), {}),
  };
}
