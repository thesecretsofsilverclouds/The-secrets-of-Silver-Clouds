# RHYTHM v30: implementation and release procedure

**Deployed and activated prospectively on 20 September 2026.** The separate preserving release passed production checks and resumed only `worldstream-v30-preserved-20260920`. The v29 and older v28 originals remain frozen. The release receipt, backup locations, observed CPU, prose gaps and remaining live-observation limits are in workspace `tmp/worldstream-v30-ops-20260920/DEPLOYMENT-RESULT.md`. The procedure below remains the required approach for any later release or rollback.

RHYTHM changes which legal routine fills three existing slots: Ashai's daytime leisure, Goaden's evening leisure, and Ashai's evening leisure. Its deterministic selection uses actual completed activities, bounded habit/satiety memory, known-event traces, need pressures, time of day and a small MORPHOS influence. All seven reviewed behaviour labels already exist. Training can settle needs after actual duty but is not offered as free leisure. No new prose, phone/contact mechanic, relationship action, or LLM call was introduced.

## What now runs

- `src/rhythm.mjs`: pure selection and bounded canonical bookkeeping. Candidate legality precedes scoring; the preference ratio is capped at four. Two actors, seven labels, at most 24 history entries and eight traces per actor, with a strict 4,096-byte UTF-8 budget.
- `src/fixture.mjs`: the three owned calendar decisions, ordinary routine starts/completions, real elapsed sleep and learned-fact hooks. RHYTHM cannot create a slot, extend its duration, postpone a duty, break an accepted arrangement, or credit an interrupted routine as complete.
- Node and Cloudflare adapters supply the real pending queue at both choice and start. A duty arriving between them takes precedence. CSV still receives the full canonical state/queue and retains its existing action, cloning, queue and cooldown limits.
- Private needs, habit values, score tables and unperformed choices stay outside reader projections. Normal committed routine events continue to use existing authored prose/ticker/reservoir selection.
- `src/rhythm-upgrade.mjs`, `scripts/upgrade-v30.mjs`, and `src/prospective-activation.mjs`: explicit preserving migration, reversible activation and independent validation of pending v29/v30 activations.

## Evidence

`RHYTHM-ACCEPTANCE.json` records the actual reducer's 30-seed, 14-day behaviour run and 90-day size check, source fingerprints, individual worlds, distribution gates, forward/reverse replay, SQLite restart and chunking equivalence, and network tripwire. The suite includes dedicated math, parity, integration, real Node/Cloudflare adapter, migration and causal-response tests.

Final local verification on 2026-09-20:

| Check | Result | Evidence |
|---|---|---|
| Full Node regression suite, including all RHYTHM tests | 1,012 passed; zero failed/skipped | Workspace `tmp/rhythm-v30-final-tests.txt` |
| Cloudflare suite plus both real adapter regressions | 67 passed; zero failed/skipped | Workspace `tmp/rhythm-v30-final-cloudflare-tests.txt` |
| Moment Engine and shadow lab suites | 37 passed; zero failed/skipped | Workspace `tmp/rhythm-v30-lab-tests.txt` |
| Actual-reducer behaviour acceptance | 44,084 events, 1,060 choices; all 20 distribution gates pass | `RHYTHM-ACCEPTANCE.json` |
| Replay, restart and chunking | Identical complete canonical results | Acceptance report `determinism` |
| Ninety simulated days | 9,414 events; actor peaks 2,661/2,626 bytes, below 4,096 | Acceptance report `longRun` |
| Cloudflare bundle | Wrangler production-config dry run passed; no deployment | Workspace `tmp/rhythm-v30-build.log` |

The two adapter regressions appear in both suite totals; do not add those totals as unique tests. The acceptance report is complete, passing, and matches the final runtime source fingerprints. The separate eight-day projection records zero model calls, request-time authoring, refill reservations and network attempts.

Inactive preactivation worlds match both v29 reference hashes exactly, including CSV diagnostics, because they retain the old concrete queue. A disabled retained RHYTHM bag necessarily adds real clone bytes; the separate test makes this diagnostic distinction explicit while retaining the hard clone budget. No production metric is falsified to obtain parity.

Existing reservoir coverage is measured separately against an exclusive copy of the saved production world under `tmp/rhythm-v30-reservoir-final/` at the workspace root. The eight-day projection produced 818 events, with 149 reservoir displays using 62 distinct passages from 874 enabled rows; 274 distinct passages were eligible somewhere in the run. All 17 protected source/backup files remained unchanged. Output continued with existing material and fallbacks, with zero model, authoring or refill calls. Freshness is not inferred from total inventory: narrow meal contexts repeat, music/piano starts lack reservoir triggers, and some observed TV/game contexts have no eligible reservoir passage. This release adds no paid generation to fill those gaps.

Repeat local checks from `worldstream-server`:

```powershell
node --test test/rhythm*.test.mjs
node scripts/verify-rhythm-behaviour.mjs
npm test
npm run test:cloudflare
npm run test:lab
```

Do not regenerate captured v29 parity hashes from current v30 code. Do not use an in-progress acceptance result as a release gate: its `complete` and `pass` must both be true and its fingerprints must match the tested code.

## Future production migration

1. Pause the current live writer and await quiescence. Export a fresh complete v29 database, manifest/identity, Durable Object KV and recovery metadata, runtime/configuration and checksums. Keep the original frozen and its pinned backup untouched. The earlier v28 rollback materials are also retained.
2. Make a separate exclusive working copy of that pinned v29 directory. The directory must contain `world.sqlite` and `active-world.json`. Run the explicit migration **only against that working copy**, supplying a new nonexisting backup path:

   ```powershell
   node scripts/upgrade-v30.mjs <copied-v29-directory> <new-before-v30-backup.sqlite>
   ```

3. Verify seed, epoch, watermark, all historical event rows, existing state/knowledge/commitments and every old pending row. Migration adds only its receipt and one `WORLD_RHYTHM_ACTIVATE` action at cutover + 1 ms. It does not populate RHYTHM early, rescore history, or replace already queued routines. A pending owned v29 narrative activation is preserved independently.
4. Import the verified copy into a new candidate Durable Object, using the preserving maintenance workflow. Keep the original object frozen. Configure the production Worker to use the new candidate only after its import matches the verified copy; use the controlled production entrypoint. A plain runtime rules-version bump against the old object is not a migration.
5. While still paused, run current/public-reader contract checks, both configured-origin CORS checks, historical pagination/old event context, read invariance, queue preservation, no-model instrumentation and the current reservoir inventory check. Migration/reader failure means stop and preserve state, not repair or overwrite it.
6. Activate at the owned cutover + 1 ms. Compare with an isolated activation reference, verify the complete old ledger and queue still match, and verify forward/reverse replay and persistence. RHYTHM begins with authored priors, not reconstructed historical habits. The already planned day retains its old concrete routines; subsequent normal day planning introduces the three decisions.
7. Resume only the verified candidate after every gate passes. Verify real simulation advancement, public bootstrap/reading, zero LLM/authoring/refill calls, and actual Cloudflare CPU/errors. Readers must not advance canon. Keep all CSV safeguards unchanged. An actual failed check requires a safe candidate pause and exact failure report.

Do not deploy this checkout against the currently configured v29 object without this separate migration. The controlled runtime deliberately rejects an incompatible rules identity instead of bootstrapping a replacement world.

## Rollback and retention

Retain the original v29 object and full pinned backup, all preexisting v28 recovery materials, and the verified migrated candidate. Do not resume both generations as competing writers. Before reverting a candidate that has advanced, pause and back it up independently so its new history is retained. Restoring an older runtime/object starts from that older cutover; it is not a merge of later history. Never delete backups merely because tests or a short observation window passed.

Phase-two routines such as phone calls or new solo outings remain out of scope. They require reviewed mechanics, permits and authored content before becoming candidates; RHYTHM cannot invent them.
