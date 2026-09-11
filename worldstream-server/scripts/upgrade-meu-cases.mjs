import { resolve, join } from 'node:path';
import { upgradeMeuCases } from '../src/meu-upgrade.mjs';

const directory = process.argv[2];
if (!directory) {
  throw new Error('Stop the world server or Durable Object, then supply the existing pinned directory that holds world.sqlite and active-world.json');
}
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-meu-v24-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeMeuCases({ directory, backupPath }), null, 2));
