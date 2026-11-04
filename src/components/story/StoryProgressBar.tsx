import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarConfig {
  isCurrent: boolean;
  isComplete: boolean;
}

interface StoryProgressBarProps {
  config: ProgressBarConfig[];
  progress: number;
  className?: string;
}

export const StoryProgressBar: React.FC<StoryProgressBarProps> = ({ config, progress, className }) => {
  return (
    <div className={cn("absolute top-3 left-3 right-3 flex gap-[3px] z-20", className)}>
      {config.map((bar, index) => (
        <div key={index} className="story-progress-track">
          <div
            className="story-progress-fill"
            style={{
              transform: `scaleX(${bar.isComplete ? 1 : bar.isCurrent ? progress / 100 : 0})`,
              transition: bar.isCurrent ? 'none' : 'none',
              transformOrigin: 'left',
              width: '100%',
            }}
          />
        </div>
      ))}
    </div>
  );
};
