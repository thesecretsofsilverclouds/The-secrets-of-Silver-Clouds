import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { initialOffscreenLives, OFFSCREEN_CAST, OFFSCREEN_RULES, offscreenAvailable,
  offscreenDayActions, offscreenEncounterActions, offscreenEncounterInterest, issueOffscreenActions,
  resolveOffscreenAction, assertOffscreenLives, publicOffscreenSummaries, noteOffscreenPresence } from '../src/offscreen-lives.mjs';
import { livesEditorial } from '../src/editorial-lives.mjs';
import { PURPOSE_RULES } from '../src/pursuit-purpose.mjs';
import { SCENE_BANK_RULES } from '../src/scene-bank.mjs';

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

function completedPurpose(guest = 'yukon') {
  const h = harness(guest); let day = 0;
  do {
    h.start(AT + day++ * DAY); h.next();
    assert.equal(h.state.offscreenLives.people[guest].purpose, undefined, 'unfinished work has no sequel');
  } while (h.project().status !== 'settled');
  const foundation = structuredClone(h.project().result), choice = h.start(AT + day++ * DAY);
  h.next();
  return { h, foundation, choice, day };
}
function actualPurposeMeeting(h, guest, at, lead = 'goaden') {
  const location = guest === 'emily' ? 'big_ben_plaza' : guest === 'rose' ? 'legion_hideout'
    : guest === 'gabriel' ? 'sanctuary' : 'mi6';
  const area = guest === 'emily' || guest === 'rose' ? 'venue' : guest === 'gabriel' ? 'central_hub'
    : guest === 'zara' ? 'common_room' : 'gaming_room';
  Object.assign(h.state.characters[lead], { location, area, activity: 'unhurried_time', activityId: `actual-meeting:${at}` });
  return h.encounter(at, lead, { location, area });
}

function completedBankMeeting(h, at, { sceneId = 'F6', duration = SCENE_BANK_RULES.sceneDuration } = {}) {
  const source = ctx(h.state, { id: `bank:${sceneId}:${at}`, type: 'SCENE_BANK_BEAT', dueAt: at });
  const cast = ['yukon', 'goaden'];
  Object.assign(h.state.characters.goaden, { location: 'mi6', area: 'gaming_room', activity: 'unhurried_time',
    activityId: source.id });
  Object.assign(source.event, { visibility: 'public', location: 'mi6', area: 'gaming_room', participants: cast,
    payload: { sceneBankId: sceneId, cast } });
  const fact = source.ops.createFact(`scene-bank:${sceneId}`, 'scene_bank_observation', sceneId, {}, null);
  source.ops.learn('goaden', fact, 'participated_in_scene');
  h.state.sceneBank = { completed: { [sceneId]: { eventId: source.id, at, cast } },
    knowledge: Object.fromEntries(cast.map(who => [who, { [sceneId]: { sourceEventId: source.id, learnedAt: at } }])),
    session: { sceneId, cast, startAt: at - SCENE_BANK_RULES.gatherDuration, until: at + duration } };
  noteOffscreenPresence(source);
  const propose = () => offscreenEncounterActions({ state: h.state, now: at, parentActionId: source.action.id,
    parentEventId: source.id, cast, participants: cast, location: 'mi6', area: 'gaming_room',
    sourceType: source.event.type, sourcePayload: source.event.payload, sourceDuration: duration });
  return { source, propose, issue() {
    const actions = issueOffscreenActions(source, propose()); h.queue.push(...actions); return actions;
  } };
}

test('a committed bank scene offers a pending purpose one listener only after its reservation, surviving reload', () => {
  const { h, choice, foundation } = completedPurpose();
  const at = choice.now + 90 * MIN, meeting = completedBankMeeting(h, at), actions = meeting.issue();
  assert.equal(actions.length, 1);
  assert.equal(actions[0].dueAt, at + SCENE_BANK_RULES.sceneDuration + 1);
  assert.equal(h.state.offscreenLives.people.yukon.purpose.attempts, 0);
  assert.equal(offscreenAvailable(h.state, 'yukon', { atMs: actions[0].dueAt - 2 }), false);
  assert.equal(knows(h.state, 'goaden', foundation.factKey, at), undefined, 'scene participation does not reveal private work');
  const saved = JSON.parse(JSON.stringify({ state: h.state, actions })), resumed = harness('yukon', saved.state);
  resumed.queue.push(...saved.actions);
  const request = resumed.next();
  assert.equal(request.event.payload.purposeStage, 'requested');
  assert.equal(request.now, actions[0].dueAt);
  assert.ok(request.event.causedBy.includes(meeting.source.id));
  assert.equal(knows(resumed.state, 'goaden', foundation.factKey, request.now).acquisitionEventId, request.id);
  assert.equal(resumed.queue.length, 1, 'only the already-owned two-minute outcome is scheduled');
  const result = resumed.next();
  assert.equal(result.event.payload.purposeOutcome, 'shared');
  assert.deepEqual(result.event.participants, ['goaden']);
  assert.deepEqual(resumed.state.characters.ashai.knowledge, []);
  const before = structuredClone(resumed.state); resumed.commit(saved.actions[0]);
  assert.deepEqual(resumed.state, before, 'a completed opportunity cannot execute twice');
  assert.equal(resumed.queue.length, 0);
});

test('a delayed bank opportunity cannot manufacture an audience, replace a new commitment or spread unearned knowledge', () => {
  const mutations = {
    'lead moved': state => { state.characters.goaden.area = 'common_room'; },
    'lead interrupted': state => { state.characters.goaden.activityId = 'another-activity'; },
    'guest elsewhere': state => { state.offscreenLives.people.yukon.lastSeen.area = 'common_room'; },
    'source lost': state => { state.sceneBank.completed.F6.eventId = 'another-event'; },
    'lead never witnessed scene': state => { state.characters.goaden.knowledge = []; },
    'guest reserved': (state, at) => { state.agendas.supporting.yukon = { commitment: { startAt: at, until: at + 20 * MIN } }; },
    'lead reserved': (state, at) => { state.arcs = { session: { cast: ['goaden'], startAt: at, until: at + 20 * MIN } }; },
    'purpose no longer ready': (state, at) => { state.offscreenLives.people.yukon.purpose.availableAt = at + 20 * MIN; },
  };
  for (const [label, mutate] of Object.entries(mutations)) {
    const { h, choice, foundation } = completedPurpose(), at = choice.now + 90 * MIN;
    completedBankMeeting(h, at).issue(); mutate(h.state, at);
    const declined = h.next();
    assert.equal(declined.event.payload.outcome, 'skipped', label);
    assert.equal(declined.event.visibility, 'private', label);
    assert.equal(h.state.offscreenLives.people.yukon.purpose.attempts, 0, label);
    assert.equal(knows(h.state, 'goaden', foundation.factKey, declined.now), undefined, label);
    assert.equal(h.queue.length, 0, label);
  }
});

test('bank-purpose opportunities require committed cast, scene knowledge and an unfinished purpose', () => {
  const { h, choice } = completedPurpose(), at = choice.now + 90 * MIN;
  const meeting = completedBankMeeting(h, at);
  h.state.sceneBank.completed.F6.cast = ['goaden']; assert.deepEqual(meeting.propose(), []);
  h.state.sceneBank.completed.F6.cast = ['goaden', 'yukon'];
  delete h.state.sceneBank.knowledge.yukon.F6; assert.deepEqual(meeting.propose(), []);
  h.state.sceneBank.knowledge.yukon.F6 = { sourceEventId: meeting.source.id, learnedAt: at };
  h.state.offscreenLives.people.yukon.purpose.availableAt = at + DAY; assert.deepEqual(meeting.propose(), []);
  h.state.offscreenLives.people.yukon.purpose.availableAt = at;
  h.state.characters.goaden.area = 'common_room'; assert.deepEqual(meeting.propose(), []);
  h.state.characters.goaden.area = 'gaming_room';
  assert.equal(meeting.propose().length, 1);
});

test('all five completed pursuits choose one next purpose and share it only with an actual listener', () => {
  for (const guest of Object.keys(OFFSCREEN_CAST)) {
    const { h, foundation, choice } = completedPurpose(guest), record = () => h.state.offscreenLives.people[guest];
    assert.equal(choice.event.payload.purposeStage, 'chosen');
    assert.equal(choice.event.payload.routineContinuation, false);
    assert.equal(choice.event.payload.purposeSourceEventId, foundation.sourceEventId);
    assert.ok(choice.event.causedBy.includes(foundation.sourceEventId));
    assert.ok(livesEditorial(choice.event)?.prose, guest);
    assert.equal(record().purpose.status, 'seeking');
    assert.deepEqual(h.state.characters.goaden.knowledge, []);
    const at = choice.now + 90 * MIN, request = actualPurposeMeeting(h, guest, at);
    assert.equal(request.event.payload.purposeStage, 'requested', guest);
    assert.ok(request.event.causedBy.includes(choice.id));
    assert.ok(request.event.causedBy.includes(foundation.sourceEventId));
    assert.equal(record().purpose.status, 'performing');
    assert.equal(offscreenAvailable(h.state, guest, { atMs: request.now + MIN }), false);
    assert.equal(knows(h.state, 'goaden', foundation.factKey, request.now).acquisitionEventId, request.id);
    assert.equal(livesEditorial(request.event)?.lines?.[0].who, guest);
    assert.equal(h.queue.length, 1, 'one owned outcome, no polling or arranged new meeting');
    const completed = h.next(), result = record().purpose.result;
    assert.equal(completed.now, request.now + PURPOSE_RULES.duration);
    assert.equal(completed.event.payload.purposeOutcome, 'shared', guest);
    assert.deepEqual(completed.event.participants, ['goaden']);
    assert.deepEqual(completed.event.payload.cast, ['goaden', guest]);
    assert.ok(completed.event.causedBy.includes(request.id));
    assert.ok(livesEditorial(completed.event)?.prose);
    assert.equal(record().purpose.status, 'shared');
    assert.equal(record().practice.sourceEventId, foundation.sourceEventId);
    assert.equal(h.state.facts[result.factKey].kind, 'offscreen_purpose_result');
    assert.equal(knows(h.state, 'goaden', result.factKey, completed.now).acquisitionEventId, completed.id);
    assert.deepEqual(h.state.characters.ashai.knowledge, [], 'absent lead learns neither the work nor its sharing');
    assert.equal(h.queue.length, 0);
  }
});

test('a fulfilled purpose survives restart and rolling practice memory without a replacement goal', () => {
  const { h, choice, foundation, day: nextDay } = completedPurpose('rose');
  actualPurposeMeeting(h, 'rose', choice.now + 90 * MIN); h.next();
  const purpose = structuredClone(h.state.offscreenLives.people.rose.purpose);
  const replay = harness('rose', JSON.parse(JSON.stringify(h.state)));
  let day = nextDay;
  for (let index = 0; index < 16; index++) {
    const start = replay.start(AT + day++ * DAY); replay.next();
    assert.equal(start.event.payload.purposeStage, undefined);
    assert.equal(start.event.payload.routineContinuation, true);
  }
  const record = replay.state.offscreenLives.people.rose;
  assert.deepEqual(record.purpose, purpose);
  assert.ok(record.knowledge.some(row => row.factKey === foundation.factKey));
  assert.ok(record.knowledge.some(row => row.factKey === purpose.result.factKey));
  assert.equal(record.knowledge.length, 12);
  assertOffscreenLives(replay.state);
});

test('two interrupted readings end the attempt to find a listener without undoing the finished verse', () => {
  const { h, foundation, choice } = completedPurpose('rose');
  for (let attempt = 1; attempt <= 2; attempt++) {
    const at = choice.now + 90 * MIN + (attempt - 1) * DAY;
    const request = actualPurposeMeeting(h, 'rose', at);
    assert.equal(request.event.payload.purposeStage, 'requested');
    h.state.characters.goaden.activityId = `interruption:${attempt}`;
    const interrupted = h.next(), purpose = h.state.offscreenLives.people.rose.purpose;
    assert.equal(interrupted.event.payload.purposeOutcome, 'unheard');
    assert.deepEqual(interrupted.event.participants, []);
    assert.deepEqual(interrupted.event.payload.cast, []);
    assert.equal(knows(h.state, 'goaden', purpose.result.factKey, interrupted.now), undefined);
    assert.equal(purpose.status, attempt === 1 ? 'seeking' : 'shelved');
    assert.ok(livesEditorial(interrupted.event)?.prose);
    assert.equal(h.state.offscreenLives.people.rose.practice.sourceEventId, foundation.sourceEventId);
  }
  const purpose = structuredClone(h.state.offscreenLives.people.rose.purpose);
  const later = actualPurposeMeeting(h, 'rose', choice.now + 90 * MIN + 2 * DAY);
  assert.notEqual(later.event.payload.purposeStage, 'requested');
  assert.deepEqual(h.state.offscreenLives.people.rose.purpose, purpose);
  assert.equal(h.queue.length, 0);
});

test('pending purpose respects its physical setting, awake attendance and a reserved scene-bank gathering', () => {
  const { h, choice } = completedPurpose();
  const at = choice.now + 90 * MIN;
  h.state.characters.goaden.area = 'common_room';
  const wrongRoom = h.encounter(at, 'goaden', { area: 'common_room' });
  assert.notEqual(wrongRoom.event.payload.purposeStage, 'requested');
  assert.equal(h.state.offscreenLives.people.yukon.purpose.attempts, 0);
  h.state.characters.ashai.activity = 'sleeping';
  assert.equal(h.encounter(at + MIN, 'ashai'), null);
  h.state.characters.ashai.activity = 'unhurried_time';
  h.state.sceneBank = { session: { cast: ['yukon', 'nimbus'], startAt: at + 2 * MIN, until: at + 9 * MIN } };
  assert.equal(offscreenAvailable(h.state, 'yukon', { atMs: at + MIN, until: at + 3 * MIN }), false);
  const upcoming = h.encounter(at + MIN + 1, 'ashai');
  assert.notEqual(upcoming?.event.payload.purposeStage, 'requested', 'known future reservation prevents accepting two minutes');
  assert.equal(h.state.offscreenLives.people.yukon.purpose.attempts, 0);
  assert.equal(h.encounter(at + 3 * MIN, 'ashai'), null);
  h.state.sceneBank.session = null;
  assertOffscreenLives(h.state);
});

test('purpose result owns its precise request, survives restart and ignores forged or duplicate execution', () => {
  const { h, choice } = completedPurpose();
  const requested = actualPurposeMeeting(h, 'yukon', choice.now + 90 * MIN), action = h.queue[0];
  for (const patch of [{ purposeId: 'other' }, { purposeRequestEventId: 'other' }, { dueAt: action.dueAt + 1 }, { guest: 'rose' }]) {
    const before = structuredClone(h.state); h.commit({ ...action, ...patch }); assert.deepEqual(h.state, before);
  }
  const saved = JSON.parse(JSON.stringify({ state: h.state, action }));
  const resumed = harness('yukon', saved.state); resumed.queue.push(saved.action);
  const result = resumed.next();
  assert.equal(result.event.payload.purposeOutcome, 'shared');
  assert.ok(result.event.causedBy.includes(requested.id));
  const before = structuredClone(resumed.state); resumed.commit(action); assert.deepEqual(resumed.state, before);
  const ordinarySource = ctx(resumed.state, { id: 'invented-source', type: 'DAY_PLAN', dueAt: result.now + MIN });
  assert.throws(() => issueOffscreenActions(ordinarySource, [{ ...action, id: 'invented-presentation', dueAt: result.now + 2 * MIN }]), /presentation/);
});

test('the unchanged integrated month actually finds listeners for completed work and keeps their source chain', async t => {
  const { openWorld } = await import('../src/world.mjs');
  const { DEFAULT_SEED } = await import('../src/fixture.mjs');
  const world = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-09-04', '00:00'), seed: DEFAULT_SEED });
  try {
    world.advance(atLondon('2026-10-04', '00:00'));
    const snapshot = world.semanticSnapshot(), events = snapshot.events;
    const choices = events.filter(event => event.payload?.purposeStage === 'chosen');
    const completed = events.filter(event => event.payload?.purposeOutcome === 'shared');
    assert.equal(choices.length, 5, 'each original completed pursuit gets exactly one next purpose');
    assert.ok(completed.length >= 2, 'the real schedule must reach later listeners, not only private intentions');
    const yukon = completed.find(event => event.payload.guest === 'yukon');
    assert.ok(yukon, 'Yukon can use a real scene-bank audience rather than wait forever for an obsolete encounter source');
    const yukonRequest = events.find(event => event.id === yukon.payload.purposeRequestEventId);
    const bankSource = events.find(event => event.type === 'SCENE_BANK_BEAT' && yukonRequest.causedBy.includes(event.id));
    assert.ok(bankSource, 'the unchanged schedule must supply the committed authored scene itself');
    assert.ok(yukonRequest.occurredAt > bankSource.occurredAt + SCENE_BANK_RULES.sceneDuration);
    assert.ok(['yukon', ...yukonRequest.participants].every(who => bankSource.participants.includes(who)));
    assert.equal(bankSource.location, yukonRequest.location);
    assert.equal(bankSource.area, yukonRequest.area);
    for (const event of completed) {
      const p = event.payload, foundation = events.find(row => row.id === p.purposeSourceEventId);
      const choice = events.find(row => row.id === p.purposeChosenEventId);
      const request = events.find(row => row.id === p.purposeRequestEventId);
      assert.equal(foundation.payload.outcome, 'settled');
      assert.equal(choice.payload.purposeStage, 'chosen');
      assert.equal(request.payload.purposeStage, 'requested');
      assert.ok(foundation.occurredAt < choice.occurredAt && choice.occurredAt < request.occurredAt);
      assert.equal(event.occurredAt - request.occurredAt, PURPOSE_RULES.duration);
      assert.deepEqual(event.participants, request.participants);
      assert.ok(livesEditorial(request)?.lines?.length);
      assert.ok(livesEditorial(event)?.prose);
    }
    for (const record of Object.values(snapshot.offscreenLives.people)) {
      assert.ok(record.practice);
      assert.equal(record.purpose.source.sourceEventId, record.practice.sourceEventId);
      assert.ok(record.purpose.attempts <= PURPOSE_RULES.maxAttempts);
    }
    assertOffscreenLives(snapshot);
    t.diagnostic(JSON.stringify({ nextPurposes: choices.length, heard: completed.map(event => event.payload.guest),
      waiting: Object.entries(snapshot.offscreenLives.people).filter(([, row]) => row.purpose.status === 'seeking').map(([guest]) => guest) }));
  } finally { world.close(); }
});

test('completed work carries into one earned later check and then ordinary practice without relearning or new premises', () => {
  for (const guest of Object.keys(OFFSCREEN_CAST)) {
    const h = harness(guest);
    let day = 0;
    do { h.start(AT + day++ * DAY); h.next(); } while (h.project().status !== 'settled');
    const established = structuredClone(h.state.offscreenLives.people[guest].practice);
    assert.equal(established.sourceEventId, h.project().result.sourceEventId);
    delete h.state.offscreenLives.people[guest].practice; // Saved pre-sprint world: adopt its actual result lazily.
    const start = h.start(AT + day++ * DAY);
    assert.equal(start.event.payload.newProject, false);
    assert.equal(start.event.payload.routineContinuation, false, 'the first later check matters');
    assert.equal(start.event.payload.continuationSourceEventId, established.sourceEventId);
    assert.ok(start.event.causedBy.includes(established.sourceEventId));
    const result = h.next();
    assert.equal(result.event.payload.outcome, 'settled');
    assert.ok(result.event.causedBy.includes(established.sourceEventId));
    assert.ok(h.state.offscreenLives.people[guest].practice.confirmedAt);
    assert.deepEqual(h.state.characters.goaden.knowledge, [], 'reader knowledge never becomes protagonist knowledge');
    // The remembered solution must survive the small rolling memory window and
    // a process restart, or the original difficulty silently becomes new again.
    const resumed = harness(guest, structuredClone(h.state));
    for (let index = 0; index < 14; index++) {
      const nextStart = resumed.start(AT + day++ * DAY);
      assert.equal(nextStart.event.payload.routineContinuation, true);
      assert.equal(nextStart.event.payload.newProject, false);
      assert.equal(nextStart.event.payload.continuationSourceEventId, established.sourceEventId);
      assert.equal(resumed.next().event.payload.outcome, 'settled');
    }
    assertOffscreenLives(resumed.state);
  }
});

test('an interrupted later check leaves the established result intact and is not compressed as unchanged routine', () => {
  const h = harness(); let day = 0;
  do { h.start(AT + day++ * DAY); h.next(); } while (h.project().status !== 'settled');
  h.start(AT + day++ * DAY); h.next();
  const established = structuredClone(h.state.offscreenLives.people.yukon.practice);
  const start = h.start(AT + day * DAY);
  h.state.agendas.supporting.yukon = { commitment: { startAt: start.now + MIN, until: start.now + 2 * MIN } };
  const result = h.next();
  assert.equal(result.event.payload.outcome, 'unfinished');
  assert.equal(result.event.payload.routineContinuation, false);
  assert.deepEqual(h.state.offscreenLives.people.yukon.practice, established);
  assert.match(result.event.publicDescription, /still beaten/);
});

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
