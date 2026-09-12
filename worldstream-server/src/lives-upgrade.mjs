import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createFixture, RULES_VERSION, assertCanonState } from './fixture.mjs';
import { initialOffscreenLives } from './offscreen-lives.mjs';
import { backupWorld } from './world-operations.mjs';
import { londonDate } from './time.mjs';

const FROM = 'canon-ambient-p183-v22', TO = 'canon-ambient-p183-v23';
const identity = (fixture, version) => `fixture:${JSON.stringify([fixture.worldId, version,
  fixture.startMs, fixture.endMs, fixture.maxActions])}`;
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ledger = db => db.prepare('SELECT seq,id,occurred_at,semantic_json,recorded_at FROM events ORDER BY seq').all();
const pending = db => db.prepare('SELECT id,due_at,priority,action_json FROM scheduled_actions ORDER BY id').all();

// Explicit, offline release boundary. None of the new lives is reconstructed in
// already recorded time, and no existing event, memory or pending action is edited.
export function upgradeOffscreenLives({ directory, backupPath } = {}) {
  if (typeof directory !== 'string' || !directory.trim()) throw new TypeError('An existing pinned directory is required');
  if (![TO, 'canon-ambient-p183-v24', 'canon-ambient-p183-v25', 'canon-ambient-p183-v26', 'canon-ambient-p183-v27'].includes(RULES_VERSION)) throw new Error('This upgrade belongs to release v23 or later');
  directory = resolve(directory);
  const manifestPath = join(directory, 'active-world.json'), databasePath = join(directory, 'world.sqlite');
  if (!existsSync(manifestPath) || !existsSync(databasePath)) throw new Error('An existing pinned world is required');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 1 || manifest.database !== 'world.sqlite') throw new Error('Unknown world manifest');
  const db = new DatabaseSync(databasePath);
  try {
    const before = db.prepare('SELECT * FROM world_state WHERE id=1').get();
    if (!before) throw new Error('World state is missing');
    const original = JSON.parse(before.state_json);
    if (!Number.isSafeInteger(original.meta?.startMs)) throw new Error('World epoch is missing');
    const fixture = createFixture({ startMs: original.meta.startMs });
    if (before.rules_version === identity(fixture, TO)) {
      // The database commit is authoritative. Repair only the known crash
      // window where its matching manifest has not yet been renamed.
      const receipts = original.meta?.upgrades?.filter(item => item.from === FROM && item.to === TO) ?? [];
      const receipt = receipts[0];
      if (![FROM, TO].includes(manifest.rulesVersion) || receipts.length !== 1
        || !Number.isSafeInteger(receipt?.cutoverAt) || receipt.cutoverAt < fixture.startMs
        || receipt.cutoverAt > before.resolved_through
        || receipt.activationActionId !== `lives-v23/activate/${receipt.cutoverAt}`
        || !/^[a-f0-9]{64}$/.test(receipt.historicalLedgerDigest ?? '')
        || !/^[a-f0-9]{64}$/.test(receipt.backupSha256 ?? '')
        || !Object.hasOwn(original, 'offscreenLives')) throw new Error('No matching committed upgrade receipt');
      assertCanonState(original);
      if (manifest.rulesVersion !== TO) saveManifest();
      return { status: 'already_upgraded', rulesVersion: TO, cutoverAt: receipt.cutoverAt,
        activationActionId: receipt.activationActionId };
    }
    if (manifest.rulesVersion !== FROM || before.rules_version !== identity(fixture, FROM))
      throw new Error('Only the pinned v22 release can be upgraded');
    if (Object.hasOwn(original, 'offscreenLives')) throw new Error('Unexpected prior offscreenLives state');
    if ((original.meta.upgrades ?? []).some(item => item.to === TO)) throw new Error('Unexpected prior lives upgrade receipt');
    if (!Number.isSafeInteger(before.resolved_through) || before.resolved_through < fixture.startMs
      || before.resolved_through + 1 >= fixture.endMs) throw new Error('Invalid release cutover');
    const state = structuredClone(original);
    state.offscreenLives = initialOffscreenLives();
    // Validate before making the backup as well as before committing. A malformed
    // v22 save must not be dressed up as an accepted new release.
    assertCanonState(state);
    if (typeof backupPath !== 'string' || !backupPath.trim()) throw new Error('Choose a new backup path before upgrading');
    const historyBefore = digest(ledger(db)), pendingBefore = pending(db), cutoverAt = before.resolved_through;
    const action = { id: `lives-v23/activate/${cutoverAt}`, type: 'WORLD_LIVES_ACTIVATE',
      day: londonDate(cutoverAt + 1), dueAt: cutoverAt + 1, priority: 1 };
    if (pendingBefore.some(row => row.id === action.id || JSON.parse(row.action_json).type === action.type))
      throw new Error('Unexpected prior lives activation');
    const backup = backupWorld({ db }, backupPath);
    db.exec('BEGIN IMMEDIATE');
    let report;
    try {
      const locked = db.prepare('SELECT * FROM world_state WHERE id=1').get();
      if (JSON.stringify(locked) !== JSON.stringify(before) || digest(ledger(db)) !== historyBefore
        || JSON.stringify(pending(db)) !== JSON.stringify(pendingBefore))
        throw new Error('The world changed during backup; stop its server before upgrading');
      const receipt = { from: FROM, to: TO, cutoverAt, activationActionId: action.id,
        historicalLedgerDigest: historyBefore, backupPath: resolve(backupPath), backupSha256: backup.sha256 };
      state.meta.upgrades = [...(state.meta.upgrades ?? []), receipt];
      assertCanonState(state);
      db.prepare('INSERT INTO scheduled_actions(id,due_at,priority,action_json) VALUES(?,?,?,?)')
        .run(action.id, action.dueAt, action.priority, JSON.stringify(action));
      db.prepare('UPDATE world_state SET rules_version=?,state_json=? WHERE id=1')
        .run(identity(fixture, TO), JSON.stringify(state));
      if (digest(ledger(db)) !== historyBefore) throw new Error('Historical ledger changed during upgrade');
      const untouched = pending(db).filter(row => row.id !== action.id);
      if (JSON.stringify(untouched) !== JSON.stringify(pendingBefore)) throw new Error('Existing pending actions changed during upgrade');
      report = { status: 'upgraded', from: FROM, rulesVersion: TO, cutoverAt,
        backupPath: resolve(backupPath), backup, historicalLedgerDigest: historyBefore,
        historicalEvents: backup.events, pendingBefore: backup.pending, activationActionId: action.id };
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    saveManifest();
    return report;
  } finally { db.close(); }

  function saveManifest() {
    const temporary = `${manifestPath}.v23.tmp`;
    writeFileSync(temporary, JSON.stringify({ ...manifest, rulesVersion: TO }, null, 2) + '\n');
    renameSync(temporary, manifestPath);
  }
}
