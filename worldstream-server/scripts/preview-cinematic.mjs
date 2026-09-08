// One controlled author rehearsal of a REAL committed event. This never changes
// the live world or runs a historical batch. A browser heartbeat is still required.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { openStartupWorld } from '../src/startup-world.mjs';
import { RULES_VERSION } from '../src/fixture.mjs';
import { openCinematicStore } from '../src/cinematic-store.mjs';
import { cinematicConfig, cinematicRecordForApi, openAICinematicClient, scoreCinematicEvent } from '../src/cinematics.mjs';
import { createApp } from '../server.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourcePath = join(root, 'data', `world-${RULES_VERSION}.sqlite`);
if (!existsSync(sourcePath)) throw new Error('No compatible saved world for rehearsal. A preview cannot create or migrate the canonical world.');
const source = openStartupWorld({ dbPath: sourcePath });
const canonical = source.semanticSnapshot();
source.close();
const selected = canonical.events.filter(event => event.visibility === 'public'
  && event.type === 'VENUE_SCENE' && scoreCinematicEvent(event).score >= 50).at(-1);
if (!selected) throw new Error('No suitable committed venue scene. Open the normal world first.');
const rehearsal = openWorld({ dbPath: ':memory:', seed: canonical.world.seed, startMs: canonical.meta.startMs });
rehearsal.advance(selected.occurredAt);
const frozen = rehearsal.semanticSnapshot(), projection = rehearsal.publicProjection();
const before = semanticDigest(frozen);
let wallStart = null; const previewStart = selected.occurredAt + (process.argv.includes('--offline') ? 60_000 : 1_000);
const now = () => { wallStart ??= Date.now(); return previewStart + (Date.now() - wallStart); };
// The connected test is separate so a transport-denied rehearsal remains in
// the audit trail; terminal production fallbacks are never silently retried.
const previewFile = process.argv.includes('--connected') ? 'worldstream-author-preview-connected.sqlite' : 'worldstream-author-preview.sqlite';
const store = openCinematicStore({ dbPath: join(root, 'data', previewFile) });
const config = { ...cinematicConfig({ ...process.env, WORLDSTREAM_CINEMATICS_ENABLED: 'true' }),
  ...(process.argv.includes('--offline') ? { enabled: false } : {}),
  maxCallsPerDay: 1, maxAttempts: 1, minSceneGapMs: 0, timeoutMs: 45_000 };
const client = config.enabled ? openAICinematicClient({ apiKey: process.env.OPENAI_API_KEY,
  model: config.model, maxOutputTokens: config.maxOutputTokens, timeoutMs: config.timeoutMs }) : null;
let callsThisRun = 0, usage = null, latencyMs = null;
const artifacts = join(root, 'artifacts');
mkdirSync(artifacts, { recursive: true });
function report() {
  const row = store.get(selected.id);
  const after = semanticDigest(rehearsal.semanticSnapshot());
  const value = { test: 'single committed-event author rehearsal', liveWorldUntouched: true,
    eventId: selected.id, eventTime: new Date(selected.occurredAt).toISOString(),
    callsThisRun, attempts: row?.attempts ?? 0, model: row?.model ?? config.model,
    latencyMs, usage, status: row?.status ?? 'waiting_for_viewer',
    failureReason: row?.failureReason ?? null,
    canonicalDigestBefore: before, canonicalDigestAfter: after,
    canonicalUnchanged: before === after, cinematic: cinematicRecordForApi(row),
    verdict: row?.status === 'performed' && before === after ? 'PASS' : row?.status === 'fallback' ? 'FAIL' : 'WAITING' };
  writeFileSync(join(artifacts, 'worldstream-live-test.json'), JSON.stringify(value, null, 2) + '\n');
  console.log(JSON.stringify({ status: value.status, verdict: value.verdict, callsThisRun, latencyMs, failureReason: value.failureReason }));
}
const wrapped = client ? async (packet, metadata) => {
  if (packet.event.id !== selected.id || callsThisRun >= 1) throw new Error('Rehearsal is limited to one selected event');
  callsThisRun++;
  const began = performance.now();
  try { const result = await client(packet, metadata); usage = result.usage; return result; }
  finally { latencyMs = Math.round(performance.now() - began); setImmediate(report); }
} : null;
const world = { advance() {}, semanticSnapshot: () => structuredClone(frozen),
  publicProjection: () => ({ ...structuredClone(projection),
    worldStatus: 'AUTHOR PREVIEW · Replaying a committed scene. The live world is unchanged.' }) };
const server = createApp({ world, cinematicStore: store, cinematicOptions: config, cinematicClient: wrapped, now });
server.listen(4318, '127.0.0.1', () => {
  console.log('Author preview: http://127.0.0.1:4318 · one call maximum, waits for a visible browser.');
  if (!client) console.log('Model calls disabled: canonical/cached preview only.');
});
server.on('close', () => { store.close(); rehearsal.close(); });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections(); });
