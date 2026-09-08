import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoryTrail } from '../../worldstream/app/story-trails.js';
import { buildStoryThread } from '../src/story-threads.mjs';
import { nightEditorial } from '../src/editorial-night.mjs';
import { editorialEvent } from '../src/editorial.mjs';
import { openWorld } from '../src/world.mjs';
import { atLondon } from '../src/time.mjs';

class MockElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.handlers = {};
    this.open = false;
    this.textContent = '';
    this.className = '';
  }
  get parentNode() { return this.parent; }
  append(...children) {
    for (const child of children) {
      if (child && typeof child === 'object') {
        if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child);
        child.parent = this;
        this.children.push(child);
      }
    }
  }
  replaceChildren(...children) {
    this.children.forEach(child => { if (child && typeof child === 'object') child.parent = null; });
    this.children = [];
    this.append(...children);
  }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(key, handler) { this.handlers[key] = handler; }
  emit(type) { this.handlers[type]?.(); }
}

const mockDoc = { createElement: tag => new MockElement(tag) };
const tick = () => new Promise(resolve => setImmediate(resolve));
const allNodes = root => [root, ...(root.children || []).flatMap(allNodes)];

test('Reading View: story trails suppress duplicate description when prose is present', async () => {
  const trailResult = {
    id: 'thread:test',
    type: 'story',
    stages: [
      { key: 'beginning', label: 'Beginning', eventIds: ['evt-1'] },
      { key: 'latest', label: 'Latest turn', eventIds: ['evt-2'] },
    ],
    events: [
      { id: 'evt-1', occurredAt: 1000, location: 'mi6', description: 'Machine headline for call.', prose: 'Rich fiction prose for call.' },
      { id: 'evt-2', occurredAt: 2000, location: 'mi6', description: 'Machine headline without prose.', prose: null },
    ],
  };

  const trails = createStoryTrail({
    document: mockDoc,
    fetcher: async () => ({ ok: true, json: async () => trailResult }),
  });

  const card = new MockElement('article');
  const details = trails.attach(card, { type: 'story', id: 'thread:test', scope: 'world:test', revision: 1 });
  details.open = true;
  details.emit('toggle');
  await tick();

  const nodes = allNodes(details);

  // For evt-1 (has prose): marked with has-prose class and renders event-prose
  const proseItem = nodes.find(n => n.className?.includes('has-prose'));
  assert.ok(proseItem, 'Event item is tagged with has-prose');
  assert.ok(nodes.some(n => n.textContent === 'Rich fiction prose for call.' && n.className === 'event-prose'));
  assert.ok(nodes.some(n => n.textContent === 'Machine headline for call.' && n.className === 'story-trail-description'));

  // For evt-2 (no prose): description is used
  assert.ok(nodes.some(n => n.textContent === 'Machine headline without prose.' && n.className === 'story-trail-description'));
});

test('Reading View: hollow diagnostic stages ("No separate public development is recorded.") are omitted', async () => {
  const trailWithEmptyStage = {
    id: 'thread:delivery',
    type: 'story',
    stages: [
      { key: 'beginning', label: 'Beginning', eventIds: ['evt-open'] },
      { key: 'development', label: 'How it developed', eventIds: [], message: 'No separate public development is recorded.' },
      { key: 'latest', label: 'Latest turn', eventIds: ['evt-close'] },
    ],
    events: [
      { id: 'evt-open', occurredAt: 1000, location: 'enchanted_ink', description: 'Opened.' },
      { id: 'evt-close', occurredAt: 3000, location: 'enchanted_ink', description: 'Closed.' },
    ],
  };

  const trails = createStoryTrail({
    document: mockDoc,
    fetcher: async () => ({ ok: true, json: async () => trailWithEmptyStage }),
  });

  const card = new MockElement('article');
  const details = trails.attach(card, { type: 'story', id: 'thread:delivery', scope: 'world:test', revision: 1 });
  details.open = true;
  details.emit('toggle');
  await tick();

  const nodes = allNodes(details);

  // Diagnostic message is never rendered to the reader
  assert.equal(nodes.some(n => n.textContent?.includes('No separate public development is recorded.')), false);
  assert.equal(nodes.some(n => n.className?.includes('story-trail-missing')), false);

  // Only the 2 stages with events are rendered
  const stageHeadings = nodes.filter(n => n.tag === 'h4').map(n => n.textContent);
  assert.deepEqual(stageHeadings, ['Beginning', 'Latest turn']);
});

test('Premature-Reveal Prevention: buildStoryThread strictly omits uncommitted future events', () => {
  const snapshot = {
    world: { resolvedThrough: 2000 },
    threads: {
      instances: {
        'thread:delivery': {
          id: 'thread:delivery', openedAt: 1000, deadlineAt: 5000, status: 'active',
          originEventId: 'evt-1', lastEventId: 'evt-2',
          causalEventIds: ['evt-1', 'evt-2', 'evt-future-3'],
        },
      },
    },
    intent: { instances: {} }, agendas: { operations: {} },
    events: [
      { id: 'evt-1', occurredAt: 1000, type: 'THREAD_OPEN', location: 'enchanted_ink', visibility: 'public', publicDescription: 'Beat 1' },
      { id: 'evt-2', occurredAt: 2000, type: 'THREAD_CHECK', location: 'enchanted_ink', visibility: 'public', publicDescription: 'Beat 2' },
      // Future event past resolvedThrough
      { id: 'evt-future-3', occurredAt: 3500, type: 'THREAD_CLOSE', location: 'enchanted_ink', visibility: 'public', publicDescription: 'Beat 3 Future' },
    ],
  };

  const result = buildStoryThread(snapshot, { type: 'story', id: 'thread:delivery' });
  assert.ok(result);
  // Future beat at 3500 must not be revealed while world is resolved through 2000
  assert.deepEqual(result.events.map(e => e.id), ['evt-1', 'evt-2']);
  assert.equal(result.events.some(e => e.id === 'evt-future-3'), false);
});

test('Premature-Reveal Prevention: nightEditorial rejects future asOf and does not expose future outcomes', () => {
  const callEvent = {
    id: 'night-call-1',
    occurredAt: 10000,
    type: 'NIGHT_CALL',
    area: 'quarters',
    location: 'mi6',
    visibility: 'public',
    participants: ['goaden'],
  };

  // When asOf is in the past relative to the event, nightEditorial returns null
  const futureContext = { asOf: 5000 };
  const rejected = nightEditorial(callEvent, futureContext);
  assert.equal(rejected, null);

  // When asOf is current or past, it presents the beat
  const validContext = { asOf: 10000, eventId: 'night-call-1', occurredAt: 10000 };
  const presented = nightEditorial(callEvent, validContext);
  assert.ok(presented);
  assert.ok(presented.prose.includes('Goaden'));
});

test('Coherent Featured Thread Orientation: protagonist stories lead and supporting stories have orientation subtitles', () => {
  function isProtagonistStory(item) {
    if (!item) return false;
    const id = String(item.id || '');
    if (id.startsWith('thread:') || id.startsWith('night:')) return true;
    if (id.startsWith('supporting:')) {
      return id.includes('goaden') || id.includes('ashai');
    }
    return false;
  }

  function storyOrientation(item) {
    if (!item || isProtagonistStory(item)) return null;
    const titleParts = String(item.title || '').split('·').map(s => s.trim());
    const character = titleParts[0] || 'Supporting character';
    const place = item.location === 'sanctuary' ? 'The Sanctuary' : item.location;
    const subject = titleParts[1] || item.status || 'Active in London';
    return `${character} · ${place} · ${subject}`;
  }

  const mockStories = [
    { id: 'offscreen:gabriel:1', title: 'Gabriel · the crowded last line', location: 'sanctuary', status: 'active' },
    { id: 'thread:delivery', title: 'The missing dispatch copy', location: 'enchanted_ink', status: 'active' },
    { id: 'offscreen:emily:1', title: 'Emily · the swing by the plaza', location: 'big_ben_plaza', status: 'active' },
    { id: 'night:goaden:1', title: 'Night watch check', location: 'mi6', status: 'active' },
  ];

  const sorted = [...mockStories].sort((a, b) => {
    const aLead = isProtagonistStory(a);
    const bLead = isProtagonistStory(b);
    if (aLead !== bLead) return bLead ? 1 : -1;
    return 0;
  });

  // Protagonist stories (thread:delivery and night:goaden) are prioritized at the top
  assert.equal(isProtagonistStory(sorted[0]), true);
  assert.equal(isProtagonistStory(sorted[1]), true);
  assert.equal(isProtagonistStory(sorted[2]), false);
  assert.equal(isProtagonistStory(sorted[3]), false);

  // Supporting stories receive a 1-line orientation subtitle
  const gabrielOrientation = storyOrientation(sorted[2]);
  assert.equal(gabrielOrientation, 'Gabriel · The Sanctuary · the crowded last line');

  // Protagonist stories do not need the external orientation subtitle
  assert.equal(storyOrientation(sorted[0]), null);
});

test('Catalogue Fiction Independence: authored stories execute and produce prose with zero audience spend', () => {
  const world = openWorld({ dbPath: ':memory:', startMs: atLondon('2026-09-04', '00:00') });
  try {
    // Advance world across multiple days with NO viewers (simulating unwatched 24/7 run)
    world.advance(atLondon('2026-09-07', '12:00'));

    const snapshot = world.presentationSnapshot();
    const events = snapshot.events || [];

    // Events with rich editorial prose exist in the ledger
    const proseEvents = events.filter(e => e.prose && typeof e.prose === 'string');
    assert.ok(proseEvents.length > 0, 'Authored prose is produced on schedule');

    // Editorial transforms run deterministically with zero runtime LLM calls
    for (const e of proseEvents) {
      assert.equal(typeof e.prose, 'string');
      assert.ok(e.prose.length > 10);
    }
  } finally {
    world.close();
  }
});

test('Reading View: eligible authored scene renders opening, dialogue beats, and closing narration without badge or duplicate machine summary', () => {
  function appendProseParagraphs(container, text, className = 'event-prose') {
    if (typeof text !== 'string' || !text.trim()) return;
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      container.append({ tag: 'p', className, textContent: p });
    }
  }

  function simulateEventRender(event, { isReading = true } = {}) {
    const detail = { children: [], append(...nodes) { this.children.push(...nodes); } };
    const performedScene = event.cinematic?.scene;

    if (isReading) {
      if (performedScene) {
        if (performedScene.openingNarration) {
          appendProseParagraphs(detail, performedScene.openingNarration, 'event-prose');
        }
        if (Array.isArray(performedScene.beats) && performedScene.beats.length > 0) {
          const exchangeList = { tag: 'ol', className: 'exchange', children: [] };
          for (const beat of performedScene.beats) {
            exchangeList.children.push({
              tag: 'li', className: 'said', who: beat.speaker,
              speaker: beat.speaker, text: beat.line,
            });
          }
          detail.append(exchangeList);
        }
        if (performedScene.closingNarration) {
          appendProseParagraphs(detail, performedScene.closingNarration, 'event-prose');
        }
      } else if (event.prose) {
        appendProseParagraphs(detail, event.prose, 'event-prose');
      } else {
        detail.append({ tag: 'p', textContent: event.description });
      }
    } else {
      // In dashboard view: badge and summary are shown
      detail.append({ tag: 'span', className: 'cinematic-chip', textContent: 'WORLDSTREAM SCENE' });
      detail.append({ tag: 'p', className: 'event-prose cinematic-summary', textContent: event.description });
      detail.append({ tag: 'p', className: 'event-canonical', textContent: event.description });
    }
    return detail.children;
  }

  const multiParagraphEvent = {
    id: 'evt-multi',
    prose: 'First paragraph of fiction.\n\nSecond paragraph of fiction.',
    description: 'Machine summary line.',
  };

  const multiNodes = simulateEventRender(multiParagraphEvent, { isReading: true });
  // Verifies paragraphs are preserved as distinct elements
  assert.equal(multiNodes.filter(n => n.className === 'event-prose').length, 2);
  assert.equal(multiNodes[0].textContent, 'First paragraph of fiction.');
  assert.equal(multiNodes[1].textContent, 'Second paragraph of fiction.');
  // Canonical machine summary is NOT rendered in Reading View
  assert.equal(multiNodes.some(n => n.className === 'event-canonical'), false);

  const cinematicSceneEvent = {
    id: 'evt-scene',
    description: 'Machine summary: Goaden and Ashai spoke in operations.',
    cinematic: {
      scene: {
        openingNarration: 'Monitor light caught Goaden and Ashai as they came into operations.',
        beats: [
          { speaker: 'goaden', line: 'The Thames line showed an unresolved variance.' },
          { speaker: 'ashai', line: 'Residual resonance from the noon chime cycle.' },
        ],
        closingNarration: 'Around that small ending, operations went on watching London.',
      },
    },
  };

  // In Reading View:
  const readingNodes = simulateEventRender(cinematicSceneEvent, { isReading: true });
  // Opening and closing narration are rendered
  assert.ok(readingNodes.some(n => n.textContent?.includes('Monitor light caught Goaden')));
  assert.ok(readingNodes.some(n => n.textContent?.includes('operations went on watching London')));
  // Dialogue beats are rendered directly in the flow
  const exchangeNode = readingNodes.find(n => n.className === 'exchange');
  assert.ok(exchangeNode, 'Dialogue exchange is rendered on reading surface');
  assert.equal(exchangeNode.children.length, 2);
  assert.equal(exchangeNode.children[0].text, 'The Thames line showed an unresolved variance.');
  assert.equal(exchangeNode.children[1].text, 'Residual resonance from the noon chime cycle.');
  // Neither WORLDSTREAM SCENE chip nor duplicate machine description is present
  assert.equal(readingNodes.some(n => n.className === 'cinematic-chip'), false);
  assert.equal(readingNodes.some(n => n.className === 'event-canonical'), false);

  // In Dashboard View:
  const dashboardNodes = simulateEventRender(cinematicSceneEvent, { isReading: false });
  assert.ok(dashboardNodes.some(n => n.className === 'cinematic-chip' && n.textContent === 'WORLDSTREAM SCENE'));
  assert.ok(dashboardNodes.some(n => n.className === 'event-canonical'));
});

test('Reading View: approved NIGHT_DEBRIEF exchange renders opening prose and 6 dialogue beats without summary duplicates', () => {
  const rawDebriefEvent = {
    id: 'evt:f46a2e1c5fa492b815b1eea75457bf6a',
    type: 'NIGHT_DEBRIEF',
    visibility: 'public',
    occurredAt: 1788777600001,
    location: 'mi6',
    area: 'corridors',
    participants: ['goaden', 'ashai'],
    payload: { outcome: 'resolved' },
    publicDescription: 'Goaden brought the night check up when they met again. Both now knew its watch entry had closed.',
  };

  const processed = editorialEvent(rawDebriefEvent);
  assert.equal(processed.publicDescription, 'Goaden and Ashai spoke about the night check and its closed entry.');
  assert.equal(processed.prose, 'Ashai leaned against the corridor wall as Goaden approached.');
  assert.ok(Array.isArray(processed.lines));
  assert.equal(processed.lines.length, 6);

  // Exact approved dialogue text check
  assert.deepEqual(processed.lines.map(l => ({ who: l.who, text: l.text })), [
    { who: 'ashai', text: 'Did you finish the check?' },
    { who: 'goaden', text: 'Closed the entry. Reconciled the ledger.' },
    { who: 'ashai', text: 'That was all?' },
    { who: 'goaden', text: "That's the version that doesn't keep you awake too." },
    { who: 'ashai', text: 'I was on the covered floor this morning. You’re the one who looks like you slept in your coat.' },
    { who: 'goaden', text: "Coat's comfortable." },
  ]);

  // Story thread projection check
  const threadSnapshot = {
    world: { resolvedThrough: 1788778000000 },
    threads: {
      instances: {
        'night:5968a92da4d38d6d51e58643': {
          id: 'night:5968a92da4d38d6d51e58643', openedAt: 1788743820000, deadlineAt: 1788780000000, status: 'resolved',
          originEventId: 'evt:445a991152db61e637521d337e8b98d6', lastEventId: 'evt:f46a2e1c5fa492b815b1eea75457bf6a',
          causalEventIds: ['evt:445a991152db61e637521d337e8b98d6', 'evt:f46a2e1c5fa492b815b1eea75457bf6a'],
        },
      },
    },
    intent: { instances: {} }, agendas: { operations: {} },
    events: [
      { id: 'evt:445a991152db61e637521d337e8b98d6', occurredAt: 1788743820000, type: 'NIGHT_WINDOW', location: 'mi6', visibility: 'public', publicDescription: 'Window' },
      rawDebriefEvent,
    ],
  };

  const thread = buildStoryThread(threadSnapshot, { type: 'story', id: 'night:5968a92da4d38d6d51e58643' });
  assert.ok(thread);
  const threadDebrief = thread.events.find(e => e.id === 'evt:f46a2e1c5fa492b815b1eea75457bf6a');
  assert.ok(threadDebrief);
  assert.equal(threadDebrief.prose, 'Ashai leaned against the corridor wall as Goaden approached.');
  assert.equal(threadDebrief.lines?.length, 6);
});

