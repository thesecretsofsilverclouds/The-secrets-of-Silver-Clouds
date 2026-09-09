import test from 'node:test';
import assert from 'node:assert/strict';
import { supportingRelationshipChoice, knownSupportingHistory, relationshipChoicePresentation } from '../src/relationship-choices.mjs';

const DAY = 24 * 60 * 60_000, NOW = 20 * DAY;
function state() {
  return { characters: { goaden: { knowledge: [] }, ashai: { knowledge: [] } }, facts: {},
    supportingStories: { people: { yukon: { knowledge: [] }, davis: { knowledge: [] } },
      rapport: { 'yukon:goaden': { reliability: -3, familiarity: 9 } } } };
}
function result(s, { id = 'meeting', who = 'goaden', guest = 'yukon', outcome = 'kept', at = NOW - 4 * DAY,
  learnedAt = at + 1, interruption = null, lead = 'goaden' } = {}) {
  const key = `fact:${id}`, sourceEventId = `event:${id}`;
  s.facts[key] = { key, kind: 'supporting_result', subject: lead, sourceEventId, createdAt: at,
    value: { guest, outcome, interruption } };
  const memory = { factKey: key, sourceEventId, acquisitionEventId: `learned:${who}:${id}`, learnedAt, validUntil: null };
  (s.characters[who] ?? s.supportingStories.people[who]).knowledge.push(memory);
  return memory;
}

test('a known completed or interrupted meeting changes a later choice; an aggregate score alone never does', () => {
  const ordinary = state(), kept = structuredClone(ordinary), interrupted = structuredClone(ordinary);
  result(kept); result(interrupted, { outcome: 'cut_short', interruption: { eventId: 'duty-call' } });
  assert.equal(supportingRelationshipChoice(ordinary, 'goaden', 'yukon', NOW).score, 0);
  assert.equal(supportingRelationshipChoice(kept, 'goaden', 'yukon', NOW).reason, 'familiar_company');
  const retry = supportingRelationshipChoice(interrupted, 'goaden', 'yukon', NOW);
  assert.equal(retry.reason, 'try_again'); assert.ok(retry.score > 0);
  assert.equal(retry.evidence[0].sourceEventId, 'event:meeting');
  assert.equal(retry.response, 'accepted', 'an interruption gives a reason to retry, not blame');
});

test('two missed meetings can make a guest defer only after that guest actually learns both outcomes', () => {
  const s = state();
  for (const [id, at] of [['one', NOW - 6 * DAY], ['two', NOW - 3 * DAY]]) result(s, { id, at, outcome: 'missed' });
  assert.equal(supportingRelationshipChoice(s, 'goaden', 'yukon', NOW).response, 'accepted');
  result(s, { id: 'one', who: 'yukon', at: NOW - 6 * DAY, outcome: 'missed' });
  assert.equal(supportingRelationshipChoice(s, 'goaden', 'yukon', NOW).response, 'accepted');
  result(s, { id: 'two', who: 'yukon', at: NOW - 3 * DAY, outcome: 'missed' });
  const defer = supportingRelationshipChoice(s, 'goaden', 'yukon', NOW);
  assert.equal(defer.response, 'deferred');
  assert.deepEqual(new Set(defer.evidence.map(proof => proof.who)), new Set(['yukon']));
  assert.deepEqual(new Set(defer.evidence.map(proof => proof.sourceEventId)), new Set(['event:one', 'event:two']));
  const forgiven = structuredClone(s); result(forgiven, { id: 'later-kept', who: 'yukon', at: NOW - DAY });
  assert.equal(supportingRelationshipChoice(forgiven, 'goaden', 'yukon', NOW).response, 'accepted');
  assert.equal(supportingRelationshipChoice(s, 'goaden', 'yukon', NOW + 5 * DAY).response, 'accepted', 'caution expires');
});

test('known unavoidable interruptions, cut-short visits, and duplicate evidence cannot masquerade as two unexplained misses', () => {
  for (const kind of ['interrupted', 'cut_short', 'duplicate', 'legacy']) {
    const s = state();
    for (const [id, at] of [['one', NOW - 6 * DAY], ['two', NOW - 3 * DAY]]) result(s, {
      id: kind === 'duplicate' ? 'same' : id, who: 'yukon', at,
      outcome: kind === 'cut_short' ? 'cut_short' : 'missed',
      interruption: kind === 'interrupted' ? { eventId: `actual-duty:${id}`, reason: 'BRIEFING_BEGIN' } : null });
    if (kind === 'legacy') for (const fact of Object.values(s.facts)) delete fact.value.interruption;
    assert.equal(supportingRelationshipChoice(s, 'goaden', 'yukon', NOW).response, 'accepted', kind);
  }
});

test('expired, future, malformed and differently owned memories cannot alter a relationship choice', () => {
  for (const mutation of [
    (s, memory) => { memory.learnedAt = NOW + 1; },
    (s, memory) => { memory.validUntil = NOW; },
    (s, memory) => { memory.sourceEventId = 'wrong-event'; },
    (s, memory) => { memory.acquisitionEventId = null; },
    (s, memory) => { memory.learnedAt = s.facts[memory.factKey].createdAt - 1; },
    (s, memory) => { s.facts[memory.factKey].subject = 'ashai'; },
    (s, memory) => { s.facts[memory.factKey].value.guest = 'davis'; },
    (s, memory) => { s.facts[memory.factKey].createdAt = NOW + 1; },
  ]) {
    const s = state(), memory = result(s); mutation(s, memory);
    assert.deepEqual(knownSupportingHistory(s, 'goaden', 'goaden', 'yukon', NOW), []);
    assert.equal(supportingRelationshipChoice(s, 'goaden', 'yukon', NOW).reason, 'ordinary_company');
  }
});

test('relationship choices cannot give a Guardian or Captain Hammond spoken refusals', () => {
  for (const guest of ['kai', 'greah', 'kartel']) {
    const s = state(); s.supportingStories.people[guest] = { knowledge: [] };
    for (const [id, at] of [['one', NOW - 6 * DAY], ['two', NOW - 3 * DAY]]) result(s, {
      id, at, guest, who: guest, outcome: 'missed' });
    assert.equal(supportingRelationshipChoice(s, 'goaden', guest, NOW).response, 'accepted');
  }
});

test('remembered choice prose is fixed to its committed evidence and rejects missing causal links or future knowledge', () => {
  const s = state(); result(s);
  const choice = supportingRelationshipChoice(s, 'goaden', 'yukon', NOW);
  const event = { id: 'current', type: 'SUPPORTING_COMMITMENT', visibility: 'public', occurredAt: NOW, participants: ['goaden'],
    causedBy: ['event:meeting', 'learned:goaden:meeting'], payload: { cast: ['goaden', 'yukon'], relationshipChoice: choice } };
  const names = { lead: 'goaden', guest: 'yukon', leadName: 'Goaden', guestName: 'Yukon' };
  const before = structuredClone(event), prose = relationshipChoicePresentation(event, names);
  assert.match(prose.prose, /last time with Yukon/);
  result(s, { id: 'changed-later', outcome: 'missed', at: NOW + DAY, learnedAt: NOW + DAY });
  assert.deepEqual(relationshipChoicePresentation(event, names), prose);
  assert.deepEqual(event, before);
  assert.equal(relationshipChoicePresentation({ ...event, causedBy: [] }, names), null);
  const future = structuredClone(event); future.payload.relationshipChoice.evidence[0].learnedAt = NOW + 1;
  assert.equal(relationshipChoicePresentation(future, names), null);
});
