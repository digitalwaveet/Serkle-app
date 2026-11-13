import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, expect, type Browser } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';

let server: ViteDevServer;
let browser: Browser;
let base = '';
const browserErrors: string[] = [];

before(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    cacheDir: 'node_modules/.vite-video-thumbnail-ui',
    optimizeDeps: { entries: ['src/tests/fixtures/video-thumbnail-ui.tsx'] },
    resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
    plugins: [{
      name: 'video-thumbnail-fixture',
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (request.url !== '/video-thumbnail-test') return next();
          response.setHeader('Content-Type', 'text/html');
          response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/video-thumbnail-ui.tsx"></script></body></html>');
        });
      },
    }],
  });
  await server.listen();
  const address = server.httpServer!.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-proxy-server'] });
});

after(async () => {
  await browser?.close();
  await server?.close();
  assert.deepEqual(browserErrors, []);
});

test('loads duration, seeks the timeline and captures a real thumbnail frame', async () => {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  await page.goto(`${base}/video-thumbnail-test`);

  await expect(page.getByRole('dialog', { name: 'Select thumbnail' })).toBeVisible();
  await expect(page.getByTestId('thumbnail-duration')).not.toHaveText('--:--', { timeout: 20000 });
  await expect(page.getByTestId('thumbnail-duration')).not.toHaveText('0:00');
  const slider = page.getByTestId('thumbnail-timeline').locator('[role="slider"]');
  await expect(slider).toBeEnabled();
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Select frame' })).toBeEnabled({ timeout: 10000 });
  await page.getByRole('button', { name: 'Select frame' }).click();
  await expect(page.getByRole('status')).toHaveText('Thumbnail selected');
  await expect(page.getByAltText('Selected thumbnail')).toBeVisible();
  await page.close();
});
