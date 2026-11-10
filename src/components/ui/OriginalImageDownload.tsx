import { useRef, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { downloadOriginalImage } from '@/lib/imageStorage';
import { cn } from '@/lib/utils';

export function OriginalImageDownload({ src, className }: { src: string; className?: string }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className={cn('absolute bottom-3 right-3 z-10', className)}>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        aria-label="Download original"
        title="Download original"
        className="grid size-11 place-items-center rounded-full bg-black/70 text-white shadow-sm hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={async event => {
          event.stopPropagation();
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError(false);
          try {
            await downloadOriginalImage(src);
          } catch {
            setError(true);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden="true" />
        ) : (
          <Download className="size-5" aria-hidden="true" />
        )}
      </button>
      {error && (
        <p role="alert" className="absolute bottom-full right-0 mb-2 w-52 rounded-lg bg-card p-2 text-sm text-foreground shadow">
          Download unavailable. Please try again.
        </p>
      )}
    </div>
  );
}
