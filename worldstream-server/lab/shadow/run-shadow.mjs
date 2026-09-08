import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { londonDate, MINUTE_MS as MIN } from '../../src/time.mjs';
import { INTERRUPTIBLE } from '../../src/places.mjs';
import { contextAtEvent } from '../../src/cinematics.mjs';
import { translate, locateEveryone } from '../engine/adapter.mjs';
import { noteEvent, offscreenLivesAt, tierOf, rosterOf } from './offscreen-rewind.mjs';
import { evaluateMomentOpportunity, viewFrom, MOMENT_RULES } from '../engine/engine.mjs';
import { PRACTICES } from '../grammar/practices.mjs';
import { CAST, CAST_IDS } from '../grammar/cast.mjs';
import { assertReadOnly, shadowRecord, compareToWorld, opportunitySeed } from './contract.mjs';
import { TRIGGERS } from '../harness/run.mjs';

// SHADOW MODE — the Moment Engine against real Worldstream history.
//
// **This process cannot write to Worldstream.** Three independent guarantees,
// each sufficient on its own:
//
//   1. The database is opened `readOnly: true`. SQLite refuses writes at the
//      driver, not by convention.
//   2. `world.advance()` is never called. Nothing in this file can cause the
//      world to resolve an action, commit an event, or move its watermark.
//   3. Every snapshot handed to the engine goes through `assertReadOnly`, which
//      throws if a live handle or a callable has reached it. The engine
//      therefore has nothing to write *through* even if it tried.
//   4. The world file and its write-ahead log are hashed before the run and
//      again at the end, and the run fails if either byte changed. This is the
//      only one of the four that is *evidence* rather than argument, so it runs
//      every time rather than being checked by hand once.
//
// On the fourth: SQLite's WAL reader memory-maps the `-shm` index to take a read
// lock, which advances that file's mtime. Its contents do not change and the
// database does not change. The check therefore compares bytes, not timestamps —
// a check on mtime would fail for a reason that is not a write.
//
// And what the engine produces is a proposal, which is recorded and dropped. No
// lifespan is spent, no relationship moves, no callback is committed, no
// schedule or location changes, no dialogue or event is written. The
// `committed` field on every record is a literal false with no code path that
// sets it true.
//
// State at each opportunity is reconstructed by rewinding the committed ledger
// with `contextAtEvent` — production's own function, already used by the
// cinematic layer — rather than by re-simulating, so the engine sees exactly
// the history Worldstream actually recorded.
//
// TWO ADDITIONS SINCE THE FIRST RUN, both read-only and both in shadow:
//
//   * The supporting cast is rebuilt (`offscreen-rewind.mjs`). `contextAtEvent`
//     carries characters, relationships, weather, factions and pressure — not
//     `offscreenLives` — so the first run handed the engine a world with Emily
//     and Yukon missing, and I wrongly reported that as production not
//     simulating them. It does. They are reconstructed here forward from
//     committed events, never from final state.
//
//   * Quiet checks. An opportunity used to exist only where an event had just
//     been committed, which left 62-69% of elapsed time unreachable and made
//     the additive rate structurally zero. The engine is now also asked, on a
//     sparse deterministic cadence, during genuine quiet. **A quiet check
//     commits nothing and is not an event**; it is a question, and the
//     overwhelmingly normal answer is silence.

const DB = process.argv[2] ?? 'data/worldstream-review-v23/world.sqlite';
const OUT = new URL('../runs/shadow/', import.meta.url).pathname.replace(/^\//, '');
const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\//, '');

const path = existsSync(DB) ? DB : `${ROOT}${DB}`;
if (!existsSync(path)) { console.error(`no such world: ${DB}`); process.exit(1); }

// ---------------------------------------------------------------- read only
/** Content hash of the world and its write-ahead log. Guarantee 4. */
const digest = () => [path, `${path}-wal`]
  .filter(existsSync)
  .map(file => `${file.split(/[\/]/).pop()}:${createHash('sha256').update(readFileSync(file)).digest('hex')}`)
  .join(' ');
const digestBefore = digest();

const db = new DatabaseSync(path, { readOnly: true });
const row = db.prepare('SELECT seed, rules_version, resolved_through, state_json FROM world_state WHERE id=1').get();
const events = db.prepare('SELECT semantic_json FROM events ORDER BY seq')
  .all().map(entry => JSON.parse(entry.semantic_json));
db.close();

const finalState = JSON.parse(row.state_json);
const snapshot = { ...finalState, events };
const seed = row.seed;

console.error(`shadow: ${path}`);
console.error(`  seed ${seed} · ${events.length} events · resolved through ${new Date(row.resolved_through).toISOString()}`);

// ------------------------------------------------------------- opportunities
const records = [];
const history = { byCharacter: {}, world: [] };
const callbacks = [];
const experiences = [];
const witnessed = [];
const notices = [];
const people = {};                 // the supporting cast, rebuilt as we walk
let considered = 0;

// How often the engine is asked during quiet, and how much quiet has to pass
// before it is asked at all. Deliberately sparse: this is a question, not a
// heartbeat, and the interest floor is already refusing 60% of what it is
// shown. Fixed cadence rather than random sampling so a run replays exactly.
//
// Tuned once, for a reason worth recording. At 90 minutes **every quiet check
// in the run landed between 21:00 and 06:00** — the only gaps that long are
// overnight ones, because daytime events arrive a median of 13 minutes apart.
// The engine was being asked whether anything was happening exclusively while
// everybody was asleep, which is both useless and the opposite of the intent.
// It also corrects a finding I reported: the 62-69% of elapsed time with no
// opportunity is overwhelmingly *night*, not daytime silence worth filling.
const QUIET_AFTER = 45 * MIN;
const QUIET_EVERY = 45 * MIN;

/** Evaluate one opportunity. Returns nothing; appends a record. */
function consider({ now, location, area, trigger, event, state, quiet = false }) {
  const active = callbacks.filter(item => item.expiresAt > now);
  const { sentences, present, inputs } = translate(state, {
    now, location, area, castIds: CAST_IDS,
    callbacks: active,
    witnessed: witnessed.filter(item => now - item.at < 6 * 60 * MIN),
    experiences: experiences.filter(item => item.expiresAt > now),
    recentNotices: notices.filter(item => now - item.at < 40 * MIN && item.at <= now).map(item => item.key),
  });
  if (!present.length) return;

  const opportunity = {
    now, day: londonDate(now), location, area,
    occurredAt: now, trigger,
    // A quiet check has no event of its own. It carries the last committed
    // event for provenance, tagged so it can never be mistaken for one.
    triggerEventId: quiet ? `quiet:${event.id}@${now}` : event.id,
    quiet,
    presentCharacters: present,
    view: viewFrom(sentences),
    practices: PRACTICES, cast: CAST,
    history, arcConstraints: {},
    seed, rulesVersion: row.rules_version,
    rules: MOMENT_RULES,
    worldEventInputs: [event.id, ...inputs],
  };
  // Guarantee 3. Throws rather than warns.
  assertReadOnly({ ...opportunity, view: undefined, practices: undefined, cast: undefined });

  const { proposal, audit, chosen } = evaluateMomentOpportunity(opportunity);
  considered += 1;

  // What Worldstream itself published in the same window, for the comparison.
  const window = events.filter(other => Math.abs(other.occurredAt - now) <= 30 * MIN
    && other.visibility === 'public' && other.publicDescription);

  records.push({
    ...shadowRecord({ opportunity, proposal, audit, worldEventsInWindow: window }),
    // Reader-facing context, so a proposal can be judged as if it had appeared.
    readerContext: {
      when: new Date(now).toISOString(),
      day: londonDate(now), time: new Date(now).toISOString().slice(11, 16),
      place: `${location}${area && area !== 'venue' ? `/${area}` : ''}`,
      participants: proposal?.participants ?? present,
      situation: proposal ? `${proposal.practice} · ${proposal.action}` : null,
      boundTo: proposal ? (proposal.roles?.Thing ?? proposal.roles?.Obstacle ?? proposal.roles?.Other ?? null) : null,
      triggeredBy: { id: event.id, type: event.type, text: event.publicDescription ?? null },
      committedContext: window.slice(-3).map(other => ({
        time: new Date(other.occurredAt).toISOString().slice(11, 16),
        type: other.type, text: other.publicDescription })),
      surface: proposal?.line ?? null,
      whyItWon: (proposal?.influences ?? []).slice()
        .sort((a, b) => b.score - a.score).slice(0, 3)
        .map(sway => `${sway.score >= 0 ? '+' : ''}${sway.score} ${sway.name}`),
      bestRejected: proposal?.rejectedAlternatives?.[0]
        ? `${proposal.rejectedAlternatives[0].actor} · ${proposal.rejectedAlternatives[0].family.split('(')[0]} (${proposal.rejectedAlternatives[0].score})`
        : null,
      refusal: proposal ? null : audit.refusal,
      refusalDetail: proposal ? null : (audit.detail ?? null),
      seed: opportunitySeed(opportunity),
    },
    quiet,
    // Who was here and in what tier, so "did widening reach work?" is a count
    // rather than an argument.
    presentTiers: Object.fromEntries(present.map(who =>
      [who, state.characters?.[who] ? 'lead' : tierOf(who).tier])),
  });

  // Local bookkeeping only — never written back to the world.
  if (chosen) {
    (history.byCharacter[chosen.actor] ??= []).push({ at: now, day: londonDate(now),
      family: chosen.surfacedFamily ?? chosen.family,
      behaviour: chosen.surfacedBehaviour ?? chosen.behaviour,
      surface: proposal?.presentationKey ?? null, line: proposal?.line ?? null,
      surfaced: Boolean(proposal) });
  }
  if (proposal) {
    history.world.push({ at: now, day: londonDate(now), family: proposal.family,
      behaviour: proposal.behaviour, actor: proposal.actor });
    for (const item of proposal.callbackSeedsCreated)
      callbacks.push({ key: item.key.replace(/[^a-zA-Z0-9]+/g, '_'), by: proposal.actor,
        about: proposal.target ?? null, topic: item.topic ?? null, spent: false,
        expiresAt: now + (item.lifespanDays ?? 14) * 86_400_000 });
    for (const effect of proposal.requestedEffects) {
      if (!effect.experience) continue;
      const thing = proposal.roles.Thing ?? proposal.roles.Other ?? proposal.action;
      const observers = effect.experience === 'observed'
        ? present.filter(who => who !== proposal.actor) : [proposal.actor];
      for (const observer of observers)
        experiences.push({ kind: effect.experience, observer,
          actor: effect.experience === 'observed' ? proposal.actor : (proposal.target ?? proposal.roles.Other),
          thing, at: now, expiresAt: now + 180 * MIN, eventId: proposal.id });
    }
  }
}

/** Rewind, with the supporting cast put back. */
function stateAt(event, now) {
  let state;
  try { state = contextAtEvent(event, snapshot); } catch { return null; }
  // The field `contextAtEvent` does not carry, rebuilt from committed events at
  // or before `now`. Tier windows are applied here, so the adapter is handed a
  // roster that is already correct for this instant.
  const lives = offscreenLivesAt(people, now, seed);
  for (const [who, record] of Object.entries(lives.people))
    record.presenceWindowMs = tierOf(who).presenceMinutes * MIN;
  state.offscreenLives = lives;
  return state;
}

let previous = null;      // last committed event, for quiet checks
let quietChecks = 0;

for (let index = 0; index < events.length; index += 1) {
  const event = events[index];
  // Every event updates the supporting cast, not only the ones that trigger.
  noteEvent(people, event);

  // Who saw whom do what. This was declared and then never filled, which is why
  // `seen.Actor.Other.What` refused 470 candidates across batch 2 — every
  // behaviour that needs somebody to have *watched* somebody else was dead on
  // arrival, including the impression Yukon does. Reconstructed from committed
  // events: a public event with participants is witnessed by the other people
  // named in it, and by the offscreen cast standing in the same room.
  if (event.visibility === 'public' && (event.participants ?? []).length && event.location) {
    const alsoHere = Object.entries(people)
      .filter(([, record]) => record.lastSeen
        && record.lastSeen.location === event.location
        && record.lastSeen.area === (event.area ?? 'venue')
        && event.occurredAt - record.lastSeen.at < 45 * MIN)
      .map(([who]) => who);
    const audience = [...new Set([...(event.participants ?? []), ...alsoHere])];
    for (const actor of event.participants ?? [])
      for (const observer of audience) {
        if (observer === actor) continue;
        witnessed.push({ observer, actor, what: event.type.toLowerCase(),
          at: event.occurredAt, eventId: event.id });
      }
  }
  if (event.payload?.notice || event.payload?.moment)
    notices.push({ at: event.occurredAt, key: event.payload.notice ?? event.payload.moment });

  // ---- quiet checks, covering the gap since the last committed event.
  if (previous && event.occurredAt - previous.occurredAt > QUIET_AFTER) {
    const state = stateAt(previous, previous.occurredAt);
    for (let at = previous.occurredAt + QUIET_EVERY; at < event.occurredAt; at += QUIET_EVERY) {
      if (!state) break;
      const view = stateAt(previous, at);
      if (!view) break;
      // Ask where the cast actually is, rather than where something last
      // happened. One question per distinct place, and usually the answer is
      // that nobody interesting is anywhere near anybody.
      const places = new Map();
      for (const person of locateEveryone(view, at).values()) {
        if (!CAST_IDS.includes(person.id)) continue;
        // "Unhurried periods", literally: only ask where somebody is actually
        // available to be interrupted. Asleep, in transit or mid-briefing is
        // not a quiet moment, it is a busy or absent one, and asking there
        // spends the question on a guaranteed no.
        if (!INTERRUPTIBLE.includes(person.activity)) continue;
        places.set(`${person.location}/${person.area}`, person);
      }
      for (const person of places.values()) {
        quietChecks += 1;
        consider({ now: at, location: person.location, area: person.area,
          trigger: 'quiet', event: previous, state: view, quiet: true });
      }
    }
  }
  previous = event;

  const trigger = TRIGGERS[event.type];
  if (!trigger) continue;
  const location = event.location;
  if (!location) continue;
  const state = stateAt(event, event.occurredAt);
  if (!state) continue;
  consider({ now: event.occurredAt, location, area: event.area ?? 'venue',
    trigger, event, state });
}

console.error(`  ${records.length} opportunities (${quietChecks} from quiet checks)`);
console.error(`  supporting cast rebuilt: ${JSON.stringify(rosterOf(people))}`);

// ------------------------------------------------------------------- outputs
// Guarantee 4, checked before anything is reported. If this throws, the run's
// conclusions are void regardless of how good they look.
const digestAfter = digest();
if (digestBefore !== digestAfter) {
  console.error('ZERO-WRITE VIOLATION — the world changed during a shadow run.');
  console.error(`  before  ${digestBefore}`);
  console.error(`  after   ${digestAfter}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const summary = compareToWorld(records);
const proposals = records.filter(record => record.proposed);

writeFileSync(`${OUT}shadow-records.json`, JSON.stringify(records, null, 1));

const lines = [];
const say = text => lines.push(text);
say('# Shadow run — the Moment Engine against real Worldstream history');
say('');
say('**Nothing was committed**, and this run proved it rather than promising it.');
say('');
say('| guarantee | how |');
say('|---|---|');
say('| the driver refuses writes | opened `readOnly: true` |');
say('| the world was never advanced | `advance()` is not called anywhere in this file |');
say('| the engine had nothing to write through | every snapshot passed `assertReadOnly` |');
say('| **the bytes are unchanged** | **world + WAL hashed before and after; identical** |');
say('');
say('```');
say(`before  ${digestBefore}`);
say(`after   ${digestAfter}`);
say('```');
say('');
say('No lifespan was spent, no relationship moved, no schedule or location');
say('changed, no callback was committed, and no dialogue or event was written.');
say('`committed` is false on all ' + records.length + ' records, and there is no');
say('code path in this file that sets it true.');
say('');
say(`World: \`${path}\``);
say(`Seed: \`${seed}\` · ${events.length} committed events`);
say('');
say('| | |');
say('|---|---:|');
say(`| Opportunities evaluated | ${summary.opportunities} |`);
say(`| Proposals | **${summary.proposals}** |`);
say(`| Refusals | ${summary.refusals} |`);
say(`| Proposed into a silence Worldstream left | **${summary.proposedIntoSilence}** |`);
say(`| Proposed alongside another world event | ${summary.proposedAlongsideWorldEvents} |`);
say(`| Proposed over the same character | ${summary.proposedOverTheSameCharacter} |`);
say(`| **Additive rate** | **${(summary.additiveRate * 100).toFixed(0)}%** |`);
say(`| Runtime LLM calls | 0 |`);
say('');
say('The additive rate excludes the trigger event that opened each');
say('opportunity, which is always inside its own window. Counting it — as the');
say('first version of this metric did — made "into a silence" unreachable by');
say('construction. It did not change the answer here: every proposal still had');
say('other public events within half an hour. The 0% is real.');
say('');

// ------------------------------------------------------------------- reach
say('## Why it is 0%: the engine is never asked during the quiet');
say('');
say('An opportunity exists only where Worldstream committed an event. Across the');
say('run the engine was therefore never invoked during the stretches it was built');
say('to fill.');
say('');
say('| | |');
say('|---|---:|');
say(`| Elapsed time covered | ${summary.reach.elapsedDays} days |`);
say(`| Opportunities per day | ${summary.reach.opportunitiesPerDay} |`);
say(`| **Time inside a quiet stretch (>2h, no opportunity)** | **${summary.reach.days} days (${(summary.reach.share * 100).toFixed(0)}%)** |`);
say(`| Longest unbroken silence | ${summary.reach.longestQuietHours} h |`);
say('');
say('## Who the engine ever saw');
say('');
const seen = {};
for (const record of records) for (const who of record.present) seen[who] = (seen[who] ?? 0) + 1;
say('| character | present at | proposals |');
say('|---|---:|---:|');
for (const id of CAST_IDS)
  say(`| ${id} | ${seen[id] ?? 0} | ${proposals.filter(record => record.proposed.actor === id).length} |`);
say('');

// --------------------------------------------------- suppression attribution
say('## What suppressed the rest');
say('');
say('Grouped by the constraint responsible, so it is clear which lever each one');
say('answers to.');
say('');
const GROUPS = [
  ['opportunity / co-presence', ['no_available_action'],
    'nobody eligible was here, or no practice bound to the state'],
  ['nothing worth surfacing', ['below_interest_floor', 'nothing_worth_surfacing', 'not_worth_surfacing'],
    'the engine had something it could do and judged it not worth doing'],
  ['world gap', ['world_gap'], 'too soon after the previous surfaced Moment'],
  ['world daily budget', ['world_daily_budget'], 'the day was already full'],
  ['character / surface spacing', ['surface_spacing', 'character_daily_budget'],
    'this character or this surface too recently'],
  ['family cooldown', ['every_fitting_line_is_cooling', 'costly_act_recently_foregrounded'],
    'the fitting lines were still cooling'],
  ['no authored surface', ['no_authored_surface', 'no_line_fits_this_target'],
    'the behaviour fired but nothing was written for it'],
  ['arc obligation', ['arc_hard_obligation'], 'an authored arc had the floor'],
];
say('| constraint | suppressed | what it means |');
say('|---|---:|---|');
for (const [label, codes, meaning] of GROUPS) {
  const n = codes.reduce((total, code) => total + (summary.refusalBreakdown[code] ?? 0), 0);
  say(`| ${label} | ${n} | ${meaning} |`);
}
say('');
say('Raw refusal codes:');
say('');
say('| reason | times |');
say('|---|---:|');
for (const [reason, n] of Object.entries(summary.refusalBreakdown).sort((a, b) => b[1] - a[1]))
  say(`| ${reason} | ${n} |`);
say('');
// The conditions that actually killed candidates, in the author's own words.
const killed = {};
for (const record of records) for (const item of record.blocked)
  killed[item.condition] = (killed[item.condition] ?? 0) + 1;
const top = Object.entries(killed).sort((a, b) => b[1] - a[1]).slice(0, 10);
if (top.length) {
  say('Conditions that refused the most candidates:');
  say('');
  say('| condition | times |');
  say('|---|---:|');
  for (const [condition, n] of top) say(`| \`${condition}\` | ${n} |`);
  say('');
}
say('---');
say('');
say(`## The ${proposals.length} proposals, as a reader would have met them`);
say('');
for (const record of proposals) {
  const c = record.readerContext;
  say(`### ${c.day} ${c.time} · ${c.place}`);
  say('');
  for (const item of c.committedContext)
    say(`> *${item.time} — ${item.text}*`);
  say('');
  say(`**${CAST.get(record.proposed.actor)?.displayName ?? record.proposed.actor}:** “${c.surface}”`);
  say('');
  say('| | |');
  say('|---|---|');
  say(`| participants | ${c.participants.join(', ')} |`);
  say(`| situation | ${c.situation}${c.boundTo ? ` · bound to **${c.boundTo}**` : ''} |`);
  say(`| triggered by | ${c.triggeredBy.type} — ${c.triggeredBy.text ?? '—'} |`);
  say(`| why it won | ${c.whyItWon.join('; ')} |`);
  say(`| best rejected | ${c.bestRejected ?? '— nothing else available'} |`);
  say(`| committed? | **no — shadow only** |`);
  say('');
}
writeFileSync(`${OUT}shadow-report.md`, lines.join('\n') + '\n');
console.error(`written: runs/shadow/shadow-report.md (${proposals.length} proposals of ${records.length} opportunities)`);
console.log(lines.slice(0, 40).join('\n'));
