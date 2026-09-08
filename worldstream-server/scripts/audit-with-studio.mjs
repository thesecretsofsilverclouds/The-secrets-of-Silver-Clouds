// Run every authored story in Worldstream through the Manuscript Studio's
// draft review, and report what it finds.
//
// This only reads the studio: it imports `reviewDraft` and the analysis
// library, writes nothing into tools/manuscript-studio, and never touches the
// live world. The studio's own framing applies to everything it says here —
// these are craft notes, not a canon clearance or a quality score, and its
// coarse-language count is descriptive rather than a target.
import { loadLibrary } from '../../tools/manuscript-studio/src/library.mjs';
import { reviewDraft } from '../../tools/manuscript-studio/src/authoring.mjs';
import { VENUE_SCENES, INK_BOOKING_SCENE } from '../src/venues.mjs';
import { LEGION_EXCHANGES } from '../src/legion.mjs';
import { EXCHANGES } from '../src/dialogue.mjs';
import { ARCS } from '../src/arcs.mjs';

const library = loadLibrary();
// Worldstream carries speakers the studio has no card for — Emily, the road
// sprites and the lintel. They are named in the draft text so the reviewer can
// still see them; they are simply not selectable as evidenced cast.
const STUDIO_CAST = new Set(library.characters.map(character => character.id));
const NAMES = {
  goaden: 'Goaden', ashai: 'Ashai', rose: 'Rose', anarchy: 'Anarchy', balthazar: 'Balthazar',
  gabriel: 'Gabriel', truth: 'Truth', zara: 'Zara', emily: 'Emily', yukon: 'Yukon',
  sprite_orange: 'Orange', sprite_shades: 'Shades', sprite_purple: 'Purple',
  sprite_blue: 'Blue', lintel: 'The lintel',
};

const base = (draft, characters, location, mode) => ({
  mode, characters, location, budget: 2600,
  purpose: 'Existing authored Worldstream material, reviewed against the manuscript study.',
  committedFacts: 'This scene is already authored and already passes the world\'s canon rails.',
  knownFacts: 'Nothing is learned here that the world has not already recorded.',
  forbiddenFacts: 'No new ability. No new world rule. Nothing past the p.183 checkpoint.',
  consequence: 'None. A scene is lines and nothing else.',
  focus: '', customNotes: '', draft,
});

const items = [];
for (const [venue, bank] of Object.entries(VENUE_SCENES))
  for (const scene of bank) items.push({ kind: 'venue', id: scene.id ?? `${venue}/untitled`, location: venue, lines: scene.lines });
items.push({ kind: 'venue', id: INK_BOOKING_SCENE.id, location: 'enchanted_ink', lines: INK_BOOKING_SCENE.lines });
for (const [mood, bank] of Object.entries(LEGION_EXCHANGES))
  bank.forEach((lines, index) => items.push({ kind: 'legion', id: `${mood}#${index}`, location: 'legion_hideout', lines }));
for (const [mood, bank] of Object.entries(EXCHANGES))
  bank.forEach((lines, index) => items.push({ kind: 'dialogue', id: `${mood}#${index}`, location: 'mi6', lines }));
for (const [id, arc] of Object.entries(ARCS)) {
  const prose = [...arc.stages.map(stage => stage.text), arc.confrontation.prose, arc.aftermath.text].join('\n\n');
  items.push({ kind: 'arc', id, location: arc.location, prose });
}

const MODE = { venue: 'banter', legion: 'ensemble', dialogue: 'quiet', arc: 'action' };
const tally = new Map();
const detail = [];
let reviewed = 0, skipped = 0;

for (const item of items) {
  const draft = item.prose ?? item.lines.map(line => `${NAMES[line.who] ?? line.who}: ${line.text}`).join('\n');
  const speakers = item.lines ? [...new Set(item.lines.map(line => line.who))] : ['goaden', 'ashai'];
  const cast = speakers.filter(who => STUDIO_CAST.has(who)).slice(0, 4);
  if (!cast.length) { skipped++; continue; }
  let review;
  try { review = reviewDraft(library, base(draft, cast, item.location, MODE[item.kind])); }
  catch (error) { console.log(`  !! ${item.kind}/${item.id}: ${error.message}`); skipped++; continue; }
  reviewed++;
  for (const finding of review.findings) {
    if (finding.title === 'Grit is not a defect') continue;
    // A speaker the studio has no card for is expected, not a defect.
    if (finding.title === 'Speaker outside the supplied cast' && speakers.length > cast.length) continue;
    tally.set(finding.title, (tally.get(finding.title) ?? 0) + 1);
    detail.push({ severity: finding.severity, title: finding.title, where: `${item.kind}/${item.id}`,
      detail: finding.detail, excerpt: finding.excerpt });
  }
}

console.log(`Manuscript Studio review · ${reviewed} stories reviewed, ${skipped} skipped\n`);
if (!tally.size) console.log('No findings.');
for (const [title, count] of [...tally].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${title}`);
if (process.argv[2] === '--detail') {
  console.log('');
  for (const row of detail.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1)))
    console.log(`[${row.severity}] ${row.where} — ${row.title}\n    ${row.excerpt || row.detail}`);
}
