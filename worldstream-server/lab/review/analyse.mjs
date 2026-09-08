import { REVIEW, summarise, keepable } from './human-review-90d-v1.mjs';
import { CAST } from '../grammar/cast.mjs';

// The author's pass, turned into the numbers that decide where authoring time
// goes next. Nothing here is a machine judgement; it is arithmetic over a human
// one.

const s = summarise();
const pct = (n, d = s.total) => `${((n / d) * 100).toFixed(0)}%`;
const out = [];
const say = t => out.push(t);
const count = (rows, v) => rows.filter(r => r.verdict === v).length;

say('# Human review of the 90-day v1 run — analysis');
say('');
say(`52 moments, reviewed by the author. **This is the quality baseline.** Every`);
say('refinement below is justified against a row in it.');
say('');
say('## Headline');
say('');
say('| | | |');
say('|---|---:|---:|');
say(`| **Overall keep rate** (KEEP + TUNE) | ${REVIEW.filter(keepable).length} / ${s.total} | **${pct(REVIEW.filter(keepable).length)}** |`);
say(`| **Pure keep rate** (KEEP only) | ${count(REVIEW, 'KEEP')} / ${s.total} | **${pct(count(REVIEW, 'KEEP'))}** |`);
for (const v of ['KEEP', 'TUNE', 'WRONG', 'CUT', 'GENERIC'])
  say(`| ${v} | ${count(REVIEW, v)} | ${pct(count(REVIEW, v))} |`);
say('');
say('Note what is **not** there: zero GENERIC. Not one moment was marked');
say('"coherent but could belong to anybody". The character layer is working; the');
say('failures are elsewhere, and they are all mechanical.');
say('');

say('## By character');
say('');
say('| character | moments | KEEP | TUNE | WRONG | CUT | keep rate | pure keep |');
say('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const [actor, rows] of Object.entries(s.byActor).sort((a, b) => b[1].length - a[1].length))
  say(`| ${actor} | ${rows.length} | ${count(rows, 'KEEP')} | ${count(rows, 'TUNE')} | ${count(rows, 'WRONG')} | ${count(rows, 'CUT')} | ${pct(rows.filter(keepable).length, rows.length)} | ${pct(count(rows, 'KEEP'), rows.length)} |`);
say('');

say('## By behaviour');
say('');
say('| action | moments | KEEP | TUNE | WRONG | CUT | keep rate | pure keep |');
say('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const [action, rows] of Object.entries(s.byAction).sort((a, b) => b[1].length - a[1].length))
  say(`| ${action} | ${rows.length} | ${count(rows, 'KEEP')} | ${count(rows, 'TUNE')} | ${count(rows, 'WRONG')} | ${count(rows, 'CUT')} | ${pct(rows.filter(keepable).length, rows.length)} | ${pct(count(rows, 'KEEP'), rows.length)} |`);
say('');

say('## By authored line — where authoring time compounds');
say('');
say('This is the table that decides the Studio budget. A line that fires eight');
say('times and is kept twice is not a good line reused; it is a good line worn out.');
say('');
say('| line | uses | KEEP | TUNE | WRONG | CUT | keepable |');
say('|---|---:|---:|---:|---:|---:|---:|');
for (const [line, rows] of Object.entries(s.byLine).sort((a, b) => b[1].length - a[1].length)) {
  if (rows.length < 2) continue;
  const short = line.length > 62 ? line.slice(0, 59) + '…' : line;
  say(`| "${short}" | ${rows.length} | ${count(rows, 'KEEP')} | ${count(rows, 'TUNE')} | ${count(rows, 'WRONG')} | ${count(rows, 'CUT')} | ${pct(rows.filter(keepable).length, rows.length)} |`);
}
say('');
const singles = Object.entries(s.byLine).filter(([, rows]) => rows.length === 1);
say(`Lines used exactly once: ${singles.length}, of which ${singles.filter(([, rows]) => keepable(rows[0])).length} keepable.`);
say('');

say('## Failure classes — where the next fix belongs');
say('');
say('| class | moments | layer that owns it |');
say('|---|---:|---|');
const OWNER = {
  semantic_binding: 'affordance design + quip binding constraints',
  scoring_leak: 'scoring — influence scope',
  repetition_line: 'pacing — exact-line cooldown',
  repetition_callback: 'pacing — callback family cooldown',
  repetition_signature: 'presentation — signature-action foregrounding',
  not_content: 'presentation — reader-facing worthiness gate',
  thin_context: 'practice design + presentation staging',
};
for (const [cause, rows] of Object.entries(s.byCause).sort((a, b) => b[1].length - a[1].length))
  say(`| ${cause} | ${rows.length} | ${OWNER[cause]} |`);
say('');
const mechanical = REVIEW.filter(r => !keepable(r)).length;
const bindingOrPacing = REVIEW.filter(r => !keepable(r)
  && ['semantic_binding', 'repetition_line', 'repetition_callback', 'repetition_signature', 'not_content', 'scoring_leak'].includes(r.cause)).length;
say(`**${bindingOrPacing} of the ${mechanical} non-keepable moments fail for binding, pacing, scoping or`);
say('worthiness reasons — not because the character grammar is wrong.** That is the');
say('case for a refinement round before any new dialogue is written.');
say('');

say('## What made the good ones work');
say('');
const factors = {};
for (const row of REVIEW.filter(keepable)) for (const f of row.factors) factors[f] = (factors[f] ?? 0) + 1;
say('| factor | keepable moments citing it |');
say('|---|---:|');
for (const [factor, n] of Object.entries(factors).sort((a, b) => b[1] - a[1]))
  say(`| ${factor} | ${n} |`);
say('');

say('## Authoring leverage, against the human verdict');
say('');
say('| character | rules | lines authored | lines fired | moments | keepable | keepable per fired line |');
say('|---|---:|---:|---:|---:|---:|---:|');
for (const [id, grammar] of CAST) {
  const rows = s.byActor[id] ?? [];
  const fired = new Set(rows.map(r => r.line)).size;
  const kept = rows.filter(keepable).length;
  const lines = Object.values(grammar.quips).reduce((n, b) => n + b.length, 0);
  const rules = grammar.drives.length + grammar.influences.length + grammar.forbids.length;
  say(`| ${id} | ${rules} | ${lines} | ${fired} | ${rows.length} | ${kept} | ${fired ? (kept / fired).toFixed(1) : '—'} |`);
}
say('');
say('Emily: 9 authored rules and 10 lines that actually fired produced');
say(`${(s.byActor.emily ?? []).filter(keepable).length} keepable moments. That is the leverage claim, measured against a`);
say('human verdict rather than a proxy.');
say('');

console.log(out.join('\n'));
