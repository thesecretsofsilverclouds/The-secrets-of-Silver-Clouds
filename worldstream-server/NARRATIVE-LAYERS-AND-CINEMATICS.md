# Narrative layers and the cinematic path

Findings from a code and data investigation on 10 September 2026, the day
Worldstream launched. Nothing here was changed as a result; this is the state of
the system as it stands, recorded before the reasoning is lost.

Two questions prompted it:

1. The world publishes ~54 public events a day and, before this work, ~17
   readable passages. Why is so little of what the simulation does becoming
   story?
2. Where is the LLM path, and is it the scene-reservoir design that was
   intended, or something else?

The short answers: **the domestic layer has no editor registered**, and **the
cinematic path is an event-bound live performer, not a reservoir**.

---

## 1. How an event becomes prose

`src/editorial.mjs:268` — `editorialEvent(event, context)`.

Every public event passes through a chain of editors, first match wins
(`editorial.mjs:273`):

```
sceneBankEditorial       scene-bank-presentation.mjs
  ?? livesEditorial      editorial-lives.mjs
  ?? supportingEditorial editorial-supporting.mjs
  ?? nightEditorial      editorial-night.mjs
  ?? callbackEditorial   editorial.mjs
  ?? worldEditorial      editorial-world.mjs
  ?? sceneEditorial      editorial-scenes.mjs
  ?? generalEditorial    editorial.mjs
```

An editor returns `{ description, prose?, lines?, memoryCallback? }` or `null`.
**Prose is optional.** `editorial.mjs:278` sets `register: 'prose'` only when a
revision supplied prose; otherwise the event keeps its one-line
`publicDescription` and reaches the reader as a ticker entry.

`generalEditorial` is the catch-all. It polishes the description and **never
returns prose of its own**. Anything with no earlier match therefore could not
become a passage, by construction rather than by policy — which is the hole §9
fills. (Its row in the table below counts events whose prose was set by the
*reducer* — `arcs.mjs`, `night-stories.mjs`, `scene-bank.mjs` write
`ctx.event.prose` at commit time and it survives the chain untouched.)

### Which editors can emit prose, and for what

| Editor | Types it claims | Prose over 7.8 days |
|---|---|---|
| `sceneBankEditorial` | `SCENE_BANK_BEAT` | 7 |
| `livesEditorial` | **only** `OFFSCREEN_START/RESULT/ENCOUNTER` (`editorial-lives.mjs:10`) | 26 |
| `supportingEditorial` | `SUPPORTING_*` | 40 |
| `nightEditorial` | `NIGHT_*` | 6 |
| `worldEditorial` | `MOMENT_NOTICED` and world texture | 0 with prose; see §9 |
| `sceneEditorial` | `VENUE_SCENE`, `CONVERSATION` | 1 |
| `domesticEditorial` | ordinary life — see §9 | **90** |
| `generalEditorial`, plus prose the reducer set directly | everything else | 52 |

Counts are attributed by running each editor and matching its output against
what the chain published, so they reflect who actually won rather than who was
asked. An earlier version of this table reported `livesEditorial` at 0; that was
the same read-the-ledger-directly mistake corrected in §2.

`livesEditorial` is worth reading before writing any new editor. It *can* write
prose — eight paths do — but it deliberately stays silent on continuations:

```js
if (continuing) return { description: event.publicDescription, prose: null };
```

at `editorial-lives.mjs:201`, `:208` and `:218`. That is the "not every event
needs a paragraph" principle already implemented. A domestic editor should reuse
it rather than reinvent it.

### The domestic layer: events with no editor at all

Measured over 7.8 simulated days (`scripts/create-launch-world.mjs`, 168h).
Before §9 these reached `generalEditorial` and became ticker lines; none had
ever produced prose:

| Type | Count | Type | Count |
|---|---|---|---|
| `MEAL_BEGIN` | 44 | `REST_BEGIN` | 14 |
| `INSTITUTION_NOTICE` | 38 | `PIANO_BEGIN` | 10 |
| `MOMENT_NOTICED` | 22 | `WEATHER_CHANGE` | 8 |
| `CROSS_PATHS` | 18 | `TV_BEGIN` | 8 |
| `PRACTICE_BEGIN` | 17 | `QUIET_TIME_BEGIN` | 6 |
| `PRACTICE_END` | 17 | `GAME_BEGIN` | 5 |

About **20 publishable state changes a day** that no editor could narrate.
`INSTITUTION_NOTICE` and `MOMENT_NOTICED` remain uncovered by design — see §9.

---

## 2. Gap study

> **Corrected 10 September 2026. An earlier version of this section reported
> 8.2 passages a day and a 601-minute p90. Those numbers were wrong and are
> gone.** They were measured by reading the committed ledger directly, which
> misses every passage the editorial chain adds at read time — `publicEvents`
> applies `editorialEvent` on the way out, so `supporting`, `lives`, `world` and
> `general` revisions never appear in the stored rows. Any figure quoted here
> now comes from running the real chain. If you find 8.2 anywhere else, it is
> this same mistake.

Method: a clean 168-hour world from the canonical seed, its committed events
then passed through `editorialEvent` exactly as `publicEvents` does. "Passage"
means an event a reader sees as new prose. Gaps are measured in waking hours
(08:00–23:00 London), since an overnight silence is not starvation.

| | all public events | passages (pre-domestic) |
|---|---|---|
| Per day | 54.2 | **16.9** |
| Median gap | 5 m | **14 m** |
| p90 gap | 55 m | **183 m** |
| Longest | 478 m | **876 m** |

Waking-hours passage gaps, extrapolated:

| Gap exceeds | Times per 30 days |
|---|---|
| 60 m | 112 |
| 90 m | 85 |
| 120 m | 69 |
| 180 m | 50 |
| 360 m | 31 |

**There is no threshold that fires about once a month**, and the correction does
not change this. The distribution is bimodal — a quarter-hour daytime rhythm and
long structural silences. Even a six-hour threshold fires 31 times; above the
876-minute maximum it fires never. A monthly cadence has to come from a
**budget**, not a threshold.

Measured effect of the domestic editor, same seed, both columns through the
chain (see `src/editorial-domestic.mjs`, commit `efce99e`):

| | passages/day | waking median | waking p90 | 3 h+ gaps |
|---|---|---|---|---|
| before | 16.9 | 14 m | 183 m | 50/month |
| **after** | **28.5** | **10 m** | **107 m** | **39/month** |

A 107-minute p90 is territory where the world breathes. The remaining long gaps
do not all want filling; some silence is the world being honest about a quiet
afternoon. **The visible enemy from here is repetition, not silence.**

---

## 3. Scene-bank inventory

`src/scene-bank-catalog.mjs`, from `src/scene-bank-data.mjs` (134 authored
scenes transcribed 9 September 2026).

| | |
|---|---|
| Scene bank | 134 — **54 enabled**, 34 `prerequisite_gated`, 46 `excluded` |
| Of the enabled | 22 are the Nimbus arc (gated on `minAgeDays`), 32 free-standing |
| Venue scenes (`src/venues.mjs`) | 41 — cafe 16, big_ben_plaza 14, enchanted_ink 11 |
| **Reachable without new prerequisites** | **95** |

The bank contributed 7 passages in the 7.7-day sample. It is not the constraint
on how alive the world looks.

---

## 4. The cinematic path, traced end to end

### Trigger — viewer-driven

`src/cinematic-service.mjs:136` `ingest(snapshot, { presence, now })`.

```js
const supplied = publicPresence(presence, now);
if (supplied.count <= 0) return { candidates: records, selected: null, generation: null };   // :161
const threshold = effectiveCinematicThreshold(supplied.count, this.config.minScore);
const beginning = Math.max(supplied.activeSinceMs - reconnectGraceMs, now - liveWindowMs);
```

- No live viewers → no generation, ever.
- `effectiveCinematicThreshold` (`src/cinematics.mjs:104`) returns `Infinity` at
  zero viewers and **falls as viewers arrive** (`base - min(14, 5 + ceil(log2(n+1)*2))`,
  floored at 42). More audience, lower bar.
- Eligibility begins at `activeSinceMs` — the moment *that viewer* connected.

The highest-scoring recent event is selected and a scene generated for it.
Despite the intention that page views should not drive generation, this is in
effect `visitor arrives → model call`.

### Request

`src/cinematics.mjs:576` `openAICinematicClient({ apiKey, model, ... })` posts
one `packet` to `https://api.openai.com/v1/responses` with
`text.format.json_schema` name `worldstream_cinematic_scene`, `strict: true`, and
a `repairReason` retry path.

### Response schema — one scene, welded to one event

`src/cinematics.mjs:437` `cinematicSceneSchema(packet)` returns a single object:

```
background          enum: packet.visuals.backgrounds
openingNarration    string
beats[]             speaker enum: Object.keys(packet.characters)
                    plate   enum: packet.visuals.plates
                    line, factRefs
closingNarration    string
chronicleSummary    string
```

No array of scenes. No variants. **No prerequisites, cast requirements, location
or trigger conditions.** The enums are derived from the one packet, so the scene
cannot be valid for any other event.

### Storage

`src/cinematic-store.mjs:40` — `cinematics` table, **`event_id TEXT PRIMARY KEY`**.
One row per already-committed event. Companion tables `cinematic_budget`
(per London day) and `cinematic_runtime`.

### Selection later

There is none. `cinematicRecordForApi` (`cinematics.mjs:602`) returns `eventId`;
the reader plays the scene attached to that event. A generated scene can never
fire for a different event, a later moment, or different conditions.

### Connection to the scene bank

**None.** `scene-bank.mjs` and `scene-bank-catalog.mjs` contain no reference to
cinematics. Generated material never becomes authored material.

### On the word "ingest"

`ingest(snapshot, …)` takes a **world snapshot** and indexes committed events as
cinematic *candidates*. It is intake of world events into a queue, not intake of
model output into a content library. `maybeIngestCinematic`
(`cloudflare/src/world-durable-object.mjs:264`, called from `:310`) is the same
idea on the deployed side.

---

## 5. Production cannot call a model

The deployed Cloudflare Worker has **no outbound `fetch` of any kind**. There is
no Anthropic, OpenAI or HTTP client anywhere in `cloudflare/src`.

`maybeIngestCinematic` writes rows stamped `status: 'fallback'`,
`model: 'deterministic-fallback'`, built by `deterministicFallbackScene(packet)`
in pure code, at zero token cost. It returns immediately for `SCENE_BANK_BEAT`
(`world-durable-object.mjs:266`), so authored scenes never enter the path.

The model client exists only in the Node workshop server: `server.mjs:144`,
behind `sceneConfig.enabled` and `process.env.OPENAI_API_KEY`.

**Production therefore cannot spend tokens, for any visitor, including the
owner.** No gate is needed today. OpenAI has not been enabled.

---

## 6. Performer vs reservoir

What exists — an **event-bound live performer**:

```
committed event -> scored -> viewer present -> one model call
  -> one scene for that event -> stored under event_id -> played once
```

What was intended — a **generated-scene reservoir**:

```
scene supply thin + world at a checkpoint + budget allows -> one model call
  -> new authored scene material with prerequisites
  -> stored in the bank -> deterministic selector owns it
  -> fires later, when conditions match
```

The differences are structural, not tuning:

| | performer (exists) | reservoir (intended) |
|---|---|---|
| Trigger | live viewer count | scene inventory + checkpoint + budget |
| Output | one performance of one past event | reusable scene(s) with gates |
| Timing | immediate | dormant until prerequisites match |
| Reuse | never — `event_id` primary key | selected whenever conditions fit |
| Owner after creation | cinematic store | deterministic scene selector |

No vestige of the reservoir exists: no prerequisites column, no variant schema,
no generated-to-bank path, nothing dormant. Either it was designed and the
performer was built instead, or it did not survive the Cloudflare migration.
The code alone cannot distinguish these.

**The scene bank already has the machinery a reservoir would need** — `status`,
`gate`, `dependencies`, `minAgeDays`, `cast`, `location`, `area`. Model output
shaped like a `SCENE_BANK_SOURCE` row would slot in and the existing selector
would own it from that moment. That is a design task, not a restoration.

---

## 7. Repository vs deployed state

**`cloudflare/wrangler.toml` is deployed but NOT committed.** This is the most
important line in this document.

The launch failed at 17:00 because Durable Object bindings and migrations are
**not inherited by named Wrangler environments**. Declared only at the top level
they vanish from `--env production`, which then boots with the environment
variables present, no `WORLD_DO`, and `500 {"error":"WORLD_DO Durable Object
binding is missing."}` on every route that needs the world. The deploy output
says so: the bindings list has no Durable Object line.

The fix — `[env.production.durable_objects]`, `[[env.production.migrations]]`
and the same pair for staging — was made, deployed, and verified live, but the
working-tree change was never committed.

**A redeploy from a clean checkout will break production again.** Commit this
before any further deploy.

Everything else is in sync: `main` matches `origin/main` as of this document.

Deployed production configuration, for reference:

| | |
|---|---|
| Worker | `silver-clouds-worldstream-production` |
| Hostname | `worldstream-api.thesecretsofsilverclouds.co.uk` (custom domain) |
| `WORLD_ID` | `worldstream-production` |
| `LAUNCH_MS` | `1789056000000` — 10 Sep 2026 17:00 London |
| `START_MS` | `1788994800000` — 10 Sep 2026 00:00 London |
| Cron | `55 15 * * *` (16:55 BST) |
| Reader | `https://thesecretsofsilverclouds.com/worldstream/` |

---

## 8. Recommended order, not yet done

1. **A domestic editor**, above `generalEditorial`. Aim for roughly 40–60% of
   the domestic layer, chosen deterministically — first meal of the day but not
   the third, practice *end* rather than every begin, `CROSS_PATHS` always. Reuse
   the `continuing` suppression from `editorial-lives.mjs`. This removes the
   four-hour blanks with no model call.
2. **Leave the bank as it is.** 95 reachable scenes is not the constraint.
3. **Then** consider the reservoir, with a budget rather than a starvation
   timer, and with the owner's own session excluded from any viewer count.
   Note that this would give the production world its first outbound call.

---

## 9. The domestic editor

`src/editorial-domestic.mjs`, added in commit `efce99e`. Last in the chain, so
it fills holes and can never displace a specialist. Surface only: it reads a
committed event and returns `{ description, prose }`, and returns the canonical
`publicDescription` unchanged so the ledger line is never rewritten.

### Event-type mapping

This is the contract the staged reservoir has to be converted against. Anything
generated or authored for these families must match these types, this admission
rule and this prose shape — not a guess at them.

| Event type | Admission | Bank size | Notes |
|---|---|---|---|
| `CROSS_PATHS` | always | 9 | Two people meeting unplanned is a beat by definition |
| `PRACTICE_END` | always | 8 | An ending carries a result |
| `PRACTICE_BEGIN` | 1 in 4 | 3 | A beginning carries only an intention |
| `MEAL_BEGIN` | morning/evening/night always; midday 1 in 5 | 5 morning, 6 paired, 4 solo | Branches on `daypart` and on whether both leads are present |
| `REST_BEGIN`, `QUIET_TIME_BEGIN` | 1 in 2 | 6 shared | |
| `PIANO_BEGIN` | 2 in 3 | 5 | |
| `GAME_BEGIN`, `TV_BEGIN`, `MUSIC_LISTEN_BEGIN` | 1 in 2 | 4 shared | |
| `WEATHER_CHANGE` | only when `isShelterWeather(payload.weatherCode)` | 3 | Weather earns prose only where it changes what people can do |

Deliberately **not** claimed: `INSTITUTION_NOTICE` (38 a week) and
`MOMENT_NOTICED` (22 a week). The first is institutional furniture; the second
belongs to `worldEditorial`. Both are candidates for the reservoir, not for a
hand-written switch.

### Selection

```js
roll(event, salt) = sha256(`silver-clouds-domestic-v1|${salt}|${event.id}|${event.type}`).readUInt32BE(0)
choose(event, bank) = bank[roll(event,'pick') % bank.length]
share(event, n, d)  = roll(event,'share') % d < n
```

Both draws depend only on committed event identity, so prose is stable across
refreshes, viewers and replays. `share` is the thinning dial per family; it is
not a random percentage but a stable partition of that family's events.

### Substitution variables available to a bank row

Every value comes off the committed event. Nothing is inferred.

| Variable | Source |
|---|---|
| `who` | `event.participants` mapped through `NAMES`, joined with "and" |
| `where` | `PLACES[event.location]` |
| `room` | `event.room`, already the manuscript's name for it |
| `when` | `daypart(event.occurredAt)` |
| `both(event)` | true when both leads are participants |

Any reservoir row for these families must restrict itself to these, or declare
its own and have the runtime supply them. A row that names a character not in
`event.participants` is invalid — the invariant harness checks this.

### Measured behaviour, 7.8-day seed

90 passages, 67 distinct sentences, worst reused 9 times. That reuse rate is the
reason for the reservoir: single-digit exact repeats over a 30-day audit is not
reachable with a hand-written switch, and Batch 01 exists to replace these banks
with authored breadth rather than to extend them.

---

## 10. Checkpoint 2 investigation — description ownership vs prose enrichment

**The question.** A specialist that returns a description-only revision claims
the event and blocks domestic prose, because the chain is a single first-match
`??` over one combined object. Can description ownership and prose enrichment be
separated without breaking first-match for specialist *prose*?

**The surface, measured.** 12 events across 7.8 days — 1.5 a day — where
domestic has prose and the chain publishes a bare line. All 12 are claimed by
`worldEditorial`:

| Type | Count |
|---|---|
| `PIANO_BEGIN` | 6 |
| `TV_BEGIN` | 4 |
| `QUIET_TIME_BEGIN` | 1 |
| `MUSIC_LISTEN_BEGIN` | 1 |

Enrichment would take passages from 28.5 to **30.0 a day**. Real, modest, and
not the main lever — repetition is.

**Where it would go.** `editorial.mjs:274–279` already merges a revision over
the event field by field. The minimal change keeps one chain and adds one
fallback at the merge, not a second pass over the editors:

```
revision = <unchanged first-match chain>
prose    = revision?.prose ?? event.prose ?? (revision && !revision.prose ? domesticEditorial(event)?.prose : undefined)
```

Properties worth stating, because they are what make it safe:

- **Specialist prose still wins outright.** The fallback is reached only when
  the winning revision carried no prose at all.
- **Description ownership is untouched.** `revision.description` is still the
  specialist's; domestic contributes text and nothing else.
- **No editor runs twice**, and domestic stays last, so its own first-match
  position is unchanged.
- Domestic is already pure and side-effect free, so calling it a second time for
  the same event returns the same string.

**The risk to weigh.** A specialist that returns description-only may be saying
"this event is deliberately quiet", not merely "I have no prose". `worldEditorial`
is the only editor affected, and its four types here are piano, television,
quiet time and music — the families where a claim of deliberate quiet is most
plausible. That should be checked against `editorial-world.mjs` intent before
implementing, and the cheap alternative is an explicit opt-in: let a revision
carry `enrichable: true`, so silence stays the default and enrichment is a
decision rather than an inference.

**Not implemented.** No code was changed for this section.
