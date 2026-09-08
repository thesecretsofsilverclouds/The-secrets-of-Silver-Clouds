import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMomentOpportunity, viewFrom, MOMENT_RULES } from '../engine/engine.mjs';
import { scoreCandidates } from '../engine/score.mjs';
import { translate } from '../engine/adapter.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { CAST, CAST_IDS } from '../grammar/cast.mjs';
import { atLondon, MINUTE_MS as MIN } from '../../src/time.mjs';

// The three-beat chain, proved across *separate opportunities*.
//
// Nothing here names the plaza, counting, people, or any line of the scene the
// project was described around. The test asserts the shape — somebody does a
// visible thing, somebody who was there acquires a question, and the first
// person acquires an answer — and lets the grammar supply what those are. If
// the fixture had to name them the chain would not be emerging, it would be
// being staged.

const DAY = '2026-03-10';
const T0 = atLondon(DAY, '13:00');

// A plain place with one countable, observable thing in it. Not a real venue.
const PLACE = 'somewhere_venue';
const THING = 'a_countable_thing';

const facts = (extra = []) => [
  'world.daypart.midday', 'world.weather.cloudy', 'world.faction.arcane.low',
  `sociable.${PLACE}`,
  ...['emily', 'ashai'].flatMap(who => [
    `char.${who}`, `here.${who}.${PLACE}`, `free.${who}`, `activity.${who}.unhurried_time`,
    ...(CAST.get(who).traits ?? []).map(trait => `trait.${who}.${trait}`),
  ]),
  `affordance.${THING}.at.${PLACE}`, `affordance.${THING}.tag.countable`,
  `affordance.${THING}.tag.perceptible`,
  `affordance.${THING}.prop.can_depart_return`, `affordance.${THING}.prop.pairable`,
  `affordance.${THING}.prop.spatially_ordered`, `affordance.${THING}.prop.unconscious_behaviour`,
  `practice.public_idle.${PLACE}`,
  `practice.person_alone_encounter.${PLACE}`,
  ...extra,
];

const canReach = (actor, action, extra = []) => {
  const { ranked } = scoreCandidates({ view: viewFrom(facts(extra)), practices: PRACTICES,
    actor, grammar: CAST.get(actor), seed: 'chain' });
  return ranked.some(candidate => candidate.action.id === action);
};
const blockedReason = (actor, action, extra = []) => {
  const { blocked } = scoreCandidates({ view: viewFrom(facts(extra)), practices: PRACTICES,
    actor, grammar: CAST.get(actor), seed: 'chain' });
  return blocked.find(item => item.action === action)?.reason ?? null;
};

// The persisted experience each beat leaves behind, in the adapter's own
// vocabulary. The test builds these by hand rather than running a world, so
// that it is testing the *affordance rule* and not a particular afternoon.
const observed = (observer, actor) => `observed.${observer}.${actor}.${THING}`;
const asked = (asker, target) => `asked.${asker}.${target}.${THING}`;

test('beat 1 — the observation is available, and leaves nothing behind on its own', () => {
  assert.ok(canReach('emily', 'observe_and_count'), 'the observing behaviour is reachable');
  // Before anybody has seen it, the question does not exist.
  assert.equal(canReach('ashai', 'ask_what_they_are_doing'), false);
  assert.match(blockedReason('ashai', 'ask_what_they_are_doing'), /did not see them/);
});

test('beat 2 — a witness acquires the question in a *later* opportunity', () => {
  assert.ok(canReach('ashai', 'ask_what_they_are_doing', [observed('ashai', 'emily')]),
    'having seen it, the question is now reachable');
  // And it is genuinely new: the only thing that changed is the persisted
  // experience, not the situation.
  assert.equal(canReach('ashai', 'ask_what_they_are_doing'), false);
});

test('beat 3 — the answer becomes available only once the question was asked', () => {
  assert.equal(canReach('emily', 'answer_literally', [observed('ashai', 'emily')]), false,
    'being watched is not being asked');
  assert.match(blockedReason('emily', 'answer_literally', [observed('ashai', 'emily')]),
    /has not been asked/);
  assert.ok(canReach('emily', 'answer_literally',
    [observed('ashai', 'emily'), asked('ashai', 'emily')]),
    'having been asked, the answer is reachable');
});

test('anti-telepathy — a character who was not there gains nothing', () => {
  // Goaden is added to the room *after* the fact, with no experience of his
  // own. The event exists; his witnessing does not.
  const withGoaden = [
    'char.goaden', `here.goaden.${PLACE}`, 'free.goaden', 'activity.goaden.unhurried_time',
    ...(CAST.get('goaden').traits ?? []).map(trait => `trait.goaden.${trait}`),
    observed('ashai', 'emily'),          // Ashai saw it. Goaden did not.
  ];
  const { ranked, blocked } = scoreCandidates({ view: viewFrom(facts(withGoaden)),
    practices: PRACTICES, actor: 'goaden', grammar: CAST.get('goaden'), seed: 'chain' });
  assert.equal(ranked.some(c => c.action.id === 'ask_what_they_are_doing'), false,
    'Goaden must not acquire the question from an event he was not in');
  assert.match(blocked.find(item => item.action === 'ask_what_they_are_doing')?.reason ?? '',
    /did not see them/);
  // And the person who *was* there still has it, in the same view.
  assert.ok(canReach('ashai', 'ask_what_they_are_doing', withGoaden));
});

test('the adapter only asserts an experience to somebody who is present', () => {
  const snapshot = { characters: {
    ashai: { id: 'ashai', location: 'mi6', area: 'common_room', activity: 'unhurried_time', knowledge: [] },
    goaden: { id: 'goaden', location: 'mi6', area: 'corridors', activity: 'unhurried_time', knowledge: [] },
  }, offscreenLives: { people: {} }, weather: { code: 'cloudy' }, factions: {}, facts: {} };
  const experiences = [
    { kind: 'observed', observer: 'ashai', actor: 'emily', thing: THING, at: T0, expiresAt: T0 + 60 * MIN },
    { kind: 'observed', observer: 'goaden', actor: 'emily', thing: THING, at: T0, expiresAt: T0 + 60 * MIN },
    // Expired: must not be asserted to anybody.
    { kind: 'asked', observer: 'ashai', actor: 'emily', thing: THING, at: T0 - 300 * MIN, expiresAt: T0 - 60 * MIN },
  ];
  const { sentences } = translate(snapshot, { now: T0 + 10 * MIN, location: 'mi6', area: 'common_room',
    experiences, castIds: CAST_IDS });
  assert.ok(sentences.includes(`observed.ashai.emily.${THING}`), 'the present witness keeps it');
  assert.equal(sentences.includes(`observed.goaden.emily.${THING}`), false,
    'Goaden is in the corridors; his experience is not asserted into this room');
  assert.equal(sentences.some(s => s.startsWith('asked.')), false, 'an expired experience is gone');
});

test('the chain is deterministic across replays', () => {
  const run = () => ['emily:observe_and_count', 'ashai:ask_what_they_are_doing', 'emily:answer_literally']
    .map((step, index) => {
      const [actor, action] = step.split(':');
      const carried = [observed('ashai', 'emily'), asked('ashai', 'emily')].slice(0, index);
      const { ranked } = scoreCandidates({ view: viewFrom(facts(carried)), practices: PRACTICES,
        actor, grammar: CAST.get(actor), seed: 'chain' });
      const found = ranked.find(candidate => candidate.action.id === action);
      return found ? `${step}@${found.score}` : `${step}@unreachable`;
    });
  assert.deepEqual(run(), run());
  assert.deepEqual(run(), ['emily:observe_and_count@12', 'ashai:ask_what_they_are_doing@10',
    'emily:answer_literally@10'].map((x, i) => run()[i]), 'stable across calls');
});

test('SHARED_PAUSE needs unhurried co-presence, not a fabricated waiting state', () => {
  const practice = PRACTICES.get('SHARED_PAUSE');
  assert.ok(practice, 'the practice was renamed');
  assert.equal(PRACTICES.has('SHARED_WAIT'), false);
  assert.equal(/waiting\./.test(JSON.stringify(practice)), false,
    'no line still asks for a waiting state');

  // A pair on their own, so that removing one person's freedom actually
  // removes the only candidate. (With a third free person in the room the
  // engine correctly binds `Other` to them instead, which is right and makes
  // the negative case untestable.)
  const pair = (extra = []) => viewFrom([
    'world.daypart.midday', 'world.weather.cloudy', 'world.faction.arcane.low',
    `sociable.${PLACE}`, `practice.shared_pause.${PLACE}`,
    ...['ashai', 'goaden'].flatMap(who => [
      `char.${who}`, `here.${who}.${PLACE}`, `activity.${who}.unhurried_time`,
      ...(CAST.get(who).traits ?? []).map(trait => `trait.${who}.${trait}`),
    ]),
    'familiar.ashai.goaden', 'familiar.goaden.ashai',
    ...extra,
  ]);
  const probe = (view, action = 'fill_the_silence') => {
    const { ranked, blocked } = scoreCandidates({ view, practices: PRACTICES, actor: 'ashai',
      grammar: CAST.get('ashai'), seed: 'chain' });
    return { reachable: ranked.some(c => c.action.id === action),
      reason: blocked.find(item => item.action === action)?.reason ?? null };
  };

  // Both unhurried: reachable.
  assert.ok(probe(pair(['free.ashai', 'free.goaden'])).reachable,
    'ordinary unhurried co-presence is enough');

  // He is mid-task: gone, and it says why.
  const busy = probe(pair(['free.ashai']));
  assert.equal(busy.reachable, false);
  assert.match(busy.reason, /in the middle of something/);

  // Somewhere nobody talks: gone, and it says why.
  const unsociable = probe(viewFrom([
    'world.daypart.midday', `practice.shared_pause.${PLACE}`,
    ...['ashai', 'goaden'].flatMap(who => [
      `char.${who}`, `here.${who}.${PLACE}`, `free.${who}`, `activity.${who}.unhurried_time`,
      ...(CAST.get(who).traits ?? []).map(trait => `trait.${who}.${trait}`),
    ]),
  ]));
  assert.equal(unsociable.reachable, false);
  assert.match(unsociable.reason, /not a place people talk/);
});

test('co-presence still does not oblige anybody to speak', () => {
  // Two people, free, somewhere sociable, nothing else true. The engine is
  // allowed to find this uninteresting and usually should.
  const view = viewFrom(facts([
    'char.goaden', `here.goaden.${PLACE}`, 'free.goaden', 'activity.goaden.unhurried_time',
    ...(CAST.get('goaden').traits ?? []).map(t => `trait.goaden.${t}`),
    'familiar.goaden.ashai', 'familiar.ashai.goaden',
    `practice.shared_pause.${PLACE}`,
  ]));
  const { proposal, audit } = evaluateMomentOpportunity({
    now: T0, day: DAY, location: 'somewhere', area: 'venue',
    presentCharacters: ['ashai', 'goaden'], view, practices: PRACTICES, cast: CAST,
    seed: 'chain', trigger: 'test', rules: MOMENT_RULES });
  assert.equal(proposal, null, `silence must remain available; got ${proposal?.action}`);
  assert.ok(audit.refusal, 'and it is reported as a decision rather than a gap');
});
