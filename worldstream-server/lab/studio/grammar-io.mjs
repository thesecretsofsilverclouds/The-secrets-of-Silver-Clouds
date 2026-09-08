import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { CAST } from '../grammar/cast.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { grammarSize } from '../engine/grammar.mjs';
import { AFFORDANCE_PROPS, PROPS } from '../grammar/affordances.mjs';

// TRACK B — grammar import/export and bank-depth metrics.
//
// Export produces a portable, reviewable description of every authored unit,
// so a Studio session can be handed a starting point and hand back a diff that
// a human can read line by line before any of it reaches the engine.
//
// Import is deliberately **not** a loader. It validates a proposed bundle and
// reports what would change; writing the grammar files stays a human edit. An
// authoring pipeline that can silently write character truth is exactly the
// thing this whole investigation exists to avoid.

const DIR = new URL('../runs/studio/', import.meta.url).pathname.replace(/^\//, '');

/** Everything currently authored, as data. */
export function exportGrammar() {
  const characters = {};
  for (const [id, grammar] of CAST) {
    characters[id] = {
      id, displayName: grammar.displayName, canon: grammar.canon ?? [],
      traits: grammar.traits ?? [], abilities: grammar.abilities ?? [],
      manners: grammar.manners ?? {},
      forbids: grammar.forbids.map(rule => ({ name: rule.name, why: rule.why, conditions: rule.conditions })),
      influences: grammar.influences.map(rule => ({ name: rule.name, score: rule.score,
        appliesTo: rule.appliesTo ?? null, conditions: rule.conditions })),
      drives: grammar.drives.map(rule => ({ name: rule.name, score: rule.score,
        appliesTo: rule.appliesTo ?? null, conditions: rule.conditions })),
      mystery: grammar.mystery,
      quips: Object.fromEntries(Object.entries(grammar.quips).map(([surface, bank]) =>
        [surface, bank.map(entry => ({ text: entry.text, requires: entry.requires,
          signature: entry.signature, filler: entry.filler, meaning: entry.meaning }))])),
      size: grammarSize(grammar),
    };
  }
  const practices = [...PRACTICES.values()].map(practice => ({
    id: practice.id, roles: practice.roles,
    actions: practice.actions.map(action => ({ id: action.id, intent: action.intent,
      manner: action.manner ?? null, surface: action.surface ?? action.id,
      surfaceBy: action.surfaceBy ?? null, surfaceable: action.surfaceable !== false,
      conditions: action.conditions, requires: action.requires ?? [],
      effects: (action.effects ?? []).map(effect => ({ kind: effect.kind, cost: effect.cost ?? null })),
      seeds: action.seeds ?? [] })),
  }));
  return { version: 'moment-lab-v2', exportedAt: new Date().toISOString(),
    characters, practices,
    affordances: { props: AFFORDANCE_PROPS, byThing: PROPS } };
}

export function writeExport(name = 'grammar-before') {
  mkdirSync(DIR, { recursive: true });
  const path = `${DIR}${name}.json`;
  writeFileSync(path, JSON.stringify(exportGrammar(), null, 1));
  return path;
}

/**
 * Validate a proposed bundle against the current one and report the delta.
 * Returns a plan, never applies it.
 */
export function planImport(bundle) {
  const current = exportGrammar();
  const problems = [];
  const additions = [];
  for (const [id, proposed] of Object.entries(bundle.characters ?? {})) {
    const existing = current.characters[id];
    if (!existing) { problems.push(`unknown character: ${id}`); continue; }
    for (const [surface, bank] of Object.entries(proposed.quips ?? {})) {
      const have = new Set((existing.quips[surface] ?? []).map(entry => entry.text));
      for (const entry of bank) {
        if (have.has(entry.text)) continue;
        if (!entry.text?.trim()) { problems.push(`${id}/${surface}: empty line`); continue; }
        // A signature line with no requirement is how the semantic-binding
        // failures happened the first time. Not fatal, but it must be a
        // deliberate choice rather than an omission.
        if (entry.signature && !(entry.requires ?? []).length)
          problems.push(`${id}/${surface}: signature line with no \`requires\` — "${entry.text.slice(0, 40)}…"`);
        additions.push({ kind: 'quip', character: id, surface, value: entry.text,
          signature: Boolean(entry.signature), requires: entry.requires ?? [] });
      }
    }
    for (const kind of ['drives', 'influences', 'forbids']) {
      const have = new Set((existing[kind] ?? []).map(rule => rule.name));
      for (const rule of proposed[kind] ?? [])
        if (!have.has(rule.name))
          additions.push({ kind: kind.replace(/s$/, ''), character: id, value: rule.name });
    }
  }
  return { additions, problems, safe: problems.length === 0 };
}

/**
 * Bank depth, per character per surface — the metric the Studio hour is aimed
 * at and the one the before/after comparison turns on.
 *
 * `effectiveDepth` is the number that actually matters: lines that are neither
 * filler nor locked behind a requirement no target in the world satisfies. A
 * bank of five where four need a property nothing has is a bank of one.
 */
export function bankDepth({ satisfiable = null } = {}) {
  const rows = [];
  for (const [id, grammar] of CAST) {
    for (const [surface, bank] of Object.entries(grammar.quips)) {
      const usable = bank.filter(entry => !entry.filler);
      const unconditional = usable.filter(entry => entry.requires.length === 0);
      const conditional = usable.filter(entry => entry.requires.length > 0);
      const reachable = satisfiable
        ? conditional.filter(entry => entry.requires.every(condition => satisfiable.has(condition)))
        : conditional;
      rows.push({ character: id, surface,
        authored: bank.length,
        filler: bank.filter(entry => entry.filler).length,
        signature: bank.filter(entry => entry.signature).length,
        effectiveDepth: unconditional.length + reachable.length });
    }
  }
  return rows.sort((a, b) => a.character.localeCompare(b.character) || a.surface.localeCompare(b.surface));
}

/** Every affordance property the world can actually assert, for reachability. */
export function satisfiableRequirements() {
  const set = new Set();
  for (const props of Object.values(PROPS)) for (const prop of props)
    set.add(`affordance.Thing.prop.${prop}`);
  // Situational requirements the adapter can assert.
  for (const extra of ['not alone.Actor', 'alone.Actor', 'char.Other']) set.add(extra);
  return set;
}
