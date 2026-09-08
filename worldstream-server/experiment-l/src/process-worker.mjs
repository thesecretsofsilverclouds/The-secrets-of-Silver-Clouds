import { performance } from 'node:perf_hooks';
import { WorldStore, semanticDigest } from './world.mjs';

// This worker deliberately owns its own SQLite connection and OS process.
// Opening the connection precedes the IPC ready barrier; no advance occurs
// until the parent has received every participant's ready message.
let store;
let configuration;
let started = false;

function send(message) {
  return new Promise((resolve, reject) => {
    if (!process.send || !process.connected) {
      reject(new Error('The experiment worker requires an IPC parent.'));
      return;
    }
    process.send(message, (error) => (error ? reject(error) : resolve()));
  });
}

async function fail(error) {
  try {
    store?.close();
  } catch {
    // Preserve the original failure, including a failed transaction.
  }
  try {
    await send({
      type: 'failed',
      pid: process.pid,
      error: error?.stack ?? String(error),
    });
  } catch {
    process.stderr.write(`${error?.stack ?? error}\n`);
  }
  process.exit(1);
}

process.on('message', async (message) => {
  try {
    if (message?.type === 'initialize') {
      if (configuration) throw new Error('Worker initialized more than once.');
      configuration = message.configuration;
      if (!configuration?.dbPath || !Array.isArray(configuration.requests)) {
        throw new Error('Worker requires dbPath and requests.');
      }
      store = new WorldStore({
        dbPath: configuration.dbPath,
        seed: configuration.seed,
      });
      await send({
        type: 'ready',
        pid: process.pid,
        workerIndex: configuration.workerIndex,
        requestCount: configuration.requests.length,
      });
      return;
    }

    if (message?.type !== 'start') throw new Error('Unexpected worker command.');
    if (!store || started) throw new Error('Worker not ready or already started.');
    started = true;
    const requests = [];
    const began = performance.now();
    for (const request of configuration.requests) {
      const requestBegan = performance.now();
      const result = await store.advance(request.targetMs);
      requests.push({
        requestId: request.requestId,
        targetMs: request.targetMs,
        durationMs: performance.now() - requestBegan,
        result,
      });
    }
    const advanceWallMs = performance.now() - began;
    const snapshot = store.semanticSnapshot();
    const result = {
      type: 'completed',
      pid: process.pid,
      workerIndex: configuration.workerIndex,
      requestCount: requests.length,
      requests,
      advanceWallMs,
      semanticDigest: semanticDigest(snapshot),
      resolvedThrough: snapshot.world.resolvedThrough,
      operationalStats: store.operationalStats(),
      checkpointSnapshot: configuration.includeCheckpoint ? snapshot : undefined,
    };
    store.close();
    store = undefined;
    await send(result);
    // The parent waits for this actual process exit before reopening in the
    // restart variant. A new process never reuses this module or connection.
    process.disconnect();
    process.exit(0);
  } catch (error) {
    await fail(error);
  }
});

process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
