// Explicit, local author verification. Never opens a live or legacy save.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { openWorld, semanticDigest } from '../src/world.mjs';
import { DEFAULT_SEED, RULES_VERSION, publicEvents, publicProjection } from '../src/fixture.mjs';
import { AGENDA_FAMILIES } from '../src/faction-agendas.mjs';
import { fatigueAt } from '../src/abilities.mjs';
import { atLondon } from '../src/time.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = join(root, 'artifacts', `final-phases-${stamp}`);
mkdirSync(output, { recursive: true });
const json = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n');
const london = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'medium' });
const cell = value => String(value ?? '').replaceAll('|', '/').replaceAll('\n', ' ');
const table = (headers, rows) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`
  + rows.map(row => `| ${row.map(cell).join(' | ')} |`).join('\n') + '\n';
const counts = (rows, key) => Object.fromEntries([...rows.reduce((map, row) => {
  const value = key(row) ?? 'unspecified'; map.set(value, (map.get(value) ?? 0) + 1); return map;
}, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))));

async function coreVerification() {
  let stdout = '', stderr = '';
  const child = spawn(process.execPath, [join(root, 'src/run-verification.mjs')], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { stdout += chunk; process.stdout.write(chunk); });
  child.stderr.on('data', chunk => { stderr += chunk; process.stderr.write(chunk); });
  const status = await new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', resolve);
  });
  writeFileSync(join(output, 'core-verification.stdout.txt'), stdout);
  writeFileSync(join(output, 'core-verification.stderr.txt'), stderr);
  assert.equal(status, 0, 'Existing A–E verification failed; see captured output');
  const summaryAt = stdout.lastIndexOf('{\n  "result": "PASS"');
  assert.ok(summaryAt >= 0, 'Core runner did not report its artifact directory');
  const summary = JSON.parse(stdout.slice(summaryAt));
  const comparisonPath = join(summary.output, 'comparison.json');
  const comparison = JSON.parse(readFileSync(comparisonPath, 'utf8'));
  const baseline = JSON.parse(readFileSync(join(summary.output, 'A-frequent', 'semantic-snapshot-private.json'), 'utf8'));
  assert.equal(comparison.result, 'PASS');
  assert.equal(baseline.world.rulesVersion, RULES_VERSION, 'Core evidence uses a different rules release');
  assert.equal(comparison.variants.length, 5);
  assert.equal(new Set(comparison.variants.map(row => row.digest)).size, 1);
  return { artifactDirectory: summary.output, comparisonPath, rulesVersion: baseline.world.rulesVersion,
    result: comparison.result, startMs: comparison.startMs, endMs: comparison.endMs,
    variants: comparison.variants, benchmark: comparison.benchmark };
}

function inspect(snapshot, publicView, publicLedger) {
  const events = snapshot.events, now = snapshot.world.resolvedThrough;
  const byId = new Map(events.map(event => [event.id, event]));
  const visible = events.filter(event => event.visibility === 'public' && event.publicDescription);
  const violations = [];
  const fail = (kind, details) => violations.push({ kind, ...details });
  if (byId.size !== events.length) fail('duplicate_event_ids', {});
  if (new Set(snapshot.pendingActions.map(action => action.id)).size !== snapshot.pendingActions.length)
    fail('duplicate_pending_action_ids', {});
  const sourceIssues = [];
  for (const event of events) for (const sourceId of event.causedBy ?? []) {
    if (sourceId.startsWith('canon-seed:')) continue;
    const source = byId.get(sourceId);
    if (!source || source.seq >= event.seq || source.occurredAt > event.occurredAt)
      sourceIssues.push({ eventId: event.id, sourceId, reason: source ? 'not_earlier' : 'missing' });
  }
  for (const issue of sourceIssues) fail('invalid_causal_source', issue);
  const requiredStart = { INK_APPOINTMENT_COMPLETED: 'INK_APPOINTMENT_STARTED',
    INTENT_COMPLETE: 'INTENT_START', GROUND_WORK_COMPLETED: 'GROUND_WORK_OPPORTUNITY',
    GROUND_PREPARED: 'GROUND_PREPARATION', AGENDA_RESOLVE: 'AGENDA_OPERATION_START',
    AGENDA_DEADLINE: 'AGENDA_OPERATION_START' };
  const orphanCompletions = visible.filter(event => requiredStart[event.type]
    && !(event.causedBy ?? []).some(id => byId.get(id)?.type === requiredStart[event.type]))
    .map(event => ({ eventId: event.id, type: event.type, requiredStartType: requiredStart[event.type] }));
  for (const issue of orphanCompletions) fail('orphan_completion', issue);
  for (const action of snapshot.pendingActions) if (action.dueAt <= now)
    fail('overdue_pending_action', { actionId: action.id, dueAt: action.dueAt });

  let checkedMemories = 0;
  for (const actor of Object.values(snapshot.characters)) for (const memory of actor.knowledge) {
    checkedMemories++;
    if (memory.provenance === 'canon_seed' && memory.sourceEventId.startsWith('canon-seed:')) continue;
    const source = byId.get(memory.sourceEventId), acquisition = byId.get(memory.acquisitionEventId);
    if (!source || !acquisition || source.occurredAt > memory.learnedAt || source.seq > acquisition.seq
      || acquisition.occurredAt !== memory.learnedAt || memory.learnedAt > now)
      fail('invalid_character_knowledge_time', { actor: actor.id, factKey: memory.factKey,
        sourceEventId: memory.sourceEventId, acquisitionEventId: memory.acquisitionEventId });
  }
  const intents = Object.values(snapshot.intent.instances), operations = Object.values(snapshot.agendas.operations);
  const ground = snapshot.abilities.trainingGround, ink = snapshot.storyEffects.ink;
  const activeIntents = intents.filter(item => ['offered', 'renegotiating', 'reserved', 'started', 'interrupting'].includes(item.status));
  const activeInk = Object.values(ink.appointments).filter(item => ['booked', 'in_progress'].includes(item.status));
  for (const item of [...activeIntents, ...activeInk]) if (item.endAt <= now)
    fail('overdue_active_reservation', { id: item.id, status: item.status, endAt: item.endAt });
  for (const operation of operations) if (operation.status === 'active' && operation.deadlineAt <= now)
    fail('overdue_active_operation', { id: operation.id, deadlineAt: operation.deadlineAt });
  for (const [kind, item] of [['work', ground.work], ['preparation', ground.preparation]])
    if (item?.status === 'in_progress' && item.endsAt <= now) fail('overdue_ground_activity', { kind, endsAt: item.endsAt });

  // Projection assertions inspect allowlisted public values, not the private report itself.
  for (const key of ['facts', 'knowledge', 'abilities', 'agendas', 'intent', 'pendingActions'])
    if (key in publicView) fail('raw_state_in_public_projection', { key });
  for (const event of publicLedger) {
    if (byId.get(event.id)?.visibility !== 'public') fail('private_event_in_projection', { eventId: event.id });
    for (const key of ['payload', 'changes', 'causedBy', 'knowledge', 'privateDecision', 'token'])
      if (key in event) fail('raw_event_field_in_projection', { eventId: event.id, key });
  }
  const publicText = JSON.stringify({ publicView, publicLedger });
  for (const item of [...intents, ...operations, ...activeInk]) if (item.token && publicText.includes(item.token))
    fail('ownership_token_in_public_projection', { id: item.id });
  if (publicLedger.length !== visible.length) fail('public_ledger_count_differs', {});

  const phaseEvents = visible.filter(event => /^(INTENT_|AGENDA_|GROUND_)/.test(event.type));
  const repetition = field => {
    const entries = new Map();
    for (const event of visible) if (typeof event[field] === 'string' && event[field].trim()) {
      const text = event[field].replace(/\s+/g, ' ').trim();
      if (!entries.has(text)) entries.set(text, { text, count: 0, types: new Set(), firstEventId: event.id, lastEventId: event.id });
      const item = entries.get(text); item.count++; item.types.add(event.type); item.lastEventId = event.id;
    }
    const repeated = [...entries.values()].filter(row => row.count > 1).sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
    return { uniqueTexts: entries.size, repeatedTexts: repeated.length,
      extraOccurrences: repeated.reduce((total, row) => total + row.count - 1, 0),
      mostRepeated: repeated.slice(0, 20).map(row => ({ ...row, types: [...row.types] })) };
  };
  const agendaEnds = visible.filter(event => ['AGENDA_RESOLVE', 'AGENDA_DEADLINE'].includes(event.type));
  const observedFamilies = counts(visible.filter(event => event.type === 'AGENDA_OPERATION_START'), event => event.payload.family);
  return { violations, eventCounts: { total: events.length, public: visible.length, private: events.length - visible.length,
    byType: counts(events, event => event.type), publicByType: counts(visible, event => event.type) },
    intent: { initiativesByRequester: counts(intents, item => item.requester), proposedActivities: counts(intents, item => item.proposed),
      selectedActivities: counts(intents.filter(item => item.selected), item => item.selected), outcomes: counts(intents, item => item.status),
      privateMotiveCountsAuthorOnly: counts(intents.filter(item => item.privateDecision), item => item.privateDecision.motive),
      responses: counts(visible.filter(event => ['INTENT_RESPONSE', 'INTENT_RENEGOTIATE'].includes(event.type)), event => event.payload.status) },
    agendas: { families: observedFamilies, outcomes: counts(agendaEnds, event => event.payload.outcome),
      resourcesAtEnd: snapshot.agendas.resources, lastResult: snapshot.agendas.lastResult },
    ground: { restrictions: visible.filter(event => event.type === 'GROUND_RESTRICTION').length,
      prepared: visible.filter(event => event.type === 'GROUND_PREPARED').length,
      started: visible.filter(event => event.type === 'GROUND_WORK_OPPORTUNITY' && event.payload.method !== 'sheltered_wait').length,
      interrupted: visible.filter(event => event.type === 'GROUND_WORK_INTERRUPTED').length,
      completed: visible.filter(event => event.type === 'GROUND_WORK_COMPLETED').length,
      weatherDeferrals: visible.filter(event => event.payload?.outcome === 'weather_deferred').length,
      statusAtEnd: ground.status, restrictionSince: ground.restriction?.since ?? null, lastClearEventId: ground.lastClearEventId,
      fatigueAtEnd: Object.fromEntries(['goaden', 'ashai'].map(who => [who, fatigueAt(snapshot, who, now)])) },
    pendingWork: { actions: snapshot.pendingActions.length, byType: counts(snapshot.pendingActions, action => action.type),
      nextDueAt: snapshot.pendingActions[0]?.dueAt ?? null, activeIntents, activeInk,
      activeOperations: operations.filter(item => item.status === 'active'), ground: { status: ground.status, work: ground.work, preparation: ground.preparation } },
    prose: { publicParagraphs: visible.filter(event => event.prose).length,
      proseRegisterEvents: visible.filter(event => event.register === 'prose').length,
      authoredLineScenes: visible.filter(event => event.payload?.lines?.length).length,
      phase3To5Paragraphs: phaseEvents.filter(event => event.prose).length,
      byType: counts(visible.filter(event => event.prose), event => event.type) },
    repetition: { descriptions: repetition('publicDescription'), prose: repetition('prose'),
      interpretation: 'Repeated authored text is a pacing diagnostic, not a determinism failure.' },
    causalIntegrity: { invalidSources: sourceIssues, orphanCompletions, checkedMemories,
      staleOrRefusedCompletionActions: events.filter(event => /(?:COMPLETE|COMPLETED|PREPARED)$/.test(event.type) && event.payload?.outcome === 'skipped').length },
    coverage: { unobservedAgendaFamilies: AGENDA_FAMILIES.filter(family => !observedFamilies[family]),
      unobservedAgendaOutcomes: ['cleared', 'followup_required', 'unverified'].filter(outcome => !agendaEnds.some(event => event.payload.outcome === outcome)),
      note: 'This is one honest seeded fortnight, not a search for every branch. Unobserved branches require the focused tests; no outcome quota manufactures history.' } };
}

try {
  const core = await coreVerification();
  const startMs = atLondon('2026-09-04', '00:00'), endMs = atLondon('2026-09-18', '00:00');
  const world = openWorld({ dbPath: join(output, 'author-world.sqlite'), seed: DEFAULT_SEED, startMs });
  let snapshot, publicView, publicLedger, advance, elapsedMs, readsUnchanged;
  try {
    const before = performance.now(); advance = world.advance(endMs); elapsedMs = performance.now() - before;
    snapshot = world.semanticSnapshot(); publicView = world.publicProjection(); publicLedger = publicEvents(snapshot, Infinity);
    assert.deepEqual(publicView, publicProjection(snapshot), 'Bounded presentation differs from full audit projection');
    const digest = semanticDigest(snapshot);
    for (let n = 0; n < 5; n++) { world.publicProjection(); world.publicHistory(); }
    readsUnchanged = semanticDigest(world.semanticSnapshot()) === digest;
  } finally { world.close(); }
  const diagnostics = inspect(snapshot, publicView, publicLedger);
  if (!readsUnchanged) diagnostics.violations.push({ kind: 'repeat_reads_changed_history' });
  const report = { result: diagnostics.violations.length ? 'FAIL' : 'PASS', rulesVersion: RULES_VERSION,
    output, generatedAt: new Date().toISOString(), core,
    authorRun: { seed: DEFAULT_SEED, startMs, endMs, fictionalDays: 14, processedActions: advance.processedActions,
      elapsedMs, measurement: 'One 14-day advance and SQLite commit; excludes creation, projections, audit checks and close.',
      digest: semanticDigest(snapshot), repeatReadsUnchanged: readsUnchanged }, diagnostics,
    sourceHashes: Object.fromEntries(['fixture', 'intent', 'faction-agendas', 'abilities', 'prose', 'cinematics', 'service-world', 'world-operations', 'world-runner']
      .map(name => [`src/${name}.mjs`, createHash('sha256').update(readFileSync(join(root, 'src', `${name}.mjs`))).digest('hex')])) };
  json('semantic-snapshot-private.json', snapshot);
  json('public-projection.json', publicView);
  json('public-event-ledger.json', publicLedger);
  json('final-comparison.json', report);
  writeFileSync(join(output, 'author-event-ledger.md'), '# Fourteen-day internal author ledger\n\n'
    + `Rules: ${RULES_VERSION}. All times Europe/London. This file and the private snapshot are author-only; neither is served by the public API. The JSON snapshot contains the complete before/after state changes, knowledge and pending actions.\n\n`
    + table(['London time', 'Event ID', 'Type', 'Location / room', 'Visibility', 'Description / refusal', 'Causes', 'Changed fields'],
      snapshot.events.map(event => [london.format(event.occurredAt), event.id, event.type, `${event.location} / ${event.area ?? ''}`, event.visibility,
        event.publicDescription ?? event.payload?.reason ?? '[private]', (event.causedBy ?? []).join(', '),
        (event.changes ?? []).map(change => `${change.entity}:${change.id}.${change.field}`).join(', ')])));
  const d = diagnostics;
  writeFileSync(join(output, 'FINAL-RESULTS.md'), `# Final phases: ${report.result}\n\nRules: ${RULES_VERSION}. Author world: ${london.format(startMs)} to ${london.format(endMs)}, Europe/London.\n\n`
    + `The existing A–E runner compared full five-day semantic snapshots. Its actual source evidence is [comparison.json](${core.comparisonPath.replaceAll('\\', '/')}).\n\n`
    + table(['Variant', 'Events', 'Pending', 'Digest'], core.variants.map(row => [row.variant, row.events, row.pending, row.digest]))
    + `\nSix-hour catch-up: ${core.benchmark.processedActions} actions; zero minute ticks; median ${core.benchmark.medianMs.toFixed(3)} ms, p95 ${core.benchmark.p95Ms.toFixed(3)} ms over ${core.benchmark.iterations} runs. ${core.benchmark.includes}.\n\n`
    + `Fourteen-day catch-up: ${advance.processedActions} actions, ${elapsedMs.toFixed(3)} ms, ${d.eventCounts.public} public events, ${d.eventCounts.private} private records. Final digest: ${report.authorRun.digest}. Repeat reads unchanged: ${readsUnchanged}.\n\n`
    + '## Observed story consequences\n\n'
    + table(['Diagnostic', 'Observed'], [
      ['Intent initiatives', JSON.stringify(d.intent.initiativesByRequester)], ['Intent outcomes', JSON.stringify(d.intent.outcomes)],
      ['Intent responses', JSON.stringify(d.intent.responses)], ['Agenda families', JSON.stringify(d.agendas.families)],
      ['Agenda outcomes', JSON.stringify(d.agendas.outcomes)], ['Ground work started / interrupted / completed', `${d.ground.started} / ${d.ground.interrupted} / ${d.ground.completed}`],
      ['Weather deferrals / final ground status', `${d.ground.weatherDeferrals} / ${d.ground.statusAtEnd}`],
      ['Pending actions / active intentions / active Ink appointments / active operations', `${d.pendingWork.actions} / ${d.pendingWork.activeIntents.length} / ${d.pendingWork.activeInk.length} / ${d.pendingWork.activeOperations.length}`],
      ['Public added paragraphs / prose register events / authored line scenes', `${d.prose.publicParagraphs} / ${d.prose.proseRegisterEvents} / ${d.prose.authoredLineScenes}`],
      ['New intent, agenda and ground paragraphs', d.prose.phase3To5Paragraphs],
      ['Repeated paragraph texts / extra occurrences', `${d.repetition.prose.repeatedTexts} / ${d.repetition.prose.extraOccurrences}`],
      ['Invalid causal sources / orphan completions', `${d.causalIntegrity.invalidSources.length} / ${d.causalIntegrity.orphanCompletions.length}`],
      ['Checked character memories', d.causalIntegrity.checkedMemories],
      ['Expected stale/refused completion records', d.causalIntegrity.staleOrRefusedCompletionActions],
    ])
    + `\n## Coverage and limits\n\nUnobserved agenda families: ${d.coverage.unobservedAgendaFamilies.join(', ') || 'none'}. Unobserved agenda outcomes: ${d.coverage.unobservedAgendaOutcomes.join(', ') || 'none'}. ${d.coverage.note}\n\n`
    + 'A persistent restriction is legitimate pending work, not an orphaned completion. Repeated authored lines are shown in the JSON diagnostics for editorial review. This runner verifies local mechanics and public field boundaries; it does not establish character authenticity, eliminate every possible semantic prose leak, load-test deployment, or test a real model provider. Weather and visual effects are the next pass.\n\n'
    + `## Hard violations\n\n${d.violations.length ? table(['Kind', 'Details'], d.violations.map(row => [row.kind, JSON.stringify(row)])) : 'None.\n'}\n`
    + 'The complete private ledger, all state changes and pending work, allowlisted public ledger, source-file hashes and factual counts are saved beside this report. No live save was opened or migrated.\n');
  console.log(JSON.stringify({ result: report.result, rulesVersion: RULES_VERSION, output,
    coreOutput: core.artifactDirectory, digest: report.authorRun.digest, violations: diagnostics.violations.length }, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
} catch (error) {
  json('final-comparison.json', { result: 'FAIL', rulesVersion: RULES_VERSION, output,
    error: error.stack ?? String(error), note: 'Verification stopped before complete evidence was available.' });
  writeFileSync(join(output, 'FINAL-RESULTS.md'), `# Final phases: FAIL\n\nVerification stopped before complete evidence was available.\n\n${String(error.message)}\n\nSee final-comparison.json and captured core output. No PASS is inferred.\n`);
  console.error(error); process.exitCode = 1;
}
