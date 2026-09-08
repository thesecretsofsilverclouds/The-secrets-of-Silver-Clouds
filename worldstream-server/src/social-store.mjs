import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { generateWatcherComments } from './watchers.mjs';
import {
  detectWagerForEvent,
  buildWagerOptionsWithVotes,
  ACCOLADES,
} from './wagers.mjs';
import { londonDate } from './time.mjs';
import { resolveWagerFromEvents } from './wagers.mjs';

// Resolved lazily. Computing this at module load calls `fileURLToPath` on
// `import.meta.url`, which is undefined inside the Cloudflare Worker bundle and
// killed the whole service on start-up — even though the Durable Object injects
// its own database and never wants a path at all.
const DEFAULT_DB_PATH = null;
const defaultDbPath = () => join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'world.sqlite');

const VALID_REACTIONS = new Set(['love', 'laugh', 'wow', 'eyes']);

const REACTION_ALIASES = {
  '❤️': 'love',
  '\u2764': 'love',
  '\u2764\uFE0F': 'love',
  heart: 'love',
  love: 'love',
  '😂': 'laugh',
  laugh: 'laugh',
  laughter: 'laugh',
  joy: 'laugh',
  '😮': 'wow',
  '\uD83D\uDE2E\uFE0F': 'wow',
  wow: 'wow',
  shock: 'wow',
  surprised: 'wow',
  '👀': 'eyes',
  eyes: 'eyes',
  watch: 'eyes',
  watching: 'eyes',
};

export function normalizeReaction(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  const mapped = REACTION_ALIASES[raw.trim()] || REACTION_ALIASES[key];
  if (mapped && VALID_REACTIONS.has(mapped)) return mapped;
  return null;
}

/**
 * @param options.db  An already-open database to use instead of opening one by
 *   path. Supplied by the Cloudflare Durable Object, whose single SQLite holds
 *   the world and these audience tables side by side. The table definitions
 *   below are `CREATE TABLE IF NOT EXISTS`, so they are the same tables either
 *   way, and none of them is canonical world history: reactions, comments and
 *   wagers are reader activity and are never read back into the simulation.
 */
export function openSocialStore({ dbPath = DEFAULT_DB_PATH, db: injected = null } = {}) {
  if (!injected && dbPath === null) dbPath = defaultDbPath();
  if (!injected && dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = injected ?? new DatabaseSync(dbPath);

  // Initialize SQLite tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_reactions (
      event_id TEXT NOT NULL,
      reaction_type TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (event_id, reaction_type)
    );

    CREATE TABLE IF NOT EXISTS event_comments (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      author_holy_item TEXT,
      author_guardian TEXT,
      author_title TEXT,
      author_avatar TEXT,
      author_bio TEXT,
      text TEXT NOT NULL,
      is_watcher INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_comments_event ON event_comments(event_id, created_at);

    CREATE TABLE IF NOT EXISTS event_bookmarks (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      traveller_name TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS event_wagers (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      closes_at INTEGER NOT NULL,
      resolution_event_id TEXT,
      winning_option_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      accolade_title TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wagers_event ON event_wagers(event_id);
    CREATE INDEX IF NOT EXISTS idx_wagers_status ON event_wagers(status);

    CREATE TABLE IF NOT EXISTS traveller_wager_votes (
      wager_id TEXT NOT NULL,
      traveller_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (wager_id, traveller_id)
    );

    CREATE INDEX IF NOT EXISTS idx_wager_votes_wager ON traveller_wager_votes(wager_id);
    CREATE INDEX IF NOT EXISTS idx_wager_votes_traveller ON traveller_wager_votes(traveller_id);

    CREATE TABLE IF NOT EXISTS traveller_accolades (
      traveller_id TEXT NOT NULL,
      accolade TEXT NOT NULL,
      awarded_at INTEGER NOT NULL,
      wager_id TEXT NOT NULL,
      PRIMARY KEY (traveller_id, accolade)
    );

    CREATE INDEX IF NOT EXISTS idx_accolades_traveller ON traveller_accolades(traveller_id);
  `);

  const stmtUpsertReaction = db.prepare(`
    INSERT INTO event_reactions (event_id, reaction_type, count)
    VALUES (?, ?, MAX(0, ?))
    ON CONFLICT(event_id, reaction_type)
    DO UPDATE SET count = MAX(0, count + ?);
  `);

  const stmtGetReactions = db.prepare(`
    SELECT reaction_type, count FROM event_reactions WHERE event_id = ?;
  `);

  const stmtInsertComment = db.prepare(`
    INSERT INTO event_comments (
      id, event_id, created_at, author_name, author_holy_item,
      author_guardian, author_title, author_avatar, author_bio, text, is_watcher
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const stmtGetComments = db.prepare(`
    SELECT id, event_id, created_at, author_name, author_holy_item,
           author_guardian, author_title, author_avatar, author_bio, text, is_watcher
    FROM event_comments
    WHERE event_id = ?
    ORDER BY created_at ASC;
  `);

  const stmtInsertWager = db.prepare(`
    INSERT INTO event_wagers (
      id, event_id, question, options_json, closes_at,
      resolution_event_id, winning_option_id, status, accolade_title, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      question = excluded.question,
      options_json = excluded.options_json,
      closes_at = excluded.closes_at,
      resolution_event_id = COALESCE(excluded.resolution_event_id, event_wagers.resolution_event_id),
      winning_option_id = COALESCE(excluded.winning_option_id, event_wagers.winning_option_id),
      status = excluded.status;
  `);

  const stmtGetWagerById = db.prepare(`
    SELECT * FROM event_wagers WHERE id = ?;
  `);

  const stmtGetWagerByEventId = db.prepare(`
    SELECT * FROM event_wagers WHERE event_id = ?;
  `);

  const stmtGetAllOpenWagers = db.prepare(`
    SELECT * FROM event_wagers WHERE status = 'open';
  `);

  const stmtGetVotesForWager = db.prepare(`
    SELECT traveller_id, option_id FROM traveller_wager_votes WHERE wager_id = ?;
  `);

  const stmtGetUserVote = db.prepare(`
    SELECT option_id FROM traveller_wager_votes WHERE wager_id = ? AND traveller_id = ?;
  `);

  const stmtUpsertVote = db.prepare(`
    INSERT INTO traveller_wager_votes (wager_id, traveller_id, option_id, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(wager_id, traveller_id)
    DO UPDATE SET option_id = excluded.option_id, created_at = excluded.created_at;
  `);

  const stmtUpdateWagerResolution = db.prepare(`
    UPDATE event_wagers
    SET status = 'resolved', winning_option_id = ?, resolution_event_id = ?
    WHERE id = ?;
  `);

  const stmtUpdateWagerStatus = db.prepare(`
    UPDATE event_wagers SET status = ? WHERE id = ?;
  `);

  const stmtInsertAccolade = db.prepare(`
    INSERT INTO traveller_accolades (traveller_id, accolade, awarded_at, wager_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(traveller_id, accolade) DO NOTHING;
  `);

  const stmtGetTravellerAccolades = db.prepare(`
    SELECT accolade, awarded_at, wager_id FROM traveller_accolades WHERE traveller_id = ? ORDER BY awarded_at DESC;
  `);

  const stmtGetWinningVoters = db.prepare(`
    SELECT traveller_id FROM traveller_wager_votes WHERE wager_id = ? AND option_id = ?;
  `);

  function addReaction(eventId, rawReaction, delta = 1) {
    if (!eventId || typeof eventId !== 'string') {
      throw new TypeError('Valid eventId is required');
    }
    const reaction = normalizeReaction(rawReaction);
    if (!reaction) {
      throw new TypeError(`Invalid reaction type: ${rawReaction}`);
    }
    const d = Number.isInteger(delta) ? delta : 1;

    stmtUpsertReaction.run(eventId, reaction, d, d);
    return getReactions(eventId);
  }

  function getReactions(eventId) {
    const rows = stmtGetReactions.all(eventId);
    const result = { love: 0, laugh: 0, wow: 0, eyes: 0, total: 0 };
    for (const row of rows) {
      if (VALID_REACTIONS.has(row.reaction_type)) {
        result[row.reaction_type] = Math.max(0, Number(row.count) || 0);
      }
    }
    result.total = result.love + result.laugh + result.wow + result.eyes;
    return result;
  }

  function sanitizeString(val, maxLen = 100, def = '') {
    if (typeof val !== 'string') return def;
    const trimmed = val.trim().slice(0, maxLen);
    return trimmed.length > 0 ? trimmed : def;
  }

  function addComment(eventId, data = {}) {
    if (!eventId || typeof eventId !== 'string') {
      throw new TypeError('Valid eventId is required');
    }
    const text = sanitizeString(data.text, 500);
    if (!text) {
      throw new Error('Comment text cannot be empty');
    }

    const rawAuthor = (typeof data.authorName === 'string' && data.authorName.trim())
      ? data.authorName
      : (data.traveller?.name || 'Anonymous Traveller');
    const authorName = sanitizeString(rawAuthor, 40, 'Anonymous Traveller');

    const rawHoly = (typeof data.authorHolyItem === 'string' && data.authorHolyItem.trim())
      ? data.authorHolyItem
      : (data.traveller?.holyItem || 'Pendant of Mist');
    const authorHolyItem = sanitizeString(rawHoly, 80, 'Pendant of Mist');

    const rawGuardian = (typeof data.authorGuardian === 'string' && data.authorGuardian.trim())
      ? data.authorGuardian
      : (data.traveller?.guardian || 'The Silver Born');
    const authorGuardian = sanitizeString(rawGuardian, 80, 'The Silver Born');

    const rawTitle = (typeof data.authorTitle === 'string' && data.authorTitle.trim())
      ? data.authorTitle
      : (data.traveller?.title || 'London Observer');
    const authorTitle = sanitizeString(rawTitle, 60, 'London Observer');

    const rawAvatar = (typeof data.authorAvatar === 'string' && data.authorAvatar.trim())
      ? data.authorAvatar
      : (data.traveller?.avatar || '👤');
    const authorAvatar = sanitizeString(rawAvatar, 10, '👤');

    const rawBio = (typeof data.authorBio === 'string' && data.authorBio.trim())
      ? data.authorBio
      : (data.traveller?.bio || '');
    const authorBio = sanitizeString(rawBio, 120, '');

    const createdAt = Number.isInteger(data.createdAt) ? data.createdAt : Date.now();
    const id = `comment-${randomUUID()}`;
    const isWatcher = data.isWatcher ? 1 : 0;

    stmtInsertComment.run(
      id,
      eventId,
      createdAt,
      authorName,
      authorHolyItem,
      authorGuardian,
      authorTitle,
      authorAvatar,
      authorBio,
      text,
      isWatcher
    );

    return {
      id,
      eventId,
      createdAt,
      authorName,
      authorHolyItem,
      authorGuardian,
      authorTitle,
      authorAvatar,
      authorBio,
      text,
      isWatcher,
    };
  }

  function getComments(eventId) {
    const rows = stmtGetComments.all(eventId);
    return rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      createdAt: Number(r.created_at),
      authorName: r.author_name,
      authorHolyItem: r.author_holy_item,
      authorGuardian: r.author_guardian,
      authorTitle: r.author_title,
      authorAvatar: r.author_avatar,
      authorBio: r.author_bio,
      text: r.text,
      isWatcher: Number(r.is_watcher) === 1 ? 1 : 0,
    }));
  }

  function getSocial(eventId, event = null, serverTime = Date.now()) {
    if (!eventId) throw new TypeError('eventId is required');

    // Reader activity is submitted activity only. Fictional World Voices stay
    // available as authored commentary, but never count towards the audience.
    const eventContext = event || { id: eventId };
    const reactions = getReactions(eventId);

    // 2. World Voices comments + stored user comments
    const watcherComments = generateWatcherComments(eventContext);
    const userComments = getComments(eventId);

    // Merge and sort comments chronologically
    const allComments = [...watcherComments, ...userComments].sort(
      (a, b) => a.createdAt - b.createdAt
    );

    // Prophecy wager if attached
    const wager = getWagerByEventId(eventId, null, serverTime);

    return {
      eventId,
      reactions,
      comments: allComments,
      totalComments: userComments.filter(comment => !comment.isWatcher).length,
      wager,
    };
  }

  function formatWagerRow(row, travellerId = null, now = Date.now()) {
    if (!row) return null;
    let options = [];
    try {
      options = JSON.parse(row.options_json);
    } catch {
      options = [];
    }

    let status = row.status;
    if (status !== 'resolved') {
      status = now >= Number(row.closes_at) ? 'closed' : 'open';
    }

    // Tally user votes
    const votes = stmtGetVotesForWager.all(row.id);
    const votesByOption = {};
    for (const v of votes) {
      votesByOption[v.option_id] = (votesByOption[v.option_id] || 0) + 1;
    }

    let userVote = null;
    if (travellerId) {
      const uVoteRow = stmtGetUserVote.get(row.id, travellerId);
      if (uVoteRow) userVote = uVoteRow.option_id;
    }

    const builtOptions = buildWagerOptionsWithVotes({ id: row.id, options }, votesByOption);

    return {
      id: row.id,
      eventId: row.event_id,
      question: row.question,
      options: builtOptions,
      closesAt: Number(row.closes_at),
      status,
      resolutionEventId: row.resolution_event_id,
      winningOptionId: row.winning_option_id,
      accoladeTitle: row.accolade_title,
      createdAt: Number(row.created_at),
      userVote,
      userWon: status === 'resolved' && Boolean(userVote) && userVote === row.winning_option_id,
    };
  }

  function createWager(data, now = null) {
    if (!data || !data.eventId) {
      throw new TypeError('Valid eventId is required to create a wager');
    }
    const id = data.id || `wager-${data.eventId}`;
    const question = sanitizeString(data.question, 200, 'What will happen next?');
    const optionsJson = JSON.stringify(data.options || []);
    const createdAt = Number.isInteger(data.createdAt) ? data.createdAt : (now ?? Date.now());
    const effectiveNow = now ?? createdAt;
    const closesAt = Number.isInteger(data.closesAt) ? data.closesAt : effectiveNow + 30 * 60 * 1000;
    const resolutionEventId = data.resolutionEventId || null;
    const winningOptionId = data.winningOptionId || null;
    const status = data.status || (effectiveNow >= closesAt ? 'closed' : 'open');
    const accoladeTitle = data.accoladeTitle || ACCOLADES.MI6_INTUITIVE;

    stmtInsertWager.run(
      id,
      data.eventId,
      question,
      optionsJson,
      closesAt,
      resolutionEventId,
      winningOptionId,
      status,
      accoladeTitle,
      createdAt
    );

    return getWager(id, null, effectiveNow);
  }

  function getWager(wagerId, travellerId = null, now = Date.now()) {
    if (!wagerId) return null;
    const row = stmtGetWagerById.get(wagerId);
    return formatWagerRow(row, travellerId, now);
  }

  function getWagerByEventId(eventId, travellerId = null, now = Date.now()) {
    if (!eventId) return null;
    const row = stmtGetWagerByEventId.get(eventId);
    return formatWagerRow(row, travellerId, now);
  }

  function castWagerVote(wagerIdOrEventId, travellerId, optionId, now = Date.now()) {
    if (!wagerIdOrEventId || typeof wagerIdOrEventId !== 'string') {
      throw new TypeError('wagerId or eventId is required');
    }
    if (!travellerId || typeof travellerId !== 'string' || !travellerId.trim()) {
      throw new TypeError('travellerId is required');
    }
    if (!optionId || typeof optionId !== 'string') {
      throw new TypeError('optionId is required');
    }

    const row = stmtGetWagerById.get(wagerIdOrEventId) || stmtGetWagerByEventId.get(wagerIdOrEventId);
    if (!row) {
      throw new Error('WAGER_NOT_FOUND');
    }

    // Strict Rule: Voting closes strictly before the resolution action resolves (closesAt).
    // Late submissions are rejected.
    if (row.status === 'resolved' || now >= Number(row.closes_at)) {
      throw new Error('WAGER_CLOSED');
    }

    let options = [];
    try {
      options = JSON.parse(row.options_json);
    } catch {}

    if (!options.some((o) => o.id === optionId)) {
      throw new Error('INVALID_OPTION');
    }

    const cleanTraveller = travellerId.trim();
    stmtUpsertVote.run(row.id, cleanTraveller, optionId, now);

    return getWager(row.id, cleanTraveller, now);
  }

  function resolveWager(wagerIdOrEventId, winningOptionId, resolutionEventId = null, now = Date.now()) {
    const row = stmtGetWagerById.get(wagerIdOrEventId) || stmtGetWagerByEventId.get(wagerIdOrEventId);
    if (!row) {
      throw new Error('WAGER_NOT_FOUND');
    }

    stmtUpdateWagerResolution.run(winningOptionId, resolutionEventId, row.id);

    // Award accolades to correct guessers
    const winners = stmtGetWinningVoters.all(row.id, winningOptionId);
    for (const winner of winners) {
      stmtInsertAccolade.run(winner.traveller_id, row.accolade_title, now, row.id);
    }

    return {
      wager: getWager(row.id, null, now),
      awardedCount: winners.length,
      winners: winners.map((w) => w.traveller_id),
      accoladeTitle: row.accolade_title,
    };
  }

  function getAccolades(travellerId) {
    if (!travellerId || typeof travellerId !== 'string') return [];
    const rows = stmtGetTravellerAccolades.all(travellerId.trim());
    return rows.map((r) => r.accolade);
  }

  function addAccolade(travellerId, accolade, wagerId = 'manual', awardedAt = Date.now()) {
    if (!travellerId || typeof travellerId !== 'string') throw new TypeError('travellerId is required');
    if (!accolade || typeof accolade !== 'string') throw new TypeError('accolade is required');
    stmtInsertAccolade.run(travellerId.trim(), accolade, awardedAt, wagerId);
    return getAccolades(travellerId);
  }

  function getTodayHighlight(events = [], dateStr = null, serverTime = Date.now()) {
    const targetDate = dateStr || londonDate(serverTime);

    const candidateEvents = (Array.isArray(events) ? events : []).filter((e) => {
      if (!e) return false;
      const t = e.occurredAt;
      if (!t) return false;
      const d = typeof t === 'number' ? londonDate(t) : String(t).slice(0, 10);
      return d === targetDate;
    });

    if (candidateEvents.length === 0) {
      return {
        date: targetDate,
        eventId: null,
        totalInteractions: 0,
        reactions: null,
        totalComments: 0,
        event: null,
      };
    }

    let topEvent = null;
    let topSocial = null;
    let maxScore = -1;

    for (const evt of candidateEvents) {
      const social = getSocial(evt.id, evt, serverTime);
      const score = social.reactions.total + social.totalComments * 2;
      if (score > maxScore) {
        maxScore = score;
        topEvent = evt;
        topSocial = social;
      }
    }

    if (maxScore <= 0 || !topEvent) {
      return {
        date: targetDate,
        eventId: null,
        totalInteractions: 0,
        reactions: null,
        totalComments: 0,
        event: null,
      };
    }

    return {
      date: targetDate,
      eventId: topEvent.id,
      totalInteractions: maxScore,
      reactions: topSocial.reactions,
      totalComments: topSocial.totalComments,
      event: topEvent,
    };
  }

  function syncWagers(world, serverTime = Date.now()) {
    if (!world) return [];
    let events = [];
    let snapshot = null;

    if (typeof world.semanticSnapshot === 'function') {
      try {
        snapshot = world.presentationSnapshot?.() ?? world.semanticSnapshot();
        events = snapshot.events || [];
      } catch {}
    } else if (typeof world.publicProjection === 'function') {
      try {
        const proj = world.publicProjection();
        events = proj.events || [];
      } catch {}
    } else if (Array.isArray(world.events)) {
      events = world.events;
    } else if (Array.isArray(world)) {
      events = world;
    }

    const created = [];
    // 1. Detect and register new wagers for eligible events
    for (const evt of events) {
      const existing = stmtGetWagerByEventId.get(evt.id);
      if (!existing) {
        const detected = detectWagerForEvent(evt, snapshot, serverTime);
        if (detected) {
          const newWager = createWager(detected, serverTime);
          created.push(newWager);
        }
      }
    }

    // Enough of a wager for the resolver: its question, its options and when
    // it was asked. Everything else lives in the row and is not needed here.
    const hydrateWager = row => ({ id: row.id, question: row.question,
      options: JSON.parse(row.options_json), createdAt: Number(row.created_at) });
    // 2. Advance / close / resolve pending wagers
    const openWagers = stmtGetAllOpenWagers.all();
    for (const w of openWagers) {
      if (serverTime >= Number(w.closes_at)) {
        // Close wager
        stmtUpdateWagerStatus.run('closed', w.id);

        // Check if resolving event has arrived in world
        const resolving = events.find(
          (e) => (e.causedBy && Array.isArray(e.causedBy) && e.causedBy.includes(w.event_id))
            || (e.occurredAt && e.occurredAt >= Number(w.closes_at) && (e.type === 'TRAVEL_ARRIVE' || e.type === 'arrived'))
        );

        // Closing the voting window is not the same as knowing the answer.
        // This used to read `resolving || w.winning_option_id`, and the winner
        // was written when the wager was created, so the condition was always
        // true: every wager resolved on the bell and announced a guess as a
        // result — including outings that were still happening. The world has
        // to have actually said, and what it said is read off the ledger.
        const winner = w.winning_option_id
          || resolveWagerFromEvents(hydrateWager(w), events);
        if (winner) resolveWager(w.id, winner, resolving?.id || null, serverTime);
      }
    }

    return created;
  }

  function close() {
    // Never close an injected database: the Durable Object owns it.
    if (!injected) db.close();
  }

  return {
    db,
    addReaction,
    getReactions,
    addComment,
    getComments,
    getSocial,
    createWager,
    getWager,
    getWagerByEventId,
    castWagerVote,
    resolveWager,
    getAccolades,
    addAccolade,
    getTodayHighlight,
    syncWagers,
    close,
  };
}
