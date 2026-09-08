// The author's pass over the 90-day v1 run. This is the quality baseline.
//
// Everything the lab measures about itself is a proxy. This file is not a
// proxy: it is Chris reading 52 moments and saying which ones he would let a
// reader encounter. Every refinement in v2 is justified against a row in here,
// and any refinement that cannot point at a row is a refinement nobody asked
// for.
//
// Verdicts, as specified:
//   KEEP    I would happily have readers encounter this.
//   TUNE    premise right; line or action needs minor authoring.
//   GENERIC coherent but could belong to anybody.
//   WRONG   structurally plausible, wrong person — or wrong binding.
//   CUT     boring, nonsensical, repetitive, or not worth reader attention.
//
// `cause` is the author's stated reason, normalised into a failure class so the
// next improvement can be routed to the layer that owns it.

export const VERDICTS = Object.freeze(['KEEP', 'TUNE', 'GENERIC', 'WRONG', 'CUT']);

// Where the fix belongs. Assigned from the author's own words, not inferred.
export const FAILURE_CLASS = Object.freeze({
  semantic_binding: 'the line and the thing it bound to do not fit',
  scoring_leak: 'an influence contributed to an action it has nothing to do with',
  repetition_line: 'the exact wording has been seen too recently',
  repetition_callback: 'the same callback is being milked',
  repetition_signature: 'a signature action has become routine',
  not_content: 'valid action, but not worth a reader-facing moment',
  thin_context: 'characterful, but needs situational staging to land',
});

export const SUCCESS_FACTOR = Object.freeze({
  character_choice: 'the character chose something only they would choose',
  behaviour_collision: 'two behaviours met',
  environment: 'a world-state affordance made it specific',
  relationship: 'it is about these two people',
  memory: 'a past event made it possible',
  ability: 'a canon power, used in character',
  world_modifier: 'the day itself supplied the meaning',
  quip: 'the authored wording carried it',
  recombination: 'an unexpected pairing of line and target',
});

const r = (date, time, actor, action, bound, line, verdict, cause, factors, note) =>
  ({ date, time, actor, action, bound, line, verdict, cause, factors: factors ?? [], note });

export const REVIEW = Object.freeze([
  r('03-02', '08:30', 'goaden', 'call_back_earlier', 'ashai', 'Extremely.', 'TUNE', 'thin_context', ['memory'], 'Works as callback response, too thin alone.'),
  r('03-02', '11:30', 'ashai', 'call_back_earlier', 'goaden', 'You slept in it again.', 'CUT', 'repetition_callback', [], 'Same coat joke again only hours later.'),
  r('03-02', '13:30', 'goaden', 'wait_it_out', 'queue', 'Coat is warm. I can stand here all day.', 'CUT', 'repetition_callback', [], 'Third coat-related beat that day.'),
  r('03-02', '14:30', 'goaden', 'keep_distance', 'emily', 'I would rather see her from here.', 'KEEP', null, ['character_choice', 'relationship'], 'Very Goaden reacting to Emily.'),
  r('03-03', '14:30', 'goaden', 'wait_it_out', null, 'It will move.', 'TUNE', 'thin_context', ['character_choice'], 'Dry enough for him, generic without staging.'),
  r('03-03', '18:30', 'emily', 'use_fade', 'closed_path', 'Quicker.', 'KEEP', null, ['character_choice', 'ability'], 'Fantastic first demonstration of disproportionate Emily logic.'),
  r('03-04', '14:30', 'ashai', 'go_around', null, 'It is two minutes round. It is not worth the argument.', 'TUNE', 'thin_context', ['character_choice'], 'Sensible Ashai; needs situation specificity.'),
  r('03-06', '13:00', 'emily', 'observe_and_count', 'lanterns', 'Six hundred and fourteen... no. Six hundred and fifteen. One came back.', 'WRONG', 'semantic_binding', [], '"One came back" does not bind to lanterns.'),
  r('03-07', '14:30', 'goaden', 'move_it', null, 'Right.', 'CUT', 'not_content', [], 'Valid action, not worthwhile reader-facing fiction.'),
  r('03-07', '19:00', 'ashai', 'go_around', null, 'It is two minutes round. It is not worth the argument.', 'CUT', 'repetition_line', [], 'Same distinctive line three days later.'),
  r('03-08', '18:30', 'emily', 'observe_and_count', 'benches', 'I lost count at the bell. Starting again... starting again from the other end.', 'TUNE', 'thin_context', ['environment'], 'Weird enough to work; surface slightly mechanical.'),
  r('03-10', '14:30', 'ashai', 'ask_for_help', 'queue', 'Excuse me — is there a way through, or do we go round?', 'KEEP', null, ['character_choice'], 'A recognisable Ashai solution.'),
  r('03-11', '13:00', 'emily', 'observe_and_count', 'plaza_shadows', 'Forty-one so far. Forty-one. They do it without knowing they do it.', 'KEEP', null, ['character_choice', 'environment', 'world_modifier'], 'Eerie without explaining itself.'),
  r('03-13', '18:30', 'emily', 'observe_and_count', 'people_sheltering', 'In twos is faster. In twos... but you miss the odd one, and the odd one is the interesting one.', 'KEEP', null, ['environment', 'world_modifier'], 'Behaviour and environment compose properly.'),
  r('03-14', '13:30', 'goaden', 'wait_it_out', 'shut_gate', 'I am in no hurry. Are you in a hurry?', 'TUNE', 'thin_context', ['character_choice'], 'Characterful; needs obvious recipient.'),
  r('03-14', '14:30', 'goaden', 'move_it', null, 'Right.', 'CUT', 'not_content', [], 'Action can happen without becoming prose.'),
  r('03-15', '14:30', 'ashai', 'go_around', 'closed_path', 'It is two minutes round. It is not worth the argument.', 'WRONG', 'scoring_leak', [], 'Scores +6 for a lone child; the action does not address the child.'),
  r('03-16', '13:00', 'emily', 'use_fade', 'standing_water', 'It was in the way. Now it is not.', 'KEEP', null, ['character_choice', 'ability', 'quip'], 'Dark, funny, concise, character-specific.'),
  r('03-18', '18:30', 'emily', 'observe_and_count', 'people_avoiding', 'Nine since you got here. You are number nine.', 'KEEP', null, ['character_choice', 'behaviour_collision'], 'Genuinely creepy Emily.'),
  r('03-21', '13:00', 'emily', 'observe_and_count', 'people_avoiding', 'Six hundred and fourteen... no. Six hundred and fifteen. One came back.', 'TUNE', 'repetition_line', ['environment'], 'Situation works; memorable line already reused.'),
  r('03-21', '14:30', 'ashai', 'go_around', 'queue', 'It is two minutes round. It is not worth the argument.', 'CUT', 'repetition_line', [], 'Machinery visible.'),
  r('03-23', '18:30', 'emily', 'observe_and_count', 'plaza_shadows', 'I lost count at the bell. Starting again... starting again from the other end.', 'TUNE', 'repetition_line', ['environment'], 'Moment works, needs another surface form.'),
  r('03-24', '15:00', 'goaden', 'keep_distance', 'emily', 'Leave it.', 'KEEP', null, ['character_choice', 'relationship'], 'Tiny and relationship-specific.'),
  r('03-26', '13:00', 'emily', 'observe_and_count', 'crowd', 'Forty-one so far. Forty-one. They do it without knowing they do it.', 'WRONG', 'semantic_binding', [], 'What are they doing? crowd is not semantically specific.'),
  r('03-28', '18:30', 'emily', 'observe_and_count', 'pedestrians_looking_up', 'I lost count at the bell. Starting again... starting again from the other end.', 'KEEP', null, ['environment', 'recombination'], 'Very close to the gold-standard scene.'),
  r('03-31', '12:00', 'emily', 'use_fade', 'standing_water', 'Five. That one was five.', 'KEEP', null, ['character_choice', 'ability', 'quip'], 'Nasty in a very good way if that is the five-year cost.'),
  r('04-02', '17:30', 'emily', 'observe_and_count', 'lanterns', 'Nine since you got here. You are number nine.', 'WRONG', 'semantic_binding', [], 'Listener cannot be number nine in a lantern count.'),
  r('04-04', '12:30', 'goaden', 'wait_it_out', 'queue', 'Coat is warm. I can stand here all day.', 'CUT', 'repetition_callback', [], 'Callback overexposure.'),
  r('04-05', '12:00', 'emily', 'observe_and_count', 'bell_strikes', 'Six hundred and fourteen... no. Six hundred and fifteen. One came back.', 'WRONG', 'semantic_binding', [], 'A bell strike does not leave and return.'),
  r('04-07', '17:30', 'emily', 'observe_and_count', 'pigeons', 'I lost count at the bell. Starting again... starting again from the other end.', 'TUNE', 'repetition_line', ['recombination'], 'Combination works; line reused.'),
  r('04-10', '12:00', 'emily', 'observe_and_count', 'benches', 'Forty-one so far. Forty-one. They do it without knowing they do it.', 'WRONG', 'semantic_binding', [], 'Benches are not unconsciously doing anything.'),
  r('04-12', '17:30', 'emily', 'use_fade', 'closed_path', 'Quicker.', 'CUT', 'repetition_signature', [], 'Fade becoming a routine gag.'),
  r('04-15', '12:00', 'emily', 'observe_and_count', 'people_sheltering', 'In twos is faster. In twos... but you miss the odd one, and the odd one is the interesting one.', 'TUNE', 'repetition_line', ['environment'], 'Good structure, reused wording.'),
  r('04-17', '13:30', 'goaden', 'keep_distance', 'emily', 'She is fine. She is not the one I would be worrying about.', 'KEEP', null, ['character_choice', 'relationship'], 'One of the best in the file.'),
  r('04-17', '17:30', 'emily', 'observe_and_count', 'lanterns', 'Nine since you got here. You are number nine.', 'WRONG', 'semantic_binding', [], 'Same semantic binding failure.'),
  r('04-20', '12:00', 'emily', 'observe_and_count', 'crowd', 'Six hundred and fourteen... no. Six hundred and fifteen. One came back.', 'TUNE', 'semantic_binding', [], 'Could work if it means people in the crowd; affordance too broad.'),
  r('04-22', '17:30', 'emily', 'go_around', null, 'The long way is fine. I have got the time. I have got all of it.', 'KEEP', null, ['character_choice', 'quip'], 'Excellent double meaning for Emily.'),
  r('04-25', '12:00', 'emily', 'use_fade', 'standing_water', 'It was in the way. Now it is not.', 'KEEP', null, ['character_choice', 'ability'], 'Strong.'),
  r('04-27', '17:30', 'emily', 'wait_it_out', null, 'I can wait. I am extremely good at waiting.', 'KEEP', null, ['character_choice', 'quip'], 'Funny/odd without screaming creepy girl.'),
  r('04-30', '12:00', 'emily', 'observe_and_count', 'people_avoiding', 'In twos is faster. In twos... but you miss the odd one, and the odd one is the interesting one.', 'TUNE', 'repetition_line', ['environment'], 'Good binding, recycled presentation.'),
  r('05-02', '17:30', 'emily', 'observe_and_count', 'pedestrians_looking_up', 'Forty-one so far. Forty-one. They do it without knowing they do it.', 'KEEP', null, ['character_choice', 'environment', 'recombination'], 'Basically the exact magic we wanted.'),
  r('05-05', '12:00', 'emily', 'observe_and_count', 'people_sheltering', 'In twos is faster. In twos... but you miss the odd one, and the odd one is the interesting one.', 'TUNE', 'repetition_line', ['environment'], 'Good moment, bank showing through.'),
  r('05-07', '14:00', 'emily', 'observe_and_count', 'shelved_inks', 'Nine since you got here. You are number nine.', 'WRONG', 'semantic_binding', [], 'Semantic template mismatch.'),
  r('05-07', '17:30', 'emily', 'observe_and_count', 'pigeons', 'Six hundred and fourteen... no. Six hundred and fifteen. One came back.', 'KEEP', null, ['recombination'], '"One came back" suddenly makes perfect sense.'),
  r('05-10', '12:00', 'emily', 'observe_and_count', 'plaza_shadows', 'I lost count at the bell. Starting again... starting again from the other end.', 'TUNE', 'repetition_line', ['environment'], 'Strong manifestation; reused line weakens it.'),
  r('05-12', '17:30', 'emily', 'use_fade', 'standing_water', 'Five. That one was five.', 'TUNE', 'repetition_line', ['ability'], 'Could be a deliberate morbid motif; not random repetition.'),
  r('05-19', '12:30', 'goaden', 'wait_it_out', null, 'It will move.', 'TUNE', 'repetition_line', ['character_choice'], 'Dry Goaden, surface bank needs widening.'),
  r('05-20', '12:00', 'emily', 'go_around', null, 'The long way is fine. I have got the time. I have got all of it.', 'TUNE', 'repetition_line', ['quip'], 'Still strong, recognisably recycled.'),
  r('05-22', '17:30', 'emily', 'wait_it_out', null, 'I can wait. I am extremely good at waiting.', 'TUNE', 'repetition_line', ['quip'], 'Same.'),
  r('05-27', '17:30', 'emily', 'observe_and_count', 'plaza_shadows', 'Forty-one so far. Forty-one. They do it without knowing they do it.', 'CUT', 'repetition_line', [], 'Fourth time. I see the template.'),
  r('05-29', '14:00', 'emily', 'observe_and_count', 'shelved_inks', 'In twos is faster. In twos... but you miss the odd one, and the odd one is the interesting one.', 'TUNE', 'repetition_line', ['recombination'], 'Combination can work; line overused.'),
  r('05-30', '12:00', 'emily', 'use_fade', 'closed_path', 'Quicker.', 'CUT', 'repetition_signature', [], 'Seventh Fade. The shocking thing is now a commute shortcut.'),
]);

/** KEEP + TUNE. What survives to a reader, with or without a pass of authoring. */
export const keepable = row => row.verdict === 'KEEP' || row.verdict === 'TUNE';

export function summarise(rows = REVIEW) {
  const by = key => rows.reduce((map, row) => {
    const value = typeof key === 'function' ? key(row) : row[key];
    if (value == null) return map;
    (map[value] ??= []).push(row);
    return map;
  }, {});
  return {
    total: rows.length,
    verdicts: by('verdict'),
    byActor: by('actor'),
    byAction: by('action'),
    byLine: by('line'),
    byCause: by('cause'),
    keepRate: rows.filter(keepable).length / rows.length,
    pureKeepRate: rows.filter(row => row.verdict === 'KEEP').length / rows.length,
  };
}
