import { SCENE_BANK_SOURCE } from './scene-bank-data.mjs';
import { polishSceneBeats } from './scene-bank-copy.mjs';

const ids = value => value.split(' ').filter(Boolean);
const names = {goaden:'Goaden',ashai:'Ashai',davis:'Davis',henderson:'Henderson',yukon:'Yukon',
  greah:'Greah',emily:'Emily',sprite_orange:'the first sprite',sprite_shades:'the second sprite',
  syndicate_man:'the man',inspector:'the inspector',stranger:'the stranger',customer:'the customer'};
const prose = text => ({kind:'prose',text});
const say = (who,text,expression='idle') => ({kind:'dialogue',who,text,expression});
const nimbus = (text,expression) => ({kind:'prose',who:'nimbus',text,expression,nimbusPlate:expression});

// Every omitted scene has a named gate below. An ANY label in the workshop is
// not a license to manufacture a prior injury, report, ability or secret.
const OPEN = new Set(ids('C2 C3 C7 C9 E2 E4 E6 E7 E9 E10 E11 E13 F6 G1 G2 G3 G5 H1 H3 I1 I2 I7 I8 I10 J2 J5 M3 N1 N2 N6 N7'));
const CONDITIONAL = {
  C1:'one_hour_of_shared_training', C6:'wet_outdoor_training', D1:'actual_north_face_alarm',
  // E3 is the callback, not the introduction. "Forty-one so far" only means
  // anything to somebody who watched her start counting, and meeting Emily
  // for the first time through three cryptic lines wastes the best entrance
  // in the plaza. The venue scene is where she counts who looks up, and says
  // "Forty-four. That one was you." This one waits for it.
  E3:'played_plaza_emily_counting',
  D5:'morning_after_actual_alarm', E1:'sustained_rain_forecast', E5:'actual_piano_performance',
  E8:'yukon_has_completed_game', E12:'actual_closed_plaza_path', E14:'actual_north_face_alarm',
  E15:'reported_vent_shortcut', F1:'awake_yukon_and_sleeping_goaden', F2:'F1_chase_continuation',
  F3:'morning_after_F1', F4:'actual_blackout', F5:'authorised_extinct_animal_training',
  H2:'rain_starts_during_training', H4:'nimbus_known_rooftop_sighting', H5:'nimbus_bounty_issued',
  H6:'actual_absorbed_ward_report', H7:'three_days_of_observed_following',
  I9:'observed_bear_form_all_morning', K1:'actual_emily_swing_presence_after_dark',
  L1:'active_veil_and_lanterns', L3:'actual_empty_stall_cordon', L4:'four_observed_forms_this_month',
  L5:'high_arcane_reading', M1:'actual_two_am_duty', M4:'actual_retained_camera_recording',
  M5:'prior_unrecognised_door_notice', N3:'one_hour_continuous_rain_at_window',
  N4:'actual_bell_strikes', N5:'established_shared_chair_routine', N8:'whole_day_without_incident',
};
const CLOSED = {
  B1:'A completed handover with this cast has not been established.',
  B2:'Three weeks of Ashai volunteering for nights have not happened.',
  B3:'A recruit demonstration needs a staffed training session.',
  B4:'The specific filed report is not established by the betrayal anchor.',
  B5:'Greah must first have given the advice being recalled.',
  // Part Two is post-betrayal throughout; B1-B5, B7 and B8 were closed on that
  // ground and this one was missed. The charm is not behind them at this
  // checkpoint, so wordless cold civility is the wrong Davis for the world.
  B6:'Part Two is after the betrayal; that phase has not been reached.',
  B7:'Marked after the current manuscript checkpoint.',
  B8:'Do not create a new family-search promise across the disclosure boundary.',
  C4:'A bad landing needs an injury and care lifecycle, not a passing line.',
  C5:'Goaden must actually have won the preceding round.',
  C8:'Marked after the current manuscript checkpoint; assumes a night-rota dispute.',
  C10:'The claimed three superior senses are not established canon.',
  D2:'Requires a resolved physical break-in and an actual inventory inspection.',
  D3:'Requires an actual lockdown and a consequential security finding.',
  D4:'The basement stays sealed; Fade cost cannot be invented off-page.',
  D6:'Requires a recorded camera displacement and a security investigation.',
  D7:'The current checkpoint does not authorise access to the sealed floor.',
  D8:'Requires a real agreed Order inspection; marked after the checkpoint.',
  F7:'A grove-guardian transformation is beyond currently taught abilities.',
  G4:'Yukon needs an actual city outing with the sprites.',
  I3:'The bank attributes Amy’s line to Ashai without an acquired source.',
  I4:'Kai is not an established source of fire; the supposed earlier lighting is unsupported.',
  I5:'A real flame-spell incident and its consequences are not established.',
  I6:'The named companion is behind the current spoiler boundary.',
  J1:'An untracked stranger and predation premise need an owned encounter.',
  J3:'A consequential Presence confrontation needs authorised MI6 access and outcomes.',
  J4:'The bank’s numerical age conflicts with the current anchored character description.',
  J6:'Requires an actual earlier prohibition and authorised reception visit.',
  K2:'No entry to the sealed basement or unexplained traversal below it.',
  K3:'The garden has no established accessible location or visit.',
  K4:'Cannot infer Ashai had the same private experience two floors away.',
  K5:'The inaccessible house and Order operative need a separate owned story.',
  L2:'A Duskkin customer and knowledge of his origin are not established.',
  L6:'The immortal’s origin is outside this checkpoint’s knowledge boundary.',
  M2:'The vault inventory is not an accessible, established source.',
};
const CAST = {
  B6:'ashai davis', C1:'goaden ashai', C2:'yukon goaden', C3:'ashai davis', C6:'ashai yukon', C7:'goaden yukon ashai', C9:'goaden ashai kai',
  D1:'goaden ashai',D5:'goaden ashai',E1:'goaden ashai',E2:'ashai goaden',E3:'emily ashai',E4:'ashai goaden',E5:'yukon goaden',E6:'greah ashai',E7:'henderson ashai',E8:'yukon ashai',E9:'goaden emily',E10:'emily ashai',E11:'davis goaden',E12:'ashai goaden',E13:'yukon goaden kai',E14:'ashai greah',E15:'yukon henderson',
  F1:'yukon goaden',F2:'yukon ashai goaden',F3:'yukon goaden ashai',F4:'yukon',F5:'yukon henderson',F6:'yukon ashai',
  G1:'sprite_orange sprite_shades ashai',G2:'sprite_orange goaden',G3:'sprite_orange ashai',G5:'sprite_orange sprite_shades goaden ashai',
  H1:'ashai greah',H2:'yukon goaden',H3:'emily ashai',H4:'goaden yukon nimbus',H5:'davis ashai',H6:'henderson ashai',H7:'yukon goaden ashai nimbus',
  I1:'goaden yukon',I2:'goaden ashai',I7:'emily goaden',I8:'yukon ashai',I9:'greah ashai',I10:'yukon goaden',
  J2:'emily ashai',J5:'emily ashai',K1:'goaden yukon',L1:'ashai goaden',L3:'ashai yukon',L4:'yukon goaden',L5:'goaden ashai',M1:'ashai davis',M3:'goaden kai',M4:'davis ashai',M5:'henderson yukon',N1:'goaden ashai',N2:'ashai davis',N3:'ashai greah',N4:'emily',N5:'ashai henderson',N6:'yukon goaden',N7:'goaden ashai kai',N8:'davis ashai',
};
const NIMBUS = {
  P1:{cast:'goaden ashai nimbus',days:0,deps:[],plate:'smile'},
  P2:{cast:'goaden ashai nimbus',days:1,deps:['P1'],plate:'smile',area:'common_room'},
  P3:{cast:'davis ashai',days:7,deps:['P2']},
  P4:{cast:'sprite_orange sprite_shades nimbus',days:8,deps:['P3'],escort:true,plate:'showoff'},
  P5:{cast:'sprite_orange sprite_shades ashai nimbus',days:8,deps:['P4'],escort:true,plate:'happy'},
  P6:{cast:'goaden ashai nimbus',days:14,deps:['P5'],plate:'smile'},
  P8:{cast:'yukon goaden nimbus',days:21,deps:['P6'],plate:'wink'},
  P7:{cast:'yukon nimbus',days:22,deps:['P8'],plate:'surprised'},
  P10:{cast:'davis goaden nimbus',days:30,deps:['P7'],plate:'smile'},
  P9:{cast:'henderson ashai',days:31,deps:['P10']},
  P11:{cast:'ashai yukon nimbus',days:35,deps:['P9'],plate:'showoff',area:'indoor_yard'},
  P12:{cast:'davis ashai nimbus',days:60,deps:['P11'],plate:'wink'},
  P13:{cast:'goaden syndicate_man nimbus',days:65,deps:['P12'],plate:'angry'},
  P14:{cast:'ashai goaden nimbus',days:70,deps:['P13'],plate:'angry',night:true},
  P15:{cast:'goaden ashai nimbus',days:90,deps:['P14'],plate:'smile'},
  P16:{cast:'yukon ashai goaden nimbus',days:92,deps:['P15'],plate:'smile'},
  P17:{cast:'henderson davis',days:95,deps:['P16']},
  P18:{cast:'yukon goaden ashai nimbus',days:98,deps:['P17'],plate:'happy'},
  P19:{cast:'ashai inspector nimbus',days:120,deps:['P18'],plate:'wink'},
  P20:{cast:'ashai goaden nimbus',days:125,deps:['P19'],plate:'smile'},
  P21:{cast:'emily nimbus',days:130,deps:['P20'],plate:'surprised',privateGarden:true},
  P22:{cast:'davis ashai',days:150,deps:['P21']},
};

const areaFor = setting => setting.includes('gaming room') ? 'gaming_room'
  : setting.includes('music room') ? 'music_room' : setting.includes('ops room') ? 'ops_room'
  : setting.includes('briefing room') ? 'briefing_room' : setting.includes('quarters') ? 'quarters'
  : setting.includes('indoor yard') ? 'indoor_yard' : setting.includes('training') ? 'training'
  : setting.includes('rooftop') ? 'rooftop' : setting.includes('reception') ? 'reception'
  : setting.includes('corridors') ? 'corridors' : setting.startsWith('`MI6') ? 'common_room' : 'venue';
const locationFor = setting => setting.startsWith('`MI6') ? 'mi6' : setting.startsWith('`cafe') ? 'cafe'
  : setting.startsWith('`Enchanted Ink') ? 'enchanted_ink' : setting.startsWith('`Big Ben') ? 'big_ben_plaza' : null;

const changes = {
  P3:[prose('Davis laid an authorisation from MI6’s higher leadership on the desk. Henderson’s name was absent.'),
    say('davis','Live capture. The figure has six digits in it.'),say('ashai','For a rat.'),
    say('davis','For a Classified Hazardous Entity that civilians have given three affectionate nicknames. Somebody will try. Probably somebody underqualified.'),
    say('ashai','And if it’s already somewhere safe?'),say('davis','Then the people upstairs still have a bounty out for it.'),
    prose('Ashai left the notice where it was. Davis returned to her screen.')],
  P9:[prose('Henderson had the containment-discharge report from Operations open in his hand. Davis had recorded the spent ward, the absence of residue and the creature on the cabinet.'),
    say('henderson','Something ate the ward.'),say('ashai','Yes, sir.'),
    say('henderson','And it’s still here.'),say('ashai','Yes, sir.'),
    prose('He closed the report. His eyes went to the biscuit crumbs on Ashai’s sleeve.'),
    say('henderson','Keep it away from the contractors. They charge enough already.')],
  P15:[prose('There was a tin on the common-room shelf now. Goaden and Ashai refilled it whenever either found it empty. This time Ashai put a saucer beside it.'),
    say('goaden','Making yourself at home?'),say('ashai','It was spilling crumbs.'),
    nimbus('Nimbus settled beside the saucer, comfortably within reach of both.', 'smile'),
    prose('They left the tin where it was.')],
  P17:[prose('Henderson closed the discharge report before Davis sat down. Neither of them needed to look at it again.'),
    say('davis','The entity is still living in this building.'),say('henderson','Yes.'),
    say('davis','The people above you issued the capture authority. They haven’t withdrawn it.'),
    say('henderson','I know.'),
    prose('Davis studied him for a moment. He had known since the report. He had not minded then; he did not mind now. There was nothing here to hold over him.'),
    say('henderson','Anything else, Agent Davis?'),say('davis','I’ll want the pen back.'),
    prose('She left without adding anything to the registry.')],
  P18:[say('yukon','It needs a name.'),say('goaden','It’s got three.'),
    say('yukon','It’s got three nicknames. Cloud Rat’s what strangers call it. Puff Gremlin’s an insult. Chimney Phantom’s what the papers say when they haven’t seen it.'),
    say('ashai','Nimbus?'),nimbus('Nimbus opened one eye at the sound and looked extremely pleased with himself.','happy'),
    say('goaden','Right. That, then.')],
  P22:[prose('Davis slid a notice from higher command across the Operations desk. The live-capture authorisation had been withdrawn.'),
    say('ashai','Why?'),say('davis','The two who came over the roof came back without it. Their employer has stopped accepting the contract.'),
    say('ashai','Is that good?'),say('davis','It’s quieter. I’ve stopped asking for more than quieter.'),
    prose('She put the withdrawal beside the original notice. Both would stay on file.')],
};

function authoredBeats(source, spec) {
  let beats = structuredClone(changes[source.id] ?? source.beats);
  if (source.id === 'C2') beats[0].text += ' His skin stayed grey and his ears stayed pointed.';
  if (source.id === 'I8') beats = beats.map(b => ({...b,text:b.text.replace('already grey and small and four-legged','already grey and small and four-legged, with pointed ears')}));
  if (source.id === 'P10') beats.push(prose('Davis recorded the containment discharge and what had swallowed it in a restricted incident report for Henderson. She left the hazardous-entity registry alone.'));
  if (source.id === 'P12') beats.push(nimbus('Nimbus turned the stolen pen in his paws. Davis looked straight at him. He winked.','wink'));
  if (source.id === 'P13') beats = beats.map(b => ({...b,text:b.text.replace('Six figures, for live capture.', 'Six figures on your higher-ups’ capture authority.')}));
  if (source.id === 'P19') beats = beats.map(b => b.who === 'ashai' && b.text.includes('paperwork')
    ? say('ashai','The readings are logged. General Henderson has the report.') : b);
  // The workshop gives him no spoken lines. Even his final visual beat is an
  // observed movement, never words put into a creature's mouth.
  if (spec?.plate && !beats.some(b => b.who === 'nimbus')) {
    const captions = {smile:'Nimbus settled into the warm fold of the coat.',happy:'Nimbus looked immensely pleased.',
      wink:'Nimbus opened one eye and winked.',showoff:'Nimbus held still, waiting to be appreciated.',
      surprised:'Nimbus blinked at what he had done.',angry:'Nimbus bristled, his edges dark with weather.'};
    const existing = {P1:0, P4:3, P5:1, P7:1, P10:0, P11:0, P13:4, P14:1, P20:5, P21:1}[source.id];
    if (Number.isInteger(existing) && beats[existing]?.kind === 'prose') {
      beats[existing] = {...beats[existing], who:'nimbus', expression:spec.plate, nimbusPlate:spec.plate};
    } else beats.push(nimbus(captions[spec.plate],spec.plate));
  }
  // P6's denied meal and pressure change precede the tin, then the smile.
  if (source.id === 'P6') beats.splice(2,0,nimbus('Nimbus stared at the closed tin. The edges of him darkened.','angry'));
  if (source.id === 'P6') beats[beats.length - 1] = nimbus('Goaden opened the tin. Nimbus ate, and the air in the room loosened.','smile');
  if (source.id === 'P5') beats.push(nimbus('Goaden held his coat open. Nimbus climbed back into the lining, taking a last scatter of crumbs with him.','happy'));
  return polishSceneBeats(source.id,beats);
}

export const SCENE_BANK_CATALOG = Object.freeze(SCENE_BANK_SOURCE.map(source => {
  const spec = NIMBUS[source.id], artefact = source.id.startsWith('A');
  const status = spec || OPEN.has(source.id) ? 'enabled' : CONDITIONAL[source.id] ? 'prerequisite_gated' : 'excluded';
  return Object.freeze({...source, location:locationFor(source.setting), area:spec?.area ?? areaFor(source.setting),
    cast:ids(spec?.cast ?? CAST[source.id] ?? ''), status,
    gate:artefact ? 'A complete single-use artefact lifecycle is required; no registry name or proven immortality-ending power is admitted.'
      : CLOSED[source.id] ?? CONDITIONAL[source.id] ?? null,
    dependencies:spec?.deps ?? [], minAgeDays:spec?.days ?? 0, nimbusPlate:spec?.plate ?? null,
    escort:spec?.escort ?? false, privateGarden:spec?.privateGarden ?? false,
    night:spec?.night ?? /after dark|night|small hours/.test(source.setting),
    beats:authoredBeats(source,spec),
    adaptation:changes[source.id] ? 'Causal/canon correction to the creator’s scene; see authored beats and tests.'
      : source.id === 'P10' ? 'The witnessed absorption creates the restricted report Henderson later reads.'
      : source.id === 'P2' ? 'The conversation can happen in the common room; no corridor-specific action is lost.' : null,
  });
}));
export const SCENE_BANK_BY_ID = Object.freeze(Object.fromEntries(SCENE_BANK_CATALOG.map(s => [s.id,s])));
export const SCENE_BANK_MANIFEST = Object.freeze(SCENE_BANK_CATALOG.map(({id,title,status,gate,dependencies,minAgeDays,location,area,adaptation}) =>
  Object.freeze({id,title,status,gate,dependencies,minAgeDays,location,area,adaptation})));

export function sceneNarrativeParagraphs(scene) {
  const speakers = new Set(scene.beats.filter(beat => beat.kind === 'dialogue').map(beat => beat.who));
  let spoken = 0, previous = null;
  return scene.beats.map(beat => {
    if (beat.kind !== 'dialogue') { spoken = 0; previous = null;
      return {kind:'prose',text:beat.text,...(beat.who ? {who:beat.who} : {})}; }
    const text = beat.text.trim(), punctuated = /[.!?…—–]$/.test(text) ? text : `${text}.`;
    const who = names[beat.who] ?? beat.who;
    // Presentation is a novel paragraph; performance/indexing keeps the raw
    // speech separately. Stage labels, speaker capitals and workshop notes do
    // not leak into the manuscript.
    const attribute = spoken < 2 || speakers.size !== 2 || spoken % 4 === 0 || previous === beat.who || beat.delivery;
    spoken++; previous = beat.who;
    const quote = attribute && !/[?!…—–]$|\.{3}$/.test(punctuated) ? punctuated.replace(/\.$/, ',') : punctuated;
    return {kind:'dialogue',who:beat.who,text:`“${quote}”${attribute ? ` ${who} ${text.endsWith('?')?'asked':'said'}${beat.delivery ? ` ${beat.delivery}` : ''}.` : ''}`};
  });
}
