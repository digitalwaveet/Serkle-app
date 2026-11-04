// Cache management utilities for force refresh and cache busting

const APP_VERSION_KEY = 'app_version';
const APP_VERSION_INIT_KEY = 'app_version_init_time';

// Use a stable version: set once per session, not on every module reload
const getStableVersion = (): string => {
  let v = sessionStorage.getItem(APP_VERSION_INIT_KEY);
  if (!v) {
    v = Date.now().toString();
    sessionStorage.setItem(APP_VERSION_INIT_KEY, v);
  }
  return v;
};
const CURRENT_VERSION = getStableVersion();

// Track if a file picker/camera flow is active to prevent reloads during/after media selection
let filePickerActive = false;
let filePickerTimeout: ReturnType<typeof setTimeout> | null = null;
const FILE_PICKER_GUARD_UNTIL_KEY = 'file_picker_guard_until';
const FILE_PICKER_OPEN_GUARD_MS = 120000; // survive app background/restart while camera app is open
const FILE_PICKER_RETURN_GUARD_MS = 15000; // grace period after returning

const setGuardUntil = (msFromNow: number) => {
  localStorage.setItem(FILE_PICKER_GUARD_UNTIL_KEY, String(Date.now() + msFromNow));
};

const isGuardWindowActive = () => {
  const until = Number(localStorage.getItem(FILE_PICKER_GUARD_UNTIL_KEY) || '0');
  return Number.isFinite(until) && until > Date.now();
};

export const setFilePickerActive = (active: boolean) => {
  if (filePickerTimeout) clearTimeout(filePickerTimeout);

  if (active) {
    filePickerActive = true;
    setGuardUntil(FILE_PICKER_OPEN_GUARD_MS);

    // Safety auto-release in case no change event fires (cancel/OS interrupt)
    filePickerTimeout = setTimeout(() => {
      filePickerActive = false;
    }, FILE_PICKER_OPEN_GUARD_MS);
  } else {
    // Delay deactivation to cover visibility/focus events after returning from camera/file app
    setGuardUntil(FILE_PICKER_RETURN_GUARD_MS);
    filePickerTimeout = setTimeout(() => {
      filePickerActive = false;
    }, FILE_PICKER_RETURN_GUARD_MS);
  }
};

export const isFilePickerActive = () => filePickerActive || isGuardWindowActive();

export const cacheManager = {
  // Force refresh the page and clear all caches
  async forceRefresh() {
    try {
      // Clear IndexedDB React Query cache
      const { clearIDBCache } = await import('@/utils/queryPersister');
      await clearIDBCache();

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
      }

      // Clear version tracking to force fresh load
      localStorage.removeItem(APP_VERSION_KEY);
      sessionStorage.clear();

      // Force reload with cache bypass (hard reload)
      window.location.reload();
    } catch (error) {
      console.error('Error during force refresh:', error);
      // Fallback to simple reload
      window.location.reload();
    }
  },

  // Check for app updates with active polling
  async checkForUpdates() {
    // Never perform update checks while picker/camera guard is active
    if (isFilePickerActive()) return false;

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          // Actively check for updates
          await registration.update();
          return registration.waiting !== null;
        }
      } catch (error) {
        // Silently ignore check errors to avoid noisy logs
      }
    }
    return false;
  },

  // Apply pending updates
  async applyUpdate() {
    if (isFilePickerActive()) throw new Error('Finish selecting your files before updating.');
    if (!('serviceWorker' in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.waiting) return false;
    // Never clear the outbox/caches or reload before the new worker takes control.
    await new Promise<void>((resolve, reject) => {
      const changed = () => { cleanup(); resolve(); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Update timed out. Please try again.')); }, 15000);
      const cleanup = () => {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('controllerchange', changed);
      };
      navigator.serviceWorker.addEventListener('controllerchange', changed);
      try { registration.waiting!.postMessage({ type: 'SKIP_WAITING' }); }
      catch (error) { cleanup(); reject(error); }
    });
    window.location.reload();
    return true;
  },

  // Add cache busting query parameter
  bustCache(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_t=${Date.now()}`;
  },

  // Check if app version has changed
  checkVersion(): boolean {
    const storedVersion = localStorage.getItem(APP_VERSION_KEY);
    const hasVersionChanged = storedVersion && storedVersion !== CURRENT_VERSION;
    
    if (!storedVersion) {
      localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
    }
    
    return hasVersionChanged;
  },

  // Update version tracking
  updateVersion() {
    localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
  },

  // Clear React Query cache (requires queryClient instance)
  async clearQueryCache(queryClient?: any) {
    if (queryClient) {
      queryClient.clear();
      console.log('React Query cache cleared');
    }
  }
};

// Add keyboard shortcut for force refresh in development
if (import.meta.env.DEV) {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+R or Cmd+Shift+R for force refresh
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      cacheManager.forceRefresh();
    }
  });
}
