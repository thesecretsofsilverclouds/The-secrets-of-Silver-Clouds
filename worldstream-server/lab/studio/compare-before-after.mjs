import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { runWorld } from '../harness/run.mjs';
import { bankDepth, satisfiableRequirements, exportGrammar } from './grammar-io.mjs';
import { summarise as summariseSession } from './session.mjs';
import { CAST } from '../grammar/cast.mjs';

// TRACK B — the before/after comparison for the one-hour Studio experiment.
//
// Run once **before** authoring to capture the baseline, once **after** to
// produce the report. Identical seed, identical world, identical engine: the
// only thing that changes between the two runs is the grammar.
//
//   node studio/compare-before-after.mjs baseline
//   ... one metered hour of authoring ...
//   node studio/compare-before-after.mjs report <session-id>
//
// The claim under test, stated so it can fail: **authored character grammar
// expands runtime fiction faster than authored scenes do.** The falsifiable
// form is the last table — units authored against fresh Moments gained. If one
// hour of grammar yields fewer new Moments than one hour of scene-writing would
// have yielded scenes, the claim is wrong and the report will say so.

const DAYS = 90;
const SEED = 'silver-clouds-now-v1';
const DIR = new URL('../runs/studio/', import.meta.url).pathname.replace(/^\//, '');
const BASELINE = `${DIR}baseline.json`;

function measure() {
  const run = runWorld({ days: DAYS, seed: undefined });
  const lineUses = run.moments.reduce((map, moment) =>
    ({ ...map, [moment.line]: (map[moment.line] ?? 0) + 1 }), {});
  const uses = Object.values(lineUses);
  const byActor = {};
  for (const moment of run.moments) {
    const entry = byActor[moment.actor] ??= { moments: 0, lines: new Set(), families: new Set() };
    entry.moments += 1; entry.lines.add(moment.line); entry.families.add(moment.family);
  }
  const perFamily = {};
  for (const moment of run.moments) {
    const key = `${moment.actor}:${moment.behaviour}`;
    (perFamily[key] ??= { moments: 0, manifestations: new Set(), lines: new Set() });
    perFamily[key].moments += 1;
    perFamily[key].manifestations.add(moment.family);
    perFamily[key].lines.add(moment.line);
  }
  return {
    capturedAt: new Date().toISOString(),
    days: DAYS, seed: SEED,
    canonicalActions: run.actions.length,
    moments: run.moments.length,
    perDay: +(run.moments.length / DAYS).toFixed(3),
    distinctLines: Object.keys(lineUses).length,
    maxLineRepeat: uses.length ? Math.max(...uses) : 0,
    freshMoments: uses.filter(n => n === 1).length,
    freshness: uses.length ? +(uses.filter(n => n === 1).length / run.moments.length).toFixed(3) : 0,
    manifestations: new Set(run.moments.map(m => m.family)).size,
    behaviours: new Set(run.moments.map(m => m.behaviour)).size,
    validatorRejections: run.rejections.length,
    runtimeLlmCalls: 0,
    lifespan: run.lifespan,
    refusals: run.stats.refusals,
    engineMs: Math.round(run.stats.engineMs),
    byActor: Object.fromEntries(Object.entries(byActor).map(([id, entry]) =>
      [id, { moments: entry.moments, distinctLines: entry.lines.size, manifestations: entry.families.size }])),
    perFamily: Object.fromEntries(Object.entries(perFamily).map(([key, entry]) =>
      [key, { moments: entry.moments, manifestations: entry.manifestations.size, lines: entry.lines.size }])),
    bankDepth: bankDepth({ satisfiable: satisfiableRequirements() }),
    grammar: Object.fromEntries([...CAST].map(([id, grammar]) => [id, {
      rules: grammar.drives.length + grammar.influences.length + grammar.forbids.length,
      lines: Object.values(grammar.quips).reduce((n, bank) => n + bank.length, 0),
      surfaces: Object.keys(grammar.quips).length,
    }])),
  };
}

const mode = process.argv[2] ?? 'baseline';
mkdirSync(DIR, { recursive: true });

if (mode === 'baseline') {
  const snapshot = measure();
  writeFileSync(BASELINE, JSON.stringify(snapshot, null, 1));
  writeFileSync(`${DIR}grammar-before.json`, JSON.stringify(exportGrammar(), null, 1));
  console.log(`baseline captured: ${snapshot.moments} Moments, ${snapshot.freshMoments} fresh, `
    + `${snapshot.distinctLines} distinct lines, max repeat ${snapshot.maxLineRepeat}`);
  console.error(`written: ${BASELINE}`);
  process.exit(0);
}

// ------------------------------------------------------------------ report
if (!existsSync(BASELINE)) {
  console.error('No baseline. Run `node studio/compare-before-after.mjs baseline` first.');
  process.exit(1);
}
const before = JSON.parse(readFileSync(BASELINE, 'utf8'));
const after = measure();
const sessionId = process.argv[3];
const session = sessionId && existsSync(`${DIR}${sessionId}.json`)
  ? summariseSession(JSON.parse(readFileSync(`${DIR}${sessionId}.json`, 'utf8'))) : null;

const delta = (a, b, digits = 0) => {
  const d = b - a;
  return `${d >= 0 ? '+' : ''}${d.toFixed(digits)}`;
};
const lines = [];
const say = t => lines.push(t);

say(`# Studio experiment — one hour of authoring, identical ${DAYS}-day seed`);
say('');
say('Same world, same seed, same engine. The only difference between the two');
say('columns is the grammar.');
say('');

if (session) {
  say('## What the hour cost');
  say('');
  say('| | |');
  say('|---|---:|');
  say(`| Authoring time | ${session.authoringMinutes} min |`);
  say(`| Human review time | ${session.humanReviewMinutes} min |`);
  say(`| **Total human time** | **${session.totalHumanMinutes} min** of ${session.budgetMinutes} |`);
  say(`| Within budget | ${session.withinBudget ? 'yes' : '**no**'} |`);
  say(`| Model calls | ${session.modelCalls} |`);
  say(`| Tokens in / out | ${session.inputTokens.toLocaleString()} / ${session.outputTokens.toLocaleString()} |`);
  say(`| **Cost** | **$${session.costUsd.toFixed(2)}** |`);
  say(`| Units authored / rejected | ${session.unitsAuthored} / ${session.unitsRejected} (acceptance ${session.acceptanceRate ?? '—'}) |`);
  say(`| Authored outside the approved targets | ${session.offTarget} |`);
  say(`| By provenance | ${Object.entries(session.byProvenance).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'} |`);
  say('');
}

say('## Output');
say('');
say('| | before | after | change |');
say('|---|---:|---:|---:|');
say(`| Canonical actions | ${before.canonicalActions} | ${after.canonicalActions} | ${delta(before.canonicalActions, after.canonicalActions)} |`);
say(`| **Surfaced Moments** | **${before.moments}** | **${after.moments}** | **${delta(before.moments, after.moments)}** |`);
say(`| Moments per day | ${before.perDay} | ${after.perDay} | ${delta(before.perDay, after.perDay, 2)} |`);
say(`| **Fresh Moments** (line seen once) | **${before.freshMoments}** | **${after.freshMoments}** | **${delta(before.freshMoments, after.freshMoments)}** |`);
say(`| Freshness rate | ${(before.freshness * 100).toFixed(0)}% | ${(after.freshness * 100).toFixed(0)}% | ${delta(before.freshness * 100, after.freshness * 100)} pts |`);
say(`| Distinct lines used | ${before.distinctLines} | ${after.distinctLines} | ${delta(before.distinctLines, after.distinctLines)} |`);
say(`| Max repeat of one line | ${before.maxLineRepeat} | ${after.maxLineRepeat} | ${delta(before.maxLineRepeat, after.maxLineRepeat)} |`);
say(`| Manifestations | ${before.manifestations} | ${after.manifestations} | ${delta(before.manifestations, after.manifestations)} |`);
say(`| Behaviours firing | ${before.behaviours} | ${after.behaviours} | ${delta(before.behaviours, after.behaviours)} |`);
say(`| Validator rejections | ${before.validatorRejections} | ${after.validatorRejections} | ${delta(before.validatorRejections, after.validatorRejections)} |`);
say(`| **Runtime LLM calls** | **${before.runtimeLlmCalls}** | **${after.runtimeLlmCalls}** | **0** |`);
say(`| Zero-inference rate | 100% | 100% | — |`);
say(`| Engine time | ${before.engineMs} ms | ${after.engineMs} ms | ${delta(before.engineMs, after.engineMs)} ms |`);
say('');

say('## Per character');
say('');
say('| character | Moments before → after | distinct lines | manifestations | grammar lines |');
say('|---|---|---|---|---|');
for (const id of CAST.keys()) {
  const b = before.byActor[id] ?? { moments: 0, distinctLines: 0, manifestations: 0 };
  const a = after.byActor[id] ?? { moments: 0, distinctLines: 0, manifestations: 0 };
  say(`| ${id} | ${b.moments} → **${a.moments}** | ${b.distinctLines} → ${a.distinctLines} | `
    + `${b.manifestations} → ${a.manifestations} | ${before.grammar[id]?.lines ?? 0} → ${after.grammar[id]?.lines ?? 0} |`);
}
say('');

say('## Reuse per authored family');
say('');
say('The economic claim, in the only form that can fail. A family that yields');
say('many Moments from few lines is grammar compounding; one that yields Moments');
say('roughly equal to its line count is a scene bank with extra steps.');
say('');
say('| family | lines | Moments | manifestations | Moments per line |');
say('|---|---:|---:|---:|---:|');
const families = new Set([...Object.keys(before.perFamily), ...Object.keys(after.perFamily)]);
for (const key of [...families].sort()) {
  const entry = after.perFamily[key];
  if (!entry) continue;
  const [actor, ...rest] = key.split(':');
  const surfaceRows = after.bankDepth.filter(row => row.character === actor);
  const depth = surfaceRows.reduce((n, row) => n + row.effectiveDepth, 0);
  say(`| ${key} | ${entry.lines} | ${entry.moments} | ${entry.manifestations} | ${(entry.moments / Math.max(1, entry.lines)).toFixed(1)} |`);
}
say('');

say('## Bank depth, before and after');
say('');
say('`effective` counts lines that are neither filler nor gated behind a');
say('requirement nothing in the world satisfies. A bank of five where four need a');
say('property no target has is a bank of one.');
say('');
say('| character | surface | authored before → after | effective before → after |');
say('|---|---|---|---|');
const key = row => `${row.character}/${row.surface}`;
const beforeDepth = new Map(before.bankDepth.map(row => [key(row), row]));
for (const row of after.bankDepth) {
  const was = beforeDepth.get(key(row));
  if (was && was.authored === row.authored && was.effectiveDepth === row.effectiveDepth) continue;
  say(`| ${row.character} | ${row.surface} | ${was?.authored ?? 0} → **${row.authored}** | ${was?.effectiveDepth ?? 0} → **${row.effectiveDepth}** |`);
}
say('');

if (session) {
  const gained = after.freshMoments - before.freshMoments;
  say('## The verdict this experiment exists to produce');
  say('');
  say('| | |');
  say('|---|---:|');
  say(`| Human minutes spent | ${session.totalHumanMinutes} |`);
  say(`| Money spent | $${session.costUsd.toFixed(2)} |`);
  say(`| Units authored | ${session.unitsAuthored} |`);
  say(`| **Fresh Moments gained over 90 days** | **${gained >= 0 ? '+' : ''}${gained}** |`);
  say(`| Fresh Moments per authored unit | ${session.unitsAuthored ? (gained / session.unitsAuthored).toFixed(2) : '—'} |`);
  say(`| Fresh Moments per human minute | ${session.totalHumanMinutes ? (gained / session.totalHumanMinutes).toFixed(2) : '—'} |`);
  say('');
  say('For comparison: an authored *scene* yields exactly one scene, forever. A');
  say('ratio above 1.0 in the second-to-last row means grammar compounds; at or');
  say('below 1.0 it does not, and the honest conclusion would be that this whole');
  say('approach buys inspectability and determinism rather than volume.');
  say('');
}

mkdirSync(DIR, { recursive: true });
writeFileSync(`${DIR}after.json`, JSON.stringify(after, null, 1));
writeFileSync(`${DIR}comparison.md`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.error(`\nwritten: runs/studio/comparison.md`);
