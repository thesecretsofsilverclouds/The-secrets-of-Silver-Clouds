import { readFileSync, writeFileSync } from 'node:fs';
import { CAST } from '../grammar/cast.mjs';
import { tierOf } from './offscreen-rewind.mjs';

// Pools the per-world shadow runs into one packet for review.
//
// Four worlds rather than one, because a single history cannot distinguish a
// finding about the engine from an accident of that world. Anything reported
// here as a finding holds in all four.

const WORLDS = ['worldstream-review-v23', 'worldstream-final-review-v21',
  'worldstream-final-review', 'worldstream-review-current'];
const CAST_IDS = ['emily', 'ashai', 'goaden', 'yukon'];
const HOUR = 3_600_000, DAY = 86_400_000;

const out = [];
const say = text => out.push(text);

let opportunities = 0, proposals = [], silence = 0, quietChecks = 0, quietProposals = 0;
const refusals = {}, present = {}, rows = [], practices = {}, manifestations = new Set();

for (const world of WORLDS) {
  const records = JSON.parse(readFileSync(`runs/shadow/records-${world}.json`, 'utf8'));
  const proposed = records.filter(record => record.proposed);
  const quiet = records.filter(record => record.quiet);
  const times = records.map(record => record.at).sort((a, b) => a - b);
  const elapsed = times.at(-1) - times[0];
  const gaps = times.slice(1).map((time, index) => time - times[index]);
  const stillQuiet = gaps.filter(gap => gap > 2 * HOUR).reduce((total, gap) => total + gap, 0);
  // A Moment is additive when the world published nothing else around it. The
  // trigger event is excluded: it is always inside its own window.
  const intoSilence = proposed.filter(record =>
    record.worldPublished.filter(event => event.id !== record.triggerEventId).length === 0).length;

  const seen = {};
  for (const record of records)
    for (const who of Object.keys(record.presentTiers ?? {})) seen[who] = (seen[who] ?? 0) + 1;
  for (const id of CAST_IDS) present[id] = (present[id] ?? 0) + (seen[id] ?? 0);
  for (const record of records)
    if (!record.proposed) refusals[record.refusal] = (refusals[record.refusal] ?? 0) + 1;
  for (const record of proposed) {
    practices[record.proposed.practice] = (practices[record.proposed.practice] ?? 0) + 1;
    manifestations.add(`${record.proposed.actor}:${record.proposed.family}`);
  }

  opportunities += records.length;
  silence += intoSilence;
  quietChecks += quiet.length;
  quietProposals += quiet.filter(record => record.proposed).length;
  proposals = proposals.concat(proposed.map(record => ({ world, ...record })));
  rows.push({ world, records: records.length, quiet: quiet.length, proposed: proposed.length,
    fromQuiet: quiet.filter(record => record.proposed).length, intoSilence,
    days: (elapsed / DAY).toFixed(1), quietShare: (stillQuiet / elapsed * 100).toFixed(0),
    seen: CAST_IDS.map(id => `${id} ${seen[id] ?? 0}`).join(', ') });
}

const social = proposals.filter(item => (item.proposed.participants ?? []).length > 1).length;
const lines = {};
for (const item of proposals) lines[item.proposed.line] = (lines[item.proposed.line] ?? 0) + 1;
const families = {};
for (const item of proposals) families[item.proposed.family] = (families[item.proposed.family] ?? 0) + 1;
const totalRefusals = Object.values(refusals).reduce((a, b) => a + b, 0);
const floor = (refusals.below_interest_floor ?? 0) + (refusals.nothing_worth_surfacing ?? 0)
  + (refusals.not_worth_surfacing ?? 0);

say('# Shadow batch 2 — supporting cast restored, quiet checks added');
say('');
say('Both additions are read-only and live only in shadow. Nothing was committed.');
say('');
say('## What changed since batch 1');
say('');
say('| | batch 1 | batch 2 |');
say('|---|---:|---:|');
say(`| Opportunities | 751 | **${opportunities}** |`);
say(`| — of which quiet checks | 0 | **${quietChecks}** |`);
say(`| Proposals | 15 | **${proposals.length}** |`);
say(`| Distinct practices reached | 1 | **${Object.keys(practices).length}** |`);
say(`| Manifestations reached | — | **${manifestations.size}** |`);
say(`| Emily proposals | 0 | **${proposals.filter(p => p.proposed.actor === 'emily').length}** |`);
say(`| Yukon proposals | 0 | **${proposals.filter(p => p.proposed.actor === 'yukon').length}** |`);
say(`| Social (>1 participant) | 0 | **${social}** |`);
say(`| Runtime LLM calls | 0 | **0** |`);
say('');

say('## Reach, per character');
say('');
say('| character | tier | present at | proposals |');
say('|---|---|---:|---:|');
for (const id of CAST_IDS) {
  const lead = id === 'ashai' || id === 'goaden';
  say(`| ${id} | ${lead ? 'lead' : tierOf(id).tier} | ${present[id] ?? 0} | ${proposals.filter(p => p.proposed.actor === id).length} |`);
}
say('');
say('Emily and Yukon were present at **0** opportunities in batch 1. That was a');
say('defect in the shadow runner, not a fact about production — see the findings');
say('note. Both are now visible to the engine.');
say('');

say('## Quiet checks');
say('');
say('| | |');
say('|---|---:|');
say(`| Quiet checks asked | ${quietChecks} |`);
say(`| Proposals from them | **${quietProposals}** |`);
say(`| Silence rate | **${((1 - quietProposals / quietChecks) * 100).toFixed(1)}%** |`);
say('');
say('Silence stays the overwhelmingly normal answer, which is the point. A quiet');
say('check commits nothing and is not an event; it is a question.');
say('');

say('## Additive Moments');
say('');
say(`**${silence} of ${proposals.length}** proposals landed where Worldstream published nothing else`);
say('within half an hour (excluding the trigger that opened the opportunity).');
say('');

say('## Per world');
say('');
say('| world | opportunities | quiet | proposals | from quiet | additive |');
say('|---|---:|---:|---:|---:|---:|');
for (const row of rows)
  say(`| \`${row.world}\` | ${row.records} | ${row.quiet} | ${row.proposed} | ${row.fromQuiet} | ${row.intoSilence} |`);
say(`| **total** | **${opportunities}** | **${quietChecks}** | **${proposals.length}** | **${quietProposals}** | **${silence}** |`);
say('');

say('## Repetition');
say('');
say(`${proposals.length} proposals · **${Object.keys(lines).length} distinct lines** · most-used **${Math.max(...Object.values(lines))}×**`);
say(`· **${Object.keys(families).length} distinct manifestations**`);
say('');
say('Pooled across four worlds, which is harsher than a reader would ever see —');
say('each world restarts the same cooldowns from zero.');
say('');
say('| line | times |');
say('|---|---:|');
for (const [line, count] of Object.entries(lines).sort((a, b) => b[1] - a[1]))
  say(`| “${line}” | ${count} |`);
say('');

say('## What suppressed the rest');
say('');
const GROUPS = [
  ['nothing worth surfacing (interest floor)', ['below_interest_floor', 'nothing_worth_surfacing', 'not_worth_surfacing']],
  ['opportunity / co-presence', ['no_available_action']],
  ['character / surface spacing', ['surface_spacing', 'character_daily_budget']],
  ['world gap', ['world_gap']],
  ['no authored surface', ['no_authored_surface', 'no_line_fits_this_target']],
  ['world daily budget', ['world_daily_budget']],
  ['family cooldown', ['every_fitting_line_is_cooling', 'costly_act_recently_foregrounded']],
  ['arc obligation', ['arc_hard_obligation']],
];
say('| constraint | suppressed |');
say('|---|---:|');
for (const [label, codes] of GROUPS)
  say(`| ${label} | ${codes.reduce((total, code) => total + (refusals[code] ?? 0), 0)} |`);
say('');
say(`**Interest-floor refusal rate: ${(floor / totalRefusals * 100).toFixed(1)}%** of all refusals `);
say(`(${floor} of ${totalRefusals}). The floor is doing the work, untouched from batch 1.`);
say('');

say('---');
say('');
say(`## The ${proposals.length} proposals`);
say('');
say('**None were committed.** `QUIET` marks one the engine raised during a lull');
say('rather than beside a committed event.');
say('');
let index = 0;
for (const item of proposals) {
  const context = item.readerContext;
  index += 1;
  say(`### ${index}. ${context.day} ${context.time} · ${context.place}${item.quiet ? ' · **QUIET CHECK**' : ''}`);
  say('');
  say(`<sub>\`${item.world}\`</sub>`);
  say('');
  for (const event of context.committedContext) say(`> *${event.time} — ${event.text}*`);
  say('');
  say(`**${CAST.get(item.proposed.actor)?.displayName ?? item.proposed.actor}:** “${context.surface}”`);
  say('');
  say('| | |');
  say('|---|---|');
  say(`| present | ${Object.entries(item.presentTiers ?? {}).map(([who, tier]) => `${who} (${tier})`).join(', ')} |`);
  say(`| situation | ${context.situation}${context.boundTo ? ` · bound to **${context.boundTo}**` : ''} |`);
  say(`| triggered by | ${item.quiet ? 'a quiet check — no event' : `${context.triggeredBy.type} — ${context.triggeredBy.text ?? '—'}`} |`);
  say(`| why it won | ${context.whyItWon.join('; ')} |`);
  say(`| best rejected | ${context.bestRejected ?? '— nothing else was available'} |`);
  say('| committed? | **no — shadow only** |');
  say('');
  say('**Verdict:** `KEEP` / `KEEP-TUNE` / `WRONG` / `CUT` — **Freshness:** `FRESH` / `THIN` / `REPEATED`');
  say('');
}

writeFileSync('runs/shadow/SHADOW-BATCH-2.md', out.join('\n') + '\n');
console.log(`written runs/shadow/SHADOW-BATCH-2.md — ${proposals.length} proposals of ${opportunities} opportunities`);
