import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { syncConversation, syncConversations } from "@/lib/sync";
import { chatDb } from "@/lib/db";
import { isActiveMute } from "@/lib/messageStatus";
import { toast } from "sonner";
export async function chatRpc<T = any>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as T;
}
export function useGroupMembers(
  conversationId: string,
  isOpen: boolean,
  currentUserId?: string,
) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["group-members", conversationId],
    enabled: isOpen,
    queryFn: async () => {
      const [
        { data: conv, error: convError },
        { data: admins, error: adminError },
        { data: rows, error: memberError },
      ] = await Promise.all([
        supabase
          .from("conversations")
          .select("created_by")
          .eq("id", conversationId)
          .single(),
        supabase
          .from("group_admins")
          .select("user_id")
          .eq("conversation_id", conversationId),
        supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", conversationId),
      ]);
      if (convError || adminError || memberError)
        throw convError || adminError || memberError;
      const ids = [...new Set((rows || []).map((row) => row.user_id))];
      if (!ids.length) return [];
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id,name,username,avatar_url,initials,avatar_color")
        .in("id", ids);
      if (error) throw error;
      const map = new Map(
        (profiles || []).map((profile) => [profile.id, profile]),
      );
      const adminIds = new Set((admins || []).map((row) => row.user_id));
      return ids.map((id) => ({
        ...map.get(id),
        id,
        name: map.get(id)?.name || map.get(id)?.username || "Member",
        is_creator: conv?.created_by === id,
        is_admin: adminIds.has(id) || conv?.created_by === id,
      }));
    },
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["group-members", conversationId] }),
      client.invalidateQueries({ queryKey: ["group-info", conversationId] }),
    ]);
    if (currentUserId)
      await syncConversations(currentUserId, true).catch(console.error);
  };
  const promoteToAdmin = useMutation({
    mutationFn: (userId: string) =>
      chatRpc("set_chat_group_admin", {
        p_conversation_id: conversationId,
        p_user_id: userId,
        p_admin: true,
      }),
    onSuccess: refresh,
  });
  const demoteAdmin = useMutation({
    mutationFn: (userId: string) =>
      chatRpc("set_chat_group_admin", {
        p_conversation_id: conversationId,
        p_user_id: userId,
        p_admin: false,
      }),
    onSuccess: refresh,
  });
  const addMembers = useMutation({
    mutationFn: (ids: string[]) =>
      chatRpc<number>("add_chat_group_members", {
        p_conversation_id: conversationId,
        p_member_ids: [...new Set(ids)],
      }),
    onSuccess: refresh,
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      chatRpc("remove_group_member", {
        _conversation_id: conversationId,
        _user_id: userId,
      }),
    onSuccess: refresh,
  });
  const leaveGroup = useMutation({
    mutationFn: (userId: string) =>
      chatRpc("remove_group_member", {
        _conversation_id: conversationId,
        _user_id: userId,
      }),
    onSuccess: async () => {
      await chatDb.conversations_meta.delete(conversationId);
      client.removeQueries({ queryKey: ["group-members", conversationId] });
      if (currentUserId)
        await syncConversations(currentUserId, true).catch(console.error);
    },
  });
  const transferOwnership = useMutation({
    mutationFn: (userId: string) =>
      chatRpc("transfer_chat_group_ownership", {
        p_conversation_id: conversationId,
        p_new_owner: userId,
      }),
    onSuccess: refresh,
  });
  return {
    members: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    promoteToAdmin,
    demoteAdmin,
    addMembers,
    removeMember,
    leaveGroup,
    transferOwnership,
  };
}
export function useGroupInfo(
  conversationId: string,
  isOpen: boolean,
  currentUserId?: string,
) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["group-info", conversationId],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("group_name,group_avatar_url,description,created_by")
        .eq("id", conversationId)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const refresh = async () => {
    await client.invalidateQueries({
      queryKey: ["group-info", conversationId],
    });
    if (currentUserId)
      await syncConversations(currentUserId, true).catch(console.error);
  };
  const updateDescription = useMutation({
    mutationFn: (description: string) =>
      chatRpc("update_chat_group", {
        p_conversation_id: conversationId,
        p_description: description,
      }),
    onSuccess: refresh,
  });
  const updateName = useMutation({
    mutationFn: (name: string) =>
      chatRpc("update_chat_group", {
        p_conversation_id: conversationId,
        p_name: name.trim(),
      }),
    onSuccess: refresh,
  });
  const updateAvatar = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (
        !file.type.startsWith("image/") ||
        !["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(ext || "")
      )
        throw new Error("Choose an image file");
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("group-avatars")
        .upload(path, file);
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from("group-avatars").getPublicUrl(path);
      await chatRpc("update_chat_group", {
        p_conversation_id: conversationId,
        p_avatar_url: publicUrl,
      });
      return publicUrl;
    },
    onSuccess: refresh,
  });
  return {
    groupInfo: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateDescription,
    updateName,
    updateAvatar,
  };
}
export function useGroupMute(
  conversationId: string,
  userId: string,
  enabled = true,
) {
  const client = useQueryClient(),
    [clock, setClock] = useState(Date.now());
  const query = useQuery({
    queryKey: ["group-mute", conversationId, userId],
    enabled: enabled && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_mutes")
        .select("muted_until")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });
  useEffect(() => {
    setClock(Date.now());
    const until = query.data?.muted_until;
    if (!until) return;
    const delay = Date.parse(until) - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.min(delay + 1, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [query.data?.muted_until]);
  const refresh = () =>
    client.invalidateQueries({
      queryKey: ["group-mute", conversationId, userId],
    });
  const mute = useMutation({
    mutationFn: async (duration: "1h" | "24h" | "forever") => {
      const until =
        duration === "forever"
          ? null
          : new Date(
              Date.now() + (duration === "1h" ? 3600000 : 86400000),
            ).toISOString();
      const { error } = await supabase.from("group_mutes").upsert(
        {
          conversation_id: conversationId,
          user_id: userId,
          muted_until: until,
        },
        { onConflict: "conversation_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const unmute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("group_mutes")
        .delete()
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return {
    isMuted: isActiveMute(query.data, clock),
    muteStatus: query.data?.muted_until,
    mute,
    unmute,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
export function useSharedMedia(conversationId: string, isOpen: boolean) {
  return useQuery({
    queryKey: ["group-shared-media", conversationId],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,attachment_url,message_type,created_at,sender_id")
        .eq("conversation_id", conversationId)
        .not("attachment_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}
export function useGroupPolls(
  conversationId: string,
  userId: string,
  isOpen: boolean,
) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["group-polls", conversationId],
    enabled: isOpen,
    queryFn: () =>
      chatRpc<any[]>("get_chat_group_polls", {
        p_conversation_id: conversationId,
      }),
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["group-polls", conversationId] }),
      client.invalidateQueries({ queryKey: ["poll-data"] }),
    ]);
  };
  const createPoll = useMutation({
    mutationFn: (poll: {
      question: string;
      options: string[];
      is_anonymous?: boolean;
      is_multiple_choice?: boolean;
      requestId: string;
    }) =>
      chatRpc("create_chat_group_poll", {
        p_conversation_id: conversationId,
        p_question: poll.question,
        p_options: poll.options,
        p_anonymous: !!poll.is_anonymous,
        p_multiple: !!poll.is_multiple_choice,
        p_request_id: poll.requestId,
      }),
    onSuccess: async () => {
      await refresh();
      await syncConversation(conversationId).catch(console.error);
    },
  });
  const endPoll = useMutation({
    mutationFn: (pollId: string) =>
      chatRpc("end_chat_group_poll", { p_poll_id: pollId }),
    onSuccess: refresh,
  });
  const vote = useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      chatRpc("set_chat_poll_vote", {
        p_poll_id: pollId,
        p_option_id: optionId,
        p_selected: true,
      }),
    onSuccess: refresh,
  });
  const unvote = useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      chatRpc("set_chat_poll_vote", {
        p_poll_id: pollId,
        p_option_id: optionId,
        p_selected: false,
      }),
    onSuccess: refresh,
  });
  return {
    polls: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createPoll,
    endPoll,
    vote,
    unvote,
  };
}
export function usePollData(pollId: string | null) {
  return useQuery({
    queryKey: ["poll-data", pollId],
    enabled: !!pollId,
    queryFn: () => chatRpc<any>("get_chat_group_poll", { p_poll_id: pollId }),
    refetchInterval: 10000,
  });
}
export function useVoterInsights(pollId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["voter-insights", pollId],
    enabled: enabled && !!pollId,
    queryFn: () =>
      chatRpc<any[]>("get_chat_poll_voters", { p_poll_id: pollId }),
  });
}
