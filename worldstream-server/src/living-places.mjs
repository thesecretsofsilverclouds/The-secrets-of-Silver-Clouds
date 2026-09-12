import { createHash } from 'node:crypto';
import { londonDate, MINUTE_MS as MIN } from './time.mjs';
import { offscreenAvailable, offscreenAwakeAtNight, offscreenNightPlace } from './offscreen-lives.mjs';
import { AREAS_BY_LOCATION } from './places.mjs';

// Addon Four: Living Places / Onari Ecology & Recovery
// Grounded in Canon CP-ONA-01..03 and Silent PE-A (Onari custodianship, living places, peaceful protests).
// Dual-subsystem architecture:
// 1. Physical Site Consequence Memory: Locations remember physical/ecological consequences (stable, disturbed, recovering).
//    Operates independently; natural recovery occurs deterministically even if no Onari responds.
// 2. Onari Ecology Response: Onari custodianship reacts when nature/living habitat is affected.
//    Notice → Consultation → [Protest] → Remediation / No Change → Close.
// Strict invariants:
// - Facts first: No disturbance without an explicit committed source fact.
// - Discrete state only: stable | disturbed | recovering, minor | moderate. Zero continuous percentage meters.
// - Existing canonical locations only (src/places.mjs). No invented london/park or embankment.
// - Yukon is strictly optional (joins only if awake, not travelling, and available; no divided loyalty meter).
// - No invented bureaucracy (no planning councils, no generic onari_protester or onari_liaison).
// - Protest is a rare consequence of failed consultation and ongoing unresolved harm (0-2 / 90d), peaceful by default.
// - Zero prose in canonical state or event payloads.

export const LIVING_PLACES_VERSION = 1;

// Event Types
export const SITE_EVENT_TYPES = Object.freeze([
  'SITE_IMPACT_REGISTER',
  'SITE_RECOVERY_BEGIN',
  'SITE_RECOVERY_DUE',
  'SITE_RECOVERED'
]);

export const ONARI_ECOLOGY_EVENT_TYPES = Object.freeze([
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

// Fact Kinds
export const LIVING_PLACES_FACT_KINDS = Object.freeze([
  'site_impact',
  'site_recovery',
  'site_recovered',
  'onari_ecology_notice',
  'onari_ecology_consultation',
  'onari_protest',
  'onari_ecology_result'
]);

// Valid ecological consequence kinds
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
export const ONARI_CASE_STATUSES = Object.freeze([
  'noticed',
  'consulting',
  'protesting',
  'remediating',
  'unresolved',
  'closed'
]);

export const ONARI_FAMILIES = Object.freeze([
  'onari.ecology_notice',
  'onari.consultation',
  'onari.peaceful_protest',
  'onari.restoration',
  'onari.unresolved_grievance'
]);

// Deterministic recovery durations (ms)
export const RECOVERY_DURATIONS = Object.freeze({
  minor_remediated: 72 * 60 * MIN,          // 72 hours
  moderate_remediated: 7 * 24 * 60 * MIN,    // 7 days
  minor_natural: 7 * 24 * 60 * MIN,          // ~7 days
  moderate_natural: 14 * 24 * 60 * MIN,      // ~14 days
});

// Cooldowns and limits
export const ONARI_NOTICE_COOLDOWN_MS = 14 * 24 * 60 * MIN; // ≥14 days between Onari notices
export const ONARI_PROTEST_SPACING_MS = 7 * 24 * 60 * MIN;   // ≥7 days between protest starts
export const MAX_ACTIVE_ONARI_CASES = 2;
export const MAX_ACTIVE_DISTURBED_SITES = 2;

const HASH = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
const TYPES = new Set(LIVING_PLACES_EVENT_TYPES);
const VALID_CONSEQUENCE_KINDS = new Set(ECOLOGICAL_CONSEQUENCE_KINDS);
const VALID_SITE_STATUSES = new Set(SITE_STATUSES);
const VALID_IMPACTS = new Set(IMPACT_SEVERITIES);
const VALID_ONARI_STATUSES = new Set(ONARI_CASE_STATUSES);
const OPEN_ONARI_STATUSES = new Set(['noticed', 'consulting', 'protesting', 'remediating', 'unresolved']);

const of = state => state.livingPlaces ?? initialLivingPlacesState();
const shape = a => ({ id: a.id, type: a.type, dueAt: a.dueAt, priority: a.priority, day: a.day });
const equal = (a, b) => a.id === b.id && a.type === b.type && a.dueAt === b.dueAt && a.priority === b.priority && a.day === b.day;

export function initialLivingPlacesState() {
  return {
    version: 1,
    sites: {},              // locationId -> siteRecord
    cases: {},              // caseId -> onariCaseRecord
    activeCaseIds: [],      // Array of open Onari caseIds (max 2)
    nextNoticeEligibleAt: 0,
    nextProtestEligibleAt: 0,
    closedSummaries: [],    // ring buffer <= 24
    recoveredSummaries: [], // ring buffer <= 24
    issued: {}              // in-flight scheduled actions <= 128
  };
}

export function assertLivingPlaces(state) {
  if (!state.livingPlaces) return;
  const current = of(state);
  if (!Number.isInteger(current.version)) throw new Error('Invalid livingPlaces version');
  if (typeof current.sites !== 'object' || current.sites === null) throw new Error('Invalid livingPlaces sites');
  if (typeof current.cases !== 'object' || current.cases === null) throw new Error('Invalid livingPlaces cases');
  if (current.closedSummaries.length > 24) throw new Error('Onari closedSummaries limit exceeded (max 24)');
  if (current.recoveredSummaries.length > 24) throw new Error('Site recoveredSummaries limit exceeded (max 24)');
  if (Object.keys(current.issued).length > 128) throw new Error('LivingPlaces issued limit exceeded (max 128)');

  // Validate sites
  for (const [locId, site] of Object.entries(current.sites)) {
    if (!AREAS_BY_LOCATION[locId]) throw new Error(`Unknown canonical location for site: ${locId}`);
    if (!VALID_SITE_STATUSES.has(site.status)) throw new Error(`Invalid site status: ${site.status}`);
    if (!VALID_IMPACTS.has(site.impact)) throw new Error(`Invalid site impact: ${site.impact}`);
    if (!VALID_CONSEQUENCE_KINDS.has(site.consequenceKind)) throw new Error(`Invalid consequence kind: ${site.consequenceKind}`);
    if (typeof site.affectsLivingHabitat !== 'boolean') throw new Error('affectsLivingHabitat must be boolean');
    if (site.prose != null) throw new Error('No prose allowed in canonical site state');
  }

  // Validate Onari cases
  const openCases = Object.values(current.cases).filter(c => OPEN_ONARI_STATUSES.has(c.status));
  if (openCases.length > MAX_ACTIVE_ONARI_CASES) {
    throw new Error(`At most ${MAX_ACTIVE_ONARI_CASES} open Onari ecology cases`);
  }
  if (current.activeCaseIds.length > MAX_ACTIVE_ONARI_CASES) {
    throw new Error(`activeCaseIds cannot exceed ${MAX_ACTIVE_ONARI_CASES}`);
  }

  for (const c of Object.values(current.cases)) {
    if (!VALID_ONARI_STATUSES.has(c.status)) throw new Error(`Invalid Onari case status: ${c.status}`);
    if (c.participants?.includes('onari_protester') || c.participants?.includes('onari_liaison')) {
      throw new Error('Generic onari placeholder actors are forbidden');
    }
    if (c.participants?.includes('contractor') || c.participants?.includes('city_planner')) {
      throw new Error('Invented bureaucratic actors are forbidden');
    }
    if (c.prose != null) throw new Error('No prose allowed in canonical Onari case state');
  }
}

/**
 * Check if Yukon is available to participate in an Onari consultation or protest.
 * Yukon is strictly optional. If busy gaming, sleeping, on duty, or travelling, returns false.
 */
export function isYukonAvailable(state, atMs, seed = '') {
  if (!Number.isFinite(atMs)) return false;
  // Sleep / night check
  const nightPlace = offscreenNightPlace('yukon', atMs);
  if (nightPlace) {
    const isAwake = offscreenAwakeAtNight('yukon', atMs, seed);
    if (!isAwake) return false;
  }
  // Availability from commitments / sessions
  return offscreenAvailable(state, 'yukon', { atMs, until: atMs + 30 * MIN });
}

/**
 * Strict source check: A site consequence requires a committed source fact proving
 * an explicit ecological / habitat consequence.
 */
export function isQualifyingEcologicalSource(event) {
  if (!event) return false;
  const p = event.payload ?? {};
  if (p.affectsLivingHabitat !== true) return false;
  const kind = p.consequenceKind || p.kind;
  if (!VALID_CONSEQUENCE_KINDS.has(kind)) return false;
  const loc = event.location || p.locationId;
  if (!loc || !AREAS_BY_LOCATION[loc]) return false;
  return true;
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

export function issueLivingPlacesActions(ctx, proposals) {
  const actions = [];
  for (const action of proposals) {
    if (!TYPES.has(action.type) || action.version !== 1 || !Number.isSafeInteger(action.dueAt) || action.dueAt <= ctx.now) {
      throw new Error('A living places action must be an owned future action');
    }
    const current = of(ctx.state);
    if (current.issued[action.id]) continue;
    const retained = Object.entries(current.issued).filter(([, row]) => row.shape.dueAt >= ctx.now - 4 * 24 * 60 * MIN);
    if (retained.length >= 128) throw new Error('Living places action budget exceeded');
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

/**
 * Opportunity generator for site impact from a qualifying source event.
 */
export function siteOpportunityActions({ state, day, now, seed, parentActionId, parentEventId, sourceEvent }) {
  if (!parentActionId || !parentEventId || !sourceEvent) return [];
  if (!isQualifyingEcologicalSource(sourceEvent)) return [];

  const p = sourceEvent.payload ?? {};
  const locationId = sourceEvent.location || p.locationId;
  const areaId = sourceEvent.area || p.areaId || null;
  const consequenceKind = p.consequenceKind || p.kind;
  const impact = p.impact === 'moderate' ? 'moderate' : 'minor';
  const affectsLivingHabitat = true;

  const actionId = `${parentActionId}/site/impact`;
  return [{
    id: actionId,
    type: 'SITE_IMPACT_REGISTER',
    dueAt: now + 5 * MIN,
    priority: 36,
    day: londonDate(now + 5 * MIN),
    actors: [],
    version: 1,
    locationId,
    areaId,
    consequenceKind,
    impact,
    affectsLivingHabitat,
    sourceEventId: parentEventId,
    sourceFactKey: p.factKey ?? null
  }];
}

/**
 * Opportunity generator for Onari ecology notice when a disturbed site affects living habitat.
 */
export function onariNoticeOpportunityActions({ state, day, now, seed, parentActionId, parentEventId, siteRecord }) {
  if (!parentActionId || !parentEventId || !siteRecord) return [];
  const current = of(state);

  // Negative gate: at most 2 active Onari cases
  if (current.activeCaseIds.length >= MAX_ACTIVE_ONARI_CASES) return [];
  if (Object.values(current.cases).some(c => OPEN_ONARI_STATUSES.has(c.status) && c.locationId === siteRecord.locationId)) return [];

  // Negative gate: cooldown between notices (≥14 days)
  if (now < current.nextNoticeEligibleAt) return [];

  // Authored arc ownership check
  if (state.arcs?.session) return [];

  const caseId = `onari:${HASH(`${seed}|onari-notice|${siteRecord.locationId}|${parentEventId}`)}`;
  const actionId = `${parentActionId}/onari/notice`;

  return [{
    id: actionId,
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

/**
 * Master reducer for all Living Places (Site Memory + Onari Ecology) actions.
 */
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

  // =========================================================================
  // SYSTEM 1: SITE MEMORY
  // =========================================================================

  if (a.type === 'SITE_IMPACT_REGISTER') {
    const existing = current.sites[a.locationId];
    const impact = (existing?.impact === 'moderate' || a.impact === 'moderate') ? 'moderate' : 'minor';
    const sourceEventIds = [...new Set([...(existing?.sourceEventIds ?? []), a.sourceEventId])];
    const factKey = `${a.day}:site-impact-${a.locationId}-${HASH(a.sourceEventId)}`;
    const sourceFactIds = [...new Set([...(existing?.sourceFactIds ?? []), factKey])];

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
      activeSourceCount: (existing?.activeSourceCount ?? 0) + 1,
      lastEventId: id
    };

    setSite(ctx, siteRecord);

    const siteFact = ops.createFact(factKey, 'site_impact', 'living_places', {
      locationId: a.locationId, impact, consequenceKind: a.consequenceKind, sourceEventId: a.sourceEventId
    }, now + 14 * 24 * 60 * MIN);

    event.location = a.locationId;
    event.area = a.areaId;
    event.participants = [];
    event.payload = {
      locationId: a.locationId,
      impact,
      consequenceKind: a.consequenceKind,
      status: 'disturbed',
      factKey
    };
    ops.publish(`Site disturbance registered at ${a.locationId}: ${a.consequenceKind.replace(/_/g, ' ')} (${impact}).`);

    // Schedule natural recovery begin check in 24 hours
    ctx.followups.push(...follow(ctx, 'SITE_RECOVERY_BEGIN', 'site-recovery-begin', now + 24 * 60 * MIN, {
      locationId: a.locationId
    }));

    // Check Onari response opportunity
    const onariOpps = onariNoticeOpportunityActions({
      state, day: a.day, now, seed: ctx.seed,
      parentActionId: a.id, parentEventId: id, siteRecord
    });
    if (onariOpps.length > 0) {
      ctx.followups.push(...issueLivingPlacesActions(ctx, onariOpps));
    }
    return true;
  }

  if (a.type === 'SITE_RECOVERY_BEGIN') {
    const site = current.sites[a.locationId];
    if (!site || site.status === 'stable') return refuse('Site already stable');

    // Natural recovery begins if remediated or if source condition is dormant/ended
    const duration = site.remediatedAt
      ? (site.impact === 'moderate' ? RECOVERY_DURATIONS.moderate_remediated : RECOVERY_DURATIONS.minor_remediated)
      : (site.impact === 'moderate' ? RECOVERY_DURATIONS.moderate_natural : RECOVERY_DURATIONS.minor_natural);

    const recoveryDueAt = now + duration;
    const nextSite = {
      ...site,
      status: 'recovering',
      recoveryDueAt,
      lastEventId: id
    };
    setSite(ctx, nextSite);

    const factKey = `${a.day}:site-recovery-${a.locationId}`;
    ops.createFact(factKey, 'site_recovery', 'living_places', {
      locationId: a.locationId, status: 'recovering', recoveryDueAt
    }, recoveryDueAt + 24 * 60 * MIN);

    event.location = a.locationId;
    event.area = site.areaId;
    event.participants = [];
    event.payload = {
      locationId: a.locationId,
      status: 'recovering',
      recoveryDueAt,
      factKey
    };
    ops.publish(`Site recovery underway at ${a.locationId}. Expected stable around ${londonDate(recoveryDueAt)}.`);

    ctx.followups.push(...follow(ctx, 'SITE_RECOVERY_DUE', 'site-recovery-due', recoveryDueAt, {
      locationId: a.locationId,
      expectedRecoveryDueAt: recoveryDueAt
    }));
    return true;
  }

  if (a.type === 'SITE_RECOVERY_DUE') {
    const site = current.sites[a.locationId];
    if (!site || site.status !== 'recovering') return refuse('Site is not in recovery');
    if (a.expectedRecoveryDueAt && site.recoveryDueAt !== a.expectedRecoveryDueAt) {
      return refuse('Recovery deadline was extended by subsequent impact');
    }

    // Recover site to stable
    const recoveredSite = {
      ...site,
      status: 'stable',
      recoveryDueAt: null,
      recoveredAt: now,
      activeSourceCount: 0,
      lastEventId: id
    };
    setSite(ctx, recoveredSite);

    // Save summary in recoveredSummaries ring buffer
    const summary = {
      locationId: site.locationId,
      consequenceKind: site.consequenceKind,
      impact: site.impact,
      disturbedAt: site.disturbedAt,
      recoveredAt: now,
      remediated: Boolean(site.remediatedAt)
    };
    save(ctx, {
      recoveredSummaries: [summary, ...of(ctx.state).recoveredSummaries].slice(0, 24)
    });

    const factKey = `${a.day}:site-recovered-${a.locationId}`;
    ops.createFact(factKey, 'site_recovered', 'living_places', {
      locationId: a.locationId, recoveredAt: now
    }, now + 7 * 24 * 60 * MIN);

    event.location = a.locationId;
    event.area = site.areaId;
    event.participants = [];
    event.payload = {
      locationId: a.locationId,
      status: 'stable',
      recoveredAt: now,
      factKey
    };
    ops.publish(`Site fully recovered at ${a.locationId}. Normal conditions restored.`);
    return true;
  }

  // =========================================================================
  // SYSTEM 2: ONARI ECOLOGY RESPONSE
  // =========================================================================

  if (a.type === 'ONARI_ECOLOGY_NOTICE') {
    if (current.activeCaseIds.length >= MAX_ACTIVE_ONARI_CASES) {
      return refuse('Maximum active Onari ecology cases reached');
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
      activeCaseIds: [...of(ctx.state).activeCaseIds, c.caseId],
      nextNoticeEligibleAt: now + ONARI_NOTICE_COOLDOWN_MS
    });

    const factKey = `${a.day}:onari-notice-${c.caseId}`;
    ops.createFact(factKey, 'onari_ecology_notice', 'onari', {
      caseId: c.caseId, locationId: a.locationId, consequenceKind: a.consequenceKind
    }, now + 7 * 24 * 60 * MIN);

    event.location = a.locationId;
    event.area = null;
    event.participants = [];
    event.payload = {
      caseId: c.caseId,
      locationId: a.locationId,
      consequenceKind: a.consequenceKind,
      stage: 'notice',
      factKey
    };
    ops.publish(`Onari ecology notice recorded for ${a.locationId}: ecological consequences noted under custodianship tradition.`);

    // Schedule consultation in 1 hour
    ctx.followups.push(...follow(ctx, 'ONARI_CONSULTATION', 'consultation', now + 60 * MIN, {
      caseId: c.caseId,
      caseToken: c.token,
      locationId: a.locationId
    }));
    return true;
  }

  // Common Onari case retrieval
  const c = a.caseId ? of(state).cases[a.caseId] : null;
  if (!c || c.token !== a.caseToken) return refuse('No matching Onari ecology case');

  if (a.type === 'ONARI_CONSULTATION') {
    // Check Yukon availability (optional!)
    const yukonPresent = isYukonAvailable(state, now, ctx.seed);
    const participants = yukonPresent ? ['yukon'] : [];

    // Consultation outcome: if an authority can agree remediation, outcome is agreed.
    // If ongoing unmitigated disturbance or unresolved instruction, outcome is consultation_unresolved.
    const site = of(state).sites[c.locationId];
    const unresolved = a.forceOutcome === 'consultation_unresolved' ||
      (c.impact === 'moderate' && (site?.activeSourceCount ?? 1) > 1);
    const outcome = unresolved ? 'consultation_unresolved' : 'remediation_agreed';

    const updated = {
      ...c,
      status: 'consulting',
      family: 'onari.consultation',
      consultationOutcome: outcome,
      participants,
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    };
    setCase(ctx, updated);

    const factKey = `${a.day}:onari-consultation-${c.caseId}`;
    ops.createFact(factKey, 'onari_ecology_consultation', 'onari', {
      caseId: c.caseId, locationId: c.locationId, outcome, yukonPresent
    }, now + 7 * 24 * 60 * MIN);

    event.location = c.locationId;
    event.area = null;
    event.participants = participants;
    event.payload = {
      caseId: c.caseId,
      locationId: c.locationId,
      stage: 'consultation',
      outcome,
      yukonPresent,
      factKey
    };
    ops.publish(`Onari ecological consultation held for ${c.locationId}; outcome: ${outcome.replace(/_/g, ' ')}.`);

    if (outcome === 'remediation_agreed') {
      ctx.followups.push(...follow(ctx, 'ONARI_REMEDIATION', 'remediation', now + 45 * MIN, {
        caseId: c.caseId, caseToken: c.token, remediationAction: 'restoration_scheduled'
      }));
    } else {
      // Consultation unresolved: may initiate peaceful protest if protest cooldown elapsed
      const canProtest = now >= of(state).nextProtestEligibleAt;
      if (canProtest) {
        ctx.followups.push(...follow(ctx, 'ONARI_PROTEST_BEGIN', 'protest-begin', now + 60 * MIN, {
          caseId: c.caseId, caseToken: c.token
        }));
      } else {
        ctx.followups.push(...follow(ctx, 'ONARI_NO_CHANGE', 'no-change', now + 45 * MIN, {
          caseId: c.caseId, caseToken: c.token, reason: 'consultation_unresolved_cooldown'
        }));
      }
    }
    return true;
  }

  if (a.type === 'ONARI_PROTEST_BEGIN') {
    // Peaceful Onari protest (PE-A)
    const yukonPresent = isYukonAvailable(state, now, ctx.seed);
    const participants = yukonPresent ? ['yukon'] : [];

    const updated = {
      ...c,
      status: 'protesting',
      family: 'onari.peaceful_protest',
      protested: true,
      protestStartedAt: now,
      participants,
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    };
    setCase(ctx, updated);
    save(ctx, { nextProtestEligibleAt: now + ONARI_PROTEST_SPACING_MS });

    const factKey = `${a.day}:onari-protest-${c.caseId}`;
    ops.createFact(factKey, 'onari_protest', 'onari', {
      caseId: c.caseId, locationId: c.locationId, peaceful: true
    }, now + 7 * 24 * 60 * MIN);

    event.location = c.locationId;
    event.area = null;
    event.participants = participants;
    event.payload = {
      caseId: c.caseId,
      locationId: c.locationId,
      stage: 'protest_begin',
      peaceful: true,
      factKey
    };
    ops.publish(`Peaceful Onari demonstration assembled near ${c.locationId} advocating habitat restoration.`);

    // Peaceful protest concludes in 2 hours
    ctx.followups.push(...follow(ctx, 'ONARI_PROTEST_END', 'protest-end', now + 120 * MIN, {
      caseId: c.caseId, caseToken: c.token
    }));
    return true;
  }

  if (a.type === 'ONARI_PROTEST_END') {
    const updated = {
      ...c,
      protestEndedAt: now,
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    };
    setCase(ctx, updated);

    event.location = c.locationId;
    event.area = null;
    event.participants = c.participants;
    event.payload = {
      caseId: c.caseId,
      locationId: c.locationId,
      stage: 'protest_end',
      peaceful: true
    };
    ops.publish(`Peaceful Onari demonstration concluded near ${c.locationId}.`);

    // Following protest: remediation conceded or grievance stands
    ctx.followups.push(...follow(ctx, 'ONARI_REMEDIATION', 'remediation', now + 30 * MIN, {
      caseId: c.caseId, caseToken: c.token, remediationAction: 'restoration_scheduled'
    }));
    return true;
  }

  if (a.type === 'ONARI_REMEDIATION') {
    const action = a.remediationAction || 'restoration_scheduled';
    const updated = {
      ...c,
      status: 'remediating',
      family: 'onari.restoration',
      remediationAction: action,
      remediationScheduled: true,
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    };
    setCase(ctx, updated);

    // Remediation enacts site remediation on the physical location
    const site = current.sites[c.locationId];
    if (site && site.status !== 'stable') {
      const remediatedSite = {
        ...site,
        remediatedAt: now,
        lastEventId: id
      };
      setSite(ctx, remediatedSite);

      // Trigger expedited site recovery begin
      ctx.followups.push(...follow(ctx, 'SITE_RECOVERY_BEGIN', 'site-recovery-begin', now + 10 * MIN, {
        locationId: c.locationId
      }));
    }

    const factKey = `${a.day}:onari-result-${c.caseId}`;
    ops.createFact(factKey, 'onari_ecology_result', 'onari', {
      caseId: c.caseId, outcome: 'remediation_enacted', remediationAction: action
    }, now + 7 * 24 * 60 * MIN);

    event.location = c.locationId;
    event.area = null;
    event.participants = [];
    event.payload = {
      caseId: c.caseId,
      locationId: c.locationId,
      stage: 'remediation',
      remediationAction: action,
      factKey
    };
    ops.publish(`Habitat restoration agreement enacted for ${c.locationId}: ${action.replace(/_/g, ' ')}.`);

    ctx.followups.push(...follow(ctx, 'ONARI_ECOLOGY_CLOSE', 'close', now + 30 * MIN, {
      caseId: c.caseId, caseToken: c.token
    }));
    return true;
  }

  if (a.type === 'ONARI_NO_CHANGE') {
    const updated = {
      ...c,
      status: 'unresolved',
      family: 'onari.unresolved_grievance',
      remediationAction: 'no_change',
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    };
    setCase(ctx, updated);

    const factKey = `${a.day}:onari-result-${c.caseId}`;
    ops.createFact(factKey, 'onari_ecology_result', 'onari', {
      caseId: c.caseId, outcome: 'no_change'
    }, now + 7 * 24 * 60 * MIN);

    event.location = c.locationId;
    event.area = null;
    event.participants = [];
    event.payload = {
      caseId: c.caseId,
      locationId: c.locationId,
      stage: 'no_change',
      outcome: 'unresolved_grievance',
      factKey
    };
    ops.publish(`Onari consultation closed without remediation agreement for ${c.locationId}. Grievance noted.`);

    ctx.followups.push(...follow(ctx, 'ONARI_ECOLOGY_CLOSE', 'close', now + 30 * MIN, {
      caseId: c.caseId, caseToken: c.token
    }));
    return true;
  }

  if (a.type === 'ONARI_ECOLOGY_CLOSE') {
    const updated = {
      ...c,
      status: 'closed',
      closedAt: now,
      lastEventId: id,
      causalEventIds: [...new Set([...c.causalEventIds, id])]
    };
    setCase(ctx, updated);

    // Free active slot and record closed summary in ring buffer
    const nextActive = of(state).activeCaseIds.filter(id => id !== c.caseId);
    const summary = {
      caseId: c.caseId,
      locationId: c.locationId,
      consequenceKind: c.consequenceKind,
      impact: c.impact,
      protested: c.protested,
      outcome: c.remediationAction || 'closed'
    };
    save(ctx, {
      activeCaseIds: nextActive,
      closedSummaries: [summary, ...of(ctx.state).closedSummaries].slice(0, 24)
    });

    event.location = c.locationId;
    event.area = null;
    event.participants = [];
    event.payload = {
      caseId: c.caseId,
      locationId: c.locationId,
      stage: 'close'
    };
    ops.publish(`Onari ecology case ${c.caseId} closed.`);
    return true;
  }

  return false;
}
