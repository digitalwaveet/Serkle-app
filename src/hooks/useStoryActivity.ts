import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';

export interface ActivityProfile { name: string; initials: string; avatar_color: string; avatar_url: string | null }
export interface StoryActivityViewer {
  id: string; viewer_id: string; viewed_at: string; profile?: ActivityProfile; hasLiked?: boolean;
}
export interface StoryActivityMessage {
  id: string; sender_id: string; receiver_id: string; content: string; created_at: string;
  profile?: ActivityProfile; receiverProfile?: ActivityProfile;
}
export interface StoryActivitySnapshot {
  viewsCount: number; likesCount: number; repliesCount: number;
  viewers: StoryActivityViewer[]; messages: StoryActivityMessage[];
}
const empty: StoryActivitySnapshot = { viewsCount: 0, likesCount: 0, repliesCount: 0, viewers: [], messages: [] };

export const useStoryActivity = (storyId: string | null) => {
  const { user } = useUser();
  const client = useQueryClient();
  const [limit, setLimit] = useState(50);
  const enabled = !!storyId && !!user?.id;
  useEffect(() => setLimit(50), [storyId, user?.id]);
  const query = useQuery({
    queryKey: ['story-activity', user?.id, storyId, limit],
    enabled, staleTime: 15000, retry: 1,
    queryFn: async ({ signal }): Promise<StoryActivitySnapshot> => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal.addEventListener('abort', abort, { once: true });
      const timeout = setTimeout(abort, 20000);
      try {
        const { data: owner, error: ownerError } = await supabase.from('stories').select('user_id').eq('id', storyId!).abortSignal(controller.signal).single();
        if (ownerError) throw ownerError;
        if (owner.user_id !== user!.id) throw new Error('Only the story owner can view these insights.');
        const [views, likesCount, messages, replyCount] = await Promise.all([
          supabase.from('story_views').select('id, viewer_id, viewed_at, profiles:viewer_id (name, initials, avatar_color, avatar_url)', { count: 'exact' })
            .eq('story_id', storyId!).order('viewed_at', { ascending: false }).order('id').range(0, limit - 1).abortSignal(controller.signal),
          supabase.from('story_likes').select('id', { count: 'exact', head: true }).eq('story_id', storyId!).abortSignal(controller.signal),
          supabase.from('story_messages').select('id, sender_id, receiver_id, content, created_at, profiles:profiles!story_messages_sender_id_fkey (name, initials, avatar_color, avatar_url), receiver:profiles!story_messages_receiver_id_fkey (name, initials, avatar_color, avatar_url)')
            .eq('story_id', storyId!).or(`receiver_id.eq.${user!.id},sender_id.eq.${user!.id}`)
            .order('created_at', { ascending: false }).order('id').range(0, limit - 1).abortSignal(controller.signal),
          supabase.from('story_messages').select('id', { count: 'exact', head: true }).eq('story_id', storyId!).eq('receiver_id', user!.id).neq('sender_id', user!.id).abortSignal(controller.signal),
        ]);
        for (const result of [views, likesCount, messages, replyCount]) if (result.error) throw result.error;
        const viewerIds = (views.data || []).map(view => view.viewer_id);
        const liked = viewerIds.length ? await supabase.from('story_likes').select('user_id').eq('story_id', storyId!).in('user_id', viewerIds).abortSignal(controller.signal) : { data: [], error: null };
        if (liked.error) throw liked.error;
        const likedIds = new Set((liked.data || []).map(like => like.user_id));
        return {
          viewsCount: views.count ?? 0, likesCount: likesCount.count ?? 0, repliesCount: replyCount.count ?? 0,
          viewers: (views.data || []).map(view => ({ id: view.id, viewer_id: view.viewer_id, viewed_at: view.viewed_at, profile: view.profiles as ActivityProfile, hasLiked: likedIds.has(view.viewer_id) })),
          messages: (messages.data || []).map(message => ({ ...message, profile: message.profiles as ActivityProfile, receiverProfile: message.receiver as ActivityProfile })),
        };
      } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
    },
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void client.invalidateQueries({ queryKey: ['story-activity', user?.id, storyId] }); }, 400);
    };
    const channel = supabase.channel(`story-insights-${user?.id}-${storyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_views', filter: `story_id=eq.${storyId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_likes', filter: `story_id=eq.${storyId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_messages', filter: `story_id=eq.${storyId}` }, refresh).subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [client, enabled, storyId, user?.id]);

  const sendReply = async (receiverId: string, content: string) => {
    if (!storyId || !user?.id || !content.trim() || content.length > 2000 || receiverId === user.id) throw new Error('Please enter a valid reply.');
    const { error } = await supabase.from('story_messages').insert({ story_id: storyId, sender_id: user.id, receiver_id: receiverId, content: content.trim() });
    if (error) throw error;
    await client.invalidateQueries({ queryKey: ['story-activity', user.id, storyId] });
  };
  return { ...(query.data || empty), isLoading: enabled && query.isPending, isRefreshing: query.isFetching,
    error: query.isError ? 'Insights could not be loaded. Check your connection and try again.' : '',
    refetch: query.refetch, sendReply, loadMore: () => setLimit(value => value + 50),
    hasMoreMessages: (query.data?.messages.length || 0) >= limit,
    hasMoreViewers: (query.data?.viewsCount || 0) > (query.data?.viewers.length || 0),
  };
};
