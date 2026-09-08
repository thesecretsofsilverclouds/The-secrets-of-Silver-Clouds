/**
 * Accolade Titles awarded for correct Prophecy Wager deductions.
 */
export const ACCOLADES = Object.freeze({
  MI6_INTUITIVE: 'MI6 Intuitive',
  SANCTUARY_ORACLE: 'Sanctuary Oracle',
  CHIMEWATCHER: 'Chimewatcher',
  BOROUGH_SLEUTH: 'Borough Sleuth',
});

export const ALL_ACCOLADES = Object.freeze(Object.values(ACCOLADES));

/**
 * Largest Remainder Method (Hamilton/Hare) rounds submitted votes to 100%.
 * No votes means zero throughout; there is no audience distribution yet.
 */
// Where they are actually going, and the question worth asking about it. Order
// matters: the two Sanctuary forms are tested before the generic ones, and the
// list is exhaustive by design — an arrangement that matches nothing here is an
// arrangement with no outing in it, and gets no outing wager.
const OUTING_WAGERS = Object.freeze([
  { match: /invited visit to Sanctuary|guest invitation|arranged an invited visit/i,
    question: 'Will the invited Sanctuary visit proceed without disruption?',
    resolver: 'sanctuary_day',
    accolade: ACCOLADES.SANCTUARY_ORACLE,
    options: [
      { id: 'opt_proceed', text: 'They get the full visit' },
      { id: 'opt_recall', text: 'Cut short by an MI6 recall' },
      { id: 'opt_delays', text: 'Delayed on the Streamliner' },
    ] },
  { match: /evening visit to Sanctuary|once the night halls open/i,
    question: 'Do they make it into the night halls before they close?',
    resolver: 'sanctuary_night',
    accolade: ACCOLADES.SANCTUARY_ORACLE,
    options: [
      { id: 'opt_in', text: 'In, and there for the whole evening' },
      { id: 'opt_recall', text: 'The callout takes the night' },
      { id: 'opt_late', text: 'They get there late and leave early' },
    ] },
  { match: /Enchanted Ink|tattoo parlour/i,
    question: 'Does anybody come out of the Ink with new ink?',
    resolver: 'ink',
    accolade: ACCOLADES.SANCTUARY_ORACLE,
    options: [
      { id: 'opt_none', text: 'They look, and leave with nothing' },
      { id: 'opt_one', text: 'One of them goes through with it' },
      { id: 'opt_cut', text: 'The afternoon is cut short first' },
    ] },
  { match: /Silver Spoon|Cafe|café/i,
    question: 'Do they get the whole hour at the Silver Spoon?',
    resolver: 'cafe',
    accolade: ACCOLADES.SANCTUARY_ORACLE,
    options: [
      { id: 'opt_whole', text: 'The whole hour, window table' },
      { id: 'opt_recall', text: 'A handheld goes off before the pot is empty' },
      { id: 'opt_company', text: 'Somebody they know turns up' },
    ] },
  { match: /Chimes of Renewal|New Big Ben|walk/i,
    question: 'Do they stay under the Chimes until the hour comes round?',
    resolver: 'walk',
    accolade: ACCOLADES.SANCTUARY_ORACLE,
    options: [
      { id: 'opt_stay', text: 'They stay for the whole hour' },
      { id: 'opt_recall', text: 'Called back before it rings' },
      { id: 'opt_early', text: 'One of them wants to go first' },
    ] },
  { match: /go back and finish the visit|take back the evening|the callout cost them/i,
    question: 'Do they get back the afternoon the callout took?',
    resolver: 'make_up',
    accolade: ACCOLADES.SANCTUARY_ORACLE,
    options: [
      { id: 'opt_kept', text: 'This time it holds' },
      { id: 'opt_recalled', text: 'Recalled a second time' },
      { id: 'opt_changed', text: 'They do something else instead' },
    ] },
]);

export function calculatePercentages(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const total = items.reduce((acc, it) => acc + Math.max(0, it.count || 0), 0);
  if (total === 0) {
    return items.map((it) => ({ ...it, count: 0, userVotes: 0, percent: 0 }));
  }

  const calculated = items.map((it) => {
    const count = Math.max(0, it.count || 0);
    const exact = (count / total) * 100;
    const integer = Math.floor(exact);
    const rem = exact - integer;
    return { ...it, count, integer, rem };
  });

  const distributed = calculated.reduce((acc, it) => acc + it.integer, 0);
  const remaining = 100 - distributed;

  const byRemainder = [...calculated].sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < remaining; i++) {
    byRemainder[i % byRemainder.length].integer += 1;
  }

  return calculated.map((it) => ({
    id: it.id,
    text: it.text,
    count: it.count,
    userVotes: it.userVotes || 0,
    percent: it.integer,
  }));
}

/**
 * Detect if an event represents an unresolved beat with a scheduled future resolution.
 * If eligible, generates in-world options based on reachable canon states.
 * 
 * Strict Rule: Zero Railroading. Wager votes never alter what actually occurs in the simulation.
 */
/**
 * Is the answer already on the page?
 *
 * The defect this exists to stop: the Streamliner wager derived its winner from
 * `desc.includes('ink')` — that is, it read the answer out of the very event it
 * was attached to, which had already published "on their way to Enchanted Ink".
 * The audience was asked to guess something the line above the poll told them.
 *
 * A wager is only a wager if the world has not yet said. This is checked
 * against the published text of the event itself and of everything published
 * before it, because either one gives the game away.
 */
export function answerAlreadyPublic(wager, event, snapshot) {
  // `expectedOptionId` is the likely answer used for this spoiler check only.
  // An outing wager no longer carries a winner at creation — see the note on
  // resolveWagerFromEvents — so the check reads the expectation instead.
  const likely = wager?.expectedOptionId ?? wager?.winningOptionId;
  if (!wager || !likely) return false;
  const winner = (wager.options ?? []).find(option => option.id === likely);
  if (!winner) return false;
  // The distinctive words of the winning option. Short ones ("the", "in") would
  // match anything, so they are dropped.
  const tells = winner.text.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3);
  if (!tells.length) return false;
  const said = [event?.description ?? event?.publicDescription ?? '']
    .concat((snapshot?.events ?? [])
      .filter(item => item.visibility !== 'private' && item.occurredAt <= (event?.occurredAt ?? 0))
      .slice(-12)
      .map(item => item.description ?? item.publicDescription ?? ''))
    .join(' ').toLowerCase();
  // Every distinctive word of the answer already in print.
  return tells.every(word => said.includes(word));
}

/**
 * The winning option, read off what the world actually did — or null, meaning
 * the question is not answered yet and the wager must stay unresolved.
 *
 * This exists because the previous behaviour was to resolve on the closing bell
 * using an option chosen when the wager was written. Every wager therefore
 * "resolved" correctly-looking and told the reader an outcome that had not
 * happened, sometimes for an outing still in progress. A closed window and a
 * decided question are different things, and only the world decides the second.
 */
export function resolverForQuestion(question) {
  return OUTING_WAGERS.find(entry => entry.question === question)?.resolver ?? null;
}

export function resolveWagerFromEvents(wager, events = []) {
  if (!wager || !Array.isArray(events)) return null;
  // A stored wager is rehydrated from columns and has no resolver on it, so it
  // is recovered from the question — which is unique per outing by construction.
  wager = { ...wager, resolver: wager.resolver ?? resolverForQuestion(wager.question) };
  const after = events.filter(item => Number(item.occurredAt) > Number(wager.createdAt ?? 0));
  if (!after.length) return null;
  const has = (...types) => after.some(item => types.includes(item.type));
  const said = text => after.some(item => (item.description ?? item.publicDescription ?? '').toLowerCase().includes(text));
  const option = id => (wager.options ?? []).some(entry => entry.id === id) ? id : null;

  // Something took the afternoon: that answers every outing question the same way.
  if (has('OUTING_CUT_SHORT', 'PLAN_BROKEN')) return option('opt_recall') ?? option('opt_recalled') ?? option('opt_cut');
  // They got home, so the outing ran its course. What that means is per-question.
  const home = after.some(item => item.type === 'TRAVEL_ARRIVE'
    && /returned to MI6/i.test(item.description ?? item.publicDescription ?? ''));
  if (!home) return null;
  switch (wager.resolver) {
    case 'ink': return said('paying') || said('tattoo') || has('INK_APPOINTMENT_COMPLETED')
      ? option('opt_one') : option('opt_none');
    case 'cafe': return after.some(item => item.type === 'VENUE_SCENE'
      && (item.payload?.cast ?? []).some(who => !['goaden', 'ashai'].includes(who)))
      ? option('opt_company') : option('opt_whole');
    case 'walk': return option('opt_stay');
    case 'sanctuary_day': return option('opt_proceed');
    case 'sanctuary_night': return option('opt_in');
    case 'make_up': return option('opt_kept');
    default: return null;
  }
}

export function detectWagerForEvent(event, snapshot = null, now = Date.now()) {
  if (!event || !event.id) return null;
  const wager = buildWagerForEvent(event, snapshot, now);
  // The one rule every wager has to pass, applied in one place so a new
  // question cannot be added without it.
  if (wager && answerAlreadyPublic(wager, event, snapshot)) return null;
  return wager;
}

function buildWagerForEvent(event, snapshot = null, now = Date.now()) {
  if (!event || !event.id) return null;

  // 1. Explicit wager attached on event (e.g. custom test fixture or synthetic action)
  if (event.wager) {
    return {
      id: event.wager.id || `wager-${event.id}`,
      eventId: event.id,
      question: event.wager.question,
      options: event.wager.options,
      closesAt: event.wager.closesAt,
      resolutionEventId: event.wager.resolutionEventId || null,
      winningOptionId: event.wager.winningOptionId || null,
      accoladeTitle: event.wager.accoladeTitle || ACCOLADES.MI6_INTUITIVE,
      status: event.wager.status || (event.wager.closesAt <= now ? 'closed' : 'open'),
      createdAt: event.occurredAt || now,
    };
  }

  const desc = (event.description || '').toLowerCase();
  const type = event.type || '';
  const occurredAt = typeof event.occurredAt === 'number' ? event.occurredAt : now;

  // 2. Departure -> Arrival: Streamliner journeys
  if (
    type === 'TRAVEL_DEPART'
    || type === 'depart'
    || desc.includes('boarded the streamliner')
    || desc.includes('departure')
  ) {
    // Find matching arrival in pending actions or payload
    let arrivalTime = null;
    let destination = 'sanctuary';

    if (snapshot?.pendingActions) {
      const arrival = snapshot.pendingActions.find(
        (a) => (a.type === 'TRAVEL_ARRIVE' || a.type === 'arrive')
          && (a.departureEventId === event.id || a.dueAt > occurredAt)
      );
      if (arrival) {
        arrivalTime = arrival.dueAt;
        if (arrival.to) destination = arrival.to;
      }
    }

    if (!arrivalTime && event.payload?.arrivesAt) {
      arrivalTime = event.payload.arrivesAt;
      if (event.payload.to) destination = event.payload.to;
    }

    if (!arrivalTime) {
      // Standard 25-minute journey window
      arrivalTime = occurredAt + 25 * 60 * 1000;
    }

    // NOT "where are they going" — the sentence this poll sits under already
    // says where they are going, every single time. The only thing genuinely
    // unsettled when they board is whether they get the afternoon they planned,
    // and that is the better question anyway: a viewer who has noticed the Holy
    // Order is working the boroughs today can actually reason their way to it,
    // which is what a prediction mechanic is for.
    const returning = destination === 'mi6' || desc.includes('return to mi6');
    if (returning) return null;
    const question = 'Do they get the afternoon they planned?';
    const options = [
      { id: 'opt_kept', text: 'Yes — they come back in their own time' },
      { id: 'opt_recalled', text: 'No — something pulls them back early' },
    ];
    // The world already knows: a recall is queued the moment the day is planned.
    const recallQueued = (snapshot?.pendingActions ?? []).some(action =>
      action.type === 'OUTING_CUT_SHORT' && action.dueAt > occurredAt);
    const expectedWinner = recallQueued ? 'opt_recalled' : 'opt_kept';
    const accoladeTitle = destination === 'sanctuary' ? ACCOLADES.SANCTUARY_ORACLE : ACCOLADES.CHIMEWATCHER;

    return {
      id: `wager-${event.id}`,
      eventId: event.id,
      question,
      options,
      closesAt: arrivalTime,
      resolutionEventId: null,
      winningOptionId: expectedWinner,
      accoladeTitle,
      status: arrivalTime <= now ? 'closed' : 'open',
      createdAt: occurredAt,
    };
  }

  // 3. Standby / Alert / Arcane Surge
  if (
    type === 'STANDBY_BEGIN'
    || type === 'ARCANE_SURGE'
    || type === 'ALERT'
    || desc.includes('stand by')
    || desc.includes('surge along the thames')
    || desc.includes('heightened readiness')
  ) {
    let closesAt = occurredAt + 45 * 60 * 1000;
    if (snapshot?.pendingActions) {
      const nextDuty = snapshot.pendingActions.find(
        (a) => a.dueAt > occurredAt && (a.actor === 'goaden' || a.type.includes('STANDBY') || a.type.includes('BRIEFING'))
      );
      if (nextDuty) closesAt = nextDuty.dueAt;
    }

    const question = 'What will the Thames perimeter scanner readings reveal?';
    const options = [
      { id: 'opt_surge', text: 'Arcane violet harmonic frequency spike' },
      { id: 'opt_order', text: 'Holy Order covert surveillance sweep' },
      { id: 'opt_lintel', text: 'Atmospheric Lintel migration fluctuation' },
      { id: 'opt_clear', text: 'Routine sensor baseline recalibration' },
    ];

    let winningOptionId = 'opt_surge';
    let accoladeTitle = ACCOLADES.MI6_INTUITIVE;

    if (desc.includes('order')) {
      winningOptionId = 'opt_order';
      accoladeTitle = ACCOLADES.BOROUGH_SLEUTH;
    }

    return {
      id: `wager-${event.id}`,
      eventId: event.id,
      question,
      options,
      closesAt,
      resolutionEventId: null,
      winningOptionId,
      accoladeTitle,
      status: closesAt <= now ? 'closed' : 'open',
      createdAt: occurredAt,
    };
  }

  // 4. Holy Order / Street Mystery investigation
  if (
    desc.includes('order scout')
    || desc.includes('viaduct')
    || desc.includes('bounty')
    || desc.includes('nameless')
  ) {
    const closesAt = occurredAt + 40 * 60 * 1000;
    return {
      id: `wager-${event.id}`,
      eventId: event.id,
      question: 'How will Goaden handle the Holy Order watcher?',
      options: [
        { id: 'opt_shadow', text: 'Maintain covert watch without breaking cover' },
        { id: 'opt_reinforce', text: 'Call in MEU corridor reinforcement' },
        { id: 'opt_disengage', text: 'Disengage through the foggy arcade' },
      ],
      closesAt,
      resolutionEventId: null,
      winningOptionId: 'opt_shadow',
      accoladeTitle: ACCOLADES.BOROUGH_SLEUTH,
      status: closesAt <= now ? 'closed' : 'open',
      createdAt: occurredAt,
    };
  }

  // 5. Arranged outing suspense.
  //
  // The bug this replaces: every arrangement in the world got "Will the planned
  // Sanctuary visit proceed without disruption?", with options about the evening
  // lounge and Streamliner delays. Measured over forty days, that was forty of
  // forty wrong — the question was asked about a meal in the lunch hall, about a
  // game with Yukon, and about a walk to hear the Chimes. A reader who is
  // watching them sit down to dinner and is asked whether the Sanctuary visit
  // will be disrupted learns, correctly, that nothing is reading the world.
  //
  // So the question is derived from where they are actually going, and an
  // arrangement that is not an outing gets no outing wager at all rather than a
  // borrowed one.
  if (type === 'ANNOUNCE_ARRANGEMENT' || type === 'INVITATION_AVAILABLE'
    || desc.includes('arranged an invited visit') || desc.includes('guest invitation')) {
    const outing = OUTING_WAGERS.find(entry => entry.match.test(desc));
    if (!outing) return null;
    const closesAt = occurredAt + 50 * 60 * 1000;
    return {
      id: `wager-${event.id}`,
      eventId: event.id,
      question: outing.question,
      options: outing.options,
      closesAt,
      resolutionEventId: null,
      // No winner at creation. This used to be options[0], which meant the
      // wager knew its own answer before the afternoon happened and the page
      // printed "Resolved: the whole hour, window table" at the closing bell —
      // while the pair were demonstrably still sitting in the café. A
      // prediction that announces the result on a timer is not a prediction.
      winningOptionId: null,
      expectedOptionId: outing.options[0].id,
      resolver: outing.resolver,
      accoladeTitle: outing.accolade,
      status: closesAt <= now ? 'closed' : 'open',
      createdAt: occurredAt,
    };
  }

  return null;
}

/**
 * Produce options from submitted votes only.
 */
export function buildWagerOptionsWithVotes(wager, userVotesByOption = {}) {
  const options = wager.options || [];
  const items = options.map((opt) => {
    const submitted = Object.hasOwn(userVotesByOption, opt.id) ? userVotesByOption[opt.id] : 0;
    const realVotes = Number.isSafeInteger(submitted) && submitted > 0 ? submitted : 0;
    return {
      id: opt.id,
      text: opt.text,
      count: realVotes,
      userVotes: realVotes,
    };
  });

  return calculatePercentages(items);
}

/**
 * Generate a High-Stakes Climax Prophecy Wager when a Plot Clock reaches penultimate status.
 */
export function detectPlotClockClimaxWager(clock, event = null, now = Date.now()) {
  if (!clock || !clock.isPenultimate) return null;

  const eventId = event?.id || `clock-${clock.id}-climax`;
  const occurredAt = typeof event?.occurredAt === 'number' ? event.occurredAt : now;
  const closesAt = occurredAt + 45 * 60 * 1000; // 45-minute voting suspense window

  if (clock.id === 'mi6_net') {
    return {
      id: `wager-clock-${clock.id}`,
      eventId,
      clockId: clock.id,
      question: 'Will the MI6 Standby culminate in an emergency Thames intercept?',
      options: [
        { id: 'opt_intercept', text: 'Emergency Thames corridor operational intercept' },
        { id: 'opt_standdown', text: 'Whitehall standing down without incident' },
        { id: 'opt_overnight', text: 'Operatives held overnight in barracks watch' },
      ],
      closesAt,
      resolutionEventId: null,
      winningOptionId: 'opt_intercept',
      accoladeTitle: ACCOLADES.MI6_INTUITIVE,
      status: closesAt <= now ? 'closed' : 'open',
      createdAt: occurredAt,
    };
  }

  if (clock.id === 'arcane_resonance') {
    return {
      id: `wager-clock-${clock.id}`,
      eventId,
      clockId: clock.id,
      question: 'Will the harmonic spike crest into a full Thames Arcane Surge?',
      options: [
        { id: 'opt_surge', text: 'Full harmonic arcane surge registered (> 0.29 µV)' },
        { id: 'opt_settle', text: 'Harmonic oscillations settle back to river equilibrium' },
        { id: 'opt_drift', text: 'Lintel familiars disperse toward Southwark arches' },
      ],
      closesAt,
      resolutionEventId: null,
      winningOptionId: 'opt_surge',
      accoladeTitle: ACCOLADES.CHIMEWATCHER,
      status: closesAt <= now ? 'closed' : 'open',
      createdAt: occurredAt,
    };
  }

  if (clock.id === 'order_vigil') {
    return {
      id: `wager-clock-${clock.id}`,
      eventId,
      clockId: clock.id,
      question: 'How will the Holy Order perimeter watch resolve tonight?',
      options: [
        { id: 'opt_confront', text: 'Direct midnight confrontation along the arcade' },
        { id: 'opt_evade', text: 'Order shadows slip away without breaking cover' },
        { id: 'opt_infiltrate', text: 'Inquisitors attempt a discrete archival breach' },
      ],
      closesAt,
      resolutionEventId: null,
      winningOptionId: 'opt_confront',
      accoladeTitle: ACCOLADES.BOROUGH_SLEUTH,
      status: closesAt <= now ? 'closed' : 'open',
      createdAt: occurredAt,
    };
  }

  if (clock.id === 'veil') {
    return {
      id: `wager-clock-${clock.id}`,
      eventId,
      clockId: clock.id,
      question: 'Will the final bells strike for the opening of the Celestial Veil?',
      options: [
        { id: 'opt_open', text: 'Final chimes confirm the Celestial Veil is underway' },
        { id: 'opt_vigil', text: 'Sanctuary remains in final evening prayer vigil' },
      ],
      closesAt,
      resolutionEventId: null,
      winningOptionId: 'opt_open',
      accoladeTitle: ACCOLADES.SANCTUARY_ORACLE,
      status: closesAt <= now ? 'closed' : 'open',
      createdAt: occurredAt,
    };
  }

  return null;
}
