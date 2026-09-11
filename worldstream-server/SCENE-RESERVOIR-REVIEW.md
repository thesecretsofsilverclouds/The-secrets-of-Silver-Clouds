# Scene reservoir subsystem — repo-grounded review

**Status of the code under review:** uncommitted, preserved verbatim on branch
`snapshot/mixed-tree-2026-09-11` (commit `c372ecb`) and on disk at
`SilverClouds_Project/worldstream-mixed-tree-2026-09-11/`. Authored by another
coding model working from `WORLDSTREAM_PROSE_RESERVOIR_SPEC.md`; that session
ran out of context before it could review or commit. Treated here as an
incomplete handoff, not as foreign code.

**What this review is:** every file read against the current runtime on `main`
(`82b81a9`), with the thirteen questions from the brief answered per file, then
a repair plan that keeps what is sound. Nothing in Bucket B has been modified.

**One-paragraph verdict.** The architecture is the one we planned, and most of it
is built well: content-hash-bound staged/accepted review, a coverage-based
health ledger that measures usable depth rather than raw count, a bounded and
durably-reserved refill with quarantine and explicit admission, off by default
and not enabled in any config. Four things need deciding or repairing before it
is trusted: the per-entry eligibility gates are defined, tested and **never
called at runtime**; the refill is **gated on live viewer presence**, which is
the coupling we rejected; the domestic editor was **rewritten** rather than
extended, replacing the approved Checkpoint 1 with flat lines, dropping
semantic admission and changing the selection salt; and a handful of new
travel-arrival passages carry **canon and voice errors** (a cathedral
Sanctuary). Alongside those, the other model found and fixed a real invariant
violation in the reader that we had not seen.

---

## 1. File-by-file

### `src/scene-reservoir-data.mjs` (4 757 lines)
- **Purpose.** Batch 01 verbatim: 140 entries in 15 families, all
  `effect_policy: surface_only`, plus `SCENE_RESERVOIR_REVIEWS` — 140 review
  rows, **22 accepted, 118 staged**, each staged row carrying a reason
  ("Pendant warmth is an unverified magical response; the existing simulator
  does not prove that response").
- **Matches architecture.** Yes. This is Checkpoint 3 done the way the spec
  asks: the source retained whole, activation bound to a content hash.
- **Complete.** As a first batch, yes. The 118 staged rows are the honest
  answer to "which of these can the runtime actually prove", not a backlog.
- **Tests.** `scene-reservoir.test.mjs` asserts 140 retained / 22 unchanged.
- **Integration.** Read only by `scene-reservoir-catalog.mjs`.
- **Incorrect assumptions.** None found in structure. The 22 location/gate
  mappings were spot-checked, not audited one by one; because health matches
  demand on exact `location/area`, a wrong mapping starves silently rather than
  failing loudly. Worth a pass by eye before the batch is trusted.
- **Model path / can generation fire / determinism / mutation / presence /
  quarantine / health.** Not applicable — data only.

### `src/scene-reservoir-catalog.mjs` (131 lines)
- **Purpose.** `normalizeReservoirBatch` turns a batch plus reviews into
  scene-bank-shaped scenes; `reservoirSceneEligible` evaluates an entry's own
  gates (`triggerTypes`, `activitiesByActor`, `minimumActivityMsByActor`,
  `weatherCodes`, `dayparts`) against a scene context; the module exports
  `SCENE_RESERVOIR_CATALOG` (22 scenes) and an import report.
- **Matches architecture.** Yes. Only explicit `surface_only` is admitted;
  unknown actors, unknown locations and `basement` fail closed; a review that
  narrows the location needs a written reason; `hammond` is aliased to
  `kartel`.
- **Complete.** **No — the gates are never enforced.** `reservoirSceneEligible`
  is referenced only from its own test. `scene-bank.mjs` on the snapshot is the
  committed file, so the 22 scenes fire through the generic `eligible()`
  (location, area, cast, free) and their trigger/activity/weather/daypart
  conditions are ignored. Health, meanwhile, *assumes* those gates when it
  counts demand, so health and runtime disagree about what an entry needs.
  This is the largest gap in the subsystem and almost certainly the write that
  was lost at 21:10.
- **Tests.** Eight, including revalidation-at-commit for the storm scene and
  the "night and elapsed-activity prose cannot borrow unrelated time" case.
  They test the function; nothing tests that the bank calls it.
- **Integration.** Concatenated onto `SCENE_BANK_CATALOG` in
  `scene-bank-catalog.mjs` (`.concat(SCENE_RESERVOIR_CATALOG)`), which is why
  the catalogue reads 156 on the snapshot and 134 on `main`.
- **Incorrect assumptions.** `TITLES` maps only seven of the fifteen families;
  the rest fall to "A passing moment". Cosmetic.
- **Determinism.** Selection stays the bank's seeded hash; nothing here adds
  a clock or a random source.
- **Mutation.** None. Entries are `effectPolicy: surface_only` with no
  dependencies and cannot write proofs or nimbus state.

### `src/scene-reservoir-health.mjs` (80 lines)
- **Purpose.** `sceneReservoirHealth(snapshot)` — per family: approved, fresh
  (past `sceneDays`), eligible-fresh (fresh and not cooling by family or pair),
  and 72-hour demand (committed public events whose type, location, area and
  witnesses would satisfy an entry). A **deficit** exists only when a family's
  exhausted scene has been demanded at least twice and no fresh alternative in
  the family matches those same events.
- **Matches architecture.** Yes, and this is the part I was most worried about.
  It measures **usable coverage**: "an unused scene in another room/cast cannot
  conceal this signature's gap" and "temporary family/pair cooldowns never
  manufacture a content deficit" are both written in and both tested.
- **Complete.** Yes for its scope.
- **Tests.** Eight, including "coverage queries are deterministic, immutable
  and never count as use".
- **Integration.** Called from the refill tick with the presentation snapshot.
- **Incorrect assumptions.** Pair-cooling compares `cast.join('|')` unsorted,
  so `['goaden','ashai']` and `['ashai','goaden']` are different pairs. The
  bank's own neighbour rule (`sceneSpent`, `82b81a9`) sorts. Repair: sort here
  too, or import the bank's predicate.
- **Model path.** None. **Presence.** Not consulted. **Mutation.** None —
  returns a frozen report.

### `src/scene-reservoir-refill.mjs` (261 lines)
- **Purpose.** `SceneReservoirRefill.tick()` — reads health deficits, keeps a
  durable reservation before any call, invokes a client for one batch of eight
  treatments of one archetype, screens the batch (schema, metadata identical
  to the archetype, length, near-duplicate against the cache), runs the
  validator, and stores survivors in `quarantine` with `approved: false` and
  `provenance: 'bounded_model_batch'`. `admitSceneRefillCandidate` is the only
  path to `approved`, and it is explicit — "never a consequence of parsing
  successfully". `openAISceneRefillClient` is the transport.
- **Matches architecture.** Mostly, and the budget is the one we asked for:
  batch 8, **1 call/day, 4 calls/month**, one family per 24 h, 25 s timeout,
  a deficit must persist 60 s and recur on a later tick. A crash after the
  reservation consumes the allowance and never retries. `store: false` on the
  provider request.
- **Complete.** Yes as a module. **No path from `approved` quarantine into the
  live catalogue exists** — an approved candidate stays in `scene_refill_state`
  until a human runs the importer with it as a new batch. That is the shadow
  posture we want, and it should be stated as a design rule rather than left
  as an absence.
- **Tests.** Fifteen, all with a stub client; no test touches `fetch`.
- **Integration.** `world-durable-object.mjs` calls `tick()` from alarm
  maintenance with `waitUntil`, never from a request handler.
- **Incorrect assumption — the one that matters.** The tick returns
  `no_viewers` unless **both** the maintenance snapshot and an independent
  registry recheck prove a live external audience within the last 60 s, and
  each viewing session may spend at most one call (`session.spent`). The other
  model's tests make the intent explicit: "no viewer… make zero calls",
  "arrival alone… never trigger a refill" — presence is a *veto* ("don't spend
  on an empty room"), not a trigger. It is coherent, and it is still the
  coupling we rejected: whether a call happens depends on who is watching,
  refill can never run in the quiet when it should, and a viewer's session is
  what unlocks a spend. It reads as inherited from the cinematic path ("Same
  dependency-free Responses transport as the existing cinematic client").
  **Decision needed:** drop the presence gate and let health alone drive the
  budget, which is what the spec describes.
- **Model path.** `openAISceneRefillClient` → `https://api.openai.com/v1/responses`.
- **Can generation fire in production.** **No.** It requires
  `RESERVOIR_REFILL_ENABLED === 'true'` **and** `OPENAI_API_KEY`; neither is set
  in `cloudflare/wrangler.toml` (checked), and the runtime constructs no client
  without both.
- **Determinism.** Generation is not selection. Nothing generated can be
  selected until imported through the reviewed path.
- **Mutation.** Writes only `scene_refill_state`. Cannot emit an event.
- **Quarantine / validation.** Yes, both, in that order, with admission a
  separate explicit step.

### `src/scene-reservoir-approval.mjs` (84 lines)
- **Purpose.** `validateSceneReservoirCandidate` — the automatic admission
  lane. A candidate passes only if every source sentence survives in order,
  quoted dialogue is verbatim, no proper noun or risk word appears that the
  source lacks, no spoiler trips `findSpoilers`, and the only permitted
  changes are a small fixed phrase-equivalence vocabulary. Anything freer is
  quarantined for a human.
- **Matches architecture.** Yes — conservative in the right direction. It
  cannot admit a new fact.
- **Complete.** Yes. Note the lane is narrow enough that automatic approval
  will admit near-paraphrases only; real variety will come from human review
  of the quarantine. That is acceptable and should be said out loud.
- **Tests.** Covered through the refill tests ("malformed batches, metadata
  contradictions and validator rejections cannot enter the cache").
- **Model path.** None. Reuses `properNouns` and `findSpoilers`.

### `src/scene-reservoir-runtime.mjs` (65 lines)
- **Purpose.** Factory: creates the `scene_refill_state` table, wires health →
  refill → validator, exposes `decorate(event)` and `tick()`.
- **Complete.** **`decorate` is a no-op** (`return event`) and is wired into
  every read path in the DO, `service-world.mjs` and `public-history.mjs`. The
  comment says "Reading selects cached text", i.e. read-time selection of
  reservoir prose was intended and not built. It should either be removed, or
  built as deterministic selection keyed on committed event identity — never
  on page load, which is precisely the reader bug the other model fixed.
- **Can generation fire.** Only with both env values; see above.

### `scripts/import-scene-reservoir.mjs` (31 lines)
- **Purpose.** Offline monthly importer: normalises a batch against reviews,
  writes a report, and with `--write` rewrites `scene-reservoir-data.mjs`.
  Existing source ids are immutable ("retain original rows and give revisions
  new ids") so a scene named in a saved ledger cannot vanish or change prose.
- **Matches architecture / complete / model path.** Yes / yes / none. Never
  reads a saved world.

### `cloudflare/src/world-durable-object.mjs` (+35/−)
- `decorateEvent` on latest, history, `eventById` and pagination (no-op today);
  a lazily-built `sceneReservoir`; `reservoirPresence` from `audience_sessions`
  within 60 s; alarm maintenance calls `tick()` and hands the generation
  promise to `waitUntil`. Correctly outside any request handler. Presence
  plumbing goes away if the gate is dropped.

### `src/service-world.mjs`, `src/public-history.mjs` (small)
- `decorateEvent` plumbing only. No behaviour today.

### `start-worldstream.mjs` (6 lines)
- **Flips the local launcher's `WORLDSTREAM_CINEMATICS_ENABLED` default from
  `'true'` to `'false'`.** Unrelated to the reservoir, unannounced, and a
  product-behaviour change to the existing viewer-driven performer. Probably
  what we want; needs to be its own decision.

### `src/editorial.mjs` (+33/−3)
- **Two changes.** (a) Travel-arrival prose gains 3–4 deterministic variants
  each for the Streamliner, Enchanted Ink, the Sanctuary, the Silver Spoon and
  the plaza — a direct answer to the audit's Streamliner-repetition and
  Sanctuary black-hole gaps. (b) **`domesticEditorial` is moved ahead of
  `generalEditorial`** in the chain, against the instruction to keep its
  placement.
- **Canon and voice, (a).** Several new lines are the "generic lyrical filler"
  the refill prompt itself forbids, and at least one set is wrong about the
  world. The Sanctuary is written as a cathedral — "vaulted ceiling",
  "stained glass threw long pools of violet", "ancient masonry", "flagstones",
  "inner aisle" — where `fixture.mjs` has it as a portal-hall attraction with
  a central hub and nightlife. "The flock of lintels circling near the dial"
  invents behaviour; "Goaden turned his music down" invents an object;
  "chalkboard specials" and "roasted beans" are stock café dressing. The
  Streamliner and Ink additions are closer to voice. Keep the mechanism,
  rewrite the lines against canon.
- **(b) needs measurement.** `generalEditorial` is not a true catch-all (it
  returns null for the domestic types, which is why Checkpoint 1 measured 90
  domestic passages a week), so the reorder only matters where both match.
  Which types those are was not established. Revert to the approved order
  until it is.

### `src/editorial-domestic.mjs` (246 lines changed: 110 in, 182 out)
- **Rewritten, not extended.** The approved Checkpoint 1 editor (`efce99e`,
  documented as a contract in `NARRATIVE-LAYERS-AND-CINEMATICS.md` §9) is
  replaced with a `v2`.
- **What was lost.** The 51 voiced variants become ~28 flat restatements of
  the description ("Goaden and Ashai began training together at the training
  grounds." / "…settled down to watch television at the common room.") — the
  status-board register the whole effort exists to remove. Semantic admission
  is gone: every meal, rest, practice-begin and game is now narrated, which is
  the diary we designed against and a frequency increase we were told not to
  pursue. The hash salt changed from `silver-clouds-domestic-v1` to `-v2`, so
  **the same committed event now selects different prose than it did**, which
  breaks stability across deploys for events already published to the live
  world.
- **What was gained, and is worth keeping as repairs to v1.** Skip when the
  event already carries `prose` or `lines` (defensive, harmless). Suppress
  `payload.outcome === 'skipped'`. **Do not narrate going to sleep as rest** —
  v1 would say "Goaden rested" for `REST_BEGIN` with `sleeping: true`; a real
  bug. Refuse duplicate or unknown participants rather than silently dropping
  them. Prefer `areaOf(location, area).name` for the room over `event.room`.
  A `trainingRelocated` line for the covered floor.
- **Tests.** `editorial-domestic-continuity.test.mjs` (8) encodes v2's
  semantics; the invariants above are good ones and survive a port to v1.

### `worldstream/app/reader-narrative.js` (−30)
- **Removes `STATIC_VARIATION_BANK` from the reader.** The removed code chose a
  stock variant by a per-page-load family counter and overwrote `prose`,
  `description` and cinematic `openingNarration` with it — so the same
  committed event read differently depending on how many earlier pages had
  loaded. That is a direct violation of "the same committed event must select
  the same prose regardless of observation", found and fixed by the other
  model. `reader-committed-prose.test.mjs` pins it ("loading an older page
  cannot select a different passage for the same committed event").
- **Keep this.** It is independent of the reservoir and should land on its
  own. `worldstream/app/prose-variation-bank.js` is now dead and should go
  with it.

### `test/scene-bank.test.mjs` (5 lines)
- Manifest count becomes `134 + SCENE_RESERVOIR_CATALOG.length`. Correct once
  the concat lands.

---

## 2. The thirteen questions, across the subsystem

| Question | Answer |
|---|---|
| Purpose | Reviewed import → coverage health → bounded refill → quarantine → explicit admission → offline re-import. |
| Matches intended architecture | Yes in shape. Two departures: presence-gated refill; read-time `decorate` stub. |
| Complete | No. Gates unwired at runtime; `decorate` empty; no approved-quarantine → catalogue path (deliberately). |
| Tests covering it | 44 across five files; pass on the snapshot; none proves the bank enforces reservoir gates. |
| Integration points | `scene-bank-catalog.mjs` concat; DO alarm `tick`; read paths (`decorate`). |
| Incorrect assumptions | Presence as refill precondition; unsorted pair key in health; cathedral Sanctuary; domestic v2 salt. |
| Model-call path | `openAISceneRefillClient` only, from alarm maintenance only. |
| Can generation fire in production | **No** — `RESERVOIR_REFILL_ENABLED` and `OPENAI_API_KEY` both required; neither configured. |
| Scene selection deterministic | Yes — the bank's seeded hash and least-played tier; nothing generated is selectable before import. |
| Generated scenes can mutate world state | No — `surface_only`, no dependencies, no proofs; a replay writes no fact (`82b81a9`). |
| Viewer presence affects refill | **Yes, as a veto and a per-session budget.** The decision to remove. |
| Generated content quarantined/validated | Yes, both, with admission a separate explicit step and a narrow automatic lane. |
| Health measures usable coverage | Yes — fresh vs cooling, demand by exact committed signature, deficits only when no fresh alternative matches. |

---

## 3. Repair plan (repair, not rewrite)

Ordered by what unblocks the most. Each is small; none touches generation.

1. **Wire the gates.** In `scene-bank.mjs` `eligible()`, after the
   status/spent check: `if (scene.reservoir && !reservoirSceneEligible(ctx, scene)) return false;`
   and revalidate at commit with `{checkTrigger:false}`. Add the one test the
   other model did not: a reservoir scene with an unmet activity gate is not
   offered by the bank.
2. **Drop the presence gate from refill.** Remove `freshExternal` checks,
   `session`, `session.spent` and `getPresence`; keep daily/monthly/family
   budgets, the persistent-deficit requirement and the durable reservation.
   Update the four presence tests to assert the opposite: an empty room with a
   persistent deficit is exactly when one call is spent. Remove
   `reservoirPresence` from the DO.
3. **Port v2's good guards into the approved v1 domestic editor** (sleep,
   skipped, existing prose/lines, unknown cast, `areaOf` room) and restore v1's
   banks, admission and `v1` salt. Re-run the Checkpoint 1 measurement to
   confirm 16.9/day and the editor distribution are unchanged.
4. **Revert the chain order** to `… ?? generalEditorial ?? domesticEditorial`
   until the overlap is measured.
5. **Rewrite the Sanctuary/plaza/café arrival lines against canon**; keep the
   Streamliner and Ink sets after a light voice pass.
6. **Land the reader fix on its own**, with its test and the removal of
   `prose-variation-bank.js`.
7. **Decide `WORLDSTREAM_CINEMATICS_ENABLED` default separately.**
8. **Sort the pair key in health**, or import `sceneSpent`'s rule.
9. **Remove `decorate` plumbing** until read-time selection is designed, or
   build it keyed on committed event identity only.
10. Spot-check the 22 accepted location mappings by eye.

Then, and only then: shadow 30/90-day runs with the 22 entries live and refill
still disabled, comparing beat rate, distinct scenes, repeats, Legion cadence
and P1 timing against the `82b81a9` baseline (13/8/12 beats, 0 repeats, Legion
4/2/2, P1 day 21.6/–/22.6).
