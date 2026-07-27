'use strict';

// TASK-008: Router — thin method+path dispatcher
// (docs/05-architecture.md component view: Router -> createHandler /
// redirectHandler / healthHandler). No business logic lives here.

const { applySecurityHeaders } = require('./security-headers');

/**
 * @param {{ shortenHandler: Function, redirectHandler: Function, healthHandler: Function }} handlers
 */
function createRouter({ shortenHandler, redirectHandler, healthHandler }) {
  return async function route(req, res) {
    const path = (req.url || '').split('?')[0];

    if (req.method === 'GET' && path === '/health') {
      healthHandler(req, res);
      return;
    }

    if (req.method === 'POST' && path === '/api/shorten') {
      await shortenHandler(req, res);
      return;
    }

    if (req.method === 'GET') {
      // Any other GET path is a redirect candidate; redirectHandler itself
      // enforces the strict SEC-9 code pattern and answers 404 otherwise.
      await redirectHandler(req, res);
      return;
    }

    applySecurityHeaders(res);
    res.writeHead(404);
    res.end();
  };
}

module.exports = { createRouter };
