import { openWorld } from '../../src/world.mjs';
import { atLondon } from '../../src/time.mjs';
import { buildScenePacket, setupBeatFor } from '../../src/cinematics.mjs';

const S = atLondon('2026-03-02','00:00');
const w = openWorld({dbPath:':memory:', startMs:S});
let m=S; const t=S+120*86_400_000;
while(m<t) m=w.advance(Math.min(t,m+6*3_600_000)).resolvedThrough;
const snap = w.semanticSnapshot();
w.close();

const hits = snap.events.filter(e=>JSON.stringify(e.payload?.lines??'').includes('fucking call'));
console.log(`the gated exchange fires ${hits.length}× in 120 days\n`);

for (const event of hits) {
  const packet = buildScenePacket(event, snap);
  const setup = packet.event.setup;
  console.log('='.repeat(74));
  console.log(`${new Date(event.occurredAt).toISOString().slice(0,10)}  ${event.id}`);
  console.log('='.repeat(74));
  console.log('\n--- THE COMPLETE READER-VISIBLE SEQUENCE ---\n');
  if (setup) {
    console.log(`  ${setup.originTimeLabel}`);
    console.log(`  ${setup.originSnippet}\n`);
    console.log(`  ${'-'.repeat(66)}\n`);
  } else {
    console.log('  (no setup beat found)\n');
  }
  console.log(`  ${new Date(event.occurredAt).toISOString().slice(11,16)} · the lunch hall\n`);
  for (const l of event.payload.lines) {
    const who = l.who === 'ashai' ? 'Ashai' : 'Goaden';
    console.log(`  ${who} (${l.expression}):  ${l.text}`);
  }
  console.log(`\n  [setup selected by: ${setup?.selector ?? '—'} · origin ${setup?.originType ?? '—'} · relevance ${setup?.relevance ?? 'null (reserved)'}]`);
  console.log();
}
