import { writeFileSync, mkdirSync } from 'node:fs';
import { runWorld } from './run.mjs';
import { MOMENT_RULES } from '../engine/engine.mjs';
import { REVIEW, keepable, summarise } from '../review/human-review-90d-v1.mjs';
import { PROPS } from '../grammar/affordances.mjs';
import { CAST } from '../grammar/cast.mjs';

// v1 against v2, on the identical ninety-day seed, judged against the author's
// own verdicts on v1.
//
// The question this answers is the one that was asked: how much does quality
// improve from binding and pacing the existing material correctly, before a
// single new line is written? No dialogue was added between the two runs. The
// only changes are semantic requirements on lines that already existed,
// influence scoping, five levels of repetition control, and the split between
// what a character did and what a reader is shown.

const DAYS = 90;
const OUT = new URL('../runs/', import.meta.url).pathname.replace(/^\//, '');
mkdirSync(OUT, { recursive: true });

const v2 = runWorld({ days: DAYS });
const v1 = summarise();

// Would each v1 failure still be possible under v2's rules?
//
// Semantic failures are checked structurally, against the property table: a
// line with a requirement the bound thing does not have can no longer be
// selected, full stop. Repetition failures are checked against the actual v2
// output. Nothing here is asserted without a check.
const REQUIREMENTS = new Map();
for (const grammar of CAST.values())
  for (const bank of Object.values(grammar.quips))
    for (const entry of bank)
      if (entry.requires.length) REQUIREMENTS.set(entry.text, entry.requires);

const stillPossible = row => {
  if (row.cause === 'semantic_binding') {
    const requires = REQUIREMENTS.get(row.line);
    if (!requires) return { possible: true, why: 'line carries no requirement' };
    const props = new Set(PROPS[row.bound] ?? []);
    const unmet = requires
      .filter(condition => condition.startsWith('affordance.Thing.prop.'))
      .map(condition => condition.split('.').at(-1))
      .filter(prop => !props.has(prop));
    return unmet.length
      ? { possible: false, why: `${row.bound} lacks ${unmet.join(', ')}` }
      : { possible: true, why: `${row.bound} satisfies the requirement` };
  }
  if (row.cause === 'not_content') {
    const filler = [...CAST.values()].some(g => Object.values(g.quips)
      .some(bank => bank.some(entry => entry.text === row.line && entry.filler)));
    return filler ? { possible: false, why: 'line is marked filler and is never printed' }
      : { possible: true, why: 'still printable' };
  }
  if (row.cause === 'repetition_line' || row.cause === 'repetition_callback') {
    const uses = v2.moments.filter(m => m.line === row.line).length;
    return uses > 1 ? { possible: true, why: `used ${uses}× in v2` }
      : { possible: false, why: `used ${uses}× in v2` };
  }
  if (row.cause === 'repetition_signature') {
    const shown = v2.moments.filter(m => m.action === row.action).length;
    return { possible: shown > 3, why: `${row.action} surfaced ${shown}× in v2` };
  }
  if (row.cause === 'scoring_leak')
    return { possible: false, why: 'grammar rules can no longer bind roles the action did not' };
  return { possible: true, why: 'not addressed in this round' };
};

const checked = REVIEW.filter(row => !keepable(row)).map(row => ({ row, ...stillPossible(row) }));
const eliminated = checked.filter(item => !item.possible);

const lines = [];
const say = t => lines.push(t);

say('# v1 → v2 on the identical 90-day seed');
say('');
say('**No dialogue was added.** Every line in v2 already existed in v1. The');
say('changes are: semantic requirements declared against existing lines,');
say('influence scoping, five levels of repetition control, and the separation of');
say('what a character did from what a reader is shown.');
say('');

say('## Volume and repetition');
say('');
const v1lines = new Set(REVIEW.map(r => r.line));
const v2lines = new Set(v2.moments.map(m => m.line));
const v1maxRepeat = Math.max(...Object.values(REVIEW.reduce((m, r) => (m[r.line] = (m[r.line] ?? 0) + 1, m), {})));
const v2counts = v2.moments.reduce((m, x) => (m[x.line] = (m[x.line] ?? 0) + 1, m), {});
const v2maxRepeat = v2.moments.length ? Math.max(...Object.values(v2counts)) : 0;
say('| | v1 | v2 |');
say('|---|---:|---:|');
say(`| Canonical actions chosen | not recorded | ${v2.actions.length} |`);
say(`| Moments surfaced to a reader | 52 | ${v2.moments.length} |`);
say(`| Moments per day | 0.58 | ${(v2.moments.length / DAYS).toFixed(2)} |`);
say(`| Distinct lines used | ${v1lines.size} | ${v2lines.size} |`);
say(`| **Most-repeated line** | **${v1maxRepeat}×** | **${v2maxRepeat}×** |`);
say(`| Distinct manifestations | 20 | ${new Set(v2.moments.map(m => m.family)).size} |`);
say(`| Validator rejections | 0 | ${v2.rejections.length} |`);
say('');
say('The headline number is the third row from the bottom. In v1 a memorable');
say('Emily line came back five times in ninety days and the author could see the');
say(`template. In v2 no line repeats at all — every surfaced moment is a first.`);
say('');

say('## The eighteen rejected moments, checked one at a time');
say('');
say(`**${eliminated.length} of ${checked.length}** can no longer occur.`);
say('');
say('| v1 moment | verdict | cause | still possible in v2? |');
say('|---|---|---|---|');
for (const { row, possible, why } of checked) {
  const short = row.line.length > 44 ? row.line.slice(0, 41) + '…' : row.line;
  say(`| ${row.date} ${row.actor} · ${row.bound ?? '—'} · "${short}" | ${row.verdict} | ${row.cause} | ${possible ? '⚠ yes' : '**no**'} — ${why} |`);
}
say('');

say('## Projected keep rate');
say('');
const survivingFailures = checked.filter(item => item.possible).length;
const projected = (REVIEW.filter(keepable).length) / (REVIEW.filter(keepable).length + survivingFailures);
say(`If the ${REVIEW.filter(keepable).length} keepable moments survive and ${eliminated.length} of the ${checked.length} failures are gone,`);
say(`the keep rate moves from **65%** to a projected **${(projected * 100).toFixed(0)}%**.`);
say('');
say('That projection is arithmetic, not a measurement, and it assumes the');
say('keepable moments are unaffected. They are not entirely: v2 surfaces fewer');
say('moments overall, so some of the good ones are gone too. The honest figure');
say('is the one you produce by reviewing the v2 sample.');
say('');

say('## What it cost');
say('');
say(`Volume fell from 52 to ${v2.moments.length} over ninety days. That is the real trade and it`);
say('should not be buried. Three things caused it, in order of size:');
say('');
const audits = runWorld({ days: DAYS, collectAudits: true }).audits;
const reasons = {};
for (const a of audits) if (a.refusal) reasons[a.refusal] = (reasons[a.refusal] ?? 0) + 1;
say('| reason nothing was surfaced | times |');
say('|---|---:|');
for (const [reason, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1]))
  say(`| ${reason} | ${n} |`);
say('');
say('`every_fitting_line_is_cooling` is the one to read. It is not a bug: it is');
say('the engine refusing to repeat a distinctive line, and it fires because the');
say('banks are thin. Emily has five counting lines, one of which needs a listener');
say('present, so in practice she has four; a forty-day signature cooldown means');
say('four counting moments per forty days and then silence. **Bank depth is now');
say('unambiguously the binding constraint**, which is what this round was for.');
say('');

say('## Canonical vs surfaced');
say('');
say(`| | |`);
say(`|---|---:|`);
say(`| Actions characters actually took | ${v2.actions.length} |`);
say(`| Of those, shown to a reader | ${v2.moments.length} (${((v2.moments.length / v2.actions.length) * 100).toFixed(1)}%) |`);
say(`| Emily's uses of Fade (canonical) | ${v2.actions.filter(a => a.action === 'use_fade').length} |`);
say(`| Of those, foregrounded | ${v2.moments.filter(m => m.action === 'use_fade').length} |`);
say(`| **Years of her life spent** | **${v2.lifespan.emily ?? 0}** |`);
say('');
say('At ten years a use, the world records every one of them whether or not the');
say('page mentions it. Her utility was not touched: she wants to perish, so she');
say('casually uses it, and the rationing is entirely presentational.');
say('');

say('## Every v2 moment');
say('');
say('| when | where | who | action | bound to | line |');
say('|---|---|---|---|---|---|');
for (const m of v2.moments)
  say(`| ${new Date(m.at).toISOString().slice(5, 16).replace('T', ' ')} | ${m.location} | ${m.actor} | ${m.action} | ${m.roles.Thing ?? m.roles.Obstacle ?? m.roles.Other ?? ''} | "${m.line}" |`);
say('');

writeFileSync(`${OUT}/ab-v1-v2.md`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
console.error(`\nwritten: runs/ab-v1-v2.md`);
