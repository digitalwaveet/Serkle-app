import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StartLiveData {
  type: 'random' | 'circle';
  circleId?: string;
  title: string;
  description?: string;
  visibility: 'public' | 'friends' | 'circle';
  locationVisible: boolean;
}

export const useLiveMutations = () => {
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);

  const startLive = async (data: StartLiveData) => {
    setIsStarting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: stream, error } = await (supabase as any)
        .from('live_streams')
        .insert({
          user_id: user.id,
          circle_id: data.circleId,
          type: data.type,
          title: data.title,
          description: data.description,
          visibility: data.visibility,
          location_visible: data.locationVisible,
          status: 'live'
        })
        .select()
        .single();

      if (error) throw error;

      // Join as viewer automatically
      await (supabase as any)
        .from('live_viewers')
        .insert({
          stream_id: stream.id,
          user_id: user.id,
          is_active: true
        });

      // Create a live story automatically
      await (supabase as any)
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: 'https://placeholder.svg', // Placeholder for live
          media_type: 'image',
          live_stream_id: stream.id
        });

      // Send notification via edge function (non-blocking)
      supabase.functions.invoke('notify-live-start', {
        body: {
          streamId: stream.id,
          title: data.title,
          type: data.type,
          circleId: data.circleId
        }
      }).catch(err => {
        console.error('Failed to send notifications:', err);
        // Don't throw - notifications are not critical for going live
      });

      toast.success('You are now live!');
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      
      return stream;
    } catch (error: any) {
      toast.error(error.message || 'Failed to start live stream');
      throw error;
    } finally {
      setIsStarting(false);
    }
  };

  const endLive = async (streamId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('live_streams')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', streamId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Delete the live story silently
      await (supabase as any)
        .from('stories')
        .delete()
        .eq('live_stream_id', streamId)
        .eq('user_id', user.id);

      toast.success('Live stream ended');
      queryClient.invalidateQueries({ queryKey: ['live-streams'] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to end live stream');
      throw error;
    }
  };

  const joinStream = async (streamId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('live_viewers')
        .upsert({
          stream_id: streamId,
          user_id: user.id,
          is_active: true,
          last_ping: new Date().toISOString()
        }, {
          onConflict: 'stream_id,user_id'
        });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Failed to join stream');
      throw error;
    }
  };

  const leaveStream = async (streamId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await (supabase as any)
        .from('live_viewers')
        .delete()
        .eq('stream_id', streamId)
        .eq('user_id', user.id);
    } catch (error: any) {
      console.error('Failed to leave stream:', error);
    }
  };

  const sendMessage = async (streamId: string, message: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any)
        .from('live_messages')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          message_text: message,
          message_type: 'text'
        });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
      throw error;
    }
  };

  return {
    startLive,
    endLive,
    joinStream,
    leaveStream,
    sendMessage,
    isStarting
  };
};
