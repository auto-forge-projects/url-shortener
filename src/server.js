'use strict';

// TASK-008: HTTP server assembly — wires SqliteLinkStore -> LinkService ->
// {createHandler, redirectHandler, healthHandler} behind a Router, on top
// of node:http with slowloris-hardened timeouts (SEC-5).
//
// SEC-12 (non-root, read-only rootfs, DB dir fail-fast) is a Faz 12
// (Dockerfile/deploy) concern, not code in this module — see docs/07-security.md.

const http = require('node:http');

const { createSqliteLinkStore } = require('./sqlite-link-store');
const { createLinkService } = require('./link-service');
const { generateCode } = require('./code-generator');
const { createHandler } = require('./create-handler');
const { createRedirectHandler } = require('./redirect-handler');
const { createHealthHandler } = require('./health-handler');
const { createStaticPageHandler } = require('./static-page-handler');
const { createRouter } = require('./router');
const { createRateLimiter } = require('./rate-limiter');

const REQUEST_TIMEOUT_MS = 5000;
const HEADERS_TIMEOUT_MS = 5000;
const KEEP_ALIVE_TIMEOUT_MS = 5000;

// SEC-4 budgets per docs/07-security.md.
const SHORTEN_RATE = { windowMs: 60000, max: 10 };
const REDIRECT_RATE = { windowMs: 60000, max: 120 };

/**
 * @param {{ dbPath: string, baseUrl?: string,
 *           shortenRateLimit?: { windowMs: number, max: number },
 *           redirectRateLimit?: { windowMs: number, max: number } }} opts
 *   `*RateLimit` overrides exist for load/integration testing only — the
 *   production defaults (SEC-4 budgets) are used whenever they are omitted.
 * @returns {import('node:http').Server}
 */
function createServer({ dbPath, baseUrl, shortenRateLimit, redirectRateLimit }) {
  const store = createSqliteLinkStore(dbPath);
  const service = createLinkService({ store, generateCode });

  const shortenHandler = createHandler({
    service,
    baseUrl,
    rateLimiter: createRateLimiter(shortenRateLimit || SHORTEN_RATE)
  });
  const redirectHandler = createRedirectHandler({
    service,
    rateLimiter: createRateLimiter(redirectRateLimit || REDIRECT_RATE)
  });
  const healthHandler = createHealthHandler();
  const staticPageHandler = createStaticPageHandler();

  const router = createRouter({ shortenHandler, redirectHandler, healthHandler, staticPageHandler });

  const server = http.createServer((req, res) => {
    router(req, res).catch(() => {
      // Defense in depth: a handler bug must not crash the process or leak
      // a stack trace (SEC-8). Handlers are expected to catch their own
      // errors; this is the last-resort net.
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal_error' }));
      }
    });
  });

  // SEC-5 — slowloris defense.
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;
  server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;

  server.on('close', () => {
    if (typeof store.close === 'function') store.close();
  });

  return server;
}

module.exports = { createServer };

if (require.main === module) {
  const dbPath = process.env.DB_PATH || '/data/links.db';
  const port = Number(process.env.PORT) || 3000;
  // DL-06-001: no localhost fallback — BASE_URL unset in prod means the
  // response omits `short_url` rather than returning an unreachable link.
  const baseUrl = process.env.BASE_URL || '';

  let server;
  try {
    server = createServer({ dbPath, baseUrl });
  } catch (err) {
    // Fail-fast if the DB directory is not writable etc. (docs/05-architecture.md
    // "Açık risk" — no silent fallback to a temp path).
    process.stderr.write(JSON.stringify({ event: 'boot_failed', error: String(err && err.message) }) + '\n');
    process.exit(1);
  }

  server.listen(port, () => {
    process.stdout.write(JSON.stringify({ event: 'listening', port }) + '\n');
  });
}
