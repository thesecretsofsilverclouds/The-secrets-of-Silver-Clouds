import { createHash } from 'node:crypto';
import { initialNarrativeSignals, narrativeSignalsActive, advanceMorphos, commitMorphos, assertNarrativeSignals } from './morphos.mjs';
import { narrativeSelectionSnapshot } from './narrative-selection.mjs';
import { initialRhythm, rhythmActive, chooseRoutine, commitCompletion, commitSleep, commitTraces, assertRhythm,
  RHYTHM_TEMPLATES, RHYTHM_SLOT_FAMILIES } from './rhythm.mjs';
import { evaluateIntentAlternatives } from './counterfactual-value.mjs';
import { boundedCounterfactualState } from './canonical-fork.mjs';
import { isMaterialWeatherChange } from './weather-provider.mjs';
import { SCENE_BANK_EVENT_TYPES, SCENE_BANK_FACT_KINDS, SCENE_BANK_RULES, initialSceneBank, sceneBankAfterAction,
  resolveSceneBankAction, assertSceneBank, sceneBankAvailable, guardSceneBankAction, interruptSceneBankSession } from './scene-bank.mjs';
import { atLondon, londonDate, nextLondonDay, prevLondonDay, MINUTE_MS as MIN } from './time.mjs';
import { DAYPARTS, daypart, dayPhase, daylightFraction, sunEvents, isShelterWeather } from './sky.mjs';
import { moodFor, selectExchange, summarise, correctLegacyWakeDialogue } from './dialogue.mjs';
import { nextVeil, phaseFor, VEIL_PRESSURE, VEIL_NOTICES } from './veil.mjs';
import { AREAS_BY_LOCATION, areaOf, permitsArea, defaultArea, encounterEligibility,
  ENCOUNTER_REASONS, SEALED_AREAS, MI6_SECTIONS, placePhrase } from './places.mjs';
import { presentableIn, SIDE_CHARACTERS, LEGION_CAST, LEGION_IDS, guardianOf } from './cast.mjs';
import { selectLegionScene, summariseLegion } from './legion.mjs';
import { baselinePressure, pressureValue, pressureLevel, chooseIncident, wantsIncident,
  aftermathFor, pressureContext, CONSEQUENCE, PRESSURE_RULES, PRESSURE_LEVELS } from './pressure.mjs';
import { assertNoSpoiler } from './spoilers.mjs';
import { diffLeaves, sameValue } from './ledger.mjs';
import { publicNarrativeBlock } from './narrative.mjs';
import { selectVenueScene, VENUE_GUESTS } from './venues.mjs';
import { proseFor, registerFor } from './prose.mjs';
import { editorialEvent } from './editorial.mjs';
import { publicSceneBankPerformance } from './scene-bank-presentation.mjs';
import { resolveContextBridge } from './context-bridge.mjs';
import { publicContinuity, isPublicStoryEvent } from './public-story-context.mjs';
import { downtimeLine, encounterLine, trainingEndLine, homewardLine, surfaceLine } from './downtime.mjs';
import { leadMomentLine, MOMENT_SIGHTS } from './moments.mjs';
import { ARC_EVENT_TYPES, ARC_FACT_KINDS, initialArcs, arcDayActions, issueArcActions,
  resolveArcAction, assertArcs, activeArcSummary, arcParticipantAvailable,
  guardArcAction, interruptArcSession } from './arcs.mjs';
import { INK_ACTIVITY, INK_EVENT_TYPES, INK_FACT_KINDS, initialStoryEffects,
  activeInkAppointment, inkVisitActions, resolveInkAction, interruptInkAppointment,
  assertStoryEffects } from './story-effects.mjs';
import { THREAD_EVENT_TYPES, THREAD_FACT_KINDS, initialThreads, threadVisitActions,
  threadEncounterActions, issueThreadActions, resolveThreadAction, assertThreads, publicThreadSummaries } from './threads.mjs';
import { INTENT_EVENT_TYPES, INTENT_FACT_KINDS, initialIntent, intentEncounterActions,
  issueIntentActions, resolveIntentAction, interruptIntent, assertIntent, publicIntentSummaries, competingCommitments } from './intent.mjs';
import { AGENDA_EVENT_TYPES, AGENDA_FACT_KINDS, initialAgendaState, agendaDayActions,
  issueAgendaActions, resolveAgendaAction, assertAgendas, publicAgendaSummaries,
  supportingAvailability, agendaFactionOverrides, agendaReportActions, agendaOpportunity } from './faction-agendas.mjs';
import { MEU_EVENT_TYPES, MEU_FACT_KINDS, initialMeuCasesState, resolveMeuCaseAction,
  issueMeuCaseActions, meuCaseOpportunityActions, meuReportActions, assertMeuCases } from './meu-cases.mjs';
import { LEGION_JOB_EVENT_TYPES, LEGION_JOB_FACT_KINDS, initialLegionJobsState, resolveLegionJobAction,
  issueLegionJobActions, legionJobOpportunityActions, mi6LegionReferralActions, legionHandoffReadActions,
  legionJobMemberAvailable, assertLegionJobs } from './legion-jobs.mjs';
import { DUSKKIN_COMPLIANCE_EVENT_TYPES, DUSKKIN_COMPLIANCE_FACT_KINDS, initialDuskkinComplianceState,
  resolveDuskkinComplianceAction, issueDuskkinComplianceActions, duskkinOpportunityActions,
  isQualifyingDuskkinSource, assertDuskkinCompliance } from './duskkin-compliance.mjs';
import { LIVING_PLACES_EVENT_TYPES, LIVING_PLACES_FACT_KINDS, initialLivingPlacesState,
  resolveLivingPlacesAction, issueLivingPlacesActions, siteOpportunityActions,
  isQualifyingEcologicalSource, assertLivingPlaces, habitatAfterAction, livingPlacesAfterAction } from './living-places.mjs';
import { ABILITY_EVENT_TYPES, ABILITY_FACT_KINDS, GROUND_ACTIVITIES, initialAbilities,
  abilityDayActions, resolveAbilityAction, assertAbilities, canEnterAbilityArea,
  abilityActivityChanged } from './abilities.mjs';
import { TICK_TIMES, tickContext, directorDecision, beatActions, tensionOf,
  anomalyText, disruptionText, DIRECTOR_RULES } from './director.mjs';
import { OUTING_RECOVERY_EVENT_TYPES, initialOutingRecovery, guardOutingRecoveryAction,
  resolveOutingRecoveryAction, outingRecoveryAfterAction, outingRecoveryActorAvailable, assertOutingRecovery } from './outing-recovery.mjs';
import { SUPPORTING_EVENT_TYPES, SUPPORTING_FACT_KINDS, initialSupportingStories, supportingDayActions,
  supportingEncounterActions, issueSupportingActions, resolveSupportingAction, interruptSupportingStories,
  supportingStoryAvailability, supportingLeadAvailable, noteSupportingAppearance, assertSupportingStories, publicSupportingSummaries } from './supporting-stories.mjs';
import { NIGHT_EVENT_TYPES, NIGHT_FACT_KINDS, initialNightStories, nightDayActions, issueNightActions,
  recordNightCause, nightEncounterActions, resolveNightAction, nightStoryAvailable, nightRecoveryFor, publicNightStories,
  assertNightStories } from './night-stories.mjs';
import { OFFSCREEN_EVENT_TYPES, OFFSCREEN_FACT_KINDS, initialOffscreenLives,
  offscreenDayActions, issueOffscreenActions, resolveOffscreenAction, offscreenEncounterActions,
  offscreenWitnessActions,
  offscreenAvailable, noteOffscreenPresence, assertOffscreenLives, publicOffscreenSummaries } from './offscreen-lives.mjs';

export const RULES_VERSION = 'canon-ambient-p183-v30';
export function isMeuActive(state) {
  if (!state?.meuCases) return false;
  if (state.meta?.upgrades?.some(item => item.to === 'canon-ambient-p183-v24')) {
    return state.meta.upgrades.some(item => item.to === 'canon-ambient-p183-v24' && item.activatedAt);
  }
  return ['canon-ambient-p183-v24', 'canon-ambient-p183-v25', 'canon-ambient-p183-v26', 'canon-ambient-p183-v27', 'canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION);
}
export function isLegionJobsActive(state) {
  if (!state?.legionJobs) return false;
  if (state.meta?.upgrades?.some(item => item.to === 'canon-ambient-p183-v25')) {
    return state.meta.upgrades.some(item => item.to === 'canon-ambient-p183-v25' && item.activatedAt);
  }
  return ['canon-ambient-p183-v25', 'canon-ambient-p183-v26', 'canon-ambient-p183-v27', 'canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION);
}
export function isDuskkinActive(state) {
  if (!state?.duskkinCompliance) return false;
  if (state.meta?.upgrades?.some(item => item.to === 'canon-ambient-p183-v26')) {
    return state.meta.upgrades.some(item => item.to === 'canon-ambient-p183-v26' && item.activatedAt);
  }
  return ['canon-ambient-p183-v26', 'canon-ambient-p183-v27', 'canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION);
}
export function isLivingPlacesActive(state) {
  if (!state?.livingPlaces) return false;
  if (state.meta?.upgrades?.some(item => item.to === 'canon-ambient-p183-v27')) {
    return state.meta.upgrades.some(item => item.to === 'canon-ambient-p183-v27' && item.activatedAt);
  }
  return ['canon-ambient-p183-v27', 'canon-ambient-p183-v28', 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION);
}

export function hasDavisBetrayal(state, atMs) {
  if (!state) return false;
  if (state.facts?.['canon.davis_betrayal_overheard'] || state.facts?.['davis_betrayal_overheard']) {
    const fact = state.facts['canon.davis_betrayal_overheard'] || state.facts['davis_betrayal_overheard'];
    if (atMs === undefined || atMs === null || fact.createdAt <= atMs) return true;
  }
  const ashai = state.characters?.ashai;
  if (ashai?.knowledge) {
    return ashai.knowledge.some(k =>
      (k.factKey === 'canon.davis_betrayal_overheard' || k.factKey === 'davis_betrayal_overheard') &&
      (atMs === undefined || atMs === null || k.learnedAt <= atMs)
    );
  }
  return false;
}

export function hasDavisWarmthPrerequisite(state) {
  if (!state) return false;
  if ((state.supportingStories?.appearances?.['davis']?.count ?? 0) >= 1) return true;
  if (Object.values(state.supportingStories?.instances ?? {}).some(s => s.guest === 'davis')) return true;
  return false;
}
// Existing pending actions and memories keep their identities across an explicit
// rules upgrade. A release number describes semantics, not a new fictional world.
export const EVENT_ID_VERSION = 'canon-ambient-p183-v21';
// A correctness repair must not redraw unrelated weather, routines and guests.
// Fixture identity/event IDs are versioned separately from these existing rolls.
export const SELECTION_VERSION = 'canon-ambient-p183-v16';
export const DEFAULT_SEED = 'silver-clouds-now-v1';
export const EVENT_TYPES = Object.freeze([
  'PRACTICE_BEGIN','PRACTICE_END','REST_BEGIN','MEAL_BEGIN','PIANO_BEGIN','MUSIC_LISTEN_BEGIN',
  'GAME_BEGIN','GAME_PAUSE','GAME_RESUME','QUIET_TIME_BEGIN','TV_BEGIN','WAIT_BEGIN','ACTIVITY_COMPLETE',
  'PRACTICE_SLOT_NOTICE','PLAN_CHANGE','WEATHER_CHANGE','NOTICE_PUBLIC_FACT','CROSS_PATHS',
  'SHARE_PRACTICAL_FACT','OFFER_ACTIVITY','ACCEPT_ACTIVITY','DEFER_ACTIVITY','SMALL_DISAGREEMENT',
  'ACKNOWLEDGE_ARRANGEMENT','END_ENCOUNTER','ANNOUNCE_ARRANGEMENT','TRAVEL_DEPART','TRAVEL_ARRIVE',
  'INVITATION_AVAILABLE','INVITATION_ACCEPTED',
  'FACTION_STATUS','INSTITUTION_NOTICE','BRIEFING_BEGIN','STANDBY_BEGIN','CITY_ACTIVITY_BEGIN','OUTING_CUT_SHORT',
  'ARCANE_SURGE','PLAN_BROKEN','CONVERSATION',
  // The pair's own side of a shared moment. Lines only, like every ambient beat.
  'MOMENT_NOTICED',
  // A story that takes several days and ends.
  ...ARC_EVENT_TYPES,
  // The director and the four things it is allowed to put in a day. A tick is
  // always private and usually decides nothing; the other three are the beats
  // that have no equivalent among the routines above.
  'DIRECTOR_TICK','COMMS_CHECK_BEGIN','SIDE_PRESENCE','MINOR_ANOMALY','WEATHER_DISRUPTION',
  // The old crew, round for an hour. Lines and nothing else, like CONVERSATION.
  'LEGION_VISIT',
  // Fantasy Pressure. UNEASE is the corner of the eye and costs nothing;
  // INCIDENT can cost an evening, a night or a plan; AFTERMATH is the morning
  // that follows one. This repertoire has no resolution handlers yet.
  'UNEASE','INCIDENT','AFTERMATH',
  // An hour at a venue used to be two lines and a gap. This is the hour.
  'VENUE_SCENE', ...INK_EVENT_TYPES, ...THREAD_EVENT_TYPES, ...INTENT_EVENT_TYPES,
  ...AGENDA_EVENT_TYPES, ...MEU_EVENT_TYPES, ...LEGION_JOB_EVENT_TYPES, ...DUSKKIN_COMPLIANCE_EVENT_TYPES, ...LIVING_PLACES_EVENT_TYPES, ...ABILITY_EVENT_TYPES, ...OUTING_RECOVERY_EVENT_TYPES,
  ...SUPPORTING_EVENT_TYPES, ...NIGHT_EVENT_TYPES, ...OFFSCREEN_EVENT_TYPES, ...SCENE_BANK_EVENT_TYPES, 'WORLD_DEPTH_ACTIVATE', 'WORLD_LIVES_ACTIVATE', 'WORLD_MEU_ACTIVATE', 'WORLD_LEGION_ACTIVATE', 'WORLD_DUSKKIN_ACTIVATE', 'WORLD_LIVING_PLACES_ACTIVATE', 'WORLD_NARRATIVE_ACTIVATE',
  'WEATHER_OBSERVATION', 'DAVIS_BETRAYAL_DISCOVERY',
  // RHYTHM. A private decision about which legal routine fills a free slot the
  // day plan already declared; the routine it schedules is an ordinary event.
  'RHYTHM_CHOOSE', 'WORLD_RHYTHM_ACTIVATE',
]);
const TYPES = new Set(EVENT_TYPES);
// City venues are a creator-approved v3 expansion. The cafe is manuscript canon (p.37);
// Enchanted Ink and the New Big Ben plaza are site canon. Wooburn Forest is deliberately
// excluded: the pair's first visit there is a manuscript scene after the p.183 anchor.
export const CITY_LOCATIONS = Object.freeze({
  enchanted_ink:{name:'Enchanted Ink',travelMinutes:15},
  cafe:{name:'the Silver Spoon Cafe',travelMinutes:10},
  big_ben_plaza:{name:'the New Big Ben plaza',travelMinutes:10},
});
const LOCATIONS = new Set(['mi6','sanctuary','streamliner','legion_hideout','onari_village',...Object.keys(CITY_LOCATIONS)]);
// Committed actions where Goaden actively crosses a boundary (intentional
// concealment of danger, broken agreement, or consequential deception).
// An autonomy breach is never inferred from passive knowledge asymmetry (such
// as Goaden being assigned to standby or present for a delivery that Ashai
// was not in the room for). It requires provenance of an intentional act.
const INTENTIONAL_BREACH_TYPES = new Set([
  'CONCEALED_DANGER',
  'BROKEN_AGREEMENT',
  'CONSEQUENTIAL_DECEPTION',
  'UNILATERAL_DECISION',
]);
const TOPICS = new Set(['break_preference','quiet_preference','finish_preference','unfinished_game','practice_slot','invitation','unfinished_visit',
  'davis_betrayal',
  // Pressure from outside. A callout and a plan it broke are both ordinary
  // operational facts: they say the world intruded, never why or on what.
  'duty_callout','broken_plan',
  // Something happened to them. The fact records that and its severity, never
  // what it was or what it meant — there is nothing to be explained.
  'incident', ...INK_FACT_KINDS, ...THREAD_FACT_KINDS, ...INTENT_FACT_KINDS,
  ...AGENDA_FACT_KINDS, ...MEU_FACT_KINDS, ...LEGION_JOB_FACT_KINDS, ...DUSKKIN_COMPLIANCE_FACT_KINDS, ...LIVING_PLACES_FACT_KINDS, ...ABILITY_FACT_KINDS, ...SUPPORTING_FACT_KINDS, ...NIGHT_FACT_KINDS, ...OFFSCREEN_FACT_KINDS,
  ...ARC_FACT_KINDS, ...SCENE_BANK_FACT_KINDS]);
const ANCHORS = Object.freeze({ checkpoint: 'opening-pdf-p183-before-p184-disclosure',
  relationshipStage: 'friends', ashaiEye: 'existing_bionic_eye', abilities: 'already_taught_only', sanctuary: 'invite_only',
  // An explicit author decision, recorded here because it changes what the
  // checkpoint means. The warehouse scene at [M102] has the Legion calling
  // Goaden's departure a betrayal; the Sanctuary reunion at [M228-230] spends
  // it — the duel, "welcome home brother", the VIP ticket. This world sits
  // after that, so the Legion are his mates rather than a wound. Without this
  // anchor a Legion scene would be a plot event; with it, it is a visit.
  legion: 'reunited-after-first-sanctuary-visit',
  // The v15 decision. The world may fight, be pursued, lock down and carry
  // consequences; what it may never do is reveal. src/spoilers.mjs holds the
  // three reveals and is the only thing standing between this and Book One.
  severity: 'unbounded-below-the-reveal-line',
  // The v16 decision, recorded beside the others because it places somebody in
  // the world the manuscript places elsewhere. Zara is introduced at [M362],
  // long after the checkpoint. The author's ruling is that the pair have
  // plausibly worked alongside her before then as an MI6 liaison, and that she
  // has assisted them on missions. That is a smaller claim than the book's own
  // introduction of her and touches nothing the book needs later.
  zara: 'mi6-liaison-known-before-the-checkpoint' });
const THEMES = ['invitation','fatigue','unfinished_game','quiet_request','meal_deferral',
  'ink_visit','cafe_outing','city_walk','gaming_night','quiet_day','sanctuary_night'];
export const THEME_NAMES = Object.freeze([...THEMES]);
const CITY_THEMES = new Set(['ink_visit','cafe_outing','city_walk']);
const CITY_KINDS = Object.freeze({ink_visit:'enchanted_ink',cafe_outing:'cafe',city_walk:'big_ben_plaza'});
// Institutions produce public facts without becoming simulated characters. Named
// colleagues appear only as event sources. Spoiler embargo (post-p.183): no
// parentage, no J'kobi, no Whisper, no voices, no Grimoire hunt. Nameless is a
// masked figure MI6 already briefed on (first sighting PDF p.75, inner-circle
// briefing p.76–78) — never a public MEU bulletin, and never Whisper.
export const FACTION_LEVELS = Object.freeze({
  mi6:['routine','briefings','elevated'],
  order:['quiet','watchful','active_in_city'],
  church:['quiet','preparations','veil_cycle'],
  sanctuary:['invited_guests','private_event'],
  streamliner:['normal','minor_delays'],
  arcane:['low','moderate','high'],
});
// A day's institutional posture is public texture. Baseline levels stay unremarked.
const FACTION_HEADLINES = Object.freeze({
  mi6:{briefings:'MI6 called an inner circle briefing',elevated:'MI6 stood at heightened readiness'},
  order:{watchful:'the Holy Order kept a watch on the boroughs',active_in_city:'Holy Order operatives were active in the city'},
  church:{preparations:'the Church worked on Celestial Veil preparations',veil_cycle:'the Church confirmed dates for the next Celestial Veil cycle'},
  sanctuary:{private_event:'Sanctuary closed one wing for a private event'},
  streamliner:{minor_delays:'Streamliner services ran with minor delays'},
  arcane:{moderate:'MEU scanners sat above their usual baseline',high:'MEU scanners flagged elevated readings along the Thames corridor'},
});
// Which public notices are loud enough that somebody elsewhere notices them.
// Deliberately short: most institutional notices are paperwork, and a world
// where every circular interrupts four people is noise rather than texture.
const NOTICE_MOMENTS = Object.freeze({ chimes_pulse: 'chimes_pulse', veil_cycle: 'veil_notice',
  storm_breaks: 'storm_breaks', order_procession: 'order_procession' });
// Institutional notices, which are the paper's own wire copy: dry, procedural,
// and the least ornamented voice in the world. That register was right and the
// volume was not — 246 notices over seventy days against one sentence each, so
// "MEU scanners flagged elevated readings along the Thames corridor" ran
// forty-five times unchanged and became the wallpaper a reader stops seeing.
//
// Each notice keeps its plain phrasing first, then gets variants that report
// the same fact from a slightly different desk. Nothing here is atmosphere for
// its own sake: an institution saying the same thing three ways is what
// institutions are actually like, and the small differences carry the world.
const NOTICES = Object.freeze({
  arcane_signature: { location: 'mi6', text: [
    'MEU scanners flagged elevated readings along the Thames corridor.',
    'The MEU logged corridor readings above baseline for the third time this week.',
    'Elevated arcane readings on the river. The MEU have asked for the usual patience.',
    'Corridor figures were up again. The MEU describe this as within tolerance, which is a range and not a comfort.',
  ] },
  elevated_alert: { location: 'mi6', text: [
    'MI6 stood at heightened readiness for the day.',
    'Heightened readiness declared across MI6 from the morning watch.',
    'MI6 moved to elevated footing. The canteen hours moved with it.',
  ] },
  order_advisory: { location: 'mi6', text: [
    'MI6 issued a routine advisory: Holy Order operatives are active in the city.',
    'Advisory posted: Order operatives working the boroughs. Personnel are asked to be unremarkable.',
    'MI6 confirmed Order activity in the city and declined, as usual, to say where.',
  ] },
  church_preparations: { location: 'sanctuary', text: [
    'The Church continued Celestial Veil preparations at the Sanctuary in the sky.',
    'Veil preparations went on at the Sanctuary. The scaffolding in the portal halls has stopped being temporary.',
    'The Church added another rite to the Veil preparations. Nobody at the Sanctuary was consulted about the hour of it.',
  ] },
  veil_cycle: { location: 'sanctuary', text: [
    'The Church confirmed dates for the next Celestial Veil cycle.',
    'The Veil dates are confirmed. Half the city has already started counting.',
    'Dates posted for the Veil cycle, earlier in the year than the last one.',
  ] },
  sanctuary_private: { location: 'sanctuary', text: [
    'Sanctuary closed one wing for a private event.',
    'One wing of the Sanctuary was shut to guests. No reason was given and none was expected.',
    'A private booking took a wing of the Sanctuary for the evening. The queue to get in doubled.',
  ] },
  streamliner_delays: { location: 'streamliner', text: [
    'Streamliner services reported minor delays.',
    'Minor delays on the Streamliner. The board said minor; the platform disagreed.',
    'Speed restrictions east of the river slowed the Streamliner all afternoon.',
  ] },
  yukon_challenge: { location: 'mi6', text: [
    'Yukon challenged Goaden to a rematch in the MI6 gaming room.',
    'Yukon put a rematch on the gaming room board with Goaden\'s name next to it, unasked.',
    'A rematch was declared in the gaming room. Only one of the two participants had agreed to it.',
  ] },
  general_rounds: { location: 'mi6', text: [
    'General Henderson walked the MI6 corridors.',
    'General Henderson did his rounds with two captains and a folder nobody opened.',
    'Henderson came through the corridors on the hour, as he does, and stopped for nothing.',
  ] },
  nameless_briefing: { location: 'mi6', text: [
    'MI6 held a follow-up briefing on the masked operative known as Nameless.',
    'Another Nameless briefing. Attendance was mandatory and the new information was not.',
    'The Nameless file was reopened for a follow-up session in the assembly room.',
  ] },
  holy_item_registry: { location: 'mi6', text: [
    'The MEU reminded Holy Item wielders to keep their registrations current.',
    'The MEU issued a registration reminder. It is the fourth of the year and identically worded.',
    'Holy Item registrations are due. The MEU have put the notice on the door in a larger font.',
  ] },
  // No hour in the text. This said "through the morning hour" and then fired at
  // half six in the evening, because the notice times are seeded and the line
  // was not. A notice that names a time has to be scheduled at that time or it
  // is simply wrong on the page.
  chimes_pulse: { location: 'big_ben_plaza', text: [
    "New Big Ben's Chimes of Renewal rang stronger than usual, and the plaza felt it come up through the paving.",
    'The Chimes of Renewal ran long and loud, and the motes went up off the tower thick enough to see from the river.',
    'New Big Ben rang heavier than the hour required. The plaza stopped for the whole of it, as the plaza does.',
  ] },
  storm_breaks: { location: 'big_ben_plaza', text: [
    'The storm came up the river and took the whole city in about four minutes.',
    'A front came in off the estuary and the boroughs went dark under it at one in the afternoon.',
    'It broke over London all at once, the way the bad ones do, from the east and downward.',
  ] },
  order_procession: { location: 'mi6', text: [
    'A column of Holy Order operatives walked the embankment in daylight, and the borough went quiet around them.',
    'The Order processed along the river without stopping and without explaining. The market packed up ahead of them.',
    'Order colours moved through the boroughs in the early evening. Nobody was detained. Everybody noticed.',
  ] },
  ink_phasing: { location: 'mi6', text: [
    "Enchanted Ink's storefront was reported phasing along a new street this week.",
    'Enchanted Ink has moved again. It is two streets from where it was and the door is where the door always is.',
    'The Ink phased overnight. The locksmith it was next to has stopped commenting.',
  ] },
  // The Veil's milestones. The festival day itself gets one line and nothing
  // more: it is the world's event, not Goaden and Ashai's, and Book One is
  // where the pair actually attend one.
  ...Object.fromEntries(Object.entries(VEIL_NOTICES)
    .map(([phase, text]) => [`veil_${phase}`, { location: 'sanctuary', text: [text] }])),
});
// Ambient notices with no bearing on the day's causal chain. One is drawn daily.
// Yukon's challenge is deliberately absent: it only ever appears as the stated
// cause of a gaming night, never as scenery that leads nowhere. Nameless stays
// an MI6 briefing, never a circulated public bulletin.
const FLAVOR_NOTICES = Object.freeze(['general_rounds','nameless_briefing',
  'holy_item_registry','chimes_pulse','ink_phasing']);
// Some activities read differently depending on the venue and the mode it is in.
const VENUE_PHRASES = Object.freeze({
  'sanctuary:public_attraction:listening_to_music':'Goaden and Ashai listened to the music drifting through the portal halls.',
  'sanctuary:evening_transition:listening_to_music':'Goaden and Ashai listened to the evening music at Sanctuary.',
  'sanctuary:nightlife:listening_to_music':'Goaden and Ashai found a place near the central hub, where the music was carrying through the night.',
});
const CITY_ACTIVITY = Object.freeze({
  ink_visit:{label:'visiting_enchanted_ink',text:'Goaden and Ashai spent time among the designs at Enchanted Ink.'},
  cafe_outing:{label:'at_the_silver_spoon',text:'Goaden and Ashai took a table at the Silver Spoon Cafe.'},
  city_walk:{label:'walking_the_city',text:'Goaden and Ashai walked the plaza beneath New Big Ben.'},
});
const ARRANGEMENT_TEXT = Object.freeze({
  sanctuary_visit:{next:'Leaving for an invited Sanctuary visit',announce:'Goaden and Ashai arranged an invited visit to Sanctuary.'},
  meal:{next:'A meal together',announce:'Goaden and Ashai arranged a meal for later.'},
  ink_visit:{next:'An outing to Enchanted Ink',announce:'Goaden and Ashai arranged a visit to Enchanted Ink, the moving tattoo parlour.'},
  cafe_outing:{next:'A trip to the Silver Spoon Cafe',announce:'Goaden and Ashai arranged a trip out to the Silver Spoon Cafe.'},
  city_walk:{next:'A walk beneath New Big Ben',announce:'Goaden and Ashai arranged a walk to hear the Chimes of Renewal.'},
  gaming_match:{next:'A match in the MI6 gaming room',announce:"Goaden and Ashai took up Yukon's challenge in the MI6 gaming room."},
  sanctuary_night:{next:'An evening at Sanctuary',announce:'Goaden and Ashai arranged an evening visit to Sanctuary, once the night halls open.'},
  revisit:{next:"Going back to finish yesterday's visit",announce:'Goaden and Ashai arranged to go back and finish the visit they were called away from.'},
  resumed_match:{next:'Finishing the interrupted match',announce:'Goaden and Ashai arranged to finish the match the recall interrupted.'},
  make_up:{next:'The evening they missed',announce:'Goaden and Ashai arranged to take back the evening the callout cost them.'},
});
const DEFAULT_ARRANGEMENT_TEXT = Object.freeze({next:'A game together',announce:'Goaden and Ashai arranged to play together later.'});
// The announcement is one string per arrangement, and the arrangement is
// made most days. Alternatives for the ones the reader meets most, chosen by
// the event; the `next` line, which the schedule shows, stays as it is.
const ANNOUNCE_LINES = Object.freeze({
  'Goaden and Ashai arranged to play together later.': [
    'Goaden and Ashai arranged to play together later.', 'A game was agreed for later. Neither said when, exactly.',
    'Goaden and Ashai settled on a game later on.', 'Later, they agreed, they would play. It was left at that.',
    'A game later was agreed between them without much discussion.'],
  'Goaden and Ashai arranged a trip out to the Silver Spoon Cafe.': [
    'Goaden and Ashai arranged a trip out to the Silver Spoon Cafe.', 'The Silver Spoon was agreed for later. Goaden did not need asking twice.',
    'Goaden and Ashai settled on the Silver Spoon for the afternoon.', 'A trip out to the Silver Spoon was arranged, which is the easiest thing they ever agree on.'],
  'Goaden and Ashai arranged a walk to hear the Chimes of Renewal.': [
    'Goaden and Ashai arranged a walk to hear the Chimes of Renewal.', 'A walk to the plaza was agreed, timed for the Chimes.',
    'Goaden and Ashai settled on the plaza for the afternoon, and the Chimes with it.'],
  'Goaden and Ashai arranged a meal for later.': [
    'Goaden and Ashai arranged a meal for later.', 'A meal later was agreed between them.',
    'Goaden and Ashai settled on eating together later.', 'Later, they agreed, they would eat. That was the arrangement.'],
  "Goaden and Ashai took up Yukon's challenge in the MI6 gaming room.": [
    "Goaden and Ashai took up Yukon's challenge in the MI6 gaming room.", "Yukon's challenge was accepted. The gaming room, later.",
    "Goaden and Ashai agreed to meet Yukon's challenge in the gaming room."],
  'Goaden and Ashai arranged an evening visit to Sanctuary, once the night halls open.': [
    'Goaden and Ashai arranged an evening visit to Sanctuary, once the night halls open.', 'Goaden and Ashai arranged an evening visit to Sanctuary for when the night halls opened.',
    'Once the night halls open, then: Goaden and Ashai arranged an evening visit to Sanctuary.'],
  'Goaden and Ashai arranged a visit to Enchanted Ink, the moving tattoo parlour.': [
    'Goaden and Ashai arranged a visit to Enchanted Ink, the moving tattoo parlour.', 'Enchanted Ink was agreed for the afternoon.',
    'Goaden and Ashai settled on a visit to Enchanted Ink.'],
});
// Weather is a world input with small causal consequences, not just wallpaper.
export const WEATHER_CODES = Object.freeze(['clear','cloudy','light_rain','heavy_rain','fog','storm']);
const WEATHERS = Object.freeze([
  {code:'clear',description:'Clear',temperatureC:17},
  {code:'cloudy',description:'Cloudy',temperatureC:15},
  {code:'light_rain',description:'Light rain',temperatureC:12},
  {code:'heavy_rain',description:'Heavy rain',temperatureC:10},
  {code:'fog',description:'Fog',temperatureC:9},
  {code:'storm',description:'Storm',temperatureC:11},
]);
export const weatherForDay = (date, seed) => WEATHERS[hash(`${seed}|${SELECTION_VERSION}|${date}/weather`) % WEATHERS.length];
// Sheltering keeps morning training off the outdoor yard; delays slow the Streamliner.
export { isShelterWeather };
export const isTravelDelayWeather = code => code === 'fog' || code === 'storm';
const RAINY = new Set(['light_rain','heavy_rain','storm']);
// Duty types are ordinary activities that additionally require being on station.
const ROUTINE_TYPES = new Set(['PRACTICE_BEGIN','REST_BEGIN','MEAL_BEGIN','PIANO_BEGIN','MUSIC_LISTEN_BEGIN','GAME_BEGIN',
  'GAME_RESUME','QUIET_TIME_BEGIN','TV_BEGIN','WAIT_BEGIN','BRIEFING_BEGIN','STANDBY_BEGIN','COMMS_CHECK_BEGIN']);
const DUTY_TYPES = new Set(['BRIEFING_BEGIN','STANDBY_BEGIN','COMMS_CHECK_BEGIN']);
// The solo events that still count as the world having done something. Every
// one of them has a cause outside the person it happens to: being called in,
// being stood up, being handed an invitation, having a plan changed by
// something learned, or seeing something the city did. Everything else a
// character does alone is their own ordinary day and leaves the clock running.
const NOTABLE_ALONE = new Set(['BRIEFING_BEGIN','STANDBY_BEGIN','COMMS_CHECK_BEGIN',
  'ARCANE_SURGE','MINOR_ANOMALY','INVITATION_ACCEPTED','PLAN_CHANGE','WEATHER_DISRUPTION']);
// Which section of the barracks a routine belongs in. Gaming and television now
// go where the manuscript puts them — the gaming area at the rear of the lunch
// hall, with the sofas and the headsets [M64] — rather than to a generic room.
// Everything unlisted defaults to the lunch hall, which is where the pair
// actually are between things.
const AREAS = Object.freeze({PIANO_BEGIN:'music_room',PRACTICE_BEGIN:'training',REST_BEGIN:'quarters',
  BRIEFING_BEGIN:'briefing_room',STANDBY_BEGIN:'quarters',COMMS_CHECK_BEGIN:'ops_room',
  GAME_BEGIN:'gaming_room',GAME_RESUME:'gaming_room',TV_BEGIN:'gaming_room'});
// Faction statuses are deterministic daily world inputs, like weather. The draw
// weights how often a posture comes up at all.
const FACTION_DRAWS = Object.freeze({
  arcane:['low','low','low','moderate','moderate','high'],
  order:['quiet','quiet','quiet','watchful','active_in_city','active_in_city'],
  church:['quiet','quiet','preparations','veil_cycle'],
  sanctuary:['invited_guests','invited_guests','invited_guests','private_event'],
  mi6:['routine','routine','briefings'],
});
// Tension does not evaporate at midnight. These three factions decay one step a
// day, so an elevated day is followed by a briefings day even if nothing new
// happens. Church business, private events and rail delays are single-day
// occurrences and are redrawn from scratch.
const DECAYING = Object.freeze(['mi6','order','arcane']);
// How the pair carry a day into the next one. Friction and worry used to be
// wiped at every midnight alongside the day's temporary conditions, so nothing
// between them could ever mean anything the following morning. They now persist
// and ease one step a day, the way an institution's footing already does.
// Trust is not on a clock: it moves only when something between them earns it.
// The bands stay small deliberately. This is memory, not plot — a remembered
// week can colour how a day reads without anything irreversible happening, and
// the p.183 checkpoint is unchanged by any value in here.
export const RELATIONSHIP_BANDS = Object.freeze({
  concern:{min:0,max:3,baseline:0,easesDaily:true},
  irritation:{min:0,max:3,baseline:0,easesDaily:true},
  trust:{min:0,max:5,baseline:2,easesDaily:false},
});
const clampBand = (field,value) => {const band=RELATIONSHIP_BANDS[field];
  return Math.max(band.min,Math.min(band.max,value));};
// One step toward the field's baseline, from either side of it.
const easeToward = (field,value) => {const {baseline}=RELATIONSHIP_BANDS[field];
  return value>baseline?value-1:value<baseline?value+1:value;};
// Pressure sets a floor rather than adding a step. An increment cannot survive
// a daily ease of the same size — the two cancel exactly, and three bad days in
// a row read no worse than one. A floor behaves the way an institution's footing
// already does: an event puts the value at a level, and quiet days walk it down.
// Taking the higher of the two is also idempotent, so a replay changes nothing.
const raiseTo = (field,current,target) => Math.max(current,clampBand(field,target));
const levelIndex = (faction,level) => FACTION_LEVELS[faction].indexOf(level);
const decayStep = (faction,level) => FACTION_LEVELS[faction][Math.max(0,levelIndex(faction,level)-1)];
const higher = (faction,a,b) => FACTION_LEVELS[faction][Math.max(levelIndex(faction,a),levelIndex(faction,b))];
function drawPosture(date, seed, weather) {
  const arcane = pick(seed,`${date}/arcane`,FACTION_DRAWS.arcane);
  return {mi6: arcane === 'high' ? 'elevated' : pick(seed,`${date}/mi6`,FACTION_DRAWS.mi6),
    order: pick(seed,`${date}/order`,FACTION_DRAWS.order),
    church: pick(seed,`${date}/church`,FACTION_DRAWS.church),
    sanctuary: pick(seed,`${date}/sanctuary`,FACTION_DRAWS.sanctuary),
    streamliner: 'normal', arcane};
}
export function factionsForDay(date, seed, weather = weatherForDay(date, seed)) {
  const today = drawPosture(date,seed,weather);
  // Yesterday's own draw is what decays, so the lookback is exactly one day and
  // never recurses back to the world epoch.
  const prev = prevLondonDay(date), yesterday = drawPosture(prev,seed,weatherForDay(prev,seed));
  const posture = {...today};
  for(const faction of DECAYING) posture[faction]=higher(faction,today[faction],decayStep(faction,yesterday[faction]));
  if(posture.arcane === 'high') posture.mi6 = 'elevated';
  // Institutions read each other. Holy Order operatives working the boroughs is
  // not something MI6 watches happen without standing its own people up, so the
  // Order sets a floor under MI6 rather than the two postures being drawn
  // independently and happening to coincide. A floor, never a step: it cannot
  // push an already-elevated footing higher, and it decays on MI6's own clock.
  if(posture.order === 'active_in_city') posture.mi6 = higher('mi6',posture.mi6,'briefings');
  posture.streamliner = (isTravelDelayWeather(weather.code) || posture.arcane === 'high') ? 'minor_delays' : 'normal';
  // The Church's public business bends toward the Veil as it nears. Far out it
  // is one thing among others; in the final week it is nearly all they are seen
  // doing. The draw stays deterministic — pressure only raises the floor.
  const veil = veilForDate(date,seed);
  const pressure = VEIL_PRESSURE[veil.phase] ?? 0;
  // Always preparations, never a re-dating. Confirming the dates is a one-time
  // announcement, and letting pressure select it produced a Church that
  // confirmed the same dates every other day for two months.
  if(pressure && hash(`${seed}|${SELECTION_VERSION}|${date}/veil-church`) % 3 < pressure) posture.church = 'preparations';
  // Once the Veil is in view at all the dates are settled, so the ordinary draw
  // cannot re-announce them either. Only the long stretch between festivals is
  // a time when confirming the next cycle is news.
  else if(posture.church === 'veil_cycle' && pressure >= 1) posture.church = 'preparations';
  return posture;
}
// The Veil for a calendar day, evaluated at London midday so a daylight-saving
// change cannot move which day the countdown thinks it is.
export const veilForDate = (date, seed) => nextVeil(atLondon(date,'12:00'), seed);
// A location is not one place. Each address runs a different operating mode in
// each civil daypart, and the mode — not the address — decides what may happen
// there. Sanctuary is the clearest case: a sacred morning, a public magical
// attraction over the middle of the day, and a nightclub after dark.
export const LOCATION_MODES = Object.freeze({
  mi6:{small_hours:'night_shift',morning:'day_watch',midday:'day_watch',evening:'day_watch',night:'night_shift'},
  sanctuary:{small_hours:'closed_reset',morning:'sacred_quiet',midday:'public_attraction',evening:'evening_transition',night:'nightlife'},
  streamliner:{small_hours:'sparse_service',morning:'frequent_service',midday:'frequent_service',evening:'frequent_service',night:'reduced_service'},
  // The parlour phases into a street over the middle of the day and shutters early.
  enchanted_ink:{small_hours:'shuttered',morning:'shuttered',midday:'open',evening:'shuttered',night:'shuttered'},
  // A band's warehouse keeps a band's hours: dead until the afternoon, alive
  // from the evening on, and never entirely shut because somebody always sleeps
  // there.
  legion_hideout:{small_hours:'dark',morning:'dark',midday:'rehearsal',evening:'rehearsal',night:'rehearsal'},
  cafe:{small_hours:'closed',morning:'open',midday:'open',evening:'open',night:'last_orders'},
  big_ben_plaza:{small_hours:'quiet_streets',morning:'open_air',midday:'open_air',evening:'open_air',night:'quiet_streets'},
  onari_village:{small_hours:'quiet_night',morning:'daylight',midday:'daylight',evening:'dusk',night:'quiet_night'},
});
// Being somewhere is not an activity, so these labels are always available.
const AMBIENT_LABELS = Object.freeze(['unhurried_time','travelling']);
// Everything a mode permits, stated explicitly. Anything absent is forbidden
// there: a mode's forbidden set is the complement of this list.
export const MODE_PERMITS = Object.freeze({
  'mi6:day_watch':['training','eating','playing_piano','listening_to_music','gaming','quiet_break','watching_television','resting','waiting','in_a_briefing','on_call','sleeping'],
  'mi6:night_shift':['eating','gaming','listening_to_music','quiet_break','watching_television','resting','waiting','on_call','sleeping'],
  'legion_hideout:rehearsal':['unhurried_time','listening_to_music','quiet_break'],
  'legion_hideout:dark':['quiet_break'],
  'sanctuary:sacred_quiet':['quiet_break'],
  'sanctuary:public_attraction':['listening_to_music','quiet_break','eating'],
  'sanctuary:evening_transition':['listening_to_music','eating'],
  'sanctuary:nightlife':['listening_to_music','eating'],
  'sanctuary:closed_reset':[],
  'enchanted_ink:open':['visiting_enchanted_ink',INK_ACTIVITY],
  'enchanted_ink:shuttered':[],
  'cafe:open':['at_the_silver_spoon','eating'],
  'cafe:last_orders':['at_the_silver_spoon','eating'],
  'cafe:closed':[],
  'big_ben_plaza:open_air':['walking_the_city'],
  'big_ben_plaza:quiet_streets':[],
  'streamliner:frequent_service':[],'streamliner:reduced_service':[],'streamliner:sparse_service':[],
  'onari_village:daylight':['unhurried_time','eating','quiet_break','waiting'],
  'onari_village:dusk':['unhurried_time','quiet_break','waiting'],
  'onari_village:quiet_night':['quiet_break','resting','sleeping'],
});
// The civil dayparts in which each activity may begin. Gaming late at night is
// ordinary; training at two in the morning is not.
export const ACTIVITY_DAYPARTS = Object.freeze({
  ...Object.fromEntries(INTENT_EVENT_TYPES.map(type=>[type,['evening']])),
  INTENT_INTERRUPTED:[...DAYPARTS],
  ...Object.fromEntries(ABILITY_EVENT_TYPES.map(type=>[type,['morning','midday','evening']])),
  ABILITY_ACTIVITY_SETTLED:[...DAYPARTS], GROUND_WORK_INTERRUPTED:[...DAYPARTS],
  PRACTICE_BEGIN:['morning','midday','evening'],
  BRIEFING_BEGIN:['morning','midday','evening'],
  STANDBY_BEGIN:['evening','night'],
  PIANO_BEGIN:['morning','midday','evening'],
  CITY_ACTIVITY_BEGIN:['midday','evening'],
  MEAL_BEGIN:['morning','midday','evening','night'],
  TV_BEGIN:['morning','midday','evening','night'],
  GAME_BEGIN:['morning','midday','evening','night'],
  GAME_RESUME:['morning','midday','evening','night'],
  QUIET_TIME_BEGIN:['morning','midday','evening','night'],
  MUSIC_LISTEN_BEGIN:['morning','midday','evening','night'],
  WAIT_BEGIN:['morning','midday','evening','night'],
  REST_BEGIN:[...DAYPARTS],
  // A comms check is a working-hours thing; the night watch has its own post.
  COMMS_CHECK_BEGIN:['morning','midday','evening'],
  // The director's own beats. Ticks run all day because deciding to do nothing
  // is free; what they may stage is what the windows below allow.
  DIRECTOR_TICK:[...DAYPARTS],
  // Deciding is free at any hour; what it may schedule is what the windows
  // above allow, checked against the slot's own time.
  RHYTHM_CHOOSE:[...DAYPARTS],
  SIDE_PRESENCE:['morning','midday','evening'],
  LEGION_VISIT:['midday','evening','night'],
  VENUE_SCENE:['morning','midday','evening','night'],
  INK_DESIGN_CHOSEN:['midday'], INK_SLOT_RELEASED:['midday'],
  INK_APPOINTMENT_BOOKED:['midday'], INK_APPOINTMENT_STARTED:['midday'],
  // A reserved hour may finish exactly at 17:00, when the daypart changes.
  INK_APPOINTMENT_COMPLETED:['midday','evening'], INK_APPOINTMENT_INTERRUPTED:[...DAYPARTS],
  INK_RESULT_NOTICED:[...DAYPARTS],
  // Strangeness keeps its own hours: the small hours are exactly when a lintel
  // sits outside a window, so unease is the one thing allowed all day.
  UNEASE:[...DAYPARTS],
  // All hours, deliberately. Being out until three because the building locked
  // down is one of the things the author asked for by name, and the small hours
  // are when the worst of it should be allowed to happen.
  INCIDENT:[...DAYPARTS],
  AFTERMATH:['morning','midday'],
  MINOR_ANOMALY:['morning','midday','evening','night'],
  WEATHER_DISRUPTION:['morning','midday','evening'],
});
export const locationMode = (location, atMs) => LOCATION_MODES[location]?.[daypart(atMs)] ?? 'unknown';
export const permitsActivity = (location, mode, label) =>
  (location==='mi6'&&GROUND_ACTIVITIES.includes(label)&&mode==='day_watch')
  || AMBIENT_LABELS.includes(label) || (MODE_PERMITS[`${location}:${mode}`] ?? []).includes(label);
export const permitsDaypart = (type, atMs) =>
  !ACTIVITY_DAYPARTS[type] || ACTIVITY_DAYPARTS[type].includes(daypart(atMs));
// A scheduled action that could not legally run at its own due time is a
// scheduling bug, so a day's plan is checked before any of it is queued.
export function assertScheduleWindows(actions) {
  for(const item of actions) {
    if(!permitsDaypart(item.type,item.dueAt)) throw new Error(`${item.type} cannot begin during ${daypart(item.dueAt)} (${item.id})`);
    if(item.type==='CITY_ACTIVITY_BEGIN'&&!permitsActivity(item.location,locationMode(item.location,item.dueAt),CITY_ACTIVITY[item.kind].label))
      throw new Error(`${item.location} is not open for ${item.kind} (${item.id})`);
  }
  return actions;
}
// An elevated MI6 footing or a Holy Order sweep pulls the pair off a city outing early.
export const isRecallDay = factions => factions.mi6 === 'elevated' || factions.order === 'active_in_city';
export const recallReason = factions => factions.mi6 === 'elevated' ? 'mi6_recall' : 'order_activity';
// Rain turns the planned plaza walk into a cafe visit instead.
export const cityKindForDay = (theme, weather) =>
  theme === 'city_walk' && RAINY.has(weather.code) ? 'cafe_outing' : theme;
const shortName = id => id === 'goaden' ? 'Goaden' : 'Ashai';
const hash = text => createHash('sha256').update(text).digest().readUInt32BE(0);
// Opaque IDs also prevent public event IDs from revealing private action names.
export const eventId = (seed, actionId) => `evt:${createHash('sha256').update(`${EVENT_ID_VERSION}|${seed}|${actionId}`).digest('hex').slice(0,32)}`;
const pick = (seed, key, values) => values[hash(`${seed}|${SELECTION_VERSION}|${key}`) % values.length];
// Ordinary routines do not run to the minute. A small deterministic offset per
// action breaks the timetable feel: the pair stop beginning and finishing the
// same thing on the same second. Only independent personal routines are moved.
// Chained actions — offers, agreements, travel legs, plan replacements — keep
// their exact authored times, so a causal sequence never loses its order.
const JITTER_MINUTES = 7;
export const scheduleJitter = (seed, date, id) =>
  hash(`${seed}|${SELECTION_VERSION}|${date}/${id}/jitter`) % JITTER_MINUTES - (JITTER_MINUTES - 1) / 2;
export function themeForDay(date, seed) {
  const ordinal = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  return THEMES[(ordinal + hash(seed) % THEMES.length) % THEMES.length];
}
export function knowsFact(actor, factKey, atMs, historical = false) {
  return actor.knowledge.find(m => m.factKey === factKey && m.learnedAt <= atMs
    && (historical || m.validUntil === null || atMs < m.validUntil));
}
export function canEnterSanctuary(state, atMs, party = ['goaden','ashai'], invitationKey) {
  const invitations = invitationKey ? [state.invitations[invitationKey]] : Object.values(state.invitations);
  return invitations.some(i => i && i.acceptedAt !== null && i.acceptedAt <= atMs && atMs >= i.entryFrom
    && atMs < i.entryUntil && party.every(id => i.party.includes(id) && knowsFact(state.characters[id], i.factKey, atMs)));
}
export function canEnterOnariVillage(state, atMs, party = ['goaden','ashai'], reasonKey) {
  if (party.length === 1 && party[0] === 'yukon') return true;
  if (!state || !state.facts) return false;
  const factKeys = reasonKey ? [reasonKey] : Object.keys(state.facts);
  return factKeys.some(k => {
    const fact = state.facts[k];
    if (!fact) return false;
    if (fact.kind === 'onari_village_access' || fact.kind === 'onari_consultation_referral') {
      return (fact.validUntil === null || atMs < fact.validUntil);
    }
    return false;
  });
}

function initialState(startMs) {
  const shared = [ ['familiar_mi6',64], ['known_practice',170], ['shared_piano_evening',68] ];
  const actor = (id, additional) => ({ id, displayName: id === 'goaden' ? 'Goaden Reeves' : 'Ashai Bennet',
    location:'mi6', area:'quarters', activity:'resting', activitySince:startMs, activityUntil:null,
    activityId:'initial-rest', journey:null, conditions:[], publicNext:null,
    body: id === 'ashai' ? { eye:'existing_bionic_eye' } : { baseline:'p183' },
    knowledge:[...shared,...additional].map(([key,page]) => ({factKey:`canon.${key}`, subject:id,
      sourceEventId:`canon-seed:pdf:${page}:${key}`, acquisitionEventId:'canon-seed:import', learnedAt:startMs,
      validUntil:null, provenance:'canon_seed', value:key, source:{file:'canon/manuscript.pdf',physicalPage:page},visibility:'private'})),
  });
  return { meta:{startMs,canonAnchors:ANCHORS,canonSpecification:'outputs/milestone-1a-canon-review/REVIEW_PACKAGE.md'},
    characters:{ goaden:actor('goaden',[['streamliner_passenger',25],['previous_secret_sanctuary_entry',58],['eye_disclosure',153]]),
      ashai:actor('ashai',[['own_eye_replacement',153],['limited_basement_remark',63]]) },
    relationships:[{from:'ashai',to:'goaden',concern:0,trust:2,irritation:0,frictionDay:null},
      {from:'goaden',to:'ashai',concern:0,trust:2,irritation:0,frictionDay:null}],
    weather:{code:'cloudy',description:'Cloudy',temperatureC:12,simulated:true},
    factions:{mi6:'routine',order:'quiet',church:'quiet',sanctuary:'invited_guests',streamliner:'normal',arcane:'low'},
    facts:{}, invitations:{}, arrangements:{}, plans:{}, games:{}, encounter:null,
    storyEffects:initialStoryEffects(),
    threads:initialThreads(),
    intent:initialIntent(),agendas:initialAgendaState(),meuCases:initialMeuCasesState(),legionJobs:initialLegionJobsState(),duskkinCompliance:initialDuskkinComplianceState(),livingPlaces:initialLivingPlacesState(),abilities:initialAbilities(),
    arcs:initialArcs(),outingRecovery:initialOutingRecovery(),supportingStories:initialSupportingStories(),nightStories:initialNightStories(),
    offscreenLives:initialOffscreenLives(),sceneBank:initialSceneBank(),narrativeSignals:initialNarrativeSignals(startMs),
    rhythm:initialRhythm(startMs),
    // The director's whole memory. It is four numbers, a short list of families
    // and today's colour — deliberately the smallest thing that can pace a day
    // and still refuse to repeat itself. `lastNotableAt` starts at the epoch, so
    // the world begins quiet rather than beginning owed a beat.
    director:{day:null,lastNotableAt:startMs,lastBeatAt:null,beatsToday:0,recent:[],colour:null},
    // Fantasy Pressure. `carried` is the residue of what has recently happened
    // to them, which decays a step a day — so a confrontation arrives after a
    // week of things being slightly wrong rather than out of a clear sky.
    pressure:{day:null,carried:0,level:'low',incidentsToday:0,lastIncidentAt:null,recent:[],pending:null} };
}

// One small causal theme per day. Exact times are approved ambient staging, not manuscript chronology.
function dayActions(date, seed, weather = weatherForDay(date, seed), factions = factionsForDay(date, seed, weather)) {
  const theme = themeForDay(date,seed), actions=[];
  const sheltered = isShelterWeather(weather.code), travelDelay = factions.streamliner === 'minor_delays' ? 10 : 0;
  const key = slug => `${date}:${slug}`;
  const at = time => atLondon(date,time);
  const minute = (time,plus) => {const [h,m]=time.split(':').map(Number);const total=h*60+m+plus;
    return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;};
  const add = (id,time,type,data={}) => actions.push({id:`${date}/${id}`,day:date,dueAt:at(time),priority:40,type,...data});
  // A jitter that would carry an action into a neighbouring daypart is dropped,
  // so loosening a time can never invalidate the rules the day is checked against.
  const loosen = (id,time) => {const shifted=minute(time,scheduleJitter(seed,date,id));
    return daypart(at(shifted))===daypart(at(time))?shifted:time;};
  // A plan-keyed activity can be replaced by an earlier decision minutes before
  // it starts, so it keeps its authored time rather than drifting into its cause.
  const activity = (id,time,type,actor,duration,extra={}) =>
    add(id,extra.planKey?time:loosen(id,time),type,{actor,duration,
      // Where the yard is shut, training is somewhere with a roof on it. The
      // day already says so out loud in its weather line; this is what makes
      // the sentence true rather than decorative.
      ...(type==='PRACTICE_BEGIN'&&sheltered?{area:'indoor_yard'}:{}),...extra});
  const meet = (id,time,area='common_room') => add(id,time,'CROSS_PATHS',{actors:['goaden','ashai'],area});
  const offer = (id,time,arrangement,actor,activity,start,duration,extra={}) => add(id,time,'OFFER_ACTIVITY',
    {actor,guest:actor==='goaden'?'ashai':'goaden',arrangementKey:key(arrangement),activity,startAt:at(start),duration,...extra});
  const accept = (id,time,arrangement) => add(id,time,'ACCEPT_ACTIVITY',{arrangementKey:key(arrangement)});
  const announce = (id,time,arrangement) => add(id,time,'ANNOUNCE_ARRANGEMENT',{arrangementKey:key(arrangement)});
  const share = (id,time,from,to,slug) => add(id,time,'SHARE_PRACTICAL_FACT',{actor:from,recipient:to,factKey:key(slug)});
  const startShared = (id,time,type,arrangement,extra={}) => add(id,time,type,{actors:['goaden','ashai'],arrangementKey:key(arrangement),...extra});
  const acknowledge = (id,time,arrangement) => add(id,time,'ACKNOWLEDGE_ARRANGEMENT',{arrangementKey:key(arrangement)});
  // A free routine slot. The plan still declares the slot and still draws the
  // routine it would have scheduled; the reducer decides one minute before
  // whether the character's lived history has anything else to say about it.
  // The routine itself keeps its old id and time, so a world with RHYTHM off
  // commits exactly the events it always did.
  const slot = (id,time,actor,duration,family,bank) => {
    const when=loosen(id,time), baseline=bank.length===1?bank[0]:pick(seed,`${date}/${bank.key}`,bank);
    add(`${id}/choose`,minute(when,-1),'RHYTHM_CHOOSE',{actor,duration,family,slot:id,baseline,slotAt:at(when),legacyId:`${date}/${id}`});
  };
  const bank = (key,...types) => Object.assign(types,{key});

  // Yesterday's unfinished business is a known input to today's schedule.
  const prev=prevLondonDay(date), prevTheme=themeForDay(prev,seed), prevWeather=weatherForDay(prev,seed);
  const prevFactions=factionsForDay(prev,seed,prevWeather);
  const cityDay=CITY_THEMES.has(theme);
  const revisit=CITY_THEMES.has(prevTheme)&&isRecallDay(prevFactions)&&!cityDay;
  const gamingNight=theme==='gaming_night';
  const finishMatch=prevTheme==='gaming_night'&&prevFactions.mi6==='elevated';
  const sanctuaryNight=theme==='sanctuary_night';
  // Pressure from outside. A surge is the city's own weather; a broken evening is
  // what that weather costs the two of them. Both are ordinary in the world of
  // Book One — an MEU reading and a callout that ruins a night out — and neither
  // moves the story: nobody is hurt, nothing is discovered, and the morning after
  // is the same morning it would have been.
  const surgeDay=factions.arcane==='high';
  const brokenNight=sanctuaryNight&&factions.mi6==='elevated';
  const makeUpDay=prevTheme==='sanctuary_night'&&prevFactions.mi6==='elevated'&&!sanctuaryNight;

  // Institutions set the day's mood and produce public facts without needing a
  // simulated character. Statuses commit first so later actions can consult them.
  add('faction-status','00:05','FACTION_STATUS',{factions,priority:5});
  const notices=[];
  if(factions.mi6==='elevated') notices.push(['08:40','elevated_alert']);
  if(factions.arcane!=='low') notices.push(['09:18','arcane_signature']);
  if(factions.streamliner==='minor_delays'&&!isTravelDelayWeather(weather.code)) notices.push(['09:40','streamliner_delays']);
  if(factions.sanctuary==='private_event') notices.push(['10:05','sanctuary_private']);
  if(factions.church==='veil_cycle') notices.push(['10:40','veil_cycle']);
  if(factions.church==='preparations') notices.push(['10:42','church_preparations']);
  if(factions.order==='active_in_city') notices.push(['11:05','order_advisory']);
  // Two moments the whole city is in at the same time. Both are placed inside
  // the windows when the offscreen cast are at their own work (12:48-13:10 and
  // 18:18-18:40) so that a storm or a procession is one event seen from five
  // rooms rather than a line nobody was awake for.
  if(isShelterWeather(weather.code)) notices.push(['13:02','storm_breaks']);
  if(factions.order==='active_in_city') notices.push(['18:22','order_procession']);
  // Yukon's challenge is the stated cause of a gaming night, not left to chance.
  if(gamingNight) notices.push(['09:30','yukon_challenge']);
  // The Veil crossing into a nearer phase is a public milestone, published once
  // on the day it happens rather than repeated. Comparing against yesterday's
  // phase means the world announces the step rather than the countdown.
  const veil=veilForDate(date,seed), veilYesterday=veilForDate(prev,seed);
  if(veil.phase!==veilYesterday.phase&&VEIL_NOTICES[veil.phase]) notices.push(['09:50',`veil_${veil.phase}`]);
  const posted=new Set(notices.map(([,notice])=>notice));
  const flavors=FLAVOR_NOTICES.filter(notice=>!posted.has(notice));
  // Two of these five fall inside the windows when the offscreen cast are at
  // their own work (12:48–13:10 and 18:18–18:40). That is deliberate: a public
  // moment nobody is awake for is a line in a newspaper, and a public moment
  // that lands while Rose is cutting a verse two miles up is a scene in three
  // places at once. The other three keep the notices from all arriving at the
  // same two times of day.
  notices.push([pick(seed,`${date}/flavor-time`,['12:05','12:55','15:42','17:12','18:25']),pick(seed,`${date}/flavor`,flavors)]);
  for(const [time,notice] of notices) add(`notice-${notice}`,time,'INSTITUTION_NOTICE',{notice});
  // An elevated MI6 footing pulls Goaden into duty regardless of the day's theme.
  if(factions.mi6==='elevated') {
    add('alert-briefing','10:35','BRIEFING_BEGIN',{actor:'goaden',duration:40});
    add('alert-standby','21:00','STANDBY_BEGIN',{actor:'goaden',duration:60});
  } else if(factions.mi6==='briefings') add('section-briefing','11:20','BRIEFING_BEGIN',{actor:'goaden',duration:30});

  // A shared afternoon outing to a London venue. On a day when MI6 is on an
  // elevated footing or Holy Order operatives are working the streets, the pair are pulled
  // back early and the unfinished visit becomes tomorrow's known cause.
  const cityOuting=(kind,slug,start='14:00')=>{
    const spot=CITY_KINDS[kind], go=CITY_LOCATIONS[spot].travelMinutes+travelDelay, recalled=isRecallDay(factions);
    add(`${slug}-meeting`,minute(start,-40),'CROSS_PATHS',{actors:['goaden','ashai'],area:'common_room',
      outingRecovery:{arrangementKey:key(slug),kind,venue:spot,departureAt:at(start),travelMinutes:go,duration:90}});
    offer(`${slug}-offer`,minute(start,-39),slug,'ashai',kind,start,90);
    accept(`${slug}-agreement`,minute(start,-38),slug); announce(`${slug}-announcement`,minute(start,-37),slug);
    add(`end-${slug}-meeting`,minute(start,-36),'END_ENCOUNTER',{});
    add(`${slug}-outbound`,start,'TRAVEL_DEPART',{actors:['goaden','ashai'],from:'mi6',to:spot,duration:go,arrangementKey:key(slug)});
    add(`${slug}-activity`,minute(start,go+5),'CITY_ACTIVITY_BEGIN',{actors:['goaden','ashai'],kind,location:spot,duration:55,arrangementKey:key(slug)});
    // The hour itself, and who else is in it. Each address has its own roster
    // — the Legion haunt the Ink because it is their shop-that-moves, Zara
    // turns up wherever a liaison plausibly has an afternoon, and Emily turns
    // up where Emily turns up. Roughly two visits in five have somebody in
    // them, which is often enough to be worth going out and rare enough that
    // the pair still get afternoons to themselves.
    const roster=VENUE_GUESTS[spot]??[];
    const guests=roster.length&&hash(`${seed}|${SELECTION_VERSION}|${date}/venue-guest`)%5<2
      ?[pick(seed,`${date}/venue-who`,roster)]:[];
    add(`${slug}-scene`,minute(start,go+18),'VENUE_SCENE',{actors:['goaden','ashai'],location:spot,venue:spot,guests});
    if(recalled) {
      add(`${slug}-recall`,minute(start,go+25),'OUTING_CUT_SHORT',{actors:['goaden','ashai'],location:spot,kind,
        reason:recallReason(factions),factKey:key('unfinished-visit'),validUntil:atLondon(nextLondonDay(date),'20:00'),arrangementKey:key(slug)});
      add(`${slug}-return`,minute(start,go+30),'TRAVEL_DEPART',{actors:['goaden','ashai'],from:spot,to:'mi6',duration:go,arrangementKey:key(slug)});
    } else {
      add(`${slug}-return`,minute(start,go+65),'TRAVEL_DEPART',{actors:['goaden','ashai'],from:spot,to:'mi6',duration:go,arrangementKey:key(slug)});
      acknowledge(`${slug}-kept`,minute(start,go+110),slug);
    }
  };
  // Yesterday's interrupted outing carries into today: they go back and finish it.
  if(revisit) {
    const prevKind=cityKindForDay(prevTheme,prevWeather), spot=CITY_KINDS[prevKind];
    const go=CITY_LOCATIONS[spot].travelMinutes+travelDelay;
    meet('revisit-meeting','10:05');
    offer('revisit-offer','10:06','revisit','goaden',prevKind,'15:30',80,{requiredFact:`${prev}:unfinished-visit`,fallback:null,announceAs:'revisit'});
    accept('revisit-agreement','10:07','revisit'); announce('revisit-announcement','10:08','revisit');
    add('end-revisit-meeting','10:09','END_ENCOUNTER',{});
    add('revisit-outbound','15:30','TRAVEL_DEPART',{actors:['goaden','ashai'],from:'mi6',to:spot,duration:go,arrangementKey:key('revisit')});
    add('revisit-activity',minute('15:30',go+5),'CITY_ACTIVITY_BEGIN',{actors:['goaden','ashai'],kind:prevKind,location:spot,duration:40,arrangementKey:key('revisit')});
    add('revisit-return',minute('15:30',go+50),'TRAVEL_DEPART',{actors:['goaden','ashai'],from:spot,to:'mi6',duration:go,arrangementKey:key('revisit')});
    acknowledge('revisit-kept','17:30','revisit');
  }
  // A match broken off by a night recall is finished the next evening, once both remember it.
  if(finishMatch) {
    const matchKey=`${prev}:match`, matchFact=`${prev}:unfinished-match`;
    meet('finish-match-meeting','12:44');
    offer('finish-match-offer','12:45','finish-match','goaden','resume_game','19:30',40,{requiredFact:matchFact,fallback:null,announceAs:'resumed_match'});
    accept('finish-match-agreement','12:46','finish-match'); announce('finish-match-announcement','12:47','finish-match');
    add('end-finish-match-meeting','12:48','END_ENCOUNTER',{});
    startShared('finish-match','19:30','GAME_RESUME','finish-match',{gameKey:matchKey,factKey:matchFact});
    acknowledge('finish-match-kept','20:20','finish-match');
  }
  // A callout took an evening; the next day they take one back. Ashai asks —
  // she is the one who chafes at being managed, and she is the one owed it. Like
  // every thread here it needs its cause to be remembered: if neither of them
  // holds the broken plan, the offer is never made and the evening stays quiet.
  if(makeUpDay) {
    const brokenFact=`${prev}:broken-plan`;
    meet('make-up-meeting','12:34');
    offer('make-up-offer','12:35','make-up','ashai','make_up','19:30',60,{requiredFact:brokenFact,fallback:null,announceAs:'make_up'});
    accept('make-up-agreement','12:36','make-up'); announce('make-up-announcement','12:37','make-up');
    add('end-make-up-meeting','12:38','END_ENCOUNTER',{});
    startShared('make-up','19:30','MUSIC_LISTEN_BEGIN','make-up',{duration:60,factKey:brokenFact});
    acknowledge('make-up-kept','20:40','make-up');
  }
  // The city's own weather. A surge is public, ordinary and frightening in the
  // way a siren is: Goaden goes on standby, and Ashai is the one left watching
  // him go. Her concern is what carries into tomorrow, not his.
  if(surgeDay) add('arcane-surge','19:40','ARCANE_SURGE',{actor:'goaden',duration:45,factKey:key('surge'),
    validUntil:atLondon(nextLondonDay(date),'12:00')});

  // Ten ticks, spaced at the same ninety minutes the quiet rule measures, so a
  // gap wide enough to matter cannot fall between two of them unnoticed. A tick
  // that decides nothing is private and costs the feed nothing.
  for(const [index,time] of TICK_TIMES.entries()) add(`director-${index}`,time,'DIRECTOR_TICK',{tick:index,priority:60});

  for(const actor of ['goaden','ashai']) activity(`breakfast-${actor}`,'08:00','MEAL_BEGIN',actor,30);
  // Bad weather closes the outdoor yard: training starts later and, sheltering
  // in the common room, the two cross paths when they otherwise would not.
  if(sheltered) {meet('shelter-meeting','08:45');add('end-shelter-meeting','08:56','END_ENCOUNTER',{});}
  // Fog does something different from rain. It does not shut the yard, so the
  // morning stands, but it puts everybody on the same interior route through
  // the building and the pair end up in the same corridor before lunch.
  else if(weather.code==='fog') {meet('fog-corridor','11:40','corridors');add('end-fog-corridor','11:52','END_ENCOUNTER',{});}
  activity('morning-goaden',sheltered?'09:20':'09:00','PRACTICE_BEGIN','goaden',45);
  activity('morning-ashai',sheltered?'09:30':'09:10','PRACTICE_BEGIN','ashai',35);
  activity('goaden-music','10:15','PIANO_BEGIN','goaden',50);
  slot('ashai-downtime','10:20','ashai',45,'daytime_leisure',bank('ashai-leisure','TV_BEGIN','QUIET_TIME_BEGIN'));
  if(theme!=='meal_deferral') for(const actor of ['goaden','ashai']) activity(`lunch-${actor}`,'12:00','MEAL_BEGIN',actor,30);

  if(theme==='invitation') {
    add('guest-window','12:40','INVITATION_AVAILABLE',{factKey:key('invite'),party:['goaden','ashai'],replyUntil:at('13:00'),
      entryFrom:at('14:45'),entryUntil:at('15:15'),exitBy:at('16:05'),mechanism:pick(seed,date,['unclaimed_guest_allocation','short_notice_guest_window'])});
    add('notice-invite','12:45','NOTICE_PUBLIC_FACT',{actor:'goaden',factKey:key('invite')});
    add('accept-invite','12:46','INVITATION_ACCEPTED',{actor:'goaden',factKey:key('invite')});
    add('optional-practice-change','12:47','PLAN_CHANGE',{actor:'goaden',factKey:key('invite'),activity:'playing_piano',duration:20,planKey:key('optional-practice')});
    activity('optional-practice','13:30','PRACTICE_BEGIN','goaden',45,{planKey:key('optional-practice'),optional:true});
    meet('invite-meeting','13:10'); share('tell-ashai','13:11','goaden','ashai','invite');
    offer('outing-offer','13:12','outing','goaden','sanctuary_visit','14:30',115,{requiredFact:key('invite')});
    accept('outing-agreement','13:13','outing'); announce('outing-announcement','13:14','outing');
    add('outing-end-meeting','13:15','END_ENCOUNTER',{});
    add('outbound','14:30','TRAVEL_DEPART',{actors:['goaden','ashai'],from:'mi6',to:'sanctuary',duration:25+travelDelay,
      arrangementKey:key('outing'),invitationKey:key('invite')});
    add('venue-music',travelDelay?'15:10':'15:00','MUSIC_LISTEN_BEGIN',{actors:['goaden','ashai'],arrangementKey:key('outing'),duration:travelDelay?40:50});
    add('return','16:00','TRAVEL_DEPART',{actors:['goaden','ashai'],from:'sanctuary',to:'mi6',duration:25+travelDelay,
      arrangementKey:key('outing'),invitationKey:key('invite')});
    acknowledge('outing-kept',travelDelay?'16:45':'16:30','outing');
  } else if(theme==='fatigue') {
    activity('extra-practice','12:30','PRACTICE_BEGIN','goaden',35,{fatigueFact:key('break'),preferenceUntil:at('15:00')});
    add('choose-rest','13:10','PLAN_CHANGE',{actor:'goaden',factKey:key('break'),activity:'resting',duration:35,planKey:key('extra-block')});
    activity('extra-block','13:11','PRACTICE_BEGIN','goaden',30,{planKey:key('extra-block'),optional:true});
    meet('break-meeting','13:50'); share('tell-break','13:51','goaden','ashai','break');
    offer('short-game-offer','13:52','short-game','ashai','short_game','14:00',25,{requiredFact:key('break'),fallback:'game'});
    accept('short-game-agreement','13:53','short-game'); announce('short-game-announcement','13:54','short-game');
    add('end-break-meeting','13:55','END_ENCOUNTER',{});
    startShared('short-game','14:00','GAME_BEGIN','short-game'); acknowledge('break-kept','14:30','short-game');
  } else if(theme==='unfinished_game') {
    meet('game-meeting','12:40'); offer('game-offer','12:41','first-game','goaden','game','13:00',90);
    accept('game-agreement','12:42','first-game'); startShared('start-game','13:00','GAME_BEGIN','first-game',{gameKey:key('session')});
    add('pause-game','13:40','GAME_PAUSE',{gameKey:key('session'),factKey:key('unfinished'),validUntil:at('20:00')});
    meet('resume-meeting','13:41');
    offer('resume-offer','13:42','resume-game','ashai','resume_game','16:00',30,{requiredFact:key('unfinished')});
    accept('resume-agreement','13:43','resume-game'); announce('resume-announcement','13:44','resume-game');
    for(const actor of ['goaden','ashai']) activity(`afternoon-practice-${actor}`,'14:00','PRACTICE_BEGIN',actor,actor==='goaden'?40:30);
    startShared('resume-game','16:00','GAME_RESUME','resume-game',{gameKey:key('session'),factKey:key('unfinished')});
    acknowledge('game-kept','16:35','resume-game');
  } else if(theme==='quiet_request') {
    meet('quiet-meeting','13:00'); offer('early-game-offer','13:01','early-game','goaden','game','13:15',30);
    add('quiet-deferral','13:02','DEFER_ACTIVITY',{actor:'ashai',arrangementKey:key('early-game'),factKey:key('quiet'),kind:'quiet_preference',validUntil:at('15:00')});
    share('tell-quiet','13:03','ashai','goaden','quiet');
    add('timing-friction','13:04','SMALL_DISAGREEMENT',{factKey:key('quiet')});
    offer('later-game-offer','13:06','later-game','goaden','game','15:05',30,{requiredFact:key('quiet')});
    accept('later-game-agreement','13:07','later-game'); announce('later-game-announcement','13:08','later-game');
    add('end-quiet-meeting','13:09','END_ENCOUNTER',{});
    add('respect-quiet','13:10','PLAN_CHANGE',{actor:'goaden',factKey:key('quiet'),activity:'playing_piano',duration:80});
    activity('ashai-quiet','13:10','QUIET_TIME_BEGIN','ashai',110);
    startShared('later-game','15:05','GAME_BEGIN','later-game'); acknowledge('quiet-kept','15:40','later-game');
  } else if(theme==='meal_deferral') {
    activity('ashai-solo-game','12:30','GAME_BEGIN','ashai',50);
    meet('meal-meeting','12:50'); offer('early-meal-offer','12:51','early-meal','goaden','meal','13:00',25);
    add('meal-deferral','12:52','DEFER_ACTIVITY',{actor:'ashai',arrangementKey:key('early-meal'),factKey:key('finish'),kind:'finish_preference',validUntil:at('13:20')});
    share('tell-finish','12:53','ashai','goaden','finish');
    offer('later-meal-offer','13:00','later-meal','goaden','meal','13:25',30,{requiredFact:key('finish')});
    accept('later-meal-agreement','13:01','later-meal'); announce('meal-announcement','13:02','later-meal');
    add('end-meal-meeting','13:03','END_ENCOUNTER',{});
    add('fill-meal-gap','13:05','PLAN_CHANGE',{actor:'goaden',factKey:key('finish'),activity:'listening_to_music',duration:15});
    startShared('shared-meal','13:25','MEAL_BEGIN','later-meal'); acknowledge('meal-kept','14:00','later-meal');
  } else if(cityDay) {
    cityOuting(cityKindForDay(theme,weather),theme);
  } else if(gamingNight) {
    meet('match-meeting','12:40'); offer('match-offer','12:41','match','ashai','gaming_match','19:15',75);
    accept('match-agreement','12:42','match'); announce('match-announcement','12:43','match');
    add('end-match-meeting','12:44','END_ENCOUNTER',{});
    for(const actor of ['goaden','ashai']) activity(`afternoon-practice-${actor}`,'14:30','PRACTICE_BEGIN',actor,actor==='goaden'?45:35);
    startShared('gaming-match','19:15','GAME_BEGIN','match',{gameKey:key('match')});
    // A night recall interrupts the match, and it stays unfinished until tomorrow.
    if(factions.mi6==='elevated') add('match-pause','20:25','GAME_PAUSE',{gameKey:key('match'),reason:'night_recall',
      factKey:key('unfinished-match'),validUntil:atLondon(nextLondonDay(date),'20:00')});
    else acknowledge('match-kept','20:35','match');
  }
  // A quiet day keeps only the routine, so the feed is not eventful every single day.
  for(const actor of ['goaden','ashai']) activity(`evening-meal-${actor}`,'18:00','MEAL_BEGIN',actor,35);
  // The same address, a different venue: after dark Sanctuary's night halls
  // open to its evening guest list. None of this can happen during the sacred
  // morning or the public daytime attraction.
  if(sanctuaryNight) {
    add('halls-window','18:40','INVITATION_AVAILABLE',{factKey:key('halls-invite'),party:['goaden','ashai'],replyUntil:at('19:10'),
      entryFrom:at('21:00'),entryUntil:at('21:40'),exitBy:at('23:15'),mechanism:'evening_guest_list'});
    add('notice-halls','18:45','NOTICE_PUBLIC_FACT',{actor:'ashai',factKey:key('halls-invite')});
    add('accept-halls','18:46','INVITATION_ACCEPTED',{actor:'ashai',factKey:key('halls-invite')});
    meet('halls-meeting','19:00'); share('tell-halls','19:01','ashai','goaden','halls-invite');
    offer('halls-offer','19:02','halls','ashai','sanctuary_night','21:00',90,{requiredFact:key('halls-invite')});
    accept('halls-agreement','19:03','halls'); announce('halls-announcement','19:04','halls');
    add('end-halls-meeting','19:05','END_ENCOUNTER',{});
    // On a night MI6 is already standing at heightened readiness, the callout
    // lands before they leave. Everything downstream of the arrangement then
    // finds it broken and stays quiet on its own.
    if(brokenNight) add('halls-broken','20:30','PLAN_BROKEN',{actors:['goaden','ashai'],arrangementKey:key('halls'),
      factKey:key('broken-plan'),validUntil:atLondon(nextLondonDay(date),'21:00')});
    add('halls-outbound','20:45','TRAVEL_DEPART',{actors:['goaden','ashai'],from:'mi6',to:'sanctuary',duration:25+travelDelay,
      arrangementKey:key('halls'),invitationKey:key('halls-invite')});
    add('halls-music','21:25','MUSIC_LISTEN_BEGIN',{actors:['goaden','ashai'],arrangementKey:key('halls'),duration:75});
    add('halls-return','22:45','TRAVEL_DEPART',{actors:['goaden','ashai'],from:'sanctuary',to:'mi6',duration:25+travelDelay,
      arrangementKey:key('halls'),invitationKey:key('halls-invite')});
    acknowledge('halls-kept','23:20','halls');
  }
  // One conversation a day, in the gap between the evening meal and whatever
  // either of them does with the evening. Which scene it plays is not decided
  // here: the reducer reads what they are actually carrying by the time it runs.
  meet('evening-talk-meeting','18:45');
  add('evening-talk','18:46','CONVERSATION',{actors:['goaden','ashai']});
  add('end-evening-talk','18:58','END_ENCOUNTER',{});

  // A made-up evening is the evening, so the solo routine stands down for it.
  if(!gamingNight&&!finishMatch&&!sanctuaryNight&&!makeUpDay) {
    slot('evening-goaden','19:30','goaden',65,'evening_leisure',bank('evening','PIANO_BEGIN','MUSIC_LISTEN_BEGIN','GAME_BEGIN'));
    slot('evening-ashai','19:45','ashai',55,'evening_leisure',bank('evening-ashai','TV_BEGIN'));
  }
  for(const actor of ['goaden','ashai']) {const id=`night-${actor}`;
    add(id,loosen(id,sanctuaryNight?'23:30':'22:30'),'REST_BEGIN',{actor,sleeping:true});}
  return assertScheduleWindows(actions);
}
// The routine a free slot would schedule with RHYTHM off. Planners that read the
// day's shape (arc staging) see this rather than the decision action, so a world
// with RHYTHM absent plans exactly as before; the reducer rechecks presence.
const plannedRoutine = item => item.type==='RHYTHM_CHOOSE'
  ? {id:item.legacyId,day:item.day,dueAt:item.slotAt,priority:40,type:item.baseline,actor:item.actor,duration:item.duration}
  : item;

// The day's strangeness, as its own plan.
//
// This started life inside dayActions and had to come out: dayActions is a pure
// function of the calendar and cannot see state, so the carried pressure it was
// supposed to respond to never reached it. Momentum was stored and then ignored,
// which meant a confrontation could arrive out of a clear sky — the one thing
// this axis exists to prevent. It is called from the day rollover instead, where
// yesterday's residue is in hand.
export function incidentActions(date, seed, weather, factions, carried = 0, recentKinds = []) {
  const veil = veilForDate(date, seed);
  const value = pressureValue(baselinePressure({factions, veilPhase: veil.phase}), carried);
  const level = pressureLevel(value);
  const theme = themeForDay(date, seed), cityDay = CITY_THEMES.has(theme);
  const slots = ['03:20','07:40','11:25','14:50','17:35','20:15','22:05'];
  const outdoorSlots = new Set(['14:50','17:35','20:15']);
  // `recentKinds` is what the world has already done to them lately, carried in
  // from state. Without it the roll only remembered inside its own day, and the
  // same sealed case came up from the river two mornings running.
  const actions = [], used = [...recentKinds];
  for(const [index,time] of slots.entries()) {
    if(actions.length>=PRESSURE_RULES.maxIncidentsPerDay) break;
    const rollKey = `${date}/pressure/${index}`;
    if(!wantsIncident({level,pressure:value,seed,key:rollKey,exposure:PRESSURE_RULES.exposure})) continue;
    const incident = chooseIncident({level,recent:used,weatherCode:weather.code,
      outdoors:cityDay||outdoorSlots.has(time)},seed,rollKey);
    if(!incident) continue;
    used.push(incident.kind);
    const dueAt = atLondon(date,time);
    if(incident.severity==='unease') {
      actions.push({id:`${date}/unease-${index}`,day:date,dueAt,priority:48,type:'UNEASE',
        actors:['goaden','ashai'],kind:incident.kind,text:incident.text});
      continue;
    }
    actions.push({id:`${date}/incident-${index}`,day:date,dueAt,priority:48,type:'INCIDENT',
      actors:['goaden','ashai'],severity:incident.severity,kind:incident.kind,text:incident.text,
      factKey:`${date}:incident-${index}`,aftermath:CONSEQUENCE[incident.severity].aftermath,
      validUntil:atLondon(nextLondonDay(date),'23:00')});
  }
  return assertScheduleWindows(actions);
}

export function assertCanonState(state, atMs) {
  if(JSON.stringify(state.meta.canonAnchors)!==JSON.stringify(ANCHORS)) throw new Error('Canon anchor changed');
  if(Object.keys(state.characters).sort().join(',')!=='ashai,goaden') throw new Error('Only two characters are permitted');
  if(state.characters.ashai.body.eye!=='existing_bionic_eye') throw new Error('Body continuity violated');
  for(const actor of Object.values(state.characters)) {
    if(!LOCATIONS.has(actor.location) || (actor.location==='streamliner') !== Boolean(actor.journey)) throw new Error('Invalid location or journey');
    // A room nobody defined, or the one room this world may never open. Both
    // are checked on every single transition rather than at the door, so there
    // is no path — scheduled, staged or replayed — that ends up behind it.
    if(SEALED_AREAS.includes(actor.area)) throw new Error('Sealed area entered');
    if(!areaOf(actor.location,actor.area)) throw new Error(`Unknown area ${actor.area} at ${actor.location}`);
    if(new Set(actor.knowledge.map(m=>`${m.factKey}|${m.sourceEventId}`)).size!==actor.knowledge.length) throw new Error('Duplicate memory');
    if(actor.conditions.some(c=>!['ordinary_fatigue','shaken'].includes(c.kind))) throw new Error('Unapproved condition');
  }
  for(const fact of Object.values(state.facts)) if(!TOPICS.has(fact.kind)) throw new Error('Forbidden knowledge topic');
  for(const [faction,levels] of Object.entries(FACTION_LEVELS)) if(!levels.includes(state.factions?.[faction])) throw new Error('Unknown faction status');
  for(const r of state.relationships) for(const [field,band] of Object.entries(RELATIONSHIP_BANDS))
    if(!Number.isInteger(r[field])||r[field]<band.min||r[field]>band.max) throw new Error('Relationship bounds violated');
  // The director may not overspend its own day, and may not remember more
  // families than its memory is declared to hold. Both are checked here rather
  // than trusted at the tick, so a bad beat cannot quietly raise the budget.
  const director=state.director;
  if(!director||!Number.isInteger(director.beatsToday)||director.beatsToday<0
    ||director.beatsToday>DIRECTOR_RULES.maxBeatsPerDay) throw new Error('Director budget violated');
  if(!Array.isArray(director.recent)||director.recent.length>DIRECTOR_RULES.memory) throw new Error('Director memory violated');
  // Pressure is bounded the same way, and for the same reason: a rule that is
  // only enforced where it is applied is a rule that drifts.
  const pressure=state.pressure;
  if(!pressure||!PRESSURE_LEVELS.includes(pressure.level)) throw new Error('Unknown pressure level');
  if(!(pressure.carried>=0&&pressure.carried<=1)) throw new Error('Pressure out of range');
  if(!Number.isInteger(pressure.incidentsToday)||pressure.incidentsToday<0
    ||pressure.incidentsToday>PRESSURE_RULES.maxIncidentsPerDay) throw new Error('Incident budget violated');
  assertStoryEffects(state);
  assertThreads(state);
  assertIntent(state);assertAgendas(state);assertAbilities(state);assertMeuCases(state);assertLegionJobs(state);assertDuskkinCompliance(state);assertLivingPlaces(state);
  assertOutingRecovery(state);assertSupportingStories(state);assertNightStories(state);assertOffscreenLives(state);assertArcs(state);assertSceneBank(state);assertNarrativeSignals(state);assertRhythm(state,atMs);
}

function reduceAction(state,a,seed,runtimeContext={}) {
  if(!TYPES.has(a.type)) throw new Error('Unapproved event type');
  const csvReady=a.type==='INTENT_RESPONSE' && narrativeSignalsActive(state)
    && !runtimeContext.disableCounterfactual && Array.isArray(runtimeContext.pendingActions)
    && (state.narrativeSignals.csv.lastEvaluatedAt===null || a.dueAt-state.narrativeSignals.csv.lastEvaluatedAt>=6*60*MIN);
  const beforeDecision=csvReady?boundedCounterfactualState(state):null;
  let csvEvaluation=null, rhythmCompletion=null;
  const id=eventId(seed,a.id), now=a.dueAt, changes=[],followups=[];
  const actors=(a.actors || (a.actor?[a.actor]:[])).map(key=>state.characters[key]);
  if(actors.some(x=>!x)) throw new Error('Unknown character');
  const actor=actors[0];
  // Where the primary actor was standing before this action moved anybody.
  const areaBefore=actor?.area??null;
  const event={id,type:a.type,occurredAt:now,location:actor?.location||'mi6',area:null,participants:actors.map(x=>x.id),
    causedBy:[],payload:{},changes,visibility:'private',publicDescription:null};
  // Record what moved, not the world around it. See src/ledger.mjs for the
  // measurements that forced this: whole-bag before/after clones made the event
  // log grow quadratically and killed a four-month-old world outright.
  const record=leaf=>{
    // One position, one row. A single event may touch the same position several
    // times — a story ledger changing ownership mid-event, say — and only the
    // transition it ends on is observable, so later writes fold into the first.
    const prior=changes.find(change=>change.entity===leaf.entity&&change.id===leaf.id
      &&change.field===leaf.field&&sameValue(change.path??null,leaf.path??null));
    if(!prior) {changes.push(leaf);return;}
    if('after' in leaf) prior.after=leaf.after; else delete prior.after;
  };
  const set=(entity,targetId,target,field,value)=>{
    const current=target[field]??null;
    if(sameValue(current,value)) return;
    const leaves=diffLeaves(current,value);
    if(leaves) for(const leaf of leaves) record({entity,id:targetId,field,...structuredClone(leaf)});
    else record({entity,id:targetId,field,
      // The prospective v29 field did not exist in old saves. Preserve that
      // absence so reversing activation restores the exact historical shape;
      // every legacy whole-value change keeps its existing null convention.
      ...(!(entity==='story'&&['narrativeSignals','rhythm'].includes(field)&&!Object.hasOwn(target,field))
        ?{before:structuredClone(current)}:{}),after:structuredClone(value)});
    target[field]=value;
  };
  const setActor=(who,field,value)=>{
    // Settle only sleep that actually occurred, before losing its activity
    // clock. This also covers a real interruption or departure, not just wake.
    if(field==='activity'&&who.activity==='sleeping'&&value!=='sleeping'&&rhythmActive(state,now))
      setStory('rhythm',commitSleep(state.rhythm,state,now));
    return set('character',who.id,who,field,value);
  };
  const setWorld=(field,value)=>set('world','shared',state,field,value);
  // The director's own bookkeeping is recorded under its own ledger entity. It
  // is genuinely persisted state and genuinely audited, but it is pacing
  // metadata rather than anything in the world: nobody is in it, nothing knows
  // it, and it says only how long the feed has been quiet and what the director
  // has already spent. Keeping it out of `world` is what lets the canon rails
  // above still say, exactly and checkably, that a conversation moves nothing.
  const setDirector=patch=>set('director','pacing',state,'director',{...state.director,...patch});
  // Pressure is world state rather than pacing metadata — an incident really
  // did happen to them — but it is recorded under its own entity so the canon
  // rails can still say precisely what a conversation does and does not move.
  const setPressure=patch=>set('pressure','world',state,'pressure',{...state.pressure,...patch});
  // The authored-situation ledgers, on the same footing as the two above and
  // for the same reason. Measured before this existed: a venue scene, a Legion
  // visit and a colleague walking past were each recording a  change,
  // because these four bags were being written through setWorld. That made the
  // canon rail — a scene is lines and nothing else — unenforceable, since
  //  is also where weather, factions and plans live. Nobody is in
  // these, nothing knows them, and they say only which authored situation is
  // running and when the next may fire.
  const setStory=(field,value)=>set('story',field,state,field,value);
  const update=(field,key,value)=>setWorld(field,{...state[field],[key]:value});
  const publish=text=>{event.visibility='public';event.publicDescription=text;};
  const pair= (from,to) => state.relationships.find(r=>r.from===from&&r.to===to);
  const relation=(from,to,field,value)=>set('relationship',`${from}->${to}`,pair(from,to),field,value);
  const useMemory=(who,key,historical=false)=>{
    const memory=knowsFact(who,key,now,historical);
    if(memory) event.causedBy.push(memory.sourceEventId,memory.acquisitionEventId);
    return memory;
  };
  const learn=(who,fact,provenance)=>{
    if(!fact||fact.createdAt>now) throw new Error('Knowledge lacks a past source');
    if(knowsFact(who,fact.key,now,true)) return;
    setActor(who,'knowledge',[...who.knowledge,{factKey:fact.key,subject:fact.subject,sourceEventId:fact.sourceEventId,
      acquisitionEventId:id,learnedAt:now,validUntil:fact.validUntil,provenance,value:structuredClone(fact.value),visibility:'private',
      ...([...INK_FACT_KINDS,...THREAD_FACT_KINDS,...INTENT_FACT_KINDS,...AGENDA_FACT_KINDS,...ABILITY_FACT_KINDS,...SUPPORTING_FACT_KINDS,...NIGHT_FACT_KINDS,...OFFSCREEN_FACT_KINDS].includes(fact.kind)&&typeof fact.value?.presentationText==='string'
        ?{presentationText:fact.value.presentationText}:{}),}]);
    event.causedBy.push(fact.sourceEventId);
  };
  const createFact=(key,kind,subject,value,validUntil)=>{
    if(!TOPICS.has(kind)) throw new Error('Forbidden knowledge topic');
    const fact={key,kind,subject,value,validUntil,createdAt:now,sourceEventId:id}, existing=state.facts[key];
    // Replaying one action is a no-op; two different actions claiming one key is a bug.
    if(existing) {if(JSON.stringify(existing)!==JSON.stringify(fact)) throw new Error('Conflicting fact'); return existing;}
    update('facts',key,fact); return fact;
  };
  const present=()=>state.encounter && state.encounter.until>=now && ['goaden','ashai'].every(w=>
    state.characters[w].location==='mi6'&&!state.characters[w].journey&&state.characters[w].area===state.encounter.area);
  const activity=(who,label,duration,area,publicText)=>{
    if(who.journey) throw new Error('Cannot start activity in transit');
    if(label==='training'&&!canEnterAbilityArea(state,who.id,who.location,area,{activity:label})) {
      area='indoor_yard';event.payload.trainingRelocated=true;
    }
    if(!canEnterAbilityArea(state,who.id,who.location,area,{activity:label}))
      throw new Error('Activity entered a restricted training ground');
    // The single choke point for every activity in the world: what a place
    // permits depends on the mode it is running at this hour.
    const mode=locationMode(who.location,now);
    if(!permitsActivity(who.location,mode,label)) throw new Error(`${label} is not available at ${who.location} in ${mode} mode`);
    if(!permitsDaypart(a.type,now)) throw new Error(`${a.type} cannot begin during ${daypart(now)}`);
    // And a third gate under those two, added in v13: the room. The address
    // says what this place is at this hour; the room says what this corner of
    // it is for. Both have to agree, which is what makes "training in the music
    // room" and "sleeping in the operations room" unreachable rather than
    // merely never scheduled — and makes the sealed basement a wall.
    if(!permitsArea(who.location,area,label,now))
      throw new Error(`${label} is not possible in ${area} at ${who.location}`);
    if(!ARC_EVENT_TYPES.includes(a.type)) interruptArcSession(storyContext(),a.type,who.id);
    if(!SCENE_BANK_EVENT_TYPES.includes(a.type)) interruptSceneBankSession(storyContext(),a.type,who.id);
    if(who.id==='goaden'&&label!==INK_ACTIVITY&&activeInkAppointment(state))
      interruptInkAppointment(storyContext(),a.type);
    if(!INTENT_EVENT_TYPES.includes(a.type)) interruptIntent(storyContext(),who.id,a.type);
    if(!SUPPORTING_EVENT_TYPES.includes(a.type)) interruptSupportingStories(storyContext(),who.id,a.type);
    abilityActivityChanged(storyContext(),who.id,label,duration,area);
    setActor(who,'activity',label);setActor(who,'activitySince',now);setActor(who,'activityId',id);
    setActor(who,'activityUntil',duration?now+duration*MIN:null);setActor(who,'area',area);
    if(who.publicNext?.at<=now) setActor(who,'publicNext',null);
    if(duration&&!INTENT_EVENT_TYPES.includes(a.type)&&!ABILITY_EVENT_TYPES.includes(a.type)&&!NIGHT_EVENT_TYPES.includes(a.type)) followups.push({id:`${a.id}/complete/${who.id}`,dueAt:now+duration*MIN,priority:20,type:a.type==='PRACTICE_BEGIN'?'PRACTICE_END':'ACTIVITY_COMPLETE',
      actor:who.id,activityId:id,fatigueFact:a.fatigueFact,preferenceUntil:a.preferenceUntil,day:a.day,
      // Which free slot this routine filled, if any. Only its completion may
      // build a leisure habit; duty and shared plans carry no tag.
      ...(a.rhythm?{rhythm:{slot:a.rhythm.slot,family:a.rhythm.family}}:{}),
      ...(rhythmActive(state,now)&&actors.length>1?{rhythmShared:true}:{})});
    if(publicText) publish(publicText);
  };
  const skip=reason=>{event.payload={outcome:'skipped',reason};};
  const agreement=()=>state.arrangements[a.arrangementKey];
  const validAgreement=()=>{const r=agreement();return r&&['accepted','started','completed'].includes(r.status)&&r.startAt<=now&&now<=r.until;};
  const castAvailable=(who,where={})=>arcParticipantAvailable(state,who,now)&&sceneBankAvailable(state,who,now)&&supportingAvailability(state,who,{...where,atMs:now})
    &&legionJobMemberAvailable(state,who,now)
    &&supportingStoryAvailability(state,who,{atMs:now})&&offscreenAvailable(state,who,{...where,atMs:now});
  // The pair's side of a shared moment: one beat each, two minutes after the
  // thing itself, only for whoever has an authored line for what they are
  // actually doing. Scheduled rather than published inline so the ledger shows
  // the cause — the Chimes, then Ashai opening one eye because of them.
  const leadMomentFollowups=moment=>{
    if(!moment||!MOMENT_SIGHTS[moment]) return [];
    const at=now+2*MIN;
    if(londonDate(at)!==a.day) return [];
    return ['goaden','ashai']
      .filter(who=>leadMomentLine({moment,who,activity:state.characters[who]?.activity}))
      .map(who=>({id:`${id}/moment/${who}`,type:'MOMENT_NOTICED',dueAt:at,priority:31,day:a.day,
        actors:[who],moment,who}));
  };
  const counterfactualDecision=csvReady?({key,baselineMotive})=>{
    const result=evaluateIntentAlternatives({state:beforeDecision,pendingActions:runtimeContext.pendingActions,
      action:a,seed,rulesVersion:RULES_VERSION,startMs:state.meta.startMs,
      resolvedThrough:runtimeContext.resolvedThrough,sequence:runtimeContext.sequence,
      reduceAction,key,baselineMotive});
    csvEvaluation=result;
    return result;
  }:undefined;
  const storyContext=()=>({state,action:a,now,id,event,followups,seed,counterfactualDecision,
    intentOverride:runtimeContext.intentOverride,disableNarrativeSignals:runtimeContext.disableNarrativeSignals,ops:{
    setStoryEffects:value=>setWorld('storyEffects',value),
    setThreads:value=>setWorld('threads',value),
    setIntent:value=>setWorld('intent',value),setAgendas:value=>setWorld('agendas',value),setMeuCases:value=>setWorld('meuCases',value),setLegionJobs:value=>setWorld('legionJobs',value),setDuskkinCompliance:value=>setWorld('duskkinCompliance',value),setLivingPlaces:value=>setWorld('livingPlaces',value),
    setAbilities:value=>setWorld('abilities',value),
    setOutingRecovery:value=>setStory('outingRecovery',value),
    setSupportingStories:value=>setStory('supportingStories',value),setNightStories:value=>setStory('nightStories',value),
    setOffscreenLives:value=>setStory('offscreenLives',value),setSceneBank:value=>setStory('sceneBank',value),
    setArcs:value=>setStory('arcs',value),
    actorAvailable:(who,atMs)=>arcParticipantAvailable(state,who,atMs)&&sceneBankAvailable(state,who,atMs)&&nightStoryAvailable(state,who,{atMs})&&outingRecoveryActorAvailable(state,who,{atMs}),
    outingRecoveryAllowed:(spec,atMs)=>['goaden','ashai'].every(who=>nightStoryAvailable(state,who,{atMs}))
      &&permitsActivity(spec.venue,locationMode(spec.venue,spec.departureAt+(spec.travelMinutes+5)*MIN),
        CITY_ACTIVITY[spec.kind]?.label)
      &&permitsDaypart('CITY_ACTIVITY_BEGIN',spec.departureAt+(spec.travelMinutes+5)*MIN),
    setActor:(who,field,value)=>setActor(state.characters[who],field,value),
    createFact,learn:(who,fact,provenance)=>learn(state.characters[who],fact,provenance),
    useMemory:(who,key)=>useMemory(state.characters[who],key),
    activity:(who,label,duration,area)=>activity(state.characters[who],label,duration,area),
    setArrangement:(key,value)=>update('arrangements',key,value),publish,skip,
  }});

  // A RHYTHM action owns exactly one existing calendar slot. Neither a forged
  // tag nor a deferred choice may create another slot, extend it, or interrupt
  // accepted work. Check before scene/arc guards can defer an ordinary routine.
  const rhythmChoice=a.type==='RHYTHM_CHOOSE';
  const rhythmRoutine=Boolean(a.rhythm)&&ROUTINE_TYPES.has(a.type);
  const rhythmFinished=Boolean(a.rhythm)&&['ACTIVITY_COMPLETE','PRACTICE_END'].includes(a.type);
  if(rhythmFinished) {
    const planned=typeof a.day==='string'?dayActions(a.day,seed).find(item=>item.type==='RHYTHM_CHOOSE'
      &&a.id===`${item.legacyId}/complete/${item.actor}`):null;
    if(!planned||a.actor!==planned.actor||a.rhythm.slot!==planned.slot||a.rhythm.family!==planned.family
      ||a.activityId!==eventId(seed,planned.legacyId)||a.dueAt!==planned.slotAt+planned.duration*MIN
      ||actor.activitySince!==planned.slotAt||actor.activityUntil!==a.dueAt) {
      skip('No matching completed leisure slot');assertCanonState(state);return {event,followups};
    }
  }
  if(rhythmChoice||rhythmRoutine) {
    const planned=typeof a.day==='string'?dayActions(a.day,seed).find(item=>item.type==='RHYTHM_CHOOSE'
      &&(rhythmChoice?item.id===a.id:item.legacyId===a.id)):null;
    const valid=planned&&a.actor===planned.actor&&a.duration===planned.duration&&a.priority===40
      &&(rhythmChoice?a.dueAt===planned.dueAt&&a.slotAt===planned.slotAt&&a.legacyId===planned.legacyId
        &&a.family===planned.family&&a.slot===planned.slot&&a.baseline===planned.baseline
        :a.dueAt===planned.slotAt&&a.rhythm.slot===planned.slot&&a.rhythm.family===planned.family
          &&a.rhythm.decisionEventId===eventId(seed,planned.id)
          &&RHYTHM_SLOT_FAMILIES[planned.family][planned.actor].some(label=>RHYTHM_TEMPLATES[label].type===a.type)
          &&(a.type!=='REST_BEGIN'||a.sleeping===false));
    const slotAt=planned?.slotAt,until=slotAt+(planned?.duration??0)*MIN;
    const free=valid&&actor.location==='mi6'&&!actor.journey
      &&['unhurried_time','waiting','quiet_break','watching_television','listening_to_music','gaming','playing_piano','resting'].includes(actor.activity)
      &&(actor.activityUntil==null||actor.activityUntil<=slotAt)
      &&storyContext().ops.actorAvailable(actor.id,now)&&storyContext().ops.actorAvailable(actor.id,slotAt)
      &&supportingLeadAvailable(state,actor.id,{atMs:slotAt})
      &&!(actor.id==='goaden'&&activeInkAppointment(state))
      &&competingCommitments(state,actor.id,slotAt,until).length===0
      &&!(runtimeContext.pendingActions??[]).some(item=>DUTY_TYPES.has(item.type)
        &&(item.actors??[item.actor]).includes(actor.id)&&item.dueAt>=slotAt&&item.dueAt<until);
    if(!free) {skip(valid?'The declared leisure slot is no longer free':'No matching owned leisure slot');
      assertCanonState(state);return {event,followups};}
  }

  if(!guardSceneBankAction(storyContext())) {
    // An authored scene has retained its cast and recorded the deferred action.
  } else if(!guardArcAction(storyContext())) {
    // The existing arc reservation recorded its own delay or refusal.
  } else if(SCENE_BANK_EVENT_TYPES.includes(a.type)) {
    resolveSceneBankAction(storyContext());
  } else if(!guardOutingRecoveryAction(storyContext())) {
    // Exact owned retry validation has already recorded the refusal.
  } else if(!NIGHT_EVENT_TYPES.includes(a.type)&&!SUPPORTING_EVENT_TYPES.includes(a.type)&&a.type!=='ABILITY_ACTIVITY_SETTLED'
    // A RHYTHM decision is not a physical action; the routine it schedules is
    // the thing this gate judges, one minute later, exactly as it always has.
    &&a.type!=='RHYTHM_CHOOSE'&&actors.some(who=>!nightStoryAvailable(state,who.id,{atMs:now}))) {
    skip('An owned night response or its recovery still occupies this character');
  } else if(['CROSS_PATHS','CONVERSATION','LEGION_VISIT','VENUE_SCENE'].includes(a.type)
    &&actors.some(who=>!supportingLeadAvailable(state,who.id,{atMs:now}))) {
    skip('A supporting-character commitment already has their attention');
  } else if(OUTING_RECOVERY_EVENT_TYPES.includes(a.type)) {
    resolveOutingRecoveryAction(storyContext());
  } else if(SUPPORTING_EVENT_TYPES.includes(a.type)) {
    resolveSupportingAction(storyContext());
  } else if(NIGHT_EVENT_TYPES.includes(a.type)) {
    resolveNightAction(storyContext());
  } else if(OFFSCREEN_EVENT_TYPES.includes(a.type)) {
    resolveOffscreenAction(storyContext());
  } else if(ARC_EVENT_TYPES.includes(a.type)) {
    resolveArcAction(storyContext());
  } else if(a.type==='RHYTHM_CHOOSE') {
    // The slot is already free and already legal for its baseline routine. With
    // RHYTHM off, or before its activation, the baseline is scheduled unchanged.
    // With it on, the character's needs, habits, satiety, traces and the hour
    // rank every reviewed template this slot may consider; the reducer's own
    // permit, daypart, room and ownership rules are the filter, so an illegal
    // label never enters the scored set and the winner still faces every gate
    // when its own action runs. Nothing here writes RHYTHM state: a decision is
    // not a behaviour, and only a completed routine leaves a trace.
    if(!Number.isSafeInteger(a.slotAt)||a.slotAt<=now||!a.legacyId||!TYPES.has(a.baseline)) throw new Error('Malformed rhythm slot');
    let chosen=a.baseline, scores=null;
    if(rhythmActive(state,now)&&actor.location==='mi6'&&!actor.journey) {
      const slotMode=locationMode(actor.location,a.slotAt);
      const legal=(template,label)=>permitsDaypart(template.type,a.slotAt)
        &&permitsActivity(actor.location,slotMode,label)
        &&permitsArea(actor.location,template.area??defaultArea(actor.location,a.slotAt),label,a.slotAt)
        &&(label!=='training'||canEnterAbilityArea(state,actor.id,actor.location,template.area,{activity:label}));
      const result=chooseRoutine({state,who:actor.id,family:a.family,slotAt:a.slotAt,now,minutes:a.duration,legal,seed,key:a.id,
        narrative:!runtimeContext.disableNarrativeSignals});
      if(result) {chosen=result.type;scores=result.scores;}
      else {skip('No legal routine fits the declared slot');assertCanonState(state);return {event,followups};}
    }
    followups.push({id:a.legacyId,day:a.day,dueAt:a.slotAt,priority:40,type:chosen,actor:actor.id,duration:a.duration,
      ...(chosen==='REST_BEGIN'?{sleeping:false}:{}),
      ...(scores?{rhythm:{slot:a.slot,family:a.family,decisionEventId:id}}:{})});
    event.payload={slot:a.slot,family:a.family,baseline:a.baseline,chosen,...(scores?{scores}:{})};
  } else if(a.type==='WORLD_RHYTHM_ACTIVATE') {
    const receipt=state.meta.upgrades?.find(item=>item.to==='canon-ambient-p183-v30'
      &&a.id===`rhythm-v30/activate/${item.cutoverAt}`&&now===item.cutoverAt+1);
    if(!receipt||receipt.activatedAt||state.rhythm) skip('No pending rhythm activation');
    else {
      setWorld('meta',{...state.meta,upgrades:state.meta.upgrades.map(item=>item===receipt?{...item,activatedAt:now}:item)});
      // Authored priors only. Old history is never rescored into habit.
      setStory('rhythm',initialRhythm(now));
      event.payload={version:1,activatedAt:now};
    }
  } else if(a.type==='WORLD_NARRATIVE_ACTIVATE') {
    const receipt=state.meta.upgrades?.find(item=>item.to==='canon-ambient-p183-v29'
      &&a.id===`narrative-v29/activate/${item.cutoverAt}`&&now===item.cutoverAt+1);
    if(!receipt||receipt.activatedAt||state.narrativeSignals) skip('No pending narrative systems activation');
    else {
      setWorld('meta',{...state.meta,upgrades:state.meta.upgrades.map(item=>item===receipt?{...item,activatedAt:now}:item)});
      setStory('narrativeSignals',initialNarrativeSignals(now));
      event.payload={version:1,activatedAt:now};
    }
  } else if(a.type==='WORLD_LIVING_PLACES_ACTIVATE') {
    const receipt=state.meta.upgrades?.find(item=>item.to==='canon-ambient-p183-v27'
      &&a.id===`living-places-v27/activate/${item.cutoverAt}`&&now===item.cutoverAt+1);
    if(!receipt||receipt.activatedAt) skip('No pending Living Places activation');
    else {
      setWorld('meta',{...state.meta,upgrades:state.meta.upgrades.map(item=>item===receipt?{...item,activatedAt:now}:item)});
      publish('Living Places consequence memory and Onari ecological custodianship protocols are now active.');
    }
  } else if(a.type==='WORLD_DUSKKIN_ACTIVATE') {
    const receipt=state.meta.upgrades?.find(item=>item.to==='canon-ambient-p183-v26'
      &&a.id===`duskkin-v26/activate/${item.cutoverAt}`&&now===item.cutoverAt+1);
    if(!receipt||receipt.activatedAt) skip('No pending Duskkin compliance activation');
    else {
      setWorld('meta',{...state.meta,upgrades:state.meta.upgrades.map(item=>item===receipt?{...item,activatedAt:now}:item)});
      publish('Duskkin compliance and diplomatic liaison protocols are now active.');
    }
  } else if(a.type==='WORLD_LEGION_ACTIVATE') {
    const receipt=state.meta.upgrades?.find(item=>item.to==='canon-ambient-p183-v25'
      &&a.id===`legion-v25/activate/${item.cutoverAt}`&&now===item.cutoverAt+1);
    if(!receipt||receipt.activatedAt) skip('No pending Legion jobs activation');
    else {
      setWorld('meta',{...state.meta,upgrades:state.meta.upgrades.map(item=>item===receipt?{...item,activatedAt:now}:item)});
      publish('MI6 off-book Legion disaster referrals are now active.');
    }
  } else if(a.type==='WORLD_MEU_ACTIVATE') {
    const receipt=state.meta.upgrades?.find(item=>item.to==='canon-ambient-p183-v24'
      &&a.id===`meu-v24/activate/${item.cutoverAt}`&&now===item.cutoverAt+1);
    if(!receipt||receipt.activatedAt) skip('No pending MEU cases activation');
    else {
      setWorld('meta',{...state.meta,upgrades:state.meta.upgrades.map(item=>item===receipt?{...item,activatedAt:now}:item)});
      publish('MEU casework protocols active under Sector Oversight directives.');
    }
  } else if(a.type==='WORLD_LIVES_ACTIVATE') {
    const receipt=state.meta.upgrades?.find(item=>item.to==='canon-ambient-p183-v23'
      &&a.id===`lives-v23/activate/${item.cutoverAt}`&&now===item.cutoverAt+1);
    if(!receipt||receipt.activatedAt) skip('No pending off-screen lives activation');
    else {
      setWorld('meta',{...state.meta,upgrades:state.meta.upgrades.map(item=>item===receipt?{...item,activatedAt:now}:item)});
      followups.push(...issueOffscreenActions(storyContext(),offscreenDayActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id})));
    }
  } else if(a.type==='WORLD_DEPTH_ACTIVATE') {
    const receipt=state.meta.upgrades?.find(item=>item.to==='canon-ambient-p183-v22'&&a.id===`depth-v22/activate/${item.cutoverAt}`&&now===item.cutoverAt+1);
    if(!receipt||receipt.activatedAt) skip('No pending release activation');
    else {
      setWorld('meta',{...state.meta,upgrades:state.meta.upgrades.map(item=>item===receipt?{...item,activatedAt:now}:item)});
      followups.push(...issueSupportingActions(storyContext(),supportingDayActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id})));
      followups.push(...issueNightActions(storyContext(),nightDayActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id})));
    }
  } else if(INTENT_EVENT_TYPES.includes(a.type)) {
    resolveIntentAction(storyContext());
  } else if(AGENDA_EVENT_TYPES.includes(a.type)) {
    resolveAgendaAction(storyContext());
  } else if(MEU_EVENT_TYPES.includes(a.type)) {
    resolveMeuCaseAction(storyContext());
  } else if(LEGION_JOB_EVENT_TYPES.includes(a.type)) {
    resolveLegionJobAction(storyContext());
  } else if(DUSKKIN_COMPLIANCE_EVENT_TYPES.includes(a.type)) {
    resolveDuskkinComplianceAction(storyContext());
  } else if(LIVING_PLACES_EVENT_TYPES.includes(a.type)) {
    resolveLivingPlacesAction(storyContext());
  } else if(ABILITY_EVENT_TYPES.includes(a.type)) {
    resolveAbilityAction(storyContext());
  } else if(THREAD_EVENT_TYPES.includes(a.type)) {
    resolveThreadAction(storyContext());
  } else if(INK_EVENT_TYPES.includes(a.type)) {
    resolveInkAction(storyContext());
  } else if(a.type==='WEATHER_OBSERVATION') {
    const obs = a.observation;
    if (!obs || !obs.code) throw new Error('Invalid weather observation');
    const effectiveTime = obs.observedAt ?? a.dueAt ?? now;
    if (effectiveTime > now) {
      skip('Weather observation effective time is in the future');
    } else {
      const prevWeather = state.weather || {};
      const slot = obs.slotTime || a.slotTime;
      if (state.weather?.slotTime === slot && state.weather?.external) {
        event.visibility = 'private';
        event.payload = { slotTime: slot, skipped: true, reason: 'slot_already_applied' };
      } else {
        const material = isMaterialWeatherChange(prevWeather, obs);
        setWorld('weather', {
          ...prevWeather,
          ...obs,
          observedAt: Math.min(obs.observedAt ?? now, now),
          simulated: false,
          external: true,
          slotTime: slot,
        });
      if (material) {
        event.payload = {
          weatherCode: obs.code,
          temperatureC: obs.temperatureC,
          precipitationMm: obs.precipitationMm,
          windSpeedKph: obs.windSpeedKph,
          slotTime: slot,
          material: true,
        };
        const notes = {
          heavy_rain: ' The outdoor yard is closed; morning training moves indoors.',
          storm: ' The outdoor yard is closed and Streamliner services expect minor delays.',
          fog: ' Streamliner services expect minor delays.'
        };
        const desc = obs.description ? obs.description.toLowerCase() : obs.code.replace(/_/g, ' ');
        publish(`World weather: ${desc}, ${obs.temperatureC}°C.${notes[obs.code] || ''}`);
      } else {
        event.visibility = 'private';
        event.payload = {
          weatherCode: obs.code,
          temperatureC: obs.temperatureC,
          slotTime: slot,
          suppressed: true,
        };
      }
    }
  }
  } else if(a.type==='WEATHER_CHANGE') {
    const date=a.day;
    const weather = (state.weather?.external && state.weather?.code)
      ? state.weather
      : weatherForDay(date,seed);
    if (!state.weather?.external) {
      setWorld('weather',{...weather,simulated:true});
    }
    event.payload={calendarDay:date,theme:themeForDay(date,seed),weatherCode:weather.code};
    const notes={heavy_rain:' The outdoor yard is closed; morning training moves indoors.',
      storm:' The outdoor yard is closed and Streamliner services expect minor delays.',
      fog:' Streamliner services expect minor delays.'};
    publish(`World weather: ${(weather.description ? weather.description : weather.code).toLowerCase()}, ${weather.temperatureC}°C.${notes[weather.code]||''}`);
    for(const who of Object.values(state.characters)) {
      setActor(who,'conditions',nightRecoveryFor(state,who.id,now)?who.conditions.filter(condition=>condition.kind==='ordinary_fatigue'&&condition.nightStoryId):[]);
      setActor(who,'publicNext',null);
    }
    // Conditions are day-scoped and still clear. What the two of them carry does
    // not: yesterday's friction eases by a step rather than vanishing at midnight.
    for(const r of state.relationships) for(const [field,band] of Object.entries(RELATIONSHIP_BANDS))
      if(band.easesDaily) relation(r.from,r.to,field,easeToward(field,r[field]));
    // A new day returns the budget and clears yesterday's colour. The memory of
    // which families have been used does not reset — that is the whole point of
    // it — and neither does how long the world has been quiet.
    setDirector({day:date,beatsToday:0,colour:null});
    // Pressure walks down when nothing happens, so a bad week stays bad for a
    // while and then eases. The day's own baseline is a floor under that.
    const carried=Math.max(0,(state.pressure?.carried??0)-PRESSURE_RULES.dailyDecay);
    const baseline=baselinePressure({factions:factionsForDay(date,seed,weather),veilPhase:veilForDate(date,seed).phase});
    const value=pressureValue(baseline,carried);
    setPressure({day:date,carried:value,level:pressureLevel(value),incidentsToday:0,pending:null});
    // Inactive worlds keep the original concrete queue. Even a private no-op
    // decision would otherwise consume CSV's real action/clone budgets and
    // change its persisted evaluation. dayActions itself stays calendar-pure.
    const planned=dayActions(date,seed,weather);
    const scheduled=rhythmActive(state,now)?planned:planned.map(plannedRoutine);
    followups.push(...incidentActions(date,seed,weather,factionsForDay(date,seed,weather),value,
      state.pressure?.recent??[]));
    for(const item of scheduled.filter(item=>item.type==='PRACTICE_BEGIN'&&item.planKey)) update('plans',item.planKey,
      {actor:item.actor,activity:'training',startAt:item.dueAt,optional:item.optional===true,status:'scheduled'});
    followups.push(...scheduled);
    followups.push(...abilityDayActions({day:date,seed}));
    followups.push(...issueAgendaActions(storyContext(),agendaDayActions({state,day:date,now,seed,parentActionId:a.id,parentEventId:id})));
    followups.push(...issueSupportingActions(storyContext(),supportingDayActions({state,day:date,now,seed,parentActionId:a.id,parentEventId:id})));
    followups.push(...issueNightActions(storyContext(),nightDayActions({state,day:date,now,seed,parentActionId:a.id,parentEventId:id})));
    followups.push(...issueOffscreenActions(storyContext(),offscreenDayActions({state,day:date,now,seed,parentActionId:a.id,parentEventId:id})));
    // An arc is a consequence of the world's condition rather than its calendar,
    // so it is scheduled here beside the pressure incidents and reads the same
    // carried value they do.
    followups.push(...issueArcActions(storyContext(),arcDayActions({state,day:date,now,seed,carried:value,scheduled:scheduled.map(plannedRoutine)})));
    // A partial checkpoint of actual sleep. Awake actors receive no sleep
    // credit; any remaining sleep is settled when they wake or are interrupted.
    if(rhythmActive(state,now)) setStory('rhythm',commitSleep(state.rhythm,state,now));
    const next=nextLondonDay(date);
    followups.push({id:`${next}/day`,dueAt:atLondon(next,'00:00')+1,priority:0,type:'WEATHER_CHANGE',day:next});
  } else if(a.type==='FACTION_STATUS') {
    const posture=Object.fromEntries(Object.keys(FACTION_LEVELS).map(faction=>[faction,a.factions?.[faction]]));
    for(const [faction,level] of Object.entries(posture)) if(!FACTION_LEVELS[faction].includes(level)) throw new Error('Unknown faction status');
    setWorld('factions',posture);event.participants=[];event.payload={calendarDay:a.day,...posture};
    // Only a departure from the baseline is worth reporting.
    const notable=Object.entries(posture).filter(([faction,level])=>level!==FACTION_LEVELS[faction][0])
      .map(([faction,level])=>FACTION_HEADLINES[faction][level]);
    if(notable.length) publish(`Across London today: ${notable.join('; ')}.`);
  } else if(a.type==='INSTITUTION_NOTICE') {
    const notice=NOTICES[a.notice];
    if(!notice) throw new Error('Unknown institution notice');
    // Institutions produce public facts without becoming simulated characters:
    // nobody learns anything and no private state moves.
    event.location=notice.location;event.participants=[];event.payload={notice:a.notice};
    const wording=Array.isArray(notice.text)?notice.text:[notice.text];
    publish(wording[hash(`${seed}|${RULES_VERSION}|${a.day}/notice/${a.notice}`)%wording.length]);
    // A loud public thing reaches the people who are in earshot of it. Whoever
    // is mid-project when this lands gets an authored beat two minutes later,
    // so the Chimes and Rose looking up from her verse are one moment in the
    // feed rather than two unrelated items.
    followups.push(...offscreenWitnessActions(storyContext(),NOTICE_MOMENTS[a.notice]??null));
    followups.push(...leadMomentFollowups(NOTICE_MOMENTS[a.notice]??null));
  } else if(ROUTINE_TYPES.has(a.type)) {
    if(a.planKey&&state.plans[a.planKey]?.status!=='scheduled') {skip('Optional activity replaced by an earlier decision');}
    else if(a.arrangementKey&&!validAgreement()) {skip('No valid accepted arrangement');}
    else if(DUTY_TYPES.has(a.type)&&actors.some(w=>w.location!=='mi6'||w.journey)) {skip('Duty call arrived while away from MI6');}
    else {
      if(a.type==='PIANO_BEGIN'&&actors.some(w=>w.id!=='goaden')) throw new Error('Only Goaden plays piano');
      if(a.type==='TV_BEGIN'&&actors.some(w=>w.id!=='ashai')) throw new Error('TV routine belongs to Ashai');
      if(actors.some(w=>w.location!=='mi6')&&!['MUSIC_LISTEN_BEGIN','QUIET_TIME_BEGIN','REST_BEGIN'].includes(a.type)) throw new Error('Activity requires MI6');
      // A replay of the very action that resumed the game is recognised and repeated harmlessly.
      const resumedHere=state.games[a.gameKey]?.sourceEventId===id;
      if(a.type==='GAME_RESUME'&&!resumedHere&&(!state.games[a.gameKey]?.paused||actors.some(w=>!useMemory(w,a.factKey)))) throw new Error('Cannot resume an unknown unfinished game');
      if(a.type==='WAIT_BEGIN'&&!a.arrangementKey) throw new Error('Waiting needs an arrangement');
      const labels={PRACTICE_BEGIN:'training',REST_BEGIN:a.sleeping?'sleeping':'resting',MEAL_BEGIN:'eating',PIANO_BEGIN:'playing_piano',
        MUSIC_LISTEN_BEGIN:'listening_to_music',GAME_BEGIN:'gaming',GAME_RESUME:'gaming',QUIET_TIME_BEGIN:'quiet_break',TV_BEGIN:'watching_television',WAIT_BEGIN:'waiting',
        BRIEFING_BEGIN:'in_a_briefing',STANDBY_BEGIN:'on_call',COMMS_CHECK_BEGIN:'on_call'};
      const label=labels[a.type], r=agreement();
      if(r&&r.status==='accepted') update('arrangements',a.arrangementKey,{...r,status:'started',startedEventId:id});
      for(const who of actors) activity(who,label,a.sleeping?null:(a.duration??r?.duration??30),
        a.area??AREAS[a.type]??defaultArea(who.location,now));
      event.participants=actors.map(w=>w.id);event.location=actors[0]?.location||'mi6';
      if(a.rhythm?.decisionEventId) event.causedBy.push(a.rhythm.decisionEventId);
      const who=actors.length===2?'Goaden and Ashai':shortName(actor.id);
      const phrases={training:'began training',resting:'settled down to rest',sleeping:'turned in for the night',eating:'stopped for a meal',playing_piano:'began playing piano',
        listening_to_music:'settled down to listen to music',gaming:a.type==='GAME_RESUME'?'resumed their game':'started a game',quiet_break:'took a quiet break',watching_television:'settled down to watch television',waiting:'waited for their agreed break',
        in_a_briefing:'was called into an inner circle briefing',on_call:'went on call for the night'};
      // Standing the night watch and being wanted on comms are the same status
      // and not the same event, so the type gets the last word on the wording.
      const byType={COMMS_CHECK_BEGIN:'was wanted in the operations room for a comms check'};
      // The plain phrasing is still the default and still the most common
      // thing the world says. It is simply no longer the *only* thing: a bank
      // per label, seeded off the day, so "Goaden began training" stops being
      // the same eleven words a hundred and forty times.
      const plain=`${who} ${byType[a.type]??phrases[label]}.`;
      publish(label==='training'&&actors.every(w=>w.area==='indoor_yard')
        ? `${who} began training on the covered floor${event.payload.trainingRelocated?' while the outdoor ground remained closed':''}.`
        :VENUE_PHRASES[`${actor.location}:${locationMode(actor.location,now)}:${label}`]
        ??(byType[a.type]?plain:downtimeLine({label,who,shared:actors.length===2,plain,part:daypart(now),
          seed,key:`${a.day}/${a.id}`})));
      if(['GAME_BEGIN','GAME_RESUME'].includes(a.type)&&a.gameKey) update('games',a.gameKey,{participants:actors.map(w=>w.id),paused:false,sourceEventId:id});
    }
  } else if(a.type==='ACTIVITY_COMPLETE'||a.type==='PRACTICE_END') {
    if(actor.activityId!==a.activityId) skip('Activity already replaced');
    else {
      const wasResting=actor.activity==='resting';
      // What actually finished, for how long, and whether a free slot chose it.
      // A concrete routine already queued before the prospective activation is
      // still its original slot. Recognize it by its exact owned clock and ID;
      // no past completion is revisited and other routines gain no leisure tag.
      const legacySlot=rhythmActive(state,now)&&!a.rhythm&&a.day?dayActions(a.day,seed).find(item=>
        item.type==='RHYTHM_CHOOSE'&&a.id===`${item.legacyId}/complete/${item.actor}`&&a.actor===item.actor
        &&a.activityId===eventId(seed,item.legacyId)&&actor.activitySince===item.slotAt
        &&a.dueAt===item.slotAt+item.duration*MIN):null;
      rhythmCompletion={who:actor.id,label:actor.activity,minutes:(now-actor.activitySince)/MIN,
        family:a.rhythm?.family??legacySlot?.family??null,shared:a.rhythmShared===true};
      activity(actor,'unhurried_time',null,defaultArea(actor.location,now));
      if(wasResting) setActor(actor,'conditions',[]);
      if(a.type==='PRACTICE_END') {
        publish(trainingEndLine({who:shortName(actor.id),spent:Boolean(a.fatigueFact),seed,key:`${a.day}/${a.id}`}));
        if(a.fatigueFact) {
          const fact=createFact(a.fatigueFact,'break_preference',actor.id,{preference:'short_game',note:'PRIVATE_ORDINARY_BREAK_PREFERENCE'},a.preferenceUntil);
          learn(actor,fact,'self_observation'); setActor(actor,'conditions',[{kind:'ordinary_fatigue',since:now,until:a.preferenceUntil,sourceEventId:id}]);
        }
      }
    }
  } else if(a.type==='CROSS_PATHS') {
    // Until v13 this asked two questions: are they both in the building, and is
    // each doing something interruptible. It never asked whether the room they
    // were about to be standing in was open, was a place anybody gathers, or
    // could be reached from where they actually were — so the pair could "cross
    // paths" in a shut training ground. The rule now lives in one place and
    // names the reason it refused, which is what the skip records.
    const verdict=encounterEligibility(Object.fromEntries(actors.map(w=>[w.id,w])),
      {location:'mi6',area:a.area,atMs:now});
    if(!verdict.ok) skip(ENCOUNTER_REASONS[verdict.reason]);
    else {for(const who of actors) setActor(who,'area',a.area);setWorld('encounter',{area:a.area,until:now+25*MIN,eventId:id});
      publish(encounterLine({room:MI6_SECTIONS[a.area].name,area:a.area,seed,key:`${a.day}/${a.id}`}));
      if (a.area === 'corridors' && !hasDavisBetrayal(state, now) && hasDavisWarmthPrerequisite(state) && castAvailable('davis', {location:'mi6', area:'corridors'})) {
        followups.push({
          id: `${a.id}/betrayal-discovery`,
          day: a.day,
          dueAt: now + 3 * MIN,
          priority: 15,
          type: 'DAVIS_BETRAYAL_DISCOVERY',
          actors: ['ashai'],
          area: 'corridors',
        });
      }
    }
  } else if(a.type==='CONVERSATION') {
    // A scene needs both of them actually in the room. Whatever they are
    // carrying by now — a broken plan, a worried week, friction, the weather —
    // decides which written exchange plays. Nothing is generated here.
    if(!present()) skip('Nobody to talk to');
    else {
      const felt=pair('ashai','goaden');
      const repairing=['goaden','ashai'].some(who=>state.characters[who].knowledge
        .some(m=>m.factKey.endsWith(':broken-plan')&&m.learnedAt<=now&&(m.validUntil===null||now<m.validUntil)));
      const mood=moodFor({concern:felt.concern,irritation:felt.irritation,trust:felt.trust,
        weatherCode:state.weather?.code,repairing,veilPhase:veilForDate(a.day,seed).phase,
        // Today's colour, if the director spent the day's beat on one that
        // leaves something to talk about. It is cleared at every midnight.
        colour:state.director?.colour??null},seed,`${a.day}/${a.id}`);
      // Who else the building puts in this room at this hour. A colleague is
      // never booked by a conversation; the conversation only gets to use one
      // who was going to be there anyway.
      const room=state.characters.goaden?.area;
      const colleagues=room&&state.characters.ashai?.area===room?presentableIn(room,daypart(now)):[];
      // Causes, not temperatures. A mood says how the evening feels; a cause
      // says what actually happened, and the strongest lines are gated on the
      // second. `autonomy_breach` is a concrete boundary violation: Goaden
      // actually committed an intentional act of withholding, deception, or
      // paternalism (e.g. CONCEALED_DANGER, BROKEN_AGREEMENT, or CONSEQUENTIAL_DECEPTION)
      // during a week the city has been pressing hard enough for her to have noticed.
      //
      // Knowledge asymmetry alone is never an autonomy breach. Goaden privately
      // knowing about a routine standby shift or an MEU courier does not mean
      // he made a decision on Ashai's behalf.
      const committedBreach=(state.events??[]).some(event=>
        INTENTIONAL_BREACH_TYPES.has(event.type)
        &&(event.participants??[]).includes('goaden')
        &&now-Number(event.occurredAt)<=7*24*60*MIN);
      // `carried` is the residue of a bad stretch and decays a step a day, so
      // this is "it has been like this for a while" rather than "something
      // happened this afternoon". She is not the type to snap easily.
      const pressedWeek=(state.pressure?.carried??0)>=0.5||state.factions?.arcane==='high';
      const causes=committedBreach&&pressedWeek&&felt.concern>=2?['autonomy_breach']:[];
      const lines=selectExchange(mood,seed,`${a.day}/${a.id}`,{present:colleagues,causes});
      event.participants=['goaden','ashai'];
      // The lines are the event. No state moves: a conversation at this
      // checkpoint teaches neither of them anything and settles nothing.
      event.payload={mood,lines};
      publish(summarise(mood));
    }
  } else if(a.type==='MOMENT_NOTICED') {
    // They have to still be doing the thing the line was written for, and still
    // be somewhere the moment reaches. Otherwise it simply passed them by, which
    // is a truer outcome than making them witness it from a train.
    const who=state.characters[a.who];
    const line=who&&!who.journey&&who.location==='mi6'
      ? leadMomentLine({moment:a.moment,who:a.who,activity:who.activity,seed,key:`${a.day}/${a.id}`}) : null;
    if(!line) skip('The moment did not reach them');
    else {event.participants=[a.who];event.payload={moment:a.moment,sight:MOMENT_SIGHTS[a.moment]};publish(line);}
  } else if(a.type==='ARCANE_SURGE') {
    // Only if he is actually on station. Out on a journey or at a venue, the
    // callout finds nobody and the evening passes as it would have.
    if(actor.location!=='mi6'||actor.journey) skip('Not on station for a callout');
    else {
      const fact=createFact(a.factKey,'duty_callout','goaden',{footing:'standby'},a.validUntil);
      learn(actor,fact,'called_to_standby');
      activity(actor,'on_call',a.duration,'quarters');
      // Directional on purpose: the worry is hers, about him. He is working.
      relation('ashai','goaden','concern',raiseTo('concern',pair('ashai','goaden').concern,2));
      event.participants=['goaden'];
      publish(surfaceLine(id, [
        'MEU scanners registered a surge along the Thames corridor, and Goaden was called to stand by.',
        'A surge along the Thames corridor put Goaden on stand-by.',
        'The MEU scanners picked up a surge along the Thames corridor. Goaden was called to stand by for it.',
        'Goaden was put on stand-by: the scanners had a surge along the Thames corridor.',
        'Another surge along the Thames corridor. Goaden went on stand-by while the MEU read it.']));
      // A surge on the corridor is felt by everything with a Presence in it,
      // which is most of the cast. Whoever is mid-project gets their own beat.
      followups.push(...offscreenWitnessActions(storyContext(),'arcane_surge'));
      followups.push(...leadMomentFollowups('arcane_surge'));
    }
  } else if(a.type==='PLAN_BROKEN') {
    const r=agreement();
    // Only an announced plan that has not yet started can be broken. Once it is
    // under way it is no longer a promise, and a replay finds it already broken.
    if(!r||r.status!=='accepted'||!r.public) skip('No announced plan left to break');
    else {
      update('arrangements',a.arrangementKey,{...r,status:'broken'});
      const fact=createFact(a.factKey,'broken_plan','both',{arrangement:r.textKey||r.activity},a.validUntil);
      for(const who of actors) {learn(who,fact,'duty_callout');setActor(who,'publicNext',null);}
      // Duty broke a promise. He did not choose it, and it still costs him
      // something with her — the one force at this checkpoint that moves trust
      // downward, and the reason a kept plan tomorrow can earn it back.
      relation('ashai','goaden','trust',clampBand('trust',pair('ashai','goaden').trust-1));
      for(const rel of state.relationships) relation(rel.from,rel.to,'concern',raiseTo('concern',pair(rel.from,rel.to).concern,2));
      event.participants=[...r.party];event.causedBy.push(r.sourceEventId,r.acceptanceEventId);
      publish('An MI6 callout broke the evening Goaden and Ashai had arranged at Sanctuary.');
    }
  } else if(a.type==='END_ENCOUNTER') {
    setWorld('encounter',null);
  } else if(a.type==='NOTICE_PUBLIC_FACT') {
    const fact=state.facts[a.factKey];
    if(!fact||fact.validUntil<=now||actor.location!=='mi6'||actor.journey) skip('No current observation opportunity');
    else learn(actor,fact,'checked_ordinary_notice');
  } else if(a.type==='SHARE_PRACTICAL_FACT') {
    const fact=state.facts[a.factKey], recipient=state.characters[a.recipient];
    if(!present()||!fact||!recipient||!useMemory(actor,a.factKey)) skip('No valid source or encounter');
    else {const news=!knowsFact(recipient,a.factKey,now,true);
      learn(recipient,fact,`told_by_${actor.id}`);event.participants=[actor.id,recipient.id];
      // Only actual news moves the relationship, so a replay cannot bank concern twice.
      if(news&&fact.kind==='break_preference') relation(recipient.id,actor.id,'concern',clampBand('concern',pair(recipient.id,actor.id).concern+1));}
  } else if(a.type==='OFFER_ACTIVITY') {
    if(!present()) skip('Offer requires an encounter');
    // A thread that depends on a forgotten cause is never proposed at all, so
    // every action further down that thread finds no arrangement and stays quiet.
    else if(a.requiredFact&&a.fallback===null&&!useMemory(actor,a.requiredFact)) skip('Nothing remembered to propose');
    else {
      const memory=a.requiredFact?useMemory(actor,a.requiredFact):null;
      const informed=!a.requiredFact||Boolean(memory);
      const chosen=informed?a.activity:(a.fallback||'game');
      const startAt=informed?a.startAt:now+30*MIN;
      update('arrangements',a.arrangementKey,{party:[actor.id,a.guest],requester:actor.id,activity:chosen,startAt,
        duration:a.duration,until:startAt+(a.duration+45)*MIN,status:'offered',public:false,sourceEventId:id,
        textKey:informed&&a.announceAs?a.announceAs:chosen,
        knowledgeSource:informed&&memory?{factKey:memory.factKey,sourceEventId:memory.sourceEventId,acquisitionEventId:memory.acquisitionEventId}:null});
      event.payload={outcome:chosen,usedKnowledge:Boolean(memory)};
    }
  } else if(a.type==='ACCEPT_ACTIVITY') {
    const r=agreement();
    if(!present()||!r||r.status!=='offered') skip('No offer to accept');
    else {update('arrangements',a.arrangementKey,{...r,status:'accepted',acceptedAt:now,acceptanceEventId:id});event.causedBy.push(r.sourceEventId);}
  } else if(a.type==='DEFER_ACTIVITY') {
    const r=agreement();
    if(!present()||!r||r.status!=='offered') skip('No offer to defer');
    else {update('arrangements',a.arrangementKey,{...r,status:'deferred'});
      const fact=createFact(a.factKey,a.kind,actor.id,{preference:a.kind},a.validUntil);learn(actor,fact,'self_report');event.causedBy.push(r.sourceEventId);}
  } else if(a.type==='ANNOUNCE_ARRANGEMENT') {
    const r=agreement();
    if(!r||r.status!=='accepted') skip('Unaccepted plan stays private');
    else {const text=ARRANGEMENT_TEXT[r.textKey||r.activity]||DEFAULT_ARRANGEMENT_TEXT;
      update('arrangements',a.arrangementKey,{...r,public:true});
      for(const key of r.party) setActor(state.characters[key],'publicNext',{at:r.startAt,description:text.next});
      event.participants=[...r.party];event.causedBy.push(r.sourceEventId,r.acceptanceEventId);
      publish(surfaceLine(id, ANNOUNCE_LINES[text.announce] ?? [text.announce]));}
  } else if(a.type==='PLAN_CHANGE') {
    const fact=state.facts[a.factKey];
    if(!fact||!useMemory(actor,a.factKey)) skip('Change requires known cause');
    else {const permitted=['resting','playing_piano','listening_to_music'];if(!permitted.includes(a.activity)) throw new Error('Unapproved substitution');
      if(a.planKey) {const plan=state.plans[a.planKey];
        if(!plan||!plan.optional||plan.actor!==actor.id||plan.startAt<now) throw new Error('Only a future optional activity can be replaced');
        update('plans',a.planKey,{...plan,status:'replaced',replacement:a.activity,decisionEventId:id});}
      activity(actor,a.activity,a.duration,a.activity==='playing_piano'?'music_room':a.activity==='resting'?'quarters':defaultArea(actor.location,now));
      const who=shortName(actor.id);
      publish(surfaceLine(id, a.activity==='resting' ? [
        `${who} took a break.`, `${who} stopped for a while instead.`, `${who} let the plan go and sat down.`, `${who} took the break instead of the thing planned.`]
      : a.activity==='playing_piano' ? [
        `${who} sat down at the piano instead.`, `${who} went to the piano instead.`, `${who} changed the plan for the piano.`,
        `${who} left the plan where it was and went to the music room.`, `The piano won. ${who} sat down to it instead.`]
      : [`${who} listened to music.`, `${who} put music on instead.`, `${who} let the plan go and listened to something.`, `${who} traded the plan for music.`]));}
  } else if(a.type==='SMALL_DISAGREEMENT') {
    if(!present()||!['goaden','ashai'].every(w=>useMemory(state.characters[w],a.factKey))) skip('No shared basis for disagreement');
    // Friction now adds to what is already there rather than overwriting it, so
    // a second disagreement in a bad week lands harder than the first. An
    // increment is not replay-safe on its own, so the day it was registered is
    // recorded and a repeat of the same day's friction resolves as a no-op.
    else if(state.relationships.every(r=>r.frictionDay===a.day)) skip('Friction already registered today');
    else {for(const r of state.relationships) {
        relation(r.from,r.to,'irritation',raiseTo('irritation',pair(r.from,r.to).irritation,1));
        relation(r.from,r.to,'frictionDay',a.day);}
      event.participants=['goaden','ashai'];publish(surfaceLine(id, [
        'Goaden and Ashai briefly disagreed about the timing of a break.', 'Goaden and Ashai did not agree about when to stop, and said so.',
        'There was a short difference of opinion about the timing of a break. It stayed short.',
        'Goaden and Ashai disagreed about when the break should be. Neither won.']));}
  } else if(a.type==='ACKNOWLEDGE_ARRANGEMENT') {
    const r=agreement(), ink=activeInkAppointment(state);
    if(ink?.arrangementKey===a.arrangementKey) {
      skip('The booked appointment is still in progress');
      followups.push({...a,id:`${a.id}/after-ink`,
        dueAt:Math.max(now+MIN,ink.returnAt+(ink.returnMinutes+1)*MIN)});
    } else if(!r||r.status!=='started'||!r.startedEventId) skip('No kept arrangement');
    else {update('arrangements',a.arrangementKey,{...r,status:'completed'});event.causedBy.push(r.acceptanceEventId,r.startedEventId);
      if(r.knowledgeSource) event.causedBy.push(r.knowledgeSource.sourceEventId,r.knowledgeSource.acquisitionEventId);
      // Keeping a plan smooths friction between them, and on a day that carried
      // none it earns a little trust. Two things it deliberately does not do.
      // It no longer zeroes anything — arrangements are kept most days, so a
      // reset here would erase accumulated feeling as fast as the old midnight
      // wipe did. And it does not touch concern: an evening together is not an
      // answer to the Order working their street, so worry about the world
      // outside is left to ease on its own clock.
      // Neither the easing nor the trust applies on a day that carried friction.
      // Smoothing over the plan does not unmake the afternoon: the irritation
      // stands until morning, which is also the only way an evening scene ever
      // sees it. Easing it here erased it hours before anyone could notice.
      for(const rel of state.relationships) {const current=pair(rel.from,rel.to);
        if(current.frictionDay!==a.day) {
          relation(rel.from,rel.to,'irritation',easeToward('irritation',current.irritation));
          relation(rel.from,rel.to,'trust',clampBand('trust',current.trust+1));}}
      event.participants=[...r.party];event.payload={outcome:'kept_arrangement'};}
  } else if(a.type==='GAME_PAUSE') {
    const game=state.games[a.gameKey];
    if(!game||game.paused) skip('No active shared game');
    else {update('games',a.gameKey,{...game,paused:true});event.causedBy.push(game.sourceEventId);
      const fact=createFact(a.factKey,'unfinished_game','both',{gameKey:a.gameKey},a.validUntil);
      for(const who of game.participants.map(w=>state.characters[w])) {learn(who,fact,'participated');activity(who,'unhurried_time',null,defaultArea(who.location,now));}
      event.participants=[...game.participants];
      publish(a.reason==='night_recall'?'Goaden and Ashai broke off their match when Goaden was called to the night watch.'
        :surfaceLine(id, ['Goaden and Ashai paused their game before training.', 'The game was paused for training. It would keep.',
          'Training was due, so Goaden and Ashai left the game where it was.', 'Goaden and Ashai put the game down for training and did not finish it.']));}
  } else if(a.type==='PRACTICE_SLOT_NOTICE') {
    createFact(a.factKey,'practice_slot','world',{startAt:a.startAt},a.validUntil);publish('An ordinary MI6 training slot has moved.');
  } else if(a.type==='INVITATION_AVAILABLE') {
    const fact=createFact(a.factKey,'invitation','goaden',{party:a.party,entryFrom:a.entryFrom,entryUntil:a.entryUntil,exitBy:a.exitBy},a.exitBy);
    update('invitations',a.factKey,{factKey:a.factKey,party:a.party,replyUntil:a.replyUntil,entryFrom:a.entryFrom,entryUntil:a.entryUntil,
      exitBy:a.exitBy,acceptedAt:null,sourceEventId:id,mechanism:a.mechanism});event.causedBy=[fact.sourceEventId];
  } else if(a.type==='INVITATION_ACCEPTED') {
    const inv=state.invitations[a.factKey];
    if(!inv||!inv.party.includes(actor.id)||inv.acceptedAt!==null||now>=inv.replyUntil||!useMemory(actor,a.factKey)) skip('Invitation unavailable, ineligible or unknown');
    else {update('invitations',a.factKey,{...inv,acceptedAt:now,acceptanceEventId:id});publish(surfaceLine(id, [`${shortName(actor.id)} received a Sanctuary guest invitation.`,
        `A guest invitation to the Sanctuary came through for ${shortName(actor.id)}.`,
        `${shortName(actor.id)} was invited up to the Sanctuary as a guest.`,
        `The Sanctuary sent ${shortName(actor.id)} a guest invitation.`]));}
  } else if(a.type==='TRAVEL_DEPART') {
    const r=agreement(),inv=state.invitations[a.invitationKey],arrivalAt=now+a.duration*MIN;
    const ink=activeInkAppointment(state), tagged=state.storyEffects.ink.appointments[a.inkAppointmentId];
    if(a.inkAppointmentId&&(!tagged||tagged.token!==a.inkAppointmentToken
      ||!['completed','interrupted'].includes(tagged.status)||(ink&&ink.id!==tagged.id))) skip('Superseded appointment return');
    else if(!a.inkAppointmentId&&a.from==='enchanted_ink'&&a.to==='mi6'
      &&ink?.arrangementKey===a.arrangementKey&&now<ink.returnAt) skip('Return postponed for the booked appointment');
    else if(!r||!['accepted','started'].includes(r.status)||actors.some(w=>w.location!==a.from||w.journey)) skip('No valid agreed departure');
    else if(a.to==='sanctuary'&&(!canEnterSanctuary(state,arrivalAt,actors.map(w=>w.id),a.invitationKey)||!inv)) skip('No valid invitation for arrival');
    else if(a.to==='onari_village'&&!canEnterOnariVillage(state,arrivalAt,actors.map(w=>w.id),a.accessFactKey||a.reasonKey)) skip('No valid Onari village access');
    else {
      if(a.from==='sanctuary'&&(!inv||now>inv.exitBy)) throw new Error('Visit exceeded permission');
      if(actors.some(w=>w.id==='goaden')&&activeInkAppointment(state))
        interruptInkAppointment(storyContext(),'TRAVEL_DEPART');
      if(a.to==='sanctuary') {update('arrangements',a.arrangementKey,{...r,status:'started',startedEventId:id});event.causedBy.push(inv.sourceEventId,inv.acceptanceEventId,r.acceptanceEventId);}
      for(const who of actors) {
        interruptIntent(storyContext(),who.id,'TRAVEL_DEPART');
        interruptSupportingStories(storyContext(),who.id,'TRAVEL_DEPART');
        abilityActivityChanged(storyContext(),who.id,'travelling',a.duration,'transit');
        setActor(who,'location','streamliner');setActor(who,'area','transit');setActor(who,'activity','travelling');setActor(who,'activitySince',now);
        setActor(who,'activityUntil',arrivalAt);setActor(who,'activityId',id);setActor(who,'publicNext',null);
        setActor(who,'journey',{from:a.from,to:a.to,departedAt:now,arrivesAt:arrivalAt,departureEventId:id,invitationKey:a.invitationKey});}
      followups.push({id:`${a.id}/arrival`,dueAt:arrivalAt,priority:10,type:'TRAVEL_ARRIVE',actors:actors.map(w=>w.id),
        from:a.from,to:a.to,departureEventId:id,invitationKey:a.invitationKey,
        accessFactKey:a.accessFactKey||a.reasonKey,day:a.day});event.location='streamliner';
      event.payload={...event.payload,to:a.to,from:a.from};
      publish(a.to==='mi6'
        ? homewardLine('boarded',seed,`${a.day}/${a.id}`)
        : a.to==='sanctuary' ? 'Goaden and Ashai boarded the Streamliner on their way to Sanctuary.'
        : a.to==='onari_village' ? `Goaden and Ashai boarded the Streamliner on their way to ${placePhrase('onari_village', null)}.`
        : `Goaden and Ashai boarded the Streamliner on their way to ${CITY_LOCATIONS[a.to].name}.`);
    }
  } else if(a.type==='TRAVEL_ARRIVE') {
    // A replayed arrival is recognised by its own event id and repeats harmlessly.
    const arrivedHere=actors.every(w=>w.location===a.to&&!w.journey&&w.activityId===id);
    if(!arrivedHere&&actors.some(w=>w.location!=='streamliner'||w.journey?.departureEventId!==a.departureEventId||w.journey.arrivesAt!==now)) throw new Error('Arrival without matching journey');
    if(a.to==='sanctuary'&&!canEnterSanctuary(state,now,actors.map(w=>w.id),a.invitationKey)) throw new Error('Sanctuary admission denied');
    if(a.to==='onari_village'&&!canEnterOnariVillage(state,now,actors.map(w=>w.id),a.accessFactKey||a.reasonKey)) throw new Error('Onari village admission denied');
    for(const who of actors) {setActor(who,'location',a.to);setActor(who,'journey',null);activity(who,'unhurried_time',null,defaultArea(a.to,now));}
    event.location=a.to;event.causedBy.push(a.departureEventId);
    event.payload={...event.payload,to:a.to,from:a.from};
    publish(a.to==='sanctuary'?'Goaden and Ashai entered the Sanctuary using their guest invitation.':
      a.to==='mi6'?homewardLine('arrived',seed,`${a.day}/${a.id}`):
      a.to==='onari_village'?`Goaden and Ashai arrived at ${placePhrase('onari_village', null)}.`:
      `Goaden and Ashai arrived at ${CITY_LOCATIONS[a.to].name}.`);
  } else if(a.type==='CITY_ACTIVITY_BEGIN') {
    const venue=CITY_LOCATIONS[a.location], plan=CITY_ACTIVITY[a.kind], r=agreement();
    if(!venue||!plan) throw new Error('Unknown city venue or activity');
    if(!validAgreement()||r.activity!==a.kind||actors.some(w=>w.location!==a.location||w.journey)) skip('No agreed party at the venue');
    else {
      if(r.status==='accepted') update('arrangements',a.arrangementKey,{...r,status:'started',startedEventId:id});
      for(const who of actors) activity(who,plan.label,a.duration,'venue');
      event.location=a.location;event.participants=actors.map(w=>w.id);
      event.payload={...event.payload,label:plan.label,kind:a.kind};
      publish(plan.text);
      if(a.location==='enchanted_ink') followups.push(...inkVisitActions({state,day:a.day,now,
        parentActionId:a.id,arrangementKey:a.arrangementKey,
        returnMinutes:CITY_LOCATIONS.enchanted_ink.travelMinutes+(state.factions.streamliner==='minor_delays'?10:0),seed}));
      if(a.location==='enchanted_ink') followups.push(...issueThreadActions(storyContext(),
        threadVisitActions({state,day:a.day,now,parentActionId:a.id,parentEventId:id,seed})));
    }
  } else if(a.type==='OUTING_CUT_SHORT') {
    if(actors.some(w=>w.location!==a.location||w.journey)) skip('Nobody at the venue to recall');
    else {
      // The interrupted visit is the known cause of tomorrow's return.
      const fact=createFact(a.factKey,'unfinished_visit','both',{location:a.location,kind:a.kind},a.validUntil);
      event.payload={...event.payload,reason:a.reason};
      for(const who of actors) {learn(who,fact,'received_advisory');activity(who,'unhurried_time',null,'venue');}
      // The world reaching in and taking an afternoon off them is the one thing
      // at this checkpoint that leaves a mark. Two steps, so a quiet day walks it
      // down without erasing it, and a bad run holds it up.
      for(const r of state.relationships)
        relation(r.from,r.to,'concern',raiseTo('concern',pair(r.from,r.to).concern,2));
      event.location=a.location;event.participants=actors.map(w=>w.id);
      publish(a.reason==='mi6_recall'?"An MI6 recall cut Goaden and Ashai's outing short."
        :"Holy Order activity nearby cut Goaden and Ashai's visit short.");
    }
  } else if(a.type==='DIRECTOR_TICK') {
    // The director's entire turn. It reads committed state, applies the two
    // thresholds and either stages one authored beat or records why it did not.
    // A tick is always private: the world does not tell anybody it was checked.
    event.participants=[];event.location='mi6';
    const context=tickContext({state,now,day:a.day,weather:state.weather,factions:state.factions});
    const key=`${a.day}/${a.tick}`, decision=directorDecision(context,seed,key);
    event.payload={outcome:decision.family?'staged':'quiet',reason:decision.reason,family:decision.family??null,
      quietMinutes:decision.quiet??null,tension:decision.tension??null};
    if(decision.family) {
      // Beats are checked against the same window rules a day's own plan is,
      // before any of them is queued. A beat that could not legally run is a
      // bug in the repertoire and fails here rather than at its due time.
      followups.push(...assertScheduleWindows(beatActions(decision.family,context,seed,key)));
      setDirector({lastBeatAt:now,beatsToday:(state.director.beatsToday??0)+1,
        recent:[decision.family,...(state.director.recent??[])].slice(0,DIRECTOR_RULES.memory),
        // An awkward encounter is the one beat that colours the rest of the
        // day: the evening scene can see that they passed somebody.
        colour:decision.family==='awkward_encounter'?'sidelong':state.director.colour});
    }
  } else if(a.type==='UNEASE') {
    const context=pressureContext(a,state);
    event.location=context.location;event.area=context.area;
    if(context.reason) skip(context.reason);
    else {
      // No participants, deliberately — and it is the existing rule rather than
      // a new one. An institution notice has none either, because "a bulletin
      // has no participants, so it can never make a day look busy". Unease is
      // the same shape: a lintel sitting outside a window is unsettling
      // scenery, not the world doing something *to* them. Attributing it to the
      // pair reset the director's quiet clock roughly once a day and quietly
      // strangled the beat repertoire — weather disruption went to zero.
      event.participants=[];
      event.payload={kind:a.kind,severity:'unease'};
      setPressure({recent:[a.kind,...(state.pressure?.recent??[])].slice(0,8)});
      publish(a.text);
    }
  } else if(a.type==='INCIDENT') {
    // Something happened to them. The severity decides what it costs, and the
    // ceiling on that is bounded in one place: an incident may take an evening,
    // a night's sleep or a plan, and may leave them shaken. It may not injure
    // anybody. Future story resolutions need their own committed effects.
    const context=pressureContext(a,state), cost=CONSEQUENCE[a.severity];
    if(!a.factKey||!Number.isFinite(a.validUntil)||a.validUntil<=now)
      throw new Error('Incident requires a valid fact lifetime');
    if(a.aftermath!==cost.aftermath) throw new Error('Incident aftermath differs from authored cost');
    const existing=state.facts[a.factKey];
    if(existing&&existing.sourceEventId!==id) throw new Error('Conflicting incident fact');
    const caught=context.participants.map(who=>state.characters[who]);
    if(existing) skip('Incident already committed');
    else if(context.reason) skip(context.reason);
    else {
      event.location=context.location;event.area=context.area;
      const fact=createFact(a.factKey,'incident',caught.length===2?'both':caught[0].id,
        {severity:a.severity,kind:a.kind},a.validUntil);
      for(const who of caught) {
        learn(who,fact,'lived_through');
        if(cost.interrupts) {
          activity(who,'unhurried_time',null,who.area);
          setActor(who,'publicNext',null);
        }
        if(a.severity==='critical'||a.severity==='high')
          setActor(who,'conditions',[{kind:'shaken',since:now,until:a.validUntil,sourceEventId:id}]);
      }
      // Worry is what an incident leaves behind, and it is a floor rather than
      // a step for the same reason every other pressure in this world is.
      if(cost.concern) for(const r of state.relationships.filter(r=>context.participants.includes(r.from)))
        relation(r.from,r.to,'concern',raiseTo('concern',pair(r.from,r.to).concern,cost.concern));
      event.participants=caught.map(w=>w.id);
      event.payload={kind:a.kind,severity:a.severity};
      // This is what makes momentum real: a night like this leaves the world
      // readable as strange for days afterwards. A floor rather than a sum, so
      // it is idempotent under replay and a quiet week still walks it down.
      setPressure({carried:Math.max(state.pressure?.carried??0,PRESSURE_RULES.incidentFloor[a.severity]??0),
        incidentsToday:Math.min(PRESSURE_RULES.maxIncidentsPerDay,(state.pressure?.incidentsToday??0)+1),
        lastIncidentAt:now,
        recent:[a.kind,...(state.pressure?.recent??[])].slice(0,6)});
      // The morning after belongs to the next day, and only exists because
      // this happened — so the incident schedules it rather than the calendar.
      // Staggered off the incident's own hour, so two bad nights do not produce
      // two lines on the same minute of the same morning.
      const wake=`08:${String(20+(new Date(now).getUTCMinutes()%4)*7).padStart(2,'0')}`;
      if(a.aftermath) followups.push({id:`${a.id}/aftermath`,day:nextLondonDay(a.day),
        dueAt:atLondon(nextLondonDay(a.day),wake),priority:35,type:'AFTERMATH',
        actors:caught.map(w=>w.id),kind:a.kind,factKey:a.factKey,text:aftermathFor(a.kind)});
      publish(a.text);
    }
  } else if(a.type==='AFTERMATH') {
    // The morning after, as a line rather than a mechanic. It needs the thing
    // it follows to still be remembered, so an incident nobody carries has no
    // aftermath — the same rule every other cross-day thread here runs under.
    if(!actors.some(w=>useMemory(w,a.factKey))) skip('Nothing carried over');
    else {event.participants=actors.map(w=>w.id);event.payload={kind:a.kind};publish(a.text);}
  } else if(a.type==='VENUE_SCENE') {
    // The hour they are actually there for. Structurally a CONVERSATION with a
    // venue attached: the lines are the event, nothing moves, and which scene
    // plays is chosen from where they are and who else is about — never
    // authored into the day, so the same outing is not the same hour twice.
    const venue=a.venue;
    if(actors.length!==2||!['goaden','ashai'].every(who=>actors.some(w=>w.id===who))
      ||actors.some(w=>w.location!==venue||w.journey||w.activity==='sleeping')) skip('They are not at the venue');
    else if(actors.some(w=>w.activity===INK_ACTIVITY)) skip('The appointment has its own scene');
    else {
      const result=state.storyEffects.ink.result;
      const knownBy=result?['goaden','ashai'].filter(who=>knowsFact(state.characters[who],result.factKey,now)):[];
      const scene=selectVenueScene({venue,available:['goaden','ashai',...(a.guests??[]).filter(who=>
        castAvailable(who,{location:venue,area:'venue'}))],
        seed,key:`${a.day}/${a.id}`,inkContext:{completed:Boolean(result&&result.completedAt<=now),knownBy},
        usage:state.director.venueScenes??{}});
      if(!scene) skip('Nothing written for this venue');
      else {
        event.location=venue;event.area='venue';
        event.participants=['goaden','ashai'];
        event.payload={mood:scene.mood,lines:scene.lines,venue,cast:scene.cast,sceneId:scene.id??null};
        setDirector({venueScenes:{...(state.director.venueScenes??{}),
          [scene.id]:(state.director.venueScenes?.[scene.id]??0)+1}});
        if(scene.id==='ink_emily_prowler'||scene.id==='ink_prowler_remembered') {
          for(const who of ['goaden','ashai']) useMemory(state.characters[who],result.factKey);
        }
        publish(scene.summary);
      }
    }
  } else if(a.type==='LEGION_VISIT') {
    // The old crew, round for an hour. Structurally this is a CONVERSATION with
    // a bigger cast: the lines are the event, no state moves, and which scene
    // plays is decided here from who actually turned up rather than authored
    // into the day. Nobody learns anything and nothing is settled — the same
    // guarantee the pair's own evening scene has carried since v10.
    if(!present()) skip('Nobody in to receive them');
    else if(!(a.visitors??[]).some(who=>LEGION_IDS.includes(who)&&castAvailable(who,{location:actor.location,area:actor.area}))) skip('Their visitors have another commitment');
    else {
      const invited=(a.visitors??[]).filter(who=>LEGION_IDS.includes(who)&&castAvailable(who,{location:actor.location,area:actor.area}));
      if(!invited.length) throw new Error('A Legion visit needs somebody from the Legion');
      const scene=selectLegionScene({available:invited,seed,key:`${a.day}/${a.id}`,
        weatherCode:state.weather?.code,atSanctuary:actor.location==='sanctuary'});
      if(!scene) skip('The available visitors do not have a scene together');
      else {
        event.participants=['goaden','ashai'];
        event.payload={mood:scene.mood,lines:scene.lines,visitors:scene.cast};
        publish(summariseLegion(scene.mood));
      }
    }
  } else if(a.type==='SIDE_PRESENCE') {
    const colleague=SIDE_CHARACTERS[a.who];
    if(!colleague) throw new Error('Unknown side character');
    // A colleague is observed, never met. There is no encounter to hold, no
    // exchange, and nothing either of them can come away knowing — so this
    // needs only that the pair are here and awake to have seen it.
    if(!castAvailable(a.who,{location:'mi6',area:a.area})) skip('Colleague occupied by an existing commitment');
    else if(actors.some(w=>w.location!=='mi6'||w.journey||w.activity==='sleeping')) skip('Nobody here to notice');
    else {event.participants=actors.map(w=>w.id);event.payload={who:a.who,area:a.area};
      publish(colleague.lines[a.line%colleague.lines.length]);
      if (a.who === 'davis' && a.area === 'corridors' && !hasDavisBetrayal(state, now) && hasDavisWarmthPrerequisite(state)) {
        followups.push({
          id: `${a.id}/betrayal-discovery`,
          day: a.day,
          dueAt: now + 2 * MIN,
          priority: 15,
          type: 'DAVIS_BETRAYAL_DISCOVERY',
          actors: ['ashai'],
          area: 'corridors',
        });
      }
    }
  } else if(a.type==='DAVIS_BETRAYAL_DISCOVERY') {
    const ashai = state.characters.ashai;
    if (hasDavisBetrayal(state, now)) {
      skip('Betrayal already discovered');
    } else if (!hasDavisWarmthPrerequisite(state)) {
      skip('Warmth prerequisite not established');
    } else if (ashai.location !== 'mi6' || ashai.journey || ashai.activity === 'sleeping') {
      skip('Ashai not available in MI6 corridors');
    } else if (!castAvailable('davis', { location: 'mi6', area: 'corridors' })) {
      skip('Davis not available');
    } else {
      const fact = createFact('canon.davis_betrayal_overheard', 'davis_betrayal', 'davis', {
        description: 'Ashai overheard Agent Davis mocking her and her charm in the MI6 corridors.',
        overheardAt: now,
      });
      learn(ashai, fact, 'overheard');
      setActor(ashai, 'area', 'corridors');
      event.location = 'mi6';
      event.area = 'corridors';
      event.participants = ['ashai'];
      event.payload = {
        who: 'davis',
        spokenTo: 'another_agent',
        overheard: true,
        counselBy: 'greah',
        lines: [
          { who: 'davis', expression: 'dismissive', text: 'Ashai? She’s not cut out for this. Too naïve, too... emotional. And that charm she gave me? Please, as if such trinkets could influence fate.' },
          { who: 'greah', expression: 'cautious', text: 'Let it go, hun. People like Davis thrive on this. Best not to make enemies in MI6.' }
        ]
      };
      publish('In the MI6 corridor, Ashai overheard Agent Davis speaking to another agent: "Ashai? She’s not cut out for this. Too naïve, too... emotional. And that charm she gave me? Please, as if such trinkets could influence fate." Greah cautioned Ashai: "Let it go, hun. People like Davis thrive on this. Best not to make enemies in MI6."');
      event.register = 'prose';
      event.prose = 'Pausing outside the corridor junction, Ashai stopped in the dim wash of the fluorescent strip. Concealed in the shadows, she caught Davis speaking to another agent around the turn, her words dripping with scorn: “Ashai? She’s not cut out for this. Too naïve, too... emotional. And that charm she gave me? Please, as if such trinkets could influence fate.” Ashai’s hands clenched into fists, but before she could step forward to confront Davis, Greah caught her shoulder, murmuring low and cautious: “Let it go, hun. People like Davis thrive on this. Don’t give her the satisfaction... Best not to make enemies in MI6.” Ashai held back, her jaw set with cold clarity.';
    }
  } else if(a.type==='MINOR_ANOMALY') {
    // Scenery, and strictly scenery. It creates no fact, teaches nobody
    // anything and leaves no memory, so nothing downstream can ever come to
    // depend on having seen it. That is what keeps it on the right side of the
    // review's line about magical anomalies: it is a thing noticed in passing,
    // never a hook, a duty or a mystery anybody is now carrying.
    if(actor.journey||actor.activity==='sleeping') skip('Not in a position to notice anything');
    else {event.participants=[actor.id];event.payload={kind:a.kind};publish(anomalyText(a.kind));}
  } else if(a.type==='WEATHER_DISRUPTION') {
    // A consequence rather than a bulletin. The yard is the only outdoor room
    // in the building, so whoever is standing in it stops what they are doing.
    const outdoors=Object.values(state.characters).filter(w=>!w.journey&&areaOf(w.location,w.area)?.indoors===false);
    for(const who of outdoors) activity(who,'unhurried_time',null,defaultArea(who.location,now));
    event.participants=outdoors.map(w=>w.id);event.payload={kind:a.kind,stopped:outdoors.map(w=>w.id)};
    publish(disruptionText(a.kind));
  }
  // Which voice this moment gets. A property of the type rather than a
  // judgement per event, so an ordinary meal can never become a set piece and a
  // confrontation can never be reduced to a ticker line.
  event.register=event.register??registerFor(a.type);
  if(event.visibility==='public'&&event.register==='prose') {
    const written=proseFor(event,{seed,key:`${a.day}/${a.id}`});
    if(written&&written!==event.publicDescription) event.prose=written;
  }
  // What the director means by the world having done something to them, and it
  // is narrower than "an event happened". Two things reset the quiet clock: a
  // shared event, because anything with both of them in it is the pair having a
  // life together; and one of the handful of solo events below, which are the
  // world reaching in — duty, a callout, an invitation, a thing seen.
  //
  // A solo routine is deliberately not on either list. Ashai watching
  // television is not the world being eventful at her, and counting it was the
  // single thing most wrong with the first cut of this: the routine publishes
  // twenty-six events a day, so the clock never ran past ninety minutes, the
  // director sat out thirty-one days in a row, and the whole repertoire barely
  // appeared. An afternoon where the two of them each potter about separately
  // is not a busy afternoon — it is exactly the flat one a catalyst is for.
  //
  // An institutional notice is excluded by construction rather than by a list:
  // a bulletin has no participants, so it can never make a day look busy.
  // The room this happened in, recorded on the event rather than left to be
  // guessed later from where somebody happens to be standing now. A reader of
  // the ledger a week later has no other way to know it.
  //
  // Which side of the transition to take depends on what the event is. Starting
  // something puts you in the room it happens in, so the room after is the
  // right one. Finishing something puts you back in the lunch hall, so the room
  // after is the wrong one — it produced "Ashai finished training in the lunch
  // hall", which is where she went, not where she trained.
  const ENDS=a.type==='ACTIVITY_COMPLETE'||a.type==='PRACTICE_END';
  if(!['UNEASE','INCIDENT',...THREAD_EVENT_TYPES,...INTENT_EVENT_TYPES,...AGENDA_EVENT_TYPES,...MEU_EVENT_TYPES,...LEGION_JOB_EVENT_TYPES,...DUSKKIN_COMPLIANCE_EVENT_TYPES,...LIVING_PLACES_EVENT_TYPES,...ABILITY_EVENT_TYPES,...SUPPORTING_EVENT_TYPES,...NIGHT_EVENT_TYPES,...OFFSCREEN_EVENT_TYPES,...SCENE_BANK_EVENT_TYPES,...ARC_EVENT_TYPES].includes(a.type))
    event.area=(ENDS?areaBefore:state.characters[event.participants[0]]?.area)??areaBefore??null;
  // Authored prose is not the world being eventful at them either. A scene the
  // bank staged put words on the page, not an incident in the room; counting it
  // let a richer bank quietly starve every director family of the quiet it
  // waits for. The two keep separate clocks and share only a short spacing
  // window, held in DIRECTOR_RULES.
  const notable=event.visibility==='public'&&a.type!=='DIRECTOR_TICK'&&!SCENE_BANK_EVENT_TYPES.includes(a.type)
    &&(event.participants.length>=2||NOTABLE_ALONE.has(a.type));
  if(notable) setDirector({lastNotableAt:Math.max(state.director?.lastNotableAt??0,now)});
  // Sharing an already completed result is a separate, causal action. Merely
  // rendering or selecting a scene never teaches Ashai what she has not learned.
  if(event.visibility==='public'&&['CROSS_PATHS','VENUE_SCENE'].includes(a.type)
    &&state.storyEffects.ink.result&&!knowsFact(state.characters.ashai,state.storyEffects.ink.result.factKey,now)) {
    followups.push({id:`${a.id}/ink-result-noticed`,day:a.day,dueAt:now+1,priority:49,
      type:'INK_RESULT_NOTICED',actors:['goaden','ashai']});
  }
  if(event.visibility==='public'&&['CROSS_PATHS','TRAVEL_ARRIVE',
    'ACTIVITY_COMPLETE',...INK_EVENT_TYPES].includes(a.type)) {
    followups.push(...issueThreadActions(storyContext(),
      threadEncounterActions({state,day:a.day,now,parentActionId:a.id,eventType:a.type})));
  }
  if(event.visibility==='public'&&a.type==='CROSS_PATHS')
    followups.push(...issueIntentActions(storyContext(),intentEncounterActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id})));
  if(event.visibility==='public'&&['BRIEFING_BEGIN','STANDBY_BEGIN','COMMS_CHECK_BEGIN','ACTIVITY_COMPLETE'].includes(a.type)) {
    followups.push(...issueAgendaActions(storyContext(),agendaReportActions({state,day:a.day,now,parentActionId:a.id})));
  }
  if(isMeuActive(state)&&event.visibility==='public'&&['BRIEFING_BEGIN','STANDBY_BEGIN','COMMS_CHECK_BEGIN'].includes(a.type)) {
    followups.push(...issueMeuCaseActions(storyContext(),meuReportActions({state,day:a.day,now,parentActionId:a.id})));
  }
  if(isMeuActive(state)&&['INCIDENT','ARCANE_SURGE'].includes(a.type)) {
    followups.push(...issueMeuCaseActions(storyContext(),meuCaseOpportunityActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id,sourceEvent:event})));
  }
  if(isLegionJobsActive(state)&&a.type==='MEU_CASE_RESOLVE') {
    followups.push(...issueLegionJobActions(storyContext(),mi6LegionReferralActions({state,day:a.day,now,parentActionId:a.id,parentEventId:id,sourceEvent:event})));
  }
  if(isLegionJobsActive(state)&&a.type==='MI6_LEGION_REFERRAL') {
    followups.push(...issueLegionJobActions(storyContext(),legionJobOpportunityActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id,sourceEvent:event})));
  }
  if(isLegionJobsActive(state)&&event.visibility==='public'&&['BRIEFING_BEGIN','STANDBY_BEGIN','COMMS_CHECK_BEGIN'].includes(a.type)) {
    followups.push(...issueLegionJobActions(storyContext(),legionHandoffReadActions({state,day:a.day,now,parentActionId:a.id})));
  }
  if(isDuskkinActive(state)&&isQualifyingDuskkinSource(event)) {
    followups.push(...issueDuskkinComplianceActions(storyContext(),duskkinOpportunityActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id,sourceEvent:event})));
  }
  if(isLivingPlacesActive(state)&&isQualifyingEcologicalSource(event)) {
    followups.push(...issueLivingPlacesActions(storyContext(),siteOpportunityActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id,sourceEvent:event})));
  }
  outingRecoveryAfterAction(storyContext());
  if(event.visibility==='public'&&['CROSS_PATHS','TRAVEL_ARRIVE','CITY_ACTIVITY_BEGIN','ACTIVITY_COMPLETE','PRACTICE_END'].includes(a.type))
    followups.push(...issueSupportingActions(storyContext(),supportingEncounterActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id,canUseActor:storyContext().ops.actorAvailable})));
  if(event.visibility==='public'&&a.type==='CROSS_PATHS')
    followups.push(...issueNightActions(storyContext(),nightEncounterActions({state,day:a.day,now,seed,parentActionId:a.id,parentEventId:id})));
  if(event.visibility==='public'&&['SUPPORTING_ENCOUNTER','SUPPORTING_OUTCOME','VENUE_SCENE','LEGION_VISIT','SCENE_BANK_BEAT'].includes(a.type))
    followups.push(...issueOffscreenActions(storyContext(),offscreenEncounterActions({state,now,parentActionId:a.id,parentEventId:id,
      cast:[...(event.payload.cast??[]),...(event.payload.visitors??[]),...(event.payload.who?[event.payload.who]:[])],participants:event.participants,location:event.location,area:event.area,
      sourceType:event.type,sourcePayload:event.payload,
      sourceDuration:a.type==='SCENE_BANK_BEAT'?SCENE_BANK_RULES.sceneDuration:undefined})));
  if(event.visibility==='public') noteSupportingAppearance(storyContext(),[...(event.payload.cast??[]),...(event.payload.visitors??[]),...(event.payload.who?[event.payload.who]:[])]);
  if(event.visibility==='public') noteOffscreenPresence(storyContext());
  recordNightCause(storyContext());
  // The version marks the prospective physical-rules cutover. Turning off
  // narrative weighting cannot turn environmental causes on or off.
  if(state.narrativeSignals?.version===1 && state.narrativeSignals.activatedAt<=now) {
    habitatAfterAction(storyContext());
    livingPlacesAfterAction(storyContext());
  }
  // Rejected actions and private no-ops have no bookkeeping effects either.
  // Defer all signal writes until the authoritative resolver has succeeded;
  // an exception must not leave an advanced motif clock in its input state.
  const narrativeStep=event.payload?.outcome!=='skipped' && !event.payload?.skipped
    && (event.visibility==='public' || changes.length>0);
  if(narrativeSignalsActive(state) && narrativeStep) {
    if(!runtimeContext.disableNarrativeSignals) {
      let signals=advanceMorphos(state.narrativeSignals,now);
      if(csvEvaluation) signals={...signals,csv:{lastEvaluatedAt:now,lastEvaluation:csvEvaluation}};
      setStory('narrativeSignals',commitMorphos(signals,state,event,a));
      if(event.visibility==='public' && event.type!=='CONVERSATION') {
        const selection=narrativeSelectionSnapshot(state,event);
        if(selection) event.payload.narrativeSelection=selection;
      }
    }
  }
  // RHYTHM bookkeeping, on the same footing: only after the authoritative
  // resolver succeeded, and never for a refused action. A completed routine
  // moves needs, history and (for a free slot) habit; a fact learned in this
  // very event by this very actor may leave a trace. The world knowing that
  // something happened is not enough — the character has to know it.
  if(rhythmActive(state,now) && event.payload?.outcome!=='skipped' && !event.payload?.skipped) {
    let rhythm=state.rhythm;
    if(rhythmCompletion) rhythm=commitCompletion(rhythm,state,{...rhythmCompletion,now});
    if(event.type==='INTENT_COMPLETE'&&event.payload?.activity) {
      const label={game:'gaming',practice:'training',quiet:'quiet_break'}[event.payload.activity];
      const session=state.intent.instances[event.payload.intentId];
      if(session?.status==='completed') for(const who of session.party) if(label)
        rhythm=commitCompletion(rhythm,state,{who,label,minutes:(session.endAt-session.startAt)/MIN,family:null,shared:true,now});
    }
    rhythm=commitTraces(rhythm,state,event,now);
    if(rhythm!==state.rhythm) setStory('rhythm',rhythm);
  }
  sceneBankAfterAction(storyContext());
  event.causedBy=[...new Set(event.causedBy)].filter(c=>typeof c==='string'&&c.length>0&&c!==id);
  // A refused forged/repeated action may carry an old timestamp. It does not
  // establish the current clock and must remain a state-preserving no-op.
  assertCanonState(state,event.payload?.outcome==='skipped'||event.payload?.skipped?undefined:now);
  return {event,followups};
}

// Presentation keys, not files. The site picks an asset from the location's mode
// and falls back to the dry key when it has no wet variant for a scene.
const SCENE_ASSETS = Object.freeze({
  'mi6:day_watch':'mi6_day','mi6:night_shift':'mi6_night',
  'sanctuary:sacred_quiet':'sanctuary_day','sanctuary:public_attraction':'sanctuary_day',
  'sanctuary:evening_transition':'sanctuary_evening','sanctuary:nightlife':'sanctuary_nightclub','sanctuary:closed_reset':'sanctuary_closed',
  'streamliner:frequent_service':'streamliner_day','streamliner:reduced_service':'streamliner_night','streamliner:sparse_service':'streamliner_night',
  'enchanted_ink:open':'enchanted_ink_day','enchanted_ink:shuttered':'enchanted_ink_night',
  'legion_hideout:rehearsal':'legion_hideout_day','legion_hideout:dark':'legion_hideout_night',
  'cafe:open':'cafe_day','cafe:last_orders':'cafe_evening','cafe:closed':'cafe_closed',
  'big_ben_plaza:open_air':'big_ben_plaza_day','big_ben_plaza:quiet_streets':'big_ben_plaza_night',
  'onari_village:daylight':'onari_village','onari_village:dusk':'onari_village','onari_village:quiet_night':'onari_village',
});
// "Ashai noticed a few lintels floating above magic-infused buildings, feeding
// off ambient energies." A quiet day has one or two drifting over; a day the MEU
// is flagging draws a crowd of them in.
const LINTELS_BY_ARCANE = Object.freeze({low:1,moderate:2,high:4});
// The same address reads differently depending on the mode it is running.
const MODE_STATUS = Object.freeze({
  'mi6:day_watch':'Ordinary life at MI6','mi6:night_shift':'A night watch at MI6',
  'sanctuary:sacred_quiet':'A sacred morning at Sanctuary','sanctuary:public_attraction':'An invited visit to Sanctuary',
  'sanctuary:evening_transition':'An evening visit to Sanctuary','sanctuary:nightlife':'Sanctuary has opened for the evening',
  'sanctuary:closed_reset':'Sanctuary is closed until morning',
  'streamliner:frequent_service':'A journey on the Streamliner','streamliner:reduced_service':'A late journey on the Streamliner',
  'streamliner:sparse_service':'A night journey on the Streamliner',
  'enchanted_ink:open':'An outing to Enchanted Ink','enchanted_ink:shuttered':'A quiet street outside Enchanted Ink',
  'cafe:open':'A visit to the Silver Spoon Cafe','cafe:last_orders':'A late table at the Silver Spoon Cafe',
  'cafe:closed':'The Silver Spoon Cafe, closed',
  'big_ben_plaza:open_air':'A walk beneath New Big Ben','big_ben_plaza:quiet_streets':'The plaza after dark',
  'onari_village:daylight':'A daylight hour in the Onari village','onari_village:dusk':'Dusk in the Onari village',
  'onari_village:quiet_night':'A quiet night in the Onari village',
});

// What a viewer may know about the hours ahead. An ordinary personal routine is
// published the moment it happens, so naming it in advance discloses nothing
// that waiting would not. Everything carrying a private reason is absent by
// omission from this map: offers, tellings, deferrals, disagreements, plan
// changes, invitations, pauses and recalls have no label and can never be
// listed. Completion follow-ups are excluded too — the finish of an activity is
// already carried by its own end time.
const UPCOMING_LABELS = Object.freeze({
  PRACTICE_BEGIN:'Training', MEAL_BEGIN:'A meal', PIANO_BEGIN:'Time at the piano',
  MUSIC_LISTEN_BEGIN:'Listening to music', TV_BEGIN:'Television', QUIET_TIME_BEGIN:'A quiet break',
  GAME_BEGIN:'A game', GAME_RESUME:'Finishing a game', REST_BEGIN:'Turning in for the night',
  BRIEFING_BEGIN:'An inner circle briefing', STANDBY_BEGIN:'On call', WAIT_BEGIN:'Waiting',
  COMMS_CHECK_BEGIN:'A comms check',
});
const UPCOMING_HOURS = 8, UPCOMING_LIMIT = 4;
// A character's own next few hours, under two gates. A shared plan appears only
// once its arrangement has been publicly announced, so an outing the pair have
// agreed but not announced stays private exactly as its announcement rule says.
// A plan-keyed optional activity is never listed: an earlier private decision
// may replace it, and a viewer watching it vanish would learn that a decision
// was made. The queue is read in due order, so these are the soonest few.
function upcomingFor(snapshot, actorId, now) {
  const horizon = now + UPCOMING_HOURS * 60 * MIN, seen = new Set(), items = [];
  for(const action of snapshot.pendingActions ?? []) {
    if(action.dueAt<=now||action.dueAt>horizon) continue;
    const party = action.actors ?? (action.actor?[action.actor]:[]);
    if(!party.includes(actorId)||action.planKey||action.rhythm) continue;
    if(!nightStoryAvailable(snapshot,actorId,{atMs:action.dueAt})) continue;
    let description;
    if(action.arrangementKey) {
      // Announced, and not yet underway: once it starts, the current activity
      // carries it and its remaining legs are no longer something to come.
      const arrangement = snapshot.arrangements?.[action.arrangementKey];
      if(!arrangement?.public||arrangement.status!=='accepted'||seen.has(action.arrangementKey)) continue;
      seen.add(action.arrangementKey);
      description = (ARRANGEMENT_TEXT[arrangement.textKey||arrangement.activity]||DEFAULT_ARRANGEMENT_TEXT).next;
    } else description = UPCOMING_LABELS[action.type];
    if(!description) continue;
    items.push({at:action.dueAt,description});
    if(items.length>=UPCOMING_LIMIT) break;
  }
  return items;
}

export function publicProjection(snapshot) {
  // Continuity, derived on read. Nothing in here is stored, and it is built
  // from the semantic snapshot rather than from the forty events the feed
  // carries — a memory addressable for a month cannot be derived from a day.
  const narrative=publicNarrativeBlock(snapshot,snapshot.world.resolvedThrough);
  const people=Object.values(snapshot.characters),now=snapshot.world.resolvedThrough;
  const places=people.map(p=>p.location);
  // Wherever the pair are, the scene is described by that place's current mode.
  const focus=places.find(place=>place!=='mi6')??'mi6', mode=locationMode(focus,now);
  const sun=sunEvents(londonDate(now)), asset=SCENE_ASSETS[`${focus}:${mode}`]??'mi6_day';
  const wet=RAINY.has(snapshot.weather?.code);
  const inkResult=snapshot.storyEffects?.ink?.result;
  return {worldId:snapshot.world.id,resolvedThrough:now,narrative,
    continuityId:createHash('sha256').update(`${snapshot.world.id}|${snapshot.world.seed}|${snapshot.meta.startMs}`).digest('hex').slice(0,24),
    stories:[...publicThreadSummaries(snapshot,now),...publicSupportingSummaries(snapshot,now),...publicNightStories(snapshot,now),...publicOffscreenSummaries(snapshot,now)]
      .sort((a,b)=>(!['active','unfinished'].includes(a.status))-(!['active','unfinished'].includes(b.status))
        ||(b.completedAt??b.openedAt)-(a.completedAt??a.openedAt)||a.id.localeCompare(b.id)),
    intentions:publicIntentSummaries(snapshot,now),operations:publicAgendaSummaries(snapshot,now),
    placeConditions:snapshot.abilities?.trainingGround.status==='restricted'
      ?[{location:'mi6',room:'the training grounds',description:'The outdoor training grounds remain closed pending a completed safety check.'}]:[],
    storyResults:inkResult&&inkResult.completedAt<=now?[{kind:'cosmetic_tattoo',owner:'goaden',design:'prowler',
      completedAt:inkResult.completedAt,eventId:inkResult.sourceEventId,
      description:'A completed moving prowler design from Enchanted Ink.'}]:[],
    weather:{
      code:snapshot.weather.code||'cloudy',
      description:snapshot.weather.description,
      temperatureC:snapshot.weather.temperatureC,
      simulated:snapshot.weather?.external ? false : Boolean(snapshot.weather?.simulated ?? true),
      ...(snapshot.weather?.precipitationMm !== undefined ? {precipitationMm: snapshot.weather.precipitationMm} : {}),
      ...(snapshot.weather?.windSpeedKph !== undefined ? {windSpeedKph: snapshot.weather.windSpeedKph} : {}),
      ...(snapshot.weather?.observedAt ? {observedAt: Math.min(snapshot.weather.observedAt, now)} : {}),
    },
    // Daylight comes from the real London sun, never from the weather.
    time:{daypart:daypart(now),dayPhase:dayPhase(now),daylight:daylightFraction(now),
      dawn:sun.dawn,sunrise:sun.sunrise,sunset:sun.sunset,dusk:sun.dusk},
    scene:{location:focus,mode,backgroundKey:wet?`${asset}_rain`:asset,fallbackKey:asset},
    // Lintels are drawn to ambient magical energy and feed off magic-infused
    // buildings, so how many are overhead is the visible form of the MEU reading
    // the factions card states as a word. The page draws them; the count is the
    // world's, and the arcane level is its only input.
    sky:{lintels:LINTELS_BY_ARCANE[snapshot.factions?.arcane]??1},
    // The season the world is leaning toward. The date is real and the countdown
    // is real; the festival itself belongs to the book.
    veil:(()=>{const v=nextVeil(now,snapshot.world.seed);
      return {date:v.date,daysAway:v.daysAway,phase:v.phase};})(),
    factions:Object.fromEntries(Object.keys(FACTION_LEVELS)
      .map(faction=>[faction,agendaFactionOverrides(snapshot,now)[faction]??snapshot.factions?.[faction]??FACTION_LEVELS[faction][0]])),
    worldStatus:people.every(p=>p.activity==='sleeping')&&focus==='mi6'?'A quiet night at MI6'
      :MODE_STATUS[`${focus}:${mode}`]??'Ordinary life at MI6',
    // The scheduled end of an already-public activity, so the page can show it
    // running rather than restating a label. For a journey this is the arrival.
    // It carries a duration and nothing else: no reason, memory or plan.
    characters:people.map(p=>({id:p.id,name:p.displayName,location:p.location,activity:p.activity,
      // The room, by the name the manuscript gives it. This is the same class
      // of fact the activity already is — "playing piano at MI6" has always
      // meant the music room — so naming it discloses nothing new. The private
      // side of a room, which is why anybody is in it, never travels with it.
      room:areaOf(p.location,p.area)?.name??null,
      activitySince:p.activitySince,activityUntil:p.activityUntil??null,upcoming:upcomingFor(snapshot,p.id,now),
      // Where a journey started and where it ends. Both are locations whose
      // departure is already published ("boarded the Streamliner on their way to
      // Sanctuary"), so this restates a public fact in a form the page can draw.
      // Nothing about why they are going travels with it.
      journey:p.journey?{from:p.journey.from,to:p.journey.to,departedAt:p.journey.departedAt,arrivesAt:p.journey.arrivesAt}:null,
      ...(p.publicNext&&p.publicNext.at>now?{nextTransition:{at:p.publicNext.at,description:p.publicNext.description}}:{})})),
    events:publicEvents(snapshot),
  };
}

// The public feed, and the one place an event is turned into something a
// reader may see. The feed asks for the last forty; the Gazette archive asks
// for a whole day, which may be weeks back. Both go through here, so a new
// consumer can never accidentally publish a private event or a raw payload.
export function publicEvents(snapshot, limit = 40) {
  const eventMap = new Map((snapshot.events ?? []).map(e => [e.id, e]));
  const lookup = id => eventMap.get(id) ?? (typeof snapshot.eventById === 'function' ? snapshot.eventById(id) : null);
  return snapshot.events.filter(e=>e.visibility==='public'&&e.publicDescription).slice(-limit)
    .map(e=>correctLegacyWakeDialogue(e, () => typeof snapshot.publicSourcesForEvent === 'function'
      ? snapshot.publicSourcesForEvent(e) : snapshot.events))
    .map(e=>editorialEvent(e, { state: snapshot })).map(e=>{
    const bridge = resolveContextBridge(e, id => {
      const source = lookup(id);
      return isPublicStoryEvent(source) && source.occurredAt <= e.occurredAt ? source : null;
    });
    return {id:e.id,occurredAt:e.occurredAt,type:e.type,
      ...(Number.isSafeInteger(e.seq) ? { narrativeOrder: e.seq } : {}),
      location:e.location,participants:[...e.participants],description:e.publicDescription,
      // Two registers. `description` is the ticker line every event has; a
      // story beat additionally carries the paragraph it deserves.
      register:e.register??'ticker',...(e.prose?{prose:e.prose}:{}),
      ...publicSceneBankPerformance(e),
      ...publicContinuity(e, lookup, bridge),
      ...(e.memoryCallback ? { memoryCallback: e.memoryCallback } : {}),
      // The room as it was at the time, which is not the same fact as the room
      // somebody is standing in now. Reading a historical event through the
      // current snapshot put every event of a day in whichever room the pair
      // happened to end it in — every meal and every training session "in the
      // quarters", because that is where they were asleep when it was read.
      room:areaOf(e.location,e.area)?.name??null,
      // A conversation carries its written lines. Each is rebuilt from three
      // named fields rather than passed through, so nothing else in the payload
      // can ride along, and the text is authored rather than generated.
      ...((e.type==='CONVERSATION'||e.type==='LEGION_VISIT'||e.type==='VENUE_SCENE'||e.type==='INK_APPOINTMENT_BOOKED'||['INTENT_RESPONSE','INTENT_RENEGOTIATE'].includes(e.type))&&Array.isArray(e.payload?.lines)
        ? {lines:e.payload.lines.map(line=>({who:line.who,expression:line.expression,text:line.text}))}
        : (Array.isArray(e.lines) ? {lines:e.lines.map(line=>({who:line.who,expression:line.expression,text:line.text}))} : {}))};
  });
}

export function createFixture({startMs}) {
  if(startMs!==atLondon(londonDate(startMs),'00:00')) throw new RangeError('World epoch must be London midnight');
  const day=londonDate(startMs);
  return {worldId:'silver-clouds-now',rulesVersion:RULES_VERSION,startMs,endMs:Date.parse('2100-01-01T00:00:00Z'),maxActions:100000,
    initialState:()=>initialState(startMs),initialActions:()=>[{id:`${day}/day`,day,dueAt:startMs+1,priority:0,type:'WEATHER_CHANGE'}],
    reduceAction,publicProjection};
}
