import { createHash } from 'node:crypto';
import { londonDate, MINUTE_MS as MIN } from './time.mjs';
import { learnOffscreenFact, offscreenAvailable, offscreenAwakeAtNight, offscreenKnowsFact, offscreenNightPlace } from './offscreen-lives.mjs';
import { AREAS_BY_LOCATION } from './places.mjs';

// Addon Four: Living Places / Onari Ecology & Recovery
// Dedicated ecological source → site memory. Onari response is a separate
// knowledge/referral path. No invented bureaucracy. Zero prose in state.

export const LIVING_PLACES_VERSION = 1;
export const ECOLOGICAL_SOURCE_EVENT_TYPE = 'ECOLOGICAL_IMPACT_SOURCE';
export const ECOLOGICAL_SOURCE_END_TYPE = 'ECOLOGICAL_SOURCE_END';
export const ECOLOGICAL_SOURCE_FACT_KIND = 'ecological_impact_source';
export const ECOLOGICAL_PROVENANCE_PATHS = Object.freeze(['observation', 'committed_report']);
export const LIVING_PLACES_STATE_BUDGET = 16 * 1024;

export const SITE_EVENT_TYPES = Object.freeze([
  ECOLOGICAL_SOURCE_EVENT_TYPE,
  ECOLOGICAL_SOURCE_END_TYPE,
  'SITE_IMPACT_REGISTER',
  'SITE_RECOVERY_BEGIN',
  'SITE_RECOVERY_DUE',
  'SITE_RECOVERED'
]);

export const ONARI_ECOLOGY_EVENT_TYPES = Object.freeze([
  'ONARI_ECOLOGY_REFERRAL',
  'ONARI_ECOLOGY_NOTICE',
  'ONARI_CONSULTATION',
  'ONARI_PROTEST_BEGIN',
  'ONARI_PROTEST_END',
  'ONARI_REMEDIATION',
  'ONARI_NO_CHANGE',
  'ONARI_ECOLOGY_CLOSE'
]);

export const LIVING_PLACES_EVENT_TYPES = Object.freeze([
  ...SITE_EVENT_TYPES,
  ...ONARI_ECOLOGY_EVENT_TYPES
]);

export const LIVING_PLACES_FACT_KINDS = Object.freeze([
  ECOLOGICAL_SOURCE_FACT_KIND,
  'ecological_source_ended',
  'site_impact',
  'site_recovery',
  'site_recovered',
  'onari_ecology_notice',
  'onari_ecology_consultation',
  'onari_ecology_referral',
  'onari_protest',
  'onari_ecology_result',
  'onari_village_access',
  'onari_consultation_referral'
]);

export const ECOLOGICAL_CONSEQUENCE_KINDS = Object.freeze([
  'vegetation_damage',
  'magical_contamination_of_living_area',
  'habitat_damage',
  'containment_damage_to_living_area',
  'ward_damage_affecting_living_environment'
]);

export const REMEDIATION_ACTIONS = Object.freeze([
  'route_work_altered',
  'magical_process_paused',
  'containment_adjusted',
  'restoration_scheduled',
  'no_change'
]);

export const SITE_STATUSES = Object.freeze(['stable', 'disturbed', 'recovering']);
export const IMPACT_SEVERITIES = Object.freeze(['minor', 'moderate']);
export const CONSULTATION_OUTCOMES = Object.freeze([
  'remediation_agreed', 'referred', 'consultation_unresolved', 'waiting', 'no_change'
]);
export const ONARI_CASE_STATUSES = Object.freeze([
  'noticed', 'consulting', 'protesting', 'remediating', 'unresolved', 'closed'
]);
export const ONARI_FAMILIES = Object.freeze([
  'onari.ecology_notice',
  'onari.consultation',
  'onari.peaceful_protest',
  'onari.restoration',
  'onari.unresolved_grievance'
]);

export const RECOVERY_DURATIONS = Object.freeze({
  minor_remediated: 72 * 60 * MIN,
  moderate_remediated: 7 * 24 * 60 * MIN,
  minor_natural: 7 * 24 * 60 * MIN,
  moderate_natural: 14 * 24 * 60 * MIN,
});

export const ONARI_NOTICE_COOLDOWN_MS = 14 * 24 * 60 * MIN;
export const ONARI_PROTEST_SPACING_MS = 7 * 24 * 60 * MIN;
export const MAX_ACTIVE_ONARI_CASES = 2;
export const MAX_ACTIVE_DISTURBED_SITES = 8;
export const MAX_CLOSED_SUMMARIES = 16;
export const MAX_RECOVERED_SUMMARIES = 16;
export const MAX_ENDED_SOURCE_SUMMARIES = 16;
export const MAX_ISSUED = 24;

const HASH = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
const TYPES = new Set(LIVING_PLACES_EVENT_TYPES);
const VALID_CONSEQUENCE_KINDS = new Set(ECOLOGICAL_CONSEQUENCE_KINDS);
const VALID_SITE_STATUSES = new Set(SITE_STATUSES);
const VALID_IMPACTS = new Set(IMPACT_SEVERITIES);
const VALID_ONARI_STATUSES = new Set(ONARI_CASE_STATUSES);
const VALID_CONSULTATION = new Set(CONSULTATION_OUTCOMES);
const OPEN_ONARI_STATUSES = new Set(['noticed', 'consulting', 'protesting', 'remediating', 'unresolved']);
const CASELESS = new Set([
  ECOLOGICAL_SOURCE_EVENT_TYPE, ECOLOGICAL_SOURCE_END_TYPE,
  'SITE_IMPACT_REGISTER', 'SITE_RECOVERY_BEGIN', 'SITE_RECOVERY_DUE',
  'ONARI_ECOLOGY_REFERRAL', 'ONARI_ECOLOGY_NOTICE'
]);
const AUTHORITY_ACTORS = new Set(['goaden', 'ashai']);

const of = state => state.livingPlaces ?? initialLivingPlacesState();
const shape = a => ({ id: a.id, type: a.type, dueAt: a.dueAt, priority: a.priority, day: a.day });
const equal = (a, b) => a.id === b.id && a.type === b.type && a.dueAt === b.dueAt && a.priority === b.priority && a.day === b.day;

export function initialLivingPlacesState() {
  return {
    version: 1,
    sites: {},
    sources: {},
    cases: {},
    activeCaseIds: [],
    nextNoticeEligibleAt: 0,
    nextProtestEligibleAt: 0,
    closedSummaries: [],
    recoveredSummaries: [],
    endedSourceSummaries: [],
    issued: {}
  };
}

export function livingPlacesSerializedBytes(state) {
  return Buffer.byteLength(JSON.stringify(of(state)));
}

export function isValidEcologicalProvenance(provenance) {
  return Boolean(provenance && typeof provenance === 'object' && !Array.isArray(provenance)
    && ECOLOGICAL_PROVENANCE_PATHS.includes(provenance.path));
}

export function assertLivingPlaces(state) {
  if (!state.livingPlaces) return;
  const current = of(state);
  if (!Number.isInteger(current.version)) throw new Error('Invalid livingPlaces version');
  if (typeof current.sites !== 'object' || current.sites === null) throw new Error('Invalid livingPlaces sites');
  if (typeof current.sources !== 'object' || current.sources === null) throw new Error('Invalid livingPlaces sources');
  if (typeof current.cases !== 'object' || current.cases === null) throw new Error('Invalid livingPlaces cases');
  if ((current.closedSummaries ?? []).length > MAX_CLOSED_SUMMARIES) throw new Error('Onari closedSummaries limit exceeded');
  if ((current.recoveredSummaries ?? []).length > MAX_RECOVERED_SUMMARIES) throw new Error('Site recoveredSummaries limit exceeded');
  if ((current.endedSourceSummaries ?? []).length > MAX_ENDED_SOURCE_SUMMARIES) throw new Error('endedSourceSummaries limit exceeded');
  if (Object.keys(current.issued).length > MAX_ISSUED) throw new Error('LivingPlaces issued limit exceeded');

  for (const [locId, site] of Object.entries(current.sites)) {
    if (!AREAS_BY_LOCATION[locId]) throw new Error(`Unknown canonical location for site: ${locId}`);
    if (!VALID_SITE_STATUSES.has(site.status)) throw new Error(`Invalid site status: ${site.status}`);
    if (!VALID_IMPACTS.has(site.impact)) throw new Error(`Invalid site impact: ${site.impact}`);
    if (!VALID_CONSEQUENCE_KINDS.has(site.consequenceKind)) throw new Error(`Invalid consequence kind: ${site.consequenceKind}`);
    if (typeof site.affectsLivingHabitat !== 'boolean') throw new Error('affectsLivingHabitat must be boolean');
    if (site.prose != null) throw new Error('No prose allowed in canonical site state');
  }

  const openCases = Object.values(current.cases).filter(c => OPEN_ONARI_STATUSES.has(c.status));
  if (openCases.length > MAX_ACTIVE_ONARI_CASES) throw new Error(`At most ${MAX_ACTIVE_ONARI_CASES} open Onari ecology cases`);
  if (current.activeCaseIds.length > MAX_ACTIVE_ONARI_CASES) throw new Error(`activeCaseIds cannot exceed ${MAX_ACTIVE_ONARI_CASES}`);
  if (Object.values(current.cases).some(c => c.status === 'closed')) {
    throw new Error('Closed Onari cases must live in closedSummaries, not cases{}');
  }

  for (const c of Object.values(current.cases)) {
    if (!VALID_ONARI_STATUSES.has(c.status)) throw new Error(`Invalid Onari case status: ${c.status}`);
    if (c.consultationOutcome && !VALID_CONSULTATION.has(c.consultationOutcome)) {
      throw new Error(`Invalid consultation outcome: ${c.consultationOutcome}`);
    }
    if (c.participants?.includes('onari_protester') || c.participants?.includes('onari_liaison')) {
      throw new Error('Generic onari placeholder actors are forbidden');
    }
    if (c.participants?.includes('contractor') || c.participants?.includes('city_planner')) {
      throw new Error('Invented bureaucratic actors are forbidden');
    }
    if (c.prose != null) throw new Error('No prose allowed in canonical Onari case state');
  }
}

export function isYukonAvailable(state, atMs, seed = '') {
  if (!Number.isFinite(atMs)) return false;
  const nightPlace = offscreenNightPlace('yukon', atMs);
  if (nightPlace && !offscreenAwakeAtNight('yukon', atMs, seed)) return false;
  return offscreenAvailable(state, 'yukon', { atMs, until: atMs + 30 * MIN });
}

export function isQualifyingEcologicalSource(event) {
  if (!event || event.type !== ECOLOGICAL_SOURCE_EVENT_TYPE) return false;
  const p = event.payload ?? {};
  if (p.affectsLivingHabitat !== true) return false;
  if (!VALID_CONSEQUENCE_KINDS.has(p.consequenceKind)) return false;
  if (!VALID_IMPACTS.has(p.impact)) return false;
  if (!isValidEcologicalProvenance(p.provenance)) return false;
  if (typeof p.sourceFactKey !== 'string' || !p.sourceFactKey) return false;
  const loc = event.location || p.locationId;
  if (!loc || !AREAS_BY_LOCATION[loc]) return false;
  return true;
}

export function siteHasActiveDamage(state, locationId) {
  return Object.values(of(state).sources).some(source =>
    source.locationId === locationId && source.sourceActive === true);
}

function locationRecentlyNoticed(current, locationId, now) {
  if (Object.values(current.cases).some(c => c.locationId === locationId)) return true;
  return (current.closedSummaries ?? []).some(row =>
    row.locationId === locationId
    && Number.isFinite(row.closedAt)
    && now - row.closedAt < ONARI_NOTICE_COOLDOWN_MS);
}

export function onariKnowsEcologicalProblem(state, locationId, now) {
  if (!Number.isFinite(now) || !locationId) return false;
  const site = of(state).sites[locationId];
  const sourceKeys = [
    ...(site?.sourceFactIds ?? []),
    ...Object.entries(of(state).sources)
      .filter(([, source]) => source.locationId === locationId)
      .map(([key]) => key)
  ];
  if (sourceKeys.some(key => offscreenKnowsFact(state, 'yukon', key, now))) return true;
  return Object.values(state.facts ?? {}).some(fact =>
    fact.kind === 'onari_ecology_referral'
    && fact.value?.locationId === locationId
    && (fact.validUntil == null || now < fact.validUntil));
}

export function consultationAuthority(state, locationId, now, seed = '') {
  const sources = Object.values(of(state).sources).filter(source => source.locationId === locationId);
  let named = null;
  for (const source of sources) {
    const id = source.authorityActor;
    if (!AUTHORITY_ACTORS.has(id)) continue;
    named = id;
    const who = state.characters?.[id];
    if (!who || who.location !== locationId || who.journey) continue;
    return { outcome: 'remediation_agreed', authorityActor: id };
  }
  if (named) return { outcome: 'waiting', authorityActor: named };
  if (isYukonAvailable(state, now, seed)) return { outcome: 'referred', authorityActor: null };
  return { outcome: 'no_change', authorityActor: null };
}

function save(ctx, patch) {
  ctx.ops.setLivingPlaces({ ...of(ctx.state), ...patch });
}

function setSite(ctx, site) {
  save(ctx, { sites: { ...of(ctx.state).sites, [site.locationId]: site } });
}

function setCase(ctx, c) {
  save(ctx, { cases: { ...of(ctx.state).cases, [c.caseId]: c } });
}

function setSource(ctx, key, source) {
  save(ctx, { sources: { ...of(ctx.state).sources, [key]: source } });
}

export function issueLivingPlacesActions(ctx, proposals) {
  const actions = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt) || action.dueAt <= ctx.now) {
      throw new Error('A living places action must be an owned future action');
    }
    const current = of(ctx.state);
    if (current.issued[action.id]) continue;
    const retained = Object.entries(current.issued).filter(([, row]) => row.shape.dueAt >= ctx.now - 2 * 24 * 60 * MIN);
    if (retained.length >= MAX_ISSUED) throw new Error('Living places action budget exceeded');
    ctx.ops.setLivingPlaces({
      ...current,
      issued: {
        ...Object.fromEntries(retained),
        [action.id]: { shape: shape(action), sourceEventId: ctx.id, consumed: false }
      }
    });
    actions.push(action);
  }
  return actions;
}

export function siteOpportunityActions({ state, now, parentActionId, parentEventId, sourceEvent }) {
  if (!parentActionId || !parentEventId || !sourceEvent) return [];
  if (!isQualifyingEcologicalSource(sourceEvent)) return [];
  const p = sourceEvent.payload ?? {};
  const sourceFact = state.facts?.[p.sourceFactKey];
  if (!sourceFact || sourceFact.kind !== ECOLOGICAL_SOURCE_FACT_KIND) return [];
  const locationId = sourceEvent.location || p.locationId;
  return [{
    id: `${parentActionId}/site/impact`,
    type: 'SITE_IMPACT_REGISTER',
    dueAt: now + 5 * MIN,
    priority: 36,
    day: londonDate(now + 5 * MIN),
    actors: [],
    version: 1,
    locationId,
    areaId: sourceEvent.area || p.areaId || null,
    consequenceKind: p.consequenceKind,
    impact: p.impact,
    affectsLivingHabitat: true,
    sourceEventId: parentEventId,
    sourceFactKey: p.sourceFactKey
  }];
}

export function recoveryOpportunityActions({ state, now, parentActionId, locationId, expectedDisturbedAt }) {
  if (!parentActionId || !locationId) return [];
  const site = of(state).sites[locationId];
  if (!site || site.status === 'stable') return [];
  if (siteHasActiveDamage(state, locationId) && !site.remediatedAt) return [];
  if (expectedDisturbedAt && site.disturbedAt !== expectedDisturbedAt) return [];
  return [{
    id: `${parentActionId}/site-recovery-begin`,
    type: 'SITE_RECOVERY_BEGIN',
    dueAt: now + 10 * MIN,
    priority: 36,
    day: londonDate(now + 10 * MIN),
    actors: [],
    version: 1,
    locationId,
    expectedDisturbedAt: site.disturbedAt
  }];
}

export function onariNoticeOpportunityActions({ state, now, seed, parentActionId, parentEventId, siteRecord }) {
  if (!parentActionId || !parentEventId || !siteRecord) return [];
  const current = of(state);
  if (current.activeCaseIds.length >= MAX_ACTIVE_ONARI_CASES) return [];
  if (Object.values(current.cases).some(c => OPEN_ONARI_STATUSES.has(c.status) && c.locationId === siteRecord.locationId)) return [];
  if (locationRecentlyNoticed(current, siteRecord.locationId, now)) return [];
  if (state.arcs?.session) return [];
  if (siteRecord.status === 'stable') return [];
  if (!onariKnowsEcologicalProblem(state, siteRecord.locationId, now)) return [];

  const caseId = `onari:${HASH(`${seed}|onari-notice|${siteRecord.locationId}|${parentEventId}`)}`;
  return [{
    id: `${parentActionId}/onari/notice`,
    type: 'ONARI_ECOLOGY_NOTICE',
    dueAt: now + 15 * MIN,
    priority: 37,
    day: londonDate(now + 15 * MIN),
    actors: [],
    version: 1,
    caseId,
    locationId: siteRecord.locationId,
    consequenceKind: siteRecord.consequenceKind,
    impact: siteRecord.impact,
    sourceEventId: parentEventId,
    sourceFactKey: siteRecord.sourceFactIds[0] ?? null
  }];
}

function follow(ctx, type, slug, dueAt, payload = {}) {
  return issueLivingPlacesActions(ctx, [{
    id: `${ctx.id}/${slug}`,
    type,
    dueAt,
    priority: 37,
    day: londonDate(dueAt),
    actors: payload.actors ?? [],
    version: 1,
    ...payload
  }]);
}

function protestEligible(ctx, c) {
  const { state, now } = ctx;
  if (!c || !OPEN_ONARI_STATUSES.has(c.status)) return false;
  if (!c.consultationOutcome || !['referred', 'consultation_unresolved'].includes(c.consultationOutcome)) return false;
  const site = of(state).sites[c.locationId];
  if (!site || site.status === 'stable' || site.remediatedAt) return false;
  if (!siteHasActiveDamage(state, c.locationId) && site.status !== 'disturbed') return false;
  if (now < of(state).nextProtestEligibleAt) return false;
  if (!isYukonAvailable(state, now, ctx.seed)) return false;
  return true;
}

export function resolveLivingPlacesAction(ctx) {
  const { state, action: a, now, id, event, ops } = ctx;
  if (!TYPES.has(a.type)) return false;
  const current = of(state), issuance = current.issued[a.id];
  const refuse = reason => { ops.skip(reason); return true; };

  if (!issuance || issuance.consumed || a.version !== 1 || !equal(shape(a), issuance.shape)) {
    return refuse('No owned Living Places action');
  }

  save(ctx, { issued: { ...of(ctx.state).issued, [a.id]: { ...issuance, consumed: true } } });
  event.causedBy.push(issuance.sourceEventId);

  if (a.type === ECOLOGICAL_SOURCE_EVENT_TYPE) {
    if (a.affectsLivingHabitat !== true) return refuse('Source does not affect living habitat');
    if (!VALID_CONSEQUENCE_KINDS.has(a.consequenceKind) || !VALID_IMPACTS.has(a.impact)) return refuse('Invalid ecological source fields');
    if (!isValidEcologicalProvenance(a.provenance)) return refuse('Ecological source missing provenance');
    if (!a.locationId || !AREAS_BY_LOCATION[a.locationId]) return refuse('Unknown canonical location');
    const sourceFactKey = `${a.day}:eco-source-${id}`;
    const authorityActor = AUTHORITY_ACTORS.has(a.authorityActor) ? a.authorityActor : null;
    const sourceFact = ops.createFact(sourceFactKey, ECOLOGICAL_SOURCE_FACT_KIND, 'living_places', {
      locationId: a.locationId,
      areaId: a.areaId ?? null,
      consequenceKind: a.consequenceKind,
      impact: a.impact,
      affectsLivingHabitat: true,
      provenance: a.provenance,
      sourceActive: true,
      authorityActor
    }, now + 30 * 24 * 60 * MIN);
    setSource(ctx, sourceFactKey, {
      sourceFactKey,
      sourceEventId: id,
      locationId: a.locationId,
      areaId: a.areaId ?? null,
      consequenceKind: a.consequenceKind,
      impact: a.impact,
      provenance: a.provenance,
      sourceActive: true,
      endedAt: null,
      authorityActor
    });
    event.location = a.locationId;
    event.area = a.areaId ?? null;
    event.participants = [];
    event.payload = {
      sourceFactKey,
      sourceEventId: id,
      locationId: a.locationId,
      consequenceKind: a.consequenceKind,
      impact: a.impact,
      affectsLivingHabitat: true,
      provenance: a.provenance,
      sourceActive: true
    };
    for (const who of ['goaden', 'ashai']) {
      const actor = state.characters?.[who];
      if (actor && actor.location === a.locationId && !actor.journey) {
        ops.learn(who, sourceFact, 'observation');
      }
    }
    ops.publish(`Ecological impact source recorded at ${a.locationId}.`);
    return true;
  }

  if (a.type === ECOLOGICAL_SOURCE_END_TYPE) {
    const key = a.sourceFactKey;
    const source = of(ctx.state).sources[key];
    if (!source || source.sourceActive !== true) return refuse('No active ecological source to end');
    const ended = { ...source, sourceActive: false, endedAt: now };
    const remaining = { ...of(ctx.state).sources };
    delete remaining[key];
    save(ctx, {
      sources: remaining,
      endedSourceSummaries: [{
        sourceFactKey: key, locationId: source.locationId, sourceEventId: source.sourceEventId, endedAt: now
      }, ...(of(ctx.state).endedSourceSummaries ?? [])].slice(0, MAX_ENDED_SOURCE_SUMMARIES)
    });
    ops.createFact(`${a.day}:eco-source-end-${id}`, 'ecological_source_ended', 'living_places', {
      sourceFactKey: key, locationId: source.locationId
    }, now + 14 * 24 * 60 * MIN);
    event.location = source.locationId;
    event.area = source.areaId;
    event.participants = [];
    event.payload = { sourceFactKey: key, locationId: source.locationId, sourceActive: false, sourceEnded: true };
    ops.publish(`Ecological impact source ended at ${source.locationId}.`);
    const site = of(ctx.state).sites[source.locationId];
    if (site && site.status !== 'stable') {
      ctx.followups.push(...issueLivingPlacesActions(ctx, recoveryOpportunityActions({
        state: ctx.state, now, parentActionId: a.id, locationId: source.locationId,
        expectedDisturbedAt: site.disturbedAt
      })));
    }
    return true;
  }

  if (a.type === 'SITE_IMPACT_REGISTER') {
    const sourceFact = state.facts?.[a.sourceFactKey];
    const liveSource = of(ctx.state).sources[a.sourceFactKey];
    if (!sourceFact || sourceFact.kind !== ECOLOGICAL_SOURCE_FACT_KIND) return refuse('No committed ecological source fact');
    if (!liveSource || liveSource.sourceActive !== true) return refuse('Ecological source is not active');
    if (a.locationId !== liveSource.locationId) return refuse('Source location mismatch');

    const existing = current.sites[a.locationId];
    const impact = (existing?.impact === 'moderate' || a.impact === 'moderate') ? 'moderate' : 'minor';
    const sourceEventIds = [...new Set([...(existing?.sourceEventIds ?? []), a.sourceEventId])].slice(-8);
    const factKey = `${a.day}:site-impact-${a.locationId}-${HASH(a.sourceEventId)}`;
    const sourceFactIds = [...new Set([...(existing?.sourceFactIds ?? []), a.sourceFactKey])].slice(-8);

    const siteRecord = {
      locationId: a.locationId,
      areaId: a.areaId || existing?.areaId || null,
      status: 'disturbed',
      impact,
      affectsLivingHabitat: true,
      consequenceKind: a.consequenceKind,
      sourceEventIds,
      sourceFactIds,
      disturbedAt: now,
      recoveryDueAt: null,
      remediatedAt: null,
      recoveredAt: null,
      lastEventId: id
    };
    setSite(ctx, siteRecord);
    ops.createFact(factKey, 'site_impact', 'living_places', {
      locationId: a.locationId, impact, consequenceKind: a.consequenceKind, sourceEventId: a.sourceEventId,
      sourceFactKey: a.sourceFactKey
    }, now + 14 * 24 * 60 * MIN);
    event.location = a.locationId;
    event.area = a.areaId;
    event.participants = [];
    event.payload = { locationId: a.locationId, impact, consequenceKind: a.consequenceKind, status: 'disturbed', factKey, sourceFactKey: a.sourceFactKey };
    ops.publish(`Site disturbance registered at ${a.locationId}: ${a.consequenceKind.replace(/_/g, ' ')} (${impact}).`);
    ctx.followups.push(...follow(ctx, 'SITE_RECOVERY_BEGIN', 'site-recovery-begin', now + 24 * 60 * MIN, {
      locationId: a.locationId,
      expectedDisturbedAt: now
    }));
    return true;
  }

  if (a.type === 'SITE_RECOVERY_BEGIN') {
    const site = of(ctx.state).sites[a.locationId];
    if (!site || site.status === 'stable') return refuse('Site already stable');
    if (site.status === 'recovering' && !site.remediatedAt) return refuse('Recovery already underway');
    if (a.expectedDisturbedAt && site.disturbedAt !== a.expectedDisturbedAt) {
      return refuse('Recovery superseded by a later impact');
    }
    if (siteHasActiveDamage(ctx.state, a.locationId) && !site.remediatedAt) {
      return refuse('Active damaging source still present');
    }
    const duration = site.remediatedAt
      ? (site.impact === 'moderate' ? RECOVERY_DURATIONS.moderate_remediated : RECOVERY_DURATIONS.minor_remediated)
      : (site.impact === 'moderate' ? RECOVERY_DURATIONS.moderate_natural : RECOVERY_DURATIONS.minor_natural);
    const recoveryDueAt = now + duration;
    setSite(ctx, { ...site, status: 'recovering', recoveryDueAt, lastEventId: id });
    const factKey = `${a.day}:site-recovery-${a.locationId}`;
    ops.createFact(factKey, 'site_recovery', 'living_places', {
      locationId: a.locationId, status: 'recovering', recoveryDueAt
    }, recoveryDueAt + 24 * 60 * MIN);
    event.location = a.locationId;
    event.area = site.areaId;
    event.participants = [];
    event.payload = { locationId: a.locationId, status: 'recovering', recoveryDueAt, factKey };
    ops.publish(`Site recovery underway at ${a.locationId}. Expected stable around ${londonDate(recoveryDueAt)}.`);
    ctx.followups.push(...follow(ctx, 'SITE_RECOVERY_DUE', 'site-recovery-due', recoveryDueAt, {
      locationId: a.locationId,
      expectedRecoveryDueAt: recoveryDueAt,
      expectedDisturbedAt: site.disturbedAt
    }));
    return true;
  }

  if (a.type === 'SITE_RECOVERY_DUE') {
    const site = of(ctx.state).sites[a.locationId];
    if (!site || site.status !== 'recovering') return refuse('Site is not in recovery');
    if (a.expectedRecoveryDueAt && site.recoveryDueAt !== a.expectedRecoveryDueAt) {
      return refuse('Recovery deadline was extended by subsequent impact');
    }
    if (a.expectedDisturbedAt && site.disturbedAt !== a.expectedDisturbedAt) {
      return refuse('Recovery superseded by a later impact');
    }
    if (siteHasActiveDamage(ctx.state, a.locationId) && !site.remediatedAt) {
      return refuse('Active damaging source still present');
    }
    setSite(ctx, {
      ...site, status: 'stable', recoveryDueAt: null, recoveredAt: now, lastEventId: id
    });
    save(ctx, {
      recoveredSummaries: [{
        locationId: site.locationId,
        recoveredAt: now,
        remediated: Boolean(site.remediatedAt),
        sourceFactIds: site.sourceFactIds ?? []
      }, ...of(ctx.state).recoveredSummaries].slice(0, MAX_RECOVERED_SUMMARIES)
    });
    const factKey = `${a.day}:site-recovered-${a.locationId}`;
    ops.createFact(factKey, 'site_recovered', 'living_places', {
      locationId: a.locationId, recoveredAt: now
    }, now + 7 * 24 * 60 * MIN);
    event.location = a.locationId;
    event.area = site.areaId;
    event.participants = [];
    event.payload = { locationId: a.locationId, status: 'stable', recoveredAt: now, factKey };
    ops.publish(`Site fully recovered at ${a.locationId}. Normal conditions restored.`);
    return true;
  }

  if (a.type === 'ONARI_ECOLOGY_REFERRAL') {
    const site = of(ctx.state).sites[a.locationId];
    const sourceFact = state.facts?.[a.sourceFactKey];
    if (!site || site.status === 'stable') return refuse('No disturbed site to refer');
    if (!sourceFact || sourceFact.kind !== ECOLOGICAL_SOURCE_FACT_KIND) return refuse('No committed ecological source to refer');
    const taught = learnOffscreenFact(ctx, 'yukon', sourceFact);
    const factKey = `${a.day}:onari-referral-${a.locationId}-${HASH(a.sourceFactKey)}`;
    ops.createFact(factKey, 'onari_ecology_referral', 'onari', {
      locationId: a.locationId, sourceFactKey: a.sourceFactKey, yukonTaught: taught
    }, now + 14 * 24 * 60 * MIN);
    event.location = a.locationId;
    event.area = site.areaId;
    event.participants = [];
    event.payload = { locationId: a.locationId, sourceFactKey: a.sourceFactKey, factKey, stage: 'referral' };
    ops.publish(`Onari ecological referral recorded for ${a.locationId}.`);
    const notice = onariNoticeOpportunityActions({
      state: ctx.state, now, seed: ctx.seed,
      parentActionId: a.id, parentEventId: id, siteRecord: of(ctx.state).sites[a.locationId]
    });
    if (notice.length) ctx.followups.push(...issueLivingPlacesActions(ctx, notice));
    return true;
  }

  if (a.type === 'ONARI_ECOLOGY_NOTICE') {
    if (of(ctx.state).activeCaseIds.length >= MAX_ACTIVE_ONARI_CASES) {
      return refuse('Maximum active Onari ecology cases reached');
    }
    const site = of(ctx.state).sites[a.locationId];
    if (!site || site.status === 'stable') return refuse('Site is not disturbed');
    if (!onariKnowsEcologicalProblem(ctx.state, a.locationId, now)) {
      return refuse('Onari side has no committed knowledge of this site');
    }
    if (locationRecentlyNoticed(of(ctx.state), a.locationId, now)) {
      return refuse('Onari notice cooldown for this location');
    }
    const c = {
      caseId: a.caseId,
      token: `${id}:onari-v1`,
      version: 1,
      system: 'onari_ecology',
      family: 'onari.ecology_notice',
      status: 'noticed',
      locationId: a.locationId,
      openedAt: now,
      sourceEventIds: [a.sourceEventId],
      sourceFactIds: a.sourceFactKey ? [a.sourceFactKey] : [],
      consequenceKind: a.consequenceKind,
      impact: a.impact,
      consultationOutcome: null,
      protested: false,
      protestStartedAt: null,
      protestEndedAt: null,
      remediationAction: null,
      remediationScheduled: false,
      closedAt: null,
      participants: [],
      originEventId: id,
      lastEventId: id,
      causalEventIds: [id]
    };
    setCase(ctx, c);
    save(ctx, {
      activeCaseIds: [...of(ctx.state).activeCaseIds, c.caseId]
    });
    const factKey = `${a.day}:onari-notice-${c.caseId}`;
    ops.createFact(factKey, 'onari_ecology_notice', 'onari', {
      caseId: c.caseId, locationId: a.locationId, consequenceKind: a.consequenceKind
    }, now + 7 * 24 * 60 * MIN);
    event.location = a.locationId;
    event.area = null;
    event.participants = [];
    event.payload = { caseId: c.caseId, locationId: a.locationId, consequenceKind: a.consequenceKind, stage: 'notice', factKey };
    ops.publish(`Onari ecology notice recorded for ${a.locationId}: ecological consequences noted under custodianship tradition.`);
    ctx.followups.push(...follow(ctx, 'ONARI_CONSULTATION', 'consultation', now + 60 * MIN, {
      caseId: c.caseId, caseToken: c.token, locationId: a.locationId
    }));
    return true;
  }

  const c = a.caseId ? of(ctx.state).cases[a.caseId] : null;
  if (!CASELESS.has(a.type) && (!c || c.token !== a.caseToken)) return refuse('No matching Onari ecology case');

  if (a.type === 'ONARI_CONSULTATION') {
    const yukonPresent = isYukonAvailable(state, now, ctx.seed);
    const participants = yukonPresent ? ['yukon'] : [];
    const decision = consultationAuthority(ctx.state, c.locationId, now, ctx.seed);
    const outcome = decision.outcome;
    setCase(ctx, {
      ...c,
      status: 'consulting',
      family: 'onari.consultation',
      consultationOutcome: outcome,
      participants,
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    });
    const factKey = `${a.day}:onari-consultation-${c.caseId}`;
    ops.createFact(factKey, 'onari_ecology_consultation', 'onari', {
      caseId: c.caseId, locationId: c.locationId, outcome, yukonPresent, authorityActor: decision.authorityActor
    }, now + 7 * 24 * 60 * MIN);
    event.location = c.locationId;
    event.area = null;
    event.participants = participants;
    event.payload = {
      caseId: c.caseId, locationId: c.locationId, stage: 'consultation', outcome,
      yukonPresent, authorityActor: decision.authorityActor, factKey
    };
    ops.publish(`Onari ecological consultation held for ${c.locationId}; outcome: ${outcome.replace(/_/g, ' ')}.`);
    if (outcome === 'remediation_agreed') {
      ctx.followups.push(...follow(ctx, 'ONARI_REMEDIATION', 'remediation', now + 45 * MIN, {
        caseId: c.caseId, caseToken: c.token, remediationAction: 'restoration_scheduled'
      }));
    } else if (['referred', 'consultation_unresolved'].includes(outcome)) {
      ctx.followups.push(...follow(ctx, 'ONARI_PROTEST_BEGIN', 'protest-begin', now + 60 * MIN, {
        caseId: c.caseId, caseToken: c.token
      }));
    } else {
      ctx.followups.push(...follow(ctx, 'ONARI_NO_CHANGE', 'no-change', now + 45 * MIN, {
        caseId: c.caseId, caseToken: c.token, reason: outcome
      }));
    }
    return true;
  }

  if (a.type === 'ONARI_PROTEST_BEGIN') {
    const live = of(ctx.state).cases[a.caseId];
    if (!live) return refuse('No matching Onari ecology case');
    if (!protestEligible(ctx, live)) {
      ctx.followups.push(...follow(ctx, 'ONARI_NO_CHANGE', 'no-change', now + 15 * MIN, {
        caseId: live.caseId, caseToken: live.token, reason: 'protest_prerequisites_not_met'
      }));
      return refuse('Protest prerequisites not met');
    }
    const participants = ['yukon'];
    setCase(ctx, {
      ...live,
      status: 'protesting',
      family: 'onari.peaceful_protest',
      protested: true,
      protestStartedAt: now,
      participants,
      lastEventId: id,
      causalEventIds: [...new Set([...live.causalEventIds, id])]
    });
    save(ctx, { nextProtestEligibleAt: now + ONARI_PROTEST_SPACING_MS });
    const factKey = `${a.day}:onari-protest-${live.caseId}`;
    ops.createFact(factKey, 'onari_protest', 'onari', {
      caseId: live.caseId, locationId: live.locationId, peaceful: true
    }, now + 7 * 24 * 60 * MIN);
    event.location = live.locationId;
    event.area = null;
    event.participants = participants;
    event.payload = { caseId: live.caseId, locationId: live.locationId, stage: 'protest_begin', peaceful: true, factKey };
    ops.publish(`Peaceful Onari demonstration assembled near ${live.locationId} advocating habitat restoration.`);
    ctx.followups.push(...follow(ctx, 'ONARI_PROTEST_END', 'protest-end', now + 120 * MIN, {
      caseId: live.caseId, caseToken: live.token
    }));
    return true;
  }

  if (a.type === 'ONARI_PROTEST_END') {
    setCase(ctx, {
      ...c,
      protestEndedAt: now,
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    });
    event.location = c.locationId;
    event.area = null;
    event.participants = c.participants;
    event.payload = { caseId: c.caseId, locationId: c.locationId, stage: 'protest_end', peaceful: true };
    ops.publish(`Peaceful Onari demonstration concluded near ${c.locationId}.`);
    ctx.followups.push(...follow(ctx, 'ONARI_NO_CHANGE', 'no-change', now + 30 * MIN, {
      caseId: c.caseId, caseToken: c.token, reason: 'protest_concluded_without_authority'
    }));
    return true;
  }

  if (a.type === 'ONARI_REMEDIATION') {
    const action = a.remediationAction || 'restoration_scheduled';
    setCase(ctx, {
      ...c,
      status: 'remediating',
      family: 'onari.restoration',
      remediationAction: action,
      remediationScheduled: true,
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    });
    const site = of(ctx.state).sites[c.locationId];
    if (site && site.status !== 'stable') {
      setSite(ctx, { ...site, remediatedAt: now, lastEventId: id });
      ctx.followups.push(...follow(ctx, 'SITE_RECOVERY_BEGIN', 'site-recovery-begin', now + 10 * MIN, {
        locationId: c.locationId,
        expectedDisturbedAt: site.disturbedAt
      }));
    }
    const factKey = `${a.day}:onari-result-${c.caseId}`;
    ops.createFact(factKey, 'onari_ecology_result', 'onari', {
      caseId: c.caseId, outcome: 'remediation_enacted', remediationAction: action
    }, now + 7 * 24 * 60 * MIN);
    event.location = c.locationId;
    event.area = null;
    event.participants = [];
    event.payload = { caseId: c.caseId, locationId: c.locationId, stage: 'remediation', remediationAction: action, factKey };
    ops.publish(`Habitat restoration agreement enacted for ${c.locationId}: ${action.replace(/_/g, ' ')}.`);
    ctx.followups.push(...follow(ctx, 'ONARI_ECOLOGY_CLOSE', 'close', now + 30 * MIN, {
      caseId: c.caseId, caseToken: c.token
    }));
    return true;
  }

  if (a.type === 'ONARI_NO_CHANGE') {
    setCase(ctx, {
      ...c,
      status: 'unresolved',
      family: 'onari.unresolved_grievance',
      remediationAction: 'no_change',
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    });
    const factKey = `${a.day}:onari-result-${c.caseId}`;
    ops.createFact(factKey, 'onari_ecology_result', 'onari', {
      caseId: c.caseId, outcome: 'no_change'
    }, now + 7 * 24 * 60 * MIN);
    event.location = c.locationId;
    event.area = null;
    event.participants = [];
    event.payload = { caseId: c.caseId, locationId: c.locationId, stage: 'no_change', outcome: 'unresolved_grievance', factKey };
    ops.publish(`Onari consultation closed without remediation agreement for ${c.locationId}. Grievance noted.`);
    ctx.followups.push(...follow(ctx, 'ONARI_ECOLOGY_CLOSE', 'close', now + 30 * MIN, {
      caseId: c.caseId, caseToken: c.token
    }));
    return true;
  }

  if (a.type === 'ONARI_ECOLOGY_CLOSE') {
    const summary = {
      caseId: c.caseId,
      locationId: c.locationId,
      protested: c.protested,
      outcome: c.remediationAction || 'closed',
      closedAt: now,
      sourceFactIds: c.sourceFactIds ?? [],
      sourceEventIds: c.sourceEventIds ?? []
    };
    const nextCases = { ...of(ctx.state).cases };
    delete nextCases[c.caseId];
    save(ctx, {
      cases: nextCases,
      activeCaseIds: of(ctx.state).activeCaseIds.filter(caseId => caseId !== c.caseId),
      closedSummaries: [summary, ...of(ctx.state).closedSummaries].slice(0, MAX_CLOSED_SUMMARIES)
    });
    event.location = c.locationId;
    event.area = null;
    event.participants = [];
    event.payload = { caseId: c.caseId, locationId: c.locationId, stage: 'close' };
    ops.publish(`Onari ecology case ${c.caseId} closed.`);
    return true;
  }

  return false;
}
