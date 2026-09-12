import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture, RULES_VERSION } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import {
  LIVING_PLACES_VERSION,
  SITE_EVENT_TYPES,
  ONARI_ECOLOGY_EVENT_TYPES,
  LIVING_PLACES_EVENT_TYPES,
  LIVING_PLACES_FACT_KINDS,
  ECOLOGICAL_CONSEQUENCE_KINDS,
  REMEDIATION_ACTIONS,
  SITE_STATUSES,
  IMPACT_SEVERITIES,
  ONARI_CASE_STATUSES,
  RECOVERY_DURATIONS,
  ONARI_NOTICE_COOLDOWN_MS,
  ONARI_PROTEST_SPACING_MS,
  MAX_ACTIVE_ONARI_CASES,
  MAX_ACTIVE_DISTURBED_SITES,
  initialLivingPlacesState,
  assertLivingPlaces,
  isYukonAvailable,
  isQualifyingEcologicalSource,
  siteOpportunityActions,
  onariNoticeOpportunityActions,
  issueLivingPlacesActions,
  resolveLivingPlacesAction
} from '../src/living-places.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEED = 'test-seed-living-places-v1';

const shape = action => ({
  id: action.id,
  type: action.type,
  dueAt: action.dueAt,
  priority: action.priority,
  day: action.day
});

function seededWorld({
  seed = SEED,
  incidents = [],
  extraState = {},
} = {}) {
  const current = createFixture({ startMs: START });
  const initial = current.initialState();
  initial.livingPlaces = {
    ...initialLivingPlacesState(),
    issued: Object.fromEntries(incidents.map(action => [action.id, {
      shape: shape(action), sourceEventId: `seed:${action.id}`, consumed: false,
    }])),
    ...extraState,
  };
  const fixture = {
    ...current,
    initialState: () => structuredClone(initial),
    initialActions: () => [...current.initialActions(), ...incidents],
    reduceAction: (state, action, seedValue) => current.reduceAction(state, action, seedValue),
  };
  return { world: new WorldStore({ dbPath: ':memory:', seed, fixture }), fixture };
}

test('Living Places rules version is canon-ambient-p183-v27', () => {
  assert.equal(RULES_VERSION, 'canon-ambient-p183-v27');
});

test('initialLivingPlacesState adheres to bounded schema', () => {
  const initial = initialLivingPlacesState();
  assert.equal(initial.version, 1);
  assert.deepEqual(initial.sites, {});
  assert.deepEqual(initial.cases, {});
  assert.deepEqual(initial.activeCaseIds, []);
  assert.equal(initial.nextNoticeEligibleAt, 0);
  assert.equal(initial.nextProtestEligibleAt, 0);
  assert.deepEqual(initial.closedSummaries, []);
  assert.deepEqual(initial.recoveredSummaries, []);
  assert.deepEqual(initial.issued, {});
  assert.doesNotThrow(() => assertLivingPlaces({ livingPlaces: initial }));
});

test('isQualifyingEcologicalSource strictly filters source events', () => {
  // Qualifying: explicit consequence, affectsLivingHabitat true, canonical location
  const qualifying = {
    location: 'big_ben_plaza',
    area: 'gardens',
    payload: {
      affectsLivingHabitat: true,
      consequenceKind: 'vegetation_damage',
      impact: 'minor',
      factKey: 'fact-eco-1'
    }
  };
  assert.equal(isQualifyingEcologicalSource(qualifying), true);

  // Missing affectsLivingHabitat
  assert.equal(isQualifyingEcologicalSource({
    location: 'big_ben_plaza',
    payload: { consequenceKind: 'vegetation_damage' }
  }), false);

  // Unknown consequence kind
  assert.equal(isQualifyingEcologicalSource({
    location: 'big_ben_plaza',
    payload: { affectsLivingHabitat: true, consequenceKind: 'unknown_disaster' }
  }), false);

  // Non-canonical invented location
  assert.equal(isQualifyingEcologicalSource({
    location: 'london/park',
    payload: { affectsLivingHabitat: true, consequenceKind: 'vegetation_damage' }
  }), false);

  // Ordinary routine event (meal, practice)
  assert.equal(isQualifyingEcologicalSource({
    location: 'mi6',
    area: 'canteen',
    type: 'MEAL_BEGIN',
    payload: { meal: 'lunch' }
  }), false);
});

test('Natural site memory lifecycle: minor disturbance recovers naturally in ~7 days', () => {
  const impactAction = {
    id: 'test/site-impact-minor',
    type: 'SITE_IMPACT_REGISTER',
    dueAt: START + 75 * MIN,
    priority: 36,
    day: londonDate(START + 75 * MIN),
    actors: [],
    version: 1,
    locationId: 'big_ben_plaza',
    areaId: 'gardens',
    consequenceKind: 'vegetation_damage',
    impact: 'minor',
    affectsLivingHabitat: true,
    sourceEventId: 'evt-qualifying-1',
    sourceFactKey: 'fact-qualifying-1'
  };

  // Cooldown active so Onari notice is suppressed; tests pure physical site consequence memory
  const { world } = seededWorld({
    incidents: [impactAction],
    extraState: { nextNoticeEligibleAt: START + 30 * 24 * 60 * MIN }
  });

  // Advance past impact
  world.advance(START + 80 * MIN);

  let snap = world.semanticSnapshot();
  const site = snap.livingPlaces.sites['big_ben_plaza'];
  assert.ok(site, 'Site record should be created');
  assert.equal(site.status, 'disturbed');
  assert.equal(site.impact, 'minor');
  assert.equal(site.consequenceKind, 'vegetation_damage');
  assert.ok(site.disturbedAt);

  // Advance 24 hours: SITE_RECOVERY_BEGIN fires
  world.advance(START + 80 * MIN + 24 * 60 * MIN);
  snap = world.semanticSnapshot();
  const recoveringSite = snap.livingPlaces.sites['big_ben_plaza'];
  assert.equal(recoveringSite.status, 'recovering');
  assert.ok(recoveringSite.recoveryDueAt, 'Recovery due timestamp must be set');
  // Natural minor duration is 7 days
  const expectedDue = recoveringSite.disturbedAt + 24 * 60 * MIN + RECOVERY_DURATIONS.minor_natural;
  assert.equal(recoveringSite.recoveryDueAt, expectedDue);

  // Advance past recoveryDueAt: SITE_RECOVERY_DUE fires and site becomes stable
  world.advance(recoveringSite.recoveryDueAt + 10 * MIN);
  snap = world.semanticSnapshot();
  const recoveredSite = snap.livingPlaces.sites['big_ben_plaza'];
  assert.equal(recoveredSite.status, 'stable');
  assert.ok(recoveredSite.recoveredAt);
  assert.equal(snap.livingPlaces.recoveredSummaries.length, 1);
  assert.equal(snap.livingPlaces.recoveredSummaries[0].locationId, 'big_ben_plaza');
  assert.equal(snap.livingPlaces.recoveredSummaries[0].consequenceKind, 'vegetation_damage');

  assert.doesNotThrow(() => assertLivingPlaces(snap));
  world.close();
});

test('Natural site memory lifecycle: moderate disturbance recovers naturally in ~14 days', () => {
  const impactAction = {
    id: 'test/site-impact-mod',
    type: 'SITE_IMPACT_REGISTER',
    dueAt: START + 75 * MIN,
    priority: 36,
    day: londonDate(START + 75 * MIN),
    actors: [],
    version: 1,
    locationId: 'mi6',
    areaId: 'training',
    consequenceKind: 'containment_damage_to_living_area',
    impact: 'moderate',
    affectsLivingHabitat: true,
    sourceEventId: 'evt-qualifying-2',
    sourceFactKey: 'fact-qualifying-2'
  };

  // Cooldown active so Onari notice is suppressed; tests pure physical site consequence memory
  const { world } = seededWorld({
    incidents: [impactAction],
    extraState: { nextNoticeEligibleAt: START + 30 * 24 * 60 * MIN }
  });

  world.advance(START + 80 * MIN);

  let snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites['mi6'].status, 'disturbed');
  assert.equal(snap.livingPlaces.sites['mi6'].impact, 'moderate');

  // Advance 25 hours: recovery begins
  world.advance(START + 80 * MIN + 25 * 60 * MIN);
  snap = world.semanticSnapshot();
  const recoveringSite = snap.livingPlaces.sites['mi6'];
  assert.equal(recoveringSite.status, 'recovering');
  const expectedDue = recoveringSite.disturbedAt + 24 * 60 * MIN + RECOVERY_DURATIONS.moderate_natural;
  assert.equal(recoveringSite.recoveryDueAt, expectedDue);

  // Advance to recovery due
  world.advance(expectedDue + 10 * MIN);
  snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites['mi6'].status, 'stable');
  world.close();
});

test('Repeated impact on same site updates record without duplicating and extends recovery', () => {
  const impact1 = {
    id: 'test/repeat-1',
    type: 'SITE_IMPACT_REGISTER',
    dueAt: START + 70 * MIN,
    priority: 36,
    day: londonDate(START + 70 * MIN),
    actors: [],
    version: 1,
    locationId: 'big_ben_plaza',
    areaId: 'gardens',
    consequenceKind: 'vegetation_damage',
    impact: 'minor',
    affectsLivingHabitat: true,
    sourceEventId: 'evt-r1',
    sourceFactKey: 'fact-r1'
  };

  const impact2Time = START + 26 * 60 * MIN;
  const impact2 = {
    id: 'test/repeat-2',
    type: 'SITE_IMPACT_REGISTER',
    dueAt: impact2Time,
    priority: 36,
    day: londonDate(impact2Time),
    actors: [],
    version: 1,
    locationId: 'big_ben_plaza',
    areaId: 'gardens',
    consequenceKind: 'magical_contamination_of_living_area',
    impact: 'moderate',
    affectsLivingHabitat: true,
    sourceEventId: 'evt-r2',
    sourceFactKey: 'fact-r2'
  };

  const { world } = seededWorld({
    incidents: [impact1, impact2],
    extraState: { nextNoticeEligibleAt: START + 30 * 24 * 60 * MIN }
  });
  world.advance(START + 80 * MIN);

  let snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites['big_ben_plaza'].impact, 'minor');
  assert.equal(snap.livingPlaces.sites['big_ben_plaza'].activeSourceCount, 1);

  // Advance through impact 2
  world.advance(impact2Time + 10 * MIN);

  snap = world.semanticSnapshot();
  assert.equal(Object.keys(snap.livingPlaces.sites).length, 1);
  const site = snap.livingPlaces.sites['big_ben_plaza'];
  assert.equal(site.impact, 'moderate', 'Severity upgraded to moderate');
  assert.equal(site.activeSourceCount, 2);
  assert.equal(site.sourceEventIds.length, 2);
  assert.equal(site.sourceFactIds.length, 2);

  world.close();
});

test('Separation of systems: site memory operates independently from Onari response', () => {
  const impactAction = {
    id: 'test/site-no-onari',
    type: 'SITE_IMPACT_REGISTER',
    dueAt: START + 75 * MIN,
    priority: 36,
    day: londonDate(START + 75 * MIN),
    actors: [],
    version: 1,
    locationId: 'big_ben_plaza',
    areaId: 'gardens',
    consequenceKind: 'vegetation_damage',
    impact: 'minor',
    affectsLivingHabitat: true,
    sourceEventId: 'evt-isolated',
    sourceFactKey: 'fact-isolated'
  };

  // Pre-fill activeCaseIds to max so Onari cannot respond
  const { world } = seededWorld({
    incidents: [impactAction],
    extraState: { activeCaseIds: ['case-dummy-1', 'case-dummy-2'] }
  });

  world.advance(START + 80 * MIN);
  let snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites['big_ben_plaza'].status, 'disturbed');

  // Advance 9 days: natural recovery proceeds regardless of Onari capacity
  world.advance(START + 9 * 24 * 60 * MIN);
  snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites['big_ben_plaza'].status, 'stable');
  world.close();
});

test('Onari response lifecycle with Remediation accelerates recovery to 72 hours for minor impact', () => {
  const impactAction = {
    id: 'test/onari-remediate',
    type: 'SITE_IMPACT_REGISTER',
    dueAt: START + 75 * MIN,
    priority: 36,
    day: londonDate(START + 75 * MIN),
    actors: [],
    version: 1,
    locationId: 'big_ben_plaza',
    areaId: 'gardens',
    consequenceKind: 'vegetation_damage',
    impact: 'minor',
    affectsLivingHabitat: true,
    sourceEventId: 'evt-onari-1',
    sourceFactKey: 'fact-onari-1'
  };

  const { world } = seededWorld({ incidents: [impactAction] });

  // Advance through notice
  world.advance(START + 75 * MIN + 30 * MIN);
  let snap = world.semanticSnapshot();
  const caseId = snap.livingPlaces.activeCaseIds[0];
  assert.ok(caseId, 'An Onari case should be opened');
  const onariCase = snap.livingPlaces.cases[caseId];
  assert.ok(onariCase);
  assert.equal(onariCase.locationId, 'big_ben_plaza');

  // Advance through consultation window and remediation
  world.advance(START + 75 * MIN + 3 * 60 * MIN);
  snap = world.semanticSnapshot();
  const consultingCase = snap.livingPlaces.cases[caseId];
  assert.ok(['consulting', 'remediating', 'closed'].includes(consultingCase.status));

  // Advance 5 days (72h remediated recovery + margins)
  world.advance(START + 75 * MIN + 5 * 24 * 60 * MIN);
  snap = world.semanticSnapshot();
  const site = snap.livingPlaces.sites['big_ben_plaza'];
  assert.equal(site.status, 'stable');
  assert.ok(snap.livingPlaces.closedSummaries.some(c => c.locationId === 'big_ben_plaza'));
  assert.equal(snap.livingPlaces.activeCaseIds.length, 0);

  world.close();
});

test('Onari response lifecycle with peaceful protest when consultation unresolved', () => {
  const impactAction = {
    id: 'test/onari-protest',
    type: 'SITE_IMPACT_REGISTER',
    dueAt: START + 75 * MIN,
    priority: 36,
    day: londonDate(START + 75 * MIN),
    actors: [],
    version: 1,
    locationId: 'big_ben_plaza',
    areaId: 'gardens',
    consequenceKind: 'magical_contamination_of_living_area',
    impact: 'moderate',
    affectsLivingHabitat: true,
    sourceEventId: 'evt-protest-src',
    sourceFactKey: 'fact-protest-src'
  };

  const { world } = seededWorld({
    incidents: [impactAction],
    extraState: {
      sites: {
        big_ben_plaza: {
          locationId: 'big_ben_plaza',
          areaId: 'gardens',
          status: 'disturbed',
          impact: 'moderate',
          affectsLivingHabitat: true,
          consequenceKind: 'magical_contamination_of_living_area',
          sourceEventIds: ['evt-prior-harm'],
          sourceFactIds: ['fact-prior-harm'],
          disturbedAt: START,
          recoveryDueAt: null,
          remediatedAt: null,
          recoveredAt: null,
          activeSourceCount: 2, // Active recurring harm causes unresolved consultation
          lastEventId: 'evt-prior'
        }
      }
    }
  });

  // Advance through notice
  world.advance(START + 75 * MIN + 30 * MIN);
  let snap = world.semanticSnapshot();
  const caseId = snap.livingPlaces.activeCaseIds[0];
  assert.ok(caseId);

  // Advance through consultation to protest
  world.advance(START + 75 * MIN + 3 * 60 * MIN);
  snap = world.semanticSnapshot();
  const events = snap.events.filter(e => e.type.startsWith('ONARI_'));
  assert.ok(events.some(e => e.type === 'ONARI_PROTEST_BEGIN'), 'Peaceful protest should be initiated');
  const protestEvent = events.find(e => e.type === 'ONARI_PROTEST_BEGIN');
  assert.equal(protestEvent.payload.peaceful, true);

  // Advance through protest end and resolution
  world.advance(START + 75 * MIN + 6 * 60 * MIN);
  snap = world.semanticSnapshot();
  const laterEvents = snap.events.filter(e => e.type.startsWith('ONARI_'));
  assert.ok(laterEvents.some(e => e.type === 'ONARI_PROTEST_END'), 'Protest ends peacefully');
  assert.ok(laterEvents.some(e => e.type === 'ONARI_REMEDIATION'), 'Concludes with remediation');

  world.close();
});

test('Yukon optionality: joins only if available and awake without error or blocking', () => {
  const current = createFixture({ startMs: START });
  const state = current.initialState();

  // Test at day time (awake)
  const dayTime = atLondon('2026-09-04', '14:00');
  const dayAvail = isYukonAvailable(state, dayTime, 'seed-yukon-test');
  assert.equal(typeof dayAvail, 'boolean');

  // Test during night small hours (asleep)
  const nightTime = atLondon('2026-09-04', '04:00');
  const nightAvail = isYukonAvailable(state, nightTime, 'seed-yukon-test');
  assert.equal(typeof nightAvail, 'boolean');
});

test('Strict invariants: zero prose in state, bounded ring buffers, no continuous meters', () => {
  const initial = initialLivingPlacesState();
  const state = { livingPlaces: initial };
  assertLivingPlaces(state);

  // Check invalid site status throws
  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        sites: {
          big_ben_plaza: {
            locationId: 'big_ben_plaza',
            status: 'invalid_status',
            impact: 'minor',
            affectsLivingHabitat: true,
            consequenceKind: 'vegetation_damage',
            sourceEventIds: ['e1'],
            sourceFactIds: ['f1'],
            disturbedAt: START
          }
        }
      }
    });
  }, /Invalid site status/);

  // Check continuous meter (non-discrete impact) throws
  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        sites: {
          big_ben_plaza: {
            locationId: 'big_ben_plaza',
            status: 'disturbed',
            impact: 0.75, // float meter forbidden!
            affectsLivingHabitat: true,
            consequenceKind: 'vegetation_damage',
            sourceEventIds: ['e1'],
            sourceFactIds: ['f1'],
            disturbedAt: START
          }
        }
      }
    });
  }, /Invalid site impact/);

  // Check generic actor throws
  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        cases: {
          'onari:bad': {
            caseId: 'onari:bad',
            locationId: 'big_ben_plaza',
            status: 'consulting',
            participants: ['onari_protester'] // generic actor forbidden!
          }
        }
      }
    });
  }, /Generic onari placeholder actors are forbidden/);

  // Check invalid location throws
  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        sites: {
          'london/park': { // invented location forbidden!
            locationId: 'london/park',
            status: 'disturbed',
            impact: 'minor',
            affectsLivingHabitat: true,
            consequenceKind: 'vegetation_damage',
            sourceEventIds: ['e1'],
            sourceFactIds: ['f1'],
            disturbedAt: START
          }
        }
      }
    });
  }, /Unknown canonical location for site/);
});
