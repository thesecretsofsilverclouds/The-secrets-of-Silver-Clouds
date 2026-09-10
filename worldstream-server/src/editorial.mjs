import { createHash } from 'node:crypto';
import { supportingEditorial } from './editorial-supporting.mjs';
import { nightEditorial } from './editorial-night.mjs';
import { livesEditorial } from './editorial-lives.mjs';
import { callbackEditorial } from './callbacks.mjs';
import { worldEditorial } from './editorial-world.mjs';
import { sceneEditorial } from './editorial-scenes.mjs';
import { sceneBankEditorial } from './scene-bank-presentation.mjs';
import { domesticEditorial } from './editorial-domestic.mjs';

// A new edition of the words, not a new edition of the world. Never called by
// the reducer: event identity, effects, knowledge and the stored scene packet
// are immutable. This also lets old recorded scenes receive copy corrections.
export const EDITORIAL_REVISION = 'silver-clouds-editorial-v5';
export function correctEditorialText(value) {
  return typeof value === 'string' ? value.replaceAll(
    'the street it had left was one street shorter than it should be',
    'the street it had left had one building fewer than it should').replaceAll(
    // The committed surge puts Goaden on call in his quarters. This old
    // reaction invented a second, unrecorded room transition two minutes later.
    'Goaden was out of the lunch hall before the second tone. Whatever it is that answers a surge in him answered this one, and Kai came off his shoulder into the air over the corridor with his scales up.',
    'In the MI6 barracks, whatever it is that answers a surge in Goaden answered this one. Kai came off his shoulder with his scales up.').replaceAll(
    'Only part of the record could be cross-checked. What was checked was fine; what was not remains not.',
    'They had checked only part of the dispatch record. Those entries matched, but the rest still needed comparing. MI6 could not clear the record yet.').replaceAll(
    'The review window closed and the allocation came off the board. Two people got their afternoon back.',
    'The time set aside for the dispatch review had run out. Its staff were released to return to their other work.') : value;
}
const pair = event => ['goaden', 'ashai'].every(id => event.participants?.includes(id));
const pick = (event, choices) => choices[createHash('sha256')
  .update(`silver-clouds-editorial-v3|${event.id}|${event.type}`).digest().readUInt32BE(0) % choices.length];
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
    'They stayed for the final seconds. Afterwards, Ashai sat back and Goaden let his hands go slack. He turned towards her with his mouth already open. She raised an eyebrow and waited.'
  ],
  quiet: [
    'Ashai stirred first. Goaden lifted his head beside her. Footsteps passed outside, followed by the heavy thud of a door. She stretched her fingers, looked at the time and nudged his arm. Their twelve minutes were up.',
    'Goaden shifted and rubbed his palms down his thighs. Ashai looked at the time. They had kept the whole twelve minutes. She drew a breath and sat forward; beside her, he was still working a crease out of his sleeve.'
  ]
};
const INTENT_YES = {
  game: [
    'Goaden agreed to the short game. Ashai held his gaze a moment longer, until he gave her a second, firmer nod.',
    'Goaden agreed to a short game. Ashai smiled at him, then glanced away before he could make anything of it.'
  ],
  practice: [
    'Ashai agreed to practise with him instead. Goaden gave her a questioning look; she held it until he nodded. Practice it was.',
    'Ashai agreed to the short practice session. Goaden nodded and loosened his shoulders. She was still looking at him; he stopped and waited for her to finish.'
  ],
  quiet: [
    'They agreed to sit together for a while. Goaden let his shoulders drop. Ashai watched him settle, then rested her hands in her lap.',
    'They agreed on a quiet break together. Goaden nodded. Ashai looked at the time before settling beside him.'
  ]
};
const DELIVERY = {
  reconciled: [
    'The two dispatch references matched. Enchanted Ink accepted the delivery at last. The supplies that had been held outside the shop’s stock could now be used.',
    'This time, the references agreed. Enchanted Ink accepted the supplies and closed the delivery check. Across the walls, the designs went on shifting.'
  ],
  returned: [
    'The references disagreed. Enchanted Ink returned the delivery; the shop still needed the supplies. A replacement would have to come with a dispatch copy that matched.',
    'The check ended with the same mismatch. The delivery went back, leaving Enchanted Ink waiting for replacement supplies.'
  ],
  missed_window: [
    'The delivery deadline arrived before the missing dispatch copy. Enchanted Ink could accept nothing from this delivery window. The supplies were still outstanding.',
    'The copy had not come. Enchanted Ink closed the delivery entry for that window. The check was over, with the supplies still outstanding.'
  ]
};
const AGENDA = {
  cleared: [
    'The service records matched. MI6 lifted the temporary caution; the work held up by this check could go ahead.',
    'Both service records had been checked against each other. They agreed. MI6 removed the temporary caution.'
  ],
  followup_required: [
    'The service records still disagreed. The review ended with MI6 waiting for a replacement record before anyone could check them again.',
    'There it was again: the same discrepancy. The review ended without clearing it. MI6 would need a replacement record and another check.'
  ],
  unverified: [
    'The service record had not been fully checked. MI6 could not clear it on a partial answer. This review ended unverified, with another check still needed.',
    'The check had ended, but nobody could yet vouch for the whole service record. It would have to be checked again before MI6 could clear it.'
  ]
};
// Stage the selected exchange, not an imaginary conversation inferred from its
// mood. The actual words below do the arguing, joking and refusing. Openings
// may use an object only when those committed words establish it.
function conversationOpening(event) {
  const lines = event.lines ?? event.payload?.lines ?? [];
  const first = lines[0]?.text ?? '';
  const words = lines.map(line => line.text ?? '').join(' ');
  if (first === "It's back, yeah." && words.includes('burn on the shoulder')) return 'Goaden was wearing the repaired jacket. Ashai’s gaze travelled up the sleeve to the shoulder as he turned towards her.';
  if (first === "She's off the critical list, yeah.") return 'Goaden had news about the woman in critical care and the man concerned about her. Ashai looked up as he began.';
  if (first === 'Every time it goes off, you go quiet.') return 'Ashai was watching Goaden. She waited until he looked back before she spoke.';
  if (first === "You didn't message.") return 'Ashai faced Goaden. He glanced at her, then held still as she spoke.';
  if (/That isn't a tear any more/.test(first)) return 'The lining hung out of Goaden’s cuff. Ashai looked down at it, then up at him.';
  if (/You always sit where you can see the door/.test(first)) return 'Goaden had the door in view. Ashai followed his glance before turning back to him.';
  if (/lights on the east corridor still flicker/.test(first)) return 'Ashai glanced towards the east corridor. The faulty lights had been bothering her for a week.';
  if (/You've (?:been up since five|had a long night)/.test(first)) return 'Goaden looked Ashai over, his own fatigue doing very little to recommend him as a judge.';
  if (/Long one\./.test(first)) return 'Goaden rubbed a hand over his face and looked across at Ashai.';
  if (/lining|cuff/.test(words) && /jacket/i.test(words)) return 'Ashai’s attention settled on Goaden’s jacket. He noticed the look.';
  // The barracks common spaces are manuscript setting, not a later world
  // snapshot. Keep other rooms and unknown speakers free of invented props.
  if (event.room === 'the lunch hall' || ['common_room', 'lunch_hall'].includes(event.area)) return lines[0]?.who === 'ashai'
    ? 'Soldiers talked across the lunch hall. Ashai leaned towards Goaden to speak.'
    : 'Soldiers talked across the lunch hall. Goaden turned towards Ashai to speak.';
  if (event.room === 'the gaming area' || ['gaming_room', 'gaming_area'].includes(event.area)) return 'Noise from the gaming area filled the pause between Goaden and Ashai.';
  return lines[0]?.who === 'ashai' ? 'Ashai turned towards Goaden.' : 'Goaden glanced across at Ashai.';
}

// These are existing public incidents, not new director beats. In particular,
// an unexplained alarm stays unexplained and a pursuit is not won in the prose.
const INCIDENT = {
  artefact: 'The river teams had brought up a sealed case. The MEU scanners registered nothing from it. Not a weak reading. Nothing. There was a solid object in front of them and no way, yet, to tell what was inside.',
  breach: 'The north-face perimeter alarm cut through MI6. Words broke off unfinished. In the space where conversation had been, the alarm went on alone.',
  deployment: 'The readiness alert cut into Goaden and Ashai’s plans. Both stopped to read it. Goaden’s half-smile disappeared as his eyes moved over the message; Ashai was already paying attention. MI6 wanted them ready at short notice.',
  pursuit: 'Something came after them between the plaza and the river. They ran. Goaden’s breath shortened; Ashai kept moving beside him. Ahead, the barracks lights held their place while every other distance ceased to matter. Neither stopped before reaching them.',
  hunted: 'Something was hunting along the embankment. Goaden looked towards the longer route, and Ashai turned with him. They kept to the lit streets. It meant more walking, but neither suggested taking the shortcut.',
  surge_incident: 'The corridor lit along a mile of the Thames. The pull reached everything with a Presence in it; for that moment, the river had become the centre of the world.',
  sighting: 'Something crossed the road ahead of Goaden and Ashai. About the size of a dog. It was the shape that was wrong. Goaden stopped looking at her and watched the far side of the road. Ashai was already watching it. Nothing came back out.',
  followed: 'Across the road, somebody kept pace with them. The plaza fell behind; the distance between the figure and the pair did not change. At the barracks lamps, the figure turned back. Only then did the road lose that exact, unwanted company.',
};

function generalEditorial(event) {
  const p = event.payload ?? {}, both = pair(event);
  const prose = bank => bank ? { prose: pick(event, bank) } : null;
  switch (event.type) {
    case 'ANNOUNCE_ARRANGEMENT':
      return both && event.publicDescription === "Goaden and Ashai took up Yukon's challenge in the MI6 gaming room."
        ? { description: 'Goaden and Ashai agreed to take up Yukon’s challenge in the gaming room later.' } : null;
    case 'GAME_RESUME':
      return both && event.location === 'mi6' && [
        'Goaden and Ashai resumed their game.', 'Goaden and Ashai started a game.',
        'A game went on between them for longer than either meant it to.'
      ].includes(event.publicDescription)
        ? { description: 'Goaden and Ashai returned to their unfinished game. Ashai leaned towards the screen as Goaden settled beside her.' } : null;
    case 'INCIDENT':
      if (['deployment', 'pursuit', 'hunted', 'sighting', 'followed'].includes(p.kind) && !both) return null;
      if (p.kind === 'deployment') return { description: 'A short-notice readiness alert reached Goaden and Ashai. They put what they were doing aside to read it.', prose: INCIDENT.deployment };
      return Object.hasOwn(INCIDENT, p.kind) ? { prose: INCIDENT[p.kind] } : null;
    case 'INTENT_COMPLETE':
      return both && p.status === 'completed' && INTENT_END[p.activity] ? {
        description: `Goaden and Ashai finished their ${p.activity === 'practice' ? 'short practice session' : p.activity === 'game' ? 'short game' : 'quiet break'}.`,
        ...prose(INTENT_END[p.activity]) } : null;
    case 'INTENT_RESPONSE': case 'INTENT_RENEGOTIATE':
      if (/offer lapsed before/.test(event.publicDescription)) return { prose: 'The time for the offer passed before they could agree. Neither had committed to the session.' };
      if (!both) return null;
      // Recorded dialogue carries the answer. Set up the exchange without
      // announcing an acceptance or refusal before the character can give it.
      if ((event.lines ?? p.lines)?.length && ['reserved', 'declined'].includes(p.status)) return { prose:
        (event.lines ?? p.lines)[0].who === 'ashai' ? 'Ashai held Goaden’s attention for another moment.' : 'Goaden turned towards Ashai. She waited for his answer.' };
      if (p.status === 'reserved') return prose(INTENT_YES[p.activity]);
      if (p.status === 'declined') return { prose: event.type === 'INTENT_RENEGOTIATE'
        ? 'Ashai declined the change. Goaden gave a short nod. They would leave that time free.'
        : 'Goaden declined the offer. Ashai heard him out, then nodded. They would leave that time free.' };
      if (p.status === 'renegotiating' && ['practice', 'quiet'].includes(p.activity)) return { prose: p.activity === 'practice'
        ? 'Goaden suggested a short practice session instead. Ashai looked at him. He waited for her answer.'
        : 'Goaden asked if they could make it a quiet break instead. He let the question stand while Ashai considered him.' };
      return null;
    case 'INTENT_INTERRUPTED': {
      const activity = { game: 'game', practice: 'practice session', quiet: 'quiet break' }[p.activity];
      return p.status === 'interrupted' && activity ? { prose: `The time Goaden and Ashai had set aside for their ${activity} was no longer available. The session remained unfinished.` } : null;
    }
    case 'THREAD_DELIVERY_OPEN':
      return event.location === 'enchanted_ink' ? { prose: 'Enchanted Ink’s supplies had arrived without the dispatch copy needed to accept them. The delivery window was already running. Until the missing copy arrived, the shop could do nothing with them.' } : null;
    case 'THREAD_DELIVERY_DECIDE': case 'THREAD_DELIVERY_DEADLINE':
      return p.completed === true ? prose(DELIVERY[p.outcome]) : null;
    case 'AGENDA_RESOLVE': case 'AGENDA_DEADLINE':
      return p.completed === true ? prose(AGENDA[p.outcome]) : null;
    case 'AGENDA_OPERATION_START': {
      const names = { davis: 'Agent Davis', zara: 'Zara', henderson: 'General Henderson' };
      if (!Array.isArray(p.team) || !p.team.length || p.team.some(id => !names[id])) return null;
      return { prose: `MI6 assigned ${p.team.map(id => names[id]).join(' and ')} to compare the dispatch records before handover. The copies had to be checked against each other; until then, the review could not be cleared.` };
    }
    case 'GROUND_WORK_OPPORTUNITY':
      if (event.location === 'mi6' && event.participants?.length
        && event.participants.every(id => ['goaden', 'ashai'].includes(id))) {
        const workers = event.participants.map(id => id === 'goaden' ? 'Goaden' : 'Ashai').join(' and ');
        return { prose: p.resumed
          ? `${workers} returned to the unfinished work in the outdoor yard. The ground was still closed; the remaining checks had to be finished before training could resume there.`
          : p.prepared
            ? `The preliminary checks were complete. ${workers} began the remaining work in the outdoor yard. Training would stay on the covered floor until the ground was ready.`
            : `${workers} began work on the closed outdoor yard. The safety checks and preparations still had to be done; training continued on the covered floor.` };
      }
      return null;
    case 'GROUND_WORK_COMPLETED':
      if (p.outcome !== 'reopened') return null;
      if (p.method === 'cooperative_reset' && both) return { prose: 'The last check was done. Ashai stepped back beside Goaden, with the yard preparations finished between them. The outdoor training ground was open again.' };
      return p.method === 'manual_reset' ? { prose: 'The outdoor yard passed its final check. Training could move outside again; the ground was ready.' } : null;
    case 'GROUND_WORK_INTERRUPTED': return prose([
      'The work stopped before the preparations were finished. The outdoor ground would stay closed; training could still use the covered floor. Outside, the unfinished check waited for somebody to return to it.',
      'The work stopped short of its final check. The outdoor ground remained closed. Training would have to fit beneath the covered floor’s roof a little longer.',
      'Still no clearance for the outdoor ground. The interrupted preparations left the last check undone, and another session would have to find room on the covered floor.'
    ]);
    case 'TRAVEL_DEPART':
      if (!both || !places[p.to]) return null;
      return prose([
        `The Streamliner slid into motion, carrying them towards ${places[p.to]}. Ashai turned to the window. Goaden leaned back beside her as London began to pass beyond the glass.`,
        `They boarded the Streamliner for ${places[p.to]}. Goaden settled beside Ashai. She braced a hand as the carriage moved, then leaned towards the window.`
      ]);
    case 'TRAVEL_ARRIVE':
      if (!both || p.to !== event.location) return null;
      if (p.to === 'enchanted_ink') return { prose: 'Ashai stepped into Enchanted Ink and stopped to follow a design across the wall. It kept moving after she did. Goaden came in beside her, turning his head to watch it go.' };
      if (p.to === 'mi6') return prose([
        'The thick metal doors of MI6 closed behind them. Goaden slowed to let Ashai catch up, and they walked on together. Voices carried from further along the passage.',
        'The metal doors shut behind them. Ashai matched Goaden’s pace along the familiar passage, their footsteps briefly indistinguishable. Beyond the walls, London kept going.',
        'Back inside MI6, Goaden loosened his shoulders. Ashai glanced at him as they walked, then turned towards the conversation further along the corridor.'
      ]);
      if (p.to === 'sanctuary') return { prose: 'They reached the Sanctuary. Ashai slowed and looked around, Goaden stopping beside her. She turned back to him before they went further.' };
      if (p.to === 'cafe') return { prose: 'Steam rose behind the counter at the Silver Spoon. Ashai stepped inside and looked for somewhere to sit. Goaden followed her gaze across the occupied tables.' };
      if (p.to === 'big_ben_plaza') return { prose: 'At the plaza, Ashai tipped her head back to look up at New Big Ben. Goaden stopped beside her. People passed around them while she followed the structure upwards.' };
      return null;
    case 'CONVERSATION': return both && event.location === 'mi6' && (event.lines?.length || p.lines?.length) ? { prose: conversationOpening(event) } : null;
    case 'PLAN_BROKEN': return event.publicDescription === 'An MI6 callout broke the evening Goaden and Ashai had arranged at Sanctuary.'
      ? { prose: 'The MI6 callout arrived before they could leave for the Sanctuary. Their evening there was off. The invitation was still valid; they could no longer use the time they had arranged for it.' } : null;
    case 'INVITATION_ACCEPTED': {
      const who = ['goaden', 'ashai'].find(id => event.participants?.includes(id)
        && event.publicDescription === `${id === 'goaden' ? 'Goaden' : 'Ashai'} received a Sanctuary guest invitation.`);
      return who ? { prose: `${who === 'goaden' ? 'Goaden' : 'Ashai'} received a guest invitation to the Sanctuary. The invitation was accepted; a visit still had to be arranged.` } : null;
    }
    case 'OUTING_CUT_SHORT':
      if (!both) return null;
      if (p.reason === 'mi6_recall') return { prose: 'The recall reached them before the outing was finished. Goaden read it, and Ashai watched his attention turn towards MI6. Whatever they had meant to do next would have to stay here.' };
      if (p.reason === 'order_activity') return { prose: 'Word of Order activity reached them. Goaden looked towards the way back, and Ashai turned with him. They left the rest of the outing undone.' };
      return null;
    case 'ARCANE_SURGE': return event.participants?.includes('goaden') ? { prose: 'The MEU scanners picked up a surge along the Thames. Goaden was called to stand by. He stopped what he was doing and read the alert, his attention fixed on the change in the readings. For now, the order was to wait.' } : null;
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
  const revision = sceneBankEditorial(event) ?? livesEditorial(event) ?? supportingEditorial(event, ownContext) ?? nightEditorial(event, ownContext) ?? callbackEditorial(event, ownContext) ?? worldEditorial(event) ?? sceneEditorial(event) ?? generalEditorial(event) ?? domesticEditorial(event);
  return { ...event, publicDescription: correctEditorialText(revision?.description ?? event.publicDescription),
    ...((revision?.prose ?? event.prose) ? { prose: correctEditorialText(revision?.prose ?? event.prose) } : {}),
    ...(Array.isArray(revision?.lines) ? { lines: revision.lines } : (Array.isArray(event.lines) ? { lines: event.lines } : {})),
    ...(revision?.memoryCallback ? { memoryCallback: revision.memoryCallback } : (event.memoryCallback ? { memoryCallback: event.memoryCallback } : {})),
    ...(revision?.prose ? { register: 'prose' } : {}), editorialRevision: EDITORIAL_REVISION };
}
