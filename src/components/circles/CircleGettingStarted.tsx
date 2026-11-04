import React, { useState } from 'react';
import { Check, X, ChevronRight, Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { type Circle } from '@/hooks/useCircles';

interface CircleGettingStartedProps {
  circle: Circle;
  onEditCircle: () => void;
  onOpenTab: (tab: string) => void;
}

/**
 * Dismissible setup guide for circle owners. Steps check themselves off from
 * live circle data and the card disappears once everything is done.
 */
const CircleGettingStarted: React.FC<CircleGettingStartedProps> = ({ circle, onEditCircle, onOpenTab }) => {
  const storageKey = `circle-setup-dismissed-${circle.id}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === '1');

  const steps = [
    {
      id: 'banner',
      label: 'Add a cover banner',
      done: !!circle.cover_image_url,
      onClick: onEditCircle,
    },
    {
      id: 'post',
      label: 'Write your first post',
      done: (circle.posts_count ?? 0) > 0,
      onClick: () => onOpenTab('feed'),
    },
    {
      id: 'invite',
      label: 'Invite your first members',
      done: (circle.members_count ?? 0) > 1,
      onClick: () => onOpenTab('members'),
    },
    ...(circle.enabled_features.includes('videos')
      ? [{
          id: 'video',
          label: 'Upload your first video',
          done: (circle.videos_count ?? 0) > 0,
          onClick: () => onOpenTab('learn'),
        }]
      : []),
    ...(circle.enabled_features.includes('resources')
      ? [{
          id: 'resource',
          label: 'Share your first resource',
          done: (circle.resources_count ?? 0) > 0,
          onClick: () => onOpenTab('learn'),
        }]
      : []),
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount === steps.length) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  return (
    <div className="px-4 py-3 animate-fade-in">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              <p className="font-semibold text-sm text-foreground">Get your circle started</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{doneCount}/{steps.length}</span>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss setup guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-gradient-primary rounded-full transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>

          <div className="space-y-1">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={step.done ? undefined : step.onClick}
                disabled={step.done}
                className={`flex items-center gap-3 w-full text-left py-1.5 px-1 rounded-lg transition-colors ${
                  step.done ? 'cursor-default' : 'hover:bg-primary/10'
                }`}
              >
                <span
                  className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${
                    step.done
                      ? 'bg-success text-success-foreground'
                      : 'border-2 border-muted-foreground/40'
                  }`}
                >
                  {step.done && <Check className="h-3 w-3" />}
                </span>
                <span className={`flex-1 text-sm ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {step.label}
                </span>
                {!step.done && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CircleGettingStarted;
