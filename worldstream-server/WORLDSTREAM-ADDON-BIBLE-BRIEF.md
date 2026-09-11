# Next-model brief: WORLDSTREAM_ADDON_BIBLE.md

This is a planning assignment. Produce the complete bible, then stop for Silent's review. Do not implement addons, activate content, change the UI, or enable generation in this assignment.

## Product and architectural contract

Worldstream is a deterministic simulation presented through Silent's prose. The simulation creates and times lives, movements, incidents, relationships and consequences. Authored scenes, Moment grammar and reusable reservoirs express those facts. Reservoir availability must never be the reason an incident occurs.

When watched, the existing presentation/director may perform more already-authored material, but observation must not change canonical history or trigger authoring/refill reservation. The LLM stays offstage, replenishing reviewed material only through the separately approved scheduled lifecycle. Keep generation OFF; do not change its spending policy.

Verify Grok's reservoir acceptance against the current production admission/selection path, not only a separate harness. Once that acceptance passes, treat the existing core as frozen. Addons must use existing event, commitment, knowledge, persistence and rendering contracts. Preserve the current UI, weather, travel, music, character plates and prose presentation. Identify any unavoidable core dependency explicitly instead of quietly rewriting it.

The earlier SPECTRA/MORPHOS/CSV proposals are optional experiments, not dependencies or another mandatory architecture phase. This bible is about concrete canonical lives and institutions.

## Read the primary canon completely before designing

Located primary-source candidates under `C:/Users/chris/Desktop/SilverClouds_Project/canon/`:

- `manuscript_indexed.txt` and `manuscript.pdf` — indexed reading plus original page verification.
- `The Secrets of Silver Clouds Codex.txt`.
- `lore book.txt`.
- Relevant supplementary entries, including `Codex Entry Nimbus, the Cloud Rat.txt`.

Confirm editions, completeness and the currently permitted timeline/spoiler checkpoint. Read the **full manuscript, Codex and Lore Book**; keyword snippets and generated knowledge files are not substitutes. Record source filenames, versions/hashes, page/section conventions and reading coverage. If a required source is missing or truncated, report that precisely; do not claim a complete canon review.

Treat the descriptions below as Silent's design direction to verify against those sources. Do not fabricate passages, citations, institutional powers or precedents. Conflicts between sources must be surfaced rather than silently resolved.

## Six systems to design

1. **Magical London / MEU incidents.** Investigate the actual precedents for dangerous/illegal magic, regulated artefacts, rogue creatures and external magical-community work. Design small spell misuse, creature incidents, artefact accidents, ward failures and unusual magical-weather consequences only where canon and existing capabilities support them. Specify severity, location, lawful responders, escalation and closure. An incident about weather must not become permission to replace the existing weather simulation.
2. **Demon's Legion contracts.** Ground their role as London street kids turned vigilantes/folk heroes, especially conflicts between ordinary authority and oppressed magical communities. Examine direct community requests, favours, jobs, who accepts them and Goaden's old relationships. Verify unofficial MI6 outsourcing, payment/debrief arrangements and rivalry with MEU individually; do not assume they are established just because they are plausible proposed mechanics.
3. **Duskkin compliance.** Verify emissaries, Council/MI6 relations and the no-human-feeding rule. Define suspicion versus verified evidence, authority, jurisdiction, custody, liaison visits and legitimate outcomes. The existence of emissaries alone does not establish MI6 arrest powers, Council procedures or a particular penalty. No invented vampire economy or human-feeding market.
4. **Onari ecology and civic life.** Ground preservation, coexistence and interdependence in actual religion/culture and scenes. Evaluate habitat damage, development disputes, protected living things, protest, consultation and restoration; identify which procedures are extensions. Ground Yukon's divided loyalties in his actual relationships and voice, not a generic nature-activist stereotype.
5. **MI6 contractors and consultants.** Identify actual specialist precedents, including any Isolde comparison supported by canon. Alchemists, ward engineers and forensic specialists appear only for committed problems requiring an established competence. Distinguish existing named characters from proposed unnamed roles. No randomly appearing consultant flavour, invented authority or unsupported abilities.
6. **Faction crossings — later, after the first five exist.** Derive interactions from compatible, simultaneous committed interests of the Order, Church, MI6, Legion, Duskkin and Onari. A shared topic alone is not a meeting trigger: require jurisdiction, knowledge paths, authority to attend, physical availability and a reason to convene. Avoid all-faction briefing spam. Keep cross-system outcomes owned and idempotent so one incident cannot resolve or pay twice.

## Required canon classification

Label **each rule, authority claim and consequential outcome**, not just each system:

- **Direct canon:** supported explicitly by an identifiable manuscript scene or Codex/Lore entry.
- **Logical simulation extension:** a conservative repeatable rule inferred from identified canon; explain the inference and limits. Proposed numeric frequencies and cooldowns usually belong here.
- **Possible Expansion — requires Silent approval:** introduces unsupported powers, institutions, jurisdiction, relationship shifts, recurring commitments, named roles or material outcomes. Keep it out of the runnable design until approved.

A broad faction description is not evidence that a specific incident or interaction already happened. Identify actual scene-level precedents: small stories, downtime, recurring relationship patterns, locations and institutional behaviour. Cite manuscript chapter plus indexed/physical page, or Codex/Lore entry plus line/section locator. Use short excerpts only where necessary; paraphrase accurately. Explicitly state when no manuscript scene exists and only an institutional entry supports the idea.

## Deliverable structure

Create `worldstream-server/WORLDSTREAM_ADDON_BIBLE.md` containing:

1. Source/reading manifest and current runtime timeline constraints.
2. Canon precedent register, with stable IDs and conflicts/uncertainties.
3. One complete design chapter for each of the six systems.
4. Cross-system ownership and knowledge/jurisdiction matrix.
5. Existing-code extension map, content coverage gaps and explicit approval register.
6. Staged implementation order and acceptance tests. No implementation in this assignment.

For **every event family**, give this concrete chain:

```text
world state + source facts
→ deterministic trigger
→ eligible participants and authority
→ event/state-machine chain
→ possible outcomes and committed effects
→ cooldown/recurrence
→ eligible reservoir/grammar expression
```

Each family must specify:

- Purpose in everyday world life and exact stable event-family IDs.
- Canon precedent IDs and classification of proposed rules.
- Preconditions, negative gates, triggering evidence and deduplication key.
- State machine, including waiting, interrupted, expired, cancelled and closed paths where applicable.
- Existing locations; cast eligibility; scheduling, travel and commitment requirements.
- Faction authority/jurisdiction, who can refer a matter and who can close it.
- Proposed frequency/cooldown with units and a grounded rationale; active-case and escalation caps.
- Escalation/de-escalation conditions and concrete deterministic outcomes, including mundane/no-action outcomes.
- Persistent facts, source-event provenance, evidence visibility and expiry.
- Allowed relationship changes and who learns what through which actual path. Rumour is not proof.
- Forbidden outcomes, continuity limits and explicit spoiler/timeline gates.
- **Verified existing** reservoir family/scene IDs that can narrate each stage, with actual cast/location/knowledge gates. Do not confuse the acceptance library with runtime-admitted content.
- Additional prose/grammar genuinely missing, expressed as canon-bound authoring requirements rather than invented finished scenes.
- Specific 30/90-day tests and bounded runtime/storage cost estimates.

If a field is unsupported, write `unsupported`, `not applicable` or `Possible Expansion`; do not fill the template with invented lore. The complete bible can contain explicit blocked families and approval questions.

## Existing architecture and simulation tests

Inspect current code rather than assuming names/counts from earlier reports remain current. Reuse `src/fixture.mjs` reduction, existing action queue/ledger, scene admission, known relationship history, offscreen lives, faction agendas and commitment guards. Map every proposed addition to the smallest existing extension point; do not duplicate an incident or pursuit system already present.

Design 30/90-day multi-seed tests for case frequency/backlog, bounded storage, plausible closure and recurrence, travel/availability, protected arcs, evidence thresholds, knowledge isolation, relationship effects, spoiler gates, restart/replay, interrupted work and shared-case ownership. Include zero-viewer and differing observation schedules: identical seed/rules must give identical canonical history, with no addon model calls. Prove reader projection uses committed facts and that unavailable prose cannot create or alter an outcome. Large tests are to be run after implementation; do not claim they passed while writing the bible.

Crossings are designed now but implemented only after the first five systems pass their own tests. Existing authored arcs remain above ambient incident selection. Avoid new obligations that prevent the protagonists from ever sleeping, travelling or simply living.

## Stop condition

Deliver the complete bible with exact source locators, explicit inferences, blocked expansions and implementation dependencies. Summarize decisions Silent actually needs to review. **Do not implement code until the complete addon bible has been reviewed.** Approval of a Possible Expansion must be explicit; merely listing it in the bible does not approve it.

This brief is not itself the completed bible and does not claim the primary sources have already been read for this assignment.
