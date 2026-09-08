import { openWorld } from '../../src/world.mjs';
import { atLondon } from '../../src/time.mjs';
const START=atLondon('2026-03-02','00:00');
const w=openWorld({dbPath:':memory:',startMs:START});
let m=START;const t=START+30*86_400_000;
while(m<t){m=w.advance(Math.min(t,m+6*3_600_000)).resolvedThrough;}
const snap=w.semanticSnapshot();
const hits=snap.events.filter(e=>JSON.stringify(e).toLowerCase().includes('emily'));
for(const e of hits.slice(0,6)) console.log(`[${e.type}] ${e.location}/${e.area} vis=${e.visibility}\n  ${e.publicDescription??''}\n  payload:${JSON.stringify(e.payload).slice(0,420)}\n`);
console.log('types:',JSON.stringify([...new Set(hits.map(e=>e.type))]));
console.log('\n--- plaza events ---');
for(const e of snap.events.filter(e=>e.location==='big_ben_plaza').slice(0,8)) console.log(`[${e.type}] ${e.publicDescription??JSON.stringify(e.payload).slice(0,200)}`);
w.close();
