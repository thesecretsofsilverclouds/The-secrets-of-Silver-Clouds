# Worldstream Addon Bible — PARTIAL · 2026-09-11

Status: **planning freeze, not a completed bible, not an implementation pass.**

This file preserves the reservoir baseline, the interrupted smart-model runtime mapping, and the constraints the complete `WORLDSTREAM_ADDON_BIBLE.md` still has to finish. **Do not implement addons, activate Future Simulation, change the UI, enable generation, or run another simulation from this document.**

Authoritative planning brief (still incomplete as a bible): `site/The-secrets-of-Silver-Clouds/worldstream-server/WORLDSTREAM-ADDON-BIBLE-BRIEF.md`.

Related but **not** the six canon systems: `WORLDSTREAM-THREE-ADDON-IMPLEMENTATION-PLAN.md` (SPECTRA / MORPHOS / CSV). Those remain optional research. They must not delay or expand the canon-grounded addons.

Rollback tag for the presentation layer: `approved-reservoir-integration-baseline`.

---

## Stop condition (binding)

1. Produce the **complete** addon bible (full primary-canon reading, precedent register, six system chapters, knowledge/jurisdiction matrix, approval register).
2. Stop for **Silent’s review**.
3. **No addon coding** until that complete bible has been reviewed.
4. Listing a Possible Expansion in a document does not approve it.

This partial file is a checkpoint after the reservoir activation pass. Primary canon was **not** fully re-read for this assignment. Do not claim a complete canon review from this document.

---

## 1. Frozen runtime baseline (2026-09-11 reservoir activation)

Do not treat older harness counts (22 / 81 / 108 / 319 / 724 / 817 / 885) as current production.

| Item | Current value |
|---|---|
| `RULES_VERSION` | `canon-ambient-p183-v23` (`src/fixture.mjs`) |
| Active current-world reservoir prose surfaces | **874** |
| Moment grammar / CAST quip lines | **673** total (515 unique validated lines added onto existing surfaces) |
| Future Simulation library | **300** entries, **0** active (100 Batch 03 + 200 Batch 04) |
| Inactive current-world production rows | **91**, each with one explicit reason |
| LLM / observe refill | 0 model calls; `/api/observe` must not reserve refill |
| Reservoir cadence | Presentation overlay only. **0** `R:` `SCENE_BANK_BEAT`s in 90d × 3 |

90-day × 3 presentation check (same committed history; A = 80-row baseline catalog, B = full 874):

| Seed | Events | Public opportunities | A hits | B hits | Unique B | Worst repeat | R: beats | Legion visits |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| silver-clouds-now-v1 | 9036 | 4819 | 132 | 428 | 214 | 3 | 0 | 7 |
| seed-beta | 9229 | 4921 | 131 | 423 | 209 | 3 | 0 | 2 |
| seed-gamma | 9133 | 4823 | 131 | 432 | 211 | 3 | 0 | 4 |

Current v23 semantic digests from that run (informational; A/B shared one simulation per seed):

- `silver-clouds-now-v1`: `ecb8a462c7d747458a3ba8a80935dbaccc82e599879a7679108329818b0bf39f`
- `seed-beta`: `e3e9ff201f10b4be83c444d09f6a13e72802d119930488462ae02b3f7319b3e7`
- `seed-gamma`: `b8f1d171ae21ed6d3b26e021a1e8f4e264c35ad3853d0b0d96a87fe2338745c7`

Invariant the addons must keep: reservoir with ~80 scenes vs ~800 scenes → **same canonical world history**. Only presentation differs.

Detail: `handoff/WORLDSTREAM_RESERVOIR_ACTIVATION_2026-09-11.md`.

---

## 2. Spoiler checkpoint (p.183)

The live world is pinned to the **p.183 / PDF ~p.183** checkpoint. `RULES_VERSION` name `canon-ambient-p183-v23` is that pin.

Embargo (must not appear in text, facts, memories, actors, or reservoir):

- Ashai parentage / Shonen / Kartia / father-daughter disclosures (manuscript after checkpoint; PDF ~p.445 in one earlier note).
- J'kobi alive.
- **Whisper** as a runtime actor or as Nameless. Whisper is spoiler-sealed; no actor id exists.
- Goaden’s voices, locked basement, Grimoire hunt (begin on the page after the checkpoint).
- Nameless is only the **already-known masked threat** (first sighting PDF p.75; inner-circle briefing p.76–78). Never a public MEU bulletin. Never Whisper.

Zara is an author decision: known as MI6 liaison **before** the checkpoint (`ANCHORS` / `OUTSIDE_CAST`). That is a smaller claim than her manuscript introduction at [M362].

Davis/Ashai: current world is **post-charm, settled rivalry**. Open reconciliation or post-disclosure warmth is phase-blocked (`davis_ashai_rivalry.013`, `.014`).

---

## 3. Canon classification (required on every rule)

Label **each rule, authority claim, and consequential outcome**, not just each system:

| Class | Meaning |
|---|---|
| **Direct Canon** | Supported explicitly by an identifiable manuscript scene or Codex/Lore entry. Cite chapter + indexed/physical page, or Codex/Lore locator. |
| **Logical Simulation Extension** | Conservative repeatable rule inferred from identified canon. State the inference and its limits. Proposed numeric frequencies and cooldowns usually belong here. |
| **Possible Expansion — Silent approval required** | Unsupported powers, institutions, jurisdiction, relationship shifts, recurring commitments, named roles, or material outcomes. Keep out of runnable design until explicitly approved. |

A faction description is not evidence that a specific incident already happened. If no manuscript scene exists, say so. Do not fill gaps with invented lore; write `unsupported`, `not applicable`, or `Possible Expansion`.

Primary sources still to be read in full for the complete bible (paths under `C:/Users/chris/Desktop/SilverClouds_Project/canon/`):

- `manuscript_indexed.txt` / `manuscript.pdf`
- `The Secrets of Silver Clouds Codex.txt`
- `lore book.txt`
- `Codex Entry Nimbus, the Cloud Rat.txt` and other supplementary entries

Keyword snippets and generated knowledge files are not a substitute.

---

## 4. Six intended addon systems

Design order: **1–5 first, independently testable. 6 last.**

### 4.1 Magical London / MEU incidents

**Runtime today:** pressure (`src/pressure.mjs`) plus `UNEASE` / `INCIDENT` / `AFTERMATH` / `ARCANE_SURGE` texture. Aftermath is **a morning line, not a mechanic**. There is **no resolution case system**: no case id, no lawful responder chain, no evidence file, no closure/payment/custody state machine.

**Must not:** replace the existing weather simulation because an incident mentions weather.

**Bible still needs:** precedents for dangerous/illegal magic, regulated artefacts, rogue creatures, ward failures, unusual magical-weather *consequences*; severity; location; lawful responders; escalation; mundane/no-action outcomes.

### 4.2 Demon’s Legion contracts

**Runtime today:** `LEGION_VISIT` is **social only** — authored banter (`src/legion.mjs`), lines and nothing else. Visitors sit in `payload.visitors`. Location is wherever Goaden/Ashai actually are (usually MI6), **not** `legion_hideout`. Hideout is never a travel destination.

**Must not:** treat existing visits as contracts, debriefs, invoices paid, or MEU rivalry already simulated.

**Bible still needs:** street-kid vigilante/folk-hero role vs ordinary authority; community requests, favours, jobs, who accepts them, Goaden’s old relationships; verify unofficial MI6 outsourcing, payment/debrief, MEU rivalry **individually** against canon. Do not assume they exist because they are plausible.

### 4.3 Duskkin compliance

**Runtime today:** **no compliance case system.** No `duskkin` / `duskkin_liaison` runtime actor. Related reservoir rows are staged. Future Simulation families (`duskkin_compliance`, etc.) are inactive.

**Must not:** invent a vampire economy or human-feeding market. Emissaries in lore do not by themselves establish MI6 arrest powers, Council procedure, or a particular penalty.

**Bible still needs:** no-human-feeding rule; suspicion vs verified evidence; authority; jurisdiction; custody; liaison visits; legitimate outcomes.

### 4.4 Onari ecology and civic life

**Runtime today:** **no ecology/protest system.** Yukon exists as a supporting character (gaming area, shapeshift, night residence). `onari_protester` is not a runtime actor. `onari_environment` Future Simulation is inactive.

**Must not:** write Yukon as a generic nature-activist stereotype.

**Bible still needs:** preservation/coexistence from actual religion/culture and scenes; habitat damage; development disputes; protest; consultation; restoration; which procedures are extensions; Yukon’s divided loyalties from his actual relationships and voice.

### 4.5 MI6 contractors and consultants

**Runtime today:** **contractors are not runtime actors.** Generic `contractor` cast is staged. `mi6_contractors` Future Simulation is inactive. Kartel/Hammond (silent alchemist), Henderson, Davis, Zara are named supporting/liaison cast — they are not a contractor roster.

**Must not:** random consultant flavour, invented authority, or unsupported abilities.

**Bible still needs:** specialist precedents (including any Isolde comparison that canon actually supports); alchemists/ward engineers/forensics only for committed problems that require an established competence; distinguish named characters from proposed unnamed roles.

### 4.6 Faction crossings — last

**Implement only after 1–5 exist and pass their own tests.**

Derive meetings from **compatible, simultaneous committed interests** of Order, Church, MI6, Legion, Duskkin, and Onari. A shared topic is not a trigger. Require jurisdiction, knowledge paths, authority to attend, physical availability, and a reason to convene. No all-faction briefing spam. Cross-system outcomes must be owned and idempotent: one incident cannot resolve or pay twice.

---

## 5. Known authority and knowledge constraints

These already bind the engine. Addons must reuse them, not duplicate or weaken them.

- **Simulation decides; prose expresses.** Reservoir availability must never be why an incident occurs.
- **Observation must not change canon.** Viewer count, request time, page refresh, and `/api/observe` must not reserve refill or call a model. Generation stays OFF. Do not silently choose refill spending policy.
- **Public feed ≠ knowledge.** Appearing in the feed, an `INSTITUTION_NOTICE`, or a ticker line does not teach a character anything. Knowledge requires an explicit noticing, telling, self-report, or participation. Rumour is not proof.
- **Institutions are not characters.** `FACTION_STATUS` / notices are public texture. Named colleagues appear as sources or cameos, not as a second player roster.
- **Commitments and travel are sovereign.** Scene-bank, director spacing, offscreen lives, Nimbus/P1, supporting purposes, and ordinary schedules must not be starved by incident addons.
- **Cast must really be present.** Supporting/world reservoir lanes may narrate Emily, Yukon, Kartel, Henderson, Nimbus, Guardians, weather — only when the committed event’s participants/witnesses include them. Do not fabricate events to spend prose.
- **Balthazar cannot appear without Anarchy** (shared body).
- **Guardians (Kai/Greah)** are attached, not independently scheduled.
- **Authored arcs stay above ambient incident selection.** Avoid new obligations that prevent sleeping, travelling, or ordinary life.
- **Integer relationship bands.** Fractional trust/concern/irritation is illegal (`assertCanonState`).
- **Upgrade/restart:** changing `RULES_VERSION` is not a migration. Local store rejects a changed persisted identity. Cloudflare init is not the same check. Do not overwrite version to silence a mismatch.

---

## 6. Interrupted smart-model runtime mapping and extension seams

A smart-model pass began mapping **existing** extension points for the complete bible and was interrupted before canon reading and system chapters. Preserve the seams; do not invent a parallel incident engine.

Required family chain (from the bible brief — still to be filled per family, not implemented):

```text
world state + source facts
→ deterministic trigger
→ eligible participants and authority
→ event/state-machine chain
→ possible outcomes and committed effects
→ cooldown/recurrence
→ eligible reservoir/grammar expression
```

### 6.1 Canonical mutation (only place addons may write facts)

| Seam | Path | Use |
|---|---|---|
| Reducer | `src/fixture.mjs` `createFixture().reduceAction(state, action, seed)` | Every canonical decision and addon-state update. Existing mutation/ledger helpers only. |
| Queue / advance | `experiment-l/src/world.mjs` `WorldStore.advance()` | Preserve `dueAt` → priority → id, ownership, follow-ups, atomic commits. |
| Stores | `src/service-world.mjs`, `src/world.mjs`, Cloudflare `src/world-durable-object.mjs` | No new production database. |

### 6.2 Existing world systems to reuse (do not duplicate)

| Seam | Path | Current limit for addons |
|---|---|---|
| Pressure / incidents | `src/pressure.mjs`, daily reduction in `fixture.mjs` | Carried pressure, floors, decay, `maxIncidentsPerDay`, repertoire of unease/incident/aftermath **lines**. No case file, no MEU closure. |
| Arcane texture | `ARCANE_SURGE`, faction `arcane` notices | Scanner/standby copy. Not a resolution workflow. |
| Legion | `src/legion.mjs`, `LEGION_VISIT` | Social exchanges. Not contracts. |
| Scene-bank | `src/scene-bank.mjs` | Authored + Nimbus cadence. Reservoir rows are **not** bookable (`scene.reservoir` skipped). |
| Reservoir presentation | `src/scene-reservoir-select.mjs`, `src/editorial.mjs` | Overlay on already-committed public events. Hard gates: trigger, location, required cast, daypart, weather, origin/callback. |
| Reservoir admission | `src/scene-reservoir-catalog.mjs` | Content-hash reviews. Unknown actors stage/reject; Future Simulation stays out. |
| Director | `src/director.mjs` | Budgets, spacing, repetition. Do not add a second scheduler. |
| Intent / choice | `src/intent.mjs` | CSV research (if ever) may only rank the final ordinary loyalty/ambition choice. Not part of the six canon addons. |
| Relationships / knowledge | `src/relationship-choices.mjs` `knownSupportingHistory()` | Witnessed/learned facts only. |
| Offscreen lives | offscreen-lives modules | Supporting purposes; do not steal their cadence. |
| Places / travel | `src/places.mjs`, `TRAVEL_DEPART` / `TRAVEL_ARRIVE` | Streamliner/Sanctuary already exist. Legion hideout is not a destination. |
| Weather | fixture + `src/sky.mjs` | Causal overlay (yard closed, journey +10m in fog/storm). Incident weather must not replace this. |
| Moments / editorial | `src/moments.mjs`, `src/editorial-*.mjs`, `lab/grammar/cast.mjs` | Cheap language layer. Grammar never creates an action. |
| Refill | `src/scene-reservoir-runtime.mjs`, alarm-only | Never from observe. Addon must not request generation. |

### 6.3 Presentation vs simulation (already decided)

Reservoir was concatenated onto `SCENE_BANK_CATALOG` and used to mint `SCENE_BANK_BEAT`s. Catalog size then changed which beats fired (80 vs 800 mutated history).

**Workaround in production now:** overlay at editorial time after exclusive banks (scene-bank, lives, supporting, night, callback, recorded scene exchanges). Fallback ticker/world/domestic may still supply `publicDescription`. Historical `R:` ids remain in `SCENE_BANK_BY_ID` for old saves.

Addon incidents must follow the same rule: **commit the event first**, then let reservoir/grammar speak. Do not book reservoir as the incident.

### 6.4 SPECTRA / MORPHOS / CSV (do not confuse with §4)

Optional research only. Source: `WORLDSTREAM-THREE-ADDON-IMPLEMENTATION-PLAN.md` — **superseded for implementation of the six canon addons.** Feasibility tests (`lab/harness/three-addons-feasibility.test.mjs`) do not authorize coding.

Preserve, do not implement:

- Two kinds of state: canonical `x` (characters, facts, journeys, commitments, events, queues) vs private selection memory `y` (motif fields, evidence summaries). If `y` ever exists, persist and replay it with `x`. Viewer counts, HTTP timing, animation frames, and unfinished background work must not influence it.
- Proposed modules that **do not exist:** `src/narrative-signals.mjs`, `src/counterfactual-value.mjs`, `lab/shadow/canonical-fork.mjs`.
- Invalid Jacobian / spectral “tipping point” must not be implemented.
- Dated inventory in that plan (22 / 108 / 817 / 885) is **not** current production. Current admitted surfaces: **874**.
- Local `/api/observe` no longer calls reservoir maintenance; Cloudflare maintenance is `WorldDurableObject.alarm()`. Local observe can still call `cinematics.ingest()` on the enabled path. Generation stays OFF. Do not silently choose refill spending policy. Request-time observe must not author or reserve.
- Upgrade/restart: changing `RULES_VERSION` is not a migration. Local `WorldStore` rejects a changed persisted identity. Cloudflare init does **not** perform the same identity check and reconstructs its fixture from the current watermark day.

CSV research (if ever) may only rank the final ordinary loyalty/ambition choice. **None of this is a prerequisite for MEU / Legion / Duskkin / Onari / contractor / crossing systems.** SPECTRA/MORPHOS/CSV must not delay the canon bible.

### 6.5 What the interrupted pass did *not* finish

- Full manuscript / Codex / Lore reading log (editions, hashes, coverage).
- Precedent register with stable IDs and source conflicts.
- Six complete design chapters and the per-family template (preconditions, state machine, jurisdiction, frequency, evidence, spoiler gates, verified reservoir IDs).
- Cross-system ownership / knowledge / jurisdiction matrix.
- Approval register of Possible Expansions for Silent.
- Staged implementation order and 30/90-day test *design* (tests to be run **after** implementation, not claimed here).

`worldstream-server/WORLDSTREAM_ADDON_BIBLE.md` **does not exist yet.** Create it from the brief + this partial. Do not start from SPECTRA/MORPHOS/CSV.

---

## 7. Future Simulation vocabulary (intentionally inactive)

Quarantined libraries (prose must never create the incident):

- `worldstream-server/data/future-simulation-library.json` — 300 scenes (batch_03: 100, batch_04: 200).
- `WORLDSTREAM_CANON_CONTENT_MEGA_BATCH_04/WORLDSTREAM_FUTURE_SIMULATION_LIBRARY_BATCH_04.json` — 200.

Families held out of the active catalog include: `duskkin_compliance`, `onari_environment`, `mi6_contractors`, `magical_london_incidents`, `multifaction_briefings`, plus Batch 03 source families of the same kind that were never imported.

These are Possible Expansion **vocabulary** for after generators exist and the bible is approved. They are not a backlog to bulk-enable.

---

## 8. All 91 inactive current-world rows

Source: `SCENE_RESERVOIR_REVIEWS` in `src/scene-reservoir-data.mjs`. No generic “staged pending review”. Every row has one explicit legitimate reason. Exact production reason strings:

### Whisper embargo — 44

Reason: `Whisper is under the spoiler embargo; no runtime actor id exists until that story is admitted.`

`ready.whisper.001` `.002` `.003` `.004` `.005` `.006` `.007` `.008` `.009` `.010` `.011` `.012` `.013` `.014` `.015` `.016` `.017` `.018` `.019` `.020` `.021` `.022` `.023` `.024` `.025`

Also Whisper-cast rows: `ready.cross.004` `.018` `.024` `.038`; `ready.training.013` `.033`; `ready.gaming.005` `.020` `.025`; `ready.lunch.004` `.024`; `ready.streamliner.005` `.023`; `ready.sanctuary.020` `.045`; `ready.emily.012` `.030`; `ready.nimbus.014` `.032`

### Marley is not a runtime actor — 16

Reason: `Marley is not a current runtime actor; the simulation does not produce this cast.`

`ready.gaming.013` `.033`; `ready.legion.004` `.012` `.022` `.030`; `ready.lunch.017` `.037`; `ready.cross.014` `.034`; `ready.training.020` `.040`; `ready.streamliner.015` `.033`; `ready.sanctuary.007` `.032`

### Callback with no real origin event — 10

Reason: `Requires an exact earlier public origin event and knowledge path; no callback source is supplied.`

`callback.shared_recent.01` `.02` `.03` `.04` `.05` `.06` `.07` `.08` `.09` `.10`

Do not manufacture callback history.

### Placeholder actor `supporting` — 7

Reason: `Placeholder actor id “supporting” is not a runtime character; the actual named cast is required.`

`supporting.davis_zara_truth.04` `.05` `.06` `.07` `.08` `.09` `.10`

### Generic contractor is not a runtime actor — 4

Reason: `Generic contractor is not a runtime actor; contractor incidents wait for the Future Simulation addon.`

`nimbus_mi6.015`; `anarchy_balthazar.009`; `streamliner_incident_transit.008`; `night_shift.004`

### Open Davis/Ashai rivalry needs post-disclosure phase — 2

Reason: `Open Davis/Ashai rivalry requires the post-disclosure relationship phase.`

`davis_ashai_rivalry.013`; `davis_ashai_rivalry.014`

### Duskkin/Onari addon cast is not a current-world runtime actor — 2

Reason: `Duskkin/Onari addon cast is not a current-world runtime actor.`

`streamliner_incident_transit.004`; `night_shift.006`

### Unverified pendant warmth — 1

`domestic.ashai_greah.quiet.01` — `Pendant warmth is an unverified magical response; the existing simulator does not prove that response.`

### Training safety notice not in world state — 1

`domestic.ashai_greah.quiet.05` — `Requires the specific new training safety notice and Ashai having access to it.`

### Impossible meal conjunctions — 3

- `domestic.shared_meal.07` — `Requires a third agent and an actual spilled-tray incident; neither is established by shared meal state.`
- `domestic.shared_meal.09` — `Requires staggered arrivals and ten elapsed minutes before a later exchange; a single instantaneous surface cannot establish that sequence.`
- `domestic.shared_meal.10` — `Requires the hall emptying, Greah present, and a meal actually ending late at night.`

### Balthazar without Anarchy — 1

`domestic.shared_meal.16` — `Balthazar cannot appear independently of Anarchy.`

**Count check:** 44 + 16 + 10 + 7 + 4 + 2 + 2 + 1 + 1 + 3 + 1 = **91**.

---

## 9. Next recommended step

1. Read the complete primary canon and write `worldstream-server/WORLDSTREAM_ADDON_BIBLE.md` using the brief’s structure and this freeze.
2. Stop for Silent’s review.
3. **Do not write addon generators, do not activate Future Simulation, do not enable LLM refill, do not run another simulation from this checkpoint.**

Approval questions Silent will eventually need (not answered here): unofficial MI6–Legion outsourcing; MEU vs Legion rivalry as a simulated case type; Duskkin custody/penalty; Onari protest as a civic procedure; unnamed contractor roles; any Isolde comparison; any new named institution.
