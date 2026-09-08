import { unify, isVariable } from './facts.mjs';

// The condition language, and the reason this layer exists at all.
//
// Praxish tracks which condition killed each candidate action and reports it as
// `impossibleActions`. That is the single best idea in either codebase for
// Worldstream's purposes: a 120-day run that produces something odd is
// unauditable without it. What is reimplemented here rather than adopted:
//
//   * An unknown operator in Praxish throws `ReferenceError: match is not
//     defined` from inside its own warning branch (probe-01, P3). An authored
//     typo takes down the simulation instead of degrading. Here an unknown
//     operator is a definition error, raised at load, not at decision time.
//   * `not` over an unbound variable silently means different things depending
//     on condition order (probe-01, P4). It is still order-sensitive — that is
//     inherent to negation as failure — but `assertConditions` refuses a `not`
//     whose variables are not already bound, so the ambiguity cannot be
//     authored by accident.
//   * A condition may carry a `because`, which is what turns
//     `knows.Actor.plaza_bell` into "Ashai has not heard about the bell" in an
//     author-facing trace.

const OPS = new Set(['not', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'calc', 'count', 'exists']);
const CALCS = { add: (a, b) => a + b, sub: (a, b) => a - b, mul: (a, b) => a * b,
  min: Math.min, max: Math.max };

const textOf = condition => (typeof condition === 'string' ? condition : condition.if);
const whyOf = condition => (typeof condition === 'string' ? null : condition.because ?? null);

// Bindings the engine always supplies, so a grammar rule may speak about the
// candidate it is judging as well as about the world. Without these an author
// has no way to say "Emily will not do this *kind* of thing", only "Emily will
// not do it in this *situation*, which is not the same rule.
export const AMBIENT_BINDINGS = Object.freeze(['Actor', 'Surface', 'ActionId', 'PracticeId', 'Intent', 'Manner']);

/** Load-time validation, so a mistyped condition is a definition error. */
export function assertConditions(conditions, label) {
  const seen = new Set(AMBIENT_BINDINGS);
  for (const condition of conditions ?? []) {
    const text = textOf(condition);
    if (typeof text !== 'string' || !text.trim()) throw new Error(`${label}: condition must be a sentence`);
    const parts = text.trim().split(/\s+/);
    if (parts.length === 1) { for (const p of parts[0].split('.')) if (isVariable(p)) seen.add(p); continue; }
    const [op, ...args] = parts;
    if (!OPS.has(op)) throw new Error(`${label}: unknown condition operator "${op}" in "${text}"`);
    if (op === 'not' || op === 'exists') {
      for (const p of args[0].split('.')) if (isVariable(p) && !seen.has(p))
        throw new Error(`${label}: "${text}" negates or tests an unbound variable ${p}; bind it first`);
    } else if (op === 'calc') {
      const [target, fn] = args;
      if (!CALCS[fn]) throw new Error(`${label}: unknown numeric operator "${fn}"`);
      seen.add(target);
    } else if (op === 'count') {
      seen.add(args[0]);
      for (const p of args[1].split('.')) if (isVariable(p)) seen.add(p);
    } else {
      for (const arg of args) if (isVariable(arg) && !seen.has(arg))
        throw new Error(`${label}: "${text}" compares unbound variable ${arg}`);
    }
  }
  return conditions ?? [];
}

const value = (token, match) => (isVariable(token) ? match[token] : token);

/**
 * Solve `conditions`. Returns an array of binding maps, carrying `.trace`:
 * per-condition survivor counts plus, when the set is emptied, the index and
 * text of the condition that emptied it.
 */
export function solve(view, conditions, bindings = {}, options = {}) {
  // `noNewBindings` is the fix for a scoring leak the author caught by reading
  // the trace. Ashai's rule "a child on their own is not a thing you walk past"
  // is written as `char.Other, trait.Other.reads_as_child, alone.Other`. With
  // free binding, that rule finds Emily *from the room* and contributes +6 to
  // every action Ashai has available — including going round a closed path,
  // which does nothing whatever about the child.
  //
  // A character rule must judge the candidate in front of it, not go looking
  // for its own subject. So when this is set, any match that introduced a
  // variable the candidate had not already bound is discarded, and the rule
  // simply does not apply to actions that do not involve that role.
  const own = new Set(Object.keys(bindings));
  let matches = [{ ...bindings }];
  const trace = [];
  let killedAt = -1;
  const list = conditions ?? [];
  for (let index = 0; index < list.length; index += 1) {
    const condition = list[index];
    const text = textOf(condition);
    const parts = text.trim().split(/\s+/);
    const next = [];
    if (parts.length === 1) {
      for (const match of matches) for (const found of unify(view, parts[0], match)) next.push(found);
    } else {
      const [op, ...args] = parts;
      for (const match of matches) {
        if (op === 'not') { if (unify(view, args[0], match).length === 0) next.push({ ...match }); continue; }
        if (op === 'exists') { if (unify(view, args[0], match).length > 0) next.push({ ...match }); continue; }
        if (op === 'count') {
          const [target, sentence] = args;
          next.push({ ...match, [target]: unify(view, sentence, match).length });
          continue;
        }
        if (op === 'calc') {
          const [target, fn, lhs, rhs] = args;
          const result = CALCS[fn](Number(value(lhs, match)), Number(value(rhs, match)));
          if (Number.isFinite(result)) next.push({ ...match, [target]: result });
          continue;
        }
        const lhs = value(args[0], match), rhs = value(args[1], match);
        if (lhs === undefined || rhs === undefined) continue;
        const pass = op === 'eq' ? String(lhs) === String(rhs)
          : op === 'neq' ? String(lhs) !== String(rhs)
            : op === 'lt' ? Number(lhs) < Number(rhs)
              : op === 'lte' ? Number(lhs) <= Number(rhs)
                : op === 'gt' ? Number(lhs) > Number(rhs)
                  : Number(lhs) >= Number(rhs);
        if (pass) next.push({ ...match });
      }
    }
    const kept = options.noNewBindings
      ? next.filter(match => Object.keys(match).every(key => own.has(key) || !isVariable(key)))
      : next;
    trace.push({ index, condition: text, because: whyOf(condition),
      before: matches.length, after: kept.length });
    matches = kept;
    if (matches.length === 0) { killedAt = index; break; }
  }
  matches.trace = trace;
  matches.killedAt = killedAt;
  matches.killedBy = killedAt === -1 ? null
    : { condition: textOf(list[killedAt]), because: whyOf(list[killedAt]) };
  return matches;
}

/** A one-line, author-facing reason an action was unavailable. */
export const explainKill = result =>
  result.killedBy ? (result.killedBy.because ?? `condition failed: ${result.killedBy.condition}`) : null;
