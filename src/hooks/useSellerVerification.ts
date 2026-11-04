import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SubmitVerificationData {
  sellerType: "personal" | "business";
  businessName?: string;
  businessRegistrationNumber?: string;
  taxId?: string;
  description: string;
  licenseFile?: File | null;
}

export const useSellerVerification = () => {
  const queryClient = useQueryClient();

  const submitVerification = useMutation({
    mutationFn: async (data: SubmitVerificationData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let licenseUrl = null;
      
      // Upload license file if provided
      if (data.licenseFile) {
        const fileExt = data.licenseFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('shop-items')
          .upload(`licenses/${fileName}`, data.licenseFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('shop-items')
          .getPublicUrl(`licenses/${fileName}`);
        
        licenseUrl = publicUrl;
      }

      // Update seller profile
      const { error } = await supabase
        .from('seller_profiles')
        .update({
          seller_type: data.sellerType,
          business_name: data.businessName,
          business_registration_number: data.businessRegistrationNumber,
          tax_id: data.taxId,
          description: data.description,
          business_license_url: licenseUrl,
          verification_status: 'pending',
          verification_submitted_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-profile'] });
      toast({
        title: "Verification submitted",
        description: "Your verification application has been submitted for review",
      });
    },
    onError: (error) => {
      toast({
        title: "Error submitting verification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return { submitVerification };
};
