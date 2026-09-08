// Frozen author review of one real deterministic episode; no live save or model.
import { openWorld } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { createApp } from '../server.mjs';
import { openCinematicStore } from '../src/cinematic-store.mjs';
import { CinematicService } from '../src/cinematic-service.mjs';
import { deterministicFallbackScene } from '../src/cinematics.mjs';

const reviewAt = atLondon('2026-09-05', '15:10');
const source = openWorld({ dbPath:':memory:', startMs:atLondon('2026-09-04', '00:00') });
source.advance(reviewAt);
const snapshot = source.semanticSnapshot(), projection = source.publicProjection(); source.close();
const world = { advance() {}, semanticSnapshot:() => structuredClone(snapshot),
  publicProjection:() => ({ ...structuredClone(projection),
    worldStatus:'PHASE 2 REVIEW · 5 September, 15:10 London · The dispatch check has ended. Frozen example; live history is unchanged.' }) };
const store = openCinematicStore({ dbPath:':memory:' });
const service = new CinematicService({ store, config:{enabled:false}, client:null, now:() => reviewAt });
const indexed = service.ingest(snapshot, {now:reviewAt});
for (const row of indexed.candidates.filter(row => row.packet.event.type.startsWith('THREAD_'))) {
  store.performCanonical(row.eventId, deterministicFallbackScene(row.packet, 'phase2_review'), {now:reviewAt,minSceneGapMs:0});
}
const server = createApp({world,cinematicService:service,now:() => reviewAt});
server.listen(4321,'127.0.0.1',() => console.log('Phase 2 review: http://127.0.0.1:4321 · frozen episode · no model calls'));
server.on('close',() => store.close());
for (const signal of ['SIGINT','SIGTERM']) process.once(signal,() => {server.close();server.closeAllConnections();});
