import { openWorld } from '../../src/world.mjs';
import { atLondon, londonDate } from '../../src/time.mjs';
const S = atLondon('2026-03-02','00:00');
const w = openWorld({dbPath:':memory:', startMs:S});
let m=S; const t=S+120*86_400_000;
while(m<t) m=w.advance(Math.min(t,m+6*3_600_000)).resolvedThrough;
const ev = w.db.prepare('SELECT semantic_json FROM events ORDER BY seq').all().map(r=>JSON.parse(r.semantic_json));
w.close();
// Replay relationship state forward from the ledger.
const rel = { 'ashai->goaden': {concern:0,irritation:0,trust:2}, 'goaden->ashai': {concern:0,irritation:0,trust:2} };
console.log('date        a->g concern  irritation  trust   what the archived scene shows a newcomer');
for (const e of ev) {
  for (const c of e.changes ?? [])
    if (c.entity==='relationship' && 'after' in c && rel[c.id]) rel[c.id][c.field] = c.after;
  if (!JSON.stringify(e.payload?.lines??'').includes('fucking call')) continue;
  const r = rel['ashai->goaden'];
  console.log(londonDate(e.occurredAt), String(r.concern).padStart(11), String(r.irritation).padStart(11),
    String(r.trust).padStart(7), '  4 lines, no preceding beat, no "Earlier"');
}
// What visible escalation existed in the same evening that the scene could have used.
console.log('\n--- candidate "Earlier" beats on the day, involving Ashai, before the scene ---');
for (const e of ev) {
  if (!JSON.stringify(e.payload?.lines??'').includes('fucking call')) continue;
  const day = londonDate(e.occurredAt);
  const sameDay = ev.filter(p => londonDate(p.occurredAt)===day && p.occurredAt < e.occurredAt
    && p.visibility==='public' && p.publicDescription
    && (p.participants??[]).includes('ashai'));
  console.log(`\n${day}:`);
  for (const p of sameDay.slice(-3))
    console.log(`   ${new Date(p.occurredAt).toISOString().slice(11,16)} ${p.type.padEnd(16)} ${p.publicDescription.slice(0,120)}`);
}
