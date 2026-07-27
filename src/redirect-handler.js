'use strict';

// TASK-007: GET /:code redirect handler.
// - SEC-9: strict route pattern, no filesystem access, no directory listing.
// - SEC-3: re-validates the stored URL at redirect time (open-redirect /
//   data-integrity defense) before ever writing a Location header.
// - SEC-4: shares the same rate-limiter shape as createHandler (separate
//   bucket instance, higher budget per docs/07-security.md: 120/min).
// - SEC-8: security headers applied to both success and 404 paths.

const { validateUrl } = require('./url-validator');
const { applySecurityHeaders } = require('./security-headers');
const { hashIp, logEvent } = require('./logger');

const CODE_PATH_RE = /^\/([0-9A-Za-z]{7})$/;

function clientIp(req) {
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function sendGeneric(res, status, body, extraHeaders) {
  applySecurityHeaders(res);
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  }
  if (body) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(status);
    res.end(JSON.stringify(body));
  } else {
    res.writeHead(status);
    res.end();
  }
}

/**
 * @param {{ service: { lookup: (code: string) => (string|null) },
 *           rateLimiter: ReturnType<typeof import('./rate-limiter').createRateLimiter>,
 *           logSink?: { write: (line: string) => void } }} deps
 */
function createRedirectHandler({ service, rateLimiter, logSink }) {
  return async function handleRedirect(req, res) {
    const ip = clientIp(req);

    // SEC-9 — reject anything not matching the exact code shape *before*
    // touching the store or the rate limiter's bucket for this path.
    const path = (req.url || '').split('?')[0];
    const match = CODE_PATH_RE.exec(path);
    if (!match) {
      sendGeneric(res, 404);
      return;
    }
    const code = match[1];

    const limit = rateLimiter.check(ip);
    if (!limit.allowed) {
      logEvent({ event: 'rate_limited', route: '/:code', ip_hash: hashIp(ip), status: 429 }, logSink);
      sendGeneric(res, 429, { error: 'rate_limited' }, { 'Retry-After': String(limit.retryAfterSec) });
      return;
    }

    const storedUrl = service.lookup(code);
    if (!storedUrl) {
      logEvent({ event: 'redirect_not_found', route: '/:code', code, status: 404 }, logSink);
      sendGeneric(res, 404);
      return;
    }

    // SEC-3 — re-validate at redirect time; a tampered/corrupted row must
    // never reach the Location header.
    const revalidated = validateUrl(storedUrl);
    if (!revalidated.ok) {
      logEvent({ event: 'redirect_revalidation_failed', route: '/:code', code, status: 404 }, logSink);
      sendGeneric(res, 404);
      return;
    }

    logEvent({ event: 'redirected', route: '/:code', code, status: 302 }, logSink);
    sendGeneric(res, 302, null, { Location: revalidated.url });
  };
}

module.exports = { createRedirectHandler };
