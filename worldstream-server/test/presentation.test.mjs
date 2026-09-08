import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalBrief, briefKey, validateVignette, properNouns, renderVignette, userPrompt,
  SYSTEM_PROMPT, ALLOWED_NOUNS, MAX_CHARS, MAX_LINES, presentationEnabled,
  openAIClient, VIGNETTE_SCHEMA } from '../src/presentation.mjs';
import { renderDay, toMarkdown, memoryCache } from '../src/render-vignettes.mjs';
import { atLondon } from '../src/time.mjs';
import { FORBIDDEN_TERMS } from '../src/spoilers.mjs';

const EVENT = Object.freeze({
  id: 'evt:test', occurredAt: atLondon('2026-09-08', '14:20'), location: 'mi6',
  // The room travels on the event, because it is where this happened rather
  // than where anybody is standing when it is read back.
  room: 'the lunch hall',
  participants: ['goaden', 'ashai'],
  description: 'Goaden and Ashai crossed paths in the lunch hall.',
});
const PROJECTION = Object.freeze({
  resolvedThrough: atLondon('2026-09-08', '15:00'),
  weather: { code: 'light_rain', description: 'Light rain', temperatureC: 12 },
  time: { daypart: 'midday' },
  factions: { mi6: 'routine', arcane: 'low' },
  characters: [
    { id: 'goaden', name: 'Goaden Reeves', room: 'the lunch hall' },
    { id: 'ashai', name: 'Ashai Bennet', room: 'the lunch hall' },
  ],
  events: [EVENT],
});
const brief = () => canonicalBrief(EVENT, PROJECTION);
const stub = prose => async () => ({ prose, namedEntities: ['Goaden', 'Ashai'] });

test('a brief carries the public fact and nothing private', () => {
  const item = brief();
  assert.equal(item.fact, EVENT.description);
  assert.equal(item.room, 'the lunch hall');
  // Both room and daypart come from the event, never from the projection it was
  // read out of. Reading them from the snapshot put a whole day's events in
  // whichever room the pair ended it in, at whatever daypart somebody looked.
  assert.equal(item.daypart, 'midday', 'the daypart belongs to the event, not to the reader');
  const late = canonicalBrief({ ...EVENT, occurredAt: atLondon('2026-09-08', '08:30'), room: 'the quarters' }, PROJECTION);
  assert.equal(late.daypart, 'morning');
  assert.equal(late.room, 'the quarters');
  assert.equal(late.londonTime, '08:30');
  assert.deepEqual(item.participants, ['goaden', 'ashai']);
  // Everything a model is ever shown, scanned for the shapes private state has.
  const text = JSON.stringify(item);
  for (const forbidden of ['knowledge', 'sourceEventId', 'acquisitionEventId', 'concern', 'irritation',
    'trust', 'arrangement', 'invitation', 'plans', 'facts', 'director', 'tension', 'PRIVATE']) {
    assert.ok(!text.includes(forbidden), `a brief leaked ${forbidden}`);
  }
  // The prompt built from it leaks nothing either.
  const prompt = userPrompt(item);
  for (const forbidden of ['concern', 'trust', 'irritation', 'because', 'secret']) {
    assert.ok(!prompt.toLowerCase().includes(forbidden), `the prompt leaked ${forbidden}`);
  }
  assert.ok(prompt.includes(EVENT.description));
  // The instruction's job is refusals, and it says the two that matter.
  assert.ok(/never decide what happened/i.test(SYSTEM_PROMPT));
  assert.ok(/invent no colleagues/i.test(SYSTEM_PROMPT));
  assert.equal(VIGNETTE_SCHEMA.additionalProperties, false);
});

test('a brief states the wall clock as a time somebody can read', () => {
  // londonClock returns {hour, minute}; a heading needs "14:20", and the first
  // cut of this put "[object Object]" above every vignette of the day.
  assert.equal(brief().londonTime, '14:20');
  assert.match(brief().londonTime, /^\d{2}:\d{2}$/);
  assert.equal(brief().londonDate, '2026-09-08');
});

test('a rendering key changes when the fact or the rules behind it change', () => {
  const first = briefKey(brief());
  assert.equal(first, briefKey(brief()));
  assert.notEqual(first, briefKey({ ...brief(), fact: 'Something else happened.' }));
  assert.notEqual(first, briefKey({ ...brief(), eventId: 'evt:other' }));
});

test('proper nouns are found without mistaking a capital letter for a name', () => {
  // Sentence-initial words are capitalised because they are first.
  assert.deepEqual(properNouns('The rain came in. Goaden waited.'), []);
  assert.deepEqual(properNouns('Ashai stood by the window.'), []);
  // A known multi-word name is matched whole, not as three mystery words.
  assert.deepEqual(properNouns('They walked to New Big Ben with Agent Davis.'), []);
  assert.deepEqual(properNouns('Goaden and Ashai left MI6 for the Silver Spoon Cafe.'), []);
  // A possessive is the same name wearing an apostrophe, straight or curly.
  assert.deepEqual(properNouns('Goaden watched the Church’s preparations with Ashai.'), []);
  assert.deepEqual(properNouns("Ashai admired MI6's corridors."), []);
  // A name whose first word also opens the sentence is still that name.
  assert.deepEqual(properNouns('Agent Davis said something and laughed at it.'), []);
  assert.deepEqual(properNouns('Captain Hammond kept the corner table. Davis did not stop.'), []);
  assert.deepEqual(properNouns('New Big Ben rang through the hour.'), []);
  // Anybody the world does not have is reported, possessive or not.
  assert.deepEqual(properNouns('Goaden spoke to Commander Vex.'), ['Commander', 'Vex']);
  assert.ok(properNouns('Ashai read Vex’s report.').includes('Vex'));
  assert.ok(properNouns('Ashai met Sergeant Blake in the hall.').includes('Blake'));
});

test('a vignette is refused for every way it can go wrong', () => {
  const item = brief();
  const good = 'Goaden found the last dry chair. Ashai took the one opposite without being asked.';
  assert.deepEqual(validateVignette(good, item), { ok: true, reason: null });

  const cases = [
    ['', 'empty'],
    ['   ', 'empty'],
    [`Goaden and Ashai. ${'x'.repeat(MAX_CHARS)}`, 'too_long'],
    [Array.from({ length: MAX_LINES + 1 }, () => 'Goaden and Ashai waited.').join('\n'), 'too_many_lines'],
    ['Goaden and Ashai went down to the basement.', 'embargoed:basement'],
    ['Goaden told Ashai about the Grimoire.', 'embargoed:grimoire'],
    ['Goaden and Ashai read it at https://example.com', 'markup'],
    ['**Goaden** and Ashai waited.', 'markup'],
    ['Goaden and Ashai waited for Commander Vex.', 'invented_name:Commander,Vex'],
    ['Nobody came by at all.', 'missing_participant:goaden+ashai'],
  ];
  for (const [prose, reason] of cases) {
    const verdict = validateVignette(prose, item);
    assert.equal(verdict.ok, false, `accepted: ${prose.slice(0, 40)}`);
    assert.equal(verdict.reason, reason, prose.slice(0, 40));
  }
  // The embargo is the shared registry now, so the check is that the validator
  // actually consults it rather than that it holds its own copy.
  for (const { term } of FORBIDDEN_TERMS) {
    const prose = `Goaden and Ashai discussed the ${term.toUpperCase()} at length.`;
    assert.equal(validateVignette(prose, item).ok, false, term);
  }
  // And the implication tier reaches the validator too, which the old flat
  // list could never have caught.
  assert.equal(validateVignette('Goaden and Ashai spoke about his brother, presumed dead.', item).ok, false);
  // One of the two is enough. Requiring both forced the pair into events whose
  // subject was somebody else, and the model met that by handing them the
  // colleague's action.
  assert.ok(validateVignette('Ashai waited, and the room stayed quiet.', item).ok);
  assert.ok(validateVignette('Goaden waited, and the room stayed quiet.', item).ok);
  // Naming a colleague the world actually has is allowed.
  assert.ok(validateVignette('Goaden and Ashai passed Agent Davis in the corridor.', item).ok);
  assert.ok(ALLOWED_NOUNS.includes('Agent Davis'));
});

test('every failure lands on the canonical sentence, unchanged', async () => {
  const item = brief();
  // No client at all: presentation is off, and off is the normal state.
  assert.deepEqual(await renderVignette(item, {}),
    { prose: item.fact, source: 'canonical', reason: 'disabled' });
  // A client that throws, one that returns nothing, one that returns rubbish.
  const failures = [
    [async () => { throw new Error('network down'); }, 'error:network down'],
    [async () => ({}), 'empty'],
    [stub('Goaden and Ashai met Commander Vex.'), 'invented_name:Commander,Vex'],
    [stub('Goaden and Ashai went to the basement.'), 'embargoed:basement'],
  ];
  for (const [client, reason] of failures) {
    const result = await renderVignette(item, { client });
    assert.equal(result.prose, item.fact, reason);
    assert.equal(result.source, 'canonical');
    assert.equal(result.reason, reason);
  }
  // A model that writes acceptable prose but declares a name it should not have
  // is refused on the declaration alone.
  // Declaring an allowed name in another case is not a violation.
  const cased = await renderVignette(item, { client: async () => ({
    prose: 'Goaden and Ashai waited.', namedEntities: ['goaden', 'mi6', 'ASHAI'] }) });
  assert.equal(cased.source, 'model', cased.reason);
  const declaring = async () => ({ prose: 'Goaden and Ashai waited.', namedEntities: ['Goaden', 'Vex'] });
  const declared = await renderVignette(item, { client: declaring });
  assert.equal(declared.source, 'canonical');
  assert.ok(declared.reason.startsWith('declared:'));

  // And a good rendering is passed through with its key.
  const good = 'Goaden found the last dry chair. Ashai took the one opposite without being asked.';
  const ok = await renderVignette(item, { client: stub(good) });
  assert.deepEqual({ prose: ok.prose, source: ok.source, reason: ok.reason },
    { prose: good, source: 'model', reason: null });
  assert.equal(ok.key, briefKey(item));
});

test('a refusal is reported rather than swallowed', async () => {
  const rejects = [];
  await renderVignette(brief(), { client: stub('Goaden and Ashai met Commander Vex.'),
    onReject: item => rejects.push(item) });
  assert.equal(rejects.length, 1);
  assert.ok(rejects[0].reason.startsWith('invented_name'));
  assert.ok(rejects[0].prose.includes('Vex'), 'the refused text is kept for inspection');
});

test('presentation stays off unless it is switched on and given a key', () => {
  assert.equal(presentationEnabled({}), false);
  assert.equal(presentationEnabled({ OPENAI_API_KEY: 'sk-test' }), false, 'a stray key must not enable it');
  assert.equal(presentationEnabled({ SILVER_CLOUDS_PRESENTATION: 'on' }), false);
  assert.equal(presentationEnabled({ SILVER_CLOUDS_PRESENTATION: 'on', OPENAI_API_KEY: 'sk-test' }), true);
  assert.throws(() => openAIClient({}), TypeError);
});

test('the transport sends the documented request and asks for nothing back but prose', async () => {
  let sent = null;
  const fetchImpl = async (url, options) => {
    sent = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ output: [{ type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify({ prose: 'Goaden waited. Ashai did not.', namedEntities: [] }) }] }] }) };
  };
  const client = openAIClient({ apiKey: 'sk-test', model: 'test-model', fetchImpl });
  const result = await client({ system: SYSTEM_PROMPT, user: 'hello' });
  assert.deepEqual(result, { prose: 'Goaden waited. Ashai did not.', namedEntities: [] });
  assert.equal(sent.url, 'https://api.openai.com/v1/responses');
  assert.equal(sent.options.headers.authorization, 'Bearer sk-test');
  assert.equal(sent.body.model, 'test-model');
  assert.equal(sent.body.text.format.type, 'json_schema');
  assert.equal(sent.body.text.format.strict, true);
  assert.deepEqual(sent.body.text.format.schema, VIGNETTE_SCHEMA);
  assert.deepEqual(sent.body.input.map(item => item.role), ['system', 'user']);
  // A failed request raises rather than returning something that reads like prose.
  const failing = openAIClient({ apiKey: 'sk-test', fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(() => failing({ system: '', user: '' }), /503/);
});

test('a rendered day never loses a canonical fact, whatever the model did', async () => {
  const prose = 'Goaden found the last dry chair. Ashai took the one opposite.';
  const cache = memoryCache();
  const rendered = await renderDay({ projection: PROJECTION, day: '2026-09-08', cache, client: stub(prose) });
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].prose, prose);
  assert.equal(rendered[0].fact, EVENT.description, 'the canonical sentence is kept beside the prose');
  assert.equal(rendered[0].eventId, EVENT.id);
  assert.equal(rendered[0].cached, false);

  // A rendered day is rendered once. Reading it again returns what was written
  // the first time, so a day somebody has already read cannot rewrite itself.
  const again = await renderDay({ projection: PROJECTION, day: '2026-09-08', cache,
    client: stub('Something completely different happened. Goaden and Ashai left.') });
  assert.equal(again[0].prose, prose, 'a cached day was re-rendered');
  assert.equal(again[0].cached, true);

  // With no client and a cold cache the day still renders — as itself.
  const plain = await renderDay({ projection: PROJECTION, day: '2026-09-08', cache: memoryCache() });
  assert.equal(plain[0].prose, EVENT.description);
  assert.equal(plain[0].source, 'canonical');
  const markdown = toMarkdown('2026-09-08', plain);
  assert.ok(markdown.includes(EVENT.description));
  assert.ok(markdown.includes('canonical'));

  // A fallback is never cached: a transient network failure must not freeze
  // into the record as though it were the rendering.
  const cold = memoryCache();
  await renderDay({ projection: PROJECTION, day: '2026-09-08', cache: cold,
    client: async () => { throw new Error('network down'); } });
  const recovered = await renderDay({ projection: PROJECTION, day: '2026-09-08', cache: cold, client: stub(prose) });
  assert.equal(recovered[0].prose, prose, 'a failed render was cached');

  // A day with nothing in it produces nothing rather than inventing a day.
  assert.deepEqual(await renderDay({ projection: PROJECTION, day: '2026-09-09', cache: memoryCache() }), []);
});
