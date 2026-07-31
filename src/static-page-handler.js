'use strict';

// TASK-010 / FR-4 (REQ-003) — the product's first real web UI: a single
// unstyled HTML page (DL-06-002, DL-04-003: zero deps/framework) whose form
// calls the existing POST /api/shorten (FR-1) contract from the browser.
//
// Security (DL-05-004 / Faz 7): served with a route-specific CSP that is
// LESS strict than the global default (script-src/connect-src 'self') only
// on these two routes; every other route keeps default-src 'none'. The
// client script writes results via textContent only, never innerHTML.

const { applySecurityHeaders } = require('./security-headers');

const PAGE_CSP =
  "default-src 'none'; script-src 'self'; connect-src 'self'; " +
  "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>url-shortener</title>
</head>
<body>
<h1>url-shortener</h1>
<form id="shorten-form">
  <label for="url">URL</label>
  <input id="url" name="url" type="url" required placeholder="https://...">
  <button type="submit">Kısalt</button>
</form>
<p id="result"></p>
<script src="/app.js"></script>
</body>
</html>
`;

const APP_JS = `'use strict';
// SEC-19: server errors are a bare { error: <code> } body — the client maps
// KNOWN codes to a fixed message here; it never displays server-provided
// free text (there isn't any, but this stays true even if fields are added).
var ERROR_MESSAGES = {
  invalid_url: 'Gecerli bir http/https adresi girin.',
  invalid_json: 'Istek gecersiz. Sayfayi yenileyip tekrar deneyin.',
  payload_too_large: 'Girdi cok uzun.',
  unsupported_media_type: 'Istek gecersiz. Sayfayi yenileyip tekrar deneyin.',
  rate_limited: 'Cok fazla istek, biraz sonra deneyin.',
  internal_error: 'Islem basarisiz oldu.'
};
function errorMessage(code) {
  return ERROR_MESSAGES[code] || 'Islem basarisiz oldu.';
}
document.getElementById('shorten-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  var input = document.getElementById('url');
  var result = document.getElementById('result');
  result.textContent = '';
  try {
    var res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: input.value })
    });
    var data = await res.json();
    result.textContent = res.ok ? (data.short_url || data.code) : errorMessage(data.error);
  } catch (err) {
    result.textContent = errorMessage(null);
  }
});
`;

function createStaticPageHandler() {
  function handlePage(req, res) {
    applySecurityHeaders(res);
    res.setHeader('Content-Security-Policy', PAGE_CSP);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(HTML);
  }

  function handleScript(req, res) {
    applySecurityHeaders(res);
    res.setHeader('Content-Security-Policy', PAGE_CSP);
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.writeHead(200);
    res.end(APP_JS);
  }

  return { handlePage, handleScript };
}

module.exports = { createStaticPageHandler };
