'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { hashIp, redactUrl, logEvent } = require('../src/logger');

// TASK-006 / SEC-11 — structured JSON logging, IP hashing, URL redaction, log-injection defense.

test('hashIp never returns the raw IP and is deterministic within a process', () => {
  const h1 = hashIp('203.0.113.7');
  const h2 = hashIp('203.0.113.7');
  assert.notEqual(h1, '203.0.113.7');
  assert.equal(h1, h2);
  assert.ok(h1.length > 0);
});

test('hashIp gives different hashes for different IPs', () => {
  assert.notEqual(hashIp('1.1.1.1'), hashIp('2.2.2.2'));
});

test('redactUrl strips query and fragment but keeps scheme/host/path', () => {
  const r = redactUrl('https://example.com/path?token=secret#frag');
  assert.equal(r, 'https://example.com/path?<redacted>');
});

test('redactUrl leaves a URL with no query/fragment untouched', () => {
  const r = redactUrl('https://example.com/path');
  assert.equal(r, 'https://example.com/path');
});

test('redactUrl tolerates a malformed URL string without throwing', () => {
  assert.doesNotThrow(() => redactUrl('not a url'));
});

test('logEvent emits a single-line JSON object to the provided sink', () => {
  const lines = [];
  logEvent({ event: 'test_event', status: 200 }, { write: (line) => lines.push(line) });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].includes('\n'), false, 'log line itself must not contain embedded newlines');
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, 'test_event');
  assert.equal(parsed.status, 200);
  assert.ok(parsed.ts);
});

test('logEvent escapes CR/LF found inside field values (log injection defense)', () => {
  const lines = [];
  logEvent({ event: 'evil\r\ninjected: true', note: 'a\nb' }, { write: (line) => lines.push(line) });
  const raw = lines[0];
  assert.equal(raw.includes('\n'), false);
  assert.equal(raw.includes('\r'), false);
  const parsed = JSON.parse(raw);
  assert.ok(parsed.event.includes('injected'));
});
