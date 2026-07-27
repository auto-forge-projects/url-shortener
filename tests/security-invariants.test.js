'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// TASK-008 — cross-cutting, whole-repo security invariants:
// SEC-2 (server never fetches user URLs / does DNS itself),
// SEC-13 (zero runtime dependencies), SEC-16 (no dangerous dynamic APIs).

const SRC_DIR = path.join(__dirname, '..', 'src');

function allSrcFiles() {
  return fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.js')).map((f) => path.join(SRC_DIR, f));
}

test('SEC-2: no outbound HTTP client or DNS calls anywhere in src/', () => {
  const forbidden = [/\bfetch\s*\(/, /https?\.request\s*\(/, /https?\.get\s*\(/, /require\(['"]node:dns['"]\)/, /require\(['"]dns['"]\)/];
  for (const file of allSrcFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    for (const re of forbidden) {
      assert.ok(!re.test(src), `${path.basename(file)} appears to make an outbound request/DNS call (matched ${re})`);
    }
  }
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
