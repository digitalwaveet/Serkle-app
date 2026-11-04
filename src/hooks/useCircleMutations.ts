import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { refreshCircleMembership, requestCircleJoin } from '@/lib/circleMembershipClient';
import type { CircleMembershipSnapshot } from '@/lib/circleMembershipState';
import { applyCircleLeaveResult, requestCircleLeave, type CircleLeaveResult } from '@/lib/circleLeave';
import { useQueryClient } from '@tanstack/react-query';

interface CreateCircleData {
  name: string;
  description: string;
  category: string;
  location?: string;
  is_private: boolean;
  is_premium?: boolean;
  is_expert?: boolean;
  avatar?: File;
  cover?: File;
  about_text?: string | null;
  guidelines?: string[];
  circle_type?: string;
  enabled_features?: string[];
  target_audience?: string | null;
  member_benefits?: string | null;
  primary_language?: string | null;
  is_online?: boolean;
  posting_policy?: string;
  subscription_enabled?: boolean;
  subscription_price?: number;
}

export const useCircleMutations = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const joining = useRef<Promise<CircleMembershipSnapshot> | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const leaving = useRef<Promise<CircleLeaveResult> | null>(null);
  const queryClient = useQueryClient();

  const createCircle = async (data: CreateCircleData, userId: string) => {
    setIsCreating(true);
    try {
      let avatarUrl = null;
      let coverUrl = null;

      // Upload avatar if provided
      if (data.avatar) {
        const avatarExt = data.avatar.name.split('.').pop();
        const avatarPath = `${userId}/${Date.now()}.${avatarExt}`;
        const { error: avatarError, data: avatarData } = await supabase.storage
          .from('circle-avatars')
          .upload(avatarPath, data.avatar);

        if (avatarError) throw avatarError;
        avatarUrl = supabase.storage.from('circle-avatars').getPublicUrl(avatarPath).data.publicUrl;
      }

      // Upload cover if provided
      if (data.cover) {
        const coverExt = data.cover.name.split('.').pop();
        const coverPath = `${userId}/${Date.now()}.${coverExt}`;
        const { error: coverError } = await supabase.storage
          .from('circle-covers')
          .upload(coverPath, data.cover);

        if (coverError) throw coverError;
        coverUrl = supabase.storage.from('circle-covers').getPublicUrl(coverPath).data.publicUrl;
      }

      // Create circle
      const { data: circle, error: circleError } = await supabase
        .from('circles')
        .insert({
          name: data.name,
          description: data.description,
          category: data.category,
          location: data.location,
          is_private: data.is_private,
          is_premium: data.is_premium || false,
          is_expert: data.is_expert || false,
          avatar_url: avatarUrl,
          cover_image_url: coverUrl,
          creator_id: userId,
          circle_type: data.circle_type || 'community',
          enabled_features: data.enabled_features,
          target_audience: data.target_audience,
          member_benefits: data.member_benefits,
          primary_language: data.primary_language,
          is_online: data.is_online ?? true,
          posting_policy: data.posting_policy || 'creator',
          subscription_enabled: data.subscription_enabled ?? false,
          subscription_price: data.subscription_price ?? 10,
        })
        .select()
        .single();

      if (circleError) throw circleError;

      // The database creates the owner membership in the same transaction.
      await refreshCircleMembership(queryClient);
      toast.success('Circle created successfully!');
      return circle;
    } catch (error: any) {
      console.error('Error creating circle:', error);
      toast.error(error.message || 'Failed to create circle');
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const performJoin = async (circleId: string, userId: string) => {
    setIsJoining(true);
    try {
      const result = await requestCircleJoin(supabase, circleId, userId);
      await refreshCircleMembership(queryClient);
      if (result.state === 'pending') toast.success('Your request is pending approval');
      else if (result.state === 'joined') toast.success('Joined circle successfully!');
      else if (result.state === 'subscription_required') toast.info('Subscribe before joining this Circle');
      return result;
    } catch (error: any) {
      // Reconcile an uncertain response with the backend; retain the request ID
      // so a retry after a lost response cannot start another request.
      await refreshCircleMembership(queryClient);
      toast.error(error.message || 'Could not confirm your request. Check your connection and retry.');
      throw error;
    } finally {
      setIsJoining(false);
    }
  };

  const joinCircle = (circleId: string, userId: string) => {
    if (joining.current) return joining.current;
    const request = performJoin(circleId, userId);
    joining.current = request;
    void request.finally(() => { if (joining.current === request) joining.current = null; }).catch(() => {});
    return request;
  };

  const performLeave = async (circleId: string, userId: string) => {
    setIsLeaving(true);
    try {
      const result = await requestCircleLeave(supabase, circleId, userId);
      await applyCircleLeaveResult(queryClient, result);
      void refreshCircleMembership(queryClient).catch(() => {});
      toast.success(result.has_subscription ? 'Left Circle. Your subscription and renewal settings are unchanged.' : 'Left Circle.');
      return result;
    } catch (error: any) {
      void refreshCircleMembership(queryClient).catch(() => {});
      // The confirmation stays open and displays this error. Do not navigate
      // or paint an optimistic success after an uncertain API response.
      throw new Error(error.message || 'Could not confirm leaving. Check your connection and retry.');
    } finally {
      setIsLeaving(false);
    }
  };

  const leaveCircle = (circleId: string, userId: string) => {
    if (leaving.current) return leaving.current;
    const request = performLeave(circleId, userId);
    leaving.current = request;
    void request.finally(() => { if (leaving.current === request) leaving.current = null; }).catch(() => {});
    return request;
  };

  const deleteCircle = async (circleId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from('circles')
        .delete()
        .eq('id', circleId)
        .eq('creator_id', userId);

      if (error) throw error;

      await refreshCircleMembership(queryClient);

      toast.success('Circle deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting circle:', error);
      toast.error(error.message || 'Failed to delete circle');
      throw error;
    }
  };

  const updateCircle = async (circleId: string, userId: string, updates: Partial<CreateCircleData>) => {
    try {
      let avatarUrl = undefined;
      let coverUrl = undefined;

      // Upload new avatar if provided
      if (updates.avatar) {
        const avatarExt = updates.avatar.name.split('.').pop();
        const avatarPath = `${userId}/${Date.now()}.${avatarExt}`;
        const { error: avatarError } = await supabase.storage
          .from('circle-avatars')
          .upload(avatarPath, updates.avatar);

        if (avatarError) throw avatarError;
        avatarUrl = supabase.storage.from('circle-avatars').getPublicUrl(avatarPath).data.publicUrl;
      }

      // Upload new cover if provided
      if (updates.cover) {
        const coverExt = updates.cover.name.split('.').pop();
        const coverPath = `${userId}/${Date.now()}.${coverExt}`;
        const { error: coverError } = await supabase.storage
          .from('circle-covers')
          .upload(coverPath, updates.cover);

        if (coverError) throw coverError;
        coverUrl = supabase.storage.from('circle-covers').getPublicUrl(coverPath).data.publicUrl;
      }

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description) updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.is_private !== undefined) updateData.is_private = updates.is_private;
      if (updates.about_text !== undefined) updateData.about_text = updates.about_text;
      if (updates.guidelines !== undefined) updateData.guidelines = updates.guidelines;
      if (updates.circle_type !== undefined) updateData.circle_type = updates.circle_type;
      if (updates.enabled_features !== undefined) updateData.enabled_features = updates.enabled_features;
      if (updates.target_audience !== undefined) updateData.target_audience = updates.target_audience;
      if (updates.member_benefits !== undefined) updateData.member_benefits = updates.member_benefits;
      if (updates.primary_language !== undefined) updateData.primary_language = updates.primary_language;
      if (updates.is_online !== undefined) updateData.is_online = updates.is_online;
      if (updates.posting_policy !== undefined) updateData.posting_policy = updates.posting_policy;
      if (avatarUrl) updateData.avatar_url = avatarUrl;
      if (coverUrl) updateData.cover_image_url = coverUrl;

      const { error } = await supabase
        .from('circles')
        .update(updateData)
        .eq('id', circleId)
        .eq('creator_id', userId);

      if (error) throw error;

      await refreshCircleMembership(queryClient);

      toast.success('Circle updated successfully!');
    } catch (error: any) {
      console.error('Error updating circle:', error);
      toast.error(error.message || 'Failed to update circle');
      throw error;
    }
  };

  return {
    createCircle,
    joinCircle,
    leaveCircle,
    deleteCircle,
    updateCircle,
    isCreating,
    isJoining,
    isLeaving,
  };
};
