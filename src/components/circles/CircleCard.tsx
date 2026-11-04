import React from 'react';
import { MapPin, Users, Crown, Lock, BadgeCheck, Shield, Share2, Video, FolderOpen, CalendarDays } from 'lucide-react';
import { lastActiveText } from '@/lib/presenceStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Circle } from '@/hooks/useCircles';
import { getCircleType, displayCategory } from '@/lib/circleTypes';
import { shareCircle } from '@/utils/shareUtils';
import { CircleMembershipButton } from './CircleMembershipButton';
import { circleMembershipAction } from '@/lib/circleMembershipState';
import { formatCircleCount } from '@/lib/circleCountFormat';

interface CircleCardProps {
  circle: Circle;
  onClick: () => void;
  onManage?: () => void;
  onJoin?: (circleId: string) => void;
  isJoining?: boolean;
}

const CircleCard: React.FC<CircleCardProps> = ({ circle, onClick, onManage, onJoin, isJoining }) => {
  const action = circleMembershipAction(circle.membership_state);
  const handleMembershipClick = () => {
    if (action.canManage) (onManage || onClick)();
    else if (action.isJoined) onClick();
    else if (onJoin) onJoin(circle.id);
    else onClick();
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    shareCircle(circle.id, circle.name);
  };

  const typeConfig = getCircleType(circle.circle_type);
  const activityLabel = lastActiveText(circle.last_activity_at);

  // Distinct tags only: the type label and category can resolve to the same
  // text (e.g. type "business" + category "Business"), so dedupe case-insensitively.
  // Category may also hold comma-separated values — split those into separate tags.
  const tags = (() => {
    const seen = new Set<string>();
    const result: string[] = [];
    const add = (label?: string | null) => {
      if (!label) return;
      label
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const key = part.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            result.push(part);
          }
        });
    };
    add(typeConfig.label);
    add(displayCategory(circle.category));
    return result;
  })();

  const contentStats = [
    { icon: Video, count: circle.videos_count || 0, unit: 'video' as const },
    { icon: FolderOpen, count: circle.resources_count || 0, unit: 'resource' as const },
    { icon: CalendarDays, count: circle.events_count || 0, unit: 'event' as const },
  ].filter((s) => s.count > 0);

  return (
    <Card
      className="group w-full max-w-full overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] bg-card/50 backdrop-blur-sm border-border/50"
      onClick={onClick}
    >
      {/* Cover Image */}
      <div className="relative h-32 overflow-hidden rounded-t-lg">
        {circle.cover_image_url ? (
          <img
            src={circle.cover_image_url}
            alt={circle.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 right-3 flex gap-2">
          {circle.is_admin && !circle.is_owned && (
            <Badge variant="default" className="bg-primary/90 text-primary-foreground">
              <Shield className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          )}
          {circle.is_owned && (
            <Badge variant="default" className="bg-primary/90 text-primary-foreground">
              <Crown className="h-3 w-3 mr-1" />
              Owner
            </Badge>
          )}
          {circle.subscription_enabled && (
            <Badge variant="default" className="bg-gradient-secondary text-primary-foreground shadow-glow">
              <Crown className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
          {circle.is_private && (
            <Badge variant="secondary" className="bg-secondary/20 text-secondary border-secondary/30">
              <Lock className="h-3 w-3 mr-1" />
              Private
            </Badge>
          )}
        </div>

        {/* Avatar */}
        <div className="absolute bottom-3 left-3">
          <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold border-2 border-background shadow-glow">
            {circle.avatar_url ? (
              <img src={circle.avatar_url} alt={circle.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              circle.name.slice(0, 2).toUpperCase()
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {circle.name}
            </h3>
            <div className="flex items-center gap-1">
              <p className="text-username text-muted-foreground">by {circle.creator?.name || 'Unknown'}</p>
              {circle.creator?.is_verified && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <BadgeCheck className="size-4 text-secondary animate-scale-in cursor-pointer" aria-label="Verified Creator" />
                    </TooltipTrigger>
                    <TooltipContent><p>Verified Creator</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          {activityLabel && (
            <div className="flex items-center gap-1.5 flex-shrink-0 text-muted-foreground">
              <span className="text-xs whitespace-nowrap">
                {activityLabel}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-post-content text-muted-foreground mb-3 line-clamp-2">
          {circle.description}
        </p>

        {/* Meta Info */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-3 text-meta-info text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{formatCircleCount(circle.members_count || 0, 'member')}</span>
          </div>
          {contentStats.map(({ icon: Icon, count, unit }) => (
            <div key={unit} className="flex items-center gap-1">
              <Icon className="h-4 w-4" />
              <span>{formatCircleCount(count, unit)}</span>
            </div>
          ))}
          {circle.location && (
            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{circle.location}</span>
            </div>
          )}
        </div>

        {/* Type, category & pricing */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-badge">
                {tag}
              </Badge>
            ))}
            {circle.subscription_enabled ? (
              <Badge variant="secondary" className="text-badge gap-1">
                <Crown className="h-3 w-3" />
                {circle.subscription_price} coins/mo
              </Badge>
            ) : (
              <Badge variant="outline" className="text-badge text-success border-success/30">
                Free
              </Badge>
            )}
          </div>

          {/* Action Button */}
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 flex-shrink-0">
            <CircleMembershipButton snapshot={circle.membership_state} busy={isJoining}
              onClick={handleMembershipClick} />
            {action.isJoined && !action.canManage && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors" onClick={handleShare} aria-label="Share Circle">
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

  );
};

export default CircleCard;
