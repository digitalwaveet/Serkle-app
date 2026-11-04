import React from 'react';
import { MapPin, Calendar, Users, Globe, Lock, Crown, Tag, ExternalLink, Target, Gift } from 'lucide-react';
import { getCircleType, displayCategory } from '@/lib/circleTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type Circle } from '@/hooks/useCircles';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCircleCount } from '@/lib/circleCountFormat';

interface CircleAboutProps {
  circle: Circle;
  onViewCreatorProfile?: (userId: string) => void;
}

const CircleAbout: React.FC<CircleAboutProps> = ({ circle, onViewCreatorProfile }) => {
  const { data: stats } = useQuery({
    queryKey: ['circle-stats', circle.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('circle_stats')
        .select('*')
        .eq('circle_id', circle.id)
        .maybeSingle();
      return data;
    },
    enabled: !!circle.id,
  });

  const circleStats = {
    totalPosts: stats?.posts_count || 0,
    totalEvents: stats?.events_count || 0,
    totalResources: stats?.resources_count || 0,
    monthlyActivity: stats?.monthly_activity || 0,
  };

  const hasAnyActivity =
    circleStats.totalPosts > 0 ||
    circleStats.totalEvents > 0 ||
    circleStats.totalResources > 0 ||
    circleStats.monthlyActivity > 0;

  const typeConfig = getCircleType(circle.circle_type);
  const tags = [
    typeConfig.label,
    displayCategory(circle.category),
    ...(circle.primary_language ? [circle.primary_language] : []),
    circle.is_online === false ? 'Local' : 'Online',
  ];

  // Use actual guidelines from database or empty array
  const displayGuidelines = circle.guidelines && circle.guidelines.length > 0 
    ? circle.guidelines 
    : [];
  
  // Use actual about text from database or just the description
  const displayAboutText = circle.about_text || circle.description;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Description */}
      <Card className="mx-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            About This Circle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground leading-relaxed mb-4">
            {displayAboutText}
          </p>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                <Tag className="h-3 w-3" />
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Who it's for / What members receive */}
      {(circle.target_audience || circle.member_benefits) && (
        <Card className="mx-0">
          <CardHeader>
            <CardTitle>Membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {circle.target_audience && (
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Who this circle is for</p>
                  <p className="text-sm text-muted-foreground">{circle.target_audience}</p>
                </div>
              </div>
            )}
            {circle.member_benefits && (
              <div className="flex items-start gap-3">
                <Gift className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">What members receive</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{circle.member_benefits}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Card className="mx-0">
        <CardHeader>
          <CardTitle>Circle Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {hasAnyActivity ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{formatCircleCount(circleStats.totalPosts, 'post')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{formatCircleCount(circleStats.totalEvents, 'event')} hosted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{formatCircleCount(circleStats.totalResources, 'resource')} shared</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{circleStats.monthlyActivity}%</p>
                <p className="text-sm text-muted-foreground">Monthly Activity</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-6">
              <img
                src="/lovable-uploads/empty-circle-stats.svg"
                alt="Empty circle statistics"
                className="w-40 h-40 mb-4"
              />
              <p className="text-lg font-semibold text-foreground">You're just getting started.</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                No activity yet. Create your first post to engage your circle.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Circle Info */}
      <Card className="mx-0">
        <CardHeader>
          <CardTitle>Circle Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Created</p>
              <p className="text-sm text-muted-foreground">
                {circle.created_at ? new Date(circle.created_at).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Members</p>
              <p className="text-sm text-muted-foreground">
                {formatCircleCount(circle.members_count || 0, 'member')}
              </p>
            </div>
          </div>
          
          {circle.location && (
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Location</p>
                <p className="text-sm text-muted-foreground">{circle.location}</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3">
            {circle.is_private ? (
              <Lock className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Globe className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Privacy</p>
              <p className="text-sm text-muted-foreground">
                {circle.is_private ? 'Private - Invite only' : 'Public - Anyone can join'}
              </p>
            </div>
          </div>
          
          {circle.subscription_enabled && (
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Membership</p>
                <p className="text-sm text-muted-foreground">
                  Premium Circle — {circle.subscription_method === 'before_join'
                    ? 'subscription required to join'
                    : 'subscribe for Premium content'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Circle Guidelines */}
      {displayGuidelines.length > 0 && (
        <Card className="mx-0">
          <CardHeader>
            <CardTitle>Circle Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {displayGuidelines.map((rule, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground">{rule}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Creator Info */}
      {circle.creator && (
        <Card className="mx-0">
          <CardHeader>
            <CardTitle>Circle Creator</CardTitle>
          </CardHeader>
          <CardContent>
            <button 
              className="flex items-center gap-4 w-full text-left hover:opacity-80 transition-opacity"
              onClick={() => onViewCreatorProfile?.(circle.creator_id)}
            >
              {circle.creator.avatar_url ? (
                <img 
                  src={circle.creator.avatar_url} 
                  alt={circle.creator.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-lg font-semibold">
                  {circle.creator.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{circle.creator.name}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  @{circle.creator.username}
                </p>
                <span className="text-sm text-primary">
                  <ExternalLink className="h-4 w-4 inline mr-1" />
                  View Profile
                </span>
              </div>
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CircleAbout;
