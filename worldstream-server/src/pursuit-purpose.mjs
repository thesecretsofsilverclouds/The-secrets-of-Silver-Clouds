// Authored next uses for work that the world has already proved complete.
// These do not reopen that work, invent a verdict, or arrange an encounter.
const names = { goaden: 'Goaden', ashai: 'Ashai' };
export const PURSUIT_PURPOSES = Object.freeze({
  yukon: {
    kind: 'show_mastered_section', location: 'mi6', area: 'gaming_room',
    choice: 'Yukon wanted someone to watch how he handled the section he had beaten.',
    chosen: 'Yukon returned to the section he had already beaten. He stopped over the controls, then looked at the space beside him.\n\nHe wanted somebody to see how he did it. Another private run would not do that; he would ask when somebody was there to watch.',
    request: n => `Yukon asked ${n} to watch how he handled the game section.`,
    opening: n => `Yukon kept the controller in his hands and turned towards ${n}. The section he had beaten was the one he wanted to show. He waited until he had ${n === 'Goaden' ? 'his' : 'her'} attention.`,
    ask: 'Watch how I do this bit.', answer: 'All right. Show me.',
    shared: n => `${n} watched Yukon work through his approach to the game section.`,
    ending: n => `Yukon lowered the controller and looked at ${n}. ${n === 'Goaden' ? 'He' : 'She'} had stayed to watch the approach Yukon wanted to show.\n\nYukon had somebody to talk to about it now. He pointed back at the screen, then let his hand drop.`,
    interrupted: 'Yukon’s demonstration lost its audience before he had finished showing the approach. The section he had beaten stayed beaten.',
  },
  gabriel: {
    kind: 'perform_finished_verse',
    choice: 'Gabriel decided to sing the finished verse for someone who could hear it through.',
    chosen: 'Gabriel went through the finished verse without crowding the last line. Then he stopped. He had been singing it back to himself long enough.\n\nThe next thing he wanted was a listener. He kept the ending as it was, ready to sing the whole verse when someone had time to hear it.',
    request: n => `Gabriel asked ${n} to hear the finished verse through.`,
    opening: n => `Gabriel turned towards ${n}, one hand already keeping the beat against his leg. The last line was finished. This time he wanted to perform the verse, and he waited for an answer before beginning.`,
    ask: 'The whole verse. Listen to the ending this time.', answer: 'Go on, then. I’m listening.',
    shared: n => `${n} heard Gabriel’s finished verse all the way through.`,
    ending: n => `Gabriel reached the last line and gave it the space he had found for it. ${n} stayed until the verse was over.\n\nHe lowered his hand. The finished ending had reached someone else’s ears, and he looked at ${n === 'Goaden' ? 'Goaden' : 'Ashai'} while the last sound faded.`,
    interrupted: 'Gabriel’s performance was interrupted before the listener heard the whole verse. He kept the finished last line unchanged.',
  },
  rose: {
    kind: 'read_finished_lines',
    choice: 'Rose kept the two finished lines and decided to read them to somebody.',
    chosen: 'Rose read the two lines she had kept, then put the pencil down. There was nothing left she wanted to cut.\n\nShe folded the page. Next she wanted somebody to hear the words aloud. She would need a listener for that, not another afternoon crossing things out.',
    request: n => `Rose asked ${n} to listen to the two lines she had kept.`,
    opening: n => `Rose turned towards ${n}. She had cut the verse to two lines, and now she wanted them heard. Her hands stayed still while she waited for ${n === 'Goaden' ? 'him' : 'her'} to answer.`,
    ask: 'Two lines. Listen.', answer: 'Go on.',
    shared: n => `${n} heard both of Rose’s finished lines.`,
    ending: n => `Rose said the two lines. ${n} stayed quiet until she had finished.\n\nThat was all of it. She looked at ${n === 'Goaden' ? 'him' : 'her'} and gave a small nod. The words had been heard; she did not add any more.`,
    interrupted: 'Rose’s reading was cut short before the listener heard both lines. The two lines she had kept remained finished.',
  },
  emily: {
    kind: 'show_swing_rule', location: 'big_ben_plaza', area: 'venue',
    choice: 'Emily decided she wanted somebody to watch the instant she had found at the top of the swing.',
    chosen: 'Emily watched the chains at the top of the swing. She had made them go slack before. This time, as she swung back down, she looked towards the path.\n\nShe wanted somebody else to watch for that instant. She would have to wait until somebody was there to ask.',
    request: n => `Emily asked ${n} to watch the chains while she swung.`,
    opening: n => `Emily held the swing chains and looked towards ${n}. She had already made them slack at the top. Now she wanted ${n === 'Goaden' ? 'him' : 'her'} to watch what she had been trying to do.`,
    ask: 'Watch the chains. Right at the top.', answer: 'All right. I’m watching.',
    shared: n => `${n} stayed to watch Emily demonstrate what she was doing with the swing chains.`,
    ending: n => `Emily let the swing slow. ${n} had stayed to watch the chains while she showed what she was trying to do.\n\nShe looked across at ${n === 'Goaden' ? 'him' : 'her'}, still holding the chains. This time she had had somebody watching with her.`,
    interrupted: 'The time watching Emily’s swing was cut short. Her earlier success with the chains remained unchanged.',
  },
  zara: {
    kind: 'read_clear_handover', location: 'mi6',
    choice: 'Zara decided to say the rewritten handover entry aloud to somebody at MI6.',
    chosen: 'Zara read the handover with the clear replacement entry in its place. She left the wording alone.\n\nNext she wanted a colleague to hear the sentence aloud. It had been a damned mess before. She wanted to say the new version without having to explain the old one first.',
    request: n => `Zara asked ${n} to hear the ordinary handover sentence she had rewritten.`,
    opening: n => `Zara stopped beside ${n}. She had replaced the muddled handover entry; now she wanted to say the new version to somebody who was not already sick of looking at it.`,
    ask: 'Listen to this. Just the sentence, for once.', answer: 'Go on. I’m listening.',
    shared: n => `${n} heard Zara say the rewritten handover sentence through.`,
    ending: n => `Zara said the rewritten sentence. ${n} heard it through, and she stopped without repeating the old version.\n\nShe had left a clean entry in the handover. Now she had said it to somebody as well. That was enough of that bloody sentence for one conversation.`,
    interrupted: 'The handover reading was interrupted before the listener heard it through. Zara’s clear replacement entry remained in place.',
  },
});
export const PURPOSE_RULES = Object.freeze({ duration: 2 * 60_000, maxAttempts: 2 });
export function purposePlace(guest, location, area) {
  const purpose = Object.hasOwn(PURSUIT_PURPOSES, guest) && PURSUIT_PURPOSES[guest];
  return Boolean(purpose && (!purpose.location || purpose.location === location)
    && (!purpose.area || purpose.area === area));
}
const string = value => typeof value === 'string' && value.length > 0;
const time = value => Number.isSafeInteger(value) && value >= 0;
const SOURCES = Object.freeze({ yukon: ['game_retry', 'mi6', 'gaming_room'],
  gabriel: ['verse_revision', 'sanctuary', 'central_hub'], rose: ['lyric_cutting', 'legion_hideout', 'venue'],
  emily: ['the_swing', 'big_ben_plaza', 'venue'], zara: ['liaison_notes', 'mi6', 'ops_room'] });

/** Read-side prose for the exact proved choice, request or outcome. */
export function purposeEditorial(event) {
  const p = event?.payload, bank = p && Object.hasOwn(PURSUIT_PURPOSES, p.guest) && PURSUIT_PURPOSES[p.guest];
  if (!bank || event.visibility !== 'public' || !string(event.id) || !time(event.occurredAt)
    || !string(p.purposeId) || p.offscreenStoryId !== p.purposeId || p.purposeKind !== bank.kind || !Array.isArray(event.participants)
    || !Array.isArray(event.causedBy)
    || !Array.isArray(p.cast) || !string(p.purposeSourceEventId) || !time(p.purposeSourceOccurredAt)
    || p.family !== SOURCES[p.guest][0] || !Number.isInteger(p.attempt) || p.attempt < 1 || p.attempt > 3
    || !Number.isInteger(p.projectNumber) || p.projectNumber < 1
    || p.purposeSourceOccurredAt >= event.occurredAt || !event.causedBy?.includes(p.purposeSourceEventId)) return null;
  if (p.purposeStage === 'chosen') return event.type === 'OFFSCREEN_START'
    && event.participants.length === 0 && p.cast.length === 1 && p.cast[0] === p.guest
    && event.location === SOURCES[p.guest][1] && event.area === SOURCES[p.guest][2]
    && p.purposeChosenEventId === event.id && p.purposeChosenOccurredAt === event.occurredAt
    ? { description: bank.choice, prose: bank.chosen } : null;
  if (!Object.hasOwn(names, p.lead) || !purposePlace(p.guest, event.location, event.area)
    || !string(p.purposeChosenEventId) || !time(p.purposeChosenOccurredAt)
    || p.purposeChosenOccurredAt <= p.purposeSourceOccurredAt
    || p.purposeChosenOccurredAt >= event.occurredAt || !event.causedBy.includes(p.purposeChosenEventId)) return null;
  const n = names[p.lead], present = event.participants.length === 1 && event.participants[0] === p.lead
    && p.cast.length === 2 && p.cast.includes(p.lead) && p.cast.includes(p.guest);
  if (p.purposeStage === 'requested' && event.type === 'OFFSCREEN_ENCOUNTER' && present) return {
    description: bank.request(n), prose: bank.opening(n),
    ...((event.lines?.length || p.lines?.length) ? {} : { lines: [
      { who: p.guest, text: bank.ask }, { who: p.lead, text: bank.answer },
    ] }),
  };
  if (p.purposeStage !== 'result' || event.type !== 'OFFSCREEN_RESULT' || !string(p.purposeRequestEventId)
    || !time(p.purposeRequestOccurredAt) || p.purposeRequestOccurredAt <= p.purposeChosenOccurredAt
    || p.purposeRequestOccurredAt + PURPOSE_RULES.duration !== event.occurredAt
    || !event.causedBy.includes(p.purposeRequestEventId)) return null;
  if (p.purposeOutcome === 'shared' && present) return { description: bank.shared(n), prose: bank.ending(n) };
  if (p.purposeOutcome === 'unheard' && event.participants.length === 0 && p.cast.length === 0)
    return { description: bank.interrupted, prose: `${bank.interrupted} ${p.purposeRetired === true
      ? 'For now, the plan to share it was put aside.' : 'The plan to share it was still unfinished.'}` };
  return null;
}
