import { writeFileSync, mkdirSync } from 'node:fs';
import { runWorld } from '../harness/run.mjs';
import { bankDepth, satisfiableRequirements } from './grammar-io.mjs';
import { CAST } from '../grammar/cast.mjs';
import { PRACTICES } from '../grammar/practices.mjs';

// A surface belongs to specific actions. Joining on "any action of this
// character" produced a table claiming Ashai's callback banks were blocked by
// "does not count things", which is the top blocker for a different action
// entirely. The index below is the fix.
const ACTIONS_BY_SURFACE = new Map();
for (const practice of PRACTICES.values())
  for (const action of practice.actions) {
    const base = action.surface ?? action.id;
    const entry = ACTIONS_BY_SURFACE.get(base) ?? [];
    entry.push(action.id);
    ACTIONS_BY_SURFACE.set(base, entry);
  }
// `surfaceBy` splits one surface into several banks (callback_line:coat_…),
// all of which belong to the same action.
const actionsFor = surface => ACTIONS_BY_SURFACE.get(surface)
  ?? ACTIONS_BY_SURFACE.get(surface.split(':')[0]) ?? [];

// TRACK B — which families are empirically under-supplied.
//
// **Candidate targets, not approved authoring targets.** Approval comes from
// the 18-Moment review, which may well say a family is fine and a different one
// is starving.
//
// A family qualifies as a candidate only on evidence. Three distinct symptoms,
// each meaning something different:
//
//   STARVED    it fires, and runs out of fresh wording. Deepening it converts
//              directly into fresh Moments. The highest-value target.
//   DEAD-END   it is authored but the action can never fire. Authoring more
//              here is *wasted* — the fix is upstream, in the practice or the
//              adapter. The most important thing to know before spending an hour.
//   UNREACHED  it could fire but its situation never occurred. This is an
//              opportunity problem, not an authoring one — Director territory.

const run = runWorld({ days: 90, collectAudits: true });
const depth = bankDepth({ satisfiable: satisfiableRequirements() });

// How often a surface was wanted but had nothing fresh or fitting left.
const starvation = new Map();
for (const audit of run.audits) {
  if (!audit.refusal) continue;
  const key = audit.detail?.surface ? `${audit.detail.actor}:${audit.detail.surface}` : null;
  if (!key) continue;
  if (!['every_fitting_line_is_cooling', 'no_line_fits_this_target',
    'surface_spacing', 'no_authored_surface'].includes(audit.refusal)) continue;
  const bucket = starvation.get(key) ?? {};
  bucket[audit.refusal] = (bucket[audit.refusal] ?? 0) + 1;
  starvation.set(key, bucket);
}

// Which actions were ever chosen at all, and which never got past a condition.
const chosen = new Set(run.actions.map(a => `${a.actor}:${a.action}`));
const surfaced = new Set(run.moments.map(m => `${m.actor}:${m.action}`));
const blockedWhy = new Map();
for (const audit of run.audits)
  for (const item of audit.blocked ?? []) {
    const key = `${item.actor}:${item.action}`;
    const bucket = blockedWhy.get(key) ?? new Map();
    bucket.set(item.reason, (bucket.get(item.reason) ?? 0) + 1);
    blockedWhy.set(key, bucket);
  }

// Structurally unreachable: an action whose only blocker is a fact the adapter
// never carries forward between opportunities.
const NEVER_CARRIED = ['the other person is not visibly doing anything',
  'has not been asked anything'];

const rows = [];
for (const row of depth) {
  const key = `${row.character}:${row.surface}`;
  const starved = starvation.get(key) ?? {};
  const starvedTotal = Object.values(starved).reduce((a, b) => a + b, 0);
  const moments = run.moments.filter(m => m.actor === row.character && m.presentationKey === row.surface).length;
  rows.push({ ...row, key, moments, starvedTotal, starved });
}

const lines = [];
const say = t => lines.push(t);
say('# Studio candidate targets — evidence only, not approved');
say('');
say('Computed from the frozen v2 90-day run. **These are candidates.** The');
say('18-Moment review decides which are approved, and it may well name a family');
say('that does not appear here.');
say('');

say('## STARVED — fires, then runs out of fresh wording');
say('');
say('Deepening these converts directly into fresh Moments. Highest value.');
say('');
say('| character | surface | authored | effective | Moments | times wanted but starved | breakdown |');
say('|---|---|---:|---:|---:|---:|---|');
for (const row of rows.filter(r => r.starvedTotal > 0).sort((a, b) => b.starvedTotal - a.starvedTotal))
  say(`| ${row.character} | \`${row.surface}\` | ${row.authored} | ${row.effectiveDepth} | ${row.moments} | **${row.starvedTotal}** | ${Object.entries(row.starved).map(([k, v]) => `${k} ${v}×`).join(', ')} |`);
say('');

say('## DEAD-END — authored, but the action can never fire');
say('');
say('**Authoring more of these is wasted.** The fix is upstream: these actions');
say('depend on a fact the adapter never carries between opportunities, so their');
say('precondition can never be true. See TRACK-C-findings.md, finding (a).');
say('');
say('| character | surface | lines authored | action | blocked by | times |');
say('|---|---|---:|---|---|---:|');
let deadLines = 0;
const deadKeys = new Set();
for (const row of rows) {
  if (row.moments > 0 || row.authored === 0) continue;
  for (const action of actionsFor(row.surface)) {
    const reasons = blockedWhy.get(`${row.character}:${action}`);
    if (!reasons) continue;
    const dead = [...reasons].find(([reason]) => NEVER_CARRIED.includes(reason));
    if (!dead) continue;
    deadLines += row.authored;
    deadKeys.add(row.key);
    say(`| ${row.character} | \`${row.surface}\` | ${row.authored} | \`${action}\` | ${dead[0]} | ${dead[1]}× |`);
  }
}
say('');
say(`**${deadLines} authored lines sit behind actions that cannot currently fire.**`);
say('');

say('## UNREACHED — could fire, situation never occurred');
say('');
say('Opportunity problem, not an authoring one. Director territory.');
say('');
say('| character | surface | lines authored | action | top blocker | times |');
say('|---|---|---:|---|---|---:|');
for (const row of rows) {
  if (row.moments > 0 || row.authored === 0 || deadKeys.has(row.key)) continue;
  const candidates = actionsFor(row.surface)
    .map(action => [action, blockedWhy.get(`${row.character}:${action}`)])
    .filter(([, reasons]) => reasons);
  if (!candidates.length) {
    say(`| ${row.character} | \`${row.surface}\` | ${row.authored} | — | never evaluated | — |`);
    continue;
  }
  for (const [action, reasons] of candidates) {
    const top = [...reasons].sort((a, b) => b[1] - a[1])[0];
    say(`| ${row.character} | \`${row.surface}\` | ${row.authored} | \`${action}\` | ${top[0]} | ${top[1]}× |`);
  }
}
say('');

say('## Bank depth, all surfaces');
say('');
say('| character | surface | authored | effective | signature | filler | Moments |');
say('|---|---|---:|---:|---:|---:|---:|');
for (const row of rows.sort((a, b) => a.character.localeCompare(b.character) || a.surface.localeCompare(b.surface)))
  say(`| ${row.character} | ${row.surface} | ${row.authored} | ${row.effectiveDepth} | ${row.signature} | ${row.filler} | ${row.moments} |`);
say('');

mkdirSync('runs/studio', { recursive: true });
writeFileSync('runs/studio/candidate-targets.md', lines.join('\n') + '\n');
console.log(lines.slice(0, 40).join('\n'));
console.error('\nwritten: runs/studio/candidate-targets.md');
