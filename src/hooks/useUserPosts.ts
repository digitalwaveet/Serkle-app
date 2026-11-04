import { signProtectedMedia } from '@/lib/protectedMedia';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PostData {
  id: string;
  content: string;
  media_url: string | null;
  cover_image_url?: string | null;
  media_urls?: string[] | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  post_type?: 'photo' | 'video' | 'pdf' | 'text';
  original_pdf_url?: string | null;
  media?: {
    urls: string[];
  };
  profiles?: {
    name: string;
    username: string;
    initials: string;
    avatar_url: string | null;
    avatar_color: string;
    is_verified: boolean;
  };
};

export const useUserPosts = (userId: string | undefined) => {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPosts = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from('posts') as any)
        .select(`
          id,
          content,
          media_url,
          cover_image_url,
          media_urls,
          post_type,
          original_pdf_url,
          created_at,
          profiles:user_id (
            name,
            username,
            initials,
            avatar_url,
            avatar_color,
            is_verified
          ),
          post_stat:post_stats!inner (
            likes_count,
            comments_count,
            shares_count,
            saves_count
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which posts the current user has liked
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      let likesData: any[] = [];
      if (currentUserId) {
        const { data: likes } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', currentUserId)
          .in('post_id', data.map(p => p.id));
        
        likesData = likes || [];
      }

      const likedPostIds = new Set(likesData.map(l => l.post_id));

      const formattedPosts = data.map(post => ({
        id: post.id,
        content: post.content,
        media_url: post.media_url,
        cover_image_url: post.cover_image_url,
        post_type: post.post_type,
        original_pdf_url: post.original_pdf_url,
        media: {
          urls: post.media_urls || []
        },
        profiles: post.profiles,
        created_at: post.created_at,
        likes_count: (Array.isArray(post.post_stats) ? post.post_stats[0]?.likes_count : (post.post_stats as any)?.likes_count) || 0,
        comments_count: (Array.isArray(post.post_stats) ? post.post_stats[0]?.comments_count : (post.post_stats as any)?.comments_count) || 0,
        shares_count: (Array.isArray(post.post_stats) ? post.post_stats[0]?.shares_count : (post.post_stats as any)?.shares_count) || 0,
        saves_count: (Array.isArray(post.post_stats) ? post.post_stats[0]?.saves_count : (post.post_stats as any)?.saves_count) || 0,
        user_has_liked: likedPostIds.has(post.id),
      }));

      setPosts(await signProtectedMedia(formattedPosts));
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    // Set up realtime subscriptions for likes and comments
    const likesChannel = supabase
      .channel('user-posts-likes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes'
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    const commentsChannel = supabase
      .channel('user-posts-comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments'
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [userId]);

  return { posts, isLoading, refetch: fetchPosts };
};
