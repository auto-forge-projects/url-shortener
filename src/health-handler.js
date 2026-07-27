'use strict';

// TASK-008 / SEC-15 — health check leaks nothing beyond a fixed OK payload
// (no version, no path, no DB status, no row counts).

const { applySecurityHeaders } = require('./security-headers');

function createHealthHandler() {
  return function handleHealth(req, res) {
    applySecurityHeaders(res);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
  };
}

module.exports = { createHealthHandler };
