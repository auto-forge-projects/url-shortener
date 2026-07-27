'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../src/server');

// TASK-008 / FR-1 / FR-2 / SEC-5 (timeouts) — real node:http integration.

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function request(port, { method = 'GET', path = '/', body }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path, method, headers: body ? { 'Content-Type': 'application/json' } : {} },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('GET /health -> 200 {status:"ok"}', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    const res = await request(port, { path: '/health' });
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body), { status: 'ok' });
  } finally {
    server.close();
  }
});

test('unknown route -> 404', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    const res = await request(port, { path: '/api/does-not-exist' });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test('POST /api/shorten then GET the returned code -> 302 to the original URL', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    const created = await request(port, {
      method: 'POST',
      path: '/api/shorten',
      body: JSON.stringify({ url: 'https://example.com/hello' })
    });
    assert.equal(created.status, 201);
    const { code } = JSON.parse(created.body);

    const redirect = await new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: `/${code}`, method: 'GET' }, (res) => {
        res.resume();
        resolve(res);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(redirect.statusCode, 302);
    assert.equal(redirect.headers.location, 'https://example.com/hello');
  } finally {
    server.close();
  }
});

test('server enforces requestTimeout/headersTimeout to defend against slowloris (SEC-5)', () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  assert.ok(server.requestTimeout > 0 && server.requestTimeout <= 10000);
  assert.ok(server.headersTimeout > 0 && server.headersTimeout <= 10000);
  server.close();
});

test('SEC-4: default (no override) shorten rate limit is enforced at the documented 10/min budget', async () => {
  const server = createServer({ dbPath: ':memory:', baseUrl: 'http://127.0.0.1' });
  const port = await listen(server);
  try {
    let sawRateLimited = false;
    for (let i = 0; i < 15; i++) {
      const res = await request(port, { method: 'POST', path: '/api/shorten', body: JSON.stringify({ url: `https://example.com/${i}` }) });
      if (res.status === 429) sawRateLimited = true;
    }
    assert.equal(sawRateLimited, true, 'expected the 11th+ request from the same IP within a minute to be rate-limited');
  } finally {
    server.close();
  }
});

test('shortenRateLimit/redirectRateLimit overrides raise the budget for load testing without touching production defaults', async () => {
  const server = createServer({
    dbPath: ':memory:',
    baseUrl: 'http://127.0.0.1',
    shortenRateLimit: { windowMs: 60000, max: 1000 }
  });
  const port = await listen(server);
  try {
    for (let i = 0; i < 20; i++) {
      const res = await request(port, { method: 'POST', path: '/api/shorten', body: JSON.stringify({ url: `https://example.com/${i}` }) });
      assert.equal(res.status, 201, `request ${i} should not be rate-limited with an overridden budget`);
    }
  } finally {
    server.close();
  }
});
