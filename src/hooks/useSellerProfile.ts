import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateSellerProfileData {
  businessName?: string;
  description?: string;
  phone?: string;
  email: string;
  location: string;
  sellerType?: 'personal' | 'shop';
  registrationNumber?: string;
  taxId?: string;
  businessLicenseUrl?: string;
}

export const useSellerProfile = (userId?: string) => {
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ['seller-profile', userId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) return null;

      const { data: profileRow, error: profileError } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileRow) return null;

      const { data: statsRow } = await supabase
        .from('seller_stats')
        .select('*')
        .eq('seller_id', targetUserId)
        .maybeSingle();

      // Fetch all items (including sold ones) for profile view
      const { data: items } = await supabase
        .from('shop_items')
        .select('*')
        .eq('seller_id', targetUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      return { 
        ...profileRow, 
        stats: statsRow || null,
        items: items || []
      } as any;
    },
    enabled: true,
  });

  const createOrUpdateProfile = useMutation({
    mutationFn: async (data: CreateSellerProfileData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('seller_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const updateData: any = {
        business_name: data.businessName,
        description: data.description,
        phone: data.phone,
        email: data.email,
        location: data.location,
        seller_type: data.sellerType || 'personal'
      };

      // Add shop-specific fields if sellerType is 'shop'
      if (data.sellerType === 'shop') {
        updateData.business_registration_number = data.registrationNumber;
        updateData.tax_id = data.taxId;
        updateData.business_license_url = data.businessLicenseUrl;
        updateData.verification_status = 'pending';
        updateData.verification_submitted_at = new Date().toISOString();
      }

      if (existing) {
        // Update
        const { data: updated, error } = await supabase
          .from('seller_profiles')
          .update(updateData)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      } else {
        // Create
        const { data: created, error } = await supabase
          .from('seller_profiles')
          .insert({ ...updateData, user_id: user.id })
          .select()
          .single();

        if (error) throw error;
        return created;
      }
    },
    onSuccess: () => {
      // Invalidate both without userId and with userId
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
      toast.success('Seller profile updated!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    }
  });

  return {
    profile: profile.data,
    isLoading: profile.isLoading,
    createOrUpdateProfile
  };
};
