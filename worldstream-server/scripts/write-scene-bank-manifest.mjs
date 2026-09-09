import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SCENE_BANK_MANIFEST } from '../src/scene-bank-catalog.mjs';

const counts=Object.fromEntries(['enabled','prerequisite_gated','excluded'].map(status=>
  [status,SCENE_BANK_MANIFEST.filter(scene=>scene.status===status).length]));
const lines=[
  '# Scene bank integration', '',
  `The creator’s 9 September 2026 bank contains ${SCENE_BANK_MANIFEST.length} scenes: ${counts.enabled} enabled, ${counts.prerequisite_gated} held behind additional prerequisites, and ${counts.excluded} excluded from this checkpoint or awaiting a complete consequential lifecycle.`, '',
  'Enabled means a scene can be selected when its actual cast, place, availability, elapsed time and earlier events satisfy the runtime guards. It does not mean every scene appears on every seed or that all scenes are immediately available. Prerequisite-gated scenes remain withheld when the engine has no actual source for the stated premise; their inclusion in this manifest is not a claim that an automatic unlocking path exists.', '',
  'The complete Nimbus sequence P1–P22 has an owned state machine. Its clock begins at the actual coat arrival, not the age of the database. The first scenes occur in weeks; later stages require months. P8 precedes P7 so Yukon actually learns who is in the coat before the sneeze. P10 precedes P9 so Henderson receives a real containment-discharge report. The bounty comes from higher MI6 leadership. Davis and Henderson knowingly leave the arrangement unfiled; Davis has no leverage over Henderson through it.', '',
  'A gathering uses real free time, reserves its cast, records movement between ordinary rooms, and rechecks arrival after three minutes. Existing work, promises, travel and recovery can prevent it. The vending machine opens one minute after Nimbus enters; its consequence still happens if the humans are called away. Absent characters receive no dialogue or memory. Emily’s garden meeting excludes both leads and remains unknown to them.', '',
  'Ordinary rooftop, reception and plaza-garden zones are available. The basement stays sealed. No runtime model call writes or re-performs these authored scenes. Source IDs, knowledge acquisition and physical outcomes stay in the normal event ledger. No past scene is injected on upgrade or on a reader request.', '',
  'All six Nimbus plates are registered. Nimbus has silent action beats and never a spoken line. Provisional artefact names are confined to the retained workshop source; the artefact sequence is not emitted.', '',
  '| Scene | Title | State | Dependencies / reason | Earliest Nimbus age |',
  '|---|---|---|---|---|',
  ...SCENE_BANK_MANIFEST.map(s=>`| ${s.id} | ${s.title.replaceAll('|','/')} | ${s.status} | ${(s.gate??s.dependencies.join(', ')??'').replaceAll('|','/')} | ${s.id.startsWith('P')?`${s.minAgeDays} days`:'—'} |`),
  '', 'The source transcription is in `src/scene-bank-data.mjs`; authored adaptations and gates are in `src/scene-bank-catalog.mjs`; physical staging and prose are in `src/scene-bank-copy.mjs`; ownership, timing, state and knowledge are in `src/scene-bank.mjs`.', '',
];
writeFileSync(fileURLToPath(new URL('../SCENE-BANK-INTEGRATION.md',import.meta.url)),lines.join('\n'));
process.stdout.write(JSON.stringify({total:SCENE_BANK_MANIFEST.length,...counts})+'\n');
