import React, { useEffect, useState } from 'react';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { useProgressiveMedia } from '@/hooks/useProgressiveMedia';
import styles from './ProgressiveMedia.module.css';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';

interface ProgressiveMediaProps {
  file: File;
  className?: string;
  aspectRatio?: string;
}

export const ProgressiveMedia: React.FC<ProgressiveMediaProps> = ({
  file,
  className,
  aspectRatio = "aspect-[4/5]"
}) => {
  const { phase, previewSrc, fullSrc, stats, load } = useProgressiveMedia();
  const [isSharpReady, setIsSharpReady] = useState(false);

  useEffect(() => {
    if (file) {
      load(file);
    }
  }, [file, load]);

  // Handle sharp-swap state
  useEffect(() => {
    if (phase === 'done') {
      // Small delay to ensure browser has painted the full image
      const timer = setTimeout(() => setIsSharpReady(true), 50);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  const isPDF = file.type === 'application/pdf';

  // State: Initial Shimmer (during reading/compressing)
  if (phase === 'reading' || phase === 'compressing' || phase === 'idle') {
    return (
      <div className={cn(aspectRatio, "w-full rounded-xl bg-muted/30 flex items-center justify-center", className)}>
        <SerkleLoader label={phase === 'compressing' ? 'Optimizing file' : 'Preparing preview'} showText />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-black/5", aspectRatio, className)}>
      {/* 1. Blurry Preview Layer */}
      {previewSrc && (
        <div className="absolute inset-0">
          {isPDF ? (
            <div className={cn("w-full h-full flex flex-col items-center justify-center bg-primary/5", styles.blurLayer)}>
              <FileText className="w-12 h-12 text-primary/40" />
              <span className="text-[10px] uppercase font-bold text-primary/40 mt-2">Document Preview</span>
            </div>
          ) : (
            <img 
              src={previewSrc} 
              alt="Preview" 
              className={cn("w-full h-full object-cover", styles.blurLayer, isSharpReady && "opacity-0")} 
            />
          )}
        </div>
      )}

      {/* 2. Full Sharp Layer */}
      {fullSrc && !isPDF && (
        <img 
          src={fullSrc} 
          alt="Full source" 
          className={cn("absolute inset-0 w-full h-full object-cover", styles.sharpLayer, isSharpReady && styles.sharpLayerReady)} 
        />
      )}

      {/* 3. PDF Final Slate */}
      {phase === 'done' && isPDF && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/10 transition-opacity duration-500">
          <FileText className="w-16 h-16 text-primary" />
          <span className="text-sm font-bold text-primary mt-3">{file.name}</span>
          <span className="text-[10px] text-primary/60 uppercase tracking-widest mt-1">
            {(file.size / (1024 * 1024)).toFixed(2)} MB • READY
          </span>
        </div>
      )}

      {/* 4. Progress Bar (during full loading) */}
      {(phase === 'loading-full' || phase === 'preview') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <SerkleLoader size="sm" dark label="Loading preview" showText />
        </div>
      )}

      {/* 5. Stats Chip */}
      {stats && (
        <div className={cn(styles.statsChip, phase === 'done' && styles.statsVisible)}>
           {(stats.previewSize / 1024).toFixed(0)}KB • saved {stats.savedPct}% • first px in {stats.ttfp}ms
        </div>
      )}

      {/* Fallback Error */}
      {phase === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 text-red-500">
          <span className="text-xs font-bold">Failed to process media</span>
        </div>
      )}
    </div>
  );
};
