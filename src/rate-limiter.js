'use strict';

// TASK-006: SEC-4 — in-memory sliding/fixed-window rate limiter keyed by
// client IP. Counters carry a TTL so the map cannot grow unbounded (memory
// leak defense). Not distributed — single-process is sufficient per
// docs/05-architecture.md (single-process, no external cache).

/**
 * @param {{ windowMs: number, max: number }} opts
 */
function createRateLimiter({ windowMs, max }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const buckets = new Map();

  function pruneExpired(now) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return {
    /**
     * @param {string} key
     * @returns {{ allowed: boolean, retryAfterSec: number }}
     */
    check(key) {
      const now = Date.now();
      // Opportunistic cleanup — bounded cost, keeps the map from growing
      // forever when many distinct IPs churn through.
      pruneExpired(now);

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }

      bucket.count += 1;

      if (bucket.count > max) {
        const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        return { allowed: false, retryAfterSec };
      }
      return { allowed: true, retryAfterSec: 0 };
    },

    /** @returns {number} number of tracked keys (for tests/observability) */
    size() {
      return buckets.size;
    }
  };
}

module.exports = { createRateLimiter };
