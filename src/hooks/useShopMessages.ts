import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";

export interface ShopConversation {
  id: string;
  item_id: string;
  item_title?: string;
  item_image?: string;
  buyer_id: string;
  seller_id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
}

export interface ShopMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  is_from_me: boolean;
  content: string;
  created_at: string;
}

export const useShopConversations = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const setupChannel = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('shop_conversations_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shop_conversations',
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['shop-conversations'] });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'shop_messages',
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['shop-conversations'] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupChannel();
  }, [queryClient]);

  return useQuery({
    queryKey: ['shop-conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: conversations, error } = await supabase
        .from('shop_conversations')
        .select(`
          *,
          shop_items(title, images),
          buyer:profiles!shop_conversations_buyer_id_fkey(id, name, avatar_url),
          seller:profiles!shop_conversations_seller_id_fkey(id, name, avatar_url)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Get last message for each conversation
      const conversationsWithMessages = await Promise.all(
        (conversations || []).map(async (conv) => {
          const { data: lastMessage } = await supabase
            .from('shop_messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const isUserBuyer = conv.buyer_id === user.id;
          const otherUser = isUserBuyer ? conv.seller : conv.buyer;

          return {
            id: conv.id,
            item_id: conv.item_id,
            item_title: (conv.shop_items as any)?.title,
            item_image: (conv.shop_items as any)?.images?.[0],
            buyer_id: conv.buyer_id,
            seller_id: conv.seller_id,
            other_user_id: (otherUser as any)?.id,
            other_user_name: (otherUser as any)?.name || 'Unknown',
            other_user_avatar: (otherUser as any)?.avatar_url || '',
            last_message: lastMessage?.content,
            last_message_at: lastMessage?.created_at || conv.created_at,
            created_at: conv.created_at,
          } as ShopConversation;
        })
      );

      return conversationsWithMessages;
    },
  });
};

export const useShopMessages = (conversationId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`shop_messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shop_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['shop-messages', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return useQuery({
    queryKey: ['shop-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: messages, error } = await supabase
        .from('shop_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (messages || []).map(msg => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        sender_id: msg.sender_id,
        is_from_me: msg.sender_id === user.id,
        content: msg.content,
        created_at: msg.created_at,
      })) as ShopMessage[];
    },
    enabled: !!conversationId,
  });
};

export const useShopMessageMutations = () => {
  const queryClient = useQueryClient();

  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('shop_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: message,
        });

      if (error) throw error;

      // Update last_message_at
      await supabase
        .from('shop_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shop-messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['shop-conversations'] });
    },
    onError: (error) => {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createConversation = useMutation({
    mutationFn: async ({ itemId, sellerId }: { itemId: string; sellerId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('shop_conversations')
        .select('id')
        .eq('item_id', itemId)
        .eq('buyer_id', user.id)
        .eq('seller_id', sellerId)
        .single();

      if (existing) return existing.id;

      // Create new conversation
      const { data, error } = await supabase
        .from('shop_conversations')
        .insert({
          item_id: itemId,
          buyer_id: user.id,
          seller_id: sellerId,
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-conversations'] });
    },
  });

  return { sendMessage, createConversation };
};
