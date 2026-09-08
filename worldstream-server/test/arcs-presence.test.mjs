import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCS, ARC_RULES, initialArcs, resolveArcAction } from '../src/arcs.mjs';

// A stage that names somebody in a place may only be told while they are in
// that place.
//
// The bug this pins: `ink_admirer`'s first sign reads "The small drifting
// lintel design followed Ashai three shelves at Enchanted Ink", and it was
// scheduled on the clock alone. It fired at 14:30 and reported her browsing the
// shop two minutes after the world had her begin training at MI6. The clock was
// teleporting her.
//
// World signs stay free to fire with nobody present — most arcs are the world
// doing something, not a character being somewhere.

const STAGE = ARCS.ink_admirer.stages.find(item => item.key === 'follows');
const DUE = Date.parse('2026-09-08T13:30:00Z');

/** A running ink_admirer arc, its first sign due now, and Ashai wherever we say. */
function situation({ location, area = 'venue', activity = 'unhurried_time', waits = 0 }) {
  const instance = {
    id: 'arc:test', arcId: 'ink_admirer', token: 'tok', status: 'running',
    stageIndex: 0, openedAt: DUE - 86_400_000, openEventId: 'evt:open',
    seen: [], eventIds: [], stageWaits: waits ? { follows: waits } : undefined,
  };
  const action = { id: 'a1', type: 'ARC_BEAT', dueAt: DUE, priority: 33,
    day: '2026-09-08', version: 1, arcId: 'ink_admirer', stage: 'follows', token: 'tok' };
  const arcs = {
    ...initialArcs(), activeId: instance.id, instances: { [instance.id]: instance },
    issued: { a1: { consumed: false, sourceEventId: 'evt:src',
      shape: { type: 'ARC_BEAT', dueAt: DUE, priority: 33, day: '2026-09-08',
        version: 1, arcId: 'ink_admirer', stage: 'follows', token: 'tok' } } },
  };
  const state = { arcs, characters: { ashai: { id: 'ashai', location, area, activity } } };
  const published = [];
  const skipped = [];
  let saved = null;
  const ctx = {
    state, action, now: DUE, id: 'evt:new',
    event: { causedBy: [] },
    ops: {
      publish: text => published.push(text),
      skip: reason => skipped.push(reason),
      setArcs: value => { saved = value; state.arcs = value; },
    },
  };
  return { ctx, published, skipped, instance, get saved() { return saved; } };
}

test('the sign is not told while she is somewhere else', () => {
  const world = situation({ location: 'mi6', area: 'training', activity: 'training' });
  const handled = resolveArcAction(world.ctx);
  assert.equal(handled, true, 'the action is still owned and answered');
  assert.deepEqual(world.published, [], 'nothing may be published about a shop she is not in');
  assert.match(world.skipped[0] ?? '', /ashai is not at enchanted_ink/i);
  const after = world.saved.instances['arc:test'];
  assert.equal(after.stageIndex, 0, 'the sign is not consumed; it waits for her');
  assert.equal(after.stageWaits.follows, 1);
});

test('the sign is told when she is actually in the shop', () => {
  const world = situation({ location: 'enchanted_ink', area: 'venue' });
  resolveArcAction(world.ctx);
  assert.equal(world.published.length, 1);
  assert.equal(world.published[0], STAGE.text);
  assert.equal(world.saved.instances['arc:test'].stageIndex, 1, 'the arc moves on');
});

test('a visit that never happens skips the sign rather than contradicting the world', () => {
  const world = situation({ location: 'mi6', area: 'training', activity: 'training',
    waits: ARC_RULES.presenceAttempts - 1 });
  resolveArcAction(world.ctx);
  assert.deepEqual(world.published, [], 'still nothing published');
  assert.match(world.skipped[0] ?? '', /never came to enchanted_ink/i);
  const after = world.saved.instances['arc:test'];
  assert.equal(after.stageIndex, 1, 'the arc gives up on this sign and continues');
  assert.ok(after.seen.includes('follows'), 'the skipped sign is recorded as seen, not retried forever');
});

test('travelling or asleep is not being there', () => {
  for (const actor of [{ location: 'enchanted_ink', area: 'venue', activity: 'sleeping' },
    { location: 'enchanted_ink', area: 'venue', activity: 'unhurried_time', journey: true }]) {
    const world = situation(actor);
    if (actor.journey) world.ctx.state.characters.ashai.journey = { to: 'mi6' };
    resolveArcAction(world.ctx);
    assert.deepEqual(world.published, [], `should not publish while ${actor.activity}/journeying`);
  }
});

test('world signs still fire with nobody present', () => {
  // Every other stage of this arc, and every stage of every other arc, declares
  // no `needs` — the guard must not quietly gate the whole system.
  const gated = [];
  for (const [id, arc] of Object.entries(ARCS)) {
    for (const stage of arc.stages ?? []) if (stage.needs) gated.push(`${id}/${stage.key}`);
  }
  assert.deepEqual(gated, ['ink_admirer/follows', 'ink_admirer/stranger'],
    'only stages that name somebody in a place should be gated');
});

test('a stage that happens elsewhere is guarded, and filed, at its own location', () => {
  // `stranger` puts Ashai at the Silver Spoon while the arc lives at the Ink.
  const stage = ARCS.ink_admirer.stages.find(item => item.key === 'stranger');
  assert.equal(stage.location, 'cafe', 'the stage carries where it happens');
  assert.equal(stage.needs, 'ashai');
  assert.notEqual(stage.location, ARCS.ink_admirer.location,
    "which is deliberately not the arc's own location");
});
