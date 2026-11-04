import { signProtectedMedia } from '@/lib/protectedMedia';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSavedPosts = (userId: string | undefined) => {
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSavedPosts = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch saved post IDs
      const { data: saves, error: savesError } = await supabase
        .from('saves')
        .select('post_id')
        .eq('user_id', userId);

      if (savesError) throw savesError;

      if (!saves || saves.length === 0) {
        setSavedPosts([]);
        setIsLoading(false);
        return;
      }

      const postIds = saves.map(s => s.post_id);

      // Fetch the actual posts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            name,
            username,
            initials,
            avatar_url,
            avatar_color,
            is_verified
          )
        `)
        .in('id', postIds)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch stats for each post
      const postsWithStats = await Promise.all(
        (posts || []).map(async (post) => {
          const { data: stats } = await supabase
            .from('post_stats')
            .select('likes_count, comments_count, shares_count')
            .eq('post_id', post.id)
            .single();

          const { data: liked } = await supabase
            .from('likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', userId)
            .maybeSingle();

          return {
            ...post,
            likes_count: stats?.likes_count || 0,
            comments_count: stats?.comments_count || 0,
            shares_count: stats?.shares_count || 0,
            user_has_liked: !!liked,
            media: {
              urls: (post as any).media_urls || []
            }
          };
        })
      );

      setSavedPosts(await signProtectedMedia(postsWithStats));
    } catch (error) {
      console.error('Error fetching saved posts:', error);
      setSavedPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedPosts();

    // Set up realtime subscriptions for likes and comments
    const likesChannel = supabase
      .channel('saved-posts-likes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes'
        },
        () => {
          fetchSavedPosts();
        }
      )
      .subscribe();

    const commentsChannel = supabase
      .channel('saved-posts-comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments'
        },
        () => {
          fetchSavedPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [userId]);

  return { savedPosts, isLoading };
};
