import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Video {
  id: string;
  user: {
    id: string;
    username: string;
    name: string;
    initials: string;
    avatar: string;
    avatarColor: string;
    verified: boolean;
  };
  url: string;
  thumbnail?: string;
  title: string;
  description: string;
  tags: string[];
  stats: {
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    views: number;
  };
  liked: boolean;
  saved: boolean;
  createdAt: string;
}

export const useVideoFeed = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchVideos = useCallback(async (pageNum: number) => {
    try {
      const { data, error: fetchError } = await supabase.rpc('get_video_feed', {
        page_num: pageNum,
        page_size: 10
      });

      if (fetchError) throw fetchError;

      const formattedVideos: Video[] = (data || []).map((video: any) => ({
        id: video.video_id,
        user: {
          id: video.user_id,
          username: video.username,
          name: video.name,
          initials: video.initials,
          avatar: video.avatar_url || '',
          avatarColor: video.avatar_color,
          verified: video.is_verified
        },
        url: video.video_url,
        thumbnail: video.thumbnail_url,
        title: video.title,
        description: video.description,
        tags: video.tags || [],
        stats: {
          likes: video.likes_count,
          comments: video.comments_count,
          shares: video.shares_count,
          saves: video.saves_count,
          views: video.views_count
        },
        liked: video.user_has_liked,
        saved: video.user_has_saved,
        createdAt: video.created_at
      }));

      if (pageNum === 0) {
        setVideos(formattedVideos);
      } else {
        setVideos(prev => [...prev, ...formattedVideos]);
      }

      setHasMore(formattedVideos.length === 10);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchVideos(nextPage);
    }
  }, [loading, hasMore, page, fetchVideos]);

  const refetch = useCallback(() => {
    setPage(0);
    fetchVideos(0);
  }, [fetchVideos]);

  useEffect(() => {
    fetchVideos(0);
  }, [fetchVideos]);

  // Real-time subscriptions
  useEffect(() => {
    const likesChannel = supabase
      .channel('video-likes-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_likes'
      }, () => refetch())
      .subscribe();

    const commentsChannel = supabase
      .channel('video-comments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_comments'
      }, () => refetch())
      .subscribe();

    const savesChannel = supabase
      .channel('video-saves-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_saves'
      }, () => refetch())
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(savesChannel);
    };
  }, [refetch]);

  return { videos, loading, error, hasMore, loadMore, refetch };
};
