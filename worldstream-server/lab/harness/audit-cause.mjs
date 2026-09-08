import { openWorld } from '../../src/world.mjs';
import { atLondon, londonDate } from '../../src/time.mjs';
import { knowsFact } from '../../src/fixture.mjs';
const S=atLondon('2026-03-02','00:00');
const w=openWorld({dbPath:':memory:',startMs:S});
let m=S; const t=S+120*86_400_000;
// Sample state at each evening conversation slot.
const rows=[];
while(m<t){
  m=w.advance(Math.min(t,m+3_600_000)).resolvedThrough;
  const st=JSON.parse(w.db.prepare('SELECT state_json FROM world_state WHERE id=1').get().state_json);
  const now=m;
  const WITHHOLDABLE=new Set(['duty_callout','incident']);
  const facts=Object.values(st.facts).filter(f=>WITHHOLDABLE.has(f.kind));
  const live=facts.filter(f=>f.validUntil===null||now<f.validUntil);
  const asym=live.filter(f=>knowsFact(st.characters.goaden,f.key,now)&&!knowsFact(st.characters.ashai,f.key,now));
  const rel=st.relationships.find(r=>r.from==='ashai'&&r.to==='goaden');
  rows.push({day:londonDate(now), factsTotal:facts.length, live:live.length, asym:asym.length,
    carried:st.pressure?.carried??0, arcane:st.factions?.arcane, concern:rel?.concern??0});
}
w.close();
const any=k=>rows.filter(r=>r[k]).length;
console.log('samples:',rows.length);
console.log('  withholdable facts ever created :', rows.some(r=>r.factsTotal>0)? Math.max(...rows.map(r=>r.factsTotal)) : 0);
console.log('  samples with a LIVE such fact   :', any('live'));
console.log('  samples with ASYMMETRIC knowledge:', any('asym'), '   <-- the withholding clause');
console.log('  samples with carried >= 0.5     :', rows.filter(r=>r.carried>=0.5).length);
console.log('  samples with arcane high        :', rows.filter(r=>r.arcane==='high').length);
console.log('  samples with concern >= 2       :', rows.filter(r=>r.concern>=2).length);
console.log('  ALL THREE                       :', rows.filter(r=>r.asym&&(r.carried>=0.5||r.arcane==='high')&&r.concern>=2).length);
console.log('  pressure+concern only           :', rows.filter(r=>(r.carried>=0.5||r.arcane==='high')&&r.concern>=2).length);
