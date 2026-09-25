// Pure validation shared by offline migrations and the controlled reader. An
// absent feature is permitted only while its exact owned activation is pending.
export function assertProspectiveActivation({ state, pending, resolvedThrough, field, from, to, type, prefix }) {
  const receipts = (state.meta.upgrades ?? []).filter(item => item.to === to);
  const actions = pending.map(row => ({ row, action: JSON.parse(row.action_json) }))
    .filter(({ action, row }) => action.type === type || row.id.startsWith(`${prefix}/`));
  const bag = state[field];
  if (receipts.length === 0 && bag) {
    if (actions.length || bag.activatedAt > resolvedThrough) throw new Error(`Invalid ${field} activation state`);
    return null; // Fresh worlds begin with an active bag and no upgrade receipt.
  }
  const receipt = receipts[0];
  if (receipts.length !== 1 || receipt.from !== from || !Number.isSafeInteger(receipt.cutoverAt)
    || receipt.cutoverAt < state.meta.startMs || receipt.cutoverAt > resolvedThrough
    || receipt.activationActionId !== `${prefix}/${receipt.cutoverAt}`
    || !/^[a-f0-9]{64}$/.test(receipt.historicalLedgerDigest ?? '')
    || !/^[a-f0-9]{64}$/.test(receipt.backupSha256 ?? '')) throw new Error(`Invalid ${field} upgrade receipt`);
  if (Object.hasOwn(receipt, 'activatedAt')) {
    if (receipt.activatedAt !== receipt.cutoverAt + 1 || receipt.activatedAt > resolvedThrough
      || !bag || bag.activatedAt !== receipt.activatedAt || actions.length)
      throw new Error(`Invalid ${field} completed activation`);
  } else {
    const entry = actions[0];
    if (Object.hasOwn(state, field) || actions.length !== 1 || entry.row.id !== receipt.activationActionId
      || entry.action.id !== entry.row.id || entry.action.type !== type
      || entry.row.due_at !== receipt.cutoverAt + 1 || entry.action.dueAt !== entry.row.due_at
      || entry.row.priority !== -1 || entry.action.priority !== -1 || entry.row.due_at <= resolvedThrough)
      throw new Error(`Invalid ${field} pending activation`);
  }
  return receipt;
}

export const NARRATIVE_ACTIVATION = Object.freeze({ field: 'narrativeSignals', from: 'canon-ambient-p183-v28',
  to: 'canon-ambient-p183-v29', type: 'WORLD_NARRATIVE_ACTIVATE', prefix: 'narrative-v29/activate' });
export const RHYTHM_ACTIVATION = Object.freeze({ field: 'rhythm', from: 'canon-ambient-p183-v29',
  to: 'canon-ambient-p183-v30', type: 'WORLD_RHYTHM_ACTIVATE', prefix: 'rhythm-v30/activate' });
