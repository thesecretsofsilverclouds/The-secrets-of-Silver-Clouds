// An isolated queue for the real reducer, with the same ordering and follow-up
// rules as WorldStore. This module owns no database, clock or service client.
export const compareCanonicalActions = (a, b) => a.dueAt - b.dueAt
  || a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const encoder = new TextEncoder();
function boundedJSON(value, maxBytes) {
  // Abort during traversal, before constructing a huge mature-state string.
  // Charging array indices too is a conservative overhead allowance. The final
  // exact byte check makes the limit independent of Unicode/JSON escaping.
  let charged = 0;
  const charge = text => {
    if (text.length > maxBytes - charged) throw new Error('Canonical fork clone budget exceeded');
    charged += encoder.encode(text).byteLength;
    if (charged > maxBytes) throw new Error('Canonical fork clone budget exceeded');
  };
  const encoded = JSON.stringify(value, (key, item) => {
    if (key) charge(`${JSON.stringify(key)}:,`);
    if (typeof item === 'string') {
      if (item.length > maxBytes - charged) throw new Error('Canonical fork clone budget exceeded');
      charge(JSON.stringify(item));
    } else if (item === null || typeof item === 'number' || typeof item === 'boolean') charge(JSON.stringify(item));
    else if (typeof item === 'object') charge('{}');
    return item;
  });
  if (encoder.encode(encoded).byteLength > maxBytes) throw new Error('Canonical fork clone budget exceeded');
  return encoded;
}

export function boundedCounterfactualState(state, maxCloneBytes = 2 * 1024 * 1024) {
  try { return JSON.parse(boundedJSON(state, maxCloneBytes)); }
  catch { return null; }
}

export class CanonicalFork {
  constructor({ state, pendingActions, seed, rulesVersion, startMs, resolvedThrough,
    sequence = 0, reduceAction, maxActions = 128, maxCloneBytes = 2 * 1024 * 1024,
    maxPendingActions = 4096, endMs = Date.parse('2100-01-01T00:00:00Z'), context = {} }) {
    if (!state || !Array.isArray(pendingActions)
      || typeof seed !== 'string' || !seed || typeof rulesVersion !== 'string' || !rulesVersion
      || !Number.isSafeInteger(startMs) || !Number.isSafeInteger(resolvedThrough)
      || resolvedThrough < startMs || !Number.isSafeInteger(sequence) || sequence < 0
      || typeof reduceAction !== 'function' || !Number.isSafeInteger(maxActions) || maxActions < 1)
      throw new Error('Incomplete canonical fork');
    if (pendingActions.length > maxPendingActions) throw new Error('Canonical fork queue budget exceeded');
    const encoded = boundedJSON({ state, pendingActions }, maxCloneBytes);
    this.cloneBytes = encoder.encode(encoded).byteLength;
    if (this.cloneBytes > maxCloneBytes) throw new Error('Canonical fork clone budget exceeded');
    const copied = JSON.parse(encoded);
    this.state = copied.state; this.pendingActions = copied.pendingActions;
    this.seed = seed; this.rulesVersion = rulesVersion; this.startMs = startMs;
    this.resolvedThrough = resolvedThrough; this.endMs = endMs; this.sequence = sequence;
    this.reduceAction = reduceAction; this.maxActions = maxActions;
    this.maxPendingActions = maxPendingActions; this.context = context;
    this.processedActions = 0; this.events = [];
    const ids = new Set();
    for (const action of this.pendingActions) {
      this.assertAction(action);
      if (ids.has(action.id) || action.dueAt <= resolvedThrough) throw new Error('Invalid canonical fork queue');
      ids.add(action.id);
    }
    this.pendingActions.sort(compareCanonicalActions);
  }

  assertAction(action) {
    if (typeof action?.id !== 'string' || !action.id || !Number.isSafeInteger(action.dueAt)
      || !Number.isSafeInteger(action.priority)) throw new Error('Invalid canonical action');
  }

  step() {
    const action = this.pendingActions[0];
    if (!action) return null;
    if (this.processedActions >= this.maxActions) throw new Error('Canonical fork action budget exceeded');
    const { event, followups } = this.reduceAction(this.state, action, this.seed, {
      ...this.context, pendingActions: this.pendingActions, resolvedThrough: this.resolvedThrough,
      sequence: this.sequence, rulesVersion: this.rulesVersion,
    });
    // The store inserts follow-ups before removing their cause. Preserve its
    // duplicate-ID rejection, including a follow-up that steals the cause ID.
    const ids = new Set(this.pendingActions.map(item => item.id));
    for (const followup of followups) {
      this.assertAction(followup);
      if (followup.dueAt <= action.dueAt) throw new Error('Follow-up must occur after its cause');
      if (ids.has(followup.id)) throw new Error('Duplicate canonical action');
      ids.add(followup.id);
    }
    if (this.pendingActions.length - 1 + followups.length > this.maxPendingActions)
      throw new Error('Canonical fork queue budget exceeded');
    if (this.events.some(item => item.id === event.id)) throw new Error('Duplicate canonical event');
    this.events.push({ seq: ++this.sequence, ...event });
    this.pendingActions.shift(); this.pendingActions.push(...followups);
    this.pendingActions.sort(compareCanonicalActions); this.processedActions++;
    return this.events.at(-1);
  }

  advance(targetMs) {
    if (!Number.isSafeInteger(targetMs) || targetMs < this.startMs || targetMs > this.endMs)
      throw new RangeError('Target outside bounded fixture');
    if (targetMs <= this.resolvedThrough) return;
    while (this.pendingActions[0]?.dueAt <= targetMs) this.step();
    this.resolvedThrough = targetMs;
  }

  snapshot() {
    return structuredClone({ state: this.state, pendingActions: this.pendingActions, events: this.events,
      seed: this.seed, rulesVersion: this.rulesVersion, startMs: this.startMs,
      resolvedThrough: this.resolvedThrough, sequence: this.sequence, processedActions: this.processedActions });
  }
}
