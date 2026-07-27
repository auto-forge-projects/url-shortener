'use strict';

// TASK-006 / SEC-8 — response hardening applied to every response
// (redirects and JSON API alike).

/**
 * @param {import('node:http').ServerResponse} res
 */
function applySecurityHeaders(res) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
}

module.exports = { applySecurityHeaders };
