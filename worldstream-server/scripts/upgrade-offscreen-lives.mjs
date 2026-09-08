import { resolve, join } from 'node:path';
import { upgradeOffscreenLives } from '../src/lives-upgrade.mjs';

const directory = process.argv[2];
if (!directory) throw new Error('Stop the world server, then supply its existing pinned directory');
const backupPath = process.argv[3] ?? join(resolve(directory), 'backups', `before-lives-v23-${Date.now()}.sqlite`);
console.log(JSON.stringify(upgradeOffscreenLives({ directory, backupPath }), null, 2));
