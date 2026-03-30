/**
 * Local development server — mirrors Vercel's behaviour:
 *   • Serves /public as static files with the same security headers
 *   • Routes /api/* to the real serverless handler modules
 *
 * Usage:  node dev-server.js
 */

import http      from 'node:http';
import fs        from 'node:fs/promises';
import path      from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env before anything else (Node 20.6+)
try { process.loadEnvFile(); } catch { /* no .env or already set */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// ── Security headers (mirrors vercel.json) ───────────────────────
const SEC = {
  'x-content-type-options':  'nosniff',
  'x-frame-options':         'DENY',
  'referrer-policy':         'strict-origin-when-cross-origin',
  'permissions-policy':      'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://browser.sentry-cdn.com; style-src 'self' 'unsafe-inline'; frame-src https://challenges.cloudflare.com; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com https://*.ingest.sentry.io; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
};

// ── Helpers ──────────────────────────────────────────────────────

/** Read JSON body from request stream */
async function readBody(req) {
  if (!req.headers['content-type']?.includes('application/json')) return {};
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve({}); }
    });
  });
}

/** Express-compatible res shim */
function makeRes(nodeRes) {
  let statusCode = 200;
  const headers  = { ...SEC };
  const shim = {
    status(code)   { statusCode = code; return shim; },
    json(data)     {
      headers['content-type'] = 'application/json';
      nodeRes.writeHead(statusCode, headers);
      nodeRes.end(JSON.stringify(data));
    },
    send(body)     { nodeRes.writeHead(statusCode, headers); nodeRes.end(String(body)); },
    end(body = '') { nodeRes.writeHead(statusCode, headers); nodeRes.end(body); },
  };
  return shim;
}

// ── API routing table ─────────────────────────────────────────────
function resolveApiHandler(segments) {
  const [a, b] = segments;
  const params = {};

  if      (a === 'auth' && b === 'login')   return { file: 'api/auth/login.js', params };
  else if (a === 'contact'  && !b)          return { file: 'api/contact.js', params };
  else if (a === 'customers' && !b)         return { file: 'api/customers/index.js', params };
  else if (a === 'customers' && b)        { params.id = b; return { file: 'api/customers/[id].js', params }; }
  else if (a === 'orders'    && !b)         return { file: 'api/orders/index.js', params };
  else if (a === 'orders'    && b)        { params.id = b; return { file: 'api/orders/[id].js', params }; }
  return null;
}

async function dispatchApi(req, nodeRes) {
  const urlObj   = new URL(req.url, 'http://localhost');
  const segments = urlObj.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const route    = resolveApiHandler(segments);

  if (!route) {
    nodeRes.writeHead(404, SEC);
    return nodeRes.end(JSON.stringify({ message: 'API route not found' }));
  }

  // Augment req to look like Express
  req.body   = await readBody(req);
  req.query  = Object.fromEntries(urlObj.searchParams);
  req.params = route.params;

  try {
    const absPath = path.join(__dirname, route.file).replace(/\\/g, '/');
    const { default: handler } = await import(`file:///${absPath}`);
    await handler(req, makeRes(nodeRes));
  } catch (err) {
    console.error(`[API error] ${route.file}:`, err.message);
    nodeRes.writeHead(500, SEC);
    nodeRes.end(JSON.stringify({ message: 'Internal server error' }));
  }
}

// ── Static file serving ───────────────────────────────────────────
async function serveStatic(nodeRes, urlPath) {
  let fp = path.join(__dirname, 'public', urlPath === '/' ? 'index.html' : urlPath);
  if (!path.extname(fp)) fp += '.html'; // clean URLs → .html

  try {
    const content = await fs.readFile(fp);
    const ext     = path.extname(fp);
    nodeRes.writeHead(200, { ...SEC, 'content-type': MIME[ext] ?? 'text/plain' });
    nodeRes.end(content);
  } catch {
    nodeRes.writeHead(404, SEC);
    nodeRes.end('404 Not Found');
  }
}

// ── Main server ───────────────────────────────────────────────────
http.createServer(async (req, nodeRes) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname;
  console.log(`  ${req.method.padEnd(6)} ${urlPath}`);
  try {
    if (urlPath.startsWith('/api/')) await dispatchApi(req, nodeRes);
    else                             await serveStatic(nodeRes, urlPath);
  } catch (err) {
    console.error('Unhandled server error:', err);
    nodeRes.writeHead(500); nodeRes.end();
  }
}).listen(PORT, () => {
  console.log(`\n${'─'.repeat(45)}`);
  console.log(`  🚀  Dev server → http://localhost:${PORT}`);
  console.log(`  📁  Static: /public`);
  console.log(`  🔌  API:    /api/*`);
  console.log(`${'─'.repeat(45)}\n`);
});
