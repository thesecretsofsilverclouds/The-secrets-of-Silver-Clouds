import { createHash } from 'node:crypto';
import { openWorld, semanticDigest } from '../../src/world.mjs';
import { atLondon } from '../../src/time.mjs';

export const PARITY_START = atLondon('2026-09-05', '00:00');
export const PARITY_DAYS = 7;

// What v29 and a v30 world with RHYTHM absent or disabled must agree on.
// RHYTHM_CHOOSE is private bookkeeping that v29 never had, so it is dropped and
// `seq` with it; INSTITUTION_NOTICE wording is seeded off RULES_VERSION and
// therefore legitimately differs across every release, so only its type, time
// and participants count. The pending queue differs by construction (the
// decision action and its `rhythm` slot tag) and state.rhythm is new.
export function parityView(snapshot) {
  const events = snapshot.events.filter(e => e.type !== 'RHYTHM_CHOOSE').map(({ seq, ...e }) =>
    e.type === 'INSTITUTION_NOTICE' ? { ...e, publicDescription: null } : e);
  const state = Object.fromEntries(Object.entries(snapshot).filter(([key]) =>
    !['world', 'events', 'pendingActions', 'rhythm'].includes(key)));
  return { events, state };
}
export const parityDigest = view => ({ events: semanticDigest(view.events), state: semanticDigest(view.state),
  eventCount: view.events.length });

export function runParityWorld(seed, { days = PARITY_DAYS, prepare = null } = {}) {
  const world = openWorld({ dbPath: ':memory:', seed, startMs: PARITY_START });
  try {
    if (prepare) prepare(world);
    world.advance(PARITY_START + days * 86_400_000);
    return world.semanticSnapshot();
  } finally { world.close(); }
}
export const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
