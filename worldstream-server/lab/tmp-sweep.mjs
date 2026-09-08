import { runWorld } from './harness/run.mjs';
import { MOMENT_RULES } from './engine/engine.mjs';
console.log('cooldown  chosen  shown  years  moments');
for (const d of [0, 1, 18, 60, 365]) {
  const r = runWorld({ days: 90, rules: { ...MOMENT_RULES, costlyActionSurfaceCooldownDays: d } });
  console.log(String(d).padStart(8), String(r.actions.filter(a=>a.action==='use_fade').length).padStart(7),
    String(r.moments.filter(m=>m.action==='use_fade').length).padStart(6),
    String(r.lifespan.emily ?? 0).padStart(6), String(r.moments.length).padStart(8));
}
