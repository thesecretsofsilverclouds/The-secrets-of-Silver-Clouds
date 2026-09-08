import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { semanticDigest } from '../experiment-l/src/world.mjs';
import { ServiceWorldStore } from './service-world.mjs';
import { createFixture, DEFAULT_SEED } from './fixture.mjs';
import { londonDate, atLondon } from './time.mjs';
export { semanticDigest };

export function openWorld({dbPath,seed,startMs}={}) {
  if(!dbPath) throw new TypeError('A database path is required');
  // Recover the persisted epoch. Restarting tomorrow must not create a new world.
  if(dbPath!==':memory:'&&existsSync(dbPath)) {
    const db=new DatabaseSync(dbPath,{readOnly:true});
    try {
      const hasTable=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='world_state'").get();
      if(hasTable) {
        const row=db.prepare('SELECT seed,state_json FROM world_state WHERE id=1').get();
        if(row) {
          const saved=JSON.parse(row.state_json);
          if(!saved.meta?.startMs) throw new Error('Database is not a Silver Clouds Now world');
          if(startMs!==undefined&&startMs!==saved.meta.startMs) throw new Error('Persisted epoch differs');
          startMs=saved.meta.startMs;
          if(seed!==undefined&&seed!==row.seed) throw new Error('Persisted seed differs');
          seed=row.seed;
        }
      }
    } finally {db.close();}
  }
  if(startMs===undefined) {
    const today=londonDate(Date.now());
    const yesterday=new Date(Date.parse(`${today}T12:00:00Z`)-86_400_000).toISOString().slice(0,10);
    startMs=atLondon(yesterday,'00:00');
  }
  return new ServiceWorldStore({dbPath,seed:seed??DEFAULT_SEED,fixture:createFixture({startMs})});
}
