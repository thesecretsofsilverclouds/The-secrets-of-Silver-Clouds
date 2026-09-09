// Only authored, committed public performance fields cross the reader boundary.
// Knowledge, eligibility, pending actions and unplayed scene text stay private.
import { dayPhase, daylightFraction } from './sky.mjs';

export function publicSceneBankPerformance(event) {
  if (event?.type !== 'SCENE_BANK_BEAT' || event.visibility !== 'public') return {};
  const payload = event.payload ?? {};
  const copy = source => (Array.isArray(source) ? source : []).flatMap(item => {
    if (!item || typeof item.text !== 'string' || !item.text.trim()
      || !['prose', 'dialogue'].includes(item.kind)) return [];
    return [{ text: item.text, kind: item.kind,
      ...(typeof item.who === 'string' ? { who: item.who } : {}),
      ...(typeof item.expression === 'string' ? { expression: item.expression } : {}),
      ...(typeof item.nimbusPlate === 'string' ? { nimbusPlate: item.nimbusPlate } : {}) }];
  });
  return { narrativeParagraphs: copy(payload.narrativeParagraphs), sceneBeats: copy(payload.sceneBeats),
    ...(Number.isSafeInteger(event.occurredAt) ? { sceneTime: {
      dayPhase: dayPhase(event.occurredAt), daylight: daylightFraction(event.occurredAt) } } : {}),
    ...(typeof payload.sceneTitle === 'string' ? { sceneTitle: payload.sceneTitle } : {}),
    ...(typeof payload.sceneBankId === 'string' ? { sceneBankId: payload.sceneBankId } : {}) };
}

export function sceneBankEditorial(event) {
  const performance = publicSceneBankPerformance(event);
  if (!performance.narrativeParagraphs?.length) return null;
  return { prose: performance.narrativeParagraphs.map(item => item.text).join('\n\n') };
}
