// Isolated local production-worker test host. Never serves production user data.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../dist/', import.meta.url));
let unavailable = false;
const types = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:4174');
  if (url.pathname === '/__pwa-offline-on') { unavailable = true; res.end('ok'); return; }
  if (url.pathname === '/__pwa-offline-off') { unavailable = false; res.end('ok'); return; }
  if (url.pathname === '/__pwa-check.html') {
    res.setHeader('Content-Type', 'text/html');
    res.end(await readFile(new URL('./pwa-smoke.html', import.meta.url))); return;
  }
  if (unavailable) { res.writeHead(503); res.end('Simulated app host unavailable'); return; }
  let filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!filename.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (!path.extname(filename)) filename = path.join(root, 'index.html');
  try { const body = await readFile(filename); res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream'); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(4174, '127.0.0.1', () => console.log('PWA smoke test: http://127.0.0.1:4174/__pwa-check.html'));
