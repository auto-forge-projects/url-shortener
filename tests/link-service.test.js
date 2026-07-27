'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLinkService, MAX_RETRIES } = require('../src/link-service');
const { createSqliteLinkStore } = require('../src/sqlite-link-store');

// TASK-005 / FR-1 / NFR-1 / NFR-4

function makeCollidingGenerator(sequence) {
  let i = 0;
  return () => {
    const v = sequence[Math.min(i, sequence.length - 1)];
    i++;
    return v;
  };
}

test('shorten() stores the url under a freshly generated code and returns it', () => {
  const store = createSqliteLinkStore(':memory:');
  const service = createLinkService({ store, generateCode: makeCollidingGenerator(['aaaaaaa']) });
  const result = service.shorten('https://example.com/');
  assert.equal(result.code, 'aaaaaaa');
  assert.equal(store.get('aaaaaaa'), 'https://example.com/');
});

test('shorten() retries on collision and succeeds within MAX_RETRIES attempts', () => {
  const store = createSqliteLinkStore(':memory:');
  store.put('busy001', 'https://taken.example/');
  const gen = makeCollidingGenerator(['busy001', 'busy001', 'free001']);
  const service = createLinkService({ store, generateCode: gen });
  const result = service.shorten('https://example.com/');
  assert.equal(result.code, 'free001');
  assert.equal(store.get('free001'), 'https://example.com/');
});

test('shorten() gives up after MAX_RETRIES consecutive collisions and throws', () => {
  const store = createSqliteLinkStore(':memory:');
  store.put('c0000001'.slice(0, 7), 'https://taken.example/');
  const alwaysColliding = makeCollidingGenerator(['c0000001'.slice(0, 7)]);
  const service = createLinkService({ store, generateCode: alwaysColliding });
  assert.throws(() => service.shorten('https://example.com/'));
});

test('MAX_RETRIES is 3 per docs/08-plan.md TASK-005', () => {
  assert.equal(MAX_RETRIES, 3);
});

test('lookup() returns the stored url for a known code', () => {
  const store = createSqliteLinkStore(':memory:');
  store.put('look001', 'https://example.com/target');
  const service = createLinkService({ store, generateCode: makeCollidingGenerator(['x']) });
  assert.equal(service.lookup('look001'), 'https://example.com/target');
});

test('lookup() returns null for an unknown code', () => {
  const store = createSqliteLinkStore(':memory:');
  const service = createLinkService({ store, generateCode: makeCollidingGenerator(['x']) });
  assert.equal(service.lookup('unknown'), null);
});

test('shorten() with the real code generator completes well within 200ms (NFR-1 smoke test)', () => {
  const store = createSqliteLinkStore(':memory:');
  const { generateCode } = require('../src/code-generator');
  const service = createLinkService({ store, generateCode });
  const start = Date.now();
  const result = service.shorten('https://example.com/perf');
  const dur = Date.now() - start;
  assert.ok(result.code);
  assert.ok(dur <= 200, `expected <=200ms, got ${dur}ms`);
});
