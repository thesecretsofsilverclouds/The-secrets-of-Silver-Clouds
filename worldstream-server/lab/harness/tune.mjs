import { runWorld } from './run.mjs';
import { MOMENT_RULES } from '../engine/engine.mjs';

// The interest floor is the single number that decides how much of the world's
// life reaches a reader, so it is measured rather than chosen. Sweeping it
// against a real thirty-day run answers the question the brief actually asks:
// not "how many moments can this produce" but "where does it stop producing
// ones worth reading".

const sweep = [3, 4, 5, 6, 7, 8, 9, 10, 12];
console.log('floor  moments  /day  distinct  behaviours  actors  top-share  silence%');
for (const interestFloor of sweep) {
  const run = runWorld({ days: 30, rules: { ...MOMENT_RULES, interestFloor } });
  const manifestations = new Set(run.moments.map(m => m.family));
  const behaviours = new Set(run.moments.map(m => m.behaviour));
  const byActor = {};
  const byBehaviour = {};
  for (const m of run.moments) {
    byActor[m.actor] = (byActor[m.actor] ?? 0) + 1;
    byBehaviour[m.behaviour] = (byBehaviour[m.behaviour] ?? 0) + 1;
  }
  const top = Math.max(0, ...Object.values(byBehaviour));
  const share = run.moments.length ? top / run.moments.length : 0;
  const silence = (run.stats.refusals.nothing_worth_surfacing ?? 0) / run.stats.evaluations;
  console.log(
    String(interestFloor).padStart(5),
    String(run.moments.length).padStart(8),
    (run.moments.length / 30).toFixed(2).padStart(6),
    String(manifestations.size).padStart(9),
    String(behaviours.size).padStart(11),
    String(Object.keys(byActor).length).padStart(7),
    `${(share * 100).toFixed(0)}%`.padStart(10),
    `${(silence * 100).toFixed(0)}%`.padStart(9));
}
