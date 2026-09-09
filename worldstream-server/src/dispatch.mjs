import { createHash } from 'node:crypto';
import { londonDate, londonClock, prevLondonDay, nextLondonDay, atLondon } from './time.mjs';
import { evaluatePlotClocks } from './clocks.mjs';
import { publicEvents } from './fixture.mjs';

/**
 * Deterministic integer hash helper.
 */
function dispatchHash(str, salt = 0) {
  const hash = createHash('sha256').update(`${str}:${salt}`).digest('hex');
  return parseInt(hash.slice(0, 8), 16);
}

/**
 * One authored line out of a bank, chosen by a seeded hash so a given issue of
 * the paper always reads the same way and a reload is a no-op.
 */
const gazettePick = (bank, key, salt = 0) => bank[dispatchHash(String(key), salt) % bank.length];

// The status is a world fact; the note is the editor's opinion of that fact.
// Humour must not invent patrols, exact times, readings or changes to access.
const FACTION_NOTES = Object.freeze({
  mi6: {
    calm: ['Routine. An underrated word, particularly by people who do not have to do the work.',
      'The Gazette is willing to let an ordinary day remain ordinary. For once.'],
    briefings: ['The Gazette wishes everyone a short meeting. A modest ambition, rarely achieved.',
      'A briefing is quite enough occasion for one room.'],
    alert: ['Heightened vigilance is not improved by heightened speculation.',
      'The Gazette favours sensible caution over a heroic amount of guesswork.'],
  },
  order: {
    calm: ['Quiet does not require an exciting explanation.', 'The Gazette has no complaint about quiet. This may be a first.'],
    watchful: ['Watching is not the same as acting. Readers are invited to preserve the distinction.',
      'The Gazette would prefer a less ominous adjective. Alas.'],
    alert: ['Residents may reasonably prefer a less eventful subject.',
      'A little caution seems a sensible use of the day.'],
  },
  church: {
    calm: ['Preparation is an occupation in its own right, especially when nobody agrees it is finished.',
      'The Gazette respects a ceremony. It also respects a comfortable pair of shoes.'],
    notice: ['The Veil gives London quite enough to anticipate without our inventing more.',
      'Readers wishing to become solemn may begin at their convenience.'],
  },
  sanctuary: {
    day: ['Invitation only. Admiring it from below remains considerably easier.',
      'An invitation is still an invitation. Enthusiasm is not a substitute.'],
    night: ['An invitation is worth enjoying. The Gazette recommends against a victory speech.',
      'Guest access is not public access, however persuasive one feels.'],
  },
  streamliner: {
    calm: ['An uneventful journey has much to recommend it.', 'The destination need not receive all the credit.'],
    notice: ['Minor delays. A description easier to appreciate when one is already seated.',
      'The Gazette recommends leaving a little room between ambition and arrival.'],
  },
  arcane: {
    calm: ['Low activity. Let us enjoy the adjective while it applies.',
      'The Gazette approves of magic that leaves room for lunch.'],
    notice: ['Above baseline is a reading, not an invitation to supply a monster.',
      'Interesting, certainly. An explanation can wait for some evidence.'],
    alert: ['High activity. The Gazette would prefer to admire it from a sensible distance.',
      'There is enough magic in London without adding any to the account.'],
  },
});

const publishedText = event => event?.visibility === 'private' ? ''
  : String(event?.description ?? event?.publicDescription ?? '').trim();

// Only notices actually published in this issue's reporting window. A joke
// about a closed cafe, moved shop or silent bell is still an invented event.
export function buildGazetteNotices(dateStr = '', count = 3, events = []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  const notices = events.filter(event => ['INSTITUTION_NOTICE', 'FACTION_STATUS'].includes(event?.type)
    && publishedText(event) && event.id && Number.isFinite(event.occurredAt)
    && [dateStr, prevLondonDay(dateStr)].includes(londonDate(event.occurredAt)));
  notices.sort((a, b) => b.occurredAt - a.occurredAt || a.id.localeCompare(b.id));
  return [...new Set(notices.map(publishedText))].slice(0, Math.max(0, count));
}
/**
 * Human-readable location names for the broadsheet.
 */
export function formatLocationName(loc) {
  const map = {
    mi6: 'MI6 Barracks',
    sanctuary: 'Sanctuary in the Sky',
    streamliner: 'The Streamliner',
    enchanted_ink: 'Enchanted Ink',
    cafe: 'The Silver Spoon Cafe',
    big_ben_plaza: 'New Big Ben Plaza',
  };
  if (!loc) return 'London Borough';
  return map[loc] || loc.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a timestamp into London civil 24-hour time "HH:MM".
 */
export function formatLondonTime(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '07:00';
  const { hour, minute } = londonClock(ms);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Format a London date string into broadsheet style: "Friday, 4 September 2026".
 */
export function formatLondonDateFull(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || 'London Edition';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * High-Stakes Raven Pings (Urgent Courier Notifications) Catalyst Filter.
 * Strictly rejects ordinary meals, training, sleeping, waiting routines.
 * Flags ONLY narrative catalysts: ARCANE_SURGE, PLAN_BROKEN, OUTING_CUT_SHORT,
 * STANDBY_BEGIN, BRIEFING_BEGIN, rare Veil cycle milestones, or major ALERTs.
 */
export function isHighStakesEvent(event) {
  if (!event || typeof event !== 'object' || event.visibility === 'private') return false;
  const type = event.type || '';
  const desc = (event.description || '').toLowerCase();

  // 1. Strictly reject ordinary routines
  const routineTypes = new Set([
    'MEAL_BEGIN',
    'MEAL_END',
    'PRACTICE_BEGIN',
    'PRACTICE_END',
    'REST_BEGIN',
    'WAIT_BEGIN',
    'QUIET_TIME_BEGIN',
    'TV_BEGIN',
    'PIANO_BEGIN',
    'MUSIC_LISTEN_BEGIN',
    'GAME_BEGIN',
    'GAME_PAUSE',
    'GAME_RESUME',
    'ACTIVITY_COMPLETE',
    'PRACTICE_SLOT_NOTICE',
    'SLEEP_BEGIN',
    'SLEEP_END',
    'sleeping',
    'REST',
    'IDLE',
  ]);

  if (routineTypes.has(type)) {
    return false;
  }

  // 2. Strict Narrative Catalysts
  if (
    type === 'ARCANE_SURGE' ||
    type === 'PLAN_BROKEN' ||
    type === 'OUTING_CUT_SHORT' ||
    type === 'STANDBY_BEGIN' ||
    type === 'BRIEFING_BEGIN'
  ) {
    return true;
  }

  // 3. Rare Veil Cycle Milestones
  if (event.isVeilMilestone) return true;
  if (
    (type === 'INSTITUTION_NOTICE' || type === 'FACTION_STATUS') &&
    (/veil\s+cycle|celestial\s+veil\s+countdown|annual\s+veil\s+festival/i.test(desc) ||
      event.payload?.veilMilestone)
  ) {
    return true;
  }

  // 4. Critical Alert footing
  if (type === 'ALERT' || (desc.includes('meu perimeter') && desc.includes('alert'))) {
    return true;
  }

  return false;
}

/**
 * Format an in-world urgent dispatch memo for a high-stakes event.
 */
export function formatHighStakesPing(event) {
  const text = publishedText(event);
  return text ? `⚡ URGENT DISPATCH: ${text}` : null;
}

/**
 * Salience scoring for events:
 * Prioritizes alerts, broken plans, conversations, surges, outings cut short,
 * over ordinary routines.
 */
export function scoreEventSalience(event) {
  if (!event) return 0;
  const type = event.type || '';
  const desc = (event.description || '').toLowerCase();
  let score = 10;

  // Emergency catalysts
  if (type === 'ARCANE_SURGE' || desc.includes('arcane surge') || desc.includes('surge along the thames')) {
    score += 100;
  } else if (type === 'ALERT' || desc.includes('perimeter alert') || desc.includes('anomaly')) {
    score += 90;
  } else if (type === 'PLAN_BROKEN' || desc.includes('plan broken') || desc.includes('duty callout')) {
    score += 85;
  } else if (type === 'OUTING_CUT_SHORT' || desc.includes('cut short')) {
    score += 80;
  } else if (type === 'STANDBY_BEGIN' || desc.includes('standby') || desc.includes('on call')) {
    score += 75;
  } else if (type === 'BRIEFING_BEGIN' || desc.includes('inner circle briefing')) {
    score += 70;
  }

  // Faction / Mystery
  if (desc.includes('order scout') || desc.includes('viaduct standoff') || desc.includes('surveillance')) {
    score += 65;
  }
  if (type === 'FACTION_STATUS' || type === 'INSTITUTION_NOTICE') {
    score += 50;
  }

  // Dialogue & Interpersonal
  if (type === 'CONVERSATION' || (Array.isArray(event.lines) && event.lines.length > 0)) {
    score += 45;
  }

  // Transit & Invitations
  if (type === 'TRAVEL_DEPART' || type === 'TRAVEL_ARRIVE') {
    score += 40;
  }
  if (type === 'INVITATION_AVAILABLE' || type === 'INVITATION_ACCEPTED' || desc.includes('invitation')) {
    score += 35;
  }
  if (type === 'WEATHER_DISRUPTION' || type === 'MINOR_ANOMALY') {
    score += 30;
  }

  // Ordinary routine penalties
  const routines = [
    'MEAL_BEGIN', 'MEAL_END', 'PRACTICE_BEGIN', 'PRACTICE_END',
    'REST_BEGIN', 'WAIT_BEGIN', 'QUIET_TIME_BEGIN', 'TV_BEGIN',
    'PIANO_BEGIN', 'MUSIC_LISTEN_BEGIN', 'GAME_BEGIN', 'GAME_PAUSE',
    'GAME_RESUME', 'ACTIVITY_COMPLETE', 'PRACTICE_SLOT_NOTICE',
    'sleeping', 'SLEEP_BEGIN', 'SLEEP_END',
  ];
  if (routines.includes(type)) {
    score = Math.min(score, 5);
  }

  return score;
}

/**
 * Deterministic curation:
 * Inspects events from the target London calendar day (or past 24 hours),
 * selecting the 3–5 highest-salience events.
 */
export function curateDailyEvents(events = [], targetDate = null, through = Infinity) {
  if (!Array.isArray(events) || events.length === 0) return [];

  events = events.filter(event => event && event.visibility !== 'private'
    && Number.isFinite(event.occurredAt) && event.occurredAt <= through);

  // Filter events matching the target date if specified
  let candidates = events;
  if (targetDate) {
    const matched = events.filter((e) => {
      if (!e) return false;
      const d = typeof e.occurredAt === 'number'
        ? londonDate(e.occurredAt)
        : (e.occurredAt ? String(e.occurredAt).slice(0, 10) : null);
      return d === targetDate;
    });

    if (matched.length >= 3) {
      candidates = matched;
    } else {
      // If targetDate has fewer than 3 events (e.g. morning cycle beginning),
      // pool candidates from the preceding London day (past 24 hours).
      const prev = prevLondonDay(targetDate);
      const prevMatched = events.filter((e) => {
        if (!e) return false;
        const d = typeof e.occurredAt === 'number'
          ? londonDate(e.occurredAt)
          : (e.occurredAt ? String(e.occurredAt).slice(0, 10) : null);
        return d === prev;
      });
      candidates = [...matched, ...prevMatched];
    }
  }

  // Deduplicate by event id
  const seenIds = new Set();
  const uniqueCandidates = [];
  for (const ev of candidates) {
    if (ev && ev.id && !seenIds.has(ev.id)) {
      seenIds.add(ev.id);
      uniqueCandidates.push(ev);
    }
  }

  // Score each event
  const scored = uniqueCandidates.map((ev) => ({
    event: ev,
    score: scoreEventSalience(ev),
    time: typeof ev.occurredAt === 'number' ? ev.occurredAt : 0,
  }));

  // Sort descending by score; break ties deterministically by timestamp, then event id hash
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.time !== a.time) return b.time - a.time;
    return dispatchHash(b.event.id) - dispatchHash(a.event.id);
  });

  // Select top 3–5 highest-salience events (or all available if < 3)
  const targetCount = Math.min(5, Math.max(Math.min(3, scored.length), scored.length));
  return scored.slice(0, targetCount).map((s) => s.event);
}

/**
 * Generate a punchy in-world headline for a chronicle brief.
 */
function createBriefHeadline(event) {
  const type = event.type || '';
  const head = bank => gazettePick(bank, `${event.id || publishedText(event)}/brief`);
  if (type === 'ARCANE_SURGE') return head(['An Arcane Surge', 'Arcane Activity Breaks the Quiet']);
  if (type === 'PLAN_BROKEN') return head(['An Arrangement Falls Through', 'Plans Do Not Always Keep']);
  if (type === 'OUTING_CUT_SHORT') return head(['An Outing Cut Short', 'An Early End to the Outing']);
  if (type === 'STANDBY_BEGIN') return head(['Called to Standby', 'A Time for Readiness']);
  if (type === 'BRIEFING_BEGIN') return head(['A Briefing Begins', 'Time for the Briefing']);
  if (['INCIDENT', 'UNEASE', 'AFTERMATH', 'ALERT'].includes(type)) return head(['Cause for Attention', 'An Unsettled Moment']);
  if (type === 'LEGION_VISIT') return head(['The Legion Pays a Visit', 'Familiar Company']);
  if (type === 'VENUE_SCENE') return head(['Time Spent Out', 'Room for an Ordinary Pleasure']);
  if (type === 'TRAVEL_DEPART') return head(['A Journey Begins', 'On the Way']);
  if (type === 'TRAVEL_ARRIVE') return head(['Journey Completed', 'An Arrival']);
  if (type === 'CONVERSATION' || event.lines?.length) return head(['Words Exchanged', 'A Moment in Conversation']);
  if (type === 'INVITATION_AVAILABLE') return 'An Invitation Offered';
  if (type === 'INVITATION_ACCEPTED') return 'An Invitation Accepted';
  return head(['From the Borough Chronicle', 'A Moment Worth Keeping']);
}

/** Public posture stays at its actual resolution: a broad level is not a patrol report. */
export function buildFactionRoundup(factions = {}, events = [], seedKey = '') {
  const specs = {
    mi6: ['MI6', 'routine', {
      routine: ['Routine duties', 'calm'], briefings: ['Briefings in session', 'briefings'], elevated: ['Heightened vigilance', 'alert'],
    }],
    order: ['The Holy Order', 'quiet', {
      quiet: ['Quiet', 'calm'], watchful: ['Watchful', 'watchful'], active_in_city: ['Active In City', 'alert'],
    }],
    church: ['The Church', 'preparations', {
      quiet: ['Quiet', 'calm'], preparations: ['Preparations continuing', 'calm'], veil_cycle: ['Veil Cycle Approaching', 'notice'],
    }],
    sanctuary: ['Sanctuary in the Sky', 'routine', {
      routine: ['Invitation-only access', 'day'], invited_guests: ['Invited guests • Sky Lounge', 'night'], nightlife: ['Sky Lounge active • Invited guests', 'night'],
      private_event: ['Private event • Invitation-only access', 'night'],
    }],
    streamliner: ['The Streamliner', 'normal', {
      normal: ['Normal service', 'calm'], minor_delays: ['Minor delays', 'notice'],
    }],
    arcane: ['Arcane Activity', 'low', {
      low: ['Low arcane activity', 'calm'], moderate: ['Moderate arcane activity', 'notice'], high: ['High arcane activity', 'alert'],
    }],
  };
  return Object.fromEntries(Object.entries(specs).map(([key, [name, baseline, levels]]) => {
    const level = Object.hasOwn(levels, factions[key]) ? factions[key] : baseline;
    const [status, band] = levels[level];
    return [key, { name, level, status,
      tone: band === 'alert' ? 'alert' : ['notice', 'watchful', 'briefings'].includes(band) ? 'notice' : 'calm',
      note: gazettePick(FACTION_NOTES[key][band], `${seedKey}/${key}/${band}`) }];
  }));
}

/** The sky supplies the count; an old surge cannot invent today's flock or instrument reading. */
export function buildLintelFlock(sky = {}, weather = {}, events = []) {
  const count = Number.isFinite(sky.lintels) ? Math.max(0, Math.trunc(sky.lintels)) : 0;
  return { count, reading: 'Over London', observation: count === 0
    ? 'No Lintels are shown overhead.'
    : count === 1 ? 'A solitary Lintel drifts overhead.'
      : `${count} Lintels drift overhead, part of the strange ordinary life of London.` };
}

/** A headline adds emphasis, never a second event or an unsupported location. */
export function synthesizeLeadHeadline(topEvent, dateStr) {
  if (!topEvent) return 'FROM THE BOROUGH: No new chronicle entries for this edition';
  const type = topEvent.type || '';
  const desc = publishedText(topEvent);
  if (type === 'ARCANE_SURGE') return /thames/i.test(desc)
    ? 'THAMES HARMONIC SURGE: Arcane activity breaks the quiet'
    : 'ARCANE SURGE: An unsettled moment in London';
  if (type === 'ALERT') return 'AN ALERT IN LONDON: Cause for attention';
  if (type === 'PLAN_BROKEN' || type === 'OUTING_CUT_SHORT') return 'PLANS INTERRUPTED: The day takes another turn';
  if (type === 'STANDBY_BEGIN') return 'CALLED TO STANDBY: A time for readiness';
  if (type === 'BRIEFING_BEGIN') return 'A BRIEFING BEGINS: Duty takes its place in the day';
  if (type === 'TRAVEL_DEPART') return 'ON THE WAY: A journey begins';
  if (type === 'TRAVEL_ARRIVE') return 'AN ARRIVAL: A journey completed';
  if (type === 'CONVERSATION') return 'WORDS EXCHANGED: A moment in conversation';
  return `BOROUGH CHRONICLE: ${createBriefHeadline(topEvent)}`;
}
/**
 * Format the entire broadsheet into a clean text/markdown summary for 1-click sharing.
 */
export function formatDispatchPlainText(broadsheet, shareUrl = '') {
  const lines = [
    `📰 ${broadsheet.masthead.publication.toUpperCase()} — ${broadsheet.date}`,
    `${broadsheet.masthead.subtitle}`,
    `London Edition: ${broadsheet.masthead.dayPhase} | Weather: ${broadsheet.masthead.weather.description}, ${broadsheet.masthead.weather.temperatureC}°C`,
    '',
    `LEAD: ${broadsheet.leadHeadline}`,
    '',
    'CHRONICLE BRIEFS:',
  ];

  for (const brief of broadsheet.chronicleBriefs) {
    lines.push(`• [${brief.time}] ${brief.location} — ${brief.headline}`);
    lines.push(`  "${brief.text}"`);
  }

  lines.push('');
  lines.push('FACTION STATUS ROUNDUP:');
  for (const f of Object.values(broadsheet.factionRoundup)) {
    lines.push(`• ${f.name}: ${f.status}`);
    if (f.note) lines.push(`  ${f.note}`);
  }

  lines.push('');
  lines.push(`LINTEL FLOCK OBSERVATION: ${broadsheet.lintelFlock.count} drifting overhead (${broadsheet.lintelFlock.reading}).`);
  lines.push(`"${broadsheet.lintelFlock.observation}"`);

  if (Array.isArray(broadsheet.notices) && broadsheet.notices.length > 0) {
    lines.push('');
    lines.push('NOTICES:');
    for (const notice of broadsheet.notices) lines.push('• ' + notice);
  }

  if (Array.isArray(broadsheet.plotClocks) && broadsheet.plotClocks.length > 0) {
    lines.push('');
    lines.push('THE LONDON PLOT CLOCKS:');
    for (const clock of broadsheet.plotClocks) {
      const filled = '■'.repeat(clock.currentSegment);
      const empty = '□'.repeat(clock.totalSegments - clock.currentSegment);
      lines.push(`• ${clock.icon} ${clock.name}: [${filled}${empty}] ${clock.currentSegment}/${clock.totalSegments} — ${clock.currentTitle}`);
    }
  }

  if (shareUrl) {
    lines.push('');
    lines.push(`Read the living novel live: ${shareUrl}`);
  }

  return lines.join('\n');
}

/**
 * Primary Broadsheet Builder.
 * Constructs the deterministic in-world newspaper card.
 */
export function buildBroadsheet({
  events = [],
  date = null,
  serverTime = Date.now(),
  world = null,
  clientOrigin = 'http://127.0.0.1:4317',
} = {}) {
  const targetDate = date || londonDate(serverTime);
  const formattedDate = formatLondonDateFull(targetDate);
  const issueNum = 700 + (dispatchHash(targetDate, 42) % 300);

  // Extract world metadata if world or projection provided
  let weatherData = {
    code: 'light_rain',
    description: 'Light rain',
    temperatureC: 12,
    summary: 'Damp cobbles, low Thames mist, gentle north-easterly breeze.',
  };
  let skyData = { lintels: 2 };
  let factionData = {};

  if (world) {
    const proj = typeof world.publicProjection === 'function' ? world.publicProjection() : world;
    if (proj?.weather) {
      weatherData = {
        code: proj.weather.code || 'light_rain',
        description: proj.weather.description || 'Light rain',
        temperatureC: Number.isFinite(proj.weather.temperatureC) ? proj.weather.temperatureC : 12,
        summary: proj.weather.summary || `${proj.weather.description || 'Light rain'} over London.`,
      };
    }
    if (proj?.sky) skyData = proj.sky;
    if (proj?.factions) factionData = proj.factions;
  }

  // Curate 3–5 highest-salience events
  const issueEvents = events.filter(event => event?.visibility !== 'private'
    && Number.isFinite(event?.occurredAt) && event.occurredAt <= serverTime);
  const curated = curateDailyEvents(issueEvents, targetDate, serverTime);

  let chronicleBriefs = [];
  if (curated.length > 0) {
    chronicleBriefs = curated.map((ev) => {
      const score = scoreEventSalience(ev);
      const tier = score >= 80 ? 'critical' : (score >= 40 ? 'notable' : 'civic');
      return {
        eventId: ev.id,
        time: formatLondonTime(ev.occurredAt),
        location: formatLocationName(ev.location),
        salienceTier: tier,
        headline: createBriefHeadline(ev),
        text: publishedText(ev) || (ev.lines ?? []).map(line => line.text).filter(Boolean).join(' '),
      };
    });
  } else {
    // Fallback civic calm brief
    chronicleBriefs = [
      {
        eventId: 'civic-calm',
        time: formatLondonTime(serverTime),
        location: 'London',
        salienceTier: 'civic',
        headline: 'From the Borough Chronicle',
        text: 'No new chronicle entries for this edition.',
      },
    ];
  }

  const leadHeadline = synthesizeLeadHeadline(curated[0] || null, targetDate);
  const factionRoundup = buildFactionRoundup(factionData, curated, targetDate);
  const lintelFlock = buildLintelFlock(skyData, weatherData, curated);
  const plotClocks = evaluatePlotClocks(world || { events, factions: factionData, sky: skyData, weather: weatherData, veil: { phase: 'distant', daysAway: 45 } }, serverTime);
  // The article dates are historical; the supplied public projection is live.
  // Say so instead of silently giving yesterday today's weather and posture.
  if (targetDate !== londonDate(serverTime)) {
    weatherData.description = `Current weather: ${weatherData.description}`;
    for (const faction of Object.values(factionRoundup)) faction.status = `Current: ${faction.status}`;
    lintelFlock.reading = 'Current sky';
    for (const clock of plotClocks) clock.currentTitle = `Current: ${clock.currentTitle}`;
  }

  const cleanDateHash = targetDate;
  const permalink = `${clientOrigin}/#dispatch-${cleanDateHash}`;

  const broadsheet = {
    id: `dispatch-${targetDate}`,
    date: targetDate,
    formattedDate,
    issueNumber: `#${issueNum}`,
    masthead: {
      publication: 'The London Borough Gazette',
      subtitle: 'MI6 Morning Intelligence & Civic Broadsheet',
      date: targetDate,
      formattedDate,
      dayPhase: gazettePick(['Morning Edition • Seventh Bell','Morning Edition • First Chimes','Morning Edition • Printed Damp','Morning Edition • Before the Rush','Morning Edition • Late Off the Press, Sorry'], targetDate + '/masthead'),
      weather: weatherData,
    },
    leadHeadline,
    chronicleBriefs,
    factionRoundup,
    lintelFlock,
    notices: buildGazetteNotices(targetDate, 3, issueEvents),
    plotClocks,
    permalink,
    plainTextSummary: '',
  };

  broadsheet.plainTextSummary = formatDispatchPlainText(broadsheet, permalink);
  return broadsheet;
}

/**
 * Service helpers to extract events from world store or array.
 */
function extractEventsAndWorld(worldOrEvents, dateStr) {
  let events = [];
  let world = null;

  if (Array.isArray(worldOrEvents)) {
    events = worldOrEvents;
  } else if (worldOrEvents && typeof worldOrEvents.publicEventsBetween === 'function' && dateStr) {
    world = worldOrEvents;
    // An issue needs its London date and the preceding day's fallback, not the whole novel.
    events = worldOrEvents.publicEventsBetween(atLondon(prevLondonDay(dateStr),'00:00'),
      atLondon(nextLondonDay(dateStr),'00:00'));
  } else if (worldOrEvents && typeof worldOrEvents.semanticSnapshot === 'function') {
    // Measured before this branch existed: the archive went blank three days
    // back. The paper was being built from `publicProjection()`, whose event
    // list is the *feed* — the last forty — so any issue older than about
    // forty-eight hours printed BOROUGH CALM and one placeholder brief.
    //
    // It reads the whole log now and publishes it through the same allowlist
    // the feed uses, so an archived issue can no more leak a private event
    // than the live page can.
    world = worldOrEvents;
    events = publicEvents(worldOrEvents.semanticSnapshot(), Infinity);
  } else if (worldOrEvents && typeof worldOrEvents.publicProjection === 'function') {
    world = worldOrEvents;
    const proj = worldOrEvents.publicProjection();
    events = proj?.events || [];
  } else if (worldOrEvents && typeof worldOrEvents.semanticSnapshot === 'function') {
    world = worldOrEvents;
    const snap = worldOrEvents.semanticSnapshot();
    events = snap?.events || [];
  } else if (worldOrEvents?.events && Array.isArray(worldOrEvents.events)) {
    events = worldOrEvents.events;
    world = worldOrEvents;
  }

  return { events, world };
}

/**
 * Retrieve dispatch for a specific London date.
 */
export function getDispatchByDate(worldOrEvents, dateStr, serverTime = Date.now(), clientOrigin = 'http://127.0.0.1:4317') {
  const { events, world } = extractEventsAndWorld(worldOrEvents, dateStr);
  return buildBroadsheet({ events, date: dateStr, serverTime, world, clientOrigin });
}

/**
 * Retrieve latest dispatch based on London civil time.
 * Before 07:00, serves yesterday's completed day dispatch.
 * At 07:00 and after, serves today's morning edition.
 */
export function getLatestDispatch(worldOrEvents, serverTime = Date.now(), clientOrigin = 'http://127.0.0.1:4317') {
  const clock = londonClock(serverTime);
  const today = londonDate(serverTime);
  const yesterday = prevLondonDay(today);

  const targetDate = clock.hour >= 7 ? today : yesterday;
  return getDispatchByDate(worldOrEvents, targetDate, serverTime, clientOrigin);
}
