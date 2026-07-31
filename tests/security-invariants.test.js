'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// TASK-008 — cross-cutting, whole-repo security invariants:
// SEC-2 (server never fetches user URLs / does DNS itself),
// SEC-13 (zero runtime dependencies), SEC-16 (no dangerous dynamic APIs).

const SRC_DIR = path.join(__dirname, '..', 'src');

// SEC-2/SEC-18: static-page-handler.js embeds the browser-side APP_JS string
// (served at GET /app.js) which legitimately calls `fetch()` from the client
// — that call never executes in Node. The server-side code in this file
// still must not perform outbound calls itself, so it's checked separately
// below with the client script string stripped out first.
const CLIENT_SCRIPT_HOST_FILE = 'static-page-handler.js';

function allSrcFiles() {
  return fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.js')).map((f) => path.join(SRC_DIR, f));
}

function readServerOnlySource(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (path.basename(file) !== CLIENT_SCRIPT_HOST_FILE) return src;
  return src.replace(/const APP_JS = `[\s\S]*?`;/, 'const APP_JS = /* client script omitted for SEC-2 scan */ null;');
}

test('SEC-2: no outbound HTTP client or DNS calls anywhere in src/ (server-side code)', () => {
  const forbidden = [/\bfetch\s*\(/, /https?\.request\s*\(/, /https?\.get\s*\(/, /require\(['"]node:dns['"]\)/, /require\(['"]dns['"]\)/];
  for (const file of allSrcFiles()) {
    const src = readServerOnlySource(file);
    for (const re of forbidden) {
      assert.ok(!re.test(src), `${path.basename(file)} appears to make an outbound request/DNS call (matched ${re})`);
    }
  }
});

test('SEC-2: static-page-handler.js embeds exactly one client-side fetch() call (GET /app.js contract)', () => {
  const file = path.join(SRC_DIR, CLIENT_SCRIPT_HOST_FILE);
  const src = fs.readFileSync(file, 'utf8');
  const matches = src.match(/\bfetch\s*\(/g) || [];
  assert.equal(matches.length, 1, 'expected exactly one fetch() call, embedded in the browser-side APP_JS string');
});

test('SEC-16: no child_process, eval, new Function, or vm usage in src/', () => {
  const forbidden = [/child_process/, /\beval\s*\(/, /new\s+Function\s*\(/, /require\(['"]vm['"]\)/, /require\(['"]node:vm['"]\)/];
  for (const file of allSrcFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    for (const re of forbidden) {
      assert.ok(!re.test(src), `${path.basename(file)} matched forbidden pattern ${re}`);
    }
  }
});

test('SEC-13: package.json declares zero runtime dependencies and is not published', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.deepEqual(pkg.dependencies || {}, {});
  assert.equal(pkg.private, true);
});
