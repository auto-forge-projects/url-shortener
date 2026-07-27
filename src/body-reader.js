'use strict';

// TASK-006: request body hardening.
// SEC-5: 4KB cap (byte-counted), Content-Type must be application/json.
// SEC-10: only { url: string } accepted; unknown/dangerous keys rejected
// (prototype pollution defense), JSON.parse errors map to 400 not 500.

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ALLOWED_KEYS = new Set(['url']);

function makeError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

/**
 * Reads and validates a request body as a strict `{ url: string }` JSON
 * object, enforcing SEC-5 (size/content-type) and SEC-10 (safe JSON shape).
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {{ maxBytes: number }} opts
 * @returns {Promise<{ url: string }>}
 */
function readJsonBody(req, { maxBytes }) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    if (!contentType.toLowerCase().startsWith('application/json')) {
      reject(makeError('unsupported_media_type', 'Content-Type must be application/json'));
      return;
    }

    let total = 0;
    const chunks = [];
    let settled = false;

    function finish(err, value) {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(value);
    }

    req.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        finish(makeError('payload_too_large', 'Request body exceeds size limit'));
        if (typeof req.destroy === 'function') req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('error', () => {
      finish(makeError('invalid_json', 'Error reading request body'));
    });

    req.on('end', () => {
      if (settled) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        finish(makeError('invalid_json', 'Malformed JSON body'));
        return;
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        finish(makeError('invalid_json', 'Body must be a JSON object'));
        return;
      }

      const keys = Object.keys(parsed);
      for (const key of keys) {
        if (DANGEROUS_KEYS.has(key)) {
          finish(makeError('invalid_json', 'Body contains a forbidden key'));
          return;
        }
        if (!ALLOWED_KEYS.has(key)) {
          finish(makeError('invalid_json', `Unexpected field: ${key}`));
          return;
        }
      }

      if (typeof parsed.url !== 'string') {
        finish(makeError('invalid_json', 'Field "url" must be a string'));
        return;
      }

      finish(null, { url: parsed.url });
    });
  });
}

module.exports = { readJsonBody };
