import { openWorld } from '../../src/world.mjs';
import { atLondon, londonDate } from '../../src/time.mjs';
const START = atLondon('2026-03-02','00:00');
const w = openWorld({dbPath:':memory:', startMs:START});
let mark=START; const target=START+30*86_400_000;
const t0=Date.now();
while(mark<target){const r=w.advance(Math.min(target,mark+6*3_600_000));mark=r.resolvedThrough;}
const snap=w.semanticSnapshot();
console.log('30 days:', Date.now()-t0,'ms, events:',snap.events.length);
const byType={}, byLoc={}, byArea={};
for(const e of snap.events){byType[e.type]=(byType[e.type]||0)+1;byLoc[e.location]=(byLoc[e.location]||0)+1;if(e.area)byArea[e.location+'/'+e.area]=(byArea[e.location+'/'+e.area]||0)+1;}
const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
console.log('\nlocations:',JSON.stringify(top(byLoc)));
console.log('\nareas:',JSON.stringify(top(byArea).slice(0,14)));
console.log('\ntop event types:',JSON.stringify(top(byType).slice(0,24)));
console.log('\npublic events:',snap.events.filter(e=>e.visibility==='public').length);
console.log('emily mentions:',snap.events.filter(e=>JSON.stringify(e).toLowerCase().includes('emily')).length);
console.log('\nfacts:',Object.keys(snap.facts).length,'knowledge g/a:',snap.characters.goaden.knowledge.length,snap.characters.ashai.knowledge.length);
w.close();
