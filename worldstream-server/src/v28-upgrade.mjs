import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createFixture, RULES_VERSION, assertCanonState } from './fixture.mjs';
import { backupWorld } from './world-operations.mjs';
import { fixtureIdentity, matchesRulesIdentity } from './world-identity.mjs';

const FROM = 'canon-ambient-p183-v27', TO = 'canon-ambient-p183-v28';
const digest = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const ledger = db => db.prepare('SELECT seq,id,occurred_at,semantic_json,recorded_at FROM events ORDER BY seq').all();
const pending = db => db.prepare('SELECT id,due_at,priority,action_json FROM scheduled_actions ORDER BY id').all();

export function upgradeV28({ directory, backupPath } = {}) {
  if (typeof directory !== 'string' || !directory.trim()) throw new TypeError('An existing pinned directory is required');
  if (![TO, 'canon-ambient-p183-v29', 'canon-ambient-p183-v30'].includes(RULES_VERSION)) throw new Error('This upgrade belongs to release v28 or later');
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
    if (matchesRulesIdentity(before.rules_version, fixture, TO)) {
      const receipts = original.meta?.upgrades?.filter(item => item.from === FROM && item.to === TO) ?? [];
      const receipt = receipts[0];
      if (![FROM, TO].includes(manifest.rulesVersion) || receipts.length !== 1
        || !Number.isSafeInteger(receipt?.cutoverAt) || receipt.cutoverAt < fixture.startMs
        || receipt.cutoverAt > before.resolved_through) throw new Error('No matching committed upgrade receipt');
      assertCanonState(original);
      if (manifest.rulesVersion !== TO) saveManifest();
      return { status: 'already_upgraded', rulesVersion: TO, cutoverAt: receipt.cutoverAt };
    }
    if (manifest.rulesVersion !== FROM || !matchesRulesIdentity(before.rules_version, fixture, FROM))
      throw new Error('Only the pinned v27 release can be upgraded');
    if ((original.meta.upgrades ?? []).some(item => item.to === TO)) throw new Error('Unexpected prior v28 upgrade receipt');
    if (!Number.isSafeInteger(before.resolved_through) || before.resolved_through < fixture.startMs
      || before.resolved_through + 1 >= fixture.endMs) throw new Error('Invalid release cutover');
    const state = structuredClone(original);
    assertCanonState(state);
    if (typeof backupPath !== 'string' || !backupPath.trim()) throw new Error('Choose a new backup path before upgrading');
    const historyBefore = digest(ledger(db)), pendingBefore = pending(db), cutoverAt = before.resolved_through;
    const backup = backupWorld({ db }, backupPath);
    db.exec('BEGIN IMMEDIATE');
    let report;
    try {
      const locked = db.prepare('SELECT * FROM world_state WHERE id=1').get();
      if (JSON.stringify(locked) !== JSON.stringify(before) || digest(ledger(db)) !== historyBefore
        || JSON.stringify(pending(db)) !== JSON.stringify(pendingBefore))
        throw new Error('The world changed during backup; stop its server before upgrading');
      const receipt = {
        from: FROM,
        to: TO,
        cutoverAt,
        historicalLedgerDigest: historyBefore,
        backupPath: resolve(backupPath),
        backupSha256: backup.sha256,
        upgradedAt: Date.now(),
      };
      state.meta.upgrades = [...(state.meta.upgrades ?? []), receipt];
      assertCanonState(state);
      db.prepare('UPDATE world_state SET rules_version=?,state_json=? WHERE id=1')
        .run(fixtureIdentity(fixture, TO), JSON.stringify(state));
      if (digest(ledger(db)) !== historyBefore) throw new Error('Historical ledger changed during upgrade');
      if (JSON.stringify(pending(db)) !== JSON.stringify(pendingBefore)) throw new Error('Existing pending actions changed during upgrade');
      report = {
        status: 'upgraded',
        from: FROM,
        rulesVersion: TO,
        cutoverAt,
        backupPath: resolve(backupPath),
        backup,
        historicalLedgerDigest: historyBefore,
        historicalEvents: backup.events,
        pendingBefore: backup.pending,
      };
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    saveManifest();
    return report;
  } finally {
    db.close();
  }

  function saveManifest() {
    const temporary = `${manifestPath}.v28.tmp`;
    writeFileSync(temporary, JSON.stringify({ ...manifest, rulesVersion: TO }, null, 2) + '\n');
    renameSync(temporary, manifestPath);
  }
}
