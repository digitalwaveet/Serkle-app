import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SERKLE_CAPTURE_URL || 'http://127.0.0.1:8083/';
const outputDir = path.resolve('artifacts/relax-responsive');
const viewports = [
  ['small-iphone', 375, 667],
  ['standard-iphone', 393, 852],
  ['large-iphone', 430, 932],
  ['compact-android', 360, 800],
  ['standard-android', 393, 851],
  ['large-samsung', 412, 915],
];

const mockFeed = [{
  video_id: '00000000-0000-4000-8000-000000000001',
  user_id: '00000000-0000-4000-8000-000000000002',
  username: 'serkle_creator',
  name: 'Serkle Creator',
  initials: 'SC',
  avatar_url: '/icon-192.png',
  avatar_color: '#713A20',
  is_verified: true,
  video_url: '/responsive-video-placeholder.mp4',
  thumbnail_url: '/opening/opening_background_1080x1920.png',
  title: 'A responsive moment for every screen',
  description: 'A longer caption with English, emojis ✨, #hashtags, and Amharic ሰላም ሰርክል to verify wrapping without colliding with the action rail or navigation.',
  tags: ['responsive', 'mobile', 'ሰርክል'],
  likes_count: 1240,
  comments_count: 87,
  shares_count: 32,
  saves_count: 19,
  views_count: 4200,
  user_has_liked: false,
  user_has_saved: false,
  created_at: new Date().toISOString(),
}];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});
const results = [];

for (const [name, width, height] of viewports) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    localStorage.setItem('cached_has_session', 'true');
    localStorage.setItem('cached_user_profile', JSON.stringify({
      id: '00000000-0000-4000-8000-000000000099',
      name: 'Responsive Tester',
      username: 'responsive_tester',
      email: 'responsive@example.test',
      initials: 'RT',
      avatar: '',
      bio: '',
      stats: { followers: 0, following: 0, replies: 0, posts: 0, videos: 0, saves: 0 },
    }));
    sessionStorage.setItem('nav_feedMode', JSON.stringify('relax'));
    sessionStorage.setItem('nav_activeTab', JSON.stringify('home'));
  });
  await page.route('**/rest/v1/rpc/get_video_feed', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockFeed),
  }));
  await page.route('**/responsive-video-placeholder.mp4', route => route.fulfill({
    status: 204,
    contentType: 'video/mp4',
    body: '',
  }));

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.relax-feed').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(500);

  if (name === 'standard-iphone') {
    await page.addStyleTag({ content: `
      .relax-feed { display: block !important; height: 100vh !important; }
      .relax-viewport { height: calc(100vh - 50px) !important; }
      .relax-nav-layer { position: absolute !important; inset: auto 0 0 !important; }
      .relax-header { padding-top: 12px !important; }
      .relax-meta { left: 10px !important; right: 70px !important; bottom: 10px !important; }
      .relax-actions { right: 8px !important; bottom: 12px !important; }
    ` });
    await page.screenshot({ path: path.join(outputDir, 'before-standard-iphone-393x852.png') });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.relax-feed').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(300);
  }

  const geometry = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
    const root = rect('.relax-feed');
    const player = rect('.relax-viewport');
    const header = rect('.relax-header');
    const actions = rect('.relax-actions');
    const meta = rect('.relax-meta');
    const nav = rect('.relax-nav-layer');
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visualViewport: window.visualViewport ? { width: window.visualViewport.width, height: window.visualViewport.height } : null,
      root: root && { left: root.left, top: root.top, right: root.right, bottom: root.bottom, width: root.width, height: root.height },
      player: player && { left: player.left, top: player.top, right: player.right, bottom: player.bottom, width: player.width, height: player.height },
      header: header && { left: header.left, top: header.top, right: header.right, bottom: header.bottom },
      actions: actions && { left: actions.left, top: actions.top, right: actions.right, bottom: actions.bottom },
      meta: meta && { left: meta.left, top: meta.top, right: meta.right, bottom: meta.bottom },
      nav: nav && { left: nav.left, top: nav.top, right: nav.right, bottom: nav.bottom, height: nav.height },
    };
  });

  const tolerance = 1;
  const checks = {
    rootMatchesViewport: Math.abs(geometry.root.height - geometry.visualViewport.height) <= tolerance && Math.abs(geometry.root.width - width) <= tolerance,
    headerInsidePlayer: geometry.header.top >= geometry.player.top - tolerance && geometry.header.right <= geometry.player.right + tolerance,
    actionsInsidePlayer: geometry.actions.top >= geometry.player.top - tolerance && geometry.actions.bottom <= geometry.player.bottom + tolerance,
    metadataInsidePlayer: geometry.meta.left >= geometry.player.left - tolerance && geometry.meta.bottom <= geometry.player.bottom + tolerance,
    metadataClearsActions: geometry.meta.right <= geometry.actions.left + tolerance,
    navigationInsideRoot: geometry.nav.bottom <= geometry.root.bottom + tolerance && geometry.nav.top >= geometry.player.bottom - tolerance,
  };

  results.push({ name, width, height, geometry, checks });
  await page.screenshot({ path: path.join(outputDir, `after-${name}-${width}x${height}.png`) });

  if (name === 'small-iphone' || name === 'standard-iphone') {
    await page.getByRole('button', { name: 'More' }).click();
    await page.waitForTimeout(220);
    const expanded = await page.evaluate(() => {
      const sheetElement = document.querySelector('.relax-meta--expanded');
      const sheet = sheetElement?.getBoundingClientRect();
      const player = document.querySelector('.relax-viewport')?.getBoundingClientRect();
      const header = document.querySelector('.relax-header')?.getBoundingClientRect();
      const actions = document.querySelector('.relax-actions');
      if (!sheetElement || !sheet || !player || !header || !actions) return null;
      return {
        sheet: { top: sheet.top, right: sheet.right, bottom: sheet.bottom, left: sheet.left, height: sheet.height },
        player: { top: player.top, right: player.right, bottom: player.bottom, left: player.left },
        header: { bottom: header.bottom },
        actionsOpacity: Number(getComputedStyle(actions).opacity),
        sheetScrollable: ['auto', 'scroll'].includes(getComputedStyle(sheetElement).overflowY),
      };
    });
    const expandedChecks = {
      exists: Boolean(expanded),
      insidePlayer: Boolean(expanded && expanded.sheet.left >= expanded.player.left - tolerance && expanded.sheet.right <= expanded.player.right + tolerance && expanded.sheet.bottom <= expanded.player.bottom + tolerance),
      belowHeader: Boolean(expanded && expanded.sheet.top >= expanded.header.bottom - tolerance),
      actionsCleared: Boolean(expanded && expanded.actionsOpacity === 0),
      scrollableWhenNeeded: Boolean(expanded?.sheetScrollable),
    };
    results.at(-1).expanded = expanded;
    results.at(-1).expandedChecks = expandedChecks;
    await page.screenshot({ path: path.join(outputDir, `after-${name}-${width}x${height}-expanded.png`) });
  }
  await context.close();
}

await browser.close();
await writeFile(path.join(outputDir, 'layout-results.json'), JSON.stringify(results, null, 2));

const failures = results.flatMap(result => Object.entries(result.checks)
  .filter(([, passed]) => !passed)
  .map(([check]) => `${result.name}: ${check}`)
  .concat(Object.entries(result.expandedChecks || {})
    .filter(([, passed]) => !passed)
    .map(([check]) => `${result.name} expanded: ${check}`)));

if (failures.length) {
  throw new Error(`Responsive layout checks failed:\n${failures.join('\n')}`);
}

console.log(`Captured ${results.length} responsive layouts in ${outputDir}`);
