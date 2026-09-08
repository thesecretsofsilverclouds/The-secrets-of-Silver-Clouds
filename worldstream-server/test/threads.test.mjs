import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { WorldStore, semanticDigest } from '../experiment-l/src/world.mjs';
import { openWorld } from '../src/world.mjs';
import { createFixture, DEFAULT_SEED } from '../src/fixture.mjs';
import { initialThreads, threadVisitActions, availableDeliveryActions,
  issueThreadActions, DELIVERY_DEFINITION, THREAD_EVENT_TYPES, assertThreads } from '../src/threads.mjs';
import { buildScenePacket } from '../src/cinematics.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';

const START = atLondon('2026-09-04', '00:00');
const VISIT = atLondon('2026-09-04', '14:20');
const END = atLondon('2026-09-04', '18:00');
const base = createFixture({ startMs: START });
const threadEvents = snapshot => snapshot.events.filter(event => THREAD_EVENT_TYPES.includes(event.type));
const visible = snapshot => threadEvents(snapshot).filter(event => event.visibility === 'public');
const onlyThread = state => {
  const instances = Object.values(state.threads.instances);
  assert.equal(instances.length, 1, 'this test must contain exactly one persisted episode');
  return instances[0];
};

// Controlled prehistory places the pair on the existing parlour floor. Every
// episode action thereafter comes from the production opportunity generator and
// reducer. This is not an alternate implementation of the thread state machine.
function setup(seed = DEFAULT_SEED, present = ['goaden', 'ashai']) {
  const state = base.initialState();
  state.threads = initialThreads();
  for (const who of Object.values(state.characters)) {
    if (present.includes(who.id)) Object.assign(who, {
      location: 'enchanted_ink', area: 'venue', activity: 'visiting_enchanted_ink',
      activitySince: START, activityId: 'canon-test:existing-ink-visit', activityUntil: null,
    });
  }
  const proposals = threadVisitActions({ state, day: londonDate(VISIT), now: VISIT,
    parentActionId: 'canon-test:existing-ink-visit', parentEventId: 'canon-test:existing-ink-visit', seed });
  const actions = issueThreadActions({ state, now: VISIT, id: 'canon-test:existing-ink-visit',
    ops: { setThreads: value => { state.threads = value; } } }, proposals);
  assert.equal(actions.length, 1, 'an eligible visit should propose one owned episode opening');
  return { state, actions, seed };
}

function harness(seed = DEFAULT_SEED, present = ['goaden', 'ashai']) {
  const initial = setup(seed, present);
  const state = initial.state, queue = [...initial.actions], events = [];
  const run = action => base.reduceAction(state, structuredClone(action), seed);
  const commit = action => {
    const result = run(action);
    events.push(result.event);
    queue.push(...result.followups);
    return result;
  };
  const next = () => {
    queue.sort((a, b) => a.dueAt - b.dueAt || a.priority - b.priority || a.id.localeCompare(b.id));
    assert.ok(queue.length, 'the authored lifecycle has no next action');
    return queue.shift();
  };
  const take = type => {
    for (let limit = 0; limit < 50; limit++) {
      const action = next();
      if (action.type === type) return action;
      commit(action);
    }
    assert.fail(`no queued ${type} within the bounded episode`);
  };
  const finish = () => {
    for (let limit = 0; queue.length && limit < 100; limit++) commit(next());
    assert.equal(queue.length, 0, 'episode should close without polling forever');
    return { ...state, events };
  };
  return { state, queue, events, run, commit, next, take, finish, seed };
}

function refused(state, action, seed = DEFAULT_SEED) {
  const before = structuredClone(state);
  const result = base.reduceAction(state, structuredClone(action), seed);
  assert.equal(result.event.visibility, 'private');
  assert.equal(result.event.payload.outcome, 'skipped');
  assert.equal(result.event.publicDescription, null);
  assert.deepEqual(result.event.changes, []);
  assert.deepEqual(state, before, 'a refused episode action changed world truth');
  return result;
}

function storeDefinition(seed = DEFAULT_SEED, present = ['goaden', 'ashai']) {
  return { ...base, worldId: 'silver-clouds-phase2-thread-test', endMs: END,
    initialState: () => setup(seed, present).state,
    initialActions: () => setup(seed, present).actions,
  };
}

function storage(t) {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-threads-test-'));
  const stores = [];
  t.after(() => {
    for (const world of stores) world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-threads-test-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  return {
    path: name => join(directory, `${name}.sqlite`),
    open(name, seed = DEFAULT_SEED, present = ['goaden', 'ashai']) {
      const world = new WorldStore({ dbPath: join(directory, `${name}.sqlite`), seed,
        fixture: storeDefinition(seed, present) });
      stores.push(world);
      return world;
    },
  };
}

function scenarioSeeds() {
  const choices = new Map();
  for (let number = 0; choices.size < 3 && number < 100; number++) {
    const seed = `phase2-thread-branch-${number}`;
    const scenario = setup(seed).actions[0].scenario;
    choices.set(scenario, seed);
  }
  assert.equal(choices.size, 3, 'all three authored dispatch conditions must be reachable');
  return choices;
}

const away = actor => Object.assign(actor, {
  location: 'mi6', area: 'common_room', activity: 'unhurried_time',
  activityId: 'canon-test:elsewhere', activityUntil: null,
});

test('one versioned delivery episode reaches three materially different lasting outcomes', () => {
  const expected = {
    matching_reference: ['resolved', 'reconciled', 'accepted', 'delivery_record_closed'],
    mismatched_reference: ['resolved', 'returned', 'returned', 'replacement_still_required'],
    delayed_copy: ['failed', 'missed_window', 'outstanding', 'next_delivery_window_required'],
  };
  for (const [scenario, seed] of scenarioSeeds()) {
    const simulation = harness(seed);
    const final = simulation.finish(), thread = onlyThread(final);
    assert.equal(thread.definitionId, DELIVERY_DEFINITION.id);
    assert.equal(thread.definitionVersion, DELIVERY_DEFINITION.version);
    assert.equal(thread.stage, 'settled');
    assert.deepEqual([thread.status, thread.result.outcome, thread.result.deliveryDisposition,
      thread.result.nextVisitNote], expected[scenario]);
    assert.equal(final.threads.completedDefinitions[DELIVERY_DEFINITION.id], thread.id);
    assert.equal(final.facts[thread.factKeys.result].sourceEventId, thread.result.sourceEventId);
    assert.equal(final.facts[thread.factKeys.result].validUntil, null, 'the ending must outlast its deadline');
    assert.equal(visible(final).filter(event => event.payload.completed).length, 1);
    assert.ok(thread.causalEventIds.includes(thread.originEventId));
    assert.ok(thread.causalEventIds.includes(thread.result.sourceEventId));
    assert.ok(thread.result.completedAt <= thread.deadlineAt);
    if (scenario !== 'delayed_copy') {
      assert.equal(thread.result.resolver, 'ashai', 'Ashai can initiate and complete this ordinary check');
      assert.equal(thread.participation.ashai.status, 'completed');
      assert.equal(thread.participation.goaden, undefined, 'the episode must not invent a second volunteer');
    }
    assertThreads(final);
  }
});

test('unknown dispatch evidence cannot unlock confirmation, including after the copy reaches the shop', () => {
  const seed = scenarioSeeds().get('matching_reference'), simulation = harness(seed);
  simulation.commit(simulation.next());
  let thread = onlyThread(simulation.state);
  for (const who of ['goaden', 'ashai']) assert.deepEqual(
    availableDeliveryActions(simulation.state, thread.id, who, VISIT + 3 * MIN), ['request_dispatch_copy']);
  const receipt = simulation.take('THREAD_DISPATCH_RECEIVED');
  simulation.commit(receipt);
  thread = onlyThread(simulation.state);
  for (const who of ['goaden', 'ashai']) {
    assert.deepEqual(availableDeliveryActions(simulation.state, thread.id, who, receipt.dueAt), []);
    assert.equal(simulation.state.characters[who].knowledge.some(memory => memory.factKey === thread.factKeys.dispatch), false);
  }
  const decide = simulation.take('THREAD_DELIVERY_DECIDE');
  thread = onlyThread(simulation.state);
  const learned = simulation.state.characters.ashai.knowledge.find(memory => memory.factKey === thread.factKeys.dispatch);
  assert.ok(learned.learnedAt > receipt.dueAt);
  assert.equal(learned.sourceEventId, thread.dispatchEventId);
  assert.equal(learned.acquisitionEventId, thread.pendingDecision.sourceEventId);
  assert.deepEqual(availableDeliveryActions(simulation.state, thread.id, 'ashai', learned.learnedAt - 1), [],
    'a persisted memory must not be usable before its acquisition time');
  assert.deepEqual(availableDeliveryActions(simulation.state, thread.id, 'ashai', decide.dueAt), ['confirm_dispatch']);
  assert.deepEqual(availableDeliveryActions(simulation.state, thread.id, 'goaden', decide.dueAt), []);
  const ignorant = structuredClone(simulation.state);
  ignorant.characters.ashai.knowledge = ignorant.characters.ashai.knowledge.filter(memory => memory.factKey !== thread.factKeys.dispatch);
  base.reduceAction(ignorant, decide, seed);
  assert.equal(onlyThread(ignorant).result, null, 'an owned action must still require currently possessed evidence');
  const success = simulation.commit(decide);
  assert.equal(onlyThread(simulation.state).result.outcome, 'reconciled');
  assert.ok(success.event.causedBy.includes(learned.sourceEventId));
  assert.ok(success.event.causedBy.includes(learned.acquisitionEventId));
});

test('a solo helper can finish, and the institution closes every branch when both protagonists leave', () => {
  for (const [scenario, seed] of scenarioSeeds()) {
    for (const who of ['goaden', 'ashai']) {
      const final = harness(seed, [who]).finish(), thread = onlyThread(final);
      if (scenario !== 'delayed_copy') assert.equal(thread.result.resolver, who);
      const absent = who === 'goaden' ? 'ashai' : 'goaden';
      assert.equal(final.characters[absent].knowledge.some(memory => memory.factKey.startsWith(thread.id)), false);
      assert.ok(visible(final).every(event => !event.participants.includes(absent)));
    }
    const simulation = harness(seed);
    simulation.commit(simulation.next());
    simulation.commit(simulation.next()); // Ashai's real offer is recorded before departure.
    const volunteered = onlyThread(simulation.state).participation.ashai;
    assert.equal(volunteered.status, 'volunteered');
    for (const actor of Object.values(simulation.state.characters)) away(actor);
    const final = simulation.finish(), thread = onlyThread(final);
    assert.equal(thread.result.resolver, 'enchanted_ink');
    assert.equal(thread.result.completedAt, thread.deadlineAt);
    assert.equal(thread.participation.ashai.status, 'abandoned');
    assert.ok(thread.participation.ashai.abandonmentEventId);
    const ending = final.events.find(event => event.id === thread.result.sourceEventId);
    assert.deepEqual(ending.participants, []);
    for (const actor of Object.values(final.characters)) {
      assert.equal(actor.knowledge.some(memory => memory.factKey === thread.factKeys.result), false);
      assert.equal(actor.knowledge.some(memory => memory.factKey === thread.factKeys.dispatch), false);
    }
  }
});

test('actual address, room, wakefulness and current occupation constrain delivery participation', () => {
  const seed = scenarioSeeds().get('matching_reference'), simulation = harness(seed);
  const decide = simulation.take('THREAD_DELIVERY_DECIDE'), thread = onlyThread(simulation.state);
  for (const patch of [
    { location: 'mi6', area: 'common_room' },
    { area: 'some_other_room' },
    { activity: 'sleeping' },
    { activity: 'getting_a_tattoo' },
    { journey: { from: 'enchanted_ink', to: 'mi6' } },
  ]) {
    const changed = structuredClone(simulation.state);
    Object.assign(changed.characters.ashai, patch);
    assert.deepEqual(availableDeliveryActions(changed, thread.id, 'ashai', decide.dueAt), []);
  }
  away(simulation.state.characters.ashai);
  const outcome = simulation.commit(decide);
  assert.equal(onlyThread(simulation.state).result, null);
  assert.equal(onlyThread(simulation.state).participation.ashai.status, 'abandoned');
  assert.equal(outcome.event.participants.includes('ashai'), false,
    'an absent helper cannot be presented as physically in the parlour scene');
  assert.equal(onlyThread(simulation.finish()).result.resolver, 'enchanted_ink');
});

test('foreign ownership, fabricated decisions and mistimed receipt/deadline actions have zero effects', () => {
  const seed = scenarioSeeds().get('matching_reference'), simulation = harness(seed);
  simulation.commit(simulation.next());
  const deadline = simulation.queue.find(action => action.type === 'THREAD_DELIVERY_DEADLINE');
  const receipt = simulation.take('THREAD_DISPATCH_RECEIVED');
  for (const action of [deadline, receipt]) {
    refused(structuredClone(simulation.state), { ...action, threadToken: 'foreign-thread-owner' }, seed);
    refused(structuredClone(simulation.state), { ...action, id: `${action.id}/fabricated` }, seed);
    refused(structuredClone(simulation.state), { ...action, dueAt: action.dueAt - 1 }, seed);
  }
  simulation.commit(receipt);
  const check = simulation.queue.find(action => action.type === 'THREAD_DELIVERY_CHECK');
  for (const patch of [{ threadToken: 'foreign-thread-owner' }, { id: `${check.id}/fabricated` },
    { dueAt: check.dueAt + 1 }, { definitionVersion: 2 }]) {
    refused(structuredClone(simulation.state), { ...check, ...patch }, seed);
  }
  const decide = simulation.take('THREAD_DELIVERY_DECIDE');
  for (const patch of [{ threadToken: 'foreign-thread-owner' }, { id: `${decide.id}/fabricated` },
    { dueAt: decide.dueAt - 1 }, { actor: 'goaden' }, { choice: 'invented_seizure' }]) {
    refused(structuredClone(simulation.state), { ...decide, ...patch }, seed);
  }
  simulation.commit(decide);
  const result = structuredClone(onlyThread(simulation.state).result);
  for (const action of [decide, receipt, deadline]) refused(simulation.state, action, seed);
  assert.deepEqual(onlyThread(simulation.state).result, result);
});

test('deadline expiry is terminal and a late dispatch cannot rewrite the missed window', () => {
  const seed = scenarioSeeds().get('delayed_copy'), simulation = harness(seed);
  const deadline = simulation.take('THREAD_DELIVERY_DEADLINE');
  const thread = onlyThread(simulation.state);
  assert.deepEqual(availableDeliveryActions(simulation.state, thread.id, 'ashai', deadline.dueAt), []);
  simulation.commit(deadline);
  const before = structuredClone(onlyThread(simulation.state).result);
  const receipt = simulation.take('THREAD_DISPATCH_RECEIVED');
  assert.ok(receipt.dueAt > deadline.dueAt);
  const arrival = simulation.commit(receipt);
  assert.equal(arrival.event.visibility, 'public');
  assert.deepEqual(onlyThread(simulation.state).result, before);
  refused(simulation.state, receipt, seed);
  assert.equal(onlyThread(simulation.state).result.deliveryDisposition, 'outstanding');
  const corrupt = structuredClone(simulation.state);
  onlyThread(corrupt).definitionVersion++;
  assert.throws(() => assertThreads(corrupt), /versioned delivery instance/);
});

test('a later return learns only the retained ending and never opens a second first episode', () => {
  const seed = scenarioSeeds().get('mismatched_reference'), simulation = harness(seed);
  simulation.commit(simulation.next());
  for (const actor of Object.values(simulation.state.characters)) away(actor);
  simulation.finish();
  let thread = onlyThread(simulation.state), result = structuredClone(thread.result);
  const actor = simulation.state.characters.goaden;
  Object.assign(actor, { location: 'enchanted_ink', area: 'venue', activity: 'visiting_enchanted_ink',
    activityId: 'canon-test:return-visit' });
  const now = thread.deadlineAt + MIN;
  const followups = issueThreadActions({ state: simulation.state, now, id: 'canon-test:return-visit',
    ops: { setThreads: value => { simulation.state.threads = value; } } },
  threadVisitActions({ state: simulation.state, now, day: londonDate(now), seed,
    parentActionId: 'canon-test:return-visit', parentEventId: 'canon-test:return-visit' }));
  assert.equal(followups.length, 1);
  assert.equal(followups[0].type, 'THREAD_DELIVERY_RESULT_NOTICED');
  refused(structuredClone(simulation.state), { ...followups[0], id: `${followups[0].id}/fabricated` }, seed);
  refused(structuredClone(simulation.state), { ...followups[0], dueAt: followups[0].dueAt + 1 }, seed);
  assert.equal(actor.knowledge.some(memory => memory.factKey === thread.factKeys.result), false);
  const noticed = simulation.commit(followups[0]);
  const memory = actor.knowledge.find(item => item.factKey === thread.factKeys.result);
  assert.equal(memory.sourceEventId, thread.result.sourceEventId);
  assert.equal(memory.acquisitionEventId, noticed.event.id);
  assert.equal(actor.knowledge.some(item => item.factKey === thread.factKeys.dispatch), false,
    'reading an ending must not silently teach the underlying dispatch evidence');
  simulation.finish();
  thread = onlyThread(simulation.state);
  assert.deepEqual(thread.result, result, 'remembering may not revise the ending');
  assert.ok(thread.callbackEventId);
  const callback = simulation.events.find(event => event.id === thread.callbackEventId);
  assert.ok(callback.causedBy.includes(memory.sourceEventId));
  assert.ok(callback.causedBy.includes(memory.acquisitionEventId));
  assert.deepEqual(threadVisitActions({ state: simulation.state, now: now + MIN, day: londonDate(now), seed,
    parentActionId: 'canon-test:another-return', parentEventId: 'canon-test:another-return' }), []);
  assert.equal(visible({ events: simulation.events }).filter(event => event.type === 'THREAD_DELIVERY_OPEN').length, 1);
});

test('late opening proposals leave enough real time before closure and every follow-up follows its cause', () => {
  for (const seed of scenarioSeeds().values()) {
    for (const time of ['16:52', '16:53', '16:54', '16:57', '17:00', '23:59']) {
      const state = base.initialState();
      for (const actor of Object.values(state.characters)) Object.assign(actor, {
        location: 'enchanted_ink', area: 'venue', activity: 'visiting_enchanted_ink',
        activityId: 'canon-test:late-visit', activityUntil: null,
      });
      const now = atLondon('2026-09-04', time);
      const proposals = threadVisitActions({ state, now, day: londonDate(now), seed,
        parentActionId: 'canon-test:late-visit', parentEventId: 'canon-test:late-visit' });
      if (time >= '16:54') {
        assert.deepEqual(proposals, [], 'the shop must not open an impossible episode just before closing');
        continue;
      }
      assert.equal(proposals.length, 1);
      const queue = issueThreadActions({ state, now, id: 'canon-test:late-visit',
        ops: { setThreads: value => { state.threads = value; } } }, proposals);
      for (let count = 0; queue.length && count < 50; count++) {
        queue.sort((a, b) => a.dueAt - b.dueAt || a.priority - b.priority || a.id.localeCompare(b.id));
        const action = queue.shift(), output = base.reduceAction(state, action, seed);
        for (const followup of output.followups) assert.ok(followup.dueAt > action.dueAt,
          `${action.type} scheduled a nonfuture ${followup.type}`);
        queue.push(...output.followups);
      }
      assert.equal(queue.length, 0);
      assert.notEqual(onlyThread(state).status, 'active');
      assert.ok(onlyThread(state).result.completedAt <= atLondon('2026-09-04', '17:00'));
    }
  }
});

test('losing the visitors before an owned opening releases its opportunity for a later actual visit', () => {
  const seed = scenarioSeeds().get('matching_reference'), simulation = harness(seed);
  const opener = simulation.next();
  refused(structuredClone(simulation.state), { ...opener, originEventId: 'fabricated-visit-event' }, seed);
  refused(structuredClone(simulation.state), { ...opener, definitionVersion: 2 }, seed);
  for (const actor of Object.values(simulation.state.characters)) away(actor);
  const missed = simulation.commit(opener);
  assert.equal(missed.event.visibility, 'private');
  assert.equal(Object.keys(simulation.state.threads.instances).length, 0);
  assert.equal(simulation.state.threads.opportunity, null, 'a missed opening cannot block the world forever');
  const now = VISIT + 20 * MIN;
  for (const actor of Object.values(simulation.state.characters)) Object.assign(actor, {
    location: 'enchanted_ink', area: 'venue', activity: 'visiting_enchanted_ink',
    activityId: 'canon-test:retry-visit',
  });
  const proposals = threadVisitActions({ state: simulation.state, now, day: londonDate(now), seed,
    parentActionId: 'canon-test:retry-visit', parentEventId: 'canon-test:retry-visit' });
  const issued = issueThreadActions({ state: simulation.state, now, id: 'canon-test:retry-visit',
    ops: { setThreads: value => { simulation.state.threads = value; } } }, proposals);
  assert.equal(issued.length, 1);
  refused(simulation.state, opener, seed);
  simulation.commit(issued[0]);
  assert.notEqual(onlyThread(simulation.finish()).status, 'active');
});

test('frequent observations, absence, duplicate requests and failed commits preserve identical episode history', t => {
  const files = storage(t);
  for (const seed of scenarioSeeds().values()) {
    const absent = files.open(`${seed}-absence`, seed);
    absent.advance(END);
    const expected = absent.semanticSnapshot();
    assert.notEqual(onlyThread(expected).status, 'active');
    const frequent = files.open(`${seed}-frequent`, seed);
    for (let target = START + 7 * MIN; target < END; target += 7 * MIN) {
      frequent.advance(target);
      const before = semanticDigest(frequent.semanticSnapshot());
      frequent.publicProjection();
      assert.equal(frequent.advance(target).processedActions, 0);
      assert.equal(frequent.advance(target - 1).processedActions, 0);
      assert.equal(semanticDigest(frequent.semanticSnapshot()), before);
    }
    frequent.advance(END);
    assert.deepEqual(frequent.semanticSnapshot(), expected);
    const failed = files.open(`${seed}-rollback`, seed);
    const before = failed.semanticSnapshot();
    assert.throws(() => failed.advance(END, { failBeforeCommit: true }), /injected|simulated|commit/i);
    assert.deepEqual(failed.semanticSnapshot(), before);
    failed.advance(END);
    assert.deepEqual(failed.semanticSnapshot(), expected);
  }
});

test('independent process restarts at every committed episode stage preserve state and pending ownership', t => {
  const files = storage(t);
  for (const seed of scenarioSeeds().values()) {
    const expectedStore = files.open(`${seed}-expected`, seed);
    expectedStore.advance(END);
    const expected = expectedStore.semanticSnapshot();
    const times = [...new Set(visible(expected).map(event => event.occurredAt))];
    assert.ok(times.length >= 4, 'restart evidence must contain the real episode stages');
    const name = `${seed}-restart`, path = files.path(name);
    let world = files.open(name, seed);
    for (const target of times) {
      world.advance(target);
      const before = semanticDigest(world.semanticSnapshot());
      world.close();
      const code = `import {WorldStore,semanticDigest} from ${JSON.stringify(new URL('../experiment-l/src/world.mjs', import.meta.url).href)};
import {createFixture} from ${JSON.stringify(new URL('../src/fixture.mjs', import.meta.url).href)};
const fixture={...createFixture({startMs:${START}}),worldId:'silver-clouds-phase2-thread-test',endMs:${END}};
const world=new WorldStore({dbPath:process.argv[1],seed:process.argv[2],fixture});
console.log(semanticDigest(world.semanticSnapshot()));world.close();`;
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', code, path, seed], {
        encoding: 'utf8', windowsHide: true, timeout: 30_000,
      });
      assert.equal(child.status, 0, child.stderr || child.error?.message);
      assert.equal(child.stdout.trim(), before, 'new process changed a saved episode stage');
      world = files.open(name, seed);
      assert.equal(semanticDigest(world.semanticSnapshot()), before);
    }
    world.advance(END);
    assert.deepEqual(world.semanticSnapshot(), expected);
  }
});

test('public projection and archived scene replay expose neither private dispatch state nor future knowledge', () => {
  const seed = scenarioSeeds().get('matching_reference');
  const world = new WorldStore({ dbPath: ':memory:', seed, fixture: storeDefinition(seed) });
  try {
    world.advance(END);
    const snapshot = world.semanticSnapshot(), thread = onlyThread(snapshot);
    const before = semanticDigest(snapshot), projected = world.publicProjection();
    assert.equal(projected.stories.length, 1);
    assert.equal(projected.stories[0].deliveryDisposition, 'accepted');
    const text = JSON.stringify(projected);
    for (const forbidden of [thread.token, thread.hidden.scenario, thread.schedule.dispatchActionId,
      ...Object.values(thread.factKeys)]) assert.equal(text.includes(forbidden), false, `public projection leaked ${forbidden}`);
    for (const key of ['threads', 'facts', 'pendingActions', 'participation', 'hidden']) assert.equal(Object.hasOwn(projected, key), false);
    const opening = snapshot.events.find(event => event.type === 'THREAD_DELIVERY_OPEN');
    const scene = buildScenePacket(opening, snapshot);
    for (const character of Object.values(scene.characters)) {
      assert.equal(character.knownFacts.some(fact => [thread.factKeys.dispatch, thread.factKeys.result].includes(fact.id)), false);
    }
    for (let repeat = 0; repeat < 8; repeat++) {
      assert.deepEqual(world.publicProjection(), projected);
      assert.deepEqual(buildScenePacket(opening, world.semanticSnapshot()), scene);
    }
    assert.equal(semanticDigest(world.semanticSnapshot()), before, 'presentation replay changed canonical history');
  } finally { world.close(); }
});

test('the ordinary calendar introduces one episode and preserves its ending across later venue visits', () => {
  const world = openWorld({ dbPath: ':memory:', seed: DEFAULT_SEED, startMs: START });
  try {
    world.advance(atLondon('2026-10-10', '00:00'));
    const snapshot = world.semanticSnapshot(), thread = onlyThread(snapshot);
    assert.notEqual(thread.status, 'active');
    assert.equal(visible(snapshot).filter(event => event.type === 'THREAD_DELIVERY_OPEN').length, 1);
    assert.equal(visible(snapshot).filter(event => event.payload.completed).length, 1);
    assert.ok(snapshot.events.some(event => event.type === 'CITY_ACTIVITY_BEGIN'
      && event.location === 'enchanted_ink' && event.occurredAt > thread.result.completedAt));
    assert.equal(snapshot.facts[thread.factKeys.result].sourceEventId, thread.result.sourceEventId);
  } finally { world.close(); }
});
