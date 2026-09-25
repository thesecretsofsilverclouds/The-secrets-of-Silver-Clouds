import { createHash, timingSafeEqual } from 'node:crypto';

// This module deliberately imports no world runtime. Loading it cannot create
// canonical tables, advance a world, poll weather, or schedule a writer alarm.
export const MAINTENANCE_PREFIX = '__worldstream_ops_v1/';
export const MAINTENANCE_CONTROL_KEY = `${MAINTENANCE_PREFIX}control`;
export const MAINTENANCE_IMPORT_KEY = `${MAINTENANCE_PREFIX}import`;
const PAGE_SIZE = 128;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_KV_SNAPSHOT_BYTES = 1024 * 1024;
const MAX_CURRENT_KV_ENTRIES = 256;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const quote = name => `"${String(name).replaceAll('"', '""')}"`;
const rows = cursor => typeof cursor.toArray === 'function' ? cursor.toArray() : [...cursor];
const response = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
class OpsError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}
const demand = (condition, message, status) => { if (!condition) throw new OpsError(message, status); };

export function encodeMaintenanceValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    demand(Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)), 'Unsafe numeric export');
    return value;
  }
  if (typeof value === 'bigint') return { $type: 'bigint', value: String(value) };
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return { $type: 'bytes', base64: Buffer.from(bytes).toString('base64') };
  }
  if (value instanceof Date) return { $type: 'date', value: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeMaintenanceValue);
  if (value instanceof Map) return { $type: 'map', entries: [...value].map(([k, v]) => [encodeMaintenanceValue(k), encodeMaintenanceValue(v)]) };
  if (value instanceof Set) return { $type: 'set', values: [...value].map(encodeMaintenanceValue) };
  if (value === undefined) return { $type: 'undefined' };
  demand(value && Object.getPrototypeOf(value) === Object.prototype, 'Unsupported KV value type');
  return { $type: 'object', entries: Object.entries(value).map(([key, v]) => [key, encodeMaintenanceValue(v)]) };
}

export function decodeMaintenanceValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    demand(Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)), 'Unsafe imported number', 400);
    return value;
  }
  if (Array.isArray(value)) return value.map(decodeMaintenanceValue);
  demand(value && typeof value === 'object', 'Invalid encoded value', 400);
  switch (value.$type) {
    case 'bytes': {
      demand(typeof value.base64 === 'string' && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.base64), 'Invalid blob encoding', 400);
      return Uint8Array.from(Buffer.from(value.base64, 'base64')).buffer;
    }
    case 'bigint': demand(typeof value.value === 'string' && /^-?\d+$/.test(value.value), 'Invalid bigint', 400); return BigInt(value.value);
    case 'date': demand(typeof value.value === 'string' && Number.isFinite(Date.parse(value.value)), 'Invalid date', 400); return new Date(value.value);
    case 'undefined': return undefined;
    case 'set': demand(Array.isArray(value.values), 'Invalid set', 400); return new Set(value.values.map(decodeMaintenanceValue));
    case 'map': demand(Array.isArray(value.entries), 'Invalid map', 400); return new Map(value.entries.map(([k, v]) => [decodeMaintenanceValue(k), decodeMaintenanceValue(v)]));
    case 'object': {
      demand(Array.isArray(value.entries) && value.entries.every(e => Array.isArray(e) && e.length === 2 && typeof e[0] === 'string'), 'Invalid object', 400);
      demand(new Set(value.entries.map(e => e[0])).size === value.entries.length, 'Duplicate object key', 400);
      return Object.fromEntries(value.entries.map(([k, v]) => [k, decodeMaintenanceValue(v)]));
    }
    default: throw new OpsError('Unknown typed value', 400);
  }
}

function schemaEntries(storage) {
  return rows(storage.sql.exec("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT GLOB '_cf_*' AND name NOT GLOB '__cf_*' AND name NOT GLOB 'sqlite_*' AND type IN ('table','index','trigger','view') ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END,name"));
}
function tableInfo(storage, name) {
  demand(schemaEntries(storage).some(row => row.type === 'table' && row.name === name), 'Unknown export table', 404);
  const info = rows(storage.sql.exec(`PRAGMA table_xinfo(${quote(name)})`));
  let columns = info.filter(column => !column.hidden).map(column => column.name);
  const primary = info.filter(column => column.pk > 0).sort((a, b) => a.pk - b.pk).map(column => column.name);
  const orderBy = primary.length ? primary : ['rowid'];
  // Fail explicitly on unsupported shadowed rowids, rather than silently
  // changing deterministic order between export, import and verification.
  demand(primary.length || !info.some(column => ['rowid', '_rowid_', 'oid'].includes(column.name.toLowerCase())), 'A table without a primary key shadows rowid');
  if (!primary.length) columns = ['rowid', ...columns];
  const rowCount = rows(storage.sql.exec(`SELECT count(*) AS n FROM ${quote(name)}`))[0].n;
  return { name, columns, orderBy, rowCount };
}
function exportTable(storage, name, offset = 0, limit = PAGE_SIZE) {
  demand(Number.isSafeInteger(offset) && offset >= 0 && Number.isSafeInteger(limit) && limit >= 1 && limit <= PAGE_SIZE, 'Invalid page bounds', 400);
  const info = tableInfo(storage, name);
  const records = rows(storage.sql.exec(`SELECT ${info.columns.map(quote).join(',')} FROM ${quote(name)} ORDER BY ${info.orderBy.map(quote).join(',')} LIMIT ? OFFSET ?`, limit, offset));
  const values = records.map(row => info.columns.map(column => encodeMaintenanceValue(row[column])));
  return { ...info, offset, rows: values, nextOffset: offset + values.length, done: offset + values.length >= info.rowCount };
}
function fingerprintTable(storage, name, maximumRows = Infinity) {
  const hash = createHash('sha256');
  let offset = 0, bytes = 0;
  while (true) {
    if (offset >= maximumRows) return { rowCount: offset, sha256: hash.digest('hex'), bytes };
    const page = exportTable(storage, name, offset, Math.min(PAGE_SIZE, maximumRows - offset));
    for (const row of page.rows) { const text = JSON.stringify(row) + '\n'; hash.update(text); bytes += Buffer.byteLength(text); }
    offset = page.nextOffset;
    if (page.done) return { rowCount: offset, sha256: hash.digest('hex'), bytes };
  }
}
function identity(storage) {
  if (!schemaEntries(storage).some(row => row.type === 'table' && row.name === 'world_state')) return null;
  const records = rows(storage.sql.exec('SELECT seed,rules_version,resolved_through FROM world_state'));
  demand(records.length <= 1, 'Ambiguous canonical world state');
  return records.length ? { seed: records[0].seed, rulesVersion: records[0].rules_version, resolvedThrough: records[0].resolved_through } : null;
}
function sameIdentity(actual, expected) {
  return actual && expected && actual.seed === expected.seed && actual.rulesVersion === expected.rulesVersion
    && actual.resolvedThrough === expected.resolvedThrough;
}
function validExpected(expected) {
  return expected && typeof expected.seed === 'string' && expected.seed.length > 0
    && typeof expected.rulesVersion === 'string' && expected.rulesVersion.length > 0
    && Number.isSafeInteger(expected.resolvedThrough);
}
function validateSchema(schema) {
  demand(Array.isArray(schema) && schema.length > 0 && schema.length <= 256, 'A bounded complete schema is required', 400);
  const names = new Set();
  for (const entry of schema) {
    demand(entry && ['table', 'index', 'trigger', 'view'].includes(entry.type)
      && typeof entry.name === 'string' && entry.name.length && !/^(_cf_|__cf_|sqlite_)/i.test(entry.name)
      && typeof entry.tbl_name === 'string' && typeof entry.sql === 'string' && entry.sql.length <= 256 * 1024
      && !names.has(entry.name), 'Invalid or duplicate schema entry', 400);
    names.add(entry.name);
    const words = entry.sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[(?:[^\]])*\]|--[^\n]*|\/\*[\s\S]*?\*\//g, ' ');
    demand(new RegExp(`^\\s*CREATE\\s+(?:UNIQUE\\s+)?${entry.type}\\b`, 'i').test(words)
      && (words.match(/\bCREATE\b/gi) ?? []).length === 1
      && !/\b(?:ATTACH|DETACH|DROP|ALTER|PRAGMA|VACUUM|REINDEX|load_extension)\b/i.test(words)
      && !/_cf_/i.test(entry.sql), 'Only one exact CREATE schema definition is permitted', 400);
    const withoutConstraints = words.replace(/\bON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|RESTRICT|NO\s+ACTION|SET\s+(?:NULL|DEFAULT))\b/gi, ' ')
      .replace(/\bON\s+CONFLICT\s+(?:ROLLBACK|ABORT|FAIL|IGNORE|REPLACE)\b/gi, ' ');
    if (entry.type !== 'trigger') demand(!/\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(withoutConstraints), 'Unexpected DML in schema definition', 400);
  }
}
async function body(request) {
  const raw = await request.text();
  demand(Buffer.byteLength(raw) <= MAX_BODY_BYTES, 'Request body too large', 413);
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new OpsError('Malformed JSON', 400); }
}

export function createMaintenanceController(ctx, env = {}) {
  const storage = ctx.storage;
  let tail = Promise.resolve();
  const exclusive = fn => { const result = tail.then(fn); tail = result.catch(() => {}); return result; };
  const readControl = () => storage.get(MAINTENANCE_CONTROL_KEY);
  async function authorize(request) {
    const configured = typeof env.WORLD_OPS_TOKEN_SHA256 === 'string' && /^[a-f0-9]{64}$/i.test(env.WORLD_OPS_TOKEN_SHA256);
    const match = /^Bearer ([^\s]{1,4096})$/.exec(request.headers.get('Authorization') ?? '');
    const actual = Buffer.from(sha256(match?.[1] ?? ''), 'hex');
    const expected = Buffer.from(configured ? env.WORLD_OPS_TOKEN_SHA256 : '0'.repeat(64), 'hex');
    return timingSafeEqual(actual, expected) && Boolean(configured && match);
  }
  async function isPaused() {
    const control = await readControl();
    if (typeof control?.paused === 'boolean') return control.paused;
    return ![false, 'false'].includes(env.WORLD_WRITER_PAUSED);
  }
  async function pause() {
    let control = await readControl();
    if (!control) {
      demand(typeof storage.getCurrentBookmark === 'function', 'PITR bookmark API is required before mutation', 503);
      const [bookmark, originalAlarm, kvMap] = await Promise.all([storage.getCurrentBookmark(), storage.getAlarm(), storage.list()]);
      demand(typeof bookmark === 'string' && bookmark.length > 0, 'A pre-mutation PITR bookmark is required', 503);
      const kv = [...kvMap].filter(([key]) => !key.startsWith(MAINTENANCE_PREFIX)).map(([key, value]) => ({ key, value: encodeMaintenanceValue(value) }));
      demand(Buffer.byteLength(JSON.stringify(kv)) <= MAX_KV_SNAPSHOT_BYTES, 'Pre-ops KV snapshot exceeds safe control size', 413);
      control = { version: 1, paused: true, originalAlarm, bookmark, kv, capturedIdentity: identity(storage) };
      // The durable recovery record commits before the first alarm deletion.
      await storage.put(MAINTENANCE_CONTROL_KEY, control);
    } else if (!control.paused) {
      control = { ...control, paused: true };
      await storage.put(MAINTENANCE_CONTROL_KEY, control);
    }
    await storage.deleteAlarm();
    return { paused: true, originalAlarm: control.originalAlarm, bookmark: control.bookmark, identity: identity(storage) };
  }
  async function status() {
    const control = await readControl(), imported = await storage.get(MAINTENANCE_IMPORT_KEY);
    return { paused: await isPaused(), captured: Boolean(control), bookmark: control?.bookmark ?? null,
      originalAlarm: control?.originalAlarm ?? null, currentAlarm: await storage.getAlarm(), identity: identity(storage),
      userTables: schemaEntries(storage).filter(row => row.type === 'table').length,
      importStatus: imported?.status ?? null, expected: imported?.resumeExpected ?? imported?.expected ?? null,
      importExpected: imported?.expected ?? null,
      allowResume: env.WORLD_OPS_ALLOW_RESUME === 'true' };
  }
  async function requirePause() { demand(await isPaused(), 'Pause the writer before export or import'); }
  async function currentStorage() {
    demand(await storage.getAlarm() === null, 'Remove the writer alarm before exporting current storage');
    demand(typeof storage.getCurrentBookmark === 'function', 'PITR bookmark API is required for current storage export', 503);
    const kvMap = await storage.list({ limit: MAX_CURRENT_KV_ENTRIES + 1 });
    demand(kvMap.size <= MAX_CURRENT_KV_ENTRIES, 'Current KV entry count exceeds safe export size', 413);
    const allKv = [...kvMap].map(([key, value]) => ({ key, value: encodeMaintenanceValue(value) }));
    const bookmark = await storage.getCurrentBookmark();
    demand(typeof bookmark === 'string' && bookmark.length > 0, 'A current PITR bookmark is required', 503);
    // Recovery records are exported verbatim, never refreshed. Only userKv may
    // be supplied to a new candidate's import; its own recovery records differ.
    const snapshot = { format: 1, bookmark, identity: identity(storage), currentAlarm: null,
      allKv, userKv: allKv.filter(({ key }) => !key.startsWith(MAINTENANCE_PREFIX)) };
    demand(Buffer.byteLength(JSON.stringify(snapshot)) <= MAX_KV_SNAPSHOT_BYTES, 'Current storage snapshot exceeds safe export size', 413);
    await requirePause();
    demand(await storage.getAlarm() === null, 'Writer alarm changed during current storage export');
    return snapshot;
  }
  // Trusted wrapper operation, called under .exclusive only after its own
  // authenticated, explicitly allowed advance. Original copy fingerprints are
  // retained; the event prefix must remain byte-for-byte identical.
  async function recordSmokeAdvance({ before, after, targetMs }) {
    demand(env.WORLD_OPS_ALLOW_ADVANCE === 'true', 'Controlled advancement is disabled');
    await requirePause();
    const imported = await storage.get(MAINTENANCE_IMPORT_KEY), actualIdentity = identity(storage);
    demand(imported?.status === 'verified', 'Controlled advancement requires a verified import');
    const previous = imported.resumeExpected ?? imported.expected;
    demand(Number.isSafeInteger(before) && Number.isSafeInteger(after) && after >= before && targetMs === after
      && before === previous.resolvedThrough && actualIdentity?.resolvedThrough === after
      && actualIdentity.seed === previous.seed && actualIdentity.rulesVersion === previous.rulesVersion, 'Controlled advance identity mismatch');
    const fingerprints = imported.resumeFingerprints ?? imported.tableFingerprints;
    if (fingerprints.events) {
      const prefix = fingerprintTable(storage, 'events', fingerprints.events.rowCount);
      demand(prefix.sha256 === fingerprints.events.sha256 && prefix.rowCount === fingerprints.events.rowCount, 'Controlled advance rewrote preserved event history');
    }
    const actual = Object.fromEntries(Object.keys(imported.tableFingerprints).map(name => [name, fingerprintTable(storage, name)]));
    await storage.put(MAINTENANCE_IMPORT_KEY, { ...imported, resumeExpected: actualIdentity, resumeFingerprints: actual,
      smokeAdvances: [...(imported.smokeAdvances ?? []), { before, after, targetMs }].slice(-4) });
    return { expected: actualIdentity, tableFingerprints: actual };
  }
  async function handle(request) {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/__ops/')) return await isPaused() ? response({ error: 'World maintenance in progress' }, 503) : null;
    if (!await authorize(request)) return response({ error: 'Unauthorized' }, 401);
    return exclusive(async () => {
      try {
        if (path === '/__ops/status') { demand(request.method === 'GET', 'GET required', 405); return response(await status()); }
        if (path === '/__ops/pause') { demand(request.method === 'POST', 'POST required', 405); return response(await pause()); }
        if (path.startsWith('/__ops/export/')) {
          demand(request.method === 'GET', 'GET required', 405); await requirePause();
          demand(await readControl(), 'Capture the pause checkpoint before exporting');
          if (path === '/__ops/export/current-storage') return response(await currentStorage());
          if (path === '/__ops/export/kv') return response({ kv: (await readControl()).kv });
          if (path === '/__ops/export/schema') {
            const schema = schemaEntries(storage);
            return response({ format: 1, schema, tables: schema.filter(e => e.type === 'table').map(e => tableInfo(storage, e.name)) });
          }
          if (path === '/__ops/export/table') return response(exportTable(storage, url.searchParams.get('name'),
            Number(url.searchParams.get('offset') ?? 0), Number(url.searchParams.get('limit') ?? PAGE_SIZE)));
          return null;
        }
        if (path.startsWith('/__ops/import/')) {
          demand(request.method === 'POST', 'POST required', 405); await requirePause();
          const input = await body(request);
          let imported = await storage.get(MAINTENANCE_IMPORT_KEY);
          if (path === '/__ops/import/start') {
            demand(!imported && schemaEntries(storage).length === 0 && !identity(storage), 'Import target must be unused and contain zero user tables');
            validateSchema(input.schema);
            demand(validExpected(input.expected), 'Exact expected seed, rules and watermark are required', 400);
            const names = input.schema.filter(e => e.type === 'table').map(e => e.name).sort();
            const fingerprints = input.tableFingerprints;
            demand(fingerprints && JSON.stringify(Object.keys(fingerprints).sort()) === JSON.stringify(names), 'Every imported table requires a fingerprint', 400);
            for (const name of names) demand(Number.isSafeInteger(fingerprints[name]?.rowCount) && fingerprints[name].rowCount >= 0
              && /^[a-f0-9]{64}$/.test(fingerprints[name].sha256), 'Invalid expected table fingerprint', 400);
            demand(Array.isArray(input.kv) && input.kv.every(row => typeof row.key === 'string' && !row.key.startsWith(MAINTENANCE_PREFIX))
              && new Set(input.kv.map(row => row.key)).size === input.kv.length, 'Invalid imported KV', 400);
            const decodedKV = input.kv.map(row => [row.key, decodeMaintenanceValue(row.value)]);
            const existingKV = [...await storage.list()].filter(([key]) => !key.startsWith(MAINTENANCE_PREFIX));
            demand(existingKV.length === 0, 'Import target already contains user KV');
            demand(typeof storage.transactionSync === 'function', 'Atomic SQLite batches require transactionSync', 503);
            await pause();
            imported = { version: 1, status: 'loading', expected: input.expected, schema: input.schema,
              tableFingerprints: fingerprints, kvHash: sha256(JSON.stringify(input.kv)) };
            await storage.put(MAINTENANCE_IMPORT_KEY, imported);
            storage.transactionSync(() => { for (const entry of input.schema.filter(e => e.type === 'table')) storage.sql.exec(entry.sql); });
            demand(JSON.stringify(schemaEntries(storage).filter(e => e.type === 'table').map(e => e.name).sort()) === JSON.stringify(names), 'Schema created unexpected tables');
            for (const [key, value] of decodedKV) await storage.put(key, value);
            return response({ status: 'loading', tables: names });
          }
          demand(imported?.status === 'loading', 'No unfinished import');
          if (path === '/__ops/import/rows') {
            demand(Object.hasOwn(imported.tableFingerprints, input.table), 'Unknown import table', 400);
            const info = tableInfo(storage, input.table), expected = imported.tableFingerprints[input.table];
            demand(Number.isSafeInteger(input.offset) && input.offset === info.rowCount, 'Chunk offset does not match the appended row count');
            demand(Array.isArray(input.rows) && input.rows.length > 0 && input.rows.length <= PAGE_SIZE
              && info.rowCount + input.rows.length <= expected.rowCount, 'Invalid or excessive row batch', 400);
            const decoded = input.rows.map(row => {
              demand(Array.isArray(row) && row.length === info.columns.length, 'Column count mismatch', 400);
              return row.map(value => { const decoded = decodeMaintenanceValue(value);
                demand(decoded === null || typeof decoded === 'string' || typeof decoded === 'number' || decoded instanceof ArrayBuffer, 'Unsupported SQL value', 400);
                return decoded;
              });
            });
            const sql = `INSERT INTO ${quote(input.table)} (${info.columns.map(quote).join(',')}) VALUES (${info.columns.map(() => '?').join(',')})`;
            storage.transactionSync(() => { for (const row of decoded) storage.sql.exec(sql, ...row); });
            return response({ table: input.table, nextOffset: info.rowCount + decoded.length });
          }
          if (path === '/__ops/import/finish') {
            demand(sameIdentity(identity(storage), imported.expected), 'Imported world identity does not match the expected seed, rules and watermark');
            const actual = {};
            for (const [name, expected] of Object.entries(imported.tableFingerprints)) {
              actual[name] = fingerprintTable(storage, name);
              demand(actual[name].rowCount === expected.rowCount && actual[name].sha256 === expected.sha256, `Fingerprint mismatch for table ${name}`);
            }
            storage.transactionSync(() => { for (const entry of imported.schema.filter(e => e.type !== 'table')) storage.sql.exec(entry.sql); });
            const actualSchema = schemaEntries(storage).map(e => ({ type: e.type, name: e.name, tbl_name: e.tbl_name, sql: e.sql }));
            const canonicalSchema = entries => JSON.stringify([...entries].sort((a, b) => a.name.localeCompare(b.name)));
            demand(canonicalSchema(actualSchema) === canonicalSchema(imported.schema), 'Imported schema differs from source');
            const importedKV = [...await storage.list()].filter(([key]) => !key.startsWith(MAINTENANCE_PREFIX)).map(([key, value]) => ({ key, value: encodeMaintenanceValue(value) }));
            demand(sha256(JSON.stringify(importedKV)) === imported.kvHash, 'Imported KV differs from source');
            await storage.put(MAINTENANCE_IMPORT_KEY, { ...imported, status: 'verified', verifiedFingerprints: actual });
            return response({ status: 'verified', identity: identity(storage), tableFingerprints: actual });
          }
          return null;
        }
        if (path === '/__ops/resume') {
          demand(request.method === 'POST', 'POST required', 405);
          demand(env.WORLD_OPS_ALLOW_RESUME === 'true', 'Resume is disabled for this deployment');
          const input = await body(request), imported = await storage.get(MAINTENANCE_IMPORT_KEY);
          demand(input.smokeValidated === true && imported?.status === 'verified', 'A verified import and explicit smoke validation are required');
          demand(sameIdentity(identity(storage), imported.resumeExpected ?? imported.expected) && sameIdentity(identity(storage), input.expected), 'Resume identity mismatch');
          for (const [name, expected] of Object.entries(imported.resumeFingerprints ?? imported.tableFingerprints)) {
            demand(input.tableFingerprints?.[name]?.sha256 === expected.sha256
              && input.tableFingerprints[name].rowCount === expected.rowCount, `External fingerprint confirmation missing for ${name}`);
            const actual = fingerprintTable(storage, name);
            demand(actual.sha256 === expected.sha256 && actual.rowCount === expected.rowCount, `Post-verification data changed in ${name}`);
          }
          const control = await readControl(); demand(control, 'Missing recovery checkpoint');
          await storage.put(MAINTENANCE_CONTROL_KEY, { ...control, paused: false });
          return response({ paused: false, identity: identity(storage) });
        }
        return null;
      } catch (error) { return response({ error: error.message }, error.status ?? 500); }
    });
  }
  return { handle, authorize, isPaused, pause, status, exclusive, recordSmokeAdvance };
}

/** Temporary maintenance-only replacement: never imports/constructs a runtime. */
export class MaintenanceDurableObject {
  constructor(ctx, env = {}) { this.control = createMaintenanceController(ctx, env); }
  async fetch(request) { return await this.control.handle(request) ?? response({ error: 'Maintenance controller only' }, 503); }
  async alarm() { await this.control.pause(); }
}
