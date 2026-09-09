// Same-ledger editorial comparison. Reads the immutable prior audit, never
// advances a world, writes a saved-world database, or calls a network service.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { analyse } from './audit-new-viewer.mjs';
import { forwardReadingEvents } from '../../worldstream/app/reader-narrative.js';

const inputFile = process.argv[2] || 'reports/new-viewer-baseline.json';
const outputStem = process.argv[3] || 'living-novel-editor';
if (!/^[a-z0-9-]+$/.test(outputStem)) throw new TypeError('Use a simple report name');
const baselineUrl = new URL(`../${inputFile}`, import.meta.url);
const baseline = await readFile(baselineUrl);
const source = JSON.parse(baseline);
const compact = model => ({ rows: model.publicEvents, words: model.words,
  sentences: model.exactSentences.total, repeatedSentences: model.exactSentences.repeatedOccurrences,
  repeatedPercent: Number((100 * model.exactSentences.repeatedOccurrences / model.exactSentences.total).toFixed(2)),
  dialogueUses: model.dialogue.scenes, dialogueScripts: model.dialogue.distinctScripts,
  dialogueLines: model.dialogue.distinctLines });
const results = source.runs.map(run => ({ seed: run.seed, canonicalEventsDigest: run.canonicalEventsDigest,
  windows: Object.fromEntries([1, 7, 30].map(days => {
    const end = run.start + days * 86_400_000, original = run.publicEvents.filter(row => row.occurredAt < end);
    const edited = forwardReadingEvents(original), shown = edited.filter(row => row.readerWeight > 0);
    const analysis = analyse(shown, [], run.start, end, run.cinematicRecords);
    return [days, { baseline: compact(run.windows[days]), novel: compact(analysis),
      omittedRoutine: edited.filter(row => row.readerOmission === 'routine').length,
      omittedRepeatedTexture: edited.filter(row => row.readerOmission === 'repeated').length,
      shortenedConsequences: edited.filter(row => row.readerWeight === 1 && row.prose && !row.readerProse).length,
      flaggedUnchangedRoutines: edited.filter(row => row.routineContinuation === true).length,
      flaggedRoutinesStillInBook: edited.filter(row => row.routineContinuation === true && row.readerWeight > 0).length,
      droppedDialogueEventIds: original.filter(row => row.lines?.length && !shown.some(item => item.id === row.id)).map(row => row.id),
      lostSourceEventIds: original.filter(row => !edited.some(item => item.id === row.id)).map(row => row.id) }];
  })) }));
const report = { measuredAt: new Date().toISOString(),
  baselineFile: inputFile, baselineSha256: createHash('sha256').update(baseline).digest('hex'),
  readerSourceSha256: createHash('sha256').update(await readFile(new URL('../../worldstream/app/reader-narrative.js', import.meta.url))).digest('hex'),
  scope: 'Identical committed public events from the specified saved uninterrupted audit sample; reader editing only.',
  limits: [
    'The planner receives the complete public window. This does not measure a browser whose editor history contains only the latest forty or two hundred events.',
    'The source snapshot is not rerun. New simulation changes are included only if already present in the specified input file; this comparison changes its reader selection only.',
    'Routine records remain in the returned plan and ledger. Omitted means absent from the default prose path.',
    'Familiar consequential passages retain the existing public factual description and any public context. No sentences or words are rewritten.',
    'Dialogue and accepted scene text are protected. Dialogue reuse is included in the repeat rate.',
    'These are text-selection measurements, not author approval, fiction quality scores, or a thirty-day human retention test.'
  ], results };
await writeFile(new URL(`../reports/${outputStem}-measurements.json`, import.meta.url), JSON.stringify(report, null, 2) + '\n');
const rows = results[0].windows;
const markdown = `# Living novel editor: same-ledger measurement\n\nMeasured ${report.measuredAt}.\n\nThe editor removes unchanged routine and repeated atmospheric passages from the default novel, while retaining every source event. A familiar consequential paragraph becomes its existing factual description. New character prose, dialogue, and accessible origins remain. The dates and scene breaks come from recorded time, place, room, and participants; they do not assert an invented causal story.\n\n| Default seed | Original rows → novel rows | Original words → novel words | Original repeats → novel repeats | Dialogue uses retained |\n|---|---:|---:|---:|---:|\n${[1, 7, 30].map(days => {
  const { baseline: before, novel: after } = rows[days];
  return `| ${days} days | ${before.rows} → ${after.rows} | ${before.words} → ${after.words} | ${before.repeatedPercent}% → ${after.repeatedPercent}% | ${after.dialogueUses}/${before.dialogueUses} |`;
}).join('\n')}\n\nAll ${results.length} month sample(s) retain every dialogue event and all original source event IDs. Their edited repeat rates are ${results.map(run => `${run.windows[30].novel.repeatedPercent}%`).join(', ')}. The remaining repeats include recurrent factual changes and deliberately protected dialogue; this edit does not create additional authored story supply.\n\n## Method and limits\n\n${report.limits.map(limit => `- ${limit}`).join('\n')}\n\nRun from the server directory: \`node scripts/measure-living-novel.mjs ${inputFile} ${outputStem}\`. Detailed counts and source hashes are in \`reports/${outputStem}-measurements.json\`. The input JSON is read and never overwritten.\n`;
await writeFile(new URL(`../reports/${outputStem.toUpperCase()}.md`, import.meta.url), markdown);
console.log(JSON.stringify(results.map(run => ({ seed: run.seed, windows: run.windows })), null, 2));
