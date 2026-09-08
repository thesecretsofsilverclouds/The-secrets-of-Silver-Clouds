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

// The Gazette's own voice.
//
// The note this answers: "for things like the inner circle rapport and plot
// clock and daily reports some need to have humour and entertainment in mind
// much like book one. not boring but not all ridiculous."
//
// Two things were wrong with the paper. It had exactly one sentence per state,
// so a hundred and eighty issues read identically; and every one of those
// sentences was written in the same breathless wire-service register, which is
// the least British thing a London local paper could possibly sound like.
//
// So the official status line stays official — that is the joke's straight man
// — and the paper gets a second column underneath it where it says what it
// actually thinks. The register is small-town broadsheet: procedural, faintly
// aggrieved, and completely certain that the reader shares its priorities.
//
// The MEU line is Davis's, from the manuscript: she calls them "traffic wardens
// with access to magic" [M87], and the Gazette has clearly read that quote too.
const FACTION_NOTES = Object.freeze({
  mi6: {
    calm: [
      'Corridor lighting remains under review. It has been under review since March.',
      'The lunch hall noticeboard has been moved again. No department admits to it.',
      'Nothing to report from Whitehall, which the Gazette reports anyway.',
    ],
    briefings: [
      'Assembly room booked all afternoon. The urn has been refilled twice, which is the real intelligence.',
      'Inner circle sitting. Everyone else is doing paperwork loudly outside the door.',
    ],
    alert: [
      'Sentries doubled. Rota doubled. Complaints about the rota, quadrupled.',
      'Heightened footing declared at 06:00. The canteen found out at 06:40 and has not forgiven anyone.',
    ],
  },
  order: {
    calm: [
      'No sightings this week. The Gazette notes that this is also what they would want.',
      'Southwark quiet. The candles in the Blackfriars window are somebody else\'s business.',
    ],
    watchful: [
      'Two robes near the viaduct on Tuesday. Both declined to comment, at considerable length.',
      'Scouts reported at the rail arches. They are not doing anything. That is the unsettling part.',
    ],
    alert: [
      'Residents are advised to be polite, and elsewhere.',
      'Working the borough since dawn. The market packed up early and did not say why.',
    ],
  },
  church: {
    calm: [
      'Incense at noon. The Gazette continues to receive letters about the incense.',
      'Preparations proceeding. Nobody outside the Church knows for what, and asking has stopped being fashionable.',
    ],
    notice: [
      'Chimes tuned for the cycle. The bell-ringers ask us to state they are not responsible for the dogs.',
      'Veil cycle approaching. Expect the usual: queues, candles, and a run on batteries.',
    ],
  },
  sanctuary: {
    day: [
      'Portal halls closed for morning inspection. Nothing is ever found, and the inspection continues.',
      'Open to the public until four. The lift still makes the noise. Management call it character.',
    ],
    night: [
      'Guest gateways operating. Door policy unchanged: they will know.',
      'Halls open from eight. The Gazette has never been on the list and has stopped mentioning it.',
    ],
  },
  streamliner: {
    calm: [
      'On time across the Thames — a sentence this paper prints with no pleasure and less belief.',
      'Running clean all week. Somebody will now write in about the third carriage.',
    ],
    notice: [
      'Speed restrictions east. We are assured this is unrelated to the thing on the line last month.',
      'Minor delays. The board says minor. The platform disagrees.',
    ],
  },
  arcane: {
    calm: [
      'The MEU report a quiet week. The MEU mostly report a quiet week, and then paperwork about it.',
      'Baseline harmonics. The scanners are on, the kettle is on, and that is the shift.',
    ],
    notice: [
      'Above baseline. The MEU have issued a leaflet. It is not a good leaflet.',
      'Readings up. Two vans out. One of them is definitely just parked.',
    ],
    alert: [
      'Violet spike on the corridor. The MEU have stopped issuing leaflets and started issuing cones.',
      'Corridor lit up at twenty to eight. Everything with a Presence in it felt the pull, including the dog at number nine.',
    ],
  },
});

// The notices column, which in any real local paper is the only bit anybody
// reads. Nothing here is a fact the world knows — it is the borough talking
// about itself, and it can never be used to learn anything.
const GAZETTE_NOTICES = Object.freeze([
  'LOST: one prowler design, last seen leaving its owner\'s shoulder in the direction of Blackfriars. Reward offered. Do not approach the shoulder.',
  'Enchanted Ink has moved again. It is not where it was. It is also not where you think it has gone.',
  'The Silver Spoon regrets to announce that the big scone is discontinued. Correspondence on this matter is now closed.',
  'New Big Ben: forty-one seconds past the hour, as ever. Letters claiming otherwise will be counted, and ignored.',
  'The Streamliner reminds passengers that the third carriage is not colder. It is differently warm.',
  'Feeding the Lintels along the embankment is discouraged. They do not want your sandwich. They want the harmonics. They will take the sandwich.',
  'WANTED: whoever moved the noticeboard in the barracks lunch hall. No action will be taken. We would simply like to know.',
  'The Gazette apologises for last week\'s photograph of the Sanctuary, which was printed upside down. The Sanctuary was upside down.',
  'Correction: Tuesday\'s item described the MEU as "traffic wardens with access to magic". The MEU have asked us to print that they also have a van.',
  'A reader writes to ask whether a tattoo can be repossessed. It cannot. It can, however, leave.',
  'The council wishes it known that the crack in the Silver Spoon window is both decorative and structural, in that order.',
  'FOUND: one pigeon, with opinions. The owner may collect it. The owner is asked to collect it.',
  'The Chimes will be silent for nine minutes on Thursday for tuning. Residents who enjoy the silence are asked not to write in about it afterwards.',
  'A gentleman on the 14:20 has again been observed reading this newspaper over another passenger\'s shoulder. He is welcome to buy one.',
]);

/**
 * Two or three notices for the issue, seeded off the date so the same day
 * always prints the same column.
 */
export function buildGazetteNotices(dateStr = '', count = 3) {
  const chosen = [];
  for (let pass = 0; chosen.length < count && pass < GAZETTE_NOTICES.length * 2; pass++) {
    const notice = gazettePick(GAZETTE_NOTICES, `${dateStr}/notice`, pass + 1);
    if (!chosen.includes(notice)) chosen.push(notice);
  }
  return chosen;
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
  if (!event || typeof event !== 'object') return false;
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
  if (!event) return null;
  const type = event.type || '';
  const desc = event.description || '';

  if (type === 'ARCANE_SURGE' || /surge/i.test(desc)) {
    return `⚡ URGENT DISPATCH: MEU corridor anomaly flagged along the Thames corridor. Goaden placed on standby.`;
  }
  if (type === 'PLAN_BROKEN') {
    return `⚡ URGENT DISPATCH: Scheduled night movements broken by emergency duty recall.`;
  }
  if (type === 'OUTING_CUT_SHORT') {
    return `⚡ URGENT DISPATCH: Evening borough excursion cut short under operational advisory.`;
  }
  if (type === 'STANDBY_BEGIN') {
    return `⚡ URGENT DISPATCH: Heightened readiness order active across Southwark perimeter.`;
  }
  if (type === 'BRIEFING_BEGIN') {
    return `⚡ URGENT DISPATCH: MI6 Inner Circle convened for classified situational briefing.`;
  }
  return `⚡ URGENT DISPATCH: ${desc || 'Operational anomaly flagged in London sector.'}`;
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
export function curateDailyEvents(events = [], targetDate = null) {
  if (!Array.isArray(events) || events.length === 0) return [];

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
  const desc = (event.description || '').toLowerCase();
  // Seeded off the event rather than the date, so two briefs of the same kind
  // in one issue do not print the same head twice.
  const head = bank => gazettePick(bank, `${event.id || desc}/brief`);

  if (type === 'ARCANE_SURGE' || desc.includes('arcane surge')) {
    return head(['Thames Anomaly Waveform Spike', 'Corridor Reading Off the Board', 'MEU Vans Out Before the Second Tone']);
  }
  if (type === 'PLAN_BROKEN' || desc.includes('plan broken')) {
    return head(['Evening Schedule Interrupted', 'Arrangement Withdrawn at Short Notice', 'The Night Taken Whole']);
  }
  if (type === 'OUTING_CUT_SHORT' || desc.includes('cut short')) {
    return head(['Borough Outing Curtailed Under Advisory', 'Afternoon Ends Mid-Sentence', 'Party of Two Recalled Early']);
  }
  if (type === 'STANDBY_BEGIN' || desc.includes('standby')) {
    return head(['Operational Readiness Order Issued', 'Boots On, Doing Nothing, Intensely', 'Night Watch Held Over']);
  }
  if (type === 'BRIEFING_BEGIN' || desc.includes('briefing')) {
    return head(['Inner Circle Classified Council', 'Assembly Room Door Shut Behind Them', 'A Meeting Nobody Will Describe']);
  }
  if (desc.includes('order scout')) {
    return head(['Covert Watcher Noted Near Viaduct', 'Robes at the Arches, Again', 'Somebody Standing Very Still by the Rail']);
  }
  if (type === 'INCIDENT' || type === 'UNEASE' || type === 'AFTERMATH') {
    return head(['Irregularity Logged in the Borough', 'A Thing Noticed and Not Explained', 'Filed Under: Look Into It']);
  }
  if (type === 'LEGION_VISIT') {
    return head(['Visitors Received at the Barracks', 'Known Associates Observed on Site', 'A Great Deal of Noise From One Room']);
  }
  if (type === 'VENUE_SCENE') {
    return head(['An Hour Spent Somewhere Pleasant', 'Borough Establishment Patronised', 'Two Agents Behaving Like Civilians']);
  }
  if (type === 'TRAVEL_DEPART' || type === 'TRAVEL_ARRIVE') {
    return head(['Streamliner Cross-Borough Passage', 'Mag-Lev Transit Recorded', 'Departure Noted; Third Carriage Again']);
  }
  if (type === 'CONVERSATION' || (Array.isArray(event.lines) && event.lines.length > 0)) {
    return head(['Confidential Embankment Discourse', 'Words Exchanged, Contents Unrecorded', 'A Conversation Held at Normal Volume']);
  }
  if (type === 'INVITATION_AVAILABLE' || type === 'INVITATION_ACCEPTED') {
    return head(['Upper Skyport Credentials Extended', 'Guest Allocation Claimed Before It Lapsed', 'Somebody Got Lucky With the List']);
  }
  return head(['Borough Activity Recorded', 'Item of Minor Civic Interest', 'Logged, For Completeness']);
}

/**
 * Faction Status Roundup Builder for all 6 canonical factions.
 */
export function buildFactionRoundup(factions = {}, events = [], seedKey = '') {
  const note = (faction, band) => gazettePick(FACTION_NOTES[faction][band], `${seedKey}/${faction}/${band}`);
  const mi6Level = factions.mi6 || 'routine';
  const orderLevel = factions.order || 'quiet';
  const churchLevel = factions.church || 'preparations';
  const sanctuaryLevel = factions.sanctuary || 'routine';
  const streamlinerLevel = factions.streamliner || 'normal';
  const arcaneLevel = factions.arcane || 'low';

  const hasSurge = events.some((e) => e.type === 'ARCANE_SURGE' || /surge|anomaly/i.test(e.description || ''));
  const hasOrderEvent = events.some((e) => /order scout|viaduct standoff/i.test(e.description || ''));

  return {
    mi6: {
      name: 'MI6',
      level: mi6Level,
      status: mi6Level === 'elevated' || hasSurge
        ? 'Heightened Vigilance • Sector Sentries Doubled'
        : (mi6Level === 'briefings' ? 'Inner Circle Briefings In Session' : 'Whitehall Corridors Nominal'),
      tone: mi6Level === 'elevated' || hasSurge ? 'alert' : 'calm',
      note: note('mi6', mi6Level === 'elevated' || hasSurge ? 'alert' : (mi6Level === 'briefings' ? 'briefings' : 'calm')),
    },
    order: {
      name: 'The Holy Order',
      level: orderLevel,
      status: orderLevel === 'active_in_city' || hasOrderEvent
        ? 'Active In City • Surveillance Shadows Flagged'
        : (orderLevel === 'watchful' ? 'Watchful • Scouts Near Rail Viaducts' : 'Shadows Dormant Across Southwark'),
      tone: orderLevel === 'active_in_city' || hasOrderEvent ? 'alert' : (orderLevel === 'watchful' ? 'notice' : 'calm'),
      note: note('order', orderLevel === 'active_in_city' || hasOrderEvent ? 'alert' : (orderLevel === 'watchful' ? 'watchful' : 'calm')),
    },
    church: {
      name: 'The Church',
      level: churchLevel,
      status: churchLevel === 'veil_cycle'
        ? 'Veil Cycle Approaching • Midnight Chimes Tuned'
        : 'Celestial Preparations • Incense Rites at Noon',
      tone: churchLevel === 'veil_cycle' ? 'notice' : 'calm',
      note: note('church', churchLevel === 'veil_cycle' ? 'notice' : 'calm'),
    },
    sanctuary: {
      name: 'Sanctuary in the Sky',
      level: sanctuaryLevel,
      status: sanctuaryLevel === 'nightlife' || sanctuaryLevel === 'invited_guests'
        ? 'Sky Lounge Active • Guest Gateways Operating'
        : 'Aether Portals Under Morning Inspection',
      tone: 'calm',
      note: note('sanctuary', sanctuaryLevel === 'nightlife' || sanctuaryLevel === 'invited_guests' ? 'night' : 'day'),
    },
    streamliner: {
      name: 'The Streamliner',
      level: streamlinerLevel,
      status: streamlinerLevel === 'minor_delays'
        ? 'Minor Speed Restrictions Across East Viaduct'
        : 'Mag-Lev Express On Schedule Across Thames',
      tone: streamlinerLevel === 'minor_delays' ? 'notice' : 'calm',
      note: note('streamliner', streamlinerLevel === 'minor_delays' ? 'notice' : 'calm'),
    },
    arcane: {
      name: 'Arcane Activity',
      level: arcaneLevel,
      status: hasSurge || arcaneLevel === 'high'
        ? 'MEU Reading: 0.38 µV • Violet Waveform Spike'
        : (arcaneLevel === 'moderate' ? 'MEU Reading: 0.19 µV • Above Baseline' : 'MEU Reading: 0.08 µV • Harmonic Calm'),
      tone: hasSurge || arcaneLevel === 'high' ? 'alert' : 'calm',
      note: note('arcane', hasSurge || arcaneLevel === 'high' ? 'alert' : (arcaneLevel === 'moderate' ? 'notice' : 'calm')),
    },
  };
}

/**
 * Lintel Flock Observation derived from Arcane MEU reading & Sky.
 */
export function buildLintelFlock(sky = {}, weather = {}, events = []) {
  const hasSurge = events.some((e) => e.type === 'ARCANE_SURGE' || /surge/i.test(e.description || ''));
  const count = typeof sky.lintels === 'number' ? sky.lintels : (hasSurge ? 4 : 2);
  let observation = 'Small flock drifting over the Thames embankment, feeding on ambient vapor and harmonic runoff.';

  if (count >= 4 || hasSurge) {
    observation = 'Flock gathered low in dense cloud formation along the river corridor, drawn by heightened arcane resonance.';
  } else if (count <= 1) {
    observation = 'Solitary Lintel drifting high above New Big Ben belfry in the quiet dawn mist.';
  }

  return {
    count,
    reading: hasSurge ? '0.38 µV' : '0.12 µV',
    observation,
  };
}

/**
 * Lead Headline synthesizer.
 */
export function synthesizeLeadHeadline(topEvent, dateStr) {
  // The banner label is fixed per kind of day — a paper's standing head for
  // "the river did something again" does not change week to week — and the
  // clause after the colon is where the Gazette gets to have a view.
  const lead = (label, subs) => `${label}: ${gazettePick(subs, `${dateStr}/lead/${label}`)}`;
  if (!topEvent) {
    return lead('BOROUGH CALM', [
      'Civic Order Holds and the Chimes Keep Time',
      'Nothing Whatever Occurs, at Length',
      'A Quiet Day on the Embankment, Reported in Full',
      'Steady Flagstones, Steady Bells, Steady Nerves',
    ]);
  }
  const type = topEvent.type || '';
  const desc = (topEvent.description || '').toLowerCase();

  if (type === 'ARCANE_SURGE' || desc.includes('arcane surge')) {
    return lead('THAMES HARMONIC SURGE', [
      'MEU Perimeters on Heightened Standby',
      'Corridor Lit End to End; Cones Deployed by Nine',
      'Scanners Went at Twenty To and Did Not Settle',
      'Everything With a Presence In It Felt the Pull',
    ]);
  }
  if (type === 'ALERT') {
    return lead('SECTOR SECURITY ALERT', [
      'Embankment Patrols Doubled Across the Borough',
      'Sentries Doubled; Rota Doubled; Complaints Quadrupled',
      'Whitehall Awake Early and Saying Very Little',
    ]);
  }
  if (type === 'PLAN_BROKEN' || type === 'OUTING_CUT_SHORT') {
    return lead('BOROUGH RECALL', [
      'Southwark Evening Movements Curtailed Under Advisory',
      'Afternoon Ends in a Sentence and a Handheld',
      'Plans Made Days Ago Unmade in Under a Minute',
    ]);
  }
  if (type === 'STANDBY_BEGIN' || type === 'BRIEFING_BEGIN') {
    return lead('INNER CIRCLE ADVISORY', [
      'MI6 Operational Standby Initiated',
      'Assembly Room Booked All Afternoon; Urn Refilled Twice',
      'Door Shut at Ten. Still Shut at One.',
    ]);
  }
  if (desc.includes('order scout') || desc.includes('viaduct')) {
    return lead('SHADOWS ON THE VIADUCT', [
      'Holy Order Watchers Spotted in the Fog',
      'Two Robes at the Arches, Neither Doing Anything',
      'Market Packs Up Early and Declines to Say Why',
    ]);
  }
  if (type === 'TRAVEL_DEPART' || desc.includes('sanctuary')) {
    return lead('CELESTIAL INVITATIONS', [
      'Streamliner Night Transit to the Upper Skyport',
      'Guest Gateways Operating; Door Policy Unchanged',
      'London Falls Away in a Long Grey Curve',
    ]);
  }
  if (type === 'CONVERSATION') {
    return lead('WHISPERS AT THE CAFE', [
      'Confidential Discourse Over the Window Table',
      'Two Agents, One Pot of Tea, No Comment',
      'Nothing Said Loudly Enough for This Paper to Print',
    ]);
  }
  return lead('BOROUGH REPORT', [
    'Calm Embankment and Regular Rail Transit',
    'The River Behaved; the Trains Mostly Did',
    'A Day of No Great Consequence, Recorded Anyway',
  ]);
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
  const curated = curateDailyEvents(events, targetDate);

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
        text: ev.description || 'An unrecorded event stirred the London quiet.',
      };
    });
  } else {
    // Fallback civic calm brief
    chronicleBriefs = [
      {
        eventId: 'civic-calm',
        time: '07:00',
        location: 'London Embankment',
        salienceTier: 'civic',
        headline: 'Quiet Skies Over London',
        text: 'Civic patrols report quiet flagstones and steady morning chimes across all boroughs.',
      },
    ];
  }

  const leadHeadline = synthesizeLeadHeadline(curated[0] || null, targetDate);
  const factionRoundup = buildFactionRoundup(factionData, curated, targetDate);
  const lintelFlock = buildLintelFlock(skyData, weatherData, curated);
  const plotClocks = evaluatePlotClocks(world || { events, factions: factionData, sky: skyData, weather: weatherData, veil: { phase: 'distant', daysAway: 45 } }, serverTime);

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
    notices: buildGazetteNotices(targetDate),
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
