'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../src/server');

// TASK-009: end-to-end integration over the real node:http server + a
// :memory: SqliteLinkStore, covering FR-1..3 and NFR-1..4 together.

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function post(port, path, jsonBody) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(jsonBody);
    const req = http.request(
      { host: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location });
    });
    req.on('error', reject);
    req.end();
  });
}

test('full lifecycle: shorten -> redirect -> 404 for unknown code (FR-1, FR-2)', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    const shorten = await post(port, '/api/shorten', { url: 'https://example.com/full-cycle' });
    assert.equal(shorten.status, 201);
    assert.equal(shorten.body.short_url, `http://127.0.0.1/${shorten.body.code}`);

    const redirect = await get(port, `/${shorten.body.code}`);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.location, 'https://example.com/full-cycle');

    const notFound = await get(port, '/zzzzzzz');
    assert.equal(notFound.status, 404);
  } finally {
    server.close();
  }
});

test('NFR-2 + FR-3: invalid-scheme URL is rejected end-to-end and never becomes reachable', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    const attempts = ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://example.com/f'];
    for (const url of attempts) {
      const res = await post(port, '/api/shorten', { url });
      assert.equal(res.status, 400, `expected 400 for ${url}`);
      assert.equal(res.body.error, 'invalid_url');
    }
  } finally {
    server.close();
  }
});

test('NFR-3: multiple concurrently-created links each redirect to their own distinct target', async () => {
  // SEC-4 rate limiting is per-IP and all requests originate from the same
  // loopback client here, so the budget is raised for this load scenario —
  // production defaults (10/min, 120/min) are exercised separately in
  // server.test.js and are untouched by this override.
  const server = createServer({
    dbPath: ':memory:',
    baseUrl: 'http://127.0.0.1',
    shortenRateLimit: { windowMs: 60000, max: 1000 },
    redirectRateLimit: { windowMs: 60000, max: 1000 }
  });
  const port = await listen(server);
  try {
    const targets = Array.from({ length: 10 }, (_, i) => `https://example.com/item-${i}`);
    const created = await Promise.all(targets.map((url) => post(port, '/api/shorten', { url })));
    for (const c of created) assert.equal(c.status, 201);

    for (let i = 0; i < created.length; i++) {
      const redirect = await get(port, `/${created[i].body.code}`);
      assert.equal(redirect.status, 302);
      assert.equal(redirect.location, targets[i], `mismatch for item ${i}`);
    }
  } finally {
    server.close();
  }
});

test('NFR-4: 200 concurrently-created links all receive unique codes', async () => {
  // Same SEC-4 rate-limit override rationale as the NFR-3 test above.
  const server = createServer({
    dbPath: ':memory:',
    baseUrl: 'http://127.0.0.1',
    shortenRateLimit: { windowMs: 60000, max: 1000 }
  });
  const port = await listen(server);
  try {
    const N = 200;
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) => post(port, '/api/shorten', { url: `https://example.com/n-${i}` }))
    );
    const codes = results.map((r) => r.body.code);
    assert.equal(results.filter((r) => r.status !== 201).length, 0);
    assert.equal(new Set(codes).size, N, 'expected zero code collisions across concurrent creations');
  } finally {
    server.close();
  }
});

test('NFR-1: p95 shorten latency stays within 200ms across a batch of sequential requests', async () => {
  // Same SEC-4 rate-limit override rationale as the NFR-3 test above — this
  // measures request latency, not rate-limit behavior.
  const server = createServer({
    dbPath: ':memory:',
    baseUrl: 'http://127.0.0.1',
    shortenRateLimit: { windowMs: 60000, max: 1000 }
  });
  const port = await listen(server);
  try {
    const durations = [];
    const N = 30;
    for (let i = 0; i < N; i++) {
      const start = Date.now();
      const res = await post(port, '/api/shorten', { url: `https://example.com/perf-${i}` });
      durations.push(Date.now() - start);
      assert.equal(res.status, 201);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    assert.ok(p95 <= 200, `expected p95 <= 200ms, got ${p95}ms (all: ${durations.join(',')})`);
  } finally {
    server.close();
  }
});

test('FR-1 AC2: submitting the same URL twice yields two distinct, non-colliding codes, each independently persisted and redirectable', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    const url = 'https://example.com/same-url-twice';
    const first = await post(port, '/api/shorten', { url });
    const second = await post(port, '/api/shorten', { url });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.body.code, second.body.code, 'each submission of the same URL must get its own unique code');

    const redirect1 = await get(port, `/${first.body.code}`);
    const redirect2 = await get(port, `/${second.body.code}`);
    assert.equal(redirect1.status, 302);
    assert.equal(redirect1.location, url);
    assert.equal(redirect2.status, 302);
    assert.equal(redirect2.location, url);
  } finally {
    server.close();
  }
});

test('malformed / oversized / wrong-content-type requests never create a reachable link', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    const badJson = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: '/api/shorten', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(res.statusCode));
      });
      req.on('error', reject);
      req.write('{not json');
      req.end();
    });
    assert.equal(badJson, 400);
  } finally {
    server.close();
  }
});

test('FR-4 (REQ-003): GET / serves the web UI and GET /app.js the client script, without stealing the redirect 404 path', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    const root = await get(port, '/');
    assert.equal(root.status, 200);

    const script = await get(port, '/app.js');
    assert.equal(script.status, 200);

    // Route order regression (DL-05-004): the new static routes must sit
    // BEFORE the redirect catch-all, but an unknown code must still 404.
    const stillNotFound = await get(port, '/zzzzzzz');
    assert.equal(stillNotFound.status, 404);
  } finally {
    server.close();
  }
});
