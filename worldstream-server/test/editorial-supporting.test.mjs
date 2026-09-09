import test from 'node:test';
import assert from 'node:assert/strict';
import { supportingEditorial } from '../src/editorial-supporting.mjs';

const FAMILIES = [
  ['another attempt', 'yukon'], ['a timing question', 'henderson'],
  ['a handover interval', 'davis'], ['a quiet seat', 'kartel'],
  ['time with Kai', 'kai'], ['time with Greah', 'greah'],
  ['a little quiet', 'rose'], ['a shorter rhythm', 'anarchy'],
  ['an end to the argument', 'balthazar'], ['one short verse', 'gabriel'],
  ['a few minutes together', 'truth'], ['a bass part that is not working', 'damien'], ['a cautious pause', 'emily'],
  ['an unhurried interval', 'zara'],
];
function source(family = 'another attempt', type = 'SUPPORTING_COMMITMENT', options = {}) {
  const guest = FAMILIES.find(([key]) => key === family)?.[1] ?? 'yukon';
  const lead = options.lead ?? (guest === 'greah' ? 'ashai' : 'goaden');
  const cast = ['anarchy', 'balthazar'].includes(guest) ? [lead, 'anarchy', 'balthazar'] : [lead, guest];
  return {
    id: options.id ?? `event:${family}:${type}`, type, visibility: 'public',
    occurredAt: 100, location: 'mi6', area: 'common_room', participants: [lead],
    description: 'The original source sentence.',
    payload: { supportingStoryId: 'support:test', family, cast,
      ...(options.outcome ? { outcome: options.outcome } : {}) },
  };
}
const prose = value => `${value?.description}\n${value?.prose}`;

test('current production family subjects and legacy ledger labels receive the same guarded performance', () => {
  const aliases = [
    ['another attempt', 'one more go at the game'], ['a timing question', 'a question about the rota'],
    ['a handover interval', 'the gap between handovers'], ['a quiet seat', 'the second chair'],
    ['time with Kai', 'half an hour with Kai'], ['time with Greah', 'a quiet half hour with Greah'],
    ['a little quiet', 'a few minutes of not competing'], ['a shorter rhythm', 'a rhythm run past Goaden'],
    ['an end to the argument', 'an argument older than the room'], ['one short verse', 'an opinion on a verse'],
    ['a few minutes together', 'a few minutes without the next thing'], ['a cautious pause', 'a few minutes nearby'],
    ['an unhurried interval', 'a break from the handover'],
  ];
  for (const [legacy, current] of aliases) for (const [type, outcome] of [
    ['SUPPORTING_COMMITMENT'], ['SUPPORTING_ENCOUNTER'], ['SUPPORTING_OUTCOME', 'kept'],
  ]) {
    const oldEvent = source(legacy, type, { outcome });
    const currentEvent = { ...oldEvent, payload: { ...oldEvent.payload, family: current } };
    assert.deepEqual(supportingEditorial(currentEvent), supportingEditorial(oldEvent));
    assert.equal(supportingEditorial({ ...currentEvent, payload: { ...currentEvent.payload, cast: [] } }), null);
  }
});

test('Yukon scene dialogue honours attendance, the company outcome and original authored lines', () => {
  for (const lead of ['goaden', 'ashai']) for (const [type, outcome] of [
    ['SUPPORTING_ENCOUNTER'], ['SUPPORTING_OUTCOME', 'kept'],
  ]) {
    const event = source('another attempt', type, { lead, outcome });
    const before = JSON.stringify(event), result = supportingEditorial(event);
    assert.ok(result.lines.length >= 4 && result.lines.length <= 6);
    assert.deepEqual(new Set(result.lines.map(line => line.who)), new Set(['yukon', lead]));
    assert.doesNotMatch(result.lines.map(line => line.text).join(' '), /\bwon\b|\blost\b|score|record|next time|try again/i);
    for (const storage of ['lines', 'payload']) {
      const lines = [{ who: lead, text: 'Existing authored exchange.' }];
      const saved = storage === 'lines' ? { ...event, lines } : { ...event, payload: { ...event.payload, lines } };
      assert.equal(supportingEditorial(saved).lines, undefined);
      assert.deepEqual(storage === 'lines' ? saved.lines : saved.payload.lines, lines);
    }
    result.lines[0].text = 'Changed by a caller';
    assert.notEqual(supportingEditorial(event).lines[0].text, result.lines[0].text);
    assert.equal(JSON.stringify(event), before);
    const absent = { ...event, payload: { ...event.payload, cast: [lead] } };
    assert.equal(supportingEditorial(absent), null);
  }
  for (const [type, outcome] of [['SUPPORTING_COMMITMENT'], ['SUPPORTING_CALLBACK', 'kept'],
    ['SUPPORTING_OUTCOME', 'missed'], ['SUPPORTING_OUTCOME', 'cut_short']])
    assert.equal(supportingEditorial(source('another attempt', type, { outcome })).lines, undefined);
});

test('new supporting exchanges use only the attended cast and preserve either source dialogue representation', () => {
  for (const [family, guest] of FAMILIES) for (const lead of ['goaden', 'ashai']) {
    const event = source(family, 'SUPPORTING_ENCOUNTER', { lead });
    const result = supportingEditorial(event);
    if (!result) continue;
    const before = JSON.stringify(event);
    if (result.lines) {
      assert.ok(result.lines.length >= 4 && result.lines.length <= 6, family);
      for (const line of result.lines) assert.ok(event.payload.cast.includes(line.who), `${family}: ${line.who}`);
      assert.ok(result.lines.some(line => line.who === lead), `${family} gives the present lead an answer`);
      assert.ok(result.lines.some(line => line.who === guest));
      assert.doesNotMatch(result.lines.map(line => line.text).join(' '), /\bwon\b|new record|forgiv|tomorrow|next week|secret mission|revelation/i);
      result.lines[0].text = 'Caller mutation';
      assert.notEqual(supportingEditorial(event).lines[0].text, 'Caller mutation');
    }
    for (const field of ['lines', 'payload']) {
      const lines = freeze([{ who: lead, text: 'This source scene was already authored.' }]);
      const existing = freeze(field === 'lines' ? { ...event, lines } : { ...event, payload: { ...event.payload, lines } });
      assert.equal(supportingEditorial(existing).lines, undefined, `${family}/${field}`);
      assert.equal(field === 'lines' ? existing.lines : existing.payload.lines, lines);
    }
    assert.equal(JSON.stringify(event), before);
    assert.equal(supportingEditorial({ ...event, payload: { ...event.payload, cast: [lead] } }), null);
  }
});

test('quiet companions keep their silence and shared-body scenes retain one physical body in every variant', () => {
  for (const family of ['a quiet seat', 'time with Kai', 'time with Greah', 'a little quiet'])
    for (const [type, outcome] of [['SUPPORTING_COMMITMENT'], ['SUPPORTING_ENCOUNTER'],
      ['SUPPORTING_OUTCOME', 'kept'], ['SUPPORTING_CALLBACK', 'kept']]) {
      const result = supportingEditorial(source(family, type, { outcome }));
      assert.equal(result.lines, undefined);
      assert.doesNotMatch(prose(result), /(?:Hammond|Captain) (?:said(?! nothing)|asked|replied|whispered)/i);
    }
  for (const family of ['a shorter rhythm', 'an end to the argument']) for (let i = 0; i < 32; i++)
    for (const [type, outcome] of [['SUPPORTING_COMMITMENT'], ['SUPPORTING_ENCOUNTER'],
      ['SUPPORTING_OUTCOME', 'kept'], ['SUPPORTING_CALLBACK', 'kept']]) {
      const result = supportingEditorial(source(family, type, { outcome, id: `one-body:${i}` }));
      assert.match(result.prose, /same body|shared body|two presences in one body|through Anarchy’s body|body he shared with Anarchy|shared the same body/i);
      assert.doesNotMatch(result.prose, /Balthazar (?:stood|sat|walked) (?:beside|opposite)|two (?:men|bodies)/i);
    }
});

test('all failure families report only the lost shared time without staging absent actors or retrying', () => {
  for (const [family, guest] of FAMILIES) for (const outcome of ['missed', 'cut_short']) {
    const event = source(family, 'SUPPORTING_OUTCOME', { outcome });
    const lead = event.participants[0];
    event.participants = []; event.payload.cast = [];
    const story = { id: 'support:test', family, guest, lead, causalEventIds: [event.id] };
    const result = supportingEditorial(event, { story });
    assert.ok(result);
    assert.equal(result.lines, undefined);
    assert.doesNotMatch(prose(result), /smiled|looked at|nodded|promised|tomorrow|next time|forgiv|apologi|secret|MI6 recall/i);
    assert.match(prose(result), outcome === 'missed' ? /never began|did not happen|never took|without/i : /cut short|ended early|interrupted|ended sooner/i);
  }
});

test('revised prose states concrete actions without adding a verdict or manufacturing Emily revelations', () => {
  for (const [family] of FAMILIES) for (let i = 0; i < 16; i++) for (const [type, outcome] of [
    ['SUPPORTING_COMMITMENT'], ['SUPPORTING_ENCOUNTER'], ['SUPPORTING_OUTCOME', 'kept'],
    ['SUPPORTING_CALLBACK', 'kept'], ['SUPPORTING_CALLBACK', 'missed'], ['SUPPORTING_CALLBACK', 'cut_short'],
  ]) {
    const result = supportingEditorial(source(family, type, { outcome, id: `concrete:${i}` }));
    assert.ok(result.prose.length > 30 && result.prose.length < 550, `${family}/${type}`);
    assert.doesNotMatch(result.prose, /quiet keep its shape|ordinary dimensions|nothing spectacular|small space in the day|belonged to both their knowledge|interesting amount of company|interval had ended|the feeling of it/i);
    if (family === 'a cautious pause') assert.doesNotMatch(prose(result), /explained|mystery|secret|Holy|power|revelation|terrifi|unsettling|no easier to read/i);
    if (['one short verse', 'a shorter rhythm', 'an end to the argument'].includes(family))
      assert.doesNotMatch(prose(result), /in (?:his|her) favour|\bwon\b|praised|approved|hated|improved|new lyrics/i);
  }
});
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}

test('all authored families render each actual stage with bounded prose and only eligible scene dialogue', () => {
  for (const [family] of FAMILIES) for (const [type, outcome] of [
    ['SUPPORTING_COMMITMENT'], ['SUPPORTING_ENCOUNTER'], ['SUPPORTING_OUTCOME', 'kept'],
    ['SUPPORTING_CALLBACK', 'kept'], ['SUPPORTING_CALLBACK', 'missed'], ['SUPPORTING_CALLBACK', 'cut_short'],
  ]) {
    const event = source(family, type, { outcome });
    const result = supportingEditorial(event);
    assert.ok(result, `${family}/${type}/${outcome}`);
    const hasDialogue = type === 'SUPPORTING_ENCOUNTER' && [
      'another attempt', 'a handover interval', 'a shorter rhythm', 'an end to the argument',
      'one short verse', 'a few minutes together', 'a bass part that is not working', 'a cautious pause', 'an unhurried interval',
    ].includes(family) || family === 'another attempt' && type === 'SUPPORTING_OUTCOME' && outcome === 'kept';
    assert.deepEqual(Object.keys(result).sort(), hasDialogue ? ['description', 'lines', 'prose'] : ['description', 'prose']);
    assert.ok(result.description.length > 15 && result.prose.length > 30);
    assert.ok(result.prose.length < 550);
    assert.doesNotMatch(prose(result), /\b(?:the an|the a|the another|their an|their a)\b|undefined|NaN/i);
    assert.doesNotMatch(prose(result), /silently rewritten|time kept|within the agreed window|state|ledger|factKey|token/i);
  }
});

test('the same event is immutable and renders identically regardless of later state or reads', () => {
  const event = freeze(source('one short verse'));
  const before = JSON.stringify(event);
  const currentStory = freeze({ id: 'support:test', family: 'one short verse', guest: 'gabriel',
    lead: 'goaden', causalEventIds: [event.id], result: { outcome: 'missed', secret: 'DO_NOT_PRINT' } });
  const result = supportingEditorial(event);
  for (let i = 0; i < 20; i++) assert.deepEqual(supportingEditorial(event, { story: currentStory }), result);
  assert.equal(JSON.stringify(event), before);
  assert.match(result.description, /agreed to listen/);
  assert.doesNotMatch(prose(result), /missed|DO_NOT_PRINT|never began/);
});

test('stable variants change presentation only and do not invent a game result or verse opinion', () => {
  for (const [family] of FAMILIES) {
    const versions = new Set();
    for (let i = 0; i < 32; i++) {
      const event = source(family, 'SUPPORTING_OUTCOME', { outcome: 'kept', id: `ending:${i}` });
      versions.add(supportingEditorial(event).prose);
    }
    assert.equal(versions.size, 2, family);
  }
  for (const family of ['another attempt', 'one short verse']) for (let i = 0; i < 16; i++) {
    const rendered = supportingEditorial(source(family, 'SUPPORTING_OUTCOME', { outcome: 'kept', id: `proof:${i}` }));
    assert.doesNotMatch(prose(rendered), /\bwon\b|\blost\b|score|high score|new record|praised|approved|hated|lyrics|promised another/i);
  }
});

test('protagonist substitution preserves Ashai and Goaden without introducing the other lead', () => {
  for (const [family, guest] of FAMILIES.filter(([, id]) => !['kai', 'greah', 'anarchy', 'balthazar'].includes(id))) {
    for (const lead of ['goaden', 'ashai']) for (const [type, outcome] of [
      ['SUPPORTING_COMMITMENT'], ['SUPPORTING_ENCOUNTER'], ['SUPPORTING_OUTCOME', 'kept'], ['SUPPORTING_CALLBACK', 'kept'],
    ]) {
      const result = supportingEditorial(source(family, type, { lead, outcome }));
      assert.ok(result, `${guest}/${lead}/${type}`);
      assert.match(prose(result), new RegExp(lead === 'goaden' ? 'Goaden' : 'Ashai'));
      assert.doesNotMatch(prose(result), new RegExp(lead === 'goaden' ? 'Ashai' : 'Goaden'));
    }
  }
});

test('performed scenes require actual lead and guest attendance, shared body and Guardian owner', () => {
  const absentGuest = source(); absentGuest.payload.cast = ['goaden', 'kai'];
  assert.equal(supportingEditorial(absentGuest), null);
  const absentLead = source(); absentLead.participants = [];
  assert.equal(supportingEditorial(absentLead), null);
  const twoLeads = source(); twoLeads.participants.push('ashai');
  assert.equal(supportingEditorial(twoLeads), null);
  const wrongOwner = source('time with Kai', 'SUPPORTING_ENCOUNTER', { lead: 'ashai' });
  assert.equal(supportingEditorial(wrongOwner), null);
  const wrongGreah = source('time with Greah', 'SUPPORTING_ENCOUNTER', { lead: 'goaden' });
  assert.equal(supportingEditorial(wrongGreah), null);
  const splitBody = source('an end to the argument'); splitBody.payload.cast = ['goaden', 'balthazar'];
  assert.equal(supportingEditorial(splitBody), null);
  assert.equal(supportingEditorial(source('a shorter rhythm', 'SUPPORTING_COMMITMENT', { lead: 'ashai' })), null);
  const together = supportingEditorial(source('an end to the argument', 'SUPPORTING_OUTCOME', { outcome: 'kept' }));
  assert.match(prose(together), /same body|two presences|body he shared with Anarchy/i);
});

test('Guardian prose never invents travel to meet an owner or a separate appointment', () => {
  for (const family of ['time with Kai', 'time with Greah']) for (const [type, outcome] of [
    ['SUPPORTING_COMMITMENT'], ['SUPPORTING_ENCOUNTER'], ['SUPPORTING_OUTCOME', 'kept'],
    ['SUPPORTING_OUTCOME', 'missed'], ['SUPPORTING_OUTCOME', 'cut_short'], ['SUPPORTING_CALLBACK', 'kept'],
  ]) for (let i = 0; i < 6; i++) {
    const result = supportingEditorial(source(family, type, { outcome, id: `${family}:${type}:${i}` }));
    assert.doesNotMatch(prose(result), /made it back|arrived|appointment|reunited|meeting|came back to (?:Kai|Greah)|returned to meet/i);
  }
});

test('missed and interrupted events describe historical failure without staging absent guests', () => {
  for (const [outcome, phrase] of [['missed', /never began|did not happen/], ['cut_short', /cut short|ended early/]]) {
    const event = source('one short verse', 'SUPPORTING_OUTCOME', { outcome });
    event.participants = []; event.payload.cast = [];
    const story = { id: 'support:test', family: 'one short verse', guest: 'gabriel', lead: 'ashai',
      causalEventIds: [event.id], interruptionReason: 'SECRET_RECALL', result: { private: 'HIDDEN_RESULT' } };
    const result = supportingEditorial(event, { story });
    assert.match(result.description, /Ashai and Gabriel/);
    assert.match(result.description, phrase);
    assert.doesNotMatch(prose(result), /looked at|smiled|nodded|still nearby|forgave|apologi|recalled|SECRET|HIDDEN/);
    const unknownLead = supportingEditorial(event);
    assert.doesNotMatch(prose(unknownLead), /Goaden|Ashai/);
    assert.equal(event.participants.length, 0);
  }
});

test('historical attribution requires exact story ownership and never reads private context', () => {
  const event = source('another attempt', 'SUPPORTING_OUTCOME', { outcome: 'missed' });
  event.participants = []; event.payload.cast = [];
  const story = { id: 'support:test', family: 'another attempt', guest: 'yukon', lead: 'ashai', causalEventIds: [event.id] };
  for (const key of ['result', 'conditions', 'knowledge', 'interruptionReason', 'token'])
    Object.defineProperty(story, key, { get() { throw new Error(`Private ${key} was read`); } });
  const result = supportingEditorial(event, { story });
  assert.match(result.description, /Ashai/);
  for (const patch of [{ id: 'different' }, { family: 'a quiet seat' }, { guest: 'gabriel' },
    { causalEventIds: ['another-event'] }, { lead: 'private-agent' }]) {
    const mismatch = supportingEditorial(event, { story: { ...story, ...patch } });
    assert.doesNotMatch(prose(mismatch), /Ashai|private-agent/);
  }
});

test('callbacks acknowledge only the recorded ending, with no automatic retry or forgiveness', () => {
  const texts = new Map();
  for (const outcome of ['kept', 'missed', 'cut_short']) {
    const event = source('another attempt', 'SUPPORTING_CALLBACK', { outcome });
    const rendered = supportingEditorial(event);
    texts.set(outcome, prose(rendered));
    assert.doesNotMatch(prose(rendered), /forgav|apologi|new attempt|played again|next time|agreed to|forgiven/);
  }
  assert.match(texts.get('kept'), /both been there for its ending/);
  assert.match(texts.get('missed'), /never had/);
  assert.match(texts.get('cut_short'), /interrupted before/);
  const missing = source('another attempt', 'SUPPORTING_CALLBACK');
  assert.equal(supportingEditorial(missing, { story: { result: { outcome: 'kept' } } }), null);
  const absent = source('another attempt', 'SUPPORTING_CALLBACK', { outcome: 'kept' }); absent.payload.cast = [];
  assert.equal(supportingEditorial(absent), null);
});

test('callback sentences name each guest once while retaining the actual subject and ending', () => {
  const names = { yukon: 'Yukon', henderson: 'Henderson', davis: 'Davis', kartel: 'Hammond',
    kai: 'Kai', greah: 'Greah', rose: 'Rose', anarchy: 'Anarchy', balthazar: 'Balthazar',
    gabriel: 'Gabriel', truth: 'Truth', damien: 'Damien', emily: 'Emily', zara: 'Zara' };
  for (const [family, guest] of FAMILIES) for (const outcome of ['kept', 'missed', 'cut_short']) {
    for (let i = 0; i < 16; i++) {
      const rendered = supportingEditorial(source(family, 'SUPPORTING_CALLBACK', { outcome, id: `callback-polish:${i}` }));
      for (const text of Object.values(rendered)) {
        assert.equal((text.match(new RegExp(`\\b${names[guest]}\\b`, 'g')) ?? []).length, 1, `${family}: ${text}`);
      }
      assert.doesNotMatch(prose(rendered), /appointment|contract|stillness|time kept/i);
    }
  }
  const zara = supportingEditorial(source('an unhurried interval', 'SUPPORTING_CALLBACK', { lead: 'ashai', outcome: 'kept' }));
  assert.equal(zara.description, 'Ashai and Zara recalled their earlier pause.');
  for (const [family, subject] of [['another attempt', /game attempt/], ['a timing question', /timing question/],
    ['one short verse', /verse/], ['a shorter rhythm', /short rhythm/], ['an end to the argument', /argument about timing/]]) {
    const result = supportingEditorial(source(family, 'SUPPORTING_CALLBACK', { outcome: 'kept' }));
    assert.match(result.description, subject); assert.match(result.prose, subject);
  }
});

test('private, unknown and contradictory event shapes are not rewritten', () => {
  for (const visibility of ['private', 'internal', undefined]) {
    const event = source(); event.visibility = visibility;
    assert.equal(supportingEditorial(event), null);
  }
  for (const event of [null, {}, { ...source(), id: null }, { ...source(), type: 'CONVERSATION' },
    { ...source(), participants: null }, { ...source(), payload: null },
    source('another attempt', 'SUPPORTING_COMMITMENT', { outcome: 'kept' }),
    source('another attempt', 'SUPPORTING_ENCOUNTER', { outcome: 'cut_short' }),
    source('another attempt', 'SUPPORTING_OUTCOME'),
    source('another attempt', 'SUPPORTING_OUTCOME', { outcome: 'secret_success' }),
  ]) assert.equal(supportingEditorial(event), null);
  for (const family of ['__proto__', 'constructor', 'unknown-family', '<script>secret()</script>']) {
    const event = source(); event.payload.family = family;
    assert.equal(supportingEditorial(event), null);
  }
  const privateValues = source(); privateValues.payload.hiddenCause = 'CLASSIFIED_CAUSE';
  privateValues.payload.cast.push('PRIVATE_UNKNOWN_CHARACTER');
  assert.doesNotMatch(prose(supportingEditorial(privateValues)), /CLASSIFIED|PRIVATE_UNKNOWN/);
});
