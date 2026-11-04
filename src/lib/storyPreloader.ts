/**
 * StoryPreloadManager
 * A singleton utility to handle background pre-buffering of story media.
 * Buffers next stories in the background to ensure instantaneous transitions.
 */
class StoryPreloadManager {
  private cache = new Map<string, HTMLImageElement | HTMLVideoElement>();

  /**
   * Triggers a background load for the given URL.
   */
  preload(url: string, type: "image" | "video") {
    if (!url || this.cache.has(url)) return;

    if (type === "image") {
      const img = new Image();
      img.src = url;
      this.cache.set(url, img);
      console.log(`[StoryPreloader] Preloading image: ${url}`);
    } else {
      const vid = document.createElement("video");
      vid.src = url;
      vid.preload = "auto";
      vid.muted = true;
      vid.playsInline = true;
      // Trigger load
      vid.load();
      this.cache.set(url, vid);
      console.log(`[StoryPreloader] Preloading video: ${url}`);
    }
  }

  /**
   * Checks if the media for a URL is fully loaded/buffered.
   */
  isReady(url: string): boolean {
    const el = this.cache.get(url);
    if (!el) return false;
    
    if (el instanceof HTMLImageElement) {
      return el.complete && el.naturalWidth !== 0;
    } else {
      // 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA
      return (el as HTMLVideoElement).readyState >= 3;
    }
  }

  /**
   * Optional: Returns the cached element.
   */
  getElement(url: string) {
    return this.cache.get(url);
  }

  /**
   * Clears old entries to prevent memory leaks in very long sessions.
   * Keeps the most recent N items.
   */
  prune(keepUrls: string[]) {
    const keepSet = new Set(keepUrls);
    for (const [url, el] of this.cache.entries()) {
      if (!keepSet.has(url)) {
        if (el instanceof HTMLVideoElement) {
          el.pause();
          el.src = "";
          el.load();
        } else if (el instanceof HTMLImageElement) {
          el.src = "";
        }
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        this.cache.delete(url);
      }
    }
  }
}

export const storyPreloader = new StoryPreloadManager();
