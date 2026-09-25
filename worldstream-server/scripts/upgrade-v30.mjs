import { resolve, join } from 'node:path';
import { upgradeRhythm } from '../src/rhythm-upgrade.mjs';
const directory = process.argv[2];
if (!directory) throw new Error('Stop the writer, then supply a copied pinned v29 directory containing world.sqlite and active-world.json');
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-v30-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeRhythm({ directory, backupPath }), null, 2));
