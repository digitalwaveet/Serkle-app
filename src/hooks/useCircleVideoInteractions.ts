import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface CircleVideoComment {
  id: string;
  video_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    name: string;
    username: string;
    avatar_url: string | null;
    avatar_color: string;
    initials: string;
  };
}

export const useCircleVideoInteractions = (videoId: string) => {
  const queryClient = useQueryClient();

  // 1. Fetch Likes
  const { data: likesCount = 0, refetch: refetchLikes } = useQuery({
    queryKey: ['circle-video-likes', videoId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('circle_video_likes')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', videoId);
      
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: userHasLiked = false, refetch: refetchUserLike } = useQuery({
    queryKey: ['circle-video-user-like', videoId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('circle_video_likes')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    }
  });

  // 2. Fetch Comments
  const { data: comments = [], refetch: refetchComments } = useQuery<CircleVideoComment[]>({
    queryKey: ['circle-video-comments', videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_video_comments')
        .select(`
          *,
          profiles:user_id (
            name,
            username,
            avatar_url,
            avatar_color,
            initials
          )
        `)
        .eq('video_id', videoId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as any;
    }
  });

  // 3. Fetch Shares (from circle_videos table)
  const { data: sharesCount = 0, refetch: refetchShares } = useQuery({
    queryKey: ['circle-video-shares', videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_videos')
        .select('shares_count')
        .eq('id', videoId)
        .single();
      
      if (error) throw error;
      return data?.shares_count || 0;
    }
  });

  // Mutations
  const toggleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please login to like');
      return;
    }

    if (userHasLiked) {
      await supabase
        .from('circle_video_likes')
        .delete()
        .eq('video_id', videoId)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('circle_video_likes')
        .insert({ video_id: videoId, user_id: user.id });
    }
    // Optimistic or simple refetch
    refetchLikes();
    refetchUserLike();
  };

  const addComment = async (content: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please login to comment');
      return;
    }

    const { error } = await supabase
      .from('circle_video_comments')
      .insert({
        video_id: videoId,
        user_id: user.id,
        content
      });

    if (error) {
      toast.error('Failed to add comment');
      throw error;
    }
    refetchComments();
  };

  const incrementShare = async () => {
    const { error } = await supabase.rpc('increment_video_shares', { video_id: videoId });
    if (error) {
       // Fallback if RPC fails/not deployed yet
       const { data } = await supabase.from('circle_videos').select('shares_count').eq('id', videoId).single();
       await supabase.from('circle_videos').update({ shares_count: (data?.shares_count || 0) + 1 }).eq('id', videoId);
    }
    refetchShares();
  };

  // Real-time Subscription
  useEffect(() => {
    const likesChannel = supabase
      .channel(`circle-video-likes-${videoId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'circle_video_likes',
        filter: `video_id=eq.${videoId}`
      }, () => {
        refetchLikes();
        refetchUserLike();
      })
      .subscribe();

    const commentsChannel = supabase
      .channel(`circle-video-comments-${videoId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'circle_video_comments',
        filter: `video_id=eq.${videoId}`
      }, () => {
        refetchComments();
      })
      .subscribe();

    const statsChannel = supabase
      .channel(`circle-video-stats-${videoId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'circle_videos',
        filter: `id=eq.${videoId}`
      }, (payload) => {
        if (payload.new && 'shares_count' in payload.new) {
          refetchShares();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(statsChannel);
    };
  }, [videoId, refetchLikes, refetchUserLike, refetchComments, refetchShares]);

  return {
    likesCount,
    userHasLiked,
    comments,
    sharesCount,
    toggleLike,
    addComment,
    incrementShare
  };
};
