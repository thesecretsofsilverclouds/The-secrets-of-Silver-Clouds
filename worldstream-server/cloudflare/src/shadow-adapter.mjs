/**
 * ShadowAdapter: Clean stub and transport point for Moment Engine shadow proposals.
 * 
 * Boundary Contract:
 * - Read-only persistence and transport for shadow Moment opportunities/proposals.
 * - ZERO modifications to canonical simulation state, lifespan, relationships, schedules or locations.
 * - Isolates the Moment Engine shadow contract from backend transport.
 */

export class ShadowAdapter {
  constructor(db) {
    this.db = db;
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shadow_moments (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT,
        occurred_at INTEGER NOT NULL,
        character_id TEXT NOT NULL,
        grammar_key TEXT,
        proposal_json TEXT NOT NULL,
        surfaced INTEGER NOT NULL DEFAULT 0,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS shadow_moments_time ON shadow_moments(occurred_at);
    `);
  }

  /**
   * Record a shadow proposal without modifying canonical state.
   */
  recordProposal(proposal) {
    if (!proposal || typeof proposal !== 'object') {
      throw new TypeError('Proposal must be an object');
    }
    const id = String(proposal.id || `shadow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const opportunityId = proposal.opportunityId ? String(proposal.opportunityId) : null;
    const occurredAt = Number.isSafeInteger(proposal.occurredAt) ? proposal.occurredAt : Date.now();
    const characterId = String(proposal.characterId || proposal.character || 'unknown');
    const grammarKey = proposal.grammarKey ? String(proposal.grammarKey) : null;
    const surfaced = proposal.surfaced ? 1 : 0;
    const proposalJson = JSON.stringify(proposal);
    const recordedAt = new Date().toISOString();

    this.db.prepare(`
      INSERT OR REPLACE INTO shadow_moments (
        id, opportunity_id, occurred_at, character_id, grammar_key, proposal_json, surfaced, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, opportunityId, occurredAt, characterId, grammarKey, proposalJson, surfaced, recordedAt);

    return {
      id,
      opportunityId,
      occurredAt,
      characterId,
      grammarKey,
      surfaced: Boolean(surfaced),
      canonical: false // Explicit boundary confirmation: never canonical
    };
  }

  /**
   * Retrieve recent shadow proposals.
   */
  listProposals({ limit = 50, sinceMs = 0 } = {}) {
    const rows = this.db.prepare(`
      SELECT proposal_json, surfaced, recorded_at
      FROM shadow_moments
      WHERE occurred_at >= ?
      ORDER BY occurred_at DESC
      LIMIT ?
    `).all(sinceMs, limit);

    return rows.map(r => {
      try {
        const parsed = JSON.parse(r.proposal_json);
        return {
          ...parsed,
          surfaced: Boolean(r.surfaced),
          recordedAt: r.recorded_at,
          canonical: false
        };
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Read-only export for transport over WebSocket or HTTP.
   */
  transportPacket(proposal) {
    return {
      type: 'SHADOW_MOMENT_PROPOSAL',
      canonical: false,
      proposal: {
        id: proposal.id,
        characterId: proposal.characterId,
        occurredAt: proposal.occurredAt,
        grammarKey: proposal.grammarKey,
        lines: Array.isArray(proposal.lines) ? proposal.lines : []
      }
    };
  }
}
