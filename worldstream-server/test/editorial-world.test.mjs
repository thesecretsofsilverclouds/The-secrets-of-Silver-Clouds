import test from 'node:test';
import assert from 'node:assert/strict';
import { worldEditorial } from '../src/editorial-world.mjs';
import { ARCS } from '../src/arcs.mjs';
import { leadMomentLine, MOMENT_SIGHTS } from '../src/moments.mjs';
import { UNEASE, INCIDENTS_MEDIUM, INCIDENTS_CRITICAL, AFTERMATH } from '../src/pressure.mjs';
import { editorialEvent } from '../src/editorial.mjs';

const source = (type, publicDescription, payload = {}, extra = {}) => ({
  id: 'event:world-copy', occurredAt: 1000, visibility: 'public', type, publicDescription,
  location: 'mi6', area: 'common_room', participants: [], payload,
  causedBy: ['event:committed-origin'], changes: [{ entity: 'world', field: 'privateCanary', after: 'NEVER_COPY' }], ...extra,
});
const momentSource = (moment, who, activity) => source('MOMENT_NOTICED',
  leadMomentLine({ moment, who, activity }), { moment, sight: MOMENT_SIGHTS[moment] }, { participants: [who] });

test('world moment corrections match exact committed scripts and keep the source, viewpoint and stimulus', () => {
  const cases = new Map();
  for (const moment of Object.keys(MOMENT_SIGHTS)) for (const who of ['goaden', 'ashai'])
    for (const activity of ['resting', 'sleeping', 'training', 'playing_piano', 'unhurried_time']) {
      const row = momentSource(moment, who, activity);
      if (row.publicDescription) cases.set(`${moment}:${who}:${row.publicDescription}`, row);
    }
  const before = JSON.stringify([...cases.values()]); let changed = 0;
  for (const row of cases.values()) {
    const revision = worldEditorial(row); if (!revision) continue;
    changed++;
    assert.match(revision.description, new RegExp(row.participants[0] === 'goaden' ? 'Goaden' : 'Ashai'));
    assert.match(revision.description, {
      chimes_pulse: /Chimes|chimes|New Big Ben/, arcane_surge: /Thames surge/,
      storm_breaks: /[Rr]ain|storm/, order_procession: /Holy Order/, veil_notice: /Veil festival/,
    }[row.payload.moment]);
    assert.equal(worldEditorial({ ...row, payload: { ...row.payload, moment: 'unknown' } }), null);
    assert.equal(worldEditorial({ ...row, participants: [row.participants[0] === 'goaden' ? 'ashai' : 'goaden'] }), null);
    assert.equal(worldEditorial({ ...row, location: 'sanctuary' }), null);
    assert.equal(worldEditorial({ ...row, publicDescription: `${row.publicDescription} A new committed detail.` }), null);
    assert.doesNotMatch(JSON.stringify(revision), /NEVER_COPY|causedBy|payload|changes/);
  }
  assert.equal(changed, 14);
  assert.equal(JSON.stringify([...cases.values()]), before);
  const piano = worldEditorial(momentSource('chimes_pulse', 'goaden', 'playing_piano'));
  assert.match(piano.description, /Kai did not stir/);
  assert.doesNotMatch(piano.description, /slept|woke/);
  assert.doesNotMatch(worldEditorial(momentSource('arcane_surge', 'goaden', 'unhurried_time')).description,
    /secret|true power|identity|God|Starborn|Demon|answered/);
  const legacy = source('MOMENT_NOTICED',
    'Goaden was out of the lunch hall before the second tone. Whatever it is that answers a surge in him answered this one, and Kai came off his shoulder into the air over the corridor with his scales up.',
    { moment: 'arcane_surge' }, { participants: ['goaden'] });
  assert.equal(worldEditorial(legacy).description,
    worldEditorial(momentSource('arcane_surge', 'goaden', 'unhurried_time')).description);
});

test('anonymous piano and television passages name the recorded performer without selecting a new song or show', () => {
  const cases = [
    ['PIANO_BEGIN', 'goaden', 'The music room light came on. Goaden, playing something he did not name.'],
    ['PIANO_BEGIN', 'goaden', 'Something slow came out of the music room for the best part of an hour.'],
    ['PIANO_BEGIN', 'goaden', 'The same eight bars came out of the music room a dozen times before they turned into the rest of it.'],
    ['PIANO_BEGIN', 'goaden', 'Goaden played with the door open, which he only does when he thinks nobody is up.'],
    ['TV_BEGIN', 'ashai', 'Ashai found something on the television and stopped arguing with the day.'],
    ['TV_BEGIN', 'ashai', 'Ashai watched most of something and the back of her eyelids for the rest of it.'],
    ['TV_BEGIN', 'ashai', 'The gaming room television ran all evening with Ashai in front of it and nobody changing the channel.'],
    ['TV_BEGIN', 'ashai', 'Something loud and daft was on. Ashai stayed for the whole of it and would deny that too.'],
    ['TV_BEGIN', 'ashai', 'The television went on in the gaming area. Greah settled on the back of the chair.'],
  ];
  for (const [type, who, text] of cases) {
    const row = source(type, text, {}, { participants: [who], register: 'ticker' });
    const revision = worldEditorial(row);
    assert.ok(revision);
    assert.match(revision.description, type === 'PIANO_BEGIN' ? /Goaden.*(?:piano|music.room)|piano.*Goaden/ : /Ashai/);
    assert.doesNotMatch(revision.description, /all evening|whole programme|his mother|she would deny|thinks nobody is up/);
    assert.deepEqual(Object.keys(revision), ['description'], 'a clearer routine cannot promote itself into an event');
    assert.equal(worldEditorial({ ...row, participants: ['goaden', 'ashai'] }), null);
    assert.equal(worldEditorial({ ...row, type: 'CONVERSATION' }), null);
    assert.equal(worldEditorial({ ...row, location: 'cafe' }), null);
  }
  for (const who of ['goaden', 'ashai']) {
    const name = who === 'goaden' ? 'Goaden' : 'Ashai';
    for (const [type, text] of [
      ['MUSIC_LISTEN_BEGIN', `${name} put something on and let it run.`],
      ['QUIET_TIME_BEGIN', `${name} went quiet for a bit, which with ${name} is a whole activity.`],
      ['QUIET_TIME_BEGIN', `${name} stopped, and let the evening do the rest of it.`],
    ]) assert.ok(worldEditorial(source(type, text, {}, { participants: [who] })));
  }
});

test('pressure hooks describe the recorded strangeness and aftermath without naming a culprit or adding an outcome', () => {
  let changed = 0;
  for (const row of UNEASE) {
    const event = source('UNEASE', row.text, { kind: row.kind }, { location: row.at });
    const revision = worldEditorial(event); if (!revision) continue;
    changed++;
    assert.deepEqual(Object.keys(revision), ['description']);
    assert.doesNotMatch(revision.description, /solved|identified|arrested|safe now|caused by/);
    assert.equal(worldEditorial({ ...event, payload: { kind: 'unknown' } }), null);
  }
  assert.equal(changed, 5);
  for (const kind of ['courier', 'confrontation']) {
    const raw = [...INCIDENTS_MEDIUM, ...INCIDENTS_CRITICAL].find(row => row.kind === kind);
    const row = source('INCIDENT', raw.text, { kind }, { participants: ['goaden', 'ashai'] });
    const revision = worldEditorial(row);
    assert.ok(revision);
    assert.doesNotMatch(revision.description, /killed|defeated|escaped|Nameless|demon|demon's|true identity/i);
    if (kind === 'confrontation') assert.equal(worldEditorial({ ...row, participants: ['goaden'] }), null);
  }
  for (const kind of ['pursuit', 'hunted', 'confrontation']) {
    const row = source('AFTERMATH', AFTERMATH[kind], { kind }, { participants: ['goaden', 'ashai'] });
    const revision = worldEditorial(row);
    assert.ok(revision); assert.match(revision.description, /Goaden/); assert.match(revision.description, /Ashai/);
    assert.equal(worldEditorial({ ...row, participants: ['ashai'] }), null);
  }
});

test('arc opening copy supplies its present subject while every confrontation and ending remains authored', () => {
  const changed = [];
  for (const arc of Object.values(ARCS)) for (const stage of arc.stages) {
    const row = source('ARC_BEAT', stage.text, { arcId: arc.id, arcInstanceId: `arc:${arc.id}:one`, stage: stage.key },
      { location: stage.location ?? arc.location, area: stage.area });
    const revision = worldEditorial(row); if (!revision) continue;
    changed.push(`${arc.id}:${stage.key}`);
    assert.deepEqual(Object.keys(revision), ['description']);
    assert.equal(worldEditorial({ ...row, type: 'ARC_CONFRONTATION' }), null);
    assert.equal(worldEditorial({ ...row, type: 'ARC_CLOSED' }), null);
    assert.equal(worldEditorial({ ...row, payload: { ...row.payload, arcId: 'unknown' } }), null);
    assert.equal(worldEditorial({ ...row, payload: { ...row.payload, arcInstanceId: '' } }), null);
    assert.equal(worldEditorial({ ...row, publicDescription: `${row.publicDescription} Revised later.` }), null);
    assert.doesNotMatch(revision.description, /Nameless|decant line|heating element|attention count|one tooth|captured|culprit/);
  }
  assert.equal(changed.length, 9);
  const sourceFor = (arcId, stage) => source('ARC_BEAT', ARCS[arcId].stages.find(row => row.key === stage).text,
    { arcId, arcInstanceId: 'arc:owned', stage });
  assert.match(worldEditorial(sourceFor('after_the_shield', 'monday')).description, /^On Saturday, Ashai.*four people.*eleven minutes/);
  assert.match(worldEditorial(sourceFor('familiar_one', 'absent')).description, /notebook had no sightings/);
  assert.match(worldEditorial(sourceFor('third_carriage', 'warm')).description, /Streamliner/);
});

test('private, incomplete and unrelated sources remain untouched, including an accepted separate performance', () => {
  const row = momentSource('arcane_surge', 'goaden', 'unhurried_time');
  for (const patch of [{ visibility: 'private' }, { occurredAt: null }, { id: '' }, { publicDescription: '' }, { type: 'NEW_KIND' }])
    assert.equal(worldEditorial({ ...row, ...patch }), null);
  const duplicated = { ...row, prose: row.publicDescription };
  const revised = worldEditorial(duplicated);
  assert.equal(revised.prose, revised.description);
  assert.equal(duplicated.prose, row.publicDescription);
  const separate = { ...row, prose: 'An accepted performance with its own wording.' };
  assert.equal(Object.hasOwn(worldEditorial(separate), 'prose'), false);
  assert.strictEqual(editorialEvent(row, { asOf: 999 }), row);
});

test('the integrated edition changes public wording without changing truth, dialogue or a quiet scene register', () => {
  const row = momentSource('arcane_surge', 'goaden', 'unhurried_time');
  row.payload.lines = [{ who: 'goaden', text: 'A recorded line left alone.' }];
  const before = JSON.stringify(row), revised = editorialEvent(row);
  assert.equal(revised.publicDescription, worldEditorial(row).description);
  for (const key of ['id', 'occurredAt', 'type', 'location', 'area', 'participants', 'causedBy', 'changes', 'payload'])
    assert.deepEqual(revised[key], row[key]);
  assert.equal(JSON.stringify(row), before);
  const piano = source('PIANO_BEGIN', 'The same eight bars came out of the music room a dozen times before they turned into the rest of it.',
    {}, { participants: ['goaden'], register: 'ticker' });
  const readable = editorialEvent(piano, { skipReservoir: true });
  assert.equal(readable.register, 'ticker');
  assert.match(readable.publicDescription, /Goaden repeated an eight-bar phrase/);
  assert.equal(Object.hasOwn(readable, 'prose'), false);
});
