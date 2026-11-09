import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadOriginalImage } from '@/lib/imageStorage';
export function OriginalImageDownload({ src }: { src: string }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  return <div className="relative z-10">
    <button type="button" disabled={busy} className="min-h-11 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-card/95 text-foreground shadow-sm focus-visible:outline focus-visible:outline-2" onClick={async event => {
      event.stopPropagation(); if (lock.current) return;
      lock.current = true; setBusy(true); setError(false);
      try { await downloadOriginalImage(src); } catch { setError(true); }
      finally { lock.current = false; setBusy(false); }
    }}><Download className="size-4" aria-hidden="true" />{busy ? 'Preparing download…' : 'Download original'}</button>
    {error && <p role="alert" className="text-sm bg-card text-foreground p-2 rounded-lg">Download unavailable. Please try again.</p>}
  </div>;
}
