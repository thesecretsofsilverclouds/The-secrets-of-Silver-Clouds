// Reviewed bindings for already-admitted legion_contracts rows.
// A scene without a row here must not narrate a job.
// future.legionjob.001–.030 stay inactive.

export const LEGION_CONTRACT_BINDINGS = Object.freeze({
  'legion_contracts.001': { stages: ['payment'], requirePaid: true },
  'legion_contracts.003': { stages: ['offer'] },
  'legion_contracts.005': { stages: ['payment'], requirePaid: true },
  'legion_contracts.006': { stages: ['report'] },
  'legion_contracts.012': { stages: ['offer'] },
  'legion_contracts.016': { stages: ['offer'] },
  'legion_contracts.018': { stages: ['payment'], requirePaid: true },
  'legion_contracts.022': { stages: ['report'] },
  'legion_contracts.023': { stages: ['offer'] },
  'legion_contracts.027': { stages: ['offer'] },
  'legion_contracts.030': { stages: ['payment'], requirePaid: true }
});
