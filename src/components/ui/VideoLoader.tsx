import React from 'react';
import { cn } from '@/lib/utils';
import { SerkleLoader } from './SerkleLoader';

interface VideoLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  label?: string;
  sublabel?: string;
  fullscreen?: boolean;
  dark?: boolean;
}

export const VideoLoader: React.FC<VideoLoaderProps> = ({ 
  size = 'md', 
  className, 
  label, 
  sublabel,
  fullscreen = false,
  dark = false,
}) => {
  const content = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <SerkleLoader size={size} dark={dark} label={label} showText={!!label} />
      {sublabel && (
        <p className={cn('text-sm', dark ? 'text-white/70' : 'text-muted-foreground')}>
          {sublabel}
        </p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center',
        dark ? 'bg-black/80' : 'bg-background/80 backdrop-blur-sm'
      )}>
        {content}
      </div>
    );
  }

  return content;
};

/** Inline wordmark for buttons. No extra video download or decoding. */
export const InlineVideoLoader: React.FC<{ className?: string }> = ({ className }) => (
  <SerkleLoader size="xs" className={cn('text-current', className)} />
);
