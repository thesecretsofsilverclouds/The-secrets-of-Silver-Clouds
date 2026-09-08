import { writeFileSync, mkdirSync } from 'node:fs';
import { runWorld } from './run.mjs';
import { CAST } from '../grammar/cast.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { grammarSize } from '../engine/grammar.mjs';

// TRACK A — the final v2 review packet.
//
// v2 is frozen. This file only *reports* it; it changes nothing and is not
// permitted to. Two independent gradings are asked for per moment, because they
// fail differently and want different fixes:
//
//   Moment   KEEP / KEEP-TUNE / WRONG / CUT
//            Is this a thing that should have happened, to this person, here?
//            A wrong Moment is a grammar or practice problem.
//
//   Surface  FRESH / THIN / REPEATED / WRONG
//            Are these the right words for it?
//            A thin surface is an authoring problem. A repeated one is a pacing
//            problem. They are not the same and conflating them last time cost
//            a round.
//
// The distinction matters most for the six moments below that share two lines:
// if the Moment is KEEP but the Surface is THIN, the fix is the Studio hour. If
// the Moment itself is CUT, no amount of new dialogue helps.

const DAYS = Number(process.argv[2] ?? 90);
const OUT = new URL('../runs/', import.meta.url).pathname.replace(/^\//, '');
mkdirSync(OUT, { recursive: true });

const run = runWorld({ days: DAYS });
const lines = [];
const say = text => lines.push(text);

// Prior-use counts, computed forward so each entry reports what was true *at
// the time it fired* rather than the total for the run.
const linePriorUses = new Map();
const familyPriorUses = new Map();
const surfacePriorUses = new Map();
const enriched = run.moments.map(moment => {
  const priorLine = linePriorUses.get(moment.line) ?? 0;
  const priorFamily = familyPriorUses.get(moment.family) ?? 0;
  const priorSurface = surfacePriorUses.get(`${moment.actor}:${moment.presentationKey}`) ?? 0;
  linePriorUses.set(moment.line, priorLine + 1);
  familyPriorUses.set(moment.family, priorFamily + 1);
  surfacePriorUses.set(`${moment.actor}:${moment.presentationKey}`, priorSurface + 1);
  return { ...moment, priorLine, priorFamily, priorSurface };
});

say(`# v2 Moment review packet — ${DAYS} days, engine frozen`);
say('');
say(`${run.moments.length} surfaced Moments, from ${run.actions.length} canonical actions.`);
say('');
say('**Two gradings per Moment.** They fail differently and want different fixes.');
say('');
say('| field | values | what it judges |');
say('|---|---|---|');
say('| **Moment** | KEEP / KEEP-TUNE / WRONG / CUT | should this have happened, to this person, here? |');
say('| **Surface** | FRESH / THIN / REPEATED / WRONG | are these the right words for it? |');
say('');
say('A Moment marked KEEP with a Surface marked THIN is the Studio hour\'s job.');
say('A Moment marked WRONG or CUT is a grammar or practice problem and no amount');
say('of new dialogue fixes it. Six of the Moments below share two lines between');
say('them; that distinction is exactly where it matters.');
say('');
say('---');
say('');

let day = null;
for (const moment of enriched) {
  if (moment.day !== day) { day = moment.day; say(`## ${day}`); say(''); }
  const time = new Date(moment.at).toISOString().slice(11, 16);
  const room = moment.area && moment.area !== 'venue' ? `/${moment.area}` : '';
  const bound = moment.roles.Thing ?? moment.roles.Obstacle ?? moment.roles.Other ?? '—';
  const others = moment.participants.filter(who => who !== moment.actor);
  const sways = [...moment.influences].sort((a, b) => b.score - a.score);
  const best = moment.rejectedAlternatives[0];

  say(`### ${time} · ${moment.location}${room}`);
  say('');
  say(`> **${CAST.get(moment.actor).displayName}:** “${moment.line}”`);
  say('');
  say('| | |');
  say('|---|---|');
  say(`| **Moment** | KEEP ☐  KEEP-TUNE ☐  WRONG ☐  CUT ☐ |`);
  say(`| **Surface** | FRESH ☐  THIN ☐  REPEATED ☐  WRONG ☐ |`);
  say(`| situation | ${moment.practice} at ${moment.location}${room}${bound !== '—' ? `, bound to **${bound}**` : ''} |`);
  say(`| participants | ${moment.actor}${others.length ? ` with ${others.join(', ')}` : ' (alone)'} |`);
  say(`| semantic action | \`${moment.action}\` — intent *${moment.intent ?? 'none'}*${moment.roles.Manner && moment.roles.Manner !== 'none' ? `, manner *${moment.roles.Manner}*` : ''} |`);
  say(`| reader-facing surface | \`${moment.presentationKey}\`${moment.lineIsSignature ? ' *(signature wording)*' : ''} |`);
  say(`| why it won | ${sways.slice(0, 3).map(s => `${s.score >= 0 ? '+' : ''}${s.score} ${s.name}`).join('; ')} |`);
  say(`| score | ${moment.score} (raw ${moment.rawScore}, fatigue ${moment.fatigue}) |`);
  say(`| best rejected alternative | ${best ? `${best.actor} · ${best.family.split('(')[0]} (${best.score})` : '— nothing else was available'} |`);
  say(`| **this exact line, prior uses** | **${moment.priorLine}** |`);
  say(`| **this family, prior uses** | **${moment.priorFamily}** |`);
  say(`| this surface, prior uses | ${moment.priorSurface} |`);
  say(`| bank at the time | ${moment.linesThatFitted ?? '?'} line(s) fitted this target, ${moment.linesStillFresh ?? '?'} still fresh |`);
  if (moment.mystery) say(`| mystery | held — the engine knows why, the page does not say |`);
  if (moment.lineMeaning) say(`| the line means | ${moment.lineMeaning} *(never stated to the reader)* |`);
  const costly = moment.requestedEffects.find(effect => effect.cost);
  if (costly) say(`| **cost committed** | ${JSON.stringify(costly.cost)} — author-approved action |`);
  say('');
}

say('---');
say('');
say('## Tally sheet');
say('');
say('| | KEEP | KEEP-TUNE | WRONG | CUT |');
say('|---|---|---|---|---|');
say('| Moment | | | | |');
say('');
say('| | FRESH | THIN | REPEATED | WRONG |');
say('|---|---|---|---|---|');
say('| Surface | | | | |');
say('');

say('## Context the grading may want');
say('');
say('### Lines carrying more than one Moment');
say('');
say('| line | uses | character | bank depth for that surface |');
say('|---|---:|---|---:|');
const byLine = new Map();
for (const moment of enriched) {
  const entry = byLine.get(moment.line) ?? { n: 0, actor: moment.actor, surface: moment.presentationKey };
  entry.n += 1;
  byLine.set(moment.line, entry);
}
for (const [line, entry] of [...byLine].sort((a, b) => b[1].n - a[1].n)) {
  if (entry.n < 2) continue;
  const depth = (CAST.get(entry.actor).quips[entry.surface] ?? []).length;
  const short = line.length > 56 ? `${line.slice(0, 53)}…` : line;
  say(`| "${short}" | ${entry.n} | ${entry.actor} | ${depth} |`);
}
say('');
say('Where bank depth is 1, the engine had nothing else to reach for. That is a');
say('Surface THIN, not necessarily a Moment CUT.');
say('');

say('### What the characters did that you were not shown');
say('');
say('| | |');
say('|---|---:|');
say(`| canonical actions | ${run.actions.length} |`);
say(`| surfaced | ${run.moments.length} (${((run.moments.length / run.actions.length) * 100).toFixed(1)}%) |`);
for (const [who, years] of Object.entries(run.lifespan))
  say(`| ${who} — years of life spent, all recorded | ${years} |`);
say('');

say('### Grammar depth, for reference');
say('');
say('| character | rules | lines authored | lines that fired here | Moments |');
say('|---|---:|---:|---:|---:|');
for (const [id, grammar] of CAST) {
  const size = grammarSize(grammar);
  const mine = enriched.filter(moment => moment.actor === id);
  say(`| ${id} | ${size.drives + size.influences + size.forbids} | ${size.quipLines} | ${new Set(mine.map(m => m.line)).size} | ${mine.length} |`);
}
say('');

writeFileSync(`${OUT}/v2-review-packet.md`, lines.join('\n') + '\n');
writeFileSync(`${OUT}/v2-review-packet.json`, JSON.stringify(enriched, null, 1));
console.error(`written: runs/v2-review-packet.md (${run.moments.length} Moments)`);
console.log(lines.slice(0, 48).join('\n'));
