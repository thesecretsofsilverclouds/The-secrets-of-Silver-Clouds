import { runWorld } from './run.mjs';
import { MOMENT_RULES } from '../engine/engine.mjs';

// The signature-line cooldown is an editorial dial, not a technical one, so it
// is presented as a trade rather than chosen here. Longer means every moment a
// reader meets is a first; shorter means more moments and some familiar wording.
console.log('signature  moments  /day  distinct-lines  max-repeat  manifestations');
for (const signatureLineCooldownDays of [7, 14, 21, 30, 40, 60]) {
  const run = runWorld({ days: 90, rules: { ...MOMENT_RULES, signatureLineCooldownDays } });
  const counts = run.moments.reduce((m, x) => (m[x.line] = (m[x.line] ?? 0) + 1, m), {});
  const values = Object.values(counts);
  console.log(
    String(signatureLineCooldownDays).padStart(9),
    String(run.moments.length).padStart(8),
    (run.moments.length / 90).toFixed(2).padStart(6),
    String(Object.keys(counts).length).padStart(15),
    String(values.length ? Math.max(...values) : 0).padStart(11),
    String(new Set(run.moments.map(m => m.family)).size).padStart(15));
}
