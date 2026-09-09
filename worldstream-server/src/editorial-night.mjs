import { createHash } from 'node:crypto';

// Read-only presentation of committed night events. No writes, scheduling,
// inference calls, character decisions or new story facts. Bounded dialogue
// performs the recorded pair's work; existing source dialogue always wins.
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
const NIGHT_CHECK_LINES = Object.freeze([
  { who: 'goaden', expression: 'tired', text: 'All this fuss over a row of bloody numbers.' },
  { who: 'ashai', expression: 'guarded', text: 'Then read them.' },
  { who: 'goaden', expression: 'idle', text: 'I am reading them.' },
  { who: 'ashai', expression: 'thoughtful', text: 'Both sets, Goaden. We need them to agree.' },
  { who: 'goaden', expression: 'deflect', text: 'Yeah. I got that part.' },
]);
const NIGHT_CLOSED_LINES = Object.freeze([
  { who: 'ashai', expression: 'neutral', text: 'These match.' },
  { who: 'goaden', expression: 'tired', text: 'All of it?' },
  { who: 'ashai', expression: 'thoughtful', text: 'All of it. We can close the entry.' },
  { who: 'goaden', expression: 'smirk', text: 'About fucking time.' },
  { who: 'ashai', expression: 'amused', text: 'Now you can stop glaring at it.' },
  { who: 'goaden', expression: 'idle', text: 'It knows what it did.' },
]);
const authoredLines = event => Array.isArray(event.lines) && event.lines.length
  || Array.isArray(event.payload?.lines) && event.payload.lines.length;
const performLines = (event, lines) => authoredLines(event) ? undefined : lines.map(line => ({ ...line }));
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

function taskFor(entry) {
  return entry === 'dispatch entry'
    ? 'The service records still left a dispatch entry unresolved. The figures needed comparing before that entry could be closed.'
    : 'An earlier watch report still needed checking. The job was to compare its figures and reconcile the entry in operations.';
}

function call(event, supplied, who) {
  const { name } = personal(who), entry = entryFor(event, supplied);
  const sleeping = supplied.wasSleeping === true;
  const description = sleeping ? `${name} woke to an MI6 request to check an unfinished ${entry}.`
    : `${name} received an MI6 request to check an unfinished ${entry}.`;
  const task = taskFor(entry);
  const body = who === 'goaden'
    ? sleeping ? choose(event, 'wake-goaden', [
      `Goaden dragged a hand down his face. MI6 had pulled him out of sleep to check bloody figures. ${task}\n\nHe sat with his jaw tight, staring towards the heavy door of his quarters. Beyond it lay the corridor to operations. He had the request now; getting back to bed would have to wait.`,
      `The call hauled Goaden awake. He blinked into the room, then rubbed at his eyes as the request sank in. ${task}\n\nHis shoulders sagged. Of all the things to be wanted for at this hour. He looked towards the door, sleep still heavy in his face.`,
    ]) : choose(event, 'call-goaden', [
      `Goaden stopped in the quarters as the MI6 request reached him. ${task}\n\nHe ran a hand over the back of his neck. The door, the long corridor, then the screens in operations. He knew the route. He had rather less enthusiasm for the job at the far end of it.`,
      `${task} The request reached Goaden in his quarters, where he could still look at the door without needing to go through it.\n\nHis mouth tightened. A report to check, line by line. He gave the request his attention, the easy slouch in his shoulders doing nothing to hide his irritation.`,
    ])
    : sleeping ? choose(event, 'wake-ashai', [
      `Ashai woke and held still while she took in the request. ${task}\n\nShe rubbed the sleep from her eyes. Operations wanted her help, but asking did not settle what she would do. She sat with the details, considering whether to give up the rest of her night.`,
      `The call woke Ashai in her quarters. She listened until the work was clear: compare the figures in the unfinished ${entry}, then check whether it could be closed.\n\nShe looked towards the door. She had been asked to help. Her answer was still hers to give.`,
    ]) : choose(event, 'call-ashai', [
      `Ashai listened to the request in her quarters. ${task}\n\nHer gaze settled on the heavy door. She understood what operations needed. That did not mean she had agreed to spend her night doing it.`,
      `The unfinished ${entry} needed another check in operations. Ashai went over what was being asked of her: compare the figures, work through the difference, help finish the report.\n\nShe remained in her quarters while she considered it. Nothing had been agreed yet.`,
    ]);
  return sentence(description, weatherOpening(event, supplied) + body);
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
      `The night watch stopped over an unfinished report beneath the operations screens. Its figures needed comparing before the ${entry} could be closed.\n\nA request went to the quarters. Somebody would have to come down and work through the check.`,
      `The figures in an earlier report still needed checking. The night watch could not close the ${entry} without going through them.\n\nBeneath the surveillance screens, the request was sent to the quarters. The watch needed somebody on the check.`,
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
      'Ashai agreed to help with the check. She straightened, giving the request a last moment of attention before turning towards the door. The report in operations would have a second pair of eyes.',
      'Ashai accepted. She had heard what needed checking and decided to go. For now she remained in her quarters, but the answer had been given: she would join the work in operations.',
    ]));
    if (payload.choice === 'decline') return sentence('Ashai declined the optional night check and returned to rest.', choose(event, 'choice-decline', [
      'Ashai declined. She had heard the request and understood the work; she was still allowed to say no. She returned to rest in her quarters while the night watch continued without her.',
      'Ashai gave her answer and turned back to rest. She would not be joining the check in operations. The heavy door of her quarters stayed between her and the work she had declined.',
    ]));
    return null;
  }
  if (event.type === 'NIGHT_WORK_BEGIN') {
    if (!participants.includes('goaden') || event.area !== 'ops_room') return null;
    return sentence(`${subject} began checking the unfinished ${entry} in operations.`, choose(event, pair ? 'work-pair' : 'work-solo', pair ? [
      `Goaden and Ashai bent over the figures beneath the operations screens. He followed one set while she checked the other, working through the ${entry} from the beginning.\n\nGoaden slowed at a detail and Ashai went back over it. Neither could finish the report by assuming the figures agreed. Each line had to be checked.`,
      `The screens lit Goaden and Ashai from above as the check began. Two sets of figures; one unfinished ${entry}. Goaden leaned in, his slouch straightening as he compared the entries.\n\nAshai kept pace beside him. When he stopped over a detail, she checked it too. The answer had to be in the report, not in how badly either wanted to leave operations.`,
    ] : [
      `Goaden leaned over the ${entry}, his face washed pale by the operations screens. He began comparing the figures, line by line, keeping his place as he went.\n\nHis usual grin was gone. Skipping a detail would get the job finished faster, but it would leave the same unchecked report for someone else. He went back over the line in front of him.`,
      `The unfinished ${entry} lay in front of Goaden beneath the monitor glow. He worked through its figures from the beginning, stopping to compare each entry before going on.\n\nHis jaw tightened when a detail made him read it again. No joke was going to settle this one. He stayed with the check.`,
    ]), pair ? performLines(event, NIGHT_CHECK_LINES) : undefined);
  }
  if (event.type === 'NIGHT_WORK_END' || event.type === 'NIGHT_DEADLINE') {
    if (!OUTCOMES.has(payload.outcome) || event.area !== 'ops_room') return null;
    if (event.type === 'NIGHT_WORK_END' && !participants.includes('goaden')) return null;
    if (event.type === 'NIGHT_DEADLINE' && payload.outcome !== 'deferred') return null;
    const resolved = payload.outcome === 'resolved';
    const closingLines = resolved && pair ? performLines(event, NIGHT_CLOSED_LINES) : undefined;
    if (closingLines) return sentence(`${subject} finished the check. The ${entry} was closed.`, choose(event, 'closed-scene', [
      'Goaden reached the last figures and stopped, one hand against his jaw. Ashai leaned forward beside him, comparing the two sets under the light of the operations screens.',
      'The monitor glare caught Ashai’s face as she went through the last figures. Goaden waited beside her, his shoulders hunched over the report. She checked the final line, then looked up.',
    ]), closingLines);
    if (resolved) return sentence(`${subject} finished the check. The ${entry} was closed.`, choose(event, 'closed', [
      `The figures matched. ${subject} reached the end of the ${entry} and closed it. ${pair ? 'Ashai sat back, easing her hands away from the work. Beside her, Goaden rubbed his face.' : 'Goaden sat back and rubbed his face, the pressure of his fingers briefly hiding the monitor glare.'}\n\nThere was no discrepancy left to pass on. The check was finished.`,
      `${subject} checked the last figures. The two sets agreed; the ${entry} could finally be closed.\n\n${pair ? 'Goaden let his shoulders drop. Ashai looked over the completed work once more before she moved back beside him.' : 'Goaden let his shoulders drop. He looked over the completed work once more, then moved back from the screen.'} No more lines to go through tonight.`,
    ]));
    return sentence(`The ${entry} remained unreconciled and passed to the day watch.`, choose(event, 'deferred', [
      `The figures still did not agree. The ${entry} could not be closed, so the remaining difference was marked for the day watch.\n\nAnother check would be needed. The night watch had reached the end of this attempt without settling the discrepancy.`,
      `One difference remained in the ${entry}. It was left clearly marked, with the report still open for the day watch.\n\nThe check had stopped here. Calling it finished would only hide the part that still needed doing.`,
    ]));
  }
  if (event.type === 'NIGHT_RETURN' || event.type === 'NIGHT_RECOVERED') {
    if (participants.length !== 1 || event.area !== 'quarters' || !number(payload.lostSleepMinutes)) return null;
    const { name, him } = personal(participants[0]), lostSleep = payload.lostSleepMinutes > 0;
    const outcome = priorOutcome(event, supplied);
    const ending = outcome === 'resolved' ? `The ${entry} was closed.`
      : outcome === 'deferred' ? `The unfinished ${entry} had passed to the day watch.` : 'The night check was over.';
    if (event.type === 'NIGHT_RETURN') return sentence(`${name} returned to the quarters to rest after the night check.`, choose(event, lostSleep ? 'return-sleep' : 'return-awake', name === 'Goaden' ? [
      `Goaden reached his quarters and lowered himself onto the bed. ${ending}\n\nHe rubbed at the back of his neck, then lay down. ${lostSleep ? 'The call had taken him out of sleep; he was going back to it now. His early morning start would have to wait.' : 'He had finished in operations. Now he could rest, with a later start to the morning.'}`,
      `${ending} Back in his quarters, Goaden sat on the edge of the bed, shoulders sagging now there was no report in front of him.\n\nHe lay back. ${lostSleep ? 'He needed the sleep the call had cut short, and he would be getting up later because of it.' : 'The work was done for now. Rest came next, followed by a later start.'}`,
    ] : [
      `Ashai returned to her quarters. ${ending} She sat down on the bed and let her hands fall still in her lap.\n\n${lostSleep ? 'The call had broken her sleep. She lay down to finish it, knowing her early start would have to wait.' : 'She lay down to rest after the work in operations. Her morning would start later.'}`,
      `${ending} Ashai reached the bed in her quarters and sat, blinking as her eyes adjusted from the operations screens.\n\n${lostSleep ? 'She had given the check part of the night she should have spent asleep. She lay down again; the morning routine would have to move.' : 'She had stayed with the night work. Now she lay down to rest, with a later start ahead of her.'}`,
    ]));
    return sentence(`${name} got up later after resting from the night check.`, choose(event, lostSleep ? 'recovered-sleep' : 'recovered-awake', name === 'Goaden' ? [
      `Goaden got up and sat forward, rubbing both hands over his face. Outside his quarters, MI6 was already into its morning.\n\nHe had rested after the night check. Now he could get moving, starting later than the ordinary routine.`,
      `The rest after the night check was over. Goaden rose from the bed and rolled his shoulders, taking a moment before he straightened.\n\nHe was getting up into a morning already under way. The hours in operations had pushed his start back.`,
    ] : [
      `Ashai got up and waited for the room to come into focus. Beyond the quarters, MI6 had begun its morning without her.\n\nShe had rested after the check in operations. Now she could start her day, later than planned.`,
      `Ashai sat forward on the bed, then rose. She had finished resting from the night work; the early start had passed while she slept.\n\nThe morning was already under way outside her quarters. She was ready to join it now.`,
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
        `Goaden told Ashai what had happened in operations. The figures had matched, and the ${entry} was closed.\n\nShe listened while he went through the result. No difference left for somebody else to find. He rubbed his face, giving her a tired look as he finished.`,
        `The ${entry} came up between Goaden and Ashai. He kept the account short: the figures checked, the two sets agreed, the report closed.\n\nAshai stayed with him until he had finished explaining it. The job had taken a night check; at least it would not need another one.`,
        `Ashai heard how the ${entry} had been settled. Goaden had checked the figures through to the end, and the two sets agreed.\n\nHe rolled his shoulders as he spoke. The report was closed. Ashai knew that now, along with what the work had involved.`,
      ]))
      : sentence('Goaden and Ashai spoke about the night entry handed to the day watch.', choose(event, 'debrief-open', [
        `Goaden told Ashai why the ${entry} was still open. The figures had not agreed. The difference was marked for the day watch to check.\n\nAshai listened to the account, her attention fixed on that remaining difference. Finishing a shift had not finished the work.`,
        `The ${entry} had gone to the day watch. Goaden explained it to Ashai: the check had stopped with figures still unreconciled, and the report could not be closed.\n\nHe gave her the result without dressing it up. Someone still had to find why the two sets differed.`,
        `Ashai heard about the figures the night check had failed to reconcile. Goaden went over the result with her, his mouth tight. The ${entry} remained open for the day watch.\n\nThe difference had been marked clearly. It still needed an answer.`,
      ]));
  }
  return null;
}
