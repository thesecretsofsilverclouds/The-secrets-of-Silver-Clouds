import { resolve, join } from 'node:path';
import { upgradeLegionJobs } from '../src/legion-upgrade.mjs';

const directory = process.argv[2];
if (!directory) {
  throw new Error('Stop the world server or Durable Object, then supply the existing pinned v24 directory that holds world.sqlite and active-world.json');
}
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-legion-v25-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeLegionJobs({ directory, backupPath }), null, 2));
