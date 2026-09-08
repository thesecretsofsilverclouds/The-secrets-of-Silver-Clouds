import { writeFileSync, mkdirSync } from 'node:fs';
import { runWorld } from './run.mjs';
import { scoreCandidates } from '../engine/score.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { CAST } from '../grammar/cast.mjs';
import { grammarSize } from '../engine/grammar.mjs';
import { SHARED_MOMENTS } from '../../src/offscreen-lives.mjs';
import { ALL_MOMENT_TEXT } from '../../src/moments.mjs';

// Control against lab, and the four questions that decide whether this is worth
// building: what does it add, is any of it good, what did it cost to author,
// and what would it have cost to get the same thing another way.
//
// The control is the same thirty days of the same world with the engine
// switched off. It is not a straw man: Worldstream already produces a great
// deal, and the honest question is what sits in the gap it leaves.

const DAYS = Number(process.argv[2] ?? 30);
const OUT = new URL('../runs/', import.meta.url).pathname.replace(/^\//, '');
mkdirSync(OUT, { recursive: true });

const control = runWorld({ days: DAYS, momentEngine: false });
const lab = runWorld({ days: DAYS, momentEngine: true, collectAudits: true });

// ---------------------------------------------------------------- quality
//
// Four deterministic proxies, deliberately conservative, plus a sample for the
// author. A proxy is not a judgement: the last column of the table is a
// machine's opinion and the sample below it is where the real one gets made.

function assessQuality(run) {
  const seenLine = new Map();
  const seenFamily = new Map();
  const assessed = [];
  for (const moment of run.moments) {
    // Character-specific: the decisive sway came from this character's own
    // grammar or their manner, not from the practice's generic influence — and
    // some other present character would not have chosen the same thing.
    const top = [...moment.influences].sort((a, b) => b.score - a.score)[0];
    const fromCharacter = Boolean(top && (top.from?.startsWith('grammar:') || top.kind === 'manner'));
    const alternatives = moment.rejectedAlternatives.filter(other => other.actor !== moment.actor);
    const distinct = alternatives.length === 0 || alternatives.some(other =>
      other.family.split('(')[0] !== moment.family.split('(')[0]);

    // Coherent: it bound to something the world state actually supported, and
    // the strongest signal of that is a transient affordance — a thing that
    // only existed because of what the city was doing that day.
    const bound = moment.roles.Thing ?? moment.roles.Obstacle ?? moment.roles.Other ?? null;
    const contextual = Boolean(bound) && CONTEXT_BOUND.has(bound);

    // Non-repetitive: this exact line and this exact manifestation are still fresh.
    const lineUses = (seenLine.get(moment.line) ?? 0) + 1;
    const familyUses = (seenFamily.get(moment.family) ?? 0) + 1;
    seenLine.set(moment.line, lineUses);
    seenFamily.set(moment.family, familyUses);
    const fresh = lineUses <= 2 && familyUses <= 2;

    // Worth surfacing: it cleared the floor by a real margin after fatigue.
    const worth = moment.score >= 12;

    assessed.push({ ...moment, quality: { fromCharacter, distinct, contextual, fresh, worth,
      score: [fromCharacter, distinct, contextual, fresh, worth].filter(Boolean).length } });
  }
  return assessed;
}
const CONTEXT_BOUND = new Set(['lanterns', 'bell_strikes', 'lit_windows', 'people_sheltering',
  'people_avoiding', 'arrivals_between_chimes', 'standing_water', 'shut_gate', 'closed_path',
  'plaza_shadows', 'crowd', 'pedestrians_looking_up']);

const assessed = assessQuality(lab);

// ------------------------------------------------------- authoring leverage
const grammarUnits = [...CAST.values()].reduce((total, grammar) => {
  const size = grammarSize(grammar);
  return { rules: total.rules + size.drives + size.influences + size.forbids,
    banks: total.banks + size.quipFamilies, lines: total.lines + size.quipLines };
}, { rules: 0, banks: 0, lines: 0 });
const practiceActions = [...PRACTICES.values()].reduce((n, p) => n + p.actions.length, 0);

const emilyMoments = assessed.filter(moment => moment.actor === 'emily');
const emilySize = grammarSize(CAST.get('emily'));
const emilyManifestations = new Set(emilyMoments.map(moment => moment.family));

// ------------------------------------------------------------------ report
const lines = [];
const say = text => lines.push(text);

say(`# Control vs lab — ${DAYS} days, seed silver-clouds-now-v1`);
say('');
say('## 1. What the Moment Engine adds');
say('');
say('| | control | lab |');
say('|---|---:|---:|');
say(`| Worldstream events | ${control.stats.worldEvents} | ${lab.stats.worldEvents} |`);
say(`| of which public | ${control.stats.publicEvents} | ${lab.stats.publicEvents} |`);
say(`| Moment opportunities evaluated | 0 | ${lab.stats.evaluations} |`);
say(`| Moments committed | 0 | ${lab.moments.length} |`);
say(`| Moments per day | 0 | ${(lab.moments.length / DAYS).toFixed(2)} |`);
say(`| Distinct manifestations | 0 | ${new Set(lab.moments.map(m => m.family)).size} |`);
say(`| Opportunities that produced nothing | — | ${lab.stats.refusals.nothing_worth_surfacing ?? 0} (${(((lab.stats.refusals.nothing_worth_surfacing ?? 0) / lab.stats.evaluations) * 100).toFixed(0)}%) |`);
say(`| Proposals refused by the world validator | — | ${lab.rejections.length} |`);
say(`| Runtime LLM calls | 0 | 0 |`);
say(`| Engine time over ${DAYS} days | — | ${lab.stats.engineMs.toFixed(0)} ms |`);
say('');
say('The world events are identical in both runs, and that is deliberate: the');
say('lab never writes back, so the simulation it is measured against is the same');
say('simulation. Everything in the lab column is additive.');
say('');

say('## 2. Quality of what it added');
say('');
const pct = n => `${((n / Math.max(1, assessed.length)) * 100).toFixed(0)}%`;
const count = key => assessed.filter(m => m.quality[key]).length;
say('| criterion | moments meeting it |');
say('|---|---:|');
say(`| Character-specific (decided by this character's own grammar) | ${count('fromCharacter')} / ${assessed.length} — ${pct(count('fromCharacter'))} |`);
say(`| Structurally distinct from what another present character would do | ${count('distinct')} / ${assessed.length} — ${pct(count('distinct'))} |`);
say(`| Bound to something today's world state supplied | ${count('contextual')} / ${assessed.length} — ${pct(count('contextual'))} |`);
say(`| Non-repetitive (line and manifestation both still fresh) | ${count('fresh')} / ${assessed.length} — ${pct(count('fresh'))} |`);
say(`| Cleared the interest floor by a margin | ${count('worth')} / ${assessed.length} — ${pct(count('worth'))} |`);
say(`| **All five** | ${assessed.filter(m => m.quality.score === 5).length} / ${assessed.length} |`);
say(`| Four or more | ${assessed.filter(m => m.quality.score >= 4).length} / ${assessed.length} |`);
say(`| Two or fewer | ${assessed.filter(m => m.quality.score <= 2).length} / ${assessed.length} |`);
say('');
say('These are machine proxies and should be read as such. The author-review');
say('sample in `runs/review-sample.md` is where the keep/cut decision is made.');
say('');

say('## 3. Authoring leverage');
say('');
say('| | count |');
say('|---|---:|');
say(`| Practices authored | ${PRACTICES.size} |`);
say(`| Action definitions authored | ${practiceActions} |`);
say(`| Character grammars authored | ${CAST.size} |`);
say(`| Grammar rules (drives + influences + forbids) | ${grammarUnits.rules} |`);
say(`| Quip banks | ${grammarUnits.banks} |`);
say(`| Authored lines | ${grammarUnits.lines} |`);
say(`| Affordance entries | ${Object.keys((await import('../grammar/affordances.mjs')).AFFORDANCES).length} places |`);
say('');
say('### Emily specifically');
say('');
say(`| | |`);
say(`|---|---:|`);
say(`| Behaviours authored (action definitions she can reach) | ${practiceActions} shared, ${emilySize.drives + emilySize.influences + emilySize.forbids} rules of her own |`);
say(`| Quip families | ${emilySize.quipFamilies} |`);
say(`| Authored lines | ${emilySize.quipLines} |`);
say(`| Distinct valid Moments over ${DAYS} days | ${emilyMoments.length} |`);
say(`| Distinct manifestations | ${emilyManifestations.size} |`);
say(`| Reuse per authored line | ${(emilyMoments.length / Math.max(1, emilySize.quipLines)).toFixed(2)}× |`);
say('');

// What production does today for the same job.
const sharedStrings = Object.values(SHARED_MOMENTS)
  .reduce((n, moment) => n + Object.keys(moment).length - 1, 0);
say('### The comparison that matters');
say('');
say(`Production already answers this need by authoring strings. \`src/offscreen-lives.mjs\``);
say(`holds ${sharedStrings} of them (${Object.keys(SHARED_MOMENTS).length} shared moments × 5 characters), and`);
say(`\`src/moments.mjs\` holds ${ALL_MOMENT_TEXT.length} more. Exactly one of those ${sharedStrings} is Emily counting —`);
say('the lanterns, on the swing, on a Veil day. It is a good sentence and it can');
say('only ever be that sentence in that situation.');
say('');
const countBehaviour = emilyMoments.filter(m => m.action === 'observe_and_count');
const countThings = new Set(countBehaviour.map(m => m.roles.Thing));
say(`In the lab the same behaviour is one action definition and ${CAST.get('emily').quips.count_pattern.length} authored lines.`);
say(`Over ${DAYS} days it produced ${countBehaviour.length} moments across ${countThings.size} different things:`);
say(`${[...countThings].join(', ')}.`);
say('');

say('## 4. Every moment the lab committed');
say('');
say('| when | where | who | action | bound to | score | line | quality |');
say('|---|---|---|---|---|---:|---|---:|');
for (const moment of assessed) {
  const bound = moment.roles.Thing ?? moment.roles.Obstacle ?? moment.roles.Other ?? '';
  say(`| ${new Date(moment.at).toISOString().slice(5, 16).replace('T', ' ')} | ${moment.location} | ${moment.actor} | ${moment.action} | ${bound} | ${moment.score} | ${moment.line ? `"${moment.line}"` : ''} | ${moment.quality.score}/5 |`);
}
say('');

say('## 5. Why the engine stayed quiet');
say('');
say('| reason | times |');
say('|---|---:|');
for (const [reason, times] of Object.entries(lab.stats.refusals).sort((a, b) => b[1] - a[1]))
  say(`| ${reason} | ${times} |`);
say('');

writeFileSync(`${OUT}/compare-${DAYS}d.md`, lines.join('\n') + '\n');
writeFileSync(`${OUT}/moments-${DAYS}d.json`, JSON.stringify(assessed, null, 1));
console.log(lines.join('\n'));
console.error(`\nwritten: runs/compare-${DAYS}d.md, runs/moments-${DAYS}d.json`);
