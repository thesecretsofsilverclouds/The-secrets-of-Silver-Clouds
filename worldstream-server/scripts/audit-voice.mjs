// Measure the authored banks against the Manuscript Studio's character cards.
//
// The studio's cards are the spec: each one lists a register and an explicit
// "avoid" list drawn from the manuscript. This checks the two things a card can
// actually be measured against — the vocabulary a character is evidenced to
// use, and the trap the card warns about — and reports rates rather than
// verdicts. The studio is clear that there is no correct swearing rate, so the
// counts below are descriptive.
import { VENUE_SCENES, INK_BOOKING_SCENE } from '../src/venues.mjs';
import { LEGION_EXCHANGES } from '../src/legion.mjs';
import { EXCHANGES } from '../src/dialogue.mjs';
import { ARCS } from '../src/arcs.mjs';

const SWEAR = /\b(fuck\w*|shit|bollocks|bastard|bloody|arse\w*|prick|piss\w*|twat|sod\w*|damn)\b/i;
const STIFF = /\b(do not|does not|did not|is not|are not|was not|were not|have not|has not|had not|will not|would not|could not|cannot|I am|it is|that is|you are|we are|they are|he is|she is)\b/;

// Vocabulary each card actually evidences, and the trap it names.
const CARDS = {
  goaden: { marks: /\b(ain'?t|gunna|gonna|reckon|mate|bruv|bro|yeah|nah|oi)\b/i,
    trap: null, note: 'card: ain\'t, gunna, reckon, mate — dialect selective, not every sound spelled' },
  ashai: { marks: /\b(fuck\w*|shit|bloody|sod\w*)\b/i,
    trap: null, note: 'card: not uniformly decorous; profanity and crude jokes when angry or comfortable' },
  truth: { marks: /\b(babe|brother|bruv|reever|cretins?)\b/i, trap: null, note: 'card: brother/babe have relational uses' },
  zara: { marks: /\b(ain'?t|walkin'|look|right|fine)\b/i,
    trap: /\b(I am|I have|do not|cannot|shall|indeed|marvellous)\b/, note: 'card: colloquial and unsentimental, less ceremonious than whoever introduces her' },
  balthazar: { marks: /\b(fuck\w*|shit|bloody|human|boy)\b/i,
    trap: /\b(thou|thee|hath|unmade|mortal|beneath me)\b/i, note: 'card: contemporary, profane when inconvenienced; no faux-biblical diction' },
  rose: { marks: /\b(dip|sick|nice|look|lovely)\b/i,
    trap: /\b(you\W?ll be|you\W?re not|don'?t|stop|shouldn'?t|always the)\b/i, note: 'card avoid: the group\'s permanently disapproving mother' },
  gabriel: { marks: /\b(fuck\w*|shit|bloody|literally)\b/i, trap: null, note: 'card: spluttering and wounded, not generic dry banter' },
  anarchy: { marks: /\b(mate|man|bro|yeah|whoops|wait)\b/i, trap: null, note: 'card: relaxed slang, ordinary swearing, not Balthazar\'s voice' },
};

const lines = [];
const push = (who, text, source) => lines.push({ who, text, source });
for (const [venue, bank] of Object.entries(VENUE_SCENES))
  for (const scene of bank) for (const line of scene.lines) push(line.who, line.text, `venue/${venue}`);
for (const line of INK_BOOKING_SCENE.lines) push(line.who, line.text, 'venue/ink');
for (const [mood, bank] of Object.entries(LEGION_EXCHANGES))
  for (const exchange of bank) for (const line of exchange) push(line.who, line.text, `legion/${mood}`);
for (const [mood, bank] of Object.entries(EXCHANGES))
  for (const exchange of bank) for (const line of exchange) push(line.who, line.text, `dialogue/${mood}`);

const pct = (n, d) => d ? `${Math.round(n / d * 100)}%` : '—';
console.log('Spoken lines, per character, against the studio card\n');
console.log('  who         lines  sworn  in-voice  stiff  card trap');
for (const [who, card] of Object.entries(CARDS)) {
  const mine = lines.filter(line => line.who === who);
  if (!mine.length) continue;
  const sworn = mine.filter(line => SWEAR.test(line.text)).length;
  const marks = mine.filter(line => card.marks.test(line.text)).length;
  const stiff = mine.filter(line => STIFF.test(line.text)).length;
  const trap = card.trap ? mine.filter(line => card.trap.test(line.text)).length : null;
  console.log(`  ${who.padEnd(11)} ${String(mine.length).padStart(4)}  ${pct(sworn, mine.length).padStart(5)}  ${pct(marks, mine.length).padStart(8)}  ${pct(stiff, mine.length).padStart(5)}  ${trap === null ? '—' : pct(trap, mine.length)}`);
}
console.log('\nCard notes');
for (const [who, card] of Object.entries(CARDS)) console.log(`  ${who.padEnd(11)} ${card.note}`);

const prose = Object.values(ARCS).flatMap(arc => [...arc.stages.map(s => s.text), arc.confrontation.prose, arc.aftermath.text]);
console.log(`\nArc narration: ${prose.length} passages · ${prose.filter(p => SWEAR.test(p)).length} carry coarse language`);
console.log('  (the studio places the manuscript\'s profanity in dialogue, so narration staying clean is expected)');
