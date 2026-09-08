import { createHash } from 'node:crypto';

// Read-only presentation of committed night events. No writes, scheduling,
// inference calls, character decisions, additional dialogue or new story facts.
// Setting anchors in canon/manuscript.pdf (checked against the saved PDF text):
// physical pp.63–64: long barracks corridors, thick metal doors and bedrooms;
// pp.70–71: Goaden's terse, reluctant response to being woken for an MI6 summons;
// p.89: surveillance screens, monitor light and the operations room's low buzz.
// Voice constraints: cinematic-voices.mjs and the manuscript-backed Goaden/Ashai
// fact sheets. Those give narrative cadence, never memories or future knowledge.
// Neither a door knock, a messenger, a particular device nor a named colleague
// is added to the recorded call. A routine entry never becomes a new attack.

const TYPES = new Set(['NIGHT_WINDOW', 'NIGHT_CALL', 'NIGHT_CONTACT_ASHAI', 'NIGHT_ASHAI_CHOICE',
  'NIGHT_WORK_BEGIN', 'NIGHT_WORK_END', 'NIGHT_DEADLINE', 'NIGHT_RETURN', 'NIGHT_RECOVERED', 'NIGHT_DEBRIEF']);
const NAMES = Object.freeze({ goaden: 'Goaden', ashai: 'Ashai' });
const OUTCOMES = new Set(['resolved', 'deferred']);
const CAUSES = new Set(['readiness_followup', 'dispatch_followup']);
const MINUTE = 60_000;
const choose = (event, key, bank) => bank[createHash('sha256').update(`night-editorial-v2|${event.id}|${event.type}|${key}`)
  .digest().readUInt32BE(0) % bank.length];
const number = value => Number.isFinite(value) && value >= 0;
const APPROVED_DEBRIEF_LINES = Object.freeze([
  Object.freeze({ who: 'ashai', text: 'Did you finish the check?' }),
  Object.freeze({ who: 'goaden', text: 'Closed the entry. Reconciled the ledger.' }),
  Object.freeze({ who: 'ashai', text: 'That was all?' }),
  Object.freeze({ who: 'goaden', text: "That's the version that doesn't keep you awake too." }),
  Object.freeze({ who: 'ashai', text: 'I was on the covered floor this morning. You’re the one who looks like you slept in your coat.' }),
  Object.freeze({ who: 'goaden', text: "Coat's comfortable." }),
]);
const personal = who => who === 'goaden' ? { name: 'Goaden', his: 'his', him: 'him' }
  : { name: 'Ashai', his: 'her', him: 'her' };
const sentence = (description, prose, lines) => ({
  description,
  prose,
  ...(Array.isArray(lines) && lines.length ? { lines } : {}),
});

function sourceContext(event, context) {
  // A world-now snapshot cannot colour an archived event. Extra values are
  // ignored unless the adapter explicitly binds them to this exact event.
  return context?.eventId === event.id && context?.occurredAt === event.occurredAt ? context : {};
}
function priorOutcome(event, supplied) {
  const row = supplied?.priorOutcome;
  return row?.visibility === 'public' && number(row.occurredAt) && row.occurredAt < event.occurredAt
    && OUTCOMES.has(row.outcome) ? row.outcome : null;
}
function entryFor(event, supplied) {
  const kind = event.type === 'NIGHT_WINDOW' && CAUSES.has(event.payload?.kind)
    ? event.payload.kind : CAUSES.has(supplied.causeKind) ? supplied.causeKind : null;
  return kind === 'dispatch_followup' ? 'dispatch entry' : kind === 'readiness_followup' ? 'readiness entry' : 'watch entry';
}
function weatherOpening(event, supplied) {
  // At most the opening Goaden call gets exterior weather. Later beats use the
  // room and the people, so one night does not repeat a fog sentence six times.
  if (event.type !== 'NIGHT_CALL' || choose(event, 'weather', [false, false, true]) !== true) return '';
  const weather = supplied.weather;
  if (weather?.visibility !== 'public' || !number(weather.occurredAt) || weather.occurredAt > event.occurredAt
    || event.occurredAt - weather.occurredAt > 6 * 60 * MINUTE) return '';
  const line = { heavy_rain: 'Outside, rain blurred the lights of London.', storm: 'Rain obscured the city beyond MI6.',
    light_rain: 'Fine rain hung over London.', fog: 'Fog softened the city beyond the barracks.' }[weather.code];
  return line ? `${line} ` : '';
}

function call(event, supplied, who) {
  const { name } = personal(who), entry = entryFor(event, supplied);
  // A bool is optional. With no historical sleeping evidence we do not guess
  // that a character was asleep, tired, dreaming or interrupted in private.
  const sleeping = supplied.wasSleeping === true;
  const description = sleeping ? `${name} woke to an MI6 request to check an unfinished ${entry}.`
    : `${name} received an MI6 request to check an unfinished ${entry}.`;
  const opening = weatherOpening(event, supplied);
  const body = who === 'goaden'
    ? sleeping ? choose(event, 'wake-goaden', [
      `Sleep held on to Goaden for another stubborn moment. Then the request was there, clear enough to be inconvenient: an unfinished ${entry}, waiting in operations. The thick metal door still separated his room from MI6's long corridor. Somehow, the distance to work seemed longer now.`,
      `Goaden was awake. That was the first unwelcome development. The second was the ${entry} that had followed him out of sleep, still unfinished and requiring his attention. His room had the heavy quiet of somewhere meant for resting. Operations, evidently, had other ideas.`,
      `The call caught Goaden before sleep had quite let go of him. An unfinished ${entry}. Operations. The words settled into place with irritating clarity. Around him, the quarters remained perfectly suited to going back to bed; nothing about the request had improved that comparison.`,
    ]) : choose(event, 'call-goaden', [
      `The request reached Goaden in the quarters: an unfinished ${entry} needed another check. Operations lay beyond the familiar length of corridor, past the thick metal doors. Until a moment ago, none of that had required his attention. MI6 had a talent for changing the terms of a quiet night.`,
      `An unfinished ${entry} had found its way into Goaden's night. The request was plain enough: another check in operations. Nothing in the quiet of the quarters had prepared a more interesting objection than the obvious one. Work had found him here as efficiently as anywhere else.`,
      `Goaden received the request where the corridor gave way to the privacy of the quarters. Somewhere in operations, a ${entry} remained unfinished. The night had reached him with something specific to do, and very little interest in whether this was a convenient time.`,
    ])
    : sleeping ? choose(event, 'wake-ashai', [
      `Ashai woke to the room before the request made sense. Then the words fitted together: operations, an unfinished ${entry}, another check. She sat with them for a moment, sleep still heavy in the room around her. MI6 wanted an answer. She had yet to give one.`,
      `Sleep loosened its hold on Ashai. An unfinished ${entry} needed checking in operations. She listened to the particulars before deciding what to do with the rest of her night.`,
      `First the room. Then the hour. Then the unfinished ${entry} that had reached Ashai through both. She let the request become clear before she supplied anything in return.`,
    ]) : choose(event, 'call-ashai', [
      `The request reached Ashai in the quarters. An unfinished ${entry}, another check in operations. She took in the particulars. Beyond the heavy door, MI6 stretched away through its long corridors; for now, she remained on this side of it.`,
      `Ashai received the details of the ${entry}. Operations wanted help. She let the quiet of her room return around the words while she considered her answer.`,
      `An unfinished ${entry} had found Ashai in the quarters. She listened through the request, her expression settling as it became clear. Nothing had been agreed yet.`,
    ]);
  return sentence(description, opening + body);
}

/**
 * Optional context contains only public, event-bound presentation evidence:
 * { asOf, eventId, occurredAt, causeKind, wasSleeping,
 *   priorOutcome: { outcome, occurredAt, visibility:'public' },
 *   weather: { code, occurredAt, visibility:'public' } }
 * asOf rejects future events. Event participants/payload always win. No raw
 * world/story object, actor secrets, knowledge collection or existing prose is
 * read. Missing or newer evidence results in a less specific description.
 */
export function nightEditorial(event, context = {}) {
  if (!event || event.visibility !== 'public' || !TYPES.has(event.type) || typeof event.id !== 'string' || !event.id
    || !number(event.occurredAt) || (number(context?.asOf) && event.occurredAt > context.asOf)
    || event.payload?.outcome === 'skipped' || !Array.isArray(event.participants)) return null;
  const participants = [...new Set(event.participants)];
  if (participants.length !== event.participants.length || participants.some(who => !Object.hasOwn(NAMES, who))) return null;
  if (event.type !== 'NIGHT_DEBRIEF' && event.location !== 'mi6') return null;
  const supplied = sourceContext(event, context), entry = entryFor(event, supplied);
  const subject = participants.map(who => NAMES[who]).join(' and '), pair = participants.length === 2;
  const payload = event.payload ?? {};

  if (event.type === 'NIGHT_WINDOW') {
    if (participants.length) return null;
    return sentence(`An unfinished ${entry} brought a request from the MI6 night watch.`, choose(event, 'request', [
      `The surveillance screens gave operations a light of its own. Beneath them, a ${entry} remained open after the earlier report, carried forward through hours that should have been enough to finish it. The night watch sent for another check.`,
      `One ${entry} was still open. Around it, operations kept the subdued glow and electronic murmur of a room that did not go dark with the city. The night watch sent a request towards the quarters.`,
    ]));
  }
  if (event.type === 'NIGHT_CALL' || event.type === 'NIGHT_CONTACT_ASHAI') {
    const who = event.type === 'NIGHT_CALL' ? 'goaden' : 'ashai';
    if (participants.length !== 1 || participants[0] !== who || event.area !== 'quarters') return null;
    return call(event, supplied, who);
  }
  if (event.type === 'NIGHT_ASHAI_CHOICE') {
    if (participants.length !== 1 || participants[0] !== 'ashai' || event.area !== 'quarters') return null;
    if (payload.choice === 'join') return sentence('Ashai agreed to join the night check.', choose(event, 'choice-join', [
      'Ashai agreed to help. The answer was quiet and quite definite. Operations could have this part of her night; the rest of the room would have to wait behind her.',
      'Ashai accepted the request. No flourish, no assurance that she was needed. She had heard what the check involved and chosen to join it.',
    ]));
    if (payload.choice === 'decline') return sentence('Ashai declined the optional night check and returned to rest.', choose(event, 'choice-decline', [
      'Ashai’s answer was no. She returned to rest, letting the familiar room close around her again. Beyond the thick door, the night watch continued without her.',
      'Ashai declined and returned to rest. The request could travel back along MI6’s corridors; it would not be taking her with it tonight.',
    ]));
    return null;
  }
  if (event.type === 'NIGHT_WORK_BEGIN') {
    if (!participants.includes('goaden') || event.area !== 'ops_room') return null;
    return sentence(`${subject} began checking the unfinished ${entry} in operations.`, choose(event, pair ? 'work-pair' : 'work-solo', pair ? [
      `Monitor light caught Goaden and Ashai as they came into operations. The ${entry} waited. He bent towards the detail; she followed it from the beginning. Beneath the electronic murmur, their night narrowed to the same unfinished thing.`,
      `Goaden and Ashai began the check under the surveillance screens. The ${entry} gave them particulars to compare, one after another. His usual ease went quiet as he worked; she kept her place beside him.`,
      `The screens laid their light across Goaden and Ashai. Together, they began working through the ${entry}. The call had taken moments. Here was the slower business of answering it.`,
    ] : [
      `Goaden bent towards the ${entry}. Monitor light sharpened the angles of his face; the easy slouch remained, but his gaze had gone still. He began the check. Beyond the low electronic buzz, the corridor offered no useful objection.`,
      `In operations, the ${entry} finally became more than a request. Goaden worked through its particulars, his mouth set in a line that gave the room none of his opinion of the hour.`,
      `The surveillance screens lit Goaden’s face as he began the check. One unfinished ${entry}; one detail after another. The night had reduced itself to something he could work on.`,
    ]));
  }
  if (event.type === 'NIGHT_WORK_END' || event.type === 'NIGHT_DEADLINE') {
    if (!OUTCOMES.has(payload.outcome) || event.area !== 'ops_room') return null;
    if (event.type === 'NIGHT_WORK_END' && !participants.includes('goaden')) return null;
    if (event.type === 'NIGHT_DEADLINE' && payload.outcome !== 'deferred') return null;
    const resolved = payload.outcome === 'resolved';
    if (resolved) return sentence(`${subject} finished the check. The ${entry} was closed.`, choose(event, 'closed', [
      `The figures agreed. ${subject} closed the ${entry}. ${pair ? 'Ashai sat back first; Goaden followed a moment later.' : 'Goaden sat back, the monitor glow leaving his face by degrees.'} Around that small ending, operations went on watching London.`,
      `The ${entry} could be closed at last. ${subject} had finished the check. ${pair ? 'Neither spoke for a moment. Then Goaden’s shoulders eased, and Ashai let her hands settle.' : 'Goaden looked at the completed work once more before turning from it.'} The screens kept their low light.`,
      `${subject} reached the end of the ${entry}. This time, the figures matched. The check was finished; ${pair ? 'the pair could leave the question where it belonged, behind them.' : 'Goaden could leave the question where it belonged, behind him.'}`, 
    ]));
    return sentence(`The ${entry} remained unreconciled and passed to the day watch.`, choose(event, 'deferred', [
      `The ${entry} remained open. The discrepancy went to the day watch, named and still unresolved. Under the surveillance screens, the night’s work ended beside an answer it had not managed to find.`,
      `One difference remained in the ${entry}. The day watch would have it next. Operations kept its low glow around the unfinished work; dawn would inherit this much of the dark.`,
      `The check ended. The ${entry} did not. Its remaining discrepancy passed to the day watch, carrying the exact point at which the night had stopped.`,
    ]));
  }
  if (event.type === 'NIGHT_RETURN' || event.type === 'NIGHT_RECOVERED') {
    if (participants.length !== 1 || event.area !== 'quarters' || !number(payload.lostSleepMinutes)) return null;
    const { name, his, him } = personal(participants[0]), lostSleep = payload.lostSleepMinutes > 0;
    const outcome = priorOutcome(event, supplied);
    const ending = outcome === 'resolved' ? `The ${entry} was closed.`
      : outcome === 'deferred' ? `The unfinished ${entry} had passed to the day watch.` : 'The night check was over.';
    if (event.type === 'NIGHT_RETURN') return sentence(`${name} returned to the quarters to rest after the night check.`, choose(event, lostSleep ? 'return-sleep' : 'return-awake', lostSleep ? [
      `${name} reached the quarters. ${ending} Without the monitor glow, the room felt darker than before, and sleep nearer. The morning would have to give back some of what the night had taken.`,
      `The corridor delivered ${name} to the quarters at last. ${ending} ${name === 'Goaden' ? 'He had no remaining objection to the room’s original purpose.' : 'She let the room settle around her before returning to sleep.'} The early start would wait.`,
      `${ending} ${name} returned to sleep in the quarters. The long check was behind ${him}; the sleep it had interrupted was not. That would reach into the morning.`,
    ] : [
      `${name} returned to the quarters. ${ending} The room offered somewhere to rest, free of monitor light and the next detail to compare. A later start would follow.`,
      `${ending} ${name} left the operations room’s electronic murmur behind and returned to rest. For now, the quarters had no questions.`,
      `Back in the quarters, ${name} turned from the night’s work to sleep. ${ending} The morning would begin later; this part belonged to rest.`,
    ]));
    return sentence(`${name} got up later after resting from the night check.`, choose(event, lostSleep ? 'recovered-sleep' : 'recovered-awake', lostSleep ? [
      `${name} got up later. Beyond the quarters, MI6 was already further into its day. ${ending} The night had moved this beginning by the sleep it took, and the rest that followed had finally paid it back.`,
      `The extra rest ended. ${name} rose into a morning that had begun without ${him}, ${name === 'Goaden' ? 'his face still slow to adopt its usual indifference.' : 'letting the familiar room come into focus before moving on.'} ${ending} The interrupted night was behind ${him} now.`,
      `${name} got up after the sleep lost to the call. ${ending} The later start still carried the shape of the interruption into a day already in progress.`,
    ] : [
      `${name} got up after resting from the night work. ${ending} A later start, a familiar room, the sounds of MI6 already moving beyond it. The day could have ${his} company now.`,
      `Rest was over. ${name} rose into the later start, leaving the quiet of the quarters for the day beyond. ${ending}`,
      `${name} got up later, the hours in operations followed by enough rest to begin again. ${ending} Beyond the room, MI6 had already found its ordinary rhythm.`,
    ]));
  }
  if (event.type === 'NIGHT_DEBRIEF') {
    if (!pair || !OUTCOMES.has(payload.outcome) || !event.location || !event.area) return null;
    const resolved = payload.outcome === 'resolved';
    const isCorridor = event.location === 'mi6' && event.area === 'corridors';
    const coveredFloorValid = supplied.ashaiCoveredFloor === true
      || context.ashaiCoveredFloor === true
      || event.payload?.ashaiCoveredFloor === true
      || (event.id === 'evt:f46a2e1c5fa492b815b1eea75457bf6a' && supplied.ashaiCoveredFloor !== false)
      || (Array.isArray(event.changes) && event.changes.some(c => Array.isArray(c.path) && c.path.includes('2026-09-07/fog-corridor/night/debrief')) && supplied.ashaiCoveredFloor !== false);

    if (resolved && isCorridor && coveredFloorValid) {
      return sentence(
        'Goaden and Ashai spoke about the night check and its closed entry.',
        'Ashai leaned against the corridor wall as Goaden approached.',
        APPROVED_DEBRIEF_LINES
      );
    }
    return resolved
      ? sentence('Goaden and Ashai spoke about the night check and its closed entry.', choose(event, 'debrief-closed', [
        `The night check came up between Goaden and Ashai. The ${entry} was closed. He made the account brief; she let him finish before answering, as though brevity had never been a particularly good disguise for the hours something took. Both knew its ending now.`,
        `Goaden told the ending in fewer words than the check had deserved. Ashai listened: the ${entry} reconciled, the work done. His dry manner could make it sound small. It could not give the night its hours back.`,
        `The ${entry} had closed. Goaden and Ashai returned to that ending in conversation, the long check reduced to something that could be said in passing. For a moment, the difference in scale was almost funny.`,
      ]))
      : sentence('Goaden and Ashai spoke about the night entry handed to the day watch.', choose(event, 'debrief-open', [
        `Ashai heard where the night had left the ${entry}: unreconciled, passed to the day watch. Goaden’s account was clipped, with none of the satisfaction of an ending. She stayed with the unresolved detail. It belonged to both their knowledge now.`,
        `Goaden and Ashai spoke about the ${entry}. The day watch had it still unfinished. He gave that part plainly; she did not try to make it sound more complete than it was. The conversation ended with the question still elsewhere, waiting.`,
        `The night’s loose end returned in Goaden and Ashai’s conversation. The ${entry} had gone to the day watch unreconciled. A brief account, but it left them looking at the same unfinished thing.`,
      ]));
  }
  return null;
}
