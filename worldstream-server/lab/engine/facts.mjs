// A transient fact view for one Moment opportunity.
//
// Shape is borrowed from Praxish's exclusion-logic DB — a tree of dotted paths,
// which is what makes variable unification cheap and authored conditions
// readable. Two deliberate departures, both forced by things measured in
// lab/research/probe-01-db.mjs:
//
//   1. Praxish records cardinality nowhere. `DB.insert(db,'mood!happy')` then
//      `'mood!sad'` leaves `{mood:{sad:{}}}`, and `dbToSentences` can only ever
//      emit `.`, so a database cannot say which of its slots are exclusive.
//      Here `setOne` is an explicit operation and exclusivity is a property of
//      the call, not of a punctuation character buried in a string.
//
//   2. Praxish's `!` wipes the parent's whole subtree, so `foo!bar.baz`
//      followed by `foo!bar.meow` destroys `baz` — the TODO in its db.js
//      suspects this and it is confirmed. `setOne(['foo','bar'],'meow')`
//      here replaces only the children of `foo.bar`.
//
// This view is never persisted. It is rebuilt from Worldstream on every
// opportunity and thrown away, which is the whole point: there is one ledger.

export const isVariable = part => /^[A-Z]/.test(part);

export function createView() { return { root: Object.create(null) }; }

const descend = (node, parts, create) => {
  for (const part of parts) {
    if (!node[part]) { if (!create) return null; node[part] = Object.create(null); }
    node = node[part];
  }
  return node;
};

// A constant that begins with a capital is indistinguishable from a variable,
// so asserting one would make it a silent wildcard for every query that touched
// it. Refusing it here is what stops the whole class of bug — see
// lab/research/probe-06 for the same defect reaching production in Praxish.
const CAPITALISED = /(^|\.)[A-Z]/;

/** Assert one dotted sentence. Adds; never removes. */
export function add(view, sentence) {
  const text = String(sentence);
  if (CAPITALISED.test(text))
    throw new Error(`fact "${text}" has a capitalised segment; constants in a path must be lower case`);
  descend(view.root, text.split('.'), true);
  return view;
}

/** Assert many sentences. Falsy entries are skipped so callers can inline `cond && fact`. */
export function addAll(view, sentences) {
  for (const sentence of sentences) if (sentence) add(view, sentence);
  return view;
}

/** Assert `value` as the single child of `path`, clearing that node's siblings only. */
export function setOne(view, path, value) {
  const parts = (Array.isArray(path) ? path : String(path).split('.')).flatMap(p => String(p).split('.'));
  const node = descend(view.root, parts, true);
  for (const key of Object.keys(node)) delete node[key];
  node[String(value)] = Object.create(null);
  return view;
}

export function remove(view, sentence) {
  const path = String(sentence).split('.');
  const parent = descend(view.root, path.slice(0, -1), false);
  if (parent) delete parent[path.at(-1)];
  return view;
}

export function has(view, sentence) {
  return descend(view.root, String(sentence).split('.'), false) !== null;
}

/** Every asserted path, sorted — used for snapshots, diffs and provenance. */
export function sentences(view) {
  const out = [];
  const walk = (node, prefix) => {
    for (const key of Object.keys(node).sort()) {
      const path = prefix ? `${prefix}.${key}` : key;
      out.push(path);
      walk(node[key], path);
    }
  };
  walk(view.root, '');
  return out;
}

/** A structural copy. Speculative execution restores from one of these. */
export function snapshot(view) {
  const copy = node => {
    const out = Object.create(null);
    for (const key of Object.keys(node)) out[key] = copy(node[key]);
    return out;
  };
  return { root: copy(view.root) };
}

/**
 * Bindings that satisfy one dotted sentence.
 *
 * Praxish's `DB.unify` returns the *same* bindings object when a sentence
 * introduces no new variable. That is the root of the aliasing defect proved in
 * probe-03: three action definitions came back as three references to one
 * object, all reading "ashai: C", so the character could not choose between
 * them at all. Every path out of this function therefore returns a fresh map.
 */
export function unify(view, sentence, bindings) {
  const parts = String(sentence).trim().split('.');
  let worlds = [{ node: view.root, bindings }];
  for (const part of parts) {
    const next = [];
    for (const world of worlds) {
      if (isVariable(part) && world.bindings[part] === undefined) {
        for (const key of Object.keys(world.node))
          next.push({ node: world.node[key], bindings: { ...world.bindings, [part]: key } });
      } else {
        const name = isVariable(part) ? String(world.bindings[part]) : part;
        const child = world.node[name];
        if (child) next.push({ node: child, bindings: world.bindings });
      }
    }
    worlds = next;
  }
  return worlds.map(world => ({ ...world.bindings }));
}

/** Substitute bound variables back into a sentence, for grounding effects. */
export function ground(sentence, bindings) {
  return String(sentence).split('.')
    .map(part => (isVariable(part) && bindings[part] !== undefined ? String(bindings[part]) : part))
    .join('.');
}
