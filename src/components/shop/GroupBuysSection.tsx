import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Clock, TrendingDown } from 'lucide-react';
import { useGroupBuys, useGroupBuyMutations } from '@/hooks/useGroupBuys';
import { useNavigate } from 'react-router-dom';


export const GroupBuysSection: React.FC = () => {
  const { data: groupBuys, isLoading } = useGroupBuys();
  const { joinGroupBuy, leaveGroupBuy } = useGroupBuyMutations();
  const navigate = useNavigate();
  const [timers, setTimers] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!groupBuys) return;

    const interval = setInterval(() => {
      const newTimers: Record<string, number> = {};
      groupBuys.forEach(gb => {
        const now = new Date().getTime();
        const endTime = new Date(gb.end_time).getTime();
        const difference = endTime - now;
        newTimers[gb.id] = Math.max(0, Math.floor(difference / 1000));
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [groupBuys]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const handleToggleJoin = async (e: React.MouseEvent, groupBuyId: string, userJoined: boolean) => {
    e.stopPropagation();
    if (userJoined) {
      await leaveGroupBuy.mutateAsync(groupBuyId);
    } else {
      await joinGroupBuy.mutateAsync(groupBuyId);
    }
  };

  if (isLoading || !groupBuys || groupBuys.length === 0) return null;

  return (
    <div className="mobile-px mobile-py space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Group Buys</h2>
        </div>
        <Badge variant="secondary">Save Together!</Badge>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {groupBuys.map((gb) => {
          const progress = (gb.current_participants / gb.min_participants) * 100;
          const discountedPrice = gb.item.price * (1 - gb.discount_percentage / 100);
          const timeLeft = timers[gb.id] || 0;
          const isUnlocked = gb.current_participants >= gb.min_participants;

          return (
            <Card
              key={gb.id}
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/shop/product/${gb.item_id}`)}
            >
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <img
                      src={gb.item.images[0]}
                      alt={gb.item.title}
                      className="w-full h-full object-cover rounded"
                    />
                    <Badge className="absolute -top-1 -right-1 bg-success text-success-foreground text-xs">
                      -{gb.discount_percentage}%
                    </Badge>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 className="font-semibold text-sm line-clamp-2">
                      {gb.item.title}
                    </h3>

                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-success">
                        ${discountedPrice.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground line-through">
                        ${gb.item.price}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {gb.current_participants}/{gb.min_participants}
                        </span>
                        {isUnlocked ? (
                          <Badge className="h-5 bg-success text-success-foreground">
                            Unlocked!
                          </Badge>
                        ) : (
                          <span className="font-semibold text-primary">
                            {gb.min_participants - gb.current_participants} more needed
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isUnlocked ? 'bg-success' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(timeLeft)} left
                      </span>
                      <Button
                        size="sm"
                        variant={gb.user_joined ? "secondary" : "default"}
                        onClick={(e) => handleToggleJoin(e, gb.id, gb.user_joined)}
                        disabled={joinGroupBuy.isPending || leaveGroupBuy.isPending}
                        className="h-7 text-xs"
                      >
                        {(joinGroupBuy.isPending || leaveGroupBuy.isPending) ? (
                          <SerkleLoader size="xs" className="text-current" />
                        ) : gb.user_joined ? (
                          'Joined'
                        ) : (
                          'Join'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
