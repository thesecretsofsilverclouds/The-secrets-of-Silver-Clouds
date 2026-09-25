import { sceneReservoirHealth } from './scene-reservoir-health.mjs';

/** Production is an authored, deterministic runtime. Maintenance measures
 * admitted coverage; it never constructs a provider client, reserves a model
 * call or changes the authoring store, even under legacy enabled env flags.
 * Explicit offline drafting can still use SceneReservoirRefill directly. */
export function createSceneReservoirRuntime() {
  return {
    tick(snapshot) {
      return {status: 'disabled', reason: 'authored_only_runtime', health: sceneReservoirHealth(snapshot)};
    },
  };
}
