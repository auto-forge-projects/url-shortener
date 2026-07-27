'use strict';

// TASK-005: LinkService — orchestrates CodeGenerator + LinkStore.
// Retries up to MAX_RETRIES times on a code collision (NFR-4 defense in
// depth on top of the store's PK uniqueness); gives up with a thrown error
// if the code space is (improbably) exhausted (docs/05-architecture.md:
// "tükenirse 500").

const MAX_RETRIES = 3;

/**
 * @param {{ store: import('./link-store').LinkStore, generateCode: () => string }} deps
 */
function createLinkService({ store, generateCode }) {
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') {
    throw new TypeError('LinkService requires a LinkStore (get/put)');
  }
  if (typeof generateCode !== 'function') {
    throw new TypeError('LinkService requires a generateCode() function');
  }

  return {
    /**
     * Generates a fresh code and persists (code, url). Retries on PK
     * collision up to MAX_RETRIES times.
     *
     * @param {string} url already-validated absolute URL (SEC-1 upstream)
     * @returns {{ code: string }}
     * @throws if the code space could not yield a free code within the retry budget
     */
    shorten(url) {
      let lastError;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const code = generateCode();
        try {
          store.put(code, url);
          return { code };
        } catch (err) {
          lastError = err;
          // collision — loop and retry with a freshly generated code
        }
      }
      const exhausted = new Error('code_space_exhausted');
      exhausted.cause = lastError;
      throw exhausted;
    },

    /**
     * @param {string} code
     * @returns {string|null}
     */
    lookup(code) {
      return store.get(code);
    }
  };
}

module.exports = { createLinkService, MAX_RETRIES };
