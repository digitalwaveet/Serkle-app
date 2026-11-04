import { build } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'story-qa-dist');
// Rollup avoids the Windows sandbox's esbuild dependency-scanning limitation.
await build({
  configFile: false, root, plugins: [react()], logLevel: 'error',
  resolve: { alias: [
    { find: '@/contexts/UserContext', replacement: resolve(root, 'src/dev/storyQaUser.ts') },
    { find: '@/services/storyService', replacement: resolve(root, 'src/dev/storyQaService.ts') },
    { find: '@', replacement: resolve(root, 'src') },
  ] },
  build: { outDir: output, minify: false, cssMinify: false, rollupOptions: { input: resolve(root, 'story-preview.html') } },
});
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = resolve(output, '.' + (pathname === '/' ? '/story-preview.html' : pathname));
  if (!file.startsWith(output + sep)) { response.writeHead(403).end(); return; }
  try { const bytes = await readFile(file); response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes); }
  catch { response.writeHead(404).end('Not found'); }
}).listen(4176, '127.0.0.1', () => console.log('Isolated story QA: http://127.0.0.1:4176/story-preview.html — no story API writes'));
