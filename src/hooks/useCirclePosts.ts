import { useUser } from '@/contexts/UserContext';
import { signProtectedMedia } from '@/lib/protectedMedia';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CirclePost {
  id: string;
  content: string;
  cover_image_url: string | null;
  is_premium: boolean;
  premium_price: number | null;
  has_tips_enabled: boolean;
  created_at: string;
  user_id: string;
  circle_id: string;
  author: {
    name: string;
    username: string;
    avatar_url: string | null;
    initials: string;
    avatar_color: string;
  };
  stats: {
    likes_count: number;
    comments_count: number;
    shares_count: number;
  };
  user_has_liked: boolean;
  user_reaction: string | null;
  user_has_unlocked: boolean;
  tip_count: number;
  user_has_tipped: boolean;
  post_type: 'photo' | 'video' | 'pdf' | 'text';
  original_pdf_url: string | null;
  pinned_at: string | null;
}

export const useCirclePosts = (circleId: string | undefined) => {
  const { user: currentUser } = useUser();
  return useQuery({
    queryKey: ['circle-posts', circleId, currentUser?.id],
    refetchInterval: 30000,
    staleTime: 0,
    queryFn: async () => {
      if (!circleId) return [];

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc('get_circle_posts_definitive', {
        _circle_id: circleId,
        page_num: 0,
        page_size: 50 // Fetch enough for initial view
      });

      if (error) throw error;

      // The feed RPC doesn't expose pinned_at, so merge pin state separately
      const { data: pinnedRows } = await supabase
        .from('posts')
        .select('id, pinned_at')
        .eq('circle_id', circleId)
        .not('pinned_at', 'is', null);
      const pinnedMap = new Map((pinnedRows || []).map((row) => [row.id, row.pinned_at]));

      const signedData = await signProtectedMedia(data || []);
      const posts = signedData.map((post: any) => ({
        id: post.post_id,
        content: post.content,
        cover_image_url: post.cover_image_url,
        is_premium: post.is_premium || false,
        premium_price: post.premium_price ?? null,
        has_tips_enabled: post.has_tips_enabled ?? true,
        created_at: post.created_at,
        user_id: post.user_id,
        circle_id: post.circle_id!,
        author: {
          name: post.name || 'Unknown',
          username: post.username || 'unknown',
          avatar_url: post.avatar_url || null,
          initials: post.initials || '??',
          avatar_color: post.avatar_color || '#4B164C',
        },
        stats: {
          likes_count: post.likes_count || 0,
          comments_count: post.comments_count || 0,
          shares_count: post.shares_count || 0,
        },
        user_has_liked: post.user_has_liked || false,
        user_reaction: post.user_reaction || null,
        user_has_unlocked: post.user_has_unlocked || false,
        tip_count: post.tip_count || 0,
        user_has_tipped: post.user_has_tipped || false,
        post_type: post.post_type || 'photo',
        original_pdf_url: post.original_pdf_url || null,
        pinned_at: pinnedMap.get(post.post_id) ?? null,
        media: {
          urls: post.media_urls || []
        }
      })) as CirclePost[];

      // Pinned posts float to the top (newest pin first); the rest keep feed order
      return posts.sort((a, b) => {
        if (!!a.pinned_at !== !!b.pinned_at) return a.pinned_at ? -1 : 1;
        if (a.pinned_at && b.pinned_at) {
          return new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime();
        }
        return 0;
      });
    },
    enabled: !!circleId,
  });
};
