import { writeFileSync, mkdirSync } from 'node:fs';
import { runWorld } from './run.mjs';
import { CAST } from '../grammar/cast.mjs';
import { grammarSize } from '../engine/grammar.mjs';

// The author-review sample.
//
// Everything else in this lab is a machine marking its own homework. This file
// exists to stop that: it prints every moment a run produced, in reading order,
// with the reasoning that produced it and a box to tick. The keep rate is not
// computed here. It is a number the author writes in after reading it, and the
// report says so rather than guessing.

const DAYS = Number(process.argv[2] ?? 90);
const OUT = new URL('../runs/', import.meta.url).pathname.replace(/^\//, '');
mkdirSync(OUT, { recursive: true });

const run = runWorld({ days: DAYS });
const lines = [];
const say = text => lines.push(text);

say(`# Author review — ${DAYS} days`);
say('');
say(`${run.moments.length} moments. Five labels, as before:`);
say('');
say('- **KEEP** — I would happily have readers encounter this.');
say('- **KEEP / TUNE** — premise right; line or action needs minor authoring.');
say('- **GENERIC** — coherent but could belong to anybody.');
say('- **CHARACTER WRONG** — structurally plausible, wrong person.');
say('- **CUT** — boring, nonsensical, repetitive, or not worth reader attention.');
say('');
say('For anything you keep, note what made it work: character choice, collision');
say('of behaviours, environment affordance, relationship, memory, ability use,');
say('world-state modifier, authored quip, or unexpected combination.');
say('');
say('The last column of each block is what the engine thought it was doing. If');
say('that reasoning is wrong, the moment is wrong even when the line reads well.');
say('');

const byDay = new Map();
for (const moment of run.moments) {
  if (!byDay.has(moment.day)) byDay.set(moment.day, []);
  byDay.get(moment.day).push(moment);
}

for (const [day, moments] of byDay) {
  say(`## ${day}`);
  say('');
  for (const moment of moments) {
    const time = new Date(moment.at).toISOString().slice(11, 16);
    const bound = moment.roles.Thing ?? moment.roles.Obstacle ?? moment.roles.Other ?? '—';
    const top = [...moment.influences].sort((a, b) => b.score - a.score).slice(0, 3);
    say(`**${time} · ${moment.location}${moment.area && moment.area !== 'venue' ? `/${moment.area}` : ''}**`);
    say('');
    say(`> ${CAST.get(moment.actor).displayName}: “${moment.line}”`);
    say('');
    say(`- KEEP ☐  TUNE ☐  GENERIC ☐  WRONG ☐  CUT ☐  — *${moment.actor} · ${moment.practice} · ${moment.action} · ${bound}*`);
    say(`- score ${moment.score} (raw ${moment.rawScore}, fatigue ${moment.fatigue}, seen ${moment.timesBefore}× before)`);
    say(`- because: ${top.map(sway => `${sway.score >= 0 ? '+' : ''}${sway.score} ${sway.name}`).join('; ')}`);
    if (moment.mystery) say(`- *mystery held: the engine knows why, the page does not say*`);
    if (moment.rejectedAlternatives.length)
      say(`- instead of: ${moment.rejectedAlternatives.slice(0, 3).map(other => `${other.actor}/${other.family.split('(')[0]} (${other.score})`).join(', ')}`);
    const costly = moment.requestedEffects.find(effect => effect.cost);
    if (costly) say(`- **cost committed: ${JSON.stringify(costly.cost)}** — author-approved action`);
    if (moment.lineMeaning) say(`- *the line means: ${moment.lineMeaning} — the page does not say so*`);
    if (moment.linesThatFitted !== undefined)
      say(`- bank: ${moment.linesThatFitted} line(s) fitted this target, ${moment.linesStillFresh} still fresh`);
    say('');
  }
}

// Leverage, measured on what actually fired rather than on what was written.
say('---');
say('');
say('## What the characters did, and what you were shown');
say('');
say('| | |');
say('|---|---:|');
say(`| Canonical actions taken | ${run.actions.length} |`);
say(`| Surfaced to a reader | ${run.moments.length} (${((run.moments.length / run.actions.length) * 100).toFixed(1)}%) |`);
for (const [who, years] of Object.entries(run.lifespan))
  say(`| ${who}: years of life spent (all of them recorded) | ${years} |`);
const fade = run.actions.filter(a => a.action === 'use_fade').length;
say(`| Emily's uses of Fade — taken / shown | ${fade} / ${run.moments.filter(m => m.action === 'use_fade').length} |`);
say('');
say('## Authoring leverage, measured on this run');
say('');
say('| character | rules | lines authored | lines used | moments | manifestations | uses per used line |');
say('|---|---:|---:|---:|---:|---:|---:|');
for (const [id, grammar] of CAST) {
  const size = grammarSize(grammar);
  const mine = run.moments.filter(moment => moment.actor === id);
  const usedLines = new Set(mine.map(moment => moment.line)).size;
  const manifestations = new Set(mine.map(moment => moment.family)).size;
  say(`| ${id} | ${size.drives + size.influences + size.forbids} | ${size.quipLines} | ${usedLines} | ${mine.length} | ${manifestations} | ${usedLines ? (mine.length / usedLines).toFixed(1) : '—'} |`);
}
say('');
say('The column that matters is the last one. A line reused twice is free');
say('variation; a line reused eight times is a reader noticing the machinery. On');
say('this run the banks that are working hardest are the ones to deepen first,');
say('and the ones that never fired are grammar written for situations the world');
say('has not yet produced.');
say('');

writeFileSync(`${OUT}/review-sample-${DAYS}d.md`, lines.join('\n') + '\n');
console.error(`written: runs/review-sample-${DAYS}d.md (${run.moments.length} moments)`);
console.log(lines.slice(0, 60).join('\n'));
