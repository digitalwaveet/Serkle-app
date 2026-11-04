import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  /** Optional Lucide icon shown when no image is provided. */
  icon?: LucideIcon;
  /** Illustration displayed above the text. Defaults to the generic circle empty-state image. Set to `null` to hide it. */
  imageSrc?: string | null;
  /** Accessible label for the illustration. */
  imageAlt?: string;
  /** Explains why the page is empty. */
  title: string;
  /** Explains what happens next or what the user can do. */
  description?: string;
  /** Call-to-action button label. */
  actionLabel?: string;
  /** Called when the CTA is pressed. */
  onAction?: () => void;
  /** Secondary button label. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

const DEFAULT_IMAGE = '/lovable-uploads/empty-circle-stats.svg';

/**
 * Generic empty-state block: illustration on top, then a title explaining
 * why the page is empty, a short description of what happens next, and a CTA.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  imageSrc = DEFAULT_IMAGE,
  imageAlt = 'Empty state illustration',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center space-y-4 ${className}`}>
      {imageSrc ? (
        <img src={imageSrc} alt={imageAlt} className="w-32 h-32 sm:w-40 sm:h-40" />
      ) : Icon ? (
        <div className="p-4 rounded-full bg-primary/10">
          <Icon className="size-8 text-primary" />
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="font-semibold text-foreground text-base">{title}</p>
        {description && <p className="text-sm text-muted-foreground max-w-[280px]">{description}</p>}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
        {actionLabel && onAction && (
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <Button size="sm" variant="outline" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
