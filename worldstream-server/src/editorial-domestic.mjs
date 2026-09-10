import { createHash } from 'node:crypto';
import { daypart } from './sky.mjs';
import { isShelterWeather } from './fixture.mjs';

// Ordinary life, given a voice.
//
// The world commits roughly fifty public events a day, and the ordinary ones —
// meals, practice, cross-paths, rest, piano, games, weather — had no editor
// claiming them at all. They fell to the catch-all, which polishes the one-line
// description and returns no prose by design, so about twenty publishable state
// changes a day could not become story because nothing was registered to
// narrate them. This fills that hole.
//
// It is surface only. It reads a committed event and returns text. It cannot
// create an event, arrange a meeting, decide an outcome, move a relationship,
// grant knowledge or change a single fact. If every function here returned null
// the world would run identically and the feed would read as it did before.
//
// Three rules keep it from turning the world into a diary:
//
//   1. It narrates only what the event already says. Every name, place and room
//      below comes off the committed event; nothing is inferred and nothing is
//      invented.
//   2. Not everything is narrated. Admission is semantic rather than a flat
//      dice roll — two people crossing paths is inherently a beat, the third
//      meal of a quiet day is not. Where a family still needs thinning, `share`
//      thins it deterministically.
//   3. Nothing is narrated twice. An activity merely continuing is left alone,
//      the principle `editorial-lives.mjs` already applies to the offscreen layer.
//
// Selection is stable from committed event identity, so a reader refreshing, a
// second viewer arriving, or the same seed replayed all produce the same prose.
//
// The variant banks here are deliberately modest. They remove the four-hour
// silences; they do not pretend to be the scene reservoir. Getting exact-sentence
// repeats into single digits over a 30-day audit needs authored surfaces, not a
// larger hand-written switch.

const NAMES = Object.freeze({ goaden: 'Goaden', ashai: 'Ashai', yukon: 'Yukon',
  greah: 'Greah', davis: 'Davis', henderson: 'Henderson', emily: 'Emily' });
const PLACES = Object.freeze({ mi6: 'MI6', sanctuary: 'Sanctuary', cafe: 'the Silver Spoon',
  enchanted_ink: 'Enchanted Ink', big_ben_plaza: 'the plaza', streamliner: 'the Streamliner' });

const named = who => NAMES[who] ?? null;
const cast = event => (event.participants ?? []).map(named).filter(Boolean);
const both = event => ['goaden', 'ashai'].every(id => event.participants?.includes(id));
const listed = people => people.length > 1
  ? `${people.slice(0, -1).join(', ')} and ${people.at(-1)}` : people[0] ?? null;

/** Deterministic from the event itself, never from when it is read. */
const roll = (event, salt) => createHash('sha256')
  .update(`silver-clouds-domestic-v1|${salt}|${event.id}|${event.type}`).digest().readUInt32BE(0);
const choose = (event, choices) => choices[roll(event, 'pick') % choices.length];
/** Admit `numerator` in `denominator` of a family, stably. */
const share = (event, numerator, denominator) => roll(event, 'share') % denominator < numerator;

// An activity carrying on is not news. The world marks these on the payload;
// where it does not, a continuation carries no fresh consequence and the
// canonical line already stands in the ledger.
const continuing = event => Boolean(event.payload?.continuing ?? event.payload?.resumed
  ?? event.routineContinuation);

export function domesticEditorial(event) {
  if (event?.visibility !== 'public' || !event.publicDescription || !event.id) return null;
  if (continuing(event)) return null;
  const prose = write(event);
  return prose ? { description: event.publicDescription, prose } : null;
}

function write(event) {
  const who = listed(cast(event));
  const where = PLACES[event.location] ?? null;
  const room = typeof event.room === 'string' && event.room ? event.room : null;
  const when = Number.isSafeInteger(event.occurredAt) ? daypart(event.occurredAt) : null;

  switch (event.type) {
    // Two people arriving in the same place without arranging it is a beat by
    // definition. This family is never thinned.
    case 'CROSS_PATHS':
      return who && choose(event, [
        `${who} arrived at the same place from different directions, which happens more often than either of them admits.`,
        `Neither of them had planned to be there at the same time. ${who} were, and neither made anything of it.`,
        `${who} crossed in the doorway. It cost them a minute they had not set aside, and neither seemed to mind.`,
        `They met without meaning to. ${who} fell into step as though the afternoon had arranged it for them.`,
        `${who} passed each other going opposite ways, stopped, and went the same way instead.`,
        `The corridor put ${who} in the same place at the same time. Nobody had asked it to.`,
        `${who} ended up walking together for no better reason than direction.`,
        `Two sets of footsteps became one conversation. ${who}, briefly, on the way to elsewhere.`,
        `${who} found each other in passing. It lasted the length of a landing and was none the worse for it.`,
      ]);

    // An ending carries a result; a beginning carries only an intention.
    case 'PRACTICE_END':
      return who && choose(event, [
        `${who} finished, and stood for a moment in the quiet that comes after effort.`,
        `The session ended when it had run out of anything left to prove. ${who} stopped.`,
        `${who} called it. Whatever had been worked at was, for today, worked at enough.`,
        `It finished the way these things finish: not resolved, only put down. ${who} left the floor.`,
        `${who} stopped short of the point where tiredness starts making the decisions.`,
        `They were done. ${who} took the long way back, which is its own kind of cooling off.`,
        `${who} finished without ceremony and without saying how it had gone.`,
        `The work ended. What it had been for stayed where ${who} had left it.`,
      ]);
    case 'PRACTICE_BEGIN':
      return who && share(event, 1, 4) ? choose(event, [
        `${who} began without much ceremony, the way people do when the work is habit rather than occasion.`,
        `${who} started. The first few minutes were only finding the shape of it again.`,
        `${who} went down to it early, before anyone else wanted the floor.`,
      ]) : null;

    // A meal is worth a passage at the ends of a day. The middle of a quiet
    // afternoon is where a diary would over-narrate.
    case 'MEAL_BEGIN': {
      if (!who) return null;
      const edges = when === 'morning' || when === 'evening' || when === 'night';
      if (!edges && !share(event, 1, 5)) return null;
      if (when === 'morning') return choose(event, [
        `${who} ate early, before the building had properly decided it was awake.`,
        `Breakfast was quiet. ${who} took it without much conversation, which was its own kind of company.`,
        `${who} ate standing, half ready for the day, the way mornings here usually go.`,
        `The first meal of the day passed almost without comment. ${who} were glad of it.`,
        `${who} started the day with something hot and not much talking.`,
      ]);
      if (both(event)) return choose(event, [
        `${who} ate together${room ? ` in ${room}` : ''}. Neither of them filled the silence, and it did not need filling.`,
        `They took the same table again. ${who} have worn a habit into that hour without either of them naming it.`,
        `${who} sat down to eat and talked about nothing that mattered, at length.`,
        `The meal took longer than it needed to. ${who} did not appear to be in any hurry about it.`,
        `${who} ate opposite one another${room ? ` in ${room}` : ''}, trading the odd remark, mostly not.`,
        `Whatever else the day had been, ${who} sat down to the end of it together.`,
      ]);
      return choose(event, [
        `${who} stopped to eat${where ? ` at ${where}` : ''}. It was the first pause in some hours.`,
        `${who} ate, unhurried, with nothing else demanding the next few minutes.`,
        `Somewhere in the middle of it all ${who} remembered to eat.`,
        `${who} took the meal late and alone, which suited the shape of the day.`,
      ]);
    }

    case 'REST_BEGIN':
    case 'QUIET_TIME_BEGIN':
      return who && share(event, 1, 2) ? choose(event, [
        `${who} stopped for a while. Not tiredness exactly — the kind of pause a day asks for around now.`,
        `${who} put the day down for a bit${room ? `, ${room} being as good a place as any` : ''}.`,
        `Nothing happened for a while, and ${who} let it.`,
        `${who} sat with nothing particular to do and did not seem troubled by it.`,
        `The hour went quiet. ${who} let it stay that way.`,
        `${who} rested, in the ordinary sense — not recovering from anything, just stopping.`,
      ]) : null;

    // Music and games are character rather than incident: narrated often, never
    // every time.
    case 'PIANO_BEGIN':
      return who && share(event, 2, 3) ? choose(event, [
        `${who} played, badly and without apology, which is the only way it ever gets played.`,
        `The piano started up${where ? ` at ${where}` : ''}. ${who} did not appear to be performing for anyone.`,
        `${who} sat down to it. Whatever was being worked out was not being worked out in words.`,
        `A few bars, a stop, the same few bars again. ${who} were in no rush to get it right.`,
        `${who} played until the piece ran out of wherever it had been going.`,
      ]) : null;
    case 'GAME_BEGIN':
    case 'TV_BEGIN':
    case 'MUSIC_LISTEN_BEGIN':
      return who && share(event, 1, 2) ? choose(event, [
        `${who} settled into something undemanding, which after the sort of day it had been was the point.`,
        `${who} found an hour that did not need to be useful.`,
        `${who} gave the evening over to something that asked nothing of them.`,
        `Whatever it was, ${who} were not really watching it, and that was fine.`,
      ]) : null;

    // Weather earns prose only where it changes what people can do. A sky that
    // merely looks different is a line in the conditions panel, not a passage.
    case 'WEATHER_CHANGE':
      return isShelterWeather(event.payload?.weatherCode) ? choose(event, [
        `The weather closed the outdoor yard. Whatever had been planned for it moved indoors, and the morning rearranged itself around that.`,
        `It came down hard enough to shut the yard. The building absorbed the change without comment, as it usually does.`,
        `The yard was closed before anyone had to be told. Training went inside and stayed there.`,
      ]) : null;

    default: return null;
  }
}
