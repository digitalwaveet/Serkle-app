import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EmergencyContact {
  id: string;
  user_id: string;
  contact_name: string;
  contact_phone: string;
  relationship?: string;
  is_primary: boolean;
  created_at: string;
}

export interface CreateContactData {
  contact_name: string;
  contact_phone: string;
  relationship?: string;
  is_primary?: boolean;
}

export const useEmergencyContacts = () => {
  const queryClient = useQueryClient();

  // Fetch user's emergency contacts
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Create emergency contact
  const createContact = useMutation({
    mutationFn: async (contactData: CreateContactData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({
          ...contactData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts'] });
      toast.success('Emergency contact added');
    },
    onError: (error: Error) => {
      console.error('Failed to add contact:', error);
      toast.error('Failed to add emergency contact');
    },
  });

  // Update emergency contact
  const updateContact = useMutation({
    mutationFn: async ({ id, ...contactData }: Partial<EmergencyContact> & { id: string }) => {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .update(contactData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts'] });
      toast.success('Contact updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update contact:', error);
      toast.error('Failed to update contact');
    },
  });

  // Delete emergency contact
  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-contacts'] });
      toast.success('Contact removed');
    },
    onError: (error: Error) => {
      console.error('Failed to delete contact:', error);
      toast.error('Failed to remove contact');
    },
  });

  return {
    contacts,
    isLoading,
    createContact,
    updateContact,
    deleteContact,
  };
};
