import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CirclePremiumBadge({ locked }: { locked: boolean }) {
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold',
      locked ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success',
    )}>
      {!locked && <Check aria-hidden="true" className="size-3" />}
      Premium · {locked ? 'Locked' : 'Unlocked'}
    </span>
  );
}

export function CirclePreviewImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt="Post cover"
      loading="lazy"
      decoding="async"
      className="block h-auto max-h-[65dvh] w-full rounded-xl bg-muted/30 object-contain"
    />
  );
}
