import { londonClock } from './time.mjs';

const hhmm = ms => {
  const { hour, minute } = londonClock(ms);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/**
 * Derives a discreet, selective 1-2 sentence context bridge for beats
 * that contain genuinely dependent referents absent from the immediate passage.
 * Strictly ignores ordinary independent routines (meals, training starts, general chat, travel).
 */
export function resolveContextBridge(event, lookup) {
  if (!event || !Array.isArray(event.causedBy) || !event.causedBy.length || typeof lookup !== 'function') {
    return null;
  }

  // 1. Ground Work Opportunity: carries forward why the outdoor yard is closed
  if (event.type === 'GROUND_WORK_OPPORTUNITY') {
    const parent = event.causedBy.map(lookup).find(p => p && (p.type === 'GROUND_RESTRICTION' || p.type === 'GROUND_PREPARED'));
    if (parent) {
      const snippet = parent.type === 'GROUND_PREPARED'
        ? 'Ashai had finished the ground preparations from the covered training floor.'
        : 'The outdoor training ground had been taken out of use for a safety check and preparations.';
      return {
        time: hhmm(parent.occurredAt),
        timeLabel: `Earlier · ${hhmm(parent.occurredAt)}`,
        snippet,
      };
    }
  }

  // 2. Ground Work Completion / Interruption: carries forward the ground work switch
  if (event.type === 'GROUND_WORK_COMPLETED' || event.type === 'GROUND_WORK_INTERRUPTED') {
    const parent = event.causedBy.map(lookup).find(p => p && p.type === 'GROUND_WORK_OPPORTUNITY');
    if (parent) {
      return {
        time: hhmm(parent.occurredAt),
        timeLabel: `Earlier · ${hhmm(parent.occurredAt)}`,
        snippet: 'Goaden and Ashai had switched plans to prepare the closed outdoor training yard themselves.',
      };
    }
  }

  // 3. Offscreen Projects: continuation/pass of an earlier attempt (e.g. Zara's handover note)
  if (event.type === 'OFFSCREEN_RESULT' || event.type === 'OFFSCREEN_UNFINISHED' || event.type === 'OFFSCREEN_RESUMED') {
    const parent = event.causedBy.map(lookup).find(p => p && (p.type === 'OFFSCREEN_START' || p.type === 'OFFSCREEN_RESUMED'));
    if (parent) {
      const isHandover = parent.publicDescription?.includes('handover') || parent.prose?.includes('handover')
        || event.publicDescription?.includes('handover') || event.prose?.includes('handover')
        || event.payload?.storyId === 'liaison_notes' || parent.payload?.storyId === 'liaison_notes';
      if (isHandover) {
        return {
          time: hhmm(parent.occurredAt),
          timeLabel: `Earlier · ${hhmm(parent.occurredAt)}`,
          snippet: 'Zara had returned to an ambiguous handover note in Operations and started another pass.',
        };
      }
      if (parent.publicDescription?.includes('Yukon') || event.publicDescription?.includes('Yukon')) {
        return {
          time: hhmm(parent.occurredAt),
          timeLabel: `Earlier · ${hhmm(parent.occurredAt)}`,
          snippet: 'Yukon had sat down for another attempt at the arcade game in the common room.',
        };
      }
      if (parent.publicDescription?.includes('swing') || event.publicDescription?.includes('swing') || parent.publicDescription?.includes('Emily')) {
        return {
          time: hhmm(parent.occurredAt),
          timeLabel: `Earlier · ${hhmm(parent.occurredAt)}`,
          snippet: 'Emily had returned to the courtyard swings to practice the slack chains.',
        };
      }
    }
  }

  // 4. Night Watch Debrief: carries forward the closed overnight readiness check in Operations
  if (event.type === 'NIGHT_DEBRIEF' || event.type === 'NIGHT_RECOVERED') {
    const parent = event.causedBy.map(lookup).find(p => p && p.type?.startsWith('NIGHT_') && p.type !== 'NIGHT_DEBRIEF' && p.type !== 'NIGHT_RECOVERED');
    if (parent) {
      return {
        time: hhmm(parent.occurredAt),
        timeLabel: `Earlier · ${hhmm(parent.occurredAt)}`,
        snippet: 'Goaden had finished the overnight readiness check in Operations and closed the outstanding watch entry.',
      };
    }
  }

  // 5. Supporting Story Callbacks: carrying forward an earlier encounter/commitment
  if (event.type === 'SUPPORTING_CALLBACK') {
    const parent = event.causedBy.map(lookup).find(p => p && (p.type === 'SUPPORTING_COMMITMENT' || p.type === 'SUPPORTING_ENCOUNTER'));
    if (parent) {
      if (parent.publicDescription?.includes('windowsill') || event.publicDescription?.includes('windowsill') || event.prose?.includes('windowsill')) {
        return {
          time: hhmm(parent.occurredAt),
          timeLabel: `Earlier · ${hhmm(parent.occurredAt)}`,
          snippet: 'Greah had settled on the windowsill to wait for Ashai.',
        };
      }
    }
  }

  return null;
}
