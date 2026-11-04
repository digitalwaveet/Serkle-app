import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useFollowMutations = () => {
  const [isFollowing, setIsFollowing] = useState(false);

  const checkFollowStatus = useCallback(async (targetUserId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error: any) {
      console.error('Error checking follow status:', error);
      return false;
    }
  }, []);

  const toggleFollow = useCallback(async (targetUserId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please login to follow users');
        return false;
      }

      // Prevent following yourself
      if (user.id === targetUserId) {
        return false;
      }

      setIsFollowing(true);

      // Check current follow status
      const isCurrentlyFollowing = await checkFollowStatus(targetUserId);

      if (isCurrentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (error) throw error;
        toast.success('Unfollowed');
        return false;
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });

        if (error) throw error;
        toast.success('Following');
        return true;
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
      return false;
    } finally {
      setIsFollowing(false);
    }
  }, [checkFollowStatus]);

  return {
    checkFollowStatus,
    toggleFollow,
    isFollowing
  };
};
