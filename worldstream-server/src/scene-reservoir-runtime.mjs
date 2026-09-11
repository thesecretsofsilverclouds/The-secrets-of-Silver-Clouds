import { sceneReservoirHealth } from './scene-reservoir-health.mjs';
import { SceneReservoirRefill, openAISceneRefillClient } from './scene-reservoir-refill.mjs';
import { validateSceneReservoirCandidate } from './scene-reservoir-approval.mjs';

/**
 * The persistent scene reservoir runtime for WorldDurableObject and local
 * servers: alarm-time health and refill only. Reservoir prose reaches the page
 * through the ordinary scene bank after review and import; nothing here touches
 * an event on the way out, and nothing about a reader can start or stop a
 * refill.
 */
export function createSceneReservoirRuntime({ db, env = {} } = {}) {
  let store = null;
  if (db && typeof db.exec === 'function' && typeof db.prepare === 'function') {
    db.exec(`
      CREATE TABLE IF NOT EXISTS scene_refill_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL
      );
    `);
    store = {
      load() {
        const row = db.prepare('SELECT state_json FROM scene_refill_state WHERE id = 1').get();
        return row ? JSON.parse(row.state_json) : null;
      },
      save(state) {
        db.prepare('INSERT OR REPLACE INTO scene_refill_state (id, state_json) VALUES (1, ?)').run(JSON.stringify(state));
        return true;
      },
    };
  }

  const enabled = env?.RESERVOIR_REFILL_ENABLED === 'true' || env?.RESERVOIR_REFILL_ENABLED === true;
  const apiKey = env?.OPENAI_API_KEY || null;
  const initialHealth = sceneReservoirHealth({});
  const archetypes = initialHealth.archetypes ?? {};

  let client = null;
  if (enabled && apiKey) {
    client = openAISceneRefillClient({ apiKey, model: env?.RESERVOIR_MODEL || 'gpt-5-mini' });
  }

  let refill = null;
  if (store) {
    refill = new SceneReservoirRefill({
      store,
      client,
      validator: validateSceneReservoirCandidate,
      archetypes,
      config: { enabled: Boolean(enabled && apiKey) },
    });
  }

  return {
    tick(snapshot, now = Date.now()) {
      const health = sceneReservoirHealth(snapshot);
      if (!refill) return { status: 'disabled', health };
      const result = refill.tick({ now, deficits: health.deficits });
      return { ...result, health };
    },
  };
}
