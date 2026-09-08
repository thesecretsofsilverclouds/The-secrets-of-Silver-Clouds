import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertReadOnly, opportunitySeed, shadowRecord, compareToWorld,
  SNAPSHOT_FIELDS, PROPOSAL_FIELDS, REFUSAL_CODES, CONTRACT_VERSION } from './contract.mjs';

// TRACK E — test fixtures for the shadow contract. Design-stage only: these
// exercise the contract itself, not an integration, because there is not one.

const opportunity = Object.freeze({
  occurredAt: 1772668800000, day: '2026-03-05',
  location: 'big_ben_plaza', area: 'venue',
  trigger: 'guest_appeared', triggerEventId: 'evt:deadbeef',
  presentCharacters: ['emily'],
  seed: 'silver-clouds-now-v1', rulesVersion: 'canon-ambient-p183-v23',
  characters: { goaden: { location: 'mi6', area: 'common_room', activity: 'eating', journey: null } },
  offscreenPeople: { emily: { lastSeen: { at: 1772668500000, location: 'big_ben_plaza', area: 'venue' } } },
  weather: { code: 'cloudy' }, factions: { order: 'quiet' },
  abilities: { trainingGround: { status: 'open' } }, encounter: null,
  knowledgeByCharacter: { goaden: [{ factKey: 'canon.familiar_mi6', learnedAt: 0, validUntil: null }] },
  recentNotices: [], callbacks: [], witnessed: [],
  arcState: { activeId: null, beatDueWithin90Min: false },
});

test('the snapshot cannot carry a write path', () => {
  assert.equal(assertReadOnly(opportunity), true);
  for (const poison of [
    { ...opportunity, db: { prepare() {} } },
    { ...opportunity, ops: { publish() {} } },
    { ...opportunity, characters: { goaden: { commit: () => {} } } },
    // A handle hidden under an innocuous name is still a handle — this is the
    // case a name-based guard would have waved through.
    { ...opportunity, harmlessLookingCache: { exec() {} } },
    { ...opportunity, nested: { deep: { advance: () => {} } } },
  ]) assert.throws(() => assertReadOnly(poison), /handle|callable|forbidden/);

  // And a plain array that merely *shares a name* with a forbidden field is
  // fine below the top level. The engine's pacing history has one.
  assert.equal(assertReadOnly({ ...opportunity, history: { world: [], byCharacter: {} } }), true);
});

test('the forbidden field list is honoured by the fixture', () => {
  for (const field of SNAPSHOT_FIELDS.forbidden)
    assert.equal(field in opportunity, false, `${field} must never be sent`);
  for (const field of SNAPSHOT_FIELDS.required)
    assert.ok(field in opportunity || field === 'presentCharacters', `${field} is missing`);
});

test('the seed is a pure function of the opportunity', () => {
  const a = opportunitySeed(opportunity);
  const b = opportunitySeed({ ...opportunity });
  assert.equal(a, b);
  assert.notEqual(a, opportunitySeed({ ...opportunity, occurredAt: opportunity.occurredAt + 1 }));
  assert.match(a, new RegExp(CONTRACT_VERSION));
});

test('a refusal is a first-class record, and nothing is ever committed', () => {
  const record = shadowRecord({ opportunity, proposal: null,
    audit: { refusal: 'nothing_worth_surfacing', detail: { won: 'PUBLIC_IDLE:sit_and_watch' },
      blocked: [{ actor: 'emily', practice: 'MINOR_INCONVENIENCE', action: 'use_fade',
        reason: 'there is no shadow here to move through', condition: 'affordance.Shadow.at.Place' }],
      rejected: [], considered: 3 } });
  assert.equal(record.committed, false);
  assert.equal(record.proposed, null);
  assert.ok(REFUSAL_CODES.includes(record.refusal));
  assert.equal(record.blocked[0].reason, 'there is no shadow here to move through');
});

test('a proposal is projected to the declared fields only', () => {
  const proposal = { id: 'moment:1', at: opportunity.occurredAt, actor: 'emily',
    action: 'observe_and_count', line: 'Forty-one so far.', score: 14,
    secretInternalHandle: { db: 1 } };
  const record = shadowRecord({ opportunity, proposal, audit: { blocked: [], rejected: [], considered: 5 } });
  assert.equal(record.proposed.actor, 'emily');
  assert.equal('secretInternalHandle' in record.proposed, false, 'undeclared fields must not leak');
  for (const field of Object.keys(record.proposed)) assert.ok(PROPOSAL_FIELDS.includes(field));
  assert.equal(record.committed, false);
});

test('the world comparison answers the question shadow mode exists to ask', () => {
  const base = { opportunity, audit: { blocked: [], rejected: [], considered: 1 } };
  const summary = compareToWorld([
    shadowRecord({ ...base, proposal: { id: 'a', actor: 'emily' }, worldEventsInWindow: [] }),
    shadowRecord({ ...base, proposal: { id: 'b', actor: 'emily' },
      worldEventsInWindow: [{ id: 'e1', type: 'OFFSCREEN_START', occurredAt: 1, participants: ['emily'], publicDescription: 'x' }] }),
    shadowRecord({ ...base, proposal: null, audit: { refusal: 'world_gap', blocked: [], rejected: [] } }),
  ]);
  assert.equal(summary.opportunities, 3);
  assert.equal(summary.proposals, 2);
  assert.equal(summary.refusals, 1);
  assert.equal(summary.proposedIntoSilence, 1);
  assert.equal(summary.proposedOverTheSameCharacter, 1);
  assert.equal(summary.additiveRate, 0.5);
  assert.deepEqual(summary.refusalBreakdown, { world_gap: 1 });
});
