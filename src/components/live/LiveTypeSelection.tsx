import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React from 'react';
import { Globe, Users, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface LiveTypeSelectionProps {
  onTypeSelect: (type: 'random' | 'circle', circleId?: string, circleName?: string) => void;
}

const LiveTypeSelection: React.FC<LiveTypeSelectionProps> = ({ onTypeSelect }) => {
  const { user } = useUser();

  // Fetch user profile for random live preview
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase as any)
        .from('profiles')
        .select('name, username, avatar_url, initials, avatar_color')
        .eq('id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch circles created by the user
  const { data: userCircles, isLoading: circlesLoading } = useQuery({
    queryKey: ['user-created-circles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase as any)
        .from('circles')
        .select(`
          id,
          name,
          avatar_url,
          circle_stats!inner (
            members_count
          )
        `)
        .eq('creator_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id
  });

  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-1">Choose Live Type</h3>
        <p className="text-muted-foreground text-xs">
          Select where you want to broadcast
        </p>
      </div>

      <div className="space-y-3">
        {/* Random Live */}
        <button
          onClick={() => onTypeSelect('random')}
          className="w-full p-3 bg-card/10 backdrop-blur-md border border-white/15 rounded-lg hover:bg-card/20 transition-all group text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-blue-600/30 rounded-full flex items-center justify-center border border-blue-400/20">
                <Globe className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground text-sm">Random Live</h4>
                {profileLoading ? (
                  <SerkleLoader size="xs" />
                ) : profile ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Avatar className="w-3.5 h-3.5">
                      <AvatarImage src={profile.avatar_url} alt={profile.name} />
                      <AvatarFallback 
                        className="text-[6px]"
                        style={{ backgroundColor: profile.avatar_color }}
                      >
                        {profile.initials}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-xs text-muted-foreground">
                      Broadcasting as {profile.name || profile.username}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Broadcast to feed, relax & stories
                  </p>
                )}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </button>

        {/* Circle Live */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground text-sm">Your Circles</h4>
            {!circlesLoading && (
              <span className="text-xs text-muted-foreground">
                {userCircles?.length || 0} available
              </span>
            )}
          </div>
          
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {circlesLoading ? (
              <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading content" showText /></div>
            ) : userCircles && userCircles.length > 0 ? (
              userCircles.map((circle: any) => (
                <button
                  key={circle.id}
                  onClick={() => onTypeSelect('circle', circle.id, circle.name)}
                  className="w-full p-2.5 bg-card/10 backdrop-blur-md border border-white/15 rounded-lg hover:bg-card/20 transition-all group text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {circle.avatar_url ? (
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={circle.avatar_url} alt={circle.name} />
                          <AvatarFallback className="text-[8px]">
                            {circle.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-7 h-7 bg-gradient-to-br from-purple-500/20 to-purple-600/30 rounded-full flex items-center justify-center border border-purple-400/20">
                          <Users className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                      )}
                      <div>
                        <h5 className="font-medium text-foreground text-xs">{circle.name}</h5>
                        <p className="text-xs text-muted-foreground">
                          {circle.circle_stats?.members_count?.toLocaleString() || 0} members
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center p-3 bg-card/5 backdrop-blur-md border border-white/10 rounded-lg">
                <div className="text-muted-foreground text-xs">
                  No circles created yet
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Create a circle to go live in it
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTypeSelection;