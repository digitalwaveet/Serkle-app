import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Video } from './useVideoFeed';

export const useUserVideos = (userId: string) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserVideos = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: videosData, error: fetchError } = await supabase
        .from('videos')
        .select(`
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
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedVideos: Video[] = (videosData || []).map((video: any) => ({
        id: video.id,
        user: {
          id: video.profiles.id,
          username: video.profiles.username,
          name: video.profiles.name,
          initials: video.profiles.initials,
          avatar: video.profiles.avatar_url || '',
          avatarColor: video.profiles.avatar_color,
          verified: video.profiles.is_verified
        },
        url: video.video_url,
        thumbnail: video.thumbnail_url,
        title: video.title,
        description: video.description,
        tags: video.tags || [],
        stats: {
          likes: video.video_stats?.[0]?.likes_count || 0,
          comments: video.video_stats?.[0]?.comments_count || 0,
          shares: video.video_stats?.[0]?.shares_count || 0,
          saves: video.video_stats?.[0]?.saves_count || 0,
          views: video.video_stats?.[0]?.views_count || 0
        },
        liked: false,
        saved: false,
        createdAt: video.created_at
      }));

      setVideos(formattedVideos);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching user videos:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserVideos();
    }
  }, [userId, fetchUserVideos]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('user-videos-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'videos',
        filter: `user_id=eq.${userId}`
      }, () => fetchUserVideos())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUserVideos]);

  return { videos, loading, error, refetch: fetchUserVideos };
};
