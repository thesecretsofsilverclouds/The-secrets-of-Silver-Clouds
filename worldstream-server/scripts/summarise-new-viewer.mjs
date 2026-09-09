import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readingSurface, analyse } from './audit-new-viewer.mjs';
import { forwardReadingEvents } from '../../worldstream/app/reader-narrative.js';
import { atLondon, londonDate } from '../src/time.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const norm = text => String(text ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const DAY = 86_400_000, HOUR = 3_600_000;
const by = (es, f) => Object.fromEntries(Object.entries(es.reduce((a, e) => { const k = f(e); a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a,b) => b[1]-a[1]));
const compact = w => ({ rows: w.publicEvents, words: w.words, exactSentences: w.exactSentences.total,
  repeatOccurrences: w.exactSentences.repeatedOccurrences, repeatPercent: +(100 * w.exactSentences.repeatedOccurrences / w.exactSentences.total).toFixed(1),
  structureRepeatPercent: +(100 * w.structuralSentences.repeatedOccurrences / w.structuralSentences.total).toFixed(1),
  tags: w.tags, dialogue: w.dialogue, prose: w.prose, acceptedCinematics: w.actualAcceptedCinematics });
const base = JSON.parse(await readFile(resolve(root, 'reports/new-viewer-baseline.json'), 'utf8'));
let after = null; try { after = JSON.parse(await readFile(resolve(root, 'reports/new-viewer-after.json'), 'utf8')); } catch {}
const comparisons = [];
for (const run of base.runs) {
  const follow = after?.runs.find(r => r.seed === run.seed);
  const raw = run.publicEvents.map(e => ({ ...e, publicDescription: e.description,
    causedBy: run.publicProvenance.find(p => p.id === e.id)?.causedBy ?? [] }));
  const presentationOnly = {};
  for (const days of [1, 7, 30]) {
    const rows = run.publicEvents.filter(e => e.occurredAt < run.start + days * DAY);
    const view = forwardReadingEvents(rows).filter(e => e.readerWeight > 0);
    presentationOnly[days] = compact(analyse(view, raw, run.start, run.start + days * DAY));
  }
  const families = Object.fromEntries(['ARC_BEAT', 'CONVERSATION', 'VENUE_SCENE', 'SUPPORTING_COMMITMENT', 'OFFSCREEN_START']
    .map(type => [type, by(run.publicProvenance.filter(e => e.type === type), e => e.family.arcId ?? e.family.family ?? e.family.sceneId ?? e.family.mood ?? 'unspecified')]));
  const dialogueByType = Object.fromEntries(['CONVERSATION', 'VENUE_SCENE', 'LEGION_VISIT', 'INTENT_RESPONSE', 'INTENT_RENEGOTIATE']
    .map(type => { const es = run.publicEvents.filter(e => e.type === type && e.lines?.length);
      return [type, { uses: es.length, uniqueScripts: new Set(es.map(e => JSON.stringify(e.lines.map(l => [l.who, l.text])))).size }]; }));
  const categories = {
    meals: /^MEAL_/, training: /^PRACTICE_/, travel: /^TRAVEL_/, dialogue: /^(?:CONVERSATION|VENUE_SCENE|LEGION_VISIT)$/,
    arcs: /^ARC_/, offscreen: /^OFFSCREEN_/, supporting: /^SUPPORTING_/, callbacks: /CALLBACK|DEBRIEF|OFFSCREEN_ENCOUNTER/,
    night: /^NIGHT_/,
  };
  const repeatByCategory = Object.fromEntries(Object.entries(categories).map(([category, pattern]) => {
    const es = run.publicEvents.filter(e => pattern.test(e.type)); const texts = es.map(e => norm(readingSurface(e).join('\n')));
    const groups = by(texts, t => t); return [category, { events: es.length, distinctFullSurfaces: new Set(texts).size,
      repeatedUses: texts.length - new Set(texts).size,
      top: Object.entries(groups).filter(([,n]) => n>1).slice(0,3).map(([text,count]) => ({text,count})) }];
  }));
  const mirrors = new Map();
  for (const e of run.publicEvents) for (const text of readingSurface(e)) {
    if (!/^(?:Goaden|Ashai)\b/.test(text)) continue;
    const key = norm(text).replace(/\b(?:goaden|ashai)\b/g, '{lead}');
    const bucket = mirrors.get(key) ?? { uses: 0, leads: new Set(), examples: [] };
    bucket.uses++; bucket.leads.add(text.split(' ')[0]);
    if (bucket.examples.length < 2) bucket.examples.push(text); mirrors.set(key, bucket);
  }
  const interchangeable = [...mirrors.entries()].filter(([,b]) => b.leads.size > 1)
    .map(([template,b]) => ({template,uses:b.uses,examples:b.examples})).sort((a,b) => b.uses-a.uses);
  const seen = new Set(), weeks = [];
  for (let week=0;week<4;week++) {
    const es = run.publicEvents.filter(e => e.occurredAt >= run.start+week*7*DAY && e.occurredAt < run.start+(week+1)*7*DAY && e.register==='prose');
    let fresh=0; for(const e of es){const key=norm(readingSurface(e).join('\n')); if(!seen.has(key)){fresh++;seen.add(key);}}
    weeks.push({week:week+1,proseRegisterEvents:es.length,newFullSurfaces:fresh,repeated:es.length-fresh});
  }
  const all = analyse(run.publicEvents, raw, run.start, run.end);
  const publicMap = new Map(run.publicEvents.map(e => [e.id,e]));
  const lateEdges = run.publicProvenance.flatMap(e => (e.causedBy??[]).flatMap(id => {
    const parent=publicMap.get(id); return parent && e.occurredAt-parent.occurredAt>=3*DAY
      ? [{from:id,to:e.id,type:e.type,days:(e.occurredAt-parent.occurredAt)/DAY,
        contextExposed:Boolean(publicMap.get(e.id)?.contextBridge||publicMap.get(e.id)?.memoryCallback)}] : [];
  }));
  comparisons.push({seed:run.seed,baseline:Object.fromEntries(Object.entries(run.windows).map(([d,w])=>[d,compact(w)])),
    sameBaselineWithReaderPolicy:presentationOnly,
    afterCanonical:follow ? Object.fromEntries(Object.entries(follow.windows).map(([d,w])=>[d,compact(w)])) : null,
    afterReader:follow ? Object.fromEntries(Object.entries(follow.readerWindows).map(([d,w])=>[d,compact(w)])) : null,
    canonicalDigestChanged:follow ? follow.canonicalEventsDigest!==run.canonicalEventsDigest : null,
    families,dialogueByType,repeatByCategory,leadInterchangeableTemplates:{count:interchangeable.length,uses:interchangeable.reduce((n,r)=>n+r.uses,0),top:interchangeable.slice(0,10)},
    weeks, wakingGaps:all.wakingDevelopmentGaps.slice(0,5),
    ElsewhereFooterCount:run.publicEvents.filter(e=>!e.participants.some(p=>['goaden','ashai'].includes(p))).length,
    callbackOriginDetails:run.publicEvents.filter(e=>e.memoryCallback).length,
    contextBridges:run.publicEvents.filter(e=>e.contextBridge).length,
    laterThanThreeDays:{edges:lateEdges.length,byType:by(lateEdges,e=>e.type),withAccessibleOrigin:lateEdges.filter(e=>e.contextExposed).length,examples:lateEdges.slice(0,8)},
    returns:run.returns.filter(r=>r.now===run.start+180*HOUR).map(r=>({absenceHours:r.absenceHours,...r.latest40Only}))});
}
const out=resolve(root,'reports/new-viewer-measurements.json');
await writeFile(out,JSON.stringify({methodology:'Supplement to immutable baseline. Same-baseline reader-policy isolates presentation changes; afterCanonical includes intentional arc guard/cinematic repair. Near structure is conservative masking, not an NLP quality judgement. 07:00–22:00 waking gaps still only state-event proxies. Callback details are available collapsed surfaces, counted separately from main prose.',comparisons},null,2)+'\n');
console.log(JSON.stringify({out,afterIncluded:Boolean(after),runs:comparisons.map(c=>({seed:c.seed,baseline:c.baseline[30],sameLedgerReader:c.sameBaselineWithReaderPolicy[30],afterReader:c.afterReader?.[30],mirrors:c.leadInterchangeableTemplates.count,ElsewhereLabels:c.ElsewhereFooterCount,callbackOriginDetails:c.callbackOriginDetails,contextBridges:c.contextBridges,weeklyNovelty:c.weeks,maxWakingGap:c.wakingGaps[0]?.maximumHours}))}));
