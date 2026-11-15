// Local-only server: compiles sketches and serves the built app.
// Binds to 127.0.0.1, so nothing is exposed to the network.
import http from 'node:http';
import { exec } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { compileSketch, toolchainReady } from './compiler.mjs';
import { root } from './arduino-paths.mjs';

const PORT = Number(process.env.PORT || 3210);
const HOST = '127.0.0.1';
const distDir = path.join(root, 'dist');
const url = `http://localhost:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Sketch is too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(distDir, urlPath));
  if (!file.startsWith(distDir)) return sendJson(res, 403, { error: 'Forbidden' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Circuit World is not built yet. Run "npm run build" (or use start.bat).');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/health') {
      return sendJson(res, 200, { ok: true, toolchain: toolchainReady() });
    }
    if (req.url === '/api/compile' && req.method === 'POST') {
      if (!toolchainReady()) {
        return sendJson(res, 503, {
          ok: false,
          diagnostics: [{ line: 1, column: 1, severity: 'error', message: 'TOOLCHAIN_MISSING' }],
          output: 'The Arduino compiler is not installed yet. Run "npm run setup" once.',
        });
      }
      const { code, board } = JSON.parse(await readBody(req));
      if (typeof code !== 'string') return sendJson(res, 400, { error: 'code must be a string' });
      const result = await compileSketch(code, board || 'uno');
      return sendJson(res, 200, result);
    }
    if (req.url.startsWith('/api/')) return sendJson(res, 404, { error: 'Not found' });
    serveStatic(req, res);
  } catch (err) {
    sendJson(res, 500, { ok: false, error: String(err?.message || err) });
  }
});

/** With OPEN_BROWSER=1 (set by the start scripts), open the app once the server is ready. */
function openBrowser() {
  if (!process.env.OPEN_BROWSER) return;
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

server.on('error', async (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  // Double-clicked twice? If Circuit World is already running, just open it again.
  const health = await fetch(`${url}/api/health`).then((r) => r.json()).catch(() => null);
  if (health?.ok) {
    console.log(`Circuit World is already running at ${url}. Opening it.`);
    openBrowser();
    setTimeout(() => process.exit(0), 300);
  } else {
    console.log(`Port ${PORT} is used by another program, so Circuit World cannot start.`);
    process.exit(1);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Circuit World running at ${url}`);
  if (!toolchainReady()) console.log('Note: Arduino compiler not installed yet. Run "npm run setup".');
  openBrowser();
});
