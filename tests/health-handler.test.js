'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHealthHandler } = require('../src/health-handler');

// TASK-008 / SEC-15 — /health leaks nothing beyond {status:"ok"}

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers[name] = value; },
    removeHeader(name) { delete headers[name]; },
    writeHead(code) { this.statusCode = code; },
    end(chunk) { if (chunk) this.body += chunk; }
  };
}

test('responds 200 with exactly {status:"ok"} — no version/path/db info', () => {
  const handler = createHealthHandler();
  const res = fakeRes();
  handler({}, res);
  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.deepEqual(parsed, { status: 'ok' });
});
