'use strict';

// TASK-003: CodeGenerator — base62(7), CSPRNG + rejection sampling (SEC-7).
// Weak PRNGs, wall-clock timestamps, counters, and URL-derived codes are
// forbidden as entropy sources per docs/07-security.md SEC-7.

const { randomBytes } = require('node:crypto');

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ALPHABET_LEN = ALPHABET.length; // 62
const CODE_LENGTH = 7;

// Rejection sampling threshold: with a byte range of 0-255 and a 62-entry
// alphabet, 256 = 4*62 + 8, so bytes >= 248 (4*62) would bias the low
// alphabet indices if kept. We reject bytes >= REJECTION_LIMIT and redraw.
const REJECTION_LIMIT = Math.floor(256 / ALPHABET_LEN) * ALPHABET_LEN; // 248

/**
 * Draws a single unbiased index in [0, ALPHABET_LEN) using rejection
 * sampling over CSPRNG bytes (SEC-7 — no modulo bias).
 *
 * @returns {number}
 */
function randomAlphabetIndex() {
  // Pull a small batch of random bytes at a time to avoid excessive
  // randomBytes(1) syscalls in the (rare) rejection case.
  for (;;) {
    const batch = randomBytes(8);
    for (let i = 0; i < batch.length; i++) {
      const b = batch[i];
      if (b < REJECTION_LIMIT) {
        return b % ALPHABET_LEN;
      }
      // else: reject and try next byte in batch / redraw
    }
  }
}

/**
 * Generates a random base62, fixed-length (7) code.
 *
 * @returns {string}
 */
function generateCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[randomAlphabetIndex()];
  }
  return out;
}

module.exports = { generateCode, ALPHABET, CODE_LENGTH };
