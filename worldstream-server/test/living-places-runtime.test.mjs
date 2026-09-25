import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import {
  GARDEN_EXPOSURE_RULES, habitatAfterAction, livingPlacesAfterAction, issueLivingPlacesActions,
  resolveLivingPlacesAction, siteOpportunityActions, isQualifyingEcologicalSource,
  assertLivingPlaces, livingPlacesSerializedBytes, LIVING_PLACES_STATE_BUDGET,
} from '../src/living-places.mjs';

const START = atLondon('2026-09-04', '00:00');
const DAY = 24 * 60 * MIN;

// A narrow reducer harness isolates negative environmental/knowledge cases.
// The final test uses the production scheduler and WorldStore without seeding
// any ecological source, referral, site, notice, or recovery action.
function harness({ onari = true } = {}) {
  const state = createFixture({ startMs: START }).initialState();
  const pending = [];
  const events = [];
  function run(action) {
    action = { priority: 36, day: londonDate(action.dueAt), ...action };
    const event = { id: `event:${action.id}`, type: action.type, occurredAt: action.dueAt,
      visibility: 'private', location: action.location ?? null, area: action.area ?? null,
      participants: action.participants ?? [], payload: action.payload ?? {}, causedBy: [] };
    const ctx = { state, action, event, now: action.dueAt, id: event.id, seed: 'ecology-unit', followups: [],
      ops: {
        setLivingPlaces: value => { state.livingPlaces = value; },
        setOffscreenLives: value => { state.offscreenLives = value; },
        createFact(key, kind, subject, value, validUntil) {
          return state.facts[key] = { key, kind, subject, value, validUntil, createdAt: ctx.now, sourceEventId: ctx.id };
        },
        learn(who, fact, provenance) {
          const actor = state.characters[who];
          if (actor.knowledge.some(row => row.factKey === fact.key)) return;
          actor.knowledge.push({ factKey: fact.key, learnedAt: ctx.now, validUntil: fact.validUntil,
            sourceEventId: fact.sourceEventId, acquisitionEventId: ctx.id, provenance });
        },
        publish: () => { event.visibility = 'public'; },
        skip: reason => { event.payload = { outcome: 'skipped', reason }; },
      } };
    const handled = resolveLivingPlacesAction(ctx);
    if (!handled) event.visibility = 'public';
    if (isQualifyingEcologicalSource(event)) ctx.followups.push(...issueLivingPlacesActions(ctx,
      siteOpportunityActions({ state, now: ctx.now, parentActionId: action.id, parentEventId: ctx.id, sourceEvent: event })));
    habitatAfterAction(ctx);
    if (onari) livingPlacesAfterAction(ctx);
    assertLivingPlaces(state);
    pending.push(...ctx.followups);
    events.push(event);
    return event;
  }
  function weather(id, dueAt, weatherCode) {
    return run({ id, dueAt, type: 'WEATHER_CHANGE', payload: { weatherCode } });
  }
  function consume(type) {
    const i = pending.findIndex(action => action.type === type);
    assert.ok(i >= 0, `Expected pending ${type}`);
    const [action] = pending.splice(i, 1);
    return run(action);
  }
  return { state, pending, events, run, weather, consume };
}

test('only sustained committed wet weather creates one provenance-linked garden source', () => {
  const h = harness();
  h.weather('wet-start', START, 'storm');
  h.weather('wet-nearly', START + DAY - MIN, 'heavy_rain');
  assert.equal(h.pending.length, 0);
  h.weather('wet-through', START + DAY, 'storm');
  h.weather('wet-repeat', START + DAY + 1, 'storm');
  assert.equal(h.pending.filter(a => a.type === 'ECOLOGICAL_IMPACT_SOURCE').length, 1);
  const source = h.consume('ECOLOGICAL_IMPACT_SOURCE');
  assert.deepEqual(source.payload.provenance.evidenceEventIds, ['event:wet-start', 'event:wet-through']);
  assert.ok(source.causedBy.includes('event:wet-start'));
  assert.ok(source.causedBy.includes('event:wet-through'));
  h.consume('SITE_IMPACT_REGISTER');
  assert.equal(h.state.livingPlaces.sites.big_ben_plaza.status, 'disturbed');
  assert.equal(h.state.livingPlaces.activeCaseIds.length, 0);
  assert.equal(h.state.offscreenLives.people.yukon.knowledge.some(k => k.factKey === source.payload.sourceFactKey), false);
  h.weather('still-wet', START + 20 * DAY, 'storm');
  assert.equal(h.pending.some(a => a.type === 'ECOLOGICAL_IMPACT_SOURCE'), false);
});

test('isolated rain, generic incident tags, and a cancelled wet episode never create damage', () => {
  const h = harness();
  h.weather('rain', START, 'heavy_rain');
  h.weather('dry', START + DAY, 'clear');
  h.run({ id: 'incident', type: 'INCIDENT', dueAt: START + DAY + MIN,
    payload: { affectsLivingHabitat: true, consequenceKind: 'vegetation_damage' } });
  assert.equal(h.pending.length, 0);
  h.weather('rain-again', START + 2 * DAY, 'storm');
  h.weather('saturated', START + 3 * DAY, 'heavy_rain');
  h.weather('drained-before-source', START + 3 * DAY + 1, 'clear');
  const refused = h.consume('ECOLOGICAL_IMPACT_SOURCE');
  assert.equal(refused.payload.outcome, 'skipped');
  assert.equal(h.state.livingPlaces.habitatExposure.sourcePending, null);
  assert.deepEqual(h.state.livingPlaces.sources, {});
});

test('dry weather ends its owned source, recovers the site, and enforces episode cooldown', () => {
  const h = harness();
  h.weather('wet-one', START, 'storm');
  h.weather('wet-two', START + DAY, 'storm');
  h.consume('ECOLOGICAL_IMPACT_SOURCE');
  h.consume('SITE_IMPACT_REGISTER');
  h.weather('dry', START + 2 * DAY, 'clear');
  h.weather('still-dry', START + 2 * DAY + 1, 'clear');
  assert.equal(h.pending.filter(a => a.type === 'ECOLOGICAL_SOURCE_END').length, 1);
  h.consume('ECOLOGICAL_SOURCE_END');
  // Discard the original 24h begin: the source-end owns the new recovery start.
  const index = h.pending.findIndex(a => a.type === 'SITE_RECOVERY_BEGIN' && a.dueAt < START + 2 * DAY);
  if (index >= 0) h.pending.splice(index, 1);
  h.consume('SITE_RECOVERY_BEGIN');
  assert.equal(h.state.livingPlaces.sites.big_ben_plaza.status, 'recovering');
  h.consume('SITE_RECOVERY_DUE');
  assert.equal(h.state.livingPlaces.sites.big_ben_plaza.status, 'stable');
  assert.equal(Object.keys(h.state.livingPlaces.sources).length, 0);
  h.weather('wet-too-soon', START + 10 * DAY, 'storm');
  h.weather('saturated-too-soon', START + 11 * DAY, 'storm');
  assert.equal(h.pending.some(a => a.type === 'ECOLOGICAL_IMPACT_SOURCE'), false);
});

test('garden knowledge requires a visit; Onari referral requires a real knowledgeable Yukon encounter', () => {
  const h = harness();
  h.weather('wet-one', START, 'storm');
  h.weather('wet-two', START + DAY, 'storm');
  const source = h.consume('ECOLOGICAL_IMPACT_SOURCE');
  h.consume('SITE_IMPACT_REGISTER');
  const lead = h.state.characters.goaden;
  h.run({ id: 'uninformed-meeting', type: 'OFFSCREEN_ENCOUNTER', dueAt: START + DAY + 10 * MIN,
    location: 'mi6', area: lead.area, participants: ['goaden'], payload: { cast: ['goaden', 'yukon'] } });
  assert.equal(h.pending.some(a => a.type === 'ONARI_ECOLOGY_REFERRAL'), false);
  lead.location = 'big_ben_plaza'; lead.area = 'venue'; lead.journey = null;
  h.run({ id: 'visit', type: 'TRAVEL_ARRIVE', dueAt: START + DAY + 20 * MIN,
    location: lead.location, area: lead.area, participants: ['goaden'] });
  assert.equal(lead.knowledge.find(k => k.factKey === source.payload.sourceFactKey)?.acquisitionEventId, 'event:visit');
  assert.equal(h.pending.some(a => a.type === 'ONARI_ECOLOGY_REFERRAL'), false);
  lead.location = 'mi6'; lead.area = 'common_room';
  h.run({ id: 'informed-meeting', type: 'OFFSCREEN_ENCOUNTER', dueAt: START + DAY + 40 * MIN,
    location: lead.location, area: lead.area, participants: ['goaden'], payload: { cast: ['goaden', 'yukon'] } });
  h.run({ id: 'same-meeting', type: 'OFFSCREEN_ENCOUNTER', dueAt: START + DAY + 40 * MIN + 1,
    location: lead.location, area: lead.area, participants: ['goaden'], payload: { cast: ['goaden', 'yukon'] } });
  assert.equal(h.pending.filter(a => a.type === 'ONARI_ECOLOGY_REFERRAL').length, 1);
  const referral = h.consume('ONARI_ECOLOGY_REFERRAL');
  assert.ok(referral.causedBy.includes('event:informed-meeting'));
  assert.equal(h.state.offscreenLives.people.yukon.knowledge.some(k => k.factKey === source.payload.sourceFactKey), true);
  assert.equal(h.pending.some(a => a.type === 'ONARI_ECOLOGY_NOTICE'), true);
});

test('owned ecological action payload cannot be changed after issuance', () => {
  const h = harness();
  h.weather('wet-one', START, 'storm');
  h.weather('wet-two', START + DAY, 'storm');
  const source = h.pending.find(a => a.type === 'ECOLOGICAL_IMPACT_SOURCE');
  const event = h.run({ ...source, locationId: 'onari_village', impact: 'moderate' });
  assert.equal(event.payload.outcome, 'skipped');
  assert.deepEqual(h.state.livingPlaces.sources, {});
});

test('cached or widely separated external rain observations cannot manufacture sustained exposure', () => {
  const h = harness();
  h.state.weather.external = true;
  h.weather('cached-one', START, 'storm');
  h.weather('cached-two', START + DAY, 'storm');
  assert.equal(h.state.livingPlaces.habitatExposure, undefined);
  h.run({ id: 'measured-one', dueAt: START + 2 * DAY, type: 'WEATHER_OBSERVATION', payload: { weatherCode: 'storm' } });
  h.run({ id: 'measured-gap', dueAt: START + 3 * DAY, type: 'WEATHER_OBSERVATION', payload: { weatherCode: 'storm' } });
  assert.equal(h.pending.length, 0);
  assert.equal(h.state.livingPlaces.habitatExposure.wetSince, START + 3 * DAY);
});

test('source cessation before site registration cannot erase committed physical damage', () => {
  const h = harness();
  h.weather('wet-one', START, 'storm');
  h.weather('wet-two', START + DAY, 'storm');
  h.consume('ECOLOGICAL_IMPACT_SOURCE');
  h.weather('early-dry', START + DAY + 2 * MIN, 'clear');
  h.consume('ECOLOGICAL_SOURCE_END');
  h.consume('SITE_IMPACT_REGISTER');
  assert.equal(h.state.livingPlaces.sites.big_ben_plaza.status, 'disturbed');
  h.consume('SITE_RECOVERY_BEGIN');
  assert.equal(h.state.livingPlaces.sites.big_ben_plaza.status, 'recovering');
});

test('renewed rain invalidates a pending dry-weather source end', () => {
  const h = harness();
  h.weather('wet-one', START, 'storm');
  h.weather('wet-two', START + DAY, 'storm');
  h.consume('ECOLOGICAL_IMPACT_SOURCE');
  h.consume('SITE_IMPACT_REGISTER');
  h.weather('dry', START + 2 * DAY, 'clear');
  h.weather('renewed-storm', START + 2 * DAY + 1, 'storm');
  assert.equal(h.consume('ECOLOGICAL_SOURCE_END').payload.outcome, 'skipped');
  assert.equal(Object.keys(h.state.livingPlaces.sources).length, 1);
  h.weather('dry-again', START + 2 * DAY + 2 * MIN, 'clear');
  assert.equal(h.pending.filter(a => a.type === 'ECOLOGICAL_SOURCE_END').length, 1);
});

test('physical ecology is identical without Onari and under opposite narrative pressure', () => {
  const on = harness(), off = harness({ onari: false });
  on.state.narrativeSignals = { arbitraryStoryPressure: 1000000 };
  off.state.narrativeSignals = { arbitraryStoryPressure: -1000000 };
  for (const h of [on, off]) {
    h.weather('wet-one', START, 'storm');
    h.weather('wet-two', START + DAY, 'storm');
    h.consume('ECOLOGICAL_IMPACT_SOURCE');
    h.consume('SITE_IMPACT_REGISTER');
    h.weather('dry', START + 2 * DAY, 'clear');
    h.consume('ECOLOGICAL_SOURCE_END');
  }
  assert.deepEqual(on.state.livingPlaces, off.state.livingPlaces);
  assert.deepEqual(on.events, off.events);
  assert.deepEqual(on.pending, off.pending);
});

test('Emily shares only a garden source she actually observed at an existing appearance', () => {
  const h = harness();
  h.weather('wet-one', START, 'storm');
  h.weather('wet-two', START + DAY, 'storm');
  const source = h.consume('ECOLOGICAL_IMPACT_SOURCE');
  h.consume('SITE_IMPACT_REGISTER');
  const lead = h.state.characters.goaden;
  h.run({ id: 'before-observation', type: 'OFFSCREEN_ENCOUNTER', dueAt: START + DAY + 10 * MIN,
    location: lead.location, area: lead.area, participants: ['goaden'], payload: { cast: ['emily', 'goaden'] } });
  assert.equal(lead.knowledge.some(k => k.factKey === source.payload.sourceFactKey), false);
  h.run({ id: 'emily-gardens', type: 'OFFSCREEN_START', dueAt: START + DAY + 15 * MIN,
    location: 'big_ben_plaza', area: 'venue', payload: { cast: ['emily'] } });
  h.run({ id: 'after-observation', type: 'OFFSCREEN_ENCOUNTER', dueAt: START + DAY + 20 * MIN,
    location: lead.location, area: lead.area, participants: ['goaden'], payload: { cast: ['emily', 'goaden'] } });
  assert.equal(lead.knowledge.find(k => k.factKey === source.payload.sourceFactKey)?.provenance, 'told_by_emily');
});

test('WorldStore commits witnessed damage, real travel and a performed Yukon encounter before owning its referral', () => {
  const fixture = createFixture({ startMs: START }), initial = fixture.initialState();
  const at = START + 12 * 60 * MIN, meetingAt = at + 45 * MIN;
  // A controlled, explicitly sourced incident and an already agreed return
  // isolate the causal route. No referral/notice is seeded or resolved by hand.
  Object.assign(initial.characters.goaden, { location: 'big_ben_plaza', area: 'gardens',
    activity: 'unhurried_time', activitySince: at - MIN, activityUntil: null, journey: null });
  initial.sceneBank.nextEligibleAt = meetingAt;
  initial.sceneBank.nextNimbusAt = START + DAY;
  initial.arrangements['fixture-return'] = { party: ['goaden'], activity: 'city_walk',
    status: 'accepted', startAt: at + 10 * MIN, until: at + 60 * MIN, duration: 20,
    sourceEventId: 'fixture:agreed-return', acceptanceEventId: 'fixture:accepted-return' };
  const source = { id: 'fixture/garden-source', type: 'ECOLOGICAL_IMPACT_SOURCE', dueAt: at + MIN,
    day: londonDate(at), priority: 36, actors: [], version: 1, locationId: 'big_ben_plaza', areaId: 'gardens',
    consequenceKind: 'vegetation_damage', impact: 'minor', affectsLivingHabitat: true,
    provenance: { path: 'observation' } };
  initial.livingPlaces.issued[source.id] = { shape: { id: source.id, type: source.type, dueAt: source.dueAt,
    day: source.day, priority: source.priority }, sourceEventId: 'fixture:source-observation', consumed: false };
  const actions = [source,
    { id: 'fixture/return', type: 'TRAVEL_DEPART', dueAt: at + 10 * MIN, priority: 10,
      day: londonDate(at), actors: ['goaden'], from: 'big_ben_plaza', to: 'mi6', duration: 20, arrangementKey: 'fixture-return' },
    { id: 'fixture/game', type: 'GAME_BEGIN', dueAt: at + 35 * MIN, priority: 20,
      day: londonDate(at), actor: 'goaden', duration: 90 },
    // Presence itself carries no information. The real scene scheduler may
    // then book and perform an available canon conversation with Yukon.
    { id: 'fixture/yukon-present', type: 'SIDE_PRESENCE', dueAt: meetingAt, priority: 25,
      day: londonDate(at), actors: ['goaden'], who: 'yukon', area: 'gaming_room', line: 0 },
  ];
  const world = new WorldStore({ dbPath: ':memory:', seed: 'ecology-full-fixture',
    fixture: { ...fixture, initialState: () => structuredClone(initial), initialActions: () => actions } });
  try {
    world.advance(at + 2 * 60 * MIN);
    const snap = world.semanticSnapshot(), committed = snap.events.filter(e => e.payload?.outcome !== 'skipped');
    const sourceEvent = committed.find(e => e.type === 'ECOLOGICAL_IMPACT_SOURCE');
    const performance = committed.find(e => e.type === 'SCENE_BANK_BEAT' && e.payload.cast.includes('yukon'));
    const referral = committed.find(e => e.type === 'ONARI_ECOLOGY_REFERRAL');
    const notice = committed.find(e => e.type === 'ONARI_ECOLOGY_NOTICE');
    assert.ok(sourceEvent && performance && referral && notice,
      JSON.stringify(committed.map(e => ({ type: e.type, payload: e.payload }))));
    assert.ok(committed.some(e => e.type === 'TRAVEL_ARRIVE' && e.payload.to === 'mi6'));
    assert.equal(snap.characters.goaden.knowledge.find(k => k.factKey === sourceEvent.payload.sourceFactKey)?.acquisitionEventId, sourceEvent.id);
    assert.ok(referral.causedBy.includes(performance.id));
    assert.ok(notice.causedBy.includes(referral.id));
    assert.ok(sourceEvent.occurredAt < performance.occurredAt && performance.occurredAt < referral.occurredAt);
  } finally { world.close(); }
});

test('ordinary production weather organically creates sourced ecology and recovery without manufacturing Onari knowledge', () => {
  const world = new WorldStore({ dbPath: ':memory:', seed: 'silver-clouds-now-v1', fixture: createFixture({ startMs: START }) });
  try {
    world.advance(START + 45 * DAY);
    const snap = world.semanticSnapshot();
    const committed = snap.events.filter(event => event.payload?.outcome !== 'skipped');
    const sources = committed.filter(event => event.type === 'ECOLOGICAL_IMPACT_SOURCE');
    assert.ok(sources.length > 0, 'Natural weather must produce a real dedicated source');
    for (const source of sources) {
      assert.equal(source.location, GARDEN_EXPOSURE_RULES.locationId);
      assert.equal(source.payload.provenance.mechanism, 'sustained_root_saturation');
      for (const id of source.payload.provenance.evidenceEventIds) {
        const evidence = committed.find(event => event.id === id);
        assert.equal(evidence?.type, 'WEATHER_CHANGE');
        assert.ok(evidence.occurredAt < source.occurredAt);
      }
    }
    for (const type of ['SITE_IMPACT_REGISTER', 'ECOLOGICAL_SOURCE_END', 'SITE_RECOVERY_DUE'])
      assert.ok(committed.some(event => event.type === type), `Natural world must reach ${type}`);
    for (const referral of committed.filter(event => event.type === 'ONARI_ECOLOGY_REFERRAL')) {
      assert.ok(referral.causedBy.some(id => committed.some(event => event.id === id
        && ['OFFSCREEN_ENCOUNTER', 'OFFSCREEN_RESULT', 'SUPPORTING_ENCOUNTER', 'SUPPORTING_OUTCOME',
          'CROSS_PATHS', 'SCENE_BANK_BEAT'].includes(event.type))),
      'A natural referral must retain a real encounter source');
    }
    assert.ok(livingPlacesSerializedBytes(snap) <= LIVING_PLACES_STATE_BUDGET);
  } finally { world.close(); }
});
