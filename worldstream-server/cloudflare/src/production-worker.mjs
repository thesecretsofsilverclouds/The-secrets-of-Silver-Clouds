import readerWorker from './worker.mjs';
import { ControlledWorldDurableObject } from './controlled-world.mjs';

// The production object is an explicitly imported continuation. Local/staging
// bootstrap remains in worker.mjs; production can never silently create one.
export { ControlledWorldDurableObject as WorldDurableObject };

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/__ops/')) {
      // Only the configured active object and preserved rollback source can be
      // addressed. The controller authenticates every operation independently.
      const target = request.headers.get('x-worldstream-target') || env.WORLD_ID;
      if (![env.WORLD_ID, env.WORLD_MIGRATION_SOURCE_ID].filter(Boolean).includes(target))
        return new Response('Unknown maintenance target', { status: 400 });
      return env.WORLD_DO.get(env.WORLD_DO.idFromName(target)).fetch(request);
    }
    return readerWorker.fetch(request, env, ctx);
  },
  scheduled(event, env, ctx) { return readerWorker.scheduled(event, env, ctx); },
};
