import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface GroupBuy {
  id: string;
  item_id: string;
  min_participants: number;
  current_participants: number;
  discount_percentage: number;
  end_time: string;
  status: string;
  user_joined: boolean;
  item: {
    id: string;
    title: string;
    images: string[];
    price: number;
    category: string;
  };
}

export const useGroupBuys = () => {
  return useQuery({
    queryKey: ['group-buys'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const now = new Date().toISOString();
      
      const { data: groupBuys, error } = await supabase
        .from('group_buys')
        .select(`
          *,
          shop_items!inner(
            id,
            title,
            images,
            price,
            category
          )
        `)
        .eq('status', 'active')
        .gte('end_time', now);

      if (error) throw error;

      // Check which group buys the user has joined
      const groupBuyIds = (groupBuys || []).map(gb => gb.id);
      let userParticipations: string[] = [];

      if (user && groupBuyIds.length > 0) {
        const { data: participations } = await supabase
          .from('group_buy_participants')
          .select('group_buy_id')
          .eq('user_id', user.id)
          .in('group_buy_id', groupBuyIds);

        userParticipations = (participations || []).map(p => p.group_buy_id);
      }

      return (groupBuys || []).map(gb => ({
        id: gb.id,
        item_id: gb.item_id,
        min_participants: gb.min_participants,
        current_participants: gb.current_participants,
        discount_percentage: gb.discount_percentage,
        end_time: gb.end_time,
        status: gb.status,
        user_joined: userParticipations.includes(gb.id),
        item: {
          id: (gb.shop_items as any).id,
          title: (gb.shop_items as any).title,
          images: (gb.shop_items as any).images,
          price: Number((gb.shop_items as any).price),
          category: (gb.shop_items as any).category,
        }
      })) as GroupBuy[];
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const useGroupBuyMutations = () => {
  const queryClient = useQueryClient();

  const joinGroupBuy = useMutation({
    mutationFn: async (groupBuyId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('group_buy_participants')
        .insert({
          group_buy_id: groupBuyId,
          user_id: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      toast({
        title: "Joined group buy!",
        description: "You'll get the discount when minimum participants is reached",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error joining group buy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const leaveGroupBuy = useMutation({
    mutationFn: async (groupBuyId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('group_buy_participants')
        .delete()
        .eq('group_buy_id', groupBuyId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-buys'] });
      toast({
        title: "Left group buy",
      });
    },
  });

  return { joinGroupBuy, leaveGroupBuy };
};
