import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SharedMessage } from "@/lib/messagingPresentation";
import { useUser } from "@/contexts/UserContext";
export function useSharedChatHistory(
  conversationId: string | undefined,
  enabled: boolean,
) {
  const { user } = useUser();
  const query = useInfiniteQuery({
    queryKey: ["chat-shared-history", conversationId, user?.id],
    initialPageParam: 0,
    enabled: enabled && !!conversationId && !!user?.id,
    queryFn: async ({
      pageParam,
    }): Promise<{ messages: SharedMessage[]; hasMore: boolean }> => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, content, message_type, attachment_url, conversation_id, sender_id, created_at, deleted_for_everyone",
        )
        .eq("conversation_id", conversationId!)
        .eq("deleted_for_everyone", false)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(pageParam, pageParam + 49);
      if (error) throw error;
      if (!data?.length) return { messages: [], hasMore: false };
      const { data: deletions, error: deletionError } = await supabase
        .from("message_deletions")
        .select("message_id")
        .eq("user_id", user!.id)
        .in(
          "message_id",
          data.map((message) => message.id),
        );
      if (deletionError) throw deletionError;
      const removed = new Set(
        (deletions || []).map((deletion) => deletion.message_id),
      );
      return {
        messages: data.filter((message) => !removed.has(message.id)),
        hasMore: data.length === 50,
      };
    },
    getNextPageParam: (last, pages) =>
      last.hasMore ? pages.length * 50 : undefined,
  });
  return {
    ...query,
    messages: query.data?.pages.flatMap((page) => page.messages) || [],
  };
}
