import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreateDisputeData {
  orderId: string;
  sellerId: string;
  reason: string;
  description: string;
}

interface UpdateDisputeData {
  disputeId: string;
  status?: string;
  resolution?: string;
}

export const useDisputes = () => {
  const queryClient = useQueryClient();

  // Fetch user's disputes (as buyer or seller)
  const { data: disputes, isLoading } = useQuery({
    queryKey: ['disputes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          orders (
            id,
            total,
            created_at
          ),
          buyer:profiles!disputes_buyer_id_fkey (
            id,
            name,
            avatar_url
          ),
          seller:profiles!disputes_seller_id_fkey (
            id,
            name,
            avatar_url
          )
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create dispute
  const createDispute = useMutation({
    mutationFn: async (data: CreateDisputeData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('disputes')
        .insert({
          order_id: data.orderId,
          buyer_id: user.id,
          seller_id: data.sellerId,
          reason: data.reason,
          description: data.description,
          status: 'open',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast({
        title: "Dispute created",
        description: "Your dispute has been submitted. We'll review it shortly.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating dispute",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update dispute
  const updateDispute = useMutation({
    mutationFn: async (data: UpdateDisputeData) => {
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      if (data.status) updates.status = data.status;
      if (data.resolution) updates.resolution = data.resolution;
      if (data.status === 'resolved') updates.resolved_at = new Date().toISOString();

      const { error } = await supabase
        .from('disputes')
        .update(updates)
        .eq('id', data.disputeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast({
        title: "Dispute updated",
        description: "The dispute status has been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating dispute",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    disputes,
    isLoading,
    createDispute,
    updateDispute,
  };
};
