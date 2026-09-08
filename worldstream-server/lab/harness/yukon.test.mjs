import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../engine/adapter.mjs';
import { viewFrom, evaluateMomentOpportunity, MOMENT_RULES } from '../engine/engine.mjs';
import { scoreCandidates } from '../engine/score.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { CAST, CAST_IDS } from '../grammar/cast.mjs';
import { offscreenNightPlace, offscreenAwakeAtNight } from '../../src/offscreen-lives.mjs';
import { PRANK_SCENE, nightPrankScene } from '../../src/night-stories.mjs';

// The Yukon practice set, tested against the author's own acceptance criteria:
//
//   * actions are recognisably Yukon-specific;
//   * shapeshifting changes his available solutions;
//   * gaming produces competitive/playful behaviour;
//   * humour is relationship-aware;
//   * he can still return null;
//   * no Director required to make these fire.
//
// The situations below are built from the shape Worldstream actually supplies —
// an `offscreenLives` project with family `game_retry`, a location and an
// attempt number — rather than from invented state. That is the whole claim
// under test: the same boring gaming-room world state the engine has been
// looking at for 954 opportunities should now produce something only Yukon
// would ever do.

const NOW = Date.parse('2026-09-01T15:00:00Z');

/** One gaming-room situation, varied along the axes that should matter. */
function room({ attempt = 3, won = false, senior = false, witnessed = true,
  alone = false } = {}) {
  const characters = alone ? {} : {
    goaden: { id: 'goaden', location: 'mi6', area: 'gaming_room', activity: 'gaming' },
  };
  if (senior) characters.henderson = { id: 'henderson', location: 'mi6',
    area: 'gaming_room', activity: 'unhurried_time' };
  const snapshot = {
    characters, weather: { code: 'clear' }, factions: {}, encounter: null,
    offscreenLives: { people: { yukon: {
      lastSeen: { at: NOW - 5 * 60_000, location: 'mi6', area: 'gaming_room' },
      knowledge: [], activity: 'gaming', tier: 'tracked',
      currentProject: { id: 'life:abc123', family: 'game_retry', location: 'mi6',
        area: 'gaming_room', status: won ? 'settled' : 'open', attempt },
    } } },
  };
  return translate(snapshot, { now: NOW, location: 'mi6', area: 'gaming_room',
    castIds: CAST_IDS,
    witnessed: witnessed
      ? [{ observer: 'yukon', actor: 'goaden', what: 'said_the_flat_thing', at: NOW - 60_000 }]
      : [] });
}

const availableTo = (actor, sentences) => scoreCandidates({
  view: viewFrom(sentences), practices: PRACTICES, actor,
  grammar: CAST.get(actor), seed: 'yukon-test',
}).ranked.map(candidate => candidate.action.id);

test('the gaming room finally produces something, and it is competitive', () => {
  const { sentences, present } = room();
  assert.ok(present.includes('yukon'), 'Yukon should be present in his own gaming room');
  const available = availableTo('yukon', sentences);
  // The finding this whole practice set answers: 30 opportunities, 0 proposals,
  // and 0 `no_authored_surface` — his actions never became available at all.
  assert.ok(available.includes('try_again_immediately'),
    'losing a game he keeps losing should offer an immediate retry');
  assert.ok(available.includes('dispute_the_loss'),
    'a repeated loss should offer the argument that it did not count');
});

test('shapeshifting changes which solutions exist, rather than decorating one', () => {
  const { sentences } = room();
  const yukon = availableTo('yukon', sentences);
  const goaden = availableTo('goaden', sentences);
  for (const shift of ['mimic_person', 'lose_it_completely']) {
    assert.ok(yukon.includes(shift), `${shift} should be available to Yukon`);
    assert.ok(!goaden.includes(shift),
      `${shift} must not be available to Goaden, who cannot change shape`);
  }
  // And the ability is the reason, in the engine's own words.
  const { blocked } = scoreCandidates({ view: viewFrom(sentences), practices: PRACTICES,
    actor: 'goaden', grammar: CAST.get('goaden'), seed: 'yukon-test' });
  const why = blocked.find(item => item.action === 'mimic_person');
  assert.equal(why?.reason, 'cannot take another shape');
});

test('humour is relationship-aware: nothing to copy, no impression', () => {
  assert.ok(availableTo('yukon', room({ witnessed: true }).sentences).includes('mimic_person'),
    'having just watched Goaden do something should offer the impression');
  assert.ok(!availableTo('yukon', room({ witnessed: false }).sentences).includes('mimic_person'),
    'Yukon does not do an impression of somebody who has not just done anything');
});

test('a senior in the room changes the register, not merely the volume', () => {
  const available = availableTo('yukon', room({ senior: true }).sentences);
  // Canon: "despite his youth and humour, he carries a quiet authority that
  // even senior agents respect".
  assert.ok(!available.includes('mimic_person'),
    'he does not take the mickey in front of a general');
  assert.ok(!available.includes('lose_it_completely'),
    'and he certainly does not wreck the console in front of one');
  // The other half of him, which is what stops him being one note.
  assert.ok(available.includes('talk_too_much'),
    'seniority should move him toward talking too much instead');
});

test('winning and losing are different behaviours, not one behaviour re-lit', () => {
  const won = availableTo('yukon', room({ won: true }).sentences);
  const losing = availableTo('yukon', room({ won: false }).sentences);
  assert.ok(won.includes('victory_lap'), 'a win should offer the victory lap');
  assert.ok(!losing.includes('victory_lap'), 'a loss should not');
  // The attempt count survives a win, so an earlier version let a victorious
  // Yukon destroy the console in celebration. Both tags are required.
  assert.ok(!won.includes('lose_it_completely'),
    'winning must not leave the tantrum available');
  assert.ok(!won.includes('dispute_the_loss'),
    'winning must not leave the argument available');
  assert.ok(losing.includes('lose_it_completely'),
    'losing for the third time should make it available');
});

test('the tantrum is earned, not merely possible', () => {
  assert.ok(!availableTo('yukon', room({ attempt: 1 }).sentences).includes('lose_it_completely'),
    'one loss is not enough to become a bear about it');
  assert.ok(availableTo('yukon', room({ attempt: 3 }).sentences).includes('lose_it_completely'),
    'three is');
});

test('the mimic carries renderer instructions and needs no bespoke artwork', () => {
  const { sentences, present } = room();
  const { proposal } = evaluateMomentOpportunity({
    now: NOW, day: '2026-09-01', location: 'mi6', area: 'gaming_room', occurredAt: NOW,
    trigger: 'test', triggerEventId: 'test-1', presentCharacters: present,
    view: viewFrom(sentences), practices: PRACTICES, cast: CAST,
    // Yukon has already retried twice today, so the impression is what is left.
    history: { byCharacter: { yukon: [
      { at: NOW - 30 * 60_000, day: '2026-09-01', family: 'COMPETITIVE_RETRY:try_again_immediately',
        behaviour: 'try_again_immediately', surfaced: true, surface: 'retry_immediately' },
    ] }, world: [] },
    arcConstraints: {}, seed: 's', rulesVersion: 1, rules: MOMENT_RULES,
  });
  assert.ok(proposal, 'the room should produce a proposal');
  if (proposal.action !== 'mimic_person') return;   // retry may still win; that is fine
  assert.deepEqual(proposal.presentation, {
    kind: 'TRANSFORM_MIMIC', source: 'yukon', target: 'goaden',
    durationMs: 4500, tint: 'onari_grey', reuseTargetPlate: true, returnTo: 'yukon',
  }, 'roles must be resolved to real people so the renderer can reuse existing plates');
  assert.equal(proposal.presentationKey, 'mimic_line:goaden',
    'one bank per person impersonated');
});

test('alone, he does not perform to an empty room', () => {
  // He may well still retry — that is what he does — but nothing he says may
  // presuppose an audience that is not there. The first version of this bank
  // had him telling an empty gaming room to "watch this bit".
  const { sentences, present } = room({ alone: true, attempt: 1, witnessed: false });
  const { proposal } = evaluateMomentOpportunity({
    now: NOW, day: '2026-09-01', location: 'mi6', area: 'gaming_room', occurredAt: NOW,
    trigger: 'test', triggerEventId: 'test-2', presentCharacters: present,
    view: viewFrom(sentences), practices: PRACTICES, cast: CAST,
    history: { byCharacter: {}, world: [] }, arcConstraints: {},
    seed: 's', rulesVersion: 1, rules: MOMENT_RULES,
  });
  assert.deepEqual(present, ['yukon'], 'nobody else is in the room');
  if (proposal) {
    assert.ok(!/watch this bit|say it|did you see|you saw/i.test(proposal.line),
      `line presupposes an audience that is not there: ${proposal.line}`);
    assert.equal(proposal.participants.length, 1, 'a solo Moment has one participant');
  }
});

test('silence is still a valid answer for Yukon', () => {
  // A sighting outside his tier window. He was in the gaming room four hours
  // ago; he is not there now, and the engine does not get to imagine him.
  const snapshot = { characters: {}, weather: { code: 'clear' }, factions: {},
    encounter: null, offscreenLives: { people: { yukon: {
      lastSeen: { at: NOW - 9 * 3_600_000, location: 'mi6', area: 'gaming_room' },
      knowledge: [], activity: 'gaming', tier: 'tracked',
      presenceWindowMs: 240 * 60_000,
      currentProject: { id: 'life:abc123', family: 'game_retry', location: 'mi6',
        area: 'gaming_room', status: 'open', attempt: 3 } } } } };
  const { sentences, present } = translate(snapshot, { now: NOW, location: 'mi6',
    area: 'gaming_room', castIds: CAST_IDS, witnessed: [] });
  assert.deepEqual(present, [], 'a stale sighting is not a presence');
  const { proposal, audit } = evaluateMomentOpportunity({
    now: NOW, day: '2026-09-01', location: 'mi6', area: 'gaming_room', occurredAt: NOW,
    trigger: 'test', triggerEventId: 'test-3', presentCharacters: present,
    view: viewFrom(sentences), practices: PRACTICES, cast: CAST,
    history: { byCharacter: {}, world: [] }, arcConstraints: {},
    seed: 's', rulesVersion: 1, rules: MOMENT_RULES,
  });
  assert.equal(proposal, null, 'nobody here, nothing to say');
  assert.equal(audit.refusal, 'no_available_action', 'and the refusal names itself');
});

test('an impression is never a line the real person would say', () => {
  // The author's staging note, made into a rule: *"fake-Emily is doing too
  // much. Real Emily would somehow be worse while doing less."* An impression
  // that could pass for the target is not an impression, and — more to the
  // point — it removes the tell that lets Goaden work out what he is looking at.
  const yukon = CAST.get('yukon');
  const banks = Object.entries(yukon.quips)
    .filter(([key]) => key.startsWith('mimic_line:') || key.startsWith('night_prank:'));
  assert.ok(banks.length >= 3, 'there should be several faces to wear');

  for (const [key, bank] of banks) {
    const target = key.split(':')[1];
    const theirLines = new Set(Object.values(CAST.get(target)?.quips ?? {})
      .flat().map(entry => (typeof entry === 'string' ? entry : entry.text)));
    for (const entry of bank) {
      const line = typeof entry === 'string' ? entry : entry.text;
      assert.ok(!theirLines.has(line),
        `${key} borrows a line ${target} actually says: ${line}`);
    }
  }
});

test('the Emily impression does the one thing Emily never does', () => {
  // Her grammar forbids social reciprocity, scores `assistance` at -3 and gives
  // her `no_social_debt`. She does not notice how you are feeling, and she
  // never tells you about it. That is precisely what the impression does, and
  // it is why the scene works: he overplays the one axis she has none of.
  const emily = CAST.get('emily');
  assert.ok(emily.traits.includes('no_social_debt'));
  assert.ok(emily.manners.assistance < 0, 'Emily does not attend to other people');

  const hers = Object.values(emily.quips).flat()
    .map(entry => (typeof entry === 'string' ? entry : entry.text));
  const noticesYou = /you (look|seem|are) [a-z]*(frightened|scared|afraid|upset|worried)/i;
  assert.ok(!hers.some(line => noticesYou.test(line)),
    'Emily never remarks on how somebody else is feeling');

  const impression = CAST.get('yukon').quips['night_prank:emily']
    .map(entry => (typeof entry === 'string' ? entry : entry.text));
  assert.ok(impression.some(line => noticesYou.test(line)),
    'the impression must overshoot on exactly that axis — it is the tell');
});

test('none of this needs an Opportunity Director', () => {
  // The situation above is assembled only from fields Worldstream already
  // publishes: a character in a room, and an offscreen project with a family,
  // a location and an attempt number. Nothing schedules anybody.
  const { sentences } = room();
  assert.ok(sentences.some(fact => fact.startsWith('contest.')),
    'the contest comes from the world state, not from a director');
  assert.ok(sentences.includes('practice.competitive_retry.mi6_gaming_room'),
    'and the practice instance is derived from it');
});

// ------------------------------------------------------ the night residence
//
// These do not force the prank to happen. They check that it *can* become
// eligible under legitimate rare conditions, and that it stays unavailable
// otherwise — which is the only claim worth making about a rare event.

/** A quarters situation at a given instant, built from production's own declaration. */
function quarters({ at, awake = true, seenEmily = true, senior = false } = {}) {
  const characters = {
    goaden: { id: 'goaden', location: 'mi6', area: 'quarters', activity: 'sleeping' },
  };
  if (senior) characters.henderson = { id: 'henderson', location: 'mi6',
    area: 'quarters', activity: 'unhurried_time' };
  const home = offscreenNightPlace('yukon', at);
  const snapshot = {
    characters, weather: { code: 'clear' }, factions: {}, encounter: null,
    offscreenLives: { people: { yukon: {
      lastSeen: { at, location: home?.location ?? 'mi6', area: home?.area ?? 'quarters' },
      knowledge: [], tier: 'tracked', currentProject: null,
      activity: awake ? 'unhurried_time' : (home?.activity ?? 'sleeping'),
    } } },
  };
  return translate(snapshot, { now: at, location: 'mi6', area: 'quarters', castIds: CAST_IDS,
    witnessed: seenEmily
      ? [{ observer: 'yukon', actor: 'emily', what: 'counted_the_shadows', at: at - 3_600_000 }]
      : [] });
}

const NIGHT = Date.parse('2026-09-02T02:40:00Z');
const DAYTIME = Date.parse('2026-09-02T14:00:00Z');

test('production gives Yukon a night residence, and only at night', () => {
  assert.deepEqual(offscreenNightPlace('yukon', NIGHT),
    { location: 'mi6', area: 'quarters', activity: 'sleeping' });
  assert.equal(offscreenNightPlace('yukon', DAYTIME), null,
    'a residence is not a daytime location');
  assert.equal(offscreenNightPlace('goaden', NIGHT), null,
    'leads are simulated; they do not need one');
});

test('being awake in the small hours is rare and deterministic', () => {
  const nights = Array.from({ length: 66 }, (unused, day) => NIGHT + day * 86_400_000);
  const awake = nights.filter(at => offscreenAwakeAtNight('yukon', at, 'silver-clouds-now-v1'));
  assert.ok(awake.length > 0, 'it must be possible at all');
  assert.ok(awake.length / nights.length < 0.2,
    `awake ${awake.length}/66 nights is a timetable, not an oddity`);
  assert.equal(offscreenAwakeAtNight('yukon', NIGHT, 'seed-a'),
    offscreenAwakeAtNight('yukon', NIGHT, 'seed-a'), 'same inputs, same night');
});

test('the prank can become eligible under legitimate rare conditions', () => {
  const available = availableTo('yukon', quarters({ at: NIGHT }).sentences);
  assert.ok(available.includes('creep_in_wearing_a_face'),
    'awake, in the dark, beside a sleeper, wearing a face he has seen');
});

test('and is unavailable under every ordinary one', () => {
  const cases = [
    ['asleep himself', quarters({ at: NIGHT, awake: false })],
    ['has never seen the face', quarters({ at: NIGHT, seenEmily: false })],
    ['a senior is in the room', quarters({ at: NIGHT, senior: true })],
    ['it is the afternoon', quarters({ at: DAYTIME })],
  ];
  for (const [why, situation] of cases)
    assert.ok(!availableTo('yukon', situation.sentences).includes('creep_in_wearing_a_face'),
      `should be unavailable: ${why}`);
});

test('the Moment hands the chase to the night layer rather than performing it', () => {
  const { sentences, present } = quarters({ at: NIGHT });
  const { proposal } = evaluateMomentOpportunity({
    now: NIGHT, day: '2026-09-02', location: 'mi6', area: 'quarters', occurredAt: NIGHT,
    trigger: 'NIGHT_WINDOW', triggerEventId: 'night-1', presentCharacters: present,
    view: viewFrom(sentences), practices: PRACTICES, cast: CAST,
    history: { byCharacter: {}, world: [] }, arcConstraints: {},
    seed: 's', rulesVersion: 1, rules: MOMENT_RULES,
  });
  assert.ok(proposal, 'the rare night should produce the opening beat');
  assert.equal(proposal.action, 'creep_in_wearing_a_face');
  assert.equal(proposal.scene.scene, 'night_prank_chase');
  assert.equal(proposal.scene.actor, 'yukon');
  assert.ok(proposal.callbackSeedsCreated.length, 'the engine owns callback provenance');

  // The night layer accepts the handoff, and refuses to run it — because the
  // delayed consequence has not been decided. That refusal is the correct
  // state, not a failure.
  const scene = nightPrankScene(proposal.scene);
  assert.ok(scene, 'a well-formed request is recognised');
  assert.equal(scene.runnable, false);
  assert.match(scene.blocked, /no consequence decided/);
  assert.equal(PRANK_SCENE.closesWith, null,
    'the terminal beat must stay undecided until it represents something real');
  assert.ok(PRANK_SCENE.provisionalCopy, 'the chase dialogue is not final copy');
});
