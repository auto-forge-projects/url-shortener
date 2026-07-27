'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../src/rate-limiter');

// TASK-006 / SEC-4 — in-memory token bucket, keyed by client IP.

test('allows requests up to the burst limit within the window', () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 3 });
  const key = '1.2.3.4';
  assert.equal(limiter.check(key).allowed, true);
  assert.equal(limiter.check(key).allowed, true);
  assert.equal(limiter.check(key).allowed, true);
});

test('rejects once the limit is exceeded within the window and reports retryAfterSec', () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
  const key = '5.6.7.8';
  assert.equal(limiter.check(key).allowed, true);
  assert.equal(limiter.check(key).allowed, true);
  const third = limiter.check(key);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterSec > 0);
});

test('different keys (IPs) have independent buckets', () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 1 });
  assert.equal(limiter.check('a').allowed, true);
  assert.equal(limiter.check('b').allowed, true);
  assert.equal(limiter.check('a').allowed, false);
});

test('counters reset after the window elapses (TTL cleanup, no unbounded growth)', async () => {
  const limiter = createRateLimiter({ windowMs: 20, max: 1 });
  const key = 'ttl-test';
  assert.equal(limiter.check(key).allowed, true);
  assert.equal(limiter.check(key).allowed, false);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(limiter.check(key).allowed, true);
});

test('size() reflects tracked keys and shrinks after expiry (memory-leak defense)', async () => {
  const limiter = createRateLimiter({ windowMs: 20, max: 1 });
  limiter.check('k1');
  limiter.check('k2');
  assert.equal(limiter.size(), 2);
  await new Promise((resolve) => setTimeout(resolve, 30));
  limiter.check('k3'); // triggers opportunistic cleanup
  assert.ok(limiter.size() <= 2, `expected stale keys to be pruned, size=${limiter.size()}`);
});
