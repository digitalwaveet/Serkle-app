import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ShippingAddress {
  id: string;
  user_id: string;
  full_name: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  is_default: boolean;
  created_at: string;
}

export const useShippingAddresses = () => {
  return useQuery({
    queryKey: ['shipping-addresses'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('shipping_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ShippingAddress[];
    },
  });
};

export const useAddressMutations = () => {
  const queryClient = useQueryClient();

  const createAddress = useMutation({
    mutationFn: async (addressData: Omit<ShippingAddress, 'id' | 'user_id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // If this is set as default, unset other defaults
      if (addressData.is_default) {
        await supabase
          .from('shipping_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id);
      }

      const { error } = await supabase
        .from('shipping_addresses')
        .insert({
          ...addressData,
          user_id: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] });
      toast({
        title: "Address added",
        description: "Shipping address has been saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding address",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAddress = useMutation({
    mutationFn: async ({ id, ...addressData }: Partial<ShippingAddress> & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // If this is set as default, unset other defaults
      if (addressData.is_default) {
        await supabase
          .from('shipping_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .neq('id', id);
      }

      const { error } = await supabase
        .from('shipping_addresses')
        .update(addressData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] });
      toast({
        title: "Address updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating address",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAddress = useMutation({
    mutationFn: async (addressId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('shipping_addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] });
      toast({
        title: "Address deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting address",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setDefaultAddress = useMutation({
    mutationFn: async (addressId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Unset all defaults
      await supabase
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      const { error } = await supabase
        .from('shipping_addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-addresses'] });
      toast({
        title: "Default address updated",
      });
    },
  });

  return { createAddress, updateAddress, deleteAddress, setDefaultAddress };
};
