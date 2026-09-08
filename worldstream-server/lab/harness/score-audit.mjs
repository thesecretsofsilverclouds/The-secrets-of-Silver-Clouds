import { openWorld } from '../../src/world.mjs';
import { atLondon, londonDate } from '../../src/time.mjs';
import { daypart } from '../../src/sky.mjs';
import { scoreMood } from '../../public/score-mood.js';

// What the score actually plays, measured against real world state rather than
// against the intent of the mood table. Sampled every 10 minutes of a 30-day
// world, which is roughly how often a reader's page refreshes its projection.
const START = atLondon('2026-03-02', '00:00');
const DAYS = 30;
const world = openWorld({ dbPath: ':memory:', startMs: START });
const target = START + DAYS * 86_400_000;
let mark = START;
while (mark < target) mark = world.advance(Math.min(target, mark + 6 * 3_600_000)).resolvedThrough;

const db = world.db;
const events = db.prepare('SELECT semantic_json FROM events ORDER BY seq').all()
  .map(r => JSON.parse(r.semantic_json));
world.close();

// Reconstruct the projection the page would have held at each sample point:
// activities from the last activity event per character, factions from the last
// FACTION_STATUS/day roll.
const MOODS = { night: 3, play: 4, pressure: 2, ordinary: 5 };
const counts = {}; const runs = []; let last = null, runLen = 0;
let idx = 0;
const state = { characters: { goaden: {}, ashai: {} }, factions: {} };

for (let t = START; t < target; t += 10 * 60_000) {
  while (idx < events.length && events[idx].occurredAt <= t) {
    const e = events[idx++];
    for (const who of e.participants ?? []) {
      const change = (e.changes ?? []).find(c => c.entity === 'character' && c.id === who && c.field === 'activity');
      if (change && 'after' in change) state.characters[who] = { id: who, activity: change.after };
    }
    for (const c of e.changes ?? [])
      if (c.entity === 'world' && c.field === 'factions' && Array.isArray(c.path))
        state.factions[c.path[0]] = c.after;
      else if (c.entity === 'world' && c.field === 'factions' && 'after' in c && !c.path)
        Object.assign(state.factions, c.after);
  }
  const projection = {
    characters: Object.values(state.characters).filter(x => x.id),
    factions: state.factions,
    time: { daypart: daypart(t) },
  };
  const mood = scoreMood(projection);
  counts[mood] = (counts[mood] ?? 0) + 1;
  if (mood === last) runLen += 1; else { if (last) runs.push({ mood: last, mins: runLen * 10 }); last = mood; runLen = 1; }
}
runs.push({ mood: last, mins: runLen * 10 });

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`Sampled every 10 min across ${DAYS} days — ${total} samples\n`);
console.log('mood        share    hours/30d   tracks   hours per track   longest unbroken stretch');
for (const [mood, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  const hours = (n * 10) / 60;
  const longest = Math.max(...runs.filter(r => r.mood === mood).map(r => r.mins));
  console.log(
    mood.padEnd(11),
    `${((n / total) * 100).toFixed(1)}%`.padStart(6),
    hours.toFixed(0).padStart(10),
    String(MOODS[mood] ?? 0).padStart(8),
    (hours / (MOODS[mood] ?? 1)).toFixed(1).padStart(16),
    `${(longest / 60).toFixed(1)} h`.padStart(24));
}
console.log('\nmood switches over 30 days:', runs.length,
  `(one every ${((DAYS * 24) / runs.length).toFixed(1)} h)`);
