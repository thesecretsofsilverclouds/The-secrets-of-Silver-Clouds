import { WorldStore } from '../experiment-l/src/world.mjs';
import { publicEvents } from './fixture.mjs';
import { readPublicHistory, readPublicEventContext, readPublicDialogueSources } from './public-history.mjs';

const DAY = 86_400_000;
const decode = rows => rows.map(row => JSON.parse(row.semantic_json));

/** Read-side indexes only. Transactions and canonical reduction stay in WorldStore. */
export class ServiceWorldStore extends WorldStore {
  constructor(options) {
    super(options);
    this.db.exec(`CREATE INDEX IF NOT EXISTS event_time ON events(occurred_at,seq);
      CREATE INDEX IF NOT EXISTS public_event_sequence ON events(seq)
        WHERE json_extract(semantic_json,'$.visibility')='public';`);
    this.cachedRead = null;
  }

  // Keep a bounded recent ledger plus the exact sources of addressable memories.
  // Full semanticSnapshot remains available for audits, never a refresh dependency.
  presentationSnapshot() {
    this.db.exec('BEGIN');
    try {
      const row = this.db.prepare('SELECT * FROM world_state WHERE id=1').get();
      const seq = this.db.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM events').get().n;
      const revision = `${row.resolved_through}:${seq}`;
      if (this.cachedRead?.revision === revision) {
        this.db.exec('COMMIT');
        return this.cachedRead.snapshot;
      }
      const state = JSON.parse(row.state_json);
      const recent = decode(this.db.prepare('SELECT semantic_json FROM events ORDER BY seq DESC LIMIT 1024').all()).reverse();
      const byId = new Map(recent.map(event => [event.id,event]));
      const ids = new Set();
      for (const actor of Object.values(state.characters ?? {})) {
        for (const memory of actor.knowledge ?? []) {
          if (memory.learnedAt < row.resolved_through - 31 * DAY) continue;
          ids.add(memory.sourceEventId); ids.add(memory.acquisitionEventId);
        }
      }
      const lookup = this.db.prepare('SELECT semantic_json FROM events WHERE id=?');
      for (const id of ids) if (id && !byId.has(id)) {
        const found = lookup.get(id);
        if (found) byId.set(id,JSON.parse(found.semantic_json));
      }
      const pendingActions = this.db.prepare('SELECT action_json FROM scheduled_actions ORDER BY due_at,priority,id').all()
        .map(entry => JSON.parse(entry.action_json));
      const snapshot = { world:{id:this.fixture.worldId,seed:row.seed,rulesVersion:this.fixture.rulesVersion,
        resolvedThrough:row.resolved_through}, ...state,
        events:[...byId.values()].sort((a,b)=>a.seq-b.seq),pendingActions,
        presentationFloor:recent[0]?.occurredAt??row.resolved_through };
      this.db.exec('COMMIT');
      this.cachedRead = {revision,snapshot};
      return snapshot;
    } catch (error) {this.db.exec('ROLLBACK');throw error;}
  }

  publicProjection() { return this.fixture.publicProjection(this.presentationSnapshot()); }

  eventById(id) {
    const row = this.db.prepare('SELECT semantic_json FROM events WHERE id=?').get(id);
    return row ? JSON.parse(row.semantic_json) : null;
  }

  publicHistory(options) { return readPublicHistory(this, options); }

  publicEventContext(id) { return readPublicEventContext(this, id); }

  publicDialogueSources(event) { return readPublicDialogueSources(this, event); }

  publicEventsBetween(startMs,endMs) {
    if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) || endMs-startMs>3*DAY)
      throw new RangeError('History date reads must be scoped to at most three days');
    return publicEvents({events:decode(this.db.prepare(`SELECT semantic_json FROM events
      WHERE occurred_at>=? AND occurred_at<? ORDER BY occurred_at,seq`).all(startMs,endMs)),eventById:id=>this.eventById(id),
      publicSourcesForEvent:event=>this.publicDialogueSources(event)},Infinity);
  }

  operationalStats() {
    return {eventCount:this.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,
      pendingActionCount:this.db.prepare('SELECT COUNT(*) AS n FROM scheduled_actions').get().n,
      resolvedThrough:this.db.prepare('SELECT resolved_through AS n FROM world_state WHERE id=1').get().n};
  }
}
