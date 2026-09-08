import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { WorldStore, semanticDigest } from '../experiment-l/src/world.mjs';
import { initialAgendaState, agendaDayActions, agendaReportActions, issueAgendaActions,
  resolveAgendaAction, supportingAvailability, agendaFactionOverrides, agendaOpportunity,
  publicAgendaSummaries, assertAgendas } from '../src/faction-agendas.mjs';
import { atLondon, londonDate, nextLondonDay, MINUTE_MS as MIN } from '../src/time.mjs';

const START = atLondon('2026-09-04', '00:00');
const END = atLondon('2026-09-04', '18:00');
const DAY = '2026-09-04';

function initial() {
  return { agendas: initialAgendaState(), facts: {}, weather: { code: 'cloudy' },
    factions: { mi6: 'routine', streamliner: 'normal' },
    characters: Object.fromEntries(['goaden', 'ashai'].map(id => [id, {
      id, location: 'mi6', area: 'quarters', activity: 'resting', journey: null, knowledge: [],
    }])) };
}

// Only the existing fixture's ledger primitives are substituted here. Every
// agenda decision, ownership check and institutional fact is production code.
function reduce(state, action, seed = 'agenda-tests') {
  const id = `test-event:${action.id}`, now = action.dueAt;
  const event = { id, type: action.type, occurredAt: now, visibility: 'private', publicDescription: null,
    location: 'mi6', area: null, participants: [], payload: {}, causedBy: [], changes: [] };
  const followups = [];
  const change = (entity, owner, target, field, value) => {
    if (JSON.stringify(target[field]) === JSON.stringify(value)) return;
    event.changes.push({ entity, id: owner, field, before: structuredClone(target[field]), after: structuredClone(value) });
    target[field] = value;
  };
  const ops = {
    setAgendas: value => change('world', 'shared', state, 'agendas', value),
    createFact(key, kind, subject, value, validUntil) {
      const fact = { key, kind, subject, value, validUntil, sourceEventId: id, createdAt: now };
      assert.equal(state.facts[key], undefined, 'an institutional fact was manufactured twice');
      change('world', 'shared', state, 'facts', { ...state.facts, [key]: fact });
      return fact;
    },
    learn(who, fact, provenance) {
      assert.ok(fact && fact.createdAt <= now, 'learning requires a past source');
      if (state.characters[who].knowledge.some(memory => memory.factKey === fact.key)) return;
      const actor = state.characters[who];
      change('character', who, actor, 'knowledge', [...actor.knowledge, {
        factKey: fact.key, sourceEventId: fact.sourceEventId, acquisitionEventId: id,
        learnedAt: now, validUntil: fact.validUntil, provenance, value: structuredClone(fact.value), visibility: 'private',
      }]);
    },
    useMemory(who, key) {
      const memory = state.characters[who].knowledge.find(row => row.factKey === key && row.learnedAt <= now);
      if (memory) event.causedBy.push(memory.sourceEventId, memory.acquisitionEventId);
      return memory;
    },
    publish(description) { event.visibility = 'public'; event.publicDescription = description; },
    skip(reason) { event.payload = { outcome: 'skipped', reason }; },
  };
  assert.equal(resolveAgendaAction({ state, action, now, id, event, followups, seed, ops }), true);
  assertAgendas(state);
  return { event, followups };
}

function issue(state, actions, now, id = 'canon-test:operation-window') {
  return issueAgendaActions({ state, now, id, ops: { setAgendas: value => { state.agendas = value; } } }, actions);
}

function harness(seed = 'agenda-tests', state = initial()) {
  const queue = [], events = [];
  const openDay = day => {
    const now = atLondon(day, '00:00') + 1;
    const source = `canon-test:${day}:operation-window`;
    const actions = agendaDayActions({ state, now, day, parentActionId: source, parentEventId: source });
    queue.push(...issue(state, actions, now, source));
    return actions;
  };
  const next = () => {
    queue.sort((a, b) => a.dueAt - b.dueAt || a.priority - b.priority || a.id.localeCompare(b.id));
    assert.ok(queue.length, 'operation lost its scheduled continuation');
    return queue.shift();
  };
  const commit = action => {
    const outcome = reduce(state, action, seed);
    for (const followup of outcome.followups) assert.ok(followup.dueAt > action.dueAt);
    events.push(outcome.event); queue.push(...outcome.followups);
    return outcome;
  };
  const take = type => {
    for (let count = 0; count < 30; count++) {
      const action = next();
      if (action.type === type) return action;
      commit(action);
    }
    assert.fail(`no ${type} within bounded operation`);
  };
  const finish = () => {
    for (let count = 0; queue.length && count < 50; count++) commit(next());
    assert.equal(queue.length, 0, 'an ordinary operation must have an ending');
    return state;
  };
  return { seed, state, queue, events, openDay, commit, next, take, finish };
}
const latest = state => Object.values(state.agendas.operations).sort((a, b) => b.startedAt - a.startedAt)[0];
function refused(state, action, seed = 'agenda-tests') {
  const before = structuredClone(state), result = reduce(state, action, seed);
  assert.equal(result.event.visibility, 'private');
  assert.equal(result.event.payload.outcome, 'skipped');
  assert.deepEqual(state, before);
  assert.deepEqual(result.event.changes, []);
}

test('an offscreen operation acquires its own information, reports, ends and releases scarce staff', () => {
  const run = harness();
  assert.equal(run.openDay(DAY).length, 1);
  run.commit(run.next());
  const operation = latest(run.state);
  assert.equal(run.state.agendas.resources.attention, 0);
  assert.deepEqual(operation.team, ['davis', 'zara']);
  assert.equal(supportingAvailability(run.state, 'zara', { atMs: operation.startedAt + MIN,
    location: 'enchanted_ink', area: 'venue' }), false);
  assert.equal(supportingAvailability(run.state, 'davis', { atMs: operation.startedAt + MIN,
    location: 'mi6', area: 'ops_room' }), false, 'being at the right address does not free a committed colleague');
  assert.equal(supportingAvailability(run.state, 'kai', { atMs: operation.startedAt + MIN }), true);
  assert.deepEqual(agendaFactionOverrides(run.state, operation.startedAt), { mi6: 'briefings' });
  run.finish();
  const final = latest(run.state);
  assert.notEqual(final.status, 'active');
  assert.equal(run.state.agendas.activeId, null);
  assert.equal(run.state.agendas.resources.attention, 2);
  assert.equal(final.resourcesReleased, true);
  assert.ok(final.observation && final.report && final.result);
  assert.equal(final.report.evidenceEventId, final.observation.sourceEventId);
  assert.equal(run.state.agendas.supporting[final.report.source].knowledge.at(-1).sourceEventId, final.observation.sourceEventId);
  assert.equal(supportingAvailability(run.state, 'zara', { atMs: final.releaseAt }), true);
  for (const actor of Object.values(run.state.characters)) assert.deepEqual(actor.knowledge, [], 'offscreen progress must not teach the protagonists');
  assert.ok(run.events.every(event => event.participants.length === 0));
  const observation = run.events.find(event => event.type === 'AGENDA_OBSERVE');
  assert.equal(observation.visibility, 'private');
});

test('removing checking resources changes evidence and outcome instead of merely changing wording', () => {
  const full = harness(); full.openDay(DAY); full.finish();
  const unavailable = initial(); unavailable.agendas.resources.attention = 0;
  const empty = harness('agenda-tests', unavailable); empty.openDay(DAY); empty.finish();
  const complete = latest(full.state), missing = latest(empty.state);
  assert.deepEqual(missing.team, []);
  assert.equal(missing.observation, null);
  assert.equal(missing.report, null);
  assert.equal(missing.result.outcome, 'unverified');
  assert.equal(missing.result.completedAt, missing.deadlineAt);
  assert.notEqual(complete.result.outcome, missing.result.outcome);
  assert.ok(complete.result.completedAt < complete.deadlineAt);
  assert.equal(agendaOpportunity(empty.state, 'city_interval', END).available, false);
  assert.equal(agendaOpportunity(empty.state, 'service_recheck', END).available, true);
});

test('a source cannot report evidence it never acquired and an absent protagonist cannot read a report', () => {
  const run = harness(); run.openDay(DAY);
  const report = run.take('AGENDA_REPORT');
  for (const record of Object.values(run.state.agendas.supporting)) record.knowledge = [];
  run.commit(report);
  assert.equal(latest(run.state).report, null);
  run.finish();
  assert.equal(latest(run.state).result.outcome, 'unverified');
  const witnessed = harness(); witnessed.openDay(DAY);
  const publication = witnessed.take('AGENDA_REPORT'); witnessed.commit(publication);
  const now = publication.dueAt + MIN, state = witnessed.state;
  assert.deepEqual(agendaReportActions({ state, now, day: DAY, parentActionId: 'test:read' }), []);
  Object.assign(state.characters.ashai, { area: 'ops_room', activity: 'unhurried_time' });
  const actions = issue(state, agendaReportActions({ state, now, day: DAY, parentActionId: 'test:read' }), now, 'test:arrived');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].actor, 'ashai');
  assert.deepEqual(state.characters.ashai.knowledge, []);
  const moved = structuredClone(state); moved.characters.ashai.area = 'quarters';
  refused(moved, actions[0]);
  const read = witnessed.commit(actions[0]);
  const memory = state.characters.ashai.knowledge[0];
  assert.equal(memory.sourceEventId, latest(state).report.sourceEventId);
  assert.equal(memory.acquisitionEventId, read.event.id);
  assert.ok(memory.learnedAt > latest(state).report.createdAt);
  assert.deepEqual(state.characters.goaden.knowledge, []);
  assert.deepEqual(agendaReportActions({ state, now: now + MIN, day: DAY, parentActionId: 'test:read-again' }), []);
});

test('an unresolved result selects an actual later recheck, and clearance enables a different next opportunity', () => {
  const run = harness(); run.state.weather.code = 'storm'; run.openDay(DAY); run.finish();
  const first = latest(run.state);
  assert.equal(first.family, 'dispatch_crosscheck');
  assert.equal(first.result.outcome, 'unverified');
  assert.deepEqual(run.openDay('2026-09-05'), [], 'resources and cadence forbid a fresh daily mission');
  run.state.weather.code = 'cloudy'; run.openDay('2026-09-07'); run.finish();
  const second = latest(run.state);
  assert.equal(second.family, 'record_recheck');
  assert.equal(second.previousResultEventId, first.result.sourceEventId);
  assert.equal(second.result.outcome, 'cleared');
  assert.equal(agendaOpportunity(run.state, 'service_recheck', second.releaseAt).available, false);
  assert.equal(agendaOpportunity(run.state, 'city_interval', second.releaseAt).available, true);
  assert.equal(agendaOpportunity(run.state, 'city_interval', second.startedAt).available, false);
  run.openDay('2026-09-10'); run.finish();
  assert.equal(latest(run.state).family, 'clearance_handover');
  assert.equal(latest(run.state).previousResultEventId, second.result.sourceEventId);
});

test('forged versions, IDs, times and tokens, stale deadlines and repeated releases have zero effects', () => {
  const run = harness(); run.openDay(DAY);
  const start = run.next();
  refused(structuredClone(run.state), { ...start, dueAt: start.dueAt + 1 });
  refused(structuredClone(run.state), { ...start, version: 2 });
  run.commit(start);
  const observation = run.take('AGENDA_OBSERVE');
  for (const patch of [{ id: `${observation.id}/fake` }, { dueAt: observation.dueAt + 1 },
    { operationToken: 'foreign-operation' }, { actors: ['ashai'] }]) refused(structuredClone(run.state), { ...observation, ...patch });
  run.commit(observation);
  const deadline = run.queue.find(action => action.type === 'AGENDA_DEADLINE');
  const release = run.queue.find(action => action.type === 'AGENDA_RELEASE');
  const finish = run.take('AGENDA_RESOLVE'); run.commit(finish);
  refused(run.state, deadline);
  run.finish();
  refused(run.state, release);
  refused(run.state, start);
  assert.equal(run.state.agendas.resources.attention, 2);
});

test('public operation summaries reveal no staff knowledge, tokens, issued actions or latent discrepancy', () => {
  const run = harness(); run.openDay(DAY); run.finish();
  const before = structuredClone(run.state), operation = latest(run.state);
  for (let i = 0; i < 6; i++) {
    const text = JSON.stringify(publicAgendaSummaries(run.state, END));
    for (const privateValue of [operation.token, operation.observation.key, operation.report.factKey,
      operation.result.factKey, 'inspected_dispatch_records']) assert.equal(text.includes(privateValue), false);
    assert.equal(publicAgendaSummaries(run.state, operation.startedAt - 1).length, 0);
  }
  assert.deepEqual(run.state, before);
});

test('SQLite absence, frequent advances, stage reopening and rollback preserve one canonical operation', t => {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-agenda-test-')), stores = [];
  t.after(() => {
    for (const world of stores) world.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-agenda-test-'))
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    rmSync(resolved, { recursive: true, force: true });
  });
  const prepared = harness(); prepared.openDay(DAY);
  const fixture = { worldId: 'agenda-test', rulesVersion: 'agenda-v1', startMs: START, endMs: END, maxActions: 100,
    initialState: () => structuredClone(prepared.state), initialActions: () => structuredClone(prepared.queue),
    reduceAction: reduce, publicProjection: snapshot => ({ operations: publicAgendaSummaries(snapshot, snapshot.world.resolvedThrough) }) };
  const open = name => {
    const world = new WorldStore({ dbPath: join(directory, `${name}.sqlite`), seed: 'agenda-tests', fixture });
    stores.push(world); return world;
  };
  const absent = open('absence'); absent.advance(END);
  const expected = absent.semanticSnapshot();
  let observed = open('observed');
  for (const event of expected.events) {
    observed.advance(event.occurredAt);
    const before = semanticDigest(observed.semanticSnapshot());
    observed.publicProjection(); observed.advance(event.occurredAt); observed.close();
    observed = open('observed');
    assert.equal(semanticDigest(observed.semanticSnapshot()), before);
  }
  observed.advance(END);
  assert.deepEqual(observed.semanticSnapshot(), expected);
  const rollback = open('rollback'), pristine = rollback.semanticSnapshot();
  assert.throws(() => rollback.advance(END, { failBeforeCommit: true }), /commit/i);
  assert.deepEqual(rollback.semanticSnapshot(), pristine);
  rollback.advance(END);
  assert.deepEqual(rollback.semanticSnapshot(), expected);
  assert.equal(expected.events.length, 6, 'one operation needs boundaries, not minute polling');
});

test('months of recurring work keep working records bounded and preserve the latest actual consequence', () => {
  const run = harness();
  for (let day = DAY, count = 0; count < 150; count++, day = nextLondonDay(day)) {
    run.openDay(day); run.finish();
    assert.ok(Object.keys(run.state.agendas.operations).length <= 12);
    assert.ok(Object.keys(run.state.agendas.issued).length <= 128);
    assert.equal(run.state.agendas.resources.attention, 2);
  }
  assert.equal(run.events.filter(event => event.type === 'AGENDA_OPERATION_START').length, 50);
  const result = run.state.agendas.lastResult;
  assert.equal(run.state.facts[result.factKey].sourceEventId, result.sourceEventId);
  assert.ok(run.state.agendas.operations[result.operationId]);
});

test('the real fortnight uses owned agendas and never stages a reserved colleague in an incompatible cameo', async () => {
  const { openWorld } = await import('../src/world.mjs');
  const through = atLondon('2026-09-18', '00:00');
  const absent = openWorld({ dbPath: ':memory:', startMs: START });
  const observed = openWorld({ dbPath: ':memory:', startMs: START });
  try {
    absent.advance(through);
    for (let target = START + 67 * MIN; target < through; target += 67 * MIN) observed.advance(target);
    observed.advance(through);
    const expected = absent.semanticSnapshot();
    assert.deepEqual(observed.semanticSnapshot(), expected);
    const operations = Object.values(expected.agendas.operations);
    assert.equal(operations.length, 5);
    assert.ok(operations.every(operation => operation.result && operation.resourcesReleased));
    for (const event of expected.events.filter(event => event.visibility === 'public')) {
      const cameo = event.type === 'SIDE_PRESENCE' ? [event.payload.who]
        : ['VENUE_SCENE', 'LEGION_VISIT'].includes(event.type) ? event.payload.cast ?? [] : [];
      for (const operation of operations) if (operation.startedAt <= event.occurredAt && event.occurredAt < operation.releaseAt) {
        assert.ok(!cameo.some(who => operation.team.includes(who)), `${event.id} stages a committed colleague`);
      }
    }
    for (const actor of Object.values(expected.characters)) for (const memory of actor.knowledge) {
      if (!expected.facts[memory.factKey]?.kind.startsWith('agenda_')) continue;
      const acquisition = expected.events.find(event => event.id === memory.acquisitionEventId);
      assert.equal(acquisition.type, 'AGENDA_REPORT_READ');
      assert.ok(acquisition.participants.includes(actor.id));
      assert.equal(acquisition.location, 'mi6');
      assert.ok(['ops_room', 'briefing_room'].includes(acquisition.area));
    }
  } finally { absent.close(); observed.close(); }
});
