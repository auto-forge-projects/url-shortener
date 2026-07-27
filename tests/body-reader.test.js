'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readJsonBody } = require('../src/body-reader');

// TASK-006 / SEC-5 (4KB cap, Content-Type enforced) / SEC-10 (safe JSON, no prototype pollution)

function fakeReq({ chunks, contentType = 'application/json' }) {
  const req = new EventEmitter();
  req.headers = { 'content-type': contentType };
  process.nextTick(() => {
    for (const c of chunks) req.emit('data', Buffer.from(c));
    req.emit('end');
  });
  return req;
}

test('parses a well-formed small JSON body', async () => {
  const req = fakeReq({ chunks: [JSON.stringify({ url: 'https://example.com/' })] });
  const body = await readJsonBody(req, { maxBytes: 4096 });
  assert.deepEqual(body, { url: 'https://example.com/' });
});

test('rejects a body exceeding maxBytes with a too_large error', async () => {
  const big = 'x'.repeat(5000);
  const req = fakeReq({ chunks: [JSON.stringify({ url: big })] });
  await assert.rejects(
    () => readJsonBody(req, { maxBytes: 4096 }),
    (err) => err.code === 'payload_too_large'
  );
});

test('rejects a non-JSON Content-Type with unsupported_media_type', async () => {
  const req = fakeReq({ chunks: ['url=https://x'], contentType: 'text/plain' });
  await assert.rejects(
    () => readJsonBody(req, { maxBytes: 4096 }),
    (err) => err.code === 'unsupported_media_type'
  );
});

test('rejects malformed JSON with invalid_json (not a 500)', async () => {
  const req = fakeReq({ chunks: ['{not valid json'] });
  await assert.rejects(
    () => readJsonBody(req, { maxBytes: 4096 }),
    (err) => err.code === 'invalid_json'
  );
});

test('rejects a body containing a __proto__ key (prototype pollution defense)', async () => {
  const req = fakeReq({ chunks: ['{"__proto__":{"polluted":true},"url":"https://example.com/"}'] });
  await assert.rejects(
    () => readJsonBody(req, { maxBytes: 4096 }),
    (err) => err.code === 'invalid_json'
  );
  assert.equal({}.polluted, undefined, 'global Object.prototype must not be polluted');
});

test('rejects a body containing a constructor/prototype key', async () => {
  const req = fakeReq({ chunks: ['{"constructor":{"prototype":{"polluted":true}}}'] });
  await assert.rejects(() => readJsonBody(req, { maxBytes: 4096 }));
});

test('rejects extra unexpected top-level fields', async () => {
  const req = fakeReq({ chunks: [JSON.stringify({ url: 'https://example.com/', admin: true })] });
  await assert.rejects(
    () => readJsonBody(req, { maxBytes: 4096 }),
    (err) => err.code === 'invalid_json'
  );
});

test('rejects a body that is not a JSON object (e.g. an array or a string)', async () => {
  const req1 = fakeReq({ chunks: ['[1,2,3]'] });
  await assert.rejects(() => readJsonBody(req1, { maxBytes: 4096 }));
  const req2 = fakeReq({ chunks: ['"just a string"'] });
  await assert.rejects(() => readJsonBody(req2, { maxBytes: 4096 }));
});
