'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertLinkStore } = require('../src/link-store');
const { createSqliteLinkStore } = require('../src/sqlite-link-store');

// TASK-004 / FR-1 / FR-2 / NFR-4 / SEC-6

test('createSqliteLinkStore(:memory:) satisfies the LinkStore port contract', () => {
  const store = createSqliteLinkStore(':memory:');
  assert.doesNotThrow(() => assertLinkStore(store));
});

test('put() then get() returns the stored url', () => {
  const store = createSqliteLinkStore(':memory:');
  store.put('abc1234', 'https://example.com/');
  assert.equal(store.get('abc1234'), 'https://example.com/');
});

test('get() returns null for an unknown code', () => {
  const store = createSqliteLinkStore(':memory:');
  assert.equal(store.get('nope000'), null);
});

test('put() throws on a duplicate code (PK violation) instead of silently overwriting', () => {
  const store = createSqliteLinkStore(':memory:');
  store.put('dup0001', 'https://example.com/first');
  assert.throws(() => store.put('dup0001', 'https://example.com/second'));
  // original value must be intact — no INSERT OR REPLACE semantics (SEC-6)
  assert.equal(store.get('dup0001'), 'https://example.com/first');
});

test('DDL is idempotent — creating a second store against the same file does not error', () => {
  const os = require('node:os');
  const path = require('node:path');
  const fs = require('node:fs');
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'urlshort-')), 'links.db');
  const store1 = createSqliteLinkStore(dbPath);
  store1.put('idem001', 'https://example.com/a');
  if (typeof store1.close === 'function') store1.close();

  const store2 = createSqliteLinkStore(dbPath);
  assert.equal(store2.get('idem001'), 'https://example.com/a');
  if (typeof store2.close === 'function') store2.close();
});

test('SQL injection payloads used as codes are treated as inert literal strings (SEC-6)', () => {
  const store = createSqliteLinkStore(':memory:');
  const payloads = ["' OR 1=1--", "x'); DROP TABLE links;--"];
  for (const p of payloads) {
    assert.equal(store.get(p), null);
  }
  // table must still be usable afterwards
  store.put('safe001', 'https://example.com/safe');
  assert.equal(store.get('safe001'), 'https://example.com/safe');
});

test('rejects wiring a raw string-concatenation query path (no such API exposed)', () => {
  const store = createSqliteLinkStore(':memory:');
  assert.equal(typeof store.get, 'function');
  assert.equal(typeof store.put, 'function');
  assert.equal(Object.keys(store).filter((k) => typeof store[k] === 'function').every((k) => ['get', 'put', 'close'].includes(k)), true);
});
