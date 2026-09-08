import { openWorld } from '../../src/world.mjs';
import { atLondon, londonDate } from '../../src/time.mjs';
const S = atLondon('2026-03-02','00:00');
const w = openWorld({dbPath:':memory:', startMs:S});
let m=S; const t=S+120*86_400_000;
while(m<t) m=w.advance(Math.min(t,m+6*3_600_000)).resolvedThrough;
const ev = w.db.prepare('SELECT semantic_json FROM events ORDER BY seq').all().map(r=>JSON.parse(r.semantic_json));
w.close();
const hits = ev.filter(e=>JSON.stringify(e.payload?.lines??'').includes('fucking call'));
// "The scanners have been going all week" is a claim about arcane / MEU activity.
const SCANNERY = e => ['ARCANE_SURGE','MINOR_ANOMALY','INCIDENT','UNEASE'].includes(e.type)
  || ['arcane_surge','arcane_signature','corridor_light','meu_handheld'].includes(e.payload?.notice ?? e.payload?.kind);
console.log('date        concern  arcane-ish events in the preceding 7 days   verdict');
for (const h of hits) {
  const week = ev.filter(e => e.occurredAt < h.occurredAt && e.occurredAt >= h.occurredAt - 7*86_400_000 && SCANNERY(e));
  const kinds = [...new Set(week.map(e=>e.payload?.notice ?? e.payload?.kind ?? e.type))];
  console.log(londonDate(h.occurredAt),
    String(h.payload?.concern ?? '?').padStart(6),
    String(week.length).padStart(6), '  ', (kinds.join(', ')||'—').padEnd(38),
    week.length === 0 ? 'CLAIM UNSUPPORTED' : 'supported');
}
console.log('\n--- how many distinct exchanges does `strained` ever use? ---');
const strained = ev.filter(e=>e.type==='CONVERSATION' && e.payload?.mood==='strained');
const shapes = new Map();
for (const e of strained) { const k = e.payload.lines[0].text; shapes.set(k,(shapes.get(k)??0)+1); }
console.log('strained conversations in 120 days:', strained.length);
for (const [k,n] of [...shapes].sort((a,b)=>b[1]-a[1])) console.log(`   ${String(n).padStart(3)}×  "${k.slice(0,70)}"`);
