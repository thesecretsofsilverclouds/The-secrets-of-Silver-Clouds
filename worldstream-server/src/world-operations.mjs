import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { openStartupWorld } from './startup-world.mjs';
import { RULES_VERSION } from './fixture.mjs';

// One directory is one continuity. A release never selects a different database
// just because its version number changed. Incompatible upgrades fail closed.
export function openPinnedWorld({directory,seed,startMs}={}) {
  directory=resolve(directory);mkdirSync(directory,{recursive:true});
  const manifestPath=join(directory,'active-world.json'),dbPath=join(directory,'world.sqlite');
  if(existsSync(manifestPath)) {
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
    if(manifest.format!==1||manifest.database!=='world.sqlite'||manifest.rulesVersion!==RULES_VERSION)
      throw new Error('Pinned world release differs. Keep its release or explicitly migrate a reviewed backup; refusing a new continuity.');
    if(!existsSync(dbPath)) throw new Error('Pinned world database is missing. Restore it; refusing a replacement history.');
  }
  const world=openStartupWorld({dbPath,seed,startMs});
  if(!existsSync(manifestPath)) {
    try {writeFileSync(manifestPath,JSON.stringify({format:1,database:'world.sqlite',rulesVersion:RULES_VERSION},null,2)+'\n',{flag:'wx'});}
    catch(error) {world.close();throw error;}
  }
  return world;
}

function inspected(path) {
  const db=new DatabaseSync(path,{readOnly:true});
  try {
    const check=db.prepare('PRAGMA integrity_check').get();
    if(Object.values(check)[0]!=='ok') throw new Error('Backup integrity check failed');
    const row=db.prepare('SELECT seed,rules_version,resolved_through FROM world_state WHERE id=1').get();
    if(!row) throw new Error('Backup has no world');
    return {...row,events:db.prepare('SELECT COUNT(*) AS n FROM events').get().n,
      pending:db.prepare('SELECT COUNT(*) AS n FROM scheduled_actions').get().n};
  } finally {db.close();}
}

export function backupWorld(world,targetPath) {
  targetPath=resolve(targetPath);
  if(existsSync(targetPath)||existsSync(`${targetPath}.json`)) throw new Error('Backup target already exists');
  mkdirSync(dirname(targetPath),{recursive:true});
  // VACUUM INTO produces one consistent standalone SQLite image including WAL.
  world.db.prepare('VACUUM main INTO ?').run(targetPath);
  const details=inspected(targetPath);
  const manifest={format:1,...details,sha256:createHash('sha256').update(readFileSync(targetPath)).digest('hex')};
  writeFileSync(`${targetPath}.json`,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return manifest;
}

export function restoreWorldBackup(sourcePath,targetPath) {
  sourcePath=resolve(sourcePath);targetPath=resolve(targetPath);
  if(existsSync(targetPath)||existsSync(`${targetPath}-wal`)||existsSync(`${targetPath}-shm`))
    throw new Error('Restore requires an empty destination; stop the service and choose a new recovery directory');
  const manifest=JSON.parse(readFileSync(`${sourcePath}.json`,'utf8'));
  if(manifest.sha256!==createHash('sha256').update(readFileSync(sourcePath)).digest('hex')) throw new Error('Backup checksum mismatch');
  inspected(sourcePath);mkdirSync(dirname(targetPath),{recursive:true});
  copyFileSync(sourcePath,targetPath,constants.COPYFILE_EXCL);
  return inspected(targetPath);
}
