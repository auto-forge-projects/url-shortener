'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertLinkStore } = require('../src/link-store');

// TASK-001: LinkStore port contract — any adapter must expose async get(code) and put(code, url).

test('assertLinkStore accepts an object exposing get(code) and put(code, url)', () => {
  const validStore = {
    get(code) { return null; },
    put(code, url) { return undefined; }
  };
  assert.doesNotThrow(() => assertLinkStore(validStore));
});

test('assertLinkStore rejects null/undefined', () => {
  assert.throws(() => assertLinkStore(null), /LinkStore/);
  assert.throws(() => assertLinkStore(undefined), /LinkStore/);
});

test('assertLinkStore rejects an object missing get()', () => {
  const store = { put() {} };
  assert.throws(() => assertLinkStore(store), /get/);
});

test('assertLinkStore rejects an object missing put()', () => {
  const store = { get() {} };
  assert.throws(() => assertLinkStore(store), /put/);
});

test('assertLinkStore rejects non-function get/put members', () => {
  const store = { get: 'nope', put: 'nope' };
  assert.throws(() => assertLinkStore(store));
});
