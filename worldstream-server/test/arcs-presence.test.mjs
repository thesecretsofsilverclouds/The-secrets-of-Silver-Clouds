import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCS, ARC_RULES, ARC_STAGING, ARC_STAGING_GATES, initialArcs, arcDayActions, resolveArcAction } from '../src/arcs.mjs';
import { createFixture } from '../src/fixture.mjs';
import { atLondon } from '../src/time.mjs';
import { SIDE_CHARACTERS, LEGION_CAST, OUTSIDE_CAST } from '../src/cast.mjs';

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

test('a location-bound opening uses an existing planned visit without requiring an impossible fixed minute', () => {
  const state = { arcs: { ...initialArcs(), exhausted: Object.keys(ARCS).filter(id => id !== 'ink_admirer') } };
  const input = { state, day: '2026-09-08', now: DUE - 10 * 60 * 60 * 1000, seed: 'opening', carried: 0.6 };
  assert.deepEqual(arcDayActions({ ...input, scheduled: [] }), [], 'an absent premise cannot waste the daily draw');
  const dueAt = DUE + 60 * 60 * 1000;
  const scheduled = [{ type: 'CITY_ACTIVITY_BEGIN', location: 'enchanted_ink', actors: ['goaden', 'ashai'], dueAt, duration: 55 }];
  const [action] = arcDayActions({ ...input, scheduled });
  assert.equal(action.arcId, 'ink_admirer');
  assert.equal(action.dueAt, dueAt + 60_000, 'the sign waits until the already planned visit is underway');
  assert.deepEqual(arcDayActions({ ...input, scheduled }), [action]);
  assert.deepEqual(arcDayActions({ ...input, carried: 0, scheduled }), [], 'world pressure gate is unchanged');
});

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
      createFact: (key, kind, subject, value) => ({ key, kind, subject, value }),
      learn: (who, fact) => { (state.characters[who].knowledge ??= []).push(fact); },
    },
  };
  return { ctx, published, skipped, instance, get saved() { return saved; } };
}

test('the sign is not told while she is somewhere else', () => {
  const world = situation({ location: 'mi6', area: 'training', activity: 'training' });
  const handled = resolveArcAction(world.ctx);
  assert.equal(handled, true, 'the action is still owned and answered');
  assert.deepEqual(world.published, [], 'nothing may be published about a shop she is not in');
  assert.match(world.skipped[0] ?? '', /cast is not available at enchanted_ink/i);
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
  assert.deepEqual(world.ctx.event.participants, ['ashai']);
  assert.equal(world.ctx.state.characters.ashai.knowledge[0].kind, 'arc_sign');
});

// Previous tests started an already-running arc. Production uses opening:true
// for this exact first sign; that separate branch bypassed the tested guard.
test('the production OPENING branch does not invent a shop visit during MI6 training', () => {
  const world = situation({ location: 'mi6', area: 'indoor_yard', activity: 'training' });
  world.ctx.action.opening = true;
  world.ctx.state.arcs.activeId = null; world.ctx.state.arcs.instances = {};
  resolveArcAction(world.ctx);
  assert.deepEqual(world.published, []);
  assert.equal(world.saved.activeId, null, 'an unmet premise does not start a story');
});

test('the production OPENING branch still works when the premise is true', () => {
  const world = situation({ location: 'enchanted_ink', area: 'venue' });
  world.ctx.action.opening = true;
  world.ctx.state.arcs.activeId = null; world.ctx.state.arcs.instances = {};
  resolveArcAction(world.ctx);
  assert.deepEqual(world.published, [STAGE.text]);
  assert.ok(world.saved.activeId);
});

test('being at headquarters is not being at an offsite confrontation', () => {
  const world = situation({ location: 'mi6', area: 'indoor_yard' });
  world.ctx.state.characters.goaden = { id: 'goaden', location: 'mi6', activity: 'unhurried_time' };
  world.instance.stageIndex = ARCS.ink_admirer.stages.length;
  world.instance.witnessedStages = Object.fromEntries(['follows', 'window', 'stranger'].map(key => [key, { eventId: `evt:${key}` }]));
  world.ctx.action.type = 'ARC_CONFRONTATION';
  world.ctx.state.arcs.issued.a1.shape.type = 'ARC_CONFRONTATION';
  resolveArcAction(world.ctx);
  assert.deepEqual(world.published, []);
  assert.equal(world.saved.instances['arc:test'].attempts, 1);
});

test('a visit that never happens leaves the arc unresolved rather than inventing its premise', () => {
  const world = situation({ location: 'mi6', area: 'training', activity: 'training',
    waits: ARC_RULES.presenceAttempts - 1 });
  resolveArcAction(world.ctx);
  assert.equal(world.published.length, 1);
  assert.match(world.published[0], /question.*remained open/i);
  assert.doesNotMatch(world.published[0], /stopped appearing|shop she|Ashai/i);
  const after = world.saved.instances['arc:test'];
  assert.equal(after.stageIndex, 0, 'the sign was never committed');
  assert.equal(after.status, 'confronted');
  assert.deepEqual(after.missedStages, ['follows']);
  assert.ok(!after.seen.includes('follows'), 'an absent sign must never be recorded as seen');
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

test('every arc has either explicit complete staging or a documented continuity hold', () => {
  assert.equal(Object.keys(ARC_STAGING).length, 7);
  assert.equal(Object.keys(ARC_STAGING_GATES).length, 14);
  assert.deepEqual([...Object.keys(ARC_STAGING), ...Object.keys(ARC_STAGING_GATES)].sort(), Object.keys(ARCS).sort());
  assert.ok(Object.values(ARC_STAGING_GATES).every(reason => reason.length > 20));
});

test('a stage that happens elsewhere is guarded, and filed, at its own location', () => {
  // `stranger` puts Ashai at the Silver Spoon while the arc lives at the Ink.
  const stage = ARCS.ink_admirer.stages.find(item => item.key === 'stranger');
  assert.equal(stage.location, 'cafe', 'the stage carries where it happens');
  assert.equal(stage.needs, 'ashai');
  assert.notEqual(stage.location, ARCS.ink_admirer.location,
    "which is deliberately not the arc's own location");
});

function productionArc(arcId, stage = 'confrontation') {
  const now = atLondon('2026-09-09', '18:50'), fixture = createFixture({ startMs: atLondon('2026-09-09', '00:00') });
  const state = fixture.initialState(), definition = ARCS[arcId], index = definition.stages.findIndex(item => item.key === stage);
  const part = definition.stages[index] ?? definition.confrontation;
  for (const [who, actor] of Object.entries(state.characters)) Object.assign(actor, { location: part.location ?? definition.location,
    area: part.area, activity: 'unhurried_time', journey: null, activitySince: now - 20 * 60_000,
    activityUntil: now + 60 * 60_000, activityId: `original:${who}` });
  const instance = { id: 'arc:production', arcId, token: 'owned-token', status: 'running',
    stageIndex: index < 0 ? definition.stages.length : index, openedAt: now - 10 * 86_400_000,
    openEventId: 'open', lastEventId: 'previous', seen: definition.stages.slice(0, index < 0 ? undefined : index).map(item => item.key),
    witnessedStages: Object.fromEntries(definition.stages.filter(item => ARC_STAGING[arcId]?.[item.key]?.some(who => ['ashai', 'goaden'].includes(who)))
      .map(item => [item.key, { eventId: `past:${item.key}`, at: now - 86_400_000, cast: ARC_STAGING[arcId][item.key] }])) };
  state.arcs = { ...initialArcs(), activeId: instance.id, instances: { [instance.id]: instance } };
  const own = (action) => {
    const { type, dueAt, priority, day, version, arcId, stage, token, phase } = action;
    state.arcs.issued[action.id] = { sourceEventId: 'owned-source', consumed: false,
      shape: { type, dueAt, priority, day, version, arcId, stage, token, ...(phase ? { phase } : {}) } };
    return action;
  };
  const action = own({ id: `production/${arcId}/${stage}`, type: index < 0 ? 'ARC_CONFRONTATION' : 'ARC_BEAT',
    dueAt: now, priority: 33, day: '2026-09-09', version: 1, arcId, stage, token: instance.token });
  const run = a => fixture.reduceAction(state, a, 'arc-continuity-test');
  return { state, fixture, instance, action, now, own, run, definition };
}

test('staged casts use actual canonical actor IDs', () => {
  const known = new Set(['goaden', 'ashai', ...Object.keys(SIDE_CHARACTERS), ...Object.keys(LEGION_CAST), ...Object.keys(OUTSIDE_CAST)]);
  for (const [arc, stages] of Object.entries(ARC_STAGING)) for (const [stage, cast] of Object.entries(stages))
    for (const who of cast) assert.ok(known.has(who), `${arc}/${stage}: ${who}`);
});

test('production named docket scene cannot claim sleeping leads read it in another room', () => {
  const h = productionArc('burned_dockets', 'named');
  for (const actor of Object.values(h.state.characters)) Object.assign(actor, { activity: 'sleeping', area: 'quarters' });
  const { event } = h.run(h.action);
  assert.equal(event.visibility, 'private');
  assert.equal(event.publicDescription, null);
  assert.equal(h.state.arcs.instances[h.instance.id].stageIndex, 2);
  assert.ok(Object.values(h.state.characters).every(actor => actor.activity === 'sleeping'));
});

test('an actual arc witness learns the sign while an absent protagonist does not', () => {
  const h = productionArc('ink_admirer', 'follows');
  h.state.characters.goaden.location = 'mi6'; h.state.characters.goaden.area = 'quarters';
  const before = Object.fromEntries(Object.entries(h.state.characters).map(([who, actor]) => [who, actor.knowledge.length]));
  const { event } = h.run(h.action);
  assert.deepEqual(event.participants, ['ashai']);
  assert.equal(h.state.characters.ashai.knowledge.length, before.ashai + 1);
  assert.equal(h.state.characters.goaden.knowledge.length, before.goaden);
  assert.equal(event.area, 'venue');
});

test('bank reservations and incompatible promises prevent an arc scene', () => {
  for (const hold of ['bank', 'promise']) {
    const h = productionArc('second_chair');
    if (hold === 'bank') h.state.sceneBank.session = { cast: ['ashai'], startAt: h.now - 1, until: h.now + 60_000 };
    else h.state.arrangements.other = { status: 'accepted', party: ['ashai'], startAt: h.now + 60_000, until: h.now + 30 * 60_000 };
    const { event } = h.run(h.action);
    assert.equal(event.visibility, 'private', hold);
    assert.equal(h.state.arcs.session, null, hold);
  }
});

test('a ten-minute visit cannot contain a twelve-minute arc scene', () => {
  const h = productionArc('smallest_roadworks');
  for (const actor of Object.values(h.state.characters)) actor.activityUntil = h.now + 10 * 60_000;
  assert.equal(h.run(h.action).event.visibility, 'private');
  assert.equal(h.state.arcs.session, null);
});

test('the rematch uses the actual overlap between a game and Ashai watching television', () => {
  const h = productionArc('yukon_rematch');
  const scheduled = [
    { actor: 'goaden', type: 'GAME_BEGIN', dueAt: atLondon('2026-09-09', '19:30'), duration: 65 },
    { actor: 'ashai', type: 'TV_BEGIN', dueAt: atLondon('2026-09-09', '19:45'), duration: 55 },
  ];
  const [action] = arcDayActions({ state: h.state, day: '2026-09-09', now: atLondon('2026-09-09', '00:01'), scheduled });
  assert.equal(action.type, 'ARC_CONFRONTATION');
  assert.equal(action.dueAt, atLondon('2026-09-09', '20:23') - 1);
  assert.ok(action.dueAt + 12 * 60_000 < scheduled[0].dueAt + 65 * 60_000);
  const replaced = [...scheduled, { actor: 'goaden', type: 'BRIEFING_BEGIN', dueAt: atLondon('2026-09-09', '19:50'), duration: 30 }];
  assert.deepEqual(arcDayActions({ state: h.state, day: '2026-09-09', now: atLondon('2026-09-09', '00:01'), scheduled: replaced }), []);
});

test('days without a real visit do not spend the arc opportunity budget', () => {
  const h = productionArc('ink_admirer', 'window');
  for (const day of ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16'])
    assert.deepEqual(arcDayActions({ state: h.state, day, now: atLondon(day, '00:01'), scheduled: [] }), []);
  assert.equal(h.state.arcs.instances[h.instance.id].stageIndex, 1);
  const day = '2026-09-17', visit = { type: 'CITY_ACTIVITY_BEGIN', actors: ['goaden', 'ashai'],
    location: 'enchanted_ink', dueAt: atLondon(day, '14:00'), duration: 55 };
  const [action] = arcDayActions({ state: h.state, day, now: atLondon(day, '00:01'), scheduled: [visit] });
  assert.equal(action.stage, 'window');
  assert.ok(action.dueAt > visit.dueAt && action.dueAt < visit.dueAt + 55 * 60_000);
});

test('an arc with no eventual opportunity has a separate bounded unresolved ending', () => {
  const h = productionArc('ink_admirer', 'window');
  const day = '2026-12-20', now = atLondon(day, '00:01');
  const [action] = arcDayActions({ state: h.state, day, now, scheduled: [] });
  assert.equal(action.stage, 'unresolved');
  h.own(action);
  const { event } = h.run(action);
  assert.equal(event.payload.stage, 'faded');
  assert.match(h.state.arcs.instances[h.instance.id].resolutionReason, /bounded arc window/);
});

test('the full scene occupies durable time and only then commits its outcome', () => {
  const h = productionArc('second_chair');
  const begin = h.run(h.action);
  assert.equal(begin.event.payload.stage, 'gathered');
  assert.equal(Object.values(h.state.facts).filter(fact => fact.kind === 'arc_result').length, 0);
  const session = structuredClone(h.state.arcs.session), completion = begin.followups.find(a => a.phase === 'complete');
  assert.equal(completion.dueAt - h.now, 12 * 60_000);
  assert.equal(session.until, completion.dueAt);
  const saved = JSON.parse(JSON.stringify(h.state)), replay = h.fixture.reduceAction(saved, completion, 'arc-continuity-test');
  const final = h.run(completion);
  assert.deepEqual(saved, h.state, 'save/load preserves the exact scene and completion');
  assert.deepEqual(replay, final);
  assert.equal(final.event.payload.stage, 'confrontation');
  assert.ok(final.event.causedBy.includes(session.startEventId));
  assert.equal(h.state.arcs.session, null);
  assert.equal(h.state.arcs.instances[h.instance.id].status, 'confronted');
});

test('routine completion waits for the active arc, while duty explicitly interrupts it', () => {
  for (const type of ['ACTIVITY_COMPLETE', 'STANDBY_BEGIN']) {
    const h = productionArc('second_chair'), begin = h.run(h.action), held = structuredClone(h.state.arcs.session);
    const routine = { id: `interruption/${type}`, type, dueAt: h.now + 60_000, day: '2026-09-09', priority: 40,
      actor: 'ashai', activityId: h.state.characters.ashai.activityId, duration: 20 };
    const result = h.run(routine);
    if (type === 'ACTIVITY_COMPLETE') {
      assert.equal(h.state.arcs.session.startEventId, held.startEventId);
      assert.equal(h.state.characters.ashai.activityId, 'original:ashai');
      assert.equal(result.followups[0].dueAt, held.until + 1);
    } else {
      assert.equal(h.state.arcs.session, null);
      assert.equal(h.state.arcs.instances[h.instance.id].sceneOutcome.status, 'interrupted');
      assert.equal(h.run(begin.followups.find(a => a.phase === 'complete')).event.visibility, 'private');
      assert.equal(Object.values(h.state.facts).filter(fact => fact.kind === 'arc_result').length, 0);
    }
  }
});

test('a missed or legacy unwitnessed premise cannot silently produce a payoff', () => {
  const h = productionArc('ink_admirer');
  delete h.state.arcs.instances[h.instance.id].witnessedStages.follows;
  const { event } = h.run(h.action);
  assert.equal(event.payload.stage, 'faded');
  assert.ok(!event.prose?.includes('tattooist explained'));
  assert.equal(h.state.arcs.instances[h.instance.id].faded, true);
  assert.equal(Object.values(h.state.facts).filter(fact => fact.kind === 'arc_result').length, 0);
});

test('a saved unsupported arc resolves explicitly without retroactive travel or a fabricated outcome', () => {
  const h = productionArc('wrong_platform', 'door');
  for (const actor of Object.values(h.state.characters)) Object.assign(actor, { location: 'mi6', area: 'quarters', activity: 'sleeping' });
  const { event } = h.run(h.action);
  assert.equal(event.payload.stage, 'faded');
  assert.deepEqual(event.participants, []);
  assert.match(event.publicDescription, /no explanation/i);
  assert.doesNotMatch(event.publicDescription, /photographed|stopped appearing|walked onto/i);
  assert.equal(h.state.arcs.instances[h.instance.id].status, 'confronted');
  assert.match(h.state.arcs.instances[h.instance.id].resolutionReason, /platform visit/i);
});
