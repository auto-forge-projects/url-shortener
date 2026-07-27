'use strict';

// TASK-004: SqliteLinkStore adapter — implements the LinkStore port
// (docs/05-architecture.md) on top of node:sqlite.
//
// - DDL is idempotent (CREATE TABLE IF NOT EXISTS).
// - Only prepared statements with bound parameters are used — never string
//   concatenation (docs/07-security.md SEC-6). `INSERT OR REPLACE` is
//   forbidden: a duplicate `code` MUST throw so LinkService can retry.
// - node:sqlite (`DatabaseSync`) is experimental in this Node version but is
//   the Faz 4/5 architecture decision (DL-04-001).

const { DatabaseSync } = require('node:sqlite');

const DDL = `CREATE TABLE IF NOT EXISTS links (
  code TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL
);`;

/**
 * @param {string} dbPath ':memory:' for tests, or a filesystem path (DB_PATH env in production)
 * @returns {import('./link-store').LinkStore & { close: () => void }}
 */
function createSqliteLinkStore(dbPath) {
  const db = new DatabaseSync(dbPath);

  // WAL + NORMAL synchronous per docs/05-architecture.md (durability vs.
  // latency trade-off for a single-writer service). `:memory:` databases
  // ignore/no-op unsupported pragmas harmlessly.
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  } catch {
    // Some environments (e.g. :memory:) may reject WAL — safe to ignore,
    // it is a performance tuning, not a correctness requirement.
  }

  db.exec(DDL);

  const insertStmt = db.prepare('INSERT INTO links (code, url, created_at) VALUES (?, ?, ?)');
  const selectStmt = db.prepare('SELECT url FROM links WHERE code = ?');

  return {
    /**
     * @param {string} code
     * @returns {string|null}
     */
    get(code) {
      const row = selectStmt.get(code);
      return row ? row.url : null;
    },

    /**
     * @param {string} code
     * @param {string} url
     * @returns {void}
     * @throws if `code` already exists (unique constraint violation)
     */
    put(code, url) {
      insertStmt.run(code, url, Date.now());
    },

    /** Releases the underlying database handle (used by tests/shutdown). */
    close() {
      db.close();
    }
  };
}

module.exports = { createSqliteLinkStore };
