import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { setFilePickerActive } from './utils/cacheManager'
import { initTheme } from './hooks/useDarkMode'
import { registerSW } from 'virtual:pwa-register'
import { clearRouteRecoveryMarker, recoverStaleApp } from './utils/routeRecovery'

if (import.meta.env.DEV) {
  // A development service worker can keep serving stale lazy chunks after
  // Vite updates. Remove this app's worker in dev, but leave Firebase's
  // messaging worker intact.
  void navigator.serviceWorker?.getRegistrations().then(async (registrations) => {
    const appRegistrations = registrations.filter((registration) => {
      const workers = [registration.active, registration.waiting, registration.installing].filter(Boolean);
      return workers.some((worker) => {
        try {
          const scriptUrl = new URL(worker!.scriptURL);
          return scriptUrl.origin === window.location.origin && !scriptUrl.pathname.endsWith('/firebase-messaging-sw.js');
        } catch {
          return false;
        }
      });
    });

    if (appRegistrations.length === 0) return;
    await Promise.all(appRegistrations.map((registration) => registration.unregister()));

    // A controlled page remains controlled until it navigates away. Reload
    // once after unregistering so all following module requests reach Vite.
    if (navigator.serviceWorker.controller) window.location.reload();
  }).catch((error) => console.warn('[PWA] Could not clear the development worker', error));
} else {
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'SERKLE_CLIENT_STATUS') {
      const hasError = !!document.querySelector('[data-serkle-error-boundary]');
      event.ports[0]?.postMessage({ healthy: !hasError });
    }
  });
  window.addEventListener('vite:preloadError', () => {
    void recoverStaleApp();
  });
  // Do not wait for remote images/fonts to finish loading before registration.
  registerSW({ immediate: true, onRegisterError(error) { console.error('[PWA] Registration failed', error); } });
}

clearRouteRecoveryMarker();

// Apply saved theme before first render to prevent flash-of-light-mode
initTheme();


// Global guard: prevent PWA reload when system file picker is open
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'file') {
    setFilePickerActive(true);
  }
}, true);

document.addEventListener('change', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'file') {
    setFilePickerActive(false);
  }
}, true);

// Also guard programmatic .click() on file inputs
const origClick = HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click = function () {
  if (this.type === 'file') {
    setFilePickerActive(true);
  }
  return origClick.call(this);
};

createRoot(document.getElementById("root")!).render(<App />);
