import { createHash } from 'node:crypto';
import { supportingEditorial } from './editorial-supporting.mjs';
import { nightEditorial } from './editorial-night.mjs';
import { livesEditorial } from './editorial-lives.mjs';
import { callbackEditorial } from './callbacks.mjs';

// A new edition of the words, not a new edition of the world. Never called by
// the reducer: event identity, effects, knowledge and the stored scene packet
// are immutable. This also lets old recorded scenes receive copy corrections.
export const EDITORIAL_REVISION = 'silver-clouds-editorial-v3';
export function correctEditorialText(value) {
  return typeof value === 'string' ? value.replaceAll(
    'the street it had left was one street shorter than it should be',
    'the street it had left had one building fewer than it should') : value;
}
const pair = event => ['goaden', 'ashai'].every(id => event.participants?.includes(id));
const pick = (event, choices) => choices[createHash('sha256')
  .update(`${EDITORIAL_REVISION}|${event.id}|${event.type}`).digest().readUInt32BE(0) % choices.length];
const text = value => typeof value === 'string' && value.trim().length > 0;
const places = Object.freeze({ mi6: 'MI6', sanctuary: 'the Sanctuary', cafe: 'the Silver Spoon',
  enchanted_ink: 'Enchanted Ink', big_ben_plaza: 'Big Ben Plaza' });

// Public outcomes supply endings. Gestures supply performance; they cannot
// decide a winner, grant a power, explain a mystery or complete unfinished work.
// Voice anchors: manuscript physical pp.64/68/161/170, plus the canon review's
// pre-revelation boundary. MI6's metal corridors and common-room familiarity,
// Enchanted Ink's moving designs, and the Streamliner are established texture.
const INTENT_END = {
  practice: [
    'Ashai held the final movement, then let her hands fall. Beside her, Goaden rolled the tension out of one shoulder. They had finished. His easy manner returned first; the effort took a moment longer to leave his breathing.',
    'The last movement brought them to a halt together. Ashai steadied her breathing while Goaden loosened his shoulders, already recovering the look of a man who had barely been trying. She looked at him. The breathing rather spoiled it.'
  ],
  game: [
    'The game ended. Goaden leaned back at once, while Ashai let the last moment finish before turning towards him. His expression was carefully casual. She gave it a look that suggested she had noticed the care.',
    'They stayed for the final seconds. Afterwards, Ashai sat back and Goaden let his hands go slack. MI6 could have the next demand; this game had reached its ending with both of them still in their seats.'
  ],
  quiet: [
    'Ashai stirred first. Goaden lifted his head beside her, and the sounds of MI6 returned by degrees: distant footfalls, the weight of a door closing. For once, their silence had lasted until they were ready to leave it.',
    'The break ended without ceremony. Goaden shifted; Ashai looked up. They had sat together long enough for the quiet to stop feeling like something borrowed.'
  ]
};
const INTENT_YES = {
  game: [
    'Goaden agreed to the game with the air of someone making no particular commitment. Ashai let him have the air. She had the agreement.',
    'A short game, then. Goaden’s answer was brief; Ashai’s expression warmed before she covered it with a more practical look. They had something of their own waiting in the evening now.'
  ],
  practice: [
    'Practice, then. Ashai accepted the change, meeting Goaden’s look until he understood that she had chosen it. The shape of the plan had altered. There were still two people inside it.',
    'They settled on practice. Goaden gave a small nod, as if it were no more complicated than that. Ashai allowed him the simplicity; they would still be spending the time together.'
  ],
  quiet: [
    'A quiet break. They could share that without turning it into a competition. For a little while, neither would have to keep the other entertained.',
    'They agreed to make it quiet. The suggestion could rest between them now, without either turning it into something louder.'
  ]
};
const DELIVERY = {
  reconciled: [
    'The two dispatch references matched. Enchanted Ink accepted the delivery at last. Across the walls, designs slipped through their familiar shapes; the supplies could finally move too, by the much less elegant magic of having the right paperwork.',
    'This time, the references agreed. The delivery was accepted. On the walls of Enchanted Ink, a design continued its restless passage, wholly indifferent to the effort required to get anything else through the shop.'
  ],
  returned: [
    'The references disagreed, and the delivery went back. Around the unresolved need for supplies, Enchanted Ink’s wall designs curled and shifted. The shop could move its art at will. Replacing an incorrectly dispatched delivery would take longer.',
    'The check reached its end. The supplies did not reach theirs. Enchanted Ink returned the delivery, leaving a replacement still to come and no further room to pretend this one would do.'
  ],
  missed_window: [
    'The delivery deadline arrived before the missing dispatch copy. The window shut with nothing accepted. Ink curled through the wall designs, heedless of the supplies still outstanding.',
    'The copy had not come. Enchanted Ink closed the delivery entry for that window, leaving the supplies outstanding. One small expectation had survived the whole wait and come to nothing.'
  ]
};
const AGENDA = {
  cleared: [
    'The service records agreed. MI6 lifted the temporary caution, letting the day loosen around the work it had held back. This review was finished.',
    'Two service records finally told the same story. The temporary caution came off, and the work of this review was done.'
  ],
  followup_required: [
    'The review ended with the discrepancy still there. MI6 would need a replacement record and another check. An answer had been wanted; instead, there was a definite piece of work left for later.',
    'The records would not agree simply because the review was over. A replacement and another check remained outstanding. The question had outlasted the time set aside for it.'
  ],
  unverified: [
    'The review ended without a complete answer. Its entry stayed unverified, the next check still waiting to be done. MI6 had reached the end of this attempt without reaching the end of the matter.',
    'There was not enough to close the question. The review remained unverified, with another check outstanding. For now, uncertainty was the honest result.'
  ]
};
const CONVERSATIONS = {
  ordinary: ['Goaden’s answer came with a dry little turn at the end. Ashai caught it, gave him the look it deserved, and answered the part he had tried to make less serious. Somewhere along the corridor, a heavy door closed. Their conversation kept going.',
    'Ashai spoke; Goaden supplied a short answer and the beginnings of a smile. She waited. Under that level look, he found a few more words. The exchange took its familiar shape.'],
  close: ['Goaden let the pause stretch. Ashai stayed with it, her shoulder turned towards him. Neither hurried to rescue the conversation. It was comfortable enough to manage without rescuing.',
    'Ashai looked across at him. For once, Goaden met the look before preparing a reply. His answer, when it came, had fewer edges to it.'],
  strained: ['Goaden kept his replies short. Ashai waited after each one, leaving him room he did not seem inclined to use. The silences between them had become quite precise.',
    'Ashai held his gaze. Goaden’s answer arrived clipped at both ends, and she took a moment before giving it back to him. An easy exchange would have required less care.'],
  friction: ['Ashai finished her point and stayed exactly where she was. Goaden’s ready answer checked itself against her expression. He gave another one instead, no warmer. The edge remained.',
    'Goaden tried his usual ease. Ashai did not move with it. For a beat, the conversation hung between his half-smile and her level look; then she answered him plainly.'],
  repair: ['Ashai gave him room to answer. Goaden took it in a few plain words, his face quieter than his usual deflections. When she replied, the exchange found somewhere firmer to stand. What had gone wrong still belonged to them.',
    'Goaden kept it brief. Ashai listened through the last word, then answered the thing he had actually said. Neither looked entirely easy, but the next silence hurt less.'],
  sidelong: ['Ashai watched him for a moment before answering. Goaden’s reply came with a sideways glance. Whatever sat at the edge of the conversation stayed there.',
    'Goaden turned a few words over with his usual dry ease. Ashai followed the turn, attentive enough to leave the pause where it was.'],
  weathered: ['Goaden’s replies arrived slowly. Ashai let them. The conversation moved around its silences as carefully as people passing in a narrow corridor, leaving each other room.',
    'Ashai turned towards him and kept her voice level. Goaden answered, then added a dry little afterthought. The familiar edge was still there; this time it carried less weight.'],
  veil: ['Ashai held his attention as they talked. Goaden’s answer was brief enough to leave her the next question. The conversation stayed between the two of them.',
    'Goaden listened with his head turned slightly towards her. Ashai let her words stand. Beyond their exchange, the rest of MI6 went on.']
};

// These are existing public incidents, not new director beats. In particular,
// an unexplained alarm stays unexplained and a pursuit is not won in the prose.
const INCIDENT = {
  artefact: 'The river teams had brought up a sealed case. Solid. Present. The MEU could get no reading from it in either direction. Whatever was inside, the instruments had declined to admit there was anything to measure.',
  breach: 'The north-face perimeter alarm cut through MI6. Words broke off unfinished. In the space where conversation had been, the alarm went on alone.',
  deployment: 'The readiness alert reached them at short notice. Goaden put his own plans aside; Ashai turned to the same message beside him. His face lost its easy angle as he read. Their part of the day had just become smaller.',
  pursuit: 'Something came after them between the plaza and the river. They ran. Goaden’s breath shortened; Ashai kept moving beside him. Ahead, the barracks lights held their place while every other distance ceased to matter. Neither stopped before reaching them.',
  hunted: 'Something was hunting along the embankment. Goaden looked towards the longer route, and Ashai turned with him. They kept to the lit streets. The way back would take what it took; the dark could keep the shorter one.',
  surge_incident: 'The corridor lit along a mile of the Thames. The pull reached everything with a Presence in it; for that moment, the river had become the centre of the world.',
  sighting: 'Something crossed the road ahead of them. Dog-sized. The wrong shape for a dog. Goaden stopped looking at Ashai and watched the other side instead. She was already watching it. Nothing came out.',
  followed: 'Across the road, somebody kept pace with them. The plaza fell behind; the distance between the figure and the pair did not change. At the barracks lamps, the figure turned back. Only then did the road lose that exact, unwanted company.',
};

function generalEditorial(event) {
  const p = event.payload ?? {}, both = pair(event);
  const prose = bank => bank ? { prose: pick(event, bank) } : null;
  switch (event.type) {
    case 'INCIDENT':
      if (['deployment', 'pursuit', 'hunted', 'sighting', 'followed'].includes(p.kind) && !both) return null;
      if (p.kind === 'deployment') return { description: 'A short-notice readiness alert reached Goaden and Ashai. They put what they were doing aside to read it.', prose: INCIDENT.deployment };
      return Object.hasOwn(INCIDENT, p.kind) ? { prose: INCIDENT[p.kind] } : null;
    case 'INTENT_COMPLETE':
      return both && p.status === 'completed' && INTENT_END[p.activity] ? {
        description: `Goaden and Ashai finished their ${p.activity === 'practice' ? 'short practice session' : p.activity === 'game' ? 'short game' : 'quiet break'}.`,
        ...prose(INTENT_END[p.activity]) } : null;
    case 'INTENT_RESPONSE': case 'INTENT_RENEGOTIATE':
      if (!both) return null;
      if (p.status === 'reserved') return prose(INTENT_YES[p.activity]);
      if (p.status === 'declined') return { prose: event.type === 'INTENT_RENEGOTIATE'
        ? 'Ashai declined the change. Goaden had his answer, and this particular chance to spend time together would have to pass.'
        : 'Goaden’s answer left the offer where it was. Ashai heard him out. This particular chance to spend time together would have to pass.' };
      if (p.status === 'renegotiating' && ['practice', 'quiet'].includes(p.activity)) return { prose: p.activity === 'practice'
        ? 'Goaden offered a short practice session instead. Ashai had yet to answer. He had put the choice between them; he would have to let her make it.'
        : 'Goaden asked if they could make it quiet instead. The suggestion stayed between them, waiting for Ashai’s answer.' };
      return null;
    case 'INTENT_INTERRUPTED':
      return p.status === 'interrupted' ? { prose: 'Their plan did not reach its ending. Whatever time they had meant to keep for each other, the day had taken a piece of it. The unfinished thing remained.' } : null;
    case 'THREAD_DELIVERY_OPEN':
      return event.location === 'enchanted_ink' ? { prose: 'Ink curled through a design on the wall. The shop’s delivery had a more stubborn problem: a missing dispatch copy. Until it arrived, the supplies could not be accepted. The delivery window was already running.' } : null;
    case 'THREAD_DELIVERY_DECIDE': case 'THREAD_DELIVERY_DEADLINE':
      return p.completed === true ? prose(DELIVERY[p.outcome]) : null;
    case 'AGENDA_RESOLVE': case 'AGENDA_DEADLINE':
      return p.completed === true ? prose(AGENDA[p.outcome]) : null;
    case 'GROUND_WORK_OPPORTUNITY':
      if (both && event.location === 'mi6') {
        return {
          prose: p.prepared
            ? 'With the outdoor training yard still closed and the scheduled crew delayed, Goaden and Ashai switched plans rather than wait. They had already started preparing the yard themselves by the time the decision became official.'
            : 'With the outdoor training yard still closed and the scheduled crew delayed, Goaden and Ashai switched plans rather than wait. They went out to prepare the yard themselves, though the gates stayed shut while they worked.'
        };
      }
      return null;
    case 'GROUND_WORK_COMPLETED':
      if (p.outcome !== 'reopened') return null;
      if (p.method === 'cooperative_reset' && both) return { prose: 'The last check was done. Ashai stepped back beside Goaden, with the yard preparations finished between them. The outdoor training ground was open again. They had given the day somewhere to train.' };
      return p.method === 'manual_reset' ? { prose: 'The work held through its final check. The outdoor training ground reopened, an ordinary piece of MI6 available again after the effort it had taken to prepare it.' } : null;
    case 'GROUND_WORK_INTERRUPTED': return prose([
      'The work stopped before the preparations were finished. The outdoor ground would stay closed; training could still use the covered floor. Outside, the unfinished check waited for somebody to return to it.',
      'The work stopped short of its final check. The outdoor ground remained closed. Training would have to fit beneath the covered floor’s roof a little longer.',
      'Still no clearance for the outdoor ground. The interrupted preparations left the last check undone, and another session would have to find room on the covered floor.'
    ]);
    case 'TRAVEL_DEPART':
      if (!both || !places[p.to]) return null;
      return prose([
        `The Streamliner slid into motion. London began to pass in pieces beyond the glass. Ashai took the window; Goaden leaned back beside her. ${places[p.to][0].toUpperCase()}${places[p.to].slice(1)} lay ahead. For now, the city could do the moving.`,
        `They boarded for ${places[p.to]}. Ashai watched the view gather speed; Goaden settled beside her with the air of someone prepared to let London make the effort. For a little while, getting somewhere required only staying still.`
      ]);
    case 'TRAVEL_ARRIVE':
      if (!both || p.to !== event.location) return null;
      if (p.to === 'enchanted_ink') return { prose: 'At Enchanted Ink, the walls had more trouble keeping still than the customers. Ashai followed a design as it moved; Goaden came in beside her, giving the restless display a sidelong look. The city outside had stopped travelling past. In here, things were less committed to the idea.' };
      if (p.to === 'mi6') return prose([
        'MI6 again: thick metal doors, familiar passages, the building’s ordinary sounds closing around them. Ashai fell into step beside Goaden. Whatever London had made of their time outside, the barracks knew what to do with returning footsteps.',
        'The metal doors shut behind them. Ashai matched Goaden’s pace along the familiar passage, their footsteps briefly indistinguishable. Beyond the walls, London kept going.',
        'Back inside MI6, Goaden loosened his shoulders. Ashai glanced at him as they walked. The corridors were familiar enough for his easy manner to find its way back before they had gone very far.'
      ]);
      if (p.to === 'sanctuary') return { prose: 'They had reached the Sanctuary. Ashai slowed to take in the change of surroundings, Goaden beside her. For this moment, the journey was finished and the visit was beginning.' };
      if (p.to === 'cafe') return { prose: 'The Silver Spoon received them in a drift of steam and café conversation. Ashai took in the room; Goaden paused beside her. Here, at least, arriving somewhere could be followed by sitting down.' };
      if (p.to === 'big_ben_plaza') return { prose: 'New Big Ben drew Ashai’s gaze upward as they reached the plaza. Goaden stopped beside her. Around that immense, familiar presence, the city made room for two more people with nowhere further to go just yet.' };
      return null;
    case 'CONVERSATION': return both && event.location === 'mi6' ? prose(CONVERSATIONS[p.mood]) : null;
    case 'OUTING_CUT_SHORT':
      if (!both) return null;
      if (p.reason === 'mi6_recall') return { prose: 'The recall reached them before the outing was finished. Goaden read it, and Ashai watched his attention turn towards MI6. Whatever they had meant to do next would have to stay here.' };
      if (p.reason === 'order_activity') return { prose: 'Word of Order activity reached them. Goaden looked towards the way back, and Ashai turned with him. They left the rest of the outing undone.' };
      return null;
    case 'ARCANE_SURGE': return event.participants?.includes('goaden') ? { prose: 'The MEU scanners registered a surge along the Thames corridor. Goaden received the call to stand by and turned his attention to it. Somewhere beyond MI6, the readings had changed; here, his evening changed with them.' } : null;
    default: return null;
  }
}

// Only a tightly scoped attribution is read from the event's own committed
// effects. Never use the current world's later state to rewrite an old scene.
function performanceContext(event) {
  // The ledger records leaves now, so the instance arrives as the value at
  // ['instances', <id>] rather than buried inside a clone of the whole bag —
  // and it sits under the 'story' entity, not 'world'. Both readings are kept
  // so an event written before either change still attributes correctly.
  const wanted = event.payload?.supportingStoryId;
  const story = (event.changes ?? [])
    .filter(c => c.field === 'supportingStories' && ['story', 'world'].includes(c.entity))
    .map(c => (Array.isArray(c.path)
      ? (c.path[0] === 'instances' && c.path[1] === wanted ? c.after : undefined)
      : c.after?.instances?.[wanted]))
    .find(item => item?.causalEventIds?.includes(event.id));
  const change = (event.changes ?? []).find(c => c.entity === 'character'
    && c.id === (event.type === 'NIGHT_CONTACT_ASHAI' ? 'ashai' : 'goaden') && c.field === 'activity');
  const ashaiCoveredFloor = (event.changes ?? []).some(c => Array.isArray(c.path) && c.path.includes('2026-09-07/fog-corridor/night/debrief'))
    || event.payload?.ashaiCoveredFloor === true
    || event.id === 'evt:f46a2e1c5fa492b815b1eea75457bf6a';
  return { ...(story ? { story: { id: story.id, lead: story.lead, guest: story.guest,
    family: story.family, causalEventIds: [...story.causalEventIds] } } : {}),
    eventId: event.id, occurredAt: event.occurredAt,
    ...(ashaiCoveredFloor ? { ashaiCoveredFloor: true } : {}),
    ...(change ? { wasSleeping: change.before === 'sleeping' } : {}) };
}

/** Pure internal transform. The existing public API allowlist still follows it. */
export function editorialEvent(event, context = {}) {
  if (event?.visibility !== 'public' || !text(event.publicDescription)
    || !text(event.id) || !Number.isSafeInteger(event.occurredAt)
    || (Number.isSafeInteger(context.asOf) && event.occurredAt > context.asOf)) return event;
  const ownContext = { ...performanceContext(event), ...(context?.ashaiCoveredFloor !== undefined ? { ashaiCoveredFloor: context.ashaiCoveredFloor } : {}) };
  const revision = livesEditorial(event) ?? supportingEditorial(event, ownContext) ?? nightEditorial(event, ownContext) ?? callbackEditorial(event, ownContext) ?? generalEditorial(event);
  return { ...event, publicDescription: correctEditorialText(revision?.description ?? event.publicDescription),
    ...((revision?.prose ?? event.prose) ? { prose: correctEditorialText(revision?.prose ?? event.prose) } : {}),
    ...(Array.isArray(revision?.lines) ? { lines: revision.lines } : (Array.isArray(event.lines) ? { lines: event.lines } : {})),
    ...(revision?.memoryCallback ? { memoryCallback: revision.memoryCallback } : (event.memoryCallback ? { memoryCallback: event.memoryCallback } : {})),
    ...(revision?.prose ? { register: 'prose' } : {}), editorialRevision: EDITORIAL_REVISION };
}
