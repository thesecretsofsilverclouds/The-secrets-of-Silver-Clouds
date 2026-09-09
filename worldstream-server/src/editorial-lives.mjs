import { createHash } from 'node:crypto';
import { purposeEditorial } from './pursuit-purpose.mjs';

// Offscreen work is already committed when this module sees it. We perform a
// scene; we cannot settle its subject, supply help, acquire a memory, or summon
// a lead. Voice anchors: manuscript PDF pp.64–69 and the Legion/Cast packets.
// In particular: Yukon is working through a section, never winning a game in
// this prose; Zara's notes contain no mission, classified order or new intel.
const NAMES = Object.freeze({ goaden: 'Goaden', ashai: 'Ashai' });
const TYPES = new Set(['OFFSCREEN_START', 'OFFSCREEN_RESULT', 'OFFSCREEN_ENCOUNTER']);
const OUTCOMES = new Set(['unfinished', 'settled']);
const nonempty = value => typeof value === 'string' && value.length > 0;
const time = value => Number.isSafeInteger(value) && value >= 0;
const choose = (event, stage, options) => options[createHash('sha256')
  .update(`lives-editorial-v2|${event.id}|${stage}`).digest().readUInt32BE(0) % options.length];
const BANK = Object.freeze({
  game_retry: {
    guest: 'yukon', name: 'Yukon', location: 'mi6', area: 'gaming_room',
    subject: 'the troublesome section of the game', method: 'shorter_section',
    nextSubject: 'another troublesome section of the game',
    next: 'A different section of the game had caught Yukon. He leaned towards it with all the determination the previous one had failed to cure.',
    started: [
      'Yukon hunched over the controller in the MI6 gaming room, his pointed ears sticking out beneath the gelled hair. The same section again. His thumbs went straight back to the movement that kept catching him.\n\nHe leaned closer, jaw clenched. Getting angry with the bloody thing was easy. Getting through it was the part he had come back to do.',
      'Screen light washed over Yukon’s grey hands. He tightened his grip on the controller and started the section again, shoulders pitched forward before anything had happened.\n\nHe knew where it went wrong. His hands kept taking him there anyway. This time he watched the movement instead of letting frustration rush him through it.'
    ],
    resumed: [
      'Yukon settled back in front of the screen. He had left this section unfinished, and the first familiar movements brought the scowl straight back to his face.\n\nHis grip tightened. Then he eased it and tried again. For all the fury he brought to the controller, his hands still had to get the sequence right.',
      'The controller fitted into Yukon’s hands as though he had never put it down. Back to the same section, with the same failure waiting if he hurried.\n\nHe drew his shoulders forward and fixed on the screen. The irritation had survived the break. So had his determination to get past it.'
    ],
    unfinished: [
      'Yukon’s thumbs stopped. He stared at the screen, breathing through his nose, then let the controller settle against his legs. He had reached the same problem and failed to get past it.\n\nHis fingers shifted towards another attempt. He pulled them back. The section would still be there when he returned; for now, he was leaving it unfinished.',
      'The section beat him again. Yukon pushed himself back in the chair, the controller gripped hard between his grey hands.\n\nHe leaned forward once more, then stopped before starting. Anger was not getting him any further. He put the controller down and left the section unfinished.'
    ],
    settled: [
      'Yukon got past it. His hands kept moving until the section was through, then stopped over the controller. For a moment he just stared.\n\nHis shoulders dropped. He set the controller down before another attempt could swallow the result. The part that had kept beating him was behind him now.',
      'The sequence held. Yukon reached the end of the section and sat back hard, loosening his fingers from the controller one at a time.\n\nHe looked at the screen again. Still through. He let out a breath and left the controller where it was.'
    ],
    helpedResult: 'He had worked on the shorter section suggested to him, and that smaller piece gave the attempt somewhere to come together.',
    heard: n => `${n} heard what Yukon had been working at: a section of the game that still refused to settle. ${n === 'Goaden' ? 'The account drew a sideways look at its aggrieved teller. The expression alone explained why the subject had survived.' : 'She listened past the frustration to the part that kept catching him.'} Another piece of the day, finally reaching ${n === 'Goaden' ? 'him' : 'her'}.`,
    heardSettled: n => `${n} heard how Yukon had finally worked through the troublesome section. ${n === 'Goaden' ? 'Goaden gave him the sort of look that left celebration entirely in his own hands.' : 'Ashai let him finish the account before her smile answered it.'}`,
    help: n => `${n} remembered the section Yukon had described. ${n === 'Goaden' ? 'Goaden’s suggestion came short and dry: work on less of it at once. He made the smaller target sound irritatingly obvious.' : 'Ashai brought him back to the part that kept catching, then suggested working on a shorter section. Something he could hold together before asking it to carry the rest.'} The attempt would still be his to make.`,
    earlierHelp: n => `${n} remembered how another section had caught Yukon before. This was a different one, but ${n === 'Goaden' ? 'Goaden’s suggestion was no less dry: work on a smaller stretch of it. His expression supplied the part about familiar habits without making it a speech.' : 'Ashai recognised the shape of the difficulty and suggested working on a smaller stretch. She had kept enough of his earlier account to spare him the whole explanation.'} The new attempt was still ahead of him.`,
    recall: n => `${n} brought up the troublesome section with Yukon again. ${n === 'Goaden' ? 'Goaden’s mouth moved towards a smile before he had quite finished mentioning it.' : 'Ashai remembered which part had caught him, and returned to that detail instead of making him begin the whole account again.'}`,
  },
  verse_revision: {
    guest: 'gabriel', name: 'Gabriel', location: 'sanctuary', area: 'central_hub',
    subject: 'the crowded ending of the verse', method: 'shorten_last_line',
    nextSubject: 'the ending of a new verse',
    next: 'Gabriel had a new verse, with a new ending threatening to carry more words than its rhythm could hold. He began working at it. Another verse had evidently done nothing to make his ambitions smaller.',
    started: [
      'Gabriel reached the last line and ran out of room. The words crowded together while the beat carried on without waiting for him. He stopped in the Sanctuary and drew breath.\n\nHe tried the line again. There was too much in it; he could hear that. Cutting something out was proving harder than singing it badly.',
      'Gabriel worked through the verse, keeping the rhythm until the last line forced him to hurry. He broke off, mouth still shaped around the words he had not fitted in.\n\nThe ending needed space. He went back over it, listening for what he could lose without cutting out the part he wanted to keep.'
    ],
    resumed: [
      'Back in the Sanctuary, Gabriel took up the verse where he had stopped. The last line still dragged too many words behind it. He tried to get through without rushing and heard himself rush anyway.\n\nHe stopped. Went back. This was the line he had left unfinished, and he would have to cut it before the ending could land.',
      'Gabriel began at the troublesome ending instead of singing the whole verse again. He knew the lead-in; it was the last line he had not managed to finish.\n\nHe worked through the words slowly, stripping away the performance until he could hear where the rhythm disappeared beneath them.'
    ],
    unfinished: [
      'Gabriel stopped before the last line had finished spilling out. He had taken words away, but the ending still rushed past its beat.\n\nHe drew breath as if to start again, then let it go. The verse stayed unfinished. Whatever he cut next would have to make more room than this.',
      'The final words came too quickly again. Gabriel’s mouth tightened. He could force them through, but he could hear exactly what that did to the verse.\n\nHe left the ending there. It was still crowded, still unfinished, and another performance would not make it fit.'
    ],
    settled: [
      'Gabriel sang the shortened line and reached the end with room to spare. He did not have to swallow the last words. The beat fell cleanly after them.\n\nHe held still, listening to the gap he had finally made. Then his mouth curled. That was the ending he had been trying to get.',
      'The last line landed on the beat. Gabriel drew breath, then stopped himself from filling the silence with another run.\n\nFewer words. A proper ending. He let the verse finish without dragging anything else after it.'
    ],
    helpedResult: 'The suggestion to shorten the final line had given the ending the space it needed.',
    heard: n => `${n} heard about Gabriel’s crowded last line. ${n === 'Goaden' ? 'The account brought an interested look to his face: a verse, it seemed, could have too much Gabriel in it.' : 'She listened for where the rhythm gave way beneath the words.'} The ending had travelled into conversation still unfinished.`,
    heardSettled: n => `Gabriel told ${n} that the verse’s ending had come together. ${n === 'Goaden' ? 'Goaden let him have the account, complete with the importance he gave its smallest turns.' : 'Ashai followed the change he described, hearing where the crowded last line had finally found room.'}`,
    help: n => `${n} remembered the crowded ending Gabriel had described. ${n === 'Goaden' ? 'Goaden suggested giving the last line fewer words to fight over. A modest proposal, delivered with an expression that did nothing to make it modest.' : 'Ashai brought him back to the final line and suggested shortening it, leaving the rhythm somewhere to land.'} Gabriel had the suggestion now. The verse remained his.`,
    earlierHelp: n => `${n} remembered another crowded verse ending Gabriel had described. This was a new verse. ${n === 'Goaden' ? 'Goaden still suggested fewer words in the last line, delivering the familiar remedy as though it had been waiting patiently for him to need it.' : 'Ashai suggested shortening the last line, drawing on the earlier difficulty without pretending this verse was the same one.'} He had the suggestion; the new ending remained his to work through.`,
    recall: n => `The verse came up again between ${n} and Gabriel. ${n === 'Goaden' ? 'Goaden remembered the crowded ending and went straight to it, sparing the performance very little of his usual dry interest.' : 'Ashai returned to the final line rather than asking him to explain the whole verse again. She had kept that part of the earlier account.'}`,
  },
  lyric_cutting: {
    guest: 'rose', name: 'Rose', location: 'legion_hideout', area: 'venue',
    subject: 'the second verse, which keeps getting shorter', method: 'say_it_out_loud',
    nextSubject: 'a third verse that arrived too long',
    next: 'Rose started a different verse, the third, and this new verse arrived at six lines — a state of affairs she appeared to regard as temporary.',
    started: [
      'Rose sat on the drum kit with the second verse across her knee. Four lines. She read through them, pressed the pencil to the page and struck one out.\n\nThe pigeon on the warehouse rail shifted its feet. Rose read the verse again. Three of those lines were doing nothing, and she had no intention of keeping them just because she had written them.',
      'Rose bent over the verse, fiery hair falling beside the page. The pencil paused under one line, then moved through it.\n\nShe read what remained. Too much still. Up on the drum kit, with the warehouse stretching away around her, she went back over the words and looked for the next thing to cut.'
    ],
    resumed: [
      'Rose laid the unfinished verse across her knee again. She read it without touching the pencil, then went back to the words she had failed to cut.\n\nThe page had kept all of them. She picked up the pencil and settled herself on the drum kit.',
      'The second verse was still too long. Rose climbed back onto the drum kit, drew the page towards her and read from the beginning.\n\nHer pencil stopped over the same lines. Leaving them alone had not made them necessary.'
    ],
    unfinished: [
      'Rose lowered the pencil. Four lines remained. She read them once more, her eyes moving back to the three she still did not want.\n\nShe left the page on her knee. The verse was not finished, and she would not pretend it was just to put the pencil down.',
      'Four lines. Rose stared at the page, then set the pencil beside her on the drum kit.\n\nShe had not got the verse down to what it needed. The words stayed where they were, waiting for her to make the cut she had not managed today.'
    ],
    settled: [
      'Rose read the two lines left on the page. Then she read them again, the pencil loose in her hand.\n\nShe did not put anything back. What she had wanted was there without the words she had cut, and she set the pencil down on the drum kit.',
      'The verse was down to two lines. Rose ran her eyes across the page, stopping where the other lines had been.\n\nNothing needed filling in. She left the cuts visible and put the pencil aside.'
    ],
    helpedResult: 'The suggestion to say it out loud had shown her which lines were only ever there on the page.',
    heard: n => `${n} heard that Rose was cutting a verse down. ${n === 'Goaden' ? 'The whole account took her about nine words, which he found funnier than the verse.' : 'Four lines, three of them doing nothing — Ashai got the problem in one sentence, because Rose does not supply a second.'} It was still four lines long when the subject moved on.`,
    heardSettled: n => `Rose told ${n} the verse was down to two lines. ${n === 'Goaden' ? 'Goaden waited for the rest of it, established that there was no rest of it, and nodded.' : 'Ashai asked which two. Rose told her, and that was the whole of the account.'}`,
    help: n => `${n} remembered the verse Rose was cutting. ${n === 'Goaden' ? 'Goaden suggested saying it out loud instead of reading it back — a page will forgive a line that the room will not.' : 'Ashai suggested she say it out loud rather than read it back, on the grounds that the ear is less polite than the eye.'} Rose took the suggestion without making an occasion of it.`,
    earlierHelp: n => `${n} remembered Rose cutting a verse down before. This was a different one. ${n === 'Goaden' ? 'Goaden suggested the same remedy anyway: out loud, not on the page. The suggestion had the advantage of having worked once already.' : 'Ashai suggested saying this one out loud too, carrying the useful part of the earlier attempt across without pretending it was the same verse.'} The cutting was still hers to do.`,
    recall: n => `The verse came up again between ${n} and Rose. ${n === 'Goaden' ? 'Goaden remembered it had been four lines and asked what it was now. Her answer was one word and a number.' : 'Ashai asked after the two lines rather than the four, and Rose evidently thought that was the right question.'}`,
  },
  // Emily, out of the two passages that sit before the checkpoint and nothing
  // else. The swing and the garden are hers from [P00729-730] and [P00993]; the
  // grey teddy-bear bag from [P00707]; the bare feet from [P01013]; the fragment
  // cadence and the repetition from her whole speaking part. No Fade, no
  // talisman, no Order, no immortality on the page — the darkness is entirely in
  // what an ordinary reader notices for themselves, which is a child alone in a
  // public garden for a very long time, being extremely patient.
  the_swing: {
    guest: 'emily', name: 'Emily', location: 'big_ben_plaza', area: 'venue',
    subject: 'the swing at the edge of the plaza gardens', method: 'stop_counting',
    nextSubject: 'the other swing, which is worse',
    next: 'Emily moved to a different swing, the one with the shorter chains, and started again from one. This one is worse, and she had clearly decided that was the point of it.',
    started: [
      'Emily pushed off with her bare feet. The swing carried her above the grass, grey teddy-bear bag lying beneath it. At the top she looked at her hands. The chains were still tight.\n\nShe wanted them slack. Only for the instant before she fell back, when there would be nothing pulling against her fingers. She counted the try and kicked forward again.',
      'The swing frame ticked as Emily passed beneath it. She leaned back, bare feet lifting, then watched the chains draw straight above her hands.\n\nStill holding her. She let the swing carry her down and pushed harder on the next pass. The rule was hers: get both chains to go slack at the top. She kept counting.'
    ],
    resumed: [
      'Emily put the grey bag on the grass and took the end swing again. Her hands closed around the chains. The count began at one.\n\nShe had not made them go slack last time. She pushed off, watching the links instead of the people passing through the plaza gardens.',
      'The frame ticked. Emily leaned back into the swing and looked up at the chains she had left taut on her last attempt.\n\nShe had come back to finish her rule. At the top of the arc she watched her hands, then counted another try as the swing fell away beneath her.'
    ],
    unfinished: [
      'Emily dragged her bare feet against the ground. The swing slowed beneath her, the chains pulling straight from her hands to the frame.\n\nThey had stayed tight at the top every time. She looked up at them once more and stopped counting. The rule was still unfinished.',
      'The chains had not gone slack. Emily let the swing lose height until her feet reached the grass, then sat holding the links still.\n\nHer grey bag lay where she had put it. She looked from the chains to the bag and ended the attempt without changing the rule.'
    ],
    settled: [
      'Both chains loosened in Emily’s hands. The swing hung for an instant, then dropped and pulled them tight again.\n\nShe kicked through another arc and watched it happen a second time. Twice. She let the swing slow, her fingers closed around the links that had finally stopped holding her at the top.',
      'At the top of the swing, the pull disappeared from Emily’s hands. The chains slackened, caught her again, and sent her back beneath the ticking frame.\n\nShe did it once more before she stopped. Two times. Emily sat very still, bare feet hanging above the grass, with both chains gathered in her hands.'
    ],
    helpedResult: 'The suggestion to stop counting had done it: the counting was keeping her honest and keeping her tight, and once the number went the arc got longer.',
    heard: n => `${n} heard about the girl on the swing at the plaza gardens, and about the rule. ${n === 'Goaden' ? 'Goaden asked how old she was, got an answer, and went quiet for a second longer than the question warranted.' : 'Ashai asked who she was there with. The answer was nobody, delivered as though the question was the strange part.'} The chains still had not gone slack.`,
    heardSettled: n => `Emily reported that she had got the chains to go slack, twice. ${n === 'Goaden' ? 'Goaden said that was a proper achievement and did not make a joke of it, which for him is a considerable statement.' : 'Ashai asked what it felt like at the top. Emily thought about it and said, "like nothing is holding you," and then went back to the swing.'}`,
    help: n => `${n} remembered the rule about the chains. ${n === 'Goaden' ? 'Goaden suggested she stop counting the tries. A number in your head shortens the arc; he did not explain how he knew that.' : 'Ashai suggested she stop counting and just swing, and did not add that the counting sounded like the harder game of the two.'} Emily took the suggestion, in her own time.`,
    earlierHelp: n => `${n} remembered the last rule Emily had set herself. This is a different swing and a different rule. ${n === 'Goaden' ? 'Goaden suggested the same remedy anyway: stop counting. It had worked on the last one.' : 'Ashai suggested she stop counting again, carrying the useful part across without pretending the new swing was the old one.'} The waiting is still hers.`,
    recall: n => `The swing came up again between ${n} and Emily. ${n === 'Goaden' ? 'Goaden asked whether she had got it. She said "twice" and nothing else, and he took that as the whole report, correctly.' : 'Ashai asked after the ticking frame rather than the rule, having remembered that detail, and Emily looked at her for a moment before answering.'}`,
  },
  liaison_notes: {
    guest: 'zara', name: 'Zara', location: 'mi6', area: 'ops_room',
    subject: 'the unclear handover note', method: 'separate_notes',
    nextSubject: 'the next unclear handover note',
    next: 'A different handover note needed Zara. She began working through its wording beneath the operations screens. Ordinary work had a way of producing another problem without asking what had become of the last.',
    started: [
      'Zara stopped at the same line in the handover. She read it again, lips pressed together. The next shift would have to work out what it meant, just as she was doing now.\n\nUnder the operations screens, she separated it from the notes she had already cleared. This entry needed rewriting before she could leave it for someone else.',
      'The handover made sense until Zara reached one muddled entry. She went back over the wording, then over it again, her face lit by the screens above the desk.\n\nShe could leave it and make the next shift untangle it. Instead she kept the entry in front of her and began another pass.'
    ],
    resumed: [
      'Zara found the entry she had marked unfinished. The rest of the handover was clear; this was the line that kept bringing her back to the desk.\n\nShe read it under the operations screens and started working through the wording again. Whoever took over after her would need a note they could understand.',
      'Back in operations, Zara stopped at the flag she had left on the handover. She had cleared the other notes. This one still needed explaining.\n\nShe drew it out from the surrounding entries and began again, working through the wording she had left unfinished.'
    ],
    unfinished: [
      'Zara read the entry one last time and left it flagged. It was still unclear. She could not pass it on as finished, however clean the rest of the handover looked.\n\nShe moved back from the desk. The next shift would see the flag before reaching the line that still needed explaining.',
      'The wording still would not give Zara a clear reading. She stopped working on it and marked the entry unfinished.\n\nThe other notes were ready. This one would have to be explained, and she left the flag where it could not be mistaken for a completed check.'
    ],
    settled: [
      'Zara read the replacement entry from beginning to end. No doubled meaning. No need to go back and work out which reading had been intended.\n\nShe put it in place of the muddled note and checked it once more. The next shift could read this one without having to ask her what it meant.',
      'The rewritten entry said what Zara needed it to say. She read it beside the other handover notes, checking that it still made sense there.\n\nThen she left it in place. One fewer explanation to drag into the next shift.'
    ],
    helpedResult: 'Separating the unclear entry from the rest of the handover, as suggested, had made it easier to leave a clear note in its place.',
    heard: n => `${n} heard about the handover note Zara had been trying to make clear. ${n === 'Goaden' ? 'Work finding its way into her conversation came as no great surprise; his expression gave that much away.' : 'The ordinary difficulty received a careful hearing. Ashai followed the wording that had caught her.'} It had occupied part of Zara’s day before reaching this conversation.`,
    heardSettled: n => `Zara told ${n} that the handover note was clear at last. ${n === 'Goaden' ? 'Goaden met the brisk account with a slight tilt of his head, letting her give a small piece of work its proper ending.' : 'Ashai let her finish describing the change. An ordinary difficulty, but someone had spent part of a day on it.'}`,
    help: n => `${n} remembered Zara’s unclear handover note. ${n === 'Goaden' ? 'Goaden suggested separating the troublesome entry from the rest. He delivered the idea with none of the professional gravity she had given the problem.' : 'Ashai suggested separating the troublesome entry from the rest of the handover, letting one unclear note stop making the whole thing difficult to follow.'} Zara had another way to try it now.`,
    earlierHelp: n => `${n} remembered a different handover note that had kept Zara occupied. ${n === 'Goaden' ? 'Goaden suggested separating this troublesome entry from the rest, with the unhurried air of someone able to recognise a pattern when work followed her into conversation.' : 'Ashai suggested separating this troublesome entry from the rest of the handover, carrying the earlier lesson into a new piece of work.'} This was another note, still hers to make clear.`,
    recall: n => `The handover note came up again between ${n} and Zara. ${n === 'Goaden' ? 'Goaden remembered the detail that had kept following her. His half-smile made it clear that the persistence had not escaped him.' : 'Ashai remembered which part had been unclear. Zara did not have to begin her account again.'}`,
  },
});

function learnedEvidence(event) {
  const p = event.payload;
  if (!nonempty(p.sourceEventId) || !time(p.sourceOccurredAt) || p.sourceOccurredAt >= event.occurredAt
    || !nonempty(p.acquisitionEventId) || !time(p.acquiredAt) || p.acquiredAt > event.occurredAt) return false;
  if (p.stage === 'heard') return p.acquisitionEventId === event.id && p.acquiredAt === event.occurredAt;
  // A recalled source may be an older unfinished result, even if this meeting
  // also supplies a newer result. Acquisition belongs to the recalled fact.
  return nonempty(p.recalledSourceEventId) && time(p.recalledOccurredAt)
    && p.recalledOccurredAt <= p.acquiredAt && p.acquiredAt < event.occurredAt
    && p.acquisitionEventId !== event.id;
}

/** Return only display copy for the exact public event; fail closed on shape,
 * attendance or acquisition inconsistencies. No arbitrary source prose read. */
export function livesEditorial(event) {
  if (event?.visibility !== 'public' || !TYPES.has(event.type) || !nonempty(event.id)
    || !time(event.occurredAt) || !Array.isArray(event.participants) || !event.payload) return null;
  const p = event.payload;
  if (p.purposeStage) return purposeEditorial(event);
  if (!Object.hasOwn(BANK, p.family)) return null;
  const item = BANK[p.family];
  if (p.guest !== item.guest || !Array.isArray(p.cast) || !p.cast.includes(item.guest)
    || !Number.isInteger(p.attempt) || p.attempt < 1 || p.attempt > 3
    || !Number.isInteger(p.projectNumber) || p.projectNumber < 1) return null;
  // Continuation prose already records an established result and its later
  // check. The old bank describes discovering the original solution; using it
  // again would make a completed verse or mastered section become new trouble.
  const continuing = nonempty(p.continuationSourceEventId) && time(p.continuationOccurredAt)
    && p.continuationOccurredAt < event.occurredAt
    && event.causedBy?.includes(p.continuationSourceEventId);
  if (event.type !== 'OFFSCREEN_ENCOUNTER') {
    if (event.participants.length || event.location !== item.location || event.area !== item.area) return null;
    if (event.type === 'OFFSCREEN_START') {
      if (!['started', 'resumed'].includes(p.stage) || p.outcome != null) return null;
      if (p.stage === 'resumed' && (p.previousOutcome !== 'unfinished' || !nonempty(p.previousResultEventId))) return null;
      if (continuing) return { description: event.publicDescription, prose: null };
      const next = p.stage === 'started' && p.projectNumber > 1;
      return { description: p.guest === 'emily' ? `Emily ${p.stage === 'resumed' ? 'tried again to get' : 'tried to get'} the swing chains to go slack at the top.`
        : `${item.name} ${p.stage === 'resumed' ? 'returned to' : 'began working on'} ${next ? item.nextSubject : item.subject}.`,
        prose: next ? item.next : choose(event, p.stage, item[p.stage]) };
    }
    if (p.stage !== 'result' || !OUTCOMES.has(p.outcome)) return null;
    if (continuing) return { description: event.publicDescription, prose: null };
    const helped = p.outcome === 'settled' && nonempty(p.helpSourceEventId) && p.helpMethod === item.method;
    return { description: p.guest === 'emily' ? p.outcome === 'settled'
      ? 'Emily made the swing chains go slack, twice.' : 'Emily stopped trying; the swing chains had stayed tight.'
      : `${item.name} ${p.outcome === 'settled' ? 'worked through' : 'left unfinished'} ${item.subject}.`,
      prose: `${choose(event, p.outcome, item[p.outcome])}${helped ? ` ${item.helpedResult}` : ''}` };
  }
  if (!['heard', 'helped', 'recalled'].includes(p.stage) || !Object.hasOwn(NAMES, p.lead)
    || event.participants.length !== 1 || event.participants[0] !== p.lead || !OUTCOMES.has(p.outcome)
    || !learnedEvidence(event)) return null;
  if (continuing) return { description: event.publicDescription, prose: null };
  const n = NAMES[p.lead];
  if (p.stage === 'heard') return { description: `${n} learned how ${item.name} had been getting on with ${item.subject}.`,
    prose: p.outcome === 'settled' ? item.heardSettled(n) : item.heard(n) };
  if (p.stage === 'helped') {
    if (p.helpMethod !== item.method || p.outcome !== 'unfinished') return null;
    return { description: `${n} remembered ${item.name}’s earlier difficulty and offered a way to try this attempt.`,
      prose: p.memoryScope === 'earlier_project' ? item.earlierHelp(n) : item.help(n) };
  }
  const recalled = p.memoryScope === 'earlier_project'
    ? `${n} recognised something of ${item.name}’s earlier difficulty in this new piece of work. The remembered account belonged to a different attempt; the two could still talk without beginning at the beginning.`
    : item.recall(n);
  return { description: `${n} and ${item.name} returned to ${item.subject}.`, prose: `${recalled} ${p.outcome === 'settled'
    ? 'It had an ending now: the troublesome part was settled.'
    : 'For now, the troublesome part was still unfinished.'}` };
}
