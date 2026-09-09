// A disposable, in-memory world for reading a real committed bank scene.
// No live database, model generation, clock fast-forward, or network provider.
import { openWorld } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { cinematicConfig } from '../src/cinematics.mjs';
import { createApp } from '../server.mjs';

const wanted = process.argv[2] || 'P1';
const port = Number(process.env.SCENE_REHEARSAL_PORT || 4324);
const startMs = atLondon('2026-09-04', '00:00');
const rehearsal = openWorld({ dbPath: ':memory:', startMs });
let found = null;
for (let now = startMs + 3_600_000; now <= startMs + 200 * 86_400_000; now += 3_600_000) {
  rehearsal.advance(now);
  found = rehearsal.presentationSnapshot().sceneBank?.completed?.[wanted];
  if (found) break;
}
if (!found) { rehearsal.close(); throw new Error(`No real ${wanted} scene reached in 200 days`); }
// Replay to the precise recorded scene time, retaining all preceding causes.
rehearsal.close();
const source = openWorld({ dbPath: ':memory:', startMs });
source.advance(found.at);
const world = new Proxy(source, { get(target, key) {
  if (key === 'advance') return () => {};
  const value = Reflect.get(target, key);
  return typeof value === 'function' ? value.bind(target) : value;
} });
const server = createApp({ world, cinematicClient: null,
  cinematicOptions: { ...cinematicConfig({}), enabled: false }, now: () => found.at });
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({
  url: `http://127.0.0.1:${port}/worldstream/app/`, scene: wanted,
  eventId: found.eventId, occurredAt: new Date(found.at).toISOString(), liveWorldUntouched: true,
} )));
server.on('close', () => source.close());
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(); server.closeAllConnections();
});
