import { VENUE_SCENES } from './venues.mjs';
import { LEGION_EXCHANGES } from './legion.mjs';

// Stage only an exchange that is actually in the recorded event. These
// openings borrow objects from its words, never a later world snapshot.
const signature = lines => JSON.stringify(lines.map(({ who, text }) => [who, text]));
const venues = new Map(Object.entries(VENUE_SCENES).flatMap(([venue, scenes]) =>
  scenes.map(scene => [`${venue}|${signature(scene.lines)}`, scene])));
const legion = new Set(Object.values(LEGION_EXCHANGES).flat().map(signature));
const names = { goaden: 'Goaden', ashai: 'Ashai', gabriel: 'Gabriel', rose: 'Rose',
  truth: 'Truth', anarchy: 'Anarchy', balthazar: 'Balthazar', damien: 'Damien',
  emily: 'Emily', zara: 'Zara' };

const openings = {
  ink_prowler_browse: 'A prowler design moved across the display at Enchanted Ink. Goaden stopped in front of it and lifted a hand to catch Ashai’s attention.',
  ink_wall_designs: 'Ashai slowed between the shelves at Enchanted Ink. She looked back towards the moving designs, then at Goaden.',
  ink_gabriel_wings: 'Gabriel looked up from the designs at Enchanted Ink. His gaze stopped on Goaden and Ashai.',
  ink_rose_florals: 'Rose stood in front of the floral designs. Ashai and Goaden drew up beside her as she studied the wall.',
  ink_truth_designs: 'Truth turned from the designs at Enchanted Ink and spotted Goaden. He raised an arm, the tattoos shifting with the movement.',
  ink_emily_prowler: 'A barefoot girl was studying the moving designs at Enchanted Ink. Ashai noticed her and leaned towards Goaden.',
  ink_prowler_remembered: 'Goaden looked from the designs at Enchanted Ink to his own prowler tattoo. Ashai saw his mouth curl before he said anything.',
  ink_light_inspector: 'Ashai looked at the drawing lamp, then at the small road sprite beside it. Goaden followed her gaze.',
  ink_lintel_portrait: 'At Enchanted Ink, an apprentice was working on another drawing of the drifting lintel. Ashai looked over the unfinished outlines.',
  ink_kai_portrait: 'At Enchanted Ink, Goaden was trying to explain Kai’s shape to the artisan drawing him. The little dragon stood on the counter. Ashai looked from him to the drawing.',
  ink_emily_commission: 'Ashai watched a customer considering his commission at Enchanted Ink. She turned back towards Goaden; the little girl nearby was listening.',
  cafe_lintel_table_six: 'A lintel hung above the outside tables at the Silver Spoon. Ashai stopped to watch the drifting creature.',
  plaza_lintel_rabbit: 'Light rose over the street performer in the plaza. Ashai tipped her head back, following the enormous outline taking shape.',
};
const firstOpenings = new Map([
  ['Ordered, yeah.', 'Goaden turned back from the counter at the Silver Spoon. Ashai was waiting for him.'],
  ["I'm not going to be good company for about twenty minutes.", 'Ashai settled at the café table with her tea. Goaden looked across at her.'],
  ['He has ordered the wrong thing for her again.', 'A voice rose at the next table. Goaden turned his head, and Ashai followed his glance.'],
  ["Oh, you're joking.", 'Zara looked up from her table at the Silver Spoon. There were two cups in front of her. Then she saw Goaden and Ashai.'],
  ['REEVER!', 'Truth spotted Goaden across the Silver Spoon. He drew breath; Ashai looked round.'],
  ["Right. Nobody move. I'm doing the new one, here, acoustically.", 'Gabriel planted himself beneath New Big Ben and lifted his hands towards Goaden and Ashai.'],
  ['You can feel the Chimes in the paving. Stand still.', 'The Chimes rolled through the plaza. Ashai stopped, feeling the sound through the soles of her feet. Goaden was still moving beside her.'],
  ['Everyone has stopped talking.', 'Conversation around them died away all at once. Ashai turned towards Goaden in the sudden quiet.'],
  ['Fancy that.', 'Zara came up to Goaden and Ashai in the plaza. Ashai watched her approach.'],
  ['Open your mouth. You can hear it in your teeth... in your teeth...', 'Under the Chimes, a little girl looked up at Ashai and opened her mouth to the sound.'],
]);

export function sceneEditorial(event) {
  const lines = event.lines ?? event.payload?.lines;
  if (!Array.isArray(lines) || !lines.length || event.visibility !== 'public'
    || !['goaden', 'ashai'].every(who => event.participants?.includes(who))) return null;
  if (event.type === 'VENUE_SCENE') {
    const scene = venues.get(`${event.location}|${signature(lines)}`);
    if (!scene || event.payload?.venue !== event.location) return null;
    const prose = openings[scene.id] ?? firstOpenings.get(lines[0].text);
    return prose ? { prose } : null;
  }
  if (event.type !== 'LEGION_VISIT' || !legion.has(signature(lines))) return null;
  const first = lines[0], speakers = new Set(lines.map(line => line.who));
  if (first.who === 'balthazar') return { prose: first.text === 'I have considered the invoice.'
    ? 'Anarchy’s expression settled. When he spoke about the damage invoice, it was Balthazar’s voice that came out. Goaden waited.'
    : 'Anarchy grew still. Balthazar spoke through the body they shared.' };
  if (first.who === 'anarchy' && speakers.has('balthazar')) return { prose: 'Anarchy paused. The conversation with Balthazar was about to become audible to everyone else.' };
  if (first.who === 'gabriel' && /Third\. Still third\./.test(first.text)) return { prose: 'Gabriel looked from Anarchy to Rose, his arms spread. Neither hurried to fill the silence.' };
  const listener = lines.find(line => line.who !== first.who && names[line.who]);
  return names[first.who] && listener
    ? { prose: `${names[first.who]} turned towards ${names[listener.who]}.` } : null;
}
