import { resolve, join } from 'node:path';
import { upgradeLivingPlaces } from '../src/living-places-upgrade.mjs';

const directory = process.argv[2];
if (!directory) {
  throw new Error('Stop the world server or Durable Object, then supply the existing pinned v26 directory that holds world.sqlite and active-world.json');
}
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-living-places-v27-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeLivingPlaces({ directory, backupPath }), null, 2));
