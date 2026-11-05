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
    optimizeDeps: { entries: ['src/tests/fixtures/chapa-return-ui.tsx'], include: ['react', 'react-dom/client', 'react-router-dom', '@tanstack/react-query', '@radix-ui/react-tabs', '@radix-ui/react-popover', '@radix-ui/react-alert-dialog', '@radix-ui/react-dialog'] },
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
        if (/^\/(verify|login|wallet-fixture)(\?|$)/.test(req.url || '')) {
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

async function pageFor(scenario: string, pending = false, search = '', route = 'verify') {
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
  await page.goto(`${base}/${route}${search}`, { timeout: 60000 });
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

test('wallet history lists test and failed attempts, filters modes and paginates receipt timelines', async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    await expect(page.getByRole('button',{name:/history-payment-0(?:\D|$)/})).toBeVisible();
    await expect(page.getByText('Failed at last check',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Load more payments',exact:true}).click();
    await expect(page.getByRole('button',{name:/history-payment-25(?:\D|$)/})).toBeVisible();
    await page.getByLabel('Payment mode').selectOption('test');
    await expect(page.getByRole('button',{name:/history-payment-1(?:\D|$)/})).toHaveCount(0);
    await page.getByRole('button',{name:/history-payment-0(?:\D|$)/}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog.getByText('Test successful',{exact:true})).toBeVisible();
    await expect(dialog.getByText('No spendable coin movement has been recorded for this payment.')).toBeVisible();
    await expect(dialog.getByText('fixture-provider-receipt',{exact:true})).toBeVisible();
    await dialog.getByRole('button',{name:'Load earlier status updates'}).click();
    await expect(dialog.getByRole('button',{name:'Load earlier status updates'})).toHaveCount(0);
  } finally {await page.context().close();}
});

test('checking a saved receipt updates its status without starting another checkout', async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    await page.getByRole('button',{name:/history-payment-1(?:\D|$)/}).click();
    const dialog=page.getByRole('dialog');await expect(dialog.getByText('Awaiting confirmation',{exact:true})).toBeVisible();
    await dialog.getByRole('button',{name:'Check payment status'}).click();
    await expect(dialog.getByText('Completed',{exact:true})).toBeVisible();
    assert.deepEqual(await calls(page),[{txRef:'history-payment-1'}]);
    assert.equal(await page.evaluate(()=>(window as any).chapaReturnFixture.payouts.length),0);
  } finally {await page.context().close();}
});

test('coin activity can load beyond 50 records and opens exact ledger details', async()=>{
  const page=await pageFor('history',false,'','wallet-fixture');
  try {
    await page.getByRole('tab',{name:'Coin activity',exact:true}).click();
    await expect(page.getByText('Your balance matches the recorded wallet movements.')).toBeVisible();
    for(let i=0;i<3;i++) await page.getByRole('button',{name:'Load more coin activity',exact:true}).click();
    await expect(page.getByText('Recorded movement 61',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Load more coin activity',exact:true})).toHaveCount(0);
    await page.getByText('View movement details',{exact:true}).first().click();
    await expect(page.getByText('ledger-000',{exact:true})).toBeVisible();
  } finally {await page.context().close();}
});

test('account-mismatched history responses are rejected before receipts can be displayed', async()=>{
  const page=await pageFor('history-wrong-account',false,'','wallet-fixture');
  try {
    await expect(page.getByRole('alert').filter({hasText:'Payment history could not be refreshed'})).toBeVisible();
    await expect(page.getByRole('button',{name:/history-payment-/})).toHaveCount(0);
  } finally {await page.context().close();}
});

test('withdrawal confirmation states test mode clearly and a mode change cannot submit a live payout', async()=>{
  const page=await pageFor('mode-change',false,'','wallet-fixture');
  try {
    await page.getByRole('tab',{name:'Withdraw',exact:true}).click();
    await expect(page.getByText('Test mode: withdrawals are recorded for testing.',{exact:false})).toBeVisible();
    await page.getByPlaceholder('Min. 10 ETB').fill('500');
    await page.getByPlaceholder('Full name as registered at bank').fill('Fixture Buyer');
    await page.getByPlaceholder('Account number').fill('1234567890');
    await page.getByRole('button',{name:/Select bank/}).click();
    await page.getByText('Fixture Bank',{exact:true}).click();
    await page.getByRole('button',{name:'Request Withdrawal',exact:true}).click();
    await expect(page.getByRole('alertdialog')).toContainText('Confirm Test Withdrawal');
    await page.getByRole('button',{name:'Confirm Withdrawal',exact:true}).click();
    await expect(page.getByText('Payment mode changed. Refresh the wallet and review the withdrawal before confirming.',{exact:true})).toBeVisible();
    assert.equal(await page.evaluate(()=>(window as any).chapaReturnFixture.payouts.length),0);
  } finally {await page.context().close();}
});

test('an uncertain checkout shows its saved-receipt guidance and subsequent clicks reuse the same request ID',async()=>{
  const page=await pageFor('topup-unconfirmed',false,'','wallet-fixture');
  try {
    await page.getByRole('tab',{name:'Top Up',exact:true}).click();
    await page.getByPlaceholder('Enter ETB amount (min. 10)').fill('50');
    await page.getByRole('button',{name:'Continue to Review',exact:true}).click();
    const pay=page.getByRole('button',{name:'Pay 50 ETB with Chapa',exact:true});
    for(let attempt=0;attempt<2;attempt++) {
      await pay.click();
      await expect(page.getByRole('alert').filter({hasText:'Your payment reference is recorded; check its status before trying another payment.'})).toBeVisible();
    }
    const attempts=await page.evaluate(()=>(window as any).chapaReturnFixture.checkouts);
    assert.equal(attempts.length,2);assert.equal(attempts[0].requestId,attempts[1].requestId);
    assert.equal(await page.evaluate(()=>localStorage.getItem('chapa:pending:00000000-0000-0000-0000-000000000001')),'saved-checkout-fixture');
    assert.ok(page.url().includes('/wallet-fixture'),'an unconfirmed checkout must not navigate to an invented URL');
  } finally {await page.context().close();}
});
