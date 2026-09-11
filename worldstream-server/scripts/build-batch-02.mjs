// scripts/build-batch-02.mjs
// Generates and validates 165 reusable surface_only scene reservoir entries for Batch 02.
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeReservoirBatch, reservoirSourceHash } from '../src/scene-reservoir-catalog.mjs';
import { SCENE_RESERVOIR_BATCHES } from '../src/scene-reservoir-data.mjs';

const entries = [];

function add(entry) {
  entries.push({
    id: entry.id,
    family: entry.family,
    origin: 'batch_02',
    status: 'staged',
    register: 'micro_scene',
    cast: entry.cast,
    location: entry.location,
    trigger_family: entry.trigger_family,
    gate_note: entry.gate_note,
    effect_policy: 'surface_only',
    cooldown_note: 'Prefer a long scene cooldown and family spacing; exact values should be mapped to current runtime rules.',
    tags: entry.tags,
    prose: entry.prose.trim()
  });
}

// ==========================================
// 1. STREAMLINER JOURNEYS (30 entries: .11 to .40)
// ==========================================

add({
  id: 'travel.streamliner.11',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The carriage swayed slightly as the Streamliner banked over the curve of Blackfriars. Ashai kept her gaze fixed on the copper tracery along the ceiling, where faint violet illumination pulsed in time with the kinetic dampers. Goaden turned a page of his transit schedule without reading it. Outside, rain smeared the double glazing into long, luminous streaks of London grey. Neither of them spoke, letting the hum of the rails fill the compartment.'
});

add({
  id: 'travel.streamliner.12',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'A low thrum resonated through the floorplates as the carriage entered the cloud layer above Southwark. Fog pressed flat against the glass, turning the afternoon to pewter. Ashai adjusted the strap of her satchel, her thumb tracing the brass buckle twice before resting. Goaden leaned his head back against the dark velvet headrest, eyes half-lidded, listening to the chime that marked their ascent. The silence between them felt deliberate and rehearsed.'
});

add({
  id: 'travel.streamliner.13',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The train glided soundlessly past the stone spires of the upper city, where damp gargoyles jutted into the mist. Inside, the noise-cancelling wards muffled the roar of the wind to a faint, papery rustle. Ashai watched the brass indicator needle tremble near seventy leagues. Goaden tapped the edge of his thumbnail against the armrest, caught himself doing it, and folded both hands neatly into his lap.'
});

add({
  id: 'travel.streamliner.14',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Deceleration came as a gentle pressure against their shoulders. Through the window, the Thames curved away beneath them like an oiled ribbon reflecting the gaslamps of the embankment. Ashai watched a steam barge crawl through the dark arches below. “Smooth run,” Goaden noted, his voice flat. Ashai offered a single nod, neither confirming nor denying the observation, and gathered her coat closer about her chest.'
});

add({
  id: 'travel.streamliner.15',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The arcane dampening coils beneath the mahogany benches clicked three times in rhythmic succession. Ashai looked up, noting the faint scent of warm resin and brass that accompanied every altitude change. Across the narrow aisle, Goaden was studying the mirrored glass of the luggage rack, watching her reflection without turning his neck. When their eyes met in the glass, neither looked away for several seconds.'
});

add({
  id: 'travel.streamliner.16',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'A sudden drop in cabin pressure above the railyards caused their ears to click simultaneously. Ashai swallowed hard, rolling her shoulders against the stiff seatback. Outside, chimney smoke rose straight into the grey ceiling before flattening out along the atmospheric ward boundary. Goaden adjusted his collar, fingers smoothing the dark wool. The carriage rocked once, settling back into its track with a quiet hiss of pneumatic valves.'
});

add({
  id: 'travel.streamliner.17',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Sunlight broke through a fissure in the upper cloud deck, casting a sudden geometric beam of pale gold across the aisle. Dust motes swirled in the warmth before the carriage plunged back into the shadow of the viaduct arches. Ashai blinked against the afterimage. Goaden did not flinch, though his knuckles tightened momentarily against the seam of his dark trousers before loosening again.'
});

add({
  id: 'travel.streamliner.18',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The velvet upholstery smelled faintly of cedar and rain. Ashai traced a spiral watermark dried into the brass window sill. Below, a cluster of church towers poked through the rolling mist like stone islands in a grey lake. “Wind is picking up from the east,” she murmured to the glass. Goaden listened, eyes fixed straight ahead. “The wards will take it,” he replied, even and unhurried.'
});

add({
  id: 'travel.streamliner.19',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The Streamliner skirted the massive brick bulkheads of a brewery complex, soot coating the external panes for a brief heartbeat before the cleaning sigils flared and dissolved the grime. Ashai watched the tiny sparks fizzle out along the perimeter seal. Goaden pulled out a pocket watch, checked the Roman numerals, and slipped it back into his waistcoat without a word.'
});

add({
  id: 'travel.streamliner.20',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai', 'kai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai', 'kai'],
  prose: 'Banking north over the borough, the luggage netting creaked gently under the lateral shift. Kai rested curled upon Goaden’s knee, a small ridged tail twitching once as the carriage tilted into the turn. Ashai leaned her temple against the frame, watching how the dragon’s dark scales caught the green glow of the carriage lantern. Nobody spoke until the car straightened on the central rail.'
});

add({
  id: 'travel.streamliner.21',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai', 'greah'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai', 'greah'],
  prose: 'Crossing the overhead junction, an arc of blue static crackled outside the roofline, grounding harmlessly along the copper lightning rods. Greah ruffled her feathers with a quiet rustle on Ashai’s shoulder, settling deeper into her cloak. Goaden glanced at the Guardian, then back to the aisle. “Static buildup along the third rail,” he said. Ashai nodded once. “Always does that at this switch.”'
});

add({
  id: 'travel.streamliner.22',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The soft chime of an altitude checkpoint sounded through the carriage grill. Below them, London lay spread out like a surveyor’s plan drawn in charcoal and brass, street lamps beginning to blossom through the late afternoon smog. Ashai watched a flock of starlings wheeling below the rail level. The distance gave everything the stillness of an oil painting held behind heavy glass.'
});

add({
  id: 'travel.streamliner.23',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The magnetic brakes engaged with a deep, shuddering hum that traveled up through the soles of their boots. Coat hems swayed in unison on the brass wall pegs. London mist clung to the outer rubber gaskets, beading into heavy droplets that ran sideways across the glass as speed bled away. Goaden stood up, adjusted his coat lapels, and waited by the door.'
});

add({
  id: 'travel.streamliner.24',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The carriage passed through the deep shadow of an elevated clock tower. For three seconds, the giant cast-iron numerals eclipsed the carriage windows, the steady mechanical clack of the escapement audible even through the reinforced glass. Ashai watched the minute hand shudder forward. Goaden remained motionless beside her, his silhouette sharp and dark against the passing ironwork.'
});

add({
  id: 'travel.streamliner.25',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'A cool draught slipped through the carriage ventilation louvres, carrying the distinct scent of wet slate and river mud. Ashai pulled her woollen scarf higher around her chin, tucking the loose fringe into her jacket. Across the aisle, Goaden watched the mist swirl around the external guide lights. Neither felt the urge to break the steady rhythm of their transit.'
});

add({
  id: 'travel.streamliner.26',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Sliding alongside an elevated signal gantry, green kerosene lanterns reflected across the polished walnut panelling of the carriage. The attendant bells rang twice with a hollow, brassy note. Ashai checked the lace of her right boot, retied it with brisk efficiency, and sat back. Goaden’s eyes followed the movement before returning to his neutral appraisal of the passing sky.'
});

add({
  id: 'travel.streamliner.27',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Concealed heating conduits along the floorboards kept the compartment comfortable, though frost feathered the lower edges of the double-glazed panes. Ashai rested the back of her hand against the chill glass, feeling the subtle vibration of the skyway. Goaden exhaled through his nose, a slow and steady breath that barely stirred the collar of his shirt.'
});

add({
  id: 'travel.streamliner.28',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Below them, river barges appeared reduced to rectangular chips of timber floating upon slate-coloured water, their navigation lanterns tiny yellow pricks in the gloom. The Streamliner maintained its smooth, unerring trajectory along the elevated magnetic beam. Ashai watched until a terrace of brick chimneys cut off the river view. Goaden did not turn his head once.'
});

add({
  id: 'travel.streamliner.29',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The train cut through a localized rain squall, drops pelting the reinforced curved roof like handfuls of dry peas. Inside, the sound was muted to a rhythmic, soothing rattle. Ashai closed her eyes for twenty seconds, letting her posture slacken. Goaden shifted his weight on the plush cushion, the wool of his trousers rustling against the dark fabric.'
});

add({
  id: 'travel.streamliner.30',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Swinging smoothly across the iron viaduct, copper conduits along the rail bed glowed with a faint cyan resonance that washed across the underside of the carriage. Ashai looked down through the floor observation strip, watching the rails converge and diverge like silver needles. “Two minutes out,” Goaden remarked, his voice steady. Ashai reached for her satchel.'
});

add({
  id: 'travel.streamliner.31',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Crossing the boundary into the central borough, a faint prickle of ward static raised the hairs on Ashai’s forearms. She rubbed her wrists against her jacket sleeves until the sensation dissipated. Goaden blinked once, his posture unyielding. Through the window, the grey limestone facades of administrative buildings slid past, solid and indifferent in the twilight.'
});

add({
  id: 'travel.streamliner.32',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The reflection of the brass interior lanterns hung suspended in the black glass of the window, seeming to float like disembodied candles over the dark expanse of London. Ashai watched the lights dance as the carriage banked. Goaden’s reflection hovered just beside hers, rigid, unreadable, and completely still. Neither looked away until the carriage levelled.'
});

add({
  id: 'travel.streamliner.33',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'A hush settled over the compartment as the noise-cancelling wards engaged over the industrial yards. The grinding clatter of shunting engines below vanished instantly, replaced by the soft hum of the carriage air circulation. Ashai tilted her head, listening to the abrupt quiet. Goaden remained seated, arms crossed loosely over his chest, waiting out the journey.'
});

add({
  id: 'travel.streamliner.34',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Ashai rested her temple against the cool glass, watching a pair of city pigeons flutter from an iron girder as the Streamliner glided past. The birds dropped fifty feet before opening their wings into the soot-stained updraft. Goaden leaned forward, elbows on his knees, watching the floorplates rather than the drop. “Nearly there,” he said quietly.'
});

add({
  id: 'travel.streamliner.35',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Through the forward partition glass, Goaden tracked the long curve of the elevated skyway as it threaded between Victorian clock towers. His index finger drummed a slow, measured four-count against his thigh. Ashai watched the movement, matching her breathing to the rhythm until he stopped. Outside, the sky turned a bruised shade of violet.'
});

add({
  id: 'travel.streamliner.36',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Rising through the evening twilight, street lamps blossomed across London in vast, glowing clusters of amber and pale gaslight. Ashai watched the city dissolve into warmth below while the carriage grew colder near the ceiling vents. Goaden reached up and adjusted the vent knob with a sharp half-turn, cutting off the chill draught with quiet satisfaction.'
});

add({
  id: 'travel.streamliner.37',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'A sharp updraft struck the underside of the carriage as they cleared the river gorge, the pneumatic suspension absorbing the sudden roll with a deep, hydraulic groan. Ashai’s hand clamped down instinctively on the brass armrest. Goaden glanced at her fingers, then back to his own lap, giving her the dignity of his silence.'
});

add({
  id: 'travel.streamliner.38',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'The train passed an ancient stone aqueduct carrying water across the borough divide. Moisture dripped from the weeping masonry, striking the train windows like scattered buckshot before rolling off into the air. Ashai watched the dark stones blur behind them. Goaden let his head rest back, his eyes closed as the train found straight track.'
});

add({
  id: 'travel.streamliner.39',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Entering the shadow of the upper terminus canopy, the carriage lanterns brightened automatically to compensate for the sudden gloom. The brass fittings gleamed with renewed luster. Ashai gathered her satchel into her lap, smoothing down the fabric of her coat. Goaden adjusted his cuffs, his posture straightening as the platform lights appeared ahead.'
});

add({
  id: 'travel.streamliner.40',
  family: 'travel.streamliner',
  cast: ['goaden', 'ashai'],
  location: ['streamliner', 'streamliner/transit'],
  trigger_family: 'TRAVEL_BEGIN|TRAVEL|TRAVEL_ARRIVE',
  gate_note: 'Use only for actual Streamliner travel. Do not invent destinations, delays or passengers that alter state.',
  tags: ['travel', 'streamliner', 'transit', 'goaden', 'ashai'],
  prose: 'Final approach along the elevated track brought the magnetic guides humming into harmonic alignment, a pleasant, resonant chord that died away as the train docked. Ashai stood first, taking a steadying breath before the door mechanism hissed open. Goaden followed a pace behind, checking the empty seat cushions out of ingrained operational habit.'
});

// ==========================================
// 2. SANCTUARY VISITS (25 entries: .01 to .25)
// ==========================================

add({
  id: 'sanctuary.visit.01',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/portal_halls', 'sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'portal_halls', 'clouds', 'ashai', 'goaden'],
  prose: 'Stepping into the portal halls, the cloud foundation beneath the reinforced glass floor shifted like dense white wool. Ashai paused at the threshold, eyes tracing the silver veins of the containment wards embedded in the glass. Goaden halted beside her, hands resting casually in his coat pockets. The shimmering anti-flight field outside cast a pale lavender gleam over their boots.'
});

add({
  id: 'sanctuary.visit.02',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub', 'sanctuary/portal_halls'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'clouds', 'ashai', 'goaden'],
  prose: 'The central hub hummed with a low bass resonance that vibrated through the deep indigo velvet of the banquettes. Miles below, London was nothing more than an abstract tapestry of orange streetlamps peeking through gaps in the cumulus. Ashai sat back, letting her shoulders sink into the upholstery. Goaden took the opposite corner of the booth, studying the crowd with quiet vigilance.'
});

add({
  id: 'sanctuary.visit.03',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/portal_halls', 'sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'portal_halls', 'anti_flight', 'ashai', 'goaden'],
  prose: 'Outside the curved panoramic windows, the anti-flight barrier shimmered like oil on water, distorting the London skyline into rippling bands of amber and charcoal. Ashai watched a stray vapor wisp curl against the ward and dissipate. “Never quite looks real from up here,” she said softly. Goaden leaned against the dark brass railing. “It isn’t meant to,” he replied.'
});

add({
  id: 'sanctuary.visit.04',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/portal_halls'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'portal_halls', 'brass', 'ashai', 'goaden'],
  prose: 'The stone tiles of the portal hall were cool even through boot leather, inlaid with geometric brass runes that pulsed with faint ambient warmth. A muted cadence of string instruments drifted from an inner chamber. Ashai stopped to adjust the strap of her bionic eye casing. Goaden stood by the archway, his silhouette framed against the vast white drift of cloud outside.'
});

add({
  id: 'sanctuary.visit.05',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'clouds', 'ashai', 'goaden'],
  prose: 'A massive bank of cloud surged up against the eastern panoramic panes, temporarily plunging the central hub into a dense, milky twilight. The polished mahogany tables caught the amber gleam of the suspended lanterns. Ashai traced the wood grain with her index finger, feeling the solid weight of the furniture suspended in empty air. Goaden watched the fog swirl without moving.'
});

add({
  id: 'sanctuary.visit.06',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden', 'gabriel'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'gabriel', 'ashai', 'goaden'],
  prose: 'In a curtained alcove near the main lounge, Gabriel leaned over a low wooden side table, pencil poised over a crowded manuscript leaf. Ashai watched from the balustrade as he crossed out a word and tapped the eraser against his chin. Goaden gave a brief, respectful nod across the mezzanine, which Gabriel acknowledged with an upturned palm before returning to his verse.'
});

add({
  id: 'sanctuary.visit.07',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/portal_halls', 'sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'portal_halls', 'ozone', 'ashai', 'goaden'],
  prose: 'The scent of high-altitude ozone and crushed mint hung in the threshold between the portal arches and the central hub. The low hum of the foundation wards vibrated in their ribcages like a resting engine. Ashai slowed her pace, letting the warmth of the interior wash away the chill of the transit. Goaden checked his watch, noting the hour before slipping it away.'
});

add({
  id: 'sanctuary.visit.08',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'balcony', 'ashai', 'goaden'],
  prose: 'Goaden rested his forearms on the heavy bronze perimeter railing of the central hub, staring into the iridescent field that sealed the nightclub from the sky. Beside him, Ashai pulled her collar tighter against the faint draught that bled through the seals. They remained shoulder to shoulder for three uninterrupted minutes, watching mist curl past the stanchions.'
});

add({
  id: 'sanctuary.visit.09',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/portal_halls'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'portal_halls', 'transit', 'ashai', 'goaden'],
  prose: 'Crossing the bronze expansion plate between the two portal chambers, their bootheels clicked in unison against the metal. The atmospheric regulator overhead hissed softly, balancing the dry exterior cloud air with the perfumed interior. Ashai took a deep breath, eyes adjusting to the dim crimson glow of the wall sconces. Goaden glanced back toward the arrival gates once before proceeding.'
});

add({
  id: 'sanctuary.visit.10',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'glass_floor', 'ashai', 'goaden'],
  prose: 'Through a circular floor panel of reinforced quartz, the Thames appeared as a pale, glistening thread weaving through dark blocks of Victorian masonry. Ashai stood directly over the aperture, her balance completely centred. Goaden stopped just at the rim of the frame, eyes tracking a distant river tugboat that seemed no larger than a grain of rice.'
});

add({
  id: 'sanctuary.visit.11',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden', 'greah'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'greah', 'ashai', 'goaden'],
  prose: 'Greah perched lightly on the high curved back of the velvet booth, her feathers sleeked tight against her body as she eyed the swirling cloud foundation below. Ashai offered the back of her knuckles, and the Guardian hopped down with delicate precision. Goaden watched from across the small marble table. “She doesn’t trust the glass,” he observed. “Neither do I,” Ashai replied.'
});

add({
  id: 'sanctuary.visit.12',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'ambience', 'ashai', 'goaden'],
  prose: 'A low murmur of conversation rose from the scattered tables across the lounge, punctuated by the occasional clink of heavy crystal against stone coasters. Ashai rested her chin on her palm, watching the amber lanterns swing imperceptibly with the building’s atmospheric drift. Goaden took a long, steadying breath, his shoulders dropping half an inch as the tension drained away.'
});

add({
  id: 'sanctuary.visit.13',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'dome', 'ashai', 'goaden'],
  prose: 'Mist drifted over the exterior dome, diffusing the afternoon sun into an ethereal golden haze that painted the carpets in honey tones. Ashai leaned both elbows on the perimeter balustrade, closing her eyes for a moment to feel the soft air currents from the intake vents. Goaden stood beside her, vigilant yet unhurried, his coat hanging loose and unbuttoned.'
});

add({
  id: 'sanctuary.visit.14',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden', 'kai'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'kai', 'ashai', 'goaden'],
  prose: 'Kai peered through the quartz floor section, neck craned forward, watching a distant flock of pigeons wheel through the lower airspace. His tail tip flicked twice against Goaden’s forearm. Ashai smiled faintly at the dragon’s intense scrutiny. “He thinks they’re bugs,” Goaden murmured. “From this height, everything is,” Ashai replied, her gaze wandering toward the distant hills.'
});

add({
  id: 'sanctuary.visit.15',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/portal_halls'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'portal_halls', 'chime', 'ashai', 'goaden'],
  prose: 'A deep, resonant chime echoed through the portal hall as the arrival conduit synchronized with the London terminal below. The air smelled briefly of ozone and damp ferns. Ashai stepped aside to clear the gangway, her boots scuffing the pale cloudstone. Goaden paused near the station pillar, waiting until the blue portal ring faded back to baseline indigo.'
});

add({
  id: 'sanctuary.visit.16',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'alcove', 'ashai', 'goaden'],
  prose: 'They took seats in a quiet semi-circular alcove beneath a suspended brass ring chandelier. The low, warm light smoothed the lines of weariness from their faces. Neither seemed inclined to start a conversation, content to let the ambient murmur of the club and the slow drift of clouds outside occupy the space between them.'
});

add({
  id: 'sanctuary.visit.17',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'condensation', 'ashai', 'goaden'],
  prose: 'Condensation beaded heavily along the lower metal sash of the observation windows, forming clear droplets that trembled against the glass. Goaden reached out and traced a slow horizontal line through the moisture with his knuckle, drying the skin against his coat. Ashai watched the clear stripe fill back in with fog within thirty seconds.'
});

add({
  id: 'sanctuary.visit.18',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'foundation', 'ashai', 'goaden'],
  prose: 'A subtle density shift in the cloud bank beneath the foundation caused the entire structure to settle with a soft, barely perceptible groan of stabilized timbers. Ashai’s hand tightened on the table edge before relaxing as the counter-wards leveled the floor. Goaden didn’t blink. “Thermal pocket,” he noted. Ashai let out a slow, approving breath.'
});

add({
  id: 'sanctuary.visit.19',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'quiet_break', 'ashai', 'goaden'],
  prose: 'The afternoon rush had receded, leaving the central hub in a state of suspended calm. An attendant in dark livery quietly cleared empty glassware from a nearby pedestal, the crystal chiming delicately. Ashai crossed her ankles beneath the booth, resting her hands flat on the polished table. Goaden watched the entrance with relaxed, steady concentration.'
});

add({
  id: 'sanctuary.visit.20',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'twilight', 'ashai', 'goaden'],
  prose: 'Twilight bled across the cloud terrace outside, turning the billowing mist from pearl to deep bruise-violet. Ashai pulled her sleeves down over her knuckles, watching the transition of light reflect across the curved ceiling panels. Goaden leaned back against the padded wall, eyes half-closed, his face cast in cool lavender shadow.'
});

add({
  id: 'sanctuary.visit.21',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/portal_halls'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'portal_halls', 'azure', 'ashai', 'goaden'],
  prose: 'Waiting near the departure conduit, the portal arch glowed with a faint, steady azure pulse that cast long shadows across the floor stones. Ashai adjusted her jacket collar, checking the seal of her cuffs. Goaden stood half a pace behind her, his breath slow and even in the cool, ward-tempered air of the hall.'
});

add({
  id: 'sanctuary.visit.22',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'barrier', 'ashai', 'goaden'],
  prose: 'A cold exterior downdraft slammed into the anti-flight barrier, causing the iridescent shimmer outside the glass to flare with sharp prismatic colours. Ashai watched the light dance across Goaden’s jawline before fading back to charcoal. “Pressure drop out there,” she remarked. Goaden nodded once, his eyes scanning the horizon where storm clouds gathered.'
});

add({
  id: 'sanctuary.visit.23',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden', 'gabriel'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'gabriel', 'verse', 'ashai', 'goaden'],
  prose: 'Gabriel walked past their booth carrying a rolled parchment tied with black ribbon, his stride unhurried and light. He nodded politely to Ashai, his gaze lingering briefly on the cloud terrace before he disappeared down the curved stair to the private suites. Ashai watched him go. “Always working,” Goaden noted quietly. Ashai smiled without answering.'
});

add({
  id: 'sanctuary.visit.24',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'velvet', 'ashai', 'goaden'],
  prose: 'The plush velvet seat cushion sank comfortably beneath Ashai’s weight as she leaned her head back against the wood panelling. High above London, the frantic pace of the streets below felt completely disconnected from this silent, floating haven. Goaden uncrossed his ankles, his posture settling into an easy, companionable stillness.'
});

add({
  id: 'sanctuary.visit.25',
  family: 'sanctuary.visit',
  cast: ['ashai', 'goaden'],
  location: ['sanctuary/central_hub', 'sanctuary/portal_halls'],
  trigger_family: 'VENUE_SCENE|ACTIVITY_COMPLETE|QUIET_TIME_BEGIN',
  gate_note: 'Only when in the Sanctuary. Grounded in the cloud foundation, anti-flight shimmer, portal arches, or velvet seating. Do not invent unauthorized drinks, patrons, fights, or structural changes.',
  tags: ['sanctuary', 'central_hub', 'departure', 'ashai', 'goaden'],
  prose: 'As the perimeter lanterns kindled for the night, London emerged through ragged breaks in the cloud cover like a constellation of amber embers. Ashai stood, brushing an invisible speck of lint from her sleeve. Goaden rose in the same motion, stepping into the aisle to lead the way toward the portal corridor without a word.'
});

// ==========================================
// 3. MI6 LUNCH-HALL MOMENTS (25 entries: .11 to .35)
// ==========================================

add({
  id: 'domestic.shared_meal.11',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'lunch_hall', 'goaden', 'ashai'],
  prose: 'The steel cutlery tray rattled loudly as Goaden pulled free a bent fork, inspected the tines, and swapped it for a straight one from the adjoining bin. Ashai was already seated at the end of the long bench, carefully scraping salted butter across a dense wedge of brown bread. He set down his tray with a dull clank and sat opposite without ceremony.'
});

add({
  id: 'domestic.shared_meal.12',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'lunch_hall', 'goaden', 'ashai'],
  prose: 'Ashai sliced into a baked potato with methodical precision, steam billowing up into the chilled air of the lunch hall. Goaden pushed the pepper shaker two inches across the formica tabletop toward her plate. She took it without looking up, gave two sharp shakes over the steaming potato, and pushed it exactly back to where it had started.'
});

add({
  id: 'domestic.shared_meal.13',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai', 'henderson'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'henderson', 'goaden', 'ashai'],
  prose: 'Henderson passed their table carrying an empty tin tray, nodding curtly to Goaden as he deposited it onto the clearing stack by the scullery hatch. The clatter of clearing echoed off the concrete pillars. Ashai chewed her toast quietly, watching Henderson march toward the corridor doors with his usual parade-ground posture.'
});

add({
  id: 'domestic.shared_meal.14',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai', 'davis'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'davis', 'goaden', 'ashai'],
  prose: 'Davis sat two tables away, spreading margarine onto toast with measured, sharp strokes of his butter knife. Ashai glanced over once, noting the neat alignment of his canteen mug and notebook. Goaden caught her gaze, shook his head by a fraction of an inch, and took a slow sip of black tea.'
});

add({
  id: 'domestic.shared_meal.15',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'tea', 'goaden', 'ashai'],
  prose: 'A thick ceramic mug of builders’ tea warmed Ashai’s chilled fingertips. Across the table, Goaden was meticulously folding a paper napkin into a crisp rectangle, pressing the creased edge flat with the side of his thumb. When he finished, he tucked it neatly under the rim of his bowl and picked up his spoon.'
});

add({
  id: 'domestic.shared_meal.16',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai', 'balthazar'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'balthazar', 'goaden', 'ashai'],
  prose: 'Balthazar stepped between their chairs to retrieve the communal salt cellar, murmuring a gruff apology as his sleeve brushed Goaden’s shoulder. Goaden nodded once without interrupting his chewing. Ashai watched Balthazar retreat toward the quartermasters’ table, the heavy scent of motor oil and cold iron trailing in his wake.'
});

add({
  id: 'domestic.shared_meal.17',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'soup', 'goaden', 'ashai'],
  prose: 'The canteen pea soup had formed a thin skin across the surface while they waited out the lunch queue. Ashai stirred it back into liquid with her spoon, watching the reflection of the high strip lights swirl in the green bowl. Goaden broke a dry bread roll in half with a crisp snap that drew a glance from the next bench.'
});

add({
  id: 'domestic.shared_meal.18',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai', 'greah'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'greah', 'goaden', 'ashai'],
  prose: 'Greah perched on the edge of the wooden partition beside Ashai’s shoulder, her head bobbing rhythmically as she watched Goaden cut a strip of cold beef. Ashai nudged a dry breadcrumb toward the table edge with her pinky finger. Greah snapped it up in a blur of feathers, then resumed her vigilant pose as though nothing had happened.'
});

add({
  id: 'domestic.shared_meal.19',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'rain', 'goaden', 'ashai'],
  prose: 'Rain lashed the high clerestory windows of the lunch hall, drowning out the ambient chatter of the recruits. Goaden scraped the last beans from his metal plate, his gaze drifting upward toward the dark glass panes where water ran in thick sheets. “Afternoon drills will be on the covered floor,” Ashai said. He nodded once in grim concurrence.'
});

add({
  id: 'domestic.shared_meal.20',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'table', 'goaden', 'ashai'],
  prose: 'The table had an annoying wobble on an uneven floor rivet, tilting every time Ashai leaned forward to reach her tea. Goaden reached into his pocket, extracted a folded cardboard beer mat from three days ago, and kicked it under the offending table leg. The table leveled with a satisfying thud. Ashai nodded her thanks.'
});

add({
  id: 'domestic.shared_meal.21',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'scullery', 'goaden', 'ashai'],
  prose: 'A loud clatter of stainless steel pots echoed from the scullery hatch as the kitchen staff changed shifts. The scent of boiled cabbage and over-steeped caraway tea hung heavy over the central rows. Ashai pushed her half-empty bowl away, resting her wrists against the table edge. Goaden finished his mug with three deliberate gulps.'
});

add({
  id: 'domestic.shared_meal.22',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai', 'kai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'kai', 'goaden', 'ashai'],
  prose: 'Kai rested his scaly chin on the wooden bench beside Goaden’s hip, his dark nostrils flaring as he sniffed the steam rising from a bowl of stew. Goaden gave the dragon a gentle nudge with his elbow, keeping him away from the cutlery. Ashai watched the dragon’s tail twitch with quiet amusement over her teacup.'
});

add({
  id: 'domestic.shared_meal.23',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'chair', 'goaden', 'ashai'],
  prose: 'Ashai pushed her wooden canteen chair back from the table, the rubber feet shrieking briefly against the scarred linoleum floor. Two junior logistics clerks glanced over before turning back to their paperwork. Goaden stayed seated, wiping a stray drop of tea from his cuff with the folded corner of his napkin.'
});

add({
  id: 'domestic.shared_meal.24',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'silence', 'goaden', 'ashai'],
  prose: 'They ate in total silence while at the next table three junior operators argued heatedly over train delays along the district line. Ashai neatly dissected a boiled apple, spearhead by spearhead. Goaden methodically chewed his crust, eyes focused on a scratch in the laminate table surface that resembled the Isle of Wight.'
});

add({
  id: 'domestic.shared_meal.25',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'pepper', 'goaden', 'ashai'],
  prose: 'Goaden slid the tin pepper shaker across the table without looking up from his plate. Ashai caught it between two fingers just before it reached the bevelled edge, giving her broth two brisk turns. She set it down with an almost imperceptible click, the unspoken domestic shorthand of two people used to shared mess routines.'
});

add({
  id: 'domestic.shared_meal.26',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'tray', 'goaden', 'ashai'],
  prose: 'Stacking their thick ceramic plates onto the metal return trolley, the heavy porcelain clinked with finality. Ashai set her fork and knife parallel across the tray out of habit. Goaden slotted his mug into the wooden rack, took a fresh paper serviette to wipe his fingers, and stepped toward the exit corridor.'
});

add({
  id: 'domestic.shared_meal.27',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'water', 'goaden', 'ashai'],
  prose: 'The metal water jug on their table was sweating heavily in the humid warmth of the hall, ice cubes clinking like small bells as Goaden tipped it into his tumbler. He pushed the jug toward Ashai, who poured herself three fingers of cold water before setting the pitcher squarely back on its cork coaster.'
});

add({
  id: 'domestic.shared_meal.28',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'noise', 'goaden', 'ashai'],
  prose: 'A heavy metal ladle slipped from a cook’s grip behind the serving counter, clattering loudly against the tiled floor. Half the soldiers in the hall paused their forks mid-bite, then resumed eating without looking up. Ashai didn’t even flinch. Goaden merely swallowed his mouthful of potato and reached for the salt.'
});

add({
  id: 'domestic.shared_meal.29',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'clementine', 'goaden', 'ashai'],
  prose: 'Ashai peeled a small clementine with her thumb, the sharp, citrus scent cutting through the greasy canteen air. She separated the fruit into four neat segments and left two on the clean napkin between them. Goaden took one without acknowledging the gesture aloud, chewing thoughtfully while watching the corridor doors.'
});

add({
  id: 'domestic.shared_meal.30',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'skylight', 'goaden', 'ashai'],
  prose: 'Rain hammered the reinforced wired skylight overhead with increasing fury, turning the midday sky above the hall to slate. Ashai took a slow sip of cooling tea, letting her gaze rest on the blurry patterns of water sheeting across the glass. Goaden pushed his chair back an inch, legs stretched out beneath the table.'
});

add({
  id: 'domestic.shared_meal.31',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'mug', 'goaden', 'ashai'],
  prose: 'Goaden set down his empty mug with a solid thump that vibrated the table. He pinched the bridge of his nose between thumb and forefinger, releasing a long, quiet breath. Ashai watched him from over the rim of her glass, noticing the faint dark circles beneath his eyes before looking away toward the clock.'
});

add({
  id: 'domestic.shared_meal.32',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'crumbs', 'goaden', 'ashai'],
  prose: 'Toast crumbs lay scattered across the brown greaseproof paper on Goaden’s tray. He carefully rolled the paper into a tight cylinder, tucking the ends inward until it formed a neat parcel. Ashai watched the demonstration of compulsive tidiness, her eyebrow lifting slightly. He dropped the parcel onto his tray without an explanation.'
});

add({
  id: 'domestic.shared_meal.33',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai', 'davis'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'davis', 'goaden', 'ashai'],
  prose: 'Davis rose from his table, cleared his dishes with crisp, parade-ground movements, and walked past them toward the exit. His eyes met Goaden’s for a split second—cool, assessing, professional. Goaden returned the look with flat indifference. Ashai kept her eyes firmly on her bowl until the heavy double doors swung shut.'
});

add({
  id: 'domestic.shared_meal.34',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'spoon', 'goaden', 'ashai'],
  prose: 'Ashai stirred her tea clockwise four times, the tin spoon tapping against the ceramic with a small, rhythmic chime. She lifted the spoon, watched the dark amber droplet fall back into the cup, and set it on the saucer. Goaden wiped his mouth with his sleeve, ready to move whenever she gave the signal.'
});

add({
  id: 'domestic.shared_meal.35',
  family: 'domestic.shared_meal',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/lunch_hall'],
  trigger_family: 'MEAL_BEGIN|MEAL|CROSS_PATHS',
  gate_note: 'Requires both characters eating or present in common room. No invented dishes with magical properties or relationship milestone confessions.',
  tags: ['domestic', 'shared_meal', 'exit', 'goaden', 'ashai'],
  prose: 'Ashai wiped a ring of water from the formica tabletop using the heel of her palm, then dried it against her jeans. Goaden stood up, picking up both their trays in one smooth motion to carry them to the wash racks. She followed half a step behind, letting him shoulder open the swinging exit door.'
});

// ==========================================
// 4. MI6 CORRIDOR CROSS-PATHS (25 entries: .11 to .35)
// ==========================================

add({
  id: 'domestic.cross_paths.11',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'The steel floorplates in Sector Three flexed slightly beneath their boots as they met at the turn. Ashai stepped left to avoid a maintenance trolley parked against the conduit casing; Goaden mirrored her movement instinctively, stepping right to keep the passage clear. They exchanged a brief, unsmiling nod before continuing in opposite directions.'
});

add({
  id: 'domestic.cross_paths.12',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'An overhead fluorescent tube buzzed with a high-pitched whine, flickering twice as Ashai approached the central staircase. Goaden was already descending, his coat slung over his forearm. Their shoulders brushed in the narrow stairwell. Neither spoke, though Goaden’s pace slowed for half a heartbeat before he cleared the bottom landing.'
});

add({
  id: 'domestic.cross_paths.13',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'Ashai caught the heavy fire door with her shoulder as it began to swing shut, propping it open with her forearm. Goaden emerged from the archive corridor carrying a bundle of logbooks, slipping through the gap with an economy of motion. “Thanks,” he muttered. “Don’t let it slam,” she replied, letting the latch catch gently.'
});

add({
  id: 'domestic.cross_paths.14',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai', 'henderson'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'henderson', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'Henderson marched past them along the operations spine, clipboard tucked firmly under his arm. He barked a half-syllable greeting that belonged on a drill square without breaking stride. Ashai and Goaden paused by the water fountain until the sergeant’s heavy bootsteps faded down the east wing, then resumed their crossing in silence.'
});

add({
  id: 'domestic.cross_paths.15',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'They met outside the briefing room niche, where the air hummed with the cooling fans of the communications bank. Ashai was rolling down her sleeves; Goaden was adjusting the strap of his wristwatch. Their eyes met in the reflection of the glass noticeboard, held for two seconds, and parted without a word.'
});

add({
  id: 'domestic.cross_paths.16',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai', 'kartel'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'kartel', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'Kartel stepped out of the records store with an armful of manila requisition files, nearly colliding with Ashai at the blind corner. Goaden caught Kartel’s elbow to steady the stack before the folders slipped. “Watch the turn,” Goaden said mildly. Kartel grumbled his thanks and shuffled on toward logistics.'
});

add({
  id: 'domestic.cross_paths.17',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'Ashai tucked a loose strand of hair behind her ear as the lift doors rattled open on the second level. Goaden was waiting to step inside, hands shoved into his pockets. As she stepped off, their shoulders turned in unison to avoid contact in the narrow frame. The doors closed behind him with a dull rumble.'
});

add({
  id: 'domestic.cross_paths.18',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai', 'davis'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'davis', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'Davis came down the iron stairs two at a time, brushing past Goaden with a stiff, formal nod that acknowledged rank without offering warmth. Ashai stepped flat against the bulkhead to let him pass. Once his boots clicked onto the landing below, Goaden gave a quiet, dry scoff and continued his ascent.'
});

add({
  id: 'domestic.cross_paths.19',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'wax', 'goaden', 'ashai'],
  prose: 'The smell of fresh floor sealant and gun oil hung thick in the east transit tunnel. Their boots squeaked softly against the glossy grey coating as they crossed paths near the ventilation shaft. Ashai glanced down at the wet floor caution sign, then up at Goaden. “They’re redoing Sector Four,” she said. “About time,” he replied.'
});

add({
  id: 'domestic.cross_paths.20',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'cart', 'goaden', 'ashai'],
  prose: 'Both paused at the corridor T-junction as a two-wheeled battery cart whined past, laden with replacement hydraulic hoses. Ashai waited with her back against the grey brick wall. Goaden waited on the opposite side, arms crossed over his chest. Once the cart cleared the intersection, they stepped forward into each other’s wake.'
});

add({
  id: 'domestic.cross_paths.21',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'armoury', 'goaden', 'ashai'],
  prose: 'Outside the armoury grille, Goaden was adjusting the buckle on his shoulder webbing when Ashai turned the corner carrying a freshly laundered kit bag. She slowed her stride to give him room to secure the pin. He finished, gave the strap a sharp tug to test the tension, and stepped aside with a nod.'
});

add({
  id: 'domestic.cross_paths.22',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'draft', 'goaden', 'ashai'],
  prose: 'A sudden gust of cold London air rushed down the hallway as an exterior loading door opened at the far end of the tunnel. Ashai’s jacket flared around her knees. Goaden squinted against the grit carried on the draught, turning his shoulder to shield his face until they passed each other near the muster board.'
});

add({
  id: 'domestic.cross_paths.23',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'roster', 'goaden', 'ashai'],
  prose: 'Ashai stood by the glass-encased duty roster, checking the guard shift rotations for the third watch. Goaden walked past behind her, hands deep in his pockets, his gaze flicking to the paper over her shoulder for just long enough to confirm his own name before carrying on toward the briefing wing.'
});

add({
  id: 'domestic.cross_paths.24',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'cadence', 'goaden', 'ashai'],
  prose: 'Their footsteps fell into an accidental synchronization for five paces along the north corridor, boots striking the linoleum in a crisp, rhythmic double-time. Ashai broke the cadence by checking her pace near the water station. Goaden maintained his steady stride, neither acknowledging the brief coordination.'
});

add({
  id: 'domestic.cross_paths.25',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'doors', 'goaden', 'ashai'],
  prose: 'The heavy double doors of the canteen swung shut behind Ashai, cutting off the roar of lunch chatter in a clean, hydraulic sigh. Goaden was leaning against the opposite wall, checking the laces on his right combat boot. He straightened as she emerged, stepping into stride down the quiet corridor.'
});

add({
  id: 'domestic.cross_paths.26',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'radio', 'goaden', 'ashai'],
  prose: 'Passing the radio room, the faint rapid chatter of telegraph keys and the static whine of long-range receivers leaked through the acoustic seals. Ashai tilted her ear toward the door for half a second. Goaden walked past without turning his head, though his fingers tapped a quick five-count against his hip.'
});

add({
  id: 'domestic.cross_paths.27',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai', 'kai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'kai', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'Kai darted ahead of Goaden along the corridor floor, tiny talons clicking like dice against the polished tiles. Ashai sidestepped smoothly to avoid the little dragon’s scaly tail as he skidded around the corner into quarters. Goaden gave an exasperated sigh, murmuring a half-hearted apology as he passed.'
});

add({
  id: 'domestic.cross_paths.28',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'towel', 'goaden', 'ashai'],
  prose: 'Ashai was carrying a rolled towel toward the washrooms when she encountered Goaden emerging from the quartermaster’s hatch with a fresh pair of wool socks. He glanced at the towel, she glanced at the socks. “Hot water’s still running on the south side,” he said. “Good to know,” she replied.'
});

add({
  id: 'domestic.cross_paths.29',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'beacon', 'goaden', 'ashai'],
  prose: 'Crossing beneath an amber inspection beacon rotating slowly at the ceiling junction, the light painted their faces in rhythmic intervals of gold and shadow. Ashai paused to let Goaden step past a pile of discarded pipe lagging. He nodded once, the light catching his jaw before sliding off into the gloom.'
});

add({
  id: 'domestic.cross_paths.30',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai', 'greah'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'greah', 'corridor', 'mi6', 'goaden', 'ashai'],
  prose: 'Greah took off from Ashai’s shoulder with a quiet flutter of wings, skimming the low ceiling conduits to land on a junction box ahead. Goaden ducked slightly as the Guardian swept past his temple. “Show-off,” he muttered under his breath. Ashai reached the junction box and offered her arm without missing a step.'
});

add({
  id: 'domestic.cross_paths.31',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'clerk', 'goaden', 'ashai'],
  prose: 'A junior logistics clerk dropped a bundle of requisition manifests directly between them at the crossroads. Both Ashai and Goaden paused, stepping back to give the flustered young man room to gather his scattered papers. Once the walkway was clear, they stepped across the threshold without a backward glance.'
});

add({
  id: 'domestic.cross_paths.32',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'pipes', 'goaden', 'ashai'],
  prose: 'Steam pipes clustered low along the ceiling of the service tunnel, forcing both to duck their heads slightly as they crossed midway. Ashai’s shoulder grazed Goaden’s sleeve in the narrow passage. The warmth of the overhead lagged pipes was intense for three paces before the corridor widened back out into the muster lobby.'
});

add({
  id: 'domestic.cross_paths.33',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'doorframe', 'goaden', 'ashai'],
  prose: 'Goaden was leaning against the steel doorframe of Section Four, tapping his knuckle against the rivets in a steady rhythm. When Ashai turned into the corridor, he pushed off the frame and fell into step three paces behind her, keeping distance without breaking the unhurried tempo of their transit.'
});

add({
  id: 'domestic.cross_paths.34',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'handrail', 'goaden', 'ashai'],
  prose: 'The steel handrail beside the ramp vibrated from the massive ventilation fans running in the substructure. Ashai trailed two fingers along the cold metal as she climbed. Goaden came down the opposite side, his knuckles grazing the lower pipe. Their eyes met briefly in the middle of the incline, then moved on.'
});

add({
  id: 'domestic.cross_paths.35',
  family: 'domestic.cross_paths',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors', 'mi6/corridor'],
  trigger_family: 'CROSS_PATHS|ACTIVITY_COMPLETE',
  gate_note: 'Passing in transit. Neither actor commits a new destination or changes operational posture.',
  tags: ['domestic', 'cross_paths', 'corridor', 'mi6', 'noticeboard', 'goaden', 'ashai'],
  prose: 'They met before the glass case displaying the barracks orders. Ashai paused to read the notice concerning boiler maintenance; Goaden stepped up beside her, scanning the duty assignments with hands hooked in his belt. After five seconds of shared reading, Goaden gave a brief snort of dismissal and walked toward the mess.'
});

// ==========================================
// 5. TRAINING-END / RECOVERY MOMENTS (25 entries: .11 to .35)
// ==========================================

add({
  id: 'domestic.practice_end.11',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'wraps', 'goaden', 'ashai'],
  prose: 'Ashai sat on the low wooden equipment bench, unwinding her damp hand wraps loop by loop. The white cotton coiled loosely between her boots like shed skin. Goaden rested against the training pylon five feet away, wiping sweat from his forehead with the back of his forearm. The hydraulic relays in the floor hummed down to idle.'
});

add({
  id: 'domestic.practice_end.12',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'yard', 'goaden', 'ashai'],
  prose: 'The overhead target drones clicked back into their docking sockets along the ceiling rail, their guidance lights winking out in sequence. Ashai dropped her hands to her knees, breathing hard through her nose. Goaden shook out both arms, rolled his shoulders, and reached down to pick up his discarded canteen.'
});

add({
  id: 'domestic.practice_end.13',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'neck', 'water', 'goaden', 'ashai'],
  prose: 'Ashai rolled her neck until the vertebra popped with a sharp, satisfying crack. She uncapped an aluminium water canister and took three long, disciplined gulps before handing it across the mat. Goaden took it without a word, drank deeply, and wiped his mouth on his shoulder. The cold water smelled faintly of lime.'
});

add({
  id: 'domestic.practice_end.14',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'chalk', 'goaden', 'ashai'],
  prose: 'Goaden clapped his palms together over the wooden chalk bin, sending a small white cloud of fine powder puffing into the drafty air of the indoor yard. Ashai watched the motes settle onto the black rubber matting. “Three seconds faster on the transition,” she noted. Goaden wiped his dusty hands on his trousers. “Still sloppy.”'
});

add({
  id: 'domestic.practice_end.15',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'bars', 'goaden', 'ashai'],
  prose: 'Ashai sat on the bottom timber of the wall bars, elbows planted firmly on her thighs as she caught her breath. Across the yard, the ventilation louvres groaned open to evacuate the humid air, letting in the sharp, cold scent of London rain. Goaden kicked an errant rubber strike dummy back into its storage recess.'
});

add({
  id: 'domestic.practice_end.16',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'towel', 'goaden', 'ashai'],
  prose: 'A grey woollen towel hung draped across Goaden’s neck, steam rising in faint wisps from his cropped dark hair into the chilly drill hall. He leaned his back against the brick pillar, watching Ashai retie the laces of her right training boot. “Good session,” he offered quietly. She pulled the knot tight and stood up.'
});

add({
  id: 'domestic.practice_end.17',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai', 'greah'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'greah', 'training', 'goaden', 'ashai'],
  prose: 'Greah dropped from an overhead steel girder to inspect a scuffed vinyl strike pad on the mat, tilting her head to peck at an unraveled seam. Ashai scooped up the pad by its canvas strap, tucking it under her arm. “Leave it, Greah,” she murmured. The Guardian fluttered up to perch on her shoulder, ruffling her wing feathers.'
});

add({
  id: 'domestic.practice_end.18',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'guards', 'goaden', 'ashai'],
  prose: 'The rip of velcro sounded loud and sharp across the silent floor as Ashai peeled off her forearm guards. She stacked them neatly on the wooden bench, massaging the red pressure indentations left in her skin. Goaden walked past carrying two wooden practice staves, returning them to their wall clips with deliberate care.'
});

add({
  id: 'domestic.practice_end.19',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai', 'kai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'kai', 'training', 'goaden', 'ashai'],
  prose: 'Kai curled himself tightly around Goaden’s discarded leather kit bag, soaking up the heat radiating from the canvas. Ashai wiped her brow with the hem of her grey training shirt, watching the little dragon’s eyelids droop. “He worked harder than either of us,” she remarked. Goaden smiled faintly as he picked up his water bottle.'
});

add({
  id: 'domestic.practice_end.20',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'cleaning', 'goaden', 'ashai'],
  prose: 'Wiping down the heavy vinyl strike dummy with a damp rag, the clean, astringent scent of lemon disinfectant cut through the smell of sweat and rubber. Ashai wrung the rag out over the galvanized bucket. Goaden took the mop, running two broad strokes over the wet footprint marks near the door.'
});

add({
  id: 'domestic.practice_end.21',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'railing', 'goaden', 'ashai'],
  prose: 'They stood together by the perimeter railing of the indoor floor, looking down through the iron mesh at the darkened obstacle course below. Ashai’s chest rose and fell in steady rhythm. “Footwork was better,” Goaden noted after a minute. Ashai leaned against the rail, looking straight ahead. “It’ll do for today.”'
});

add({
  id: 'domestic.practice_end.22',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'wrist', 'goaden', 'ashai'],
  prose: 'Goaden rotated his right wrist in slow circles, listening to the soft tendon click before shaking out the fingers. Ashai tossed him a small tin of arnica balm from the first-aid locker. He caught it with his left hand, rubbed a dab into his knuckles, and tossed it back without needing to say a word.'
});

add({
  id: 'domestic.practice_end.23',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'hair', 'goaden', 'ashai'],
  prose: 'Ashai unclipped her hair tie, letting dark strands tumble down over her damp collar before gathering them back into a tighter knot. Goaden waited on the bench, zipping up his dark fleece jacket against the cooling air. When she finished securing the pin, they both stepped toward the changing room corridor.'
});

add({
  id: 'domestic.practice_end.24',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'roof', 'goaden', 'ashai'],
  prose: 'A sudden downpour clattered like gravel against the corrugated iron roof of the yard. Ashai picked up her canvas kit bag, hoisting it onto one shoulder. Goaden looked up at the dripping skylight seam where water had begun to collect in an iron channel. “Glad we moved indoors,” he remarked, heading for the exit.'
});

add({
  id: 'domestic.practice_end.25',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'daggers', 'goaden', 'ashai'],
  prose: 'Ashai replaced the two blunt wooden training daggers into their fitted felt slots on the equipment wall. Each blade clicked home with precision. Goaden checked the padlock on the weapon cabinet, slotted the brass key into his pocket, and turned off the bench lights with a flick of his wrist.'
});

add({
  id: 'domestic.practice_end.26',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'fountain', 'goaden', 'ashai'],
  prose: 'Goaden pressed his scraped knuckles against the chilled chrome rim of the drinking fountain, letting the icy water run over the red skin for ten seconds. Ashai stood behind him, waiting her turn with hands on her hips. When he stood up, he flicked the cold water from his hand and stepped aside.'
});

add({
  id: 'domestic.practice_end.27',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'gloves', 'goaden', 'ashai'],
  prose: 'Dropping her heavy leather sparring gloves into the wicker bin, the foam inside wheezed as it expanded back to its original shape. Ashai rubbed her sore thumbs, looking out over the empty mats. Goaden slung his towel over his shoulder, took one last look around the perimeter, and unlatched the exit door.'
});

add({
  id: 'domestic.practice_end.28',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'stretching', 'goaden', 'ashai'],
  prose: 'Ashai sat cross-legged on the blue mat, leaning forward into a long hamstring stretch with her forehead resting near her knees. Goaden leaned against the brick wall, watching the second hand sweep across the large wall clock. When two minutes elapsed, she sat back up, exhaled slowly, and reached for her boots.'
});

add({
  id: 'domestic.practice_end.29',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'showers', 'goaden', 'ashai'],
  prose: 'The rhythmic squeak of damp rubber soles against the sealed concrete walkway accompanied their walk toward the locker rooms. The humidity of the practice session began to dissipate into the colder corridor air. Ashai tucked her towel into her satchel, while Goaden unzipped his fleece to let the draft cool his neck.'
});

add({
  id: 'domestic.practice_end.30',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'louvres', 'goaden', 'ashai'],
  prose: 'A steady breeze entered through the high louvres, carrying the scent of soot and river damp. Ashai stood still for a moment, letting the draft dry the sweat at her temples. Goaden kicked the locker room door open with his heel, holding it with his shoulder until she walked through.'
});

add({
  id: 'domestic.practice_end.31',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'toss', 'goaden', 'ashai'],
  prose: 'Goaden tossed a spare clean sweatband across the width of the bench. Ashai caught it one-handed without shifting her gaze from her boots, slipping it over her wrist with practiced ease. “Shower queue will be three deep in ten minutes,” she noted. Goaden hoisted his gear bag without argument.'
});

add({
  id: 'domestic.practice_end.32',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'cones', 'goaden', 'ashai'],
  prose: 'Ashai gathered four orange rubber agility markers from the drill square, stacking them into a neat cylinder by the equipment bin. Goaden carried the marker poles over his shoulder, sliding them into the wall bracket with three sharp metallic thuds. They locked the storage cage together and stepped out.'
});

add({
  id: 'domestic.practice_end.33',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'ocular', 'goaden', 'ashai'],
  prose: 'Ashai touched the perimeter seal of her bionic eye casing with her fingertip, checking that no sweat had breached the optical gasket during the ground drills. Everything was dry and secure. Goaden watched her inspection from the doorway, waiting until she lowered her hand before turning to leave.'
});

add({
  id: 'domestic.practice_end.34',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'barefoot', 'goaden', 'ashai'],
  prose: 'Unlacing her heavy combat boots, Ashai stepped her stockinged feet onto the cool bare floorboards with an audible sigh of relief. Goaden dropped his shoes onto the bench, rubbing his arch with a knuckle. “Ten miles tomorrow if the weather clears,” he said. Ashai pulled on her clean socks. “I know.”'
});

add({
  id: 'domestic.practice_end.35',
  family: 'domestic.practice_end',
  cast: ['goaden', 'ashai'],
  location: ['mi6/training', 'mi6/indoor_yard'],
  trigger_family: 'PRACTICE_END|ACTIVITY_COMPLETE',
  gate_note: 'Immediately following training. Characters winding down, recovering breath, stowing equipment. No new injuries, rank advancements, or technique revelations.',
  tags: ['domestic', 'practice_end', 'training', 'floodlights', 'goaden', 'ashai'],
  prose: 'With a loud, metallic clunk, the main floodlights above the indoor floor extinguished, leaving only the amber perimeter nightlights to illuminate the empty matting. Ashai paused at the exit threshold, glancing back into the vast, shadowed hall. Goaden reached past her to pull the heavy steel latch shut.'
});

// ==========================================
// 6. QUIET / NIGHT / PIANO / TV ROUTINES (20 entries: .11 to .30)
// ==========================================

add({
  id: 'night.low_stakes.11',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/music_room', 'mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'music_room', 'piano', 'goaden', 'ashai'],
  prose: 'In the darkened music room, Goaden lifted the hinged mahogany fallboard of the upright piano. The brass hinges creaked softly in the quiet. He placed his thumb upon middle C, pressed down until the felt hammer kissed the brass string in a muted chime, and slowly lowered the lid back into place.'
});

add({
  id: 'night.low_stakes.12',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'common_room', 'television', 'goaden', 'ashai'],
  prose: 'The television screen in the deserted common room was tuned to an overnight news channel with the sound completely muted. Pale blue flickering light played over the cracked leather armchairs. Ashai sat on the armrest of the middle sofa, watching silent weather graphics scroll across a map of the British Isles.'
});

add({
  id: 'night.low_stakes.13',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'quarters', 'clock', 'goaden', 'ashai'],
  prose: 'A brass carriage clock on the mantelpiece ticked with steady, hollow precision in the small hours. Ashai leaned her forehead against the cool wallpaper of the quarters corridor, listening to the heartbeat of the building. Goaden passed carrying a glass of tap water, his footsteps silent on the wool carpet runner.'
});

add({
  id: 'night.low_stakes.14',
  family: 'night.low_stakes',
  cast: ['ashai', 'goaden'],
  location: ['mi6/common_room', 'mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'quarters', 'kettle', 'ashai', 'goaden'],
  prose: 'Ashai stood barefoot in the kitchenette nook off the common room, waiting for an old copper kettle to warm on the hotplate. Goaden appeared at the archway in a faded grey sweatshirt, leaned against the jamb, and waited without speaking until the steam hissed into the dark.'
});

add({
  id: 'night.low_stakes.15',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/music_room', 'mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'music_room', 'window', 'goaden', 'ashai'],
  prose: 'The tall windows of the music room looked out across sleeping London, where street lamps formed amber pools in the heavy night fog. The piano stood behind them, its dark wooden casing catching the city glow. Ashai watched a solitary patrol car crawl across Westminster Bridge. Goaden sat on the piano stool, silent.'
});

add({
  id: 'night.low_stakes.16',
  family: 'night.low_stakes',
  cast: ['goaden', 'kai'],
  location: ['mi6/quarters', 'mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'quarters', 'kai', 'goaden'],
  prose: 'Kai lay curled into a tight spiral on Goaden’s spare blanket, tiny wisps of cooling grey vapour puffing from his nostrils with each sleeping breath. Goaden sat at the small timber desk, cleaning the gears of his compass with an oiled rag under the yellow beam of a single desk lamp.'
});

add({
  id: 'night.low_stakes.17',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'common_room', 'broadcast', 'goaden', 'ashai'],
  prose: 'A silent broadcast of late-night shipping forecasts illuminated the common room walls in cool white. Ashai wrapped both hands around a warm ceramic mug, her feet tucked under her on the armchair. Goaden sat at the end of the long table, turning the pages of an engineering periodical with slow care.'
});

add({
  id: 'night.low_stakes.18',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/music_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'music_room', 'chords', 'goaden', 'ashai'],
  prose: 'Goaden depressed the soft pedal of the piano with his socked heel, pressing two low chords that resonated through the floorboards like distant thunder. He held the sustain until the sound dissolved into the ambient hum of the ventilation. Ashai remained leaning against the bookshelves, listening to the decay of the note.'
});

add({
  id: 'night.low_stakes.19',
  family: 'night.low_stakes',
  cast: ['ashai', 'goaden'],
  location: ['mi6/corridors', 'mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'corridor', 'windowsill', 'ashai', 'goaden'],
  prose: 'Ashai sat on the deep stone windowsill of the south corridor, knees drawn up to her chin, watching the distant blinking red beacon atop the Post Office Tower. Goaden walked by on his way from the archives, paused for two seconds to look out into the dark, and continued on.'
});

add({
  id: 'night.low_stakes.20',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'common_room', 'vending', 'goaden', 'ashai'],
  prose: 'The refrigeration unit of the common room vending machine kicked on with a low, mechanical shudder. Goaden dropped two coins into the slot, punched the button for sparkling water, and caught the metal can as it thudded into the tray. He handed it across to Ashai before taking a seat opposite.'
});

add({
  id: 'night.low_stakes.21',
  family: 'night.low_stakes',
  cast: ['ashai', 'greah'],
  location: ['mi6/music_room', 'mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'music_room', 'greah', 'ashai'],
  prose: 'Greah was asleep with her head tucked under her right wing, perched securely upon the top rail of the music room bookcase. Ashai walked quietly past in her woollen socks, carefully closing the door until the brass catch engaged without a sound, leaving the Guardian to her rest.'
});

add({
  id: 'night.low_stakes.22',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'common_room', 'documentary', 'goaden', 'ashai'],
  prose: 'A soundless documentary about Victorian bridge construction played across the television screen. Ashai watched the black-and-white photographs of ironworkers suspended over the river. Goaden leaned his head back against the cushion, eyes closed, listening to the faint rain ticking against the glass behind the drawn curtains.'
});

add({
  id: 'night.low_stakes.23',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/music_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'music_room', 'stand', 'goaden', 'ashai'],
  prose: 'Goaden straightened the brass music stand on the upright piano, carefully sliding a sheet of handwritten exercises into place. He didn’t play. He merely stood over the keys with hands resting lightly on the polished fallboard, letting the quiet of the empty room settle around his shoulders.'
});

add({
  id: 'night.low_stakes.24',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/corridors'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'corridor', 'nightlights', 'goaden', 'ashai'],
  prose: 'The long corridor was lit only by amber baseboard nightlights, casting soft pools of light across the carpet tiles. Ashai walked down the centreline, her shadow stretching long behind her. Goaden stepped out from the washroom archway, nod exchanged in the gloom, both returning to their quarters.'
});

add({
  id: 'night.low_stakes.25',
  family: 'night.low_stakes',
  cast: ['ashai', 'goaden'],
  location: ['mi6/common_room', 'mi6/corridors'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'common_room', 'water', 'ashai', 'goaden'],
  prose: 'Ashai drank cold water from a paper cup, leaning against the counter while the common room slept. Goaden came in, rinsed his tea mug under the tap with minimal splash, and set it upside down on the drying rack. “Still up?” he asked quietly. “Just turning in,” she answered.'
});

add({
  id: 'night.low_stakes.26',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/music_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'music_room', 'pedal', 'goaden', 'ashai'],
  prose: 'With the soft pedal depressed, Goaden played an open fifth that hung in the quiet room like a low bell. Ashai watched from the armchair by the door as the sound died away into silence. He took his hands off the keys and rested them on his knees.'
});

add({
  id: 'night.low_stakes.27',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'common_room', 'magazine', 'goaden', 'ashai'],
  prose: 'A stack of outdated logistics magazines slipped from the coffee table, sliding across the carpet with a soft, papery rustle. Ashai leaned down from the sofa and nudged them back into a neat pile with her heel. Goaden glanced up from his chair, nodded once, and returned to his reading.'
});

add({
  id: 'night.low_stakes.28',
  family: 'night.low_stakes',
  cast: ['ashai', 'goaden'],
  location: ['mi6/common_room', 'mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'common_room', 'steam', 'ashai', 'goaden'],
  prose: 'Steam from a fresh mug of chamomile tea fogged the small pane of the kitchen door. Ashai waited for the water to cool, blowing gently across the surface. Goaden walked past in the hallway, his silhouette briefly blocking the amber nightlight before disappearing toward the stairs.'
});

add({
  id: 'night.low_stakes.29',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/quarters', 'mi6/corridors'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'quarters', 'subway', 'goaden', 'ashai'],
  prose: 'A distant rumble traveled up through the bedrock of London as the last underground mail train traversed the deep tunnels beneath Whitehall. Ashai paused outside her door, feeling the vibration under her socks. Goaden glanced at the floorplates, recognized the familiar tremor, and turned his key in the lock.'
});

add({
  id: 'night.low_stakes.30',
  family: 'night.low_stakes',
  cast: ['goaden', 'ashai'],
  location: ['mi6/common_room', 'mi6/corridors'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|TV_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'After hours / small hours. Low sensory stimulation, routine domestic downtime. No nightmare visions or emergency alerts.',
  tags: ['night', 'common_room', 'switch', 'goaden', 'ashai'],
  prose: 'Goaden reached out and clicked off the main lamp in the common room, plunging the seating area into soft grey gloom. Only the LED standby light on the television screen remained, a single red dot in the dark. Ashai stepped out into the hallway, letting the heavy door latch shut.'
});

// ==========================================
// 7. YUKON / KAI / GREAH AMBIENT (15 entries: 5 + 5 + 5)
// ==========================================

// Yukon gaming (5 entries: .11 to .15)
add({
  id: 'domestic.yukon_game.11',
  family: 'domestic.yukon_game',
  cast: ['yukon', 'goaden'],
  location: ['mi6/gaming_room', 'mi6/common_room'],
  trigger_family: 'GAME_BEGIN|GAME_PAUSE|GAME_RESUME|ACTIVITY_COMPLETE',
  gate_note: 'Yukon gaming personality with Goaden in the room; lead co-present to satisfy selector requirement.',
  tags: ['domestic', 'gaming', 'yukon', 'goaden'],
  prose: 'Yukon leaned forward until his grey nose was six inches from the cathode-ray monitor, thumbs hammering the plastic buttons in a fury of rapid clicks. On screen, a pixelated mech tumbled into an abyss. Goaden sat on the sofa behind him, calmly stirring sugar into his mug without offering commentary.'
});

add({
  id: 'domestic.yukon_game.12',
  family: 'domestic.yukon_game',
  cast: ['yukon', 'goaden'],
  location: ['mi6/gaming_room', 'mi6/common_room'],
  trigger_family: 'GAME_BEGIN|GAME_PAUSE|GAME_RESUME|ACTIVITY_COMPLETE',
  gate_note: 'Yukon gaming personality with Goaden in the room; lead co-present to satisfy selector requirement.',
  tags: ['domestic', 'gaming', 'yukon', 'goaden'],
  prose: 'A brassy eight-bit victory fanfare trilled from the television speakers. Yukon spun around on his swivel stool, pointing an accusing grey claw at Goaden as though defying him to dispute the high score. Goaden raised his mug in a dry toast. “Fluke,” Goaden remarked. Yukon instantly restarted the level.'
});

add({
  id: 'domestic.yukon_game.13',
  family: 'domestic.yukon_game',
  cast: ['yukon', 'goaden'],
  location: ['mi6/gaming_room', 'mi6/common_room'],
  trigger_family: 'GAME_BEGIN|GAME_PAUSE|GAME_RESUME|ACTIVITY_COMPLETE',
  gate_note: 'Yukon gaming personality with Goaden in the room; lead co-present to satisfy selector requirement.',
  tags: ['domestic', 'gaming', 'yukon', 'goaden'],
  prose: 'Yukon slammed the pause button on the final boss encounter, his breathing ragged as he wiped sweaty grey palms on the knees of his combat fatigues. The screen pulsed with paused crimson lasers. Goaden turned a page of the operations manual, completely unruffled by the digital crisis unfolding two feet away.'
});

add({
  id: 'domestic.yukon_game.14',
  family: 'domestic.yukon_game',
  cast: ['yukon', 'goaden'],
  location: ['mi6/gaming_room', 'mi6/common_room'],
  trigger_family: 'GAME_BEGIN|GAME_PAUSE|GAME_RESUME|ACTIVITY_COMPLETE',
  gate_note: 'Yukon gaming personality with Goaden in the room; lead co-present to satisfy selector requirement.',
  tags: ['domestic', 'gaming', 'yukon', 'goaden'],
  prose: 'The black controller cord had wrapped itself twice around Yukon’s combat boot. Without taking his golden eyes off the descending airship on screen, he kicked his heel vigorously until the wire whipped free. Goaden caught the flying loop before it knocked over his water tumbler, sliding it aside with his toe.'
});

add({
  id: 'domestic.yukon_game.15',
  family: 'domestic.yukon_game',
  cast: ['yukon', 'goaden'],
  location: ['mi6/gaming_room', 'mi6/common_room'],
  trigger_family: 'GAME_BEGIN|GAME_PAUSE|GAME_RESUME|ACTIVITY_COMPLETE',
  gate_note: 'Yukon gaming personality with Goaden in the room; lead co-present to satisfy selector requirement.',
  tags: ['domestic', 'gaming', 'yukon', 'goaden'],
  prose: 'The words DEFEAT flashed across the CRT screen in jagged scarlet lettering. Yukon placed the controller onto the table with terrifying, slow-motion gentleness, folded his arms over his chest, and stared at the blank wall. Goaden took a sip of tea. “Left flank was wide open,” he observed. Yukon growled.'
});

// Goaden & Kai quiet (5 entries: .11 to .15)
add({
  id: 'domestic.goaden_kai.quiet.11',
  family: 'domestic.goaden_kai.quiet',
  cast: ['goaden', 'kai'],
  location: ['mi6/quarters', 'mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Goaden with Kai. Quiet observation, unhurried presence.',
  tags: ['domestic', 'quiet', 'goaden', 'kai', 'guardian'],
  prose: 'Kai balanced on the iron headboard of Goaden’s bunk, his dark wings half-spread to catch the rising warmth from the steam radiator below. Goaden sat on the edge of the mattress, pulling off his heavy socks one by one. The dragon let out a soft, warm churr that filled the quiet room.'
});

add({
  id: 'domestic.goaden_kai.quiet.12',
  family: 'domestic.goaden_kai.quiet',
  cast: ['goaden', 'kai'],
  location: ['mi6/quarters', 'mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Goaden with Kai. Quiet observation, unhurried presence.',
  tags: ['domestic', 'quiet', 'goaden', 'kai', 'guardian'],
  prose: 'Kai nudged Goaden’s forearm with his blunt, scaly snout until Goaden relented and scratched the ridged scales beneath the dragon’s chin. The small beast leaned heavily into the contact, eyes half-closed in bliss. Goaden kept up the steady rhythm for a minute before tapping Kai’s flank to signal bedtime.'
});

add({
  id: 'domestic.goaden_kai.quiet.13',
  family: 'domestic.goaden_kai.quiet',
  cast: ['goaden', 'kai'],
  location: ['mi6/quarters', 'mi6/music_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Goaden with Kai. Quiet observation, unhurried presence.',
  tags: ['domestic', 'quiet', 'goaden', 'kai', 'guardian'],
  prose: 'Goaden sat at the small quarters desk, polishing the brass bezel of his watch with a chamois cloth. Kai lay beside the lamp, watching the tiny reflection of the bulb gleam across the metal with unwavering golden pupils. Neither moved until the church bells outside struck the half hour.'
});

add({
  id: 'domestic.goaden_kai.quiet.14',
  family: 'domestic.goaden_kai.quiet',
  cast: ['goaden', 'kai'],
  location: ['mi6/quarters', 'mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Goaden with Kai. Quiet observation, unhurried presence.',
  tags: ['domestic', 'quiet', 'goaden', 'kai', 'guardian'],
  prose: 'Kai gave a sudden, muffled sneeze, a tiny orange spark popping against the linoleum before fading instantly to grey soot. Goaden looked down over the top of his newspaper, one eyebrow arched in reproof. The little dragon tucked his nose sheepishly under his wing and pretended to be asleep.'
});

add({
  id: 'domestic.goaden_kai.quiet.15',
  family: 'domestic.goaden_kai.quiet',
  cast: ['goaden', 'kai'],
  location: ['mi6/quarters', 'mi6/music_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Goaden with Kai. Quiet observation, unhurried presence.',
  tags: ['domestic', 'quiet', 'goaden', 'kai', 'guardian'],
  prose: 'Standing by the open window of the music room, Goaden let the cool night air wash over his face while Kai rested comfortably across his right shoulder. The dragon’s tail hung down Goaden’s back like a braided strap. Together they watched the rain drift across the dark roofs of Whitehall in silence.'
});

// Ashai & Greah quiet (5 entries: .11 to .15)
add({
  id: 'domestic.ashai_greah.quiet.11',
  family: 'domestic.ashai_greah.quiet',
  cast: ['ashai', 'greah'],
  location: ['mi6/quarters', 'mi6/common_room'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Ashai with Greah. Subtle watchful companionship, quiet moments.',
  tags: ['domestic', 'quiet', 'ashai', 'greah', 'guardian'],
  prose: 'Greah preened her glossy flight feathers while perched upon the corner of Ashai’s open logbook, taking meticulous care not to smudge the fresh black ink. Ashai sat back in her wooden chair, watching the Guardian’s rhythmic preening until her breathing settled into the same quiet cadence.'
});

add({
  id: 'domestic.ashai_greah.quiet.12',
  family: 'domestic.ashai_greah.quiet',
  cast: ['ashai', 'greah'],
  location: ['mi6/quarters', 'mi6/corridors'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Ashai with Greah. Subtle watchful companionship, quiet moments.',
  tags: ['domestic', 'quiet', 'ashai', 'greah', 'guardian'],
  prose: 'Ashai leaned her shoulder against the cool corridor brickwork, her eyes following the dust motes dancing in the late afternoon sunbeam. Greah hovered near her temple for five beats, tiny wings humming, before settling gently onto her collar. Neither made a sound as the shadows lengthened across the floor.'
});

add({
  id: 'domestic.ashai_greah.quiet.13',
  family: 'domestic.ashai_greah.quiet',
  cast: ['ashai', 'greah'],
  location: ['mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Ashai with Greah. Subtle watchful companionship, quiet moments.',
  tags: ['domestic', 'quiet', 'ashai', 'greah', 'guardian'],
  prose: 'Greah landed delicately on the porcelain rim of the washbasin while Ashai splashed cold tap water over her face. Ashai reached for a towel, patting her cheeks dry, and held out her index finger. Greah touched the tip of her beak to Ashai’s wet knuckle in a silent greeting.'
});

add({
  id: 'domestic.ashai_greah.quiet.14',
  family: 'domestic.ashai_greah.quiet',
  cast: ['ashai', 'greah'],
  location: ['mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Ashai with Greah. Subtle watchful companionship, quiet moments.',
  tags: ['domestic', 'quiet', 'ashai', 'greah', 'guardian'],
  prose: 'Ashai carefully untangled a stray blue woollen thread caught in Greah’s left claw. The little Guardian remained motionless, head cocked sideways, letting Ashai work the knot free with a needle tip. Once liberated, Greah gave a soft chirp and shook out her plumage.'
});

add({
  id: 'domestic.ashai_greah.quiet.15',
  family: 'domestic.ashai_greah.quiet',
  cast: ['ashai', 'greah'],
  location: ['mi6/quarters'],
  trigger_family: 'QUIET_TIME_BEGIN|REST_BEGIN|ACTIVITY_COMPLETE',
  gate_note: 'Ashai with Greah. Subtle watchful companionship, quiet moments.',
  tags: ['domestic', 'quiet', 'ashai', 'greah', 'guardian'],
  prose: 'Ashai sat on the edge of her cot with her hands folded loosely in her lap, staring at the grey skirting board. Greah fluttered down to the hollow of her collarbone, tucking her feet beneath warm feathers and closing her eyes. Ashai rested a finger against the Guardian’s flank and breathed.'
});

// ==========================================
// VALIDATION & COMPILATION
// ==========================================

console.log(`Generated ${entries.length} entries.`);
if (entries.length !== 165) {
  throw new Error(`Expected exactly 165 entries, but got ${entries.length}`);
}

// 1. Check word counts (40 - 110)
for (const e of entries) {
  const words = e.prose.split(/\s+/).filter(Boolean);
  if (words.length < 40 || words.length > 110) {
    throw new Error(`Entry ${e.id} word count out of bounds: ${words.length} words (must be 40-110).`);
  }
}

// 2. Check British English spelling
const americanisms = [
  /\bcolor\b/i, /\bcolors\b/i, /\bcolored\b/i,
  /\bgray\b/i, /\bgrays\b/i,
  /\bflavor\b/i, /\bflavors\b/i,
  /\bcenter\b/i, /\bcenters\b/i, // note: central is fine
  /\btheater\b/i, /\btheaters\b/i,
  /\bdefense\b/i, /\boffense\b/i,
  /\bhumor\b/i, /\brumor\b/i, /\bharbor\b/i
];
for (const e of entries) {
  for (const re of americanisms) {
    if (re.test(e.prose)) {
      throw new Error(`Entry ${e.id} contains un-British spelling matching ${re}: "${e.prose}"`);
    }
  }
}

// 3. Load Batch 01 texts to check for duplicates
const batch01Texts = SCENE_RESERVOIR_BATCHES.flatMap(b => b.entries.map(e => e.prose));
const normal = v => v.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const seen = new Set();
for (const t of batch01Texts) {
  seen.add(normal(t));
}

for (const e of entries) {
  const n = normal(e.prose);
  if (seen.has(n)) {
    throw new Error(`Duplicate prose detected for ${e.id}!`);
  }
  seen.add(n);
}

// 4. Check Jaccard similarity across new batch
function jaccard(a, b) {
  const sa = new Set(normal(a).split(' ')), sb = new Set(normal(b).split(' '));
  const common = [...sa].filter(x => sb.has(x)).length;
  return common / (sa.size + sb.size - common);
}

for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const sim = jaccard(entries[i].prose, entries[j].prose);
    if (sim > 0.75) {
      throw new Error(`Excessive similarity (${sim.toFixed(2)}) between ${entries[i].id} and ${entries[j].id}`);
    }
  }
}

const batchObject = {
  batch_id: 'reservoir-batch-02',
  status: 'staged',
  count: entries.length,
  effect_policy: 'surface_only',
  notes: [
    'Authored Batch 02 reusable surface_only scene reservoir entries.',
    'Covers Streamliner journeys (30), Sanctuary visits (25), MI6 lunch-hall moments (25), MI6 corridor cross-paths (25), training recovery (25), night/piano/TV routines (20), and Yukon gaming/Kai/Greah ambient moments (15).',
    'All entries remain strictly staged pending creator review. Zero simulation or runtime code modified.'
  ],
  entries
};

// 5. Test with normalizeReservoirBatch
const others = SCENE_RESERVOIR_BATCHES.filter(b => b.batch_id !== batchObject.batch_id);
const normResult = normalizeReservoirBatch(batchObject, {
  existingIds: others.flatMap(b => b.entries.map(e => e.id)),
  existingTexts: others.flatMap(b => b.entries.map(e => e.prose))
});

console.log('normalizeReservoirBatch report:', normResult.report);
if (normResult.report.rejected > 0) {
  console.error('Rejections:', normResult.report.rows.filter(r => r.status === 'rejected'));
  throw new Error(`Batch 02 had ${normResult.report.rejected} rejections!`);
}

// Write to data/scene-reservoir-batch-02.json
const outputPath = resolve('data/scene-reservoir-batch-02.json');
writeFileSync(outputPath, JSON.stringify(batchObject, null, 2) + '\n', 'utf8');
console.log(`Successfully wrote ${entries.length} validated entries to ${outputPath}`);
