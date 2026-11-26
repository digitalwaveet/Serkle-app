import { useState, useEffect, useCallback, useRef } from 'react';
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

const PAGE_SIZE = 10;

const formatVideoRow = (video: any): Video => ({
  id: video.video_id,
  user: {
    id: video.user_id,
    username: video.username,
    name: video.name,
    initials: video.initials,
    avatar: video.avatar_url || '',
    avatarColor: video.avatar_color,
    verified: Boolean(video.is_verified),
  },
  url: video.video_url,
  thumbnail: video.thumbnail_url,
  title: video.title,
  description: video.description,
  tags: video.tags || [],
  stats: {
    likes: Number(video.likes_count ?? 0),
    comments: Number(video.comments_count ?? 0),
    shares: Number(video.shares_count ?? 0),
    saves: Number(video.saves_count ?? 0),
    views: Number(video.views_count ?? 0),
  },
  liked: Boolean(video.user_has_liked),
  saved: Boolean(video.user_has_saved),
  createdAt: video.created_at,
});

export const useVideoFeed = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);

  const fetchVideos = useCallback(async (pageNum: number) => {
    try {
      const { data, error: fetchError } = await supabase.rpc('get_video_feed', {
        page_num: pageNum,
        page_size: PAGE_SIZE
      });

      if (fetchError) throw fetchError;

      const formattedVideos: Video[] = (data || []).map(formatVideoRow);

      if (pageNum === 0) {
        setVideos(formattedVideos);
      } else {
        setVideos(prev => {
          const existingIds = new Set(prev.map(v => v.id));
          const uniqueNext = formattedVideos.filter(v => !existingIds.has(v.id));
          return [...prev, ...uniqueNext];
        });
      }

      setHasMore(formattedVideos.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateVideo = useCallback((videoId: string, updater: (video: Video) => Video) => {
    setVideos(prev => prev.map(video => (video.id === videoId ? updater(video) : video)));
  }, []);

  const refreshLoadedVideos = useCallback(async () => {
    try {
      const loadedSize = (pageRef.current + 1) * PAGE_SIZE;
      const { data, error: fetchError } = await supabase.rpc('get_video_feed', {
        page_num: 0,
        page_size: loadedSize,
      });

      if (fetchError) throw fetchError;

      const formattedVideos: Video[] = (data || []).map(formatVideoRow);
      setVideos(formattedVideos);
      setHasMore(formattedVideos.length === loadedSize);
    } catch (err) {
      console.error('Error refreshing videos:', err);
    }
  }, []);

  const refreshVideoById = useCallback(async (videoId: string) => {
    try {
      const { data: statsData, error: statsError } = await supabase
        .from('video_stats')
        .select('likes_count, comments_count, shares_count, saves_count, views_count')
        .eq('video_id', videoId)
        .maybeSingle();

      if (statsError || !statsData) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      let liked: boolean | undefined;
      let saved: boolean | undefined;

      if (userId) {
        const [likeRes, saveRes] = await Promise.all([
          supabase
            .from('video_likes')
            .select('id')
            .eq('video_id', videoId)
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('video_saves')
            .select('id')
            .eq('video_id', videoId)
            .eq('user_id', userId)
            .maybeSingle(),
        ]);

        if (!likeRes.error) liked = Boolean(likeRes.data);
        if (!saveRes.error) saved = Boolean(saveRes.data);
      }

      setVideos(prev =>
        prev.map(video => {
          if (video.id !== videoId) return video;
          return {
            ...video,
            liked: typeof liked === 'boolean' ? liked : video.liked,
            saved: typeof saved === 'boolean' ? saved : video.saved,
            stats: {
              likes: Number(statsData.likes_count ?? video.stats.likes),
              comments: Number(statsData.comments_count ?? video.stats.comments),
              shares: Number(statsData.shares_count ?? video.stats.shares),
              saves: Number(statsData.saves_count ?? video.stats.saves),
              views: Number(statsData.views_count ?? video.stats.views),
            },
          };
        }),
      );
    } catch (err) {
      console.error('Error refreshing video stats:', err);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      pageRef.current = nextPage;
      setPage(nextPage);
      fetchVideos(nextPage);
    }
  }, [loading, hasMore, page, fetchVideos]);

  const refetch = useCallback(() => {
    pageRef.current = 0;
    setPage(0);
    fetchVideos(0);
  }, [fetchVideos]);

  useEffect(() => {
    fetchVideos(0);
  }, [fetchVideos]);

  // Re-sync user-specific liked/saved state when auth session settles after page load
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void refreshLoadedVideos();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshLoadedVideos]);

  // Real-time subscriptions
  useEffect(() => {
    const handleChange = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      const changedVideoId =
        (typeof payload.new?.video_id === 'string' && payload.new.video_id) ||
        (typeof payload.old?.video_id === 'string' && payload.old.video_id) ||
        null;

      if (changedVideoId) {
        void refreshVideoById(changedVideoId);
      } else {
        void refreshLoadedVideos();
      }
    };

    const likesChannel = supabase
      .channel('video-likes-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_likes'
      }, handleChange)
      .subscribe();

    const commentsChannel = supabase
      .channel('video-comments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_comments'
      }, handleChange)
      .subscribe();

    const savesChannel = supabase
      .channel('video-saves-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'video_saves'
      }, handleChange)
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(savesChannel);
    };
  }, [refreshVideoById, refreshLoadedVideos]);

  return { videos, loading, error, hasMore, loadMore, refetch, updateVideo };
};
