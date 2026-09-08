import { resolve, join } from 'node:path';
import { upgradeWorldDepth } from '../src/depth-upgrade.mjs';

const directory = process.argv[2];
if (!directory) throw new Error('Stop the world server, then supply its existing pinned directory');
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-depth-v22-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeWorldDepth({ directory, backupPath }), null, 2));
