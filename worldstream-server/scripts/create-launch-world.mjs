import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStartupWorld } from '../src/startup-world.mjs';
import { londonDate, atLondon } from '../src/time.mjs';

// Create a clean launch-candidate world from the current rules.
//
//     node worldstream-server/scripts/create-launch-world.mjs [dbPath] [hours]
//
// Why a new world rather than the review one: a saved history is a record of
// what happened under the rules in force at the time, and the review world's
// history contains beats the corrected rules would now refuse — Ashai browsing
// Enchanted Ink while she was training at MI6. Those cannot be edited out
// honestly; a world is its history. So the launch candidate starts clean and
// the mistake never exists in it.
//
// This **never** touches an existing world. It refuses rather than overwrite,
// and the review world at data/world-*.sqlite is not opened at all.

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..');
const target = resolve(process.argv[2] ?? join(SERVER, 'data', 'launch-candidate', 'world.sqlite'));
const hours = Number(process.argv[3] ?? 24);

if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
  console.error('hours must be a positive number up to 168');
  process.exit(1);
}
if (existsSync(target)) {
  console.error(`refusing to touch an existing world: ${target}`);
  console.error('delete it deliberately, or pass a different path.');
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });

// A world epoch must be London midnight — `createFixture` enforces it, and it
// is what makes a day of history a *day* rather than an arbitrary span. So the
// requested hours are rounded back to the midnight that covers them: 24 hours
// means "from midnight yesterday", which yields a full day plus today so far.
const now = Date.now();
const daysBack = Math.max(1, Math.ceil(hours / 24));
const startDay = londonDate(now - daysBack * 86_400_000);
const startMs = atLondon(startDay, '00:00');

console.log(`creating   ${target}`);
console.log(`epoch      ${startDay} 00:00 London  (${((now - startMs) / 3_600_000).toFixed(1)}h of history)`);

const world = openStartupWorld({ dbPath: target, startMs });

// Advance in steps rather than one jump: the same path a live world takes, so
// scheduled actions resolve in order instead of all landing on one instant.
const step = 15 * 60_000;
let cursor = startMs;
let ticks = 0;
while (cursor < now) {
  cursor = Math.min(cursor + step, now);
  world.advance(cursor);
  ticks += 1;
}

const snapshot = world.semanticSnapshot();
const projection = world.publicProjection();
console.log(`advanced   ${ticks} ticks to ${new Date(cursor).toISOString()}`);
console.log(`events     ${snapshot.events.length} committed, ${projection.events?.length ?? 0} public`);
console.log(`day        ${londonDate(cursor)}`);
console.log(`\nrun it with:  npm run dev -- --world ${target}`);
