import React, { useState } from 'react';
import { formatCount } from '@/utils/formatters';
import FollowListModal from './FollowListModal';

interface FollowStatsProps {
  userId: string;
  followers: number;
  following: number;
  onProfileClick?: () => void;
  className?: string;
}

/**
 * Compact horizontal social proof: "12.4K Followers · 210 Following".
 * Both values are tappable and open the respective list modal.
 */
const FollowStats: React.FC<FollowStatsProps> = ({
  userId,
  followers,
  following,
  onProfileClick,
  className = '',
}) => {
  const [openList, setOpenList] = useState<'followers' | 'following' | null>(null);

  return (
    <>
      <div className={`flex items-center gap-1.5 text-sm ${className}`}>
        <button
          onClick={() => setOpenList('followers')}
          className="hover:underline underline-offset-2 transition-colors"
        >
          <span className="font-semibold text-foreground">{formatCount(followers)}</span>{' '}
          <span className="text-muted-foreground">Followers</span>
        </button>
        <span className="text-muted-foreground/60" aria-hidden>·</span>
        <button
          onClick={() => setOpenList('following')}
          className="hover:underline underline-offset-2 transition-colors"
        >
          <span className="font-semibold text-foreground">{formatCount(following)}</span>{' '}
          <span className="text-muted-foreground">Following</span>
        </button>
      </div>

      {openList && (
        <FollowListModal
          open={!!openList}
          onOpenChange={(open) => !open && setOpenList(null)}
          userId={userId}
          type={openList}
          onProfileClick={onProfileClick}
        />
      )}
    </>
  );
};

export default FollowStats;
