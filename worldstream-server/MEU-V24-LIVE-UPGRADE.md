# Production v23 → v24 MEU upgrade (do not run against the live world from this document)

This is the exact procedure for an **existing** `canon-ambient-p183-v23` world (Node pinned directory or Cloudflare Durable Object SQLite). It is prospective only. It does not reseed, backfill historical incidents, rewrite history, or change epoch, seed, watermark, or existing pending actions.

**Do not execute this against the live production world from an audit or coding session.** Prove it on a copy. Tests in `test/meu-upgrade.test.mjs` and `cloudflare/test/meu-v24-upgrade-identity.test.mjs` are that proof.

## What the upgrade does

`src/meu-upgrade.mjs` `upgradeMeuCases()`:

1. Refuses unless the checkout is `canon-ambient-p183-v24` and the pinned world is still v23.
2. Backs up the SQLite image (`VACUUM INTO`) with SHA-256 + integrity check.
3. Installs empty `meuCases` (no reconstructed cases).
4. Writes one pending `WORLD_MEU_ACTIVATE` at `resolved_through + 1`.
5. Changes `rules_version` / manifest to v24.
6. Leaves the event ledger, seed, epoch (`meta.startMs`), watermark (`resolved_through`), and every existing pending action untouched.
7. Is idempotent (`already_upgraded`) and rolls back if the world changes mid-backup.

Cases open only from **new** `INCIDENT` / `ARCANE_SURGE` events after `WORLD_MEU_ACTIVATE` commits.

## Preconditions

- Stop the Node world server **or** the Cloudflare Durable Object (no alarm / request advance).
- Checkout / deploy image is v24 code, but you have **not** yet pointed it at the live v23 database.
- You have a writable copy of the live `world.sqlite` plus `active-world.json` (`format: 1`, `database: world.sqlite`, `rulesVersion: canon-ambient-p183-v23`).

## Node pinned directory

```text
node scripts/upgrade-meu-cases.mjs /path/to/pinned-world [/path/to/before-v24.sqlite]
```

Then `openPinnedWorld({ directory })` and advance past `cutoverAt + 1` so `WORLD_MEU_ACTIVATE` fires. Confirm:

- event ledger bytes before cutover are unchanged;
- seed, `meta.startMs`, and `resolved_through` (until you deliberately advance) match the backup;
- pending actions = previous pending + the one activation;
- no `MEU_CASE_*` caused by events that occurred at or before cutover.

## Cloudflare Durable Object

The live object stores the same tables (`world_state`, `events`, `scheduled_actions`). `ensureWorld` now **refuses** a v23 `rules_version` under the v24 fixture (it no longer rebuilds a fixture from the watermark day). Shipping v24 Worker code onto an unupgraded v23 DO fails closed.

Two persisted identity forms are real:

- Node pinned worlds / `WorldStore` custom fixtures: `fixture:["silver-clouds-now","canon-ambient-p183-v23",…]`
- Cloudflare Durable Objects created before this release: bare `canon-ambient-p183-v23`

`upgradeMeuCases` accepts either v23 form. After a successful copy-upgrade it always writes the full v24 fixture identity. New Durable Objects persist that same identity so restart does not reinterpret history. A bare v24 string is still accepted on reopen (legacy write), but is not written anymore.

Procedure on a **copy**, never the live DO from this session:

1. Export the DO SQLite (Wrangler durable-object export / storage dump) to a file.
2. Place it in a pinned directory as `world.sqlite` with `active-world.json` still naming v23.
3. Run `node scripts/upgrade-meu-cases.mjs <copy-dir> <backup.sqlite>`.
4. Verify the copy with the same checks as Node.
5. Only after review: replace the stopped DO’s storage with the upgraded SQLite and start the v24 Worker.

If you start the v24 Worker against the unupgraded DO, construction throws:

`Saved world does not match rules canon-ambient-p183-v24; refusing to reinterpret its history.`

Restore from the backup; do not reseed.

## Forbidden

- Deleting `world.sqlite` and letting startup create a new world.
- Overwriting `rules_version` by hand to silence the identity check.
- Enabling MEU midway through a pending action without the activation receipt.
- Running the upgrade while alarms or `/api/observe` catch-up can advance the live object.
