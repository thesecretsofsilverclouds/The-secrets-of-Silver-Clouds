import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldStore } from '../experiment-l/src/world.mjs';
import { createFixture, RULES_VERSION, eventId } from '../src/fixture.mjs';
import { atLondon, londonDate, MINUTE_MS as MIN } from '../src/time.mjs';
import { AREAS_BY_LOCATION } from '../src/places.mjs';
import {
  LIVING_PLACES_FACT_KINDS,
  ECOLOGICAL_SOURCE_EVENT_TYPE,
  ECOLOGICAL_SOURCE_END_TYPE,
  ECOLOGICAL_SOURCE_FACT_KIND,
  LIVING_PLACES_STATE_BUDGET,
  MAX_CLOSED_SUMMARIES,
  MAX_RECOVERED_SUMMARIES,
  MAX_ENDED_SOURCE_SUMMARIES,
  MAX_ISSUED,
  MAX_ACTIVE_ONARI_CASES,
  RECOVERY_DURATIONS,
  initialLivingPlacesState,
  assertLivingPlaces,
  isYukonAvailable,
  isQualifyingEcologicalSource,
  livingPlacesSerializedBytes,
  onariKnowsEcologicalProblem,
  consultationAuthority,
} from '../src/living-places.mjs';

const START = atLondon('2026-09-04', '00:00');
const SEED = 'test-seed-living-places-v1';
const DAY = atLondon('2026-09-04', '10:00');

const shape = action => ({
  id: action.id,
  type: action.type,
  dueAt: action.dueAt,
  priority: action.priority,
  day: action.day
});

function sourceAction({
  id,
  dueAt = DAY,
  locationId = 'big_ben_plaza',
  areaId = 'gardens',
  consequenceKind = 'vegetation_damage',
  impact = 'minor',
  authorityActor = null,
  provenance = { path: 'committed_report' },
} = {}) {
  return {
    id,
    type: ECOLOGICAL_SOURCE_EVENT_TYPE,
    dueAt,
    priority: 36,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    locationId,
    areaId,
    consequenceKind,
    impact,
    affectsLivingHabitat: true,
    provenance,
    authorityActor
  };
}

function sourceEndAction({ id, dueAt, sourceFactKey }) {
  return {
    id,
    type: ECOLOGICAL_SOURCE_END_TYPE,
    dueAt,
    priority: 36,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    sourceFactKey
  };
}

function referralAction({ id, dueAt, locationId, sourceFactKey }) {
  return {
    id,
    type: 'ONARI_ECOLOGY_REFERRAL',
    dueAt,
    priority: 37,
    day: londonDate(dueAt),
    actors: [],
    version: 1,
    locationId,
    sourceFactKey
  };
}

function predictedSourceFactKey(seed, action) {
  return `${action.day}:eco-source-${eventId(seed, action.id)}`;
}

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

test('village access fact kinds are canonical Living Places topics', () => {
  assert.ok(LIVING_PLACES_FACT_KINDS.includes('onari_village_access'));
  assert.ok(LIVING_PLACES_FACT_KINDS.includes('onari_consultation_referral'));
  assert.ok(LIVING_PLACES_FACT_KINDS.includes(ECOLOGICAL_SOURCE_FACT_KIND));
});

test('initialLivingPlacesState adheres to bounded schema', () => {
  const initial = initialLivingPlacesState();
  assert.equal(initial.version, 1);
  assert.deepEqual(initial.sites, {});
  assert.deepEqual(initial.sources, {});
  assert.deepEqual(initial.cases, {});
  assert.deepEqual(initial.activeCaseIds, []);
  assert.deepEqual(initial.closedSummaries, []);
  assert.deepEqual(initial.recoveredSummaries, []);
  assert.deepEqual(initial.endedSourceSummaries, []);
  assert.deepEqual(initial.issued, {});
  assert.doesNotThrow(() => assertLivingPlaces({ livingPlaces: initial }));
});

test('isQualifyingEcologicalSource requires the dedicated source contract', () => {
  const qualifying = {
    type: ECOLOGICAL_SOURCE_EVENT_TYPE,
    location: 'big_ben_plaza',
    payload: {
      affectsLivingHabitat: true,
      consequenceKind: 'vegetation_damage',
      impact: 'minor',
      provenance: { path: 'committed_report' },
      sourceFactKey: '2026-09-04:eco-source-evt1'
    }
  };
  assert.equal(isQualifyingEcologicalSource(qualifying), true);

  assert.equal(isQualifyingEcologicalSource({
    type: 'INCIDENT',
    location: 'big_ben_plaza',
    payload: {
      affectsLivingHabitat: true,
      consequenceKind: 'vegetation_damage',
      impact: 'minor',
      provenance: { path: 'committed_report' },
      sourceFactKey: 'fact-eco-1'
    }
  }), false);

  assert.equal(isQualifyingEcologicalSource({
    type: 'MEU_CASE_RESOLVE',
    location: 'mi6',
    payload: { affectsLivingHabitat: true, consequenceKind: 'habitat_damage', impact: 'moderate' }
  }), false);

  assert.equal(isQualifyingEcologicalSource({
    type: 'LEGION_JOB_RESOLVE',
    location: 'legion_hideout',
    payload: { affectsLivingHabitat: true, consequenceKind: 'vegetation_damage', impact: 'minor' }
  }), false);

  assert.equal(isQualifyingEcologicalSource({
    type: 'DUSKKIN_COMPLIANCE_NOTICE',
    location: 'mi6',
    payload: { affectsLivingHabitat: true, consequenceKind: 'vegetation_damage', impact: 'minor' }
  }), false);

  assert.equal(isQualifyingEcologicalSource({
    type: 'WEATHER_CHANGE',
    location: 'big_ben_plaza',
    payload: { affectsLivingHabitat: true, consequenceKind: 'vegetation_damage', impact: 'minor' }
  }), false);

  assert.equal(isQualifyingEcologicalSource({
    type: ECOLOGICAL_SOURCE_EVENT_TYPE,
    location: 'big_ben_plaza',
    payload: { consequenceKind: 'vegetation_damage', impact: 'minor' }
  }), false);

  assert.equal(isQualifyingEcologicalSource({
    type: ECOLOGICAL_SOURCE_EVENT_TYPE,
    location: 'london/park',
    payload: {
      affectsLivingHabitat: true,
      consequenceKind: 'vegetation_damage',
      impact: 'minor',
      provenance: { path: 'committed_report' },
      sourceFactKey: 'fact-eco-1'
    }
  }), false);
});

test('committed source registers site memory without opening an Onari case', () => {
  const source = sourceAction({ id: 'test/eco-isolated' });
  const { world } = seededWorld({ incidents: [source] });
  world.advance(DAY + 20 * MIN);
  const snap = world.semanticSnapshot();
  const site = snap.livingPlaces.sites.big_ben_plaza;
  assert.ok(site);
  assert.equal(site.status, 'disturbed');
  assert.equal(site.impact, 'minor');
  assert.equal(snap.livingPlaces.activeCaseIds.length, 0);
  assert.equal(Object.keys(snap.livingPlaces.cases).length, 0);
  assert.equal(onariKnowsEcologicalProblem(snap, 'big_ben_plaza', DAY + 20 * MIN), false);
  assert.doesNotThrow(() => assertLivingPlaces(snap));
  world.close();
});

test('active damaging source blocks recovery; source end then schedules natural recovery', () => {
  const source = sourceAction({ id: 'test/eco-block' });
  const end = sourceEndAction({
    id: 'test/eco-block-end',
    dueAt: DAY + 30 * 60 * MIN,
    sourceFactKey: predictedSourceFactKey(SEED, source)
  });
  const { world } = seededWorld({ incidents: [source, end] });

  world.advance(DAY + 26 * 60 * MIN);
  let snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites.big_ben_plaza.status, 'disturbed');
  assert.equal(snap.events.some(e => e.type === 'SITE_RECOVERY_BEGIN' && e.payload?.status === 'recovering'), false);

  world.advance(DAY + 31 * 60 * MIN);
  snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites.big_ben_plaza.status, 'recovering');
  const begin = snap.events.find(e => e.type === 'SITE_RECOVERY_BEGIN' && e.payload?.status === 'recovering');
  assert.ok(begin);
  assert.equal(snap.livingPlaces.sites.big_ben_plaza.recoveryDueAt - begin.occurredAt, RECOVERY_DURATIONS.minor_natural);

  world.advance(snap.livingPlaces.sites.big_ben_plaza.recoveryDueAt + 10 * MIN);
  snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites.big_ben_plaza.status, 'stable');
  assert.equal(snap.livingPlaces.recoveredSummaries[0].locationId, 'big_ben_plaza');
  assert.equal(snap.livingPlaces.activeCaseIds.length, 0);
  world.close();
});

test('later impact invalidates stale recovery while the new source remains active', () => {
  const first = sourceAction({ id: 'test/eco-stale-1', dueAt: DAY });
  const second = sourceAction({
    id: 'test/eco-stale-2',
    dueAt: DAY + 12 * 60 * MIN,
    consequenceKind: 'magical_contamination_of_living_area',
    impact: 'moderate'
  });
  const { world } = seededWorld({ incidents: [first, second] });
  world.advance(DAY + 25 * 60 * MIN);
  const snap = world.semanticSnapshot();
  const site = snap.livingPlaces.sites.big_ben_plaza;
  assert.equal(site.status, 'disturbed');
  assert.equal(site.impact, 'moderate');
  assert.equal(site.sourceFactIds.length, 2);
  assert.ok(site.disturbedAt > DAY);
  assert.equal(snap.events.filter(e => e.type === 'SITE_RECOVERY_BEGIN' && e.payload?.status === 'recovering').length, 0);
  world.close();
});

test('moderate source-ended recovery uses the 14-day natural schedule', () => {
  const source = sourceAction({
    id: 'test/eco-moderate',
    locationId: 'mi6',
    areaId: 'training',
    consequenceKind: 'containment_damage_to_living_area',
    impact: 'moderate'
  });
  const end = sourceEndAction({
    id: 'test/eco-moderate-end',
    dueAt: DAY + 40 * MIN,
    sourceFactKey: predictedSourceFactKey(SEED, source)
  });
  const { world } = seededWorld({ incidents: [source, end] });
  world.advance(DAY + 60 * MIN);
  let snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites.mi6.status, 'recovering');
  const begin = snap.events.find(e => e.type === 'SITE_RECOVERY_BEGIN' && e.payload?.status === 'recovering');
  assert.equal(snap.livingPlaces.sites.mi6.recoveryDueAt - begin.occurredAt, RECOVERY_DURATIONS.moderate_natural);
  world.advance(snap.livingPlaces.sites.mi6.recoveryDueAt + 10 * MIN);
  snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites.mi6.status, 'stable');
  world.close();
});

test('Onari notice requires a committed referral/knowledge path', () => {
  const source = sourceAction({ id: 'test/eco-know' });
  const key = predictedSourceFactKey(SEED, source);
  const referral = referralAction({
    id: 'test/eco-know-ref',
    dueAt: DAY + 20 * MIN,
    locationId: 'big_ben_plaza',
    sourceFactKey: key
  });
  const { world } = seededWorld({ incidents: [source, referral] });
  world.advance(DAY + 50 * MIN);
  const snap = world.semanticSnapshot();
  assert.equal(onariKnowsEcologicalProblem(snap, 'big_ben_plaza', DAY + 50 * MIN), true);
  assert.equal(snap.livingPlaces.activeCaseIds.length, 1);
  assert.ok(snap.events.some(e => e.type === 'ONARI_ECOLOGY_NOTICE'));
  world.close();
});

test('consultation without present authority does not default to remediation_agreed', () => {
  const source = sourceAction({ id: 'test/eco-consult' });
  const referral = referralAction({
    id: 'test/eco-consult-ref',
    dueAt: DAY + 20 * MIN,
    locationId: 'big_ben_plaza',
    sourceFactKey: predictedSourceFactKey(SEED, source)
  });
  const { world } = seededWorld({ incidents: [source, referral] });
  world.advance(DAY + 3 * 60 * MIN);
  const snap = world.semanticSnapshot();
  const consultation = snap.events.find(e => e.type === 'ONARI_CONSULTATION');
  assert.ok(consultation);
  assert.notEqual(consultation.payload.outcome, 'remediation_agreed');
  assert.ok(['referred', 'waiting', 'no_change', 'consultation_unresolved'].includes(consultation.payload.outcome));
  world.close();
});

test('named authority away from the damage yields waiting, not invented agreement', () => {
  const empty = createFixture({ startMs: START }).initialState();
  empty.livingPlaces = {
    ...initialLivingPlacesState(),
    sources: {
      'src-plaza': {
        sourceFactKey: 'src-plaza',
        locationId: 'big_ben_plaza',
        sourceActive: true,
        authorityActor: 'goaden'
      }
    }
  };
  const decision = consultationAuthority(empty, 'big_ben_plaza', DAY, SEED);
  assert.equal(decision.outcome, 'waiting');
  assert.equal(decision.authorityActor, 'goaden');
});

test('present Goaden authority at the damaged site can agree remediation', () => {
  const source = sourceAction({
    id: 'test/eco-authority',
    locationId: 'mi6',
    areaId: 'training',
    authorityActor: 'goaden'
  });
  const referral = referralAction({
    id: 'test/eco-authority-ref',
    dueAt: DAY + 20 * MIN,
    locationId: 'mi6',
    sourceFactKey: predictedSourceFactKey(SEED, source)
  });
  const { world } = seededWorld({ incidents: [source, referral] });
  world.advance(DAY + 3 * 60 * MIN);
  let snap = world.semanticSnapshot();
  const consultation = snap.events.find(e => e.type === 'ONARI_CONSULTATION');
  assert.equal(consultation.payload.outcome, 'remediation_agreed');
  assert.equal(consultation.payload.authorityActor, 'goaden');
  world.advance(DAY + 5 * 24 * 60 * MIN);
  snap = world.semanticSnapshot();
  assert.equal(snap.livingPlaces.sites.mi6.status, 'stable');
  assert.ok(snap.livingPlaces.closedSummaries.some(row => row.locationId === 'mi6'));
  assert.equal(snap.livingPlaces.activeCaseIds.length, 0);
  assert.equal(Object.values(snap.livingPlaces.cases).some(c => c.status === 'closed'), false);
  world.close();
});

test('protest requires an ecology case, consultation, unresolved harm, and Yukon', () => {
  const source = sourceAction({
    id: 'test/eco-protest',
    consequenceKind: 'magical_contamination_of_living_area',
    impact: 'moderate'
  });
  const referral = referralAction({
    id: 'test/eco-protest-ref',
    dueAt: DAY + 20 * MIN,
    locationId: 'big_ben_plaza',
    sourceFactKey: predictedSourceFactKey(SEED, source)
  });
  const { world } = seededWorld({ incidents: [source, referral] });
  world.advance(DAY + 5 * 60 * MIN);
  const snap = world.semanticSnapshot();
  const protest = snap.events.find(e => e.type === 'ONARI_PROTEST_BEGIN');
  assert.ok(protest, 'Daytime referred consultation may protest');
  assert.equal(protest.payload.peaceful, true);
  assert.deepEqual(protest.participants, ['yukon']);
  assert.ok(!snap.events.some(e => e.type === 'ONARI_REMEDIATION'));
  world.close();
});

test('protest is refused at performance time when Yukon is unavailable', () => {
  const source = sourceAction({ id: 'test/eco-night-protest', dueAt: atLondon('2026-09-04', '17:30') });
  const referral = referralAction({
    id: 'test/eco-night-protest-ref',
    dueAt: atLondon('2026-09-04', '17:50'),
    locationId: 'big_ben_plaza',
    sourceFactKey: predictedSourceFactKey(SEED, source)
  });
  const { world } = seededWorld({ incidents: [source, referral] });
  world.advance(atLondon('2026-09-04', '20:30'));
  const snap = world.semanticSnapshot();
  assert.ok(snap.events.some(e => e.type === 'ONARI_CONSULTATION'));
  assert.equal(snap.events.some(e => e.type === 'ONARI_PROTEST_BEGIN' && e.participants?.length), false);
  world.close();
});

test('three committed site impacts remain after the two-case Onari cap', () => {
  const plaza = sourceAction({ id: 'test/eco-cap-plaza', dueAt: DAY, locationId: 'big_ben_plaza', areaId: 'gardens' });
  const cafe = sourceAction({
    id: 'test/eco-cap-cafe',
    dueAt: DAY + 5 * MIN,
    locationId: 'cafe',
    areaId: 'venue',
    consequenceKind: 'habitat_damage'
  });
  const ink = sourceAction({
    id: 'test/eco-cap-ink',
    dueAt: DAY + 10 * MIN,
    locationId: 'enchanted_ink',
    areaId: 'venue',
    consequenceKind: 'ward_damage_affecting_living_environment',
    impact: 'moderate'
  });
  const referrals = [
    referralAction({
      id: 'test/eco-cap-plaza-ref',
      dueAt: DAY + 25 * MIN,
      locationId: 'big_ben_plaza',
      sourceFactKey: predictedSourceFactKey(SEED, plaza)
    }),
    referralAction({
      id: 'test/eco-cap-cafe-ref',
      dueAt: DAY + 30 * MIN,
      locationId: 'cafe',
      sourceFactKey: predictedSourceFactKey(SEED, cafe)
    }),
    referralAction({
      id: 'test/eco-cap-ink-ref',
      dueAt: DAY + 35 * MIN,
      locationId: 'enchanted_ink',
      sourceFactKey: predictedSourceFactKey(SEED, ink)
    })
  ];
  const { world } = seededWorld({ incidents: [plaza, cafe, ink, ...referrals] });
  world.advance(DAY + 90 * MIN);
  const snap = world.semanticSnapshot();
  assert.ok(snap.livingPlaces.sites.big_ben_plaza);
  assert.ok(snap.livingPlaces.sites.cafe);
  assert.ok(snap.livingPlaces.sites.enchanted_ink);
  assert.equal(Object.keys(snap.livingPlaces.sites).length, 3);
  assert.equal(snap.livingPlaces.activeCaseIds.length, MAX_ACTIVE_ONARI_CASES);
  const openedNotices = snap.events.filter(e => e.type === 'ONARI_ECOLOGY_NOTICE' && e.payload?.outcome !== 'skipped');
  assert.equal(openedNotices.length, 2);
  assert.doesNotThrow(() => assertLivingPlaces(snap));
  world.close();
});

test('closed cases stay in the bounded summary ring and serialized state stays within 16 KiB', () => {
  const locations = Object.keys(AREAS_BY_LOCATION);
  const fat = initialLivingPlacesState();
  locations.forEach((locationId, i) => {
    fat.sites[locationId] = {
      locationId, areaId: null, status: 'disturbed', impact: i % 2 ? 'moderate' : 'minor',
      affectsLivingHabitat: true, consequenceKind: 'habitat_damage',
      sourceEventIds: [`evt-${i}`], sourceFactIds: [`fact-${i}`],
      disturbedAt: DAY, recoveryDueAt: null, remediatedAt: null, recoveredAt: null, lastEventId: `evt-${i}`
    };
    fat.sources[`fact-${i}`] = {
      sourceFactKey: `fact-${i}`, sourceEventId: `evt-${i}`, locationId, areaId: null,
      consequenceKind: 'habitat_damage', impact: i % 2 ? 'moderate' : 'minor',
      provenance: { path: 'committed_report' }, sourceActive: true, endedAt: null, authorityActor: 'goaden'
    };
  });
  fat.cases = {
    'onari:one': { caseId: 'onari:one', status: 'consulting', locationId: 'mi6', participants: ['yukon'] },
    'onari:two': { caseId: 'onari:two', status: 'noticed', locationId: 'cafe', participants: [] }
  };
  fat.activeCaseIds = ['onari:one', 'onari:two'];
  fat.closedSummaries = Array.from({ length: MAX_CLOSED_SUMMARIES }, (_, i) => ({
    caseId: `closed-${i}`, locationId: 'mi6', protested: false, outcome: 'no_change',
    closedAt: DAY + i, sourceFactIds: [`f-${i}`], sourceEventIds: [`e-${i}`]
  }));
  fat.recoveredSummaries = Array.from({ length: MAX_RECOVERED_SUMMARIES }, (_, i) => ({
    locationId: 'cafe', recoveredAt: DAY + i, remediated: false, sourceFactIds: [`rf-${i}`]
  }));
  fat.endedSourceSummaries = Array.from({ length: MAX_ENDED_SOURCE_SUMMARIES }, (_, i) => ({
    sourceFactKey: `ended-${i}`, locationId: 'mi6', sourceEventId: `es-${i}`, endedAt: DAY + i
  }));
  fat.issued = Object.fromEntries(Array.from({ length: MAX_ISSUED }, (_, i) => [`issued-${i}`, {
    shape: { id: `issued-${i}`, type: 'SITE_IMPACT_REGISTER', dueAt: DAY + i, priority: 36, day: '2026-09-04' },
    sourceEventId: `src-${i}`, consumed: i % 2 === 0
  }]));
  assert.doesNotThrow(() => assertLivingPlaces({ livingPlaces: fat }));
  const bytes = livingPlacesSerializedBytes({ livingPlaces: fat });
  assert.equal(LIVING_PLACES_STATE_BUDGET, 16 * 1024);
  assert.ok(bytes <= LIVING_PLACES_STATE_BUDGET, `serialized livingPlaces was ${bytes} bytes; budget ${LIVING_PLACES_STATE_BUDGET}`);
  assert.ok(bytes >= 12_000, `max bounded state should exercise the real budget; measured ${bytes}`);
  process.stdout.write(`Living Places max measured serialized bytes: ${bytes}\n`);

  const over = { livingPlaces: { ...fat, padding: 'x'.repeat(LIVING_PLACES_STATE_BUDGET) } };
  assert.throws(() => assertLivingPlaces(over), /exceeded/);
});

test('Yukon optionality: joins only if available and awake without error or blocking', () => {
  const state = createFixture({ startMs: START }).initialState();
  const dayAvail = isYukonAvailable(state, atLondon('2026-09-04', '14:00'), 'seed-yukon-test');
  const nightAvail = isYukonAvailable(state, atLondon('2026-09-04', '04:00'), 'seed-yukon-test');
  assert.equal(typeof dayAvail, 'boolean');
  assert.equal(typeof nightAvail, 'boolean');
  assert.equal(nightAvail, false);
});

test('Strict invariants: zero prose, no placeholders, discrete states only', () => {
  const initial = initialLivingPlacesState();
  assertLivingPlaces({ livingPlaces: initial });

  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        sites: {
          big_ben_plaza: {
            locationId: 'big_ben_plaza', status: 'invalid_status', impact: 'minor',
            affectsLivingHabitat: true, consequenceKind: 'vegetation_damage',
            sourceEventIds: ['e1'], sourceFactIds: ['f1'], disturbedAt: START
          }
        }
      }
    });
  }, /Invalid site status/);

  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        sites: {
          big_ben_plaza: {
            locationId: 'big_ben_plaza', status: 'disturbed', impact: 0.75,
            affectsLivingHabitat: true, consequenceKind: 'vegetation_damage',
            sourceEventIds: ['e1'], sourceFactIds: ['f1'], disturbedAt: START
          }
        }
      }
    });
  }, /Invalid site impact/);

  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        cases: {
          'onari:bad': {
            caseId: 'onari:bad', locationId: 'big_ben_plaza', status: 'consulting',
            participants: ['onari_protester']
          }
        }
      }
    });
  }, /Generic onari placeholder actors are forbidden/);

  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        cases: {
          'onari:bad': {
            caseId: 'onari:bad', locationId: 'big_ben_plaza', status: 'consulting',
            participants: ['contractor']
          }
        }
      }
    });
  }, /Invented bureaucratic actors are forbidden/);

  assert.throws(() => {
    assertLivingPlaces({
      livingPlaces: {
        ...initial,
        sites: {
          'london/park': {
            locationId: 'london/park', status: 'disturbed', impact: 'minor',
            affectsLivingHabitat: true, consequenceKind: 'vegetation_damage',
            sourceEventIds: ['e1'], sourceFactIds: ['f1'], disturbedAt: START
          }
        }
      }
    });
  }, /Unknown canonical location for site/);
});
