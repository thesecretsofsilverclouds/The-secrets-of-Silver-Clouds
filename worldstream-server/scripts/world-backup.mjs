import { resolve } from 'node:path';
import { openPinnedWorld,backupWorld,restoreWorldBackup } from '../src/world-operations.mjs';
const [command,source,target]=process.argv.slice(2);
if(!source||!target||!['backup','restore'].includes(command)) throw new Error('Usage: node scripts/world-backup.mjs backup <world-directory> <new-backup.sqlite> OR restore <backup.sqlite> <new-world.sqlite>');
if(command==='restore') console.log(restoreWorldBackup(source,target));
else {const world=openPinnedWorld({directory:resolve(source)});try{console.log(backupWorld(world,target));}finally{world.close();}}
