'use strict';

// TASK-006 / SEC-11 — structured single-line JSON logging.
// - Target URLs: query/fragment redacted before logging.
// - Client IP: per-process salted hash, never the raw address.
// - Log injection: CR/LF inside any value is stripped before serialization
//   (defense in depth on top of JSON.stringify already escaping them).

const crypto = require('node:crypto');

// Per-process salt — deliberately not persisted/config'able: the goal is to
// avoid storing/joining raw IPs across restarts, not to build a stable
// cross-session identifier.
const PROCESS_SALT = crypto.randomBytes(16).toString('hex');

/**
 * @param {string} ip
 * @returns {string} salted hash, never the raw IP
 */
function hashIp(ip) {
  return crypto.createHash('sha256').update(PROCESS_SALT).update(String(ip)).digest('hex').slice(0, 16);
}

/**
 * Redacts the query string and fragment of a URL for logging (SEC-11).
 * Tolerates malformed input — returns it unchanged rather than throwing.
 *
 * @param {string} url
 * @returns {string}
 */
function redactUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.search && !parsed.hash) {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return `${parsed.origin}${parsed.pathname}?<redacted>`;
  } catch {
    return url;
  }
}

/**
 * Recursively strips CR/LF from string values so a single log call can
 * never emit more than one physical line (log injection defense).
 */
function sanitizeValue(value) {
  if (typeof value === 'string') {
    return value.replace(/[\r\n]/g, ' ');
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return value;
}

// Default sink wraps process.stdout and owns the newline framing itself —
// callers/tests that pass a custom sink receive exactly one line, with no
// trailing terminator, so they can assert on its content directly.
const defaultSink = { write: (line) => process.stdout.write(line + '\n') };

/**
 * Emits one structured JSON log line to `sink` (defaults to process.stdout).
 *
 * @param {Record<string, unknown>} fields
 * @param {{ write: (line: string) => void }} [sink]
 */
function logEvent(fields, sink = defaultSink) {
  const record = sanitizeValue({ ts: new Date().toISOString(), ...fields });
  sink.write(JSON.stringify(record));
}

module.exports = { hashIp, redactUrl, logEvent };
