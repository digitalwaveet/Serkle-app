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
              h(Route, { path: 'platform-health', element: h(AdminPlatformHealth) })
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
    rpc() {
      return { async abortSignal() {
        if (query.has('snapshot-error')) return { error: new Error('Snapshot unavailable') };
        return { data: {
          checked_at: '2026-11-27T11:30:00Z', counts,
          signups: Array.from({ length: 7 }, (_, index) => ({ day: '2026-11-' + (21 + index), count: index })),
        } };
      } };
    },
    auth: { async getUser() { return { data: { user: { id: query.get('account') || 'admin' } } }; } },
  };
`;

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir: 'node_modules/.vite-admin-operations-ui',
    resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
    optimizeDeps: {
      entries: ['src/components/AdminRoute.tsx', 'src/pages/admin/Admin{Layout,Dashboard,PlatformHealth}.tsx'],
      include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'react-router-dom', '@tanstack/react-query'],
    },
    server: { host: '127.0.0.1', port: 8898, strictPort: true, hmr: false, watch: null },
    plugins: [{
      name: 'admin-operations-fixture',
      enforce: 'pre',
      resolveId(id) {
        const path = id.replaceAll('\\', '/');
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
