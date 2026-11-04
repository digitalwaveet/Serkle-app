import { refreshCircleMembership } from '@/lib/circleMembershipClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateConversation } from './useConversations';
import { useSendMessage } from './useMessages';
import { toast } from 'sonner';

export interface CircleInvitation {
  id: string;
  circle_id: string;
  inviter_id: string;
  invitee_id: string;
  invitation_type: 'admin' | 'transfer_ownership';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
}

export const usePendingInvitations = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['circle-invitations', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('circle_invitations')
        .select('*')
        .eq('invitee_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CircleInvitation[];
    },
    enabled: !!userId,
  });
};

export const useSendCircleInvitation = () => {
  const queryClient = useQueryClient();
  const { createConversation } = useCreateConversation();
  const { sendMessage } = useSendMessage();

  const sendInvitation = async (
    circleId: string,
    circleName: string,
    inviterId: string,
    inviteeIds: string[],
    type: 'admin' | 'transfer_ownership'
  ) => {
    for (const inviteeId of inviteeIds) {
      // Create invitation record
      const { data: invitationId, error } = await supabase.rpc('send_circle_invitation' as any, {
        _circle_id: circleId, _invitee_id: inviteeId, _type: type,
      });

      if (error) {
        console.error('Error creating invitation:', error);
        toast.error('Failed to send invitation');
        continue;
      }

      // Send message to invitee
      try {
        const conversationId = await createConversation(inviterId, inviteeId);
        const typeLabel = type === 'admin' ? 'Admin' : 'Ownership Transfer';
        const messageContent = `🔔 Circle Invitation: ${typeLabel}\n\nYou've been invited to become ${type === 'admin' ? 'an admin' : 'the new owner'} of "${circleName}".\n\n👉 [Click here to respond](circle-invitation:${invitationId})`;

        sendMessage({
          conversationId,
          senderId: inviterId,
          content: messageContent,
          messageType: 'text',
        });
      } catch (err) {
        console.error('Error sending invitation message:', err);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['circle-invitations'] });
    const label = type === 'admin' ? 'Admin' : 'Ownership transfer';
    toast.success(`${label} invitation${inviteeIds.length > 1 ? 's' : ''} sent!`);
  };

  return { sendInvitation };
};

export const useRespondToInvitation = () => {
  const queryClient = useQueryClient();

  const respond = async (invitationId: string, accept: boolean) => {
    const { error } = await supabase.rpc('respond_circle_invitation' as any, {
      _invitation_id: invitationId, _accept: accept,
    });
    if (error) {
      toast.error(error.message || 'Failed to respond to invitation');
      return;
    }
    await refreshCircleMembership(queryClient);
    toast.success(accept ? 'Circle invitation accepted' : 'Invitation declined');
  };

  return { respond };
};

export const useFriendsList = (userId: string | undefined, searchQuery: string) => {
  return useQuery({
    queryKey: ['friends-list', userId, searchQuery],
    queryFn: async () => {
      if (!userId) return [];

      // Get people the user follows (friends)
      const { data: following, error: followError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followError) throw followError;
      if (!following || following.length === 0) return [];

      const friendIds = following.map(f => f.following_id);

      let query = supabase
        .from('profiles')
        .select('id, name, username, avatar_url, initials, avatar_color')
        .in('id', friendIds);

      if (searchQuery.trim()) {
        query = query.or(`username.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};
