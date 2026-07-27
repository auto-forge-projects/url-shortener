'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generateCode, ALPHABET, CODE_LENGTH } = require('../src/code-generator');

// TASK-003 / FR-1 / SEC-7

test('generates a code of the expected length', () => {
  const code = generateCode();
  assert.equal(code.length, CODE_LENGTH);
  assert.equal(CODE_LENGTH, 7);
});

test('generated code only contains base62 alphabet characters', () => {
  for (let i = 0; i < 500; i++) {
    const code = generateCode();
    for (const ch of code) {
      assert.ok(ALPHABET.includes(ch), `unexpected char "${ch}" in code "${code}"`);
    }
  }
});

test('alphabet is exactly base62 (0-9A-Za-z), 62 unique characters', () => {
  assert.equal(ALPHABET.length, 62);
  assert.equal(new Set(ALPHABET.split('')).size, 62);
  assert.ok(/^[0-9A-Za-z]+$/.test(ALPHABET));
});

test('large sample: no repeats among 100k generations (birthday-bound sanity, not a proof)', () => {
  const seen = new Set();
  const N = 100000;
  for (let i = 0; i < N; i++) {
    seen.add(generateCode());
  }
  // 62^7 ~= 3.5e12 possible codes; 100k draws should not collide in practice.
  assert.equal(seen.size, N, 'expected zero collisions across 100k draws');
});

test('character distribution is not obviously skewed (no alphabet char is wildly over/under represented)', () => {
  const counts = new Map();
  const N = 62000; // ~1000 draws per alphabet char expected on average
  let totalChars = 0;
  for (let i = 0; i < N; i++) {
    for (const ch of generateCode()) {
      counts.set(ch, (counts.get(ch) || 0) + 1);
      totalChars++;
    }
  }
  const expectedPerChar = totalChars / ALPHABET.length;
  for (const ch of ALPHABET) {
    const c = counts.get(ch) || 0;
    // Generous tolerance band (not a statistical proof, just a skew smoke test).
    assert.ok(c > expectedPerChar * 0.5, `char "${ch}" under-represented: ${c} vs expected ~${expectedPerChar}`);
    assert.ok(c < expectedPerChar * 1.5, `char "${ch}" over-represented: ${c} vs expected ~${expectedPerChar}`);
  }
});

test('SEC-7: implementation must use crypto.randomBytes, not Math.random, Date, or a counter', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'code-generator.js'), 'utf8');
  assert.ok(src.includes('randomBytes') || src.includes('crypto.getRandomValues'), 'must use a CSPRNG');
  assert.ok(!/Math\.random/.test(src), 'Math.random is forbidden by SEC-7');
  assert.ok(!/Date\.now|new Date\(/.test(src), 'timestamp-derived codes are forbidden by SEC-7');
});
