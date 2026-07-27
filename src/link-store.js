'use strict';

/**
 * LinkStore port (hexagonal architecture boundary — docs/05-architecture.md).
 *
 * An adapter (e.g. SqliteLinkStore) MUST implement:
 *
 * @typedef {Object} LinkStore
 * @property {(code: string) => (string|null)} get
 *   Returns the stored URL for `code`, or `null` if the code does not exist.
 *   MUST NOT throw for an unknown code — only return `null` (FR-2/404 path).
 * @property {(code: string, url: string) => void} put
 *   Inserts a new (code, url) pair. MUST throw (not silently overwrite) when
 *   `code` already exists — NFR-4 relies on a hard uniqueness violation so
 *   LinkService can detect a collision and retry. `INSERT OR REPLACE` is
 *   forbidden (docs/07-security.md SEC-6).
 *
 * Only these two operations cross the port — no HTTP types, no SQL, no
 * transport concerns leak past this boundary (docs/05-architecture.md
 * "Katman kuralı").
 */

/**
 * Runtime contract check for a LinkStore adapter. Throws a descriptive
 * TypeError when `store` does not satisfy the LinkStore port shape.
 *
 * @param {*} store
 * @returns {void}
 */
function assertLinkStore(store) {
  if (!store || typeof store !== 'object') {
    throw new TypeError('LinkStore: expected an object implementing get(code)/put(code,url)');
  }
  if (typeof store.get !== 'function') {
    throw new TypeError('LinkStore: missing required method get(code)');
  }
  if (typeof store.put !== 'function') {
    throw new TypeError('LinkStore: missing required method put(code, url)');
  }
}

module.exports = { assertLinkStore };
