import { Check, Lock } from 'lucide-react';
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

export function CircleLockedCover({ thumbnail }: { thumbnail: string | null }) {
  return (
    <div className="relative isolate grid aspect-[2.24] place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-accent to-primary/20">
      {thumbnail && (
        <>
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="absolute inset-0 -z-10 size-full scale-105 object-cover blur-[4px]"
          />
          <div className="absolute inset-0 -z-10 bg-black/15" />
        </>
      )}
      <div className="grid justify-items-center gap-1.5 rounded-xl bg-card/85 px-3 py-2 text-sm font-semibold text-foreground backdrop-blur-sm">
        <Lock aria-hidden="true" className="size-4 text-primary" />
        Premium preview
      </div>
    </div>
  );
}

export function CirclePreviewFade() {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none space-y-2 py-2 blur-[3px] [mask-image:linear-gradient(black,transparent)]">
      <div className="h-2 w-[96%] rounded-full bg-muted-foreground/60" />
      <div className="h-2 w-[88%] rounded-full bg-muted-foreground/60" />
      <div className="h-2 w-[92%] rounded-full bg-muted-foreground/60" />
      <div className="h-2 w-[64%] rounded-full bg-muted-foreground/60" />
    </div>
  );
}
