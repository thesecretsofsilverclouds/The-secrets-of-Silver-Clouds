/**
 * SqliteAdapter: Bridges Cloudflare Durable Object SQLite (ctx.storage.sql)
 * to the synchronous SQLite interface (prepare/get/all/run/exec) used across Worldstream.
 */

export class SqliteAdapter {
  constructor(storageSql) {
    if (!storageSql) {
      throw new TypeError('SqliteAdapter requires a Cloudflare DO ctx.storage.sql or compatible storage instance');
    }
    this.sql = storageSql;
    this._inTransaction = false;
    this.rowsReadTotal = 0;
    this.rowsWrittenTotal = 0;
    this.queriesTotal = 0;
  }

  get isTransaction() {
    return this._inTransaction;
  }

  /**
   * Execute raw SQL string. Handles multi-statement DDL/DML and tracks transaction state.
   */
  exec(sql) {
    if (typeof sql !== 'string') throw new TypeError('sql must be a string');
    this.queriesTotal++;

    // Track transaction lifecycle
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('BEGIN')) {
      this._inTransaction = true;
    } else if (normalized.startsWith('COMMIT') || normalized.startsWith('ROLLBACK')) {
      this._inTransaction = false;
    }

    // Filter out unsupported/unneeded pragmas in Cloudflare DO SQLite
    // DO SQLite handles its own WAL/synchronous settings internally.
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.toUpperCase().startsWith('PRAGMA'));

    if (statements.length === 0) return;

    for (const statement of statements) {
      try {
        const cursor = this.sql.exec(statement);
        if (cursor) {
          if (cursor.rowsRead) this.rowsReadTotal += cursor.rowsRead;
          if (cursor.rowsWritten) this.rowsWrittenTotal += cursor.rowsWritten;
        }
      } catch (err) {
        // If the statement is already within a transaction or commit on empty, handle gracefully
        if (err.message && (err.message.includes('cannot start a transaction within a transaction') ||
            err.message.includes('cannot rollback - no transaction is active'))) {
          // Sync transaction state
          if (normalized.startsWith('COMMIT') || normalized.startsWith('ROLLBACK')) {
            this._inTransaction = false;
          }
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Prepare a parameterized SQL statement with get(), all(), and run() semantics.
   */
  prepare(sql) {
    if (typeof sql !== 'string') throw new TypeError('sql must be a string');
    const self = this;

    return {
      get(...params) {
        self.queriesTotal++;
        const cursor = self.sql.exec(sql, ...params);
        if (cursor.rowsRead) self.rowsReadTotal += cursor.rowsRead;
        if (cursor.rowsWritten) self.rowsWrittenTotal += cursor.rowsWritten;

        // Return first row or undefined
        for (const row of cursor) {
          return row;
        }
        return undefined;
      },

      all(...params) {
        self.queriesTotal++;
        const cursor = self.sql.exec(sql, ...params);
        if (cursor.rowsRead) self.rowsReadTotal += cursor.rowsRead;
        if (cursor.rowsWritten) self.rowsWrittenTotal += cursor.rowsWritten;

        if (typeof cursor.toArray === 'function') {
          return cursor.toArray();
        }
        return [...cursor];
      },

      run(...params) {
        self.queriesTotal++;
        const cursor = self.sql.exec(sql, ...params);
        const written = cursor.rowsWritten ?? 0;
        const read = cursor.rowsRead ?? 0;
        self.rowsWrittenTotal += written;
        self.rowsReadTotal += read;

        return {
          changes: written,
          lastInsertRowid: cursor.lastInsertRowid ?? 0
        };
      }
    };
  }

  close() {
    // No-op: Cloudflare DO storage is managed by the CF runtime
  }

  getMetrics() {
    return {
      queriesTotal: this.queriesTotal,
      rowsReadTotal: this.rowsReadTotal,
      rowsWrittenTotal: this.rowsWrittenTotal
    };
  }
}

/**
 * Creates a mock ctx.storage.sql backed by a node:sqlite DatabaseSync instance.
 * Allows running Cloudflare DO SQLite code directly in standard Node.js test suites.
 */
export function createMockSqlStorage(nodeDb) {
  return {
    exec(query, ...bindings) {
      const trimmed = query.trim().toUpperCase();
      const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA');

      if (isSelect) {
        const stmt = nodeDb.prepare(query);
        const rows = stmt.all(...bindings);
        return {
          columnNames: rows.length > 0 ? Object.keys(rows[0]) : [],
          rowsRead: rows.length,
          rowsWritten: 0,
          toArray() { return rows; },
          one() {
            if (rows.length === 0) throw new Error('Result was empty, but one row was expected');
            return rows[0];
          },
          *[Symbol.iterator]() {
            for (const row of rows) yield row;
          }
        };
      } else {
        // DML / DDL statement
        try {
          const stmt = nodeDb.prepare(query);
          const result = stmt.run(...bindings);
          return {
            columnNames: [],
            rowsRead: 0,
            rowsWritten: result.changes ?? 1,
            lastInsertRowid: result.lastInsertRowid ?? 0,
            toArray() { return []; },
            one() { throw new Error('No rows returned'); },
            *[Symbol.iterator]() {}
          };
        } catch {
          // If multi-statement (e.g. schema exec)
          nodeDb.exec(query);
          return {
            columnNames: [],
            rowsRead: 0,
            rowsWritten: 1,
            toArray() { return []; },
            one() { throw new Error('No rows returned'); },
            *[Symbol.iterator]() {}
          };
        }
      }
    }
  };
}
