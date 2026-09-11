import { resolve, join } from 'node:path';
import { upgradeDuskkinCompliance } from '../src/duskkin-upgrade.mjs';

const directory = process.argv[2];
if (!directory) {
  throw new Error('Stop the world server or Durable Object, then supply the existing pinned v25 directory that holds world.sqlite and active-world.json');
}
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-duskkin-v26-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeDuskkinCompliance({ directory, backupPath }), null, 2));
