import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { createFixture, DEFAULT_SEED, publicProjection } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { applyChange } from '../src/ledger.mjs';

const START = atLondon('2026-08-22', '00:00'), END = atLondon('2026-09-06', '00:00');
let cached;
function sample() {
  if (!cached) {
    const world = openWorld({ dbPath: ':memory:', startMs: START, seed: DEFAULT_SEED });
    try { world.advance(END); cached = world.semanticSnapshot(); } finally { world.close(); }
  }
  return cached;
}
function atEvent(snapshot, through) {
  const copy = structuredClone(snapshot), index = snapshot.events.findIndex(event => event.id === through.id);
  assert.ok(index >= 0);
  for (const event of snapshot.events.slice(index + 1).reverse()) for (const change of [...event.changes].reverse()) {
    const target = change.entity === 'character' ? copy.characters[change.id]
      : change.entity === 'relationship' ? copy.relationships.find(row => `${row.from}->${row.to}` === change.id) : copy;
    assert.ok(target, `Unknown ledger target ${change.entity}/${change.id}`);
    applyChange(target, change, 'before');
  }
  copy.events = snapshot.events.slice(0, index + 1); copy.pendingActions = [];
  copy.world.resolvedThrough = through.occurredAt;
  return copy;
}

test('real Sep5 ground completion recovers the Ink proposal and preserves its 14:00 departure', () => {
  const snapshot = sample();
  const recovery = Object.values(snapshot.outingRecovery.opportunities).find(item => item.day === '2026-09-05');
  assert.ok(recovery, 'the actual collision date needs a recovery record');
  assert.equal(recovery.status, 'recovered'); assert.equal(recovery.attempts, 1);
  const original = snapshot.events.find(event => event.id === recovery.originEventId);
  assert.equal(original.type, 'CROSS_PATHS'); assert.equal(original.payload.outcome, 'skipped');
  assert.equal(original.occurredAt, atLondon('2026-09-05', '13:20'));
  const completion = snapshot.events.find(event => event.id === recovery.blockers[0].completionEventId);
  assert.equal(completion.type, 'GROUND_WORK_COMPLETED');
  const meeting = snapshot.events.find(event => event.id === recovery.meetingEventId);
  assert.ok(meeting.occurredAt > completion.occurredAt);
  assert.ok(meeting.causedBy.includes(original.id)); assert.ok(meeting.causedBy.includes(completion.id));
  const agreement = snapshot.arrangements[recovery.spec.arrangementKey];
  assert.equal(agreement.startAt, atLondon('2026-09-05', '14:00'));
  const offer = snapshot.events.find(event => event.id === agreement.sourceEventId);
  const acceptance = snapshot.events.find(event => event.id === agreement.acceptanceEventId);
  assert.ok(meeting.occurredAt < offer.occurredAt && offer.occurredAt < acceptance.occurredAt);
  const departures = snapshot.events.filter(event => event.type === 'TRAVEL_DEPART' && event.visibility === 'public'
    && event.occurredAt === agreement.startAt && event.payload.to === 'enchanted_ink');
  assert.equal(departures.length, 1);
  const beforeDeparture = atEvent(snapshot, acceptance);
  assert.deepEqual(Object.values(beforeDeparture.characters).map(who => who.location), ['mi6', 'mi6']);
});

test('busy-world replay, duplicate polls and disk restart preserve the same complete semantic history', t => {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'world-depth-release-')));
  const tempParent = realpathSync(tmpdir());
  t.after(() => {
    assert.equal(dirname(temp).toLowerCase(), tempParent.toLowerCase());
    assert.ok(basename(temp).startsWith('world-depth-release-'));
    rmSync(temp, { recursive: true, force: true });
  });
  const path = join(temp, 'observed.sqlite');
  let observed = openWorld({ dbPath: path, startMs: START, seed: DEFAULT_SEED });
  try {
    observed.advance(atLondon('2026-09-05', '13:10'));
    observed.advance(atLondon('2026-09-05', '13:20'));
    observed.close(); observed = openWorld({ dbPath: path });
    const targets = ['13:21', '13:31', '13:34', '14:00', '14:10'].map(time => atLondon('2026-09-05', time));
    for (const [index, target] of targets.entries()) {
      observed.advance(target);
      const before = index === 0 ? semanticDigest(observed.semanticSnapshot()) : null;
      if (index === 0) for (let read = 0; read < 2; read++) observed.publicProjection();
      observed.advance(target);
      if (index === 0) assert.equal(semanticDigest(observed.semanticSnapshot()), before);
    }
    observed.advance(END);
    assert.deepEqual(observed.semanticSnapshot(), sample());
  } finally { observed.close(); }
});

test('a real night response has a prior cause, actual work, retained recovery and later explicit learning', () => {
  const snapshot = sample();
  const story = Object.values(snapshot.nightStories.episodes).find(item => item.result && item.debriefEventId);
  assert.ok(story, 'the sample must contain a night response and actual later debrief');
  const source = snapshot.events.find(event => event.id === story.source.eventId);
  const request = snapshot.events.find(event => event.id === story.requestEventId);
  assert.ok(source.occurredAt < request.occurredAt); assert.equal(source.visibility, 'public');
  assert.ok(request.causedBy.includes(source.id));
  const work = snapshot.events.find(event => event.type === 'NIGHT_WORK_BEGIN' && story.eventIds.includes(event.id));
  const result = snapshot.events.find(event => event.id === story.result.sourceEventId);
  assert.ok(work && result.occurredAt >= work.occurredAt + story.workMinutes * MIN);
  const atResult = atEvent(snapshot, result);
  const sleeping = ['goaden', 'ashai'].find(who => !work.participants.includes(who));
  assert.ok(sleeping, 'this pinned sample leaves one character uninvolved in the night work');
  assert.equal(atResult.characters[sleeping].knowledge.some(memory => memory.factKey === story.result.factKey), false);
  const debrief = snapshot.events.find(event => event.id === story.debriefEventId);
  const learned = snapshot.characters[sleeping].knowledge.find(memory => memory.factKey === story.result.factKey);
  assert.equal(learned.acquisitionEventId, debrief.id); assert.ok(learned.learnedAt > result.occurredAt);
  assert.ok(debrief.participants.includes(sleeping));
  const lead = work.participants[0], part = story.participants[lead];
  assert.ok(part.lostSleepMinutes > 0 && part.recoveredAt === part.recoveryUntil);
  const returned = snapshot.events.find(event => event.id === part.recoveryEventId);
  const recoveryState = atEvent(snapshot, returned);
  assert.equal(recoveryState.characters[lead].activity, 'sleeping');
  assert.equal(recoveryState.characters[lead].activityUntil, part.recoveryUntil);
  assert.ok(recoveryState.characters[lead].conditions.some(condition => condition.kind === 'ordinary_fatigue'));
  assert.ok(!snapshot.events.some(event => event.visibility === 'public' && event.type === 'PRACTICE_BEGIN'
    && event.participants.includes(lead) && returned.occurredAt < event.occurredAt && event.occurredAt < part.recoveredAt));
});

test('new public stories never export private module state or manufacture knowledge through reads', () => {
  const snapshot = structuredClone(sample()), canary = 'PRIVATE_WORLD_DEPTH_CANARY';
  const now = snapshot.world.resolvedThrough;
  const privateEvent = { id: 'event:private-depth-canary', type: 'PRIVATE_TEST', occurredAt: now,
    visibility: 'private', publicDescription: null, participants: ['ashai'], causedBy: [], changes: [], payload: { canary } };
  snapshot.events.push(privateEvent);
  snapshot.facts['private-depth-canary'] = { key: 'private-depth-canary', kind: 'night_result', subject: 'ashai',
    sourceEventId: privateEvent.id, createdAt: now, validUntil: null, value: { presentationText: canary } };
  snapshot.characters.ashai.knowledge.push({ factKey: 'private-depth-canary', sourceEventId: privateEvent.id,
    acquisitionEventId: privateEvent.id, learnedAt: now, validUntil: null, value: { presentationText: canary }, visibility: 'private' });
  snapshot.nightStories.privatePlanning = canary;
  snapshot.supportingStories.people.rose.privatePlanning = canary;
  snapshot.outingRecovery.privatePlanning = canary;
  const before = structuredClone(snapshot);
  for (let read = 0; read < 3; read++) {
    const projection = publicProjection(snapshot);
    assert.equal(JSON.stringify(projection).includes(canary), false);
    for (const field of ['outingRecovery', 'supportingStories', 'nightStories', 'facts', 'pendingActions'])
      assert.equal(Object.hasOwn(projection, field), false);
    assert.ok(projection.stories.some(story => story.id.startsWith('support:')));
  }
  assert.deepEqual(snapshot, before);
  for (const actor of Object.values(snapshot.characters)) for (const memory of actor.knowledge) {
    const fact = snapshot.facts[memory.factKey];
    if (!fact || !['supporting_promise', 'supporting_result', 'night_request', 'night_result', 'night_recovery'].includes(fact.kind)) continue;
    const acquired = snapshot.events.find(event => event.id === memory.acquisitionEventId);
    assert.ok(acquired, 'each learned fact has an actual acquisition event');
    assert.ok(fact.createdAt <= memory.learnedAt && memory.learnedAt === acquired.occurredAt);
  }
});

test('an active supporting promise in the common room cannot overlap a new pair encounter', () => {
  const snapshot = sample();
  const opening = snapshot.events.find(event => event.type === 'SUPPORTING_COMMITMENT'
    && event.visibility === 'public' && event.location === 'mi6' && event.area === 'common_room');
  assert.ok(opening);
  const state = atEvent(snapshot, opening), fixture = createFixture({ startMs: START });
  const active = Object.values(state.supportingStories.instances).find(story => story.originEventId === opening.id);
  assert.ok(active && ['promised', 'met'].includes(active.status));
  const { event } = fixture.reduceAction(state, { id: 'test/new-encounter-during-promise', day: londonDate(opening.occurredAt),
    type: 'CROSS_PATHS', actors: ['goaden', 'ashai'], area: 'common_room', dueAt: opening.occurredAt + MIN, priority: 40 }, DEFAULT_SEED);
  assert.equal(event.visibility, 'private'); assert.equal(event.payload.outcome, 'skipped');
  assert.match(event.payload.reason, /supporting-character commitment/i,
    'the supporting reservation itself must prevent overlap, not an unrelated busy activity');
  assert.equal(state.supportingStories.instances[active.id].status, active.status);
});
