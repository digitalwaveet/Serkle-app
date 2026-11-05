import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { createServer, transformWithEsbuild, type ViteDevServer } from 'vite';

let server: ViteDevServer, browser: Browser, base: string;
const fixtureSource = await readFile(new URL('./fixtures/chapa-return-client.ts', import.meta.url), 'utf8');
before(async () => {
  server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-chapa-return-ui',
    resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
    optimizeDeps: { entries: ['src/tests/fixtures/chapa-return-ui.tsx'], include: ['react', 'react-dom/client', 'react-router-dom', '@tanstack/react-query'] },
    server: { host: '127.0.0.1', port: 8995, hmr: false, watch: null },
    plugins: [{ name: 'isolated-chapa-return', enforce: 'pre',
      resolveId(source) {
        const path = source.replace(/\\/g, '/').replace(/\/+/g, '/');
        if (source === 'virtual:chapa-return-client' || /(?:@|\/src)\/integrations\/supabase\/client(?:\.ts)?$/.test(path)) return '\0chapa-return-client';
        if (/(?:@|\/src)\/contexts\/UserContext(?:\.tsx)?$/.test(path)) return '\0chapa-return-user';
      },
      async load(id) {
        const path = id.replace(/\\/g, '/').replace(/\/+/g, '/');
        if (id === '\0chapa-return-client') return (await transformWithEsbuild(fixtureSource, 'chapa-return-client.ts', { loader: 'ts', target: 'es2020' })).code;
        if (id === '\0chapa-return-user' || path.endsWith('/src/contexts/UserContext.tsx')) return "import {fixture} from 'virtual:chapa-return-client'; export const useUser=()=>({user:fixture.user,isLoading:false});";
        if (path.endsWith('/src/integrations/supabase/client.ts')) return "export {supabase} from 'virtual:chapa-return-client';";
      },
      configureServer(instance) { instance.middlewares.use((req, res, next) => {
        if (/^\/(verify|login)(\?|$)/.test(req.url || '')) {
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/src/tests/fixtures/chapa-return-ui.tsx"></script></body></html>');
        } else next();
      }); },
    }],
  });
  await server.listen();
  const address = server.httpServer!.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-proxy-server'] });
});
after(async () => { await browser?.close(); await server?.close(); });

async function pageFor(scenario: string, pending = false, search = '') {
  const context = await browser.newContext();
  context.setDefaultTimeout(15000);
  await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  await context.addInitScript(({ scenario, pending }) => {
    if (localStorage.getItem('chapa-return-fixture')) return;
    localStorage.setItem('chapa-return-fixture', scenario);
    if (pending) localStorage.setItem('chapa:pending:00000000-0000-0000-0000-000000000001', 'serkle-return-fixture');
  }, { scenario, pending });
  const page = await context.newPage();
  page.on('pageerror', error => process.stderr.write(`Return fixture: ${error.message}\n`));
  await page.goto(`${base}/verify${search}`);
  return page;
}
const calls = (page: Page) => page.evaluate(() => (window as any).chapaReturnFixture.calls);

test('successful test verification clears pending storage without losing the receipt or showing a failure toast', async () => {
  const page = await pageFor('test', true);
  try {
    await expect(page.getByRole('heading', { name: 'Test payment successful' })).toBeVisible();
    await expect(page.getByText('Test mode does not add spendable coins', { exact: false })).toBeVisible();
    await expect(page.getByText('No payment credit available')).toHaveCount(0);
    assert.equal(await page.evaluate(() => localStorage.getItem('chapa:pending:00000000-0000-0000-0000-000000000001')), null);
    assert.equal(new URL(page.url()).searchParams.get('tx_ref'), 'serkle-return-fixture');
    assert.equal((await calls(page)).length, 1, 'persisting the URL must not repeat verification');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Test payment successful' })).toBeVisible();
    await expect(page.getByText('Transaction reference is missing', { exact: false })).toHaveCount(0);
  } finally { await page.context().close(); }
});

test('a legacy bare return URL recovers its reference server-side with no local storage', async () => {
  const page = await pageFor('test');
  try {
    await expect(page.getByRole('heading', { name: 'Test payment successful' })).toBeVisible();
    assert.deepEqual(await calls(page), [{}]);
    assert.equal(new URL(page.url()).searchParams.get('tx_ref'), 'serkle-return-fixture');
  } finally { await page.context().close(); }
});

test('multiple recent receipts require a choice before displaying a verified payment', async () => {
  const page = await pageFor('selection');
  try {
    await expect(page.getByRole('heading', { name: 'Choose the payment to check' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toHaveCount(0);
    await page.getByRole('button', { name: /Check 20 ETB payment/ }).click();
    await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toBeVisible();
    assert.deepEqual(await calls(page), [{}, { txRef: 'serkle-second' }]);
  } finally { await page.context().close(); }
});

test('unknown returns show verification guidance without claiming failure or credit', async () => {
  const page = await pageFor('unknown');
  try {
    await expect(page.getByRole('heading', { name: 'Payment needs verification' })).toBeVisible();
    await expect(page.getByText('No payment credit available')).toHaveCount(0);
    await page.getByRole('button', { name: 'Check payment status' }).click();
    await expect(page.getByRole('heading', { name: 'Payment needs verification' })).toBeVisible();
    assert.equal((await calls(page)).length, 2);
  } finally { await page.context().close(); }
});

test('pending receipts can be rechecked, and unverified success never becomes wallet credit', async () => {
  const page = await pageFor('pending', false, '?trx_ref=serkle-return-fixture');
  try {
    await expect(page.getByRole('heading', { name: 'Payment pending' })).toBeVisible();
    await page.getByRole('button', { name: 'Check payment status' }).click();
    await expect(page.getByRole('heading', { name: 'Payment Successful!' })).toBeVisible();
    assert.equal((await calls(page)).length, 2);
  } finally { await page.context().close(); }
  const forged = await pageFor('forged', false, '?tx_ref=serkle-return-fixture');
  try {
    await expect(forged.getByRole('heading', { name: 'Payment pending' })).toBeVisible();
    await expect(forged.getByRole('heading', { name: 'Payment Successful!' })).toHaveCount(0);
  } finally { await forged.context().close(); }
});

test('login preserves the payment reference for verification after authentication', async () => {
  const page = await pageFor('login', false, '?tx_ref=serkle-return-fixture');
  try {
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    assert.equal(new URL(page.url()).searchParams.get('returnTo'), '/verify?tx_ref=serkle-return-fixture');
    assert.equal((await calls(page)).length, 0);
  } finally { await page.context().close(); }
});
