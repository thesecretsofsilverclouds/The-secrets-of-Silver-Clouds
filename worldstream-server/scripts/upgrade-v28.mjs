import { resolve, join } from 'node:path';
import { upgradeV28 } from '../src/v28-upgrade.mjs';

const directory = process.argv[2];
if (!directory) {
  throw new Error('Stop the world server or Durable Object, then supply the existing pinned v27 directory that holds world.sqlite and active-world.json');
}
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-v28-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeV28({ directory, backupPath }), null, 2));
