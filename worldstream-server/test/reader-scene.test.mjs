import test from 'node:test';
import assert from 'node:assert/strict';
import { readingSceneParagraphs, appendReadingScene } from '../../worldstream/app/reader-scene.js';

const names = who => ({ goaden: 'Goaden', ashai: 'Ashai', yukon: 'Yukon' })[who];
const line = (who, text) => ({ who, text });

test('accepted opening, dialogue and closing are the sole reading performance', () => {
  const event = { prose: 'Raw opening.', description: 'Raw summary.', lines: [line('goaden', 'Raw dialogue.')] };
  const scene = { openingNarration: 'First paragraph.\n\nSecond paragraph.',
    beats: [{ speaker: 'ashai', line: 'The accepted words?' }, { speaker: 'goaden', line: 'Exactly.' }],
    closingNarration: 'Accepted ending.' };
  const before = JSON.stringify({ event, scene });
  assert.deepEqual(readingSceneParagraphs(event, scene, names), [
    { text: 'First paragraph.', kind: 'prose' }, { text: 'Second paragraph.', kind: 'prose' },
    { text: '“The accepted words?” asked Ashai.', kind: 'dialogue', who: 'ashai' },
    { text: '“Exactly,” said Goaden.', kind: 'dialogue', who: 'goaden' },
    { text: 'Accepted ending.', kind: 'prose' },
  ]);
  assert.equal(JSON.stringify({ event, scene }), before);
});

test('raw dialogue survives missing prose and register without a summary wrapper', () => {
  const result = readingSceneParagraphs({ description: 'They exchanged some words.',
    lines: [line('goaden', 'Oi.'), line('ashai', 'What?')] }, null, names);
  assert.deepEqual(result.map(item => item.text), ['“Oi,” said Goaden.', '“What?” asked Ashai.']);
  assert.ok(result.every(item => item.kind === 'dialogue'));
});

test('reader selection uses its own prose and short description while respecting an empty prose override', () => {
  assert.deepEqual(readingSceneParagraphs({ prose: 'Old.', readerProse: 'Edited.\n\nNext.', description: 'Summary.' })
    .map(item => item.text), ['Edited.', 'Next.']);
  assert.deepEqual(readingSceneParagraphs({ prose: 'Long.', readerWeight: 1, readerDescription: 'Brief.' })
    .map(item => item.text), ['Brief.']);
  assert.deepEqual(readingSceneParagraphs({ prose: 'Suppressed.', readerProse: '', description: 'The recorded fact.' })
    .map(item => item.text), ['The recorded fact.']);
  assert.deepEqual(readingSceneParagraphs({ publicDescription: 'Fallback fact.' }, {})
    .map(item => item.text), ['Fallback fact.']);
});

test('an alternating pair gets clear initial and periodic attribution without script labels', () => {
  const lines = ['First.', 'Second.', 'Third.', 'Fourth.', 'Fifth.', 'Sixth.', 'Seventh.']
    .map((text, index) => line(index % 2 ? 'ashai' : 'goaden', text));
  const texts = readingSceneParagraphs({ lines }, null, names).map(item => item.text);
  assert.deepEqual(texts, ['“First,” said Goaden.', '“Second,” said Ashai.', '“Third.”', '“Fourth.”',
    '“Fifth,” said Goaden.', '“Sixth.”', '“Seventh.”']);
  assert.ok(!texts.join(' ').includes('GOADEN'));
  const repeated = readingSceneParagraphs({ lines: [...lines.slice(0, 2), line('ashai', 'Still me.')] }, null, names);
  assert.equal(repeated[2].text, '“Still me,” said Ashai.');
});

test('three speakers retain explicit identity throughout the exchange', () => {
  const result = readingSceneParagraphs({ lines: [line('goaden', 'One.'), line('ashai', 'Two.'),
    line('yukon', 'Three.'), line('goaden', 'Four.'), line('ashai', 'Five.')] }, null, names);
  assert.deepEqual(result.map(item => item.text), ['“One,” said Goaden.', '“Two,” said Ashai.',
    '“Three,” said Yukon.', '“Four,” said Goaden.', '“Five,” said Ashai.']);
});

test('nonverbal lintel actions remain exact narration and renew the surrounding voices', () => {
  const action = 'It drifts eight inches west, which puts the rain over the woman.';
  const result = readingSceneParagraphs({ lines: [line('goaden', 'One.'), line('ashai', 'Two.'),
    line('goaden', 'Three.'), line('lintel', action), line('ashai', 'Four.'), line('goaden', 'Five.'),
    line('ashai', 'Six.')] }, null, names);
  assert.deepEqual(result.map(item => item.text), ['“One,” said Goaden.', '“Two,” said Ashai.', '“Three.”',
    action, '“Four,” said Ashai.', '“Five,” said Goaden.', '“Six.”']);
  assert.deepEqual(result[3], { text: action, kind: 'prose', who: 'lintel' });
  assert.equal(result.filter(item => item.kind === 'dialogue').length, 6);
});

test('accepted lintel beats preserve their nonverbal provenance too', () => {
  const action = 'It settles above the second shelf and lets a curl of itself come apart and reassemble.';
  const scene = { openingNarration: 'Inside the shop.', beats: [{ speaker: 'lintel', line: action },
    { speaker: 'ashai', line: 'There it is.' }, { speaker: 'goaden', line: 'Yeah.' }], closingNarration: 'They watched.' };
  const result = readingSceneParagraphs({ prose: 'Unused raw text.' }, scene, names);
  assert.deepEqual(result.map(item => item.text), ['Inside the shop.', action,
    '“There it is,” said Ashai.', '“Yeah,” said Goaden.', 'They watched.']);
  assert.equal(result[1].kind, 'prose');
  assert.ok(!result.some(item => /said.*lintel/i.test(item.text)));
});

test('profanity, contractions and dialogue wording remain intact', () => {
  const result = readingSceneParagraphs({ lines: [line('goaden', "Fuckin’ hell!"),
    line('ashai', "What the fuck?"), line('goaden', "I'm not censoring shit."),
    line('ashai', 'Neither am I, you bastard.')] }, null, names);
  assert.deepEqual(result.map(item => item.text), ['“Fuckin’ hell!” said Goaden.',
    '“What the fuck?” asked Ashai.', '“I\'m not censoring shit.”', '“Neither am I, you bastard.”']);
});

test('attribution adapts punctuation without replacing a line or its internal quotation', () => {
  for (const [input, expected] of [
    ['Finished.', '“Finished,” said Goaden.'], ['Finished', '“Finished,” said Goaden.'],
    ['Really?', '“Really?” asked Goaden.'], ['Oi!', '“Oi!” said Goaden.'],
    ['I...', '“I...” said Goaden.'], ['I…', '“I…” said Goaden.'],
    ["That isn't —", "“That isn't —” said Goaden."],
    ['“Already quoted.”', '“Already quoted,” said Goaden.'],
    ['He said “no”.', '“He said “no”,” said Goaden.'],
  ]) assert.equal(readingSceneParagraphs({ lines: [line('goaden', input)] }, null, names)[0].text, expected);
});

test('a partial accepted scene never imports raw dialogue and an empty accepted scene falls back', () => {
  const event = { prose: 'Raw paragraph.', lines: [line('ashai', 'Raw line.')] };
  assert.deepEqual(readingSceneParagraphs(event, { closingNarration: 'Only accepted ending.' })
    .map(item => item.text), ['Only accepted ending.']);
  assert.deepEqual(readingSceneParagraphs(event, { beats: [] }, names).map(item => item.text),
    ['Raw paragraph.', '“Raw line,” said Ashai.']);
  assert.equal(readingSceneParagraphs({ readerWeight: 0, lines: [line('ashai', 'Still spoken.')] }).length, 1);
});

test('DOM paragraphs use textContent, preserve provenance and contain no uppercase speaker labels', () => {
  const appended = [];
  const doc = { createElement(tag) { return { tagName: tag, dataset: {},
    set innerHTML(_) { throw new Error('Reading text must never be interpreted as HTML'); } }; } };
  const container = { ownerDocument: doc, append(node) { appended.push(node); } };
  const nodes = appendReadingScene(container, { prose: '<img onerror="bad()">',
    lines: [line('goaden', 'Fuck <script>this</script>.')] }, { className: 'passage-prose', speakerLabel: names });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].textContent, '<img onerror="bad()">');
  assert.equal(nodes[1].textContent, '“Fuck <script>this</script>,” said Goaden.');
  assert.equal(nodes[1].className, 'passage-prose reader-dialogue');
  assert.equal(nodes[1].dataset.who, 'goaden');
  assert.ok(nodes.every(node => node.tagName === 'p'));
  assert.deepEqual(nodes, appended);
  assert.deepEqual(appendReadingScene(null, {}), []);
});
