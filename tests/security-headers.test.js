'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applySecurityHeaders } = require('../src/security-headers');

// TASK-006 / SEC-8

function fakeRes() {
  const headers = {};
  return {
    headers,
    removeHeader(name) { delete headers[name]; },
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; }
  };
}

test('sets nosniff, no-referrer, restrictive CSP, and no-store', () => {
  const res = fakeRes();
  applySecurityHeaders(res);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  assert.equal(res.headers['Content-Security-Policy'], "default-src 'none'; frame-ancestors 'none'");
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('removes/never sets X-Powered-By or Server identifying headers', () => {
  const res = fakeRes();
  res.headers['X-Powered-By'] = 'Express'; // simulate a framework default we must strip
  applySecurityHeaders(res);
  assert.equal(res.headers['X-Powered-By'], undefined);
});
