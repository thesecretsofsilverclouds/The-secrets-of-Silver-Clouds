# Production v25 → v26 Duskkin compliance upgrade (do not run against the live world from this document)

This is the exact procedure for an existing `canon-ambient-p183-v25` world (Node pinned directory or Cloudflare Durable Object SQLite). It is prospective only. It does not reseed, backfill Duskkin cases, rewrite history, or change epoch, seed, watermark, or existing pending actions.

It does **not** replace or fold into the v23 → v24 MEU upgrade or the v24 → v25 Legion upgrade. The intended chain is:

```text
v23 → v24 MEU → v25 Legion → v26 Duskkin
```

**Do not execute this against the live production world from an audit or coding session.** Prove it on a copy.

## What the upgrade does

`src/duskkin-upgrade.mjs` `upgradeDuskkinCompliance()`:

1. Refuses unless the checkout is `canon-ambient-p183-v26` and the pinned world is still v25.
2. Backs up the SQLite image with SHA-256 + integrity check.
3. Installs empty `duskkinCompliance` if missing. Does not reconstruct cases from historical incidents.
4. Writes one pending `WORLD_DUSKKIN_ACTIVATE` at `resolved_through + 1`.
5. Changes `rules_version` / manifest to v26.
6. Leaves the event ledger, seed, epoch, watermark, and every existing pending action untouched.
7. Is idempotent and rolls back if the world changes mid-backup.

Cases open only from new committed qualifying Duskkin source events after `WORLD_DUSKKIN_ACTIVATE` commits.

## Node pinned directory

```text
node scripts/upgrade-duskkin-compliance.mjs /path/to/pinned-v25-world [/path/to/before-v26.sqlite]
```

Then `openPinnedWorld({ directory })` and advance past `cutoverAt + 1`. Confirm:

- event ledger bytes before cutover are unchanged;
- seed, `meta.startMs`, and `resolved_through` match the backup until you deliberately advance;
- pending actions = previous pending + the one activation;
- no `DUSKKIN_COMPLIANCE_*` caused by events that occurred at or before cutover.

## Cloudflare Durable Object

`ensureWorld` refuses a v25 identity under the v26 fixture. Shipping v26 Worker code onto an unupgraded v25 DO fails closed.

Procedure on a **copy**:

1. Export the DO SQLite.
2. Place it in a pinned directory as `world.sqlite` with `active-world.json` still naming v25.
3. Run `node scripts/upgrade-duskkin-compliance.mjs <copy-dir> <backup.sqlite>`.
4. Verify the copy.
5. Only after review: replace the stopped DO’s storage with the upgraded SQLite and start the v26 Worker.

## Forbidden

- Deleting `world.sqlite` and letting startup create a new world.
- Overwriting `rules_version` by hand.
- Installing Duskkin compliance inside `upgradeLegionJobs`.
- Running the upgrade while the live object can advance.
