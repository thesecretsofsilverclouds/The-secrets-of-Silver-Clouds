import { openWorld } from '../../src/world.mjs';
import { atLondon } from '../../src/time.mjs';
const S = atLondon('2026-03-02','00:00');
const w = openWorld({dbPath:':memory:', startMs:S});
let m=S; const t=S+120*86_400_000;
while(m<t) m=w.advance(Math.min(t,m+6*3_600_000)).resolvedThrough;
const ev = w.db.prepare('SELECT semantic_json FROM events ORDER BY seq').all().map(r=>JSON.parse(r.semantic_json));
w.close();
const hits = ev.map((e,i)=>[e,i]).filter(([e])=>JSON.stringify(e.payload?.lines??'').includes('fucking call'));
console.log('occurrences of the line in 120 days:', hits.length);
for (const [e,i] of hits.slice(0,2)) {
  console.log('\n================ '+new Date(e.occurredAt).toISOString().slice(0,16)+'  '+e.type+'  mood='+e.payload?.mood);
  console.log('event id:', e.id);
  console.log('--- the archived exchange ---');
  for (const l of e.payload.lines) console.log(`   ${l.who} (${l.expression}): ${l.text}`);
  console.log('--- 8 committed events immediately before ---');
  for (const p of ev.slice(Math.max(0,i-8), i))
    console.log(`   ${new Date(p.occurredAt).toISOString().slice(5,16)} ${p.type.padEnd(22)} ${(p.publicDescription??'').slice(0,105)}`);
}
