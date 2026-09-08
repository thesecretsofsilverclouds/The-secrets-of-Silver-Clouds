import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createFixture, RULES_VERSION } from './fixture.mjs';
import { openWorld } from './world.mjs';

function refuse(message) {
  const error = new Error(`${message} Saved history was not changed. Migration must be a separate, explicit operation; use a distinct new dbPath only for an isolated test world.`);
  error.code = 'SAVED_WORLD_REQUIRES_REVIEW';
  throw error;
}

// WorldStore's constructor sets WAL/schema before checking fixture identity.
// Startup therefore checks existing saves through a read-only connection first.
// The constructor still checks identity again to guard against a stale preflight.
function validateSavedWorld(dbPath, { seed, startMs }) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='world_state'").get();
    if (!table) refuse(`The existing database at ${dbPath} is not a saved Silver Clouds world.`);
    const row = db.prepare('SELECT seed, rules_version, state_json FROM world_state WHERE id = 1').get();
    if (!row) refuse(`The existing database at ${dbPath} has no saved world state.`);
    let saved;
    try { saved = JSON.parse(row.state_json); }
    catch { refuse(`The saved world at ${dbPath} has invalid state data.`); }
    if (!Number.isSafeInteger(saved.meta?.startMs)) refuse(`The saved world at ${dbPath} has no valid epoch.`);
    const fixture = createFixture({ startMs: saved.meta.startMs });
    const expectedRules = `fixture:${JSON.stringify([
      fixture.worldId, fixture.rulesVersion, fixture.startMs, fixture.endMs, fixture.maxActions,
    ])}`;
    if (row.rules_version !== expectedRules) refuse(`The saved world at ${dbPath} does not match rules ${RULES_VERSION}; refusing to reinterpret its history.`);
    if (seed !== undefined && row.seed !== seed) refuse(`The requested seed differs from the saved world at ${dbPath}.`);
    if (startMs !== undefined && saved.meta.startMs !== startMs) refuse(`The requested epoch differs from the saved world at ${dbPath}.`);
  } finally {
    db.close();
  }
}

export function openStartupWorld({ dataDirectory, dbPath, seed, startMs } = {}) {
  const explicitPath = dbPath !== undefined;
  if (explicitPath && (typeof dbPath !== 'string' || !dbPath.trim())) throw new TypeError('dbPath must be a nonempty path');
  if (!explicitPath && (typeof dataDirectory !== 'string' || !dataDirectory.trim())) throw new TypeError('A dataDirectory is required for normal startup');
  const selectedPath = explicitPath
    ? dbPath === ':memory:' ? dbPath : resolve(dbPath)
    : join(resolve(dataDirectory), `world-${RULES_VERSION}.sqlite`);

  if (selectedPath !== ':memory:' && existsSync(selectedPath)) {
    validateSavedWorld(selectedPath, { seed, startMs });
  } else if (!explicitPath && existsSync(dataDirectory)) {
    const olderWorlds = readdirSync(dataDirectory).filter(name => /^world-.+\.sqlite$/.test(name)).sort();
    if (olderWorlds.length) {
      refuse(`No ${RULES_VERSION} world exists, but saved worlds are present (${olderWorlds.join(', ')}). Refusing to silently create a replacement world.`);
    }
  }

  return openWorld({ dbPath: selectedPath, seed, startMs });
}
