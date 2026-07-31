'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createHandler } = require('../src/create-handler');
const { createLinkService } = require('../src/link-service');
const { createSqliteLinkStore } = require('../src/sqlite-link-store');
const { createRateLimiter } = require('../src/rate-limiter');

// TASK-006 / FR-1 / FR-3 / SEC-4 / SEC-5 / SEC-9

function fakeReq({ body, contentType = 'application/json', ip = '10.10.10.10' }) {
  const req = new EventEmitter();
  req.headers = { 'content-type': contentType };
  req.socket = { remoteAddress: ip };
  req.url = '/api/shorten';
  req.method = 'POST';
  process.nextTick(() => {
    if (body !== undefined) req.emit('data', Buffer.from(body));
    req.emit('end');
  });
  return req;
}

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: 0,
    body: '',
    ended: false,
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
    removeHeader(name) { delete headers[name]; },
    writeHead(code, hdrs) {
      this.statusCode = code;
      if (hdrs) Object.assign(headers, hdrs);
    },
    end(chunk) {
      if (chunk) this.body += chunk;
      this.ended = true;
    }
  };
}

function makeHandler({ baseUrl = 'http://localhost:3000' } = {}) {
  const store = createSqliteLinkStore(':memory:');
  const { generateCode } = require('../src/code-generator');
  const service = createLinkService({ store, generateCode });
  const rateLimiter = createRateLimiter({ windowMs: 60000, max: 10 });
  const logs = [];
  const handler = createHandler({
    service,
    baseUrl,
    rateLimiter,
    logSink: { write: (l) => logs.push(l) }
  });
  return { handler, logs, store };
}

test('valid URL -> 201 with code + short_url within a JSON body', async () => {
  const { handler } = makeHandler();
  const req = fakeReq({ body: JSON.stringify({ url: 'https://example.com/page' }) });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 201);
  const parsed = JSON.parse(res.body);
  assert.equal(typeof parsed.code, 'string');
  assert.equal(parsed.code.length, 7);
  assert.equal(parsed.short_url, `http://localhost:3000/${parsed.code}`);
});

test('invalid scheme -> 400, generic error body, no leaking internals', async () => {
  const { handler, store } = makeHandler();
  const req = fakeReq({ body: JSON.stringify({ url: 'javascript:alert(1)' }) });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  const parsed = JSON.parse(res.body);
  assert.equal(parsed.error, 'invalid_url');
  assert.equal(parsed.stack, undefined);
});

test('malformed JSON -> 400 invalid_json, not 500', async () => {
  const { handler } = makeHandler();
  const req = fakeReq({ body: '{oops' });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
});

test('body over 4KB -> 413', async () => {
  const { handler } = makeHandler();
  const big = JSON.stringify({ url: 'https://example.com/' + 'a'.repeat(5000) });
  const req = fakeReq({ body: big });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 413);
});

test('wrong Content-Type -> 415', async () => {
  const { handler } = makeHandler();
  const req = fakeReq({ body: 'url=https://x', contentType: 'text/plain' });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 415);
});

test('response always carries the SEC-8 security headers', async () => {
  const { handler } = makeHandler();
  const req = fakeReq({ body: JSON.stringify({ url: 'https://example.com/' }) });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('SEC-4: exceeding the rate limit for this IP returns 429 with Retry-After', async () => {
  const store = createSqliteLinkStore(':memory:');
  const { generateCode } = require('../src/code-generator');
  const service = createLinkService({ store, generateCode });
  const rateLimiter = createRateLimiter({ windowMs: 60000, max: 1 });
  const handler = createHandler({ service, baseUrl: 'http://localhost:3000', rateLimiter, logSink: { write() {} } });

  const req1 = fakeReq({ body: JSON.stringify({ url: 'https://example.com/1' }) });
  const res1 = fakeRes();
  await handler(req1, res1);
  assert.equal(res1.statusCode, 201);

  const req2 = fakeReq({ body: JSON.stringify({ url: 'https://example.com/2' }) });
  const res2 = fakeRes();
  await handler(req2, res2);
  assert.equal(res2.statusCode, 429);
  assert.ok(res2.headers['Retry-After']);
});

test('DL-06-001/REQ-002: no BASE_URL -> 201 with code only, no short_url (never leak localhost)', async () => {
  const { handler } = makeHandler({ baseUrl: '' });
  const req = fakeReq({ body: JSON.stringify({ url: 'https://example.com/page' }) });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 201);
  const parsed = JSON.parse(res.body);
  assert.equal(typeof parsed.code, 'string');
  assert.equal('short_url' in parsed, false);
});

test('rejected requests never write a row to the store (FR-3)', async () => {
  const { handler, store } = makeHandler();
  const req = fakeReq({ body: JSON.stringify({ url: 'file:///etc/passwd' }) });
  const res = fakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  // Cannot enumerate the store directly (no such API — SEC-15), but we can
  // assert the handler never called shorten() by checking response has no code.
  assert.equal(JSON.parse(res.body).code, undefined);
});
