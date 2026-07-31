'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../src/router');

// TASK-008 — Router dispatches by method+path, per docs/05-architecture.md component view.

function fakeRes() {
  return {
    statusCode: 0,
    body: '',
    headers: {},
    setHeader(n, v) { this.headers[n] = v; },
    removeHeader() {},
    writeHead(c) { this.statusCode = c; },
    end(chunk) { if (chunk) this.body += chunk; }
  };
}

test('routes POST /api/shorten to the shorten handler', async () => {
  let called = false;
  const router = createRouter({
    shortenHandler: async () => { called = true; },
    redirectHandler: async () => { throw new Error('should not be called'); },
    healthHandler: () => { throw new Error('should not be called'); }
  });
  await router({ method: 'POST', url: '/api/shorten' }, fakeRes());
  assert.equal(called, true);
});

test('routes GET /health to the health handler', async () => {
  let called = false;
  const router = createRouter({
    shortenHandler: async () => { throw new Error('should not be called'); },
    redirectHandler: async () => { throw new Error('should not be called'); },
    healthHandler: () => { called = true; }
  });
  await router({ method: 'GET', url: '/health' }, fakeRes());
  assert.equal(called, true);
});

test('routes GET / to the static page handler (FR-4, REQ-003)', async () => {
  let called = false;
  const router = createRouter({
    shortenHandler: async () => { throw new Error('should not be called'); },
    redirectHandler: async () => { throw new Error('should not be called — / must not fall through to redirect'); },
    healthHandler: () => { throw new Error('should not be called'); },
    staticPageHandler: {
      handlePage: () => { called = true; },
      handleScript: () => { throw new Error('should not be called'); }
    }
  });
  await router({ method: 'GET', url: '/' }, fakeRes());
  assert.equal(called, true);
});

test('routes GET /app.js to the static script handler (FR-4, REQ-003)', async () => {
  let called = false;
  const router = createRouter({
    shortenHandler: async () => { throw new Error('should not be called'); },
    redirectHandler: async () => { throw new Error('should not be called — /app.js must not fall through to redirect'); },
    healthHandler: () => { throw new Error('should not be called'); },
    staticPageHandler: {
      handlePage: () => { throw new Error('should not be called'); },
      handleScript: () => { called = true; }
    }
  });
  await router({ method: 'GET', url: '/app.js' }, fakeRes());
  assert.equal(called, true);
});

test('routes GET /:code to the redirect handler for any other GET path', async () => {
  let called = false;
  const router = createRouter({
    shortenHandler: async () => { throw new Error('should not be called'); },
    redirectHandler: async () => { called = true; },
    healthHandler: () => { throw new Error('should not be called'); }
  });
  await router({ method: 'GET', url: '/abc1234' }, fakeRes());
  assert.equal(called, true);
});

test('POST to any path other than /api/shorten -> 404, no handler invoked', async () => {
  const router = createRouter({
    shortenHandler: async () => { throw new Error('should not be called'); },
    redirectHandler: async () => { throw new Error('should not be called'); },
    healthHandler: () => { throw new Error('should not be called'); }
  });
  const res = fakeRes();
  await router({ method: 'POST', url: '/whatever' }, res);
  assert.equal(res.statusCode, 404);
});

test('unsupported method (e.g. DELETE) -> 404', async () => {
  const router = createRouter({
    shortenHandler: async () => { throw new Error('should not be called'); },
    redirectHandler: async () => { throw new Error('should not be called'); },
    healthHandler: () => { throw new Error('should not be called'); }
  });
  const res = fakeRes();
  await router({ method: 'DELETE', url: '/abc1234' }, res);
  assert.equal(res.statusCode, 404);
});
