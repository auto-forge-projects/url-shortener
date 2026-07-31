'use strict';

// TASK-006: POST /api/shorten handler.
// Wires together: rate limiting (SEC-4), body hardening (SEC-5/SEC-10),
// URL validation (SEC-1, FR-3), LinkService (FR-1), response hardening
// (SEC-8), and structured logging (SEC-11). Errors are always mapped to a
// generic `{ error: <code> }` body — never a stack trace or SQLite message.

const { validateUrl } = require('./url-validator');
const { applySecurityHeaders } = require('./security-headers');
const { readJsonBody } = require('./body-reader');
const { hashIp, logEvent } = require('./logger');

const MAX_BODY_BYTES = 4096;

function clientIp(req) {
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function sendJson(res, status, payload, extraHeaders) {
  applySecurityHeaders(res);
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  }
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(status);
  res.end(JSON.stringify(payload));
}

const BODY_ERROR_STATUS = {
  payload_too_large: 413,
  unsupported_media_type: 415,
  invalid_json: 400
};

/**
 * @param {{ service: ReturnType<typeof import('./link-service').createLinkService>,
 *           baseUrl?: string, rateLimiter: ReturnType<typeof import('./rate-limiter').createRateLimiter>,
 *           logSink?: { write: (line: string) => void } }} deps
 *   `baseUrl` falsy (DL-06-001): response omits `short_url`, returns `{ code }` only.
 */
function createHandler({ service, baseUrl, rateLimiter, logSink }) {
  return async function handleShorten(req, res) {
    const ip = clientIp(req);

    // SEC-4 — rate limit before any body parsing / DB work.
    const limit = rateLimiter.check(ip);
    if (!limit.allowed) {
      logEvent({ event: 'rate_limited', route: '/api/shorten', ip_hash: hashIp(ip), status: 429 }, logSink);
      sendJson(res, 429, { error: 'rate_limited' }, { 'Retry-After': String(limit.retryAfterSec) });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES });
    } catch (err) {
      const status = BODY_ERROR_STATUS[err.code] || 400;
      logEvent({ event: 'body_rejected', route: '/api/shorten', reason: err.code, status }, logSink);
      sendJson(res, status, { error: err.code || 'invalid_json' });
      return;
    }

    const validation = validateUrl(body.url);
    if (!validation.ok) {
      logEvent({ event: 'validation_rejected', route: '/api/shorten', status: 400 }, logSink);
      sendJson(res, 400, { error: 'invalid_url' });
      return;
    }

    try {
      const { code } = service.shorten(validation.url);
      logEvent({ event: 'shortened', route: '/api/shorten', code, status: 201 }, logSink);
      const payload = baseUrl ? { code, short_url: `${baseUrl}/${code}` } : { code };
      sendJson(res, 201, payload);
    } catch (err) {
      logEvent({ event: 'shorten_failed', route: '/api/shorten', status: 500 }, logSink);
      sendJson(res, 500, { error: 'internal_error' });
    }
  };
}

module.exports = { createHandler };
