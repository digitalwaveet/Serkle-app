import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';
import { useImagePreview } from '@/hooks/useImagePreview';
import type { ImageSize } from '@/lib/imageAsset';
import { cn } from '@/lib/utils';
import './optimized-image.css';

interface Props {
  src: string; alt: string; size?: ImageSize; className?: string; imageClassName?: string;
  style?: CSSProperties; loading?: 'eager' | 'lazy'; onLoad?: () => void;
  onOpen?: () => void; openLabel?: string;
  retryLabel?: string;
}
export function ImageSkeleton({ className }: { className?: string }) {
  return <div className={cn('image-skeleton', className)} data-testid="image-skeleton" role="status" aria-label="Loading image"><span className="sr-only">Loading image</span></div>;
}
export function OptimizedImage({ src, alt, size = 'display', className, imageClassName, style, loading = 'lazy', onLoad, onOpen, openLabel, retryLabel = 'Retry' }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(loading === 'eager');
  const [loaded, setLoaded] = useState(''), [broken, setBroken] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (loading === 'eager' || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [loading]);
  const media = useImagePreview(src, size, visible);
  const identity = `${src}:${media.url}:${attempt}`;
  const failed = media.failed || (!!media.url && broken === identity);
  const ready = !!media.url && loaded === identity;
  const ratio = media.asset?.width && media.asset?.height ? media.asset.width / media.asset.height : undefined;
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (media.url && img.current?.complete && img.current.naturalWidth) setLoaded(identity);
  }, [media.url, identity]);
  return <div ref={container} className={cn('optimized-image', className)} style={{ ...(ratio ? { aspectRatio: ratio } : {}), ...style }} aria-busy={!ready && !failed}>
    {!ready && !failed && <ImageSkeleton />}
    {failed ? <div className="optimized-image-error" role="status">
      <ImageOff aria-hidden="true" className="size-6" />
      <span>{media.asset?.status === 'failed' ? 'Preview could not be prepared' : 'Image unavailable'}</span>
      <button type="button" aria-label={retryLabel} className="min-h-11 inline-flex items-center gap-2 px-3 rounded-lg focus-visible:outline focus-visible:outline-2" onClick={e => { e.stopPropagation(); setAttempt(n => n + 1); void media.retry(); }}>
        <RefreshCw className="size-4" aria-hidden="true" />Retry
      </button>
      {onOpen && <button type="button" className="min-h-11 px-3 underline" onClick={onOpen}>Open attachment</button>}
    </div> : media.url && <img ref={img} key={identity} src={media.url} alt={alt} loading={loading} decoding="async" draggable={false}
      onLoad={() => { setLoaded(identity); onLoad?.(); }} onError={() => setBroken(identity)}
      className={cn('optimized-image-content', !ready && 'image-pending', imageClassName)} />}
    {onOpen && !failed && <button type="button" className="absolute inset-0 w-full h-full focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2" onClick={onOpen} aria-label={openLabel || `Open ${alt}`} />}
  </div>;
}
