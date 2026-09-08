import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWorld } from './run.mjs';
import { evaluateMomentOpportunity, viewFrom, MOMENT_RULES } from '../engine/engine.mjs';
import { scoreCandidates } from '../engine/score.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { CAST } from '../grammar/cast.mjs';
import { validateProposal } from '../engine/validate.mjs';
import { atLondon } from '../../src/time.mjs';

// The seven acceptance tests from section 24, plus the rails from 17 and 20.
// They are written against the engine rather than against a recorded output, so
// a change in the grammar that breaks the premise fails here rather than in a
// hundred-day run somebody reads afterwards.

const NOW = atLondon('2026-03-10', '14:30');
const base = (extra = []) => [
  'world.daypart.midday', 'world.weather.cloudy', 'world.faction.arcane.low',
  ...extra,
];
const plaza = (people, extra = []) => viewFrom(base([
  ...people.flatMap(person => [
    `char.${person.id}`, `here.${person.id}.big_ben_plaza_venue`,
    `activity.${person.id}.unhurried_time`, `free.${person.id}`,
    ...(person.traits ?? []).map(trait => `trait.${person.id}.${trait}`),
    ...(person.abilities ?? []).map(ability => `ability.${person.id}.${ability}`),
    ...(person.alone === false ? [] : [`alone.${person.id}`]),
  ]),
  'affordance.crowd.at.big_ben_plaza_venue', 'affordance.crowd.tag.countable',
  'affordance.crowd.tag.perceptible', 'affordance.crowd.tag.social',
  // Semantic properties, added in v2. A line only binds to a target whose
  // properties make its wording true.
  'affordance.crowd.prop.can_depart_return', 'affordance.crowd.prop.pairable',
  'affordance.crowd.prop.listener_can_be_member', 'affordance.crowd.prop.animate_population',
  'affordance.benches.at.big_ben_plaza_venue', 'affordance.benches.tag.sittable',
  'affordance.plaza_shadows.at.big_ben_plaza_venue', 'affordance.plaza_shadows.tag.shadowed',
  'affordance.plaza_shadows.tag.perceptible', 'affordance.plaza_shadows.tag.countable',
  'affordance.plaza_shadows.prop.unconscious_behaviour',
  'affordance.plaza_shadows.prop.spatially_ordered', 'affordance.plaza_shadows.prop.pairable',
  'practice.public_idle.big_ben_plaza_venue',
  'practice.person_alone_encounter.big_ben_plaza_venue',
  ...extra,
]));

const EMILY = { id: 'emily', traits: ['counts_things', 'answers_literally', 'reads_as_child',
  'unhurried', 'no_social_debt'], abilities: ['fade'] };
const ASHAI = { id: 'ashai', traits: ['protective', 'norm_compliant', 'finishes_the_movement'] };
const GOADEN = { id: 'goaden', traits: ['watchful', 'deadpan', 'unbothered', 'deflects_concern'] };
const YUKON = { id: 'yukon', traits: ['loud', 'competitive', 'impatient', 'physical'],
  abilities: ['shapeshift'] };

const evaluate = (view, present, options = {}) => evaluateMomentOpportunity({
  now: NOW, day: '2026-03-10', location: 'big_ben_plaza', area: 'venue',
  presentCharacters: present, view, practices: PRACTICES, cast: CAST,
  seed: 'test-seed', trigger: 'test', ...options });

// ---------------------------------------------------------------- Test 1
test('Test 1 — the plaza encounter arises without a hardcoded plaza scene', () => {
  const view = plaza([{ ...EMILY }, { ...ASHAI, alone: false }, { ...GOADEN, alone: false }], [
    'companion.ashai.goaden', 'companion.goaden.ashai',
    'familiar.ashai.goaden', 'familiar.goaden.ashai',
  ]);
  const { proposal } = evaluate(view, ['ashai', 'emily', 'goaden']);
  assert.ok(proposal, 'the situation should produce a moment');

  // Nothing in the library names Emily, the plaza, or counting-in-a-plaza.
  const source = JSON.stringify([...PRACTICES.values()]);
  assert.equal(/emily/i.test(source), false, 'no practice may name Emily');
  assert.equal(/plaza/i.test(source), false, 'no practice may name the plaza');

  // The three ingredients of the gold-standard beat are all reachable here.
  const emily = scoreCandidates({ view, practices: PRACTICES, actor: 'emily',
    grammar: CAST.get('emily'), seed: 'test-seed' });
  const ashai = scoreCandidates({ view, practices: PRACTICES, actor: 'ashai',
    grammar: CAST.get('ashai'), seed: 'test-seed' });
  const goaden = scoreCandidates({ view, practices: PRACTICES, actor: 'goaden',
    grammar: CAST.get('goaden'), seed: 'test-seed' });
  const has = (result, id) => result.ranked.some(candidate => candidate.action.id === id);
  assert.ok(has(emily, 'observe_and_count'), 'Emily can be observed counting something');
  assert.ok(has(ashai, 'approach_person_alone'), 'Ashai can approach a child on her own');
  assert.ok(has(goaden, 'keep_distance'), 'Goaden can decline to');

  // And they rank differently, which is the whole point.
  assert.notEqual(ashai.ranked[0].action.id, goaden.ranked[0].action.id,
    'Ashai and Goaden must not reach for the same action');
});

// ---------------------------------------------------------------- Test 2
test('Test 2 — one behaviour, many manifestations, still recognisably Emily', () => {
  const things = ['crowd', 'pigeons', 'bell_strikes', 'lit_windows', 'lanterns',
    'people_avoiding', 'plaza_shadows', 'stops', 'passengers', 'soldiers'];
  const found = new Set();
  for (const thing of things) {
    const view = viewFrom(base([
      'char.emily', 'here.emily.anywhere', 'free.emily', 'alone.emily',
      'activity.emily.unhurried_time',
      ...EMILY.traits.map(trait => `trait.emily.${trait}`),
      `affordance.${thing}.at.anywhere`, `affordance.${thing}.tag.countable`,
      `affordance.${thing}.tag.perceptible`,
      // Test 2 asks whether one behaviour binds to many targets, which is a
      // question about the practice, not about which wording fits. Give every
      // target the full property set so the binding is what is measured.
      ...['animate_population', 'can_depart_return', 'listener_can_be_member',
        'unconscious_behaviour', 'spatially_ordered', 'pairable']
        .map(prop => `affordance.${thing}.prop.${prop}`),
      'practice.public_idle.anywhere',
    ]));
    const { ranked } = scoreCandidates({ view, practices: PRACTICES, actor: 'emily',
      grammar: CAST.get('emily'), seed: 'test-seed' });
    const counting = ranked.find(candidate => candidate.action.id === 'observe_and_count');
    if (counting) found.add(counting.bindings.Thing);
  }
  assert.equal(found.size, things.length,
    `one authored behaviour should bind to every countable thing; bound to ${found.size}/${things.length}`);
});

// ---------------------------------------------------------------- Test 3
test('Test 3 — Emily may spend ten years on a puddle; Ashai may not, and the reason differs', () => {
  const inconvenience = who => viewFrom(base([
    `char.${who.id}`, `here.${who.id}.turnstile`, `free.${who.id}`, `alone.${who.id}`,
    `activity.${who.id}.unhurried_time`,
    ...who.traits.map(trait => `trait.${who.id}.${trait}`),
    ...(who.abilities ?? []).map(ability => `ability.${who.id}.${ability}`),
    'obstacle.standing_water.at.turnstile', 'obstacle.standing_water.tag.navigable',
    // A puddle is not something you can shift, and since `move_it` started
    // testing `tag.movable` positively — rather than the old `not tag.fixed`,
    // which made every unnailed thing in the world shiftable, including a queue
    // of people — the puddle alone no longer offers it. The fixture gains
    // something genuinely shiftable rather than the assertion losing `move_it`:
    // the point of this test is that Fade wins against a *full* field of
    // ordinary answers, so the field has to stay full and every option in it
    // has to be true.
    //
    // The author's suggestion, and it is a better fixture than the crate it
    // replaces: masonry Emily brought down over something trivial. The comedy
    // is the disproportion, not Emily — canon gives her superhuman strength and
    // a casualness about consequences, which is exactly what makes a whole
    // frontage a plausible answer to an inconvenience.
    //
    // **Nothing in Worldstream currently produces this.** Its incidents are
    // alarms, readiness alerts and arcane surges; none leave anything in the
    // way. It is legitimate here because a fixture is explicitly hypothetical,
    // and it is deliberately *not* in `obstacleFacts`, which may only describe
    // obstacles the world state actually supports. See SHADOW-FINDINGS.md.
    'obstacle.fallen_masonry.at.turnstile', 'obstacle.fallen_masonry.tag.navigable',
    'obstacle.fallen_masonry.tag.movable',
    'affordance.plaza_shadows.at.turnstile', 'affordance.plaza_shadows.tag.shadowed',
    'affordance.market_stall.at.turnstile', 'affordance.market_stall.tag.askable',
    'practice.minor_inconvenience.turnstile',
  ]));

  const emily = scoreCandidates({ view: inconvenience(EMILY), practices: PRACTICES,
    actor: 'emily', grammar: CAST.get('emily'), seed: 'test-seed' });
  assert.equal(emily.ranked[0].action.id, 'use_fade',
    'Emily should choose Fade over four ordinary answers that are all available to her');
  // Every ordinary option was genuinely on the table. This is what makes it a
  // choice rather than the only thing that was possible.
  for (const id of ['wait_it_out', 'go_around', 'ask_for_help', 'move_it'])
    assert.ok(emily.ranked.some(candidate => candidate.action.id === id), `${id} was available to Emily`);
  const why = emily.ranked[0].sways.sort((a, b) => b.score - a.score)[0];
  assert.match(why.name, /shortens this/, 'the deciding influence is her wanting an ending');

  // Ashai: could not, and separately would not.
  const ashai = scoreCandidates({ view: inconvenience(ASHAI), practices: PRACTICES,
    actor: 'ashai', grammar: CAST.get('ashai'), seed: 'test-seed' });
  assert.equal(ashai.ranked.some(candidate => candidate.action.id === 'use_fade'), false);
  const blocked = ashai.blocked.find(item => item.action === 'use_fade');
  assert.equal(blocked.reason, 'does not possess Fade');

  // With the ability granted, the grammar still refuses — and says so.
  const armed = viewFrom([...['char.ashai', 'here.ashai.turnstile', 'free.ashai', 'alone.ashai',
    'activity.ashai.unhurried_time', 'ability.ashai.fade',
    'obstacle.standing_water.at.turnstile', 'obstacle.standing_water.tag.navigable',
    'affordance.plaza_shadows.at.turnstile', 'affordance.plaza_shadows.tag.shadowed',
    'practice.minor_inconvenience.turnstile'], ...ASHAI.traits.map(t => `trait.ashai.${t}`)]);
  const forced = scoreCandidates({ view: armed, practices: PRACTICES, actor: 'ashai',
    grammar: CAST.get('ashai'), seed: 'test-seed' });
  const refused = forced.rejected.find(item => item.action === 'use_fade');
  assert.ok(refused, 'a grammar-level refusal, distinct from the ability gate');
  assert.match(refused.reason, /would not use a forbidden technique/);
});

// ---------------------------------------------------------------- Test 4
test('Test 4 — four characters, one inconvenience, four structurally different answers', () => {
  const situation = who => viewFrom(base([
    `char.${who.id}`, `here.${who.id}.corridor`, `free.${who.id}`, `alone.${who.id}`,
    `activity.${who.id}.unhurried_time`,
    ...who.traits.map(trait => `trait.${who.id}.${trait}`),
    ...(who.abilities ?? []).map(ability => `ability.${who.id}.${ability}`),
    'obstacle.trolley.at.corridor', 'obstacle.trolley.tag.navigable',
    'affordance.plaza_shadows.at.corridor', 'affordance.plaza_shadows.tag.shadowed',
    'affordance.serving_hatch.at.corridor', 'affordance.serving_hatch.tag.askable',
    'practice.minor_inconvenience.corridor',
  ]));
  const chosen = {};
  for (const who of [EMILY, ASHAI, GOADEN, YUKON]) {
    const { ranked } = scoreCandidates({ view: situation(who), practices: PRACTICES,
      actor: who.id, grammar: CAST.get(who.id), seed: 'test-seed' });
    chosen[who.id] = ranked[0].action.id;
  }
  assert.equal(new Set(Object.values(chosen)).size, 4,
    `four characters should reach four different answers, got ${JSON.stringify(chosen)}`);
});

// ---------------------------------------------------------------- Test 5
test('Test 5 — a committed moment makes an action available that did not exist before', () => {
  const without = viewFrom(base([
    'char.ashai', 'char.goaden', 'here.ashai.hall', 'here.goaden.hall',
    'free.ashai', 'free.goaden',
    'activity.ashai.unhurried_time', 'activity.goaden.unhurried_time',
    'familiar.ashai.goaden', 'familiar.goaden.ashai',
    'sociable.hall', 'practice.shared_pause.hall',
  ]));
  const before = scoreCandidates({ view: without, practices: PRACTICES, actor: 'ashai',
    grammar: CAST.get('ashai'), seed: 'test-seed' });
  assert.equal(before.ranked.some(c => c.action.id === 'call_back_earlier'), false,
    'with no earned callback the action does not exist');
  const blocked = before.blocked.find(item => item.action === 'call_back_earlier');
  assert.match(blocked.reason, /no earned callback/);

  const withSeed = viewFrom(base([
    'char.ashai', 'char.goaden', 'here.ashai.hall', 'here.goaden.hall',
    'free.ashai', 'free.goaden',
    'activity.ashai.unhurried_time', 'activity.goaden.unhurried_time',
    'familiar.ashai.goaden', 'familiar.goaden.ashai',
    'sociable.hall', 'practice.shared_pause.hall',
    'callback.coat_comfortable.by.ashai', 'callback.coat_comfortable.about.goaden',
    'callback.coat_comfortable.topic.coat_comfortable',
  ]));
  const after = scoreCandidates({ view: withSeed, practices: PRACTICES, actor: 'ashai',
    grammar: CAST.get('ashai'), seed: 'test-seed' });
  assert.ok(after.ranked.some(c => c.action.id === 'call_back_earlier'),
    'the past event enlarges the present action set');
});

// ---------------------------------------------------------------- Test 6
test('Test 6 — a hard arc obligation silences the engine entirely', () => {
  const view = plaza([{ ...EMILY }]);
  const free = evaluate(view, ['emily']);
  assert.ok(free.proposal, 'on an ordinary day the engine has an opinion');
  const railed = evaluate(view, ['emily'], {
    arcConstraints: { hardObligation: true, reason: 'arc mid-beat' } });
  assert.equal(railed.proposal, null);
  assert.equal(railed.audit.refusal, 'arc_hard_obligation');
  assert.equal(railed.audit.considered, 0, 'nothing is even enumerated');
});

// ---------------------------------------------------------------- Test 7
test('Test 7 — identical world, identical seed, identical moment', () => {
  const first = runWorld({ days: 20 });
  const second = runWorld({ days: 20 });
  const shape = run => run.moments.map(moment => [moment.id, moment.at, moment.actor,
    moment.action, moment.family, moment.score, moment.line]);
  assert.deepEqual(shape(first), shape(second));
  // And the audit trail, not only the outcome.
  assert.deepEqual(first.stats.refusals, second.stats.refusals);

  const other = runWorld({ days: 20, seed: 'a-different-world' });
  assert.notDeepEqual(shape(first), shape(other), 'a different seed is a different world');
});

// -------------------------------------------------------- rails, section 17
test('rail — a costly effect from an unapproved action is refused at commit', () => {
  const proposal = {
    at: NOW, location: 'big_ben_plaza', area: 'venue', actor: 'emily',
    participants: ['emily'], action: 'improvised_shortcut', requiredFacts: [],
    requestedEffects: [{ kind: 'ability_used', ability: 'fade', authorApproved: true }],
    line: null, presentationKey: 'x',
  };
  const snapshot = { characters: {}, offscreenLives: { people: { emily: {
    lastSeen: { at: NOW, location: 'big_ben_plaza', area: 'venue' } } } } };
  const verdict = validateProposal(proposal, snapshot, { now: NOW });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'costly_effect_from_unapproved_action');
});

test('rail — the never-list cannot be requested at any score', () => {
  const snapshot = { characters: {}, offscreenLives: { people: { emily: {
    lastSeen: { at: NOW, location: 'big_ben_plaza', area: 'venue' } } } } };
  for (const kind of ['death', 'reveal', 'arc_resolved', 'faction_status_change']) {
    const verdict = validateProposal({ at: NOW, location: 'big_ben_plaza', area: 'venue',
      actor: 'emily', participants: ['emily'], action: 'use_fade', requiredFacts: [],
      requestedEffects: [{ kind }], line: null, presentationKey: 'x' }, snapshot, { now: NOW });
    assert.equal(verdict.code, 'forbidden_effect', `${kind} must be refused`);
  }
});

test('rail — anti-telepathy: a character cannot act on a fact they do not hold', () => {
  // The engine cannot reach for what the adapter never asserts. Proving the
  // negative directly: a condition on somebody else's knowledge finds nothing.
  const view = viewFrom(base(['char.ashai', 'here.ashai.hall', 'free.ashai',
    'knows.goaden.the_secret', 'practice.public_idle.hall']));
  const { solve } = { solve: null };
  assert.equal(JSON.stringify(view.root.knows.ashai ?? null), 'null',
    'Ashai has no knowledge branch, so nothing can bind through one');
});

test('rail — silence is a valid and frequent result', () => {
  const run = runWorld({ days: 30 });
  // Silence, not one particular way of arriving at it. This used to count only
  // `nothing_worth_surfacing`, which was a proxy that stopped being accurate
  // the moment SHARED_PAUSE gave the lunch hall a surfaceable-but-dull
  // candidate: the same opportunities now fall out at the interest floor
  // instead, which is the floor finally doing work rather than silence
  // disappearing. Measured across the change: 96.9% silent either way.
  const silent = run.stats.evaluations - run.moments.length;
  assert.ok(silent / run.stats.evaluations > 0.5,
    `most opportunities should produce nothing; got ${silent}/${run.stats.evaluations}`);
  assert.ok(run.moments.length / 30 < 2, 'fewer than two moments a day');
  // And it must be a decision rather than an absence: the engine has to have
  // looked at something and declined it. A run that produced silence because
  // nothing was ever available would pass the check above and be a bug.
  const declined = (run.stats.refusals.below_interest_floor ?? 0)
    + (run.stats.refusals.nothing_worth_surfacing ?? 0)
    + (run.stats.refusals.surface_spacing ?? 0)
    + (run.stats.refusals.every_fitting_line_is_cooling ?? 0);
  assert.ok(declined > (run.stats.refusals.no_available_action ?? 0),
    'silence should mostly be the engine declining, not the engine finding nothing');
});

test('rail — every committed moment passed the world validator', () => {
  const run = runWorld({ days: 30 });
  assert.equal(run.rejections.length, 0, JSON.stringify(run.rejections.map(r => r.verdict)));
  assert.ok(run.moments.every(moment => moment.line), 'every moment has an authored surface');
  assert.ok(run.moments.every(moment => moment.provenance.actionDefinition));
});

// ------------------------------------------------- Fade: canon vs presentation
//
// The rail this guards is an author ruling, not a preference: **Emily wants to
// perish, so she does casually use Fade.** How often she does it is a canon
// question. How often a reader is shown it is an editorial one. They are
// allowed different answers, and nothing in the decision path may ever conflate
// them.
//
// It exists because a dead branch nearly did. An earlier version suppressed
// costly actions before scoring, at the point where a character decides; the
// split moved that to the presentation gate, and the old branch survived as
// unreachable code referencing a constant that no longer existed. Inert, but
// re-adding the constant six months from now would silently give Emily a
// survival instinct she does not have. The branch is gone; this is what stops
// it coming back.
test('Fade frequency is a canon question, not a presentation one', () => {
  const base = runWorld({ days: 90 });
  const chosen = run => run.actions.filter(action => action.action === 'use_fade').length;
  const shown = run => run.moments.filter(moment => moment.action === 'use_fade').length;

  assert.ok(chosen(base) > 0, 'the fixture stopped producing Fade at all');
  assert.ok(chosen(base) > shown(base),
    'the split is not doing anything: every canonical use is being surfaced');

  // The supported range. Across every setting anyone would actually use, moving
  // the editorial dial must not move the canon.
  for (const days of [0, 1, 18, 60]) {
    const run = runWorld({ days: 90,
      rules: { ...MOMENT_RULES, costlyActionSurfaceCooldownDays: days } });
    assert.equal(chosen(run), chosen(base),
      `presentation cooldown of ${days} days changed how often Emily *chose* Fade `
      + `(${chosen(run)} vs ${chosen(base)}); it may only change what is shown`);
    assert.equal(run.lifespan.emily, base.lifespan.emily,
      `presentation cooldown of ${days} days changed the years she actually spent`);
  }

  // And it must genuinely be a dial on the showing.
  const heavy = runWorld({ days: 90,
    rules: { ...MOMENT_RULES, costlyActionSurfaceCooldownDays: 60 } });
  assert.ok(shown(heavy) < shown(base),
    'the presentation cooldown does nothing at all, which is its own bug');

  // Ten years a use, every use, whether or not the page mentions it.
  assert.equal(base.lifespan.emily, chosen(base) * 10,
    'the ledger and the canon cost have drifted apart');
});

// ---------------------------------------------------------- STRESS PROBE
//
// Not a supported setting. This exists to keep a known, documented coupling
// visible and bounded rather than silently drifting.
//
// The two pacing jobs — stopping a character repeating themselves, and stopping
// a reader seeing repetition — are both computed from surfaced history, so the
// first is a function of the second. An unshown act leaves its manifestation
// looking fresh, keeps its full score, and is chosen marginally sooner. Across
// 0–60 days the effect is exactly zero (asserted above). At 365 days, which
// nobody would set, one extra use appears.
//
// The fix is to measure decision-layer pacing against *chosen* history and
// leave presentation pacing on *surfaced*, which requires retuning decision
// fatigue and is deliberately deferred until after bank enrichment. Until then
// this characterises the coupling: it may not grow.
// See lab/FINDING-pacing-leak.md.
test('stress probe — the known pacing coupling stays bounded at absurd settings', () => {
  const base = runWorld({ days: 90 });
  const extreme = runWorld({ days: 90,
    rules: { ...MOMENT_RULES, costlyActionSurfaceCooldownDays: 365 } });
  const chosen = run => run.actions.filter(action => action.action === 'use_fade').length;
  const drift = chosen(extreme) - chosen(base);
  assert.ok(drift >= 0 && drift <= 1,
    `the coupling has changed size: ${chosen(base)} -> ${chosen(extreme)} (drift ${drift}). `
    + 'It was one extra use in ninety days at a 365-day cooldown. Either it has been '
    + 'fixed — delete this probe and unfreeze the supported-range test — or it has '
    + 'grown, which needs looking at.');
});
