import { mkdir, writeFile } from 'node:fs/promises';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, release } from 'node:os';
import { WorldStore, semanticDigest, START_MS, END_MS } from './world.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const workerPath = join(here, 'process-worker.mjs');
const seed = 'silver-clouds-experiment-l';
const minute = 60_000;
const benchmarkRuns = 20;
const concurrencyRequests = 100;
const concurrencyProcesses = 8;
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const runDirectory = join(here, '..', 'artifacts', runId);
const variants = [];

function json(value) {
  return `${JSON.stringify(value, (_key, entry) =>
    typeof entry === 'bigint' ? entry.toString() : entry, 2)}\n`;
}

async function saveJson(path, value) {
  await writeFile(path, json(value), 'utf8');
}

function london(timestamp) {
  if (!Number.isFinite(timestamp)) return String(timestamp ?? '');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false,
  }).format(new Date(timestamp));
}

function markdownCell(value) {
  return String(value ?? '').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
}

function describeEvent(event) {
  const names = { goaden: 'Goaden', ashai: 'Ashai' };
  const places = { mi6: 'MI6', sanctuary: 'Sanctuary', streamliner: 'the Streamliner' };
  const actor = names[event.participants?.[0]] ?? event.participants?.[0] ?? 'Character';
  const payload = event.payload ?? {};
  if (event.type === 'condition_applied') return `Goaden acquired the synthetic minor strain (${payload.side}).`;
  if (event.type === 'scheduled_activity_resolved') return `Goaden's planned ${payload.planned} became ${payload.selected}; reason: ${payload.reason}.`;
  if (event.type === 'departed') return `${actor} left ${places[payload.from] ?? payload.from} for ${places[payload.to] ?? payload.to}, travelling on the Streamliner.`;
  if (event.type === 'arrived') return `${actor} arrived at ${places[payload.destination] ?? payload.destination}.`;
  if (event.type === 'encounter_resolved') {
    if (payload.outcome === 'ordinary_greeting') return 'Goaden and Ashai met; Ashai gave an ordinary greeting.';
    if (payload.outcome === 'learned_condition') return 'Goaden and Ashai met; Ashai learned about the earlier condition from Goaden.';
    if (payload.outcome === 'concerned_check_in') return 'Goaden and Ashai met; Ashai checked on the condition she learned about earlier. Concern and trust changed.';
  }
  return event.summary ?? event.description ?? event.publicDescription ?? JSON.stringify(payload);
}

function ledgerMarkdown(snapshot, label) {
  const lines = [
    `# ${label}: canonical event ledger`,
    '',
    `Resolved through ${london(snapshot.world.resolvedThrough)} (Europe/London).`,
    '',
    'Synthetic test fixture; this internal ledger includes facts excluded from the public projection. Full payloads, provenance and before/after changes are preserved in event-ledger.json.',
    '',
    '| Sequence | London time | Event | Detail |',
    '| --- | --- | --- | --- |',
  ];
  for (const event of snapshot.events) {
    const eventTime = event.occurredAt ?? event.occurredAtMs ?? event.atMs ?? event.time;
    lines.push(`| ${markdownCell(event.seq ?? event.sequence ?? event.id)} | ${markdownCell(london(eventTime))} | ${markdownCell(event.type ?? event.kind)} | ${markdownCell(describeEvent(event))} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function createVariant(label, description) {
  const directory = join(runDirectory, label);
  await mkdir(directory, { recursive: true });
  return { label, description, directory, dbPath: join(directory, 'world.sqlite') };
}

function seedDatabase(dbPath) {
  const store = new WorldStore({ dbPath, seed });
  store.close();
}

async function captureVariant(variant, details) {
  const store = new WorldStore({ dbPath: variant.dbPath, seed });
  let snapshot;
  let publicProjection;
  let operationalStats;
  try {
    snapshot = store.semanticSnapshot();
    publicProjection = store.publicProjection();
    operationalStats = store.operationalStats();
  } finally {
    store.close();
  }
  const digest = semanticDigest(snapshot);
  await saveJson(join(variant.directory, 'semantic-snapshot.json'), snapshot);
  await saveJson(join(variant.directory, 'event-ledger.json'), snapshot.events);
  await writeFile(join(variant.directory, 'event-ledger.md'), ledgerMarkdown(snapshot, variant.label), 'utf8');
  await saveJson(join(variant.directory, 'public-projection.json'), publicProjection);
  const report = {
    label: variant.label,
    description: variant.description,
    digest,
    eventCount: snapshot.events.length,
    resolvedThrough: snapshot.world.resolvedThrough,
    operationalStats,
    ...details,
  };
  await saveJson(join(variant.directory, 'run-details.json'), report);
  variants.push(report);
  process.stdout.write(`${variant.label}: ${snapshot.events.length} events; ${digest}\n`);
  return report;
}

function launchWorker(configuration) {
  const child = fork(workerPath, [], {
    execArgv: [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    windowsHide: true,
  });
  let readyResolve;
  let readyReject;
  let completedResolve;
  let completedReject;
  let completion;
  let remoteFailure;
  let stderr = '';
  let stdout = '';
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const completed = new Promise((resolve, reject) => {
    completedResolve = resolve;
    completedReject = reject;
  });
  // Register a handler immediately: startup can fail before the caller awaits
  // completed (the barrier awaits ready first).
  completed.catch(() => {});
  ready.catch(() => {});
  const timeout = setTimeout(() => {
    child.kill();
    const error = new Error(`Worker ${configuration.workerIndex} exceeded 60 seconds. ${stderr}`);
    readyReject(error);
    completedReject(error);
  }, 60_000);
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('message', (message) => {
    if (message.type === 'ready') readyResolve(message);
    if (message.type === 'completed') completion = message;
    if (message.type === 'failed') remoteFailure = message.error;
  });
  child.on('error', (error) => {
    clearTimeout(timeout);
    readyReject(error);
    completedReject(error);
  });
  child.on('exit', (code, signal) => {
    clearTimeout(timeout);
    if (code !== 0 || !completion || remoteFailure) {
      const error = new Error(`Worker ${configuration.workerIndex} exited with code ${code}, signal ${signal}: ${remoteFailure ?? stderr}`);
      readyReject(error);
      completedReject(error);
      return;
    }
    completedResolve({ ...completion, exitCode: code, exitSignal: signal, stdout, stderr });
  });
  child.send({ type: 'initialize', configuration });
  return {
    ready,
    completed,
    start() { child.send({ type: 'start' }); },
    stop() { child.kill(); },
  };
}

function requestTargets(offsets, prefix) {
  return offsets.map((offset, index) => ({
    requestId: `${prefix}-${index + 1}`,
    targetMs: START_MS + offset * minute,
  }));
}

async function runLocalVariant(label, description, requests) {
  const variant = await createVariant(label, description);
  const store = new WorldStore({ dbPath: variant.dbPath, seed });
  const results = [];
  const began = performance.now();
  try {
    for (const request of requests) {
      results.push({ ...request, result: await store.advance(request.targetMs) });
    }
  } finally {
    store.close();
  }
  return captureVariant(variant, {
    requestCount: requests.length,
    advanceAndCloseWallMs: performance.now() - began,
    requests: results,
  });
}

async function runRestartVariant() {
  const variant = await createVariant('C-process-restart', 'Irregular advances, clean OS-process exit, then a new OS process reopens the committed database and resumes.');
  seedDatabase(variant.dbPath);
  const batches = [
    requestTargets([7, 29, 63, 91, 127], 'before-exit'),
    requestTargets([128, 177, 229, 301, 359, 360], 'after-reopen'),
  ];
  const processes = [];
  for (let index = 0; index < batches.length; index += 1) {
    const worker = launchWorker({ dbPath: variant.dbPath, seed, workerIndex: index, requests: batches[index], includeCheckpoint: true });
    await worker.ready;
    worker.start();
    // completed only resolves after the child OS process has exited.
    processes.push(await worker.completed);
  }
  if (processes[0].pid === processes[1].pid) throw new Error('Restart did not use distinct process IDs.');
  const checkpoint = processes[0].checkpointSnapshot;
  if (checkpoint.characters.goaden.location !== 'streamliner' || !checkpoint.characters.goaden.journey
    || !checkpoint.pendingActions.some((action) => action.id === 'goaden-outbound-arrival')) {
    throw new Error('Restart checkpoint did not preserve Goaden in transit and his dynamically scheduled arrival.');
  }
  await saveJson(join(variant.directory, 'restart-checkpoint.json'), checkpoint);
  return captureVariant(variant, {
    requestCount: batches.flat().length,
    actualProcessCount: processes.length,
    restartKind: 'clean committed checkpoint; process exit; new process and connection',
    checkpointLondonTime: london(checkpoint.world.resolvedThrough),
    persistedDynamicArrivalVerified: true,
    processes,
  });
}

async function runConcurrencyVariant() {
  const variant = await createVariant('E-100-requests-8-processes', '100 advance requests distributed across 8 independently opened SQLite connections in 8 OS processes, released after every worker reports ready. SQLite serializes writes.');
  // Initialization and seeding are complete before any worker is spawned.
  seedDatabase(variant.dbPath);
  const assignments = Array.from({ length: concurrencyProcesses }, () => []);
  for (let index = 0; index < concurrencyRequests; index += 1) {
    assignments[index % concurrencyProcesses].push({ requestId: `concurrent-${index + 1}`, targetMs: END_MS });
  }
  const workers = assignments.map((requests, workerIndex) => launchWorker({
    dbPath: variant.dbPath, seed, workerIndex, requests,
  }));
  try {
    const ready = await Promise.all(workers.map((worker) => worker.ready));
    const began = performance.now();
    for (const worker of workers) worker.start();
    const processes = await Promise.all(workers.map((worker) => worker.completed));
    const barrierToAllExitedWallMs = performance.now() - began;
    const requestCount = processes.reduce((sum, child) => sum + child.requestCount, 0);
    const distinctProcesses = new Set(processes.map((child) => child.pid)).size;
    if (requestCount !== concurrencyRequests || distinctProcesses !== concurrencyProcesses) {
      throw new Error(`Concurrency coverage was ${requestCount} requests / ${distinctProcesses} processes.`);
    }
    return captureVariant(variant, {
      requestCount,
      actualProcessCount: distinctProcesses,
      concurrencyMeaning: '100 queued requests; 8 independent processes released together; maximum 8 connections contending, never 100 simultaneous writers',
      readyBarrier: ready,
      barrierToAllExitedWallMs,
      processes,
    });
  } catch (error) {
    for (const worker of workers) worker.stop();
    throw error;
  }
}

function percentileNearestRank(sorted, percentile) {
  return sorted[Math.max(0, Math.ceil(percentile * sorted.length) - 1)];
}

async function benchmark(expectedDigest) {
  const directory = join(runDirectory, 'benchmark');
  await mkdir(directory, { recursive: true });
  const results = [];
  for (let index = 0; index < benchmarkRuns; index += 1) {
    const dbPath = join(directory, `world-${String(index + 1).padStart(2, '0')}.sqlite`);
    // Constructor creates/seeds the fresh database outside the measured span.
    const store = new WorldStore({ dbPath, seed });
    let result;
    let durationMs;
    let digest;
    try {
      const began = performance.now();
      result = await store.advance(END_MS);
      durationMs = performance.now() - began;
      digest = semanticDigest(store.semanticSnapshot());
    } finally {
      store.close();
    }
    results.push({ run: index + 1, dbPath, durationMs, result, digest, digestMatches: digest === expectedDigest });
  }
  const durations = results.map((entry) => entry.durationMs).sort((a, b) => a - b);
  const medianMs = (durations[9] + durations[10]) / 2;
  const p95Ms = percentileNearestRank(durations, 0.95);
  const maxMs = durations.at(-1);
  const report = {
    runCount: benchmarkRuns,
    measuredOperation: 'advance(END_MS), including the synchronous database commit; new database construction/seeding, snapshots, digest calculation and close are excluded',
    medianMs,
    p95Ms,
    maxMs,
    percentileMethod: 'nearest rank (19th sorted observation for p95 of 20)',
    subsecondGoal: {
      thresholdMs: 1000,
      medianPasses: medianMs < 1000,
      p95Passes: p95Ms < 1000,
      everyRunPasses: maxMs < 1000,
    },
    allDigestsMatch: results.every((entry) => entry.digestMatches),
    results,
  };
  await saveJson(join(directory, 'benchmark.json'), report);
  await writeFile(join(directory, 'summary.md'), [
    '# Six-hour catch-up benchmark', '',
    `${benchmarkRuns} fresh databases; creation and seeding excluded from timing.`, '',
    '| Median | p95 | Maximum | Every run below one second |',
    '| --- | --- | --- | --- |',
    `| ${medianMs.toFixed(3)} ms | ${p95Ms.toFixed(3)} ms | ${maxMs.toFixed(3)} ms | ${report.subsecondGoal.everyRunPasses ? 'Yes' : 'No'} |`, '',
    'Timing includes advance and its database commit. It excludes snapshotting, hashing and closing the connection.',
    'These are local measurements on this machine, not a hosted-service latency or capacity guarantee.', '',
  ].join('\n'), 'utf8');
  return report;
}

async function main() {
  if ((END_MS - START_MS) / minute !== 360) throw new Error('This experiment requires a six-hour fixture.');
  await mkdir(runDirectory, { recursive: true });
  await saveJson(join(runDirectory, 'environment.json'), {
    runId, createdAt: new Date().toISOString(), nodeVersion: process.version,
    platform: process.platform, osRelease: release(), architecture: process.arch,
    cpuModel: cpus()[0]?.model ?? 'unavailable', sqliteVersion: process.versions.sqlite ?? 'unavailable',
    seed, START_MS, END_MS,
    timezone: 'Europe/London', llmCalls: 0,
  });
  process.stdout.write(`Experiment artifacts: ${runDirectory}\n`);
  await runLocalVariant('A-minute-advances', '360 consecutive one-minute advances.', requestTargets(Array.from({ length: 360 }, (_value, index) => index + 1), 'minute'));
  await runLocalVariant('B-one-shot', 'One six-hour catch-up from the same seeded starting state.', [{ requestId: 'one-shot', targetMs: END_MS }]);
  await runRestartVariant();
  const duplicateVariant = await runLocalVariant('D-duplicate-requests', 'Repeated requests for already resolved timestamps; same target must append no events.', requestTargets([30, 30, 90, 90, 180, 180, 360, 360, 360], 'duplicate'));
  const concurrencyVariant = await runConcurrencyVariant();
  const expectedDigest = variants[0].digest;
  const duplicateChecks = duplicateVariant.requests
    .filter((request, index, requests) => index > 0 && request.targetMs === requests[index - 1].targetMs)
    .map((request) => ({ requestId: request.requestId, appendedEvents: request.result.appendedEvents, processedActions: request.result.processedActions, passes: request.result.appendedEvents === 0 && request.result.processedActions === 0 }));
  const concurrentRequests = concurrencyVariant.processes.flatMap((child) => child.requests);
  const appendedEventCount = concurrentRequests.reduce((sum, request) => sum + request.result.appendedEvents, 0);
  const processedActionCount = concurrentRequests.reduce((sum, request) => sum + request.result.processedActions, 0);
  const eventProducingAdvanceCount = concurrentRequests.filter((request) => request.result.appendedEvents > 0).length;
  const concurrentChecks = {
    requestCount: concurrentRequests.length,
    processCount: concurrencyVariant.actualProcessCount,
    everyChildDigestMatchesBaseline: concurrencyVariant.processes.every((child) => child.semanticDigest === expectedDigest),
    expectedEventCount: variants[0].eventCount,
    appendedEventCount,
    processedActionCount,
    appendedEventsMatchBaseline: appendedEventCount === variants[0].eventCount,
    processedActionsMatchBaseline: processedActionCount === variants[0].eventCount,
    eventProducingAdvanceCount,
    exactlyOneEventProducingAdvance: eventProducingAdvanceCount === 1,
    everyRequestResolvedThroughEnd: concurrentRequests.every((request) => request.result.resolvedThrough === END_MS),
  };
  concurrentChecks.passes = concurrentChecks.requestCount === concurrencyRequests
    && concurrentChecks.processCount === concurrencyProcesses
    && concurrentChecks.everyChildDigestMatchesBaseline
    && concurrentChecks.appendedEventsMatchBaseline
    && concurrentChecks.processedActionsMatchBaseline
    && concurrentChecks.exactlyOneEventProducingAdvance
    && concurrentChecks.everyRequestResolvedThroughEnd;
  const comparison = {
    expectedDigest,
    allFiveDigestsMatch: variants.length === 5 && variants.every((variant) => variant.digest === expectedDigest),
    duplicateRequestsAreNoOps: duplicateChecks.every((check) => check.passes),
    duplicateChecks,
    concurrentChecks,
    variants: variants.map(({ label, description, digest, eventCount, resolvedThrough, requestCount }) => ({ label, description, digest, eventCount, resolvedThrough, requestCount, matches: digest === expectedDigest })),
  };
  await saveJson(join(runDirectory, 'digest-comparison.json'), comparison);
  const timing = await benchmark(expectedDigest);
  const semanticPasses = comparison.allFiveDigestsMatch && comparison.duplicateRequestsAreNoOps
    && concurrentChecks.passes && timing.allDigestsMatch;
  const performancePasses = timing.subsecondGoal.everyRunPasses;
  const success = semanticPasses && performancePasses;
  await saveJson(join(runDirectory, 'result.json'), {
    success, semanticPasses, performancePasses, runId, runDirectory, comparison,
    benchmark: { runCount: timing.runCount, medianMs: timing.medianMs, p95Ms: timing.p95Ms, maxMs: timing.maxMs, subsecondGoal: timing.subsecondGoal, allDigestsMatch: timing.allDigestsMatch },
  });
  await writeFile(join(runDirectory, 'summary.md'), [
    '# Experiment L results', '',
    `Result: **${success ? 'PASS' : 'FAIL'}**.`, '',
    '| Variant | Requests | Events | Canonical digest matches A |',
    '| --- | ---: | ---: | --- |',
    ...comparison.variants.map((variant) => `| ${variant.label} | ${variant.requestCount} | ${variant.eventCount} | ${variant.matches ? 'Yes' : 'No'} |`), '',
    `Canonical semantic digest: \`${expectedDigest}\`.`, '',
    'C uses an actual child-process exit followed by a distinct process reopening the committed SQLite database. This is a clean restart, not a forced crash inside a transaction.', '',
    'E dispatches 100 requests across 8 independent processes and SQLite connections after an IPC ready barrier. Each process handles its assigned requests sequentially; SQLite serializes writers. This does not represent 100 simultaneous writers.', '',
    `Concurrent request checks: **${concurrentChecks.passes ? 'PASS' : 'FAIL'}**. ${appendedEventCount} appended events and ${processedActionCount} processed actions across all requests; ${eventProducingAdvanceCount} event-producing advance. Every child digest matches the baseline: ${concurrentChecks.everyChildDigestMatchesBaseline ? 'yes' : 'NO'}. Every response is resolved through the end: ${concurrentChecks.everyRequestResolvedThroughEnd ? 'yes' : 'NO'}.`, '',
    `Duplicate requests appended no events and processed no actions: ${comparison.duplicateRequestsAreNoOps ? 'yes' : 'NO'}.`, '',
    `Six-hour catch-up across ${benchmarkRuns} fresh databases: median **${timing.medianMs.toFixed(3)} ms**, p95 **${timing.p95Ms.toFixed(3)} ms**, maximum **${timing.maxMs.toFixed(3)} ms**.`, '',
    `Every measured run met the subsecond goal: **${timing.subsecondGoal.everyRunPasses ? 'yes' : 'no'}**. Database creation/seeding is outside the timer; advance and commit are included.`, '',
    `Semantic acceptance: **${semanticPasses ? 'PASS' : 'FAIL'}**. Performance acceptance: **${performancePasses ? 'PASS' : 'FAIL'}**. Both are required for the overall pass and zero exit status.`, '',
    'All snapshots, complete event ledgers, process/request details and benchmark databases are preserved in this run directory. No previous run is overwritten.', '',
  ].join('\n'), 'utf8');
  process.stdout.write(`${success ? 'PASS' : 'FAIL'}: five semantic digests ${comparison.allFiveDigestsMatch ? 'agree' : 'DO NOT agree'}; benchmark median ${timing.medianMs.toFixed(3)} ms, p95 ${timing.p95Ms.toFixed(3)} ms, max ${timing.maxMs.toFixed(3)} ms.\n`);
  process.stdout.write(`Summary: ${join(runDirectory, 'summary.md')}\n`);
  if (!success) process.exitCode = 1;
}

main().catch(async (error) => {
  await mkdir(runDirectory, { recursive: true });
  await saveJson(join(runDirectory, 'failure.json'), { runId, error: error?.stack ?? String(error), completedVariants: variants });
  process.stderr.write(`${error?.stack ?? error}\nArtifacts preserved: ${runDirectory}\n`);
  process.exitCode = 1;
});
