# RHYTHM: behavioural metabolism for WorldStream (v30 design)

Date: 2026-09-20. Status: **implemented, tested and deployed as v30 through the preserving release procedure.** See workspace `tmp/worldstream-v30-ops-20260920/DEPLOYMENT-RESULT.md` for production evidence and remaining live-observation limits. The reviewed design began against v29; the current implementation uses `RULES_VERSION = canon-ambient-p183-v30`. Paths are relative to `worldstream-server/`. Historical line numbers below describe the original seam and may have moved.

The real-reducer acceptance run passed with the inherited pilot weights: 30 seeds × 14 days, 44,084 events and 1,060 legal choices; Ashai evening TV was 37.73% of choices and 38.01% of completed routines. Ninety simulated days used at most 2,661 UTF-8 bytes per actor. See `RHYTHM-ACCEPTANCE.json` and `RHYTHM-V30-LIVE-UPGRADE.md` for evidence and the separate future deployment procedure.

## 0. What this replaces

The v29 plan said (§7): *"Do not add the proposed metabolic state; these rules already provide the needed governor."* That was correct for pacing scenes. It is wrong for the problem RHYTHM solves, which is not pacing but **choice**: today every solo leisure slot is decided by `pick(seed, key, bank)` inside `dayActions()` (`src/fixture.mjs:873, 981-982`), and Ashai's evening slot is not even a pick, it is the literal `TV_BEGIN`. Nothing she has done, seen or been told can change it. RHYTHM supersedes that §7 sentence for the leisure seam only. Director budgets, cooldowns, spacing and least-performed tiers are untouched.

RHYTHM is not anti-repetition. It says: *the character still wants what television gives her; she does not necessarily want television.* Everything below is ordinary deterministic arithmetic on bounded canonical state. Zero model calls.

## 1. Hard boundaries

- RHYTHM chooses **which legal routine** fills a slot that the day plan has already declared free. It cannot create a slot, move a duty, break an arrangement, admit a scene, create a fact, grant knowledge or alter a relationship.
- Candidates are drawn from a **reviewed template library** (§6). RHYTHM can discover *Ashai has started listening to music in the evenings*. It cannot discover an activity nobody authored.
- Every candidate still passes `activity()`'s three legality gates (`MODE_PERMITS`, `ACTIVITY_DAYPARTS`, `permitsArea`, fixture.mjs:1157-1189) and the per-actor ownership checks (`Only Goaden plays piano`, `TV routine belongs to Ashai`, 1462-1463). RHYTHM scores; the reducer still refuses.
- All RHYTHM state is canonical, versioned, bounded, ledger-replayed and created only by a prospective activation action. Disabled or pre-activation worlds produce the **exact** `pick()` baseline.
- Determinism: `sha256(seed|rhythm-v1|key)` only. No wall clock, no `Math.random`, no iteration over unbounded maps, no viewer input.
- Needs are **behavioural pressures**, not emotions. They never appear in prose, projection or API as numbers, and no reader may infer character feelings from them.

## 2. The seam

`dayActions()` stays pure of state (see the comment at fixture.mjs:991-997 for why). It stops emitting concrete types for the three free slots and emits one decision action per slot instead:

```js
// fixture.mjs dayActions(), replacing lines 873, 981, 982
slot('ashai-downtime','10:20','ashai',45,'daytime_leisure');
slot('evening-goaden','19:30','goaden',65,'evening_leisure');
slot('evening-ashai','19:45','ashai',55,'evening_leisure');

const slot=(id,time,actor,duration,family)=>add(id,loosen(id,time),'RHYTHM_CHOOSE',
  {actor,duration,family,baseline:legacyPick(date,seed,id)});
```

`baseline` is the exact value the old `pick()` (or literal `TV_BEGIN`) would have produced. The `RHYTHM_CHOOSE` resolver:

1. **Inactive parity:** at day rollover, materialize the original concrete baseline actions before enqueueing. Do not enqueue extra decision actions while RHYTHM is absent or disabled. The first implementation's extra private actions changed CSV's real action count and clone size; preserving the original queue fixes both without weakening CSV's budgets. `dayActions()` itself remains calendar-pure.
2. **Active choice:** enqueue the decision one minute before the original slot, carrying its exact `legacyId` and `slotAt`. Validate it against the three authored calendar slots and current availability, accepted commitments and queued duty overlap. Filter the reviewed candidates by `permitsActivity/permitsDaypart/permitsArea` and actor ownership before scoring. The winner keeps the original routine ID, start time and duration. It is checked again when it starts; an unavailable slot is skipped, never moved or extended. Its private decision contains bounded scores; only the ensuing ordinary routine has public prose.

An already-enqueued choice encountered after disabling RHYTHM selects its baseline without a habit tag. Selected private follow-ups are omitted from public upcoming plans. Completion must retain the exact routine ownership, start/end clock and slot tag before earning a leisure habit. Existing concrete routines queued before migration remain unchanged and can be recognized by their exact legacy slot ID when they actually finish.

This mirrors `PLAN_CHANGE → optional planKey activity` (fixture.mjs:1672-1686, 1458). Follow-ups are strictly after their cause and ordered `dueAt → priority → id`, as `WorldStore.advance()` requires.

New entries required: `RHYTHM_CHOOSE` in `EVENT_TYPES` (131-159) and `ACTIVITY_DAYPARTS`; `TOPICS` unchanged in v1 (no new fact kinds). Conversation-continuity tests that list allowed change entities need `rhythm` added to the bookkeeping allowance, precisely as `narrativeSignals` was.

## 3. Canonical state

```js
state.rhythm = {
  version: 1, enabled: true, activatedAt,            // gate: version===1 && enabled!==false && activatedAt<=now
  actors: {
    [id]: {
      needs: { rest, social, stimulation, solitude, mastery },  // each in [0,1]
      needsAt,                                                  // ms; lazy integration watermark
      habits: { [activityLabel]: H },                           // H in [0,1]; only labels in the template library
      history: [ { label, at } ],                               // newest last, max 24 entries, max 7 days
      traces: [ { label, strength, at, tau, sourceEventId, factKey } ]  // max 8, strength in [0,1]
    }
  }
};
```

`initialRhythm(now)` seeds `needs` at profile baselines and `habits` at authored priors (`ashai.watching_television = .6`, `goaden.playing_piano = .7`, everything else `.1`) so the first week resembles today's world rather than a blank slate. Writes go through `setStory('rhythm', …)` with the same omission-preservation handling `set()` uses for `narrativeSignals` (1104-1105) so reversing activation restores the pre-upgrade shape. `assertRhythm(state)` runs inside `assertCanonState`: bounds, list caps, known labels, monotone `needsAt <= now`, `traces[].sourceEventId` present. Serialized budget: **≤ 4 KiB per actor**, asserted in tests.

## 4. The five terms

All terms are in `[0,1]` (or `[-1,1]` where signed) and combined as

```text
Score(a) = α·Gain(a) + β·Habit(a) + γ·Circadian(a) + δ·Trace(a) + ρ·Social(a) + μ·Narrative(a) − λ·Satiety(a) − κ·Cost(a)
```

Pilot weights, not tuned truth: `α=.35 β=.20 γ=.15 δ=.25 ρ=.10 μ=.05 λ=.40 κ=.15`. They live in `RHYTHM_RULES` and are versioned with `rhythm-v1`.

### 4.1 Homeostatic gain (with allostatic look-ahead)

Needs drift while awake and are settled lazily. Reads calculate pressures without writing canonical state; successful completions and actual sleep checkpoints persist the new watermark. Per-actor rates come from the inherited implementation's authored **profile**:

```js
RHYTHM_PROFILES = {
  ashai:  { rise: { rest:.04, social:.03, stimulation:.07, solitude:.03, mastery:.03 } },  // per awake hour
  goaden: { rise: { rest:.04, social:.02, stimulation:.04, solitude:.05, mastery:.06 } }
};
```

Each template has an effect vector applied **at completion** (`ACTIVITY_COMPLETE`/`PRACTICE_END`, fixture.mjs:1496-1508; `INTENT_COMPLETE` for shared activities), scaled by `min(1, minutes/45)`:

```js
watching_television: { rest:-.25, stimulation:-.35, solitude:-.10 },
quiet_break:         { rest:-.20, solitude:-.35 },
listening_to_music:  { rest:-.20, stimulation:-.20, solitude:-.20 },
gaming:              { stimulation:-.40, mastery:-.15, social:-.20 /* shared only */ },
playing_piano:       { stimulation:-.20, mastery:-.30, solitude:-.25 },
training:            { rest:+.20, stimulation:-.15, mastery:-.40 },
resting:             { rest:-.40 },
```

Discomfort is `Drive(D) = Σ w_i D_i²` with `w = 1`. Gain is the normalized reduction, evaluated at **projected** need, one slot ahead:

```text
D̂ = clamp(D + rate · Δt_lookahead),  Δt_lookahead = 2h
Gain(a) = clamp((Drive(D̂) − Drive(clamp(D̂ + E_a))) / Drive(D̂))   (0 if Drive(D̂)=0)
```

That is the allostatic part: Goaden's low-energy options rise *before* he is spent, because the projection already contains two more hours of drift. Fatigue is not duplicated: `rest` need reads the existing `fatigueAt(state, who, now)` (abilities.mjs:72-80) as a floor, `rest = max(rest, fatigueAt/6)`, so RHYTHM cannot disagree with the ability system about tiredness.

Sleep is credited only during a real `sleeping` activity, using the overlap between its actual start, the last need watermark, and the current action. Recovery is proportional to elapsed sleep, with an explicitly authored eight-hour normalization (`rest × .25^(hours/8)`, `solitude × .6^(hours/8)`). Midnight settles only the sleep elapsed so far; waking or interruption settles the remainder before changing activity. Awake characters receive no fictitious nightly recovery. Shared gaming's social effect requires a successfully completed shared session, and never builds a solo leisure habit.

### 4.2 Habit gravity

On successful completion of label `a` in slot family `f`:

```text
H_a ← H_a + η(1 − H_a),                         η = .08
H_b ← H_b − ε·H_b   for every b ≠ a in the same need family as a,   ε = .02
```

Bounded by construction. Unpracticed habits fade slowly; a behaviour repeated nightly saturates around week three. `Habit(a) = H_a`. Context matters: the increment is only applied when the completing activity was chosen by `RHYTHM_CHOOSE` **or** the legacy slot of the same family; duty, shared arrangements and travel do not build leisure habits.

### 4.3 Behavioural satiety

Read-only over the bounded `history`:

```text
Satiety(a) = clamp( Σ_j  Sim(a, label_j) · exp(−(now − at_j)/τ) ),   τ = 40h
```

with a **reviewed symmetric similarity matrix** (need-family based, not text based):

| | tv | music | quiet | gaming | piano | training | resting |
|---|---|---|---|---|---|---|---|
| tv | 1 | .35 | .25 | .35 | .10 | 0 | .15 |
| music | | 1 | .45 | .15 | .40 | 0 | .20 |
| quiet | | | 1 | 0 | .20 | 0 | .55 |
| gaming | | | | 1 | .10 | .10 | 0 |
| piano | | | | | 1 | .30 | 0 |
| training | | | | | | 1 | 0 |
| resting | | | | | | | 1 |

Three consecutive TV evenings give `Satiety(tv) ≈ 1 + e^{−.6} + e^{−1.2} ≈ 1.85 → clamp 1`; music inherits only `.35` of that. Being sick of the *sort* of thing, not the passage ID.

### 4.4 Circadian fit

Dayparts are discrete here (`daypart()` in `src/sky.mjs`: small_hours/morning/midday/evening/night). `ACTIVITY_DAYPARTS` is the hard legality gate and stays hard. `Circadian(a)` is a soft reviewed table per label, e.g. `playing_piano: {morning:.6, midday:.4, evening:1, night:.5}`, `training: {morning:1, midday:.8, evening:.3, night:0}`. A cosine profile is unnecessary at this granularity and would imply precision the world does not have.

### 4.5 Event traces (scars)

A trace is created only from a **committed fact the actor actually knows** (`useMemory`/`knowsFact`), through a reviewed association table — the same knowledge discipline SPECTRA uses (`src/spectra.mjs:12-29`). No trace from omniscient state.

```js
RHYTHM_TRACE_SOURCES = {
  break_preference: { resting:.5, quiet_break:.4 },                  // fatigue theme
  unfinished_game:  { gaming:.6 },                                   // GAME_PAUSE fact
  broken_plan:      { listening_to_music:.4, quiet_break:.3 },       // PLAN_BROKEN
  quiet_preference: { quiet_break:.5 },
  incident:         { quiet_break:.4, resting:.3 }                   // high/critical only, subject includes actor
};
```

At `commitRhythm(event)` each newly learned qualifying fact deposits `{label, strength: S_e · assoc, at, tau: 36h, sourceEventId}`; one trace per source per label; oldest evicted at 8. `Trace(a) = clamp(Σ strength · exp(−(now−at)/tau))`. **Temporary event → repeated behaviour → persistent habit** happens with no extra rule: following a trace completes the activity, which runs §4.2.

### 4.6 Social, Narrative, Cost

- `Social(a)`: 1 if the template is shared and the other actor is present, awake, free (`intent.mjs:free()`) and unarranged; 0 if shared and unavailable (and the candidate is dropped, not merely penalized); .5 for solo templates. v1 templates are all solo, so this term is reserved and constant.
- `Narrative(a)`: bounded MORPHOS read at the actor's own node for the label's motif (`practice`, `everyday_competition`, `shared_recovery`), via a `morphosActorAffinity(state, who, motif, now)` helper added beside `morphosSceneScore`. Clamped `[-1,1]`, weight `μ=.05`, **zeroed under `disableNarrativeSignals`** so CSV forks cannot award themselves value through RHYTHM. SPECTRA is not consulted: it ranks passages, not behaviour.
- `Cost(a)`: `training` costs `fatigueAt/6`; anything requiring an area change from the actor's current area costs `.15`; everything else 0.

## 5. Selection: the capped keyed race

Reuse the idiom from `rankNarrativeScenes()` (`src/narrative-selection.mjs:27-52`) rather than a new RNG:

```text
v_i   = (Score_i − min(Score)) / T           T = .05 (fixed temperature; scores live in roughly [−.4, .8])
scale = min(1, ln(R_max) / max(v))           R_max = 4 (largest-to-smallest weight ratio)
w_i   = exp(v_i · scale)
u_i   = (parseInt(sha256(`${seed}|rhythm-v1|${slotId}|${label}`).slice(0,13),16)+1) / (2^52+1)
race_i = −log1p(−u_i) / w_i;  winner = argmin race_i, ties by hash then label
```

Two deliberate differences from `rankNarrativeScenes()`. First, a fixed temperature: the v29 selector is a tie-breaker between already-good passages and correctly refuses to stretch tiny differences, but RHYTHM's whole job is to let a .15 score gap change behaviour, so `T` converts that gap into a real weight before the cap applies. Second, `R_max = 4` rather than 2: a cap of 2 can only jitter a habit, not shift one. Equal scores still reproduce the pure hash order exactly. A strong pull wins most nights but not every night, which is what a habit looks like from outside.

## 6. Template library (the possibility fence)

v1 ships only labels that already exist in the reducer, so **no new prose, permits or events are required to activate RHYTHM**:

| family | candidates |
|---|---|
| `daytime_leisure` (ashai) | `watching_television`, `quiet_break`, `listening_to_music`, `gaming` (solo) |
| `evening_leisure` (goaden) | `playing_piano`, `listening_to_music`, `gaming` (solo), `quiet_break` |
| `evening_leisure` (ashai) | `watching_television`, `listening_to_music`, `gaming` (solo), `quiet_break`, `resting` |

The proposal's richer templates are **phase 2 content work**, each needing a label, `MODE_PERMITS`/`places.mjs` permits, `ACTIVITY_DAYPARTS`, `downtime.mjs` ticker lines and Silent's review:

```text
contact(person)       → 'on_the_phone'        Emily/Zara are offscreen cast; needs a phone label + who was called as private payload
visit(place)          → already partly exists via cityOuting(); would need a solo evening variant
listen_to(media), practice(skill), spend_time_with(person), check(place), care_for(object), avoid(place|person)
```

Nothing in RHYTHM's maths changes when these arrive; only `RHYTHM_TEMPLATES`, effect vectors and the similarity matrix grow, and each addition is a reviewed data change.

## 7. Worked example (pilot weights, v1 templates)

20:45-ish evening slot, Ashai. Needs after drift and projection: `rest .55, social .40, stimulation .70, solitude .30, mastery .20`. History: TV last two evenings (Satiety(tv) ≈ .9 after clamp, music ≈ .32, gaming ≈ .32). Yesterday's `PLAN_BROKEN` fact she knows gives traces `listening_to_music .4·e^{−22/36}=.22`, `quiet_break .16`. Habits: tv .62, music .12, quiet .10, gaming .18, resting .05.

| | Gain ·.35 | Habit ·.20 | Circ ·.15 | Trace ·.25 | Satiety ·−.40 | Cost | **Total** |
|---|---|---|---|---|---|---|---|
| tv | .41→.14 | .62→.12 | 1→.15 | 0 | .90→−.36 | 0 | **.05** |
| music | .33→.12 | .12→.02 | .9→.14 | .22→.06 | .32→−.13 | 0 | **.21** |
| quiet | .24→.08 | .10→.02 | .8→.12 | .16→.04 | .20→−.08 | 0 | **.18** |
| gaming | .36→.13 | .18→.04 | .9→.14 | 0 | .32→−.13 | 0 | **.18** |
| resting | .18→.06 | .05→.01 | .6→.09 | 0 | .10→−.04 | 0 | **.12** |

Gaps over the minimum: `0, .16, .13, .13, .07`; divided by `T=.05`: `0, 3.2, 2.6, 2.6, 1.4`; `max = 3.2 > ln4`, so `scale = 1.386/3.2 = .43`; weights `1, 4.0, 3.1, 3.1, 1.8` (sum 13.0). Across keyed draws that is roughly **music 31%, quiet 24%, gaming 24%, resting 14%, TV 8%**. TV is not forbidden; it has been made unlikely by two nights of itself. On this evening music is *favoured*, not scripted.

Over a week the drift is what matters: TV recovers as its satiety decays (back to `≈.3` after two nights off), music builds habit if it keeps winning, and the trace dies if she never follows it. The test suite asserts the **distribution over 30 seeded evenings**, not one night.

## 8. Interaction with existing systems

- **MORPHOS** reads unchanged; concrete follow-ups still fire `eventMotifs()`. RHYTHM reads MORPHOS through one bounded helper (§4.6).
- **SPECTRA** untouched.
- **CSV** operates on `INTENT_RESPONSE` only; RHYTHM on `RHYTHM_CHOOSE` only. Disjoint seams. Forks run RHYTHM identically (it is world behaviour, part of `x`), with `μ` zeroed under `disableNarrativeSignals`.
- **Onari / Living Places** unaffected.
- **Director/scene bank**: no change to opportunity frequency; a different leisure activity may make different reservoir passages eligible, which is the point, and coverage per label should be measured before activation (`scene-reservoir-health`: passages per `activity` binding).
- **Themes** (`invitation`, `fatigue`, …) still own the middle of the day. RHYTHM does not touch themed slots in v1.

## 9. Persistence and release

Exactly the v29 pattern (`src/narrative-upgrade.mjs`, `scripts/upgrade-v29.mjs`, reducer arm fixture.mjs:1263-1271):

- `RULES_VERSION → canon-ambient-p183-v30`. Changing `dayActions()` changes the action set, so this is a real rules change and must not be relabelled onto a v29 save.
- `scripts/upgrade-v30.mjs <COPY-of-pinned-v29-dir> <new-backup>`: identity check, clean queue past cutover, receipt in `state.meta.upgrades`, one owned action `{id:'rhythm-v30/activate/<ms>', type:'WORLD_RHYTHM_ACTIVATE', dueAt: cutover+1, priority:-1}`, backup + sha256. Never run it against the only original or untouched pinned backup. Every preexisting pending action remains byte-identical; choices begin with later normal day planning.
- Reducer arm: `setStory('rhythm', initialRhythm(now))`. Old history is never rescored; habits start at authored priors, not inferred from the ledger.
- Fresh v30 worlds enable it in `initialState`.

## 10. Module layout

```text
src/rhythm.mjs               RHYTHM_RULES, RHYTHM_PROFILES, RHYTHM_TEMPLATES, similarity, trace sources,
                             initialRhythm(now), rhythmActive(state,now), settleNeeds(actor,now),
                             scoreCandidates(state,who,slot,now,seed) → [{label,total,terms}],
                             chooseRoutine(state,who,slot,now,seed) → {label, scores},
                             commitRhythm(rhythm,state,event,action,now) (pure), assertRhythm(state)
src/rhythm-upgrade.mjs       upgradeRhythm({directory, backupPath})
scripts/upgrade-v30.mjs
src/fixture.mjs              slot() in dayActions; RHYTHM_CHOOSE + WORLD_RHYTHM_ACTIVATE arms;
                             commitRhythm under the existing post-resolution guard next to commitMorphos (2141-2156);
                             habit/need updates in the ACTIVITY_COMPLETE / PRACTICE_END / INTENT_COMPLETE arms
src/morphos.mjs              + morphosActorAffinity(state, who, motif, now)
test/rhythm.test.mjs, test/rhythm-upgrade.test.mjs
```

`commitRhythm` follows `commitMorphos`'s contract: pure, reads the committed `event` and `action` after the resolver succeeded, returns a new bag, never touches other state.

## 11. Tests and gates

**Parity (must pass before anything else)**
- With `rhythm` absent before activation, the seven-day event/state digests match both captured v29 references exactly, including CSV diagnostics. No extra RHYTHM action is enqueued. The preexisting parity view excludes release-dependent institution-notice wording and normalizes event sequence wrappers.
- With an explicitly disabled **retained** RHYTHM bag, routines, queue, state changes and CSV decisions are identical in the regression worlds. The bag's real additional clone bytes remain truthfully measured and count against the unchanged hard cap. That one diagnostic is normalized only in the separate disabled-bag comparison; it is never hidden from production or removed from the captured v29 hash check. At a clone-budget boundary, the existing neutral CSV fallback still takes precedence over any parity expectation.

**Unit**
- Needs bounded and monotone under drift; effects clamp; `rest` never below `fatigueAt/6`.
- Habit approaches 1 asymptotically, never exceeds; unpracticed habits decay; duty completions do not build leisure habit.
- Satiety: three TV nights ≥ .9; music inherits ≤ .35 of it; `walk`-class similarity 0 stays 0.
- Trace only from facts the actor knows; unknown/expired/other-subject facts produce none; one trace per source per label; decays to `<1e-3` within `7τ`; eviction at 8 keeps newest.
- Illegal candidates (wrong daypart, wrong actor, closed room) never appear in `scores`, even with a huge score.
- Equal scores reproduce pure hash order; relative weight ratio ≤ 4.

**Behavioural (30 seeds × 14 days, lab)**
- Ashai's evening TV share falls from 100% to a band of roughly 35–60%; no label exceeds 70% or falls below 5% among legal candidates.
- After a genuinely learned `PLAN_BROKEN` fact, traced routines become more likely at the **next genuinely eligible free slot**, compared with an otherwise identical actor who lacks that source knowledge and its resulting traces. The immediately following evening belongs to the existing make-up plan, which suppresses evening leisure; the test must not invent a slot or displace those duties.
- Habit formation: five actual, unforced music completions in reviewed leisure families raise subsequent unforced music choice rates against a matched no-music-learning control. Hold needs, traces, legality and recent history equal to isolate habit, and separately report the immediate combined effect of habit and retained satiety without requiring that combined effect to be positive.
- No behaviour appears that is not in `RHYTHM_TEMPLATES`.

The bounded causal tests in `test/rhythm-response.test.mjs` use actual source events and owned completions from a fresh, in-memory WorldStore with the existing `silver-clouds-now-v1` seed. Across 4,096 common deterministic selection keys, the known broken-plan trace raises traced-routine wins from **23.46% to 28.13%** at the next available real evening (**+4.66 percentage points**). Five actual music completions raise music wins from **11.72% to 19.70%** with recent history held equal (**+7.98 points**, isolated habit effect). When the control also removes those five exposures' retained music-history entries, the immediate habit-plus-satiety comparison is **20.24% versus 19.70%** (**−0.54 points**): recent repetition can outweigh the learned habit. That comparison still holds physical needs and other circumstances equal; it does not claim to simulate an alternate full world history. No winners, facts, slots or completion tags are injected into the factual run, and no pilot weights were retuned for these results.

**Determinism and replay**
- Forward + reverse ledger replay of `state.rhythm`; chunked vs single `advance()` equality; JSON restart equality; Node vs Cloudflare adapter parity for activation.
- `runtime-no-llm` tripwire still passes.
- Serialized `state.rhythm` ≤ 4 KiB/actor after 90 simulated days.

**Go/no-go**: if the behavioural band is not reached with pilot weights, retune `RHYTHM_RULES` only (not cooldowns, not permits). If parity fails, stop.

## 12. Build order

A. `src/rhythm.mjs` pure module + unit tests (no fixture changes).
B. `slot()` + `RHYTHM_CHOOSE` parity path only; parity test green.
C. Activation arm, upgrade script, replay tests.
D. Enable scoring; behavioural lab sweep; tune weights; write `RHYTHM-V30-LIVE-UPGRADE.md` in the style of the existing `*-LIVE-UPGRADE.md` files.
E. Phase 2 content proposal for Silent: `on_the_phone` (contact Emily/Zara), solo evening walk, with ticker lines and permits. Not part of v30 activation.
