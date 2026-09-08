import { snapshot, add, setOne, remove, ground } from './facts.mjs';
import { solve, explainKill } from './query.mjs';
import { instanceQuery } from './practices.mjs';
import { unify } from './facts.mjs';
import { hash } from './rng.mjs';

// Candidate enumeration and selection.
//
// The overall shape is Swaygent's and it is a good shape: enumerate affordances
// from active practices, score each by influences read off the state now plus
// drives read off the state the action *would* produce, sort, pick. Four
// changes, each forced by something measured in lab/research:
//
//   1. Forbidden actions are REMOVED, not sorted last. Praxish's
//      `Swaygent.scoreActions` carries a FIXME asking whether to filter them
//      and does not; probe-02 P5 confirms that when every action is forbidden
//      it returns a forbidden one. For Worldstream a forbidden action is a
//      canon violation, not a low preference.
//   2. Every candidate is its own object. Praxish's `getAllPossibleActions`
//      returns aliases of one bindings map whenever an action's conditions bind
//      no new variable (probe-03 P7: three action definitions came back as
//      three references to one object). That is precisely the shape of
//      MINOR_INCONVENIENCE — wait / walk round / ask / Fade all condition on
//      already-bound Actor — so upstream would have silently collapsed the
//      flagship test into four copies of one action.
//   3. Scores are checked for finiteness. Swaygent's `evaluate` is
//      `parseInt(bindings[expr])`, so one mistyped lvar yields NaN, the sum
//      becomes NaN, and the comparator returns NaN, which Array#sort treats as
//      "equal" — the ranking silently degenerates into input order (probe-02
//      P6). Here a non-finite contribution is a definition error.
//   4. Doing nothing is a real candidate with a real score, not the absence of
//      a decision. Worldstream must be allowed to stay quiet.

const clampContribution = (value, label) => {
  if (!Number.isFinite(value)) throw new Error(`${label}: non-finite score contribution`);
  return value;
};

/** Apply an action's effects to the transient view, for post-action evaluation. */
function speculate(view, effects, bindings) {
  for (const effect of effects ?? []) {
    if (!effect.asserts) continue;
    for (const sentence of effect.asserts) {
      const grounded = ground(sentence, bindings);
      if (effect.exclusive) {
        const parts = grounded.split('.');
        setOne(view, parts.slice(0, -1), parts.at(-1));
      } else add(view, grounded);
    }
    for (const sentence of effect.retracts ?? []) remove(view, ground(sentence, bindings));
  }
}

/** Influence and drive rules that matched, with their contributions. */
function weigh(view, rules, bindings, kind, label, options = {}) {
  const sways = [];
  for (const rule of rules ?? []) {
    // Explicit scoping, for rules that want to say so out loud.
    if (rule.appliesTo) {
      const { actions, intents, manners, practices } = rule.appliesTo;
      if (actions && !actions.includes(bindings.ActionId)) continue;
      if (intents && !intents.includes(bindings.Intent)) continue;
      if (manners && !manners.includes(bindings.Manner)) continue;
      if (practices && !practices.includes(bindings.PracticeId)) continue;
    }
    const found = solve(view, rule.conditions, bindings, options);
    if (!found.length) continue;
    if (rule.priority) { sways.push({ kind, name: rule.name, priority: rule.priority, score: 0, from: label }); continue; }
    // A rule fires once however many ways it is satisfied. Praxish adds one
    // contribution per satisfying binding, which lets an incidental fact that
    // happens to unify twenty ways dominate a deliberate authored weight.
    sways.push({ kind, name: rule.name, score: clampContribution(rule.score, `${label}/${rule.name}`), from: label });
  }
  return sways;
}

/**
 * Every action available to `actor` right now, and every action that was not,
 * with the exact condition that refused it.
 */
export function enumerateCandidates({ view, practices, actor }) {
  const candidates = [];
  const blocked = [];
  for (const practice of practices.values()) {
    const query = instanceQuery(practice);
    for (const instance of unify(view, query, { Actor: actor })) {
      const instanceId = ground(query, instance);
      for (const action of practice.actions) {
        const found = solve(view, action.conditions, instance);
        if (!found.length) {
          blocked.push({ practice: practice.id, instance: instanceId, action: action.id,
            reason: explainKill(found) ?? 'no binding', condition: found.killedBy?.condition ?? null });
          continue;
        }
        for (const bindings of found) {
          // A fresh object per candidate. See note 2 above. The ambient
          // bindings describe the candidate itself, so a character grammar can
          // refuse a *kind* of action rather than only a situation.
          const bound = { ...bindings, Surface: action.surface ?? action.id,
            ActionId: action.id, PracticeId: practice.id, Intent: action.intent ?? 'none',
            Manner: action.manner ?? 'none' };
          candidates.push({ practice, action, instanceId, bindings: bound,
            id: `${practice.id}/${instanceId}/${action.id}/${JSON.stringify(bindings)}` });
        }
      }
    }
  }
  return { candidates, blocked };
}

/**
 * Score candidates. Returns `{ ranked, blocked, rejected }` where `blocked` is
 * unavailable-and-why and `rejected` is available-but-forbidden-and-why.
 */
export function scoreCandidates({ view, practices, actor, grammar, modifiers = [], seed = '' }) {
  const { candidates, blocked } = enumerateCandidates({ view, practices, actor });
  const ranked = [];
  const rejected = [];
  for (const candidate of candidates) {
    const { practice, action, bindings } = candidate;
    const label = `${practice.id}/${action.id}`;

    // Hard rails first, and cheaply: a character-level prohibition is checked
    // before anything is speculatively performed.
    let forbidden = null;
    for (const rule of grammar?.forbids ?? []) {
      if (solve(view, rule.conditions, bindings, { noNewBindings: true }).length) {
        forbidden = rule; break;
      }
    }
    // How this character feels about this *kind* of solution. One number per
    // manner per character replaces what would otherwise be a rule per action
    // per character, and it is the thing that actually separates them.
    const manner = action.manner;
    const mannerWeight = manner ? grammar?.manners?.[manner] : undefined;
    const influences = [
      ...(typeof mannerWeight === 'number'
        ? [{ kind: 'manner', name: `${manner} is how they deal with things`,
          score: mannerWeight, from: `grammar:${actor}` }] : []),
      ...weigh(view, action.influences, bindings, 'influence', label),
      // Strict: a character rule may only speak about roles this candidate
      // actually binds. See the note in query.mjs `solve`.
      ...weigh(view, grammar?.influences, bindings, 'influence', `grammar:${actor}`,
        { noNewBindings: true }),
      ...weigh(view, modifiers, bindings, 'modifier', 'world'),
    ];
    if (!forbidden) {
      const hardStop = influences.find(sway => sway.priority === 'forbidden');
      if (hardStop) forbidden = { name: hardStop.name, why: hardStop.name };
    }
    if (forbidden) {
      rejected.push({ practice: practice.id, action: action.id, bindings,
        reason: forbidden.why ?? forbidden.name, rule: forbidden.name ?? null });
      continue;
    }

    // Post-action evaluation. Restore from a structural copy taken before,
    // rather than mutating and hoping the inverse is exact.
    const before = snapshot(view);
    speculate(view, action.effects, bindings);
    const drives = [
      ...weigh(view, practice.volitions, bindings, 'volition', practice.id),
      ...weigh(view, grammar?.drives, bindings, 'drive', `grammar:${actor}`,
        { noNewBindings: true }),
    ];
    view.root = before.root;

    const sways = [...influences, ...drives];
    const required = sways.some(sway => sway.priority === 'required');
    const score = sways.reduce((total, sway) => total + sway.score, 0);
    ranked.push({ ...candidate, sways, score, tier: required ? 'required' : 'normal' });
  }

  // Deterministic ordering. Required first, then score, then a stable id — so
  // an exact tie resolves the same way on every replay of the same state.
  ranked.sort((a, b) =>
    (a.tier === b.tier ? 0 : a.tier === 'required' ? -1 : 1)
    || b.score - a.score
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { ranked, blocked, rejected };
}

// The key cooldown and novelty are measured against.
//
// This deliberately includes the bound roles, and that is the difference
// between "Emily counted something yesterday, so she may not count today" and
// "Emily counted the benches yesterday, so today the benches are stale and the
// crowd is not". The first suppresses the character; the second suppresses the
// repetition. Measured before and after in harness/tune.mjs: family-level keys
// produced one manifestation per behaviour across thirty days, because every
// binding scored identically and the stable tie-break always chose the same one.
const SALIENT_ROLES = ['Thing', 'Obstacle', 'Other', 'Helper', 'Key', 'What'];
export const familyOf = candidate => {
  const bound = SALIENT_ROLES
    .filter(role => candidate.bindings[role] !== undefined)
    .map(role => `${role}=${candidate.bindings[role]}`).join(',');
  return `${candidate.practice.id}:${candidate.action.id}${bound ? `(${bound})` : ''}`;
};
/** The behaviour without its binding, for reporting reuse per authored family. */
export const behaviourOf = candidate => `${candidate.practice.id}:${candidate.action.id}`;
export const seededIndex = (key, length) => (length ? hash(key) % length : 0);
