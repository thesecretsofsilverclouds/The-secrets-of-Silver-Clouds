import { createHash } from 'node:crypto';

// Read-side performance only. No facts, actions, dialogue, world writes or clocks.
// Existing event family supplies the subject; its outcome supplies the ending.
// Incidental posture/attention may stage that event but cannot grant an answer,
// a game win, another appointment, forgiveness, authority, or future knowledge.
// Canon priority: manuscript.pdf > canon text > site, with PHASE0-CONTINUITY's
// named Legion/Zara exceptions and the existing pre-revelation knowledge locks.
// Performance anchors in canon/manuscript_indexed.txt:
// P00163 Kai's shoulder/weight; P00520 Greah's soft glow; P00479 Yukon gaming;
// P00382 Henderson; P00495 Hammond's silence; P00669 Davis's measured warmth;
// P00728 Emily's sunny delivery; P00788-798 Legion; P01779-786 reunion gestures.
// These anchors inform cadence, not additional events or imported memories.

const TYPES = new Set(['SUPPORTING_COMMITMENT', 'SUPPORTING_ENCOUNTER',
  'SUPPORTING_OUTCOME', 'SUPPORTING_DEADLINE', 'SUPPORTING_CALLBACK']);
const OUTCOMES = new Set(['kept', 'missed', 'cut_short']);
const LEADS = Object.freeze({ goaden: 'Goaden', ashai: 'Ashai' });
const pick = (event, stage, choices) => choices[createHash('sha256')
  .update(`supporting-editorial-v2|${event.id}|${stage}`).digest().readUInt32BE(0) % choices.length];

// All family strings are already authored in supporting-stories.mjs. Unknown
// families are refused rather than interpolated into public copy.
const BANK = {
  'another attempt': {
    guest: 'yukon', name: 'Yukon', subject: 'the game attempt',
    request: n => `${n} agreed to keep Yukon company for another attempt at the game.`,
    begin: n => `${n} joined Yukon for the next attempt.`,
    end: n => `${n} stayed with Yukon through the end of the game attempt.`,
    opening: n => [
      `Yukon wanted another attempt. Of course he did. ${n === 'Goaden' ? 'Goaden agreed to watch, wearing the expression of a man expecting to be entertained for entirely the wrong reasons.' : 'Ashai agreed to watch. Yukon’s pointed ears did nothing to soften the determination beneath them.'}`,
      `The game had acquired an enemy in Yukon. ${n} agreed to keep him company for another attempt; whether the company would improve his temper remained an open question.`],
    middle: n => [
      `Yukon leaned so far towards the game that posture alone ought to have helped. ${n === 'Goaden' ? 'Goaden settled back. Between them, they made one reasonably seated person.' : 'Ashai watched his hands, then his face. Both were making a considerable effort.'}`,
      `Another attempt began. Yukon’s jaw worked; the rest of him followed the game in small, furious movements. ${n === 'Goaden' ? 'Goaden watched with an interest he was careful not to make encouraging.' : 'Ashai gave him the courtesy of keeping her amusement to herself.'}`],
    ending: n => [
      `Yukon’s hands went still. The game attempt was over. ${n === 'Goaden' ? 'Goaden remained beside him, one eyebrow already prepared for whatever explanation came next.' : 'Ashai turned from the game to its much more expressive player. She had stayed for the ending; now he had someone to look at.'}`,
      `The last seconds ran out and Yukon sat back at last. ${n === 'Goaden' ? 'Goaden gave him a sideways look. The game might be finished, but his expression suggested that the entertainment had possibilities yet.' : 'Ashai stayed beside him as the tension went out of his hands. For once, the end of a game attempt did not leave him talking to the game alone.'}`],
  },
  'a timing question': {
    guest: 'henderson', name: 'General Henderson', subject: 'the timing question',
    request: n => `${n} agreed to help General Henderson settle a question of timing.`,
    begin: n => `${n} and General Henderson turned to the timing question.`,
    end: n => `${n} and General Henderson settled the timing question.`,
    opening: n => [
      `Henderson stopped over a question of timing. ${n === 'Goaden' ? 'Goaden’s shoulders kept their customary slouch; his eyes were already on the General.' : 'Ashai turned to him, ready to hear the particulars before she supplied an answer.'} The rounds could wait for this.`,
      `One timing question before the General moved on. ${n} agreed to help, and Henderson gave the matter the blunt, practical shape of something that could actually be answered.`],
    middle: n => [
      `Henderson went through the timing question with ${n}. No grand problem, no grand speech. ${n === 'Goaden' ? 'Goaden’s easy manner remained; the answer beneath it took more care.' : 'Ashai followed the sequence, holding each part against the one before it.'}`,
      `The General brought the question back to its practical point. ${n === 'Goaden' ? 'Goaden inclined his head. For all the unhurried air, he was listening.' : 'Ashai stayed with the detail until it became clear what Henderson needed from her.'}`],
    ending: n => [
      `Henderson nodded once. That settled the timing question. ${n === 'Goaden' ? 'Goaden’s shoulders eased into their usual angle, as if they had never straightened.' : 'Ashai let out the breath she had been holding over the detail.'} Nothing more elaborate was required.`,
      `The answer gave Henderson somewhere to leave the question. ${n} stayed until he had it, then watched the General’s gaze move on. A small matter, settled properly; MI6 was built of more of those than it cared to admit.`],
  },
  'a handover interval': {
    guest: 'davis', name: 'Agent Davis', subject: 'the pause between handovers',
    request: n => `${n} agreed to spend a few minutes with Agent Davis between handovers.`,
    begin: n => `${n} joined Agent Davis during her break between handovers.`,
    end: n => `${n} and Agent Davis shared the few minutes between handovers.`,
    opening: n => [
      `Davis had a break between handovers. ${n} accepted her company. Her smile arrived neat and measured, as though even an idle moment deserved to be properly received.`,
      `For once, the next handover did not need Davis yet. ${n} agreed to stay with her. She turned from the work with a composed smile; ${n === 'Goaden' ? 'he brought rather less ceremony to the occasion.' : 'Ashai met it without borrowing its careful shape.'}`],
    middle: n => [
      `Davis let the silence last before filling it. ${n === 'Goaden' ? 'Goaden matched her composed smile with something considerably less polished.' : 'Ashai watched the minute shifts of her expression, answering the person behind the practised warmth.'} The next handover had yet to claim either of them.`,
      `${n === 'Goaden' ? 'Goaden sat as though no one had ever taught him to look busy. Davis’s composure survived the comparison.' : 'Ashai settled beside Davis. Away from the handover, a lowered voice could be heard without leaning towards a screen.'} They had this much of the day to themselves.`],
    ending: n => [
      `Davis checked the time. ${n} had stayed through the break, and for a moment her gaze remained with ${n === 'Goaden' ? 'him' : 'her'} instead of following the next handover. Then the familiar composure settled back into place.`,
      `The break ended. Davis gave ${n} the last of it before turning back to the work, a final glance where another instruction might have gone.`],
  },
  'a quiet seat': {
    guest: 'kartel', name: 'Captain Hammond', subject: 'the quiet at Hammond’s table', recallSubject: 'the quiet at the table',
    request: n => `${n} accepted the quiet seat Captain Hammond made room for.`,
    begin: n => `${n} sat with Captain Hammond.`,
    end: n => `${n} stayed with Captain Hammond through the quiet pause.`,
    opening: n => [
      `Hammond made room at the table. ${n} accepted. The invitation had needed no voice.`,
      `There was space at Hammond's table, and ${n} agreed to take it. He had offered it without saying a word.`],
    middle: n => [
      `${n} sat opposite Hammond. The Captain’s scar caught the light when he lifted his face; his silence needed no explanation. ${n === 'Goaden' ? 'Goaden leaned back, resisting the obvious temptation to be the entire conversation.' : 'Ashai settled her hands and let the quiet keep its shape.'}`,
      `At Hammond’s table, ${n === 'Goaden' ? 'Goaden discovered that a raised eyebrow could go unanswered indefinitely.' : 'Ashai found no demand to turn a comfortable silence into conversation.'} The Captain sat opposite, perfectly content with the arrangement.`],
    ending: n => [
      `When ${n} stirred, Hammond looked up. They had shared the table without a word from him. ${n === 'Goaden' ? 'Goaden answered the glance with a tilt of his head. An unusually economical conversation, even for him.' : 'Ashai returned the glance. There had been company here all the same.'}`,
      `Hammond’s gaze lifted as their time at the table ended. ${n} had stayed with him through the quiet. No parting speech followed; the Captain had a certain advantage there.`],
  },
  'time with Kai': {
    guest: 'kai', name: 'Kai', owner: 'goaden', subject: 'the quiet with Kai',
    request: () => 'Goaden made time to be still with Kai.',
    begin: () => 'Goaden settled into a quiet moment with Kai close by.',
    end: () => 'Goaden and Kai had their few quiet minutes together.',
    opening: () => [
      'Kai shifted against him, warm and solid for so small a dragon. Goaden stopped. Whatever else wanted him could endure a few minutes of being wanted back less urgently.',
      'Goaden made time to be still. Kai was already there, silver and black, requiring no invitation and making no apology for his weight.'],
    middle: () => [
      'Kai adjusted himself with the solemn care of something much larger. Goaden held still until the dragon was satisfied. It was remarkable how much negotiation could take place without a word.',
      'One slow blink from Kai. Goaden answered it with his own. The small dragon remained warm against him, unimpressed by whatever hurry governed the rest of London.'],
    ending: () => [
      'Goaden stirred at last. Kai’s weight shifted with him, the dragon still settled close. Nothing spectacular had happened; for those few minutes, nothing had needed to.',
      'The quiet ended with Kai still warm against him. Goaden moved carefully before resuming his usual careless air. The dragon had been there for both.'],
  },
  'time with Greah': {
    guest: 'greah', name: 'Greah', owner: 'ashai', subject: 'the quiet with Greah',
    request: () => 'Ashai made room for a quieter moment with Greah.',
    begin: () => 'Ashai paused with Greah close by.',
    end: () => 'Ashai and Greah had their few quiet minutes together.',
    opening: () => [
      'Greah hovered close enough to colour the edge of Ashai’s hand with light. Ashai stopped for her. The day could ask its next question in a moment.',
      'Ashai made time for Greah, who had been close all along. Without the hurry, the flutter of those wings became something she could notice again.'],
    middle: () => [
      'Greah’s wings made small corrections in the air. Ashai watched their quick, delicate work, her face softened by the light. For a while, the world was allowed to be this near.',
      'Ashai held still as Greah hovered beside her. A tremor of wings, a steady glow. Familiar things, given back their detail when no one was hurrying.'],
    ending: () => [
      'Ashai looked up at last. Greah remained close, her glow unchanged; the rest of the day returned by degrees around that small certainty.',
      'When Ashai moved again, Greah moved with her. Their quiet had lasted to its end. The flutter of wings accompanied the first ordinary movement afterwards.'],
  },
  'a little quiet': {
    guest: 'rose', name: 'Rose', subject: 'the quiet with Rose', recallSubject: 'their earlier quiet',
    request: n => `${n} agreed to a few quieter minutes with Rose.`,
    begin: n => `${n} joined Rose for a little quiet.`,
    end: n => `${n} and Rose let their quiet pause last.`,
    opening: n => [
      `Rose wanted quiet. ${n === 'Goaden' ? 'Goaden agreed with a brevity that ought to have reassured her.' : 'Ashai agreed, and let that be the whole answer.'} Rose had spent very few words acquiring it.`,
      `There was room beside Rose, and ${n} agreed to take it quietly. It was a simple arrangement. She looked prepared to enforce the simple part.`],
    middle: n => [
      `${n === 'Goaden' ? 'Goaden opened his mouth, reconsidered, and settled back. Rose’s glance took in the entire operation.' : 'Ashai settled beside Rose. Neither reached for a subject simply because there was room for one.'} The quiet survived.`,
      `Rose sat with ${n}, economical even in stillness. ${n === 'Goaden' ? 'He gave her the courtesy of leaving an obvious joke alone. For now.' : 'Ashai let her gaze wander without asking Rose to follow it.'}`],
    ending: n => [
      `Rose’s smallest nod marked the end. ${n} had let the quiet last. ${n === 'Goaden' ? 'He looked mildly pleased with his own restraint; she declined to reward the expression.' : 'Ashai returned the nod, carrying no unfinished conversation away from it.'}`,
      `When ${n} stirred, Rose looked over. They had reached the end without filling it with talk. She managed to make that seem like the least surprising achievement in the world.`],
  },
  'a shorter rhythm': {
    guest: 'anarchy', name: 'Anarchy', bodyPair: true, subject: 'the short rhythm',
    request: n => `${n} agreed to listen to Anarchy’s short rhythm.`,
    begin: n => `Anarchy began the rhythm for ${n}, with Balthazar present through him.`,
    end: n => `${n} heard Anarchy’s rhythm through to its end.`,
    opening: n => [
      `Anarchy had a short rhythm for ${n}. Short was the ambitious part. Balthazar’s presence shared the same body, lending the occasion rather more dignity than its owner seemed likely to need.`,
      `A short rhythm. ${n} agreed to listen, and Anarchy made even that modest arrangement look like the opening of a show. Balthazar remained present through him: two presences, one body, considerable scope for disagreement.`],
    middle: n => [
      `The rhythm began small. Anarchy’s commitment to it did not. ${n} listened as the beat gathered its shape, Balthazar present through that same body, a second dignity sharing the first man’s momentum.`,
      `Anarchy put his whole frame into the rhythm. ${n} watched with an expression deliberately short of awe. Through the same body, Balthazar supplied the impression that this, too, was a matter deserving grave consideration.`],
    ending: n => [
      `Anarchy stopped on the last beat. ${n} was still there to hear the silence it left. Balthazar remained present in the same body; for once, the two presences had reached a stopping place at exactly the same time.`,
      `The short rhythm reached its end. ${n} looked at Anarchy, whose whole body seemed to retain the next beat without making it. Balthazar shared that same body. Between all three of them, the silence had an interesting amount of company.`],
  },
  'an end to the argument': {
    guest: 'balthazar', name: 'Balthazar', bodyPair: true, subject: 'the argument about timing',
    request: n => `${n} agreed to stay while Balthazar brought the small argument about timing to a close.`,
    begin: n => `${n} listened as Balthazar, present through Anarchy, returned to the timing argument.`,
    end: n => `The timing argument ended with ${n} still there to hear it.`,
    opening: n => [
      `Balthazar wanted the timing argument settled. Through Anarchy, he approached this minor dispute with the bearing of someone receiving a difficult embassy. ${n} agreed to stay.`,
      `Two presences, one body, and a disagreement about timing. Balthazar wanted an ending; ${n} agreed to hear it. Anarchy provided the body in which the matter would have to be settled.`],
    middle: n => [
      `${n} listened. Balthazar’s patience and Anarchy’s momentum pulled at the timing argument from within the same body. It gave even the smallest hesitation an unusual amount of personality.`,
      `Balthazar returned to the point with polished gravity. ${n} kept his face reasonably straight. Anarchy occupied the same body as that elaborate patience, which made the argument about timing rather less abstract than it might have been.`],
    ending: n => [
      `The timing argument ended. ${n} let a beat pass, wisely declining to supply another point. Anarchy and Balthazar occupied the silence together, just as they occupied the same body.`,
      `At last, neither side of the timing argument added anything. ${n} was still there to witness it. The two presences in one body had achieved a silence so exact that commenting on it seemed dangerous.`],
  },
  'one short verse': {
    guest: 'gabriel', name: 'Gabriel', subject: 'the verse',
    request: n => `${n} agreed to listen to a verse whose timing Gabriel wanted an opinion on.`,
    begin: n => `Gabriel began the verse for ${n}.`,
    end: n => `${n} heard Gabriel’s verse to its end.`,
    opening: n => [
      `Gabriel wanted an opinion on the verse’s timing. ${n} agreed to listen. He straightened as though the audience had been larger when he last counted it.`,
      `One verse. An opinion on the timing. ${n} agreed to that much, and Gabriel received the agreement with all the ceremony a private performance could bear.`],
    middle: n => [
      `Gabriel began the verse. Every turn of it received the full benefit of being performed by Gabriel. ${n === 'Goaden' ? 'Goaden listened with the infuriating calm of an audience determined to remain one person.' : 'Ashai followed the rhythm, her gaze steady enough to make the performance work for its effect.'}`,
      `The verse rose and turned. Gabriel carried it as though any hesitation might be mistaken for a lack of conviction. ${n === 'Goaden' ? 'Goaden’s face supplied him with very little assistance.' : 'Ashai listened past the flourish to the timing he had asked about.'}`],
    ending: n => [
      `The verse ended. Gabriel looked at ${n}. For someone who had asked only about the timing, he made a remarkable amount of room for a verdict. ${n} had heard every word.`,
      `Gabriel held the last beat, then let it fall. ${n} was still there. The whole verse had reached its audience; what the audience made of it was another matter, and Gabriel’s face made clear that he had noticed the distinction.`],
  },
  'a few minutes together': {
    guest: 'truth', name: 'Truth', subject: 'the time with Truth', recallSubject: 'their earlier conversation',
    request: n => `${n} agreed to spend a few unhurried minutes with Truth.`,
    begin: n => `${n} joined Truth for the few minutes they had set aside.`,
    end: n => `${n} stayed with Truth through their time together.`,
    opening: n => [
      `Truth wanted company. ${n} agreed, and the request somehow seemed louder for having been so easily granted. Even a few minutes received his wholehearted commitment.`,
      `${n} had time for Truth. He accepted that simple kindness with the force he brought to everything, as though the day ought to make room and be pleased about it.`],
    middle: n => [
      `Truth gave the conversation his whole voice. ${n === 'Goaden' ? 'Goaden answered from somewhere considerably lower on the volume scale. The contrast did neither man any harm.' : 'Ashai met that enormous conviction with a level look, warm enough to take the force of it.'}`,
      `${n} stayed with Truth, whose idea of an ordinary exchange still had room for declarations. ${n === 'Goaden' ? 'Goaden’s dry replies made small punctures in the grandeur.' : 'Ashai let the emphasis pass before placing her answer exactly where it belonged.'}`],
    ending: n => [
      `Truth brought their time together to its end with the same conviction he had brought to its beginning. ${n} had stayed through all of it. The air afterwards seemed to be recovering its ordinary dimensions.`,
      `The last words landed. ${n} was still with Truth, who had given a brief conversation enough force to carry across a much larger room. There was an unexpected gentleness in having been included so completely.`],
  },
  'a cautious pause': {
    guest: 'emily', name: 'Emily', subject: 'the pause with Emily', recallSubject: 'their earlier pause',
    request: n => `${n} agreed to stay nearby while Emily looked around a little longer.`,
    begin: n => `${n} stayed near Emily as she looked around.`,
    end: n => `${n} stayed nearby until Emily’s short pause was over.`,
    opening: n => [
      `Emily wanted to look a little longer. ${n} agreed to remain nearby. She smiled as though the place had told her something amusing; she supplied no explanation.`,
      `A little longer. Emily made the request lightly, and ${n} agreed to stay. Her gaze had already wandered elsewhere by the time the answer was given.`],
    middle: n => [
      `Emily tilted her head at something ${n === 'Goaden' ? 'Goaden' : 'Ashai'} could also see without learning what she found in it. The smile remained. ${n === 'Goaden' ? 'He stayed nearby, giving her very little of his face in return.' : 'Ashai stayed nearby, letting the unanswered question remain unanswered.'}`,
      `${n} remained close while Emily looked around. Her expression brightened, settled, brightened again. It was like watching someone enjoy a joke whose beginning had never reached the room.`],
    ending: n => [
      `Emily finished looking. ${n} was still nearby, no better supplied with an explanation for her smile. The interval had ended neatly. The feeling of it was less obliging.`,
      `${n} stayed until the pause was over. Emily’s gaze moved on, cheerful as ever. Nothing had been explained by spending longer in her company.`],
  },
  'an unhurried interval': {
    guest: 'zara', name: 'Zara', subject: 'the pause with Zara', recallSubject: 'their earlier pause',
    request: n => `${n} agreed to spend Zara’s free few minutes with her.`,
    begin: n => `${n} joined Zara for a pause between pieces of work.`,
    end: n => `${n} and Zara had their few minutes free of work.`,
    opening: n => [
      `Zara was free for a few minutes. ${n} agreed to spend them with her. She announced the freedom briskly enough to make it sound like another assignment.`,
      `Work had released Zara, briefly. ${n} accepted her company before it could change its mind. Even the way she settled herself had the precision of someone accustomed to being needed elsewhere.`],
    middle: n => [
      `Zara checked the time, caught herself, and looked back at ${n}. ${n === 'Goaden' ? 'His expression suggested that he had enjoyed the entire manoeuvre.' : 'Ashai’s mouth curved; she let the observation stand without help.'} For now, there was no work between them.`,
      `${n === 'Goaden' ? 'Goaden made himself comfortable with a lack of urgency that Zara could have studied professionally.' : 'Ashai let Zara finish settling before drawing her into the quieter rhythm of the break.'} Work remained outside the exchange, where they had put it.`],
    ending: n => [
      `This time, Zara could check the clock without catching herself. The break was over. ${n} had stayed through it, and work had managed perfectly well without entering their conversation.`,
      `Zara straightened, briskness returning to her shoulders. ${n} had given her company through the whole break. The work would have her back; it had not had every minute.`],
  },
};

function historicalLead(event, story, entry) {
  // This is identity attribution for an already public failure, never a way to
  // place an absent actor into a scene or import today's result into yesterday.
  if (!story || story.id !== event.payload.supportingStoryId || story.family !== event.payload.family
    || story.guest !== entry.guest || !Array.isArray(story.causalEventIds)
    || !story.causalEventIds.includes(event.id) || !LEADS[story.lead]) return null;
  return story.lead;
}

function failure(event, entry, lead, outcome) {
  const pair = lead ? `${LEADS[lead]} and ${entry.name}` : null;
  if (entry.owner) {
    const n = LEADS[entry.owner];
    return outcome === 'missed' ? {
      description: `${n}'s planned quiet with ${entry.name} never began.`,
      prose: pick(event, 'missed', [
        `The few quiet minutes ${n} had meant to give ${entry.name} did not happen. The pause remained something there had been no room for.`,
        `${n} had meant to stop for a little while with ${entry.name}. That small space in the day never opened.`]),
    } : {
      description: `${n}'s quiet with ${entry.name} was cut short.`,
      prose: pick(event, 'cut_short', [
        `There had been a little stillness with ${entry.name}, but less than ${n} had set aside. The pause ended before its time.`,
        `${n} had stopped with ${entry.name} for a while. Their quiet was interrupted before those few minutes were through.`]),
    };
  }
  return outcome === 'missed' ? {
    description: pair ? `${pair} never began ${entry.subject}.` : `The planned time with ${entry.name} did not happen.`,
    prose: pick(event, 'missed', [
      `There had been room in the plan for ${entry.subject}. In the day itself, that space never opened.`,
      `The chance to begin ${entry.subject} passed. What had been agreed never became time spent together.`]),
  } : {
    description: pair ? `${pair} began ${entry.subject}, but their time was cut short.` : `The time with ${entry.name} began, but ended early.`,
    prose: pick(event, 'cut_short', [
      `They had begun ${entry.subject}. Then the little opening in the day closed before they were done.`,
      `There had been a beginning to ${entry.subject}, and some time together. The interruption left it short of an ending.`]),
  };
}

function callback(event, entry, n, outcome) {
  if (entry.owner) {
    const end = outcome === 'kept' ? 'had lasted to its end' : outcome === 'missed' ? 'had never begun' : 'had been interrupted';
    const touch = entry.owner === 'goaden'
      ? 'Warm weight against him; a familiarity easy to carry and easier to hurry past.'
      : 'The soft light was familiar enough to overlook. She looked at it now.';
    return {
      description: `${n} recalled the earlier quiet with ${entry.name}.`,
      prose: pick(event, `callback-${outcome}`, [
        `${n} noticed ${entry.name}, and remembered the quiet that ${end}. ${touch}`,
        `The quiet with ${entry.name} ${end}. It returned to ${n} now, in the middle of another day. ${touch}`]),
    };
  }
  const ending = outcome === 'kept' ? 'They had both been there for its ending.'
    : outcome === 'missed' ? 'It was the time they had meant to share, and never had.'
      : 'They had begun it together, and been interrupted before they were done.';
  // A callback is a new meeting about a known event. Physical responses happen
  // here; they are not presented as memories of gestures the ledger never knew.
  const response = {
    yukon: outcome === 'kept'
      ? 'He lifted his chin, already prepared for the matter to become his fault. It lent the recollection a familiar edge.'
      : 'He rubbed his palms together as the recollection surfaced. The game was easy to leave unfinished; being reminded of it was another matter.',
    henderson: 'The General gave the recollection a brief nod. Even among the larger demands of MI6, that one had kept its place.',
    davis: 'She met the recollection with a measured smile, letting it occupy a moment that belonged to no handover.',
    kartel: 'The Captain answered with a glance. His silence held the recollection as readily as it had held the table.',
    rose: 'Her eyebrow moved a fraction. It was quite enough commentary on the subject.',
    anarchy: 'His hands stirred as the rhythm was mentioned. Even a recollection appeared to require the use of his whole body.',
    balthazar: 'Through the body he shared with Anarchy, he received the recollection with an almost ceremonial patience.',
    gabriel: outcome === 'kept'
      ? 'He straightened at the mention of the verse. Having been heard once had evidently done nothing to diminish his interest in the matter.'
      : 'His mouth tightened, then recovered its usual confidence. The verse had proved easier to begin than to leave behind.',
    truth: 'His response arrived with the force of something considerably larger than a passing recollection.',
    emily: 'She tilted her head and smiled. Remembering it together made her no easier to read.',
    zara: 'Her glance went briefly to the time, then returned. Work had not managed to take the memory as well.',
  }[entry.guest];
  const subject = entry.recallSubject ?? entry.subject;
  return {
    description: `${n} and ${entry.name} recalled ${subject}.`,
    prose: pick(event, `callback-${outcome}`, [
      `${subject[0].toUpperCase()}${subject.slice(1)} came up again between ${n} and ${entry.name}. ${ending} ${response}`,
      `${n} brought ${subject} up again with ${entry.name}. ${response} ${ending}`]),
  };
}

/** Render only the facts of this public source event. The optional owned story
 * may supply historical identity for an absent lead; it cannot supply outcomes.
 * Return null for unsupported/malformed input so callers keep the source copy.
 */
export function supportingEditorial(event, { story } = {}) {
  if (event?.visibility !== 'public' || !TYPES.has(event.type) || typeof event.id !== 'string'
    || !event.id || !event.payload || !Array.isArray(event.participants)
    || !Array.isArray(event.payload.cast)) return null;
  if (!Object.hasOwn(BANK, event.payload.family)) return null;
  const entry = BANK[event.payload.family];
  if (!entry || typeof entry !== 'object') return null;
  const outcome = event.payload.outcome;
  const isFailure = ['SUPPORTING_ENCOUNTER', 'SUPPORTING_OUTCOME', 'SUPPORTING_DEADLINE'].includes(event.type)
    && ['missed', 'cut_short'].includes(outcome);
  const leads = [...new Set(event.participants.filter(id => Object.hasOwn(LEADS, id)))];
  if (leads.length > 1) return null;
  const present = leads[0] ?? null;
  if (isFailure) {
    if (event.type === 'SUPPORTING_ENCOUNTER' && outcome !== 'missed') return null;
    const historical = present ?? historicalLead(event, story, entry);
    if (entry.owner && historical && historical !== entry.owner) return null;
    return failure(event, entry, historical, outcome);
  }
  // Every performed scene needs actual public attendance, including the guest.
  // Anarchy/Balthazar share a body. Guardians cannot be summoned to a meeting
  // without their owner. Unknown cast members never become public prose.
  if (!present || !event.payload.cast.includes(present) || !event.payload.cast.includes(entry.guest)
    || entry.owner && present !== entry.owner
    || entry.bodyPair && (present !== 'goaden' || !event.payload.cast.includes('anarchy')
      || !event.payload.cast.includes('balthazar'))) return null;
  const n = LEADS[present];
  if (event.type === 'SUPPORTING_CALLBACK') return OUTCOMES.has(outcome) ? callback(event, entry, n, outcome) : null;
  if (event.type === 'SUPPORTING_COMMITMENT' && outcome == null)
    return { description: entry.request(n), prose: pick(event, 'opening', entry.opening(n)) };
  if (event.type === 'SUPPORTING_ENCOUNTER' && outcome == null)
    return { description: entry.begin(n), prose: pick(event, 'middle', entry.middle(n)) };
  if (['SUPPORTING_OUTCOME', 'SUPPORTING_DEADLINE'].includes(event.type) && outcome === 'kept')
    return { description: entry.end(n), prose: pick(event, 'ending', entry.ending(n)) };
  return null;
}
