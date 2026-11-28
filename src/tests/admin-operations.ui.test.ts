import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium, expect, type Browser } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let browser: Browser;
let base: string;

const fixture = `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { MemoryRouter, Route, Routes } from 'react-router-dom';
  import { ThemeProvider } from '/src/contexts/ThemeContext.tsx';
  import AdminRoute from '/src/components/AdminRoute.tsx';
  import AdminLayout from '/src/pages/admin/AdminLayout.tsx';
  import AdminDashboard from '/src/pages/admin/AdminDashboard.tsx';
  import AdminPlatformHealth from '/src/pages/admin/AdminPlatformHealth.tsx';
  import AdminWalletOperations from '/src/pages/admin/AdminWalletOperations.tsx';
  import '/src/index.css';

  document.title = 'Serkle admin test fixture';
  const h = React.createElement;
  const query = new URLSearchParams(location.search);
  createRoot(document.getElementById('root')).render(
    h(QueryClientProvider, { client: new QueryClient() },
      h(ThemeProvider, {},
        h(MemoryRouter, { initialEntries: [query.get('path') || '/admin/dashboard'] },
          h(Routes, {},
            h(Route, { path: '/admin', element: h(AdminRoute, {}, h(AdminLayout)) },
              h(Route, { path: 'dashboard', element: h(AdminDashboard) }),
              h(Route, { path: 'platform-health', element: h(AdminPlatformHealth) }),
              h(Route, { path: 'wallet', element: h(AdminWalletOperations) })
            ),
            h(Route, { path: '/login', element: h('h1', {}, 'Sign in') })
          )
        )
      )
    )
  );
`;

const userContext = `
  import { useEffect, useState } from 'react';
  const initial = new URLSearchParams(location.search).get('account') || 'admin';
  export function useUser() {
    const [account, setAccount] = useState(initial);
    useEffect(() => {
      const update = (event) => setAccount(event.detail);
      window.addEventListener('fixture-account', update);
      return () => window.removeEventListener('fixture-account', update);
    }, []);
    return { isSessionReady: true, session: account === 'anonymous' ? null : { user: { id: account } } };
  }
`;

const client = `
  const query = new URLSearchParams(location.search);
  let attempts = 0;
  let activeMode = 'test';
  let withdrawalChecked = false;
  let latestReview = null;
  const counts = Object.fromEntries([
    'profiles', 'banned_profiles', 'posts', 'videos', 'stories', 'comments', 'messages',
    'circles', 'questions', 'orders', 'live_streams', 'pending_reports', 'pending_appeals',
    'pending_reviews', 'open_disputes', 'active_sos',
  ].map(key => [key, key === 'pending_reports' ? 6 : 0]));
  export const supabase = {
    from() {
      let account;
      return {
        select() { return this; },
        eq(column, value) { account = value; return this; },
        in() { return this; },
        async abortSignal() {
          if (account === 'retry' && ++attempts === 1) return { error: new Error('Role check temporarily unavailable') };
          const role = { admin: 'admin', retry: 'admin', super: 'super_admin' }[account];
          return { data: role ? [{ role }] : [], error: null };
        },
      };
    },
    rpc(name, args) {
      if (name === 'send_wallet_payment_review') {
        latestReview = { message: args._message, reason: args._reason, created_at: '2026-11-27T11:35:00Z' };
        return Promise.resolve({ data: { sent_at: latestReview.created_at } });
      }
      return { async abortSignal() {
        if (name === 'get_admin_coin_holdings') {
          if (query.has('holdings-error')) return { error: new Error('Holdings unavailable') };
          const holders = Array.from({length: 12}, (_, i) => ({
            user_id: 'holder-' + (i + 1), balance: 1000 - i * 10, name: 'Wallet user ' + (i + 1), username: 'walletuser' + (i + 1),
          }));
          const start = args._before_user_id ? holders.findIndex(holder => holder.user_id === args._before_user_id) + 1 : 0;
          return { data: {
            checked_at: '2026-11-27T11:35:00Z', summary: { circulating_coins: '11340', holders: '12' },
            items: holders.slice(start, start + args._limit + 1),
          } };
        }
        if (name === 'get_admin_payment_diagnostics') return { data: {
          status: 'pending', mode: 'live', kind: 'topup', checkout_state: 'ready', checkout_return_seen_at: null,
          verified_at: null, provider_reference: null, last_error_code: 'provider_timeout', review_code: null,
          events: [], latest_review: latestReview,
        } };
        if (name === 'get_admin_wallet_operations') {
          const live = args._mode === 'live';
          const tx = live ? 'serkle-live-fixture' : 'serkle-test-fixture';
          const matches = !args._reference || args._reference === tx;
          return { data: {
            checked_at: '2026-11-27T11:30:00Z', summary: { pending: live ? 1 : 0, failed: live ? 0 : 1, due: 0 },
            latest_run: live ? { started_at: '2026-11-27T11:28:00Z', completed_at: '2026-11-27T11:29:00Z', checked: 1, errors: 0 } : null,
            items: matches && (!args._kind || args._kind === 'all' || args._kind === (live ? 'withdrawal' : 'topup')) ? [{ id: 'one', tx_ref: tx, kind: live ? 'withdrawal' : 'topup', status: live ? (withdrawalChecked ? 'succeeded' : 'pending') : 'failed', amount: 500,
              currency: 'ETB', created_at: '2026-11-27T11:30:00Z', attempts: 1, has_check_error: !live, review_sent_at: latestReview?.created_at }] : [],
          } };
        }
        if (query.has('snapshot-error')) return { error: new Error('Snapshot unavailable') };
        return { data: {
          checked_at: '2026-11-27T11:30:00Z', counts,
          signups: Array.from({ length: 7 }, (_, index) => ({ day: '2026-11-' + (21 + index), count: index })),
        } };
      } };
    },
    functions: { async invoke(name, { body }) {
      if (name !== 'chapa-admin') throw new Error('Unexpected function');
      if (body.action === 'check_withdrawal') {
        withdrawalChecked = true;
        return { data: { reference: body.reference, status: 'succeeded' } };
      }
      if (body.action === 'check_payment') return { data: { reference: body.reference, status: 'pending' } };
      if (body.action === 'set_mode') activeMode = body.mode;
      return { data: { activeMode, availableModes: ['live', 'test'] } };
    } },
    auth: { async getUser() { return { data: { user: { id: query.get('account') || 'admin' } } }; } },
  };
`;

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite-admin-operations-ui',
    resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
    optimizeDeps: {
      entries: ['src/components/AdminRoute.tsx', 'src/pages/admin/Admin{Layout,Dashboard,PlatformHealth,WalletOperations}.tsx'],
      include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'react-router-dom', '@tanstack/react-query'],
    },
    server: { host: '127.0.0.1', port: 8898, strictPort: true, hmr: false, watch: null },
    plugins: [{
      name: 'admin-operations-fixture',
      enforce: 'pre',
      resolveId(id) {
        const path = id.replace(/\\/g, '/');
        if (path === '/admin-operations-fixture.js') return '\0admin-operations-fixture';
        if (path.endsWith('/contexts/UserContext') || path.endsWith('/contexts/UserContext.tsx')) return '\0admin-operations-user';
        if (path.endsWith('/integrations/supabase/client')) return '\0admin-operations-client';
      },
      load(id) {
        if (id === '\0admin-operations-fixture') return fixture;
        if (id === '\0admin-operations-user') return userContext;
        if (id === '\0admin-operations-client') return client;
      },
      configureServer(vite) {
        vite.middlewares.use((request, response, next) => {
          if (request.url?.split('?')[0] !== '/admin-operations-test') return next();
          response.setHeader('Content-Type', 'text/html');
          response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/admin-operations-fixture.js"></script></body></html>');
        });
      },
    }],
  });
  await server.listen();
  const address = server.httpServer?.address();
  assert(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-proxy-server'] });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function adminPage(query: string) {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.route('**/*', (route) => route.request().url().startsWith(`${base}/`) ? route.continue() : route.abort());
  page.on('pageerror', (error) => process.stderr.write(`${error.message}\n`));
  await page.goto(`${base}/admin-operations-test?${query}`, { waitUntil: 'commit' });
  return page;
}

test('role check retries, renders verified counts on mobile and drops access after switching accounts', async () => {
  const page = await adminPage('account=retry');
  try {
    await expect(page.getByRole('heading', { name: 'Could not verify admin access' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('link', { name: /6 Pending reports/ })).toBeVisible({ timeout: 15_000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('fixture-account', { detail: 'member' })));
    await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pending reports/ })).toHaveCount(0);
  } finally {
    await page.context().close();
  }
});

test('health passes authentication while leaving a failed database request and unchecked services visible', async () => {
  const page = await adminPage('account=super&path=/admin/platform-health&snapshot-error');
  try {
    await expect(page.getByRole('heading', { name: 'Platform health' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('listitem').filter({ hasText: 'Admin database request' })).toContainText('Unavailable');
    await expect(page.getByRole('listitem').filter({ hasText: 'Authentication session' })).toContainText('Passed');
    await expect(page.getByRole('listitem').filter({ hasText: 'Payment provider and webhooks' })).toContainText('Not checked');
  } finally {
    await page.context().close();
  }
});

test('mobile navigation searches workspace pages and closes after opening a destination', async () => {
  const page = await adminPage('account=super');
  try {
    await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Open admin navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'Admin navigation' });
    await drawer.getByRole('textbox', { name: 'Find an admin page' }).fill('health');
    await expect(drawer.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await drawer.getByRole('link', { name: 'Platform health', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Platform health' })).toBeVisible();
  } finally {
    await page.context().close();
  }
});

test('wallet support filters live and test receipts and keeps financial details behind the super-admin state', async () => {
  const denied = await adminPage('account=admin&path=/admin/wallet');
  try {
    await expect(denied.getByText('Payment monitoring is available to super admins.')).toBeVisible({ timeout: 30_000 });
    await expect(denied.getByText('serkle-live-fixture')).toHaveCount(0);
  } finally {
    await denied.context().close();
  }

  const page = await adminPage('account=super&path=/admin/wallet');
  try {
    await expect(page.getByText('serkle-live-fixture')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Test payments' }).click();
    await expect(page.getByText('serkle-live-fixture')).toHaveCount(0);
    await page.getByText('serkle-test-fixture').click();
    await expect(page.getByText('Test payments do not create spendable coins.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Exact transaction reference' }).fill('wrong-reference');
    await page.getByRole('button', { name: 'Search payments' }).click();
    await expect(page.getByText('No payments match these filters.')).toBeVisible();
  } finally {
    await page.context().close();
  }
});

test('a mode change requires confirmation and withdrawal checks refresh the recorded outcome', async () => {
  const page = await adminPage('account=super&path=/admin/wallet');
  try {
    await page.getByRole('button', { name: 'Use live mode' }).click({ timeout: 30_000 });
    const dialog = page.getByRole('dialog', { name: 'Switch to live mode?' });
    await expect(dialog.getByText(/will use real money/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Use live mode' })).toBeEnabled();
    await page.getByRole('button', { name: 'Use live mode' }).click();
    await dialog.getByRole('button', { name: 'Confirm mode change' }).click();
    await expect(page.getByRole('button', { name: 'Use live mode' })).toBeDisabled();
    await page.getByText('serkle-live-fixture').click();
    await page.getByRole('button', { name: 'Check withdrawal status' }).click();
    await expect(page.getByText('Succeeded', { exact: true })).toBeVisible();
  } finally {
    await page.context().close();
  }
});

test('payment review shows evidence, checks Chapa, and explicitly sends the edited message', async () => {
  const page = await adminPage('account=super&path=/admin/wallet');
  try {
    await page.getByText('serkle-live-fixture').click({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Review payment' }).click();
    const dialog = page.getByRole('dialog', { name: 'Review Chapa payment' });
    await expect(dialog).toContainText('Request to Chapa timed out');
    await expect(dialog).toContainText('No visit recorded');
    await dialog.getByRole('button', { name: 'Check with Chapa' }).click();
    await dialog.getByRole('button', { name: 'Write review message' }).click();
    await expect(dialog.getByRole('combobox', { name: 'Reason' })).toContainText('Request to Chapa timed out');
    const note = 'The confirmation request timed out. Please keep your receipt.';
    await dialog.getByRole('textbox', { name: 'Message to the user' }).fill(note);
    await dialog.getByRole('button', { name: 'Send review message' }).click();
    await expect(dialog.getByRole('region', { name: 'Last review sent' })).toContainText(note);
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Review message sent', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review payment' })).toBeFocused();
  } finally { await page.context().close(); }
});

test('wallet operations shows live coin circulation and pages through the highest balances', async () => {
  const page = await adminPage('account=super&path=/admin/wallet');
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    const section = page.getByRole('region', { name: 'Coin circulation' });
    const list = section.getByRole('list', { name: 'Coin holders ranked by balance' });
    await expect(section.getByText('11,340', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(section.getByText('12', { exact: true })).toBeVisible();
    await expect(list.getByRole('listitem')).toHaveCount(10);
    await expect(list.getByRole('listitem').first()).toContainText('Wallet user 1');
    await expect(list.getByRole('listitem').first()).toContainText('1,000 coins');
    await section.getByRole('button', { name: 'Next' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(list.getByRole('listitem').first()).toContainText('Wallet user 11');
    await expect(section.getByRole('button', { name: 'Next' })).toBeDisabled();
    await page.getByRole('button', { name: 'Test payments' }).click();
    await expect(section.getByText('11,340', { exact: true })).toBeVisible();
    await section.getByRole('button', { name: 'Refresh holdings' }).click();
    await expect(list.getByRole('listitem')).toHaveCount(10);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally { await page.context().close(); }
});
