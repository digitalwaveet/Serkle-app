const refreshParam = '__serkle_reload';
const recoveryKey = 'serkle_last_recovered_entry';
const entrySelector = 'script[type="module"][src]';

export function isRouteLoadError(error: Error | null) {
  return !!error && /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk [\w-]+ failed|unable to preload css|chunkloaderror/i
    .test(`${error.name} ${error.message}`);
}

function freshUrl(path: string) {
  const url = new URL(path, window.location.href);
  // Older service workers exclude file-like URLs from their cached navigation
  // route. Keep that suffix in the query so the current app route is preserved.
  url.searchParams.set(refreshParam, `${Date.now()}.js`);
  return url;
}

async function activateWaitingServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update().catch(() => {});
    const waiting = registration?.waiting;
    if (!waiting) return;

    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 1500);
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {
          window.clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      waiting.postMessage({ type: 'SKIP_WAITING' });
    });
  } catch {
    // Proceed with hard navigation fallback.
  }
}

export function reloadAppPage(path = window.location.href) {
  if (!navigator.onLine) {
    window.location.reload();
    return;
  }
  void activateWaitingServiceWorker().finally(() => {
    window.location.replace(freshUrl(path));
  });
}

export function clearRouteRecoveryMarker() {
  const url = new URL(window.location.href);
  if (url.searchParams.has(refreshParam)) {
    url.searchParams.delete(refreshParam);
    window.history.replaceState(window.history.state, '', url);
  }
}

export async function recoverStaleApp() {
  try {
    const current = document.querySelector<HTMLScriptElement>(entrySelector)?.src;
    if (!navigator.onLine || !current || sessionStorage.getItem(recoveryKey) === current) return;

    const response = await fetch(freshUrl('/index.html'), { cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return;
    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    const source = html.querySelector(entrySelector)?.getAttribute('src');
    if (!source) return;
    const latest = new URL(source, window.location.origin);
    if (latest.origin !== window.location.origin || !latest.pathname.startsWith('/assets/') || latest.href === current) return;

    sessionStorage.setItem(recoveryKey, current);
    reloadAppPage();
  } catch {
    // The error screen remains available for a manual retry.
  }
}
