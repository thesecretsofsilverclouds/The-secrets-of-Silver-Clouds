import { createHash } from 'node:crypto';
import { atLondon, londonDate, nextLondonDay, MINUTE_MS as MIN } from './time.mjs';

// Something that takes more than one day, and ends.
//
// The gap this fills, read straight off four months of feed: the world produced
// thirty-four incidents, twenty-five surges and eighty-three moments of unease,
// and *every one of them resolved inside its own day*. A docket arrived with the
// bottom third burned away and nobody had sent it — a genuinely good hook — and
// then nothing followed it, ever. The pressure axis carried the residue across
// days, but the residue is a number, and a reader cannot see a number.
//
// So the texture was excellent and there was no plot, because a plot needs
// somebody to want something and somebody else in the way. An arc supplies both:
// a run of authored beats over several days that a reader can recognise as one
// story, escalating on a visible ladder, ending in a scene that costs something.
//
// Three rails, all inherited rather than invented:
//
//   * Nothing past the checkpoint. The masked figure is Nameless, who is in the
//     manuscript before p.183 [P00581-P00583] — the gas mask of weathered metal
//     and cracked leather, the crude smile scarred into the iron, the finger to
//     where his lips would be, and the Flicker. MI6 already holds follow-up
//     briefings about him in this world's own notices. Nothing is learnt about
//     who he is, because this world does not know and must not guess.
//   * The confrontation is a brush, not a victory. He gets away, exactly as he
//     does in the book. An arc that ended in his capture would be writing the
//     novel's plot, which is the one thing this engine may never do.
//   * Authored and seeded. Every line below is written; the arc picks its start
//     day by hash off the world's own pressure, and a replay is a no-op.
export const ARC_EVENT_TYPES = Object.freeze(['ARC_BEAT', 'ARC_CONFRONTATION', 'ARC_CLOSED']);
export const ARC_FACT_KINDS = Object.freeze(['arc_sign', 'arc_result']);
export const ARC_RULES = Object.freeze({
  version: 1,
  // A confrontation is a rare thing. The world must have been getting worse for
  // a while before one is allowed, and must then be left alone for a fortnight.
  // Two gates, not one. A confrontation on a bridge needs the world to have
  // been getting worse for a fortnight; a shopkeeper's tattoo following somebody
  // about does not. Arcs declare which they are and most of them are ordinary.
  opensAbove: 0.62,
  opensAboveOrdinary: 0.30,
  cooldownDaysOrdinary: 9,
  cooldownDays: 22,
  retainedArcs: 16,
  // A confrontation needs both of them on station. If the world will not give
  // that within a few nights, the arc ends the other way, which is its own kind
  // of ending and arguably the worse one.
  confrontationAttempts: 5,
  // A stage that names somebody in a place waits for them to actually go there.
  // It waits this many days and then gives up on that beat rather than
  // contradicting where the world says they are.
  presenceAttempts: 6,
  retainedActions: 64,
});

const hash = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
const number = value => parseInt(hash(value).slice(0, 8), 16);
const of = state => state.arcs ?? initialArcs();

export function initialArcs() {
  // `exhausted` is the list of one-off arcs that have already been told. It is
  // deliberately separate from `instances`, which is trimmed to the most recent
  // few — a mystery that scrolled out of the retained window would otherwise
  // become eligible again and replay its whole ladder verbatim.
  return { version: 1, activeId: null, issued: {}, instances: {}, exhausted: [], lastClosedDay: null };
}

// The one arc, written end to end. Each stage is a day; the reader sees the
// ladder because each beat names the one before it without explaining itself.
export const ARCS = Object.freeze({
  burned_dockets: {
    id: 'burned_dockets',
    title: 'The Burned Dockets', tier: 'danger', once: true,
    // Where the whole thing happens. MI6, because the point of it is that
    // something is getting *inside*.
    location: 'mi6',
    stages: [
      { key: 'first', at: '22:05', area: 'corridors',
        text: 'A docket arrived for the section with the bottom third burned away. Nobody had sent it, and the duty officer logged it under nothing in particular.' },
      { key: 'second', at: '21:40', area: 'corridors',
        text: 'A second docket, burned the same way, to the same depth, arrived at the same desk. The duty officer stopped logging it under nothing in particular and went to find somebody senior.' },
      { key: 'named', at: '20:15', area: 'common_room',
        text: 'The third one had a name on it. Ashai read what was left of her own name above the burn line, put the docket face down on the lunch hall table, and did not finish her meal. Goaden read it after her and said nothing at all, which from Goaden is a great deal.' },
      { key: 'smell', at: '19:30', area: 'corridors',
        text: 'The sealed corridor on the lower level was found open by four inches. It smelled of the same burn. Two agents went down it with lamps, came back up rather quickly, and reported that there was nothing to report.' },
      { key: 'seen', at: '21:10', area: 'corridors',
        text: 'Somebody was on the upper gantry at ten past nine, where nobody had any business being. Whoever it was did not run. They stood, and let themselves be looked at, and were gone by the time the corridor lights came up.' },
    ],
    // The payoff. Prose rather than plates, because the fourth person in the
    // room has no face the world owns and must not be given one.
    confrontation: {
      at: '21:20', area: 'corridors',
      prose: 'They caught him on the lower level with the fourth docket still in his hand.\n\n'
        + 'He was not hiding. That was the thing Ashai could not get past afterwards — he had waited, in a dead corridor, under a light that had been out for a month, with the burned paper held out slightly as though he were returning something borrowed. The mask was weathered metal and cracked leather with a crude smile cut into the iron of it, and the smoke that came off the filters went upward in the still air, and did not disperse.\n\n'
        + 'Goaden drew. Vega came out of the sheath with a sound the corridor made twice.\n\n'
        + 'What followed lasted about nine seconds. He gave up the docket in the first of them and the wall in the second, and after that it was Goaden going forward and the masked man going backward with an economy that was worse than speed — no wasted motion, no attempt to strike, only a man declining to be caught by a man who is very good at catching. Ashai came round the far side to close the corridor and he let her, which is how they both understood, too late, that he had already chosen the ending.\n\n'
        + 'At the shaft head he stopped. He raised one finger to where his lips would have been.\n\n'
        + 'Then the air went thin in the shape of him and he was not there, and the docket he had dropped went on burning very slowly along its bottom edge with nothing to burn it.',
      factText: 'A masked intruder was cornered on the lower level and Flickered out. Four burned dockets, one of them addressed to Ashai.',
    },
    faded: {
      factText: 'The burned dockets stopped arriving. Nothing was ever found on the lower level.',
      text: 'The dockets stopped. No fifth one came, and the lower level stayed shut, and after a week the duty officers stopped checking the desk first thing. Ashai kept the third one — the one with what was left of her name on it — in the drawer she does not open. Nothing was resolved. Things do sometimes simply stop, and that is worse than most endings.',
    },
    aftermath: {
      at: '08:20',
      text: 'The lower level was sealed again by morning, properly this time, and the fourth docket went upstairs in a box. Nobody at breakfast asked either of them about it. Kai did not leave Goaden\'s shoulder all day, and Greah spent the morning on the corridor sill facing the wrong way, watching the door.',
    },
  },
  // Conflict with a face on it. The Holy Order are already a faction posture in
  // this world and are canonically working the boroughs before the checkpoint;
  // what they have never done here is *notice the pair back*. This one ends in
  // an actual scrap, because the brief asked for one and because MI6 and the
  // Order colliding in a street is the most ordinary violence this side of the
  // reveal line — no revelation, no arrest, nobody's identity in play, and both
  // sides walking away because neither can afford the alternative.
  order_interest: {
    id: 'order_interest',
    title: 'The Order Take an Interest', tier: 'danger', once: true,
    location: 'mi6',
    stages: [
      { key: 'noticed', at: '18:40', area: 'corridors',
        text: 'An Order robe stood at the far end of the embankment for most of the evening, facing the barracks. Not watching a door, not watching a window. Watching the building, the way you look at a thing you have been told about.' },
      { key: 'twice', at: '17:55', area: 'common_room',
        text: 'The same robe, or one exactly like it, was at the Streamliner platform when they came through. Ashai clocked it on the way out and again on the way back, four hours apart, in the same place, and said so out loud in the lunch hall in a voice that made two captains look up.' },
      { key: 'asked', at: '19:05', area: 'corridors',
        text: 'A courier came to the gate with a folded card and no explanation. It carried an Order seal, a time, a bridge, and no name at all. MI6 advised in the strongest terms that it be ignored. Goaden read it twice and put it in his jacket rather than the bin, which everybody present noticed and nobody mentioned.' },
      { key: 'closer', at: '20:30', area: 'corridors',
        text: 'Three of them on the embankment now, and closer, and making no attempt to be anything other than three Order operatives standing in the open at the end of an MI6 street. The gate scanner logged four passes of the same figure in ninety minutes. Nobody came in. That was somehow the point.' },
    ],
    confrontation: {
      at: '20:50', area: 'corridors',
      prose: 'They went out to the embankment because the alternative was letting it happen again tomorrow.\n\n'
        + 'There were three, and then there were five, which is the oldest trick on a bridge and worked anyway. Nobody said anything first. The Order do not announce; that is a courtesy and courtesy is for people you intend to leave standing.\n\n'
        + 'Goaden took the first two before the river had finished carrying the sound of Vega leaving the sheath — not killing, nothing like it, just the brutal economy of a man moving three feet further forward than anybody expects and being extremely rude about it. The third got a hand up and a word out and the word cost him, because Ashai had come off the wall behind him at a speed that made the whole exchange briefly a matter of physics rather than opinion.\n\n'
        + 'The fourth was better. The fourth put Goaden into the parapet hard enough to take the wind out of the night, and for about four seconds the fight was genuinely a fight, blade against something that turned the lamplight the wrong way, both of them working at close range with nothing clever left.\n\n'
        + 'Then the fifth said one word from the far end of the bridge and all four of them stopped.\n\n'
        + 'He did not come closer. He looked at Ashai for slightly too long, and at Goaden for no time at all, and said that the Order had no instruction regarding either of them tonight. Then he took his people back along the embankment at a walk, in step, without hurrying, which was the most frightening part of the entire evening.\n\n'
        + 'Goaden stood in the road getting his breath back. "Tonight," he said.\n\n'
        + '"That is what he said," said Ashai. "Tonight."',
      factText: 'Five Order operatives on the embankment. Four of them fought; the fifth called it off and said the Order had no instruction regarding either of them tonight.',
    },
    faded: {
      factText: 'The Order stopped coming to the end of the street. No instruction was ever given and none was explained.',
      text: 'They stopped coming. The embankment was empty on the Thursday and empty on the Friday and by the following week the gate scanner had nothing unusual to log at all. No card, no seal, no explanation. Goaden kept the folded one in his jacket for a fortnight before he put it somewhere he would not look at it, which is not the same as throwing it away.',
    },
    aftermath: {
      at: '08:35',
      text: 'MI6 doubled the embankment watch by morning and found nothing to watch. The folded card went up to the assembly room in a bag. Ashai trained on the covered floor with the door open, facing it, and did not offer a reason.',
    },
  },
  // The uncanny one. No antagonist at all, which after the other two is the
  // point: some weeks the thing that is wrong is a place rather than a person.
  // The Streamliner is the pair's own everyday, which is what makes it work.
  wrong_platform: {
    id: 'wrong_platform',
    title: 'The Platform That Is Not There', tier: 'danger', once: true,
    location: 'streamliner',
    stages: [
      { key: 'listed', at: '12:20', area: 'transit',
        text: 'The Streamliner board listed a platform nine at a station that has eight. It listed it for eleven minutes, with a service time and a destination nobody could read, and then it did not.' },
      { key: 'again', at: '16:05', area: 'transit',
        text: 'Platform nine came back. Same eleven minutes, same unreadable destination, and this time three separate people photographed the board and all three photographs show eight platforms.' },
      { key: 'sound', at: '18:15', area: 'transit',
        text: 'A carriage went through the station at ten past six that no service log has any record of. Everybody on the platform felt it go past. Nobody agrees on which direction.' },
      { key: 'door', at: '13:40', area: 'transit',
        text: 'Ashai found a door in the tiled wall at the end of platform eight, in a stretch she has walked perhaps four hundred times. It was the right period, the right paint, the right amount of grime. It was locked. She photographed it, and went back an hour later with Goaden, and the wall was a wall.' },
    ],
    confrontation: {
      at: '19:55', area: 'transit',
      prose: 'Platform nine was there when they got to the station, and it was there long enough for both of them to walk onto it.\n\n'
        + 'It was an ordinary platform. That was the thing neither of them could put down afterwards — there was nothing eerie about it at all, no fog, no wrong angles, just tile and lamplight and a bench with a hundred years of paint on it and a board showing a service in four minutes to somewhere neither of them could hold in their heads for longer than it took to look away.\n\n'
        + 'The carriage came in on time.\n\n'
        + 'It was empty and it was lit and it had the wear of a thing in daily use, and when the doors opened the air that came out was warm and smelled of nothing whatsoever. Kai came off Goaden\'s shoulder and would not go near it. Greah put herself between Ashai and the gap and stayed there, glowing hard enough to throw shadows.\n\n'
        + 'They stood on the platform, and the doors stayed open, and it would have been the easiest thing in the world to step on.\n\n'
        + '"No," said Ashai, eventually, to nobody.\n\n'
        + 'The doors closed. The carriage left in the direction of a tunnel that platform eight does not have, and the sound of it going did not fade so much as stop, all at once, the way a held note stops.\n\n'
        + 'Then they were standing at the end of platform eight in front of a tiled wall, and the station was doing its ordinary evening business behind them, and Goaden was gripping Vega hard enough that it took him a moment to let go.',
      factText: 'Platform nine was real for four minutes. A carriage came in, the doors opened, and they did not get on.',
    },
    faded: {
      factText: 'Platform nine stopped appearing on the board. The wall at the end of platform eight is a wall.',
      text: 'Platform nine stopped appearing. The board behaved, the service logs balanced, and the wall at the end of platform eight went on being a wall through every one of the several hundred further times Ashai walked past it and did not look at it. She has the photograph. The photograph shows a door.',
    },
    aftermath: {
      at: '09:10',
      text: 'The Streamliner authority found no fault, logged no service, and closed the file in a single line. Ashai went back to the station in the morning on her own and stood at the end of platform eight for a while. Goaden did not ask where she had been and she did not say, which is the arrangement they seem to have arrived at about this.',
    },
  },
  // ── ACTION ────────────────────────────────────────────────────────────────
  // Objective: work out why the Lintels are massing before the MEU cull them.
  // Ends in a success, and the person who solves it never says a word — Captain
  // Hammond took a vow of silence when the Alchemical society fell [M66], so he
  // writes. Lintels feeding on ambient magic is established world texture here.
  lintel_roost: {
    id: 'lintel_roost', title: 'The Roost', tier: 'ordinary', once: true, location: 'mi6',
    stages: [
      { key: 'count', at: '17:20', area: 'corridors',
        text: 'The Lintel count over the embankment went from two to nine in a day, and the MEU wrote it down as within tolerance. Ashai, who has been watching them out of the corridor window for a year, said it was not within anything.' },
      { key: 'where', at: '18:05', area: 'corridors',
        text: 'She was right about where, at least. They were not drifting; they were going somewhere. All nine came off the river on the same line and over the same roof, three streets back, and did not come out again.' },
      { key: 'building', at: '16:40', area: 'common_room',
        text: 'The roof belonged to a bonded store that has been shut since the Alchemical society fell. Nobody at MI6 had a key. Everybody at MI6 had an opinion, and the MEU\'s opinion was a cull notice with a date on it.' },
      { key: 'hammond', at: '19:15', area: 'common_room',
        text: 'Captain Hammond put his cold cup down, turned the cull notice over, and wrote four words on the back of it. Ashai read them, and then read them again, and then went to find a lamp. Hammond returned to not saying anything, which he does at a volume.' },
      { key: 'inside', at: '20:00', area: 'corridors',
        text: 'They got the door open at eight with a warrant nobody had wanted to sign. The count in the roof space was thirty-one. Whatever the Lintels were feeding on was under the floor, and it had been leaking gently into the borough for eleven years.' },
    ],
    confrontation: {
      at: '20:40', area: 'corridors',
      prose: 'It was a decant line. Four inches of alchemical brass under a floor nobody had lifted since the society folded, weeping ambient charge into the London clay at a rate too small for anybody to bill for and exactly large enough to feed a flock.\n\n'
        + 'The Lintels were not hostile. That was the part the cull notice had assumed and the part Ashai had refused to assume, and standing under thirty-one of them in a roof space at eight in the evening she was extremely glad of it. They were roosting. They were the shape of a thing that has found a warm place.\n\n'
        + 'Goaden held the lamp and did not make a single joke, which he would later claim was concentration.\n\n'
        + 'Capping it took forty minutes and both of them flat on their fronts in eleven years of dust, and it was completely undramatic, and the flock came off the roof in one great turning sheet as the charge went out of the floor — up over the bonded store and out along the river, thinning as they went, going back to feeding off the whole city instead of one dead building.\n\n'
        + 'The MEU withdrew the notice the following morning without acknowledging that there had ever been one.',
      factText: 'A leaking decant line under a bonded store was drawing the Lintel flock. Capped, and the cull notice withdrawn.',
    },
    faded: {
      factText: 'The Lintel flock over the bonded store dispersed on its own before anything was done about it.',
      text: 'The flock thinned out on its own before anybody got a warrant signed, and the MEU quietly let the cull date pass. Ashai went back to the street twice. The building is still shut. Whatever was under the floor is presumably still under the floor.',
    },
    aftermath: { at: '08:15',
      text: 'The count over the embankment was back to two by morning. Ashai left the cull notice on the lunch hall table with Hammond\'s four words still on the back of it, face up, where the day shift would see it. Hammond did not look at her when she came in, and moved the second chair out.' },
  },
  // Objective: get the Streamliner's third carriage safe before somebody is
  // burned. Ends in a costly compromise — they are right, and being right shuts
  // a line for a week and costs a man his registration.
  third_carriage: {
    id: 'third_carriage', title: 'The Third Carriage', tier: 'ordinary', once: true, location: 'streamliner',
    stages: [
      { key: 'warm', at: '13:15', area: 'transit',
        text: 'The third carriage was running warm again. It has been running warm for a month and the board has been saying so for a month, in a font that suggests nobody involved considers it their problem.' },
      { key: 'burn', at: '17:35', area: 'transit',
        text: 'A passenger put a hand on the third carriage bulkhead at half five and took the skin off two fingers. Services continued. The bulkhead was covered with a laminated notice apologising for the inconvenience.' },
      { key: 'log', at: '12:50', area: 'transit',
        text: 'Ashai asked for the maintenance log and got it, which was the surprise. The surprise after that was that four entries were in the same hand and the same ink and dated across five weeks, and that the coupling they described being checked is not a coupling that carriage has.' },
      { key: 'davis', at: '18:20', area: 'corridors',
        text: 'Agent Davis put a name to the handwriting without being asked and then rather wished she had not. She had signed his bonding paperwork herself, nine years ago, and she said so before anybody could find it out and mention it to her.' },
      { key: 'ride', at: '21:05', area: 'transit',
        text: 'They rode the last service of the night in the third carriage with the heating off and the temperature climbing anyway. At Blackfriars it reached the point where the window frames ticked. Goaden put his palm flat on the floor and left it there until he could not.' },
    ],
    confrontation: {
      at: '22:10', area: 'transit',
      prose: 'The coupling was in a service void under the third carriage, and it was not a coupling. It was a Holy Item — small, old, unregistered and entirely unsuitable — wired in as a heating element because it ran hot for nothing and never needed charging.\n\n'
        + 'He was there when they found it. He had come to check it, the way he had come to check it every week for five weeks and written down that he had checked something else.\n\n'
        + 'There was no fight. He sat down on the running board with his hands on his knees and told them the whole of it in about ninety seconds: that the proper part had been on order since March, that the carriage would have been withdrawn without something in the slot, that withdrawing it would have taken the evening service down to two carriages, and that he had believed — genuinely, and he said it twice — that he was the only person who would ever be hurt by it.\n\n'
        + '"You were not," said Ashai.\n\n'
        + '"No," he said. "I know. I saw the notice they put on the bulkhead."\n\n'
        + 'Goaden lifted the item out with his jacket wrapped round his hand and it was still warm three hours later.',
      factText: 'An unregistered Holy Item was wired into the third carriage as a heating element. The carriage was withdrawn; the man who did it lost his bonding.',
    },
    faded: {
      factText: 'The third carriage was withdrawn from service without explanation before anybody established why it ran hot.',
      text: 'The carriage was withdrawn on the Thursday with no reason given, and the evening service dropped to two, and the borough complained about that instead. Ashai never got the rest of the log. Davis stopped bringing the subject up, which from Davis is not the same as having stopped thinking about it.',
    },
    aftermath: { at: '09:00',
      text: 'The third carriage was cut from the sets overnight and the evening service ran short for a week, which the boroughs were extremely vocal about. The item went to the MEU in a box with two seals on it. Davis countersigned the withdrawal of his bonding herself rather than let it go to somebody who did not know him, and then worked the rest of her shift, and did not take the twenty minutes she is owed.' },
  },
  // ── CHARACTER ─────────────────────────────────────────────────────────────
  // Objective: Yukon wants to beat Goaden at the game, once, properly. Canon:
  // Yukon is Onari and shifts shape [M65]; the rematch is already one of this
  // world's own institutional notices. Ends in an embarrassing victory.
  yukon_rematch: {
    id: 'yukon_rematch', title: 'Yukon Wants a Rematch', tier: 'ordinary', once: true, location: 'mi6',
    stages: [
      { key: 'challenge', at: '19:20', area: 'gaming_room',
        text: 'Yukon challenged Goaden to a rematch in front of eleven people, a decision he appeared to regret from about the fourth word onward. A date was set. Money was not involved, which everyone agreed made it worse.' },
      { key: 'practice', at: '22:30', area: 'gaming_room',
        text: 'The gaming room light was on at half ten with one person in it. It was on at half ten the following night as well. Nobody said anything, on the grounds that saying something would have been unbearable for everybody.' },
      { key: 'caught', at: '21:45', area: 'gaming_room',
        text: 'Ashai came in for the good chair and found Yukon with four extra fingers on his left hand, mid-shift, absolutely rigid with guilt. He put them away. She let a very long silence happen. Then she said she would not tell Goaden, and he said that was worse, and she agreed that it was.' },
      { key: 'apology', at: '18:50', area: 'common_room',
        text: 'Yukon apologised to Goaden at dinner for something Goaden had not known about, in detail, unprompted, at a table with six other people at it. Goaden listened to the whole thing with a face like a man watching a controlled demolition and then said the rematch was still on.' },
    ],
    confrontation: {
      at: '20:30', area: 'gaming_room',
      prose: 'Yukon won.\n\n'
        + 'He won with both hands the correct shape and eighteen people watching, on the section that had beaten him for a month, by four seconds and a margin nobody could dispute. The gaming room made a noise it has not made since the brass put the screen in for morale.\n\n'
        + 'And then, in the silence afterwards, while Goaden was actually offering him a hand, Yukon said: "Three weeks. I have been practising for three weeks. Every night. I worked out your route on the second Tuesday."\n\n'
        + 'There is a particular quality of silence available to a room of eighteen off-duty operatives when somebody explains their own victory into the ground, and the gaming room found all of it.\n\n'
        + '"I know," said Goaden.\n\n'
        + '"You know?"\n\n'
        + '"The light was on. Every night. It is a window, bro."\n\n'
        + 'Yukon looked at his own hands for a while. Then he said, in a much smaller voice, that he would like it on the record that he had still won, and Ashai said that it was on the record, and that everybody was going to be putting it on the record for months.',
      factText: 'Yukon beat Goaden at the game, fairly, and then explained exactly how long he had practised, in front of eighteen people.',
    },
    faded: {
      factText: 'The rematch never came off. The gaming room booking lapsed twice and then stopped being mentioned.',
      text: 'The rematch did not happen. It was moved for a callout, and moved again for a briefing, and after the third time nobody rebooked the screen. Yukon still practises. The light is still on at half ten some nights, and Goaden still walks past the window and does not knock.' },
    aftermath: { at: '08:40',
      text: 'By breakfast it had reached the corridors, the operations room and, somehow, the Streamliner platform. Three separate people asked Yukon how the three weeks had gone. He has begun claiming it was two.' },
  },
  // Objective: Ashai wants to know why Captain Hammond keeps putting the second
  // chair out. Ends in a deliberate refusal — she finds out, and keeps it.
  // Hammond's vow of silence after the Alchemical society's fall is canon [M66];
  // nothing here breaks it and nothing here is lore.
  second_chair: {
    id: 'second_chair', title: 'The Second Chair', tier: 'ordinary', once: true, location: 'mi6',
    stages: [
      { key: 'notice', at: '12:40', area: 'common_room',
        text: 'Captain Hammond has a corner table and two chairs, and he has never once sat at it alone without moving the second chair out. Ashai has eaten in that hall for two years. She noticed it on a Tuesday, which is how noticing works.' },
      { key: 'pattern', at: '13:10', area: 'common_room',
        text: 'It is not an invitation to whoever is nearest. Ashai watched for a week. The chair comes out at the same hour whether anybody takes it or not, and goes back at the same hour, and on the days he does not come to the hall at all it does not happen.' },
      { key: 'davis', at: '17:50', area: 'corridors',
        text: 'Davis knew, and would not say, and was decent about not saying it — no arch look, no half-hint. Just: it is his, ask him. Ashai pointed out that he does not speak. Davis said that was rather the point and went back to her screens.' },
      { key: 'sitting', at: '12:55', area: 'common_room',
        text: 'So Ashai took the chair. Four days running, for the length of a cold cup each time, saying nothing, because that is the only conversation on offer. On the fourth of them Hammond moved the salt so she could reach it, which after four days felt like being handed something.' },
      { key: 'napkin', at: '13:05', area: 'common_room',
        text: 'On the fifth day he wrote on a napkin, folded it once, and put it under her cup. He did not watch her read it. He finished his cold cup at his own speed, inclined his head, and went back to the corridors.' },
    ],
    confrontation: {
      at: '19:40', area: 'common_room',
      prose: 'It was a name and a year.\n\n'
        + 'That was all it was. One name Ashai did not recognise, and a year she did — the year the Alchemical society came apart and a great many people stopped being alchemists, and a smaller number stopped being anything.\n\n'
        + 'She sat with it in the lunch hall until the evening crowd had come and gone.\n\n'
        + 'Goaden found her there at twenty to eight and asked, in the way he asks, which is by sitting down and not asking. She had the napkin in her hand. He looked at her hand and then at her face and waited, because he is better at that than he lets on.\n\n'
        + '"It is his," she said.\n\n'
        + 'And that was the end of it. Goaden nodded once and let the subject close and did not raise it again, then or later, and the two of them sat in the emptying hall while the lights went down a bank at a time.\n\n'
        + 'Ashai put the napkin in her jacket. It is still there.',
      factText: 'Captain Hammond wrote down why he keeps the second chair out. Ashai read it and did not repeat it.',
    },
    faded: {
      factText: 'Hammond never explained the second chair, and Ashai stopped asking.',
      text: 'He never wrote anything. Ashai took the chair for a fortnight and then the week got in the way, and then it had been a month, and the chair goes on coming out at the same hour for nobody in particular. She has stopped intending to find out. She has not stopped noticing.' },
    aftermath: { at: '12:45',
      text: 'The second chair came out at the usual hour. Ashai took it, as she now does perhaps twice a week, and the two of them said nothing at each other over a cold cup for twenty minutes. Greah has taken to waiting on the back of it.' },
  },
  // ── STRANGE AND FUNNY ─────────────────────────────────────────────────────
  // Objective: get the tattoo design to stop following Ashai. Living ink is
  // canon [M101]. Ends in an absurd success: the fix is to stop looking at it.
  ink_admirer: {
    id: 'ink_admirer', title: 'The Ink Has Taken a View', tier: 'ordinary', once: true, location: 'enchanted_ink',
    stages: [
      // This sentence puts Ashai inside the shop, so it may only be told while
      // she is inside the shop. Without `needs`, the beat fired on the clock at
      // 14:30 and reported her browsing Enchanted Ink two minutes after she
      // started training at MI6.
      { key: 'follows', at: '14:30', area: 'venue', needs: 'ashai',
        text: 'The small drifting lintel design followed Ashai three shelves at Enchanted Ink, which she has decided to find flattering rather than the alternative.' },
      { key: 'window', at: '15:10', area: 'venue',
        text: 'It was on the inside of the shop window when they walked past four days later, on a street the shop had not been on when they last saw it. It was, unmistakably, facing out.' },
      { key: 'gabriel', at: '18:35', area: 'venue',
        text: 'Gabriel arrived at the Ink for wings and left with a small drifting lintel on his forearm that he had not asked for, had not paid for and could not get anybody to take responsibility for. He was, by his own later account, gracious about it. Nobody who was there supports this account.' },
      // This one happens at the Silver Spoon, not the Ink, so it carries its own
      // `location`: both the guard and the event's filing use it. Without that
      // the sign could put Ashai at a cafe table while she is elsewhere, and
      // would then be recorded as having happened at Enchanted Ink.
      { key: 'stranger', at: '14:05', area: 'venue', needs: 'ashai', location: 'cafe',
        text: 'A woman at the next table in the Silver Spoon had it on the back of her hand. She had never been to Enchanted Ink. She thought it was very sweet and asked Ashai whether she knew what it was, and Ashai said no, twice, with increasing conviction.' },
    ],
    confrontation: {
      at: '15:40', area: 'venue',
      prose: 'The shop, when they finally cornered it about the matter, was completely unembarrassed.\n\n'
        + 'The tattooist explained it the way you would explain a fault in a boiler. The wall keeps a count. It has always kept a count. Designs that get looked at move toward the looking, and the one that gets looked at most in a given month goes on tour — window, regulars, whoever is nearest — because that is how the wall advertises, and it has been doing it since the Shattering and nobody has ever thought to mention it because nobody has ever asked.\n\n'
        + 'Ashai had topped the count three months running.\n\n'
        + '"So it is not following me," she said.\n\n'
        + '"It is going where the interest is," said the tattooist. "You are the interest."\n\n'
        + 'The remedy, delivered with the air of a man who has given it many times, was to stop looking at it.\n\n'
        + 'This proved to be the hardest thing Ashai had attempted all month. She managed nine minutes on the shop floor with her eyes deliberately elsewhere while the design tried increasingly undignified manoeuvres in her peripheral vision, and Goaden — who was no help whatsoever and made no pretence of being help — timed it.\n\n'
        + 'On the tenth minute it gave up and went back to the wall.\n\n'
        + 'It was on Gabriel again by Thursday. He has stopped complaining about it.',
      factText: 'The drifting lintel design was following the shop\'s own attention count. Ashai had topped it three months running.',
    },
    faded: {
      factText: 'The drifting design stopped appearing. Nobody at the Ink was ever asked to account for it.',
      text: 'It stopped. No explanation, no apology, and the shop was on a different street by the time anybody got round to asking. Gabriel still has his. He has begun telling people it was commissioned.' },
    aftermath: { at: '13:20',
      text: 'The Ink was two streets over by the weekend, between a locksmith and nothing at all. Ashai walked past on the other side of the road, on purpose, looking straight ahead. Goaden reported this to at least four people.' },
  },
  // Objective: find out why New Big Ben is ringing early before the borough's
  // clocks all follow it. Ends in a success supplied by a child on a swing —
  // and nobody quite thanks her, which is the sting.
  chimes_early: {
    id: 'chimes_early', title: 'The Chimes Are Early', tier: 'ordinary', once: true, location: 'big_ben_plaza',
    stages: [
      { key: 'early', at: '12:15', area: 'venue',
        text: 'New Big Ben rang forty-one seconds early. It has rung forty-one seconds late since the Chimes were hung, which every Londoner knows and half of them will tell you about, so ringing exactly that far the other way felt less like a fault than a remark.' },
      { key: 'doubling', at: '16:20', area: 'venue',
        text: 'Eighty-two seconds early the next day. A hundred and sixty-four the day after: not another forty-one, but twice the last one, every morning. The Belfry Tuner went up the tower twice, found the frame true, the weights right and the harmonics clean, and came down looking like a man who would rather have found something broken.' },
      { key: 'following', at: '17:45', area: 'venue',
        text: 'The borough clocks began to follow. Not all at once — the ones tuned off the belfry first, then the market bells, then the Streamliner departure board, which is when it stopped being a curiosity and started being a problem with a committee attached.' },
      { key: 'emily', at: '18:10', area: 'venue',
        text: 'A girl on the swing at the edge of the plaza gardens said, without being asked and without stopping swinging, that it was forty-one and then eighty-two and then a hundred and sixty-four and three hundred and twenty-eight today, and that tomorrow it would be six hundred and fifty-six, and the day after that one thousand three hundred and twelve, and after that she stopped counting and said it just keeps going. Ashai wrote all of it on her hand. Nobody else appeared to have heard.' },
    ],
    confrontation: {
      at: '11:50', area: 'venue',
      prose: 'The child was right, and being right was the whole of it.\n\n'
        + 'Forty-one seconds, and then twice that, and then twice that again. Not drifting — drift is untidy and this was arithmetic, and once the Belfry Tuner had the sequence written down in front of him in biro on the back of Ashai\'s hand he stopped talking mid-sentence and went up the tower at a speed no clocksmith of his years should attempt.\n\n'
        + 'The fault was in the Renewal escapement, which is not a clock part. It is the part that lets the peal do what the peal does, and it had been re-cut in the spring by somebody competent and re-hung by somebody who had counted the teeth correctly and set them one place round.\n\n'
        + 'One place. Forty-one seconds on the first morning, and double the morning before on every one after it — which is nothing at all for four days and eleven minutes by the sixth.\n\n'
        + 'They caught it at noon the following day with the borough clocks six hundred and fifty-six seconds adrift, which is the exact number a child on a swing had given Ashai the evening before, and the Streamliner board announcing services that had not left. The Tuner and two apprentices took forty minutes over it. Goaden and Ashai stood in the plaza with about a thousand other people and watched a tower, which is not an action, and it was one of the most tense hours either of them had had in months.\n\n'
        + 'She rang true at one. The plaza made a noise you could feel in the paving, and the motes went up off the tower in their hundreds, and the market bells came back into line over the following hour like a room of people being tuned.',
      factText: 'The Renewal escapement had been re-hung one tooth out in the spring. Forty-one seconds, doubling every morning. Corrected with the clocks six hundred and fifty-six seconds adrift.',
    },
    faded: {
      factText: 'The Chimes corrected themselves overnight and the belfry never established why.',
      text: 'She came back into line on her own, overnight, between one morning and the next, and the borough clocks followed her back over about a week. The Belfry Tuner has never accepted this. He has a folder now. He would like it known that he has a folder.' },
    aftermath: { at: '09:30',
      text: 'The Tuner was written up in three papers and gave a quote to each. The girl on the swing was not mentioned in any of them, and was not on the swing when Ashai went back to the gardens two days later, and had left the grey bag on the grass under it.' },
  },
  // ── KINETIC ───────────────────────────────────────────────────────────────
  // Exhilarating. Objective: get the stolen plate back before Enchanted Ink
  // phases overnight and takes the theft with it. Living ink is canon [M101];
  // the shop moving streets is this world's own established behaviour. The
  // rooftops are named and reused so the chase is followable, and the setback
  // at Carter Lane forces a different route rather than a harder push.
  ink_runs: {
    id: 'ink_runs', title: 'The Ink Runs', tier: 'ordinary', once: true, location: 'enchanted_ink',
    stages: [
      { key: 'still', at: '15:10', area: 'venue',
        text: 'There was a gap in the back wall of Enchanted Ink the size of a hand, four plates in from the left, where there has not been a gap since the shop opened. The tattooist found it at three and reacted to it by sitting down on the floor.' },
      { key: 'anchor', at: '16:25', area: 'venue',
        text: 'One plate was missing from the middle of the wall: a piece of brass the size of a hand carrying the oldest living design the shop owns — ninety years on the wall, worth more than the building, and impossible to replace because the person who cut it is dead. Somebody had come in during the phase and lifted it. The tattooist gave them a deadline without being asked: the shop moves tonight, and once it has moved nobody finds it until it wants finding, so whatever is not back on the wall by midnight is gone for good.' },
      { key: 'signal', at: '11:40', area: 'venue',
        text: 'The design was still moving, which is the one thing about living ink a thief cannot do anything about. Kai found the flicker of it from three hundred feet over Blackfriars in under an hour — a small brass rectangle turning over and over in a coat pocket, going the wrong way up the river, at walking pace.' },
      { key: 'yard', at: '14:15', area: 'venue',
        text: 'They took him in a yard off Carter Lane and he gave up immediately, which is when it became clear he was the second man and not the first. The plate went over the wall to somebody on a bike before Goaden had a hand on him, and the bike was gone before Ashai reached the gate, and the plate was on the roofs by four.' },
    ],
    confrontation: {
      at: '17:30', area: 'venue',
      prose: 'The roofline from Carter Lane runs east: locksmith, three terraces, the glass canopy over the arcade, then the gap, then the bonded store with the scaffolding still up. Two hours to the phase. Goaden went up the locksmith\'s drainpipe and was on the terraces inside a minute.\n\n'
        + 'The man with the plate was good. He was small and he knew the roofs, and he went over the terraces at a flat sprint with a lead of about forty feet, and Goaden — who is faster over open ground than anybody has a right to be — spent three roofs closing it to twenty and none of them closing it further.\n\n'
        + 'Then the arcade canopy, and the runner went straight over it because he weighed nine stone, and Goaden went two steps onto the glass and heard it start.\n\n'
        + 'He came off it sideways onto the parapet, which cost him the twenty feet and all of the momentum, and by the time he was up the runner was at the Carter Lane gap and across it and gone, and the gap is eleven feet and Goaden had nothing left to take it with.\n\n'
        + 'So he stopped, and shouted one word down into the street, and did the other thing.\n\n'
        + 'Kai went past him at head height and up, and the plate in the runner\'s coat did what living ink does when something it wants goes overhead: it turned. Hard enough to pull the coat. Hard enough to put a man off his stride on a wet roof, which bought four seconds — and four seconds was how long Ashai needed, because she had not gone up at all. She had gone along the arcade at ground level, through the market, and up the bonded store scaffolding on the far side of the gap, and she came over the parapet in front of him with her hand already out.\n\n'
        + 'He went sideways off the scaffold rather than give it up, and caught the third lift with one arm, and hung there over forty feet of loading yard with the plate in his other hand.\n\n'
        + 'There was a moment. There was very clearly a moment.\n\n'
        + 'Goaden made the gap on the scaffold boards a second later and had one grab in him, and he took the man.\n\n'
        + 'The plate went. Kai got under it eight feet off the cobbles and could not hold it — a dragon the size of a cat and a hand of solid brass — and the two of them came down together in a heap of scales and swearing, and the plate rang off the stone with a noise like a dropped bell.\n\n'
        + 'It was back on the wall forty minutes before the phase, with a crack across it from the top corner to the middle of the design. Ninety years without a mark on it and it went off a scaffold onto London stone. The design still moves. It moves with a catch in it now, on the turn, that it did not have on the Tuesday, and it will do that for as long as the Ink is a shop.\n\n'
        + '"You could have had the plate," said the tattooist, not unkindly.\n\n'
        + '"Yeah," said Goaden.',
      factText: 'The Ink\'s oldest plate was recovered off the bonded store scaffolding, cracked. Goaden took the thief instead of the plate.',
    },
    faded: {
      factText: 'The Ink\'s oldest plate was not recovered before the shop phased.',
      text: 'The shop phased at midnight with the plate still out there somewhere, and the wall came up on its new street four plates in from the left with a gap in it. Nine days now. The tattooist has not replaced it and will not, and has taken to standing in front of the space when the shop is quiet. Ashai has been back to Carter Lane four times.' },
    aftermath: { at: '09:20',
      text: 'The runner gave up the first man inside an hour and the pair of them turned out to be collectors rather than anything more interesting, which was somehow worse. Kai spent the morning asleep on the warm end of the piano and would not be moved. Ashai went to the Ink on her way past and watched the cracked one turn a few times, catching each time in the same place, and the design she likes drifted over and sat under her hand.' },
  },
  // Tense. Objective: get a grounded Lintel airborne before the MEU process it.
  // Established behaviour throughout: Lintels feed on ambient magic and gorge
  // near a leak; the MEU are procedural rather than hostile — cones, a van and
  // a form — and the plaza notice already warns that feeding them is a bad idea
  // and that they will take the sandwich anyway.
  lintel_down: {
    id: 'lintel_down', title: 'The One That Came Down', tier: 'ordinary', once: true, location: 'big_ben_plaza',
    stages: [
      { key: 'down', at: '13:05', area: 'venue',
        text: 'A Lintel came down in the plaza gardens at one and did not get up again. It was not hurt. It sat on the grass with its wings half out, the size of a large dog and the colour of weather, turning its head at things, and could not lift.' },
      { key: 'crowd', at: '14:20', area: 'venue',
        text: 'By two there were sixty people round it and four of them were feeding it. The notice on the railings says not to. The notice on the railings has said not to for years. It ate everything it was given, because that is what they do, and got heavier, and stopped trying.' },
      { key: 'meu', at: '16:00', area: 'venue',
        text: 'The MEU logged it at four and gave an attendance window of two hours. They were not unkind about it. They were procedural: a grounded familiar in a public space is a containment item, the van has a crate in it, and nothing that goes into the crate has ever been recorded coming back out.' },
      { key: 'why', at: '17:10', area: 'venue',
        text: 'Ashai worked out why it could not lift, which nobody else had tried to do. It was saturated — gorged on something and then gorged on sandwiches — and the plaza sits directly under the belfry, and the standing harmonic off New Big Ben was holding it down like a hand on a kite.' },
    ],
    confrontation: {
      at: '17:55', area: 'venue',
      prose: 'Five past six. The van was due at six.\n\n'
        + 'Ashai had two problems and forty minutes, and took the crowd first, because the crowd was the one that would not wait. Not by asking — by walking the railing line with her jacket open and her service card up and being extremely boring about it, sixty people at a time, until there were twelve feet of empty grass on every side of the creature and a plaza full of people filming from behind a rope that had not existed at ten to.\n\n'
        + 'The second problem was that a Lintel too full to fly is also too full to be picked up.\n\n'
        + 'It is the size of a large dog and it weighs like wet sand, and the standing harmonic off the belfry sits over the gardens and not over the plaza steps forty feet east. Forty feet is nothing at all unless you are moving something that does not want to be moved and cannot be lifted. So they dragged it. That was the plan and that was the whole of the plan: a tarpaulin off the market railings, both of them on the corners, Goaden hauling and Ashai steering it round by the shoulders, and forty feet of wet grass in eleven minutes.\n\n'
        + 'It fought them for about half of that — not viciously, just enormously, the way a frightened thing that has never been handled fights. It got a claw into her forearm at nine minutes and she kept hold of it anyway. Greah went up and hung over the pair of them at a brightness that hurt to look at, which is not a thing Greah does, and Goaden talked to a plaza of two hundred people in the tone of a man who has decided nobody is going to argue with him.\n\n'
        + 'They got it onto the flagstones at four minutes to.\n\n'
        + 'And it still did not go, because it was still gorged, and Ashai sat down on the cold stone with one hand on its ridge and waited for the hour, which was an appalling plan and the only one left.\n\n'
        + 'New Big Ben rang forty-one seconds late, as it has rung forty-one seconds late since the Chimes were hung. The peal came up through the flagstones. Whatever it is that a Lintel takes out of the air it took all of it at once — and it went, straight up, forty feet, and then caught properly and came round over the gardens once, low, right over the rope, close enough that the whole plaza ducked, and away east along the river with the motes still rising off the tower around it.\n\n'
        + 'The MEU arrived at four minutes past six to an empty patch of flattened grass, a dispersing crowd, a tarpaulin nobody could account for, and one MI6 agent sitting on the steps with her forearm wrapped in a market scarf and nothing to say that would fit on a form.',
      // Not prose-only. `shaken` is one of the two condition kinds the world
      // already approves, and the midnight rollover already clears it, so the
      // cost is real for the rest of the evening and consistent by morning.
      shakes: 'ashai',
      factText: 'A gorged Lintel was dragged clear of the belfry harmonic and went up on the six o\'clock peal, four minutes before the MEU containment van arrived. Ashai took a claw to the forearm holding it.',
    },
    faded: {
      factText: 'The grounded Lintel was taken by the MEU containment van from the plaza gardens.',
      text: 'The van came at six and two MEU officers put it in the crate, politely, with a leaflet for the crowd and a form for the gardens. It did not struggle. Ashai watched the whole thing from the railings with her hands in her pockets and has not been back to the gardens since, which Goaden has noticed and has not mentioned.' },
    aftermath: { at: '08:55',
      text: 'The night watch cleaned and dressed the forearm, which was four inches of shallow tear and looked considerably worse than it was. Ashai slept badly and trained on the covered floor in the morning anyway, one-handed, and was extremely rude to anybody who suggested otherwise. The patch of gardens they dragged it across is still flat. Children have started daring each other to lie on it.' },
  },
  // Unruly. Objective: help Truth shift some gear, which is not the job. Canon
  // holds throughout: the Sanctuary reunion has happened [M228-230] and Goaden
  // is not in the Legion and does not rejoin one. Anarchy and Balthazar share a
  // body [M99]; Gabriel has blood wings and is third [M100]; Truth took the
  // light at the initiation [M137] and calls Goaden Reever. Nothing is
  // reconciled and nobody's history is rewritten — five people have a bad
  // afternoon in a yard about unpaid rent.
  legion_job: {
    id: 'legion_job', title: 'A Favour, He Called It', tier: 'ordinary', once: true, location: 'legion_hideout',
    stages: [
      { key: 'ask', at: '19:15', area: 'common_room',
        text: 'Truth wanted a favour, and described it as an hour and a van: shifting some gear out of a lock-up. He was cheerful about it in a way that Ashai, who has met him twice, immediately did not like.' },
      { key: 'what', at: '12:50', area: 'common_room',
        text: 'Nobody could establish what the gear was. Not evasively — genuinely. Anarchy thought it was the rig. Rose thought it was the rig and something else. Gabriel said it was definitely the rig and then asked, unprompted, whether Goaden was bringing his sword, which is not a question you ask about a van.' },
      { key: 'locks', at: '14:30', area: 'venue',
        text: 'The locks on the lock-up had been changed. Gabriel had been standing in the yard for an hour by the time anybody else arrived and had reached the stage of explaining the situation to the door. The rig was inside. Four months of unpaid rent, it turned out, were also inside, in a ledger, in the office.' },
      { key: 'arrives', at: '15:05', area: 'venue',
        text: 'The owner arrived with five people and a completely legitimate grievance, which is the worst kind to have shouted at you in a yard. Truth began to negotiate. Truth negotiates the way he sings, which is loudly and at length and with both arms, and it went about as well as everyone present had privately expected.' },
    ],
    confrontation: {
      at: '15:40', area: 'venue',
      prose: 'It started because Gabriel put his wings out.\n\n'
        + 'He would tell you it started because somebody shoved Rose. Nobody shoved Rose. Gabriel put his wings out to make a point about the rent and five men who collect debts for a living took that as an opening statement, and after that the yard was a yard fight.\n\n'
        + 'Anarchy did not swing at anybody. He got up on a flight case, which is the only place Anarchy has ever wanted to be, and started drumming on the lid — and on the third bar Balthazar came up through his hands, long fingers flickering into being alongside his own, and the sound stopped being a sound. Two of them went down without being touched, holding their ears.\n\n'
        + 'Rose cracked a vine out of her sleeve and took the legs from one of them without appearing to look, and then, because the yard was getting silly, turned her palm up and let a bud open in it. Two men who had been about to do something regrettable to Gabriel stopped being able to move at all, mid-stride, and stayed like that for the rest of the afternoon. Rose folded her arms.\n\n'
        + 'Gabriel, magnificent, airborne, six feet up with blood wings out to their full span and the late sun coming through them, was hit in the stomach with a scaffold pole by a man who had not looked up.\n\n'
        + 'Truth lit the yard. Not at anybody — up, all of it at once, so that for about four seconds there were no shadows anywhere and everybody stopped and squinted, and in those four seconds three people changed their minds about the whole afternoon.\n\n'
        + 'And Goaden did not draw.\n\n'
        + 'He had Vega on him and he did not draw it, and he fought a scaffold-pole man and then a second one with his hands and a flight case lid and took a hit across the ribs he would not have taken with a blade in the yard, and when Truth bellowed at him to for God\'s sake use the sword he shouted back — mid-fight, quite calmly — that they were bailiffs.\n\n'
        + 'It was over in under two minutes and nobody was seriously hurt, which was entirely down to that.\n\n'
        + 'The owner, sitting on an upturned crate at the end of it with a split lip and his ledger still under his arm, looked at the sword that had stayed in its sheath and said he would take a payment plan.',
      factText: 'A yard fight at the lock-up over four months of unpaid Legion rent. Goaden did not draw; the owner took a payment plan instead of calling the Order.',
    },
    faded: {
      factText: 'The lock-up job never happened. The rig is still behind a changed lock.',
      text: 'The favour did not come off. Truth moved it twice and then stopped mentioning it, which from Truth is a confession, and the rig is presumably still behind the new locks with four months of rent behind it. Gabriel brings it up roughly weekly. Nobody has asked Truth what the other thing in the lock-up was.' },
    aftermath: { at: '10:40',
      text: 'Goaden paid half the arrears, which Truth accepted with the graciousness of a man being handed a live animal, and has since told at least three people that the money was a loan and one person that it was an investment. The rig came out of the lock-up in a van, in an hour, exactly as advertised. Gabriel is telling it as a story in which he was hit by four men and it was a girder.' },
  },
  // ---- Treatment: "The Counter Doesn't Move" -------------------------------
  // Collectors pick the busiest hour so that refusing is humiliating. The owner
  // refuses anyway, before Goaden can get there first, and that is the story:
  // the person who actually stands up is the one behind the counter.
  //
  // Combat is permitted in this world since v15 and is written the way the
  // manuscript writes it — short, ugly, and over. Nobody discovers a new
  // ability here and nothing about the Silver Spoon changes permanently except
  // who eats at the last table.
  counter_stands: {
    id: 'counter_stands', title: 'The Counter Does Not Move', tier: 'danger', once: true, location: 'cafe',
    stages: [
      { key: 'twice', at: '13:10', area: 'venue',
        text: 'Two men came into the Silver Spoon at the busiest part of lunch, did not order, stood where the queue had to go round them, and left after four minutes. The owner served the whole queue without once looking at the door they went out of, which is how Ashai knew it was the second time.' },
      { key: 'terms', at: '12:40', area: 'venue',
        text: 'It was the third time that they said a number out loud. They said it at the counter, at ten past one, over the heads of nineteen people eating, because the point of saying it then is that everybody hears it and nobody knows where to look. The owner asked whether they wanted anything, in the voice she uses for people who have not decided about the soup.' },
      { key: 'asking', at: '17:55', area: 'venue',
        text: 'Goaden asked around, which took an afternoon and got him the same answer four times in slightly different words: they had done the fish shop, they had done the framers, and the framers had paid. Nobody would say it to a form. Everybody would say it to him on a doorstep with the door half shut.' },
      { key: 'offer', at: '18:30', area: 'venue',
        text: 'He offered to be there at one. She said no. She said that if there is a man at the counter every lunchtime then it is his cafe, and that she had bought it with her own money in her own name and would keep it in both. Then she asked him whether he wanted the last table, since he was going to sit at it anyway.' },
      { key: 'friday', at: '12:20', area: 'venue',
        text: 'On the Friday they came at one with a third man, and the third man was the reason: two can be refused, three is a decision being made in front of witnesses. The room understood before anyone moved. Half the tables were families. The owner put both hands flat on the counter and said no while the door was still swinging.' },
    ],
    confrontation: {
      at: '13:05', area: 'venue',
      prose: 'The table went over onto a woman and her son.\n\n'
        + 'That was the whole of the decision — not the number, not the third man, not any of the four minutes of standing about that had come before it. A table with two plates on it went over onto somebody\'s child at ten past one on a Friday, and after that there was nothing to negotiate about and the room stopped being a room full of people who did not want trouble.\n\n'
        + 'Ashai got there before the second one landed. Not to the men — to the woman, and to the four people behind her, and she stayed there, which is the harder half of it and the half nobody afterwards described properly. Everything that came off that side of the cafe for the next forty seconds came off it into her back.\n\n'
        + 'Goaden came off the last table saying one thing, which about nine people heard and all nine reported the same: "Out. All three of you, out that fuckin\' door."\n\n'
        + 'They did not go. So he took them out of it.\n\n'
        + 'It was not a fight and he would not later call it one. It was a man clearing a doorway of three people who had decided that a room full of families was a safe place to be frightening in, and it lasted about as long as that ought to. The third man went through the door frame shoulder first and got up on the pavement and did not come back in.\n\n'
        + 'Inside, the owner had already got the boy out from under the table and was checking his arms, and was saying — to him, evenly, as if it were the ordinary next thing — that the soup was still on and he could have some.\n\n'
        + 'The MEU took forty minutes to arrive. By then two of the nineteen had gone, and the other seventeen had put the tables back.',
      factText: 'Collectors turned a table onto a customer at the Silver Spoon. Goaden put them out; Ashai kept the diners covered. The owner refused to close.',
      shakes: ['ashai'],
    },
    faded: {
      factText: 'The collectors stopped coming to the Silver Spoon before it came to anything.',
      text: 'They did not come back on the Friday, or the Friday after. The owner kept the number written on the inside of a receipt book in case anybody official ever asked her for it, and nobody ever did. She still does not sit with her back to the door.',
    },
    aftermath: { at: '19:40',
      text: 'She would not close and she would not have anybody standing at the counter, so it settled into something else instead: for ten days the last table was never empty. Goaden one night, Zara two, a captain who ate very slowly and read a folder, the fish shop\'s son, and on the Thursday a girl nobody could place who stayed until the shutters came down and left the exact money on the table. The soup is unchanged. The door frame is a different colour to the rest of the frame and the owner has not painted it.' },
  },
  // ---- Treatment: "Left Luggage, Still Warm" -------------------------------
  // A case on a platform getting warmer and no alarm going off for it.
  //
  // The treatment called the contents Cinder sprites, which are not established
  // anywhere in the manuscript or the Codex, so this uses Canopy Sprites, which
  // are: "diminutive creatures with wings like autumn leaves, glowing with the
  // life force of the forest" [P01680], sparrow-sized, luminescent, signalling
  // to one another through their wings. The case is warm because it is full of
  // living bodies, not because anything in it burns — which is also why the
  // station's flame wards never fired. The hazard is the crowd. Nothing here
  // gives the species a new ability or a new habit.
  left_luggage: {
    id: 'left_luggage', title: 'Left Luggage, Still Warm', tier: 'danger', once: true, location: 'streamliner',
    stages: [
      { key: 'noticed', at: '16:05', area: 'transit',
        text: 'A cleaner mentioned to nobody in particular that the case at the end of platform two had been there since the ten-forty and was warm. Not warm like a thing left in the sun. Warm like a thing with something in it.' },
      { key: 'no_alarm', at: '16:35', area: 'transit',
        text: 'The station\'s wards had not fired, and that is the detail that turned it from lost property into a problem. They are set for open flame and they are honest about it. Nothing in that case was burning. It was the temperature of a great many small bodies in a space meant for crockery, and there is no ward in London set for that.' },
      { key: 'manifest', at: '17:10', area: 'transit',
        text: 'The consignment paperwork said ceramics. It said ceramics in the same handwriting on nine previous journeys this month, all of them terminating here, all of them collected inside twenty minutes. This one had not been collected, and the man who wrote it was somewhere in a concourse of four thousand people.' },
      { key: 'seams', at: '17:40', area: 'transit',
        text: 'You could see them by then if you crouched, which Ashai did for a long time and did not want to stand up from: a green-gold seam of light where the lid met the case, moving, going dim at one end and then the other. Canopy Sprites glow the way a forest floor glows. Forty of them had been packed in the dark since Wooburn and the light was simply them, shifting about, looking for room.' },
      { key: 'clearing', at: '18:00', area: 'transit',
        text: 'The MEU sent handlers with a proper travelling roost and an honest estimate: eleven minutes to rig it. So they cleared the platform the slow way, which is the only way that works — no announcement, no running, staff at the barriers turning people gently the wrong way, and the departure board quietly sending platform two\'s service somewhere else. It took nine of the eleven and nobody in the coffee queue ever knew.' },
    ],
    confrontation: {
      at: '18:20', area: 'transit',
      prose: 'The case went at eight minutes.\n\n'
        + 'Not open — the seams went, along the top edge, in the way a thing gives when what is inside it has been pressed against that edge for seven hours and has run out of patience with the arrangement. What came out came out all at once and low and shining, the whole consignment into the last unclosed forty feet of platform two.\n\n'
        + 'The handlers had the roost up but not rigged.\n\n'
        + 'Ashai went to the barrier, because that was the only thing on that platform that mattered. Not the case. The barrier, and the eleven people still the wrong side of it, and a boy of about nine who had stopped dead the way nine-year-olds do when something extraordinary is happening in front of them. She got the whole of that gap and she held it while the platform went green-gold behind her.\n\n'
        + 'They are not dangerous. They are frightened, and there are a great many of them, and forty sparrow-sized creatures going up together into a glass roof and lighting the whole of it from underneath is the most beautiful thing that will ever happen on platform two. It would also have taken the concourse apart, because four thousand people do not stand still for beauty they were not warned about.\n\n'
        + 'Nobody ran, because there was nobody left to run.\n\n'
        + 'The man who wrote ceramics nine times went for the west stair at the noise, which was reasonable, and got about thirty feet, which was less so. Goaden had been standing at the bottom of the west stair for two hours for exactly this and had frankly begun to think it was a wasted afternoon.\n\n'
        + 'Getting them down took nineteen minutes and no force at all. The senior handler put the roost open on the platform with a lamp in it and then made everybody be quiet, and they came down to it in ones and twos, and then in a rush at the end. All of them alive. Four shops lost the afternoon. The transport company has been asked to explain, in writing, how ceramics got warm.',
      factText: 'A trafficked consignment of Canopy Sprites broke open on platform two. The concourse had been cleared; all of them were recovered alive and the shipper was stopped on the west stair.',
    },
    faded: {
      factText: 'The warm case on platform two was taken by handlers before it opened.',
      text: 'The handlers got the roost rigged with ninety seconds in hand and the case went into it still shut, which is the outcome everybody wanted and nobody will ever tell a story about. Platform two reopened at seven. The paperwork still says ceramics, and somewhere there is a tenth consignment that has not been sent yet.',
    },
    aftermath: { at: '09:20',
      text: 'The wards on platform two are being reset to something more suspicious, which will cost the station a fortune in false alarms and has been signed off anyway. The consignment went back to Wooburn on a slow van with the roost open and a handler sitting beside it. Ashai went to the platform the next morning and stood where the barrier had been, and reports that it is an extremely ordinary platform. The boy who stopped dead has apparently told his class that a woman held the light back off him.' },
  },
  // ---- Treatment: "The Smallest Roadworks in London" -----------------------
  // A road sprite lays a road. It is eleven inches long. It has bunting.
  // Nothing in this establishes that road sprites build roads as a species;
  // one of them is building this one, and is not to be argued with.
  smallest_roadworks: {
    id: 'smallest_roadworks', title: 'The Smallest Roadworks in London', tier: 'ordinary', once: true, location: 'big_ben_plaza',
    stages: [
      { key: 'barriers', at: '11:40', area: 'venue',
        text: 'Somebody had put barriers round the crack in the paving at the east end of the plaza. Proper ones, in the proper colours, with a little striped pole across the top. They came up to Goaden\'s ankle.' },
      { key: 'works', at: '15:20', area: 'venue',
        text: 'Inside the barriers was a road. Eleven inches of it, laid in chips of slate off the market skips, graded and tamped and rising very slightly to the left, and beside it a handwritten notice on a card the size of a stamp which nobody has yet been able to read.' },
      { key: 'displaced', at: '12:55', area: 'venue',
        text: 'The plaza kept walking through it. Not maliciously — a full-sized person simply does not see a barrier eleven inches high, and each morning the signs were somewhere new and each morning they went back exactly where they had been. Ashai watched the sprite spend forty minutes on the position of one cone.' },
      { key: 'corner', at: '16:30', area: 'venue',
        text: 'The difficulty was the corner. It had been rebuilt four times, and the fourth version was worse than the second, and the sprite knew it. It sat on the kerbstone beside its own corner for most of an afternoon with its chin in its hands, and then took the whole thing up again.' },
      { key: 'offer', at: '10:15', area: 'venue',
        text: 'A caretaker offered it the strip along the wall by the gardens — same length, same slate, nobody walking over it. The sprite inspected the strip for a long time in the manner of a professional being offered a lesser commission, and then accepted, and then insisted on carrying the good chips over itself.' },
    ],
    confrontation: {
      at: '17:10', area: 'venue',
      prose: 'The road opened on the Thursday.\n\n'
        + 'It is eleven inches long, it runs along the wall by the plaza gardens, and it has a camber. It cost, as far as anybody can establish, one caretaker\'s goodwill, half a skip of slate and eleven days.\n\n'
        + 'There was bunting. Nobody knows where the bunting came from and the sprite would not be drawn on it.\n\n'
        + 'There were three test runs with the cart, because two would have been complacent, and between the second and the third there was a delay while a snail was removed from the carriageway with more ceremony than the snail can have wanted. Goaden was asked to hold one end of the bunting and did so for eleven minutes without saying anything clever, which Ashai has decided to remember.\n\n'
        + 'At the third run the cart came down the whole length, took the corner — the corner, the one that had been built five times — without slowing, and stopped square at the far end.\n\n'
        + 'Nine people had gathered by then, which for a plaza that ignores a street performer with a four-storey rabbit is a considerable crowd. They applauded. The sprite did not acknowledge it. It went and stood at the corner and looked at the corner.',
      factText: 'A road sprite finished an eleven-inch road along the plaza garden wall. It has a camber, and it opened with bunting.',
    },
    faded: {
      factText: 'The small roadworks at the east end of the plaza were cleared away by the borough.',
      text: 'The borough took the barriers away on a Tuesday along with the rest of the plaza\'s unlicensed clutter, and the eleven inches of slate went into the back of the same van. Ashai looked for the sprite twice and did not find it. The crack in the paving is still there and is now genuinely a trip hazard.',
    },
    aftermath: { at: '13:25',
      text: 'The road is still there. Somebody from the gardens sweeps it, which nobody asked them to do. The card-sized notice has been moved to the near end where it can be read by anybody prepared to kneel, and Ashai has knelt, and reports that it is not writing at all but a very small and extremely detailed plan of the corner.' },
  },
  // ---- Treatment: "The Clockwork Derby" ------------------------------------
  // Yukon helps build the fastest-looking cart in the field. Its problem is
  // geometry. [M65]: he joined after a creative bank heist and shape-shifts;
  // none of which helps with a bend.
  clockwork_derby: {
    id: 'clockwork_derby', title: 'The Clockwork Derby', tier: 'ordinary', once: true, location: 'mi6',
    stages: [
      { key: 'heard', at: '18:20', area: 'gaming_room',
        text: 'Yukon came into the gaming area saying the word derby in a tone that made it clear he had already committed to something. There is a courtyard behind the market where the road sprites race carts they build out of skip metal, and there is a race in three weeks, and Yukon has been adopted by an entrant.' },
      { key: 'build', at: '19:05', area: 'common_room',
        text: 'The cart he is helping with is magnificent. It has fins. It has a spoiler off a broken filing trolley and a painted flame down each side and it is, by common agreement in the courtyard, the most frightening object anybody there has ever built. Yukon has explained the fins to four separate people at MI6 and each explanation has been longer.' },
      { key: 'heats', at: '17:50', area: 'common_room',
        text: 'It won its heat by a distance that made two other entrants retire on the spot. It also went into the wall on the exit of the last bend, and left a scrape, and everybody agreed the scrape was fine because it had won. The sprite that built it looked at the scrape for some time.' },
      { key: 'width', at: '20:10', area: 'gaming_room',
        text: 'Ashai, who came to one practice out of politeness and stayed for three, pointed out over dinner that the final course uses the tight bend by the gate and the cart is four inches wider than the heat course allows for. Yukon said the fins were structural. Ashai said the fins were four inches. Yukon said they were structural four inches and could she please stop being clever about it at dinner.' },
      { key: 'plain', at: '16:45', area: 'common_room',
        text: 'The favourite going into the final is a flat grey plank on four wheels built by a sprite who has not spoken to anybody for the entire competition. It has no fins. It has, Ashai noted, the only steering linkage in the field with a return spring on it.' },
    ],
    confrontation: {
      at: '18:40', area: 'common_room',
      prose: 'The final was run over three laps of the courtyard in front of about sixty people, forty of them a foot tall.\n\n'
        + 'The magnificent cart led for two and a half of them, and it was not close. It came off the top straight so far ahead that Yukon had already stood up.\n\n'
        + 'Then it reached the bend by the gate.\n\n'
        + 'Four inches. A driver who had never once had to lift, and four inches of gatepost that was not going to move for him. The left fin took it square. The cart came up onto two wheels, hung there long enough for sixty people to draw breath, and came down sideways — and finished the race travelling backwards into a stack of pallets with tremendous dignity.\n\n'
        + 'The grey plank came round the same bend at two-thirds of the speed with its little spring pulling the wheels straight, and won by half a length, and its builder did not celebrate, and has still not spoken to anybody.\n\n'
        + 'The defeated sprite got out, walked round to the front, and began taking the fins off. Not angrily. The way you put away a thing that has been answered. It had them off in under a minute and stacked them, and then it stood there holding the last one and looking at the gatepost, working out the number.\n\n'
        + 'Yukon took it considerably harder. He got as far as "the gatepost has been moved" before he heard himself, and then had to be walked to the gate by Goaden, who said only "it was a lovely cart, mate" four times, at intervals, and did not once say the word fins.',
      factText: 'Yukon\'s cart led the Clockwork Derby for two and a half laps and lost it on the bend by the gate. It was four inches too wide.',
    },
    faded: {
      factText: 'The Clockwork Derby final was called off after the courtyard was cleared for building work.',
      text: 'The courtyard went behind hoarding a week before the final and the derby was abandoned rather than moved, which the entrants took better than Yukon did. The magnificent cart is in the gaming area under a dust sheet. He mentions it about once a fortnight and nobody has told him about the bend.',
    },
    aftermath: { at: '19:30',
      text: 'The scrape on the gatepost from the heat is still there and the sprites have started using it as the marker for where to turn in, which means Yukon\'s cart has permanently improved everybody\'s lap times except its own. He has heard about this. He has decided it is a legacy. The fins are in the gaming area in a neat stack and he will not let anybody move them.' },
  },
  // ---- Treatment: "Where the Familiar One Went" ----------------------------
  // A lintel stops visiting one roof. Nothing is wrong. [P00040] and [P02734]:
  // they go where the ambient magic is, and a garden two streets away simply
  // got better at growing things.
  familiar_one: {
    id: 'familiar_one', title: 'Where the Familiar One Went', tier: 'ordinary', once: true, location: 'big_ben_plaza',
    stages: [
      { key: 'absent', at: '17:30', area: 'venue',
        text: 'The roof garden above the market has kept a notebook for two years, and the notebook has a lintel in it most weeks, and this month it has none. The woman who keeps the notebook mentioned it to Ashai in the way people mention a thing they have decided not to be upset about.' },
      { key: 'checking', at: '12:10', area: 'venue',
        text: 'They checked the obvious first, because the obvious is usually right and is also the frightening one: nothing dead on the roof, nothing wrong with the beds, no works nearby, no new wards. The garden is in better condition than it was in the spring. That is what made it strange.' },
      { key: 'notebook', at: '18:15', area: 'venue',
        text: 'The notebook is very good. It records the day, the weather and the plant it settled over, and it goes back far enough that the absence has a shape: not a sudden stop but a thinning across five weeks, one visit fewer, then two, the way attention goes rather than the way an accident does.' },
      { key: 'found', at: '15:45', area: 'venue',
        text: 'It is four buildings east, on a roof that was gravel eighteen months ago and is now the best-fed square of ground for a quarter of a mile, and it is not alone up there. Ashai stood in the stairwell doorway and counted three, and did not go out onto the roof, and came back down.' },
      { key: 'telling', at: '19:00', area: 'venue',
        text: 'Telling her was harder than finding it. She took it well for about four seconds and then said, of a cloud, that she had thought it liked the rosemary. Goaden said that it probably did, and that things go where the food is, and that this was not a compliment being withdrawn. She said she knew that. She wrote it in the notebook.' },
    ],
    confrontation: {
      at: '16:20', area: 'venue',
      prose: 'What actually happened was that two people who have lived four buildings apart for nine years met on a stairwell landing over a cloud, and were both extremely embarrassed about how much they minded.\n\n'
        + 'The gravel roof belongs to a man who started growing things eighteen months ago because he had to do something with his hands. He had no idea there was a notebook. He had no idea there was a roof garden above the market at all, and said so, and then said that he had wondered why they were coming to him.\n\n'
        + 'They stood there for a while working out that they had been keeping separate records of the same animal.\n\n'
        + 'There was a bad ten minutes in the middle where it was very nearly a competition — two people establishing, politely, at length, whose beds were better — and then she asked what he was doing about the mint, because his mint was extraordinary, and after that it was fine.\n\n'
        + 'It came back to the market roof eleven days later for one afternoon and then went east again. The notebook records this without comment, which took some doing.\n\n'
        + 'They have not merged the notebooks. They have agreed that this would be sensible and have not done it, and instead each writes down what the other tells them, in their own hand, in their own book, which is twice the work and is obviously the point.',
      factText: 'The market roof\'s regular lintel had moved to a better-fed garden four buildings east. The two gardeners have started comparing notes.',
    },
    faded: {
      factText: 'The lintel that used to visit the market roof came back on its own.',
      text: 'It came back in the third week without anybody establishing where it had been, settled over the rosemary as though nothing had happened, and the notebook resumed. She has stopped saying she was worried. She has not stopped checking at four.',
    },
    aftermath: { at: '11:50',
      text: 'There are now two notebooks four buildings apart, each containing the other roof\'s sightings in the wrong handwriting. The lintel divides its time unevenly and neither of them will say out loud which way. Ashai has been given a cutting of the extraordinary mint and has put it on the corridor windowsill at MI6, where it is doing better than anything else on that windowsill and is beginning to be a topic.' },
  },
  // ---- Treatment: "The Sketchbook Hostage" ---------------------------------
  // A thief with the wrong idea about what an apprentice can authorise. The
  // pursuit is real and the recovery is partial: some of the book is gone and
  // stays gone. Nothing here opens the Ink's private archive.
  sketchbook_hostage: {
    id: 'sketchbook_hostage', title: 'The Sketchbook Hostage', tier: 'danger', once: true, location: 'enchanted_ink',
    stages: [
      { key: 'postponed', at: '14:20', area: 'venue',
        text: 'The apprentice at Enchanted Ink postponed Ashai\'s consultation twice in four days, both times by note, both times with a reason that would have been fine once. Ashai went in on the second afternoon anyway and bought nothing and stayed twenty minutes.' },
      { key: 'gone', at: '16:00', area: 'venue',
        text: 'The book is nine years of work. It is not the shop\'s and it is not insured and it is the only place most of those designs have ever existed, because that is what a sketchbook is. It went out of the back room on the Tuesday with a man who had been in twice about a piece he was never going to have done.' },
      { key: 'terms', at: '17:25', area: 'venue',
        text: 'What he wants is an hour alone with the private commission archive, which is a thing an apprentice cannot give him, does not have the keys to, and could not survive being found to have tried. He appears to believe otherwise, sincerely, which makes him considerably more dangerous than a man asking for money.' },
      { key: 'telling', at: '18:40', area: 'venue',
        text: 'She was four hours from doing it when she told Ashai. Not because she thought she would get away with it — because losing the book felt like the end of the nine years and being sacked only felt like the end of the job. Ashai sat with her in the back room and did not tell her she was being stupid, which is why she got the rest of it.' },
      { key: 'meet', at: '19:15', area: 'venue',
        text: 'The exchange was set for the yard behind the framers at seven. He named it himself, which was his mistake: it has one way in for a person who does not know the borough and three for anybody who has spent a year walking it at night.' },
    ],
    confrontation: {
      at: '19:50', area: 'venue',
      prose: 'He came out of the yard the moment he saw who was standing in it.\n\n'
        + 'He went well, too. Over the framers\' bins, along the low roof, down into the lane behind the fish shop — a man who had walked his route in daylight and counted the drops.\n\n'
        + 'The trouble with rehearsing a route is that Goaden was not on it.\n\n'
        + 'Ashai took the yard, which is where the apprentice was. Goaden took the borough.\n\n'
        + 'Four minutes. Roofs, one wall, a scaffold. He did not gain a stride on any of it — the man was quick, and desperate, and nine feet ahead from the first bin, and every time the gap looked like closing there was another drop he had already measured.\n\n'
        + 'It ended at the hoarding on Cross Lane, which does not have a gap in it any more and has not had since June.\n\n'
        + 'He threw the book at the hoarding before he was caught. Not at Goaden — at the boards, hard, the way you break a thing so that whoever wanted it does not get it whole, and it hit spine-first and came apart in the rain that had been going on all evening and that nobody had thought about until that second.\n\n'
        + 'Goaden went for the pages and not for the man. That is the only choice in the whole affair that anybody argued about afterwards, and he has not defended it once.\n\n'
        + 'They got most of it. The binding is finished, four pages went into the drain at the corner, and eleven more are ink and water and a suggestion of what they used to be. The rest — nine years less fifteen pages — went back to the shop inside a coat.\n\n'
        + 'The man was picked up on the Cross Lane side an hour later by two entirely ordinary MEU officers, sitting on a step, not running any more.',
      factText: 'A thief held an Enchanted Ink apprentice\'s sketchbook against access to the private archive. The book was recovered in a pursuit; fifteen pages were lost. The archive was never opened.',
      shakes: ['goaden'],
    },
    faded: {
      factText: 'The stolen Enchanted Ink sketchbook was returned intact and the demand was never met.',
      text: 'He put it through the shop letterbox on the fourth night, whole, dry, with nothing missing and no note, which the apprentice found harder to think about than the theft. Nobody has established why. She has photographed every page since and keeps the copies somewhere else.',
    },
    aftermath: { at: '12:30',
      text: 'The book is rebound in a cover that does not match. Fifteen pages are blank and have been left blank on purpose, and the apprentice is redrawing them from memory at a rate of about one a fortnight, badly at first and then less badly. Ashai has finally had her consultation. She spent most of it looking at the empty pages and asking what had been on them, and the apprentice found she could describe eleven of the fifteen, which is more than she had thought.' },
  },
  // ---- Treatment 85, "The Tapping in the Streetlamp" ----------------------
  // Studio mode: uncanny — "Give the reader a concrete ordinary baseline.
  // Introduce one sensory anomaly. Let the character test, conceal, misread or
  // respond to it." Its avoid list rules out calling anything eerie, offering
  // several metaphors for one anomaly, and adding an unestablished supernatural
  // rule to force suspense. So the anomaly is a noise, the test is physical,
  // and the answer is a person with a screwdriver.
  lamp_tapping: {
    id: 'lamp_tapping', title: 'The Tapping in the Streetlamp', tier: 'danger', once: true, location: 'big_ben_plaza',
    stages: [
      { key: 'noise', at: '23:40', area: 'venue',
        text: 'The lamp on the corner of the plaza gardens taps after midnight. Three, then a gap, then three. The borough logged it as a loose fitting in June and again in July, and the man who came out both times found a loose fitting and tightened it.' },
      { key: 'dark', at: '00:15', area: 'venue',
        text: 'It also goes out when anybody walks up to it, and comes back on about a minute after they give up. That part is not in the log, because the only way to find it out is to stand in the road at midnight being patient, and nobody is paid to do that.' },
      { key: 'answers', at: '23:55', area: 'venue',
        text: 'Ashai stood in the road at midnight being patient. What she got was worth the hour: it is not a rhythm. She moved two paces left and the tapping changed. She stopped and it stopped. Whatever is in that housing is not repeating. It is answering.' },
      { key: 'hand', at: '00:30', area: 'venue',
        text: 'She got her hand flat on the column and tapped twice. It gave her two back, immediately, and then a great deal more than two, fast, all over the inside of the housing, the way a thing knocks when it has been knocking at nobody for weeks.' },
      { key: 'others', at: '22:20', area: 'venue',
        text: 'Goaden went along the row while she worked. Four lamps between the gardens and the market have had their covers off recently — clean scratches round the screws, and one cover put back with the wrong screws entirely. Nobody breaks into a streetlamp for the bulb.' },
    ],
    confrontation: {
      at: '01:05', area: 'venue',
      prose: 'The housing came off at one in the morning and a road sprite came out of it sideways.\n\n'
        + 'It had been in there long enough to be past frightened. It got about four feet, sat down hard on the kerb, and stayed there with its back to the column and both hands over its head while Ashai crouched a careful distance away and did not touch it.\n\n'
        + 'Its left arm was wrong. Not broken — flattened, the way a thing goes when a cover is put back on it while it is still in the way, by somebody who felt it happen and did the screws up anyway.\n\n'
        + '"That is what the tapping was," Goaden said, from the road, not coming closer. "It has been asking."\n\n'
        + 'What the lamps were actually for was on the inside of the four covers.\n\n'
        + 'The market security run is chained off the same feed. Somebody had been walking the row with a screwdriver, laying a shim across the contacts, one lamp a week. Do it slowly enough and the whole run comes up dark on a night of your choosing and reads as a fault.\n\n'
        + 'The sprite had got into the wrong lamp on the wrong evening and seen a face.\n\n'
        + 'It would not come out to either of them. It came out, eventually, to a woman who runs the flower stall and has been leaving a saucer of water on that kerb since August for reasons she was embarrassed to explain — and it went to her the way you go to somebody you have already decided about.\n\n'
        + 'The market run came up dark four nights later, exactly as arranged, and there were eleven people standing in it who had been told which night to expect.',
      factText: 'A road sprite was trapped in a plaza streetlamp with a flattened arm. It had been tapping in answer to movement. The lamps were being shimmed to black out the market security run.',
      shakes: ['ashai'],
    },
    faded: {
      factText: 'The tapping streetlamp on the plaza corner stopped on its own.',
      text: 'It stopped in the second week and the borough closed the ticket. The four covers with the wrong screws are still on the four lamps. Ashai has walked that row twice since, at midnight, and got nothing back, and has not entirely let it go.',
    },
    aftermath: { at: '10:20',
      text: 'The arm will not come right. It works and it is the wrong shape and it is going to stay the wrong shape, and the sprite has taken to holding it behind its back when anybody looks, which is new and is nobody\'s business. It lives on the flower stall now — not in it, on it, on the top corner of the awning frame where it can see the whole row of lamps. The woman has stopped putting the saucer out. It comes down for the water.' },
  },
  // ---- Treatment 94, "The Footsteps That Stop Behind You" -----------------
  // Uncanny again, but the answer is a person paying for information rather
  // than anything supernatural. Dusk sprites are canon fauna; nothing here
  // gives them a new ability, only somebody's use of one.
  footsteps: {
    id: 'footsteps', title: 'The Footsteps That Stop Behind You', tier: 'danger', once: true, location: 'mi6',
    stages: [
      { key: 'reported', at: '18:40', area: 'ops_room',
        text: 'A woman from the Cross Lane end reported being followed home six nights running. Every time she turns round there is nobody there, and she has turned round a great many times, and she has begun saying sorry when she reports it, which is the part Ashai wrote down.' },
      { key: 'nothing', at: '19:20', area: 'ops_room',
        text: 'There is nothing on any camera she passes. Not a figure that vanishes — nothing at all, six nights, four cameras. That is not a haunting. That is somebody who does not need to be on the street to know she is on it.' },
      { key: 'accurate', at: '17:50', area: 'corridors',
        text: 'The detail that turned it was small and horrible. She changed her route on the fourth night, told nobody, and the footsteps were on the new route. She stayed at a friend\'s on the fifth and got a message about it the next morning from somebody who should not have known.' },
      { key: 'above', at: '20:15', area: 'ops_room',
        text: 'So the watcher is not at street level, and Ashai spent an evening looking up instead of round: gutter lines, sign brackets, the gap over the chemist\'s door. Dusk sprites will sit anywhere a person cannot, they will sit still for hours, and they will do it for somebody who feeds them.' },
      { key: 'route', at: '18:05', area: 'briefing_room',
        text: 'You cannot catch a watcher by watching back. You can give them something worth reporting. The plan was ugly and simple and the woman agreed to it before it was fully explained, which Goaden did not like and said so twice.' },
    ],
    confrontation: {
      at: '21:30', area: 'ops_room',
      prose: 'She walked a route she had not walked in a fortnight, at a time she had told three people about, and each of the three had been told something slightly different.\n\n'
        + 'It took forty minutes. The sprites went up off the chemist\'s bracket at the top of Cross Lane and moved ahead of her along the gutter line, and they were good at it — a person looking for them would not have found them, which is the whole point of hiring something that lives above eye level.\n\n'
        + 'Ashai was not looking for them. She was looking at the one thing a watcher cannot help doing, which is going somewhere afterwards.\n\n'
        + 'They went to a first-floor window over the launderette, four streets off her route, and the version of the evening that came back through that window was the version told to exactly one of the three people.\n\n'
        + 'He was not a monster and that was somehow worse. He had a notebook. Six nights of times and turnings in small neat handwriting, and a page at the front where he had written down what he thought her routine meant about her, and he wanted to explain the notebook.\n\n'
        + 'Goaden let him get about a sentence into it.\n\n'
        + 'The sprites were not his and had no loyalty to him. They had been fed for eleven days and they left when the feeding stopped, back up the gutter line and off over the launderette roof, and they will do the same thing for the next person who puts food on a windowsill, which is a problem nobody in that room could solve that night.',
      factText: 'A man over the launderette was paying dusk sprites to track a woman\'s route from above. He kept a notebook. The harassment was stopped and the sprites dispersed when the feeding did.',
    },
    faded: {
      factText: 'The Cross Lane reports stopped before the route could be tested.',
      text: 'The footsteps stopped on the seventh night and did not come back, and the file was closed with nothing in it. She still does not walk Cross Lane. She takes the long way past the market instead, and she has told people it is because it is better lit, which it is.',
    },
    aftermath: { at: '09:40',
      text: 'It took her five weeks to walk Cross Lane again and she did it in the afternoon, with somebody, and then a fortnight later on her own at nine, which she mentioned to the desk on her way past as though it were nothing. Ashai has put a note in about the gutter line over the chemist. Nobody has worked out what to do about a creature that will watch anybody for eleven days of food.' },
  },
  // ---- Treatment 97, "The Day After the Shield" ---------------------------
  // Studio mode: aftermath. Its avoid list is the whole design here — no
  // immediate emotional recovery, no compulsory inspirational speech, no new
  // threat replacing the chance to process the old one, and above all no
  // "caretaker deciding everything for the person receiving care". Ashai's
  // barrier is her evidenced ability [M47, M356]; nothing new is learned and
  // nobody gets stronger.
  after_the_shield: {
    id: 'after_the_shield', title: 'The Day After the Shield', tier: 'ordinary', once: true, location: 'mi6',
    stages: [
      { key: 'monday', at: '08:30', area: 'corridors',
        text: 'She held a barrier over four people for eleven minutes on the Saturday and everybody has been very nice about it. On the Monday she came in at the usual time, went to the usual place and found that she could not hold a thought through to the end of a sentence.' },
      { key: 'small', at: '11:15', area: 'common_room',
        text: 'It is not dramatic and that is what makes it intolerable. Reading is fine. Reading twice is fine. Reading twice and then being asked a question about the first time is not, and the lunch hall at one o\'clock is a wall of noise she has sat in happily for a year.' },
      { key: 'helping', at: '13:40', area: 'common_room',
        text: 'Goaden has carried her tray, answered a question that was put to her, moved a chair she was walking towards and told a captain she was fine. Three of those were useful. She has not yet decided out loud which three.' },
      { key: 'said', at: '18:20', area: 'corridors',
        text: 'She said it in the corridor, evenly, once: that he can carry the tray and he cannot answer the question. He said alright. He did not say it well and he did not argue, and he went and stood at the window for a bit, which is what he does instead of saying the next thing.' },
      { key: 'thursday', at: '16:50', area: 'training',
        text: 'Thursday was better and Friday was worse, which nobody had told her was how it goes. She took Friday off the floor entirely and sat on the bench with the noise-dampening set on and watched other people train, and hated it, and did it anyway.' },
    ],
    confrontation: {
      at: '15:30', area: 'training',
      prose: 'The following Tuesday she put up a barrier the size of a doorway and held it for ninety seconds.\n\n'
        + 'That is the whole event. Ninety seconds, one doorway, in an empty hall with a supervisor and a clock, and it cost her the rest of the afternoon.\n\n'
        + 'It is a fifth of what she did on the Saturday and about a third of what she could do the Tuesday before, and she wrote both those numbers down herself, in the log, in front of the supervisor, because the alternative was carrying them around unwritten.\n\n'
        + 'Goaden watched from the door and said nothing at all, which took visible effort and which she noticed.\n\n'
        + 'Then she asked him — not the supervisor — to time the next one, and he did that, badly, holding the watch like it might go off, and called ninety-four seconds at ninety-four seconds without rounding it up.\n\n'
        + '"Right," she said. "Same time Thursday."\n\n'
        + 'She has put her name down for the river exercise at the end of the month, which is eight weeks earlier than the supervisor would have suggested and four weeks later than she wanted, and she made that decision on her own in the corridor afterwards with the log still in her hand.',
      factText: 'Ashai came back to barrier practice at a fifth of her usual and logged the number herself. She has entered the river exercise at the end of the month.',
    },
    faded: {
      factText: 'The week after the rescue passed without Ashai returning to barrier practice.',
      text: 'She did not go back to the hall that week. She did the reading, took the Friday, and told the supervisor she would look at it again after the weekend, and the supervisor wrote nothing in the log because there was nothing to write. It is still there to be gone back to.',
    },
    aftermath: { at: '19:10',
      text: 'The noise-dampening set has stayed in her drawer rather than going back to stores, which is a small permanent change nobody has commented on. Goaden still carries the tray. He has stopped answering for her, mostly, and the two times he has slipped she has said his name once and he has stopped mid-sentence, which is not grace but is quick.' },
  },
});
const ARC_IDS = Object.keys(ARCS);

const shape = action => ({ type: action.type, dueAt: action.dueAt, priority: action.priority,
  day: action.day, version: action.version, arcId: action.arcId ?? null,
  stage: action.stage ?? null, token: action.token ?? null });
const proposal = (id, at, type, extra = {}) => ({ id, type, dueAt: at,
  priority: 33, day: londonDate(at), version: 1, actors: [], ...extra });

function save(ctx, patch) { ctx.ops.setArcs({ ...of(ctx.state), ...patch }); }
function touch(ctx, instance, patch) {
  const next = { ...instance, ...patch }, current = of(ctx.state);
  save(ctx, { instances: { ...current.instances, [instance.id]: next } });
  return next;
}

/** Ownership, on the same terms every other authored system here uses. */
export function issueArcActions(ctx, proposals) {
  const result = [];
  for (const action of proposals) {
    if (!ARC_EVENT_TYPES.includes(action.type) || action.version !== 1
      || !Number.isSafeInteger(action.dueAt) || action.dueAt <= ctx.now
      || action.day !== londonDate(action.dueAt)) throw new Error('Arc action requires an owned, strictly future cause');
    const current = of(ctx.state);
    if (current.issued[action.id]) continue;
    const issued = Object.fromEntries(Object.entries(current.issued)
      .filter(([, row]) => row.shape.dueAt >= ctx.now - 30 * 24 * 60 * MIN));
    if (Object.keys(issued).length >= ARC_RULES.retainedActions) throw new Error('Arc action budget exceeded');
    issued[action.id] = { shape: shape(action), sourceEventId: ctx.id, consumed: false };
    ctx.ops.setArcs({ ...current, issued });
    result.push(action);
  }
  return result;
}

/**
 * The day's arc actions: either the next beat of a running arc, or the opening
 * of a new one when the world has been bad enough for long enough.
 *
 * Deliberately state-aware and therefore called from the rollover rather than
 * from the pure day plan — the same route the pressure incidents take, because
 * an arc is a consequence of the world's condition rather than of its calendar.
 */
export function arcDayActions({ state, day, now, seed, carried = 0 }) {
  const current = of(state);
  const active = current.activeId ? current.instances[current.activeId] : null;
  if (active && active.status === 'running') {
    const definition = ARCS[active.arcId];
    const stage = definition.stages[active.stageIndex];
    // The confrontation follows the last sign, on the next day.
    if (!stage) {
      const at = atLondon(day, definition.confrontation.at);
      return at > now ? [proposal(`${day}/arc/${active.id}/confrontation`, at, 'ARC_CONFRONTATION',
        { arcId: active.arcId, token: active.token, stage: 'confrontation' })] : [];
    }
    const at = atLondon(day, stage.at);
    return at > now ? [proposal(`${day}/arc/${active.id}/${stage.key}`, at, 'ARC_BEAT',
      { arcId: active.arcId, token: active.token, stage: stage.key })] : [];
  }
  if (active && active.status === 'confronted') {
    const at = atLondon(day, ARCS[active.arcId].aftermath.at);
    return at > now ? [proposal(`${day}/arc/${active.id}/closed`, at, 'ARC_CLOSED',
      { arcId: active.arcId, token: active.token, stage: 'closed' })] : [];
  }
  // Nothing running. Which stories are even available today depends on how bad
  // the world has got: a bridge full of Order operatives needs a fortnight of
  // things going wrong behind it, whereas a tattoo following somebody round a
  // shop can happen on any ordinary Tuesday. Two gates, one list.
  //
  // A `once` arc is a mystery with an answer in it. Once that answer is on the
  // page the world knows it, and replaying the whole ladder would be the pair
  // forgetting something the feed has already told a reader — so an exhausted
  // one is simply gone.
  const runs = Object.values(current.instances).reduce((counts, item) =>
    ({ ...counts, [item.arcId]: (counts[item.arcId] ?? 0) + 1 }), {});
  const eligible = ARC_IDS.filter(id => {
    const definition = ARCS[id];
    if (definition.once && ((runs[id] ?? 0) > 0 || (current.exhausted ?? []).includes(id))) return false;
    const gate = definition.tier === 'danger' ? ARC_RULES.opensAbove : ARC_RULES.opensAboveOrdinary;
    return carried >= gate;
  });
  if (!eligible.length) return [];
  // The gap after the last one scales with what the last one was, so a fight on
  // a bridge buys a proper silence and a shop-floor farce does not.
  if (current.lastClosedDay) {
    const previous = current.instances[current.lastArcId ?? ''];
    const gap = previous && ARCS[previous.arcId]?.tier === 'danger'
      ? ARC_RULES.cooldownDays : ARC_RULES.cooldownDaysOrdinary;
    let earliest = current.lastClosedDay;
    for (let index = 0; index < gap; index++) earliest = nextLondonDay(earliest);
    if (day < earliest) return [];
  }
  // Never the same story twice while another has not been told. Measured before
  // this existed: one arc ran six times in a hundred and fifty days, verbatim.
  // Once the one-offs are spent the repeatable few can tie on run count, and a
  // tie-break landed the same story twice within a fortnight. Whatever closed
  // last is out of the running while anything else is available.
  const previousArcId = current.instances[current.lastArcId ?? '']?.arcId ?? null;
  const fresh = eligible.filter(id => id !== previousArcId);
  const pool = fresh.length ? fresh : eligible;
  const fewest = Math.min(...pool.map(id => runs[id] ?? 0));
  const unseen = pool.filter(id => (runs[id] ?? 0) === fewest);
  const arcId = unseen[number(`${seed}|arc|${day}`) % unseen.length];
  const at = atLondon(day, ARCS[arcId].stages[0].at);
  if (at <= now) return [];
  return [proposal(`${day}/arc/${arcId}/open`, at, 'ARC_BEAT',
    { arcId, token: hash(`${seed}|arc-token|${day}|${arcId}`), stage: ARCS[arcId].stages[0].key, opening: true })];
}

/** Resolve an owned arc action. Returns true when it handled the action. */
export function resolveArcAction(ctx) {
  const { state, action, now, ops } = ctx;
  if (!ARC_EVENT_TYPES.includes(action.type)) return false;
  const refuse = reason => { ops.skip(reason); return true; };
  const current = of(state), issued = current.issued[action.id];
  if (!issued || issued.consumed || now !== action.dueAt
    || JSON.stringify(issued.shape) !== JSON.stringify(shape(action))) return refuse('No owned arc action');
  const definition = ARCS[action.arcId];
  if (!definition) return refuse('Unknown arc');
  save(ctx, { issued: { ...current.issued, [action.id]: { ...issued, consumed: true } } });
  ctx.event.causedBy.push(issued.sourceEventId);

  if (action.type === 'ARC_BEAT' && action.opening) {
    if (of(state).activeId) return refuse('An arc is already running');
    const instance = { id: `arc:${hash(`${ctx.id}|${action.arcId}`)}`, arcId: action.arcId,
      token: action.token, status: 'running', stageIndex: 1, openedAt: now, openEventId: ctx.id,
      seen: [definition.stages[0].key] };
    save(ctx, { activeId: instance.id, instances: { ...of(state).instances, [instance.id]: instance } });
    publishBeat(ctx, definition, definition.stages[0], instance);
    return true;
  }

  const instance = of(state).instances[of(state).activeId];
  if (!instance || instance.arcId !== action.arcId || instance.token !== action.token) return refuse('No matching arc');

  if (action.type === 'ARC_BEAT') {
    const stage = definition.stages.find(item => item.key === action.stage);
    if (!stage || instance.status !== 'running') return refuse('That sign has passed');
    // A stage that names somebody in a place waits for them to be there. World
    // signs — the great majority — declare no `needs` and are unaffected: a
    // docket arriving or ink behaving oddly in an empty shop needs nobody.
    const stageLocation = stage.location ?? definition.location;
    if (stage.needs && !actuallyAt(state, stage.needs, stageLocation, stage.area)) {
      const waited = (instance.stageWaits?.[stage.key] ?? 0) + 1;
      const stageWaits = { ...(instance.stageWaits ?? {}), [stage.key]: waited };
      if (waited < ARC_RULES.presenceAttempts) {
        touch(ctx, instance, { stageWaits });
        return refuse(`${stage.needs} is not at ${stageLocation} for this sign`);
      }
      // The visit never happened. Skip the beat rather than tell it anyway —
      // an untold sign is a gap; a told one is a contradiction.
      touch(ctx, instance, { stageWaits,
        stageIndex: instance.stageIndex + 1, seen: [...instance.seen, stage.key] });
      return refuse(`${stage.needs} never came to ${stageLocation}; sign skipped`);
    }
    publishBeat(ctx, definition, stage, instance);
    touch(ctx, instance, { stageIndex: instance.stageIndex + 1, seen: [...instance.seen, stage.key] });
    return true;
  }

  if (action.type === 'ARC_CONFRONTATION') {
    if (instance.status !== 'running' || instance.stageIndex < definition.stages.length) return refuse('The arc has not run its course');
    // Both of them are in it, and both come away knowing. This is the one place
    // an arc touches memory, and it does so through the ordinary rail: they were
    // there, so they know.
    const pair = ['goaden', 'ashai'].filter(who => onStation(state, who, definition.location));
    if (pair.length < 2) {
      // He came, and they were not both there to meet him. Try again tomorrow —
      // but not forever. After five nights the thing gives up on them, which is
      // an ending, and a colder one than the fight.
      const attempts = (instance.attempts ?? 0) + 1;
      if (attempts < ARC_RULES.confrontationAttempts) {
        touch(ctx, instance, { attempts });
        return refuse('Not both of them on station tonight');
      }
      touch(ctx, instance, { attempts, status: 'confronted', faded: true, confrontedAt: now, confrontationEventId: ctx.id });
      ctx.event.location = definition.location;
      ctx.event.area = definition.confrontation.area;
      ctx.event.participants = [];
      ctx.event.payload = { arcId: definition.id, arcTitle: definition.title, stage: 'faded',
        arcInstanceId: instance.id, finale: true };
      ctx.event.causedBy.push(instance.openEventId);
      ops.publish(definition.faded.factText);
      return true;
    }
    ctx.event.location = definition.location;
    ctx.event.area = definition.confrontation.area;
    ctx.event.participants = pair;
    ctx.event.payload = { arcId: definition.id, arcTitle: definition.title, stage: 'confrontation',
      arcInstanceId: instance.id, finale: true };
    ctx.event.prose = definition.confrontation.prose;
    const fact = ops.createFact(`${instance.id}:result`, 'arc_result', 'both',
      { arcId: definition.id, presentationText: definition.confrontation.factText }, null);
    for (const who of pair) ops.learn(who, fact, 'participated');
    // A confrontation may leave one of them shaken until the day rolls over.
    const shaken = definition.confrontation.shakes;
    if (shaken && pair.includes(shaken)) {
      ops.setActor(shaken, 'conditions', [...(state.characters[shaken].conditions ?? []),
        { kind: 'shaken', since: now, until: atLondon(nextLondonDay(londonDate(now)), '00:00'), sourceEventId: ctx.id }]);
    }
    ctx.event.causedBy.push(instance.openEventId);
    ops.publish(definition.confrontation.factText);
    touch(ctx, instance, { status: 'confronted', confrontedAt: now, confrontationEventId: ctx.id });
    return true;
  }

  // ARC_CLOSED: the morning after, and the arc goes back in its box.
  if (instance.status !== 'confronted') return refuse('Nothing to close');
  ctx.event.location = definition.location;
  ctx.event.participants = [];
  ctx.event.payload = { arcId: definition.id, arcTitle: definition.title, stage: 'closed',
    arcInstanceId: instance.id, faded: Boolean(instance.faded) };
  ctx.event.causedBy.push(instance.confrontationEventId);
  const closing = instance.faded ? definition.faded.text : definition.aftermath.text;
  ctx.event.prose = closing;
  ops.publish(closing);
  const instances = Object.fromEntries(Object.entries({ ...of(state).instances,
    [instance.id]: { ...instance, status: 'closed', closedAt: now } })
    .sort((a, b) => (a[1].openedAt ?? 0) - (b[1].openedAt ?? 0)).slice(-ARC_RULES.retainedArcs));
  const exhausted = definition.once && !(of(state).exhausted ?? []).includes(definition.id)
    ? [...(of(state).exhausted ?? []), definition.id] : (of(state).exhausted ?? []);
  save(ctx, { activeId: null, instances, exhausted, lastClosedDay: londonDate(now), lastArcId: instance.id });
  return true;
}

// Where the arc happens, not always the barracks. A payoff at the Streamliner
// or the Ink was previously checking whether they were both at MI6, which is
// the wrong question and only passed by luck.
/**
 * Strictly where they are, for a stage that names them somewhere.
 *
 * Deliberately not `onStation`, whose `|| actor.location === 'mi6'` fallback
 * treats being at headquarters as being anywhere — fine for "are they around
 * tonight", useless for "is she in the shop".
 */
const actuallyAt = (state, who, location, area = null) => {
  const actor = state.characters?.[who];
  if (!actor || actor.journey || actor.activity === 'sleeping') return false;
  if (actor.location !== location) return false;
  return area ? actor.area === area : true;
};

const onStation = (state, who, location = 'mi6') => {
  const actor = state.characters?.[who];
  if (!actor || actor.journey || actor.activity === 'sleeping') return false;
  return actor.location === location || actor.location === 'mi6';
};

function publishBeat(ctx, definition, stage, instance) {
  // A stage may happen somewhere other than the arc's home — the ink follows
  // people out of the shop. File it where it happened, not where the arc lives.
  ctx.event.location = stage.location ?? definition.location;
  ctx.event.area = stage.area;
  // Signs are the world's, not theirs. Nobody is a participant in a docket
  // arriving, and nobody learns anything from one — which is what keeps the
  // ladder from quietly becoming knowledge before the night it is earned.
  ctx.event.participants = [];
  ctx.event.payload = { arcId: definition.id, arcTitle: definition.title, stage: stage.key,
    arcInstanceId: instance.id, step: instance.seen.length + (stage.key === definition.stages[0].key ? 0 : 1),
    of: definition.stages.length };
  // One sentence, told once. `fixture.mjs` already states the rule for prose
  // generally — "if (written && written !== event.publicDescription)" — and
  // assigning both here bypassed it, so the reader met the same paragraph twice,
  // plain and then italic. Publishing sets the public description; prose only
  // earns a place when it says something the description does not.
  ctx.ops.publish(stage.text);
  if (ctx.event.publicDescription && ctx.event.publicDescription.trim() !== stage.text.trim()) {
    ctx.event.prose = stage.text;
  }
}

/** A reader-facing summary of what is currently building, or null. */
export function activeArcSummary(state) {
  const current = of(state), instance = current.activeId ? current.instances[current.activeId] : null;
  if (!instance || instance.status === 'closed') return null;
  const definition = ARCS[instance.arcId];
  return { id: instance.id, title: definition.title, step: instance.seen.length,
    of: definition.stages.length, status: instance.status };
}

export function assertArcs(state) {
  const current = state.arcs;
  if (!current || current.version !== 1) throw new Error('Invalid arc ledger');
  for (const instance of Object.values(current.instances)) {
    if (!ARCS[instance.arcId]) throw new Error('Unknown arc instance');
    if (!['running', 'confronted', 'closed'].includes(instance.status)) throw new Error('Invalid arc status');
    if (instance.seen.length > ARCS[instance.arcId].stages.length) throw new Error('Arc ran past its own ladder');
  }
  if (current.activeId && !current.instances[current.activeId]) throw new Error('Arc ledger points at nothing');
  for (const id of current.exhausted ?? []) if (!ARCS[id]?.once) throw new Error('Unknown or repeatable arc marked exhausted');
}
