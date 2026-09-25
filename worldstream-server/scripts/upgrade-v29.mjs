import { resolve, join } from 'node:path';
import { upgradeNarrativeSystems } from '../src/narrative-upgrade.mjs';
const directory = process.argv[2];
if (!directory) throw new Error('Stop the writer, then supply the pinned v28 directory containing world.sqlite and active-world.json');
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-v29-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeNarrativeSystems({ directory, backupPath }), null, 2));
