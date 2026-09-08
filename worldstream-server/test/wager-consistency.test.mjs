import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { openWorld } from '../src/world.mjs';
import { DEFAULT_SEED } from '../src/fixture.mjs';
import { atLondon, nextLondonDay } from '../src/time.mjs';
import { detectWagerForEvent, resolveWagerFromEvents } from '../src/wagers.mjs';

// Two presentation defects, both spotted by a reader watching the page rather
// than by any test:
//
//   "the café outing displays a Sanctuary-specific prediction"
//   "a return outcome is shown while they're still at the café"
//
// Measured after the report, the first was worse than described: forty of forty
// arrangements got "Will the planned Sanctuary visit proceed without
// disruption?", including a meal in the lunch hall and a game with Yukon. The
// second was structural — the winner was written when the wager was created and
// the store resolved on the closing bell, so every prediction announced a guess
// as a result, sometimes for an afternoon still in progress.
//
// Both are the same failure underneath: the page asserting things about the
// world without asking it.

function world(t, days = 40) {
  const directory = mkdtempSync(join(tmpdir(), 'silver-clouds-wager-'));
  const store = openWorld({ dbPath: join(directory, 'w.sqlite'), seed: DEFAULT_SEED, startMs: atLondon('2026-09-04', '00:00') });
  t.after(() => {
    store.close();
    const resolved = realpathSync(directory);
    if (dirname(resolved) !== realpathSync(tmpdir()) || !basename(resolved).startsWith('silver-clouds-wager-')) {
      throw new Error(`Refusing unexpected cleanup target: ${resolved}`);
    }
    rmSync(resolved, { recursive: true, force: true });
  });
  let end = '2026-09-04';
  for (let index = 0; index < days; index++) end = nextLondonDay(end);
  store.advance(atLondon(end, '00:00'));
  return store.semanticSnapshot();
}

test('a prediction is about the outing it is attached to', t => {
  const snapshot = world(t);
  const announcements = snapshot.events.filter(event =>
    event.type === 'ANNOUNCE_ARRANGEMENT' && event.visibility === 'public');
  assert.ok(announcements.length > 20, `expected a real sample, saw ${announcements.length}`);

  let asked = 0;
  for (const event of announcements) {
    const wager = detectWagerForEvent({ ...event, description: event.publicDescription }, snapshot, event.occurredAt);
    if (!wager) continue;
    asked++;
    const text = `${wager.question} ${wager.options.map(option => option.text).join(' ')}`;
    // The venue in the question has to be the venue in the announcement.
    for (const [venue, tell] of [['Silver Spoon', /Silver Spoon|Cafe/i], ['Enchanted Ink', /Ink/i],
      ['Chimes of Renewal', /Chimes|New Big Ben/i]]) {
      if (!tell.test(event.publicDescription)) continue;
      assert.doesNotMatch(text, /Sanctuary/i,
        `a ${venue} outing was asked a Sanctuary question: ${wager.question}`);
    }
    // And an arrangement with no outing in it gets no outing question at all.
    if (/arranged a meal|play together later|gaming room/i.test(event.publicDescription)) {
      assert.fail(`an indoor arrangement was given an outing wager: ${wager.question}`);
    }
  }
  assert.ok(asked > 5, `expected some outings to be asked about, saw ${asked}`);
});

test('a prediction never announces an outcome the world has not reached', t => {
  const snapshot = world(t);
  const announcements = snapshot.events.filter(event =>
    event.type === 'ANNOUNCE_ARRANGEMENT' && event.visibility === 'public');

  let checked = 0;
  for (const event of announcements) {
    const wager = detectWagerForEvent({ ...event, description: event.publicDescription }, snapshot, event.occurredAt);
    if (!wager) continue;
    checked++;
    // Nothing is decided at the moment of asking.
    assert.equal(wager.winningOptionId, null, 'a wager knew its own answer before the afternoon happened');
    // Nor at the closing bell, if the world has not said yet. The published
    // ledger up to that instant is all the resolver is allowed to read.
    const atClose = snapshot.events.filter(item =>
      item.visibility === 'public' && item.occurredAt <= wager.closesAt)
      .map(item => ({ ...item, description: item.publicDescription }));
    const early = resolveWagerFromEvents(wager, atClose);
    if (early) {
      const decided = atClose.some(item => ['OUTING_CUT_SHORT', 'PLAN_BROKEN'].includes(item.type)
        || (item.type === 'TRAVEL_ARRIVE' && /returned to MI6/i.test(item.description ?? '')));
      assert.ok(decided,
        `"${wager.question}" resolved to ${early} before anything in the world settled it`);
    }
  }
  assert.ok(checked > 5, `expected a real sample, saw ${checked}`);
});

test('an outing that was cut short does not resolve as one that went well', t => {
  const snapshot = world(t);
  const cut = snapshot.events.find(event => event.type === 'OUTING_CUT_SHORT');
  assert.ok(cut, 'expected the world to have interrupted an afternoon at least once');
  const wager = {
    question: 'Do they get the whole hour at the Silver Spoon?', createdAt: cut.occurredAt - 3600_000,
    options: [{ id: 'opt_whole', text: 'x' }, { id: 'opt_recall', text: 'y' }, { id: 'opt_company', text: 'z' }],
  };
  assert.equal(resolveWagerFromEvents(wager, [{ ...cut, description: cut.publicDescription }]), 'opt_recall');
});
