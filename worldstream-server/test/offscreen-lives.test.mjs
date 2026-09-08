import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { initialOffscreenLives, OFFSCREEN_CAST, OFFSCREEN_RULES, offscreenAvailable,
  offscreenDayActions, offscreenEncounterActions, offscreenEncounterInterest, issueOffscreenActions,
  resolveOffscreenAction, assertOffscreenLives, publicOffscreenSummaries, noteOffscreenPresence } from '../src/offscreen-lives.mjs';

const DAY = 24 * 60 * MIN, AT = atLondon('2026-09-07', '12:48');
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const actionId = `${londonDate(AT)}/offscreen/1248`;
const projectId = `life:${hash(`event:${actionId}|yukon`)}`;
const seed = Array.from({ length: 100 }, (_, n) => `offscreen-test-${n}`).find(value => [1, 2].every(attempt =>
  Number.parseInt(hash(`${value}|${projectId}|${attempt}`).slice(0, 2), 16) % 3 !== 0));
const knows = (state, lead, key, now) => state.characters[lead].knowledge.find(row => row.factKey === key
  && row.sourceEventId === state.facts[key]?.sourceEventId && row.learnedAt <= now
  && (row.validUntil == null || row.validUntil > now));

function initial(guest = 'yukon') {
  return { offscreenLives: initialOffscreenLives(), facts: {}, arrangements: {}, encounter: null,
    agendas: { supporting: Object.fromEntries(Object.keys(OFFSCREEN_CAST).filter(id => id !== guest)
      .map(id => [id, { commitment: { startAt: AT - DAY, until: AT + 60 * DAY } }])) },
    supportingStories: { instances: {} },
    characters: Object.fromEntries(['goaden', 'ashai'].map(id => [id, { id, location: 'mi6', area: 'gaming_room',
      activity: 'unhurried_time', journey: null, knowledge: [] }])) };
}
function ctx(state, action, options = {}) {
  const id = `event:${action.id}`, now = action.dueAt;
  const event = { id, type: action.type, occurredAt: now, visibility: 'private', participants: [],
    location: null, area: null, payload: {}, causedBy: [], changes: [] };
  const current = { state, action, id, now, seed, event, followups: [], ops: {
    setOffscreenLives(value) { event.changes.push({ field: 'offscreenLives', before: structuredClone(state.offscreenLives), after: structuredClone(value) }); state.offscreenLives = value; },
    createFact(key, kind, subject, value, validUntil) {
      const fact = { key, kind, subject, value, validUntil, sourceEventId: id, createdAt: now };
      if (state.facts[key]) assert.deepEqual(state.facts[key], fact);
      state.facts[key] = fact; return fact;
    },
    learn(lead, fact, provenance) { if (knows(state, lead, fact.key, now)) return;
      state.characters[lead].knowledge.push({ factKey: fact.key, sourceEventId: fact.sourceEventId,
        acquisitionEventId: id, learnedAt: now, validUntil: fact.validUntil, provenance, visibility: 'private' });
      event.causedBy.push(fact.sourceEventId);
    },
    useMemory(lead, key) { const memory = knows(state, lead, key, now);
      if (memory) event.causedBy.push(memory.sourceEventId, memory.acquisitionEventId); return memory; },
    publish(description) { event.visibility = 'public'; event.publicDescription = description; },
    skip(reason) { event.payload = { outcome: 'skipped', reason }; },
  }, ...options };
  return current;
}
function harness(guest = 'yukon', givenState = null) {
  const state = givenState ?? initial(guest), queue = [], events = [];
  function commit(action) {
    const context = ctx(state, action); assert.equal(resolveOffscreenAction(context), true);
    noteOffscreenPresence(context);
    queue.push(...context.followups); events.push(context.event); assertOffscreenLives(state); return context;
  }
  function issue(action, at = action.dueAt - 1) {
    const source = ctx(state, { id: `source:${action.id}`, type: 'DAY_PLAN', dueAt: at });
    queue.push(...issueOffscreenActions(source, [action]));
  }
  function next() {
    queue.sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
    assert.ok(queue.length); return commit(queue.shift());
  }
  function start(at = AT, id = null) {
    const action = offscreenDayActions({ state, day: londonDate(at), now: at - 1,
      parentActionId: 'day', parentEventId: 'day-event' }).find(row => row.dueAt === at);
    assert.ok(action); if (id) action.id = id; issue(action); return next();
  }
  function encounter(at, lead = 'goaden', options = {}) {
    const source = ctx(state, { id: `meeting:${at}:${lead}`, type: 'SUPPORTING_ENCOUNTER', dueAt: at });
    Object.assign(source.event, { visibility: 'public', location: 'mi6', area: 'gaming_room', participants: [lead], payload: { cast: [lead, guest] } }, options);
    noteOffscreenPresence(source);
    const proposals = offscreenEncounterActions({ state, now: at, parentActionId: source.action.id,
      parentEventId: source.id, cast: source.event.payload.cast, participants: source.event.participants,
      location: source.event.location, area: source.event.area, sourceType: source.event.type });
    queue.push(...issueOffscreenActions(source, proposals));
    return proposals.length ? next() : null;
  }
  const project = () => state.offscreenLives.projects[state.offscreenLives.people[guest].currentProjectId];
  return { state, queue, events, commit, issue, next, start, encounter, project };
}

test('ordinary lives start and finish without either protagonist, retaining unfinished intentions and source-linked guest knowledge', () => {
  const h = harness();
  for (const actor of Object.values(h.state.characters)) Object.assign(actor, { location: 'sanctuary', area: 'central_hub', activity: 'sleeping' });
  const began = h.start(); assert.equal(began.event.payload.guest, 'yukon');
  assert.deepEqual(began.event.participants, []); assert.deepEqual(began.event.payload.cast, ['yukon']);
  assert.equal(offscreenAvailable(h.state, 'yukon', { atMs: AT + MIN }), false);
  assert.equal(offscreenAvailable(h.state, 'yukon', { atMs: AT - MIN, until: AT + MIN }), false, 'future interval overlaps reservation');
  assert.equal(offscreenAvailable(h.state, 'yukon', { atMs: AT - 2 * MIN, until: AT }), false,
    'a snapshot containing a later actual sighting cannot authorize an earlier scene');
  const ended = h.next(); assert.equal(ended.event.payload.outcome, 'unfinished');
  assert.equal(h.project().status, 'waiting'); assert.equal(h.project().attempt, 1);
  assert.equal(offscreenAvailable(h.state, 'yukon', { atMs: AT + 23 * MIN }), true);
  assert.equal(h.state.offscreenLives.people.yukon.knowledge[0].sourceEventId, ended.id);
  for (const actor of Object.values(h.state.characters)) assert.deepEqual(actor.knowledge, []);
  const previous = structuredClone(h.project().result);
  const resumed = h.start(AT + DAY); assert.equal(resumed.event.payload.stage, 'resumed');
  assert.equal(h.project().attempt, 2); assert.equal(h.project().previousResult.sourceEventId, previous.sourceEventId);
  assert.ok(resumed.event.causedBy.includes(previous.sourceEventId)); h.next();
});

test('explicitly heard memory changes a later actual encounter and then the next autonomous outcome', () => {
  const h = harness(); h.start(); const firstResult = h.next();
  assert.equal(knows(h.state, 'goaden', h.project().result.factKey, AT + 59 * MIN), undefined);
  const heard = h.encounter(AT + 60 * MIN); assert.equal(heard.event.payload.stage, 'heard');
  assert.equal(heard.event.payload.acquisitionEventId, heard.id);
  assert.equal(heard.event.payload.sourceEventId, firstResult.id);
  assert.equal(h.state.characters.ashai.knowledge.length, 0, 'public readership never teaches absent Ashai');
  const before = structuredClone(h.state), unknown = harness('yukon', structuredClone(before));
  unknown.state.characters.goaden.knowledge = [];
  const secondAt = AT + DAY + 61 * MIN;
  assert.equal(offscreenEncounterInterest(h.state, 'goaden', 'yukon', secondAt), 1);
  assert.equal(offscreenEncounterInterest(unknown.state, 'goaden', 'yukon', secondAt), 0);
  const helped = h.encounter(secondAt), notHelped = unknown.encounter(secondAt);
  assert.equal(helped.event.payload.stage, 'helped'); assert.equal(notHelped.event.payload.stage, 'heard');
  assert.equal(helped.event.payload.recalledSourceEventId, firstResult.id);
  assert.equal(helped.event.payload.acquisitionEventId, heard.id);
  assert.equal(helped.event.payload.helpMethod, 'shorter_section');
  assert.ok(helped.event.causedBy.includes(firstResult.id)); assert.ok(helped.event.causedBy.includes(heard.id));
  assert.equal(h.state.offscreenLives.people.yukon.encounters.goaden.familiarity, 1);
  const retryAt = atLondon('2026-09-08', '18:18');
  h.start(retryAt); unknown.start(retryAt);
  const helpedResult = h.next(), plainResult = unknown.next();
  assert.equal(helpedResult.event.payload.outcome, 'settled');
  assert.equal(plainResult.event.payload.outcome, 'unfinished', 'same seeded attempt actually changes because remembered help was acquired');
  assert.equal(helpedResult.event.payload.helpSourceEventId, helped.id);
  assert.ok(helpedResult.event.causedBy.includes(helped.id));
  assert.equal(h.state.characters.ashai.knowledge.length, 0);
  const settledKey = h.project().result.factKey, laterAt = AT + 2 * DAY + 120 * MIN;
  assert.equal(knows(h.state, 'goaden', settledKey, laterAt), undefined, 'a result published offscreen is not automatically learned');
  const recalled = h.encounter(laterAt);
  assert.equal(recalled.event.payload.stage, 'recalled', 'learning the ending does not erase their earlier involvement');
  assert.equal(recalled.event.payload.sourceEventId, helpedResult.id);
  assert.equal(recalled.event.payload.recalledSourceEventId, firstResult.id);
  assert.equal(recalled.event.payload.acquisitionEventId, heard.id);
  assert.equal(recalled.event.payload.outcome, 'settled');
  assert.equal(knows(h.state, 'goaden', settledKey, recalled.now).acquisitionEventId, recalled.id);
  assert.ok(recalled.event.causedBy.includes(heard.id));
  assert.equal(h.project().help.sourceEventId, helped.id, 'settled recollection cannot invent a second intervention');
});

test('a previous heard attempt remains useful after another unseen attempt, without magically importing the new result', () => {
  const h = harness(); h.start(); const result1 = h.next(); const heard = h.encounter(AT + 60 * MIN);
  h.start(AT + DAY); const result2 = h.next(); assert.equal(result2.event.payload.outcome, 'unfinished');
  const currentKey = h.project().result.factKey;
  assert.equal(knows(h.state, 'goaden', currentKey, AT + DAY + 60 * MIN), undefined);
  const later = h.encounter(AT + DAY + 61 * MIN);
  assert.equal(later.event.payload.stage, 'helped');
  assert.equal(later.event.payload.sourceEventId, result2.id);
  assert.equal(later.event.payload.recalledSourceEventId, result1.id);
  assert.equal(later.event.payload.acquisitionEventId, heard.id);
  assert.equal(knows(h.state, 'goaden', currentKey, later.now).acquisitionEventId, later.id);
});

test('ownership validates exact actions, future times and encounter evidence; duplicate requests are inert', () => {
  const h = harness(); const first = h.start(), next = h.queue[0];
  for (const patch of [{ id: 'forged' }, { dueAt: next.dueAt + 1 }, { actors: ['ashai'] }, { version: 2 }, { token: 'forged' }]) {
    const before = structuredClone(h.state); h.commit({ ...next, ...patch }); assert.deepEqual(h.state, before);
  }
  const before = structuredClone(h.state); h.commit(first.action); assert.deepEqual(h.state, before);
  h.next();
  const source = ctx(h.state, { id: 'source', type: 'DAY_PLAN', dueAt: AT + 60 * MIN });
  assert.throws(() => issueOffscreenActions(source, [{ ...next, id: 'past', dueAt: source.now }]), /strictly future/);
  assert.throws(() => issueOffscreenActions(source, [{ id: 'forged-meeting', type: 'OFFSCREEN_ENCOUNTER', version: 1,
    actors: [], priority: 29, day: londonDate(source.now), dueAt: source.now + 1, encounter: {
      eventId: source.id, occurredAt: source.now, type: 'SUPPORTING_ENCOUNTER', location: 'mi6', area: 'gaming_room', lead: 'goaden', guest: 'yukon' } }]), /causal source/);
});

test('an issued conversation rechecks the real room, awake participant and separate commitments before transferring any knowledge', () => {
  for (const change of ['room', 'sleep', 'agenda', 'supporting']) {
    const h = harness(); h.start(); h.next(); const at = AT + 60 * MIN;
    const source = ctx(h.state, { id: `encounter-${change}`, type: 'VENUE_SCENE', dueAt: at });
    Object.assign(source.event, { visibility: 'public', location: 'mi6', area: 'gaming_room', participants: ['goaden'], payload: { cast: ['yukon'] } });
    const actions = offscreenEncounterActions({ state: h.state, now: at, parentActionId: source.action.id, parentEventId: source.id,
      cast: ['yukon'], participants: ['goaden'], location: 'mi6', area: 'gaming_room', sourceType: source.event.type });
    const issued = issueOffscreenActions(source, actions); assert.equal(issued.length, 1);
    if (change === 'room') h.state.characters.goaden.area = 'common_room';
    if (change === 'sleep') h.state.characters.goaden.activity = 'sleeping';
    if (change === 'agenda') h.state.agendas.supporting.yukon = { commitment: { startAt: at, until: at + MIN } };
    if (change === 'supporting') h.state.supportingStories.instances.other = { status: 'met', guests: ['yukon'], lead: 'ashai',
      location: 'mi6', area: 'common_room', openedAt: at, deadlineAt: at + MIN, causalEventIds: ['other-event'] };
    const result = h.commit(issued[0]); assert.equal(result.event.visibility, 'private');
    assert.deepEqual(h.state.characters.goaden.knowledge, []);
  }
});

test('temporary conflicts are retried sparsely and unfinished work survives a process restart', () => {
  const h = harness();
  h.state.agendas.supporting.yukon = { commitment: { startAt: AT - MIN, until: AT + 10 * MIN } };
  const skipped = h.start(); assert.equal(skipped.event.visibility, 'private');
  assert.equal(h.queue.length, 1); assert.equal(h.queue[0].dueAt, AT + 30 * MIN);
  const serialized = JSON.parse(JSON.stringify({ state: h.state, queue: h.queue }));
  const restarted = harness('yukon', serialized.state); restarted.queue.push(...serialized.queue);
  assert.equal(restarted.next().event.visibility, 'public'); assert.equal(restarted.next().event.visibility, 'public');
  assert.equal(restarted.queue.length, 0, 'two actions resolve 22 minutes without minute ticks');
  assert.equal(restarted.state.offscreenLives.people.yukon.startedCount, 1);
  const blocked = harness(); blocked.state.agendas.supporting.yukon = { commitment: { startAt: AT - MIN, until: AT + DAY } };
  blocked.start(); blocked.next(); blocked.next(); assert.equal(blocked.queue.length, 0);
  assert.equal(blocked.events.length, 3, 'one initial probe and two bounded retries');
  assert.equal(blocked.events.filter(event => event.visibility === 'public').length, 0);
});

test('new-day planning is future-only, public projections are pure and private intention/memory records stay hidden', () => {
  const h = harness(); h.start(); h.next();
  const future = offscreenDayActions({ state: h.state, day: '2026-09-07', now: atLondon('2026-09-07', '16:00'),
    parentActionId: 'activate', parentEventId: 'activation-event' });
  assert.equal(future.length, 1); assert.equal(future[0].dueAt, atLondon('2026-09-07', '18:18'));
  assert.deepEqual(offscreenDayActions({ state: h.state, day: '2026-09-07', now: atLondon('2026-09-07', '20:00'),
    parentActionId: 'activate', parentEventId: 'activation-event' }), []);
  const before = structuredClone(h.state), a = publicOffscreenSummaries(h.state, AT + 60 * MIN), b = publicOffscreenSummaries(h.state, AT + 60 * MIN);
  assert.deepEqual(a, b); assert.deepEqual(h.state, before);
  const json = JSON.stringify(a);
  for (const key of ['knowledge', 'intention', 'issued', 'token', 'factKey', 'acquisitionEventId', 'familiarity', 'commitment'])
    assert.equal(json.includes(key), false, key);
  assert.deepEqual(publicOffscreenSummaries(h.state, AT - 1), []);
});

test('all authored lives have permitted rooms, return opportunities and bounded persistence across weeks', () => {
  const h = harness(); h.state.agendas.supporting = {};
  for (let day = 0; day < 28; day++) {
    for (const offset of [0, 330 * MIN]) { h.start(AT + day * DAY + offset); if (h.queue.length) h.next(); }
  }
  for (const [id, person] of Object.entries(h.state.offscreenLives.people)) {
    assert.ok(person.startedCount >= 8, `${id} has an independent recurring life`);
    assert.ok(person.knowledge.length <= 12);
  }
  assert.ok(Object.keys(h.state.offscreenLives.projects).length <= OFFSCREEN_RULES.retainedProjects);
  assert.ok(Object.keys(h.state.offscreenLives.issued).length <= OFFSCREEN_RULES.retainedActions);
  assert.ok(h.events.some(event => event.payload.stage === 'resumed'));
  assert.ok(h.events.some(event => event.payload.outcome === 'settled'));
  assert.ok(h.events.some(event => event.payload.outcome === 'unfinished'));
  for (const event of h.events.filter(row => row.visibility === 'public')) {
    assert.deepEqual(event.participants, []); assert.equal(event.location, OFFSCREEN_CAST[event.payload.guest].location);
  }
  assert.equal(h.events.filter(event => event.visibility === 'public').length, 28 * 4);
});

test('actual public appearances prevent cross-location teleporting while permitting same-place scenes and a later transfer gap', () => {
  const state = initial('rose'), source = ctx(state, { id: 'rose-really-at-mi6', type: 'LEGION_VISIT', dueAt: AT - 10 * MIN });
  Object.assign(source.event, { visibility: 'public', location: 'mi6', area: 'common_room', participants: ['goaden'], payload: { visitors: ['rose'] } });
  noteOffscreenPresence(source); const seen = structuredClone(state.offscreenLives.people.rose.lastSeen);
  assert.deepEqual(seen, { at: AT - 10 * MIN, location: 'mi6', area: 'common_room', eventId: source.id });
  assert.equal(offscreenAvailable(state, 'rose', { atMs: AT, location: 'sanctuary' }), false);
  assert.equal(offscreenAvailable(state, 'rose', { atMs: AT, location: 'mi6' }), true);
  assert.equal(offscreenAvailable(state, 'rose', { atMs: seen.at + OFFSCREEN_RULES.transferInterval, location: 'sanctuary' }), true);
  assert.equal(offscreenAvailable(state, 'rose', { atMs: seen.at - 1, location: 'mi6' }), false, 'future sighting cannot authorize a past appearance');
  const before = structuredClone(state); noteOffscreenPresence(source); assert.deepEqual(state, before, 'same actual appearance is idempotent');
  const privateSource = ctx(state, { id: 'not-seen', type: 'LEGION_VISIT', dueAt: AT });
  Object.assign(privateSource.event, { location: 'sanctuary', area: 'central_hub', payload: { cast: ['rose'] } });
  noteOffscreenPresence(privateSource); assert.deepEqual(state.offscreenLives.people.rose.lastSeen, seen);
});

test('offscreen work waits after a recently witnessed appearance elsewhere instead of inventing instant travel', () => {
  const h = harness('rose'), source = ctx(h.state, { id: 'real-mi6-meeting', type: 'SUPPORTING_OUTCOME', dueAt: AT - 10 * MIN });
  Object.assign(source.event, { visibility: 'public', location: 'mi6', area: 'common_room', participants: ['goaden'], payload: { cast: ['goaden', 'rose'] } });
  noteOffscreenPresence(source);
  const first = h.start(); assert.equal(first.event.visibility, 'private');
  assert.equal(h.queue[0].dueAt, AT + OFFSCREEN_RULES.retryDelay);
  const began = h.next(); assert.equal(began.event.visibility, 'public'); assert.equal(began.event.location, OFFSCREEN_CAST.rose.location);
  assert.equal(began.now - source.now, 40 * MIN);
  assert.equal(h.state.offscreenLives.people.rose.lastSeen.eventId, began.id);
  h.next();
  assert.equal(h.events.filter(event => /TRAVEL/.test(event.type)).length, 0, 'the guard makes no fictional journey claim');
});
