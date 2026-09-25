# Worldstream: three bounded upgrades to the existing simulation

**2026-09-20 implementation update:** The user's subsequent instruction authorized implementation. SPECTRA, MORPHOS and CSV are now integrated in the v29 runtime, with Onari environmental-response integration and a production no-LLM boundary. See [NARRATIVE-SYSTEMS-V29.md](NARRATIVE-SYSTEMS-V29.md) for actual mechanisms, limits, validation and prospective save activation. The planning status and freeze below are historical, not the current implementation status.

Date: 2026-09-11. Revision 2: checked against runtime admission, scheduling and numerical limitations. Status: implementation handoff, not implemented runtime functionality.

**Final direction — takes precedence over this document's implementation steps:** first follow [WORLDSTREAM-ADDON-BIBLE-BRIEF.md](WORLDSTREAM-ADDON-BIBLE-BRIEF.md). Read the complete primary canon and produce `WORLDSTREAM_ADDON_BIBLE.md` for the six grounded world systems. No addon implementation until Silent has reviewed the complete bible. Once Grok's reservoir acceptance is verified, treat the existing core and presentation as frozen. SPECTRA, MORPHOS and CSV remain optional research proposals; they are not prerequisites for the canon-grounded addons and must not delay or expand them. The experiments below do not authorize coding or certify the new systems.

## 1. Read this first

Worldstream is a deterministic simulation presented through Silent's prose. The simulation creates the lives and consequences. Existing authored scenes, Moment grammar and reservoirs express them. The LLM may replenish reviewed reservoirs through scheduled maintenance; opening or refreshing the page must never reserve generation or call a model.

Build an upgrade inside the existing engine. Preserve the UI, prose renderer, weather, audio, travel presentation, character canon, authored arcs and approved content. No new framework, graph database, embeddings, continuous LLM, second scheduler or live narrator. Do not activate staged batches as part of this work.

**The attached research proposal is inspiration, not a tested specification. These are three candidate adaptations, with explicit go/no-go gates. Their reader benefit is not yet established. The full proposed spectral detector is mathematically inappropriate for the present engine. Do not implement its equations literally.** Numerical tests validate limited mechanisms, not guaranteed literary quality or originality. Keeping an addon neutral after a failed feasibility gate is a valid outcome.

Plain meaning of the additions:

1. **SPECTRA:** recognize existing unresolved pressure and fragile obligations; prefer a fitting, already-valid subtle passage when there is evidence for it.
2. **MORPHOS:** let motifs from committed events leave a small, local, fading influence on which eligible passages appear next.
3. **CSV:** at a genuinely free character choice, compare permitted alternatives in isolated copies of the real reducer and modestly prefer useful delayed consequences.

None can make an ineligible scene eligible, create a fact, grant knowledge, override duty or break an arc. If no supported material exists, return a neutral score. A missing passage is a reservoir coverage issue, not permission to fabricate one.

## 2. The actual code to build on

Paths below are relative to `worldstream-server/`, not the sibling workshop/backups.

| Existing responsibility | Actual implementation | Use it this way |
|---|---|---|
| Canonical transitions | `src/fixture.mjs:createFixture().reduceAction(state, action, seed)` | Own every canonical decision and addon-state update here through existing mutation/ledger helpers. |
| Transactions and queue | `experiment-l/src/world.mjs:WorldStore.advance()` | Preserve dueAt → priority → id ordering, action ownership, follow-ups and atomic commits. |
| Production stores | `src/service-world.mjs`, `src/world.mjs`, Cloudflare `src/world-durable-object.mjs` | Keep existing persistence and restart semantics; no new production database. |
| Scene choice | `src/scene-bank.mjs:sceneBankAfterAction()`, `eligible()`, `sceneSpent()`, `resolveSceneBankAction()` | Only rank inside the current eligible, least-performed tier. Revalidate at performance. |
| Reservoir admission | `src/scene-reservoir-catalog.mjs:reservoirSceneEligible()` | Preserve cast, location, activity, weather, timing, review and source bindings. |
| Pressure | `src/pressure.mjs`, daily reduction in `src/fixture.mjs` | Reuse carried pressure, its floors, decay and incident limits. |
| Known relationship history | `src/relationship-choices.mjs:knownSupportingHistory()`, `supportingRelationshipChoice()` | Use witnessed/learned facts, never aggregate rapport as omniscient character knowledge. |
| Character choice | `src/intent.mjs:chooseIntentMotive()`, `issueIntentActions()` | CSV pilot may rank only the final `ordinary_preference` loyalty/ambition choice. All earlier branches stay authoritative. |
| Existing pacing | `src/director.mjs:DIRECTOR_RULES`, `chooseFamily()` | Reuse budgets, spacing and repetition protection; no extra energy subsystem. |
| Place/encounter links | `src/places.mjs`, committed participants, `event.causedBy` | Build a small derived motif graph; these are inputs, not an existing multiplex graph service. |
| Literary output | `src/moments.mjs`, `src/prose.mjs`, `src/editorial-*.mjs`, public projection and scene renderer | Keep the same output contract. No numerical scores appear on the page. |
| Reservoir health/refill | `src/scene-reservoir-health.mjs`, `src/scene-reservoir-runtime.mjs` | Report coverage cheaply. Never let an addon directly request generation. |

Original measurement: **156 scene-bank rows; 22 enabled reservoir rows, 7 reservoir families, 18 distinct serialized context signatures**. **Concurrent admission work changed the checkout during revision 2:** a later fresh import measured **242 scene-bank rows; 108 enabled reservoir passages, 13 families and 36 serialized context signatures**. All 108 are single-prose-beat leaf passages and all 108 source IDs are in the 885-entry library. These numbers are dated observations, not constants to hardcode into tests or limits. Re-run the inventory before implementation because another model is editing admission data. Audit actual text before assigning motif/precursor tags; family names alone do not establish facts.

**Inventory reconciliation verified after follow-up:** the broader acceptance pool really contains **885 unique scene IDs: 813 READY/RARE entries plus 72 repaired MISBOUND entries**. The saved `reports/final-acceptance-report.json` reports **817 distinct reservoir scenes selected** across its 90-day, three-seed run. This is existing saved evidence, not a rerun during this review. The original 22 runtime rows were **individual leaf passages**, each with exactly one prose beat; they were not containers for hundreds of hidden variants. The same leaf structure holds for the later 108-row runtime import.

These counts describe different integration stages. `scripts/run-acceptance-harness.mjs` reads `data/scene-reservoir-ready-rare.json` and `reports/misbound-report.json` directly into its own `admittedPool`, then selects passages over already-committed events. The production reservoir instead imports `SCENE_RESERVOIR_BATCHES` through source-hash-bound reviews in `normalizeReservoirBatch()`. No production reference to those two harness input files was found in server, src or Cloudflare code. Thus the larger library exists, but the harness's 885 candidates are not evidence of 885 production-enabled reservoir passages.

The harness matcher is also weaker than runtime admission: it checks broad event types and locations, does not check cast presence, knowledge, weather or commitments, and permits a `common_room` area mismatch. Its digest comparison establishes that its post-processing left canonical simulation unchanged; it does not establish production eligibility or canon-safe use of all 817 passages. **Do not discard this library or author replacements because of the 22 count.** Before choosing addon content scope, reconcile those 885 rows against actual production review/eligibility gates and test the same selector used by production. Do not bulk-enable them or weaken guards to reproduce the harness number; any staged-content activation remains separate from this addon task.

Important nuance: `surface_only` still participates in the scene lifecycle: observation facts, five-minute sessions, knowledge bookkeeping, performance counts and offscreen hooks. Those deltas must not masquerade as meaningful counterfactual consequences.

## 3. Preflight: a real issue found during this review

Local `/api/observe` no longer calls reservoir maintenance. Cloudflare reservoir maintenance is in `WorldDurableObject.alarm()`, and its observe route does not invoke refill. **Local observe still calls `cinematics.ingest()`, whose enabled path can generate live cinematic text.** The existing Node boundary test disables cinematics and asserts an unconnected `clientCallCount`; it does not prove all model calls are impossible.

Before enabling any addon:

1. Preserve generation OFF. Trace observe, presence, live and alarm paths in the current checkout; another model may have changed them.
2. Add a spy at the actual cinematic/refill clients and persistent reservation store. With generation flags enabled in a mock environment, repeated observe/presence traffic must produce zero authoring and zero new reservations.
3. If the legacy cinematic authoring path remains, make request-time ingestion authored/cache-only. Do not move live narration into an alarm. Only approved reservoir replenishment belongs on the scheduled authoring lifecycle. Test actual method calls, not a local variable that is never incremented.
4. Verify local and Cloudflare adapters. This review inspected repository code and mocks, not a deployed Cloudflare instance.

This is a prerequisite within the existing invariant, not authorization to turn generation on or redesign cinematics.

## 4. Shared invariants and the small integration seam

There are two kinds of state:

- `x`: canonical characters, facts, journeys, commitments, events and queues.
- `y`: private deterministic selection memory: motif fields, evidence summaries and any seed estimates.

Because `y` can influence future canonical choices, **persist and replay it with `x`**. It is not disposable per-viewer state. Viewer counts, HTTP timing, animation frames and whether a background calculation happens to finish must not influence it. Viewer presentation may reveal already-committed material more richly without changing either history.

Use one versioned optional `state.narrativeSignals` field, created at an explicit future rules activation boundary, with matching fixture and rules-version handling. Defaults are neutral; disabled hooks must not even materialize an empty field in old state. Store bounded fields, source IDs and simulation-time watermarks, not paragraphs or every historical event. Use existing ledger mutation helpers so rollback/restart work. Never silently recompute old choices under new rules.

**Upgrade/restart gate:** changing `RULES_VERSION` alone is not a migration. Local `WorldStore`/startup checks reject a changed persisted identity. The Cloudflare initialization path does not perform the same identity check and reconstructs its fixture using the current watermark day. Before deployment, test an explicit reviewed upgrade on a copied existing database in both adapters: retain its true epoch, seed, committed events, watermark and pending queue; activate the new behavior prospectively and preserve old replay semantics. Never delete/reseed the database, merely overwrite its version to silence a mismatch, or enable midway through a pending action. If a safe existing-world upgrade is not available, keep the experiment in isolated fixtures and report deployment blocked.

Choose an explicit ledger mapping for the new selection state using the existing `set()` pattern. Audit readers already recognize `director`/`story` metadata, but some continuity tests require conversations to contain only director changes. Do not use `setWorld` or broadly relax those tests. Add only the precise bookkeeping allowance needed, and explicitly include `narrativeSignals` in forward/reverse replay assertions (several assertions list fields manually).

Proposed small pure modules (names are proposals, not files that already exist):

```text
src/narrative-signals.mjs       evidence extraction, motif state and bounded scene bias
src/counterfactual-value.mjs    normalized metrics and bounded legal-choice bias
lab/shadow/canonical-fork.mjs  isolated forward-reducer evaluation; lab first
```

Keep source tags in a reviewed map keyed by scene ID and source hash. Suggested fields:

```js
{ sceneId, sourceHash, motifs: ['shared_recovery'],
  evidenceKinds: ['supporting_result'], subtlety: 0.5 }
```

This map only annotates existing admitted content. Unknown IDs, source hash mismatches or unsupported evidence mean zero bias. It cannot weaken `reservoirSceneEligible` or add runtime approval.

Preserve the scene-selector order exactly:

```text
Nimbus / authored priority and existing bookings
→ existing actor, knowledge, location, time, arc and context eligibility
→ scene / family / pair cooldowns and director spacing
→ existing fewest-performance tier
→ bounded SPECTRA + MORPHOS bias within that tier
→ deterministic keyed tie-break / weighted selection
→ existing booking, signed action and commit-time revalidation
→ existing prose and UI
```

Do not attach CSV to prose alternatives. It belongs to the separate ordinary intent-choice seam. Keep existing no-op opportunity rejection and daily budgets; no addon may manufacture extra opportunities just to spend its score.

## 5. SPECTRA: correct the mathematics before coding

For a locally smooth autonomous discrete system, `tau = -DeltaT / ln(rho)` only describes an asymptotic recovery envelope when `0 < rho < 1`. It is not a universal tipping-point detector, especially with time-varying forcing or non-normal dynamics. Critical slowing down has documented applicability limits: [empirical research](https://www.nature.com/articles/s41467-023-43744-8).

Arithmetic checks in our harness:

| rho | Recovery in steps |
|---|---:|
| .487 | 1.390 |
| .839 | 5.697 |
| .998 | **499.500**, not 412 |
| .621 | 2.099 |
| .963 | 26.524 |

The actual Worldstream reducer has:

- **Integer** trust/concern/irritation. A fractional trust perturbation fails `assertCanonState` with `Relationship bounds violated`.
- Trust retained until an event changes it; it is not mean-reverting.
- Pressure `max(baseline, carried - .14)` at daily reset. Away from the floor its derivative is 1 despite completely ordinary finite-time decay. In the real reducer test, `.90 → .76` and the perturbation derivative is approximately 1.
- Discrete faction postures and condition expirations. Tiny perturbations cannot reliably predict crossing their branches.

Therefore **do not build a 16–30 variable world Jacobian, label rho=1 as instability, add fictional continuous suspicion variables, or reuse that invalid matrix for CSV**. A stable toy matrix `[[.8,4],[0,.8]]` also initially amplifies a disturbance 4.079× despite rho=.8; eigenvalues alone miss transient amplification.

Build the useful part as an evidence-backed sensitivity diagnostic:

1. Read known unresolved interruptions, existing pressure residue and genuinely conflicting future commitments. Keep source fact/event IDs and the existing predicates that justify each signal.
2. For the initial runtime version, use bounded exact discrete evidence, not a spectral forecast. Example: `supportingRelationshipChoice` already distinguishes a remembered interrupted meeting from ordinary company. That may favor an eligible shared-recovery passage only if its text fits the evidence; it cannot make someone angry or invent a missed meeting.
3. In the lab, compare legal, one-band/state-valid interventions using the canonical fork from step 8. Do not inject synthetic knowledge into production. Measure normalized difference at fixed horizons and note decay, persistence or amplification. An unchanged trust band is persistent memory, not rising fragility.
4. Only promote a diagnostic to runtime if it predicts an existing downstream branch on held-out fixture cases better than existing pressure/history alone. If it adds no information, keep the simple evidence view and leave spectral analysis out.

Initial scene contribution: `f = confidence * affinity * subtlety`, each in `[0,1]`, with **zero when evidence is missing or context contradicts the prose**. Cap its log-weight at `ln(1.25)`. These are conservative pilot constants, not proven optimal settings. Do not claim inferred eigenmodes or future payoffs.

## 6. MORPHOS: a stable motif-memory pilot

Start with at most four motifs supported by reviewed admitted passages, such as shared recovery, companionship, practice and everyday competition. No missing-object motif until real inventory/transfer facts and appropriate content exist. No new object, rumour or magical-contamination simulation.

Use at most 32 existing actor/place anchors and 128 links in the pilot. Derive links only from actual locations/co-presence and allowed existing relationships. Objects may be anchors later only if an authoritative object identity/holder is already recorded. Adjacency is editorial affinity, **never a knowledge-transfer channel**. A connected actor still needs the existing knowledge gate to say anything.

For each motif, build a nonnegative row-stochastic neighbor matrix `P`; isolated nodes self-loop. If mixing edge types, normalize each available layer and use nonnegative weights summing to 1. Sort IDs deterministically. With the conventional Laplacian `L=D-A`, diffusion has sign **minus L**, not plus L: [NetworkX definition](https://networkx.org/documentation/stable/reference/generated/networkx.linalg.laplacianmatrix.laplacian_matrix.html). Use `Pz-z` to avoid sign ambiguity.

The first build should use the tested bounded approximation, not an uncalibrated cubic excitable medium:

```text
Delta = 0.25 simulation hours
B_D(z) = (1 - Delta*D) z + Delta*D Pz
A_next = exp(-Delta/8) * B_0.2(A)
I_next = exp(-Delta/2) * B_0.5(I)
```

After a whitelisted new committed event, deposit a local pulse `A=min(1,A+.6)`, `I=min(1,I+1)`. Interpret `A` as theme memory and `I` as short-term suppression. Initial local affinity is `.6-1=-.4`; suppression decays faster and permits a modest later echo. Existing hard family/scene cooldowns still win. Use `M=clamp(A-I,-1,1)` averaged across a candidate's actual anchors, never summed across cast size. Cap its log contribution at `ln(1.4)*M`.

Why it is stable: `0 <= Delta*D <= 1`, so `B` is a convex combination. Decay is at most 1 and pulses are bounded. With no new pulses, the maximum decreases exponentially. In the four-node test, one pulse produced later positive local affinity `.1661`, never reached the disconnected node, and decayed below `1.3e-40` after 30 mathematical days. Chunked execution plus JSON restart matched exactly. **This demonstrates bounded fading motif memory, not emergent Turing waves or a proven mini-story.**

**Timing gate found on review:** that same pulse's affinity is only `.03877` at 12 hours and `.001668` at 36 hours. With `ln(1.4)*M`, those are approximately **1.013× and 1.00056×** weight changes. Ordinary scenes have a 12-hour gap and the same reservoir family a 36-hour cooldown. The attractive early peak may therefore be gone before a useful eligible choice exists. The numerical constants above are a lab baseline, not approved production tuning. Log affinity at real eligible opportunities before wiring live selection. Retune only the field time constants if measured opportunities justify it; never weaken established cooldowns to make the demonstration work. If no useful eligible echo exists, leave MORPHOS neutral.

Clock semantics must be explicit: use fixed epoch-aligned quarter-hour buckets, fold earlier committed pulses in canonical event order, and apply each pulse once. No advancement per request. Decide topology only from committed state at that bucket boundary; do not use today's graph to diffuse yesterday's field during catch-up. If a private reducer tick is needed, put it in the existing queue, after ordinary actions at the same timestamp using a documented priority, with a unique bucket ID and at most one pending tick. Never choose a different numerical step according to how late a request arrived.

Exponentials do not become exactly zero promptly. At bucket boundaries, if the maximum A/I value for an entire motif is below `1e-6`, set that motif to zero deterministically. Retire its bounded source references and stop scheduling ticks when all motifs and pending pulses are empty. A later canonical pulse restarts at the next fixed boundary. The revised test reaches exactly zero; the earlier untruncated mathematical residual was about `1.23e-40`. Test revival, same-timestamp ordering, topology changes and no duplicate ticks as well as restart. A retained source cursor or event-owned idempotence must prevent expired source-reference cleanup from allowing an old pulse to be applied again.

Only the original canonical source may excite a theme. A selected echo/scene observation must not re-excite it indefinitely. Deduplicate by source event ID within the ledger-owned update, expire old source references and keep repeated passage exposure in existing cooldown systems. Do not attach a new relationship change to motif propagation.

## 7. Combined weighting and reservoir coverage

The proposal's independent maximum multipliers multiply to **2 × 1.7 × 1.8 = 6.12**. In a two-choice example a 10% base candidate would become 40.48%; that is not a small nudge.

For raw shortlist contributions `s_i`, compute `v_i=s_i-min(s)` and `b_i=v_i*min(1,ln(2)/max(v))`, treating an all-zero range as all-zero bias. This limits the largest-to-smallest addon weight ratio to 2 without stretching tiny differences to the maximum. With a 2× relative bias the example becomes 18.18%. Do not let each candidate independently range from -ln(2) to +ln(2), which would allow a 4× relative bias.

Use the **same existing per-scene hash** for biased and unbiased ranking, not a different random draw when any signal becomes nonzero. One suitable race uses `u_i` derived monotonically from that hash and picks minimum `-log1p(-u_i)/exp(b_i)`, with stable full-hash/ID tie-breaking and `0<u_i<1`. Equal weights then preserve the original ascending-hash order; explicitly preserve the original path for equal biases to cover floating-point ties. A tiny signal should change a winner only near a real rank boundary. Treat the weighted probability interpretation as across keyed draws, not proof of changed frequency in one deterministic world. Temperature is fixed at 1 in the pilot.

If CSV eventually passes its directional-value gate, retain the intent branch's 4:3 prior and cap its separate relative multiplier at 1.25. Preserve the existing `%7 < 4` result exactly at zero bias. Do not feed seven coarse midpoint buckets directly into a continuous weighted threshold: a small multiplier may then change no decisions at all. A fixed additional keyed fraction inside each existing bucket can provide resolution while preserving which side of 4/7 the original draw occupied; test zero-bias parity and do not alter exogenous random keys.

Keep `maxBeatsPerDay=2`, existing three-hour director gap, twenty-minute scene spacing, twelve-hour ordinary scene gap and scene/family/pair cooldowns. Do not add the proposed metabolic state; these rules already provide the needed governor.

Coverage remains a hard limit. Extend offline reservoir health with counts of **reachable distinct context signatures per narrative function**, excluding staged/disabled rows and distinguishing hard ineligibility from cooldown. The measured signatures (originally 18, later 36) are distinct metadata shapes, not proof all are reachable in normal play.

The optional covariance effective-rank metric is diagnostic only: covariance with zero trace must return 0/undefined, not divide by zero; rank cannot exceed `min(feature_count, scene_count-1)`. Correlated one-hot categories and duplicated wording do not prove independent narrative responses. Do not add an eigensolver just to count content variety.

## 8. CSV: bounded forward comparisons of real choices

**Lab first. No runtime shadow execution until parity and cost gates below pass.** Existing `lab/shadow` checks prose against history; it is not a canonical forward fork. Do not call it an already-working twin-world engine.

The first eligible seam is the final `ordinary_preference` branch in `chooseIntentMotive`, currently loyalty/ambition with a 4:3 seeded prior. Leave current duty, fatigue, commitments, remembered repair and recent-activity branches untouched. Candidates are permitted intent decisions, not imaginary umbrellas, shift swaps or forced authored outcomes. Action issuance and resolution remain owned by existing intent code. Enumerate both alternatives once; the seeded baseline is already one of those alternatives, not a third different branch.

A fork must contain canonical state, complete pending queue, stable action IDs, epoch, seed, rules version and simulation time. It must use the same reducer, follow-up insertion and dueAt/priority/id ordering. Copy source data into an isolated in-memory store; never pass a production DB handle or model/service client. Reuse the real reducer rather than writing a simplified agent simulator. First prove its no-intervention run equals `WorldStore.advance()` including pending actions.

Branch A selects candidate c at the identified free decision. Branch B takes the normal baseline alternative at the **same** opportunity. Do not remove mandatory actions or insert arbitrary state patches. Override only that one legal decision using a test/evaluation adapter, then resume normal rules. Disable nested CSV and all new narrative nudges in both branches so the evaluator cannot award itself value for its own subsequent steering.

Existing randomness is mostly hashed from seed/version/date/action IDs. Keep exogenous keys identical between twins; audit any path using event counts, changed parent IDs or state-dependent keys. A matching starting seed alone is insufficient. Treat independent alternative futures as separate paired environments with shared exogenous keys within each pair, not unrelated seeds per branch. Do not claim robustness from repeating the identical deterministic future three times.

Use fixed normalized **subsystem** features `phi(x)` (initially four groups):

1. Meaningful, provenance-backed relationship outcomes.
2. Existing commitments/results and known interruptions, normalized by bounded duration/count.
3. Existing thread progress/results.
4. Distinct currently eligible meaningful intent/event families, checked with real predicates.

Exclude prose, timestamps by themselves, UUIDs, event totals, observation facts, scene counters, cosmetic knowledge and numerical motif fields. Compare categories by explicit same/different meaningful outcome, not arbitrary numeric IDs. Do not count a changed five-minute scene booking alone as a useful consequence. Require a whitelisted causal path from the intervention to a substantive result. Do not invent more continuous state dimensions to make breadth larger.

**Divergence is not value.** The norm/entropy formula below gives identical scores to positive and negative versions of a trajectory. Also, a seeded baseline compared with itself gets zero while any different choice may score positively. Neither property justifies preferring the alternative. Call this score **causal sensitivity** in the lab. Runtime CSV stays disabled unless a reviewed, directional outcome rule identifies a worthwhile delayed consequence relative to the baseline and rejects prohibited disruption. Examples must be grounded in actual existing completed commitments or genuinely additional legal opportunities, with explicit costs for incompatible disruption; do not invent an opaque happiness score or automatically treat all conflict as either good or bad. Unknown, zero or negative reviewed gain means no bias. Equal sensitivity cannot break a tie. Test matched beneficial/harmful and baseline-label-swapped cases before claiming useful seed selection.

Sample immediate difference `delta_0` directly after the target action commits in each fork. Do not use a one-hour sample as 'immediate': the current intent can already have completed within that hour. Then sample future differences at actual elapsed times `t=[1,2,4,6]` hours. The following uses explicit right-endpoint quadrature; it is a bounded heuristic, not a continuous-time trajectory proof:

```text
d_h = norm(delta_h)
E_now = norm(delta_0)
dt_h = t_h - t_(h-1), with t_0=0
w_h = dt_h * exp(-(t_h - 1)/6)
E_late = sum(w_h*(t_h/6)*d_h) / sum(w_h*(t_h/6))
z_j = sum(w_h * abs(delta_h,j))
B = exp(-sum(p_j*ln(p_j))) / number_of_groups, p_j=z_j/sum(z)
P = sum(w_h * indicator(d_h > .01)) / sum(w_h)
O = max(0, ln((1+distinct_reachable_families_c)/(1+distinct_reachable_families_0)))
sensitivity = Q * P * B * log1p(E_late/(.05+E_now)) * (1+min(.5,O))
choice_bias = 0 unless a separately reviewed positive outcome gain is established
```

Define zero impact as sensitivity=0 before dividing by `sum(z)`. Validate strictly increasing finite checkpoint times. Weight actual elapsed hours, not sample indices, because the checkpoint intervals differ. P measures persistence at these samples; it does not prove an effect remained continuously present between them. Use fixed subsystem normalization and denominator floor `.05`, not an arbitrarily tiny epsilon. Raw-unit conversions followed by the same physical normalization must leave scores unchanged; arbitrarily rescaling already-normalized differences should not. For O, count distinct currently eligible families at the common final checkpoint using real predicates, not a prediction of all theoretically reachable future states. Options mean different legitimate families, not extra paraphrases or duplicate scene rows. Invalid/incomplete rollouts produce unavailable/neutral scores, never a preferred result.

`Q` is a reliability factor only if measured across paired environments. Initially label one deterministic pair as **unvalidated robustness**, use it for lab rankings, and do not claim Q=1 is established. Before runtime enablement, validate sign/rank consistency across a small fixed offline fixture set. If multiple paired futures are later justified, specify which checkpoint/outcome vectors define the mean/covariance and guard zero variance/zero effect. Direction-sensitive Q can penalize different equally useful outcomes; it is a heuristic, not a probability of literary success.

Revised elapsed-time synthetic checks gave routine=.0267, delayed seed=.8326, loud fading disturbance=.2441. Zero and microscopic changes scored zero. A separate test gave **the same .5878 sensitivity for positive and negative effects**, proving why a directional outcome gate is needed. These are synthetic unit tests, **not evidence that Worldstream already produces useful causal trajectories**.

Do not implement the proposed Gramian as a cheap dependency on SPECTRA. The current world has no valid shared J. A log-determinant of impulse responses also is not proof of reachable scene count or state-space volume for a single deterministic intervention. A cheap first filter can use explicit approved consequence types; then evaluate only the two ordinary intent alternatives.

## 9. Costs and deterministic limits

No added model calls. LLM costs stay unchanged; these modules never call clients or refill reservation methods. Keep generation OFF and retain the existing enablement/authorization/budget guards. Current scheduled `SceneReservoirRefill` has no viewer input; do not claim it already guarantees zero calls in an empty world when enabled. Earlier zero-viewer spending requirements and later scheduled replenishment instructions need an explicit policy decision before anyone enables it. This addon work must not silently choose that policy or enable generation.

MORPHOS pilot arithmetic: four motifs × 32 anchors × two Float64 fields = **2,048 raw bytes**. Persist ordinary JSON arrays/maps, not unhandled typed arrays. JSON, IDs and ledger evidence cost more; measure serialized size and cap it at 16 KiB with bounded references. At 128 directed neighbor entries and 96 buckets/day, two sparse field updates require roughly `4*2*128*96 = 98,304` edge accumulations/day plus O(nodes) work. An undirected edge stored in both directions counts twice. A private tick can add **96 committed bookkeeping events/day** when active, compared with 107 baseline events in the smoke fixture; a full 16 KiB field image each time would be 1.5 MiB/day before overhead. Measure ledger bytes, queue entries and transaction cost, not just arithmetic. Do not claim this is negligible or schedule forever after a pulse has expired.

The original 24-hour Node in-memory smoke run processed **107 reducer actions and committed 107 events**; `advance()` took about 46–63 ms in isolated runs and 309 ms during a parallel test run. This reducer/store currently emits one committed event per action; the revised harness records both rather than assuming they are interchangeable in every future version. Catalog changes may change these counts. This is **not a Cloudflare CPU estimate** or a mature-world clone benchmark. Use the latest measurement artifact rather than treating these noisy timings as a performance guarantee.

For the two-alternative intent pilot, the baseline is one alternative: there are **two unique branches**. At the measured baseline action density, a six-hour pair averages approximately `2 * 107/4 = 54` reducer actions, before clone/queue cost and any private ticks. This average is not a worst-case bound, especially at busy evening opportunities. Three environments over 24 hours for five nonbaseline candidates plus a shared baseline would cost approximately `3 * (5+1) * 107 = 1,926` actions. A central-difference 30-variable Jacobian needs at least 61 branches before any longer recovery study. These estimates are illustrative; measure processed actions, follow-ups and serialized clone size on actual candidates.

Pilot limits: two intent alternatives; an immediate post-action sample plus checkpoints at 1, 2, 4 and 6 simulation hours; **128 reducer actions total per branch across all checkpoints**, not per checkpoint; at most one evaluated opportunity per six simulation hours. Count bookkeeping ticks and all follow-ups. If either branch cannot complete the common horizon, the entire comparison is unavailable; never compare a truncated branch to a completed one. Six hours can assess near-term consequences only; do not advertise multi-day setup detection. Longer lab horizons require separate measured budgets.

CPU measurements decide whether to deploy a fixed deterministic configuration; they must not decide which branch wins at runtime. A wall-clock timeout, cache-ready race or queue priority based on viewers would make canon depend on load. Cache keys must include relevant state/queue digest, opportunity ID, seed, rules and evaluator versions, and horizon. Cached and recomputed values must agree. If this cannot fit production's measured CPU allowance, ship CSV as offline analysis with zero runtime bias. Do not compensate with live LLM generation.

## 10. Build order with explicit completion gates

### Step A — preserve baseline and instrument boundaries

- Read current git status and preserve other models' work. Capture rules version, enabled catalog, current tests and committed baseline fixtures.
- Close/instrument the legacy live-authoring boundary described in section 3.
- Create neutral optional hooks. With addons disabled, semantic snapshots, queue, prose and API fields must match the baseline exactly.
- Resolve the existing-world upgrade/replay gate on copied data before preparing any production activation. Keep other models' admission-audit work intact.

### Step A2 — demonstrate an opportunity for the additions to matter

- Reconcile the 885-source library with runtime review/eligibility without activating staged rows. Reuse any current admission census instead of duplicating it.
- In a small baseline sample, instrument the actual scene selector: record shortlist sizes **after** hard gates, cooldowns and fewest-performance filtering. Count opportunities with at least two choices carrying different valid motif/evidence tags. One candidate or identical tags means these weights cannot improve selection.
- Measure field affinity at those actual opportunity times, including the 12-hour and 36-hour constraints. If weighting has no practical scope, stop the live SPECTRA/MORPHOS integration there; report the content/admission limitation rather than changing pacing or building inactive machinery.

### Step B — annotate admitted content and implement MORPHOS

- Add a reviewed ID/hash metadata map for existing eligible passages. Report unsupported motifs instead of inventing content or importing staged batches.
- Implement fixed-time bounded fields and source deduplication through the canonical reducer. Persist/replay state atomically.
- Add rank only within `sceneBankAfterAction`'s existing least-played tier. No change to opportunity frequency, Nimbus priority or eligibility.
- Tests: positivity/bounds; no disconnected propagation; source applied once; no echo feedback; expiry; chunked catch-up/restart equality; cooldown and priority remain sovereign; missing tags give neutral score.

### Step C — implement evidence-backed SPECTRA

- Add exact supported evidence views, source IDs and context matching. No new canonical emotional meters.
- Prove that actual unresolved outcomes affect the signal and resolution/expiry removes it. Invalid knowledge or an irrelevant source must not produce precursor bias.
- Compare with the existing pressure/history baseline on held-out examples. Leave unsupported spectral forecasts disabled.

### Step D — build and validate canonical forks, then CSV

- Prove baseline fork parity, action ordering, queues and source immutability before trying interventions.
- Pilot only ordinary loyalty/ambition decisions. Show one actual downstream substantive difference and one true no-effect case, with source chains. If the limited choice has no useful delayed differences, record that and keep CSV neutral; do not enlarge simulation scope to manufacture success.
- Tests: same exogenous randomness; different branch consumption cannot shift weather; mandatory choices bypass scoring; incomplete fork neutral; no recursive scoring, I/O or model calls; cosmetic changes zero; raw-unit conversion plus fixed normalization; deterministic cache/restart; hard cap on actions and relative bias.
- Prove immediate-effect sampling, actual elapsed-time discounting, directional outcome acceptance/rejection, and baseline-label symmetry. A sensitivity-only prototype does not pass runtime activation.
- Measure representative mature-state clone/evaluation cost in Node and the Cloudflare adapter. Runtime remains disabled until acceptable cost and deterministic parity are demonstrated.

### Step E — small comparative simulation and reader acceptance

- Run three fixed seeds for 24 hours and seven days, baseline and candidate. Use existing continuity/replay validators. No 210-day soak for this experiment.
- Compare worlds advanced in one call, hourly calls, simulated observer arrival/departure and restart. For the same seed/rules, canonical history must be identical across observer schedules.
- Compare opportunity counts, authored-arc completion, skipped commitments, family exposure concentration, scene repetition and routine/no-event share. A new motif must not defeat existing novelty or concentrate the entire page on one family.
- Read matched samples blind: ordinary life, one interruption, recovery, travel context and an authored passage. Require plausible causal continuity and improved thematic connection without more repetitive symbolism or ominous prose. Metrics alone cannot establish this.
- Keep the existing public payload and renderer contract. Browser spot-check should show the same layout, plates, weather/audio/travel, with only differently selected legitimate content.
- Run focused tests while developing; the full existing suite once before handing off. Report unimplemented/deferred capabilities honestly.

## 11. What was actually tested for this plan

Reproduce from `worldstream-server/`:

```powershell
node --test lab/harness/three-addons-feasibility.test.mjs
node --test test/relationship-choices.test.mjs test/scene-bank-lifecycles.test.mjs test/observe-refill-boundary.test.mjs
```

Results after this review: **all 28 focused checks passed together: 11 feasibility checks plus 17 existing tests**. The feasibility harness includes a real 24-hour comparison: hourly catch-up plus reads matched one advance, and repeated projections did not change history. It also checks the real reducer's pressure derivative, rejects fractional trust, tests a 30-day tiny motif field and synthetic sensitivity rankings, demonstrates unsigned-value ambiguity, and checks neutral weighted ranking. The field test is not a 30-day full-world soak. The combined run began with the earlier catalog snapshot; this is not full-suite certification of concurrent admission changes. The new scheduling, migration and directional-value requirements remain future implementation gates, not tests claimed as already passed.

Machine-readable measurements: `lab/THREE-ADDONS-FEASIBILITY.json`. The tests and this document are the only additions for this planning task. No addon was wired into runtime, no generation enabled, no staged batch imported, no production deployment performed.

## 12. Definition of done

The same website presents coherent existing prose, selected with small evidence-backed thematic improvements. Real free choices may receive a tested causal-value nudge only where proven useful and cheap. Canon, authored priorities, knowledge and persistence remain authoritative. Observer traffic changes no canonical choices and authors no text. All unsupported forecasts return neutral scores.

Stop after these bounded additions pass their gates. Do not introduce a replacement simulation, fabricated continuous state, unreviewed content, UI widgets or another expansion phase to satisfy a mathematical metaphor.
