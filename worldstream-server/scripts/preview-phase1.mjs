// Frozen author review, separate from every saved live world. Never generates AI.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openWorld } from '../src/world.mjs';
import { RULES_VERSION } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';
import { createApp } from '../server.mjs';
import { openCinematicStore } from '../src/cinematic-store.mjs';
import { CinematicService } from '../src/cinematic-service.mjs';
import { deterministicFallbackScene } from '../src/cinematics.mjs';
import { publicNarrativeBlock } from '../src/narrative.mjs';

const folder = new URL('../artifacts/phase1-review-v18/', import.meta.url);
const stateFile = new URL('snapshot-private.json', folder);
const projectionFile = new URL('public-projection.json', folder);
const reviewAt = atLondon('2026-10-08', '15:26');
if (!existsSync(stateFile) || !existsSync(projectionFile)) {
  if (RULES_VERSION !== 'canon-ambient-p183-v18') throw new Error('The Phase 1 snapshot must be created with v18 rules.');
  mkdirSync(folder, { recursive: true });
  const source = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-10-08', '00:00') });
  try {
    source.advance(reviewAt);
    writeFileSync(stateFile, JSON.stringify(source.semanticSnapshot()));
    writeFileSync(projectionFile, JSON.stringify(source.publicProjection()));
  } finally { source.close(); }
}
const snapshot = JSON.parse(readFileSync(stateFile, 'utf8'));
const projection = JSON.parse(readFileSync(projectionFile, 'utf8'));
const world = { advance() {}, semanticSnapshot: () => structuredClone(snapshot),
  publicProjection: () => ({ ...structuredClone(projection),
    narrative: publicNarrativeBlock(snapshot, reviewAt),
    worldStatus: 'PHASE 1 REVIEW · 8 October, 15:26 London · Completed Enchanted Ink appointment. Frozen example; live history is unchanged.' }) };
const store = openCinematicStore({ dbPath: ':memory:' });
const service = new CinematicService({ store, config: { enabled: false }, client: null, now: () => reviewAt });
const indexed = service.ingest(snapshot, { now: reviewAt });
for (const row of indexed.candidates.filter(row => row.packet.event.type === 'INK_APPOINTMENT_BOOKED')) {
  store.performCanonical(row.eventId, deterministicFallbackScene(row.packet, 'phase1_review'), { now: reviewAt, minSceneGapMs: 0 });
}
const server = createApp({ world, cinematicService: service, now: () => reviewAt });
server.listen(4320, '127.0.0.1', () => console.log('Phase 1 review: http://127.0.0.1:4320 · frozen example · no model calls'));
server.on('close', () => store.close());
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
