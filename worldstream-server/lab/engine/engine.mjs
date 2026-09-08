import { createView, addAll, add } from './facts.mjs';
import { scoreCandidates, familyOf, behaviourOf } from './score.mjs';
import { solve } from './query.mjs';
import { hash } from './rng.mjs';

// The Moment Engine's whole public surface.
//
// It reads a translated view of Worldstream state, decides what a character
// would do, and returns a semantic proposal. It commits nothing, persists
// nothing and writes no prose. Worldstream validates the proposal against its
// own rails and commits the effects through its own ledger, or refuses it.
//
// The single most important line in this file is the one that returns null.

export const MOMENT_RULES = Object.freeze({
  // Below this, the best thing available is not worth a reader's attention.
  // Calibrated in harness/tune.mjs against the control baseline, not guessed.
  interestFloor: 6,
  // How long a family of moment is suppressed for the character who last used
  // it. Emily counting things twice in one afternoon is the "same-day
  // overexposure" failure the brief names.
  familyCooldownMinutes: 6 * 60,
  // And a longer, softer memory: a family used recently is penalised rather
  // than barred, so variety is preferred without being mandatory.
  noveltyWindowMinutes: 48 * 60,
  noveltyPenalty: 4,
  // And a fatigue that never resets. The recent-window penalty above stops a
  // thing happening twice in a day; this stops it being the thing that always
  // happens. Measured: without it, one manifestation — Goaden asking about the
  // MI6 lunch queue — took eleven of twenty-five moments across thirty days,
  // because the queue recurs daily and a six-hour cooldown never bit. A cost
  // that grows with lifetime use lets a good beat happen twice and then makes
  // the world find something else, without anybody tuning a per-beat number.
  // Behavioural fatigue, retuned for the chosen-history denominator. These
  // used to count surfaced Moments (about 22 per 90 days); they now count
  // canonical actions (about 787), so the old values silenced everybody
  // immediately. The cap is what matters: a behaviour saturates its penalty and
  // stops getting worse, rather than climbing until the character is mute.
  repetitionPenalty: 0.75,
  repetitionCap: 8,
  // The recent-window nudge stays small for the same reason.
  noveltyPenaltyChosen: 1,
  // Repetition at five levels, because the author's review showed one flat
  // penalty is not enough. Fifteen of eighteen unusable moments were
  // repetition, and they were not all the same kind: a memorable line coming
  // back is a different failure from a behaviour recurring, and both differ
  // from a signature act becoming routine. Generic wording may repeat often;
  // wording a reader will remember may not repeat at the same frequency.
  lineCooldownDays: 14,            // any exact wording
  signatureLineCooldownDays: 40,   // distinctive wording — a hard block, not a penalty
  surfaceCooldownHours: 36,        // floor for a quip family; see selectLine
  spaceSurfaceByBankDepth: true,   // real gap = signature cooldown / bank depth
  // An action that permanently costs a character something is not a weekly
  // occurrence in a *feed*. Note where this sits: it is a **presentation**
  // rail, applied after the character has already chosen. Emily still uses
  // Fade as often as canon says she would — the author's ruling is that she
  // wants to perish and does casually use it — the world still records every
  // ten-year cost, and the reader is simply not shown all of them. "Would she
  // do it seven times" and "should readers see seven Fade moments" are separate
  // questions that need not share an answer.
  costlyActionSurfaceCooldownDays: 18,
  // No character produces more than this many committed moments in a day.
  dailyBudgetPerCharacter: 3,
  // Nor may the world as a whole. A day of six moments is a day of content.
  dailyBudgetWorld: 6,
  // Two moments cannot land inside this window at all.
  worldGapMinutes: 45,
});

const MIN = 60_000;

// Which authored bank a candidate reaches for. An action may defer the choice
// to one of its bound roles — a callback picks its line by *topic*, so
// referring back to a coat and referring back to a promise are different banks
// rather than the same bank used twice.
export const surfaceOf = (action, bindings) => {
  const base = action.surface ?? action.id;
  if (!action.surfaceBy) return base;
  const discriminator = bindings[action.surfaceBy];
  return discriminator === undefined ? base : `${base}:${discriminator}`;
};

/**
 * @param {object} opportunity Translated Worldstream state; see adapter.mjs.
 * @returns {{proposal: object|null, audit: object}}
 */
export function evaluateMomentOpportunity(opportunity) {
  const { now, day, location, area, presentCharacters, view, practices, cast,
    history = { byCharacter: {}, world: [] }, arcConstraints = {}, seed = '',
    rules = MOMENT_RULES, trigger = 'unspecified' } = opportunity;

  const audit = { trigger, now, location, area, considered: 0, blocked: [], rejected: [],
    suppressed: [], actors: [] };

  // Arc precedence, before anything is enumerated. A hard arc obligation is not
  // a low score; it is the engine declining to have an opinion.
  if (arcConstraints.hardObligation)
    return finish(null, { ...audit, refusal: 'arc_hard_obligation', detail: arcConstraints.reason ?? null });
  // Reader-facing budgets are NOT checked here any more, and that is the last
  // piece of the pacing split.
  //
  // They used to return before anything was enumerated, so a Moment suppressed
  // for editorial reasons meant nobody in the room chose anything at all — and
  // because the budget is consumed by *surfacing*, turning the display dial
  // changed which later opportunities were gated, which changed what characters
  // did. The split held everywhere except here, and this was enough to keep
  // Emily's canonical Fade count drifting by one across the range.
  //
  // Characters now always act. The budgets below decide only whether a reader
  // is told, and they are applied after the choice is made.

  const proposals = [];
  for (const actor of presentCharacters) {
    const grammar = cast.get(actor);
    if (!grammar) continue;
    const mine = history.byCharacter[actor] ?? [];
    // TWO HISTORIES, AND THE SPLIT IS THE WHOLE POINT.
    //
    //   `mine`  — everything the character actually did. Behavioural pacing
    //             reads this, because a character repeating themselves is a
    //             fact about them, not about what a reader was shown.
    //   `shown` — what reached the page. Presentation pacing reads this.
    //
    // Both used to read `shown`, which made the first a function of the second:
    // an unshown act left its manifestation looking fresh, so it was chosen
    // again sooner, and turning the editorial dial up bought Emily another use
    // of Fade. Dormant until bank enrichment, then live and monotonic across
    // the whole supported range — 26, 27, 28 uses as the display cooldown rose.
    // See FINDING-pacing-leak.md.
    //
    // Behavioural fatigue is retuned to match: it now counts a much denser
    // history (787 canonical actions against 22 surfaced ones), so the same
    // numbers would silence everybody. Measured before the retune: 369
    // opportunities with nothing available.
    const index = historyIndex(mine);
    const { ranked, blocked, rejected } = scoreCandidates({ view, practices, actor, grammar, seed });
    audit.considered += ranked.length;
    audit.blocked.push(...blocked.map(item => ({ actor, ...item })));
    audit.rejected.push(...rejected.map(item => ({ actor, ...item })));

    for (const candidate of ranked) {
      const family = familyOf(candidate);
      // Nothing gates a costly action here, deliberately. What a character
      // would do is a question for canon — Emily wants to perish and does
      // casually use Fade — and how often a reader is shown it is a question
      // for the presentation gate further down. An earlier version suppressed
      // costly actions at *this* point; it was removed when the split was
      // introduced, and the dead branch that survived it is gone too, because
      // reintroducing its constant would silently give Emily a survival
      // instinct she canonically does not have. Guarded by the regression test
      // "Fade frequency is a canon question, not a presentation one".
      // Behavioural: did *they* just do this? Reads everything they did.
      const seenFamily = index.family.get(family);
      const last = seenFamily?.last ?? undefined;
      if (last && now - last.at < rules.familyCooldownMinutes * MIN) {
        audit.suppressed.push({ actor, family, reason: 'cooldown',
          minutesSince: Math.round((now - last.at) / MIN) });
        continue;
      }
      const stale = Boolean(last) && now - last.at < rules.noveltyWindowMinutes * MIN;
      // Behavioural fatigue, also on the full history.
      const lifetime = seenFamily?.count ?? 0;
      const fatigue = Math.min(lifetime, rules.repetitionCap) * rules.repetitionPenalty;
      const novelty = (stale ? rules.noveltyPenaltyChosen : 0) + fatigue;
      proposals.push({ actor, candidate, family, behaviour: behaviourOf(candidate),
        score: candidate.score - novelty, novelty: -novelty, lifetime });
    }
    audit.actors.push({ actor, available: ranked.length, blocked: blocked.length, rejected: rejected.length });
  }

  if (!proposals.length) return finish(null, { ...audit, refusal: 'no_available_action' });

  // Required beats everything; then adjusted score; then a stable key.
  proposals.sort((a, b) =>
    (a.candidate.tier === b.candidate.tier ? 0 : a.candidate.tier === 'required' ? -1 : 1)
    || b.score - a.score
    || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0));

  // Two selections over one ranking, which is the author's split made literal.
  //
  //   `top`  is what the character did. Canonical, always recorded, whether or
  //          not anybody is told about it.
  //   `best` is the best thing worth *showing*, which is a different question.
  //
  // Requiring the top-ranked candidate to be surfaceable was wrong, and
  // measurably so: `sit_and_watch` — the designated nothing — won 594 of 967
  // opportunities and took the whole opportunity down with it. Sitting down and
  // waiting out a queue are not mutually exclusive; only the label is. What
  // keeps this honest is the interest floor below, which for the first time has
  // to do real work rather than sitting inert underneath a structural rule.
  const top = proposals[0];
  const best = proposals.find(item => item.candidate.action.surfaceable !== false) ?? top;

  // ---------------------------------------------------------------------
  // The action is chosen. Everything below decides only whether a reader is
  // stopped and told about it.
  //
  // This split is the author's, and it is worth stating plainly: "the character
  // did something" and "this deserves a moment on the page" are different
  // claims. Goaden saying "Right." and shifting a trolley is perfectly in
  // character and completely uninteresting. The world should remember it. The
  // Reading View should not announce it.
  // ---------------------------------------------------------------------
  const chosen = {
    actor: top.actor, action: top.candidate.action.id,
    practice: top.candidate.practice.id, family: top.family,
    behaviour: top.behaviour, at: now, day, surfaced: false,
    score: Number(top.score.toFixed(3)),
    effects: (top.candidate.action.effects ?? []).map(effect => ({
      kind: effect.kind, cost: effect.cost ?? null, subject: top.actor })),
  };
  const unsurfaced = (code, detail) =>
    finish(null, { ...audit, refusal: code, detail }, chosen);

  // Reader-facing budgets, applied to the showing and nothing else. The
  // character has already acted by this point; `chosen` is recorded either way.
  if ((worldPerDay(history.world).get(day) ?? 0) >= rules.dailyBudgetWorld)
    return unsurfaced('world_daily_budget', null);
  const lastWorld = history.world.at(-1);
  if (lastWorld && now - lastWorld.at < rules.worldGapMinutes * MIN)
    return unsurfaced('world_gap', { minutesSince: Math.round((now - lastWorld.at) / MIN) });
  const mineShown = historyIndex(history.byCharacter[best.actor] ?? [])
    .shownPerDay.get(day) ?? 0;
  if (mineShown >= rules.dailyBudgetPerCharacter)
    return unsurfaced('character_daily_budget', { actor: best.actor, shown: mineShown });

  if (best.candidate.action.surfaceable === false)
    return unsurfaced('nothing_worth_surfacing',
      { won: best.family, score: Number(best.score.toFixed(3)) });

  // The character's own effects are what get committed. When the thing worth
  // showing is not the thing they primarily did, the proposal still carries the
  // showable action's effects, and the canonical record carries the top one.

  const surface = surfaceOf(best.candidate.action, best.candidate.bindings);
  const line = selectLine({ opportunity, best, surface, rules, now });
  if (!line.text)
    return unsurfaced(line.reason, { actor: best.actor, surface, ...(line.detail ?? {}) });

  // A costly act stays canonical however often it happens; it is foregrounded
  // rarely. The cost is committed either way.
  const surfacedEffects = (best.candidate.action.effects ?? []);
  if (surfacedEffects.some(effect => effect.cost)) {
    const shown = historyIndex(opportunity.history?.byCharacter?.[best.actor] ?? [])
      .behaviourShown.get(best.behaviour);
    if (shown && now - shown.at < rules.costlyActionSurfaceCooldownDays * 86_400_000)
      return unsurfaced('costly_act_recently_foregrounded',
        { daysSince: Math.round((now - shown.at) / 86_400_000) });
  }

  if (best.candidate.tier !== 'required' && best.score < rules.interestFloor)
    return unsurfaced('below_interest_floor',
      { best: best.family, score: Number(best.score.toFixed(3)), floor: rules.interestFloor });

  const proposal = buildProposal({ best, proposals, opportunity, audit, surface, line });
  return finish(proposal, audit, {
    ...chosen, surfaced: true,
    // When these differ, the page is showing a real thing the character did
    // that was not the headline of their afternoon. Recorded so an audit can
    // see it rather than having to infer it.
    surfacedAction: best.candidate.action.id,
    surfacedFamily: best.family,
    surfacedBehaviour: best.behaviour,
    surfacedEffects: surfacedEffects.map(effect => ({
      kind: effect.kind, cost: effect.cost ?? null, subject: best.actor })),
  });
}

/**
 * Which authored line, if any, this moment may use.
 *
 * Three filters, in order, and each answers a specific row of the author's
 * review:
 *   1. the wording has to make sense of what it is bound to     (8 rejections)
 *   2. it must not have been used recently, and distinctive
 *      wording carries a far longer cooldown than generic      (15 rejections)
 *   3. a line marked `filler` is never printed                  (2 rejections)
 */
// ------------------------------------------------------------------ indexes
//
// The pacing split made every opportunity enumerate fully — budgets now gate
// surfacing rather than short-circuiting evaluation — so these history arrays
// came to be re-scanned for every candidate at every opportunity. That is
// quadratic in the length of a run, and it showed: a ninety-day world went from
// 3.1s to 135s, with the per-day cost itself climbing (680 ms/day at thirty
// days, 1,500 at ninety). The fix is not to scan less history but to stop
// re-deriving the same answer.
//
// These arrays are only ever appended to. An index folded forward from the last
// length seen is therefore exact rather than an approximation, and the cache is
// keyed on the array itself so callers keep pushing as they always have.
const HISTORY_INDEX = new WeakMap();

function historyIndex(list) {
  let index = HISTORY_INDEX.get(list);
  if (!index) {
    index = { seen: 0, family: new Map(), shownPerDay: new Map(),
      behaviourShown: new Map(), surfaceShown: new Map(), lineShown: new Map(),
      surfaceCount: new Map() };
    HISTORY_INDEX.set(list, index);
  }
  // Fold forward only what is new. Insertion order gives `.at(-1)` semantics:
  // a later item overwrites an earlier one under the same key.
  for (; index.seen < list.length; index.seen += 1) {
    const item = list[index.seen];
    const family = index.family.get(item.family) ?? { last: null, count: 0 };
    family.last = item; family.count += 1;
    index.family.set(item.family, family);
    if (!item.surfaced) continue;
    index.shownPerDay.set(item.day, (index.shownPerDay.get(item.day) ?? 0) + 1);
    index.behaviourShown.set(item.behaviour, item);
    if (item.surface != null) {
      index.surfaceShown.set(item.surface, item);
      // Drives the rotation offset, so it must count every surfaced use rather
      // than remember only the last one.
      index.surfaceCount.set(item.surface, (index.surfaceCount.get(item.surface) ?? 0) + 1);
    }
    if (item.line != null) index.lineShown.set(item.line, item);
  }
  return index;
}

/** Surfaced Moments the world showed on a given day. Same append-only trick. */
const WORLD_INDEX = new WeakMap();
function worldPerDay(list) {
  let index = WORLD_INDEX.get(list);
  if (!index) { index = { seen: 0, perDay: new Map() }; WORLD_INDEX.set(list, index); }
  for (; index.seen < list.length; index.seen += 1) {
    const day = list[index.seen].day;
    index.perDay.set(day, (index.perDay.get(day) ?? 0) + 1);
  }
  return index.perDay;
}

function selectLine({ opportunity, best, surface, rules, now }) {
  const { cast, view, seed = '' } = opportunity;
  const bank = cast.get(best.actor)?.quips?.[surface] ?? [];
  if (!bank.length) return { text: null, reason: 'no_authored_surface' };

  // Same principle: these are the reader's cooldowns, so only surfaced history
  // counts. An action the page never mentioned did not use up its line.
  const history = historyIndex(opportunity.history?.byCharacter?.[best.actor] ?? []);
  const fits = bank.filter(entry => !entry.filler
    && solve(view, entry.requires, best.candidate.bindings).length > 0);

  // Spacing, computed from how much bank there is to spend. A flat cooldown
  // here produced a sawtooth: four distinctive counting lines were spent in the
  // first fortnight and then locked for forty days, so ninety days of world
  // gave fourteen moments in March, none in April and one in May. Spacing a
  // surface by (line cooldown / bank depth) spreads a thin bank across the
  // window it has to cover. A shallow bank then appears rarely and evenly,
  // which is how a shallow bank should behave.
  const signatures = bank.filter(entry => entry.signature && !entry.filler).length;
  const spacingMs = rules.spaceSurfaceByBankDepth && signatures > 0
    ? Math.max(rules.surfaceCooldownHours * 3_600_000,
      (rules.signatureLineCooldownDays / signatures) * 86_400_000)
    : rules.surfaceCooldownHours * 3_600_000;
  const lastSurface = history.surfaceShown.get(surface);
  if (lastSurface && now - lastSurface.at < spacingMs)
    return { text: null, reason: 'surface_spacing',
      detail: { daysSince: +((now - lastSurface.at) / 86_400_000).toFixed(1),
        needs: +(spacingMs / 86_400_000).toFixed(1), bank: signatures } };
  if (!fits.length)
    return { text: null,
      reason: bank.every(entry => entry.filler) ? 'not_worth_surfacing' : 'no_line_fits_this_target',
      detail: { bound: best.candidate.bindings.Thing ?? null } };

  const fresh = fits.filter(entry => {
    const used = history.lineShown.get(entry.text);
    if (!used) return true;
    const days = (now - used.at) / 86_400_000;
    return days >= (entry.signature ? rules.signatureLineCooldownDays : rules.lineCooldownDays);
  });
  if (!fresh.length)
    return { text: null, reason: 'every_fitting_line_is_cooling', detail: { fitting: fits.length } };

  // Rotation over what survives, phased per character so two people sharing a
  // bank do not walk through it in step.
  const used = history.surfaceCount.get(surface) ?? 0;
  const offset = hash(`${seed}|quip-phase|${best.actor}|${surface}`) % fresh.length;
  const entry = fresh[(used + offset) % fresh.length];
  return { text: entry.text, entry, considered: fits.length, fresh: fresh.length };
}

function buildProposal({ best, proposals, opportunity, audit, surface, line }) {
  const { now, day, location, area, seed = '' } = opportunity;
  const { candidate, actor } = best;
  const { practice, action, bindings, instanceId, sways } = candidate;
  const grammar = opportunity.cast.get(actor);

  return {
    id: `moment:${hash(`${seed}|moment|${actor}|${candidate.id}|${now}`).toString(16)}`,
    at: now, day, location, area,
    family: familyOf(candidate),
    practice: practice.id,
    instance: instanceId,
    participants: [actor, ...(action.participants ?? []).map(role => bindings[role]).filter(Boolean)],
    roles: Object.fromEntries(Object.entries(bindings).filter(([key]) => /^[A-Z]/.test(key))),
    actor,
    action: action.id,
    intent: action.intent ?? null,
    target: bindings.Target ?? bindings.Other ?? null,
    reason: action.reason ?? sways.filter(s => s.score > 0).sort((a, b) => b.score - a.score)[0]?.name ?? null,
    score: Number(best.score.toFixed(3)),
    rawScore: Number(candidate.score.toFixed(3)),
    fatigue: Number((best.novelty ?? 0).toFixed(3)),
    timesBefore: best.lifetime ?? 0,
    tier: candidate.tier,
    influences: sways.map(sway => ({ name: sway.name, score: sway.score, kind: sway.kind, from: sway.from })),
    behaviour: best.behaviour,
    rejectedAlternatives: proposals.slice(1, 6).map(other => ({
      actor: other.actor, family: other.family, score: Number(other.score.toFixed(3)) })),
    unavailable: audit.blocked.slice(0, 12),
    forbidden: audit.rejected.slice(0, 12),
    requiredFacts: (action.requires ?? []).map(fact => groundFact(fact, bindings)),
    requestedEffects: (action.effects ?? []).map(effect => {
      const { asserts, retracts, ...rest } = effect;
      return { ...rest, subject: effect.subject ? bindings[effect.subject] ?? effect.subject : actor };
    }),
    presentationKey: surface,
    // Renderer instructions, with roles resolved to actual people. This is what
    // makes the mimic affordable: `TRANSFORM_MIMIC` tells the front end to reuse
    // the *target's existing plate* under a grey Onari tint and then return, so
    // no bespoke artwork is needed for Yukon-as-anybody.
    presentation: action.presentation
      ? Object.fromEntries(Object.entries(action.presentation).map(([key, value]) =>
        [key, typeof value === 'string' && bindings[value] !== undefined ? bindings[value] : value]))
      : null,
    // A request for a scene the engine does not own. Roles resolved the same
    // way, so the receiving layer gets people rather than variables.
    scene: action.scene
      ? Object.fromEntries(Object.entries(action.scene).map(([key, value]) =>
        [key, typeof value === 'string' && bindings[value] !== undefined ? bindings[value] : value]))
      : null,
    line: line.text,
    lineIsSignature: Boolean(line.entry?.signature),
    // What the line refers to, when the page must not say. "Ten. That one was
    // ten." means ten years of her life; the reader is never told that.
    lineMeaning: line.entry?.meaning ?? null,
    linesThatFitted: line.considered,
    linesStillFresh: line.fresh,
    dialogueFamily: action.dialogueFamily ?? null,
    mystery: grammar.mystery.includes(surface),
    callbackSeedsCreated: (action.seeds ?? []).map(item => ({ ...item,
      key: groundFact(item.key, bindings), by: actor })),
    provenance: {
      practiceDefinition: practice.id,
      actionDefinition: `${practice.id}/${action.id}`,
      grammar: actor,
      trigger: audit.trigger,
      worldEventInputs: opportunity.worldEventInputs ?? [],
      engineVersion: 'moment-lab-v1',
    },
  };
}

const groundFact = (fact, bindings) => String(fact).replace(/\b([A-Z][A-Za-z]*)\b/g,
  (whole, name) => (bindings[name] !== undefined ? String(bindings[name]) : whole));

function finish(proposal, audit, chosen = null) {
  return { proposal, audit, chosen };
}

/** Build the transient view for one opportunity from a list of fact sentences. */
export function viewFrom(sentences) { return addAll(createView(), sentences); }
export { add };
