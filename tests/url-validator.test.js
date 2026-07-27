'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateUrl } = require('../src/url-validator');

// TASK-002 / FR-3 / NFR-2 / SEC-1 / SEC-14

test('accepts a well-formed https URL', () => {
  const r = validateUrl('https://example.com/path?q=1');
  assert.equal(r.ok, true);
  assert.equal(r.url, 'https://example.com/path?q=1');
});

test('accepts a well-formed http URL', () => {
  const r = validateUrl('http://example.com/');
  assert.equal(r.ok, true);
});

test('rejects non-string input', () => {
  for (const bad of [undefined, null, 42, {}, [], true]) {
    const r = validateUrl(bad);
    assert.equal(r.ok, false, `expected reject for ${JSON.stringify(bad)}`);
    assert.equal(r.code, 'invalid_url');
  }
});

test('rejects empty / whitespace-only string', () => {
  for (const bad of ['', '   ', '\t\n']) {
    const r = validateUrl(bad);
    assert.equal(r.ok, false);
  }
});

test('rejects malformed URL syntax', () => {
  const r = validateUrl('not a url at all');
  assert.equal(r.ok, false);
});

test('rejects disallowed schemes (SEC-1)', () => {
  const bad = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/file',
    'blob:https://example.com/uuid',
    'mailto:a@b.com'
  ];
  for (const url of bad) {
    const r = validateUrl(url);
    assert.equal(r.ok, false, `expected reject for scheme in ${url}`);
    assert.equal(r.code, 'invalid_url');
  }
});

test('rejects URL with no scheme', () => {
  const r = validateUrl('example.com/path');
  assert.equal(r.ok, false);
});

test('rejects control characters (CR/LF/TAB/NUL) in input (log/header injection defense)', () => {
  const bad = [
    'https://example.com/\r\nSet-Cookie: x=1',
    'https://example.com/\n',
    'https://example.com/\t',
    'https://example.com/\0'
  ];
  for (const url of bad) {
    const r = validateUrl(url);
    assert.equal(r.ok, false, `expected reject for control char in ${JSON.stringify(url)}`);
  }
});

test('rejects input longer than 2048 characters', () => {
  const long = 'https://example.com/' + 'a'.repeat(2048);
  const r = validateUrl(long);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'invalid_url');
});

test('accepts input exactly at the 2048 boundary', () => {
  const base = 'https://example.com/';
  const filler = 'a'.repeat(2048 - base.length);
  const url = base + filler;
  assert.equal(url.length, 2048);
  const r = validateUrl(url);
  assert.equal(r.ok, true);
});

test('rejects a scheme with no host at all', () => {
  const r = validateUrl('http://');
  assert.equal(r.ok, false);
});

test('rejects loopback IP-literal hosts (SEC-14 defense in depth)', () => {
  const bad = ['http://127.0.0.1/', 'http://127.0.0.1:8080/x', 'http://[::1]/'];
  for (const url of bad) {
    const r = validateUrl(url);
    assert.equal(r.ok, false, `expected reject for ${url}`);
    assert.equal(r.code, 'invalid_url');
  }
});

test('rejects link-local / cloud metadata IP host (SEC-14)', () => {
  const r = validateUrl('http://169.254.169.254/latest/meta-data');
  assert.equal(r.ok, false);
});

test('rejects private-range IP-literal hosts (SEC-14)', () => {
  const bad = ['http://10.0.0.1/', 'http://172.16.0.1/', 'http://192.168.1.1/', 'http://0.0.0.0/'];
  for (const url of bad) {
    const r = validateUrl(url);
    assert.equal(r.ok, false, `expected reject for ${url}`);
  }
});

test('accepts public IP-literal hosts (denylist is narrow, not IP-literal-wide)', () => {
  const r = validateUrl('http://93.184.216.34/');
  assert.equal(r.ok, true);
});

test('accepts a normal public hostname that merely contains digits', () => {
  const r = validateUrl('https://example123.com/');
  assert.equal(r.ok, true);
});
