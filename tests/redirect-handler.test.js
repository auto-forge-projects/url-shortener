'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRedirectHandler } = require('../src/redirect-handler');
const { createLinkService } = require('../src/link-service');
const { createSqliteLinkStore } = require('../src/sqlite-link-store');
const { createRateLimiter } = require('../src/rate-limiter');

// TASK-007 / FR-2 / SEC-3 / SEC-9

function fakeReq({ url, ip = '10.10.10.10' }) {
  const req = new EventEmitter();
  req.url = url;
  req.method = 'GET';
  req.socket = { remoteAddress: ip };
  return req;
}

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
    removeHeader(name) { delete headers[name]; },
    writeHead(code, hdrs) {
      this.statusCode = code;
      if (hdrs) Object.assign(headers, hdrs);
    },
    end(chunk) {
      if (chunk) this.body += chunk;
    }
  };
}

function makeHandler({ max = 100 } = {}) {
  const store = createSqliteLinkStore(':memory:');
  const { generateCode } = require('../src/code-generator');
  const service = createLinkService({ store, generateCode });
  const rateLimiter = createRateLimiter({ windowMs: 60000, max });
  const handler = createRedirectHandler({ service, rateLimiter, logSink: { write() {} } });
  return { handler, service, store };
}

test('known code -> 302 with Location set to the stored URL', async () => {
  const { handler, service } = makeHandler();
  const { code } = service.shorten('https://example.com/target');
  const req = fakeReq({ url: `/${code}` });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, 'https://example.com/target');
});

test('unknown code -> 404', async () => {
  const { handler } = makeHandler();
  const req = fakeReq({ url: '/unknown1' });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('SEC-9: path not matching ^/[0-9A-Za-z]{7}$ -> 404 (no path traversal, no directory listing)', async () => {
  const { handler } = makeHandler();
  const badPaths = ['/../etc/passwd', '/a/b/c', '/short', '/toolongcode123', '/has space', '/has-dash1'];
  for (const p of badPaths) {
    const req = fakeReq({ url: p });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 404, `expected 404 for path ${p}`);
  }
});

test('SEC-3: if the stored URL somehow fails re-validation, redirect responds 404 (not a raw redirect)', async () => {
  // Simulate a tampered row by writing directly via a stub service whose
  // lookup() returns something that would fail validateUrl.
  const service = {
    lookup: (code) => (code === 'bad0001' ? 'javascript:alert(1)' : null)
  };
  const rateLimiter = createRateLimiter({ windowMs: 60000, max: 100 });
  const handler = createRedirectHandler({ service, rateLimiter, logSink: { write() {} } });
  const req = fakeReq({ url: '/bad0001' });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('response carries SEC-8 security headers including no-referrer and no-store', async () => {
  const { handler, service } = makeHandler();
  const { code } = service.shorten('https://example.com/target');
  const req = fakeReq({ url: `/${code}` });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('SEC-4: GET rate limit returns 429 with Retry-After once exceeded', async () => {
  const { handler, service } = makeHandler({ max: 1 });
  const { code } = service.shorten('https://example.com/target');
  const req1 = fakeReq({ url: `/${code}` });
  const res1 = fakeRes();
  await handler(req1, res1);
  assert.equal(res1.statusCode, 302);

  const req2 = fakeReq({ url: `/${code}` });
  const res2 = fakeRes();
  await handler(req2, res2);
  assert.equal(res2.statusCode, 429);
  assert.ok(res2.headers['Retry-After']);
});
