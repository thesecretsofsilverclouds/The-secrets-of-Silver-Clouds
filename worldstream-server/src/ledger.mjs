// What an event records about the state it moved.
//
// The problem this solves, measured rather than suspected. Every write used to
// store a `structuredClone` of the *entire* bag as `before` and again as
// `after`. `world.facts` holds 189 entries after twenty days and keeps growing;
// `supportingStories.instances` the same. So a single fact expiring wrote a
// quarter of a megabyte into the log, and every later event that touched the
// bag wrote more than the last. Over sixty days that is 468 MB of SQLite, single
// events of 1.48 MB, and a heap death at four months. The growth was quadratic:
// the log recorded the whole world, once per change to any part of it.
//
// The fix is to record the leaves that actually moved. A fact expiring is now
// one path and one value, and stays one path and one value however large the
// bag it lives in becomes.
//
// Two shapes therefore appear in `changes`:
//
//   whole-value  { entity, id, field, before, after }
//                Scalars, small objects, anything too tangled to diff cheaply.
//                Exactly what the ledger has always recorded.
//
//   leaf         { entity, id, field, path: [...], before?, after? }
//                One position inside a bag. `before` and `after` are *omitted*
//                rather than null when the position did not exist, so a stored
//                null stays distinguishable from an absent key — `'after' in
//                change` is the test, and it survives a JSON round trip.
//
// Nothing here weakens the audit. The replay in canon.test.mjs still
// reconstructs the world change by change and still checks every before-value
// against the state it claims to have found, which is the guarantee that makes
// this world deterministic rather than merely repeatable.

export const LEDGER_LIMITS = Object.freeze({
  // How far into a bag a path may point. `supportingStories.instances.<id>` is
  // three, which is the deepest any current ledger needs.
  maxDepth: 3,
  // Past this many differing leaves the diff is not paying for itself and the
  // whole value is recorded instead. A rollover that rewrites a bag wholesale
  // should not become forty separate rows.
  maxLeaves: 40,
});

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isContainer = value => value !== null && typeof value === 'object';

/** Structural equality with early exit, so comparing does not allocate a copy. */
export function sameValue(a, b) {
  if (a === b) return true;
  if (!isContainer(a) || !isContainer(b)) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.hasOwn(b, key)) return false;
    if (!sameValue(a[key], b[key])) return false;
  }
  return true;
}

/**
 * The smallest set of leaf differences describing before → after, or null when
 * the value should be recorded whole.
 */
export function diffLeaves(before, after, limits = LEDGER_LIMITS) {
  if (!isContainer(before) || !isContainer(after)) return null;
  if (Array.isArray(before) !== Array.isArray(after)) return null;
  const leaves = [];
  const walk = (a, b, path, depth) => {
    if (leaves.length > limits.maxLeaves) return false;
    const bothWalkable = isContainer(a) && isContainer(b)
      && Array.isArray(a) === Array.isArray(b) && depth < limits.maxDepth;
    if (!bothWalkable) {
      const leaf = { path };
      if (a !== undefined) leaf.before = a;
      if (b !== undefined) leaf.after = b;
      leaves.push(leaf);
      return true;
    }
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (sameValue(a[key], b[key])) continue;
      if (!walk(a[key], b[key], [...path, key], depth + 1)) return false;
    }
    return true;
  };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (sameValue(before[key], after[key])) continue;
    if (!walk(before[key], after[key], [key], 1)) return null;
  }
  return leaves.length && leaves.length <= limits.maxLeaves ? leaves : null;
}

/** The value a change claims to find (or leave) at its position. */
export function sideOf(change, side) {
  return side in change ? change[side] : undefined;
}

/** What the target currently holds at the change's position. */
export function readChange(target, change) {
  if (!Array.isArray(change.path)) return target[change.field] ?? null;
  let node = target[change.field];
  for (const step of change.path) {
    if (!isContainer(node)) return undefined;
    node = node[step];
  }
  return node;
}

/**
 * Move the target to one side of a change. Used forward by the replay audit and
 * backward by the cinematic rewind, so both directions are the same code and
 * cannot drift apart.
 */
export function applyChange(target, change, side) {
  if (!Array.isArray(change.path)) {
    target[change.field] = structuredClone(sideOf(change, side) ?? null);
    return;
  }
  let node = target[change.field];
  if (!isContainer(node)) { node = {}; target[change.field] = node; }
  for (const step of change.path.slice(0, -1)) {
    if (!isContainer(node[step])) node[step] = {};
    node = node[step];
  }
  const key = change.path.at(-1);
  if (side in change) { node[key] = structuredClone(change[side]); return; }
  // The position did not exist on this side. Removing a trailing array index is
  // a truncation rather than a hole, which is what an append-only ledger like
  // `knowledge` needs when it is wound back.
  if (Array.isArray(node) && String(Number(key)) === String(key)) {
    node.length = Math.min(node.length, Number(key));
  } else {
    delete node[key];
  }
}
