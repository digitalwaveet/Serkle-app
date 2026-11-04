import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cacheManager, isFilePickerActive } from '@/utils/cacheManager';
import { useUpload } from '@/contexts/UploadContext';
import { toast } from 'sonner';

export default function UpdateNotifier() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { pathname } = useLocation();
  const { uploads } = useUpload();
  const busy = pathname.startsWith('/create/') || pathname === '/share' ||
    Object.values(uploads).some(upload => upload.status === 'uploading');

  useEffect(() => {
    if (import.meta.env.DEV) return;
    let cancelled = false;
    const check = async () => {
      if (document.hidden || isFilePickerActive()) return;
      try {
        const waiting = await cacheManager.checkForUpdates();
        if (!cancelled) setAvailable(waiting);
      } catch { /* Keep the app usable when offline. */ }
    };
    void check();
    const interval = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => { cancelled = true; clearInterval(interval); document.removeEventListener('visibilitychange', check); };
  }, []);

  const update = async () => {
    if (busy || isFilePickerActive()) { toast.info('Finish your draft or upload before updating.'); return; }
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) { toast.info('Close the open dialog before updating.'); return; }
    const hasDraft = Array.from(document.querySelectorAll('textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]):not([type="color"]), [contenteditable="true"]'))
      .some(element => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? !!element.value : !!element.textContent);
    if (hasDraft) { toast.info('Finish or clear your open draft before updating.'); return; }
    setUpdating(true);
    try { if (!await cacheManager.applyUpdate()) setAvailable(false); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to apply update.'); }
    finally { setUpdating(false); }
  };
  if (!available || dismissed) return null;
  return <aside role="status" className="fixed bottom-6 right-6 z-[100] w-[calc(100%-3rem)] max-w-sm rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-xl">
    <div className="flex items-start justify-between gap-3">
      <div><h2 className="font-semibold">A new Serkle version is ready</h2>
        <p className="mt-2 text-sm text-muted-foreground">{busy ? 'Finish your draft or upload, then update when you’re ready.' : 'Update when you’re ready. This reloads the app.'}</p></div>
      <button aria-label="Dismiss update" disabled={updating} onClick={() => setDismissed(true)}><X className="size-5" /></button>
    </div>
    <Button className="mt-4 w-full" disabled={updating || busy} onClick={update}><RefreshCw className="mr-2 size-4" />{updating ? 'Updating…' : 'Update Serkle'}</Button>
  </aside>;
}
