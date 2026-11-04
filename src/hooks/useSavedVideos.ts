import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Video } from './useVideoFeed';

export const useSavedVideos = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedVideos = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setVideos([]);
        setLoading(false);
        return;
      }

      const { data: savedData, error: fetchError } = await supabase
        .from('video_saves')
        .select(`
          created_at,
          videos!inner (
            *,
            profiles!inner (
              id,
              username,
              name,
              initials,
              avatar_url,
              avatar_color,
              is_verified
            ),
            video_stats (
              likes_count,
              comments_count,
              shares_count,
              saves_count,
              views_count
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedVideos: Video[] = (savedData || []).map((save: any) => ({
        id: save.videos.id,
        user: {
          id: save.videos.profiles.id,
          username: save.videos.profiles.username,
          name: save.videos.profiles.name,
          initials: save.videos.profiles.initials,
          avatar: save.videos.profiles.avatar_url || '',
          avatarColor: save.videos.profiles.avatar_color,
          verified: save.videos.profiles.is_verified
        },
        url: save.videos.video_url,
        thumbnail: save.videos.thumbnail_url,
        title: save.videos.title,
        description: save.videos.description,
        tags: save.videos.tags || [],
        stats: {
          likes: save.videos.video_stats?.[0]?.likes_count || 0,
          comments: save.videos.video_stats?.[0]?.comments_count || 0,
          shares: save.videos.video_stats?.[0]?.shares_count || 0,
          saves: save.videos.video_stats?.[0]?.saves_count || 0,
          views: save.videos.video_stats?.[0]?.views_count || 0
        },
        liked: false,
        saved: true,
        createdAt: save.videos.created_at
      }));

      setVideos(formattedVideos);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching saved videos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedVideos();
  }, [fetchSavedVideos]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('saved-videos-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_saves'
      }, () => fetchSavedVideos())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSavedVideos]);

  return { videos, loading, error, refetch: fetchSavedVideos };
};
