import React from 'react';
import { BadgeCheck, Briefcase, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type BadgeType = 'verified' | 'business' | 'creator';

interface ProfileBadgeProps {
  type: BadgeType;
  className?: string;
}

const BADGE_CONFIG: Record<BadgeType, { icon: React.ElementType; label: string; className: string }> = {
  verified: {
    icon: BadgeCheck,
    label: 'Verified account',
    className: 'text-secondary',
  },
  business: {
    icon: Briefcase,
    label: 'Business account',
    className: 'text-primary',
  },
  creator: {
    icon: Sparkles,
    label: 'Creator account',
    className: 'text-success',
  },
};

/**
 * Subtle account badge placed beside the profile name.
 * Designed so new badge types can be added via BADGE_CONFIG without layout changes.
 */
const ProfileBadge: React.FC<ProfileBadgeProps> = ({ type, className = '' }) => {
  const config = BADGE_CONFIG[type];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center flex-shrink-0 ${className}`}>
            <Icon className={`size-5 ${config.className}`} aria-label={config.label} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ProfileBadge;
