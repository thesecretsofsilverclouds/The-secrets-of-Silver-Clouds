# WorldStream narrative systems, v29

Implemented in the canonical runtime, 2026-09-20. This supersedes the planning-only status of the earlier three-addon proposal. These are adaptations to WorldStream's discrete, canon-constrained engine; the implementation makes no claim of globally unique algorithms, spectral prediction, or emergent Turing waves.

Reality is deterministic given the seed and committed external inputs. Narrative patterns emerge from lawful choices and persistent consequences. Language comes from the existing reviewed prose and deterministic presentation grammar. Production makes **zero LLM calls**, even with legacy generation flags enabled. Explicit offline authoring tools remain separate.

## Hard boundaries

- SPECTRA ranks only scenes already admitted by the existing eligibility, knowledge, cast, time, cooldown and least-performed gates. It cannot admit a scene.
- MORPHOS stores motif affinity, never facts, emotions, knowledge, objects or abilities. Its graph is not a communication channel. Echoes cannot excite themselves.
- CSV evaluates only the two ordinary loyalty/ambition options in the real intent resolver. Duty, fatigue, repair and recent shared activity retain precedence; the original resolver still owns acceptance, refusal, travel and completion.
- Onari observes, communicates and responds to committed ecological facts. Narrative scores cannot create environmental damage. The independent habitat rule reads only committed weather and exposure history.
- Nothing depends on a viewer, request count, wall-clock scoring deadline, LLM, or network service. Scheduled weather is recorded input; archived history/context reads do not advance reality.

## Runtime modules

| Module | Mechanism | Real effect |
| --- | --- | --- |
| `src/spectra.mjs` | Provenance-backed unresolved interruptions, pressure residue and overlapping accepted commitments | A fitting admitted passage can win a real canonical booking or event-bound reservoir selection |
| `src/morphos.mjs` | Local activator/refractory motif memory over actual actor/place links, with fixed quarter-hour diffusion | Original completed actions suppress immediate repetition, then modestly favour later related passages |
| `src/canonical-fork.mjs`, `src/counterfactual-value.mjs` | Isolated complete queues running the same reducer under two legal ordinary choices | Completed useful commitments can modestly bias a free choice; extra disruption blocks preference |
| `src/habitat-dynamics.mjs`, `src/living-places.mjs` | Independent sustained wet-ground exposure, recorded source/end facts, existing observation/referral/recovery machinery | Real habitat consequences can be witnessed, communicated and addressed by Onari |

SPECTRA deliberately uses exact discrete evidence rather than an invalid continuous world Jacobian. It contributes at most `ln(1.25)` of scene log-weight. Annotations bind reviewed passage IDs, actual content hashes and reservoir source hashes; changed or unknown text has no annotation.

MORPHOS uses four motifs: shared recovery, companionship, practice and everyday competition. Each has a memory field with a 36-hour lifetime and a refractory field with a 6-hour lifetime. Mixing is a convex neighbour average followed by decay, so fields remain in `[0,1]`. An original qualifying event deposits `.6` memory and `1` suppression at the next fixed bucket. This leaves measurable affinity at existing 12/36-hour scene opportunities without relaxing cooldowns. There are at most 32 anchors and 16 retained source references per motif; fields below `1e-6` retire, while the source cursor prevents old events from reviving them. Integration occurs only at canonical action boundaries and preserves the historical topology across idle intervals.

SPECTRA and MORPHOS share a capped exponential race using the existing scene hash. Their combined largest-to-smallest relative influence cannot exceed 2. Equal weights preserve the exact original order. Reservoir weights are captured in the committed event; a later viewer cannot reinterpret that event using today's pressure or motifs. Canonical scene bookings still revalidate at performance.

CSV clones canonical state and the complete pending queue, including the current action, stable IDs, seed, epoch and sequence. It compares the immediate result and actual elapsed horizons of 1, 2, 4 and 6 hours. Nested CSV and subsequent narrative steering are disabled in both forks. Sensitivity is diagnostic; signed completed-commitment gains and disruption costs determine value. Cosmetic observations, prose, motif fields and event volume do not count as useful consequences. Hypothetical evidence stays private and never becomes real causality or character knowledge.

CSV preserves the original 4:3 prior exactly at zero bias and caps relative influence at 1.25. Limits are one evaluation per six simulation hours, 128 actions across both branches, a 2 MiB state/queue cloning budget and 4,096 pending actions. Incomplete, oversized, invalid or exhausted comparisons are neutral. Node measurements for three seven-day seeds found five natural evaluations: two positive and three neutral, using 34–53 paired actions. See `reports/csv-runtime-measurement.json`; these are local measurements, not Cloudflare CPU certification.

The physical habitat rule uses sustained heavy rain/storm evidence at the existing plaza gardens, ends the active source when conditions dry, and has a fourteen-day episode cooldown. Repeated cached weather is not fresh evidence. A single rainy observation cannot manufacture damage. Referrals require real observed knowledge and a real encounter, so some seeds correctly produce damage/recovery with no Onari referral.

## Persistence and release

`state.narrativeSignals` is canonical, versioned and ledger-replayed. Fresh v29 worlds enable it. Existing saved worlds refuse an identity mismatch and require an explicit prospective upgrade. The upgrade preserves the epoch, seed, watermark, old events and pending actions, adds a receipt and one private owned activation action at `cutover + 1ms`, and takes a backup. The field is first created by that activation event; old history is never rescored.

With the writer stopped, use a pinned v28 copy containing `world.sqlite` and `active-world.json`:

```powershell
node scripts/upgrade-v29.mjs <pinned-directory> <new-backup-path>
```

Older saves must run the existing intermediate upgrades first. For Cloudflare, export and upgrade a pinned copy and restore that upgraded database through the deployment workflow. Startup does not silently relabel a save. No live database was migrated or deployed as part of implementation.

## Verification

Final acceptance run: **1,042 tests passed, zero failed** — 968 Node runtime tests, 37 Cloudflare tests, and 37 lab/harness/shadow tests. The lab run includes full simulation fixtures. Deployment and live-save migration were not performed.

Dedicated tests cover real changed scene bookings and intent choices, neutral parity, illegal/cooldown/knowledge rejection, motif suppression/echo/extinction/revival, source deduplication, forward/reverse ledger replay, JSON restart and chunked advancement, clone/action budgets, hypothetical-evidence privacy, real model-call tripwires, and prospective activation parity between Node and the Cloudflare SQLite adapter. See `test/{spectra,morphos,counterfactual-value,narrative-upgrade,runtime-no-llm}.test.mjs` and the Onari integration tests.
