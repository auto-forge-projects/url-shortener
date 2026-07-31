'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStaticPageHandler } = require('../src/static-page-handler');

// TASK-010 / FR-4 / REQ-003 — GET / (form) + GET /app.js (client script).
// Author=orchestrator (Faz 9 inline); Faz 10 blind review is a SEPARATE agent.

function fakeRes() {
  const headers = {};
  return {
    headers,
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers[name] = value; },
    getHeader(name) { return headers[name]; },
    removeHeader(name) { delete headers[name]; },
    writeHead(code) { this.statusCode = code; },
    end(chunk) { if (chunk) this.body += chunk; }
  };
}

test('handlePage returns 200 HTML containing a URL input form that loads /app.js', () => {
  const { handlePage } = createStaticPageHandler();
  const res = fakeRes();
  handlePage({}, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /text\/html/);
  assert.match(res.body, /<form/);
  assert.match(res.body, /type="url"/);
  assert.match(res.body, /<script src="\/app\.js">/);
});

test('handlePage sets a route-specific CSP (self script/connect, no unsafe-inline)', () => {
  const { handlePage } = createStaticPageHandler();
  const res = fakeRes();
  handlePage({}, res);
  const csp = res.headers['Content-Security-Policy'];
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline/);
});

test('handleScript returns 200 JS that posts to /api/shorten and never uses innerHTML', () => {
  const { handleScript } = createStaticPageHandler();
  const res = fakeRes();
  handleScript({}, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['Content-Type'], /javascript/);
  assert.match(res.body, /\/api\/shorten/);
  assert.doesNotMatch(res.body, /innerHTML/);
  assert.match(res.body, /textContent/);
});

test('handleScript is served with the same route-specific CSP as the page', () => {
  const { handleScript } = createStaticPageHandler();
  const res = fakeRes();
  handleScript({}, res);
  assert.match(res.headers['Content-Security-Policy'], /script-src 'self'/);
});

test('handleScript maps known server error codes to fixed client text, never displays raw server fields (SEC-19)', () => {
  const { handleScript } = createStaticPageHandler();
  const res = fakeRes();
  handleScript({}, res);
  assert.match(res.body, /ERROR_MESSAGES/);
  assert.match(res.body, /invalid_url/);
  assert.match(res.body, /rate_limited/);
  assert.doesNotMatch(res.body, /data\.message/);
});

test('both handlers strip framework-identifying headers (SEC-8 baseline)', () => {
  const { handlePage } = createStaticPageHandler();
  const res = fakeRes();
  res.headers['X-Powered-By'] = 'Express';
  handlePage({}, res);
  assert.equal(res.headers['X-Powered-By'], undefined);
});
