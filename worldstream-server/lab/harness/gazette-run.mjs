import { writeFileSync, mkdirSync } from 'node:fs';
import { runWorld } from './run.mjs';
import { createDesk, consider, reconcile, edition, publicKnowledgeAffordances } from '../gazette/gazette.mjs';
import { londonDate } from '../../src/time.mjs';

// Thirty days of the Gazette Engine reading the same world the Moment Engine
// reads. No LLM, no writes back into Worldstream.
const DAYS = Number(process.argv[2] ?? 30);
const run = runWorld({ days: DAYS, momentEngine: false });
const desk = createDesk();

const byDay = new Map();
for (const event of run.events) {
  const day = londonDate(event.occurredAt);
  if (!byDay.has(day)) byDay.set(day, []);
  byDay.get(day).push(event);
}

// Faction posture is world state and changes daily; the paper's sourcing depends
// on it, because an institution under pressure gives worse answers.
import { factionsForDay, weatherForDay } from '../../src/fixture.mjs';
const SEED = 'silver-clouds-now-v1';
const factionsOn = day => factionsForDay(day, SEED, weatherForDay(day, SEED));

const lines = [];
const say = t => lines.push(t);
say(`# The London Borough Gazette — ${DAYS} days, no inference`);
say('');
let printed = 0, correctionCount = 0;
const factionsByDay = new Map();
for (const [day, events] of byDay) {
  const items = [], corrections = [];
  for (const event of events) {
    corrections.push(...reconcile(desk, event, day));
    const item = consider(desk, event, { day, factions: factionsOn(day) });
    if (item) items.push(item);
  }
  if (!items.length && !corrections.length) continue;
  const paper = edition(desk, day, items, corrections);
  printed += items.length; correctionCount += corrections.length;
  say(`## ${day}`);
  if (paper.lead) say(`### ${paper.lead.headline}`);
  for (const [section, entries] of Object.entries(paper.sections)) {
    say(`**${section}**`);
    for (const item of entries) {
      const thread = item.entryNumber > 1 ? ` *(story ${item.entryNumber} of a running thread)*` : '';
      say(`- **${item.headline}** — ${item.size}, score ${item.score}${thread}`);
      say(`  - ${item.attribution ? item.attribution + ': ' : ''}${item.body}`);
      say(`  - *why it ran: ${item.why.join('; ')}${item.hedge ? ` · ${item.hedge}` : ''}*`);
    }
  }
  for (const c of corrections) say(`**Corrections** — ${c.text}`);
  say('');
}
say('---');
say('');
say('## Summary');
say('');
say(`| | |`); say(`|---|---:|`);
say(`| Public events considered | ${run.events.filter(e => e.visibility === 'public').length} |`);
say(`| Stories printed | ${printed} |`);
say(`| Editions with anything in them | ${desk.editions.length} of ${DAYS} |`);
say(`| Running threads opened | ${desk.threads.size} |`);
say(`| Threads that reached 3+ entries | ${[...desk.threads.values()].filter(t => t.entries.length >= 3).length} |`);
say(`| Longest thread | ${Math.max(0, ...[...desk.threads.values()].map(t => t.entries.length))} entries |`);
say(`| Corrections run | ${correctionCount} |`);
say(`| Claims still standing | ${desk.claims.filter(c => !c.retracted).length} |`);
say(`| Follow-up affordances offered to the Moment Engine | ${publicKnowledgeAffordances(desk, [...byDay.keys()].at(-1)).length} |`);
say(`| Runtime LLM calls | 0 |`);
say('');
say('### Longest running threads');
say('');
for (const thread of [...desk.threads.values()].sort((a, b) => b.entries.length - a.entries.length).slice(0, 5)) {
  say(`**${thread.key}** — ${thread.entries.length} entries, ${thread.openedDay} → ${thread.lastDay}`);
  for (const entry of thread.entries) say(`  - ${entry.day}: ${entry.headline}`);
  say('');
}
mkdirSync('runs', { recursive: true });
writeFileSync(`runs/gazette-${DAYS}d.md`, lines.join('\n') + '\n');
console.log(lines.slice(-60).join('\n'));
console.error(`written: runs/gazette-${DAYS}d.md`);
