'use strict';

// TASK-002: UrlValidator — kayıt öncesi kapı (FR-3, NFR-2, SEC-1, SEC-14).
// SEC-2 invariant: this module NEVER performs a network/DNS call. It only
// parses/inspects the string form of the URL.

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);
const MAX_LENGTH = 2048;
// Control characters U+0000-U+001F (CR/LF/TAB/NUL etc.) — log/header
// injection defense (SEC-1). Written as \x escapes, not raw bytes.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = new RegExp('[\\x00-\\x1F]');

const INVALID = Object.freeze({ ok: false, code: 'invalid_url' });

/**
 * @param {string} hostname already-lowercased, without brackets for IPv6
 * @returns {boolean} true if hostname is an IPv4 dotted literal
 */
function isIPv4Literal(hostname) {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/**
 * SEC-14 — derinlemesine savunma: hostname bir IP literal ise loopback,
 * link-local (bulut metadata dahil), özel aralıklar ve 0.0.0.0 reddedilir.
 * DNS rebinding'i kapatmaz (dokümante sınır) — yalnız literal IP hedefleri.
 *
 * @param {string} rawHostname URL.hostname value (may include [] for IPv6)
 * @returns {boolean} true if this literal must be denied
 */
function isDeniedIpLiteral(rawHostname) {
  // IPv6 literal loopback
  if (rawHostname === '[::1]' || rawHostname === '::1') return true;

  if (isIPv4Literal(rawHostname)) {
    const [a, b] = rawHostname.split('.').map(Number);
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / metadata
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 0 && b === 0) return true; // 0.0.0.0
    return false;
  }

  return false;
}

/**
 * Validates a candidate URL string against the shortener's acceptance
 * contract. Pure/synchronous — never performs I/O (SEC-2).
 *
 * @param {*} input
 * @returns {{ok: true, url: string} | {ok: false, code: string}}
 */
function validateUrl(input) {
  if (typeof input !== 'string') return INVALID;
  if (input.length === 0 || input.length > MAX_LENGTH) return INVALID;
  if (CONTROL_CHAR_RE.test(input)) return INVALID;
  if (input.trim().length === 0) return INVALID;

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return INVALID;
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) return INVALID;
  if (!parsed.hostname) return INVALID;
  if (isDeniedIpLiteral(parsed.hostname)) return INVALID;

  return { ok: true, url: parsed.toString() };
}

module.exports = { validateUrl };
