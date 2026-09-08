import { assertConditions } from './query.mjs';

// A practice is a situation with roles and affordances. It is not a scene.
//
// Shape is Praxish's — id, roles, actions with conditions/outcomes/influences,
// plus practice-level volitions — with one structural addition taken from
// Ensemble: an action carries an abstract `intent` and a `surface`, so the
// decision ("Goaden wants to tease Ashai") is separated from its delivery
// ("about the coat, using the coat bank"). Ensemble reaches concrete behaviour
// by walking `leadsTo` from an intent down to terminal actions; the same
// separation is available here without the grammar-walk, because Worldstream
// already owns a presentation layer that wants a key rather than a sentence.
//
// `requires` is the addition neither codebase has and Worldstream cannot do
// without: the facts the proposal claims are true, restated so the world engine
// can check them again at commit time against real state rather than against
// this engine's translated view. A Moment Engine that is trusted is a second
// source of truth; one that is re-checked is not.

const REQUIRED = ['id', 'roles', 'actions'];

export function definePractice(def) {
  for (const field of REQUIRED) if (!def[field]) throw new Error(`practice ${def.id ?? '?'}: missing ${field}`);
  if (!Array.isArray(def.roles) || !def.roles.length) throw new Error(`practice ${def.id}: needs at least one role`);
  const ids = new Set();
  for (const action of def.actions) {
    if (!action.id) throw new Error(`practice ${def.id}: action without an id`);
    if (ids.has(action.id)) throw new Error(`practice ${def.id}: duplicate action ${action.id}`);
    ids.add(action.id);
    assertConditions(action.conditions, `${def.id}/${action.id}`);
    for (const influence of action.influences ?? []) {
      assertConditions(influence.conditions, `${def.id}/${action.id}/influence`);
      if (influence.priority && !['forbidden', 'required'].includes(influence.priority))
        throw new Error(`${def.id}/${action.id}: priority must be forbidden or required`);
      if (influence.priority === undefined && typeof influence.score !== 'number')
        throw new Error(`${def.id}/${action.id}/${influence.name}: an influence needs a numeric score or a priority`);
    }
    for (const effect of action.effects ?? [])
      if (!effect.kind) throw new Error(`${def.id}/${action.id}: every effect needs a kind`);
  }
  for (const volition of def.volitions ?? [])
    assertConditions(volition.conditions, `${def.id}/volition/${volition.name}`);
  return Object.freeze({ ...def, actions: def.actions.map(a => Object.freeze({ ...a })) });
}

export function definePractices(defs) {
  const byId = new Map();
  for (const def of defs) {
    const practice = definePractice(def);
    if (byId.has(practice.id)) throw new Error(`duplicate practice ${practice.id}`);
    byId.set(practice.id, practice);
  }
  return byId;
}

// The instance query for a practice.
//
// The id is lowercased into the path, and that is not cosmetic. Both this
// engine and Praxish decide "is this path segment a variable?" by testing
// whether its first character is uppercase, so a capitalised *constant* in a
// path is silently a wildcard. Worldstream's natural ids are capitalised —
// PUBLIC_IDLE, CROSS_PATHS, MI6_SECTIONS — and lab/research/probe-06 confirms
// the collision in upstream Praxish: `practice.PUBLIC_IDLE.Place` matches every
// practice in the database and binds a variable literally named PUBLIC_IDLE.
// `slugOf` is applied everywhere an id enters a path, and `add` in facts.mjs
// refuses an uppercase-initial segment outright, so it cannot be reintroduced.
export const slugOf = id => String(id).toLowerCase();
export const instanceQuery = practice => `practice.${slugOf(practice.id)}.${practice.roles.join('.')}`;
