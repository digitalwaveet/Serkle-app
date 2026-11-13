import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, expect, type Browser } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

let server: ViteDevServer;
let browser: Browser;
let base = '';
const browserErrors: string[] = [];

before(async () => {
  server = await createServer({
    configFile: false,
    root: process.cwd(),
    cacheDir: 'node_modules/.vite-video-create-ui',
    optimizeDeps: { entries: ['src/tests/fixtures/video-create-ui.tsx'] },
    resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
    plugins: [{
      name: 'video-create-fixture',
      enforce: 'pre',
      resolveId(id) {
        if (/\/hooks\/useVideoMutations(?:\.tsx?)?$/.test(id.replace(/\\/g, '/'))) return '\0video-create-mutation';
      },
      load(id) {
        if (id !== '\0video-create-mutation') return;
        return `
          export const useVideoMutations = () => ({
            createVideo: async (data) => {
              window.videoCreateFixture.calls += 1;
              data.onProgress?.({ stage: 'preparing', percent: 1 });
              await new Promise(resolve => setTimeout(resolve, 40));
              data.onProgress?.({ stage: 'video', percent: 31 });
              await new Promise(resolve => setTimeout(resolve, 80));
              data.onProgress?.({ stage: 'video', percent: 61 });
              await new Promise(resolve => setTimeout(resolve, 120));
              return { success: false, error: 'Network interrupted. Your video is ready to retry.' };
            }
          });
        `;
      },
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (request.url !== '/video-create-test') return next();
          response.setHeader('Content-Type', 'text/html');
          response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/src/tests/fixtures/video-create-ui.tsx"></script></body></html>');
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

test('publish is single-flight and exposes real progress plus retryable failure', async () => {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  await page.goto(`${base}/video-create-test`);

  await page.locator('input[accept="video/*"]').first().setInputFiles(resolve('public/loading-animation.mp4'));
  await expect(page.getByText('loading-animation.mp4')).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.getByLabel('Title').fill('A reliable upload');
  await page.getByRole('button', { name: /Review video/ }).click();

  await page.evaluate(() => {
    const publish = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Publish video')) as HTMLButtonElement;
    publish.click();
    publish.click();
  });
  await expect(page.getByRole('button', { name: /Uploading 61%/ })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Upload paused')).toBeVisible();
  await expect(page.getByText('Network interrupted. Your video is ready to retry.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Retry upload/ })).toBeEnabled();
  assert.equal(await page.evaluate(() => window.videoCreateFixture.calls), 1);
  await page.close();
});
