import { openWorld } from '../../src/world.mjs';
import { atLondon } from '../../src/time.mjs';

const START = atLondon('2026-03-02', '00:00');
const t0 = Date.now();
const world = openWorld({ dbPath: ':memory:', startMs: START });
let watermark = START, processed = 0;
const target = START + 3 * 86_400_000;
while (watermark < target) {
  const r = world.advance(Math.min(target, watermark + 6 * 3_600_000));
  processed += r.processedActions; watermark = r.resolvedThrough;
}
const snap = world.semanticSnapshot();
console.log('processed actions:', processed);
console.log('events:', snap.events.length);
console.log('ms:', Date.now() - t0);
console.log('sample public:', snap.events.filter(e => e.visibility === 'public').slice(-4).map(e => `${new Date(e.occurredAt).toISOString().slice(11,16)} ${e.type} :: ${e.publicDescription}`));
world.close();
