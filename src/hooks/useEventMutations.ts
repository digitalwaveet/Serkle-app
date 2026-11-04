import { purchaseCircleBooking } from '@/lib/circlePayments';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export interface CreateEventData {
  circle_id: string;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  duration_minutes: number;
  event_type: string;
  platform?: string;
  meeting_url?: string;
  max_attendees?: number;
  price?: number;
  timezone?: string;
}

export const useEventMutations = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUploadingRecording, setIsUploadingRecording] = useState(false);
  const queryClient = useQueryClient();

  const createEvent = async (data: CreateEventData, userId: string) => {
    setIsCreating(true);
    try {
      const { data: eventData, error } = await supabase
        .from('circle_events')
        .insert({
          ...data,
          creator_id: userId,
          status: 'upcoming',
        })
        .select()
        .single();

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['circle-events', data.circle_id] });
      
      toast({
        title: 'Success',
        description: 'Event created successfully',
      });

      return eventData;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create event',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  const registerForEvent = async (eventId: string, userId: string, expectedPrice: number) => {
    setIsRegistering(true);
    try {
      await purchaseCircleBooking('event', eventId, expectedPrice);
      await queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      await queryClient.invalidateQueries({ queryKey: ['circle-events'] });
      await queryClient.invalidateQueries({ queryKey: ['coin-wallet'] });
      
      toast({
        title: 'Success',
        description: 'Successfully registered for event',
      });
    } catch (error: any) {
      if (error.code === '23505') {
        toast({
          title: 'Already Registered',
          description: 'You are already registered for this event',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to register for event',
          variant: 'destructive',
        });
      }
      throw error;
    } finally {
      setIsRegistering(false);
    }
  };

  const cancelRegistration = async (eventId: string, userId: string) => {
    try {
      const { error } = await supabase.rpc('cancel_circle_event_registration' as any, { _event_id: eventId });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['event-attendees', eventId] });
      await queryClient.invalidateQueries({ queryKey: ['circle-events'] });
      
      toast({
        title: 'Success',
        description: 'Registration cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel registration',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const uploadRecording = async (eventId: string, file: File) => {
    setIsUploadingRecording(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}-${Date.now()}.${fileExt}`;
      const filePath = `event-recordings/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('circle-resources')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('circle-resources')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('circle_events')
        .update({ 
          recording_url: publicUrl,
          status: 'past'
        })
        .eq('id', eventId);

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({ queryKey: ['circle-events'] });
      
      toast({
        title: 'Success',
        description: 'Recording uploaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload recording',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setIsUploadingRecording(false);
    }
  };

  const updateEventStatus = async (eventId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('circle_events')
        .update({ status })
        .eq('id', eventId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['circle-events'] });
      
      toast({
        title: 'Success',
        description: 'Event status updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update event status',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    createEvent,
    registerForEvent,
    cancelRegistration,
    uploadRecording,
    updateEventStatus,
    isCreating,
    isRegistering,
    isUploadingRecording,
  };
};
