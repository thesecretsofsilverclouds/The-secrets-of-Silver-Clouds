import { createHash } from 'node:crypto';

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
      'Yukon was at the game again. He leaned into the same troublesome section, pointed ears giving his concentration an unnecessarily combative silhouette. London could wait its turn.',
      'The game wanted precision. Yukon approached it with conviction, which was not quite the same thing. He worked at the troublesome section alone, leaning towards it as though the missing answer might be closer to the screen.'
    ],
    resumed: [
      'Yukon returned to the section he had left unfinished. His hands found the familiar sequence; his face suggested considerably less affection for it. The game had kept its place. So had he.',
      'The troublesome section was waiting. Yukon settled in for another attempt, still recognisably offended by the need for one. Whatever else had happened since, this part of the game remained his problem.'
    ],
    unfinished: [
      'Yukon stopped. The section still had him. His hands fell still before the rest of him accepted it, and for a moment his expression did all the work. He left the attempt unfinished.',
      'The section refused to come together. Yukon sat back, then leaned towards it again without beginning another attempt. Leaving something alone was apparently going to require an effort of its own.'
    ],
    settled: [
      'The troublesome section finally came together. Yukon’s hands eased; the rest of him took a moment to follow. One piece of the game, sorted. He gave it a long look, as if it might still attempt to dispute the matter.',
      'This time, the section held together. Yukon let his hands settle and sat back. The game was still the game, but the part that had kept drawing him back no longer stopped him in the same place.'
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
      'Gabriel tried the last line again. Too much of it wanted to arrive at once. He paced the words against their own rhythm, giving the Sanctuary a performance whose most demanding audience, for now, was himself.',
      'The verse had an overcrowded ending. Gabriel returned to it with the bearing of a man preparing to correct a minor misunderstanding between his intentions and everyone else’s sense of rhythm.'
    ],
    resumed: [
      'Gabriel returned to the unfinished last line. It still wanted more room than the verse could give it. He went through it again, fully committed to the possibility that confidence might yet count as space.',
      'The ending had stayed with Gabriel. Back at the verse, he tried the last line once more, measuring the turn of it against the words still crowding towards the end. This was the part he had not managed to leave behind.'
    ],
    unfinished: [
      'The last line still crowded its ending. Gabriel stopped there, his expression retaining the performance a moment after his voice had abandoned it. The verse would have to wait unfinished.',
      'Gabriel reached the crowded ending and stopped. Conviction had carried the words a considerable distance. It had not made them fit. He left that part unresolved.'
    ],
    settled: [
      'The last line found its ending. Gabriel let the final beat fall, and for once nothing was trying to arrive after it. He stood with the finished shape of the verse before his face remembered to look as though that had always been inevitable.',
      'Gabriel reached the end without crowding it. A clean finish; room for the last beat to be heard. He held the silence afterwards with rather more ceremony than the silence required.'
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
      'Rose sat up on the drum kit with a pencil and the second verse. She read it, crossed out a line, and read it again. The pigeon on the rail watched all of this and contributed nothing.',
      'Four lines, and Rose did not like three of them. She worked at the verse the way she talks: taking things out until what is left cannot be argued with.'
    ],
    resumed: [
      'The verse was where she had left it, one line shorter than it had been that morning. Rose read it through and reached for the pencil again.',
      'Rose came back to the second verse. It had not improved in her absence, which she seemed to have expected.'
    ],
    unfinished: [
      'Rose put the pencil down. Four lines, still. She had cut two and put one back, which is not progress, though it is not quite nothing. The pigeon left before she did.',
      'The verse stayed at four lines. Rose read it once more, decided against saying anything about it, and left it there.'
    ],
    settled: [
      'Two lines. Rose read them, then read them again, and did not reach for the pencil. Whatever the other two had been doing, the pair that were left did it without them.',
      'She cut it to two lines and stopped. Rose has never needed many words to finish a thing, and the verse had finally come round to her way of seeing it.'
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
      'Emily had the swing at the far end of the gardens, the one nobody uses because the frame ticks. She was working at a rule of her own: get the chains to go slack at the top of the arc, just for a moment, so that for that moment nothing is holding you. Bare feet. Grey bag on the grass. She counted the tries out loud.',
      'The gardens had the after-school crowd in them and Emily had the end swing to herself, as she always seems to. She was going high, and higher, and watching the chains rather than the sky — waiting for the half-second of slack at the top that she has decided counts as flying.',
    ],
    resumed: [
      'Emily came back to the end swing. The count started again from one, which suggests the rule has terms.',
      'The frame was still ticking and the chains were still taut at the top. Emily picked it up where she had left it, with no apparent feeling about the interval.',
    ],
    unfinished: [
      'The chains never went slack. Emily kept going until the gardens had emptied out around her and the light had gone amber, and then a while after that. When she stopped, she stopped all at once, the way a clock does.',
      'Forty-one tries and the chains stayed tight every time. She said the number out loud to nobody, picked the grey bag up off the grass, and walked out barefoot across the cold flagstones.',
    ],
    settled: [
      'It went slack. Half a second at the top of the arc, both chains, and Emily made a sound that a passer-by would have said was a laugh. She did it again to be certain. Then she sat in the still swing for a long while with her feet not reaching the ground.',
      'Twice. She got it twice, and stopped, because a rule you can meet twice is finished. Emily sat with the chains going quiet in her hands and looked at the tower for a while, and did not go home for some time.',
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
      'In operations, Zara returned to an ordinary handover note whose wording had made more work than it saved. Monitor light caught her face as she went through it. A small ambiguity, given enough time, could become everyone’s problem.',
      'Zara had a handover note to make clear. Nothing secret, nothing dramatic; just a piece of ordinary work that would otherwise follow someone into the next shift. She bent over it beneath the steady glow of the screens.'
    ],
    resumed: [
      'The handover note was still unclear. Zara returned to it in operations, her brisk manner narrowing to the stubborn detail. The wording had waited. So had the person who would eventually need to understand it.',
      'Zara took up the unfinished handover note again. In the monitor glow, the same ambiguous wording remained as unhelpful as she had left it. She began another pass.'
    ],
    unfinished: [
      'The handover note was still ambiguous when Zara stopped. She left it marked for more work. Beyond her, the operations screens kept their steady light; this small uncertainty had survived another attempt to tidy it away.',
      'Zara reached the end of the second pass without making the handover note any clearer. Her gaze remained on it a moment longer, then lifted. The next handover would still need that piece explained.'
    ],
    settled: [
      'The handover note was clear at last. Zara read it through once more, then let it go. Somewhere between one shift and the next, a question would no longer need to be asked. No screen in operations announced the difference.',
      'Zara finished the note and read back wording that could stand on its own. Clear enough to hand over. Her shoulders eased by a fraction before she straightened them again.'
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
  if (!Object.hasOwn(BANK, p.family)) return null;
  const item = BANK[p.family];
  if (p.guest !== item.guest || !Array.isArray(p.cast) || !p.cast.includes(item.guest)
    || !Number.isInteger(p.attempt) || p.attempt < 1 || p.attempt > 3
    || !Number.isInteger(p.projectNumber) || p.projectNumber < 1) return null;
  if (event.type !== 'OFFSCREEN_ENCOUNTER') {
    if (event.participants.length || event.location !== item.location || event.area !== item.area) return null;
    if (event.type === 'OFFSCREEN_START') {
      if (!['started', 'resumed'].includes(p.stage) || p.outcome != null) return null;
      if (p.stage === 'resumed' && (p.previousOutcome !== 'unfinished' || !nonempty(p.previousResultEventId))) return null;
      const next = p.stage === 'started' && p.projectNumber > 1;
      return { description: `${item.name} ${p.stage === 'resumed' ? 'returned to' : 'began working on'} ${next ? item.nextSubject : item.subject}.`,
        prose: next ? item.next : choose(event, p.stage, item[p.stage]) };
    }
    if (p.stage !== 'result' || !OUTCOMES.has(p.outcome)) return null;
    const helped = p.outcome === 'settled' && nonempty(p.helpSourceEventId) && p.helpMethod === item.method;
    return { description: `${item.name} ${p.outcome === 'settled' ? 'worked through' : 'left unfinished'} ${item.subject}.`,
      prose: `${choose(event, p.outcome, item[p.outcome])}${helped ? ` ${item.helpedResult}` : ''}` };
  }
  if (!['heard', 'helped', 'recalled'].includes(p.stage) || !Object.hasOwn(NAMES, p.lead)
    || event.participants.length !== 1 || event.participants[0] !== p.lead || !OUTCOMES.has(p.outcome)
    || !learnedEvidence(event)) return null;
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
