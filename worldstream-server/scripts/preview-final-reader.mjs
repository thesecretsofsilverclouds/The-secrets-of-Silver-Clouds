// Disposable real-reader rehearsal. No saved world, provider, production route,
// or accelerated live world. Commands on stdin choose committed audit moments.
import { createInterface } from 'node:readline';
import { openWorld } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';
import { createApp } from '../server.mjs';

const start = atLondon(process.env.FINAL_READER_START || '2026-09-09', '00:00');
const end = start + 30 * 86_400_000;
const port = Number(process.env.FINAL_READER_PORT || 4325);
const probe = openWorld({ dbPath: ':memory:', startMs: start });
probe.advance(end);
const events = probe.semanticSnapshot().events;
const categories = {
  mundane: event => ['PIANO_BEGIN', 'MEAL_BEGIN', 'PRACTICE_BEGIN'].includes(event.type),
  travel: event => event.type === 'TRAVEL_DEPART',
  interaction: event => event.type === 'CONVERSATION',
  weather: event => event.type === 'WEATHER_CHANGE' && event.occurredAt > start + 86_400_000,
  background: event => event.type === 'OFFSCREEN_RESULT',
  authored: event => event.type === 'SCENE_BANK_BEAT',
  arc: event => event.type.startsWith('ARC_'),
  arc_completion: event => event.type === 'ARC_CONFRONTATION' && event.payload?.phase === 'complete',
};
const moments = Object.fromEntries(Object.entries(categories).map(([key, match]) => {
  const event = events.find(event => event.visibility === 'public' && match(event));
  return [key, event ? { at: event.occurredAt, eventId: event.id, type: event.type,
    description: event.publicDescription } : null];
}));
probe.close();
let source, clock;
function move(target) {
  if (!Number.isSafeInteger(target) || target < start || target > end) throw new RangeError('Use a moment within this thirty-day rehearsal');
  if (!source || target < clock) {
    source?.close(); source = openWorld({ dbPath: ':memory:', startMs: start });
  }
  source.advance(target); clock = target;
  const view = source.publicProjection();
  console.log(JSON.stringify({ at: new Date(clock).toISOString(),
    characters: view.characters.map(({ id, location, activity }) => ({ id, location, activity })),
    events: view.events.slice(0, 3).map(({ id, type, description }) => ({ id, type, description })) }));
}
move(moments.authored?.at ?? start + 12 * 3_600_000);
const world = new Proxy({}, { get(_target, key) {
  if (key === 'advance') return () => {};
  const value = source[key]; return typeof value === 'function' ? value.bind(source) : value;
} });
const server = createApp({ world, cinematicClient: null,
  cinematicOptions: { enabled: false }, now: () => clock });
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({
  url: `http://127.0.0.1:${port}/worldstream/app/`, moments,
  commands: 'category name, ISO timestamp, or quit; backward moves reset only this disposable in-memory rehearsal',
} )));
const input = createInterface({ input: process.stdin });
const close = () => { input.close(); server.closeAllConnections(); server.close(() => source.close()); };
input.on('line', line => {
  try {
    if (line.trim() === 'quit') return close();
    const moment = moments[line.trim()];
    move(moment?.at ?? Date.parse(line.trim()));
  } catch (error) { console.error(error.message); }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, close);
