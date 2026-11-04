import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isActiveMute } from '@/lib/messageStatus';

// ─── Members & Admins ───
export const useGroupMembers = (conversationId: string, isOpen: boolean) => {
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['group-members', conversationId],
    queryFn: async () => {
      const { data: conv } = await supabase
        .from('conversations')
        .select('created_by')
        .eq('id', conversationId)
        .single();

      const { data: admins } = await supabase
        .from('group_admins')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .then(res => {
          // Gracefully handle 500 / RLS errors on group_admins
          if (res.error) { console.warn('group_admins query failed, falling back to empty', res.error.message); return { data: [] }; }
          return res;
        });

      const adminIds = new Set((admins || []).map((a: any) => a.user_id));

      const { data: memberRows, error: memberErr } = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (memberErr) throw memberErr;
      if (!memberRows || memberRows.length === 0) return [];

      const userIds = memberRows.map(m => m.user_id);

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, initials, avatar_color')
        .in('id', userIds);

      if (profErr) throw profErr;

      return (profiles || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        username: p.username,
        avatar_url: p.avatar_url,
        initials: p.initials,
        avatar_color: p.avatar_color,
        is_creator: p.id === conv?.created_by,
        is_admin: adminIds.has(p.id) || p.id === conv?.created_by,
      }));
    },
    enabled: isOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['group-members', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  const promoteToAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('group_admins').insert({ conversation_id: conversationId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Promoted to admin'); },
    onError: () => toast.error('Failed to promote'),
  });

  const demoteAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('group_admins').delete().eq('conversation_id', conversationId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Removed admin role'); },
    onError: () => toast.error('Failed to demote'),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_group_member', { _conversation_id: conversationId, _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Member removed'); },
    onError: () => toast.error('Failed to remove member'),
  });

  const leaveGroup = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_group_member', { _conversation_id: conversationId, _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('You left the group'); },
    onError: () => toast.error('Failed to leave group'),
  });

  return { members, isLoading, promoteToAdmin, demoteAdmin, removeMember, leaveGroup };
};

// ─── Group Info (description, avatar) ───
export const useGroupInfo = (conversationId: string, isOpen: boolean) => {
  const queryClient = useQueryClient();

  const { data: groupInfo } = useQuery({
    queryKey: ['group-info', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('group_name, group_avatar_url, description, created_by')
        .eq('id', conversationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
  });

  const updateDescription = useMutation({
    mutationFn: async (description: string) => {
      const { error } = await supabase.from('conversations').update({ description }).eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-info', conversationId] });
      toast.success('Description updated');
    },
  });

  const updateAvatar = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop();
      const path = `${conversationId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from('group-avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('group-avatars').getPublicUrl(path);
      const { error } = await supabase.from('conversations').update({ group_avatar_url: publicUrl }).eq('id', conversationId);
      if (error) throw error;
      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-info', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Group avatar updated');
    },
    onError: () => toast.error('Failed to upload avatar'),
  });

  const updateName = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('conversations').update({ group_name: name.trim() }).eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-info', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Group name updated');
    },
  });

  return { groupInfo, updateDescription, updateAvatar, updateName };
};

// ─── Mute ───
export const useGroupMute = (conversationId: string, userId: string) => {
  const queryClient = useQueryClient();

  const { data: muteStatus } = useQuery({
    queryKey: ['group-mute', conversationId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_mutes')
        .select('muted_until')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    refetchInterval: 60000,
  });

  const mute = useMutation({
    mutationFn: async (duration: '1h' | '24h' | 'forever') => {
      const muted_until = duration === 'forever' ? null :
        duration === '1h' ? new Date(Date.now() + 3600000).toISOString() :
        new Date(Date.now() + 86400000).toISOString();

      const { error } = await supabase.from('group_mutes').upsert(
        { conversation_id: conversationId, user_id: userId, muted_until },
        { onConflict: 'conversation_id,user_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-mute', conversationId, userId] });
      toast.success('Notifications muted');
    },
    onError: () => toast.error('Could not mute notifications. Please try again.'),
  });

  const unmute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('group_mutes').delete().eq('conversation_id', conversationId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-mute', conversationId, userId] });
      toast.success('Notifications unmuted');
    },
    onError: () => toast.error('Could not unmute notifications. Please try again.'),
  });

  return { isMuted: isActiveMute(muteStatus), muteStatus: muteStatus?.muted_until, mute, unmute };
};

// ─── Shared Media ───
export const useSharedMedia = (conversationId: string, isOpen: boolean) => {
  return useQuery({
    queryKey: ['group-shared-media', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, attachment_url, message_type, created_at, sender_id')
        .eq('conversation_id', conversationId)
        .not('attachment_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen,
  });
};

// ─── Polls ───
export const useGroupPolls = (conversationId: string, userId: string, isOpen: boolean) => {
  const queryClient = useQueryClient();

  const { data: polls = [], isLoading } = useQuery({
    queryKey: ['group-polls', conversationId],
    queryFn: async () => {
      const { data: pollsData, error } = await supabase
        .from('group_polls')
        .select('*, poll_votes(*)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return pollsData || [];
    },
    enabled: isOpen,
  });

  const createPoll = useMutation({
    mutationFn: async (poll: { question: string; options: string[]; is_anonymous?: boolean; is_multiple_choice?: boolean }) => {
      const optionsJson = poll.options.map((text, i) => ({ id: `opt_${i}`, text }));
      const { data: pollData, error } = await supabase.from('group_polls').insert({
        conversation_id: conversationId,
        creator_id: userId,
        question: poll.question,
        options: optionsJson,
        is_anonymous: poll.is_anonymous || false,
        is_multiple_choice: poll.is_multiple_choice || false,
      }).select('id').single();
      if (error) throw error;

      // Send poll as a message in the group chat
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: `📊 Poll: ${poll.question}`,
        message_type: 'poll',
        attachment_url: pollData.id, // store poll_id in attachment_url
      });
      if (msgError) throw msgError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-polls', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      toast.success('Poll created');
    },
    onError: () => toast.error('Failed to create poll'),
  });

  const endPoll = useMutation({
    mutationFn: async (pollId: string) => {
      const { error } = await supabase
        .from('group_polls')
        .update({ status: 'ended', ended_at: new Date().toISOString() } as any)
        .eq('id', pollId)
        .eq('creator_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-polls', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['poll-data'] });
      toast.success('Poll ended');
    },
    onError: () => toast.error('Failed to end poll'),
  });

  const vote = useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      const { error } = await supabase.from('poll_votes').insert({ poll_id: pollId, user_id: userId, option_id: optionId });
      if (error && error.code === '23505') {
        toast.info('Already voted');
        return;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-polls', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['poll-data'] });
    },
    onError: () => toast.error('Failed to vote'),
  });

  const unvote = useMutation({
    mutationFn: async ({ pollId, optionId }: { pollId: string; optionId: string }) => {
      const { error } = await supabase.from('poll_votes').delete().eq('poll_id', pollId).eq('user_id', userId).eq('option_id', optionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-polls', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['poll-data'] });
    },
  });

  return { polls, isLoading, createPoll, endPoll, vote, unvote };
};

// ─── Single Poll (for inline message rendering) ───
export const usePollData = (pollId: string | null) => {
  return useQuery({
    queryKey: ['poll-data', pollId],
    queryFn: async () => {
      if (!pollId) return null;
      const { data, error } = await supabase
        .from('group_polls')
        .select('*, poll_votes(*)')
        .eq('id', pollId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!pollId,
    refetchInterval: 10000, // refresh every 10s for live voting
  });
};

// ─── Voter Insights (who voted for what — creator only) ───
export const useVoterInsights = (pollId: string | null, enabled: boolean) => {
  return useQuery({
    queryKey: ['voter-insights', pollId],
    queryFn: async () => {
      if (!pollId) return [];
      const { data: votes, error } = await supabase
        .from('poll_votes')
        .select('option_id, user_id')
        .eq('poll_id', pollId);
      if (error) throw error;

      const userIds = [...new Set((votes || []).map(v => v.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url, initials')
        .in('id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return (votes || []).map(v => ({
        option_id: v.option_id,
        user_id: v.user_id,
        profile: profileMap.get(v.user_id) || null,
      }));
    },
    enabled: !!pollId && enabled,
  });
};
