import { atLondon, londonDate } from '../../src/time.mjs';
import { factionsForDay, weatherForDay } from '../../src/fixture.mjs';

// Which clause of scoreMood's `pressure` test is firing, per day.
const SEED = 'silver-clouds-now-v1';
let day = '2026-03-02';
const hits = { mi6_elevated: 0, arcane_high: 0, order_active: 0, none: 0 };
const daysWithAny = [];
for (let i = 0; i < 30; i += 1) {
  const f = factionsForDay(day, SEED, weatherForDay(day, SEED));
  const fired = [];
  if (f.mi6 === 'elevated') { hits.mi6_elevated += 1; fired.push('mi6'); }
  if (f.arcane === 'high') { hits.arcane_high += 1; fired.push('arcane'); }
  if (f.order === 'active_in_city') { hits.order_active += 1; fired.push('order'); }
  if (!fired.length) hits.none += 1; else daysWithAny.push(`${day} ${fired.join('+')}`);
  day = new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}
console.log('Which clause puts the score into `pressure`, over 30 days:\n');
for (const [k, v] of Object.entries(hits)) console.log(' ', k.padEnd(14), `${v} days`.padStart(8), `${((v / 30) * 100).toFixed(0)}%`.padStart(6));
console.log('\ndays in pressure at all:', daysWithAny.length, `of 30 (${((daysWithAny.length / 30) * 100).toFixed(0)}%)`);
console.log('\n' + daysWithAny.join('\n'));

// Per-track exposure, assuming even rotation inside each mood.
const MOODS = {
  night: ['midnight-static-loop', 'floating-night', 'little-star'],
  play: ['arcade-after-dark', 'neon-arcade-hustle', 'dunk-no-jutsu', 'touchscreen-drift'],
  pressure: ['glitch-pocket-riot', 'tiny-rebel'],
  ordinary: ['tiny-rebel', 'legends-of-dawn', 'oracle', 'magic', 'silver-clouds'],
};
const HOURS = { ordinary: 239, night: 238, pressure: 216, play: 28 };
const exposure = {};
for (const [mood, tracks] of Object.entries(MOODS))
  for (const t of tracks) exposure[t] = (exposure[t] ?? 0) + HOURS[mood] / tracks.length;
console.log('\nHours each track plays across 30 days, if rotation is even:\n');
const sorted = Object.entries(exposure).sort((a, b) => b[1] - a[1]);
for (const [track, hours] of sorted)
  console.log(' ', track.padEnd(22), hours.toFixed(0).padStart(5), 'h', ' '.repeat(1) + '#'.repeat(Math.round(hours / 4)));
console.log(`\nratio, most-played to least: ${(sorted[0][1] / sorted.at(-1)[1]).toFixed(0)}x`);
