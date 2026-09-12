# Production v26 → v27 Living Places / Onari Ecology upgrade (do not run against the live world from this document)

This is the exact procedure for an existing `canon-ambient-p183-v26` world (Node pinned directory or Cloudflare Durable Object SQLite). It is prospective only. It does not reseed, backfill historical site disturbances, rewrite history, or change epoch, seed, watermark, or existing pending actions.

It does **not** replace or fold into the prior upgrades. The intended chain is:

```text
v23 → v24 MEU → v25 Legion → v26 Duskkin → v27 Living Places
```

**Do not execute this against the live production world from an audit or coding session.** Prove it on a copy.

## What the upgrade does

`src/living-places-upgrade.mjs` `upgradeLivingPlaces()`:

1. Refuses unless the checkout is `canon-ambient-p183-v27` and the pinned world is still v26.
2. Backs up the SQLite image with SHA-256 + integrity check.
3. Installs empty `livingPlaces` if missing. Does not reconstruct site disturbances or cases from historical incidents.
4. Writes one pending `WORLD_LIVING_PLACES_ACTIVATE` at `resolved_through + 1`.
5. Changes `rules_version` / manifest to v27.
6. Leaves the event ledger, seed, epoch, watermark, and every existing pending action untouched.
7. Is idempotent and rolls back if the world changes mid-backup.

Site consequence memory and Onari ecology cases open only from new committed qualifying source events after `WORLD_LIVING_PLACES_ACTIVATE` commits.

## Node pinned directory

```text
node scripts/upgrade-living-places.mjs /path/to/pinned-v26-world [/path/to/before-v27.sqlite]
```

Then `openPinnedWorld({ directory })` and advance past `cutoverAt + 1`. Confirm:

- event ledger bytes before cutover are unchanged;
- seed, `meta.startMs`, and `resolved_through` match the backup until you deliberately advance;
- pending actions = previous pending + the one activation;
- no `SITE_*` or `ONARI_*` caused by events that occurred at or before cutover.

## Cloudflare Durable Object

`ensureWorld` refuses a v26 identity under the v27 fixture. Shipping v27 Worker code onto an unupgraded v26 DO fails closed.

Procedure on a **copy**:

1. Export the DO SQLite.
2. Place it in a pinned directory as `world.sqlite` with `active-world.json` still naming v26.
3. Run `node scripts/upgrade-living-places.mjs <copy-dir> <backup.sqlite>`.
4. Verify the copy.
5. Only after review: replace the stopped DO’s storage with the upgraded SQLite and start the v27 Worker.

## Forbidden

- Deleting `world.sqlite` and letting startup create a new world.
- Overwriting `rules_version` by hand.
- Installing Living Places inside `upgradeDuskkinCompliance`.
- Running the upgrade while the live object can advance.
